# AI Understanding

## Project Summary

`shorts-uploader-engine` is an operations-focused repository for publishing Valorant clips as short-form video content across YouTube Shorts, Instagram Reels, and Facebook Reels.

The repository is centered on Python scripts and local JSON state files rather than a packaged backend application or database-backed service. It also contains two desktop operator interfaces:

- a mature Tkinter launcher in `projectUiLauncher.py`
- a newer Electron + React desktop app in `app/`

The core mental model is:

1. discover local source videos
2. identify each clip by a stable file key
3. generate metadata and derived media artifacts
4. upload to one or more platforms
5. persist local state and upload ledgers
6. audit live platform inventories against the local library

## Architecture Summary

### Script-first automation

The repository's primary business logic lives in top-level Python scripts:

- `youtubeBatchUpload.py`
- `metaBatchReelsUpload.py`
- `generateLiveUploadAudit.py`
- `rebuildUploadComparison.py`
- `generateUploadStatusReport.py`
- `youtubeFixRepeatedMetadata.py`
- `musicOverlaySample.py`

There is no shared Python package layout. Common patterns are duplicated across scripts:

- recursive video discovery
- extension and exclude filtering
- JSON load/save helpers
- stable file-key generation
- path resolution for generated assets and source videos

### State model

Operational state is persisted in repository-root JSON files. The most important identity is:

```text
relative_path|file_size|modified_time
```

That stable key links together:

- YouTube upload state
- Meta reels upload state
- per-platform upload ledgers
- local/live audit comparisons
- Electron UI library rows

### UI layers

#### Tkinter launcher

`projectUiLauncher.py` is a production-facing wrapper around the Python scripts. It exposes script arguments as form controls, validates input combinations, shows a generated command preview, runs subprocesses, and streams console output.

#### Electron + React app

`app/` is a more modern "Content Command Center" desktop shell:

- Electron main process creates the window and registers IPC handlers
- preload exposes a safe `window.api`
- React renderer uses state-based page routing
- Zustand stores renderer state
- Framer Motion drives page transitions and some interaction effects

The Electron app already launches Python scripts through `uploadService.js`, reads root JSON files through `dataService.js`, and polls process state. It is not just a mock layout, although some areas still look like early product scaffolding.

## Key Modules

### Root Python scripts

#### `youtubeBatchUpload.py`

Primary orchestration entry point.

Responsibilities:

- discover source videos
- centralize platform selection using `--upload-platform`
- skip previously uploaded clips using `.youtube_upload_state.json`
- convert clips into Shorts format when needed
- optionally add background music
- generate AI metadata
- upload to YouTube
- optionally add playlist entries
- optionally cross-post to Meta platforms

Notable characteristics:

- imports helpers from `metaBatchReelsUpload.py` for cross-post logic
- depends on Google OAuth, YouTube Data API, OpenAI, and ffmpeg/ffprobe
- appends a sibling project path for `valorant_clip_data_extractor_v3`
- behaves like the operational center of gravity for the repo

#### `metaBatchReelsUpload.py`

Cross-posting script for Instagram and Facebook.

Responsibilities:

- read `.youtube_upload_state.json` as the source inventory
- publish to Instagram and/or Facebook via Meta Graph API
- write `.meta_reels_upload_state.json`
- update Instagram and Facebook upload ledgers
- optionally clean up temporary converted outputs after successful upload

Important operator detail:

- Instagram requires a numeric professional account ID
- Facebook uploads use a page ID

#### `generateLiveUploadAudit.py`

Networked audit script.

Responsibilities:

- discover local videos
- fetch live YouTube uploads
- fetch live Instagram uploads
- fetch live Facebook uploads
- build `live_upload_audit/offline_videos.json`
- annotate live entries with `matched_state_key` hints
- emit `live_upload_audit/upload_comparison.json`

This script is the main "ground truth reconciliation" workflow for the repo.

#### `rebuildUploadComparison.py`

Offline-only comparison rebuild.

Use this when live platform JSON snapshots already exist and only the comparison output needs to be recomputed.

#### `generateUploadStatusReport.py`

Local-only aggregate status report.

It scans the source library, counts offline matches in the YouTube and Meta state files, and writes `upload_status_report.json`.

This report is also reused by the Electron path service to infer the active video root.

#### `projectUiLauncher.py`

Structured Tkinter launcher with typed option metadata (`OptionSpec`, `ScriptSpec`) and per-tab command building. It persists per-script form state to `.project_ui_launcher_state.json`.

### Electron application

#### `app/electron/main.js`

- creates the desktop window
- loads Vite dev server in development and `dist/index.html` in production
- registers upload and system IPC handlers

#### `app/electron/preload.js`

- expected safe boundary between renderer and Node/Electron APIs

#### `app/electron/services/uploadService.js`

- resolves Python executable
- builds Python script commands
- spawns long-running upload processes
- tracks current process status
- streams stdout/stderr back to the renderer
- supports stop behavior, including `taskkill` on Windows

#### `app/electron/services/dataService.js`

- reads root JSON ledgers and state files
- derives platform flags per clip
- builds library rows for the renderer
- resolves source file paths via `pathService`

#### `app/useAppStore.js`

- central Zustand store
- page navigation state
- video inventory and filtering
- metadata editing state
- upload status polling
- log accumulation

## Data Files That Matter

### System-of-record style operational state

- `.youtube_upload_state.json`
- `.meta_reels_upload_state.json`

### Per-platform execution ledgers

- `.youtube_uploaded_videos.json`
- `.instagram_uploaded_videos.json`
- `.facebook_uploaded_videos.json`

### Generated outputs

- `generated_metadata/`
- `converted_shorts/`
- `live_upload_audit/`

### Local UI/operator state

- `.project_ui_launcher_state.json`
- `.meta_setup_progress.json`

## Current Capabilities

- upload local clips to YouTube Shorts
- cross-post clips to Instagram Reels and Facebook Reels
- maintain local upload state across runs
- generate AI-assisted metadata
- create Shorts-friendly converted outputs
- optionally add background music overlays
- keep separate ledgers for platform upload attempts
- audit live platform inventories against local inventory
- rebuild comparison results without network access
- operate through either Tkinter or Electron desktop interfaces

## Important Patterns

### 1. Stable-key-first tracking

Most repository behavior is built around the stable local clip key rather than a database ID or media hash.

### 2. File-based workflow state

JSON in the repo root is the working memory of the system. Any change to those files can materially affect behavior.

### 3. Root-script orchestration over reusable modules

The repo is optimized for practical operations and iteration speed, not library design.

### 4. Shared local inventory, multiple views

The same underlying state powers:

- upload scripts
- Tkinter launcher
- Electron library/audit views
- local reports

## Risks And Constraints

- no test suite was found
- credentials are file/env based and easy to mishandle
- generated JSON/media artifacts are large and can dirty the repo quickly
- some functionality depends on sibling-project imports outside this repo
- shared helper logic is duplicated across scripts
- audit matching to local files is partly heuristic
- React UI state and Electron services appear ahead of some deeper workflow polish

## Recommended Context Order For Future Sessions

When resuming work in this repo, read in this order:

1. `AI_UNDERSTANDING.md`
2. `bridge_progress/project_knowledge.json`
3. `bridge_progress/project_snapshot.json`
4. `README.md`
5. `AGENT_CONTEXT.md`
6. only then open the specific script or UI module relevant to the task

## Suggested Next Improvements

- extract shared Python helpers for discovery, JSON IO, and stable-key handling
- add a central config file or env template
- add tests around file-key generation, state loading, and audit comparison
- separate committed code from volatile operational artifacts more aggressively
- document the external dependency on `valorant_clip_data_extractor_v3`
- decide the long-term relationship between the Tkinter launcher and Electron app
