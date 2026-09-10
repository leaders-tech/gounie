"""Create the users table with email confirmation, ban flag, and rep.

Edit this file only if this migration has not been used yet.
Create a new migration file instead when you need another schema change.
"""

from yoyo import step


steps = [
    step(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            email TEXT UNIQUE COLLATE NOCASE,
            email_confirmed_at TEXT,
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
            is_banned INTEGER NOT NULL DEFAULT 0 CHECK (is_banned IN (0, 1)),
            rep INTEGER NOT NULL DEFAULT 0,
            rep_risk_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        ) STRICT
        """,
        "DROP TABLE users",
    )
]
