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
    row: Dict[str, Any] = {
        "status": status,
        "relative_path": relative_path,
        "source_file": str(source_file),
        "metadata_file": str(metadata_file),
        "title": title,
        "updated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
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
    ledger_state["entries"][state_key] = row


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
