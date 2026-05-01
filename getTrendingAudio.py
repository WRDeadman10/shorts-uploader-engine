"""Fetch trending audio tracks from YouTube (music category) and Instagram (trending reels).

Outputs a JSON report and prints a human-readable summary to stdout.

Usage:
    # YouTube via API key (simplest — no OAuth needed):
    python getTrendingAudio.py --youtube --youtube-api-key YOUR_KEY

    # YouTube via OAuth (reuses existing credentials):
    python getTrendingAudio.py --youtube --client-secrets client_secret.json --token-file token.json

    # Instagram only:
    python getTrendingAudio.py --instagram --ig-username USER --ig-password PASS

    # Both platforms:
    python getTrendingAudio.py --youtube --instagram \\
        --youtube-api-key YOUR_KEY \\
        --ig-username USER --ig-password PASS \\
        --max-results 25 --region US
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from lib.file_utils import save_json_file


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch trending audio from YouTube and Instagram."
    )

    # Platform selection
    parser.add_argument(
        "--youtube",
        action="store_true",
        help="Fetch YouTube trending music category videos.",
    )
    parser.add_argument(
        "--instagram",
        action="store_true",
        help="Fetch Instagram trending reels audio tracks.",
    )

    # YouTube auth — API key (read-only, no OAuth needed for public trending)
    parser.add_argument(
        "--youtube-api-key",
        default="",
        help="YouTube Data API v3 key. Sufficient for public trending data.",
    )
    # YouTube auth — OAuth fallback (reuses existing project credentials)
    parser.add_argument(
        "--client-secrets",
        default="client_secret.json",
        help="OAuth client secrets JSON (used when --youtube-api-key is not set).",
    )
    parser.add_argument(
        "--token-file",
        default="token.json",
        help="OAuth token file path.",
    )
    parser.add_argument(
        "--auth-port",
        type=int,
        default=0,
        help="Local port for OAuth redirect (default: auto).",
    )

    # YouTube options
    parser.add_argument(
        "--region",
        default="US",
        help="ISO 3166-1 alpha-2 region code for trending results (default: US).",
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=20,
        help="Max trending items to fetch per platform (default: 20, max: 50).",
    )

    # Instagram auth
    parser.add_argument("--ig-username", default="", help="Instagram username.")
    parser.add_argument("--ig-password", default="", help="Instagram password.")
    parser.add_argument(
        "--ig-session-file",
        default=".ig_session.json",
        help="Path to cache the Instagram session to avoid repeated logins.",
    )

    # Output
    parser.add_argument(
        "--output-file",
        default="trending_audio_report.json",
        help="Output JSON report path (default: trending_audio_report.json).",
    )

    return parser.parse_args()


# ── YouTube ───────────────────────────────────────────────────────────────────

def _build_youtube_track(rank: int, item: Dict[str, Any]) -> Dict[str, Any]:
    snippet = item.get("snippet", {})
    stats = item.get("statistics", {})
    video_id = item.get("id", "")
    return {
        "rank": rank,
        "video_id": video_id,
        "title": snippet.get("title", ""),
        "channel": snippet.get("channelTitle", ""),
        "published_at": snippet.get("publishedAt", ""),
        "view_count": int(stats.get("viewCount", 0) or 0),
        "like_count": int(stats.get("likeCount", 0) or 0),
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
    }


def fetch_youtube_api_key(api_key: str, region: str, max_results: int) -> List[Dict[str, Any]]:
    """Trending music via YouTube Data API v3 (API key — no OAuth)."""
    try:
        from googleapiclient.discovery import build
        youtube = build("youtube", "v3", developerKey=api_key)
    except Exception as exc:
        print(f"[error][youtube] Could not build API client: {exc}")
        return []

    try:
        response = youtube.videos().list(
            part="snippet,statistics",
            chart="mostPopular",
            videoCategoryId="10",   # Music
            regionCode=region,
            maxResults=min(max_results, 50),
        ).execute()
    except Exception as exc:
        print(f"[error][youtube] API request failed: {exc}")
        return []

    return [
        _build_youtube_track(i + 1, item)
        for i, item in enumerate(response.get("items", []))
    ]


def fetch_youtube_oauth(
    client_secrets: Path,
    token_file: Path,
    auth_port: int,
    region: str,
    max_results: int,
) -> List[Dict[str, Any]]:
    """Trending music via YouTube Data API v3 (OAuth)."""
    try:
        from lib.youtube_auth import build_youtube_client
        youtube = build_youtube_client(client_secrets, token_file, auth_port)
    except Exception as exc:
        print(f"[error][youtube] OAuth setup failed: {exc}")
        return []

    try:
        response = youtube.videos().list(
            part="snippet,statistics",
            chart="mostPopular",
            videoCategoryId="10",
            regionCode=region,
            maxResults=min(max_results, 50),
        ).execute()
    except Exception as exc:
        print(f"[error][youtube] API request failed: {exc}")
        return []

    return [
        _build_youtube_track(i + 1, item)
        for i, item in enumerate(response.get("items", []))
    ]


# ── Instagram ─────────────────────────────────────────────────────────────────

def _login_instagram(username: str, password: str, session_file: Path):
    """Return an authenticated instagrapi Client, using session cache when available."""
    from instagrapi import Client  # type: ignore

    cl = Client()

    if session_file.exists():
        try:
            cl.load_settings(session_file)
            cl.login(username, password)
            print("[info][instagram] Logged in via cached session.")
            return cl
        except Exception:
            print("[info][instagram] Session stale — re-authenticating.")
            cl = Client()

    cl.login(username, password)
    cl.dump_settings(session_file)
    print("[info][instagram] Logged in and session saved.")
    return cl


def _fetch_clips_channel_raw(cl: Any, amount: int) -> List[Dict[str, Any]]:
    """Call /api/v1/clips/channel/ directly via the instagrapi private session.

    This bypasses named method wrappers so it works across all instagrapi versions.
    The endpoint returns the same trending clips feed as the Instagram Reels tab.
    """
    items: List[Dict[str, Any]] = []
    max_id: Optional[str] = None

    while len(items) < amount:
        params: Dict[str, Any] = {"has_visited_clips_tab": "true"}
        if max_id:
            params["max_id"] = max_id
        try:
            resp = cl.private.get("clips/channel/", params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            print(f"[warn][instagram] clips/channel/ request failed: {exc}")
            break

        batch = data.get("items", [])
        if not batch:
            break
        items.extend(batch)

        max_id = data.get("next_max_id") or data.get("paging_info", {}).get("max_id")
        if not max_id:
            break

    return items[:amount]


def fetch_instagram_trending(
    username: str,
    password: str,
    session_file: Path,
    max_results: int,
) -> List[Dict[str, Any]]:
    """Trending reels audio from Instagram via instagrapi."""
    try:
        import instagrapi  # noqa: F401
    except ImportError:
        print("[error][instagram] instagrapi not installed. Run: pip install instagrapi")
        return []

    try:
        cl = _login_instagram(username, password, session_file)
    except Exception as exc:
        print(f"[error][instagram] Login failed: {exc}")
        return []

    tracks: List[Dict[str, Any]] = []
    seen_audio_ids: set = set()
    fetch_amount = max_results * 3

    # Use raw private API — version-independent, no method name guessing.
    # cl.private is a requests.Session pointed at https://i.instagram.com/api/v1/
    raw_items = _fetch_clips_channel_raw(cl, fetch_amount)
    print(f"[info][instagram] clips/channel/ returned {len(raw_items)} raw items.")

    if not raw_items:
        print("[warn][instagram] No reels returned — account may need to browse Reels first.")
        return []

    for item in raw_items:
        if len(tracks) >= max_results:
            break
        try:
            # Raw API: items are {"media": {...}} dicts
            media = item.get("media") or item  # handle both wrapped and unwrapped
            clips_meta = media.get("clips_metadata") or {}
            media_id = str(media.get("id", ""))
            code = media.get("code", "")
            play_count = int(media.get("play_count", 0) or 0)
            caption = (media.get("caption") or {}).get("text", "")

            original = clips_meta.get("original_sound_info") or {}
            music = (clips_meta.get("music_info") or {}).get("music_asset_info") or {}

            if original:
                audio_id = str(original.get("audio_asset_id", ""))
                if audio_id and audio_id in seen_audio_ids:
                    continue
                if audio_id:
                    seen_audio_ids.add(audio_id)

                ig_artist = original.get("ig_artist") or {}
                tracks.append({
                    "rank": len(tracks) + 1,
                    "audio_id": audio_id,
                    "title": original.get("original_audio_title") or caption or "Unknown",
                    "author": ig_artist.get("username", "") if isinstance(ig_artist, dict) else "",
                    "usage_count": int(original.get("usage_count", 0) or 0),
                    "is_explicit": bool(original.get("is_explicit", False)),
                    "audio_type": "original_sound",
                    "reel_id": media_id,
                    "reel_url": f"https://www.instagram.com/reel/{code}/",
                    "reel_play_count": play_count,
                })

            elif music:
                audio_id = str(music.get("audio_asset_id", ""))
                if audio_id and audio_id in seen_audio_ids:
                    continue
                if audio_id:
                    seen_audio_ids.add(audio_id)

                tracks.append({
                    "rank": len(tracks) + 1,
                    "audio_id": audio_id,
                    "title": music.get("title", "Unknown"),
                    "author": music.get("display_artist", ""),
                    "usage_count": 0,
                    "is_explicit": bool(music.get("is_explicit", False)),
                    "audio_type": "licensed_music",
                    "reel_id": media_id,
                    "reel_url": f"https://www.instagram.com/reel/{code}/",
                    "reel_play_count": play_count,
                })

        except Exception as exc:
            print(f"[warn][instagram] Skipped reel {getattr(reel, 'pk', '?')}: {exc}")
            continue

    return tracks


# ── Report printing ───────────────────────────────────────────────────────────

def _fmt_count(n: int) -> str:
    return f"{n:,}" if n else "—"


def print_youtube_summary(tracks: List[Dict[str, Any]]) -> None:
    print(f"\n{'─' * 62}")
    print(f"  YouTube Trending Music — {len(tracks)} tracks")
    print(f"{'─' * 62}")
    for t in tracks:
        print(f"  {t['rank']:>2}. {t['title'][:55]}")
        print(f"      Channel : {t['channel']}")
        print(f"      Views   : {_fmt_count(t['view_count'])}  |  Likes: {_fmt_count(t['like_count'])}")
        print(f"      URL     : {t['url']}")
        print()


def print_instagram_summary(tracks: List[Dict[str, Any]]) -> None:
    print(f"\n{'─' * 62}")
    print(f"  Instagram Trending Audio — {len(tracks)} tracks")
    print(f"{'─' * 62}")
    for t in tracks:
        print(f"  {t['rank']:>2}. {t['title'][:55]}")
        print(f"      Author  : {t['author'] or '—'}  |  Type: {t['audio_type']}")
        print(f"      Uses    : {_fmt_count(t['usage_count'])}  |  Reel plays: {_fmt_count(t['reel_play_count'])}")
        print(f"      Reel    : {t['reel_url']}")
        print()


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> int:
    args = parse_args()

    if not args.youtube and not args.instagram:
        print("[error] Specify at least --youtube or --instagram")
        return 1

    report: Dict[str, Any] = {
        "generated_at_utc": now_utc_iso(),
        "region": args.region,
        "max_results": args.max_results,
        "youtube": None,
        "instagram": None,
    }

    # ── YouTube ───────────────────────────────────────────────────────────────
    if args.youtube:
        print("[info] Fetching YouTube trending music…")

        if args.youtube_api_key:
            yt_tracks = fetch_youtube_api_key(args.youtube_api_key, args.region, args.max_results)
        else:
            secrets = Path(args.client_secrets)
            if not secrets.exists():
                print(
                    f"[error][youtube] Provide --youtube-api-key or place {secrets} "
                    "in the project root."
                )
                yt_tracks = []
            else:
                yt_tracks = fetch_youtube_oauth(
                    secrets, Path(args.token_file), args.auth_port,
                    args.region, args.max_results,
                )

        report["youtube"] = {
            "fetch_error": None if yt_tracks else "No tracks returned — check API key / credentials.",
            "count": len(yt_tracks),
            "tracks": yt_tracks,
        }

        if yt_tracks:
            print_youtube_summary(yt_tracks)
        else:
            print("[warn][youtube] No tracks fetched.")

    # ── Instagram ─────────────────────────────────────────────────────────────
    if args.instagram:
        if not args.ig_username or not args.ig_password:
            print("[error][instagram] --ig-username and --ig-password are required.")
            report["instagram"] = {
                "fetch_error": "Missing credentials.",
                "count": 0,
                "tracks": [],
            }
        else:
            print("[info] Fetching Instagram trending audio…")
            ig_tracks = fetch_instagram_trending(
                args.ig_username,
                args.ig_password,
                Path(args.ig_session_file),
                args.max_results,
            )
            report["instagram"] = {
                "fetch_error": None if ig_tracks else "No tracks returned — check credentials or try again later.",
                "count": len(ig_tracks),
                "tracks": ig_tracks,
            }
            if ig_tracks:
                print_instagram_summary(ig_tracks)
            else:
                print("[warn][instagram] No tracks fetched.")

    # ── Save report ───────────────────────────────────────────────────────────
    output_path = Path(args.output_file)
    save_json_file(output_path, report)
    print(f"[info] Report saved → {output_path.resolve()}")

    total = (report.get("youtube") or {}).get("count", 0) + \
            (report.get("instagram") or {}).get("count", 0)
    print(f"[info] Done. {total} total tracks fetched.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
