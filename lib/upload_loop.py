import argparse
import time
import sys
import os
import re
import subprocess
import random
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from lib.file_utils import *
from lib.ledger import *
from lib.media_tools import *
from lib.music import *
from lib.youtube_auth import build_youtube_client
from lib.youtube_upload import *
from lib.ai_metadata import *
from lib.meta_api import *
from lib.video_conversion import *
from lib.text_utils import *
from lib.crosspost import crosspost_meta_reel
from lib.schedule import *
from metaBatchReelsUpload import ensure_meta_state_shape
from lib.meta_api import platform_enabled as meta_platform_enabled
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    import requests as meta_requests
except ImportError:
    meta_requests = None

def prepare_trending_music(report_path: Path, cache_dir: Path, max_tracks: int) -> Optional[Path]:
    """Download top audio tracks from trending_audio_report.json via yt-dlp.

    Returns the cache directory path if at least one track was downloaded, else None.
    Skips URLs already cached (file with matching safe-title exists).
    """
    from lib.file_utils import load_json_file

    report = load_json_file(report_path, default={})
    urls: List[Tuple[str, str]] = []  # (url, title)

    yt_section = report.get("youtube") or {}
    for t in (yt_section.get("tracks") or [])[:max_tracks]:
        if t.get("url"):
            urls.append((t["url"], t.get("title", "track")))

    ig_section = report.get("instagram") or {}
    remaining = max_tracks - len(urls)
    for t in (ig_section.get("tracks") or [])[:remaining]:
        if t.get("reel_url"):
            urls.append((t["reel_url"], t.get("title", "track")))

    if not urls:
        print(f"[warn][trending] No URLs found in {report_path}")
        return None

    cache_dir.mkdir(parents=True, exist_ok=True)
    downloaded = 0

    ytdlp_commands = [
        ["yt-dlp"],
        [sys.executable, "-m", "yt_dlp"],
    ]

    for url, title in urls[:max_tracks]:
        safe = re.sub(r"[^\w\-]", "_", title)[:40].strip("_") or "track"
        # Skip if already cached
        existing = list(cache_dir.glob(f"{safe}.*"))
        if existing:
            print(f"[info][trending] cached: {existing[0].name}")
            downloaded += 1
            continue

        output_tmpl = str(cache_dir / f"{safe}.%(ext)s")
        success = False
        saw_missing_command = False

        for base_command in ytdlp_commands:
            try:
                result = subprocess.run(
                    base_command + [
                        "-x",
                        "--audio-format", "mp3",
                        "--audio-quality", "0",
                        "--no-playlist",
                        "-o", output_tmpl,
                        url,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
                if result.returncode == 0:
                    downloaded += 1
                    success = True
                    print(f"[info][trending] downloaded: {safe}.mp3")
                    break

                err = result.stderr.strip().splitlines()[-1] if result.stderr.strip() else "unknown"
                print(f"[warn][trending] yt-dlp failed for {url}: {err}")
                break
            except FileNotFoundError:
                saw_missing_command = True
                continue
            except subprocess.TimeoutExpired:
                print(f"[warn][trending] yt-dlp timed out for {url}")
                break

        if not success and saw_missing_command:
            print(
                "[error][trending] yt-dlp not found in PATH and not importable via python -m yt_dlp. "
                "Install with: pip install -r requirements.txt"
            )
            break

    if downloaded == 0:
        print("[warn][trending] No tracks downloaded — music overlay disabled.")
        return None

    print(f"[info][trending] {downloaded}/{len(urls)} tracks ready in {cache_dir}")
    return cache_dir




def main(args) -> int:
    import os, sys
    
    target_platform = args.upload_platform
    if target_platform == "instagram":
        args.shorts_max_seconds = 85
    root = Path(args.root).resolve()
    client_secrets = Path(args.client_secrets).resolve()
    token_file = Path(args.token_file).resolve()
    state_file = Path(args.state_file).resolve()
    youtube_upload_ledger_file = Path(args.youtube_upload_ledger_file).resolve()
    instagram_upload_ledger_file = Path(args.instagram_upload_ledger_file).resolve()
    facebook_upload_ledger_file = Path(args.facebook_upload_ledger_file).resolve()
    metadata_dir = Path(args.metadata_dir).resolve()
    metadata_history_file = Path(args.metadata_history_file).resolve()
    converted_dir = Path(args.converted_dir).resolve()
    meta_reels_state_file = Path(args.meta_reels_state_file).resolve()
    schedule_progress_file = Path(args.schedule_progress_file).resolve()
    music_dir = Path(args.music_dir).resolve() if args.music_dir.strip() else None
    music_inventory_file = Path(args.music_inventory_file).resolve()

    if args.trending_audio_report.strip() and args.use_trending_audio:
        if args.use_trending_audio and not args.trending_audio_report.strip():
            print("[error] --use-trending-audio requires --trending-audio-report.")
            return 1
        report_path = Path(args.trending_audio_report).resolve()
        if not report_path.exists():
            print(f"[error] trending audio report not found: {report_path}")
            return 1
        print(f"[info] Preparing trending music from {report_path}…")
        trending_dir = prepare_trending_music(
            report_path=report_path,
            cache_dir=Path(args.trending_audio_cache_dir).resolve(),
            max_tracks=args.trending_audio_max,
        )
        if trending_dir:
            if target_platform == "youtube" and args.use_trending_audio:
                music_dir = trending_dir
                print(f"[info] music_dir overridden → {music_dir}")
        elif args.use_trending_audio:
            print(
                "[error] Trending audio mode is enabled but no usable tracks were prepared. "
                "Check yt-dlp, the report URLs, or the cache directory."
            )
            return 1

    if not root.exists():
        print(f"[error] root path not found: {root}")
        return 1
    if target_platform == "youtube" and not args.dry_run and not client_secrets.exists():
        print(f"[error] client secrets file not found: {client_secrets}")
        return 1

    extensions = normalize_extensions(args.extensions)
    exclude_dirs = normalize_names_csv(args.exclude_dirs)
    exclude_files = normalize_names_csv(args.exclude_files)
    videos = discover_videos(root, extensions, exclude_dirs, exclude_files)
    if not videos:
        print(f"[info] no videos found under: {root}")
        return 0

    state = load_json_file(state_file, default={"uploaded": {}})
    uploaded_state: Dict[str, Any] = state.get("uploaded", {})
    youtube_upload_ledger = ensure_platform_upload_ledger_shape(
        load_json_file(youtube_upload_ledger_file, default={"entries": {}})
    )
    instagram_upload_ledger = ensure_platform_upload_ledger_shape(
        load_json_file(instagram_upload_ledger_file, default={"entries": {}})
    )
    facebook_upload_ledger = ensure_platform_upload_ledger_shape(
        load_json_file(facebook_upload_ledger_file, default={"entries": {}})
    )
    try:
        required_uploaded_platforms = normalize_platform_names_csv(args.require_uploaded_on)
        required_missing_platforms = normalize_platform_names_csv(args.require_missing_on)
    except ValueError as exc:
        print(f"[error] {exc}")
        return 2

    if not required_uploaded_platforms and not required_missing_platforms:
        required_missing_platforms = ["youtube", "instagram", "facebook"]

    if target_platform not in required_missing_platforms:
        required_missing_platforms.append(target_platform)

    metadata_history = load_json_file(
        metadata_history_file,
        default={"titles": [], "descriptions": []},
    )
    history_titles = [
        str(x) for x in metadata_history.get("titles", [])
        if isinstance(x, str) and x.strip()
    ]
    history_descriptions = [
        str(x) for x in metadata_history.get("descriptions", [])
        if isinstance(x, str) and x.strip()
    ]
    meta_crosspost_enabled = bool(args.crosspost_meta and target_platform == "youtube")
    meta_upload_enabled = meta_crosspost_enabled or target_platform in {"instagram", "facebook"}
    meta_reels_state = ensure_meta_state_shape({"entries": {}})
    facebook_blocked_for_run = {"blocked": False}
    music_inventory: List[Dict[str, str]] = []
    music_enabled = bool(music_dir)
    if meta_upload_enabled:
        if meta_requests is None:
            print("[error] Meta cross-posting requires requests. Run: pip install -r requirements.txt")
            return 2
        if not clean_text(args.meta_access_token):
            print("[error] Meta upload is enabled but access token is missing.")
            return 2
        effective_meta_platform = args.meta_platform
        if target_platform in {"instagram", "facebook"}:
            effective_meta_platform = target_platform
        args.meta_platform = effective_meta_platform
        if meta_platform_enabled(args.meta_platform, "instagram") and not clean_text(args.meta_ig_user_id):
            print("[error] Meta upload enabled for Instagram but IG user id is missing.")
            return 2
        if meta_platform_enabled(args.meta_platform, "facebook") and not clean_text(args.meta_facebook_page_id):
            print("[error] Meta upload enabled for Facebook but page id is missing.")
            return 2
        meta_reels_state = ensure_meta_state_shape(
            load_json_file(meta_reels_state_file, default={"entries": {}})
        )
    if music_enabled:
        if not music_dir or not music_dir.exists():
            print(f"[error] music directory not found: {music_dir}")
            return 2
        music_inventory = build_music_inventory(music_dir)
        if not music_inventory:
            print(f"[error] no MP3 files found in music directory: {music_dir}")
            return 2
        save_json_file(
            music_inventory_file,
            {
                "music_dir": str(music_dir),
                "count": len(music_inventory),
                "tracks": music_inventory,
            },
        )

    pending: List[Tuple[Path, str, str, float]] = []
    for video in videos:
        rel = video.relative_to(root).as_posix()
        key = file_key(root, video)
        is_allowed = True

        for platform_name in required_uploaded_platforms:
            if not is_uploaded_on_platform(
                platform_name,
                state_key=key,
                uploaded_state=uploaded_state,
                instagram_upload_ledger=instagram_upload_ledger,
                facebook_upload_ledger=facebook_upload_ledger,
            ):
                is_allowed = False
                break

        if not is_allowed:
            continue

        for platform_name in required_missing_platforms:
            if is_uploaded_on_platform(
                platform_name,
                state_key=key,
                uploaded_state=uploaded_state,
                instagram_upload_ledger=instagram_upload_ledger,
                facebook_upload_ledger=facebook_upload_ledger,
            ):
                is_allowed = False
                break

        if not is_allowed:
            continue

        pending.append((video, rel, key, video.stat().st_mtime))

    pending.sort(key=lambda item: item[1])  # sort by relative path (alphabetical) — matches UI queue order

    if not pending:
        print("[info] nothing to upload (all files already uploaded or filtered).")
        return 0

    extra_keywords = [clean_text(x) for x in args.extra_keywords.split(",") if clean_text(x)]
    ffprobe_bin = args.ffprobe_bin
    ffmpeg_bin = args.ffmpeg_bin

    if args.shorts_policy != "off":
        resolved_ffprobe = resolve_media_tool(args.ffprobe_bin)
        if not resolved_ffprobe:
            print(f"[error] ffprobe not found: {args.ffprobe_bin}")
            return 1
        ffprobe_bin = resolved_ffprobe
        resolved_ffmpeg = resolve_media_tool(args.ffmpeg_bin)
        if args.shorts_policy == "convert" and not resolved_ffmpeg:
            print(f"[error] ffmpeg not found: {args.ffmpeg_bin}")
            return 1
        if resolved_ffmpeg:
            ffmpeg_bin = resolved_ffmpeg
        print(f"[info] ffprobe: {ffprobe_bin}")
        if args.shorts_policy == "convert":
            print(f"[info] ffmpeg: {ffmpeg_bin}")
    use_ai = not args.no_ai and bool(os.getenv("OPENAI_API_KEY"))
    if not args.no_ai and OpenAI is None:
        print("[warn] openai package not installed. Using fallback metadata templates.")
    openai_client: Optional[OpenAI] = OpenAI() if use_ai else None

    if not use_ai:
        print("[warn] AI metadata disabled or OPENAI_API_KEY missing. Using fallback metadata templates.")
        if args.require_ai:
            print("[error] --require-ai is enabled but OpenAI metadata is unavailable.")
            return 1

    youtube = None
    playlist_id: Optional[str] = None
    if target_platform == "youtube" and not args.dry_run:
        youtube = build_youtube_client(client_secrets, token_file, args.auth_port)
        if args.playlist_name.strip():
            try:
                playlist_id = resolve_playlist_id(youtube, args.playlist_name)
                if playlist_id:
                    print(f"[info] playlist resolved: {args.playlist_name} ({playlist_id})")
                else:
                    print(f"[warn] playlist not found: {args.playlist_name}")
            except Exception as exc:  # noqa: BLE001
                print(f"[warn] playlist lookup failed: {exc}")

    metadata_dir.mkdir(parents=True, exist_ok=True)

    print(f"[info] discovered videos: {len(videos)}")
    print(f"[info] queued videos: {len(pending)}")
    print(f"[info] target platform: {target_platform}")
    print(
        f"[info] require uploaded on: "
        f"{', '.join(required_uploaded_platforms) if required_uploaded_platforms else '-'}"
    )
    print(
        f"[info] require missing on: "
        f"{', '.join(required_missing_platforms) if required_missing_platforms else '-'}"
    )
    print(f"[info] dry run: {args.dry_run}")
    if music_enabled:
        print(
            f"[info] background music enabled: tracks={len(music_inventory)} "
            f"| volume={args.music_bg_volume:.3f} | inventory={music_inventory_file}"
        )
    if meta_crosspost_enabled:
        print(
            f"[info] Meta cross-posting enabled: platform={args.meta_platform} "
            f"| state={meta_reels_state_file}"
        )
    elif target_platform in {"instagram", "facebook"}:
        print(
            f"[info] Meta direct upload enabled: platform={args.meta_platform} "
            f"| state={meta_reels_state_file}"
        )

    try:
        schedule_slots = parse_schedule_slots(args.schedule_plan)
    except ValueError as exc:
        print(f"[error] {exc}")
        return 2
    schedule_publish_sequence = expand_schedule_publish_sequence(schedule_slots)
    schedule_signature = build_schedule_signature(
        root=root,
        target_platform=target_platform,
        slots=schedule_slots,
    ) if schedule_publish_sequence else ""
    schedule_publish_index = load_schedule_cursor(
        schedule_progress_file,
        schedule_signature,
        len(schedule_publish_sequence),
    )

    def current_schedule_publish_at() -> Optional[str]:
        if schedule_publish_index < len(schedule_publish_sequence):
            return schedule_publish_sequence[schedule_publish_index]
        return None

    def mark_schedule_slot_consumed() -> None:
        nonlocal schedule_publish_index
        if schedule_publish_index >= len(schedule_publish_sequence):
            return
        schedule_publish_index += 1
        save_schedule_cursor(
            schedule_progress_file,
            signature=schedule_signature,
            next_index=schedule_publish_index,
            total_slots=len(schedule_publish_sequence),
            target_platform=target_platform,
            root=root,
            slots=schedule_slots,
        )

    if schedule_publish_sequence:
        print(
            f"[info] schedule slots: {len(schedule_slots)} "
            f"| capacity={len(schedule_publish_sequence)} "
            f"| next={schedule_publish_index + 1}/{len(schedule_publish_sequence)} "
            f"| progress={schedule_progress_file}"
        )
        if schedule_publish_index > 0:
            print("[info] resuming partially filled schedule instead of starting from slot 1.")

    upload_batches: List[List[Tuple[Path, str, str, float]]] = []
    trim_head_seconds = 10.0
    if target_platform in {"youtube", "instagram", "facebook"}:
        target_seconds = float(args.shorts_max_seconds)
        i = 0
        while i < len(pending):
            first = pending[i]
            first_info = probe_video_info(first[0], ffprobe_bin)
            first_duration = float(first_info["duration"]) if first_info else 0.0
            first_effective_duration = max(0.0, first_duration - trim_head_seconds)
            batch = [first]
            total_duration = first_effective_duration
            if 0 < first_effective_duration < target_seconds:
                j = i + 1
                while j < len(pending):
                    nxt = pending[j]
                    nxt_info = probe_video_info(nxt[0], ffprobe_bin)
                    nxt_duration = float(nxt_info["duration"]) if nxt_info else 0.0
                    nxt_effective_duration = max(0.0, nxt_duration - trim_head_seconds)
                    if nxt_effective_duration <= 0:
                        break
                    if total_duration + nxt_effective_duration > target_seconds:
                        break
                    batch.append(nxt)
                    total_duration += nxt_effective_duration
                    j += 1
                i = j
            else:
                i += 1
            upload_batches.append(batch)
    else:
        upload_batches = [[entry] for entry in pending]

    if args.max_videos > 0:
        upload_batches = upload_batches[: args.max_videos]

    uploaded_count = 0
    skipped_not_shorts = 0
    hit_upload_limit = False
    session_titles: List[str] = []
    session_descriptions: List[str] = []
    skip_full_size_youtube_quota_exceeded = False
    for index, batch_entries in enumerate(upload_batches, start=1):
        original_batch_entries = list(batch_entries)
        video_path, rel_path, key, _ = batch_entries[0]
        print(f"\n[{index}/{len(upload_batches)}] processing: {rel_path}")
        upload_path = video_path
        cleanup_candidates: List[Path] = []
        chosen_music_path: Optional[Path] = None
        metadata_source_path = video_path
        metadata_rel_path = rel_path

        clip_context = build_aggregated_clip_context([entry[0] for entry in original_batch_entries])
        if clip_context:
            print(
                "[meta] sidecar context: "
                f"kills={clip_context.get('kills')}, "
                f"site={clip_context.get('site_name') or '-'}, "
                f"agent={clip_context.get('agent_name') or '-'}"
            )

        fallback = build_fallback_metadata(metadata_source_path, extra_keywords, clip_context)
        metadata: Dict[str, Any] = finalize_metadata(
            fallback,
            fallback,
            instagram_username=args.instagram_username,
        )
        metadata_generated_by_ai = False

        recent_titles_pool = (history_titles + session_titles)[-max(args.ai_uniqueness_window, 1):]
        recent_descriptions_pool = (
            history_descriptions + session_descriptions
        )[-max(args.ai_uniqueness_window, 1):]

        if openai_client:
            ai_success = False
            for attempt in range(1, max(args.ai_metadata_retries, 1) + 1):
                try:
                    metadata_raw = generate_ai_metadata(
                        client=openai_client,
                        model=args.openai_model,
                        file_path=metadata_source_path,
                        rel_path=metadata_rel_path,
                        channel_name=args.channel_name,
                        extra_keywords=extra_keywords,
                        language=args.language,
                        recent_titles=recent_titles_pool[-30:],
                        recent_descriptions=recent_descriptions_pool[-15:],
                        clip_context=clip_context,
                    )
                    candidate = finalize_metadata(
                        metadata_raw,
                        fallback,
                        instagram_username=args.instagram_username,
                    )
                    unique_ok, unique_reason = is_metadata_unique(
                        title=candidate["title"],
                        description=candidate["description"],
                        recent_titles=recent_titles_pool,
                        recent_descriptions=recent_descriptions_pool,
                    )
                    if unique_ok:
                        metadata = candidate
                        ai_success = True
                        metadata_generated_by_ai = True
                        break
                    print(
                        f"[warn] AI metadata attempt {attempt} not unique enough "
                        f"({unique_reason}); retrying."
                    )
                except Exception as exc:  # noqa: BLE001
                    print(f"[warn] AI generation attempt {attempt} failed: {exc}")

            if not ai_success:
                if args.require_ai:
                    print("[error] Could not generate unique AI metadata. Skipping upload for this file.")
                    continue
                print("[warn] falling back to template metadata for this file.")

        metadata_record = {
            "relative_path": metadata_rel_path,
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "metadata": metadata,
        }
        metadata_path = metadata_dir / (metadata_source_path.stem + ".metadata.json")
        save_json_file(metadata_path, metadata_record)

        print(f"[meta] title: {metadata['title']}")
        print(f"[meta] tags: {', '.join(metadata['tags'][:8])}{' ...' if len(metadata['tags']) > 8 else ''}")
        if metadata_generated_by_ai:
            print("[meta] source: OpenAI")
        else:
            print("[meta] source: fallback")

        session_titles.append(metadata["title"])
        session_descriptions.append(metadata["description"])
        session_titles = session_titles[-max(args.ai_uniqueness_window, 1):]
        session_descriptions = session_descriptions[-max(args.ai_uniqueness_window, 1):]

        trimmed_batch_entries: List[Tuple[Path, str, str, float]] = []
        for original_path, original_rel_path, original_key, original_mtime in batch_entries:
            original_info = probe_video_info(original_path, ffprobe_bin)
            original_duration = float(original_info["duration"]) if original_info else 0.0
            if original_duration <= trim_head_seconds:
                print(
                    f"[skip] clip too short after trimming {trim_head_seconds:.0f}s: "
                    f"{original_rel_path} ({original_duration:.1f}s)"
                )
                continue
            trim_digest = hashlib.sha1(
                f"{original_path.resolve()}|trim{int(trim_head_seconds)}".encode("utf-8")
            ).hexdigest()[:10]
            safe_trim_stem = re.sub(r"[^a-zA-Z0-9._-]", "_", original_path.stem)[:80]
            trimmed_path = converted_dir / f"{safe_trim_stem}.{trim_digest}.trim{int(trim_head_seconds)}.mp4"
            try:
                trimmed_video = trim_video_head(
                    source=original_path,
                    output=trimmed_path,
                    ffmpeg_bin=ffmpeg_bin,
                    ffprobe_bin=ffprobe_bin,
                    trim_seconds=trim_head_seconds,
                )
                cleanup_candidates.append(trimmed_video)
                trimmed_batch_entries.append((trimmed_video, original_rel_path, original_key, original_mtime))
            except Exception as exc:  # noqa: BLE001
                print(f"[error] trim failed; skipping clip {original_rel_path}: {exc}")

        if not trimmed_batch_entries:
            print("[warn] no usable clips remained in batch after trimming; skipping batch.")
            continue

        batch_entries = trimmed_batch_entries
        video_path, rel_path, key, _ = batch_entries[0]
        upload_path = video_path

        if len(batch_entries) > 1:
            batch_rel_paths = [entry[1] for entry in batch_entries]
            batch_sources = [entry[0] for entry in batch_entries]
            combined_name = f"{batch_entries[0][0].stem}.batch{len(batch_entries)}.combined.mp4"
            combined_output = converted_dir / combined_name
            try:
                upload_path = combine_videos_up_to_target(
                    sources=batch_sources,
                    output=combined_output,
                    ffmpeg_bin=ffmpeg_bin,
                    ffprobe_bin=ffprobe_bin,
                )
                cleanup_candidates.append(upload_path)
                video_path = upload_path
                rel_path = f"{batch_rel_paths[0]} (+{len(batch_entries)-1} appended)"
                key = batch_entries[0][2]
                print(
                    f"[combine] merged {len(batch_entries)} clips "
                    f"into {upload_path.name} (target <= {int(args.shorts_max_seconds)}s)"
                )
            except Exception as exc:  # noqa: BLE001
                print(f"[error] combine failed; skipping batch starting at {batch_rel_paths[0]}: {exc}")
                continue

        def cleanup_converted_outputs() -> None:
            if not args.delete_converted_after_upload:
                return
            seen_cleanup = set()
            for temp_path in cleanup_candidates:
                temp_path_str = str(temp_path.resolve())
                if temp_path_str in seen_cleanup:
                    continue
                seen_cleanup.add(temp_path_str)
                try:
                    is_converted_temp = False
                    try:
                        temp_path.resolve().relative_to(converted_dir.resolve())
                        is_converted_temp = True
                    except ValueError:
                        is_converted_temp = False

                    if is_converted_temp and temp_path.exists():
                        temp_path.unlink()
                        print(f"[cleanup] deleted converted file: {temp_path.name}")
                except Exception as exc:  # noqa: BLE001
                    print(f"[warn] uploaded but failed to delete converted file: {exc}")

        source_info = probe_video_info(video_path, ffprobe_bin)
        if source_info:
            src_w = int(source_info["width"])
            src_h = int(source_info["height"])
            src_dur = source_info["duration"]
            print(f"[video] source: {src_w}x{src_h}, {src_dur:.1f}s")
        else:
            print("[warn] could not inspect video dimensions/duration with ffprobe.")

        # Track pre-music path as a fallback when music mixing is unavailable.
        pre_music_path = upload_path

        
        _replace_audio = bool(args.use_trending_audio)
        if target_platform == "youtube" and args.use_trending_audio:
            music_track_index = (index - 1)
        else :
            music_track_index = random.randint(0, len(music_inventory) - 1)
            
        mixed_upload_path, chosen_music_path, music_failures = try_mix_background_music(
            source=upload_path,
            music_tracks=music_inventory,
            converted_dir=converted_dir,
            ffmpeg_bin=ffmpeg_bin,
            ffprobe_bin=ffprobe_bin,
            bg_volume=args.music_bg_volume,
            track_index=music_track_index,
            replace_audio=_replace_audio,
        )
        if chosen_music_path:
            upload_path = mixed_upload_path
            if upload_path != video_path:
                cleanup_candidates.append(upload_path)
            if _replace_audio:
                print(f"[audio] original audio replaced with trending track: {chosen_music_path.name}")
            else:
                print(
                    f"[audio] background music mixed: {chosen_music_path.name} "
                    f"(volume={args.music_bg_volume:.3f})"
                )
        else:
            upload_path = pre_music_path
            if music_failures:
                print(
                    "[warn] background music mix failed for all available tracks; "
                    "uploading video without music."
                )
                for failure in music_failures[:3]:
                    print(f"[warn] music attempt failed: {failure}")
                if len(music_failures) > 3:
                    print(
                        f"[warn] additional music failures not shown: "
                        f"{len(music_failures) - 3}"
                    )
            else:
                print("[warn] no usable background music tracks found; uploading video without music.")
                if args.use_trending_audio:
                    print(
                        "[error] Trending audio mode requested a full audio replacement, "
                        "but no track could be applied."
                    )
                    continue

        full_size_upload_path = upload_path
        if args.shorts_policy != "off":
            post_music_info = probe_video_info(upload_path, ffprobe_bin)
            if not post_music_info:
                print("[warn] skipping because Shorts policy requires valid media info.")
                skipped_not_shorts += 1
                continue

            eligible, reasons = is_shorts_eligible(post_music_info, args.shorts_max_seconds)
            if not eligible:
                reason_text = "; ".join(reasons)
                if args.shorts_policy == "strict":
                    print(f"[skip] not Shorts-eligible: {reason_text}")
                    skipped_not_shorts += 1
                    continue
                try:
                    converted_source = upload_path
                    upload_path = convert_to_shorts(
                        source=converted_source,
                        converted_dir=converted_dir,
                        ffmpeg_bin=ffmpeg_bin,
                        ffprobe_bin=ffprobe_bin,
                        shorts_max_seconds=args.shorts_max_seconds,
                    )
                    if upload_path != converted_source:
                        cleanup_candidates.append(upload_path)
                    converted_info = probe_video_info(upload_path, ffprobe_bin)
                    if converted_info:
                        c_w = int(converted_info["width"])
                        c_h = int(converted_info["height"])
                        c_dur = converted_info["duration"]
                        print(
                            f"[video] converted for Shorts: {upload_path.name} "
                            f"({c_w}x{c_h}, {c_dur:.1f}s)"
                        )
                    else:
                        print(f"[video] converted for Shorts: {upload_path.name}")
                except Exception as exc:  # noqa: BLE001
                    print(f"[error] conversion failed; skipping file: {exc}")
                    skipped_not_shorts += 1
                    continue
        if args.full_size_video and full_size_upload_path != upload_path:
            print(f"[video] full-size mode enabled: additional upload source kept: {full_size_upload_path.name}")

        if args.dry_run:
            continue

        if target_platform == "youtube":
            try:
                current_publish_at = current_schedule_publish_at()
                video_id = upload_video(
                    youtube=youtube,
                    file_path=upload_path,
                    metadata=metadata,
                    privacy=args.privacy,
                    category_id=args.category_id,
                    language=args.language,
                    notify_subscribers=args.notify_subscribers,
                    publish_at=current_publish_at,
                )
                uploaded_at_utc = datetime.now(timezone.utc).isoformat()
                for _, batch_rel_path, batch_key, _ in batch_entries:
                    uploaded_state[batch_key] = {
                        "video_id": video_id,
                        "relative_path": batch_rel_path,
                        "uploaded_at_utc": uploaded_at_utc,
                        "title": metadata["title"],
                        "metadata_file": str(metadata_path),
                        "uploaded_file_path": str(upload_path),
                        "background_music_file": str(chosen_music_path) if chosen_music_path else "",
                        "playlist_name": "",
                        "playlist_id": "",
                        "playlist_item_id": "",
                    }
                state["uploaded"] = uploaded_state
                save_json_file(state_file, state)
                for _, batch_rel_path, batch_key, _ in batch_entries:
                    update_platform_upload_ledger(
                        youtube_upload_ledger,
                        state_key=batch_key,
                        status="ok",
                        relative_path=batch_rel_path,
                        source_file=upload_path,
                        metadata_file=metadata_path,
                        title=metadata["title"],
                        platform_id_key="video_id",
                        platform_id_value=video_id,
                        extra_fields={
                            "playlist_name": "",
                            "playlist_id": "",
                            "playlist_item_id": "",
                            "uploaded_file_path": str(upload_path),
                            "background_music_file": str(chosen_music_path) if chosen_music_path else "",
                        },
                    )
                save_json_file(youtube_upload_ledger_file, youtube_upload_ledger)
                mark_schedule_slot_consumed()
                playlist_item_id = ""
                if playlist_id:
                    try:
                        playlist_item_id = add_video_to_playlist(youtube, playlist_id, video_id)
                        for _, _, batch_key, _ in batch_entries:
                            uploaded_state[batch_key]["playlist_name"] = args.playlist_name
                            uploaded_state[batch_key]["playlist_id"] = playlist_id
                            uploaded_state[batch_key]["playlist_item_id"] = playlist_item_id
                        state["uploaded"] = uploaded_state
                        save_json_file(state_file, state)
                        for _, batch_rel_path, batch_key, _ in batch_entries:
                            update_platform_upload_ledger(
                                youtube_upload_ledger,
                                state_key=batch_key,
                                status="ok",
                                relative_path=batch_rel_path,
                                source_file=upload_path,
                                metadata_file=metadata_path,
                                title=metadata["title"],
                                platform_id_key="video_id",
                                platform_id_value=video_id,
                                extra_fields={
                                    "playlist_name": args.playlist_name,
                                    "playlist_id": playlist_id,
                                    "playlist_item_id": playlist_item_id,
                                    "uploaded_file_path": str(upload_path),
                                    "background_music_file": str(chosen_music_path) if chosen_music_path else "",
                                },
                            )
                        save_json_file(youtube_upload_ledger_file, youtube_upload_ledger)
                        print(f"[ok] added to playlist: {args.playlist_name}")
                    except Exception as exc:  # noqa: BLE001
                        print(f"[warn] uploaded but failed to add playlist item: {exc}")
                history_titles.append(metadata["title"])
                history_descriptions.append(metadata["description"])
                metadata_history["titles"] = history_titles[-5000:]
                metadata_history["descriptions"] = history_descriptions[-5000:]
                save_json_file(metadata_history_file, metadata_history)
                uploaded_count += 1
                print(f"[ok] uploaded: https://www.youtube.com/watch?v={video_id}")
                if args.full_size_video and full_size_upload_path != upload_path:
                    if skip_full_size_youtube_quota_exceeded:
                        print("[skip][youtube][full-size] Skipping full-size upload due to YouTube quota exceeded earlier.")
                    else:
                        try:
                            fs_video_id = upload_video(
                                youtube=youtube,
                                file_path=full_size_upload_path,
                                metadata=metadata,
                                privacy=args.privacy,
                                category_id=args.category_id,
                                language=args.language,
                                notify_subscribers=args.notify_subscribers,
                                publish_at=current_publish_at,
                            )
                            for _, _, batch_key, _ in batch_entries:
                                row = uploaded_state.get(batch_key, {})
                                if isinstance(row, dict):
                                    row["full_size_video_id"] = fs_video_id
                                    row["full_size_uploaded_file_path"] = str(full_size_upload_path)
                                ledger_row = youtube_upload_ledger.get("entries", {}).get(batch_key, {})
                                if isinstance(ledger_row, dict):
                                    ledger_row["full_size_video_id"] = fs_video_id
                                    ledger_row["full_size_uploaded_file_path"] = str(full_size_upload_path)
                            save_json_file(state_file, state)
                            save_json_file(youtube_upload_ledger_file, youtube_upload_ledger)
                            print(f"[ok][youtube][full-size] uploaded: https://www.youtube.com/watch?v={fs_video_id}")
                        except Exception as fs_exc:  # noqa: BLE001
                            print(f"[warn][youtube][full-size] {fs_exc}")
                            if "Quota exceeded" in str(fs_exc) or "rateLimitExceeded" in str(fs_exc):
                                print("[warn][youtube][full-size] Quota exceeded detected. Disabling full-size uploads for the rest of this run.")
                                skip_full_size_youtube_quota_exceeded = True
                if meta_crosspost_enabled:
                    _meta_error = crosspost_meta_reel(
                        args=args,
                        reels_state=meta_reels_state,
                        meta_reels_state_file=meta_reels_state_file,
                        instagram_upload_ledger=instagram_upload_ledger,
                        instagram_upload_ledger_file=instagram_upload_ledger_file,
                        facebook_upload_ledger=facebook_upload_ledger,
                        facebook_upload_ledger_file=facebook_upload_ledger_file,
                        state_key=key,
                        rel_path=rel_path,
                        source_file=upload_path,
                        full_size_source_file=full_size_upload_path,
                        metadata=metadata,
                        metadata_path=metadata_path,
                        youtube_video_id=video_id,
                        facebook_blocked_for_run=facebook_blocked_for_run,
                        publish_at=current_publish_at,
                        schedule_instagram=False,
                        schedule_facebook=True,
                    )
                    save_json_file(meta_reels_state_file, meta_reels_state)
                    save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
                    save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)
                    if len(batch_entries) > 1:
                        primary_ig_row = instagram_upload_ledger.get("entries", {}).get(key, {})
                        primary_fb_row = facebook_upload_ledger.get("entries", {}).get(key, {})
                        primary_state_row = meta_reels_state.get("entries", {}).get(key, {})
                        for _, batch_rel_path, batch_key, _ in batch_entries[1:]:
                            if isinstance(primary_ig_row, dict) and primary_ig_row:
                                instagram_upload_ledger["entries"][batch_key] = dict(primary_ig_row)
                                instagram_upload_ledger["entries"][batch_key]["relative_path"] = batch_rel_path
                            if isinstance(primary_fb_row, dict) and primary_fb_row:
                                facebook_upload_ledger["entries"][batch_key] = dict(primary_fb_row)
                                facebook_upload_ledger["entries"][batch_key]["relative_path"] = batch_rel_path
                            if isinstance(primary_state_row, dict) and primary_state_row:
                                meta_reels_state["entries"][batch_key] = dict(primary_state_row)
                                meta_reels_state["entries"][batch_key]["relative_path"] = batch_rel_path
                        save_json_file(meta_reels_state_file, meta_reels_state)
                        save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
                        save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)
                    if _meta_error:
                        if args.continue_on_platform_error:
                            print("[warn] Meta platform error — continuing due to --continue-on-platform-error.")
                        else:
                            print("[fatal] Meta platform error — stopping run.")
                            break
                cleanup_converted_outputs()
            except Exception as exc:  # noqa: BLE001
                reason, reason_message = extract_http_error_reason(exc)
                for _, batch_rel_path, batch_key, _ in batch_entries:
                    update_platform_upload_ledger(
                        youtube_upload_ledger,
                        state_key=batch_key,
                        status="error",
                        relative_path=batch_rel_path,
                        source_file=upload_path,
                        metadata_file=metadata_path,
                        title=metadata["title"],
                        platform_id_key="video_id",
                        platform_id_value="",
                        extra_fields={
                            "uploaded_file_path": str(upload_path),
                            "background_music_file": str(chosen_music_path) if chosen_music_path else "",
                        },
                        error_message=str(exc),
                    )
                save_json_file(youtube_upload_ledger_file, youtube_upload_ledger)
                print(f"[error] upload failed for {rel_path}: {exc}")
                if reason in {"uploadLimitExceeded", "quotaExceeded"}:
                    hit_upload_limit = True
                    if reason_message:
                        print(f"[limit] {reason_message}")
                    print(
                        "[limit] YouTube quota limit reached. "
                        "Stop now and retry after the quota window resets."
                    )
                if meta_crosspost_enabled and args.continue_on_platform_error:
                    print("[warn] YouTube upload failed — trying Meta uploads for this video.")
                    _meta_publish_at = current_schedule_publish_at()
                    _meta_error = crosspost_meta_reel(
                        args=args,
                        reels_state=meta_reels_state,
                        meta_reels_state_file=meta_reels_state_file,
                        instagram_upload_ledger=instagram_upload_ledger,
                        instagram_upload_ledger_file=instagram_upload_ledger_file,
                        facebook_upload_ledger=facebook_upload_ledger,
                        facebook_upload_ledger_file=facebook_upload_ledger_file,
                        state_key=key,
                        rel_path=rel_path,
                        source_file=upload_path,
                        full_size_source_file=full_size_upload_path,
                        metadata=metadata,
                        metadata_path=metadata_path,
                        youtube_video_id="",
                        facebook_blocked_for_run=facebook_blocked_for_run,
                        publish_at=_meta_publish_at,
                        schedule_instagram=False,
                        schedule_facebook=True,
                    )
                    save_json_file(meta_reels_state_file, meta_reels_state)
                    save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
                    save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)
                    if _meta_error:
                        print("[warn] Meta upload also failed for this video.")
                    else:
                        print("[ok] Meta upload succeeded for this video despite YouTube failure.")
                    continue
                if args.continue_on_platform_error:
                    print("[warn] YouTube upload error — continuing due to --continue-on-platform-error.")
                    continue
                print("[fatal] YouTube upload error — stopping run.")
                break
        else:
            _meta_publish_at = current_schedule_publish_at()
            _meta_error = crosspost_meta_reel(
                args=args,
                reels_state=meta_reels_state,
                meta_reels_state_file=meta_reels_state_file,
                instagram_upload_ledger=instagram_upload_ledger,
                instagram_upload_ledger_file=instagram_upload_ledger_file,
                facebook_upload_ledger=facebook_upload_ledger,
                facebook_upload_ledger_file=facebook_upload_ledger_file,
                state_key=key,
                rel_path=rel_path,
                source_file=upload_path,
                full_size_source_file=full_size_upload_path,
                metadata=metadata,
                metadata_path=metadata_path,
                youtube_video_id="",
                facebook_blocked_for_run=facebook_blocked_for_run,
                publish_at=_meta_publish_at,
            )
            save_json_file(meta_reels_state_file, meta_reels_state)
            save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
            save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)
            if _meta_error:
                if len(batch_entries) > 1:
                    primary_ig_error = instagram_upload_ledger.get("entries", {}).get(key, {})
                    primary_fb_error = facebook_upload_ledger.get("entries", {}).get(key, {})
                    primary_state_error = meta_reels_state.get("entries", {}).get(key, {})
                    for _, batch_rel_path, batch_key, _ in batch_entries[1:]:
                        if isinstance(primary_ig_error, dict) and primary_ig_error:
                            instagram_upload_ledger["entries"][batch_key] = dict(primary_ig_error)
                            instagram_upload_ledger["entries"][batch_key]["relative_path"] = batch_rel_path
                        if isinstance(primary_fb_error, dict) and primary_fb_error:
                            facebook_upload_ledger["entries"][batch_key] = dict(primary_fb_error)
                            facebook_upload_ledger["entries"][batch_key]["relative_path"] = batch_rel_path
                        if isinstance(primary_state_error, dict) and primary_state_error:
                            meta_reels_state["entries"][batch_key] = dict(primary_state_error)
                            meta_reels_state["entries"][batch_key]["relative_path"] = batch_rel_path
                    save_json_file(meta_reels_state_file, meta_reels_state)
                    save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
                    save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)
                if args.continue_on_platform_error:
                    print("[warn] Upload error — continuing due to --continue-on-platform-error.")
                    continue
                print("[fatal] Upload error — stopping run.")
                break

            if len(batch_entries) > 1:
                primary_ig_row = instagram_upload_ledger.get("entries", {}).get(key, {})
                primary_fb_row = facebook_upload_ledger.get("entries", {}).get(key, {})
                primary_state_row = meta_reels_state.get("entries", {}).get(key, {})
                for _, batch_rel_path, batch_key, _ in batch_entries[1:]:
                    if isinstance(primary_ig_row, dict) and primary_ig_row:
                        instagram_upload_ledger["entries"][batch_key] = dict(primary_ig_row)
                        instagram_upload_ledger["entries"][batch_key]["relative_path"] = batch_rel_path
                    if isinstance(primary_fb_row, dict) and primary_fb_row:
                        facebook_upload_ledger["entries"][batch_key] = dict(primary_fb_row)
                        facebook_upload_ledger["entries"][batch_key]["relative_path"] = batch_rel_path
                    if isinstance(primary_state_row, dict) and primary_state_row:
                        meta_reels_state["entries"][batch_key] = dict(primary_state_row)
                        meta_reels_state["entries"][batch_key]["relative_path"] = batch_rel_path
                save_json_file(meta_reels_state_file, meta_reels_state)
                save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
                save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)

            mark_schedule_slot_consumed()
            history_titles.append(metadata["title"])
            history_descriptions.append(metadata["description"])
            metadata_history["titles"] = history_titles[-5000:]
            metadata_history["descriptions"] = history_descriptions[-5000:]
            save_json_file(metadata_history_file, metadata_history)
            instagram_status = get_platform_upload_status(instagram_upload_ledger, key)
            facebook_status = get_platform_upload_status(facebook_upload_ledger, key)
            if target_platform == "instagram" and instagram_status == "ok":
                uploaded_count += len(batch_entries)
                print(f"[ok][instagram] uploaded: {rel_path}")
                cleanup_converted_outputs()
            elif target_platform == "instagram" and instagram_status == "scheduled":
                uploaded_count += len(batch_entries)
                print(f"[scheduled][instagram] queued: {rel_path}")
                cleanup_converted_outputs()
            elif target_platform == "facebook" and facebook_status == "ok":
                uploaded_count += len(batch_entries)
                print(f"[ok][facebook] uploaded: {rel_path}")
                cleanup_converted_outputs()
                if index < len(upload_batches):
                    if args.shorts_max_seconds <= 30:
                        delay_seconds = random.randint(90, 150)
                        print(f"[delay][facebook] waiting {delay_seconds}s before next upload")
                        time.sleep(delay_seconds)

    if args.dry_run:
        print("\n[done] dry run completed.")
    else:
        print(f"\n[done] uploads completed: {uploaded_count}/{len(pending)}")
        if target_platform == "youtube":
            print(f"[done] state file: {state_file}")
        else:
            print(f"[done] reels state file: {meta_reels_state_file}")
    if skipped_not_shorts:
        print(f"[done] skipped by Shorts policy: {skipped_not_shorts}")
    if hit_upload_limit:
        print("[done] stopped early due to YouTube quota limit.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
