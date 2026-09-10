"""Create the slot_spins table that records every slot machine spin.

Edit this file only if this migration has not been used yet.
Create a new migration file instead when you need another schema change.
"""

from yoyo import step


steps = [
    step(
        """
        CREATE TABLE slot_spins (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            stake INTEGER NOT NULL CHECK (stake > 0),
            reels TEXT NOT NULL,
            multiplier INTEGER NOT NULL,
            payout INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) STRICT
        """,
        "DROP TABLE slot_spins",
    )
]
