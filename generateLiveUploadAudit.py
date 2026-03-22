"""Fetch live upload data from YouTube, Instagram, and Facebook and compare it to local videos."""

from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES: List[str] = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch live platform uploads and compare them to local offline videos."
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Root directory to recursively scan for local videos.",
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
        "--client-secrets",
        default="client_secret.json",
        help="Path to YouTube OAuth client secrets JSON.",
    )
    parser.add_argument(
        "--token-file",
        default="token.json",
        help="Path to YouTube OAuth token JSON.",
    )
    parser.add_argument(
        "--auth-port",
        type=int,
        default=8080,
        help="Local port used by the YouTube OAuth callback server.",
    )
    parser.add_argument(
        "--youtube-state-file",
        default=".youtube_upload_state.json",
        help="Path to local YouTube upload state JSON.",
    )
    parser.add_argument(
        "--meta-access-token",
        default=(
            os.getenv("META_PAGE_ACCESS_TOKEN", "").strip()
            or os.getenv("META_ACCESS_TOKEN", "").strip()
            or os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN", "").strip()
        ),
        help="Meta Graph API access token.",
    )
    parser.add_argument(
        "--ig-user-id",
        default=os.getenv("INSTAGRAM_USER_ID", "").strip() or os.getenv("IG_USER_ID", "").strip(),
        help="Instagram professional account ID.",
    )
    parser.add_argument(
        "--facebook-page-id",
        default=os.getenv("FACEBOOK_PAGE_ID", "").strip() or os.getenv("FB_PAGE_ID", "").strip(),
        help="Facebook page ID.",
    )
    parser.add_argument(
        "--graph-version",
        default="v25.0",
        help="Meta Graph API version.",
    )
    parser.add_argument(
        "--request-timeout-seconds",
        type=float,
        default=60.0,
        help="Timeout in seconds for each Meta request.",
    )
    parser.add_argument(
        "--output-dir",
        default="live_upload_audit",
        help="Directory where all JSON output files will be written.",
    )
    return parser.parse_args()


def normalize_extensions(raw_extensions: str) -> Set[str]:
    extensions: Set[str] = set()
    for item in raw_extensions.split(","):
        cleaned = item.strip().lower()
        if not cleaned:
            continue
        if not cleaned.startswith("."):
            cleaned = f".{cleaned}"
        extensions.add(cleaned)
    return extensions


def normalize_names_csv(raw_value: str) -> Set[str]:
    names: Set[str] = set()
    for item in raw_value.split(","):
        cleaned = item.strip().lower()
        if cleaned:
            names.add(cleaned)
    return names


def discover_videos(
    root: Path,
    extensions: Set[str],
    exclude_dirs: Set[str],
    exclude_files: Set[str],
) -> List[Path]:
    files: List[Path] = []
    for dir_path, dir_names, file_names in os.walk(root):
        dir_names[:] = [name for name in dir_names if name.lower() not in exclude_dirs]
        base_path = Path(dir_path)
        for file_name in file_names:
            if file_name.lower() in exclude_files:
                continue
            file_path = base_path / file_name
            if file_path.suffix.lower() in extensions:
                files.append(file_path)
    files.sort()
    return files


def file_key(root: Path, file_path: Path) -> str:
    file_stat = file_path.stat()
    relative_path = file_path.relative_to(root).as_posix()
    return f"{relative_path}|{file_stat.st_size}|{int(file_stat.st_mtime)}"


def load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def save_json_file(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(value: str) -> str:
    lowered = value.strip().lower()
    collapsed = re.sub(r"\s+", " ", lowered)
    return re.sub(r"[^a-z0-9]+", "", collapsed)


def clean_text(value: Any) -> str:
    return str(value or "").strip()


def chunked(values: List[str], size: int) -> List[List[str]]:
    chunks: List[List[str]] = []
    index = 0
    while index < len(values):
        chunks.append(values[index:index + size])
        index += size
    return chunks


def build_youtube_client(client_secrets: Path, token_file: Path, auth_port: int):
    credentials: Optional[Credentials] = None
    if token_file.exists():
        credentials = Credentials.from_authorized_user_file(str(token_file), SCOPES)
    if credentials and not credentials.valid:
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
        else:
            credentials = None
    if credentials is None:
        flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets), SCOPES)
        credentials = flow.run_local_server(port=auth_port)
        token_file.write_text(credentials.to_json(), encoding="utf-8")
    return build("youtube", "v3", credentials=credentials)


def fetch_youtube_uploads(
    client_secrets: Path,
    token_file: Path,
    auth_port: int,
) -> Dict[str, Any]:
    youtube = build_youtube_client(client_secrets, token_file, auth_port)
    channel_response = youtube.channels().list(part="contentDetails,snippet", mine=True).execute()
    channel_items = channel_response.get("items", [])
    if not channel_items:
        raise RuntimeError("YouTube channel lookup returned no authenticated channel.")

    channel_item = channel_items[0]
    uploads_playlist_id = clean_text(
        channel_item.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads", "")
    )
    if not uploads_playlist_id:
        raise RuntimeError("YouTube uploads playlist could not be resolved.")

    playlist_items: List[Dict[str, Any]] = []
    video_ids: List[str] = []
    next_page_token: Optional[str] = None

    while True:
        response = youtube.playlistItems().list(
            part="snippet,contentDetails,status",
            playlistId=uploads_playlist_id,
            maxResults=50,
            pageToken=next_page_token,
        ).execute()
        for item in response.get("items", []):
            playlist_items.append(item)
            video_id = clean_text(item.get("contentDetails", {}).get("videoId", ""))
            if video_id:
                video_ids.append(video_id)
        next_page_token = response.get("nextPageToken")
        if not next_page_token:
            break

    video_details_by_id: Dict[str, Dict[str, Any]] = {}
    for batch in chunked(video_ids, 50):
        response = youtube.videos().list(
            part="snippet,status,contentDetails",
            id=",".join(batch),
            maxResults=50,
        ).execute()
        for item in response.get("items", []):
            video_id = clean_text(item.get("id", ""))
            if video_id:
                video_details_by_id[video_id] = item

    entries: List[Dict[str, Any]] = []
    for item in playlist_items:
        video_id = clean_text(item.get("contentDetails", {}).get("videoId", ""))
        detail = video_details_by_id.get(video_id, {})
        snippet = detail.get("snippet", {})
        entries.append(
            {
                "platform": "youtube",
                "video_id": video_id,
                "title": clean_text(snippet.get("title", "")),
                "description": clean_text(snippet.get("description", "")),
                "published_at": clean_text(snippet.get("publishedAt", "")),
                "privacy_status": clean_text(detail.get("status", {}).get("privacyStatus", "")),
                "duration": clean_text(detail.get("contentDetails", {}).get("duration", "")),
                "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else "",
                "raw": {
                    "playlist_item": item,
                    "video": detail,
                },
            }
        )

    return {
        "generated_at_utc": now_utc_iso(),
        "channel_title": clean_text(channel_item.get("snippet", {}).get("title", "")),
        "uploads_playlist_id": uploads_playlist_id,
        "count": len(entries),
        "entries": entries,
    }


def request_json(
    method: str,
    url: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    timeout: float,
) -> Dict[str, Any]:
    response = requests.request(method=method, url=url, params=params, timeout=timeout)
    if response.status_code >= 400:
        response_text = response.text.strip()
        raise RuntimeError(
            f"{response.status_code} {response.reason}: {response_text}"
        )
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"Unexpected JSON payload: {payload}")
    return payload


def fetch_paged_graph_entries(
    url: str,
    params: Dict[str, Any],
    timeout: float,
) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    next_url: Optional[str] = url
    next_params: Optional[Dict[str, Any]] = dict(params)

    while next_url:
        payload = request_json("GET", next_url, params=next_params, timeout=timeout)
        page_data = payload.get("data", [])
        if isinstance(page_data, list):
            for item in page_data:
                if isinstance(item, dict):
                    entries.append(item)
        paging = payload.get("paging", {})
        if isinstance(paging, dict):
            cursors_next = paging.get("next")
            if isinstance(cursors_next, str) and cursors_next.strip():
                next_url = cursors_next
                next_params = None
                continue
        next_url = None
        next_params = None

    return entries


def fetch_instagram_uploads(
    graph_version: str,
    ig_user_id: str,
    access_token: str,
    timeout: float,
) -> Dict[str, Any]:
    url = f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media"
    params = {
        "fields": "id,caption,media_type,media_product_type,permalink,shortcode,timestamp,thumbnail_url,media_url",
        "limit": 100,
        "access_token": access_token,
    }
    raw_entries = fetch_paged_graph_entries(url, params, timeout)
    entries: List[Dict[str, Any]] = []
    for item in raw_entries:
        media_type = clean_text(item.get("media_type", ""))
        media_product_type = clean_text(item.get("media_product_type", ""))
        if media_product_type.upper() == "REELS" or media_type.upper() == "VIDEO":
            entries.append(
                {
                    "platform": "instagram",
                    "media_id": clean_text(item.get("id", "")),
                    "caption": clean_text(item.get("caption", "")),
                    "media_type": media_type,
                    "media_product_type": media_product_type,
                    "timestamp": clean_text(item.get("timestamp", "")),
                    "permalink": clean_text(item.get("permalink", "")),
                    "shortcode": clean_text(item.get("shortcode", "")),
                    "raw": item,
                }
            )

    return {
        "generated_at_utc": now_utc_iso(),
        "ig_user_id": ig_user_id,
        "count": len(entries),
        "entries": entries,
    }


def resolve_instagram_user_id(
    graph_version: str,
    facebook_page_id: str,
    ig_user_id_or_username: str,
    access_token: str,
    timeout: float,
) -> str:
    cleaned_value = clean_text(ig_user_id_or_username).lstrip("@")
    if cleaned_value.isdigit():
        return cleaned_value

    if not clean_text(facebook_page_id):
        raise RuntimeError(
            "Instagram username was provided, but --facebook-page-id is missing so the numeric IG user id cannot be resolved."
        )

    url = f"https://graph.facebook.com/{graph_version}/{facebook_page_id}"
    params = {
        "fields": "instagram_business_account{id,username}",
        "access_token": access_token,
    }
    payload = request_json("GET", url, params=params, timeout=timeout)
    instagram_business_account = payload.get("instagram_business_account", {})
    if not isinstance(instagram_business_account, dict):
        raise RuntimeError(
            "The Facebook page is not linked to an Instagram professional account."
        )

    resolved_id = clean_text(instagram_business_account.get("id", ""))
    resolved_username = clean_text(instagram_business_account.get("username", "")).lstrip("@")
    if not resolved_id:
        raise RuntimeError(
            "The linked Instagram professional account id could not be resolved from the Facebook page."
        )

    if cleaned_value and resolved_username and cleaned_value.lower() != resolved_username.lower():
        raise RuntimeError(
            f"The supplied Instagram username '{cleaned_value}' does not match the page-linked account '{resolved_username}'."
        )

    return resolved_id


def fetch_facebook_uploads(
    graph_version: str,
    page_id: str,
    access_token: str,
    timeout: float,
) -> Dict[str, Any]:
    errors: List[str] = []
    attempts: List[Tuple[str, str]] = [
        (
            "video_reels",
            f"https://graph.facebook.com/{graph_version}/{page_id}/video_reels",
        ),
        (
            "videos",
            f"https://graph.facebook.com/{graph_version}/{page_id}/videos",
        ),
    ]

    for mode_name, url in attempts:
        try:
            params: Dict[str, Any] = {
                "fields": "id,description,created_time,permalink_url,source,status,title,length",
                "limit": 100,
                "access_token": access_token,
            }
            if mode_name == "videos":
                params["type"] = "uploaded"
            raw_entries = fetch_paged_graph_entries(url, params, timeout)
            entries: List[Dict[str, Any]] = []
            for item in raw_entries:
                entries.append(
                    {
                        "platform": "facebook",
                        "video_id": clean_text(item.get("id", "")),
                        "title": clean_text(item.get("title", "")),
                        "description": clean_text(item.get("description", "")),
                        "created_time": clean_text(item.get("created_time", "")),
                        "permalink_url": clean_text(item.get("permalink_url", "")),
                        "length": item.get("length"),
                        "status": item.get("status"),
                        "mode": mode_name,
                        "raw": item,
                    }
                )
            return {
                "generated_at_utc": now_utc_iso(),
                "facebook_page_id": page_id,
                "mode": mode_name,
                "count": len(entries),
                "entries": entries,
                "errors": errors,
            }
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{mode_name}: {exc}")

    raise RuntimeError("; ".join(errors))


def metadata_file_for_video(root: Path, relative_path: str) -> Path:
    stem = Path(relative_path).stem
    return root / "generated_metadata" / f"{stem}.metadata.json"


def build_offline_entry(
    root: Path,
    video_path: Path,
    youtube_state_by_key: Dict[str, Any],
) -> Dict[str, Any]:
    relative_path = video_path.relative_to(root).as_posix()
    state_key = file_key(root, video_path)
    metadata_path = metadata_file_for_video(root, relative_path)
    metadata_payload = load_json_file(metadata_path, default={})
    metadata_obj = metadata_payload.get("metadata", {})
    if not isinstance(metadata_obj, dict):
        metadata_obj = {}

    youtube_state_row = youtube_state_by_key.get(state_key, {})
    if not isinstance(youtube_state_row, dict):
        youtube_state_row = {}

    stem = video_path.stem
    source_token = normalize_text(stem)
    metadata_title = clean_text(metadata_obj.get("title", ""))
    metadata_description = clean_text(metadata_obj.get("description", ""))
    youtube_title = clean_text(youtube_state_row.get("title", ""))

    return {
        "state_key": state_key,
        "relative_path": relative_path,
        "absolute_path": str(video_path),
        "file_name": video_path.name,
        "file_stem": stem,
        "file_size_bytes": video_path.stat().st_size,
        "modified_at_utc": datetime.fromtimestamp(
            video_path.stat().st_mtime,
            tz=timezone.utc,
        ).isoformat(),
        "metadata_file": str(metadata_path) if metadata_path.exists() else "",
        "metadata_title": metadata_title,
        "metadata_description": metadata_description,
        "youtube_state_video_id": clean_text(youtube_state_row.get("video_id", "")),
        "youtube_state_title": youtube_title,
        "match_tokens": {
            "source_token": source_token,
            "metadata_title": normalize_text(metadata_title),
            "youtube_title": normalize_text(youtube_title),
        },
    }


def build_offline_inventory(
    root: Path,
    extensions: Set[str],
    exclude_dirs: Set[str],
    exclude_files: Set[str],
    youtube_state_file: Path,
) -> Dict[str, Any]:
    videos = discover_videos(root, extensions, exclude_dirs, exclude_files)
    youtube_state = load_json_file(youtube_state_file, default={"uploaded": {}})
    youtube_state_by_key = youtube_state.get("uploaded", {})
    if not isinstance(youtube_state_by_key, dict):
        youtube_state_by_key = {}

    entries: List[Dict[str, Any]] = []
    for video_path in videos:
        entries.append(build_offline_entry(root, video_path, youtube_state_by_key))

    return {
        "generated_at_utc": now_utc_iso(),
        "root_directory": str(root),
        "count": len(entries),
        "entries": entries,
    }


def searchable_text_for_remote(entry: Dict[str, Any]) -> str:
    values: List[str] = []
    for key in ["title", "description", "caption", "url", "permalink", "permalink_url"]:
        values.append(clean_text(entry.get(key, "")))
    return normalize_text(" ".join(values))


def title_candidates_for_offline(entry: Dict[str, Any]) -> List[str]:
    candidates: List[str] = []
    match_tokens = entry.get("match_tokens", {})
    if isinstance(match_tokens, dict):
        metadata_title = clean_text(match_tokens.get("metadata_title", ""))
        youtube_title = clean_text(match_tokens.get("youtube_title", ""))
        if metadata_title:
            candidates.append(metadata_title)
        if youtube_title and youtube_title not in candidates:
            candidates.append(youtube_title)
    return candidates


def match_remote_to_offline(
    platform_name: str,
    remote_entries: List[Dict[str, Any]],
    offline_entries: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    offline_by_video_id: Dict[str, str] = {}
    for entry in offline_entries:
        video_id = clean_text(entry.get("youtube_state_video_id", ""))
        if video_id:
            offline_by_video_id[video_id] = clean_text(entry.get("state_key", ""))

    used_state_keys: Set[str] = set()
    annotated_remote_entries: List[Dict[str, Any]] = []

    for remote_entry in remote_entries:
        search_text = searchable_text_for_remote(remote_entry)
        best_state_key = ""
        best_method = ""
        best_score = -1

        if platform_name == "youtube":
            remote_video_id = clean_text(remote_entry.get("video_id", ""))
            mapped_state_key = offline_by_video_id.get(remote_video_id, "")
            if mapped_state_key:
                best_state_key = mapped_state_key
                best_method = "youtube_video_id"
                best_score = 1000

        if not best_state_key:
            for offline_entry in offline_entries:
                state_key = clean_text(offline_entry.get("state_key", ""))
                if not state_key or state_key in used_state_keys:
                    continue

                score = -1
                method = ""
                match_tokens = offline_entry.get("match_tokens", {})
                source_token = ""
                metadata_title = ""
                youtube_title = ""
                if isinstance(match_tokens, dict):
                    source_token = clean_text(match_tokens.get("source_token", ""))
                    metadata_title = clean_text(match_tokens.get("metadata_title", ""))
                    youtube_title = clean_text(match_tokens.get("youtube_title", ""))

                if source_token and len(source_token) >= 12 and source_token in search_text:
                    score = 800
                    method = "source_token"
                else:
                    if metadata_title and metadata_title == search_text:
                        score = 700
                        method = "metadata_title_exact"
                    elif youtube_title and youtube_title == search_text:
                        score = 680
                        method = "youtube_title_exact"
                    else:
                        for title_candidate in title_candidates_for_offline(offline_entry):
                            if title_candidate and (
                                title_candidate in search_text or search_text in title_candidate
                            ):
                                score = 500
                                method = "title_contains"
                                break

                if score > best_score:
                    best_score = score
                    best_state_key = state_key
                    best_method = method

        annotated_entry = dict(remote_entry)
        if best_score >= 500 and best_state_key and best_state_key not in used_state_keys:
            annotated_entry["matched_state_key"] = best_state_key
            annotated_entry["match_method"] = best_method
            annotated_entry["match_score"] = best_score
            used_state_keys.add(best_state_key)
        else:
            annotated_entry["matched_state_key"] = ""
            annotated_entry["match_method"] = ""
            annotated_entry["match_score"] = 0
        annotated_remote_entries.append(annotated_entry)

    matched_state_keys = sorted(used_state_keys)
    all_state_keys: List[str] = []
    for entry in offline_entries:
        state_key = clean_text(entry.get("state_key", ""))
        if state_key:
            all_state_keys.append(state_key)

    pending_state_keys: List[str] = []
    for state_key in all_state_keys:
        if state_key not in used_state_keys:
            pending_state_keys.append(state_key)

    summary = {
        "uploaded_count": len(matched_state_keys),
        "not_uploaded_count": len(pending_state_keys),
        "matched_state_keys": matched_state_keys,
        "not_uploaded_state_keys": pending_state_keys,
        "unmatched_remote_count": len(
            [item for item in annotated_remote_entries if not clean_text(item.get("matched_state_key", ""))]
        ),
    }
    return annotated_remote_entries, summary


def fetch_with_error_capture(
    fetch_name: str,
    fetch_fn,
) -> Dict[str, Any]:
    try:
        return fetch_fn()
    except Exception as exc:  # noqa: BLE001
        return {
            "generated_at_utc": now_utc_iso(),
            "count": 0,
            "entries": [],
            "fetch_error": f"{fetch_name}: {exc}",
        }


def extract_count_from_payload(payload: Dict[str, Any]) -> int:
    raw_count = payload.get("count")
    if isinstance(raw_count, int):
        return max(raw_count, 0)

    entries = payload.get("entries", [])
    if isinstance(entries, list):
        return len(entries)

    return 0


def main() -> int:
    args = parse_args()

    root = Path(args.root).resolve()
    output_dir = Path(args.output_dir).resolve()
    client_secrets = Path(args.client_secrets).resolve()
    token_file = Path(args.token_file).resolve()
    youtube_state_file = Path(args.youtube_state_file).resolve()

    extensions = normalize_extensions(args.extensions)
    exclude_dirs = normalize_names_csv(args.exclude_dirs)
    exclude_files = normalize_names_csv(args.exclude_files)

    offline_inventory = build_offline_inventory(
        root=root,
        extensions=extensions,
        exclude_dirs=exclude_dirs,
        exclude_files=exclude_files,
        youtube_state_file=youtube_state_file,
    )
    offline_entries = offline_inventory["entries"]

    youtube_uploads = fetch_with_error_capture(
        "youtube",
        lambda: fetch_youtube_uploads(client_secrets, token_file, args.auth_port),
    )

    if args.meta_access_token and args.ig_user_id:
        instagram_uploads = fetch_with_error_capture(
            "instagram",
            lambda: fetch_instagram_uploads(
                graph_version=args.graph_version,
                ig_user_id=resolve_instagram_user_id(
                    graph_version=args.graph_version,
                    facebook_page_id=args.facebook_page_id,
                    ig_user_id_or_username=args.ig_user_id,
                    access_token=args.meta_access_token,
                    timeout=args.request_timeout_seconds,
                ),
                access_token=args.meta_access_token,
                timeout=args.request_timeout_seconds,
            ),
        )
    else:
        instagram_uploads = {
            "generated_at_utc": now_utc_iso(),
            "count": 0,
            "entries": [],
            "fetch_error": "instagram: missing --meta-access-token or --ig-user-id",
        }

    if args.meta_access_token and args.facebook_page_id:
        facebook_uploads = fetch_with_error_capture(
            "facebook",
            lambda: fetch_facebook_uploads(
                graph_version=args.graph_version,
                page_id=args.facebook_page_id,
                access_token=args.meta_access_token,
                timeout=args.request_timeout_seconds,
            ),
        )
    else:
        facebook_uploads = {
            "generated_at_utc": now_utc_iso(),
            "count": 0,
            "entries": [],
            "fetch_error": "facebook: missing --meta-access-token or --facebook-page-id",
        }

    youtube_annotated_entries, youtube_match_summary = match_remote_to_offline(
        "youtube",
        youtube_uploads.get("entries", []),
        offline_entries,
    )
    instagram_annotated_entries, instagram_match_summary = match_remote_to_offline(
        "instagram",
        instagram_uploads.get("entries", []),
        offline_entries,
    )
    facebook_annotated_entries, facebook_match_summary = match_remote_to_offline(
        "facebook",
        facebook_uploads.get("entries", []),
        offline_entries,
    )

    offline_count = int(offline_inventory["count"])
    youtube_live_count = extract_count_from_payload(youtube_uploads)
    instagram_live_count = extract_count_from_payload(instagram_uploads)
    facebook_live_count = extract_count_from_payload(facebook_uploads)

    youtube_uploads["entries"] = youtube_annotated_entries
    youtube_uploads["matched_count"] = youtube_match_summary["uploaded_count"]
    instagram_uploads["entries"] = instagram_annotated_entries
    instagram_uploads["matched_count"] = instagram_match_summary["uploaded_count"]
    facebook_uploads["entries"] = facebook_annotated_entries
    facebook_uploads["matched_count"] = facebook_match_summary["uploaded_count"]

    comparison_payload = {
        "generated_at_utc": now_utc_iso(),
        "offline_count": offline_count,
        "files": {
            "offline_inventory": str(output_dir / "offline_videos.json"),
            "youtube_uploads": str(output_dir / "youtube_uploaded_videos.json"),
            "instagram_uploads": str(output_dir / "instagram_uploaded_videos.json"),
            "facebook_uploads": str(output_dir / "facebook_uploaded_videos.json"),
        },
        "platforms": {
            "youtube": {
                "uploaded_count": min(youtube_live_count, offline_count),
                "not_uploaded_count": max(offline_count - youtube_live_count, 0),
                "live_uploaded_count": youtube_live_count,
                "matched_state_keys_count": youtube_match_summary["uploaded_count"],
                "matched_state_keys": youtube_match_summary["matched_state_keys"],
                "not_uploaded_state_keys": youtube_match_summary["not_uploaded_state_keys"],
                "unmatched_remote_count": youtube_match_summary["unmatched_remote_count"],
            },
            "instagram": {
                "uploaded_count": min(instagram_live_count, offline_count),
                "not_uploaded_count": max(offline_count - instagram_live_count, 0),
                "live_uploaded_count": instagram_live_count,
                "matched_state_keys_count": instagram_match_summary["uploaded_count"],
                "matched_state_keys": instagram_match_summary["matched_state_keys"],
                "not_uploaded_state_keys": instagram_match_summary["not_uploaded_state_keys"],
                "unmatched_remote_count": instagram_match_summary["unmatched_remote_count"],
            },
            "facebook": {
                "uploaded_count": min(facebook_live_count, offline_count),
                "not_uploaded_count": max(offline_count - facebook_live_count, 0),
                "live_uploaded_count": facebook_live_count,
                "matched_state_keys_count": facebook_match_summary["uploaded_count"],
                "matched_state_keys": facebook_match_summary["matched_state_keys"],
                "not_uploaded_state_keys": facebook_match_summary["not_uploaded_state_keys"],
                "unmatched_remote_count": facebook_match_summary["unmatched_remote_count"],
            },
        },
    }

    save_json_file(output_dir / "offline_videos.json", offline_inventory)
    save_json_file(output_dir / "youtube_uploaded_videos.json", youtube_uploads)
    save_json_file(output_dir / "instagram_uploaded_videos.json", instagram_uploads)
    save_json_file(output_dir / "facebook_uploaded_videos.json", facebook_uploads)
    save_json_file(output_dir / "upload_comparison.json", comparison_payload)

    print(json.dumps(comparison_payload, indent=2, ensure_ascii=False))
    print(f"\n[done] output directory: {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
