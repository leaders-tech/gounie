"""Store and load user rows for login, sign-up, walls, and admin features.

Edit this file when the users table or user query behavior changes.
Copy this file as a starting point when you add queries for another table.
"""

from __future__ import annotations

from typing import Any

import aiosqlite

from backend.db.connection import fetch_returning, like_pattern, utc_now_text

USER_COLUMNS = "id, username, email, email_confirmed_at, password_hash, is_admin, is_banned, karma, karma_risk_at, created_at, updated_at"


def row_to_user(row: aiosqlite.Row | None) -> dict[str, Any] | None:
    """The logged-in user's own view of their account."""
    if row is None:
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "is_admin": bool(row["is_admin"]),
        "karma": row["karma"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def row_to_public_user(row: aiosqlite.Row) -> dict[str, Any]:
    """What other users may see. Never includes the email."""
    return {
        "id": row["id"],
        "username": row["username"],
        "is_admin": bool(row["is_admin"]),
        "karma": row["karma"],
        "created_at": row["created_at"],
    }


def row_to_admin_user(row: aiosqlite.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "email_confirmed": row["email_confirmed_at"] is not None,
        "is_admin": bool(row["is_admin"]),
        "is_banned": bool(row["is_banned"]),
        "karma": row["karma"],
        "created_at": row["created_at"],
    }


async def get_user_by_username(db: aiosqlite.Connection, username: str) -> aiosqlite.Row | None:
    cursor = await db.execute(f"SELECT {USER_COLUMNS} FROM users WHERE username = ?", (username,))
    return await cursor.fetchone()


async def get_user_by_email(db: aiosqlite.Connection, email: str) -> aiosqlite.Row | None:
    cursor = await db.execute(f"SELECT {USER_COLUMNS} FROM users WHERE email = ?", (email,))
    return await cursor.fetchone()


async def get_user_by_id(db: aiosqlite.Connection, user_id: int) -> aiosqlite.Row | None:
    cursor = await db.execute(f"SELECT {USER_COLUMNS} FROM users WHERE id = ?", (user_id,))
    return await cursor.fetchone()


async def user_exists(db: aiosqlite.Connection, username: str) -> bool:
    cursor = await db.execute("SELECT 1 FROM users WHERE username = ?", (username,))
    return await cursor.fetchone() is not None


async def list_users(db: aiosqlite.Connection) -> list[dict[str, Any]]:
    cursor = await db.execute(f"SELECT {USER_COLUMNS} FROM users ORDER BY id")
    rows = await cursor.fetchall()
    return [row_to_admin_user(row) for row in rows]


async def search_users(db: aiosqlite.Connection, query: str) -> list[dict[str, Any]]:
    cursor = await db.execute(
        f"""
        SELECT {USER_COLUMNS}
        FROM users
        WHERE (email_confirmed_at IS NOT NULL OR is_admin = 1)
          AND is_banned = 0
          AND username LIKE ? ESCAPE '\\'
        ORDER BY username COLLATE NOCASE
        LIMIT 200
        """,
        (like_pattern(query),),
    )
    rows = await cursor.fetchall()
    return [row_to_public_user(row) for row in rows]


async def create_user_if_missing(
    db: aiosqlite.Connection,
    username: str,
    password_hash: str,
    is_admin: bool,
    email: str | None = None,
    confirmed: bool = False,
) -> None:
    now = utc_now_text()
    await db.execute(
        """
        INSERT INTO users (username, email, email_confirmed_at, password_hash, is_admin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
        """,
        (username, email, now if confirmed else None, password_hash, int(is_admin), now, now),
    )
    await db.commit()


async def create_pending_user(db: aiosqlite.Connection, username: str, email: str, password_hash: str) -> int:
    now = utc_now_text()
    row = await fetch_returning(
        db,
        """
        INSERT INTO users (username, email, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id
        """,
        (username, email, password_hash, now, now),
    )
    await db.commit()
    if row is None:
        raise ValueError("User was not created.")
    return int(row["id"])


async def delete_user(db: aiosqlite.Connection, user_id: int) -> None:
    await db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    await db.commit()


async def confirm_user_email(db: aiosqlite.Connection, user_id: int) -> None:
    now = utc_now_text()
    await db.execute(
        "UPDATE users SET email_confirmed_at = ?, updated_at = ? WHERE id = ? AND email_confirmed_at IS NULL",
        (now, now, user_id),
    )
    await db.commit()


async def set_password_hash(db: aiosqlite.Connection, user_id: int, password_hash: str) -> None:
    await db.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", (password_hash, utc_now_text(), user_id))
    await db.commit()


async def set_user_banned(db: aiosqlite.Connection, user_id: int, banned: bool) -> bool:
    cursor = await db.execute("UPDATE users SET is_banned = ?, updated_at = ? WHERE id = ?", (int(banned), utc_now_text(), user_id))
    await db.commit()
    return cursor.rowcount > 0
