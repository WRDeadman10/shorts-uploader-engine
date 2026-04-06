"""Meta (Instagram/Facebook) Reels API client — upload, publish, status check.

Shared between: metaBatchReelsUpload.py, youtubeBatchUpload.py (crosspost)
"""
from __future__ import annotations

import time
from typing import Any, Dict, Optional

import requests


def is_facebook_rate_limited_error(exc: Exception) -> bool:
    """Check if an exception is a Facebook rate limit error."""
    msg = str(exc).lower()
    return "rate limit" in msg or "too many calls" in msg or "#32" in msg


def extract_meta_error_message(payload: Any) -> str:
    """Extract a human-readable error from a Meta API response."""
    if isinstance(payload, dict):
        err = payload.get("error", {})
        if isinstance(err, dict):
            return str(err.get("message", err.get("error_user_msg", "")))
        return str(err)
    return str(payload)[:200]


def request_json(
    method: str,
    url: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None,
    files: Optional[Dict[str, Any]] = None,
    timeout: int = 120,
) -> Dict[str, Any]:
    """Make an HTTP request and return parsed JSON."""
    response = requests.request(
        method, url,
        params=params, data=data, files=files,
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def ig_create_reel_container(
    ig_user_id: str,
    access_token: str,
    video_url: str,
    caption: str,
) -> str:
    """Create an Instagram Reels container. Returns the container ID."""
    result = request_json(
        "POST",
        f"https://graph.facebook.com/v21.0/{ig_user_id}/media",
        data={
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "access_token": access_token,
        },
    )
    container_id = result.get("id")
    if not container_id:
        raise RuntimeError(f"IG container creation failed: {result}")
    return str(container_id)


def ig_upload_reel_binary(
    ig_user_id: str,
    access_token: str,
    video_path: str,
    caption: str,
) -> str:
    """Upload a reel binary to Instagram. Returns container ID."""
    with open(video_path, "rb") as f:
        result = request_json(
            "POST",
            f"https://graph.facebook.com/v21.0/{ig_user_id}/media",
            data={
                "media_type": "REELS",
                "caption": caption,
                "access_token": access_token,
            },
            files={"source": f},
            timeout=300,
        )
    container_id = result.get("id")
    if not container_id:
        raise RuntimeError(f"IG binary upload failed: {result}")
    return str(container_id)


def ig_wait_until_ready(
    container_id: str,
    access_token: str,
    max_wait: int = 300,
    poll_interval: int = 10,
) -> str:
    """Poll Instagram until the container is ready for publishing."""
    waited = 0
    while waited < max_wait:
        result = request_json(
            "GET",
            f"https://graph.facebook.com/v21.0/{container_id}",
            params={
                "fields": "status_code,status",
                "access_token": access_token,
            },
        )
        status = str(result.get("status_code", "")).upper()
        if status == "FINISHED":
            return "FINISHED"
        if status in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"IG container {container_id} failed: {result}")
        time.sleep(poll_interval)
        waited += poll_interval
    raise RuntimeError(f"IG container {container_id} not ready after {max_wait}s")


def ig_publish_reel(
    ig_user_id: str,
    access_token: str,
    container_id: str,
) -> str:
    """Publish a ready Instagram Reel. Returns the media ID."""
    result = request_json(
        "POST",
        f"https://graph.facebook.com/v21.0/{ig_user_id}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": access_token,
        },
    )
    media_id = result.get("id")
    if not media_id:
        raise RuntimeError(f"IG publish failed: {result}")
    return str(media_id)


def fb_start_reel_session(
    page_id: str,
    access_token: str,
    description: str,
) -> str:
    """Start a Facebook Reel upload session. Returns the video ID."""
    result = request_json(
        "POST",
        f"https://graph.facebook.com/v21.0/{page_id}/video_reels",
        data={
            "upload_phase": "start",
            "access_token": access_token,
        },
    )
    video_id = result.get("video_id")
    if not video_id:
        raise RuntimeError(f"FB session start failed: {result}")
    return str(video_id)


def fb_upload_reel_binary(
    video_id: str,
    access_token: str,
    video_path: str,
) -> None:
    """Upload the video binary to an existing Facebook Reel session."""
    with open(video_path, "rb") as f:
        result = request_json(
            "POST",
            f"https://graph.facebook.com/v21.0/{video_id}",
            data={
                "upload_phase": "transfer",
                "access_token": access_token,
            },
            files={"source": f},
            timeout=300,
        )
    if not result.get("success"):
        raise RuntimeError(f"FB binary upload failed: {result}")


def fb_finish_reel_publish(
    page_id: str,
    access_token: str,
    video_id: str,
    description: str,
) -> str:
    """Finish and publish a Facebook Reel. Returns the post ID."""
    result = request_json(
        "POST",
        f"https://graph.facebook.com/v21.0/{page_id}/video_reels",
        data={
            "upload_phase": "finish",
            "video_id": video_id,
            "description": description,
            "access_token": access_token,
        },
    )
    post_id = result.get("id") or result.get("post_id")
    if not post_id:
        raise RuntimeError(f"FB publish failed: {result}")
    return str(post_id)


def platform_enabled(platform_choice: str, platform_name: str) -> bool:
    """Check if a platform is enabled based on the user's choice."""
    if platform_choice == "both":
        return True
    return platform_choice.lower() == platform_name.lower()
