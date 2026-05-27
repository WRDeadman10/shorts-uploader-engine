import argparse
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from lib.file_utils import save_json_file
from lib.ledger import update_platform_upload_ledger
from lib.text_utils import clean_text
from lib.ai_metadata import build_meta_captions
from lib.meta_api import (
    ig_create_reel_container, ig_upload_reel_binary, ig_wait_until_ready, ig_publish_reel,
    fb_start_reel_session, fb_upload_reel_binary, fb_finish_reel_publish,
    is_retryable_instagram_processing_error, is_facebook_rate_limited_error,
    platform_enabled as meta_platform_enabled,
)
from metaBatchReelsUpload import (
    should_skip_platform as meta_should_skip_platform,
    now_utc_iso as meta_now_utc_iso,
)

def crosspost_meta_reel(
    *,
    args: argparse.Namespace,
    reels_state: Dict[str, Any],
    meta_reels_state_file: Path,
    instagram_upload_ledger: Dict[str, Any],
    instagram_upload_ledger_file: Path,
    facebook_upload_ledger: Dict[str, Any],
    facebook_upload_ledger_file: Path,
    state_key: str,
    rel_path: str,
    source_file: Path,
    full_size_source_file: Optional[Path] = None,
    metadata: Dict[str, Any],
    metadata_path: Path,
    youtube_video_id: str,
    facebook_blocked_for_run: Dict[str, bool],
    publish_at: Optional[str] = None,
    schedule_instagram: bool = False,
    schedule_facebook: bool = True,
) -> bool:
    """Upload reel to Meta platforms. Returns True if a fatal error occurred (caller should stop)."""
    had_error = False
    reels_entries = reels_state.get("entries", {})
    if "entries" not in reels_state:
        reels_state["entries"] = reels_entries

    state_row = reels_entries.get(state_key, {})
    if not isinstance(state_row, dict):
        state_row = {}
        reels_entries[state_key] = state_row

    do_instagram = meta_platform_enabled(args.meta_platform, "instagram") and not meta_should_skip_platform(
        reels_entries, state_key, "instagram", args.meta_skip_uploaded
    )
    do_facebook = meta_platform_enabled(args.meta_platform, "facebook") and not meta_should_skip_platform(
        reels_entries, state_key, "facebook", args.meta_skip_uploaded
    )
    if facebook_blocked_for_run.get("blocked"):
        do_facebook = False
    if not do_instagram and not do_facebook:
        print("[meta-crosspost] skipped: already uploaded on selected platform(s)")
        return False

    ig_caption, fb_description, fb_title = build_meta_captions(
        metadata,
        youtube_username=args.youtube_username,
        instagram_username=args.instagram_username,
    )
    print(f"[meta-crosspost] source file: {source_file}")

    def save_meta_progress() -> None:
        save_json_file(meta_reels_state_file, reels_state)
        save_json_file(instagram_upload_ledger_file, instagram_upload_ledger)
        save_json_file(facebook_upload_ledger_file, facebook_upload_ledger)

    if do_instagram:
        for attempt in range(1, max(args.meta_instagram_retries, 1) + 1):
            try:
                _ig_scheduled_ts: Optional[int] = None
                if publish_at and schedule_instagram:
                    try:
                        _ig_scheduled_ts = int(
                            datetime.fromisoformat(publish_at.replace("Z", "+00:00"))
                            .astimezone(timezone.utc)
                            .timestamp()
                        )
                    except Exception:
                        _ig_scheduled_ts = None
                container_id, ig_upload_uri = ig_create_reel_container(
                    graph_version=args.meta_graph_version,
                    ig_user_id=clean_text(args.meta_ig_user_id),
                    access_token=clean_text(args.meta_access_token),
                    caption=ig_caption,
                    timeout=args.meta_request_timeout_seconds,
                    scheduled_publish_time=_ig_scheduled_ts,
                )
                ig_upload_reel_binary(
                    upload_uri=ig_upload_uri,
                    access_token=clean_text(args.meta_access_token),
                    file_path=str(source_file),
                    timeout=args.meta_request_timeout_seconds,
                )
                ig_wait_until_ready(
                    graph_version=args.meta_graph_version,
                    container_id=container_id,
                    access_token=clean_text(args.meta_access_token),
                    attempts=args.meta_poll_attempts,
                    interval_seconds=args.meta_poll_interval_seconds,
                    timeout=args.meta_request_timeout_seconds,
                )
                ig_media_id = ig_publish_reel(
                    graph_version=args.meta_graph_version,
                    ig_user_id=clean_text(args.meta_ig_user_id),
                    container_id=container_id,
                    access_token=clean_text(args.meta_access_token),
                    timeout=args.meta_request_timeout_seconds,
                )
                instagram_status = "scheduled" if _ig_scheduled_ts is not None else "ok"
                state_row["instagram"] = {
                    "status": instagram_status,
                    "container_id": container_id,
                    "media_id": ig_media_id,
                    "source_file": str(source_file),
                }
                if instagram_status == "ok":
                    state_row["instagram"]["published_at_utc"] = meta_now_utc_iso()
                elif instagram_status == "scheduled":
                    state_row["instagram"]["scheduled_for_utc"] = publish_at
                    state_row["instagram"]["scheduled_at_utc"] = meta_now_utc_iso()
                update_platform_upload_ledger(
                    instagram_upload_ledger,
                    state_key=state_key,
                    status=instagram_status,
                    relative_path=rel_path,
                    source_file=source_file,
                    metadata_file=metadata_path,
                    title=str(metadata.get("title", "")),
                    platform_id_key="media_id",
                    platform_id_value=ig_media_id,
                    extra_fields={
                        "container_id": container_id,
                        "youtube_video_id": youtube_video_id,
                    },
                )
                if (
                    args.full_size_video
                    and full_size_source_file
                    and full_size_source_file.exists()
                    and full_size_source_file != source_file
                ):
                    try:
                        fs_container_id, fs_upload_uri = ig_create_reel_container(
                            graph_version=args.meta_graph_version,
                            ig_user_id=clean_text(args.meta_ig_user_id),
                            access_token=clean_text(args.meta_access_token),
                            caption=ig_caption,
                            timeout=args.meta_request_timeout_seconds,
                            scheduled_publish_time=None,
                        )
                        ig_upload_reel_binary(
                            upload_uri=fs_upload_uri,
                            access_token=clean_text(args.meta_access_token),
                            file_path=str(full_size_source_file),
                            timeout=args.meta_request_timeout_seconds,
                        )
                        ig_wait_until_ready(
                            graph_version=args.meta_graph_version,
                            container_id=fs_container_id,
                            access_token=clean_text(args.meta_access_token),
                            attempts=args.meta_poll_attempts,
                            interval_seconds=args.meta_poll_interval_seconds,
                            timeout=args.meta_request_timeout_seconds,
                        )
                        fs_media_id = ig_publish_reel(
                            graph_version=args.meta_graph_version,
                            ig_user_id=clean_text(args.meta_ig_user_id),
                            container_id=fs_container_id,
                            access_token=clean_text(args.meta_access_token),
                            timeout=args.meta_request_timeout_seconds,
                        )
                        ig_entry = instagram_upload_ledger.get("entries", {}).get(state_key, {})
                        if isinstance(ig_entry, dict):
                            ig_entry["full_size_media_id"] = fs_media_id
                            ig_entry["full_size_source_file"] = str(full_size_source_file)
                        print(f"[ok][instagram][full-size] media_id={fs_media_id}")
                    except Exception as fs_exc:  # noqa: BLE001
                        print(f"[warn][instagram][full-size] {fs_exc}")
                save_meta_progress()
                if instagram_status == "ok":
                    print(f"[ok][instagram] media_id={ig_media_id}")
                elif instagram_status == "scheduled":
                    print(f"[scheduled][instagram] media_id={ig_media_id} publish_at={publish_at}")
                break
            except Exception as exc:  # noqa: BLE001
                retryable = is_retryable_instagram_processing_error(exc)
                is_last_attempt = attempt >= max(args.meta_instagram_retries, 1)
                if retryable and not is_last_attempt:
                    print(
                        f"[warn][instagram] transient processing failure on attempt {attempt}; "
                        f"retrying in {args.meta_instagram_retry_delay_seconds:.1f}s"
                    )
                    time.sleep(max(args.meta_instagram_retry_delay_seconds, 0.0))
                    continue
                state_row["instagram"] = {
                    "status": "error",
                    "error": str(exc),
                    "updated_at_utc": meta_now_utc_iso(),
                    "source_file": str(source_file),
                }
                update_platform_upload_ledger(
                    instagram_upload_ledger,
                    state_key=state_key,
                    status="error",
                    relative_path=rel_path,
                    source_file=source_file,
                    metadata_file=metadata_path,
                    title=str(metadata.get("title", "")),
                    platform_id_key="media_id",
                    platform_id_value="",
                    extra_fields={
                        "youtube_video_id": youtube_video_id,
                    },
                    error_message=str(exc),
                )
                save_meta_progress()
                print(f"[error][instagram] {exc}")
                had_error = True
                break

    if do_facebook and not had_error:
        try:
            fb_video_id, upload_url = fb_start_reel_session(
                graph_version=args.meta_graph_version,
                page_id=clean_text(args.meta_facebook_page_id),
                access_token=clean_text(args.meta_access_token),
                timeout=args.meta_request_timeout_seconds,
            )
            fb_upload_reel_binary(
                upload_url=upload_url,
                access_token=clean_text(args.meta_access_token),
                file_path=str(source_file),
                timeout=args.meta_request_timeout_seconds,
            )
            _fb_scheduled_ts: Optional[int] = None
            if publish_at and schedule_facebook:
                try:
                    _fb_scheduled_ts = int(
                        datetime.fromisoformat(publish_at.replace("Z", "+00:00"))
                        .astimezone(timezone.utc)
                        .timestamp()
                    )
                except Exception:
                    _fb_scheduled_ts = None
            finish_response = fb_finish_reel_publish(
                graph_version=args.meta_graph_version,
                page_id=clean_text(args.meta_facebook_page_id),
                access_token=clean_text(args.meta_access_token),
                video_id=fb_video_id,
                description=fb_description,
                title=fb_title,
                timeout=args.meta_request_timeout_seconds,
                scheduled_publish_time=_fb_scheduled_ts,
            )
            state_row["facebook"] = {
                "status": "ok",
                "video_id": fb_video_id,
                "publish_response": finish_response,
                "published_at_utc": meta_now_utc_iso(),
                "source_file": str(source_file),
            }
            update_platform_upload_ledger(
                facebook_upload_ledger,
                state_key=state_key,
                status="ok",
                relative_path=rel_path,
                source_file=source_file,
                metadata_file=metadata_path,
                title=str(metadata.get("title", "")),
                platform_id_key="video_id",
                platform_id_value=fb_video_id,
                extra_fields={
                    "publish_response": finish_response,
                    "youtube_video_id": youtube_video_id,
                },
            )
            if (
                args.full_size_video
                and full_size_source_file
                and full_size_source_file.exists()
                and full_size_source_file != source_file
            ):
                try:
                    fs_video_id, fs_upload_url = fb_start_reel_session(
                        graph_version=args.meta_graph_version,
                        page_id=clean_text(args.meta_facebook_page_id),
                        access_token=clean_text(args.meta_access_token),
                        timeout=args.meta_request_timeout_seconds,
                    )
                    fb_upload_reel_binary(
                        upload_url=fs_upload_url,
                        access_token=clean_text(args.meta_access_token),
                        file_path=str(full_size_source_file),
                        timeout=args.meta_request_timeout_seconds,
                    )
                    fb_finish_reel_publish(
                        graph_version=args.meta_graph_version,
                        page_id=clean_text(args.meta_facebook_page_id),
                        access_token=clean_text(args.meta_access_token),
                        video_id=fs_video_id,
                        description=fb_description,
                        title=fb_title,
                        timeout=args.meta_request_timeout_seconds,
                        scheduled_publish_time=None,
                    )
                    fb_entry = facebook_upload_ledger.get("entries", {}).get(state_key, {})
                    if isinstance(fb_entry, dict):
                        fb_entry["full_size_video_id"] = fs_video_id
                        fb_entry["full_size_source_file"] = str(full_size_source_file)
                    print(f"[ok][facebook][full-size] video_id={fs_video_id}")
                except Exception as fs_exc:  # noqa: BLE001
                    print(f"[warn][facebook][full-size] {fs_exc}")
            save_meta_progress()
            print(f"[ok][facebook] video_id={fb_video_id}")
        except Exception as exc:  # noqa: BLE001
            state_row["facebook"] = {
                "status": "error",
                "error": str(exc),
                "updated_at_utc": meta_now_utc_iso(),
                "source_file": str(source_file),
            }
            update_platform_upload_ledger(
                facebook_upload_ledger,
                state_key=state_key,
                status="error",
                relative_path=rel_path,
                source_file=source_file,
                metadata_file=metadata_path,
                title=str(metadata.get("title", "")),
                platform_id_key="video_id",
                platform_id_value="",
                extra_fields={
                    "youtube_video_id": youtube_video_id,
                },
                error_message=str(exc),
            )
            save_meta_progress()
            print(f"[error][facebook] {exc}")
            had_error = True
            if is_facebook_rate_limited_error(exc):
                facebook_blocked_for_run["blocked"] = True
                print(
                    "[warn][facebook] Facebook rate-limited (code 368/subcode 1390008). Stopping run."
                )

    state_row["relative_path"] = rel_path
    state_row["youtube_video_id"] = youtube_video_id
    state_row["metadata_file"] = str(metadata_path)
    return had_error
