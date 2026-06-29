"""Tiny template-based blurb generator for the Blend (no LLM needed)."""

from __future__ import annotations


def _join(items: list[str]) -> str:
    """'a', 'a and b', or 'a, b and c'."""
    if not items:
        return "a bit of everything"
    if len(items) == 1:
        return items[0]
    return f"{', '.join(items[:-1])} and {items[-1]}"


# Display forms for genre labels that contain hyphens (no hyphens in copy).
_GENRE_DISPLAY = {"Sci-Fi": "science fiction", "Film-Noir": "noir"}


def _genre_label(g: str) -> str:
    return _GENRE_DISPLAY.get(g, g).lower()


def blend_blurb(
    friend_name: str,
    blend_vec: list[float],
    genre_names: list[str],
    overlap_count: int,
) -> str:
    top = [
        _genre_label(g)
        for g, _ in sorted(zip(genre_names, blend_vec), key=lambda x: x[1], reverse=True)[:3]
    ]
    genres = _join(top)
    if overlap_count == 0:
        return (
            f"You and {friend_name} have pretty different tastes. Here's the "
            f"closest middle ground to watch together."
        )
    films = "film lights" if overlap_count == 1 else "films light"
    return (
        f"You and {friend_name} both gravitate to {genres}. "
        f"{overlap_count} {films} up for both of you. Start at the top."
    )
