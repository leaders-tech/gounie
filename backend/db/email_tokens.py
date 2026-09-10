"""Store hashed email tokens for email confirmation and password reset links.

Edit this file when the email_tokens table or token query behavior changes.
Copy this file as a starting point when you add queries for another small token table.
"""

from __future__ import annotations

import aiosqlite

from backend.db.connection import utc_now_text


async def create_email_token(db: aiosqlite.Connection, user_id: int, purpose: str, token_hash: str, expires_at: str) -> None:
    """Save a new token. Older unused tokens with the same purpose stop working."""
    now = utc_now_text()
    await db.execute(
        "UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
        (now, user_id, purpose),
    )
    await db.execute(
        """
        INSERT INTO email_tokens (user_id, purpose, token_hash, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (user_id, purpose, token_hash, now, expires_at),
    )
    await db.commit()


async def get_email_token(db: aiosqlite.Connection, token_hash: str, purpose: str) -> aiosqlite.Row | None:
    cursor = await db.execute(
        """
        SELECT id, user_id, purpose, created_at, expires_at, used_at
        FROM email_tokens
        WHERE token_hash = ? AND purpose = ?
        """,
        (token_hash, purpose),
    )
    return await cursor.fetchone()


async def mark_email_token_used(db: aiosqlite.Connection, token_id: int) -> bool:
    cursor = await db.execute("UPDATE email_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL", (utc_now_text(), token_id))
    await db.commit()
    return cursor.rowcount > 0


async def latest_email_token_created_at(db: aiosqlite.Connection, user_id: int, purpose: str) -> str | None:
    cursor = await db.execute(
        "SELECT MAX(created_at) AS created_at FROM email_tokens WHERE user_id = ? AND purpose = ?",
        (user_id, purpose),
    )
    row = await cursor.fetchone()
    return row["created_at"] if row is not None else None


async def has_live_email_token(db: aiosqlite.Connection, user_id: int, purpose: str, now_text: str) -> bool:
    cursor = await db.execute(
        """
        SELECT 1
        FROM email_tokens
        WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?
        """,
        (user_id, purpose, now_text),
    )
    return await cursor.fetchone() is not None
