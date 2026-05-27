import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from lib.file_utils import load_json_file, save_json_file
from lib.text_utils import clean_text

def parse_schedule_slots(schedule_plan: Optional[str]) -> List[Dict[str, Any]]:
    if not schedule_plan:
        return []
    try:
        raw_slots = json.loads(schedule_plan)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid --schedule-plan JSON: {exc}") from exc
    if not isinstance(raw_slots, list):
        raise ValueError("--schedule-plan must be a JSON array.")

    slots: List[Dict[str, Any]] = []
    for index, raw_slot in enumerate(raw_slots, start=1):
        if not isinstance(raw_slot, dict):
            raise ValueError(f"--schedule-plan slot {index} must be an object.")
        try:
            count = int(raw_slot.get("count", 0))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"--schedule-plan slot {index} has an invalid count.") from exc
        publish_at = clean_text(str(raw_slot.get("publish_at", "")))
        if count < 1:
            raise ValueError(f"--schedule-plan slot {index} count must be at least 1.")
        if not publish_at:
            raise ValueError(f"--schedule-plan slot {index} is missing publish_at.")
        slots.append({"count": count, "publish_at": publish_at})
    return slots

def expand_schedule_publish_sequence(slots: List[Dict[str, Any]]) -> List[str]:
    return [
        str(slot["publish_at"])
        for slot in slots
        for _ in range(int(slot["count"]))
    ]

def build_schedule_signature(*, root: Path, target_platform: str, slots: List[Dict[str, Any]]) -> str:
    payload = {
        "root": str(root),
        "target_platform": target_platform,
        "slots": slots,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

def load_schedule_cursor(progress_file: Path, signature: str, total_slots: int) -> int:
    if total_slots <= 0:
        return 0
    progress = load_json_file(progress_file, default={})
    if not isinstance(progress, dict):
        return 0
    cursors = progress.get("cursors")
    if not isinstance(cursors, dict):
        return 0
    active = cursors.get(signature)
    if not isinstance(active, dict):
        return 0
    try:
        cursor = int(active.get("next_index", 0))
    except (TypeError, ValueError):
        return 0
    if cursor >= total_slots:
        return 0
    return max(cursor, 0)

def save_schedule_cursor(
    progress_file: Path,
    *,
    signature: str,
    next_index: int,
    total_slots: int,
    target_platform: str,
    root: Path,
    slots: List[Dict[str, Any]],
) -> None:
    if total_slots <= 0:
        return
    progress = load_json_file(progress_file, default={})
    if not isinstance(progress, dict):
        progress = {}
    cursors = progress.get("cursors")
    if not isinstance(cursors, dict):
        cursors = {}

    now = datetime.now(timezone.utc).isoformat()
    if next_index >= total_slots:
        cursors.pop(signature, None)
        progress["cursors"] = cursors
        completed = progress.get("last_completed")
        if not isinstance(completed, dict):
            completed = {}
        completed[signature] = {
            "signature": signature,
            "target_platform": target_platform,
            "root": str(root),
            "total_slots": total_slots,
            "completed_at_utc": now,
        }
        progress["last_completed"] = completed
        save_json_file(progress_file, progress)
        return

    cursors[signature] = {
        "signature": signature,
        "target_platform": target_platform,
        "root": str(root),
        "slots": slots,
        "next_index": next_index,
        "total_slots": total_slots,
        "updated_at_utc": now,
    }
    progress["cursors"] = cursors
    save_json_file(progress_file, progress)
