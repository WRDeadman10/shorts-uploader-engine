"""Delete source video files that have already been uploaded to ALL selected platforms.

Usage:
    python deleteUploadedVideos.py --root "E:/Videos/VALORANT" --platforms youtube,instagram,facebook
    python deleteUploadedVideos.py --root "E:/Videos/VALORANT" --platforms youtube,instagram,facebook --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delete source video files uploaded to ALL selected platforms."
    )
    parser.add_argument(
        "--root",
        required=True,
        help="Root directory where the source video files live.",
    )
    parser.add_argument(
        "--platforms",
        default="youtube,instagram,facebook",
        help="Comma-separated platforms that must ALL be uploaded (default: youtube,instagram,facebook).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List files that would be deleted without actually deleting them.",
    )
    return parser.parse_args()


def read_json(path: Path) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def main() -> None:
    args = parse_args()
    script_dir = Path(__file__).parent.resolve()
    video_root = Path(args.root).resolve()

    platforms = [p.strip().lower() for p in args.platforms.split(",") if p.strip()]
    if not platforms:
        print("[error] No platforms specified.", file=sys.stderr)
        sys.exit(1)

    print(f"[info] Checking platforms: {', '.join(platforms)}")
    print(f"[info] Video root: {video_root}")
    if args.dry_run:
        print("[info] DRY RUN — no files will be deleted")

    # ── Load state files ────────────────────────────────────────────────────────
    yt_state    = read_json(script_dir / ".youtube_upload_state.json").get("uploaded", {})
    yt_ledger   = read_json(script_dir / ".youtube_uploaded_videos.json").get("entries", {})
    ig_ledger   = read_json(script_dir / ".instagram_uploaded_videos.json").get("entries", {})
    fb_ledger   = read_json(script_dir / ".facebook_uploaded_videos.json").get("entries", {})
    meta_state  = read_json(script_dir / ".meta_reels_upload_state.json").get("entries", {})

    # ── Collect all known video keys ────────────────────────────────────────────
    all_keys: set[str] = set()
    for collection in (yt_state, yt_ledger, ig_ledger, fb_ledger, meta_state):
        all_keys.update(collection.keys())

    to_delete: list[tuple[str, Path]] = []

    for key in sorted(all_keys):
        # Determine per-platform upload status
        yt_ok = bool(yt_state.get(key) or yt_ledger.get(key))

        ig_e    = ig_ledger.get(key, {})
        meta_ig = (meta_state.get(key) or {}).get("instagram") or {}
        ig_ok   = ig_e.get("status") == "ok" or str(meta_ig.get("status", "")).lower() == "ok"

        fb_e    = fb_ledger.get(key, {})
        meta_fb = (meta_state.get(key) or {}).get("facebook") or {}
        fb_ok   = fb_e.get("status") == "ok" or str(meta_fb.get("status", "")).lower() == "ok"

        flags = {"youtube": yt_ok, "instagram": ig_ok, "facebook": fb_ok}

        # Skip if not uploaded on every requested platform
        if not all(flags.get(p, False) for p in platforms):
            continue

        # Resolve the relative path to an absolute path
        yt_entry = yt_state.get(key) or yt_ledger.get(key) or {}
        ig_entry = ig_ledger.get(key) or {}
        fb_entry = fb_ledger.get(key) or {}
        rel_path = (
            yt_entry.get("relative_path")
            or ig_entry.get("relative_path")
            or fb_entry.get("relative_path")
            or ""
        )
        if not rel_path:
            continue

        abs_path = video_root / rel_path
        if abs_path.is_file():
            to_delete.append((rel_path, abs_path))

    print(f"[info] Found {len(to_delete)} video(s) eligible for deletion")

    if not to_delete:
        print("[info] Nothing to delete.")
        return

    deleted = 0
    errors  = 0

    for rel_path, abs_path in to_delete:
        if args.dry_run:
            print(f"[dry-run] {rel_path}")
        else:
            try:
                os.remove(abs_path)
                print(f"[deleted] {rel_path}")
                deleted += 1
            except Exception as exc:
                print(f"[error] could not delete {rel_path}: {exc}", file=sys.stderr)
                errors += 1

    if args.dry_run:
        print(f"\n[dry-run] {len(to_delete)} file(s) would be deleted — re-run without --dry-run to delete")
    else:
        print(f"\n[done] deleted={deleted}  errors={errors}")


if __name__ == "__main__":
    main()
