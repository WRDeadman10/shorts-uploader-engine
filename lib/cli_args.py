import argparse
import os
from lib.file_utils import get_default_video_root

VIDEO_SOURCE_ROOT = ""

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Upload local clips to YouTube Shorts with AI metadata."
    )
    parser.add_argument(
        "--root",
        "--videos-path",
        dest="root",
        default=VIDEO_SOURCE_ROOT,
        help=(
            "Root directory to recursively scan for videos. "
            "Defaults to sibling folder named 'VALORANT'."
        ),
    )
    parser.add_argument(
        "--extensions",
        default=".mp4,.mov,.mkv,.webm",
        help="Comma-separated list of video extensions.",
    )
    parser.add_argument(
        "--exclude-dirs",
        default=".git,__pycache__,generated_metadata,converted_shorts",
        help="Comma-separated directory names to skip while scanning for videos.",
    )
    parser.add_argument(
        "--exclude-files",
        default="shorts_crop_preview.mp4",
        help="Comma-separated file names to skip while scanning for videos.",
    )
    parser.add_argument(
        "--max-videos",
        type=int,
        default=0,
        help="Limit number of uploads (0 = all discovered).",
    )
    parser.add_argument(
        "--privacy",
        choices=["private", "public", "unlisted"],
        default="public",
        help="YouTube privacy setting.",
    )
    parser.add_argument(
        "--playlist-name",
        default="Valorant",
        help="Playlist title to add each uploaded video to (empty to disable).",
    )
    parser.add_argument(
        "--upload-platform",
        choices=["youtube", "instagram", "facebook"],
        default="youtube",
        help="Choose which platform this run should upload to.",
    )
    parser.add_argument(
        "--require-uploaded-on",
        default="",
        help="Comma-separated platforms that must already have the clip uploaded before it is queued.",
    )
    parser.add_argument(
        "--require-missing-on",
        default="",
        help="Comma-separated platforms that must not already have the clip uploaded before it is queued.",
    )
    parser.add_argument(
        "--client-secrets",
        default="client_secret.json",
        help="Path to YouTube OAuth client secrets JSON.",
    )
    parser.add_argument(
        "--auth-port",
        type=int,
        default=8080,
        help="Local port used by OAuth callback server.",
    )
    parser.add_argument(
        "--token-file",
        default="token.json",
        help="Path to store OAuth access token JSON.",
    )
    parser.add_argument(
        "--state-file",
        default=".youtube_upload_state.json",
        help="Path to upload state file (used to skip already uploaded videos).",
    )
    parser.add_argument(
        "--youtube-upload-ledger-file",
        default=".youtube_uploaded_videos.json",
        help="Path to per-video YouTube upload ledger JSON.",
    )
    parser.add_argument(
        "--instagram-upload-ledger-file",
        default=".instagram_uploaded_videos.json",
        help="Path to per-video Instagram upload ledger JSON.",
    )
    parser.add_argument(
        "--facebook-upload-ledger-file",
        default=".facebook_uploaded_videos.json",
        help="Path to per-video Facebook upload ledger JSON.",
    )
    parser.add_argument(
        "--metadata-dir",
        default="generated_metadata",
        help="Directory to store generated metadata JSON per uploaded file.",
    )
    parser.add_argument(
        "--shorts-policy",
        choices=["off", "strict", "convert"],
        default="convert",
        help=(
            "How to enforce Shorts format: "
            "off=upload as-is, strict=skip non-Shorts files, "
            "convert=auto-convert non-Shorts files to 9:16."
        ),
    )
    parser.add_argument(
        "--shorts-max-seconds",
        type=int,
        default=180,
        help="Maximum Shorts duration in seconds.",
    )
    parser.add_argument(
        "--full-size-video",
        action="store_true",
        default=False,
        help="Upload an additional full-size version alongside mandatory Shorts conversion.",
    )
    parser.add_argument(
        "--converted-dir",
        default="converted_shorts",
        help="Directory to store auto-converted Shorts files.",
    )
    parser.add_argument(
        "--ffmpeg-bin",
        default="ffmpeg",
        help="Path to ffmpeg binary for conversion.",
    )
    parser.add_argument(
        "--ffprobe-bin",
        default="ffprobe",
        help="Path to ffprobe binary for media inspection.",
    )
    parser.add_argument(
        "--openai-model",
        default="gpt-4.1-mini",
        help="OpenAI model used to generate metadata.",
    )
    parser.add_argument(
        "--channel-name",
        default="",
        help="Optional channel name/style for AI prompt.",
    )
    parser.add_argument(
        "--instagram-username",
        default=os.getenv("INSTAGRAM_USERNAME", "").strip(),
        help="Instagram username/handle to mention in YouTube descriptions.",
    )
    parser.add_argument(
        "--youtube-username",
        default=(
            os.getenv("YOUTUBE_USERNAME", "").strip()
            or os.getenv("YOUTUBE_CHANNEL_USERNAME", "").strip()
        ),
        help="YouTube username/handle to mention in Instagram captions.",
    )
    parser.add_argument(
        "--extra-keywords",
        default="valorant,valorant clips,shorts,gaming,fps",
        help="Comma-separated keywords to guide metadata generation.",
    )
    parser.add_argument(
        "--language",
        default="en",
        help="Default language for video metadata.",
    )
    parser.add_argument(
        "--category-id",
        default="20",
        help="YouTube category ID (20 = Gaming).",
    )
    parser.add_argument(
        "--notify-subscribers",
        action="store_true",
        help="Send upload notifications to subscribers.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate and save metadata, but do not upload.",
    )
    parser.add_argument(
        "--edit-only",
        action="store_true",
        default=False,
        help="Perform video trimming, conversion, and music mixing to converted_shorts/, but skip the upload step.",
    )
    parser.add_argument(
        "--skip-uploaded",
        action="store_true",
        default=True,
        help="Skip files already present in the state file.",
    )
    parser.add_argument(
        "--no-skip-uploaded",
        action="store_false",
        dest="skip_uploaded",
        help="Re-upload files even if they exist in the state file.",
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="Disable OpenAI metadata generation and use fallback metadata.",
    )
    parser.add_argument(
        "--require-ai",
        action="store_true",
        default=True,
        help="Fail/skip upload if OpenAI metadata generation is unavailable.",
    )
    parser.add_argument(
        "--allow-fallback",
        action="store_false",
        dest="require_ai",
        help="Allow fallback template metadata if OpenAI generation fails.",
    )
    parser.add_argument(
        "--metadata-history-file",
        default=".metadata_history.json",
        help="Path to persistent history file used to avoid title/description repeats.",
    )
    parser.add_argument(
        "--ai-uniqueness-window",
        type=int,
        default=500,
        help="How many recent title/description entries to compare for uniqueness.",
    )
    parser.add_argument(
        "--ai-metadata-retries",
        type=int,
        default=4,
        help="How many OpenAI regeneration attempts to make for unique metadata.",
    )
    parser.add_argument(
        "--delete-converted-after-upload",
        action="store_true",
        default=True,
        help="Delete temporary converted/cropped file after successful upload.",
    )
    parser.add_argument(
        "--keep-converted-after-upload",
        action="store_false",
        dest="delete_converted_after_upload",
        help="Keep converted/cropped file after successful upload.",
    )
    parser.add_argument(
        "--music-dir",
        default=os.getenv("BG_MUSIC_DIR", "").strip(),
        help="Optional directory of MP3 files to mix under each uploaded short/reel.",
    )
    parser.add_argument(
        "--music-inventory-file",
        default="hollywood_music_inventory.json",
        help="Path to save the discovered MP3 inventory when --music-dir is enabled.",
    )
    parser.add_argument(
        "--music-bg-volume",
        type=float,
        default=0.18,
        help="Relative background music volume/weight when mixing under the original clip audio.",
    )
    parser.add_argument(
        "--trending-audio-report",
        default="",
        help="Path to trending_audio_report.json. When set, downloads top audio tracks via yt-dlp and uses them as --music-dir.",
    )
    parser.add_argument(
        "--trending-audio-cache-dir",
        default=".trending_music_cache",
        help="Directory to cache downloaded trending audio (default: .trending_music_cache).",
    )
    parser.add_argument(
        "--trending-audio-max",
        type=int,
        default=5,
        help="Max trending tracks to download (default: 5).",
    )
    parser.add_argument(
        "--use-trending-audio",
        action="store_true",
        help=(
            "Treat trending audio as a dedicated upload mode: fetch tracks from "
            "--trending-audio-report and replace original video audio completely."
        ),
    )
    parser.add_argument(
        "--crosspost-meta",
        action="store_true",
        help="After a successful YouTube upload, also upload the same file to Instagram/Facebook Reels.",
    )
    parser.add_argument(
        "--meta-platform",
        choices=["both", "instagram", "facebook"],
        default="both",
        help="Which Meta platform(s) to cross-post to when --crosspost-meta is enabled.",
    )
    parser.add_argument(
        "--meta-reels-state-file",
        default=".meta_reels_upload_state.json",
        help="Path to save Instagram/Facebook reels upload state during YouTube runs.",
    )
    parser.add_argument(
        "--meta-graph-version",
        default="v25.0",
        help="Meta Graph API version used for cross-posting.",
    )
    parser.add_argument(
        "--meta-access-token",
        default=(
            os.getenv("META_PAGE_ACCESS_TOKEN", "").strip()
            or os.getenv("META_ACCESS_TOKEN", "").strip()
            or os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN", "").strip()
        ),
        help="Meta Page access token for Instagram/Facebook cross-posting.",
    )
    parser.add_argument(
        "--meta-ig-user-id",
        default=os.getenv("INSTAGRAM_USER_ID", "").strip() or os.getenv("IG_USER_ID", "").strip(),
        help="Instagram professional account ID for cross-posting.",
    )
    parser.add_argument(
        "--meta-facebook-page-id",
        default=os.getenv("FACEBOOK_PAGE_ID", "").strip() or os.getenv("FB_PAGE_ID", "").strip(),
        help="Facebook Page ID for cross-posting.",
    )
    parser.add_argument(
        "--meta-poll-attempts",
        type=int,
        default=30,
        help="Max status polling attempts for Instagram reel readiness during cross-posting.",
    )
    parser.add_argument(
        "--meta-poll-interval-seconds",
        type=float,
        default=4.0,
        help="Seconds between Instagram reel status polls during cross-posting.",
    )
    parser.add_argument(
        "--meta-request-timeout-seconds",
        type=float,
        default=120.0,
        help="HTTP timeout for each Meta API request during cross-posting.",
    )
    parser.add_argument(
        "--meta-skip-uploaded",
        action="store_true",
        default=True,
        help="Skip Meta cross-posts already marked successful in the Meta reels state file.",
    )
    parser.add_argument(
        "--no-meta-skip-uploaded",
        action="store_false",
        dest="meta_skip_uploaded",
        help="Do not skip Meta cross-posts already present in the Meta reels state file.",
    )
    parser.add_argument(
        "--meta-instagram-retries",
        type=int,
        default=3,
        help="How many times to retry Instagram cross-posting when Meta returns a transient processing failure.",
    )
    parser.add_argument(
        "--meta-instagram-retry-delay-seconds",
        type=float,
        default=20.0,
        help="Seconds to wait between Instagram processing-failure retries.",
    )
    parser.add_argument(
        "--use_trending_audio",
        action="store_true",
        default=False,
        help="Whether to use trending audio for uploads.",
    )
    parser.add_argument(
        "--continue-on-platform-error",
        action="store_true",
        default=False,
        help="Continue remaining platform uploads in sequence even when one platform fails.",
    )
    parser.add_argument('--schedule-plan', default=None, help='JSON schedule: [{"count": N, "publish_at": "ISO UTC datetime"}]')
    parser.add_argument(
        "--schedule-progress-file",
        default=".schedule_upload_progress.json",
        help="Path to schedule slot progress state used to resume partially-filled scheduled batches.",
    )
    return parser.parse_args()
