"""Rebuild upload_comparison.json from existing local audit JSON files."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rebuild upload_comparison.json from existing local audit files."
    )
    parser.add_argument(
        "--audit-dir",
        default="live_upload_audit",
        help="Directory containing offline_videos.json and platform upload JSON files.",
    )
    return parser.parse_args()


def load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def save_json_file(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def extract_count(payload: Dict[str, Any]) -> int:
    raw_count = payload.get("count")
    if isinstance(raw_count, int):
        return max(raw_count, 0)

    entries = payload.get("entries", [])
    if isinstance(entries, list):
        return len(entries)

    return 0


def extract_matched_count(payload: Dict[str, Any]) -> int:
    raw_value = payload.get("matched_count")
    if isinstance(raw_value, int):
        return max(raw_value, 0)

    entries = payload.get("entries", [])
    if not isinstance(entries, list):
        return 0

    matched_count = 0
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if str(entry.get("matched_state_key", "")).strip():
            matched_count += 1
    return matched_count


def extract_state_keys(payload: Dict[str, Any]) -> List[str]:
    entries = payload.get("entries", [])
    if not isinstance(entries, list):
        return []

    state_keys: List[str] = []
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        state_key = str(entry.get("matched_state_key", "")).strip()
        if not state_key or state_key in seen:
            continue
        seen.add(state_key)
        state_keys.append(state_key)
    return state_keys


def build_platform_summary(
    payload: Dict[str, Any],
    offline_count: int,
    offline_state_keys: List[str],
) -> Dict[str, Any]:
    live_uploaded_count = extract_count(payload)
    matched_state_keys_count = extract_matched_count(payload)
    matched_state_keys = extract_state_keys(payload)
    fetch_error = str(payload.get("fetch_error", "")).strip()
    matched_state_key_lookup = set(matched_state_keys)
    not_uploaded_state_keys: List[str] = []
    for state_key in offline_state_keys:
        if state_key not in matched_state_key_lookup:
            not_uploaded_state_keys.append(state_key)

    summary: Dict[str, Any] = {
        "uploaded_count": min(live_uploaded_count, offline_count),
        "not_uploaded_count": max(offline_count - live_uploaded_count, 0),
        "live_uploaded_count": live_uploaded_count,
        "matched_state_keys_count": matched_state_keys_count,
        "matched_state_keys": matched_state_keys,
        "not_uploaded_state_keys": not_uploaded_state_keys,
    }

    if fetch_error:
        summary["fetch_error"] = fetch_error

    return summary


def main() -> int:
    args = parse_args()
    audit_dir = Path(args.audit_dir).resolve()

    offline_payload = load_json_file(audit_dir / "offline_videos.json", default={})
    youtube_payload = load_json_file(audit_dir / "youtube_uploaded_videos.json", default={})
    instagram_payload = load_json_file(audit_dir / "instagram_uploaded_videos.json", default={})
    facebook_payload = load_json_file(audit_dir / "facebook_uploaded_videos.json", default={})

    offline_count_value = offline_payload.get("count", 0)
    if isinstance(offline_count_value, int):
        offline_count = max(offline_count_value, 0)
    else:
        offline_entries = offline_payload.get("entries", [])
        if isinstance(offline_entries, list):
            offline_count = len(offline_entries)
        else:
            offline_count = 0

    offline_state_keys: List[str] = []
    offline_entries = offline_payload.get("entries", [])
    if isinstance(offline_entries, list):
        for entry in offline_entries:
            if not isinstance(entry, dict):
                continue
            state_key = str(entry.get("state_key", "")).strip()
            if state_key:
                offline_state_keys.append(state_key)

    comparison_payload = {
        "generated_at_utc": now_utc_iso(),
        "offline_count": offline_count,
        "files": {
            "offline_inventory": str(audit_dir / "offline_videos.json"),
            "youtube_uploads": str(audit_dir / "youtube_uploaded_videos.json"),
            "instagram_uploads": str(audit_dir / "instagram_uploaded_videos.json"),
            "facebook_uploads": str(audit_dir / "facebook_uploaded_videos.json"),
        },
        "platforms": {
            "youtube": build_platform_summary(youtube_payload, offline_count, offline_state_keys),
            "instagram": build_platform_summary(instagram_payload, offline_count, offline_state_keys),
            "facebook": build_platform_summary(facebook_payload, offline_count, offline_state_keys),
        },
    }

    save_json_file(audit_dir / "upload_comparison.json", comparison_payload)
    print(json.dumps(comparison_payload, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
