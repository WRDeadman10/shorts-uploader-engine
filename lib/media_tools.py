"""Media tool utilities — ffmpeg/ffprobe resolution, video probing, conversion.

Used by: youtubeBatchUpload, musicOverlaySample
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_WIN_FLAGS = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


def check_tool_available(bin_name: str) -> bool:
    """Check if a binary is available and functional by running -version."""
    if Path(bin_name).is_absolute() and not Path(bin_name).exists():
        return False
    try:
        proc = subprocess.run(
            [bin_name, "-version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
            creationflags=_WIN_FLAGS,
        )
        return proc.returncode == 0
    except OSError:
        return False


def resolve_media_tool(bin_name: str) -> Optional[str]:
    """Resolve a media tool binary path. Returns None if not found."""
    if Path(bin_name).is_absolute():
        return str(bin_name) if Path(bin_name).exists() else None
    if check_tool_available(bin_name):
        return bin_name
    resolved = shutil.which(bin_name)
    if resolved:
        return resolved
    # Try common Windows locations
    if sys.platform == "win32":
        exe_name = bin_name if bin_name.lower().endswith(".exe") else f"{bin_name}.exe"
        # WinGet FFmpeg installation path
        local_appdata = os.getenv("LOCALAPPDATA")
        if local_appdata:
            candidate_root = Path(local_appdata) / "Microsoft" / "WinGet" / "Packages"
            if candidate_root.exists():
                for match in candidate_root.rglob(exe_name):
                    if match.is_file():
                        return str(match)
        for candidate in [
            Path("C:/ffmpeg/bin") / bin_name,
            Path.home() / "ffmpeg" / "bin" / bin_name,
        ]:
            if candidate.exists():
                return str(candidate)
            with_ext = candidate.with_suffix(".exe")
            if with_ext.exists():
                return str(with_ext)
    return None


def probe_video_info(file_path: Path, ffprobe_bin: str) -> Optional[Dict[str, float]]:
    """Get video duration and dimensions using ffprobe."""
    try:
        result = subprocess.run(
            [
                ffprobe_bin,
                "-v", "quiet",
                "-print_format", "json",
                "-show_streams",
                "-show_format",
                str(file_path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
            creationflags=_WIN_FLAGS,
        )
        if result.returncode != 0:
            return None

        data = json.loads(result.stdout)
        fmt = data.get("format", {})
        duration = float(fmt.get("duration", 0))

        width = 0
        height = 0
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                width = int(stream.get("width", 0))
                height = int(stream.get("height", 0))
                break

        return {"duration": duration, "width": width, "height": height}
    except Exception:
        return None


def video_has_audio_stream(file_path: Path, ffprobe_bin: str) -> bool:
    """Check if a video file has an audio stream."""
    try:
        result = subprocess.run(
            [
                ffprobe_bin,
                "-v", "quiet",
                "-select_streams", "a",
                "-show_entries", "stream=codec_type",
                "-of", "csv=p=0",
                str(file_path),
            ],
            capture_output=True,
            text=True,
            timeout=15,
            creationflags=_WIN_FLAGS,
        )
        return bool(result.stdout.strip())
    except Exception:
        return False


def is_shorts_eligible(
    source_info: dict, max_duration: float = 60.0
) -> Tuple[bool, List[str]]:
    """Check if a video is eligible for Shorts (vertical, < 60s)."""
    reasons: List[str] = []
    duration = source_info.get("duration", 0)
    width = int(source_info.get("width", 0))
    height = int(source_info.get("height", 0))

    if duration <= 0 or duration > max_duration:
        reasons.append("duration exceeds max")
    if height <= 0:
        reasons.append("invalid height")
    elif not (height >= width):
        reasons.append("not portrait or square orientation")

    return (len(reasons) == 0, reasons)


def build_converted_path(source: Path, converted_dir: Path) -> Path:
    """Generate the output path for a converted video."""
    return converted_dir / f"{source.stem}_shorts{source.suffix}"


def build_temp_media_output_path(output: Path) -> Path:
    """Generate a temporary output path for media processing."""
    return output.with_name(f".tmp_{output.name}")
