"""Per-user watchlist (the 'want to watch' swipe). Saved films the user has not
seen yet; unlike history it carries no rating and never feeds the recommender."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import enrich
from app.db import get_db
from app.deps import get_current_user
from app.models import User, WatchlistItem
from app.schemas import WatchlistAddRequest

router = APIRouter(prefix="/me", tags=["watchlist"])


def _enriched_watchlist(db: Session, user_id: int) -> list[dict]:
    rows = db.scalars(
        select(WatchlistItem)
        .where(WatchlistItem.user_id == user_id)
        .order_by(WatchlistItem.added_at.desc())
    ).all()
    return [enrich.enrich(r.movie_id) for r in rows]


@router.get("/watchlist")
def get_watchlist(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return {"watchlist": _enriched_watchlist(db, user.id)}


@router.post("/watchlist")
def add_watchlist(
    req: WatchlistAddRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if req.movieId not in enrich.recommendable_ids():
        raise HTTPException(status_code=400, detail="Movie not in the catalog")
    existing = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.user_id == user.id, WatchlistItem.movie_id == req.movieId
        )
    )
    if existing is None:  # idempotent: adding twice is a no-op
        db.add(WatchlistItem(user_id=user.id, movie_id=req.movieId))
        db.commit()
    return {"watchlist": _enriched_watchlist(db, user.id)}


@router.delete("/watchlist/{movie_id}")
def remove_watchlist(
    movie_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    db.execute(
        delete(WatchlistItem).where(
            WatchlistItem.user_id == user.id, WatchlistItem.movie_id == movie_id
        )
    )
    db.commit()
    return {"watchlist": _enriched_watchlist(db, user.id)}
