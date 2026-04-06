"""Generate a JSON report for local videos and per-platform upload coverage."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Set

from lib.file_utils import (
    load_json_file,
    normalize_extensions,
    normalize_names_csv,
    discover_videos,
    file_key,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a JSON report of total videos and per-platform upload counts."
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Root directory to recursively scan for source videos.",
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
        "--youtube-state-file",
        default=".youtube_upload_state.json",
        help="Path to the YouTube upload state file.",
    )
    parser.add_argument(
        "--meta-state-file",
        default=".meta_reels_upload_state.json",
        help="Path to the Meta reels upload state file.",
    )
    parser.add_argument(
        "--output-file",
        default="upload_status_report.json",
        help="Path to the JSON report file to create.",
    )
    return parser.parse_args()


# normalize_extensions, normalize_names_csv, discover_videos, file_key,
# load_json_file — now imported from lib/file_utils


def ensure_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def count_meta_platform_uploads(
    reels_entries: Dict[str, Any],
    known_keys: Set[str],
    platform_name: str,
) -> int:
    uploaded_count: int = 0
    for state_key, row in reels_entries.items():
        if state_key not in known_keys:
            continue
        row_dict = ensure_dict(row)
        platform_row = ensure_dict(row_dict.get(platform_name))
        status = str(platform_row.get("status", "")).strip().lower()
        if status == "ok":
            uploaded_count += 1
    return uploaded_count


def build_report(
    total_videos: int,
    youtube_uploaded: int,
    facebook_uploaded: int,
    instagram_uploaded: int,
    root: Path,
    youtube_state_file: Path,
    meta_state_file: Path,
) -> Dict[str, Any]:
    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "root_directory": str(root),
        "total_videos": total_videos,
        "youtube_state_file": str(youtube_state_file),
        "meta_state_file": str(meta_state_file),
        "platforms": {
            "youtube": {
                "uploaded": youtube_uploaded,
                "not_uploaded": total_videos - youtube_uploaded,
            },
            "facebook": {
                "uploaded": facebook_uploaded,
                "not_uploaded": total_videos - facebook_uploaded,
            },
            "instagram": {
                "uploaded": instagram_uploaded,
                "not_uploaded": total_videos - instagram_uploaded,
            },
        },
    }


def main() -> int:
    args = parse_args()

    root = Path(args.root).resolve()
    youtube_state_file = Path(args.youtube_state_file).resolve()
    meta_state_file = Path(args.meta_state_file).resolve()
    output_file = Path(args.output_file).resolve()

    extensions = normalize_extensions(args.extensions)
    exclude_dirs = normalize_names_csv(args.exclude_dirs)
    exclude_files = normalize_names_csv(args.exclude_files)

    videos = discover_videos(root, extensions, exclude_dirs, exclude_files)
    known_keys: Set[str] = set()
    for video_path in videos:
        known_keys.add(file_key(root, video_path))

    youtube_state = load_json_file(youtube_state_file, default={"uploaded": {}})
    youtube_uploaded_entries = ensure_dict(ensure_dict(youtube_state).get("uploaded"))
    youtube_uploaded = 0
    for state_key in youtube_uploaded_entries.keys():
        if state_key in known_keys:
            youtube_uploaded += 1

    meta_state = load_json_file(meta_state_file, default={"entries": {}})
    reels_entries = ensure_dict(ensure_dict(meta_state).get("entries"))
    facebook_uploaded = count_meta_platform_uploads(reels_entries, known_keys, "facebook")
    instagram_uploaded = count_meta_platform_uploads(reels_entries, known_keys, "instagram")

    report = build_report(
        total_videos=len(videos),
        youtube_uploaded=youtube_uploaded,
        facebook_uploaded=facebook_uploaded,
        instagram_uploaded=instagram_uploaded,
        root=root,
        youtube_state_file=youtube_state_file,
        meta_state_file=meta_state_file,
    )

    output_file.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\n[done] report file: {output_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
