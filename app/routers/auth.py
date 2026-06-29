"""Registration, login, and the current-user profile."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Friendship, HistoryItem, User
from app.schemas import (
    AuthResponse,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    UserOut,
)
from app.security import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, username=user.username, display_name=user.display_name)


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    ci = req.username.lower()
    if db.scalar(select(User).where(User.username_ci == ci)):
        raise HTTPException(status_code=409, detail="Username already taken")
    user = User(
        username=req.username,
        username_ci=ci,
        password_hash=hash_password(req.password),
        display_name=req.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(token=create_token(user.id), user=_user_out(user))


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.username_ci == req.username.lower()))
    # Generic error on both unknown-user and bad-password (no enumeration).
    if user is None or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return AuthResponse(token=create_token(user.id), user=_user_out(user))


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MeResponse:
    history_count = db.scalar(
        select(func.count()).select_from(HistoryItem).where(HistoryItem.user_id == user.id)
    )
    friend_count = db.scalar(
        select(func.count()).select_from(Friendship).where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == user.id, Friendship.addressee_id == user.id),
        )
    )
    return MeResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        history_count=history_count or 0,
        friend_count=friend_count or 0,
    )
