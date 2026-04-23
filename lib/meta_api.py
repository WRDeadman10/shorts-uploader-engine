"""Meta (Instagram/Facebook) Reels API client — upload, publish, status check.

Shared between: metaBatchReelsUpload.py, youtubeBatchUpload.py (crosspost)
"""
from __future__ import annotations

import os
import time
from typing import Any, Dict, Optional, Tuple

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
    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as exc:
        try:
            error_payload = response.json()
            error_msg = extract_meta_error_message(error_payload)
            if error_msg:
                raise RuntimeError(f"Meta API Error ({response.status_code}): {error_msg}") from exc
        except (ValueError, KeyError):
            pass
        raise exc
    return response.json()


def ig_create_reel_container(
    ig_user_id: str,
    access_token: str,
    video_url: str,
    caption: str,   
    graph_version: str = "v25.0",
    timeout: float = 120,
) -> str:
    """Create an Instagram Reels container. Returns the container ID."""
    result = request_json(
        "POST",
        f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media",
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
    graph_version: str,
    container_id: str,
    access_token: str,
    file_path: str,
    timeout: float = 300,
) -> str:
    """Upload a reel binary to Instagram. Returns container ID."""
    with open(file_path, "rb") as f:
        result = request_json(
            "POST",
            f"https://graph.facebook.com/{graph_version}/{container_id}",
            data={
                "access_token": access_token,
            },
            files={"source": f},
            timeout=timeout,
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
    graph_version: str = "v25.0",
) -> str:
    """Poll Instagram until the container is ready for publishing."""
    waited = 0
    while waited < max_wait:
        result = request_json(
            "GET",
            f"https://graph.facebook.com/{graph_version}/{container_id}",
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
    graph_version: str = "v25.0",
    timeout: float = 120,
) -> str:
    """Publish a ready Instagram Reel. Returns the media ID."""
    result = request_json(
        "POST",
        f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media_publish",
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
    graph_version: str = "v25.0",
    timeout: float = 120,
) -> Tuple[str, str]:
    """Start a Facebook Reel upload session. Returns (video_id, upload_url)."""
    print(f"[fb_start_reel_session]")
    result = request_json(
        "POST",
        f"https://graph.facebook.com/{graph_version}/{page_id}/video_reels",
        data={
            "upload_phase": "start",
            "access_token": access_token,
        },
        timeout=timeout,
    )
    video_id = result.get("video_id")
    upload_url = result.get("upload_url")
    if not video_id or not upload_url:
        raise RuntimeError(f"FB session start failed: {result}")
    return str(video_id), str(upload_url)


def fb_upload_reel_binary(
    upload_url: str,
    access_token: str,
    file_path: str,
    timeout: float = 300,
) -> None:
    """Upload the video binary to the Facebook Resumable Upload endpoint.

    rupload.facebook.com requires raw binary with Authorization/offset/file_size
    headers — NOT multipart form data.
    """
    print(f"[fb_upload_reel_binary]")
    file_size = os.path.getsize(file_path)
    with open(file_path, "rb") as f:
        response = requests.post(
            upload_url,
            headers={
                "Authorization": f"OAuth {access_token}",
                "offset": "0",
                "file_size": str(file_size),
            },
            data=f,
            timeout=timeout,
        )
    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as exc:
        try:
            error_payload = response.json()
            error_msg = extract_meta_error_message(error_payload)
            if error_msg:
                raise RuntimeError(f"Meta API Error ({response.status_code}): {error_msg}") from exc
        except (ValueError, KeyError):
            pass
        raise exc
    result = response.json()
    if not result.get("success"):
        raise RuntimeError(f"FB binary upload failed: {result}")


def fb_finish_reel_publish(
    page_id: str,
    access_token: str,
    video_id: str,
    description: str,
    title: str = "",
    graph_version: str = "v25.0",
    timeout: float = 120,
    scheduled_publish_time: Optional[int] = None,
) -> str:
    """Finish and publish a Facebook Reel. Returns the post ID."""
    print(f"[fb_finish_reel_publish]")
    data: Dict[str, Any] = {
        "upload_phase": "finish",
        "video_id": video_id,
        "video_state": "SCHEDULED" if scheduled_publish_time else "PUBLISHED",
        "access_token": access_token,
    }
    if description:
        data["description"] = description
    if title:
        data["title"] = title
    if scheduled_publish_time is not None:
        data["scheduled_publish_time"] = scheduled_publish_time

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            result = request_json(
                "POST",
                f"https://graph.facebook.com/{graph_version}/{page_id}/video_reels",
                data=data,
                timeout=timeout,
            )
            post_id = result.get("id") or result.get("post_id")
            if not post_id:
                raise RuntimeError(f"FB publish failed: {result}")
            return str(post_id)
        except RuntimeError as exc:
            msg = str(exc)
            if "problem uploading your video file" in msg.lower() and attempt < max_attempts:
                print(f"[warn][fb] Publish attempt {attempt} failed, waiting 10s to retry...")
                time.sleep(10)
                continue
            raise
    # Should not be reachable
    return ""


def platform_enabled(platform_choice: str, platform_name: str) -> bool:
    """Check if a platform is enabled based on the user's choice."""
    if platform_choice == "both":
        return True
    return platform_choice.lower() == platform_name.lower()
