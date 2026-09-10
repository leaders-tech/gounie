"""Check nicknames, emails, allowed email domains, and passwords for sign-up.

Edit this file when nickname, email, or password rules change.
Copy the small check-function style here when you add another input rule.
"""

from __future__ import annotations

import re

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 200


def validate_username(username: str) -> str | None:
    if not USERNAME_RE.match(username):
        return "Nickname must be 3-20 characters: letters, numbers, or _."
    return None


def email_domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower() if "@" in email else ""


def validate_email(email: str, allowed_domains: tuple[str, ...]) -> str | None:
    if len(email) > 254 or not EMAIL_RE.match(email):
        return "Please enter a valid email."
    if email_domain(email) not in allowed_domains:
        return "Only emails from allowed school domains can be used."
    return None


def validate_password(password: str) -> str | None:
    if len(password) < PASSWORD_MIN_LENGTH:
        return f"Password must be at least {PASSWORD_MIN_LENGTH} characters."
    if len(password) > PASSWORD_MAX_LENGTH:
        return f"Password must be at most {PASSWORD_MAX_LENGTH} characters."
    return None
