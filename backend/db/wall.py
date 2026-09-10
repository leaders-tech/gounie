"""Store and load sticky notes on user walls, including note pictures and the note look (colors, text style, tilt).

Edit this file when the wall_notes table or wall query behavior changes.
Copy this file as a starting point when you add queries for another table with a picture column.
"""

from __future__ import annotations

from typing import Any

import aiosqlite

from backend.db.connection import fetch_returning, utc_now_text

NOTE_STYLE_FLAGS = ("bold", "italic", "underline", "strikethrough")

NOTE_SELECT = """
    SELECT n.id, n.wall_user_id, n.author_id, a.username AS author_username, n.text,
           n.image IS NOT NULL AS has_image, n.color, n.text_color, n.tilt,
           n.bold, n.italic, n.underline, n.strikethrough, n.created_at
    FROM wall_notes n
    JOIN users a ON a.id = n.author_id
"""


def row_to_note(row: aiosqlite.Row) -> dict[str, Any]:
    note = dict(row)
    note["has_image"] = bool(note["has_image"])
    for flag in NOTE_STYLE_FLAGS:
        note[flag] = bool(note[flag])
    return note


async def list_wall_notes(db: aiosqlite.Connection, wall_user_id: int) -> list[dict[str, Any]]:
    cursor = await db.execute(f"{NOTE_SELECT} WHERE n.wall_user_id = ? ORDER BY n.id DESC", (wall_user_id,))
    return [row_to_note(row) for row in await cursor.fetchall()]


async def get_wall_note(db: aiosqlite.Connection, note_id: int) -> dict[str, Any] | None:
    cursor = await db.execute(f"{NOTE_SELECT} WHERE n.id = ?", (note_id,))
    row = await cursor.fetchone()
    return row_to_note(row) if row is not None else None


async def create_wall_note(
    db: aiosqlite.Connection,
    wall_user_id: int,
    author_id: int,
    text: str,
    image: bytes | None,
    style: dict[str, Any],
) -> dict[str, Any]:
    """style has color, text_color, tilt, bold, italic, underline, and strikethrough."""
    row = await fetch_returning(
        db,
        """
        INSERT INTO wall_notes (
            wall_user_id, author_id, text, image, color, text_color, tilt, bold, italic, underline, strikethrough, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
        """,
        (
            wall_user_id,
            author_id,
            text,
            image,
            style["color"],
            style["text_color"],
            style["tilt"],
            int(style["bold"]),
            int(style["italic"]),
            int(style["underline"]),
            int(style["strikethrough"]),
            utc_now_text(),
        ),
    )
    await db.commit()
    if row is None:
        raise ValueError("Wall note was not saved.")
    note = await get_wall_note(db, int(row["id"]))
    if note is None:
        raise ValueError("Wall note was not saved.")
    return note


async def update_wall_note_tilt(db: aiosqlite.Connection, note_id: int, tilt: int) -> dict[str, Any] | None:
    """Turn a posted note. Rotation is the only thing about a posted note that can change."""
    await db.execute("UPDATE wall_notes SET tilt = ? WHERE id = ?", (tilt, note_id))
    await db.commit()
    return await get_wall_note(db, note_id)


async def get_wall_image(db: aiosqlite.Connection, note_id: int) -> bytes | None:
    cursor = await db.execute("SELECT image FROM wall_notes WHERE id = ?", (note_id,))
    row = await cursor.fetchone()
    if row is None or row["image"] is None:
        return None
    return bytes(row["image"])


async def delete_wall_note(db: aiosqlite.Connection, note_id: int) -> dict[str, Any] | None:
    note = await get_wall_note(db, note_id)
    if note is None:
        return None
    await db.execute("DELETE FROM wall_notes WHERE id = ?", (note_id,))
    await db.commit()
    return note
