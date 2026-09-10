"""Create the email_tokens table for email confirmation and password reset links.

Edit this file only if this migration has not been used yet.
Create a new migration file instead when you need another schema change.
"""

from yoyo import step


steps = [
    step(
        """
        CREATE TABLE email_tokens (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            purpose TEXT NOT NULL CHECK (purpose IN ('confirm', 'reset')),
            token_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) STRICT
        """,
        "DROP TABLE email_tokens",
    ),
    step(
        "CREATE INDEX email_tokens_user_purpose ON email_tokens (user_id, purpose)",
        "DROP INDEX email_tokens_user_purpose",
    ),
]
