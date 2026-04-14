"""Admin authentication — file-based credentials with token sessions."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Credentials file (not Databricks-specific — works on any deployment)
# ---------------------------------------------------------------------------

_DEFAULT_CREDS_PATH = Path(__file__).parent / "admin_credentials.json"

_DEFAULT_USERNAME = "admin"
_DEFAULT_PASSWORD = "matrix-admin-2024"  # sha256 stored, change after first login


def _get_creds_path() -> Path:
    custom = os.environ.get("ADMIN_CREDS_PATH", "")
    return Path(custom) if custom else _DEFAULT_CREDS_PATH


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _load_credentials() -> dict:
    path = _get_creds_path()
    if not path.exists():
        creds = {
            "username": _DEFAULT_USERNAME,
            "password_hash": _hash_password(_DEFAULT_PASSWORD),
        }
        path.write_text(json.dumps(creds, indent=2), encoding="utf-8")
        return creds
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"username": _DEFAULT_USERNAME, "password_hash": _hash_password(_DEFAULT_PASSWORD)}


# ---------------------------------------------------------------------------
# In-memory session tokens (cleared on restart — stateless enough for admin)
# ---------------------------------------------------------------------------

_sessions: dict[str, float] = {}  # token -> expiry timestamp
_TOKEN_TTL_SECONDS = 8 * 3600  # 8 hours


def verify_credentials(username: str, password: str) -> bool:
    creds = _load_credentials()
    return (
        username == creds.get("username", "")
        and _hash_password(password) == creds.get("password_hash", "")
    )


def create_session_token() -> str:
    token = secrets.token_hex(32)
    _sessions[token] = time.time() + _TOKEN_TTL_SECONDS
    return token


def validate_token(token: str) -> bool:
    expiry = _sessions.get(token)
    if expiry is None:
        return False
    if time.time() > expiry:
        _sessions.pop(token, None)
        return False
    return True


def revoke_token(token: str) -> None:
    _sessions.pop(token, None)


def change_password(username: str, new_password: str) -> None:
    path = _get_creds_path()
    creds = _load_credentials()
    creds["username"] = username
    creds["password_hash"] = _hash_password(new_password)
    path.write_text(json.dumps(creds, indent=2), encoding="utf-8")
    # Revoke all existing sessions on password change
    _sessions.clear()
