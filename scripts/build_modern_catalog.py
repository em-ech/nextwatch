"""Build the app's modern catalog from the Letterboxd metadata (samlearner).

The web app used to browse MovieLens ml-1m (films up to the year 2000). This
swaps it onto a modern catalog: the films the collaborative NCF model actually
knows (its vocab) that also carry a TMDB id and a poster, keyed by tmdb_id so
the app's movie ids stay integers. Posters come straight from the dataset's
Letterboxd CDN path, so no TMDB API key is needed.

One-time data step. The big CSV stays in ~/Downloads (passed by path); output
lands in artifacts/modern/ (gitignored).

Usage
-----
    conda activate deep-learning
    python -m scripts.build_modern_catalog \
        --movies ~/Downloads/movie_data.csv \
        --ncf artifacts/ncf --limit 8000 --min-votes 50 --out artifacts/modern
"""

from __future__ import annotations

import argparse
import ast
import json
import os

import pandas as pd

LTRBXD_BASE = "https://a.ltrbxd.com/resized/"


def _poster_url(image_url) -> str | None:
    if not isinstance(image_url, str) or not image_url.strip():
        return None
    return f"{LTRBXD_BASE}{image_url}.jpg"


def _genres(s) -> list[str]:
    if not isinstance(s, str) or not s.strip():
        return []
    for parser in (json.loads, ast.literal_eval):
        try:
            v = parser(s)
            return [str(g) for g in v] if isinstance(v, list) else []
        except (ValueError, SyntaxError):
            continue
    return []


def _year(v) -> str:
    y = pd.to_numeric(v, errors="coerce")
    return "" if pd.isna(y) else str(int(y))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--movies", required=True)
    ap.add_argument("--ncf", default="artifacts/ncf")
    ap.add_argument("--limit", type=int, default=8000, help="max films, ranked by popularity")
    ap.add_argument("--min-votes", type=int, default=50)
    ap.add_argument("--out", default="artifacts/modern")
    args = ap.parse_args()

    with open(f"{args.ncf}/movie_index.json") as fh:
        vocab = set(json.load(fh).keys()) - {"<UNK>"}
    print(f"NCF vocab: {len(vocab):,} slugs the model can score")

    cols = ["movie_id", "tmdb_id", "movie_title", "year_released", "genres",
            "image_url", "vote_average", "vote_count", "popularity"]
    mv = pd.read_csv(args.movies, usecols=cols, engine="python", on_bad_lines="skip")

    mv = mv[mv["movie_id"].isin(vocab)]                          # model must know it
    mv = mv.dropna(subset=["tmdb_id", "image_url", "movie_title"])  # need id + poster
    mv = mv[pd.to_numeric(mv["vote_count"], errors="coerce").fillna(0) >= args.min_votes]
    mv["popularity"] = pd.to_numeric(mv["popularity"], errors="coerce").fillna(0.0)
    mv["tmdb_id"] = pd.to_numeric(mv["tmdb_id"], errors="coerce")
    mv = mv.dropna(subset=["tmdb_id"])
    mv["tmdb_id"] = mv["tmdb_id"].astype(int)

    # Dedupe (a tmdb_id or slug can recur): keep the most-voted row.
    mv["_vc"] = pd.to_numeric(mv["vote_count"], errors="coerce").fillna(0)
    mv = mv.sort_values("_vc", ascending=False).drop_duplicates("tmdb_id").drop_duplicates("movie_id")
    mv = mv.sort_values("popularity", ascending=False).head(args.limit)
    print(f"kept {len(mv):,} films (>= {args.min_votes} votes, top {args.limit} by popularity)")

    catalog: dict[str, dict] = {}
    slug_to_tmdb: dict[str, int] = {}
    n_post2000 = 0
    for _, r in mv.iterrows():
        tid = int(r["tmdb_id"])
        yr = _year(r["year_released"])
        if yr and int(yr) > 2000:
            n_post2000 += 1
        catalog[str(tid)] = {
            "movieId": tid,
            "title": str(r["movie_title"]),
            "year": yr,
            "genres": _genres(r["genres"]),
            "rating": None if pd.isna(r["vote_average"]) else round(float(r["vote_average"]), 1),
            "poster_url": _poster_url(r["image_url"]),
            "slug": str(r["movie_id"]),
        }
        slug_to_tmdb[str(r["movie_id"])] = tid

    os.makedirs(args.out, exist_ok=True)
    with open(f"{args.out}/catalog.json", "w") as fh:
        json.dump(catalog, fh)
    with open(f"{args.out}/slug_to_tmdb.json", "w") as fh:
        json.dump(slug_to_tmdb, fh)

    print(f"Done. -> {args.out}/catalog.json")
    print(f"  {len(catalog):,} films | {n_post2000:,} from after 2000 "
          f"({100 * n_post2000 / max(len(catalog), 1):.0f}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
