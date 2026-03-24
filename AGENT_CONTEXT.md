# AGENT_CONTEXT

## Purpose

This repository is a script-driven pipeline for uploading Valorant gameplay clips as short-form content to:

- YouTube Shorts
- Instagram Reels
- Facebook Reels

It also includes reporting and audit tooling for comparing the local clip library against live platform upload data.

## Architecture

The architecture is file-based and script-centric.

There is no application framework, package layout, or database. State is persisted in JSON files in the repository root.

Core flow:

1. scan local clip files from a root video directory
2. build a stable file key from relative path, size, and mtime
3. generate metadata and optional converted Shorts assets
4. upload to YouTube
5. optionally cross-post to Instagram and Facebook
6. save local upload state
7. fetch live platform uploads later for auditing
8. compare live uploads to the offline library

## Module Responsibilities

### `youtubeBatchUpload.py`

Primary orchestration script.

Responsibilities:
- discover local videos
- compute stable file keys
- choose the target upload platform from one centralized script entry point
- skip previously uploaded files
- inspect media with ffmpeg/ffprobe
- convert videos to 9:16 Shorts format when needed
- optionally mix background music
- generate AI metadata
- upload to YouTube
- add uploaded videos to a playlist
- update `.youtube_upload_state.json`
- optionally call Meta cross-post functions

Dependencies:
- Google OAuth / YouTube Data API
- OpenAI
- ffmpeg / ffprobe
- local JSON state files

### `metaBatchReelsUpload.py`

Meta publishing layer.

Responsibilities:
- load source entries from `.youtube_upload_state.json`
- resolve source file paths
- publish to Instagram Reels
- publish to Facebook Reels
- update `.meta_reels_upload_state.json`

Important detail:
- Instagram expects a numeric professional account ID, not a username
- Facebook publishing uses a page ID

### `generateLiveUploadAudit.py`

Live audit fetcher.

Responsibilities:
- build `offline_videos.json` from the local video root
- fetch live YouTube uploads
- fetch live Instagram uploads
- fetch live Facebook uploads
- annotate remote entries with local `matched_state_key` guesses
- build `upload_comparison.json`

Important detail:
- `--upload-platform` can run oldest-first uploads for `youtube`, `instagram`, or `facebook`
- `--require-uploaded-on` and `--require-missing-on` define cross-platform queue filters
- if both compare filters are omitted, queue selection defaults to clips missing on all platforms
- `uploaded_count` in comparison is count-based
- `matched_state_keys_count` is match-based
- `matched_state_keys` and `not_uploaded_state_keys` are preserved for traceability

### `rebuildUploadComparison.py`

Local-only comparison rebuilder.

Responsibilities:
- read existing audit JSON files
- rebuild `upload_comparison.json`
- avoid all network requests

Use this when:
- platform JSON files are already correct
- only the comparison output needs to be updated

### `generateUploadStatusReport.py`

Simple local status report.

Responsibilities:
- count videos from a local root
- count local offline state coverage
- generate a lightweight JSON report

### `youtubeFixRepeatedMetadata.py`

Maintenance utility for metadata cleanup or correction in the YouTube upload flow.

### `musicOverlaySample.py`

Experimental or utility script related to mixing background music onto videos.

### `projectUiLauncher.py`

Desktop Tkinter launcher for the existing scripts.

Responsibilities:
- render a tabbed UI for the main operational scripts
- expose CLI arguments as form inputs
- validate common path and credential combinations before execution
- launch the scripts as subprocesses without changing their internal logic
- stream subprocess output live in the UI console
- persist last-used values in `.project_ui_launcher_state.json`

## File Structure

### Root scripts

- `youtubeBatchUpload.py`
- `metaBatchReelsUpload.py`
- `generateLiveUploadAudit.py`
- `rebuildUploadComparison.py`
- `generateUploadStatusReport.py`
- `youtubeFixRepeatedMetadata.py`
- `musicOverlaySample.py`
- `projectUiLauncher.py`

### Root state files

- `.youtube_upload_state.json`
- `.meta_reels_upload_state.json`
- `.youtube_uploaded_videos.json`
- `.instagram_uploaded_videos.json`
- `.facebook_uploaded_videos.json`
- `.metadata_history.json`
- `.meta_setup_progress.json`
- `.project_ui_launcher_state.json`

### Credentials

- `client_secret.json`
- `token.json`

### Generated directories

- `generated_metadata/`
- `converted_shorts/`
- `live_upload_audit/`
- `__pycache__/`

## Data Model

### Stable local key

Most scripts identify a source video using:

```text
relative_path|file_size|modified_time
```

This is the core local identity used across:
- upload state
- cross-post state
- audit matching

### YouTube state

Stored in `.youtube_upload_state.json`.

Each entry usually contains:
- `video_id`
- `relative_path`
- `uploaded_at_utc`
- `title`
- `metadata_file`
- `uploaded_file_path`
- `background_music_file`
- optional playlist fields

### Meta state

Stored in `.meta_reels_upload_state.json`.

Each entry is keyed by the same stable local key and may contain:
- `instagram.status`
- `instagram.media_id`
- `facebook.status`
- `facebook.video_id`

### Audit outputs

Stored in `live_upload_audit/`.

Files:
- `offline_videos.json`
- `youtube_uploaded_videos.json`
- `instagram_uploaded_videos.json`
- `facebook_uploaded_videos.json`
- `upload_comparison.json`

Important distinction:
- root-level `.youtube_uploaded_videos.json` / `.instagram_uploaded_videos.json` / `.facebook_uploaded_videos.json` are local upload ledgers written during upload execution
- `live_upload_audit/*.json` files are audit snapshots produced by the audit scripts

## Current Capabilities

- upload local clips to YouTube Shorts
- generate AI titles, descriptions, tags, and hashtags
- convert videos to Shorts format
- optionally add background music
- retry background music selection across multiple tracks and fall back to uploading without music
- validate cached converted and music-mixed outputs before reuse
- cross-post uploaded clips to Instagram and Facebook
- persist upload state locally
- persist per-platform upload ledgers locally for both successful and failed attempts
- run the upload and maintenance scripts through a desktop UI with saved last-used form values
- fetch live upload inventories from all supported platforms
- compare live uploads against the local clip inventory
- rebuild comparison output without hitting APIs again

## Current Operational Assumptions

- scripts are run manually from the repository root
- JSON files in the repo root are treated as operational state
- the local video library is outside or alongside the repo in many cases
- this is a workflow tool, not a reusable library
- generated JSON and media outputs can be large
- the UI launcher state file is local operator state and not a system-of-record artifact

## Known Constraints

- matching remote uploads back to exact local files is heuristic unless a strong identifier is present
- Instagram/Facebook captions do not always contain a unique local clip marker
- platform JSON counts can be accurate even when `matched_state_keys_count` is lower
- there is no centralized config file
- credentials are file/env based
- there is no test suite
- there is no `.editorconfig` in the repo
- most operational state is local JSON and easy to dirty during manual runs

## Pending Improvements

- add a real config file for all paths, tokens, and defaults
- split shared helpers into a common module to reduce duplication
- add a `compare-only` mode to `generateLiveUploadAudit.py`
- improve remote-to-local matching with stronger source identifiers embedded in metadata
- add tests for file discovery, key generation, state loading, and comparison logic
- document required environment variables in a dedicated setup section or sample env file
- add log files or structured logging
- ignore generated audit/media artifacts more aggressively in git
- add a small command wrapper or task runner for common workflows
- decide which generated state files should be ignored in git by default

## Recommended Mental Model For Future Agents

When working in this repository, think in terms of:

- local source clips
- stable local file keys
- per-platform upload records
- generated artifacts
- comparison reports

If a user says counts are wrong:
- first determine whether the problem is fetch accuracy or comparison accuracy
- if the platform JSONs are already correct, do not refetch
- prefer rebuilding `upload_comparison.json` locally

If a user says Instagram is failing:
- verify whether they passed a numeric IG professional account ID or only a username
- confirm the Facebook page is linked to that Instagram account

If a user asks to commit:
- avoid bundling unrelated generated media or JSON files unless explicitly requested
