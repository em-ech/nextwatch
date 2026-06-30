"""Serving seam for the collaborative NCF model: rank the modern catalog for a
viewer's watch history.

A brand-new app user is not in the model's trained user table, so we **fold in**
a fresh user embedding + bias: freeze every trained weight and fit just the new
user's 50-dim vector (and bias) to their rated films with a few gradient steps,
then rank the catalog by the model's predicted rating. Films map
tmdb_id <-> Letterboxd slug <-> the model's integer index.

    from src import ncf_recommend as ncf
    ncf.rank_for_history([(550, 4.5), (27205, 5.0)], n=12, exclude=[550])
"""

from __future__ import annotations

import functools
import json

import numpy as np
import tensorflow as tf
from tensorflow.keras import Input, Model, layers

from src.ncf_data import load_features, load_meta
from src.ncf_model import build_ncf

NCF_DIR = "artifacts/ncf"
MODERN_DIR = "artifacts/modern"
EMB_DIM = 50


def _stars_to_scale(stars: float) -> float:
    """Letterboxd stars (0.5-5) -> the model's 1-10 rating scale."""
    return float(min(max(stars * 2.0, 1.0), 10.0))


@functools.lru_cache(maxsize=1)
def load() -> dict:
    """Load the trained model, a fold-in inference graph, and the catalog maps.
    Cached: the heavy work happens once per process."""
    meta = load_meta(NCF_DIR)
    feats = load_features(NCF_DIR)
    with open(f"{NCF_DIR}/model_config.json") as fh:
        cfg = json.load(fh)
    gmean = float(meta["global_mean"])

    model = build_ncf(meta["n_users"], meta["n_movies"], feats,
                      emb_dim=cfg["emb_dim"], global_mean=gmean)
    model.load_weights(f"{NCF_DIR}/ncf.weights.h5")
    foldin = _build_foldin_model(model, gmean)

    with open(f"{NCF_DIR}/movie_index.json") as fh:
        movie_index = json.load(fh)  # slug -> idx
    with open(f"{MODERN_DIR}/slug_to_tmdb.json") as fh:
        slug_to_tmdb = json.load(fh)
    with open(f"{MODERN_DIR}/catalog.json") as fh:
        catalog = json.load(fh)  # already popularity-ordered

    # Modern-catalog films the model can actually score (have an embedding idx).
    tmdb_to_idx: dict[int, int] = {}
    idx_to_tmdb: dict[int, int] = {}
    for slug, tmdb in slug_to_tmdb.items():
        idx = movie_index.get(slug)
        if idx:
            tmdb_to_idx[int(tmdb)] = idx
            idx_to_tmdb[idx] = int(tmdb)
    cand_idx = np.array(sorted(idx_to_tmdb), dtype=np.int32)
    popular_tmdb = [int(t) for t in catalog]  # catalog.json insertion order
    # L2-normalized movie embeddings for item-item similarity (the well-trained
    # item space; far more coherent than a cold fold-in on a few films).
    memb = model.get_layer("movie_emb").get_weights()[0]
    memb_norm = memb / (np.linalg.norm(memb, axis=1, keepdims=True) + 1e-9)

    # Per-movie genre multi-hot (anchors genre-strong tastes; the embedding space
    # alone drifts toward a co-rating arthouse cluster).
    genre_names = meta["genre_names"]
    gidx = {g: i for i, g in enumerate(genre_names)}
    gmat = np.zeros((meta["n_movies"], len(genre_names)), dtype=np.float32)
    for tmdb, entry in catalog.items():
        idx = tmdb_to_idx.get(int(tmdb))
        if idx is not None:
            for g in entry["genres"]:
                if g in gidx:
                    gmat[idx, gidx[g]] = 1.0

    return {
        "model": model, "foldin": foldin, "global_mean": gmean,
        "tmdb_to_idx": tmdb_to_idx, "idx_to_tmdb": idx_to_tmdb,
        "cand_idx": cand_idx, "popular_tmdb": popular_tmdb,
        "memb_norm": memb_norm, "gmat": gmat, "genre_names": genre_names,
    }


def genre_names() -> list[str]:
    """The model's genre vocabulary (for taste vectors / the Blend radar)."""
    return load()["genre_names"]


def _build_foldin_model(model: Model, global_mean: float) -> Model:
    """An inference graph that takes a user embedding + bias DIRECTLY (instead of
    a user id) and reuses every trained movie-side and dense layer. Dropout is
    omitted (identity at inference)."""
    u_emb_in = Input(shape=(EMB_DIM,), name="u_emb")
    u_bias_in = Input(shape=(1,), name="u_bias")
    m_in = Input(shape=(1,), dtype="int32", name="movie")

    m_emb = layers.Flatten()(model.get_layer("movie_emb")(m_in))
    content = layers.Flatten()(model.get_layer("content")(m_in))
    m_bias = layers.Flatten()(model.get_layer("movie_bias")(m_in))

    x = layers.Concatenate()([u_emb_in, m_emb, content])
    x = model.get_layer("dense")(x)
    x = model.get_layer("dense_1")(x)
    mlp = model.get_layer("mlp_out")(x)
    out = layers.Add()([mlp, u_bias_in, m_bias])
    out = layers.Lambda(lambda t: t + global_mean)(out)
    return Model([u_emb_in, u_bias_in, m_in], out)


def _fold_in_user(
    foldin: Model,
    rated_idx: np.ndarray,
    rated_scale: np.ndarray,
    steps: int = 150,
    lr: float = 0.05,
    l2: float = 1e-3,
) -> tuple[np.ndarray, float]:
    """Fit a fresh (user embedding, user bias) to the user's rated films with the
    rest of the network frozen. A small MSE optimization in the 50-dim space."""
    u = tf.Variable(tf.zeros([1, EMB_DIM]))
    b = tf.Variable(tf.zeros([1, 1]))
    opt = tf.optimizers.Adam(lr)
    m = tf.constant(rated_idx.reshape(-1, 1))
    y = tf.constant(rated_scale.reshape(-1, 1).astype(np.float32))
    k = int(rated_idx.shape[0])

    for _ in range(steps):
        with tf.GradientTape() as tape:
            pred = foldin(
                [tf.tile(u, [k, 1]), tf.tile(b, [k, 1]), m], training=False
            )
            loss = tf.reduce_mean((pred - y) ** 2) + l2 * tf.reduce_sum(u ** 2)
        grads = tape.gradient(loss, [u, b])
        opt.apply_gradients(zip(grads, [u, b]))
    return u.numpy()[0], float(b.numpy()[0, 0])


def _zscore(a: np.ndarray) -> np.ndarray:
    return (a - a.mean()) / (a.std() + 1e-9)


def rank_for_history(
    history: list[tuple[int, float]],
    n: int = 12,
    exclude: list[int] | None = None,
    sim_weight: float = 0.7,
) -> list[tuple[int, float]]:
    """history: list of (tmdb_id, stars 0.5-5). Returns the top-n (tmdb_id,
    predicted_rating 1-10), seen + excluded films removed.

    Hybrid ranking: a rating-centered **item-item** direction over the trained
    movie embeddings (films you rated above the midpoint pull toward, below push
    away) blended with the **fold-in** predicted rating as a quality term. The
    item space is robust where a cold fold-in alone is noisy; the fold-in adds
    the quality signal and the displayed match score."""
    st = load()
    tmdb_to_idx = st["tmdb_to_idx"]
    memb_norm = st["memb_norm"]
    exclude_set = {int(t) for t in (exclude or [])}

    rated_idx, rated_scale = [], []
    for tmdb, stars in history:
        idx = tmdb_to_idx.get(int(tmdb))
        if idx is not None:
            rated_idx.append(idx)
            rated_scale.append(_stars_to_scale(stars))
        exclude_set.add(int(tmdb))

    # Cold start (no scorable history): popularity order, minus excluded.
    if not rated_idx:
        out = [t for t in st["popular_tmdb"] if t not in exclude_set][:n]
        return [(t, st["global_mean"]) for t in out]

    rated_idx = np.array(rated_idx, np.int32)
    rated_scale = np.array(rated_scale, np.float32)

    # Item-item taste direction: weight each rated film by how far above the
    # rating midpoint it sits, so dislikes push the direction away.
    weights = rated_scale - 5.5
    u_dir = (memb_norm[rated_idx] * weights[:, None]).sum(0)
    if np.linalg.norm(u_dir) < 1e-6:  # all ratings at the midpoint -> plain mean
        u_dir = memb_norm[rated_idx].mean(0)
    u_dir = u_dir / (np.linalg.norm(u_dir) + 1e-9)

    # Genre affinity from the films the viewer liked (rated above the midpoint).
    gmat = st["gmat"]
    pos = np.maximum(rated_scale - 5.5, 0.0)
    g_dir = (gmat[rated_idx] * pos[:, None]).sum(0)
    g_norm = np.linalg.norm(g_dir)
    use_genre = g_norm > 1e-6
    if use_genre:
        g_dir = g_dir / g_norm

    u_emb, u_bias = _fold_in_user(st["foldin"], rated_idx, rated_scale)

    seen_idx = set(rated_idx.tolist()) | {
        tmdb_to_idx[t] for t in exclude_set if t in tmdb_to_idx
    }
    cand = np.array([i for i in st["cand_idx"] if i not in seen_idx], dtype=np.int32)
    if cand.size == 0:
        return []

    k = int(cand.shape[0])
    sim = memb_norm[cand] @ u_dir
    preds = st["foldin"].predict(
        [np.tile(u_emb, (k, 1)), np.tile([[u_bias]], (k, 1)), cand.reshape(-1, 1)],
        verbose=0, batch_size=4096,
    ).ravel()
    # Blend: collaborative item space + genre anchor + fold-in quality.
    score = sim_weight * _zscore(sim) + (1.0 - sim_weight) * _zscore(preds)
    if use_genre:
        cg = gmat[cand]
        cg = cg / (np.linalg.norm(cg, axis=1, keepdims=True) + 1e-9)
        score = 0.65 * score + 0.35 * _zscore(cg @ g_dir)
    top = np.argsort(-score)[:n]
    idx_to_tmdb = st["idx_to_tmdb"]
    return [(idx_to_tmdb[int(cand[i])], float(min(max(preds[i], 1.0), 10.0))) for i in top]


def taste_genres(history, genres_of) -> dict[str, float]:
    """A rating-weighted genre profile over the seen films, for the taste radar +
    blurb. genres_of: callable mapping a tmdb_id to its list of genre names."""
    acc: dict[str, float] = {}
    total = 0.0
    for tmdb, stars in history:
        w = _stars_to_scale(stars)
        total += w
        for g in genres_of(int(tmdb)):
            acc[g] = acc.get(g, 0.0) + w
    if total <= 0:
        return {}
    return {g: round(v / total, 4) for g, v in acc.items()}
