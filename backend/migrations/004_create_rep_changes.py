"""Create the rep_changes table, a log of every rep change for debugging.

Edit this file only if this migration has not been used yet.
Create a new migration file instead when you need another schema change.
"""

from yoyo import step


steps = [
    step(
        """
        CREATE TABLE rep_changes (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            delta INTEGER NOT NULL,
            rep_after INTEGER NOT NULL,
            reason TEXT NOT NULL,
            ref_id INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) STRICT
        """,
        "DROP TABLE rep_changes",
    ),
    step(
        "CREATE INDEX rep_changes_user ON rep_changes (user_id, id)",
        "DROP INDEX rep_changes_user",
    ),
]
