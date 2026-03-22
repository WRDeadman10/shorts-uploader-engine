# Shorts Uploader Engine

This repository automates a Valorant short-form video pipeline:

1. discover local source clips
2. generate metadata
3. upload to YouTube Shorts
4. cross-post to Instagram and Facebook Reels
5. audit live platform uploads against the local video library

## Main Scripts

### `youtubeBatchUpload.py`

Primary YouTube uploader.

Responsibilities:
- scan a local video root
- skip already uploaded files by checking `.youtube_upload_state.json`
- optionally convert videos into Shorts format
- optionally add background music
- generate AI metadata
- upload videos to YouTube
- optionally add uploaded videos to a playlist
- optionally cross-post the same video to Meta platforms

Typical usage:

```powershell
python youtubeBatchUpload.py --root "E:\New folder\Valorant Tracker\VALORANT" --privacy public
```

### `metaBatchReelsUpload.py`

Meta uploader for Instagram Reels and Facebook Reels.

Responsibilities:
- use YouTube-uploaded source entries as input
- publish clips to Instagram and/or Facebook
- persist local Meta upload state in `.meta_reels_upload_state.json`

Typical usage:

```powershell
python metaBatchReelsUpload.py --videos-root "E:\New folder\Valorant Tracker\VALORANT" --platform both
```

### `generateLiveUploadAudit.py`

Fetches live platform upload data and compares it to the local offline inventory.

Responsibilities:
- build `offline_videos.json`
- fetch live uploaded videos from YouTube
- fetch live uploaded videos from Instagram
- fetch live uploaded videos from Facebook
- annotate platform entries with local match hints
- generate `upload_comparison.json`

Output directory:
- `live_upload_audit/`

Typical usage:

```powershell
python generateLiveUploadAudit.py --root "E:\New folder\Valorant Tracker\VALORANT" --meta-access-token "..." --ig-user-id "ganpatigamerboi" --facebook-page-id "1064411090088218"
```

### `rebuildUploadComparison.py`

Rebuilds `live_upload_audit/upload_comparison.json` from the already-saved JSON files without making any API calls.

Typical usage:

```powershell
python rebuildUploadComparison.py
```

### `generateUploadStatusReport.py`

Simple local count report from offline files plus local state files.

Typical usage:

```powershell
python generateUploadStatusReport.py --root "E:\New folder\Valorant Tracker\VALORANT"
```

## Important Data Files

### `.youtube_upload_state.json`

Local source-of-truth state for YouTube uploads.

Each uploaded item is keyed by:

```text
relative_path|file_size|modified_time
```

This key format is reused by the audit scripts.

### `.meta_reels_upload_state.json`

Local state file for Instagram and Facebook uploads.

Structure:
- `entries[state_key].instagram`
- `entries[state_key].facebook`

### `generated_metadata/`

Stores metadata JSON files generated per uploaded clip.

### `converted_shorts/`

Stores generated Shorts-ready video files and intermediate render outputs.

### `live_upload_audit/`

Stores audit outputs:
- `offline_videos.json`
- `youtube_uploaded_videos.json`
- `instagram_uploaded_videos.json`
- `facebook_uploaded_videos.json`
- `upload_comparison.json`

## Setup

Install dependencies:

```powershell
pip install -r requirements.txt
```

Required credentials depend on the script:

### YouTube
- `client_secret.json`
- `token.json`
- `OPENAI_API_KEY` for AI metadata generation

### Meta
- `META_PAGE_ACCESS_TOKEN` or `META_ACCESS_TOKEN`
- `INSTAGRAM_USER_ID` or `IG_USER_ID`
- `FACEBOOK_PAGE_ID` or `FB_PAGE_ID`

## Matching Notes

The audit flow has two comparison modes:

- count-based comparison:
  uses the saved platform JSON file counts directly
- match-based comparison:
  uses local `matched_state_key` annotations where available

In `upload_comparison.json`:
- `uploaded_count` reflects the platform file count
- `matched_state_keys_count` reflects the stricter local matcher result
- `matched_state_keys` and `not_uploaded_state_keys` are preserved for traceability

## Repository Notes

- There is currently no `.editorconfig` in this repository.
- Generated files and media files are large and should usually not be committed unless explicitly needed.
- The repo contains operational scripts, not a packaged Python module.
