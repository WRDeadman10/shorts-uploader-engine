"""YouTube API authentication and client setup.

Handles OAuth2 flow, token refresh, and API client construction.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from lib.file_utils import load_json_file

SCOPES: List[str] = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]


def build_youtube_client(client_secrets: Path, token_file: Path, auth_port: int):
    """Build an authenticated YouTube API v3 client.

    Handles token refresh and re-authentication if scopes are outdated.
    """
    creds: Optional[Credentials] = None
    client_config = load_json_file(client_secrets, default={})
    if "web" in client_config and "installed" not in client_config:
        print(
            "[warn] client_secret.json is a WEB OAuth client. "
            "Use a DESKTOP OAuth client to avoid redirect_uri_mismatch."
        )
    token_scope_mismatch = False
    if token_file.exists():
        token_payload = load_json_file(token_file, default={})
        stored_scopes = set(token_payload.get("scopes", []))
        if stored_scopes and not set(SCOPES).issubset(stored_scopes):
            token_scope_mismatch = True
        if token_scope_mismatch:
            print("[info] token scopes are outdated; re-authenticating for playlist access.")
        else:
            creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)
    if creds and not creds.has_scopes(SCOPES):
        creds = None
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token and creds.has_scopes(SCOPES):
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets), SCOPES)
            creds = flow.run_local_server(port=auth_port)
        token_file.write_text(creds.to_json(), encoding="utf-8")
    return build("youtube", "v3", credentials=creds)
