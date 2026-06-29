"""Unit tests for password hashing and JWT tokens (no DB, no model load)."""

from __future__ import annotations

import jwt

from app.config import settings
from app.security import create_token, decode_token, hash_password, verify_password


def test_hash_roundtrip_and_uniqueness():
    h1 = hash_password("hunter2")
    h2 = hash_password("hunter2")
    assert h1 != h2                      # per-hash salt
    assert verify_password("hunter2", h1)
    assert verify_password("hunter2", h2)


def test_wrong_password_rejected():
    h = hash_password("correct horse")
    assert not verify_password("wrong", h)
    assert not verify_password("", h)


def test_long_password_truncated_not_crashed():
    # bcrypt's 72-byte limit must be handled, not raised.
    pw = "a" * 200
    h = hash_password(pw)
    assert verify_password(pw, h)


def test_token_roundtrip():
    token = create_token(42)
    assert decode_token(token) == 42


def test_tampered_token_rejected():
    token = create_token(7)
    assert decode_token(token + "x") is None
    assert decode_token("not.a.jwt") is None


def test_token_signed_with_other_secret_rejected():
    forged = jwt.encode({"sub": "1"}, "some-other-secret", algorithm="HS256")
    assert decode_token(forged) is None


def test_expired_token_rejected():
    import datetime as dt

    expired = jwt.encode(
        {"sub": "1", "exp": dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=1)},
        settings.jwt_secret,
        algorithm="HS256",
    )
    assert decode_token(expired) is None
