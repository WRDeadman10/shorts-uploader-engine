"""Media tool utilities — ffmpeg/ffprobe resolution, video probing, conversion.

Used by: youtubeBatchUpload, musicOverlaySample
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_WIN_FLAGS = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


def check_tool_available(bin_name: str) -> bool:
    """Check if a binary is available on PATH or as an absolute path."""
    if Path(bin_name).is_absolute():
        return Path(bin_name).exists()
    return shutil.which(bin_name) is not None


def resolve_media_tool(bin_name: str) -> Optional[str]:
    """Resolve a media tool binary path. Returns None if not found."""
    if Path(bin_name).is_absolute():
        return str(bin_name) if Path(bin_name).exists() else None
    resolved = shutil.which(bin_name)
    if resolved:
        return resolved
    # Try common Windows locations
    if sys.platform == "win32":
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


_FFPROBE_CACHE_FILE = Path(".ffprobe_cache.json")
_ffprobe_cache: Dict[str, Dict[str, Any]] = {}
_cache_loaded = False

def _load_ffprobe_cache() -> None:
    global _cache_loaded, _ffprobe_cache
    if _cache_loaded:
        return
    if _FFPROBE_CACHE_FILE.exists():
        try:
            with open(_FFPROBE_CACHE_FILE, "r", encoding="utf-8") as f:
                _ffprobe_cache = json.load(f)
        except Exception:
            _ffprobe_cache = {}
    else:
        _ffprobe_cache = {}
    _cache_loaded = True

def _save_ffprobe_cache() -> None:
    try:
        with open(_FFPROBE_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_ffprobe_cache, f, indent=2)
    except Exception:
        pass


def probe_video_info(file_path: Path, ffprobe_bin: str) -> Optional[Dict[str, float]]:
    """Get video duration and dimensions using ffprobe."""
    _load_ffprobe_cache()
    resolved_path = Path(file_path).resolve()
    key = resolved_path.as_posix()
    
    try:
        mtime = resolved_path.stat().st_mtime
    except OSError:
        mtime = 0.0

    if key in _ffprobe_cache:
        cached = _ffprobe_cache[key]
        if cached.get("mtime") == mtime and "info" in cached:
            return cached["info"]

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

        info = {"duration": duration, "width": width, "height": height}
        _ffprobe_cache[key] = {"mtime": mtime, "info": info}
        _save_ffprobe_cache()
        return info
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
