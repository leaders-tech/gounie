"""Open SQLite connections and provide small UTC time and LIKE-search helpers.

Edit this file when DB connection setup, PRAGMA values, or shared DB helpers change.
Copy the helper style here when you add another small DB-wide utility.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import aiosqlite


def utc_now() -> datetime:
    return datetime.now(tz=UTC)


def utc_now_text() -> str:
    return utc_now().isoformat(timespec="seconds")


def parse_utc_text(value: str) -> datetime:
    return datetime.fromisoformat(value)


def like_pattern(text: str) -> str:
    """Turn user search text into a LIKE pattern. Use it with ESCAPE '\\' in SQL."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


async def fetch_returning(db: aiosqlite.Connection, sql: str, parameters: tuple | dict) -> aiosqlite.Row | None:
    """Run an INSERT/UPDATE/DELETE ... RETURNING statement and read its row right away.

    All requests share one connection. A RETURNING statement that is not fully read stays "in progress",
    and then another request's commit fails. Reading all rows in the same step finishes the statement.
    """
    rows = list(await db.execute_fetchall(sql, parameters))
    return rows[0] if rows else None


async def open_db(path: Path) -> aiosqlite.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON;")
    await db.execute("PRAGMA journal_mode = WAL;")
    await db.commit()
    return db
