"""Send emails through SMTP (for example Brevo) or only log them in dev mode.

Edit this file when email sending, the SMTP connection, or the dev outbox changes.
Do not copy this file. Call send_email() from any route that needs to send an email.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from aiohttp import web

from backend.config import Settings
from backend.db.connection import utc_now_text

LOGGER = logging.getLogger("backend.email")
OUTBOX_LIMIT = 50


async def send_email(app: web.Application, to: str, subject: str, body: str) -> bool:
    """Send one plain-text email. Returns False (and logs the error) when sending failed."""
    settings: Settings = app["settings"]
    if settings.email_mode == "log":
        outbox: list[dict[str, str]] = app["email_outbox"]
        outbox.append({"to": to, "subject": subject, "body": body, "created_at": utc_now_text()})
        del outbox[:-OUTBOX_LIMIT]
        LOGGER.info("EMAIL_MODE=log, email not really sent. to=%s subject=%s\n%s", to, subject, body)
        return True
    try:
        await asyncio.to_thread(_send_smtp, settings, to, subject, body)
    except Exception:
        LOGGER.exception("Email sending failed to=%s subject=%s host=%s port=%s", to, subject, settings.smtp_host, settings.smtp_port)
        return False
    LOGGER.info("Email sent to=%s subject=%s", to, subject)
    return True


def _send_smtp(settings: Settings, to: str, subject: str, body: str) -> None:
    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    context = ssl.create_default_context()
    if settings.smtp_port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20, context=context) as smtp:
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
        return
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        smtp.starttls(context=context)
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
