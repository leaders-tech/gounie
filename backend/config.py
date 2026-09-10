"""Load backend settings from .env and keep them in one Settings object.

Edit this file when env variables, ports, cookie names, email settings, karma rules, or dev/prod defaults change.
Do not copy this file. Change it when the app configuration model changes.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_COOKIE_SECRET = "change-this-secret"
EMAIL_MODES = {"log", "smtp"}


@dataclass(slots=True)
class Settings:
    mode: str
    host: str
    port: int
    db_path: Path
    cookie_secret: str
    frontend_origin: str
    debug_logs: bool = True
    admin_password: str = ""
    allowed_email_domains: tuple[str, ...] = ("example.edu",)
    email_mode: str = "log"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""
    karma_floor: int = -50
    access_cookie_name: str = "gounie_access"
    refresh_cookie_name: str = "gounie_refresh"
    access_ttl_seconds: int = 2 * 60 * 60
    refresh_ttl_seconds: int = 60 * 24 * 60 * 60

    @property
    def secure_cookies(self) -> bool:
        return self.mode == "prod"

    @property
    def allowed_origins(self) -> set[str]:
        origins = {self.frontend_origin.rstrip("/")}
        if self.mode != "prod":
            origins.add(f"http://{self.host}:{self.port}")
            parsed = urlsplit(self.frontend_origin)
            if parsed.hostname == "127.0.0.1":
                origins.add(urlunsplit((parsed.scheme, f"localhost:{parsed.port}", parsed.path, parsed.query, parsed.fragment)).rstrip("/"))
            if parsed.hostname == "localhost":
                origins.add(urlunsplit((parsed.scheme, f"127.0.0.1:{parsed.port}", parsed.path, parsed.query, parsed.fragment)).rstrip("/"))
        return origins

    @property
    def migrations_path(self) -> Path:
        return ROOT_DIR / "backend" / "migrations"


def load_settings() -> Settings:
    load_dotenv(ROOT_DIR / ".env")
    mode = os.getenv("APP_MODE", "dev").strip().lower()
    host = os.getenv("APP_HOST", "localhost").strip()
    port = int(os.getenv("APP_PORT", "3101"))
    db_path = Path(os.getenv("DB_PATH", "./dev.sqlite3")).expanduser()
    if not db_path.is_absolute():
        db_path = ROOT_DIR / db_path
    cookie_secret = os.getenv("COOKIE_SECRET", DEFAULT_COOKIE_SECRET)
    frontend_public_host = os.getenv("FRONTEND_PUBLIC_HOST", "localhost").strip()
    frontend_port = os.getenv("FRONTEND_PORT", "5101").strip()
    frontend_origin = os.getenv("FRONTEND_ORIGIN", f"http://{frontend_public_host}:{frontend_port}").rstrip("/")
    debug_logs = parse_bool_env(os.getenv("APP_DEBUG_LOGS"), default=mode != "prod")
    settings = Settings(
        mode=mode,
        host=host,
        port=port,
        db_path=db_path,
        cookie_secret=cookie_secret,
        frontend_origin=frontend_origin,
        debug_logs=debug_logs,
        admin_password=os.getenv("ADMIN_PASSWORD", ""),
        allowed_email_domains=parse_domains(os.getenv("ALLOWED_EMAIL_DOMAINS", "")),
        email_mode=os.getenv("EMAIL_MODE", "log").strip().lower() or "log",
        smtp_host=os.getenv("SMTP_HOST", "").strip(),
        smtp_port=int(os.getenv("SMTP_PORT", "").strip() or "587"),
        smtp_user=os.getenv("SMTP_USER", "").strip(),
        smtp_password=os.getenv("SMTP_PASSWORD", ""),
        email_from=os.getenv("EMAIL_FROM", "").strip(),
        karma_floor=int(os.getenv("KARMA_FLOOR", "").strip() or "-50"),
    )
    validate_settings(settings)
    return settings


def parse_bool_env(value: str | None, *, default: bool) -> bool:
    if value is None or value.strip() == "":
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"Expected a boolean env value, got {value!r}. Use 1 or 0.")


def parse_domains(value: str) -> tuple[str, ...]:
    domains = []
    for part in value.split(","):
        domain = part.strip().lower().lstrip("@")
        if domain and domain not in domains:
            domains.append(domain)
    return tuple(domains)


def validate_settings(settings: Settings) -> None:
    if settings.mode == "prod" and settings.cookie_secret == DEFAULT_COOKIE_SECRET:
        raise ValueError("Refusing to start in prod with the default COOKIE_SECRET. Set a real secret in .env or your deploy env.")
    if settings.mode == "prod" and not settings.admin_password:
        raise ValueError("Refusing to start in prod without ADMIN_PASSWORD. Set it in the tlfpaas Secrets UI or your deploy env.")
    if not settings.allowed_email_domains:
        raise ValueError("ALLOWED_EMAIL_DOMAINS is empty. Set a comma-separated list like school.edu,uni.edu.")
    if settings.email_mode not in EMAIL_MODES:
        raise ValueError(f"EMAIL_MODE must be log or smtp, got {settings.email_mode!r}.")
    if settings.email_mode == "smtp":
        required = {
            "SMTP_HOST": settings.smtp_host,
            "SMTP_USER": settings.smtp_user,
            "SMTP_PASSWORD": settings.smtp_password,
            "EMAIL_FROM": settings.email_from,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(f"EMAIL_MODE=smtp needs these settings: {', '.join(missing)}.")
    if settings.karma_floor > 0:
        raise ValueError("KARMA_FLOOR must be 0 or a negative number.")
