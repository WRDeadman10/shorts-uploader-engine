"""Fix repeated title/description metadata for already uploaded YouTube videos.

This script reads uploaded video IDs from `.youtube_upload_state.json`, fetches the
current live metadata from YouTube, detects repeated titles/descriptions, and
updates duplicates with clip-specific unique text.

Examples:
python youtubeFixRepeatedMetadata.py --dry-run
python youtubeFixRepeatedMetadata.py --max-updates 25
python youtubeFixRepeatedMetadata.py --mode all
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Update uploaded YouTube videos and fix repeated titles/descriptions "
            "using the local upload state file."
        )
    )
    parser.add_argument(
        "--state-file",
        default=".youtube_upload_state.json",
        help="Path to upload state JSON created by youtubeBatchUpload.py.",
    )
    parser.add_argument(
        "--metadata-dir",
        default="generated_metadata",
        help="Directory containing local metadata JSON records.",
    )
    parser.add_argument(
        "--client-secrets",
        default="client_secret.json",
        help="Path to YouTube OAuth client secrets JSON.",
    )
    parser.add_argument(
        "--token-file",
        default="token.json",
        help="Path to store OAuth access token JSON.",
    )
    parser.add_argument(
        "--auth-port",
        type=int,
        default=8080,
        help="Local port used by OAuth callback server.",
    )
    parser.add_argument(
        "--mode",
        choices=["duplicates", "all"],
        default="duplicates",
        help="duplicates=only update repeated metadata, all=update every discovered upload.",
    )
    parser.add_argument(
        "--keep-first",
        action="store_true",
        default=True,
        help="When in duplicates mode, keep the first copy unchanged.",
    )
    parser.add_argument(
        "--no-keep-first",
        action="store_false",
        dest="keep_first",
        help="When in duplicates mode, also update the first copy in each duplicate group.",
    )
    parser.add_argument(
        "--max-updates",
        type=int,
        default=0,
        help="Limit number of videos to update (0 = all targets).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview updates without writing to YouTube or local JSON files.",
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


def build_youtube_client(client_secrets: Path, token_file: Path, auth_port: int):
    creds: Optional[Credentials] = None
    if token_file.exists():
        token_payload = load_json_file(token_file, default={})
        stored_scopes = set(token_payload.get("scopes", []))
        scope_mismatch = bool(stored_scopes) and not set(SCOPES).issubset(stored_scopes)
        if not scope_mismatch:
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


def normalize_text(text: str) -> str:
    value = re.sub(r"\s+", " ", text or "").strip().lower()
    return value


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def trim_title(title: str, max_len: int = 100) -> str:
    title = clean_text(title)
    if len(title) <= max_len:
        return title
    return clean_text(title[: max_len - 3]) + "..."


def trim_description(description: str, max_len: int = 5000) -> str:
    value = (description or "").strip()
    if len(value) <= max_len:
        return value
    return value[: max_len - 1].rstrip()


def parse_uploaded_at(raw: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def iter_chunks(items: List[str], size: int) -> Iterable[List[str]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def load_state_entries(state_file: Path) -> tuple[Dict[str, Any], List[Dict[str, Any]]]:
    state = load_json_file(state_file, default={"uploaded": {}})
    uploaded = state.get("uploaded", {})
    entries: List[Dict[str, Any]] = []
    if not isinstance(uploaded, dict):
        return state, entries

    for state_key, row in uploaded.items():
        if not isinstance(row, dict):
            continue
        video_id = str(row.get("video_id", "")).strip()
        if not video_id:
            continue
        relative_path = str(row.get("relative_path", "")).strip()
        metadata_file = str(row.get("metadata_file", "")).strip()
        uploaded_at = str(row.get("uploaded_at_utc", "")).strip()
        entries.append(
            {
                "state_key": state_key,
                "video_id": video_id,
                "relative_path": relative_path,
                "metadata_file": metadata_file,
                "uploaded_at_utc": uploaded_at,
                "sort_time": parse_uploaded_at(uploaded_at),
            }
        )

    entries.sort(key=lambda item: item["sort_time"])
    return state, entries


def fetch_live_snippets(youtube, video_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    snippets: Dict[str, Dict[str, Any]] = {}
    for chunk in iter_chunks(video_ids, 50):
        response = youtube.videos().list(
            part="snippet",
            id=",".join(chunk),
            maxResults=50,
        ).execute()
        for item in response.get("items", []):
            video_id = str(item.get("id", "")).strip()
            snippet = item.get("snippet", {})
            if video_id and isinstance(snippet, dict):
                snippets[video_id] = snippet
    return snippets


def extract_clip_marker(relative_path: str, video_id: str) -> str:
    stem = Path(relative_path).stem if relative_path else ""
    if stem:
        match = re.search(
            r"(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2})-(\d{2})-(\d{2})",
            stem,
        )
        if match:
            month, day, _, hour, minute, second = match.groups()
            return f"{month}-{day} {int(hour):02d}:{minute}:{second}"

        simplified = re.sub(r"[^a-zA-Z0-9]+", " ", stem).strip()
        if simplified:
            return simplified[:26]

    return f"clip {video_id[-6:]}" if video_id else "clip"


def build_unique_title(
    base_title: str,
    marker: str,
    video_id: str,
    used_titles: set[str],
) -> str:
    root = clean_text(base_title) or "Valorant Shorts"
    candidate = trim_title(f"{root} | {marker}")
    if normalize_text(candidate) not in used_titles:
        return candidate

    candidate = trim_title(f"{root} | {marker} {video_id[-4:]}")
    if normalize_text(candidate) not in used_titles:
        return candidate

    counter = 2
    while True:
        candidate = trim_title(f"{root} | {marker} #{counter}")
        if normalize_text(candidate) not in used_titles:
            return candidate
        counter += 1


def build_unique_description(
    base_description: str,
    marker: str,
    relative_path: str,
    video_id: str,
    used_descriptions: set[str],
) -> str:
    root = (base_description or "").strip()
    if not root:
        root = "Valorant short clip highlight."

    source_name = Path(relative_path).stem if relative_path else marker
    source_line = f"Source clip: {source_name or marker}"

    candidate = trim_description(f"{root}\n\n{source_line}")
    if normalize_text(candidate) not in used_descriptions:
        return candidate

    candidate = trim_description(f"{root}\n\n{source_line}\nVideo ID: {video_id}")
    if normalize_text(candidate) not in used_descriptions:
        return candidate

    counter = 2
    while True:
        candidate = trim_description(f"{root}\n\n{source_line}\nVariant: {counter}")
        if normalize_text(candidate) not in used_descriptions:
            return candidate
        counter += 1


def find_duplicate_targets(
    entries: List[Dict[str, Any]],
    snippets: Dict[str, Dict[str, Any]],
    keep_first: bool,
) -> List[Dict[str, Any]]:
    by_title: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    by_description: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for entry in entries:
        snippet = snippets.get(entry["video_id"])
        if not snippet:
            continue
        by_title[normalize_text(str(snippet.get("title", "")))].append(entry)
        by_description[normalize_text(str(snippet.get("description", "")))].append(entry)

    targets_by_id: Dict[str, Dict[str, Any]] = {}
    for groups in (by_title, by_description):
        for normalized_text_key, group in groups.items():
            if not normalized_text_key or len(group) < 2:
                continue
            sorted_group = sorted(group, key=lambda item: item["sort_time"])
            start_idx = 1 if keep_first else 0
            for candidate in sorted_group[start_idx:]:
                targets_by_id[candidate["video_id"]] = candidate

    targets = list(targets_by_id.values())
    targets.sort(key=lambda item: item["sort_time"])
    return targets


def update_local_metadata_file(
    metadata_file: Path,
    title: str,
    description: str,
) -> bool:
    payload = load_json_file(metadata_file, default={})
    if not isinstance(payload, dict):
        return False

    metadata = payload.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
        payload["metadata"] = metadata

    metadata["title"] = title
    metadata["description"] = description
    save_json_file(metadata_file, payload)
    return True


def main() -> int:
    args = parse_args()

    state_file = Path(args.state_file).resolve()
    metadata_dir = Path(args.metadata_dir).resolve()
    client_secrets = Path(args.client_secrets).resolve()
    token_file = Path(args.token_file).resolve()

    if not client_secrets.exists():
        print(f"[error] client secrets not found: {client_secrets}")
        return 2
    if not state_file.exists():
        print(f"[error] state file not found: {state_file}")
        return 2

    state_data, entries = load_state_entries(state_file)
    if not entries:
        print("[info] no uploaded videos found in state file.")
        return 0

    youtube = build_youtube_client(client_secrets, token_file, args.auth_port)
    video_ids = [entry["video_id"] for entry in entries]
    snippets = fetch_live_snippets(youtube, video_ids)

    missing = [entry["video_id"] for entry in entries if entry["video_id"] not in snippets]
    if missing:
        print(
            f"[warn] {len(missing)} video IDs from state were not returned by YouTube "
            "(deleted/private/unavailable)."
        )

    if args.mode == "duplicates":
        targets = find_duplicate_targets(entries, snippets, keep_first=args.keep_first)
    else:
        targets = [entry for entry in entries if entry["video_id"] in snippets]
        targets.sort(key=lambda item: item["sort_time"])

    if args.max_updates > 0:
        targets = targets[: args.max_updates]

    if not targets:
        print("[done] no target videos to update.")
        return 0

    print(f"[info] target videos: {len(targets)} (mode={args.mode}, dry_run={args.dry_run})")

    used_titles = {
        normalize_text(str(snippet.get("title", "")))
        for snippet in snippets.values()
        if normalize_text(str(snippet.get("title", "")))
    }
    used_descriptions = {
        normalize_text(str(snippet.get("description", "")))
        for snippet in snippets.values()
        if normalize_text(str(snippet.get("description", "")))
    }

    uploaded_state = state_data.get("uploaded", {})
    updated_count = 0
    failed_count = 0
    local_metadata_updated = 0

    for entry in targets:
        video_id = entry["video_id"]
        snippet = snippets.get(video_id)
        if not snippet:
            continue

        current_title = str(snippet.get("title", "")).strip()
        current_description = str(snippet.get("description", "")).strip()
        marker = extract_clip_marker(entry["relative_path"], video_id)

        new_title = build_unique_title(current_title, marker, video_id, used_titles)
        new_description = build_unique_description(
            current_description,
            marker,
            entry["relative_path"],
            video_id,
            used_descriptions,
        )

        if (
            normalize_text(current_title) == normalize_text(new_title)
            and normalize_text(current_description) == normalize_text(new_description)
        ):
            print(f"[skip] {video_id} already unique after generation.")
            continue

        print(f"[plan] {video_id}")
        print(f"       old title: {current_title}")
        print(f"       new title: {new_title}")

        if args.dry_run:
            used_titles.add(normalize_text(new_title))
            used_descriptions.add(normalize_text(new_description))
            continue

        snippet_update: Dict[str, Any] = {
            "title": new_title,
            "description": new_description,
            "categoryId": str(snippet.get("categoryId", "20")),
        }

        tags = snippet.get("tags")
        if isinstance(tags, list):
            snippet_update["tags"] = [str(tag) for tag in tags if str(tag).strip()]
        default_language = str(snippet.get("defaultLanguage", "")).strip()
        if default_language:
            snippet_update["defaultLanguage"] = default_language
        default_audio_language = str(snippet.get("defaultAudioLanguage", "")).strip()
        if default_audio_language:
            snippet_update["defaultAudioLanguage"] = default_audio_language

        try:
            youtube.videos().update(
                part="snippet",
                body={"id": video_id, "snippet": snippet_update},
            ).execute()
        except HttpError as exc:
            failed_count += 1
            print(f"[error] failed updating {video_id}: {exc}")
            continue

        used_titles.add(normalize_text(new_title))
        used_descriptions.add(normalize_text(new_description))
        updated_count += 1

        if isinstance(uploaded_state, dict):
            state_row = uploaded_state.get(entry["state_key"])
            if isinstance(state_row, dict):
                state_row["title"] = new_title
                state_row["description"] = new_description

        metadata_file_raw = entry["metadata_file"]
        metadata_file = Path(metadata_file_raw) if metadata_file_raw else None
        if metadata_file and not metadata_file.is_absolute():
            metadata_file = (metadata_dir / metadata_file).resolve()
        if not metadata_file:
            rel_stem = Path(entry["relative_path"]).stem
            metadata_file = metadata_dir / f"{rel_stem}.metadata.json"
        if metadata_file.exists():
            if update_local_metadata_file(metadata_file, new_title, new_description):
                local_metadata_updated += 1

        print(f"[ok] updated: https://www.youtube.com/watch?v={video_id}")

    if not args.dry_run:
        save_json_file(state_file, state_data)
        print(f"[done] state updated: {state_file}")
        print(f"[done] local metadata files updated: {local_metadata_updated}")

    print(f"[done] youtube updates succeeded: {updated_count}")
    if failed_count:
        print(f"[done] youtube updates failed: {failed_count}")
    return 0 if failed_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
