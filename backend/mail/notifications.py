"""Write and send the emails that tell users what happened to something they made.

Right now this is the EPS-bet decision email: the admin approved or declined a bet.
Edit this file when the wording of such an email changes.
Copy the function pattern here when another feature needs to email a user.
"""

from __future__ import annotations

import logging
from typing import Any

from aiohttp import web

from backend.config import Settings
from backend.mail.sender import send_email

LOGGER = logging.getLogger("backend.bets")


def bet_decision_email(settings: Settings, bet: dict[str, Any], username: str, approved: bool, note: str) -> tuple[str, str]:
    """Build the subject and the plain-text body of the approved/declined email for one bet."""
    title = bet["title"]
    if approved:
        link = f"{settings.frontend_origin}/eps-bet/{bet['id']}"
        body = (
            f"Hi {username}!\n\n"
            f'Your bet "{title}" was approved and is now live on EPS-bet:\n\n'
            f"{link}\n\n"
            "Remember: only you can reveal the outcome after the deadline.\n"
        )
        if note:
            body += f"\nThe admin added: {note}\n"
        return f"Your bet is live: {title}", body
    body = f'Hi {username}!\n\nYour bet "{title}" was not approved, so it was not published.\n'
    if note:
        body += f"\nThe admin said: {note}\n"
    body += "\nNobody lost any karma. You can always start another bet.\n"
    return f"Your bet was not approved: {title}", body


async def send_bet_decision_email(app: web.Application, bet: dict[str, Any], email: str | None, username: str, approved: bool, note: str) -> bool:
    """Tell the creator of a bet that it was approved or declined. Returns False when no email was sent."""
    if not email:
        LOGGER.info("No bet decision email sent bet=%s creator=%s reason=no_email", bet["id"], username)
        return False
    subject, body = bet_decision_email(app["settings"], bet, username, approved, note)
    return await send_email(app, email, subject, body)
