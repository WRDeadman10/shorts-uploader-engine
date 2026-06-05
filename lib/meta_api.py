"""Meta (Instagram/Facebook) Reels API client — upload, publish, status check.

Shared between: metaBatchReelsUpload.py, youtubeBatchUpload.py (crosspost)
"""
from __future__ import annotations

import os
import time
from typing import Any, Dict, Optional, Tuple

import json
import requests


def is_facebook_rate_limited_error(exc: Exception) -> bool:
    """Check if an exception is a Facebook rate limit error."""
    msg = str(exc).lower()
    return "rate limit" in msg or "too many calls" in msg or "#32" in msg


def is_retryable_instagram_processing_error(exc: Exception) -> bool:
    """Return True for transient Instagram processing errors worth retrying.

    Meta's API may return {'retriable': False} in the error payload, but for 
    ProcessingFailedError and 500 errors, their backend is so flaky that 
    retrying often succeeds regardless. We force retries for known transient issues.
    """
    msg = str(exc).lower()
    
    # Always retry these notorious transient errors
    if "processingfailederror" in msg or "request processing failed" in msg or "unknown error" in msg:
        return True
        
    # If Meta explicitly says non-retryable for other errors, trust it
    if "'retriable': false" in msg or '"retriable": false' in msg or "retriable\': false" in msg:
        return False
        
    if "processing" in msg or "timeout" in msg:
        return True
    return any(phrase in msg for phrase in [
        "in_progress", "in progress", "media not found",
        "try again", "temporarily", "transient",
    ])


def extract_meta_error_message(payload: Any) -> str:
    """Extract a human-readable error from a Meta API response."""
    if isinstance(payload, dict):
        err = payload.get("error", {})
        if isinstance(err, dict):
            return str(err.get("message", err.get("error_user_msg", "")))
        # Also check for debug_info (used by Instagram binary upload errors)
        debug = payload.get("debug_info", {})
        if isinstance(debug, dict) and debug.get("message"):
            return f"{debug.get('type', 'Error')}: {debug['message']} (retriable={debug.get('retriable', '?')})"
        return str(err)
    return str(payload)[:200]


def _extract_http_error_detail(response: requests.Response) -> str:
    """Best-effort extraction of useful HTTP error details."""
    try:
        payload = response.json()
        msg = extract_meta_error_message(payload)
        if msg:
            return msg
        return str(payload)[:400]
    except ValueError:
        text = (response.text or "").strip()
        return text[:400] if text else ""


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
        error_msg = _extract_http_error_detail(response)
        if error_msg:
            raise RuntimeError(f"Meta API Error ({response.status_code}): {error_msg}") from exc
        raise exc
    return response.json()


def ig_create_reel_container(
    ig_user_id: str,
    access_token: str,
    caption: str,
    graph_version: str = "v25.0",
    timeout: float = 120,
    scheduled_publish_time: Optional[int] = None,
) -> Tuple[str, str]:
    """Create an Instagram Reels resumable-upload container.

    Returns (container_id, upload_uri).
    The caller must POST the video binary to upload_uri via ig_upload_reel_binary().
    If scheduled_publish_time (Unix timestamp) is provided the container is created
    with published=false so Meta will auto-publish at the scheduled time.
    """
    data: Dict[str, Any] = {
        "media_type": "REELS",
        "upload_type": "resumable",
        "caption": caption,
        "access_token": access_token,
    }
    if scheduled_publish_time is not None:
        data["scheduled_publish_time"] = scheduled_publish_time
        data["published"] = "false"
    result = request_json(
        "POST",
        f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media",
        data=data,
        timeout=timeout,
    )
    container_id = result.get("id")
    upload_uri = result.get("uri", "")
    if not container_id:
        raise RuntimeError(f"IG container creation failed: {result}")
    if not upload_uri:
        raise RuntimeError(f"IG container creation returned no upload URI: {result}")
    return str(container_id), str(upload_uri)


def ig_upload_reel_binary(
    upload_uri: str,
    access_token: str,
    file_path: str,
    timeout: float = 300,
) -> None:
    """Upload the video binary to the Instagram resumable upload URI in chunks.
    
    Using exact logic from test script to bypass Meta processing failures.
    """
    file_size = os.path.getsize(file_path)
    chunk_size = 10 * 1024 * 1024  # 10MB chunks
    
    print(f"\n[instagram] Starting raw binary upload to {upload_uri[:50]}... (Size: {file_size})")
    
    with open(file_path, "rb") as f:
        offset = 0
        while offset < file_size:
            chunk = f.read(chunk_size)
            if not chunk:
                break
                
            print(f"[instagram] Uploading chunk offset {offset} size {len(chunk)}...")
            
            headers = {
                "Authorization": f"OAuth {access_token}",
                "offset": str(offset),
                "file_size": str(file_size),
                "Content-Type": "application/octet-stream",
                "Accept": "application/json",
            }
            
            # Intentionally ignoring timeout here to perfectly match test script
            response = requests.post(
                upload_uri,
                headers=headers,
                data=chunk,
            )
            
            print(f"[instagram] Chunk Response: {response.status_code} {response.text}")
            
            try:
                # 206 Partial Content is expected for all but the last chunk
                if response.status_code not in (200, 206):
                    response.raise_for_status()
            except requests.exceptions.HTTPError as exc:
                error_msg = _extract_http_error_detail(response)
                if error_msg:
                    raise RuntimeError(
                        f"Meta API Error ({response.status_code}) during IG binary upload: {error_msg}"
                    ) from exc
                raise exc
                
            offset += len(chunk)
            
            if offset >= file_size:
                result = response.json()
                if not result.get("success"):
                    raise RuntimeError(f"IG binary upload failed: {result}")


def ig_wait_until_ready(
    container_id: str,
    access_token: str,
    graph_version: str = "v25.0",
    attempts: int = 30,
    interval_seconds: float = 10,
    timeout: float = 120,
) -> str:
    """Poll Instagram until the container is ready for publishing."""
    for attempt in range(1, max(attempts, 1) + 1):
        result = request_json(
            "GET",
            f"https://graph.facebook.com/{graph_version}/{container_id}",
            params={
                "fields": "status_code,status",
                "access_token": access_token,
            },
            timeout=timeout,
        )
        status = str(result.get("status_code", "")).upper()
        if status == "FINISHED":
            return "FINISHED"
        if status in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"IG container {container_id} failed: {result}")
        if attempt < attempts:
            time.sleep(interval_seconds)
    raise RuntimeError(
        f"IG container {container_id} not ready after {attempts} attempts "
        f"({attempts * interval_seconds:.0f}s)"
    )


def ig_publish_reel(
    ig_user_id: str,
    access_token: str,
    container_id: str,
    graph_version: str = "v25.0",
    timeout: float = 120,
) -> str:
    """Publish a ready Instagram Reel. Returns the media ID.

    For scheduled reels, scheduled_publish_time must be set on the container
    (ig_create_reel_container) — not here. This call is always immediate-publish.
    """
    result = request_json(
        "POST",
        f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": access_token,
        },
        timeout=timeout,
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
    """Upload the video binary to the Facebook Resumable Upload endpoint in chunks.

    rupload.facebook.com requires raw binary with Authorization/offset/file_size
    headers — NOT multipart form data.
    """
    print(f"[fb_upload_reel_binary]")
    file_size = os.path.getsize(file_path)
    chunk_size = 10 * 1024 * 1024  # 10MB chunks
    
    with open(file_path, "rb") as f:
        offset = 0
        while offset < file_size:
            chunk = f.read(chunk_size)
            if not chunk:
                break
                
            response = requests.post(
                upload_url,
                headers={
                    "Authorization": f"OAuth {access_token}",
                    "offset": str(offset),
                    "file_size": str(file_size),
                },
                data=chunk,
                timeout=timeout,
            )
            
            try:
                if response.status_code not in (200, 206):
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
                
            offset += len(chunk)
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

def resolve_meta_credentials(
    user_access_token: str,
    target_page_id: str,
    graph_version: str = "v25.0",
    cache_file: str = ".meta_auth_cache.json"
) -> Tuple[str, str]:
    """Resolve and cache Page Access Token and IG User ID from a User Access Token.
    Returns (page_access_token, instagram_user_id).
    """
    # 1. Check Cache
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cache = json.load(f)
            if target_page_id in cache:
                page_data = cache[target_page_id]
                return page_data["page_access_token"], page_data["ig_user_id"]
        except Exception:
            pass

    print("[meta_api] Fetching fresh Page Access Token from Graph API...")
    url = f"https://graph.facebook.com/{graph_version}/me/accounts"
    params = {
        "fields": "id,name,access_token,instagram_business_account{id,username}",
        "access_token": user_access_token
    }

    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        raise RuntimeError(f"Failed to fetch Meta accounts (is your user access token expired?): {exc}")

    accounts = data.get("data", [])
    for account in accounts:
        if str(account.get("id")) == str(target_page_id):
            page_access_token = account.get("access_token")
            ig_account = account.get("instagram_business_account", {})
            ig_user_id = ig_account.get("id", "")
            
            if not page_access_token:
                raise RuntimeError(f"Found page {target_page_id} but no access_token was returned.")
                
            # 4. Cache and Return
            cache = {}
            if os.path.exists(cache_file):
                try:
                    with open(cache_file, "r", encoding="utf-8") as f:
                        cache = json.load(f)
                except Exception:
                    pass
            cache[target_page_id] = {
                "page_access_token": page_access_token,
                "ig_user_id": ig_user_id,
                "page_name": account.get("name", "")
            }
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(cache, f, indent=2)
                
            return page_access_token, ig_user_id
            
    raise RuntimeError(
        f"Could not find Page ID {target_page_id} in the accounts returned by Meta API. "
        f"Found IDs: {[a.get('id') for a in accounts]}"
    )
