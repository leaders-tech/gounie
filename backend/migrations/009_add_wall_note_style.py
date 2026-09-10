"""Add text color and text styles (bold, italic, underline, strikethrough) to wall notes.

Old notes used color names like 'pink'. This migration turns them into hex colors like '#fbcfe8'.
Edit this file only if this migration has not been used yet.
Create a new migration file instead when you need another schema change.
"""

from yoyo import step


steps = [
    step(
        "ALTER TABLE wall_notes ADD COLUMN text_color TEXT NOT NULL DEFAULT '#1c1917'",
        "ALTER TABLE wall_notes DROP COLUMN text_color",
    ),
    step(
        "ALTER TABLE wall_notes ADD COLUMN bold INTEGER NOT NULL DEFAULT 0 CHECK (bold IN (0, 1))",
        "ALTER TABLE wall_notes DROP COLUMN bold",
    ),
    step(
        "ALTER TABLE wall_notes ADD COLUMN italic INTEGER NOT NULL DEFAULT 0 CHECK (italic IN (0, 1))",
        "ALTER TABLE wall_notes DROP COLUMN italic",
    ),
    step(
        "ALTER TABLE wall_notes ADD COLUMN underline INTEGER NOT NULL DEFAULT 0 CHECK (underline IN (0, 1))",
        "ALTER TABLE wall_notes DROP COLUMN underline",
    ),
    step(
        "ALTER TABLE wall_notes ADD COLUMN strikethrough INTEGER NOT NULL DEFAULT 0 CHECK (strikethrough IN (0, 1))",
        "ALTER TABLE wall_notes DROP COLUMN strikethrough",
    ),
    step(
        """
        UPDATE wall_notes
        SET color = CASE color
            WHEN 'yellow' THEN '#fef08a'
            WHEN 'pink' THEN '#fbcfe8'
            WHEN 'green' THEN '#d9f99d'
            WHEN 'blue' THEN '#bae6fd'
            WHEN 'orange' THEN '#fed7aa'
            WHEN 'purple' THEN '#ddd6fe'
            ELSE color
        END
        """
    ),
]
