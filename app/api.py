"""FastAPI service exposing the Reverie recommender to the React frontend.

Wraps src/recommend.py (stack-agnostic inference). Loads the model + movie
titles once at startup and warms it so the first user request is fast.   [M6]

Run (dev):  uvicorn app.api:app --reload --port 8000
"""

from __future__ import annotations

import contextlib
import io
import json
import math
import os
import tempfile

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src import importers
from src import recommend as rec

MOVIES_DAT = "data/ml-1m/movies.dat"
POSTERS_JSON = "artifacts/posters.json"

_titles: dict[int, dict] = {}
_posters: dict[int, dict] = {}

# Netflix-style match-% display band. The raw model score is a softmax
# probability (max ~0.05), which is meaningless to a user; we map the returned
# top-N onto a familiar 80-99% band by relative (log) strength.   [demo polish]
_MATCH_CEIL = 0.99
_MATCH_FLOOR = 0.80


def _load_titles() -> None:
    """movieId -> {title, year, genres} for recommendable items only."""
    st = rec.load()
    recommendable = set(st["movie_to_id"].keys())
    with open(MOVIES_DAT, encoding="latin-1") as fh:
        for line in fh:
            mid_str, title, genres = line.rstrip("\n").split("::")
            mid = int(mid_str)
            if mid in recommendable:
                year = title[-5:-1] if title.endswith(")") else ""
                _titles[mid] = {
                    "movieId": mid,
                    "title": title[:-7].strip() if year else title,
                    "year": year,
                    "genres": genres.split("|"),
                }


def _load_posters() -> None:
    """movieId -> {poster_url, backdrop_url} from the prebuilt TMDB cache.

    Optional: the API serves fine (gradient fallbacks in the UI) if the file
    is absent, e.g. before build_posters.py has been run.
    """
    p = Path(POSTERS_JSON)
    if not p.exists():
        return
    with open(p, encoding="utf-8") as fh:
        raw = json.load(fh)
    for k, v in raw.items():
        _posters[int(k)] = {
            "poster_url": v.get("poster_url"),
            "backdrop_url": v.get("backdrop_url"),
        }


@asynccontextmanager
async def lifespan(_: FastAPI):
    _load_titles()
    _load_posters()
    rec.recommend_movies([])  # warm the model graph before the first request
    yield


app = FastAPI(title="Reverie API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"], allow_headers=["*"],
)


class HistItem(BaseModel):
    movieId: int
    rating: float = 4.0  # stars


class RecRequest(BaseModel):
    history: list[HistItem] = []
    n: int = 12


def _enrich(movie_id: int, score: float | None = None) -> dict:
    """Title + genre + poster metadata for a movie; optional raw model score."""
    meta = _titles.get(
        movie_id, {"movieId": movie_id, "title": str(movie_id), "year": "", "genres": []}
    )
    poster = _posters.get(movie_id, {"poster_url": None, "backdrop_url": None})
    out = {**meta, **poster}
    if score is not None:
        out["score"] = round(float(score), 4)
    return out


def _match_scores(scores: list[float]) -> list[int]:
    """Map raw softmax scores onto a Netflix-style 80-99% match band.

    Monotonic in score: the strongest pick anchors near 99%, the weakest of the
    returned set near 80%, with a log scale so the long softmax tail decays
    gently rather than collapsing to a single number. Degenerate inputs
    (one item, or all-equal scores) return the ceiling.
    """
    logs = [math.log(s) if s > 0 else None for s in scores]
    finite = [l for l in logs if l is not None]
    if not finite:
        return [round(_MATCH_CEIL * 100)] * len(scores)
    hi, lo = max(finite), min(finite)
    if hi == lo:
        return [round(_MATCH_CEIL * 100)] * len(scores)
    out: list[int] = []
    for l in logs:
        if l is None:
            out.append(round(_MATCH_FLOOR * 100))
        else:
            r = (l - lo) / (hi - lo)
            out.append(round((_MATCH_FLOOR + (_MATCH_CEIL - _MATCH_FLOOR) * r) * 100))
    return out


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "catalog_size": len(_titles), "posters": len(_posters)}


@app.get("/catalog")
def catalog(q: str = "", limit: int = 20, genre: str = "") -> list[dict]:
    """Title search for building a watch history (autocomplete), with an
    optional genre filter used to populate the genre rows in the UI."""
    ql = q.lower().strip()
    gl = genre.strip()
    items = (
        m for m in _titles.values()
        if (not ql or ql in m["title"].lower())
        and (not gl or gl in m["genres"])
    )
    out = sorted(items, key=lambda m: m["title"])[:limit]
    return [_enrich(m["movieId"]) for m in out]


@app.post("/recommend")
def recommend(req: RecRequest) -> dict:
    history = [(h.movieId, h.rating) for h in req.history]
    recs = rec.recommend_movies(history, n=req.n)
    matches = _match_scores([s for _, s in recs])
    taste = rec.taste_vector(history) if history else None
    st = rec.load()
    return {
        "recommendations": [
            {**_enrich(mid, s), "match": m} for (mid, s), m in zip(recs, matches)
        ],
        "taste": None if taste is None else {
            g: round(float(v), 4) for g, v in zip(st["cfg"]["genre_names"], taste)
        },
    }


def _detect_source(header: str, source: str) -> str:
    """Classify an uploaded CSV by its header row. Letterboxd exports carry
    Name + Rating; Netflix ViewingActivity carries Title + Start Time."""
    if source != "auto":
        return source
    h = header.lower()
    if "name" in h and "rating" in h:
        return "letterboxd"
    if "title" in h and ("start time" in h or "profile name" in h or "duration" in h):
        return "netflix"
    raise HTTPException(
        status_code=400,
        detail="Unrecognized CSV format (expected Letterboxd ratings.csv or Netflix ViewingActivity.csv)",
    )


def _temp_csv(raw: bytes) -> str:
    """Write uploaded bytes to a temp file in the SYSTEM temp dir (never the
    repo) so the path-based importers can read it. Caller must unlink."""
    tf = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    try:
        tf.write(raw)
    finally:
        tf.close()
    return tf.name


@app.post("/import")
async def import_watchlist(
    file: UploadFile = File(...),
    ratings_file: UploadFile | None = File(None),
    source: str = Form("auto"),
) -> dict:
    """Turn a Letterboxd / Netflix export into a Reverie watch history.

    Privacy: the upload is processed from a system temp file that is deleted
    immediately afterwards; nothing is written under the repo and file contents
    are never logged (importer stdout is captured and discarded).
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    text = raw.decode("utf-8-sig", errors="replace")
    lines = text.splitlines()
    header = lines[0] if lines else ""
    total = max(0, len(lines) - 1)  # data rows (minus header)
    detected = _detect_source(header, source)

    movie_to_id = rec.load()["movie_to_id"]
    sink = io.StringIO()  # swallow importer prints (privacy + noise)

    if detected == "letterboxd":
        path = _temp_csv(raw)
        try:
            with contextlib.redirect_stdout(sink):
                pairs = importers.load_letterboxd(path, movie_to_id, MOVIES_DAT)
        finally:
            os.unlink(path)
    else:  # netflix
        view_path = _temp_csv(raw)
        ratings_path = None
        if ratings_file is not None:
            rraw = await ratings_file.read()
            ratings_path = _temp_csv(rraw) if rraw else None
        try:
            with contextlib.redirect_stdout(sink):
                movies_hist, _tv = importers.load_netflix(
                    view_path, movie_to_id,
                    ratings_path=ratings_path, movies_dat_path=MOVIES_DAT,
                )
            pairs = movies_hist
        finally:
            os.unlink(view_path)
            if ratings_path:
                os.unlink(ratings_path)

    history = [
        {**_enrich(mid), "rating": round(float(stars), 1)} for mid, stars in pairs
    ]
    return {
        "source": detected,
        "total": total,
        "matched": len(history),
        "history": history,
    }
