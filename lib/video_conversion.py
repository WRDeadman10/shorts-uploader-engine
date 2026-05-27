"""Video conversion — shorts formatting, music mixing with caching.

Handles ffmpeg-based video conversion for YouTube Shorts format
and background music overlay with deterministic caching.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
import time
import re
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from lib.file_utils import delete_file_if_exists
from lib.media_tools import (
    build_converted_path, build_temp_media_output_path, probe_video_info,
    video_has_audio_stream,
)
from lib.music import build_mixed_music_path

_WIN_FLAGS = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

_VIDEO_ENCODER_ARGS_CACHE: Dict[str, List[str]] = {}

def _parse_ffmpeg_timecode_seconds(raw: str) -> Optional[float]:
    try:
        hh, mm, ss = raw.strip().split(":")
        return int(hh) * 3600 + int(mm) * 60 + float(ss)
    except (TypeError, ValueError):
        return None


def run_ffmpeg_with_progress(
    *,
    cmd: List[str],
    step_label: str,
    total_seconds: Optional[float] = None,
) -> Tuple[int, str, str]:
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    stderr_lines: List[str] = []
    stdout_text = ""
    last_progress_print_at = time.time()
    last_percent_printed = -1
    last_heartbeat_print_at = time.time()

    assert proc.stderr is not None
    for raw_line in proc.stderr:
        line = raw_line.rstrip("\n")
        stderr_lines.append(line)
        match = re.search(r"time=([0-9:.]+)", line)
        if match and total_seconds and total_seconds > 0:
            elapsed = _parse_ffmpeg_timecode_seconds(match.group(1))
            if elapsed is not None:
                percent = int(max(0.0, min(100.0, (elapsed / total_seconds) * 100.0)))
                now = time.time()
                if percent >= last_percent_printed + 5 or now - last_progress_print_at >= 15:
                    print(f"[progress][{step_label}] {percent}% ({elapsed:.1f}s/{total_seconds:.1f}s)")
                    last_percent_printed = percent
                    last_progress_print_at = now
                    last_heartbeat_print_at = now
        else:
            now = time.time()
            if now - last_heartbeat_print_at >= 30:
                print(f"[progress][{step_label}] still running...")
                last_heartbeat_print_at = now

    if proc.stdout is not None:
        stdout_text = proc.stdout.read()
    returncode = proc.wait()
    stderr_text = "\n".join(stderr_lines)
    return returncode, stdout_text, stderr_text


def build_max_quality_video_encode_args(ffmpeg_bin: str) -> List[str]:
    cached = _VIDEO_ENCODER_ARGS_CACHE.get(ffmpeg_bin)
    if cached is not None:
        return list(cached)

    encoder_args: List[str]
    try:
        proc = subprocess.run(
            [ffmpeg_bin, "-hide_banner", "-encoders"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        encoders_blob = f"{proc.stdout}\n{proc.stderr}".lower()
    except OSError:
        encoders_blob = ""

    if "h264_nvenc" in encoders_blob:
        encoder_args = [
            "-c:v", "h264_nvenc",
            "-preset", "p7",
            "-tune", "hq",
            "-rc", "constqp",
            "-qp", "0",
            "-b:v", "0",
            "-profile:v", "high",
            "-pix_fmt", "yuv420p",
        ]
        print("[info] ffmpeg video encoder: h264_nvenc (GPU, max-quality mode)")
    else:
        encoder_args = [
            "-c:v", "libx264",
            "-preset", "slow",
            "-crf", "14",
            "-tune", "grain",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
            "-level:v", "5.1",
        ]
        print("[info] ffmpeg video encoder: libx264 (CPU fallback)")

    _VIDEO_ENCODER_ARGS_CACHE[ffmpeg_bin] = encoder_args
    return list(encoder_args)

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

def combine_videos_up_to_target(
    *,
    sources: List[Path],
    output: Path,
    ffmpeg_bin: str,
    ffprobe_bin: str,
) -> Path:
    """Concatenate multiple source videos into one output clip."""
    output.parent.mkdir(parents=True, exist_ok=True)
    newest_input_mtime = max(src.stat().st_mtime for src in sources)
    if reuse_valid_cached_video(
        output=output,
        newest_input_mtime=newest_input_mtime,
        ffprobe_bin=ffprobe_bin,
        cache_label="combined",
    ):
        return output

    total_seconds = 0.0
    for src in sources:
        info = probe_video_info(src, ffprobe_bin)
        if info:
            total_seconds += float(info.get("duration", 0.0))

    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as concat_file:
        concat_path = Path(concat_file.name)
        for src in sources:
            normalized = str(src.resolve()).replace("\\", "/").replace("'", "'\\''")
            concat_file.write(f"file '{normalized}'\n")

    temp_output = build_temp_media_output_path(output)
    delete_file_if_exists(temp_output)
    try:
        video_encode_args = build_max_quality_video_encode_args(ffmpeg_bin)
        cmd = [
                ffmpeg_bin,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_path),
                *video_encode_args,
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
                str(temp_output),
            ]
        rc, _out, err = run_ffmpeg_with_progress(
            cmd=cmd,
            step_label="combine",
            total_seconds=total_seconds if total_seconds > 0 else None,
        )
        if rc != 0:
            tail = "\n".join((err or "").splitlines()[-20:])
            raise RuntimeError(f"ffmpeg concat failed:\n{tail}")
        info = probe_video_info(temp_output, ffprobe_bin)
        if not info:
            raise RuntimeError("combined output is invalid or unreadable")
        temp_output.replace(output)
        return output
    finally:
        delete_file_if_exists(concat_path)
        if temp_output.exists():
            try:
                if temp_output != output:
                    temp_output.unlink()
            except OSError:
                pass


def trim_video_head(
    *,
    source: Path,
    output: Path,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    trim_seconds: float = 10.0,
) -> Path:
    """Trim the first N seconds from a video file."""
    output.parent.mkdir(parents=True, exist_ok=True)
    source_info = probe_video_info(source, ffprobe_bin)
    if not source_info:
        raise RuntimeError(f"could not inspect source for trim: {source}")
    source_duration = float(source_info["duration"])
    if source_duration <= trim_seconds:
        raise RuntimeError(f"source too short to trim {trim_seconds:.1f}s: {source_duration:.1f}s")
    newest_input_mtime = source.stat().st_mtime
    if reuse_valid_cached_video(
        output=output,
        newest_input_mtime=newest_input_mtime,
        ffprobe_bin=ffprobe_bin,
        cache_label="trimmed",
    ):
        return output

    temp_output = build_temp_media_output_path(output)
    delete_file_if_exists(temp_output)
    try:
        video_encode_args = build_max_quality_video_encode_args(ffmpeg_bin)
        cmd = [
                ffmpeg_bin,
                "-y",
                "-ss",
                f"{trim_seconds:.3f}",
                "-i",
                str(source),
                *video_encode_args,
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
                str(temp_output),
            ]
        rc, _out, err = run_ffmpeg_with_progress(
            cmd=cmd,
            step_label="trim",
            total_seconds=max(source_duration - trim_seconds, 1.0),
        )
        if rc != 0:
            tail = "\n".join((err or "").splitlines()[-20:])
            raise RuntimeError(f"ffmpeg trim failed:\n{tail}")
        info = probe_video_info(temp_output, ffprobe_bin)
        if not info:
            raise RuntimeError("trimmed output is invalid or unreadable")
        temp_output.replace(output)
        return output
    finally:
        if temp_output.exists():
            try:
                if temp_output != output:
                    temp_output.unlink()
            except OSError:
                pass


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
