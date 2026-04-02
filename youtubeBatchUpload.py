"""Batch-upload YouTube Shorts with AI-generated metadata.

Setup:
1) Create YouTube API OAuth credentials and download `client_secret.json`.
2) Set `OPENAI_API_KEY` in your environment for AI metadata generation.
3) Install dependencies:
   pip install google-api-python-client google-auth-oauthlib google-auth-httplib2 openai

Example:
python youtubeBatchUpload.py --root "." --max-videos 10 --privacy public
"""

from __future__ import annotations



import argparse
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from metaBatchReelsUpload import (
    ensure_meta_state_shape,
    fb_finish_reel_publish,
    fb_start_reel_session,
    fb_upload_reel_binary,
    ig_create_reel_container,
    ig_publish_reel,
    ig_upload_reel_binary,
    ig_wait_until_ready,
    now_utc_iso as meta_now_utc_iso,
    platform_enabled as meta_platform_enabled,
    requests as meta_requests,
    should_skip_platform as meta_should_skip_platform,
)
try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - handled at runtime.
    OpenAI = None  # type: ignore[assignment]

sys.path.append(os.path.abspath("../valorant-clip-data-extractor-v3"))
from valorant_clip_data_extractor_v3.KillJson import process_video  # your modified function

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]
RETRIABLE_STATUS_CODES = {500, 502, 503, 504}
DEFAULT_YOUTUBE_UPLOAD_LEDGER_FILE = ".youtube_uploaded_videos.json"
DEFAULT_INSTAGRAM_UPLOAD_LEDGER_FILE = ".instagram_uploaded_videos.json"
DEFAULT_FACEBOOK_UPLOAD_LEDGER_FILE = ".facebook_uploaded_videos.json"

# Option 1: set this directly in code.
# Leave empty ("") to auto-use sibling folder named "VALORANT"
# or override with --root / --videos-path argument.
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload local clips to YouTube Shorts with AI metadata."
    )
    parser.add_argument(
        "--root",
        "--videos-path",
        dest="root",
        default=DEFAULT_VIDEO_ROOT,
        help=(
            "Root directory to recursively scan for videos. "
            "Defaults to sibling folder named 'VALORANT'."
        ),
    )
    parser.add_argument(
        "--extensions",
        default=".mp4,.mov,.mkv,.webm",
        help="Comma-separated list of video extensions.",
    )
    parser.add_argument(
        "--exclude-dirs",
        default=".git,__pycache__,generated_metadata,converted_shorts",
        help="Comma-separated directory names to skip while scanning for videos.",
    )
    parser.add_argument(
        "--exclude-files",
        default="shorts_crop_preview.mp4",
        help="Comma-separated file names to skip while scanning for videos.",
    )
    parser.add_argument(
        "--max-videos",
        type=int,
        default=0,
        help="Limit number of uploads (0 = all discovered).",
    )
    parser.add_argument(
        "--privacy",
        choices=["private", "public", "unlisted"],
        default="public",
        help="YouTube privacy setting.",
    )
    parser.add_argument(
        "--playlist-name",
        default="Valorant",
        help="Playlist title to add each uploaded video to (empty to disable).",
    )
    parser.add_argument(
        "--upload-platform",
        choices=["youtube", "instagram", "facebook"],
        default="youtube",
        help="Choose which platform this run should upload to.",
    )
    parser.add_argument(
        "--require-uploaded-on",
        default="",
        help="Comma-separated platforms that must already have the clip uploaded before it is queued.",
    )
    parser.add_argument(
        "--require-missing-on",
        default="",
        help="Comma-separated platforms that must not already have the clip uploaded before it is queued.",
    )
    parser.add_argument(
        "--client-secrets",
        default="client_secret.json",
        help="Path to YouTube OAuth client secrets JSON.",
    )
    parser.add_argument(
        "--auth-port",
        type=int,
        default=8080,
        help="Local port used by OAuth callback server.",
    )
    parser.add_argument(
        "--token-file",
        default="token.json",
        help="Path to store OAuth access token JSON.",
    )
    parser.add_argument(
        "--state-file",
        default=".youtube_upload_state.json",
        help="Path to upload state file (used to skip already uploaded videos).",
    )
    parser.add_argument(
        "--youtube-upload-ledger-file",
        default=DEFAULT_YOUTUBE_UPLOAD_LEDGER_FILE,
        help="Path to per-video YouTube upload ledger JSON.",
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
        "--metadata-dir",
        default="generated_metadata",
        help="Directory to store generated metadata JSON per uploaded file.",
    )
    parser.add_argument(
        "--shorts-policy",
        choices=["off", "strict", "convert"],
        default="convert",
        help=(
            "How to enforce Shorts format: "
            "off=upload as-is, strict=skip non-Shorts files, "
            "convert=auto-convert non-Shorts files to 9:16."
        ),
    )
    parser.add_argument(
        "--shorts-max-seconds",
        type=int,
        default=180,
        help="Maximum Shorts duration in seconds.",
    )
    parser.add_argument(
        "--converted-dir",
        default="converted_shorts",
        help="Directory to store auto-converted Shorts files.",
    )
    parser.add_argument(
        "--ffmpeg-bin",
        default="ffmpeg",
        help="Path to ffmpeg binary for conversion.",
    )
    parser.add_argument(
        "--ffprobe-bin",
        default="ffprobe",
        help="Path to ffprobe binary for media inspection.",
    )
    parser.add_argument(
        "--openai-model",
        default="gpt-4.1-mini",
        help="OpenAI model used to generate metadata.",
    )
    parser.add_argument(
        "--channel-name",
        default="",
        help="Optional channel name/style for AI prompt.",
    )
    parser.add_argument(
        "--instagram-username",
        default=os.getenv("INSTAGRAM_USERNAME", "").strip(),
        help="Instagram username/handle to mention in YouTube descriptions.",
    )
    parser.add_argument(
        "--youtube-username",
        default=(
            os.getenv("YOUTUBE_USERNAME", "").strip()
            or os.getenv("YOUTUBE_CHANNEL_USERNAME", "").strip()
        ),
        help="YouTube username/handle to mention in Instagram captions.",
    )
    parser.add_argument(
        "--extra-keywords",
        default="valorant,valorant clips,shorts,gaming,fps",
        help="Comma-separated keywords to guide metadata generation.",
    )
    parser.add_argument(
        "--language",
        default="en",
        help="Default language for video metadata.",
    )
    parser.add_argument(
        "--category-id",
        default="20",
        help="YouTube category ID (20 = Gaming).",
    )
    parser.add_argument(
        "--notify-subscribers",
        action="store_true",
        help="Send upload notifications to subscribers.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate and save metadata, but do not upload.",
    )
    parser.add_argument(
        "--skip-uploaded",
        action="store_true",
        default=True,
        help="Skip files already present in the state file.",
    )
    parser.add_argument(
        "--no-skip-uploaded",
        action="store_false",
        dest="skip_uploaded",
        help="Re-upload files even if they exist in the state file.",
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="Disable OpenAI metadata generation and use fallback metadata.",
    )
    parser.add_argument(
        "--require-ai",
        action="store_true",
        default=True,
        help="Fail/skip upload if OpenAI metadata generation is unavailable.",
    )
    parser.add_argument(
        "--allow-fallback",
        action="store_false",
        dest="require_ai",
        help="Allow fallback template metadata if OpenAI generation fails.",
    )
    parser.add_argument(
        "--metadata-history-file",
        default=".metadata_history.json",
        help="Path to persistent history file used to avoid title/description repeats.",
    )
    parser.add_argument(
        "--ai-uniqueness-window",
        type=int,
        default=500,
        help="How many recent title/description entries to compare for uniqueness.",
    )
    parser.add_argument(
        "--ai-metadata-retries",
        type=int,
        default=4,
        help="How many OpenAI regeneration attempts to make for unique metadata.",
    )
    parser.add_argument(
        "--delete-converted-after-upload",
        action="store_true",
        default=True,
        help="Delete temporary converted/cropped file after successful upload.",
    )
    parser.add_argument(
        "--keep-converted-after-upload",
        action="store_false",
        dest="delete_converted_after_upload",
        help="Keep converted/cropped file after successful upload.",
    )
    parser.add_argument(
        "--music-dir",
        default=os.getenv("BG_MUSIC_DIR", "").strip(),
        help="Optional directory of MP3 files to mix under each uploaded short/reel.",
    )
    parser.add_argument(
        "--music-inventory-file",
        default="hollywood_music_inventory.json",
        help="Path to save the discovered MP3 inventory when --music-dir is enabled.",
    )
    parser.add_argument(
        "--music-bg-volume",
        type=float,
        default=0.18,
        help="Relative background music volume/weight when mixing under the original clip audio.",
    )
    parser.add_argument(
        "--crosspost-meta",
        action="store_true",
        help="After a successful YouTube upload, also upload the same file to Instagram/Facebook Reels.",
    )
    parser.add_argument(
        "--meta-platform",
        choices=["both", "instagram", "facebook"],
        default="both",
        help="Which Meta platform(s) to cross-post to when --crosspost-meta is enabled.",
    )
    parser.add_argument(
        "--meta-reels-state-file",
        default=".meta_reels_upload_state.json",
        help="Path to save Instagram/Facebook reels upload state during YouTube runs.",
    )
    parser.add_argument(
        "--meta-graph-version",
        default="v25.0",
        help="Meta Graph API version used for cross-posting.",
    )
    parser.add_argument(
        "--meta-access-token",
        default=(
            os.getenv("META_PAGE_ACCESS_TOKEN", "").strip()
            or os.getenv("META_ACCESS_TOKEN", "").strip()
            or os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN", "").strip()
        ),
        help="Meta Page access token for Instagram/Facebook cross-posting.",
    )
    parser.add_argument(
        "--meta-ig-user-id",
        default=os.getenv("INSTAGRAM_USER_ID", "").strip() or os.getenv("IG_USER_ID", "").strip(),
        help="Instagram professional account ID for cross-posting.",
    )
    parser.add_argument(
        "--meta-facebook-page-id",
        default=os.getenv("FACEBOOK_PAGE_ID", "").strip() or os.getenv("FB_PAGE_ID", "").strip(),
        help="Facebook Page ID for cross-posting.",
    )
    parser.add_argument(
        "--meta-poll-attempts",
        type=int,
        default=30,
        help="Max status polling attempts for Instagram reel readiness during cross-posting.",
    )
    parser.add_argument(
        "--meta-poll-interval-seconds",
        type=float,
        default=4.0,
        help="Seconds between Instagram reel status polls during cross-posting.",
    )
    parser.add_argument(
        "--meta-request-timeout-seconds",
        type=float,
        default=120.0,
        help="HTTP timeout for each Meta API request during cross-posting.",
    )
    parser.add_argument(
        "--meta-skip-uploaded",
        action="store_true",
        default=True,
        help="Skip Meta cross-posts already marked successful in the Meta reels state file.",
    )
    parser.add_argument(
        "--no-meta-skip-uploaded",
        action="store_false",
        dest="meta_skip_uploaded",
        help="Do not skip Meta cross-posts already present in the Meta reels state file.",
    )
    parser.add_argument(
        "--meta-instagram-retries",
        type=int,
        default=3,
        help="How many times to retry Instagram cross-posting when Meta returns a transient processing failure.",
    )
    parser.add_argument(
        "--meta-instagram-retry-delay-seconds",
        type=float,
        default=20.0,
        help="Seconds to wait between Instagram processing-failure retries.",
    )
    return parser.parse_args()


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
    metadata_file: Path,
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
        "metadata_file": str(metadata_file),
        "title": title,
        "updated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    if platform_id_key:
        row[platform_id_key] = platform_id_value
    if status == "ok":
        row["uploaded_at_utc"] = datetime.now(timezone.utc).isoformat()
    elif error_message:
        row["error"] = error_message
    if extra_fields:
        for field_name, field_value in extra_fields.items():
            row[field_name] = field_value
    ledger_state["entries"][state_key] = row


def is_platform_upload_completed(ledger_state: Dict[str, Any], state_key: str) -> bool:
    entries = ledger_state.get("entries", {})
    if not isinstance(entries, dict):
        return False
    row = entries.get(state_key, {})
    if not isinstance(row, dict):
        return False
    return str(row.get("status", "")).strip().lower() == "ok"


def normalize_platform_names_csv(raw: str) -> List[str]:
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
    if platform_name == "youtube":
        return state_key in uploaded_state
    if platform_name == "instagram":
        return is_platform_upload_completed(instagram_upload_ledger, state_key)
    if platform_name == "facebook":
        return is_platform_upload_completed(facebook_upload_ledger, state_key)
    return False


def normalize_extensions(raw_extensions: str) -> set[str]:
    exts: set[str] = set()
    for item in raw_extensions.split(","):
        cleaned = item.strip().lower()
        if not cleaned:
            continue
        if not cleaned.startswith("."):
            cleaned = f".{cleaned}"
        exts.add(cleaned)
    return exts


def normalize_names_csv(raw: str) -> set[str]:
    values = set()
    for item in raw.split(","):
        cleaned = item.strip().lower()
        if cleaned:
            values.add(cleaned)
    return values


def discover_videos(
    root: Path,
    extensions: set[str],
    exclude_dirs: set[str],
    exclude_files: set[str],
) -> List[Path]:
    files: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d.lower() not in exclude_dirs]
        base = Path(dirpath)
        for filename in filenames:
            if filename.lower() in exclude_files:
                continue
            path = base / filename
            if path.suffix.lower() in extensions:
                files.append(path)
    files.sort()
    return files


def file_key(root: Path, file_path: Path) -> str:
    stat = file_path.stat()
    rel = file_path.relative_to(root).as_posix()
    return f"{rel}|{stat.st_size}|{int(stat.st_mtime)}"


def build_youtube_client(client_secrets: Path, token_file: Path, auth_port: int):
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


def check_tool_available(bin_name: str) -> bool:
    try:
        proc = subprocess.run(
            [bin_name, "-version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        return proc.returncode == 0
    except OSError:
        return False


def resolve_media_tool(bin_name: str) -> Optional[str]:
    # If user provided an absolute path or PATH-resolved binary, use it.
    if Path(bin_name).exists() or check_tool_available(bin_name):
        return bin_name

    exe_name = bin_name
    if not exe_name.lower().endswith(".exe"):
        exe_name = f"{exe_name}.exe"

    # Fallback for WinGet FFmpeg installation path.
    local_appdata = os.getenv("LOCALAPPDATA")
    if local_appdata:
        candidate_root = Path(local_appdata) / "Microsoft" / "WinGet" / "Packages"
        if candidate_root.exists():
            for match in candidate_root.rglob(exe_name):
                if match.is_file():
                    return str(match)

    return None


def probe_video_info(file_path: Path, ffprobe_bin: str) -> Optional[Dict[str, float]]:
    try:
        proc = subprocess.run(
            [
                ffprobe_bin,
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(file_path),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
    except OSError:
        return None

    if proc.returncode != 0:
        return None

    try:
        payload = json.loads(proc.stdout or "{}")
        streams = payload.get("streams", [])
        stream = streams[0] if streams else {}
        width = int(stream.get("width", 0))
        height = int(stream.get("height", 0))
        duration = float(payload.get("format", {}).get("duration", 0.0))
    except (ValueError, TypeError, json.JSONDecodeError, IndexError):
        return None

    if width <= 0 or height <= 0 or duration <= 0:
        return None

    return {
        "width": float(width),
        "height": float(height),
        "duration": float(duration),
    }


def delete_file_if_exists(file_path: Path) -> None:
    try:
        if file_path.exists():
            file_path.unlink()
    except OSError:
        pass


def build_temp_media_output_path(output: Path) -> Path:
    return output.with_name(f"{output.stem}.{os.getpid()}.tmp{output.suffix}")


def reuse_valid_cached_video(
    *,
    output: Path,
    newest_input_mtime: float,
    ffprobe_bin: str,
    cache_label: str,
) -> bool:
    if not output.exists():
        return False
    if output.stat().st_mtime < newest_input_mtime:
        return False
    if probe_video_info(output, ffprobe_bin):
        return True

    print(f"[warn] invalid cached {cache_label} file detected; rebuilding: {output.name}")
    delete_file_if_exists(output)
    return False


def is_shorts_eligible(
    video_info: Dict[str, float],
    shorts_max_seconds: int,
) -> Tuple[bool, List[str]]:
    reasons: List[str] = []
    width = int(video_info["width"])
    height = int(video_info["height"])
    duration = float(video_info["duration"])
    if width > height:
        reasons.append(f"horizontal aspect ratio ({width}x{height})")
    if duration > shorts_max_seconds:
        reasons.append(f"duration {duration:.1f}s > {shorts_max_seconds}s")
    return (len(reasons) == 0, reasons)


def build_converted_path(source: Path, converted_dir: Path) -> Path:
    profile = "cropv1"
    digest = hashlib.sha1(f"{source}|{profile}".encode("utf-8")).hexdigest()[:10]
    safe_stem = re.sub(r"[^a-zA-Z0-9._-]", "_", source.stem)[:80]
    filename = f"{safe_stem}.{digest}.{profile}.shorts.mp4"
    return converted_dir / filename


def convert_to_shorts(
    source: Path,
    converted_dir: Path,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    shorts_max_seconds: int,
) -> Path:
    converted_dir.mkdir(parents=True, exist_ok=True)
    output = build_converted_path(source, converted_dir)
    newest_input_mtime = source.stat().st_mtime

    if reuse_valid_cached_video(
        output=output,
        newest_input_mtime=newest_input_mtime,
        ffprobe_bin=ffprobe_bin,
        cache_label="converted",
    ):
        return output

    temp_output = build_temp_media_output_path(output)
    delete_file_if_exists(temp_output)

    filter_graph = (
        "crop="
        "'if(gte(iw/ih,9/16),trunc(ih*9/16/2)*2,iw)':"
        "'if(gte(iw/ih,9/16),ih,trunc(iw*16/9/2)*2)',"
        "scale=1080:1920,setsar=1"
    )
    proc = subprocess.run(
        [
            ffmpeg_bin,
            "-y",
            "-i",
            str(source),
            "-vf",
            filter_graph,
            "-t",
            str(shorts_max_seconds),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "high",
            "-level:v",
            "4.1",
            "-r",
            "30",
            "-g",
            "60",
            "-maxrate",
            "8M",
            "-bufsize",
            "16M",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            str(temp_output),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        delete_file_if_exists(temp_output)
        tail = "\n".join((proc.stderr or "").splitlines()[-20:])
        raise RuntimeError(f"ffmpeg conversion failed for {source}:\n{tail}")

    converted_info = probe_video_info(temp_output, ffprobe_bin)
    if not converted_info:
        delete_file_if_exists(temp_output)
        raise RuntimeError(f"Converted Shorts output is invalid or unreadable: {temp_output}")

    temp_output.replace(output)

    return output


def build_music_inventory(music_dir: Path) -> List[Dict[str, str]]:
    tracks: List[Dict[str, str]] = []
    for path in sorted(music_dir.rglob("*.mp3")):
        tracks.append(
            {
                "name": path.name,
                "path": str(path.resolve()),
            }
        )
    return tracks


def video_has_audio_stream(file_path: Path, ffprobe_bin: str) -> bool:
    try:
        proc = subprocess.run(
            [
                ffprobe_bin,
                "-v",
                "error",
                "-select_streams",
                "a",
                "-show_entries",
                "stream=codec_type",
                "-of",
                "json",
                str(file_path),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
    except OSError:
        return False

    if proc.returncode != 0:
        return False

    try:
        payload = json.loads(proc.stdout or "{}")
        streams = payload.get("streams", [])
        return bool(streams)
    except (TypeError, ValueError, json.JSONDecodeError):
        return False


def build_mixed_music_path(
    source: Path,
    music_path: Path,
    converted_dir: Path,
    bg_volume: float,
) -> Path:
    profile = "bgmixv1"
    digest = hashlib.sha1(
        f"{source.resolve()}|{music_path.resolve()}|{bg_volume:.3f}|{profile}".encode("utf-8")
    ).hexdigest()[:10]
    safe_stem = re.sub(r"[^a-zA-Z0-9._-]", "_", source.stem)[:80]
    return converted_dir / f"{safe_stem}.{digest}.{profile}.mp4"


def mix_background_music(
    *,
    source: Path,
    music_path: Path,
    converted_dir: Path,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    bg_volume: float,
) -> Path:
    converted_dir.mkdir(parents=True, exist_ok=True)
    output = build_mixed_music_path(source, music_path, converted_dir, bg_volume)
    newest_input_mtime = max(source.stat().st_mtime, music_path.stat().st_mtime)
    if reuse_valid_cached_video(
        output=output,
        newest_input_mtime=newest_input_mtime,
        ffprobe_bin=ffprobe_bin,
        cache_label="music-mixed",
    ):
        return output

    temp_output = build_temp_media_output_path(output)
    delete_file_if_exists(temp_output)

    source_info = probe_video_info(source, ffprobe_bin)
    if not source_info:
        raise RuntimeError(f"Could not inspect video duration for music mix: {source}")
    duration = float(source_info["duration"])
    if duration <= 0:
        raise RuntimeError(f"Invalid video duration for music mix: {source}")

    has_audio = video_has_audio_stream(source, ffprobe_bin)
    if has_audio:
        bg_weight = max(bg_volume, 0.01)
        filter_complex = (
            f"[1:a]atrim=0:{duration:.3f},asetpts=N/SR/TB,volume={bg_volume:.3f}[bg];"
            "[0:a]volume=1.0[main];"
            f"[main][bg]amix=inputs=2:duration=first:weights='1 {bg_weight:.3f}':normalize=0[aout]"
        )
        cmd = [
            ffmpeg_bin,
            "-y",
            "-i",
            str(source),
            "-i",
            str(music_path),
            "-filter_complex",
            filter_complex,
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            str(temp_output),
        ]
    else:
        cmd = [
            ffmpeg_bin,
            "-y",
            "-i",
            str(source),
            "-i",
            str(music_path),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-t",
            f"{duration:.3f}",
            str(temp_output),
        ]

    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        delete_file_if_exists(temp_output)
        tail = "\n".join((proc.stderr or "").splitlines()[-30:])
        raise RuntimeError(
            f"ffmpeg background music mix failed for {source} using {music_path.name}:\n{tail}"
        )
    mixed_info = probe_video_info(temp_output, ffprobe_bin)
    if not mixed_info:
        delete_file_if_exists(temp_output)
        raise RuntimeError(f"Mixed video output is invalid or unreadable: {temp_output}")

    temp_output.replace(output)
    return output


def try_mix_background_music(
    *,
    source: Path,
    music_inventory: List[Dict[str, str]],
    converted_dir: Path,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    bg_volume: float,
) -> Tuple[Path, Optional[Path], List[str]]:
    failures: List[str] = []
    if not music_inventory:
        return source, None, failures

    candidates: List[Dict[str, str]] = list(music_inventory)
    random.shuffle(candidates)

    for chosen_music in candidates:
        chosen_music_path = Path(str(chosen_music.get("path", "")).strip())
        if not chosen_music_path.exists():
            failures.append(f"{chosen_music_path.name or 'unknown'}: music file not found")
            continue

        try:
            mixed_output = mix_background_music(
                source=source,
                music_path=chosen_music_path,
                converted_dir=converted_dir,
                ffmpeg_bin=ffmpeg_bin,
                ffprobe_bin=ffprobe_bin,
                bg_volume=bg_volume,
            )
            return mixed_output, chosen_music_path, failures
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{chosen_music_path.name}: {exc}")

    return source, None, failures


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_json_response(raw: str) -> Dict[str, Any]:
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def normalize_hashtag(tag: str) -> str:
    text = re.sub(r"[^a-zA-Z0-9_]", "", tag.replace("#", "").strip().lower())
    return f"#{text}" if text else ""


def normalize_tags(tags: List[str], max_total_chars: int = 500, max_tags: int = 15) -> List[str]:
    normalized: List[str] = []
    seen = set()
    total = 0
    for tag in tags:
        cleaned = clean_text(tag).lower()
        cleaned = re.sub(r"[^a-z0-9\s\-]", "", cleaned).strip("- ")
        if not cleaned or cleaned in seen:
            continue
        estimated_add = len(cleaned) + (1 if normalized else 0)
        if len(normalized) >= max_tags or total + estimated_add > max_total_chars:
            break
        normalized.append(cleaned)
        seen.add(cleaned)
        total += estimated_add
    return normalized


def trim_title(title: str, max_len: int = 100) -> str:
    title = clean_text(title)
    if len(title) <= max_len:
        return title
    return clean_text(title[: max_len - 3]) + "..."


def get_sidecar_value(payload: Dict[str, Any], *keys: str) -> Any:
    normalized = {
        re.sub(r"[\s_\-]+", "", str(key).lower()): value for key, value in payload.items()
    }
    for key in keys:
        probe = re.sub(r"[\s_\-]+", "", key.lower())
        if probe in normalized:
            return normalized[probe]
    return None


def load_clip_context(file_path: Path) -> Optional[Dict[str, Any]]:
    sidecar_path = file_path.with_suffix(".json")

    if sidecar_path.exists() == False:
        process_video(file_path)

    payload = load_json_file(sidecar_path, default=None)

    
    if not isinstance(payload, dict):
        return None

    raw_kills = get_sidecar_value(payload, "kills", "kill_count", "killcount")
    kills: Optional[int] = None
    if raw_kills is not None:
        try:
            kills = max(int(raw_kills), 1)
        except (TypeError, ValueError):
            kills = None

    site_name_raw = get_sidecar_value(payload, "site_name", "site name", "site", "map")
    agent_name_raw = get_sidecar_value(payload, "agent_name", "agent name", "agent")
    round_details = payload.get("round_details", {})
    if not isinstance(round_details, dict):
        round_details = {}
    kills_breakdown = round_details.get("kills_breakdown", [])
    if not isinstance(kills_breakdown, list):
        kills_breakdown = []
    first_kill = kills_breakdown[0] if kills_breakdown and isinstance(kills_breakdown[0], dict) else {}

    weapon_raw = get_sidecar_value(payload, "weapon")
    if weapon_raw is None and isinstance(first_kill, dict):
        weapon_raw = first_kill.get("weapon")

    headshots_raw = get_sidecar_value(payload, "headshots", "total_headshots")
    if headshots_raw is None:
        headshots_raw = round_details.get("total_headshots")

    victim_agent_raw = get_sidecar_value(payload, "victim_agent", "victim agent")
    if victim_agent_raw is None and isinstance(first_kill, dict):
        victim_agent_raw = first_kill.get("victim_agent")

    site_name = clean_text(str(site_name_raw or ""))
    agent_name = clean_text(str(agent_name_raw or ""))
    weapon = clean_text(str(weapon_raw or ""))
    victim_agent = clean_text(str(victim_agent_raw or ""))
    headshots: Optional[int] = None
    if headshots_raw is not None:
        try:
            headshots = max(int(headshots_raw), 0)
        except (TypeError, ValueError):
            headshots = None
    if site_name.lower() == "unknown":
        site_name = ""
    if agent_name.lower() == "unknown":
        agent_name = ""
    if weapon.lower() == "unknown":
        weapon = ""
    if victim_agent.lower() == "unknown":
        victim_agent = ""

    if (
        kills is None
        and not site_name
        and not agent_name
        and not weapon
        and headshots is None
        and not victim_agent
    ):
        return None

    return {
        "sidecar_path": str(sidecar_path),
        "kills": kills,
        "site_name": site_name,
        "agent_name": agent_name,
        "weapon": weapon,
        "headshots": headshots,
        "victim_agent": victim_agent,
    }


def build_clip_focus(context: Optional[Dict[str, Any]]) -> str:
    if not context:
        return ""

    kills = context.get("kills")
    site_name = clean_text(str(context.get("site_name") or ""))
    agent_name = clean_text(str(context.get("agent_name") or ""))
    weapon = clean_text(str(context.get("weapon") or ""))
    parts: List[str] = []
    if kills:
        kill_word = "Kill" if int(kills) == 1 else "Kills"
        parts.append(f"{kills} {kill_word}")
    if site_name:
        parts.append(f"on {site_name}")
    if agent_name:
        parts.append(f"with {agent_name}")
    if weapon:
        parts.append(f"using {weapon}")
    return clean_text(" ".join(parts))


def build_fallback_metadata(
    file_path: Path,
    extra_keywords: List[str],
    clip_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    base_name = file_path.stem.replace("_", " ")
    base_name = re.sub(r"[-]+", " ", base_name)
    base_name = clean_text(base_name)
    focus = build_clip_focus(clip_context)
    if focus:
        title = f"{focus} | Valorant Shorts"
        description = (
            f"VALORANT short featuring {focus.lower()}.\n"
            f"Clip source: {base_name}.\n"
            "More clutch and aim clips coming daily."
        )
    else:
        title = f"{base_name} | Valorant Shorts"
        description = (
            f"Clean VALORANT clip from session: {base_name}.\n"
            "More clutch and aim clips coming daily.\n"
            "Like + subscribe for consistent highlights."
        )
    tags = [
        "valorant",
        "valorant clips",
        "valorant shorts",
        "fps",
        "gaming",
        "valorant gameplay",
    ]
    if clip_context:
        if clip_context.get("agent_name"):
            tags.append(str(clip_context["agent_name"]))
        if clip_context.get("site_name"):
            tags.append(f"{clip_context['site_name']} site")
        if clip_context.get("kills"):
            tags.append(f"{clip_context['kills']} kill")
        if clip_context.get("weapon"):
            tags.append(str(clip_context["weapon"]))
        if clip_context.get("victim_agent"):
            tags.append(str(clip_context["victim_agent"]))
        if clip_context.get("headshots"):
            tags.append("headshot")
    tags += extra_keywords
    return {
        "title": title,
        "description": description,
        "tags": tags,
        "hashtags": ["#shorts", "#valorant", "#gaming"],
        "cta": "Follow for more daily Valorant highlights.",
    }


def generate_ai_metadata(
    client: OpenAI,
    model: str,
    file_path: Path,
    rel_path: str,
    channel_name: str,
    extra_keywords: List[str],
    language: str,
    recent_titles: List[str],
    recent_descriptions: List[str],
    clip_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    system_prompt = (
        "You are a YouTube Shorts growth strategist for VALORANT content who specializes in FUNNY, VIRAL, HIGH-CTR metadata. "
        "Your goal is to make viewers laugh, relate, or feel curious enough to instantly click. "

        "You ONLY produce funny, entertaining, or ironic content. No serious esports tone.\n\n"

        "Your humor style includes:\n"
        "- Relatable gamer pain\n"
        "- Whiffs, fails, lucky shots\n"
        "- Overconfidence gone wrong\n"
        "- 'This should not have worked' moments\n"
        "- Sarcasm, exaggeration, irony\n\n"
        "- Make fun of gameplay\n\n"

        "Titles must feel like memes or inside jokes gamers instantly understand.\n"
        "Descriptions should feel like a human reacting, not describing.\n\n"

        "Avoid robotic phrasing, templates, or generic wording.\n"
        "Return ONLY strict JSON."
    )
    clip_context_text = (
        json.dumps(clip_context, ensure_ascii=False) if clip_context else "none"
    )
    user_prompt = (
        "Create FUNNY, HIGH-CTR metadata for a VALORANT short.\n\n"

        f"Video file name: {file_path.name}\n"
        f"Relative path: {rel_path}\n"
        f"Channel name/style: {channel_name or 'not provided'}\n"
        f"Language: {language}\n"
        f"Extra keywords: {', '.join(extra_keywords) if extra_keywords else 'none'}\n\n"

        f"Sibling sidecar JSON facts: {clip_context_text}\n\n"

        "CORE GOAL:\n"
        "- Make the viewer laugh OR say 'I need to see this'\n"
        "- Focus on relatable or absurd moments\n"
        "- Prioritize humor over skill\n\n"

        "TITLE RULES:\n"
        "- Max 100 characters\n"
        "- Must be funny, ironic, or meme-like\n"
        "- Create curiosity or confusion ('how did this happen?')\n"
        "- Use VALORANT terms naturally (ace, clutch, jett, etc.)\n"
        "- Avoid generic phrases completely\n\n"

        "HUMOR STYLES (IMPORTANT):\n"
        "- 'this should not have worked'\n"
        "- 'enemy uninstalling after this'\n"
        "- 'i did NOT deserve that'\n"
        "- 'my aim finally clocked in'\n"
        "- 'valorant logic makes no sense'\n\n"

        "DESCRIPTION RULES:\n"
        "- 2–4 short lines\n"
        "- First line = funny hook\n"
        "- Add reaction-style commentary\n"
        "- Keep it casual and human\n\n"

        "VARIETY RULE:\n"
        "- Do NOT repeat phrasing from past outputs\n"
        "- Each output should feel like a new joke\n\n"

        f"Recent titles to avoid repeating:\n{json.dumps(recent_titles, ensure_ascii=False)}\n\n"
        f"Recent descriptions to avoid repeating:\n{json.dumps(recent_descriptions, ensure_ascii=False)}\n\n"

        "Output JSON schema:\n"
        "{\n"
        '  "title": "funny, high-CTR, <=100 chars",\n'
        '  "description": "2-4 short funny lines",\n'
        '  "tags": ["10-15 relevant tags"],\n'
        '  "hashtags": ["3-5 hashtags"],\n'
        '  "cta": "short playful call-to-action"\n'
        "}\n\n"

        "STRICT RULES:\n"
        "- No emojis\n"
        "- No serious tone\n"
        "- No generic phrases\n"
        "- Use clip context if available\n"
        "- If kills = 0, treat as 1\n"
        "- Do not mention unknown info\n"
        "- Do not use round numbers\n"
        "- No Agent Name\n"
        "- No Weapon Name\n"
        "- No Flick\n"
    )
    response = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        temperature=0.8,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    raw = response.choices[0].message.content or "{}"
    return parse_json_response(raw)


def normalize_handle(value: str) -> str:
    cleaned = clean_text(value).lstrip("@")
    return f"@{cleaned}" if cleaned else ""


def finalize_metadata(
    raw: Dict[str, Any],
    fallback: Dict[str, Any],
    instagram_username: str = "",
) -> Dict[str, Any]:
    title = trim_title(str(raw.get("title") or fallback["title"]))
    description = str(raw.get("description") or fallback["description"]).strip()
    cta = str(raw.get("cta") or fallback["cta"]).strip()

    raw_tags = raw.get("tags")
    tags_input = raw_tags if isinstance(raw_tags, list) else fallback["tags"]
    tags = normalize_tags([str(x) for x in tags_input])
    if "valorant" not in tags:
        tags = normalize_tags(["valorant"] + tags)
    if "shorts" not in tags:
        tags = normalize_tags(tags + ["shorts"])

    raw_hashtags = raw.get("hashtags")
    hashtags_input = raw_hashtags if isinstance(raw_hashtags, list) else fallback["hashtags"]
    hashtags = []
    seen = set()
    for value in hashtags_input:
        tag = normalize_hashtag(str(value))
        if tag and tag not in seen:
            hashtags.append(tag)
            seen.add(tag)
    for required in ("#shorts", "#valorant"):
        if required not in seen:
            hashtags.append(required)
            seen.add(required)
    hashtags = hashtags[:5]

    lines = [description]
    if cta:
        lines.extend(["", cta])
    if hashtags:
        lines.extend(["", " ".join(hashtags)])
    insta_handle = normalize_handle(instagram_username)
    if insta_handle:
        lines.extend(["", f"Instagram: {insta_handle}"])
    final_description = "\n".join(line.strip() for line in lines if line is not None).strip()
    if len(final_description) > 5000:
        final_description = final_description[:4999]

    return {
        "title": title,
        "description": final_description,
        "tags": tags,
        "hashtags": hashtags,
        "cta": cta,
    }


def normalize_compare_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def text_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize_compare_text(a), normalize_compare_text(b)).ratio()


def is_metadata_unique(
    title: str,
    description: str,
    recent_titles: List[str],
    recent_descriptions: List[str],
) -> Tuple[bool, str]:
    norm_title = normalize_compare_text(title)
    norm_description = normalize_compare_text(description)

    for old_title in recent_titles:
        old_norm = normalize_compare_text(old_title)
        if old_norm and old_norm == norm_title:
            return False, "exact title duplicate"
        if text_similarity(title, old_title) >= 0.90:
            return False, "title too similar to previous upload"

    for old_description in recent_descriptions:
        old_norm = normalize_compare_text(old_description)
        if old_norm and old_norm == norm_description:
            return False, "exact description duplicate"
        if text_similarity(description, old_description) >= 0.86:
            return False, "description too similar to previous upload"

    return True, ""


def build_meta_captions(
    metadata: Dict[str, Any],
    youtube_username: str = "",
    instagram_username: str = "",
) -> Tuple[str, str, str]:
    title = clean_text(str(metadata.get("title", "")))
    description = str(metadata.get("description", "")).strip()

    if description:
        ig_caption = description
        if title and title.lower() not in description.lower():
            ig_caption = f"{title}\n\n{description}"
        fb_description = description
    else:
        ig_caption = title
        fb_description = title

    youtube_handle = normalize_handle(youtube_username)
    if youtube_handle:
        promo_line = f"YouTube: {youtube_handle}"
        ig_caption = f"{ig_caption}\n\n{promo_line}".strip()

    footer_lines: List[str] = []
    insta_handle = normalize_handle(instagram_username)
    if insta_handle:
        footer_lines.append(f"Instagram: {insta_handle}")
    if youtube_handle:
        footer_lines.append(f"YouTube: {youtube_handle}")
    if footer_lines:
        fb_description = f"{fb_description}\n\n" + "\n".join(footer_lines)

    return ig_caption[:2200].rstrip(), fb_description[:5000].rstrip(), title[:255].rstrip()


def is_retryable_instagram_processing_error(exc: Exception) -> bool:
    message = str(exc).lower()
    markers = [
        "processingfailederror",
        "generic internal error",
        "internal server error occurred",
        "meta api error (500)",
    ]
    return any(marker in message for marker in markers)


def is_facebook_rate_limited_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "code=368" in message and "subcode=1390008" in message


def crosspost_meta_reel(
    *,
    args: argparse.Namespace,
    reels_state: Dict[str, Any],
    instagram_upload_ledger: Dict[str, Any],
    facebook_upload_ledger: Dict[str, Any],
    state_key: str,
    rel_path: str,
    source_file: Path,
    metadata: Dict[str, Any],
    metadata_path: Path,
    youtube_video_id: str,
    facebook_blocked_for_run: Dict[str, bool],
) -> None:
    reels_entries = reels_state["entries"]
    state_row = reels_entries.get(state_key, {})
    if not isinstance(state_row, dict):
        state_row = {}
        reels_entries[state_key] = state_row

    do_instagram = meta_platform_enabled(args.meta_platform, "instagram") and not meta_should_skip_platform(
        reels_entries, state_key, "instagram", args.meta_skip_uploaded
    )
    do_facebook = meta_platform_enabled(args.meta_platform, "facebook") and not meta_should_skip_platform(
        reels_entries, state_key, "facebook", args.meta_skip_uploaded
    )
    if facebook_blocked_for_run.get("blocked"):
        do_facebook = False
    if not do_instagram and not do_facebook:
        print("[meta-crosspost] skipped: already uploaded on selected platform(s)")
        return

    ig_caption, fb_description, fb_title = build_meta_captions(
        metadata,
        youtube_username=args.youtube_username,
        instagram_username=args.instagram_username,
    )
    print(f"[meta-crosspost] source file: {source_file}")

    if do_instagram:
        for attempt in range(1, max(args.meta_instagram_retries, 1) + 1):
            try:
                container_id = ig_create_reel_container(
                    graph_version=args.meta_graph_version,
                    ig_user_id=clean_text(args.meta_ig_user_id),
                    access_token=clean_text(args.meta_access_token),
                    caption=ig_caption,
                    timeout=args.meta_request_timeout_seconds,
                )
                ig_upload_reel_binary(
                    graph_version=args.meta_graph_version,
                    container_id=container_id,
                    access_token=clean_text(args.meta_access_token),
                    file_path=source_file,
                    timeout=args.meta_request_timeout_seconds,
                )
                ig_wait_until_ready(
                    graph_version=args.meta_graph_version,
                    container_id=container_id,
                    access_token=clean_text(args.meta_access_token),
                    attempts=args.meta_poll_attempts,
                    interval_seconds=args.meta_poll_interval_seconds,
                    timeout=args.meta_request_timeout_seconds,
                )
                ig_media_id = ig_publish_reel(
                    graph_version=args.meta_graph_version,
                    ig_user_id=clean_text(args.meta_ig_user_id),
                    container_id=container_id,
                    access_token=clean_text(args.meta_access_token),
                    timeout=args.meta_request_timeout_seconds,
                )
                state_row["instagram"] = {
                    "status": "ok",
                    "container_id": container_id,
                    "media_id": ig_media_id,
                    "published_at_utc": meta_now_utc_iso(),
                    "source_file": str(source_file),
                }
                update_platform_upload_ledger(
                    instagram_upload_ledger,
                    state_key=state_key,
                    status="ok",
                    relative_path=rel_path,
                    source_file=source_file,
                    metadata_file=metadata_path,
                    title=str(metadata.get("title", "")),
                    platform_id_key="media_id",
                    platform_id_value=ig_media_id,
                    extra_fields={
                        "container_id": container_id,
                        "youtube_video_id": youtube_video_id,
                    },
                )
                print(f"[ok][instagram] media_id={ig_media_id}")
                break
            except Exception as exc:  # noqa: BLE001
                retryable = is_retryable_instagram_processing_error(exc)
                is_last_attempt = attempt >= max(args.meta_instagram_retries, 1)
                if retryable and not is_last_attempt:
                    print(
                        f"[warn][instagram] transient processing failure on attempt {attempt}; "
                        f"retrying in {args.meta_instagram_retry_delay_seconds:.1f}s"
                    )
                    time.sleep(max(args.meta_instagram_retry_delay_seconds, 0.0))
                    continue
                state_row["instagram"] = {
                    "status": "error",
                    "error": str(exc),
                    "updated_at_utc": meta_now_utc_iso(),
                    "source_file": str(source_file),
                }
                update_platform_upload_ledger(
                    instagram_upload_ledger,
                    state_key=state_key,
                    status="error",
                    relative_path=rel_path,
                    source_file=source_file,
                    metadata_file=metadata_path,
                    title=str(metadata.get("title", "")),
                    platform_id_key="media_id",
                    platform_id_value="",
                    extra_fields={
                        "youtube_video_id": youtube_video_id,
                    },
                    error_message=str(exc),
                )
                print(f"[error][instagram] {exc}")
                break

    if do_facebook:
        try:
            fb_video_id, upload_url = fb_start_reel_session(
                graph_version=args.meta_graph_version,
                page_id=clean_text(args.meta_facebook_page_id),
                access_token=clean_text(args.meta_access_token),
                timeout=args.meta_request_timeout_seconds,
            )
            fb_upload_reel_binary(
                upload_url=upload_url,
                access_token=clean_text(args.meta_access_token),
                file_path=source_file,
                timeout=args.meta_request_timeout_seconds,
            )
            finish_response = fb_finish_reel_publish(
                graph_version=args.meta_graph_version,
                page_id=clean_text(args.meta_facebook_page_id),
                access_token=clean_text(args.meta_access_token),
                video_id=fb_video_id,
                description=fb_description,
                title=fb_title,
                timeout=args.meta_request_timeout_seconds,
            )
            state_row["facebook"] = {
                "status": "ok",
                "video_id": fb_video_id,
                "publish_response": finish_response,
                "published_at_utc": meta_now_utc_iso(),
                "source_file": str(source_file),
            }
            update_platform_upload_ledger(
                facebook_upload_ledger,
                state_key=state_key,
                status="ok",
                relative_path=rel_path,
                source_file=source_file,
                metadata_file=metadata_path,
                title=str(metadata.get("title", "")),
                platform_id_key="video_id",
                platform_id_value=fb_video_id,
                extra_fields={
                    "publish_response": finish_response,
                    "youtube_video_id": youtube_video_id,
                },
            )
            print(f"[ok][facebook] video_id={fb_video_id}")
        except Exception as exc:  # noqa: BLE001
            state_row["facebook"] = {
                "status": "error",
                "error": str(exc),
                "updated_at_utc": meta_now_utc_iso(),
                "source_file": str(source_file),
            }
            update_platform_upload_ledger(
                facebook_upload_ledger,
                state_key=state_key,
                status="error",
                relative_path=rel_path,
                source_file=source_file,
                metadata_file=metadata_path,
                title=str(metadata.get("title", "")),
                platform_id_key="video_id",
                platform_id_value="",
                extra_fields={
                    "youtube_video_id": youtube_video_id,
                },
                error_message=str(exc),
            )
            print(f"[error][facebook] {exc}")
            if is_facebook_rate_limited_error(exc):
                facebook_blocked_for_run["blocked"] = True
                print(
                    "[warn][facebook] Facebook returned code 368/subcode 1390008. "
                    "Skipping Facebook uploads for the rest of this run."
                )

    state_row["relative_path"] = rel_path
    state_row["youtube_video_id"] = youtube_video_id
    state_row["metadata_file"] = str(metadata_path)


def resolve_playlist_id(youtube, playlist_name: str) -> Optional[str]:
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


def extract_http_error_reason(exc: Exception) -> Tuple[str, str]:
    if not isinstance(exc, HttpError):
        return "", ""
    try:
        payload = json.loads(exc.content.decode("utf-8"))
    except Exception:  # noqa: BLE001
        return "", ""

    error_obj = payload.get("error", {})
    details = error_obj.get("errors", [])
    if isinstance(details, list) and details:
        first = details[0]
        return str(first.get("reason", "")), str(first.get("message", ""))
    return "", str(error_obj.get("message", ""))


def main() -> int:
    args = parse_args()
    target_platform = args.upload_platform
    root = Path(args.root).resolve()
    client_secrets = Path(args.client_secrets).resolve()
    token_file = Path(args.token_file).resolve()
    state_file = Path(args.state_file).resolve()
    youtube_upload_ledger_file = Path(args.youtube_upload_ledger_file).resolve()
    instagram_upload_ledger_file = Path(args.instagram_upload_ledger_file).resolve()
    facebook_upload_ledger_file = Path(args.facebook_upload_ledger_file).resolve()
    metadata_dir = Path(args.metadata_dir).resolve()
    metadata_history_file = Path(args.metadata_history_file).resolve()
    converted_dir = Path(args.converted_dir).resolve()
    meta_reels_state_file = Path(args.meta_reels_state_file).resolve()
    music_dir = Path(args.music_dir).resolve() if args.music_dir.strip() else None
    music_inventory_file = Path(args.music_inventory_file).resolve()

    if not root.exists():
        print(f"[error] root path not found: {root}")
        return 1
    if target_platform == "youtube" and not args.dry_run and not client_secrets.exists():
        print(f"[error] client secrets file not found: {client_secrets}")
        return 1

    extensions = normalize_extensions(args.extensions)
    exclude_dirs = normalize_names_csv(args.exclude_dirs)
    exclude_files = normalize_names_csv(args.exclude_files)
    videos = discover_videos(root, extensions, exclude_dirs, exclude_files)
    if not videos:
        print(f"[info] no videos found under: {root}")
        return 0

    state = load_json_file(state_file, default={"uploaded": {}})
    uploaded_state: Dict[str, Any] = state.get("uploaded", {})
    youtube_upload_ledger = ensure_platform_upload_ledger_shape(
        load_json_file(youtube_upload_ledger_file, default={"entries": {}})
    )
    instagram_upload_ledger = ensure_platform_upload_ledger_shape(
        load_json_file(instagram_upload_ledger_file, default={"entries": {}})
    )
    facebook_upload_ledger = ensure_platform_upload_ledger_shape(
        load_json_file(facebook_upload_ledger_file, default={"entries": {}})
    )
    try:
        required_uploaded_platforms = normalize_platform_names_csv(args.require_uploaded_on)
        required_missing_platforms = normalize_platform_names_csv(args.require_missing_on)
    except ValueError as exc:
        print(f"[error] {exc}")
        return 2

    if not required_uploaded_platforms and not required_missing_platforms:
        required_missing_platforms = ["youtube", "instagram", "facebook"]

    if target_platform not in required_missing_platforms:
        required_missing_platforms.append(target_platform)

    metadata_history = load_json_file(
        metadata_history_file,
        default={"titles": [], "descriptions": []},
    )
    history_titles = [
        str(x) for x in metadata_history.get("titles", [])
        if isinstance(x, str) and x.strip()
    ]
    history_descriptions = [
        str(x) for x in metadata_history.get("descriptions", [])
        if isinstance(x, str) and x.strip()
    ]
    meta_crosspost_enabled = bool(args.crosspost_meta and target_platform == "youtube")
    meta_upload_enabled = meta_crosspost_enabled or target_platform in {"instagram", "facebook"}
    meta_reels_state = ensure_meta_state_shape({"entries": {}})
    facebook_blocked_for_run = {"blocked": False}
    music_inventory: List[Dict[str, str]] = []
    music_enabled = bool(music_dir)
    if meta_upload_enabled:
        if meta_requests is None:
            print("[error] Meta cross-posting requires requests. Run: pip install -r requirements.txt")
            return 2
        if not clean_text(args.meta_access_token):
            print("[error] Meta upload is enabled but access token is missing.")
            return 2
        effective_meta_platform = args.meta_platform
        if target_platform in {"instagram", "facebook"}:
            effective_meta_platform = target_platform
        args.meta_platform = effective_meta_platform
        if meta_platform_enabled(args.meta_platform, "instagram") and not clean_text(args.meta_ig_user_id):
            print("[error] Meta upload enabled for Instagram but IG user id is missing.")
            return 2
        if meta_platform_enabled(args.meta_platform, "facebook") and not clean_text(args.meta_facebook_page_id):
            print("[error] Meta upload enabled for Facebook but page id is missing.")
            return 2
        meta_reels_state = ensure_meta_state_shape(
            load_json_file(meta_reels_state_file, default={"entries": {}})
        )
    if music_enabled:
        if not music_dir or not music_dir.exists():
            print(f"[error] music directory not found: {music_dir}")
            return 2
        music_inventory = build_music_inventory(music_dir)
        if not music_inventory:
            print(f"[error] no MP3 files found in music directory: {music_dir}")
            return 2
        save_json_file(
            music_inventory_file,
            {
                "music_dir": str(music_dir),
                "count": len(music_inventory),
                "tracks": music_inventory,
            },
        )

    pending: List[Tuple[Path, str, str, float]] = []
    for video in videos:
        rel = video.relative_to(root).as_posix()
        key = file_key(root, video)
        is_allowed = True

        for platform_name in required_uploaded_platforms:
            if not is_uploaded_on_platform(
                platform_name,
                state_key=key,
                uploaded_state=uploaded_state,
                instagram_upload_ledger=instagram_upload_ledger,
                facebook_upload_ledger=facebook_upload_ledger,
            ):
                is_allowed = False
                break

        if not is_allowed:
            continue

        for platform_name in required_missing_platforms:
            if is_uploaded_on_platform(
                platform_name,
                state_key=key,
                uploaded_state=uploaded_state,
                instagram_upload_ledger=instagram_upload_ledger,
                facebook_upload_ledger=facebook_upload_ledger,
            ):
                is_allowed = False
                break

        if not is_allowed:
            continue

        pending.append((video, rel, key, video.stat().st_mtime))

    pending.sort(key=lambda item: item[3])

    if args.max_videos > 0:
        pending = pending[: args.max_videos]

    if not pending:
        print("[info] nothing to upload (all files already uploaded or filtered).")
        return 0

    extra_keywords = [clean_text(x) for x in args.extra_keywords.split(",") if clean_text(x)]
    ffprobe_bin = args.ffprobe_bin
    ffmpeg_bin = args.ffmpeg_bin

    if args.shorts_policy != "off":
        resolved_ffprobe = resolve_media_tool(args.ffprobe_bin)
        if not resolved_ffprobe:
            print(f"[error] ffprobe not found: {args.ffprobe_bin}")
            return 1
        ffprobe_bin = resolved_ffprobe
        resolved_ffmpeg = resolve_media_tool(args.ffmpeg_bin)
        if args.shorts_policy == "convert" and not resolved_ffmpeg:
            print(f"[error] ffmpeg not found: {args.ffmpeg_bin}")
            return 1
        if resolved_ffmpeg:
            ffmpeg_bin = resolved_ffmpeg
        print(f"[info] ffprobe: {ffprobe_bin}")
        if args.shorts_policy == "convert":
            print(f"[info] ffmpeg: {ffmpeg_bin}")
    use_ai = not args.no_ai and bool(os.getenv("OPENAI_API_KEY"))
    if not args.no_ai and OpenAI is None:
        print("[warn] openai package not installed. Using fallback metadata templates.")
    openai_client: Optional[OpenAI] = OpenAI() if use_ai else None

    if not use_ai:
        print("[warn] AI metadata disabled or OPENAI_API_KEY missing. Using fallback metadata templates.")
        if args.require_ai:
            print("[error] --require-ai is enabled but OpenAI metadata is unavailable.")
            return 1

    youtube = None
    playlist_id: Optional[str] = None
    if target_platform == "youtube" and not args.dry_run:
        youtube = build_youtube_client(client_secrets, token_file, args.auth_port)
        if args.playlist_name.strip():
            try:
                playlist_id = resolve_playlist_id(youtube, args.playlist_name)
                if playlist_id:
                    print(f"[info] playlist resolved: {args.playlist_name} ({playlist_id})")
                else:
                    print(f"[warn] playlist not found: {args.playlist_name}")
            except Exception as exc:  # noqa: BLE001
                print(f"[warn] playlist lookup failed: {exc}")

    metadata_dir.mkdir(parents=True, exist_ok=True)

    print(f"[info] discovered videos: {len(videos)}")
    print(f"[info] queued videos: {len(pending)}")
    print(f"[info] target platform: {target_platform}")
    print(
        f"[info] require uploaded on: "
        f"{', '.join(required_uploaded_platforms) if required_uploaded_platforms else '-'}"
    )
    print(
        f"[info] require missing on: "
        f"{', '.join(required_missing_platforms) if required_missing_platforms else '-'}"
    )
    print(f"[info] dry run: {args.dry_run}")
    if music_enabled:
        print(
            f"[info] background music enabled: tracks={len(music_inventory)} "
            f"| volume={args.music_bg_volume:.3f} | inventory={music_inventory_file}"
        )
    if meta_crosspost_enabled:
        print(
            f"[info] Meta cross-posting enabled: platform={args.meta_platform} "
            f"| state={meta_reels_state_file}"
        )
    elif target_platform in {"instagram", "facebook"}:
        print(
            f"[info] Meta direct upload enabled: platform={args.meta_platform} "
            f"| state={meta_reels_state_file}"
        )

    uploaded_count = 0
    skipped_not_shorts = 0
    hit_upload_limit = False
    session_titles: List[str] = []
    session_descriptions: List[str] = []
    for index, (video_path, rel_path, key, _) in enumerate(pending, start=1):
        print(f"\n[{index}/{len(pending)}] processing: {rel_path}")
        upload_path = video_path
        cleanup_candidates: List[Path] = []
        chosen_music_path: Optional[Path] = None

        source_info = probe_video_info(video_path, ffprobe_bin)
        if source_info:
            src_w = int(source_info["width"])
            src_h = int(source_info["height"])
            src_dur = source_info["duration"]
            print(f"[video] source: {src_w}x{src_h}, {src_dur:.1f}s")
        else:
            print("[warn] could not inspect video dimensions/duration with ffprobe.")

        if args.shorts_policy != "off":
            if not source_info:
                print("[warn] skipping because Shorts policy requires valid media info.")
                skipped_not_shorts += 1
                continue

            eligible, reasons = is_shorts_eligible(source_info, args.shorts_max_seconds)
            if not eligible:
                reason_text = "; ".join(reasons)
                if args.shorts_policy == "strict":
                    print(f"[skip] not Shorts-eligible: {reason_text}")
                    skipped_not_shorts += 1
                    continue
                try:
                    upload_path = convert_to_shorts(
                        source=video_path,
                        converted_dir=converted_dir,
                        ffmpeg_bin=ffmpeg_bin,
                        ffprobe_bin=ffprobe_bin,
                        shorts_max_seconds=args.shorts_max_seconds,
                    )
                    if upload_path != video_path:
                        cleanup_candidates.append(upload_path)
                    converted_info = probe_video_info(upload_path, ffprobe_bin)
                    if converted_info:
                        c_w = int(converted_info["width"])
                        c_h = int(converted_info["height"])
                        c_dur = converted_info["duration"]
                        print(
                            f"[video] converted for Shorts: {upload_path.name} "
                            f"({c_w}x{c_h}, {c_dur:.1f}s)"
                        )
                    else:
                        print(f"[video] converted for Shorts: {upload_path.name}")
                except Exception as exc:  # noqa: BLE001
                    print(f"[error] conversion failed; skipping file: {exc}")
                    skipped_not_shorts += 1
                    continue

        if music_enabled:
            original_upload_path = upload_path
            mixed_upload_path, chosen_music_path, music_failures = try_mix_background_music(
                source=upload_path,
                music_inventory=music_inventory,
                converted_dir=converted_dir,
                ffmpeg_bin=ffmpeg_bin,
                ffprobe_bin=ffprobe_bin,
                bg_volume=args.music_bg_volume,
            )
            if chosen_music_path:
                upload_path = mixed_upload_path
                if upload_path != video_path:
                    cleanup_candidates.append(upload_path)
                print(
                    f"[audio] background music mixed: {chosen_music_path.name} "
                    f"(volume={args.music_bg_volume:.3f})"
                )
            else:
                upload_path = original_upload_path
                if music_failures:
                    print(
                        "[warn] background music mix failed for all available tracks; "
                        "uploading video without music."
                    )
                    for failure in music_failures[:3]:
                        print(f"[warn] music attempt failed: {failure}")
                    if len(music_failures) > 3:
                        print(
                            f"[warn] additional music failures not shown: "
                            f"{len(music_failures) - 3}"
                        )
                else:
                    print("[warn] no usable background music tracks found; uploading video without music.")

        clip_context = load_clip_context(video_path)
        if clip_context:
            print(
                "[meta] sidecar context: "
                f"kills={clip_context.get('kills')}, "
                f"site={clip_context.get('site_name') or '-'}, "
                f"agent={clip_context.get('agent_name') or '-'}"
            )

        fallback = build_fallback_metadata(video_path, extra_keywords, clip_context)
        metadata: Dict[str, Any] = finalize_metadata(
            fallback,
            fallback,
            instagram_username=args.instagram_username,
        )
        metadata_generated_by_ai = False

        recent_titles_pool = (history_titles + session_titles)[-max(args.ai_uniqueness_window, 1):]
        recent_descriptions_pool = (
            history_descriptions + session_descriptions
        )[-max(args.ai_uniqueness_window, 1):]

        if openai_client:
            ai_success = False
            for attempt in range(1, max(args.ai_metadata_retries, 1) + 1):
                try:
                    metadata_raw = generate_ai_metadata(
                        client=openai_client,
                        model=args.openai_model,
                        file_path=video_path,
                        rel_path=rel_path,
                        channel_name=args.channel_name,
                        extra_keywords=extra_keywords,
                        language=args.language,
                        recent_titles=recent_titles_pool[-30:],
                        recent_descriptions=recent_descriptions_pool[-15:],
                        clip_context=clip_context,
                    )
                    candidate = finalize_metadata(
                        metadata_raw,
                        fallback,
                        instagram_username=args.instagram_username,
                    )
                    unique_ok, unique_reason = is_metadata_unique(
                        title=candidate["title"],
                        description=candidate["description"],
                        recent_titles=recent_titles_pool,
                        recent_descriptions=recent_descriptions_pool,
                    )
                    if unique_ok:
                        metadata = candidate
                        ai_success = True
                        metadata_generated_by_ai = True
                        break
                    print(
                        f"[warn] AI metadata attempt {attempt} not unique enough "
                        f"({unique_reason}); retrying."
                    )
                except Exception as exc:  # noqa: BLE001
                    print(f"[warn] AI generation attempt {attempt} failed: {exc}")

            if not ai_success:
                if args.require_ai:
                    print("[error] Could not generate unique AI metadata. Skipping upload for this file.")
                    continue
                print("[warn] falling back to template metadata for this file.")

        metadata_record = {
            "relative_path": rel_path,
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata,
        }
        metadata_path = metadata_dir / (video_path.stem + ".metadata.json")
        save_json_file(metadata_path, metadata_record)

        print(f"[meta] title: {metadata['title']}")
        print(f"[meta] tags: {', '.join(metadata['tags'][:8])}{' ...' if len(metadata['tags']) > 8 else ''}")
        if metadata_generated_by_ai:
            print("[meta] source: OpenAI")
        else:
            print("[meta] source: fallback")

        session_titles.append(metadata["title"])
        session_descriptions.append(metadata["description"])
        session_titles = session_titles[-max(args.ai_uniqueness_window, 1):]
        session_descriptions = session_descriptions[-max(args.ai_uniqueness_window, 1):]

        if args.dry_run:
            continue

        if target_platform == "youtube":
            try:
                video_id = upload_video(
                    youtube=youtube,
                    file_path=upload_path,
                    metadata=metadata,
                    privacy=args.privacy,
                    category_id=args.category_id,
                    language=args.language,
                    notify_subscribers=args.notify_subscribers,
                )
                playlist_item_id = ""
                if playlist_id:
                    try:
                        playlist_item_id = add_video_to_playlist(youtube, playlist_id, video_id)
                        print(f"[ok] added to playlist: {args.playlist_name}")
                    except Exception as exc:  # noqa: BLE001
                        print(f"[warn] uploaded but failed to add playlist item: {exc}")
                uploaded_state[key] = {
                    "video_id": video_id,
                    "relative_path": rel_path,
                    "uploaded_at_utc": datetime.now(timezone.utc).isoformat(),
                    "title": metadata["title"],
                    "metadata_file": str(metadata_path),
                    "uploaded_file_path": str(upload_path),
                    "background_music_file": str(chosen_music_path) if chosen_music_path else "",
                    "playlist_name": args.playlist_name if playlist_id else "",
                    "playlist_id": playlist_id or "",
                    "playlist_item_id": playlist_item_id,
                }
                state["uploaded"] = uploaded_state
                save_json_file(state_file, state)
                update_platform_upload_ledger(
                    youtube_upload_ledger,
                    state_key=key,
                    status="ok",
                    relative_path=rel_path,
                    source_file=upload_path,
                    metadata_file=metadata_path,
                    title=metadata["title"],
                    platform_id_key="video_id",
                    platform_id_value=video_id,
                    extra_fields={
                        "playlist_name": args.playlist_name if playlist_id else "",
                        "playlist_id": playlist_id or "",
                        "playlist_item_id": playlist_item_id,
                        "uploaded_file_path": str(upload_path),
                        "background_music_file": str(chosen_music_path) if chosen_music_path else "",
                    },
                )
                save_json_file(youtube_upload_ledger_file, youtube_upload_ledger)
                history_titles.append(metadata["title"])
                history_descriptions.append(metadata["description"])
                metadata_history["titles"] = history_titles[-5000:]
                metadata_history["descriptions"] = history_descriptions[-5000:]
                save_json_file(metadata_history_file, metadata_history)
                uploaded_count += 1
                print(f"[ok] uploaded: https://www.youtube.com/watch?v={video_id}")
                if meta_crosspost_enabled:
                    crosspost_meta_reel(
                        args=args,
                        reels_state=meta_reels_state,
                        instagram_upload_ledger=instagram_upload_ledger,
                        facebook_upload_ledger=facebook_upload_ledger,
                        state_key=key,
                        rel_path=rel_path,
                        source_file=upload_path,
                        metadata=metadata,
                        metadata_path=metadata_path,
                        youtube_video_id=video_id,
                        facebook_blocked_for_run=facebook_blocked_for_run,
                    )
                    save_json_file(meta_reels_state_file, meta_reels_state)
                    save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
                    save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)
                if args.delete_converted_after_upload:
                    seen_cleanup = set()
                    for temp_path in cleanup_candidates:
                        temp_path_str = str(temp_path.resolve())
                        if temp_path_str in seen_cleanup:
                            continue
                        seen_cleanup.add(temp_path_str)
                        try:
                            is_converted_temp = False
                            try:
                                temp_path.resolve().relative_to(converted_dir.resolve())
                                is_converted_temp = True
                            except ValueError:
                                is_converted_temp = False

                            if is_converted_temp and temp_path.exists():
                                temp_path.unlink()
                                print(f"[cleanup] deleted converted file: {temp_path.name}")
                        except Exception as exc:  # noqa: BLE001
                            print(f"[warn] uploaded but failed to delete converted file: {exc}")
            except Exception as exc:  # noqa: BLE001
                reason, reason_message = extract_http_error_reason(exc)
                update_platform_upload_ledger(
                    youtube_upload_ledger,
                    state_key=key,
                    status="error",
                    relative_path=rel_path,
                    source_file=upload_path,
                    metadata_file=metadata_path,
                    title=metadata["title"],
                    platform_id_key="video_id",
                    platform_id_value="",
                    extra_fields={
                        "uploaded_file_path": str(upload_path),
                        "background_music_file": str(chosen_music_path) if chosen_music_path else "",
                    },
                    error_message=str(exc),
                )
                save_json_file(youtube_upload_ledger_file, youtube_upload_ledger)
                print(f"[error] upload failed for {rel_path}: {exc}")
                if reason in {"uploadLimitExceeded", "quotaExceeded"}:
                    hit_upload_limit = True
                    if reason_message:
                        print(f"[limit] {reason_message}")
                    print(
                        "[limit] YouTube quota limit reached. "
                        "Stop now and retry after the quota window resets."
                    )
                    break
        else:
            crosspost_meta_reel(
                args=args,
                reels_state=meta_reels_state,
                instagram_upload_ledger=instagram_upload_ledger,
                facebook_upload_ledger=facebook_upload_ledger,
                state_key=key,
                rel_path=rel_path,
                source_file=upload_path,
                metadata=metadata,
                metadata_path=metadata_path,
                youtube_video_id="",
                facebook_blocked_for_run=facebook_blocked_for_run,
            )
            save_json_file(meta_reels_state_file, meta_reels_state)
            save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
            save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)
            history_titles.append(metadata["title"])
            history_descriptions.append(metadata["description"])
            metadata_history["titles"] = history_titles[-5000:]
            metadata_history["descriptions"] = history_descriptions[-5000:]
            save_json_file(metadata_history_file, metadata_history)
            if target_platform == "instagram" and is_platform_upload_completed(instagram_upload_ledger, key):
                uploaded_count += 1
                print(f"[ok][instagram] uploaded: {rel_path}")
            elif target_platform == "facebook" and is_platform_upload_completed(facebook_upload_ledger, key):
                uploaded_count += 1
                print(f"[ok][facebook] uploaded: {rel_path}")

    if args.dry_run:
        print("\n[done] dry run completed.")
    else:
        print(f"\n[done] uploads completed: {uploaded_count}/{len(pending)}")
        print(f"[done] state file: {state_file}")
    if skipped_not_shorts:
        print(f"[done] skipped by Shorts policy: {skipped_not_shorts}")
    if hit_upload_limit:
        print("[done] stopped early due to YouTube quota limit.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
