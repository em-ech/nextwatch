"""Schema + ordering tests for the watch-history store.

Uses an in-memory SQLite engine so it runs fast and never touches reverie.db
or loads TensorFlow.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import Base
from app.models import Friendship, HistoryItem, User


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _user(db: Session, name: str) -> User:
    u = User(username=name, username_ci=name.lower(), password_hash="x")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _append(db: Session, user_id: int, movie_id: int, rating: float = 4.0) -> None:
    next_pos = db.scalar(
        select(func.coalesce(func.max(HistoryItem.position), -1)).where(
            HistoryItem.user_id == user_id
        )
    )
    db.add(HistoryItem(user_id=user_id, movie_id=movie_id, rating=rating, position=next_pos + 1))
    db.commit()


def test_history_keeps_insertion_order(db):
    u = _user(db, "em")
    for mid in (858, 1213, 296, 50):
        _append(db, u.id, mid)
    rows = db.scalars(
        select(HistoryItem).where(HistoryItem.user_id == u.id).order_by(HistoryItem.position)
    ).all()
    assert [r.movie_id for r in rows] == [858, 1213, 296, 50]
    assert [r.position for r in rows] == [0, 1, 2, 3]


def test_duplicate_movie_rejected_by_unique_constraint(db):
    u = _user(db, "em")
    _append(db, u.id, 858)
    db.add(HistoryItem(user_id=u.id, movie_id=858, rating=5.0, position=1))
    with pytest.raises(IntegrityError):
        db.commit()


def test_two_users_have_independent_positions(db):
    a, b = _user(db, "a"), _user(db, "b")
    _append(db, a.id, 858)
    _append(db, b.id, 296)
    assert db.scalar(select(HistoryItem.position).where(HistoryItem.user_id == a.id)) == 0
    assert db.scalar(select(HistoryItem.position).where(HistoryItem.user_id == b.id)) == 0


def test_self_friendship_rejected(db):
    u = _user(db, "em")
    db.add(Friendship(requester_id=u.id, addressee_id=u.id, status="pending"))
    with pytest.raises(IntegrityError):
        db.commit()
