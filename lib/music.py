"""Music overlay utilities — inventory, mixing, background music management.

Used by: youtubeBatchUpload, musicOverlaySample
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional

from lib.file_utils import delete_file_if_exists
from lib.media_tools import video_has_audio_stream, build_temp_media_output_path, probe_video_info

_WIN_FLAGS = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


def build_music_inventory(music_dir: Path) -> List[Dict[str, str]]:
    """Scan a directory for .mp3 files and return an inventory list."""
    tracks: List[Dict[str, str]] = []
    for path in sorted(music_dir.rglob("*.mp3")):
        tracks.append({
            "name": path.name,
            "path": str(path.resolve()),
        })
    return tracks


def build_mixed_music_path(
    source: Path,
    music_path: Path,
    converted_dir: Path,
    bg_volume: float,
    replace_audio: bool = False,
) -> Path:
    """Generate a deterministic output path for a music-mixed video."""
    profile = "bgmixv1"
    mode = "replace" if replace_audio else f"{bg_volume:.3f}"
    digest = hashlib.sha1(
        f"{source.resolve()}|{music_path.resolve()}|{mode}|{profile}".encode("utf-8")
    ).hexdigest()[:10]
    safe_stem = re.sub(r"[^a-zA-Z0-9._-]", "_", source.stem)[:80]
    return converted_dir / f"{safe_stem}.{digest}.{profile}.mp4"


def reuse_valid_cached_video(
    output_path: Path,
    source_path: Path,
    ffprobe_bin: str,
    min_duration: float = 1.0,
) -> bool:
    """Check if a cached output video is still valid and can be reused."""
    if not output_path.exists():
        return False
    try:
        if output_path.stat().st_size < 1024:
            return False
        if output_path.stat().st_mtime < source_path.stat().st_mtime:
            return False
    except OSError:
        return False
    info = probe_video_info(output_path, ffprobe_bin)
    if not info or info.get("duration", 0) < min_duration:
        return False
    return True


def mix_background_music(
    *,
    source: Path,
    music_path: Path,
    converted_dir: Path,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    bg_volume: float,
) -> Path:
    """Mix background music into a video, preserving original audio if present.

    Returns the path to the mixed output file.
    """
    converted_dir.mkdir(parents=True, exist_ok=True)
    output = build_mixed_music_path(source, music_path, converted_dir, bg_volume)

    if reuse_valid_cached_video(output, source, ffprobe_bin):
        return output

    tmp_output = build_temp_media_output_path(output)
    has_audio = video_has_audio_stream(source, ffprobe_bin)

    if has_audio:
        # Mix: keep original audio + add background music at bg_volume
        cmd = [
            ffmpeg_bin, "-y",
            "-i", str(source),
            "-i", str(music_path),
            "-filter_complex",
            f"[1:a]volume={bg_volume}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=3[out]",
            "-map", "0:v",
            "-map", "[out]",
            "-c:v", "copy",
            "-shortest",
            str(tmp_output),
        ]
    else:
        # No original audio — use music track directly
        cmd = [
            ffmpeg_bin, "-y",
            "-i", str(source),
            "-i", str(music_path),
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "copy",
            "-shortest",
            str(tmp_output),
        ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
            creationflags=_WIN_FLAGS,
        )
        if result.returncode != 0:
            delete_file_if_exists(tmp_output)
            raise RuntimeError(f"ffmpeg failed: {result.stderr[:300]}")

        # Rename temp → final
        delete_file_if_exists(output)
        tmp_output.rename(output)
        return output

    except subprocess.TimeoutExpired:
        delete_file_if_exists(tmp_output)
        raise RuntimeError(f"ffmpeg timed out processing {source.name}")
