"""ORM models: User, HistoryItem, Friendship."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    # lower(username) for case-insensitive lookup + search
    username_ci: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    history: Mapped[list["HistoryItem"]] = relationship(
        back_populates="user", cascade="all, delete-orphan",
    )


class HistoryItem(Base):
    """A movie in a user's watch history. `position` is the canonical ordered
    sequence the GRU consumes (0,1,2,...); append at max(position)+1."""

    __tablename__ = "history_items"
    __table_args__ = (
        UniqueConstraint("user_id", "movie_id", name="uq_user_movie"),
        Index("ix_hist_user_pos", "user_id", "position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    movie_id: Mapped[int] = mapped_column(Integer, nullable=False)  # original MovieLens id
    rating: Mapped[float] = mapped_column(Float, default=4.0, nullable=False)  # stars 0.5-5
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="history")


class Friendship(Base):
    """One row per ordered (requester, addressee) pair. A friendship is active
    when a single accepted row exists in either direction."""

    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_friend_pair"),
        CheckConstraint("requester_id <> addressee_id", name="ck_no_self_friend"),
        Index("ix_friend_addressee", "addressee_id", "status"),
        Index("ix_friend_requester", "requester_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    addressee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
