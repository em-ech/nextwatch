"""FastAPI dependencies: DB session + current-user resolution from a Bearer token."""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.security import decode_token


def _user_from_auth(authorization: str | None, db: Session) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    user_id = decode_token(authorization[7:].strip())
    if user_id is None:
        return None
    return db.get(User, user_id)


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    user = _user_from_auth(authorization, db)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def get_current_user_optional(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of 401, so endpoints can
    stay public (e.g. /recommend) while still personalizing when logged in."""
    return _user_from_auth(authorization, db)
