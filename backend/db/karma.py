"""Change user karma in one place and keep a karma_changes log for debugging.

Edit this file when karma rules, the karma log, or the 24h recovery query change.
Do not copy this file. Every karma change in the app should go through change_karma here.
"""

from __future__ import annotations

import logging

import aiosqlite

from backend.db.connection import fetch_returning, utc_now_text

LOGGER = logging.getLogger("backend.karma")


async def get_karma(db: aiosqlite.Connection, user_id: int) -> int | None:
    cursor = await db.execute("SELECT karma FROM users WHERE id = ?", (user_id,))
    row = await cursor.fetchone()
    return int(row["karma"]) if row is not None else None


async def change_karma(
    db: aiosqlite.Connection,
    user_id: int,
    delta: int,
    reason: str,
    ref_id: int | None = None,
    *,
    risky: bool = False,
    commit: bool = True,
) -> int:
    """Add delta to a user's karma and return the new karma.

    karma_risk_at is set to now when this is a gamble (risky=True) or when karma goes from 0+ to negative.
    The 24h recovery timer starts from karma_risk_at.
    """
    now = utc_now_text()
    row = await fetch_returning(
        db,
        """
        UPDATE users
        SET karma = karma + :delta,
            karma_risk_at = CASE WHEN :risky = 1 OR (karma >= 0 AND karma + :delta < 0) THEN :now ELSE karma_risk_at END,
            updated_at = :now
        WHERE id = :user_id
        RETURNING karma
        """,
        {"delta": delta, "risky": int(risky), "now": now, "user_id": user_id},
    )
    if row is None:
        raise ValueError(f"User {user_id} does not exist.")
    karma_after = int(row["karma"])
    await db.execute(
        """
        INSERT INTO karma_changes (user_id, delta, karma_after, reason, ref_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (user_id, delta, karma_after, reason, ref_id, now),
    )
    if commit:
        await db.commit()
    LOGGER.info("Karma change user=%s delta=%+d reason=%s ref=%s karma_after=%s", user_id, delta, reason, ref_id, karma_after)
    return karma_after


async def touch_karma_risk(db: aiosqlite.Connection, user_id: int, *, commit: bool = True) -> None:
    """Restart the 24h recovery timer without changing karma (for example, a lost wager was closed)."""
    await db.execute("UPDATE users SET karma_risk_at = ? WHERE id = ?", (utc_now_text(), user_id))
    if commit:
        await db.commit()


async def list_recoverable_users(db: aiosqlite.Connection, cutoff_text: str) -> list[aiosqlite.Row]:
    """Users with negative karma, no open wagers, and no risky karma activity since cutoff_text."""
    cursor = await db.execute(
        """
        SELECT u.id, u.username, u.karma
        FROM users u
        WHERE u.karma < 0
          AND (u.karma_risk_at IS NULL OR u.karma_risk_at <= ?)
          AND NOT EXISTS (
              SELECT 1
              FROM bet_wagers w
              JOIN bets b ON b.id = w.bet_id
              WHERE w.user_id = u.id AND b.status = 'open'
          )
        ORDER BY u.id
        """,
        (cutoff_text,),
    )
    return list(await cursor.fetchall())


async def list_karma_changes(db: aiosqlite.Connection, user_id: int, limit: int = 50) -> list[dict[str, object]]:
    cursor = await db.execute(
        """
        SELECT id, delta, karma_after, reason, ref_id, created_at
        FROM karma_changes
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (user_id, limit),
    )
    return [dict(row) for row in await cursor.fetchall()]
