"""Configure small stdout logs for backend startup, requests, and websocket events.

Edit this file when backend log format, levels, or logger names change.
Do not copy this file. Change it when the shared backend logging model changes.
"""

from __future__ import annotations

import logging
import sys

from backend.config import Settings


def configure_logging(settings: Settings) -> None:
    make_stdout_safe_for_any_text()
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s", datefmt="%H:%M:%S"))
        root_logger.addHandler(handler)

    root_logger.setLevel(logging.INFO if settings.debug_logs else logging.WARNING)
    logging.getLogger("backend").setLevel(logging.INFO if settings.debug_logs else logging.WARNING)
    logging.getLogger("aiohttp.access").setLevel(logging.WARNING)


def make_stdout_safe_for_any_text() -> None:
    """Windows terminals often can't print emoji (slot reels) or letters like ε.

    Print them as escapes like \\U0001f352 instead of failing the whole log line.
    """
    try:
        sys.stdout.reconfigure(errors="backslashreplace")
    except AttributeError, ValueError:
        pass
