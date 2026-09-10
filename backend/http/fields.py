"""Read and check simple fields (text, whole numbers, ids) from JSON request bodies.

Edit this file when shared input checks or their error messages change.
Copy the helper style here when you add another small shared field reader.
"""

from __future__ import annotations

import re
from typing import Any

from backend.http.json_api import AppError

HEX_COLOR_RE = re.compile(r"#[0-9a-fA-F]{6}")


def read_text(payload: dict[str, Any], key: str, *, label: str, max_length: int, min_length: int = 0) -> str:
    value = payload.get(key)
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise AppError(400, "bad_request", f"{label} must be text.")
    value = value.strip()
    if len(value) < min_length:
        message = f"{label} is required." if min_length == 1 else f"{label} must be at least {min_length} characters."
        raise AppError(400, "bad_request", message)
    if len(value) > max_length:
        raise AppError(400, "bad_request", f"{label} must be at most {max_length} characters.")
    return value


def read_int(payload: dict[str, Any], key: str, *, label: str, minimum: int | None = None, maximum: int | None = None) -> int:
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        raise AppError(400, "bad_request", f"{label} must be a whole number.")
    if minimum is not None and value < minimum:
        raise AppError(400, "bad_request", f"{label} must be at least {minimum}.")
    if maximum is not None and value > maximum:
        raise AppError(400, "bad_request", f"{label} must be at most {maximum}.")
    return value


def read_id(payload: dict[str, Any], key: str = "id") -> int:
    return read_int(payload, key, label=key, minimum=1)


def read_choice(payload: dict[str, Any], key: str, *, label: str, choices: set[str]) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or value not in choices:
        raise AppError(400, "bad_request", f"{label} must be one of: {', '.join(sorted(choices))}.")
    return value


def read_bool(payload: dict[str, Any], key: str, *, label: str, default: bool = False) -> bool:
    value = payload.get(key)
    if value is None:
        return default
    if not isinstance(value, bool):
        raise AppError(400, "bad_request", f"{label} must be true or false.")
    return value


def read_hex_color(payload: dict[str, Any], key: str, *, label: str, default: str) -> str:
    """Read a color like #ffcc00 and return it in lower case."""
    value = payload.get(key)
    if value is None:
        return default
    if not isinstance(value, str) or not HEX_COLOR_RE.fullmatch(value):
        raise AppError(400, "bad_request", f"{label} must be a color like #ffcc00.")
    return value.lower()
