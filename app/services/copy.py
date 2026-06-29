"""Shared copy helpers for human-readable blurbs (Blend + taste profile).

No hyphens in any user-facing copy; genre labels that contain a hyphen are
spelled out here. Kept in one place so the Blend and the taste blurb phrase
things the same way.
"""

from __future__ import annotations

# Display forms for genre labels that contain hyphens (no hyphens in copy).
_GENRE_DISPLAY = {"Sci-Fi": "science fiction", "Film-Noir": "noir", "Children's": "family"}


def genre_label(g: str) -> str:
    return _GENRE_DISPLAY.get(g, g).lower()


def join_list(items: list[str]) -> str:
    """'a', 'a and b', or 'a, b and c'."""
    if not items:
        return "a bit of everything"
    if len(items) == 1:
        return items[0]
    return f"{', '.join(items[:-1])} and {items[-1]}"
