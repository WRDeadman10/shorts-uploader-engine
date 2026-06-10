"""Platform upload ledger — tracks upload status across YouTube, Instagram, Facebook.

Used by: youtubeBatchUpload, metaBatchReelsUpload, generateLiveUploadAudit,
         rebuildUploadComparison
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def ensure_platform_upload_ledger_shape(data: Any) -> Dict[str, Any]:
    """Normalize ledger data to the expected shape."""
    if not isinstance(data, dict):
        data = {}
    entries = data.get("entries")
    if not isinstance(entries, dict):
        data["entries"] = {}
    return data


def update_platform_upload_ledger(
    ledger_state: Dict[str, Any],
    *,
    state_key: str,
    status: str,
    relative_path: str,
    source_file: Any,
    metadata_file: Any,
    title: str,
    platform_id_key: str,
    platform_id_value: str,
    extra_fields: Optional[Dict[str, Any]] = None,
    error_message: str = "",
) -> None:
    """Record an upload result in the ledger."""
    entries = ledger_state.get("entries")
    if not isinstance(entries, dict):
        ledger_state["entries"] = {}
        entries = ledger_state["entries"]

    existing_row = entries.get(state_key)
    if isinstance(existing_row, dict):
        row = existing_row.copy()
        if status == "error" and row.get("status") == "pre cooked":
            status = "pre cooked" # Keep as pre cooked but add error message
    else:
        row = {}

    row.update({
        "status": status,
        "relative_path": relative_path,
        "source_file": str(source_file),
        "metadata_file": str(metadata_file),
        "title": title,
        "updated_at_utc": datetime.now(timezone.utc).isoformat(),
    })

    if platform_id_key:
        row[platform_id_key] = platform_id_value
    if status == "ok":
        row["uploaded_at_utc"] = datetime.now(timezone.utc).isoformat()
    elif status == "scheduled":
        row["scheduled_at_utc"] = datetime.now(timezone.utc).isoformat()
    elif error_message:
        row["error"] = error_message
    if extra_fields:
        for field_name, field_value in extra_fields.items():
            row[field_name] = field_value
            
    entries[state_key] = row


def is_platform_upload_completed(ledger_state: Dict[str, Any], state_key: str) -> bool:
    """Check if a specific entry has been successfully uploaded."""
    entries = ledger_state.get("entries", {})
    if not isinstance(entries, dict):
        return False
    row = entries.get(state_key, {})
    if not isinstance(row, dict):
        return False
    return str(row.get("status", "")).strip().lower() in {"ok", "scheduled"}


def normalize_platform_names_csv(raw: str) -> List[str]:
    """Parse and validate comma-separated platform names."""
    values: List[str] = []
    seen: set[str] = set()
    for item in raw.split(","):
        cleaned = item.strip().lower()
        if not cleaned:
            continue
        if cleaned not in {"youtube", "instagram", "facebook"}:
            raise ValueError(f"Unsupported platform name: {cleaned}")
        if cleaned in seen:
            continue
        seen.add(cleaned)
        values.append(cleaned)
    return values


def is_uploaded_on_platform(
    platform_name: str,
    *,
    state_key: str,
    uploaded_state: Dict[str, Any],
    instagram_upload_ledger: Dict[str, Any],
    facebook_upload_ledger: Dict[str, Any],
) -> bool:
    """Check if a video is uploaded on a specific platform."""
    if platform_name == "youtube":
        return state_key in uploaded_state
    if platform_name == "instagram":
        return is_platform_upload_completed(instagram_upload_ledger, state_key)
    if platform_name == "facebook":
        return is_platform_upload_completed(facebook_upload_ledger, state_key)
    return False


def get_platform_upload_status(ledger_state: Dict[str, Any], state_key: str) -> str:
    entries = ledger_state.get('entries', {})
    if not isinstance(entries, dict):
        return ''
    row = entries.get(state_key, {})
    if not isinstance(row, dict):
        return ''
    return str(row.get('status', '')).strip().lower()


def initialize_discovered_videos_in_ledgers(
    root: Any,
    videos: List[Any],
    ledgers: List[Dict[str, Any]],
) -> None:
    """Pre-fill ledgers with discovered videos as 'not uploaded'."""
    from lib.file_utils import file_key
    for video_path in videos:
        key = file_key(root, video_path)
        try:
            rel_path = video_path.resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            rel_path = video_path.name
            
        for ledger in ledgers:
            entries = ledger.get("entries")
            if not isinstance(entries, dict):
                ledger["entries"] = {}
                entries = ledger["entries"]
            if key not in entries:
                entries[key] = {
                    "status": "not uploaded",
                    "relative_path": rel_path,
                    "source_file": str(video_path),
                    "discovered_at_utc": datetime.now(timezone.utc).isoformat()
                }
