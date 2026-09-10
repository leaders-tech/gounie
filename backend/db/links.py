"""Store and search links in the great url collection, plus link votes.

Edit this file when the links or link_votes tables or their queries change.
Copy this file as a starting point when you add another searchable table.
"""

from __future__ import annotations

from typing import Any

import aiosqlite

from backend.db.connection import fetch_returning, like_pattern, utc_now_text

LINK_SELECT = """
    SELECT l.id, l.author_id, u.username AS author_username, l.url, l.title, l.description, l.score,
           l.created_at, l.updated_at, COALESCE(v.value, 0) AS my_vote
    FROM links l
    JOIN users u ON u.id = l.author_id
    LEFT JOIN link_votes v ON v.link_id = l.id AND v.user_id = :viewer_id
"""


async def list_links(db: aiosqlite.Connection, viewer_id: int, query: str) -> list[dict[str, Any]]:
    if query:
        cursor = await db.execute(
            f"""
            {LINK_SELECT}
            WHERE l.title LIKE :pattern ESCAPE '\\'
               OR l.description LIKE :pattern ESCAPE '\\'
               OR l.url LIKE :pattern ESCAPE '\\'
               OR u.username LIKE :pattern ESCAPE '\\'
            ORDER BY l.score DESC, l.id DESC
            LIMIT 500
            """,
            {"viewer_id": viewer_id, "pattern": like_pattern(query)},
        )
    else:
        cursor = await db.execute(f"{LINK_SELECT} ORDER BY l.score DESC, l.id DESC LIMIT 500", {"viewer_id": viewer_id})
    return [dict(row) for row in await cursor.fetchall()]


async def get_link(db: aiosqlite.Connection, link_id: int, viewer_id: int) -> dict[str, Any] | None:
    cursor = await db.execute(f"{LINK_SELECT} WHERE l.id = :link_id", {"viewer_id": viewer_id, "link_id": link_id})
    row = await cursor.fetchone()
    return dict(row) if row is not None else None


async def create_link(db: aiosqlite.Connection, author_id: int, url: str, title: str, description: str) -> int:
    now = utc_now_text()
    row = await fetch_returning(
        db,
        """
        INSERT INTO links (author_id, url, title, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
        """,
        (author_id, url, title, description, now, now),
    )
    await db.commit()
    if row is None:
        raise ValueError("Link was not saved.")
    return int(row["id"])


async def update_link(db: aiosqlite.Connection, link_id: int, url: str, title: str, description: str) -> None:
    await db.execute(
        "UPDATE links SET url = ?, title = ?, description = ?, updated_at = ? WHERE id = ?",
        (url, title, description, utc_now_text(), link_id),
    )
    await db.commit()


async def delete_link(db: aiosqlite.Connection, link_id: int) -> bool:
    cursor = await db.execute("DELETE FROM links WHERE id = ?", (link_id,))
    await db.commit()
    return cursor.rowcount > 0


async def get_link_vote(db: aiosqlite.Connection, link_id: int, user_id: int) -> int:
    cursor = await db.execute("SELECT value FROM link_votes WHERE link_id = ? AND user_id = ?", (link_id, user_id))
    row = await cursor.fetchone()
    return int(row["value"]) if row is not None else 0


async def save_link_vote(db: aiosqlite.Connection, link_id: int, user_id: int, value: int, delta: int) -> None:
    """Save a vote (1, -1, or 0 to clear) and move the link score by delta. The caller commits."""
    now = utc_now_text()
    if value == 0:
        await db.execute("DELETE FROM link_votes WHERE link_id = ? AND user_id = ?", (link_id, user_id))
    else:
        await db.execute(
            """
            INSERT INTO link_votes (link_id, user_id, value, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (link_id, user_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (link_id, user_id, value, now, now),
        )
    await db.execute("UPDATE links SET score = score + ? WHERE id = ?", (delta, link_id))
