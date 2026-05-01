"""Video conversion — shorts formatting, music mixing with caching.

Handles ffmpeg-based video conversion for YouTube Shorts format
and background music overlay with deterministic caching.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from lib.file_utils import delete_file_if_exists
from lib.media_tools import (
    build_converted_path, build_temp_media_output_path, probe_video_info,
    video_has_audio_stream,
)
from lib.music import build_mixed_music_path

_WIN_FLAGS = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


def reuse_valid_cached_video(
    output: Path,
    newest_input_mtime: float,
    ffprobe_bin: str,
    cache_label: str = "",
) -> bool:
    """Check if a cached output is valid — exists, non-empty, newer than source."""
    if not output.exists():
        return False
    try:
        if output.stat().st_size < 1024:
            return False
        if output.stat().st_mtime < newest_input_mtime:
            return False
    except OSError:
        return False
    info = probe_video_info(output, ffprobe_bin)
    if not info or info.get("duration", 0) < 0.5:
        return False
    if cache_label:
        print(f"[cache-hit][{cache_label}] reusing {output.name}")
    return True


def convert_to_shorts(
    source: Path,
    converted_dir: Path,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    shorts_max_seconds: int,
) -> Path:
    """Convert a video to YouTube Shorts format (9:16, 1080x1920, <=60s)."""
    converted_dir.mkdir(parents=True, exist_ok=True)
    output = build_converted_path(source, converted_dir)
    newest_input_mtime = source.stat().st_mtime

    if reuse_valid_cached_video(output, newest_input_mtime, ffprobe_bin, "converted"):
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
            ffmpeg_bin, "-y", "-i", str(source),
            "-vf", filter_graph,
            "-t", str(shorts_max_seconds),
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", "4.1",
            "-r", "30", "-g", "60", "-maxrate", "8M", "-bufsize", "16M",
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
            "-movflags", "+faststart",
            str(temp_output),
        ],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, check=False, creationflags=_WIN_FLAGS,
    )
    if proc.returncode != 0:
        delete_file_if_exists(temp_output)
        tail = "\n".join((proc.stderr or "").splitlines()[-20:])
        raise RuntimeError(f"ffmpeg conversion failed for {source}:\n{tail}")

    converted_info = probe_video_info(temp_output, ffprobe_bin)
    if not converted_info:
        delete_file_if_exists(temp_output)
        raise RuntimeError(f"Converted output invalid: {temp_output}")

    temp_output.replace(output)
    return output


def mix_background_music(
    *,
    source: Path,
    music_path: Path,
    converted_dir: Path,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    bg_volume: float,
    replace_audio: bool = False,
) -> Path:
    """Mix background music into a video with caching.

    When replace_audio=True, the original video audio is completely stripped
    and replaced with the music track at full volume (trending audio mode).
    """
    converted_dir.mkdir(parents=True, exist_ok=True)
    output = build_mixed_music_path(source, music_path, converted_dir, bg_volume, replace_audio)
    newest_input_mtime = max(source.stat().st_mtime, music_path.stat().st_mtime)

    if reuse_valid_cached_video(output, newest_input_mtime, ffprobe_bin, "music-mixed"):
        return output

    temp_output = build_temp_media_output_path(output)
    delete_file_if_exists(temp_output)

    if replace_audio:
        # Strip original audio entirely — use trending track at full volume
        cmd = [
            ffmpeg_bin, "-y",
            "-i", str(source), "-i", str(music_path),
            "-map", "0:v", "-map", "1:a",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart",
            str(temp_output),
        ]
    else:
        has_audio = video_has_audio_stream(source, ffprobe_bin)
        if has_audio:
            filter_complex = (
                f"[1:a]volume={bg_volume}[bg];"
                "[0:a][bg]amix=inputs=2:duration=first:dropout_transition=3[aout]"
            )
            cmd = [
                ffmpeg_bin, "-y",
                "-i", str(source), "-i", str(music_path),
                "-filter_complex", filter_complex,
                "-map", "0:v", "-map", "[aout]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
                "-shortest", "-movflags", "+faststart",
                str(temp_output),
            ]
        else:
            cmd = [
                ffmpeg_bin, "-y",
                "-i", str(source), "-i", str(music_path),
                "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
                "-shortest", "-movflags", "+faststart",
                str(temp_output),
            ]

    proc = subprocess.run(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, check=False, creationflags=_WIN_FLAGS,
    )
    if proc.returncode != 0:
        delete_file_if_exists(temp_output)
        tail = "\n".join((proc.stderr or "").splitlines()[-20:])
        raise RuntimeError(f"ffmpeg music mix failed for {source}:\n{tail}")

    mix_info = probe_video_info(temp_output, ffprobe_bin)
    if not mix_info:
        delete_file_if_exists(temp_output)
        raise RuntimeError(f"Mixed output invalid: {temp_output}")

    temp_output.replace(output)
    return output


def try_mix_background_music(
    *,
    source: Path,
    music_tracks: List[Dict[str, str]],
    track_index: int,
    converted_dir: Path,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    bg_volume: float,
    replace_audio: bool = False,
) -> Tuple[Optional[Path], Optional[Path], List[str]]:
    """Try multiple music tracks, returning (mixed_path, track_path, failures)."""
    if not music_tracks:
        return None, None, ["No music tracks provided."]

    num_tracks = len(music_tracks)
    start_idx = track_index % num_tracks
    music_failures: List[str] = []

    # Attempt to find a working track by iterating through all available tracks
    for offset in range(num_tracks):
        idx = (start_idx + offset) % num_tracks
        track_info = music_tracks[idx]
        music_path = Path(track_info["path"])

        if not music_path.exists():
            music_failures.append(f"Track missing: {music_path}")
            continue

        try:
            mixed_path = mix_background_music(
                source=source,
                music_path=music_path,
                converted_dir=converted_dir,
                ffmpeg_bin=ffmpeg_bin,
                ffprobe_bin=ffprobe_bin,
                bg_volume=bg_volume,
                replace_audio=replace_audio,
            )
            # Success!
            return mixed_path, music_path, music_failures
        except Exception as exc:
            music_failures.append(f"{music_path.name}: {exc}")

    return None, None, music_failures
