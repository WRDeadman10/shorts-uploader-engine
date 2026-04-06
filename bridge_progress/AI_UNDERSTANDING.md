# AI Understanding

Status: `confirmed`
Project: `shorts-uploader-engine`
Type: `node` | Language: `JavaScript/TypeScript`

## Summary

Node project (JavaScript/TypeScript), 75 source files scanned. Patterns: Framework: React.

## Important Docs

- `README.md`: # Shorts Uploader Engine This repository automates a Valorant short-form video pipeline: discover local source clips generate metadata upload to YouTube Shorts cross-post to Instagram and Facebook Reels audit live platform uploads against the local video library ## Content Command Center The repository now also contains a modular Electron + React desktop app under named Content Command Center. Current UI stack: Electron main process with preload bridge and IPC handlers React renderer with state-based page routing Zustand for shared UI state Framer Motion for transitions and interaction feedback Current UI modules: page modules for Dashboard, Library, Upload, Console, Audit, and Metadata Current UI behavior: renderer does not access Node directly preload exposes a safe Electron communication uses and Electron main can launch the existing Python scripts and stream stdout/stderr to the UI Library and Audit screens read the existing JSON state and ledger files the Tkinter launcher still exists and remains supported ## Desktop UI ### Tkinter launcher for the existing scripts. Responsibilities: expose the available CLI arguments as form fields validate common input combinations before launch show the exact generated command before execution stream script output live in the UI console persist the last-used values for each tab in Covered scripts: Typical usage: Behavior: saved form values are restored on the next launch scripts are launched unbuffered so the UI console updates progressively during long runs the UI wraps the existing scripts and does not replace their CLI entry points ## Main Scripts ### Primary YouTube uploader.
- `missingFeatures/README.md`: # Missing Features This folder contains one short Markdown brief per missing Electron + React UI feature. Purpose: help an AI or developer understand the gap quickly map the missing UI capability back to the existing Python scripts make implementation planning easier without rereading the whole repo Scope: these docs compare the React + Electron app in against the currently available script capabilities in the repository root and, where useful, against the richer Tkinter launcher in Each file is intentionally brief and implementation-oriented.
- `.aider.chat.history.md`: # aider chat started at 2026-04-06 00:00:32 Can't initialize prompt toolkit: Found xterm-256color, while expecting a Windows console. Maybe try to run this program using "winpty" or run it in cmd.exe instead. Or otherwise, in case of Cygwin, use the Python executable that is compiled for Cygwin.
- `AGENT_CONTEXT.md`: # AGENT_CONTEXT ## Purpose This repository is a script-driven pipeline for uploading Valorant gameplay clips as short-form content to: YouTube Shorts Instagram Reels Facebook Reels It also includes reporting and audit tooling for comparing the local clip library against live platform upload data. The repository now has two operator-facing UI layers: the existing Tkinter launcher in a newer Electron + React desktop app in named Content Command Center ## Architecture The core automation architecture is still file-based and script-centric. There is no application framework, package layout, or database.
- `AI_UNDERSTANDING.md`: # AI Understanding ## Project Summary is an operations-focused repository for publishing Valorant clips as short-form video content across YouTube Shorts, Instagram Reels, and Facebook Reels. The repository is centered on Python scripts and local JSON state files rather than a packaged backend application or database-backed service. It also contains two desktop operator interfaces: a mature Tkinter launcher in a newer Electron + React desktop app in The core mental model is: discover local source videos identify each clip by a stable file key generate metadata and derived media artifacts upload to one or more platforms persist local state and upload ledgers audit live platform inventories against the local library ## Architecture Summary ### Script-first automation The repository's primary business logic lives in top-level Python scripts: There is no shared Python package layout.

## Key Files

- `.facebook_uploaded_videos.json`: {
- `.instagram_uploaded_videos.json`: {
- `.meta_reels_upload_state.json`: {
- `.meta_setup_progress.json`: {
- `.metadata_history.json`: {
- `.project_ui_launcher_state.json`: {
- `.youtube_upload_state.json`: {
- `.youtube_uploaded_videos.json`: {
- `AGENT_CONTEXT.md`: This repository is a script-driven pipeline for uploading Valorant gameplay clips as short-form content to:
- `AI_UNDERSTANDING.md`: `shorts-uploader-engine` is an operations-focused repository for publishing Valorant clips as short-form video content across YouTube Shorts, Instagram Reels, and Facebook Reels.
- `README.md`: This repository automates a Valorant short-form video pipeline:
- `app/App.jsx`: no description

## Architecture Signals

- Framework: React
- file-based JSON state
- platform upload pipeline plus live audit pipeline
- script-first orchestration
- two desktop operator UIs over shared scripts and ledgers

## User Clarifications

- No test suite was found.
- Operational state is stored as mutable root JSON files.
- Large generated media and audit artifacts can dirty the repository quickly.
- The upload flow depends on local credentials and API access.
- youtubeBatchUpload.py imports from a sibling valorant_clip_data_extractor_v3 project.

## Context Text

This is the compact context summary that can be reused in later bridge sessions.

```text
PROJECT: shorts-uploader-engine (node/JavaScript/TypeScript)
(roles inferred by static scan — not task-authored)
SUMMARY: Node project (JavaScript/TypeScript), 75 source files scanned. Patterns: Framework: React.

DOCUMENTATION SIGNALS:
  README.md
    -> # Shorts Uploader Engine This repository automates a Valorant short-form video pipeline: discover local source clips generate metadata upload to YouTube Shorts cross-post to Instagram and Facebook Reels audit live platform uploads against the local video library ## Content Command Center The repository now also contains a modular Electron + React desktop app under named Content Command Center. Current UI stack: Electron main process with preload bridge and IPC handlers React renderer with state-based page routing Zustand for shared UI state Framer Motion for transitions and interaction feedback Current UI modules: page modules for Dashboard, Library, Upload, Console, Audit, and Metadata Current UI behavior: renderer does not access Node directly preload exposes a safe Electron communication uses and Electron main can launch the existing Python scripts and stream stdout/stderr to the UI Library and Audit screens read the existing JSON state and ledger files the Tkinter launcher still exists and remains supported ## Desktop UI ### Tkinter launcher for the existing scripts. Responsibilities: expose the available CLI arguments as form fields validate common input combinations before launch show the exact generated command before execution stream script output live in the UI console persist the last-used values for each tab in Covered scripts: Typical usage: Behavior: saved form values are restored on the next launch scripts are launched unbuffered so the UI console updates progressively during long runs the UI wraps the existing scripts and does not replace their CLI entry points ## Main Scripts ### Primary YouTube uploader.
  missingFeatures/README.md
    -> # Missing Features This folder contains one short Markdown brief per missing Electron + React UI feature. Purpose: help an AI or developer understand the gap quickly map the missing UI capability back to the existing Python scripts make implementation planning easier without rereading the whole repo Scope: these docs compare the React + Electron app in against the currently available script capabilities in the repository root and, where useful, against the richer Tkinter launcher in Each file is intentionally brief and implementation-oriented.
  .aider.chat.history.md
    -> # aider chat started at 2026-04-06 00:00:32 Can't initialize prompt toolkit: Found xterm-256color, while expecting a Windows console. Maybe try to run this program using "winpty" or run it in cmd.exe instead. Or otherwise, in case of Cygwin, use the Python executable that is compiled for Cygwin.
  AGENT_CONTEXT.md
    -> # AGENT_CONTEXT ## Purpose This repository is a script-driven pipeline for uploading Valorant gameplay clips as short-form content to: YouTube Shorts Instagram Reels Facebook Reels It also includes reporting and audit tooling for comparing the local clip library against live platform upload data. The repository now has two operator-facing UI layers: the existing Tkinter launcher in a newer Electron + React desktop app in named Content Command Center ## Architecture The core automation architecture is still file-based and script-centric. There is no application framework, package layout, or database.
  AI_UNDERSTANDING.md
    -> # AI Understanding ## Project Summary is an operations-focused repository for publishing Valorant clips as short-form video content across YouTube Shorts, Instagram Reels, and Facebook Reels. The repository is centered on Python scripts and local JSON state files rather than a packaged backend application or database-backed service. It also contains two desktop operator interfaces: a mature Tkinter launcher in a newer Electron + React desktop app in The core mental model is: discover local source videos identify each clip by a stable file key generate metadata and derived media artifacts upload to one or more platforms persist local state and upload ledgers audit live platform inventories against the local library ## Architecture Summary ### Script-first automation The repository's primary business logic lives in top-level Python scripts: There is no shared Python package layout.

FILE REGISTRY (what each file does):
  .facebook_uploaded_videos.json
    -> {
  .instagram_uploaded_videos.json
    -> {
  .meta_reels_upload_state.json
    -> {
  .meta_setup_progress.json
    -> {
  .metadata_history.json
    -> {
  .project_ui_launcher_state.json
    -> {
  .youtube_upload_state.json
    -> {
  .youtube_uploaded_videos.json
    -> {
  AGENT_CONTEXT.md
    -> This repository is a script-driven pipeline for uploading Valorant gameplay clips as short-form content to:
  AI_UNDERSTANDING.md
    -> `shorts-uploader-engine` is an operations-focused repository for publishing Valorant clips as short-form video content across YouTube Shorts, Instagram Reels, and Facebook Reels.
  README.md
    -> This repository automates a Valorant short-form video pipeline:
  app/App.jsx
    -> no description
  app/Audit.jsx
    -> no description
  app/Card.jsx
    -> no description
  app/Console.jsx
    -> no description
  app/Dashboard.jsx
    -> no description
  app/Library.jsx
    -> no description
  app/Metadata.jsx
    -> no description
  app/ProgressBar.jsx
    -> no description
  app/Sidebar.jsx
    -> no description
  app/StatusBadge.jsx
    -> no description
  app/ToggleSwitch.jsx
    -> no description
  app/Topbar.jsx
    -> no description
  app/Upload.jsx
    -> no description
  app/electron/ipc/systemHandlers.js
    -> no description
  app/electron/ipc/uploadHandlers.js
    -> no description
  app/electron/main.js
    -> no description
  app/electron/preload.js
    -> no description
  app/electron/services/dataService.js
    -> no description
  app/electron/services/pathService.js
    -> no description
  app/electron/services/pythonService.js
    -> no description
  app/electron/services/uploadService.js
    -> Runs Python upload scripts as child processes, tracks status, and streams logs back to the renderer.
  app/global.css
    -> :root
  app/main.jsx
    -> no description
  app/useAppStore.js
    -> exports pageOrder, useAppStore
  generateLiveUploadAudit.py
    -> Fetch live upload data from YouTube, Instagram, and Facebook and compare it to local videos
  generateUploadStatusReport.py
    -> Generate a JSON report for local videos and per-platform upload coverage
  hollywood_music_inventory.json
    -> {
  index.html
    -> <!doctype html>
  metaBatchReelsUpload.py
    -> Upload existing clips as Instagram and Facebook Reels using Meta Graph API
  missingFeatures/FEATURE_STATUS.md
    -> Use this file to track which Electron + React parity features are still pending and which have been completed.
  missingFeatures/IMPLEMENTATION_PLAN.md
    -> This plan turns the missing-feature analysis into a practical bridge + Aider workflow.
  missingFeatures/README.md
    -> This folder contains one short Markdown brief per missing Electron + React UI feature.
  missingFeatures/advanced-ai-metadata-settings.md
    -> The Electron UI only has a simple "AI Metadata" toggle and misses the advanced metadata controls already supported by the script.
  missingFeatures/audit-page-uses-local-status-not-live-audit.md
    -> The current Audit page is not a true live-audit view.
  missingFeatures/console-missing-command-history-and-export.md
    -> The Console page streams logs, but it is still thin compared to operator needs.
  missingFeatures/credential-management-fields.md
    -> The Electron UI does not expose required operator credential inputs.
  missingFeatures/cross-platform-queue-filters.md
    -> The Electron UI does not expose the queue filtering features used for oldest-first cross-platform operations.
  missingFeatures/dashboard-missing-operational-actions.md
    -> The Dashboard is currently read-only.
  missingFeatures/dry-run-and-validation-modes.md
    -> The Electron UI does not expose dry-run and validation-oriented script modes in a clear way.
  missingFeatures/ffmpeg-and-ffprobe-settings.md
    -> The Electron UI does not expose ffmpeg and ffprobe path settings.
  missingFeatures/library-missing-search-sort-and-details.md
    -> The Library page shows cards, but important operator features are missing.
  missingFeatures/live-upload-audit-runner.md
    -> The Electron UI does not provide a first-class flow for `generateLiveUploadAudit.py`.
  missingFeatures/max-videos-control.md
    -> The Electron UI hardcodes upload batches to one item.
  missingFeatures/meta-publishing-advanced-options.md
    -> The Electron UI does not expose the deeper Meta upload controls from `metaBatchReelsUpload.py`.
  missingFeatures/metadata-page-not-persisted.md
    -> The Metadata page is currently a local editor shell, not a real metadata workflow.
  missingFeatures/music-overlay-sample-flow.md
    -> The Electron UI does not expose the dedicated sample-generation workflow from `musicOverlaySample.py`.
  missingFeatures/music-workflow-settings.md
    -> The Electron UI has only a simple "Music Overlay" toggle and does not expose the real music workflow controls.
  missingFeatures/rebuild-upload-comparison-flow.md
    -> The Electron UI does not expose `rebuildUploadComparison.py`.
  missingFeatures/script-surface-parity-with-tkinter.md
    -> The Electron UI does not yet match the script surface already exposed by `projectUiLauncher.py`.
  missingFeatures/setup-and-environment-checks.md
    -> The Electron UI does not provide a proper setup screen or environment validation workflow.
  missingFeatures/ui-state-persistence-parity.md
    -> The Electron UI does not have parity with the Tkinter launcher's persisted per-script state.
  missingFeatures/upload-status-report-flow.md
    -> The Electron UI does not expose `generateUploadStatusReport.py`.
  missingFeatures/video-discovery-filters.md
    -> The Electron UI does not expose file discovery filters.
  missingFeatures/videos-root-selection.md
    -> The Electron UI cannot choose the source video root directory.
  missingFeatures/youtube-fix-repeated-metadata-flow.md
    -> The Electron UI does not expose the maintenance workflow from `youtubeFixRepeatedMetadata.py`.
  missingFeatures/youtube-privacy-and-playlist.md
    -> The Electron UI does not expose YouTube publishing controls for privacy or playlist placement.
  musicOverlaySample.py
    -> exposes parse_args, load_json_file, save_json_file, build_music_inventory, pick_sample_video
  package-lock.json
    -> {
  package.json
    -> {
  projectUiLauncher.py
    -> defines OptionSpec, ScriptSpec, ScriptTab, LauncherApp; exposes resolve_path, validate_youtube, validate_meta, validate_fix_metadata, validate_music_sample
  rebuildUploadComparison.py
    -> Rebuild upload_comparison
  requirements.txt
    -> google-api-python-client>=2.170.0
  youtubeBatchUpload.py
    -> Batch-upload YouTube Shorts with AI-generated metadata
  youtubeFixRepeatedMetadata.py
    -> Fix repeated title/description metadata for already uploaded YouTube videos

CODE PATTERNS:
  -Framework: React
  -file-based JSON state
  -platform upload pipeline plus live audit pipeline
  -script-first orchestration
  -two desktop operator UIs over shared scripts and ledgers

ALREADY IMPLEMENTED: Per-video generated metadata artifacts., Converted or remixed video outputs for upload pipelines., Offline inventory, live platform snapshots, and upload comparison outputs., Upload, Console, Library, pathService

USER CLARIFICATIONS:
  -No test suite was found.
  -Operational state is stored as mutable root JSON files.
  -Large generated media and audit artifacts can dirty the repository quickly.
  -The upload flow depends on local credentials and API access.
  -youtubeBatchUpload.py imports from a sibling valorant_clip_data_extractor_v3 project.

LAST RUN: 2026-04-06 | 0 tasks | "Implement missing features"
```
