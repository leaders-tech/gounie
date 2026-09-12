"""Store and load EPS-bet bets, wagers, and bet comments.

Edit this file when the bets, bet_wagers, or bet_comments tables or their queries change.
Copy this file as a starting point when you add queries for another group of related tables.
"""

from __future__ import annotations

from typing import Any

import aiosqlite

from backend.db.connection import fetch_returning, utc_now_text

BET_SELECT = """
    SELECT b.id, b.creator_id, c.username AS creator_username, b.title, b.description, b.deadline_at,
           b.status, b.outcome, b.resolved_at, b.created_at, b.approval, b.review_note, b.reviewed_at,
           (SELECT COUNT(*) FROM bet_wagers w WHERE w.bet_id = b.id) AS wager_count,
           (SELECT COALESCE(SUM(w.amount), 0) FROM bet_wagers w WHERE w.bet_id = b.id AND w.side = 'yes') AS yes_total,
           (SELECT COALESCE(SUM(w.amount), 0) FROM bet_wagers w WHERE w.bet_id = b.id AND w.side = 'no') AS no_total,
           (SELECT COUNT(*) FROM bet_comments m WHERE m.bet_id = b.id) AS comment_count
    FROM bets b
    JOIN users c ON c.id = b.creator_id
"""


async def list_bets(db: aiosqlite.Connection, viewer_id: int = 0, is_admin: bool = False) -> list[dict[str, Any]]:
    """List published bets. The creator also sees their own bets waiting for approval, the admin sees all of them."""
    cursor = await db.execute(
        f"{BET_SELECT} WHERE b.approval = 'approved' OR b.creator_id = ? OR ? = 1 ORDER BY b.id DESC LIMIT 500",
        (viewer_id, int(is_admin)),
    )
    return [dict(row) for row in await cursor.fetchall()]


async def list_bets_by_approval(db: aiosqlite.Connection, approval: str) -> list[dict[str, Any]]:
    """List bets in one approval state, oldest first. The admin page uses this for the waiting queue."""
    cursor = await db.execute(f"{BET_SELECT} WHERE b.approval = ? ORDER BY b.id LIMIT 500", (approval,))
    return [dict(row) for row in await cursor.fetchall()]


async def get_bet(db: aiosqlite.Connection, bet_id: int) -> dict[str, Any] | None:
    cursor = await db.execute(f"{BET_SELECT} WHERE b.id = ?", (bet_id,))
    row = await cursor.fetchone()
    return dict(row) if row is not None else None


async def create_bet(db: aiosqlite.Connection, creator_id: int, title: str, description: str, deadline_at: str) -> dict[str, Any]:
    """Save a new bet. It waits for admin approval until an admin approves or declines it."""
    now = utc_now_text()
    row = await fetch_returning(
        db,
        """
        INSERT INTO bets (creator_id, title, description, deadline_at, approval, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
        RETURNING id
        """,
        (creator_id, title, description, deadline_at, now, now),
    )
    await db.commit()
    bet = await get_bet(db, int(row["id"])) if row is not None else None
    if bet is None:
        raise ValueError("Bet was not saved.")
    return bet


async def set_bet_approval(db: aiosqlite.Connection, bet_id: int, approval: str, reviewer_id: int, note: str) -> bool:
    """Approve or decline a waiting bet. Returns False when the bet was already reviewed."""
    now = utc_now_text()
    cursor = await db.execute(
        """
        UPDATE bets
        SET approval = ?, reviewed_by = ?, reviewed_at = ?, review_note = ?, updated_at = ?
        WHERE id = ? AND approval = 'pending'
        """,
        (approval, reviewer_id, now, note, now, bet_id),
    )
    await db.commit()
    return cursor.rowcount > 0


async def list_wagers(db: aiosqlite.Connection, bet_id: int) -> list[dict[str, Any]]:
    cursor = await db.execute(
        """
        SELECT w.id, w.bet_id, w.user_id, u.username, w.side, w.amount, w.payout, w.created_at
        FROM bet_wagers w
        JOIN users u ON u.id = w.user_id
        WHERE w.bet_id = ?
        ORDER BY w.id
        """,
        (bet_id,),
    )
    return [dict(row) for row in await cursor.fetchall()]


async def get_wager(db: aiosqlite.Connection, bet_id: int, user_id: int) -> aiosqlite.Row | None:
    cursor = await db.execute("SELECT id, side, amount FROM bet_wagers WHERE bet_id = ? AND user_id = ?", (bet_id, user_id))
    return await cursor.fetchone()


async def insert_wager(db: aiosqlite.Connection, bet_id: int, user_id: int, side: str, amount: int) -> int:
    """Insert a wager without committing. The caller commits together with the karma change."""
    row = await fetch_returning(
        db,
        """
        INSERT INTO bet_wagers (bet_id, user_id, side, amount, created_at)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id
        """,
        (bet_id, user_id, side, amount, utc_now_text()),
    )
    if row is None:
        raise ValueError("Wager was not saved.")
    return int(row["id"])


async def close_bet(db: aiosqlite.Connection, bet_id: int, status: str, outcome: str | None, resolved_by: int | None) -> bool:
    """Close an open bet without committing. Returns False when the bet was not open."""
    now = utc_now_text()
    cursor = await db.execute(
        """
        UPDATE bets
        SET status = ?, outcome = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
        WHERE id = ? AND status = 'open'
        """,
        (status, outcome, resolved_by, now, now, bet_id),
    )
    return cursor.rowcount > 0


async def set_wager_payout(db: aiosqlite.Connection, wager_id: int, payout: int) -> None:
    await db.execute("UPDATE bet_wagers SET payout = ? WHERE id = ?", (payout, wager_id))


async def list_abandoned_bet_ids(db: aiosqlite.Connection, cutoff_text: str) -> list[int]:
    cursor = await db.execute(
        "SELECT id FROM bets WHERE status = 'open' AND approval = 'approved' AND deadline_at <= ? ORDER BY id",
        (cutoff_text,),
    )
    return [int(row["id"]) for row in await cursor.fetchall()]


async def list_comments(db: aiosqlite.Connection, bet_id: int) -> list[dict[str, Any]]:
    cursor = await db.execute(
        """
        SELECT m.id, m.bet_id, m.author_id, u.username AS author_username, m.text, m.created_at
        FROM bet_comments m
        JOIN users u ON u.id = m.author_id
        WHERE m.bet_id = ?
        ORDER BY m.id
        """,
        (bet_id,),
    )
    return [dict(row) for row in await cursor.fetchall()]


async def create_comment(db: aiosqlite.Connection, bet_id: int, author_id: int, text: str) -> dict[str, Any]:
    row = await fetch_returning(
        db,
        """
        INSERT INTO bet_comments (bet_id, author_id, text, created_at)
        VALUES (?, ?, ?, ?)
        RETURNING id
        """,
        (bet_id, author_id, text, utc_now_text()),
    )
    await db.commit()
    if row is None:
        raise ValueError("Comment was not saved.")
    cursor = await db.execute(
        """
        SELECT m.id, m.bet_id, m.author_id, u.username AS author_username, m.text, m.created_at
        FROM bet_comments m
        JOIN users u ON u.id = m.author_id
        WHERE m.id = ?
        """,
        (int(row["id"]),),
    )
    saved = await cursor.fetchone()
    return dict(saved) if saved is not None else {}


async def delete_comment(db: aiosqlite.Connection, comment_id: int) -> int | None:
    """Delete a comment and return its bet id, or None when it does not exist."""
    row = await fetch_returning(db, "DELETE FROM bet_comments WHERE id = ? RETURNING bet_id", (comment_id,))
    await db.commit()
    return int(row["bet_id"]) if row is not None else None
