"""Create the bets, bet_wagers, and bet_comments tables for the EPS-bet page.

Edit this file only if this migration has not been used yet.
Create a new migration file instead when you need another schema change.
"""

from yoyo import step


steps = [
    step(
        """
        CREATE TABLE bets (
            id INTEGER PRIMARY KEY,
            creator_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            deadline_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'cancelled', 'refunded')),
            outcome TEXT CHECK (outcome IN ('yes', 'no')),
            resolved_by INTEGER,
            resolved_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (creator_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL
        ) STRICT
        """,
        "DROP TABLE bets",
    ),
    step(
        """
        CREATE TABLE bet_wagers (
            id INTEGER PRIMARY KEY,
            bet_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
            amount INTEGER NOT NULL CHECK (amount > 0),
            payout INTEGER,
            created_at TEXT NOT NULL,
            UNIQUE (bet_id, user_id),
            FOREIGN KEY (bet_id) REFERENCES bets (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) STRICT
        """,
        "DROP TABLE bet_wagers",
    ),
    step(
        """
        CREATE TABLE bet_comments (
            id INTEGER PRIMARY KEY,
            bet_id INTEGER NOT NULL,
            author_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (bet_id) REFERENCES bets (id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
        ) STRICT
        """,
        "DROP TABLE bet_comments",
    ),
    step(
        "CREATE INDEX bet_wagers_user ON bet_wagers (user_id)",
        "DROP INDEX bet_wagers_user",
    ),
    step(
        "CREATE INDEX bet_comments_bet ON bet_comments (bet_id, id)",
        "DROP INDEX bet_comments_bet",
    ),
]
