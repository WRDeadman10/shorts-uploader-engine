# AI Understanding

Status: `pending confirmation`
Project: `shorts-uploader-engine`
Type: `python` | Language: `JavaScript/TypeScript`

## Summary

# Shorts Uploader Engine This repository automates a Valorant short-form video pipeline: discover local source clips generate metadata upload to YouTube Shorts cross-post to Instagram and Facebook Reels audit live platform uploads against the local video library ## Content Command Center The reposit

## Important Docs

- `README.md`: # Shorts Uploader Engine This repository automates a Valorant short-form video pipeline: discover local source clips generate metadata upload to YouTube Shorts cross-post to Instagram and Facebook Reels audit live platform uploads against the local video library ## Content Command Center The repository now also contains a modular Electron + React desktop app under named Content Command Center. Current UI stack: Electron main process with preload bridge and IPC handlers React renderer with state-based page routing Zustand for shared UI state Framer Motion for transitions and interaction feedback Current UI modules: page modules for Dashboard, Library, Upload, Console, Audit, and Metadata Current UI behavior: renderer does not access Node directly preload exposes a safe Electron communication uses and Electron main can launch the existing Python scripts and stream stdout/stderr to the UI Library and Audit screens read the existing JSON state and ledger files the Tkinter launcher still exists and remains supported ## Desktop UI ### Tkinter launcher for the existing scripts. Responsibilities: expose the available CLI arguments as form fields validate common input combinations before launch show the exact generated command before execution stream script output live in the UI console persist the last-used values for each tab in Covered scripts: Typical usage: Behavior: saved form values are restored on the next launch scripts are launched unbuffered so the UI console updates progressively during long runs the UI wraps the existing scripts and does not replace their CLI entry points ## Main Scripts ### Primary YouTube uploader.
- `missingFeatures/README.md`: # Missing Features This folder contains one short Markdown brief per missing Electron + React UI feature. Purpose: help an AI or developer understand the gap quickly map the missing UI capability back to the existing Python scripts make implementation planning easier without rereading the whole repo Scope: these docs compare the React + Electron app in against the currently available script capabilities in the repository root and, where useful, against the richer Tkinter launcher in Each file is intentionally brief and implementation-oriented.
- `.aider.chat.history.md`: # aider chat started at 2026-04-06 00:00:32 Can't initialize prompt toolkit: Found xterm-256color, while expecting a Windows console. Maybe try to run this program using "winpty" or run it in cmd.exe instead. Or otherwise, in case of Cygwin, use the Python executable that is compiled for Cygwin.
- `AGENT_CONTEXT.md`: # AGENT_CONTEXT ## Purpose This repository is a script-driven pipeline for uploading Valorant gameplay clips as short-form content to: YouTube Shorts Instagram Reels Facebook Reels It also includes reporting and audit tooling for comparing the local clip library against live platform upload data. The repository now has two operator-facing UI layers: the existing Tkinter launcher in a newer Electron + React desktop app in named Content Command Center ## Architecture The core automation architecture is still file-based and script-centric. There is no application framework, package layout, or database.
- `AI_UNDERSTANDING.md`: # AI Understanding ## Project Summary is an operations-focused repository for publishing Valorant clips as short-form video content across YouTube Shorts, Instagram Reels, and Facebook Reels. The repository is centered on Python scripts and local JSON state files rather than a packaged backend application or database-backed service. It also contains two desktop operator interfaces: a mature Tkinter launcher in a newer Electron + React desktop app in The core mental model is: discover local source videos identify each clip by a stable file key generate metadata and derived media artifacts upload to one or more platforms persist local state and upload ledgers audit live platform inventories against the local library ## Architecture Summary ### Script-first automation The repository's primary business logic lives in top-level Python scripts: There is no shared Python package layout.

## Key Files

- `.aider.chat.history.md`: > Can't initialize prompt toolkit: Found xterm-256color, while expecting a Windows console. Maybe try to run this program using "winpty" or run it in cmd.exe instead. Or otherwise, in case of Cygwin,
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

## Architecture Signals

- Framework: React

## Context Text

This is the compact context summary that can be reused in later bridge sessions.

```text
PROJECT: shorts-uploader-engine (python/JavaScript/TypeScript)
(roles inferred by static scan - not task-authored)
SUMMARY: # Shorts Uploader Engine This repository automates a Valorant short-form video pipeline: discover local source clips generate metadata upload to YouTube Shorts cross-post to Instagram and Facebook Reels audit live platform uploads against the local video library ## Content Command Center The reposit

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
  .aider.chat.history.md
    -> > Can't initialize prompt toolkit: Found xterm-256color, while expecting a Windows console. Maybe try to run this program using "winpty" or run it in cmd.exe instead. Or otherwise, in case of Cygwin, 
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
  app/Setup.jsx
    -> Create a new React component file app/Setup.jsx.
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
  app/UploadAdvancedOptions.jsx
    -> Default-export a React component with props options and setUploadOption.
  app/electron/ipc/systemHandlers.js
    -> Fix two things.
  app/electron/preload.js
    -> Add one new entry to the contextBridge.exposeInMainWorld api object: runEnvCheck: function runEnvCheck() { return ipcRenderer.invoke('run-env-check'); }.
  app/electron/services/dataService.js
    -> Add two new exported functions at the bottom of this file, before the module.exports line.
  app/electron/services/uploadService.js
    -> In buildUploadCommand() in uploadService.js, add new arg mappings.
  app/global.css
    -> :root
  app/main.jsx
    -> no description
  app/useAppStore.js
    -> exports pageOrder, useAppStore
  client_secret.json
    -> {"installed":{"client_id":"294354856377-fsnpl75s9sordg6mf6oq2u5jamfevqfe.apps.googleusercontent.com","project_id":"youtube-upload-489217","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_
  client_secret_294354856377-s0e7elinaaj6n7nujnlfv47nsicftnlh.apps.googleusercontent.com.json
    -> {"installed":{"client_id":"294354856377-s0e7elinaaj6n7nujnlfv47nsicftnlh.apps.googleusercontent.com","project_id":"youtube-upload-489217","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_
  generateLiveUploadAudit.py
    -> Fetch live upload data from YouTube, Instagram, and Facebook and compare it to local videos
  generateUploadStatusReport.py
    -> Generate a JSON report for local videos and per-platform upload coverage
  generated_metadata/VALORANT 01-01-2026 22-23-50-114.metadata.json
    -> {
  generated_metadata/VALORANT 01-01-2026 22-27-44-486.metadata.json
    -> {
  generated_metadata/VALORANT 01-01-2026 22-30-00-065.metadata.json
    -> {
  generated_metadata/VALORANT 01-01-2026 22-44-24-319.metadata.json
    -> {
  generated_metadata/VALORANT 01-01-2026 22-50-27-907.metadata.json
    -> {
  generated_metadata/VALORANT 01-01-2026 22-53-03-725.metadata.json
    -> {
  generated_metadata/VALORANT 01-01-2026 22-58-00-769.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-07-35-572.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-14-57-271.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-16-46-604.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-17-56-113.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-18-26-465.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-21-54-521.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-22-46-066.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-38-38-337.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-39-33-381.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-40-54-988.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-42-09-922.metadata.json
    -> {
  generated_metadata/VALORANT 01-03-2026 16-43-00-791.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 0-57-57-840.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 1-06-37-837.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 1-08-03-392.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 1-09-17-161.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 1-14-55-788.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 1-18-07-927.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 1-22-34-870.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 1-27-36-355.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 1-30-00-414.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 1-34-23-807.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 1-42-08-070.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-24-19-689.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-27-29-476.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-33-15-879.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-35-53-342.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-42-35-890.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-42-57-892.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-45-04-051.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-47-17-535.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-47-50-718.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-49-35-029.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-50-26-703.metadata.json
    -> {
  generated_metadata/VALORANT 01-04-2026 2-53-38-842.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-06-49-225.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-09-51-404.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-12-09-913.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-15-30-591.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-17-01-939.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-21-16-079.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-25-49-179.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-27-26-406.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-28-29-340.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-29-44-056.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-30-19-773.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-40-29-242.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-40-52-146.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-46-38-864.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-47-44-126.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-50-18-154.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-52-14-813.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-53-55-626.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-55-19-056.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 22-56-42-578.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-03-52-209.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-08-40-409.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-10-09-422.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-11-24-562.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-12-32-966.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-14-43-634.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-26-48-316.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-28-07-631.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-29-52-495.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-34-19-295.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-34-52-546.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-36-04-859.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-37-03-798.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-41-32-090.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-44-55-153.metadata.json
    -> {
  generated_metadata/VALORANT 01-12-2026 23-50-25-385.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 0-15-28-881.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 0-20-41-966.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 0-22-55-038.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 0-27-51-787.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 0-29-18-115.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 0-37-35-120.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 0-43-45-010.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 0-45-09-676.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 0-49-57-507.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 23-41-35-499.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 23-42-38-986.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 23-44-08-094.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 23-51-57-502.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 23-56-56-183.metadata.json
    -> {
  generated_metadata/VALORANT 01-13-2026 23-58-54-472.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-01-17-380.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-02-40-370.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-04-40-115.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-07-07-878.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-22-47-193.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-23-43-663.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-32-24-960.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-35-04-134.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-37-02-600.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-38-21-685.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-41-19-913.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-42-54-215.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-45-04-674.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-45-30-066.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-48-15-126.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-49-00-874.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-50-19-618.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 0-56-34-429.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-00-10-145.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-08-37-967.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-09-44-665.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-11-28-385.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-14-09-655.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-18-18-839.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-19-24-380.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-21-12-613.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-23-56-102.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-27-38-630.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-29-15-173.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-31-20-716.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-32-22-289.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-34-14-716.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-54-09-692.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-57-42-293.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 1-58-51-435.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 12-41-46-567.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 12-42-21-530.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 12-43-33-386.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 12-47-50-533.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 12-49-09-331.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 12-50-06-888.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 12-51-46-909.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 13-01-08-398.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 13-09-02-978.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 13-12-56-484.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 13-14-30-997.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 13-17-48-614.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 13-19-10-923.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 13-21-44-751.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 13-24-52-788.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 13-26-32-133.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 14-22-08-377.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 14-29-22-739.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 14-30-27-789.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 14-36-41-972.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 14-40-14-624.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 14-41-13-670.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 14-49-16-731.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 14-51-30-645.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 14-54-46-041.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 14-58-40-921.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-00-37-157.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-08-40-579.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-10-20-313.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-14-53-769.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-21-26-175.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-22-50-840.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-28-11-464.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-31-32-750.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-34-46-654.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-36-15-983.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-44-05-849.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 15-46-27-317.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-02-29-793.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-04-26-557.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-04-49-286.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-08-40-499.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-34-44-425.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-38-17-715.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-44-29-120.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-46-55-610.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-48-48-665.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-51-35-690.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-55-29-257.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-56-08-983.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 2-57-11-621.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 23-36-53-874.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 23-40-10-747.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 23-42-49-214.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 23-43-47-091.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 23-45-16-609.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 23-47-36-033.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 23-50-51-608.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-00-08-204.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-00-42-734.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-02-06-078.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-03-56-103.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-06-05-945.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-13-30-356.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-17-31-555.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-24-06-837.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-26-29-267.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-35-48-411.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-38-37-582.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-39-52-033.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-40-28-350.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-42-33-328.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-46-11-610.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-50-06-633.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-51-33-228.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 3-59-37-405.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 4-00-01-463.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 4-02-43-829.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 4-05-46-460.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 4-09-34-385.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 4-13-52-880.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 4-15-41-884.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 4-23-49-317.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 4-25-20-631.metadata.json
    -> {
  generated_metadata/VALORANT 01-14-2026 4-27-28-529.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-01-14-598.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-05-35-257.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-20-14-408.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-21-01-415.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-21-21-805.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-26-24-088.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-27-54-421.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-32-41-771.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-33-06-175.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-36-05-798.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-41-57-006.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-46-04-692.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-47-34-763.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-48-57-158.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-52-49-880.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 0-53-35-083.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 1-05-10-660.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 1-09-54-007.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 1-13-20-013.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 1-15-40-945.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 1-24-46-126.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 1-30-14-409.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 1-32-01-193.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 22-21-01-057.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 22-28-28-346.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 22-31-53-501.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 22-35-48-603.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 22-37-19-662.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 22-39-56-616.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 22-41-31-151.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 22-45-44-955.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 22-56-13-917.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 22-57-49-757.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-01-00-725.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-01-48-391.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-03-48-377.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-05-00-029.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-10-11-384.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-22-14-788.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-22-38-453.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-28-30-746.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-28-51-269.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-37-22-046.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-40-43-783.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-43-02-842.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-50-46-569.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-55-56-676.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-57-05-773.metadata.json
    -> {
  generated_metadata/VALORANT 01-15-2026 23-59-57-658.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-00-21-157.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-01-28-140.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-02-42-892.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-11-57-705.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-14-07-357.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-16-11-465.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-17-40-218.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-25-21-535.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-26-44-903.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-29-25-516.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-32-54-886.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-34-51-900.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-45-45-349.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-46-48-805.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-49-42-748.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-53-57-785.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-55-50-333.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-56-35-486.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-57-35-733.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 0-59-41-923.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 1-05-10-096.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 23-41-11-620.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 23-43-52-492.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 23-53-44-310.metadata.json
    -> {
  generated_metadata/VALORANT 01-16-2026 23-57-42-382.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-10-19-217.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-11-25-130.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-15-42-315.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-29-40-212.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-31-24-350.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-35-03-255.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-35-59-016.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-39-48-332.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-51-26-647.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-55-09-849.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 0-58-56-741.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-04-04-806.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-06-29-134.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-07-55-615.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-08-32-157.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-20-15-729.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-23-25-118.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-23-57-270.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-26-05-628.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-28-23-251.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-29-25-181.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-33-48-098.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-36-06-164.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-37-54-531.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-41-39-378.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-42-13-688.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-52-01-616.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-53-35-194.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-55-29-238.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-55-54-941.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 1-56-43-279.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-05-22-430.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-09-37-309.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-17-50-094.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-19-39-416.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-27-00-109.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-28-46-438.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-31-48-014.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-33-46-758.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-34-53-197.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-36-56-009.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-37-51-086.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-39-27-518.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-41-10-545.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-48-57-740.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-56-00-075.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 2-59-04-192.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 22-55-41-943.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-00-21-572.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-04-28-170.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-06-28-329.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-10-24-203.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-13-06-749.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-16-29-265.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-23-40-293.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-28-15-013.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-32-44-210.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-37-35-862.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-44-34-182.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 23-52-51-045.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-09-03-568.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-11-27-695.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-12-53-226.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-29-29-802.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-33-10-694.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-35-23-380.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-37-37-958.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-40-47-024.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-42-15-640.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-43-31-981.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-45-07-582.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-46-18-296.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-48-52-291.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 3-55-33-782.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-03-03-567.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-09-10-090.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-17-33-594.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-18-30-140.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-21-28-801.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-24-17-464.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-24-55-213.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-30-35-034.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-32-57-875.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-34-18-297.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-35-38-063.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-58-01-250.metadata.json
    -> {
  generated_metadata/VALORANT 01-17-2026 4-59-22-516.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-03-27-874.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-04-39-351.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-05-57-282.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-09-07-523.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-10-58-136.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-14-11-794.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-16-54-571.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-20-44-920.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-28-05-169.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-36-20-046.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 0-43-46-083.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-02-59-421.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-09-32-555.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-09-57-138.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-15-55-083.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-17-59-022.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-19-58-623.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-24-17-442.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-29-33-284.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-32-43-155.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-41-03-959.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-45-30-099.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-48-15-352.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-54-29-845.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 1-56-58-472.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-01-01-145.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-04-51-530.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-06-11-141.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-08-51-029.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-11-15-471.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-13-15-142.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-14-08-259.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-23-36-050.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-30-52-579.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-32-16-268.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-36-13-117.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-41-55-989.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-42-27-981.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-48-46-891.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-50-56-818.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 2-54-28-188.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 3-00-09-647.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 3-03-31-332.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 3-05-27-936.metadata.json
    -> {
  generated_metadata/VALORANT 01-18-2026 3-06-43-362.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 22-45-21-063.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 22-47-20-615.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 22-47-53-259.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 22-48-14-961.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 22-50-37-292.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 22-54-44-426.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-02-53-914.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-04-54-561.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-05-19-063.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-06-34-336.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-08-20-387.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-08-48-839.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-10-10-487.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-36-15-366.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-42-50-528.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-50-14-085.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-55-14-785.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-56-03-712.metadata.json
    -> {
  generated_metadata/VALORANT 01-19-2026 23-57-34-819.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 0-01-43-084.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 0-03-58-816.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 0-05-55-833.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 0-11-19-161.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 0-18-07-741.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 0-21-14-172.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 0-22-55-556.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 0-30-51-445.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 0-34-25-741.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 22-44-10-664.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 22-47-41-980.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 22-48-29-213.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 22-49-36-434.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 22-50-56-763.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 22-56-33-172.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 23-00-10-547.metadata.json
    -> {
  generated_metadata/VALORANT 01-20-2026 23-10-24-662.metadata.json
    -> {
  hollywood_music_inventory.json
    -> {
  index.html
    -> <!doctype html>
  lib/meta_api.py
    -> In fb_upload_reel_binary at line 181, replace the parameter 'video_id: str' with 'upload_url: str' and remove the 'graph_version: str = "v25.0"' parameter entirely.
  metaBatchReelsUpload.py
    -> Upload existing clips as Instagram and Facebook Reels using Meta Graph API
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
  test_fb_retry_logic.py
    -> exposes test_fb_finish_reel_publish_retries
  token.json
    -> {"token": "ya29.
  youtubeBatchUpload.py
    -> Batch-upload YouTube Shorts with AI-generated metadata
  youtubeFixRepeatedMetadata.py
    -> Fix repeated title/description metadata for already uploaded YouTube videos

CODE PATTERNS:
  -Framework: React

ALREADY IMPLEMENTED: meta_api, youtubeBatchUpload, metaBatchReelsUpload, dataService, systemHandlers, preload, useAppStore, App, Setup, Upload, uploadService, UploadAdvancedOptions

LAST RUN: 2026-04-14 | 2 tasks | "Build a logging system feature"
```
