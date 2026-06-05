"""Shared file I/O utilities — JSON read/write, file discovery, key generation.

Used by: youtubeBatchUpload, metaBatchReelsUpload, generateLiveUploadAudit,
         generateUploadStatusReport, musicOverlaySample, rebuildUploadComparison,
         youtubeFixRepeatedMetadata
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, List, Optional


def load_json_file(path: Path, default: Any = None) -> Any:
    """Read and parse a JSON file. Returns default if missing or invalid."""
    if default is None:
        default = {}
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def save_json_file(path: Path, data: Any) -> None:
    """Write data as formatted JSON. Creates parent directories if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    try:
        temp_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        temp_path.replace(path)
    finally:
        delete_file_if_exists(temp_path)


def normalize_extensions(raw_extensions: str) -> set[str]:
    """Parse comma-separated extensions into a normalized set (e.g., '.mp4')."""
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
    """Parse comma-separated names into a lowercase set."""
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
    """Walk a directory tree and find video files matching extension filters."""
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
    """Generate a unique key for a file based on path + size + mtime."""
    stat = file_path.stat()
    rel = file_path.relative_to(root).as_posix()
    return f"{rel}|{stat.st_size}|{int(stat.st_mtime)}"


def delete_file_if_exists(file_path: Path) -> None:
    """Delete a file if it exists, ignore errors."""
    try:
        if file_path.exists():
            file_path.unlink()
    except OSError:
        pass


def get_default_video_root() -> str:
    """Return the default video root from environment or current directory."""
    return os.environ.get("VIDEOS_ROOT", str(Path.cwd()))
