"""Upload existing clips as Instagram and Facebook Reels using Meta Graph API.

This script reuses videos listed in `.youtube_upload_state.json` so you can
cross-post the same clips that were uploaded to YouTube.

Required credentials (CLI args or env vars):
- Meta Page access token:
  - --access-token, or META_PAGE_ACCESS_TOKEN / META_ACCESS_TOKEN
- Instagram professional account id (for IG uploads):
  - --ig-user-id, or INSTAGRAM_USER_ID / IG_USER_ID
- Facebook page id (for FB uploads):
  - --facebook-page-id, or FACEBOOK_PAGE_ID / FB_PAGE_ID

Examples:
python metaBatchReelsUpload.py --dry-run
python metaBatchReelsUpload.py --platform both --max-videos 5
python metaBatchReelsUpload.py --platform instagram
"""

from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:  # pragma: no cover - handled at runtime
    requests = None  # type: ignore[assignment]

# Leave empty to auto-use sibling folder named "VALORANT".
VIDEO_SOURCE_ROOT = ""


def get_default_video_root() -> str:
    if VIDEO_SOURCE_ROOT.strip():
        return VIDEO_SOURCE_ROOT.strip()
    script_dir = Path(__file__).resolve().parent
    sibling_valorant = script_dir.parent / "VALORANT"
    if sibling_valorant.exists():
        return str(sibling_valorant)
    return "."


DEFAULT_VIDEO_ROOT = get_default_video_root()
DEFAULT_SOURCE_STATE_FILE = ".youtube_upload_state.json"
DEFAULT_REELS_STATE_FILE = ".meta_reels_upload_state.json"
DEFAULT_GRAPH_VERSION = "v25.0"
DEFAULT_INSTAGRAM_UPLOAD_LEDGER_FILE = ".instagram_uploaded_videos.json"
DEFAULT_FACEBOOK_UPLOAD_LEDGER_FILE = ".facebook_uploaded_videos.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload existing local clips as Instagram/Facebook Reels."
    )
    parser.add_argument(
        "--source-state-file",
        default=DEFAULT_SOURCE_STATE_FILE,
        help="Path to YouTube upload state file used as source input.",
    )
    parser.add_argument(
        "--reels-state-file",
        default=DEFAULT_REELS_STATE_FILE,
        help="Path to save Instagram/Facebook reels upload state.",
    )
    parser.add_argument(
        "--instagram-upload-ledger-file",
        default=DEFAULT_INSTAGRAM_UPLOAD_LEDGER_FILE,
        help="Path to per-video Instagram upload ledger JSON.",
    )
    parser.add_argument(
        "--facebook-upload-ledger-file",
        default=DEFAULT_FACEBOOK_UPLOAD_LEDGER_FILE,
        help="Path to per-video Facebook upload ledger JSON.",
    )
    parser.add_argument(
        "--videos-root",
        default=DEFAULT_VIDEO_ROOT,
        help="Root directory used to resolve relative source video paths.",
    )
    parser.add_argument(
        "--platform",
        choices=["both", "instagram", "facebook"],
        default="both",
        help="Choose where to upload reels.",
    )
    parser.add_argument(
        "--graph-version",
        default=DEFAULT_GRAPH_VERSION,
        help="Meta Graph API version (example: v25.0).",
    )
    parser.add_argument(
        "--access-token",
        default=(
            os_env("META_PAGE_ACCESS_TOKEN")
            or os_env("META_ACCESS_TOKEN")
            or os_env("FACEBOOK_PAGE_ACCESS_TOKEN")
            or ""
        ),
        help="Meta Page access token (can also be set via env vars).",
    )
    parser.add_argument(
        "--ig-user-id",
        default=os_env("INSTAGRAM_USER_ID") or os_env("IG_USER_ID") or "",
        help="Instagram professional account ID.",
    )
    parser.add_argument(
        "--facebook-page-id",
        default=os_env("FACEBOOK_PAGE_ID") or os_env("FB_PAGE_ID") or "",
        help="Facebook Page ID.",
    )
    parser.add_argument(
        "--max-videos",
        type=int,
        default=0,
        help="Limit number of source videos processed (0 = all).",
    )
    parser.add_argument(
        "--skip-uploaded",
        action="store_true",
        default=True,
        help="Skip platform uploads already marked successful in reels state file.",
    )
    parser.add_argument(
        "--no-skip-uploaded",
        action="store_false",
        dest="skip_uploaded",
        help="Do not skip entries that already exist in reels state file.",
    )
    parser.add_argument(
        "--poll-attempts",
        type=int,
        default=30,
        help="Max status polling attempts for IG container readiness.",
    )
    parser.add_argument(
        "--poll-interval-seconds",
        type=float,
        default=4.0,
        help="Seconds between status polling attempts.",
    )
    parser.add_argument(
        "--request-timeout-seconds",
        type=float,
        default=120.0,
        help="HTTP timeout for each API request.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned actions without calling Meta APIs.",
    )
    return parser.parse_args()


def os_env(name: str) -> str:
    import os

    return os.getenv(name, "").strip()


def load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def save_json_file(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def ensure_platform_upload_ledger_shape(data: Any) -> Dict[str, Any]:
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
    source_file: Path,
    metadata_file: str,
    title: str,
    platform_id_key: str,
    platform_id_value: str,
    extra_fields: Optional[Dict[str, Any]] = None,
    error_message: str = "",
) -> None:
    row: Dict[str, Any] = {
        "status": status,
        "relative_path": relative_path,
        "source_file": str(source_file),
        "metadata_file": metadata_file,
        "title": title,
        "updated_at_utc": now_utc_iso(),
    }
    if platform_id_key:
        row[platform_id_key] = platform_id_value
    if status == "ok":
        row["uploaded_at_utc"] = now_utc_iso()
    elif error_message:
        row["error"] = error_message
    if extra_fields:
        for field_name, field_value in extra_fields.items():
            row[field_name] = field_value
    ledger_state["entries"][state_key] = row


def parse_iso_utc(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_one_line(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def clean_multiline(text: str) -> str:
    raw = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = [clean_one_line(line) for line in raw.split("\n")]
    return "\n".join(line for line in lines if line)


def build_caption_from_entry(entry: Dict[str, Any]) -> tuple[str, str, str]:
    title = clean_one_line(str(entry.get("title", "")))
    description = ""

    metadata_file_value = str(entry.get("metadata_file", "")).strip()
    if metadata_file_value:
        metadata_path = Path(metadata_file_value)
        if metadata_path.exists():
            metadata_payload = load_json_file(metadata_path, default={})
            metadata_obj = metadata_payload.get("metadata", {})
            if isinstance(metadata_obj, dict):
                meta_title = clean_one_line(str(metadata_obj.get("title", "")))
                meta_description = clean_multiline(str(metadata_obj.get("description", "")))
                if meta_title:
                    title = meta_title
                if meta_description:
                    description = meta_description

    if not title:
        rel = str(entry.get("relative_path", "")).strip()
        title = clean_one_line(Path(rel).stem if rel else "Valorant Reel")

    if description:
        combined = description
        if title and title.lower() not in description.lower():
            combined = f"{title}\n\n{description}"
    else:
        combined = title

    combined = clean_multiline(combined)
    ig_caption = combined[:2200].rstrip()
    fb_description = combined[:5000].rstrip()
    fb_title = title[:255].rstrip()
    return ig_caption, fb_description, fb_title


def resolve_source_video_path(entry: Dict[str, Any], videos_root: Path) -> Optional[Path]:
    uploaded_file_path = str(entry.get("uploaded_file_path", "")).strip()
    if uploaded_file_path:
        path = Path(uploaded_file_path)
        if path.exists():
            return path

    relative_path = str(entry.get("relative_path", "")).strip()
    if relative_path:
        path = videos_root / Path(relative_path)
        if path.exists():
            return path

    return None


def load_source_entries(source_state_file: Path) -> List[Dict[str, Any]]:
    source_data = load_json_file(source_state_file, default={"uploaded": {}})
    uploaded = source_data.get("uploaded", {})
    if not isinstance(uploaded, dict):
        return []

    entries: List[Dict[str, Any]] = []
    for state_key, row in uploaded.items():
        if not isinstance(row, dict):
            continue
        entries.append(
            {
                "state_key": str(state_key),
                "video_id": str(row.get("video_id", "")).strip(),
                "relative_path": str(row.get("relative_path", "")).strip(),
                "uploaded_file_path": str(row.get("uploaded_file_path", "")).strip(),
                "metadata_file": str(row.get("metadata_file", "")).strip(),
                "title": str(row.get("title", "")).strip(),
                "uploaded_at_utc": str(row.get("uploaded_at_utc", "")).strip(),
                "sort_time": parse_iso_utc(str(row.get("uploaded_at_utc", "")).strip()),
            }
        )
    entries.sort(key=lambda item: item["sort_time"])
    return entries


def extract_meta_error_message(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""
    error = payload.get("error", {})
    if not isinstance(error, dict):
        return ""
    message = str(error.get("message", "")).strip()
    error_type = str(error.get("type", "")).strip()
    code = str(error.get("code", "")).strip()
    subcode = str(error.get("error_subcode", "")).strip()
    parts = [p for p in [message, f"type={error_type}" if error_type else "", f"code={code}" if code else "", f"subcode={subcode}" if subcode else ""] if p]
    return " | ".join(parts)


def is_facebook_rate_limited_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "code=368" in message and "subcode=1390008" in message


def request_json(
    method: str,
    url: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    data: Optional[Any] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: float,
) -> Dict[str, Any]:
    assert requests is not None
    try:
        response = requests.request(
            method=method.upper(),
            url=url,
            params=params,
            data=data,
            headers=headers,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"HTTP request failed: {exc}") from exc

    text = response.text or ""
    parsed: Any = {}
    if text.strip():
        try:
            parsed = response.json()
        except ValueError:
            parsed = {"raw": text.strip()}

    if response.status_code >= 400:
        err = extract_meta_error_message(parsed)
        if not err:
            err = text[:400].strip() or f"status={response.status_code}"
        raise RuntimeError(f"Meta API error ({response.status_code}): {err}")

    if isinstance(parsed, dict):
        return parsed
    return {"value": parsed}


def ig_create_reel_container(
    graph_version: str,
    ig_user_id: str,
    access_token: str,
    caption: str,
    timeout: float,
) -> str:
    url = f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media"
    payload = {
        "media_type": "REELS",
        "upload_type": "resumable",
        "caption": caption,
        "access_token": access_token,
    }
    response = request_json("POST", url, data=payload, timeout=timeout)
    container_id = str(response.get("id", "")).strip()
    if not container_id:
        raise RuntimeError(f"Instagram container creation missing id: {response}")
    return container_id


def ig_upload_reel_binary(
    graph_version: str,
    container_id: str,
    access_token: str,
    file_path: Path,
    timeout: float,
) -> None:
    url = f"https://rupload.facebook.com/ig-api-upload/{graph_version}/{container_id}"
    file_size = file_path.stat().st_size
    headers = {
        "Authorization": f"OAuth {access_token}",
        "offset": "0",
        "file_size": str(file_size),
        "Content-Type": "application/octet-stream",
    }
    with file_path.open("rb") as fh:
        request_json("POST", url, headers=headers, data=fh, timeout=timeout)


def ig_wait_until_ready(
    graph_version: str,
    container_id: str,
    access_token: str,
    attempts: int,
    interval_seconds: float,
    timeout: float,
) -> None:
    url = f"https://graph.facebook.com/{graph_version}/{container_id}"
    params = {"fields": "status_code,status", "access_token": access_token}

    for attempt in range(1, max(attempts, 1) + 1):
        response = request_json("GET", url, params=params, timeout=timeout)
        status_code = clean_one_line(str(response.get("status_code", ""))).upper()
        status = clean_one_line(str(response.get("status", ""))).upper()

        if status_code in {"FINISHED", "PUBLISHED"} or status in {"FINISHED", "PUBLISHED"}:
            return
        if status_code in {"ERROR", "EXPIRED"} or status in {"ERROR", "EXPIRED"}:
            raise RuntimeError(
                f"Instagram container failed. status_code={status_code or '?'} status={status or '?'}"
            )

        if attempt < attempts:
            time.sleep(max(interval_seconds, 0.0))

    raise RuntimeError("Instagram container did not become ready before timeout.")


def ig_publish_reel(
    graph_version: str,
    ig_user_id: str,
    container_id: str,
    access_token: str,
    timeout: float,
) -> str:
    url = f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media_publish"
    payload = {"creation_id": container_id, "access_token": access_token}
    response = request_json("POST", url, data=payload, timeout=timeout)
    media_id = clean_one_line(str(response.get("id", "")))
    if not media_id:
        raise RuntimeError(f"Instagram publish response missing id: {response}")
    return media_id


def fb_start_reel_session(
    graph_version: str,
    page_id: str,
    access_token: str,
    timeout: float,
) -> tuple[str, str]:
    url = f"https://graph.facebook.com/{graph_version}/{page_id}/video_reels"
    payload = {"upload_phase": "start", "access_token": access_token}
    response = request_json("POST", url, data=payload, timeout=timeout)
    video_id = clean_one_line(str(response.get("video_id", "")))
    upload_url = clean_one_line(str(response.get("upload_url", "")))
    if not video_id or not upload_url:
        raise RuntimeError(f"Facebook start session missing fields: {response}")
    return video_id, upload_url


def fb_upload_reel_binary(
    upload_url: str,
    access_token: str,
    file_path: Path,
    timeout: float,
) -> None:
    file_size = file_path.stat().st_size
    headers = {
        "Authorization": f"OAuth {access_token}",
        "offset": "0",
        "file_size": str(file_size),
        "Content-Type": "application/octet-stream",
    }
    with file_path.open("rb") as fh:
        request_json("POST", upload_url, headers=headers, data=fh, timeout=timeout)


def fb_finish_reel_publish(
    graph_version: str,
    page_id: str,
    access_token: str,
    video_id: str,
    description: str,
    title: str,
    timeout: float,
) -> Dict[str, Any]:
    url = f"https://graph.facebook.com/{graph_version}/{page_id}/video_reels"
    payload = {
        "access_token": access_token,
        "video_id": video_id,
        "upload_phase": "finish",
        "video_state": "PUBLISHED",
        "description": description,
    }
    if title:
        payload["title"] = title
    return request_json("POST", url, data=payload, timeout=timeout)


def platform_enabled(platform_choice: str, platform_name: str) -> bool:
    return platform_choice == "both" or platform_choice == platform_name


def ensure_meta_state_shape(data: Any) -> Dict[str, Any]:
    if not isinstance(data, dict):
        data = {}
    entries = data.get("entries")
    if not isinstance(entries, dict):
        data["entries"] = {}
    return data


def should_skip_platform(
    reels_entries: Dict[str, Any],
    state_key: str,
    platform_name: str,
    skip_uploaded: bool,
) -> bool:
    if not skip_uploaded:
        return False
    row = reels_entries.get(state_key, {})
    if not isinstance(row, dict):
        return False
    platform_row = row.get(platform_name, {})
    if not isinstance(platform_row, dict):
        return False
    return clean_one_line(str(platform_row.get("status", ""))).lower() == "ok"


def main() -> int:
    if requests is None:
        print("[error] missing dependency: requests. Run: pip install -r requirements.txt")
        return 2

    args = parse_args()

    source_state_file = Path(args.source_state_file).resolve()
    reels_state_file = Path(args.reels_state_file).resolve()
    instagram_upload_ledger_file = Path(args.instagram_upload_ledger_file).resolve()
    facebook_upload_ledger_file = Path(args.facebook_upload_ledger_file).resolve()
    videos_root = Path(args.videos_root).resolve()

    if not source_state_file.exists():
        print(f"[error] source state file not found: {source_state_file}")
        return 2

    access_token = clean_one_line(args.access_token)
    ig_user_id = clean_one_line(args.ig_user_id)
    facebook_page_id = clean_one_line(args.facebook_page_id)

    if not access_token and not args.dry_run:
        print("[error] missing access token. Set --access-token or META_PAGE_ACCESS_TOKEN.")
        return 2
    if platform_enabled(args.platform, "instagram") and not ig_user_id and not args.dry_run:
        print("[error] missing IG user id. Set --ig-user-id or INSTAGRAM_USER_ID.")
        return 2
    if platform_enabled(args.platform, "facebook") and not facebook_page_id and not args.dry_run:
        print("[error] missing Facebook page id. Set --facebook-page-id or FACEBOOK_PAGE_ID.")
        return 2

    source_entries = load_source_entries(source_state_file)
    if not source_entries:
        print("[info] no uploaded source entries found.")
        return 0

    reels_state = ensure_meta_state_shape(
        load_json_file(reels_state_file, default={"entries": {}})
    )
    reels_entries = reels_state["entries"]
    instagram_upload_ledger = ensure_platform_upload_ledger_shape(
        load_json_file(instagram_upload_ledger_file, default={"entries": {}})
    )
    facebook_upload_ledger = ensure_platform_upload_ledger_shape(
        load_json_file(facebook_upload_ledger_file, default={"entries": {}})
    )

    selected_entries = source_entries
    if args.max_videos > 0:
        selected_entries = source_entries[: args.max_videos]

    print(
        f"[info] source entries: {len(source_entries)} | "
        f"selected: {len(selected_entries)} | "
        f"platform={args.platform} | dry_run={args.dry_run}"
    )

    success_instagram = 0
    success_facebook = 0
    failed_instagram = 0
    failed_facebook = 0
    skipped_all = 0
    facebook_blocked_for_run = False

    for entry in selected_entries:
        state_key = entry["state_key"]
        state_row = reels_entries.get(state_key, {})
        if not isinstance(state_row, dict):
            state_row = {}
            reels_entries[state_key] = state_row

        do_instagram = platform_enabled(args.platform, "instagram") and not should_skip_platform(
            reels_entries, state_key, "instagram", args.skip_uploaded
        )
        do_facebook = platform_enabled(args.platform, "facebook") and not should_skip_platform(
            reels_entries, state_key, "facebook", args.skip_uploaded
        )
        if facebook_blocked_for_run:
            do_facebook = False

        if not do_instagram and not do_facebook:
            skipped_all += 1
            continue

        source_file = resolve_source_video_path(entry, videos_root)
        if not source_file:
            print(
                f"[warn] source file missing for state key: {state_key} "
                f"(uploaded_file_path and relative_path not found)"
            )
            if do_instagram:
                failed_instagram += 1
                update_platform_upload_ledger(
                    instagram_upload_ledger,
                    state_key=state_key,
                    status="error",
                    relative_path=str(entry.get("relative_path", "")).strip(),
                    source_file=videos_root / Path(str(entry.get("relative_path", "")).strip()),
                    metadata_file=str(entry.get("metadata_file", "")).strip(),
                    title=str(entry.get("title", "")).strip(),
                    platform_id_key="media_id",
                    platform_id_value="",
                    extra_fields={
                        "youtube_video_id": str(entry.get("video_id", "")).strip(),
                    },
                    error_message="source file missing",
                )
            if do_facebook:
                failed_facebook += 1
                update_platform_upload_ledger(
                    facebook_upload_ledger,
                    state_key=state_key,
                    status="error",
                    relative_path=str(entry.get("relative_path", "")).strip(),
                    source_file=videos_root / Path(str(entry.get("relative_path", "")).strip()),
                    metadata_file=str(entry.get("metadata_file", "")).strip(),
                    title=str(entry.get("title", "")).strip(),
                    platform_id_key="video_id",
                    platform_id_value="",
                    extra_fields={
                        "youtube_video_id": str(entry.get("video_id", "")).strip(),
                    },
                    error_message="source file missing",
                )
            save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
            save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)
            continue

        ig_caption, fb_description, fb_title = build_caption_from_entry(entry)

        print(f"\n[video] {entry.get('relative_path') or source_file.name}")
        print(f"[file] {source_file}")
        if args.dry_run:
            if do_instagram:
                print("[dry-run][instagram] would upload + publish reel")
            if do_facebook:
                print("[dry-run][facebook] would upload + publish reel")
            continue

        if do_instagram:
            try:
                container_id = ig_create_reel_container(
                    graph_version=args.graph_version,
                    ig_user_id=ig_user_id,
                    access_token=access_token,
                    caption=ig_caption,
                    timeout=args.request_timeout_seconds,
                )
                ig_upload_reel_binary(
                    graph_version=args.graph_version,
                    container_id=container_id,
                    access_token=access_token,
                    file_path=source_file,
                    timeout=args.request_timeout_seconds,
                )
                ig_wait_until_ready(
                    graph_version=args.graph_version,
                    container_id=container_id,
                    access_token=access_token,
                    attempts=args.poll_attempts,
                    interval_seconds=args.poll_interval_seconds,
                    timeout=args.request_timeout_seconds,
                )
                ig_media_id = ig_publish_reel(
                    graph_version=args.graph_version,
                    ig_user_id=ig_user_id,
                    container_id=container_id,
                    access_token=access_token,
                    timeout=args.request_timeout_seconds,
                )
                success_instagram += 1
                state_row["instagram"] = {
                    "status": "ok",
                    "container_id": container_id,
                    "media_id": ig_media_id,
                    "published_at_utc": now_utc_iso(),
                    "source_file": str(source_file),
                }
                update_platform_upload_ledger(
                    instagram_upload_ledger,
                    state_key=state_key,
                    status="ok",
                    relative_path=str(entry.get("relative_path", "")).strip(),
                    source_file=source_file,
                    metadata_file=str(entry.get("metadata_file", "")).strip(),
                    title=str(entry.get("title", "")).strip(),
                    platform_id_key="media_id",
                    platform_id_value=ig_media_id,
                    extra_fields={
                        "container_id": container_id,
                        "youtube_video_id": str(entry.get("video_id", "")).strip(),
                    },
                )
                print(f"[ok][instagram] media_id={ig_media_id}")
            except Exception as exc:  # noqa: BLE001
                failed_instagram += 1
                state_row["instagram"] = {
                    "status": "error",
                    "error": str(exc),
                    "updated_at_utc": now_utc_iso(),
                    "source_file": str(source_file),
                }
                update_platform_upload_ledger(
                    instagram_upload_ledger,
                    state_key=state_key,
                    status="error",
                    relative_path=str(entry.get("relative_path", "")).strip(),
                    source_file=source_file,
                    metadata_file=str(entry.get("metadata_file", "")).strip(),
                    title=str(entry.get("title", "")).strip(),
                    platform_id_key="media_id",
                    platform_id_value="",
                    extra_fields={
                        "youtube_video_id": str(entry.get("video_id", "")).strip(),
                    },
                    error_message=str(exc),
                )
                print(f"[error][instagram] {exc}")

        if do_facebook:
            try:
                fb_video_id, upload_url = fb_start_reel_session(
                    graph_version=args.graph_version,
                    page_id=facebook_page_id,
                    access_token=access_token,
                    timeout=args.request_timeout_seconds,
                )
                fb_upload_reel_binary(
                    upload_url=upload_url,
                    access_token=access_token,
                    file_path=source_file,
                    timeout=args.request_timeout_seconds,
                )
                finish_response = fb_finish_reel_publish(
                    graph_version=args.graph_version,
                    page_id=facebook_page_id,
                    access_token=access_token,
                    video_id=fb_video_id,
                    description=fb_description,
                    title=fb_title,
                    timeout=args.request_timeout_seconds,
                )
                success_facebook += 1
                state_row["facebook"] = {
                    "status": "ok",
                    "video_id": fb_video_id,
                    "publish_response": finish_response,
                    "published_at_utc": now_utc_iso(),
                    "source_file": str(source_file),
                }
                update_platform_upload_ledger(
                    facebook_upload_ledger,
                    state_key=state_key,
                    status="ok",
                    relative_path=str(entry.get("relative_path", "")).strip(),
                    source_file=source_file,
                    metadata_file=str(entry.get("metadata_file", "")).strip(),
                    title=str(entry.get("title", "")).strip(),
                    platform_id_key="video_id",
                    platform_id_value=fb_video_id,
                    extra_fields={
                        "publish_response": finish_response,
                        "youtube_video_id": str(entry.get("video_id", "")).strip(),
                    },
                )
                print(f"[ok][facebook] video_id={fb_video_id}")
            except Exception as exc:  # noqa: BLE001
                failed_facebook += 1
                state_row["facebook"] = {
                    "status": "error",
                    "error": str(exc),
                    "updated_at_utc": now_utc_iso(),
                    "source_file": str(source_file),
                }
                update_platform_upload_ledger(
                    facebook_upload_ledger,
                    state_key=state_key,
                    status="error",
                    relative_path=str(entry.get("relative_path", "")).strip(),
                    source_file=source_file,
                    metadata_file=str(entry.get("metadata_file", "")).strip(),
                    title=str(entry.get("title", "")).strip(),
                    platform_id_key="video_id",
                    platform_id_value="",
                    extra_fields={
                        "youtube_video_id": str(entry.get("video_id", "")).strip(),
                    },
                    error_message=str(exc),
                )
                print(f"[error][facebook] {exc}")
                if is_facebook_rate_limited_error(exc):
                    facebook_blocked_for_run = True
                    print(
                        "[warn][facebook] Facebook returned code 368/subcode 1390008. "
                        "Skipping Facebook uploads for the rest of this run."
                    )

        save_json_file(reels_state_file, reels_state)
        save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
        save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)

    if not args.dry_run:
        save_json_file(reels_state_file, reels_state)
        save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
        save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)

    print("\n[done] summary")
    print(f"[done] skipped (already uploaded on selected platforms): {skipped_all}")
    if platform_enabled(args.platform, "instagram"):
        print(f"[done] instagram success={success_instagram} failed={failed_instagram}")
    if platform_enabled(args.platform, "facebook"):
        print(f"[done] facebook success={success_facebook} failed={failed_facebook}")
    print(f"[done] reels state file: {reels_state_file}")

    if args.dry_run:
        return 0

    total_failed = 0
    if platform_enabled(args.platform, "instagram"):
        total_failed += failed_instagram
    if platform_enabled(args.platform, "facebook"):
        total_failed += failed_facebook
    return 0 if total_failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
