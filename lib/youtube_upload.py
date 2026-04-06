"""YouTube video upload, playlist management, and error handling.

Handles resumable uploads, playlist resolution, and HTTP error extraction.
"""
from __future__ import annotations

import json
import random
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from lib.text_utils import clean_text

# HTTP status codes that are retryable for YouTube uploads
RETRIABLE_STATUS_CODES = {500, 502, 503, 504}


def upload_video(
    youtube,
    file_path: Path,
    metadata: Dict[str, Any],
    privacy: str,
    category_id: str,
    language: str,
    notify_subscribers: bool,
    max_retries: int = 8,
) -> str:
    """Upload a video to YouTube with resumable upload and retries.

    Returns the YouTube video ID on success.
    """
    body = {
        "snippet": {
            "title": metadata["title"],
            "description": metadata["description"],
            "tags": metadata["tags"],
            "categoryId": category_id,
            "defaultLanguage": language,
            "defaultAudioLanguage": language,
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=MediaFileUpload(str(file_path), resumable=True),
        notifySubscribers=notify_subscribers,
    )

    response = None
    retries = 0
    while response is None:
        try:
            _, response = request.next_chunk()
            if response and "id" in response:
                return response["id"]
        except HttpError as exc:
            if exc.resp.status not in RETRIABLE_STATUS_CODES:
                raise
            retries += 1
        except OSError:
            retries += 1

        if retries > max_retries:
            raise RuntimeError(f"Upload failed after {max_retries} retries: {file_path}")
        sleep_for = min((2 ** retries) + random.random(), 60)
        time.sleep(sleep_for)

    raise RuntimeError(f"Upload response missing video id for file: {file_path}")


def resolve_playlist_id(youtube, playlist_name: str) -> Optional[str]:
    """Find a YouTube playlist by name. Returns playlist ID or None."""
    if not playlist_name.strip():
        return None

    wanted = clean_text(playlist_name).lower()
    next_page_token: Optional[str] = None
    fallback_id: Optional[str] = None

    while True:
        response = youtube.playlists().list(
            part="snippet",
            mine=True,
            maxResults=50,
            pageToken=next_page_token,
        ).execute()

        for item in response.get("items", []):
            title = clean_text(item.get("snippet", {}).get("title", ""))
            if not title:
                continue
            playlist_id = item.get("id")
            if not playlist_id:
                continue
            if title.lower() == wanted:
                return playlist_id
            if fallback_id is None and wanted in title.lower():
                fallback_id = playlist_id

        next_page_token = response.get("nextPageToken")
        if not next_page_token:
            break

    return fallback_id


def add_video_to_playlist(youtube, playlist_id: str, video_id: str) -> str:
    """Add a video to a YouTube playlist. Returns the playlist item ID."""
    response = youtube.playlistItems().insert(
        part="snippet",
        body={
            "snippet": {
                "playlistId": playlist_id,
                "resourceId": {
                    "kind": "youtube#video",
                    "videoId": video_id,
                },
            }
        },
    ).execute()
    return str(response.get("id", ""))


def extract_http_error_reason(exc: Exception) -> Tuple[str, str]:
    """Extract error reason and message from a YouTube API HttpError."""
    if not isinstance(exc, HttpError):
        return "", ""
    try:
        payload = json.loads(exc.content.decode("utf-8"))
    except Exception:
        return str(exc), ""

    errors = payload.get("error", {}).get("errors", [])
    if errors:
        reason = errors[0].get("reason", "")
        message = errors[0].get("message", "")
        return reason, message
    return str(payload.get("error", {}).get("message", "")), ""
