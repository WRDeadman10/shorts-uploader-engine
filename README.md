# Shorts Uploader Engine

This repository automates a Valorant short-form video pipeline:

1. discover local source clips
2. generate metadata
3. upload to YouTube Shorts
4. cross-post to Instagram and Facebook Reels
5. audit live platform uploads against the local video library

## Content Command Center

The repository now also contains a modular Electron + React desktop app under `app/` named Content Command Center.

Current UI stack:
- Electron main process with preload bridge and IPC handlers
- React renderer with state-based page routing
- Zustand for shared UI state
- Framer Motion for transitions and interaction feedback

Current UI modules:
- `app/electron/main.js`
- `app/electron/preload.js`
- `app/electron/ipc/`
- `app/App.jsx`
- `app/useAppStore.js`
- page modules for Dashboard, Library, Upload, Console, Audit, and Metadata

Current UI behavior:
- renderer does not access Node directly
- preload exposes a safe `window.api`
- Electron communication uses `ipcRenderer.invoke` and `ipcMain.handle`
- Electron main can launch the existing Python scripts and stream stdout/stderr to the UI
- Library and Audit screens read the existing JSON state and ledger files
- the Tkinter launcher still exists and remains supported

## Desktop UI

### `projectUiLauncher.py`

Tkinter launcher for the existing scripts.

Responsibilities:
- expose the available CLI arguments as form fields
- validate common input combinations before launch
- show the exact generated command before execution
- stream script output live in the UI console
- persist the last-used values for each tab in `.project_ui_launcher_state.json`

Covered scripts:
- `youtubeBatchUpload.py`
- `metaBatchReelsUpload.py`
- `youtubeFixRepeatedMetadata.py`
- `musicOverlaySample.py`

Typical usage:

```powershell
python projectUiLauncher.py
```

Behavior:
- saved form values are restored on the next launch
- scripts are launched unbuffered so the UI console updates progressively during long runs
- the UI wraps the existing scripts and does not replace their CLI entry points

## Main Scripts

### `youtubeBatchUpload.py`

Primary YouTube uploader.

Responsibilities:
- scan a local video root
- choose a target upload platform from one centralized entry point
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

Centralized oldest-first platform uploads:

```powershell
python youtubeBatchUpload.py --root "E:\New folder\Valorant Tracker\VALORANT" --upload-platform youtube --max-videos 10
python youtubeBatchUpload.py --root "E:\New folder\Valorant Tracker\VALORANT" --upload-platform instagram --max-videos 10
python youtubeBatchUpload.py --root "E:\New folder\Valorant Tracker\VALORANT" --upload-platform facebook --max-videos 10
```

Behavior:
- videos are queued oldest-first by file modified time
- the queue is filtered by offline platform state only
- the target platform is always treated as required missing
- if no compare filters are passed, the clip must be missing on all platforms

Comparison examples:

```powershell
python youtubeBatchUpload.py --upload-platform instagram --require-uploaded-on youtube --require-missing-on instagram --max-videos 30
python youtubeBatchUpload.py --upload-platform facebook --require-uploaded-on youtube --require-missing-on facebook --max-videos 30
python youtubeBatchUpload.py --upload-platform facebook --require-uploaded-on instagram --require-missing-on facebook --max-videos 30
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

### `youtubeFixRepeatedMetadata.py`

Maintenance script for fixing repeated YouTube titles and descriptions on already uploaded videos.

### `musicOverlaySample.py`

Utility script for building a music inventory and creating a sample output with background music mixed under the original video audio.

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

### Per-platform upload ledgers

These files are updated during upload runs and keep both successful and failed upload attempts:

- `.youtube_uploaded_videos.json`
- `.instagram_uploaded_videos.json`
- `.facebook_uploaded_videos.json`

These are local execution ledgers, not live audit snapshots.

### `generated_metadata/`

Stores metadata JSON files generated per uploaded clip.

### `converted_shorts/`

Stores generated Shorts-ready video files and intermediate render outputs.

Notes:
- converted cache files are validated before reuse
- invalid cached converted outputs are automatically rebuilt
- conversion and music-mix outputs are written through temporary files first so partial MP4s are not reused as valid cache entries

### `.project_ui_launcher_state.json`

Stores the last-used values from the desktop UI launcher on a per-script basis.

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

Install the Electron app dependencies:

```powershell
npm install
```

Run the Electron app in development mode:

```powershell
npm run dev
```

Build the renderer for production and launch Electron:

```powershell
npm run build
npm start
```

Launch the desktop UI:

```powershell
python projectUiLauncher.py
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
- `.project_ui_launcher_state.json` is local UI state and should usually not be committed.
- The repo contains operational scripts, not a packaged Python module.
- `app/` is a desktop UI over the same Python scripts and JSON state files used by the existing Tkinter launcher.
- The Electron app expects Node.js/npm to be installed locally.
