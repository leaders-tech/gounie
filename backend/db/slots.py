"""Record slot machine spins so every gamble can be checked later.

Edit this file when the slot_spins table or spin history queries change.
Copy this file as a starting point when you add another small audit table.
"""

from __future__ import annotations

import json

import aiosqlite

from backend.db.connection import fetch_returning, utc_now_text


async def insert_slot_spin(db: aiosqlite.Connection, user_id: int, stake: int, reels: list[str], multiplier: int, payout: int) -> int:
    """Insert a spin without committing. The caller commits together with the karma change."""
    row = await fetch_returning(
        db,
        """
        INSERT INTO slot_spins (user_id, stake, reels, multiplier, payout, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
        """,
        (user_id, stake, json.dumps(reels, ensure_ascii=False), multiplier, payout, utc_now_text()),
    )
    if row is None:
        raise ValueError("Spin was not saved.")
    return int(row["id"])
