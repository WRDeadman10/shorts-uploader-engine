from __future__ import annotations

import argparse
import json
import random
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build an MP3 inventory and create a sample video with background music mixed under the original audio."
    )
    parser.add_argument(
        "--music-dir",
        required=True,
        help="Directory containing MP3 files.",
    )
    parser.add_argument(
        "--inventory-output",
        default="hollywood_music_inventory.json",
        help="Path to save the generated music inventory JSON.",
    )
    parser.add_argument(
        "--sample-video",
        default="",
        help="Optional explicit video path for the sample output.",
    )
    parser.add_argument(
        "--sample-music",
        default="",
        help="Optional explicit MP3 path for the sample output.",
    )
    parser.add_argument(
        "--sample-output",
        default="sample_video_with_music.mp4",
        help="Path to write the mixed sample video.",
    )
    parser.add_argument(
        "--youtube-state-file",
        default=".youtube_upload_state.json",
        help="YouTube upload state file used to auto-pick an existing converted sample video.",
    )
    parser.add_argument(
        "--ffprobe-bin",
        default="ffprobe",
        help="Path to ffprobe binary.",
    )
    parser.add_argument(
        "--ffmpeg-bin",
        default="ffmpeg",
        help="Path to ffmpeg binary.",
    )
    parser.add_argument(
        "--bg-volume",
        type=float,
        default=0.18,
        help="Relative weight/volume for the background music layer.",
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


def build_music_inventory(music_dir: Path) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    for path in sorted(music_dir.rglob("*.mp3")):
        entries.append(
            {
                "name": path.name,
                "path": str(path.resolve()),
            }
        )
    return entries


def pick_sample_video(state_file: Path) -> Optional[Path]:
    payload = load_json_file(state_file, default={"uploaded": {}})
    uploaded = payload.get("uploaded", {})
    if not isinstance(uploaded, dict):
        return None

    script_dir = Path(__file__).resolve().parent
    sibling_videos_root = script_dir.parent / "VALORANT"

    for row in uploaded.values():
        if not isinstance(row, dict):
            continue
        raw = str(row.get("uploaded_file_path", "")).strip()
        if not raw:
            path = None
        else:
            path = Path(raw)
            if path.exists():
                return path

        rel = str(row.get("relative_path", "")).strip()
        if rel:
            candidate = sibling_videos_root / Path(rel)
            if candidate.exists():
                return candidate
    return None


def probe_video(path: Path, ffprobe_bin: str) -> Dict[str, Any]:
    proc = subprocess.run(
        [
            ffprobe_bin,
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            str(path),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {path}:\n{proc.stderr.strip()}")
    try:
        return json.loads(proc.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid ffprobe JSON for {path}") from exc


def get_duration_seconds(probe_payload: Dict[str, Any]) -> float:
    format_obj = probe_payload.get("format", {})
    try:
        return float(format_obj.get("duration", 0.0))
    except (TypeError, ValueError):
        return 0.0


def has_audio_stream(probe_payload: Dict[str, Any]) -> bool:
    streams = probe_payload.get("streams", [])
    if not isinstance(streams, list):
        return False
    return any(isinstance(item, dict) and item.get("codec_type") == "audio" for item in streams)


def build_sample_video(
    *,
    video_path: Path,
    music_path: Path,
    output_path: Path,
    ffmpeg_bin: str,
    ffprobe_bin: str,
    bg_volume: float,
) -> None:
    probe_payload = probe_video(video_path, ffprobe_bin)
    duration = get_duration_seconds(probe_payload)
    if duration <= 0:
        raise RuntimeError(f"Could not determine duration for sample video: {video_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    if has_audio_stream(probe_payload):
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
            str(video_path),
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
            str(output_path),
        ]
    else:
        cmd = [
            ffmpeg_bin,
            "-y",
            "-i",
            str(video_path),
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
            str(output_path),
        ]

    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        tail = "\n".join((proc.stderr or "").splitlines()[-30:])
        raise RuntimeError(f"ffmpeg sample build failed:\n{tail}")


def main() -> int:
    args = parse_args()
    music_dir = Path(args.music_dir).resolve()
    inventory_output = Path(args.inventory_output).resolve()
    youtube_state_file = Path(args.youtube_state_file).resolve()

    if not music_dir.exists():
        print(f"[error] music directory not found: {music_dir}")
        return 2

    inventory = build_music_inventory(music_dir)
    if not inventory:
        print(f"[error] no MP3 files found in: {music_dir}")
        return 2

    inventory_payload = {
        "music_dir": str(music_dir),
        "count": len(inventory),
        "tracks": inventory,
    }
    save_json_file(inventory_output, inventory_payload)
    print(f"[ok] inventory written: {inventory_output}")
    print(f"[ok] mp3 count: {len(inventory)}")

    sample_music = (
        Path(args.sample_music).resolve()
        if args.sample_music.strip()
        else Path(random.choice(inventory)["path"])
    )
    if not sample_music.exists():
        print(f"[error] sample music file not found: {sample_music}")
        return 2

    if args.sample_video.strip():
        sample_video = Path(args.sample_video).resolve()
    else:
        sample_video = pick_sample_video(youtube_state_file) or Path()
    if not sample_video or not sample_video.exists():
        print("[error] could not auto-pick a sample video from the YouTube state file.")
        return 2

    sample_output = Path(args.sample_output).resolve()
    build_sample_video(
        video_path=sample_video,
        music_path=sample_music,
        output_path=sample_output,
        ffmpeg_bin=args.ffmpeg_bin,
        ffprobe_bin=args.ffprobe_bin,
        bg_volume=args.bg_volume,
    )
    print(f"[ok] sample video written: {sample_output}")
    print(f"[ok] sample video source: {sample_video}")
    print(f"[ok] sample music source: {sample_music}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
