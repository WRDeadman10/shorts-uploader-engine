# AI Understanding

Status: `confirmed`
Project: `shorts-uploader-engine`
Type: `script-driven media upload automation with Electron desktop UI` | Language: `Python, JavaScript, JSX`

## Summary

A repository for discovering local Valorant clips, generating metadata and derived assets, uploading to YouTube Shorts and Meta Reels, and auditing live platform uploads against local inventory. It uses root-level Python scripts plus two desktop UI layers: a Tkinter launcher and an Electron + React app.

## Important Docs

- `README.md`: # Shorts Uploader Engine This repository automates a Valorant short-form video pipeline: discover local source clips generate metadata upload to YouTube Shorts cross-post to Instagram and Facebook Reels audit live platform uploads against the local video library ## Content Command Center The repository now also contains a modular Electron + React desktop app under named Content Command Center. Current UI stack: Electron main process with preload bridge and IPC handlers React renderer with state-based page routing Zustand for shared UI state Framer Motion for transitions and interaction feedback Current UI modules: page modules for Dashboard, Library, Upload, Console, Audit, and Metadata Current UI behavior: renderer does not access Node directly preload exposes a safe Electron communication uses and Electron main can launch the existing Python scripts and stream stdout/stderr to the UI Library and Audit screens read the existing JSON state and ledger files the Tkinter launcher still exists and remains supported ## Desktop UI ### Tkinter launcher for the existing scripts. Responsibilities: expose the available CLI arguments as form fields validate common input combinations before launch show the exact generated command before execution stream script output live in the UI console persist the last-used values for each tab in Covered scripts: Typical usage: Behavior: saved form values are restored on the next launch scripts are launched unbuffered so the UI console updates progressively during long runs the UI wraps the existing scripts and does not replace their CLI entry points ## Main Scripts ### Primary YouTube uploader.
- `missingFeatures/README.md`: # Missing Features This folder contains one short Markdown brief per missing Electron + React UI feature. Purpose: help an AI or developer understand the gap quickly map the missing UI capability back to the existing Python scripts make implementation planning easier without rereading the whole repo Scope: these docs compare the React + Electron app in against the currently available script capabilities in the repository root and, where useful, against the richer Tkinter launcher in Each file is intentionally brief and implementation-oriented.
- `.aider.chat.history.md`: # aider chat started at 2026-04-02 22:05:11 Can't initialize prompt toolkit: No Windows console found. C:\Users\winss\AppData\Roaming\Python\Python311\site-packages\aider\__main__.py --model ollama/qwen2.5-coder:14b --yes-always --no-pretty --no-stream --no-auto-lint --no-auto-commits --no-gitignore --no-show-model-warnings --message GOAL Implement shorts-uploader-engine Electron UI parity plan TASK 1 OF 43 (MODIFY) Update the feature tracker to add an implementation-session note section and a clear convention for marking features in progress and done during bridge-driven work. TARGET FILES — edit ONLY these exact paths, nothing else: C:\Users\winss\Documents\Projects\shorts-uploader-engine\missingFeatures\FEATURE_STATUS.md RULES CRITICAL: edit only the TARGET FILES listed above — do NOT create new files or write to any other path CRITICAL: use the exact absolute path shown — do not change the filename, directory, or extension Do not ask questions or request clarification — implement directly Do not write TODO/stub placeholders — write complete working code Do not remove existing unrelated code --file C:\Users\winss\Documents\Projects\shorts-uploader-engine\missingFeatures\FEATURE_STATUS.md Aider v0.86.2 Model: ollama/qwen2.5-coder:14b with whole edit format Git repo: .git with 485 files Repo-map: using 4096.0 tokens, auto refresh Added missingFeatures\FEATURE_STATUS.md to the chat.
- `AGENT_CONTEXT.md`: # AGENT_CONTEXT ## Purpose This repository is a script-driven pipeline for uploading Valorant gameplay clips as short-form content to: YouTube Shorts Instagram Reels Facebook Reels It also includes reporting and audit tooling for comparing the local clip library against live platform upload data. The repository now has two operator-facing UI layers: the existing Tkinter launcher in a newer Electron + React desktop app in named Content Command Center ## Architecture The core automation architecture is still file-based and script-centric. There is no application framework, package layout, or database.
- `AI_UNDERSTANDING.md`: # AI Understanding ## Project Summary is an operations-focused repository for publishing Valorant clips as short-form video content across YouTube Shorts, Instagram Reels, and Facebook Reels. The repository is centered on Python scripts and local JSON state files rather than a packaged backend application or database-backed service. It also contains two desktop operator interfaces: a mature Tkinter launcher in a newer Electron + React desktop app in The core mental model is: discover local source videos identify each clip by a stable file key generate metadata and derived media artifacts upload to one or more platforms persist local state and upload ledgers audit live platform inventories against the local library ## Architecture Summary ### Script-first automation The repository's primary business logic lives in top-level Python scripts: There is no shared Python package layout.

## Key Files

- `AGENT_CONTEXT.md`: Agent-facing architecture and workflow summary.
- `README.md`: Human-facing operational overview and setup guide.
- `app/electron/ipc/systemHandlers.js`: Add IPC handlers for loading and saving Electron UI workflow settings so the renderer can persist advanced upload configuration.
- `app/electron/main.js`: Electron main process bootstrap for the Content Command Center desktop app.
- `app/electron/preload.js`: Renderer bridge exposing safe APIs from Electron to the React frontend.
- `app/electron/services/dataService.js`: Reads root JSON state and ledgers to build video rows and status summaries for the Electron UI.
- `app/electron/services/pathService.js`: Resolves repo paths, renderer build path, and the active video root.
- `app/electron/services/uploadService.js`: Runs Python upload scripts as child processes, tracks status, and streams logs back to the renderer.
- `app/useAppStore.js`: Central Zustand store for page state, logs, upload status, metadata editing, and video filtering.
- `generateLiveUploadAudit.py`: Fetches live platform uploads and compares them against local video inventory, producing audit snapshots and comparison output.
- `generateUploadStatusReport.py`: Builds a local aggregate report of total clips and per-platform upload coverage.
- `metaBatchReelsUpload.py`: Instagram and Facebook reels publisher built on Meta Graph API using YouTube-uploaded items as source inventory.

## Architecture Signals

- script-first orchestration
- file-based JSON state
- two desktop operator UIs over shared scripts and ledgers
- platform upload pipeline plus live audit pipeline

## User Clarifications

- No test suite was found.
- Operational state is stored as mutable root JSON files.
- Large generated media and audit artifacts can dirty the repository quickly.
- The upload flow depends on local credentials and API access.
- youtubeBatchUpload.py imports from a sibling valorant_clip_data_extractor_v3 project.

## Context Text

This is the compact context summary that can be reused in later bridge sessions.

```text
PROJECT: shorts-uploader-engine (script-driven media upload automation with Electron desktop UI/Python, JavaScript, JSX)
(roles inferred by static scan — not task-authored)
SUMMARY: A repository for discovering local Valorant clips, generating metadata and derived assets, uploading to YouTube Shorts and Meta Reels, and auditing live platform uploads against local inventory. It uses root-level Python scripts plus two desktop UI layers: a Tkinter launcher and an Electron + React app.

DOCUMENTATION SIGNALS:
  README.md
    -> # Shorts Uploader Engine This repository automates a Valorant short-form video pipeline: discover local source clips generate metadata upload to YouTube Shorts cross-post to Instagram and Facebook Reels audit live platform uploads against the local video library ## Content Command Center The repository now also contains a modular Electron + React desktop app under named Content Command Center. Current UI stack: Electron main process with preload bridge and IPC handlers React renderer with state-based page routing Zustand for shared UI state Framer Motion for transitions and interaction feedback Current UI modules: page modules for Dashboard, Library, Upload, Console, Audit, and Metadata Current UI behavior: renderer does not access Node directly preload exposes a safe Electron communication uses and Electron main can launch the existing Python scripts and stream stdout/stderr to the UI Library and Audit screens read the existing JSON state and ledger files the Tkinter launcher still exists and remains supported ## Desktop UI ### Tkinter launcher for the existing scripts. Responsibilities: expose the available CLI arguments as form fields validate common input combinations before launch show the exact generated command before execution stream script output live in the UI console persist the last-used values for each tab in Covered scripts: Typical usage: Behavior: saved form values are restored on the next launch scripts are launched unbuffered so the UI console updates progressively during long runs the UI wraps the existing scripts and does not replace their CLI entry points ## Main Scripts ### Primary YouTube uploader.
  missingFeatures/README.md
    -> # Missing Features This folder contains one short Markdown brief per missing Electron + React UI feature. Purpose: help an AI or developer understand the gap quickly map the missing UI capability back to the existing Python scripts make implementation planning easier without rereading the whole repo Scope: these docs compare the React + Electron app in against the currently available script capabilities in the repository root and, where useful, against the richer Tkinter launcher in Each file is intentionally brief and implementation-oriented.
  .aider.chat.history.md
    -> # aider chat started at 2026-04-02 22:05:11 Can't initialize prompt toolkit: No Windows console found. C:\Users\winss\AppData\Roaming\Python\Python311\site-packages\aider\__main__.py --model ollama/qwen2.5-coder:14b --yes-always --no-pretty --no-stream --no-auto-lint --no-auto-commits --no-gitignore --no-show-model-warnings --message GOAL Implement shorts-uploader-engine Electron UI parity plan TASK 1 OF 43 (MODIFY) Update the feature tracker to add an implementation-session note section and a clear convention for marking features in progress and done during bridge-driven work. TARGET FILES — edit ONLY these exact paths, nothing else: C:\Users\winss\Documents\Projects\shorts-uploader-engine\missingFeatures\FEATURE_STATUS.md RULES CRITICAL: edit only the TARGET FILES listed above — do NOT create new files or write to any other path CRITICAL: use the exact absolute path shown — do not change the filename, directory, or extension Do not ask questions or request clarification — implement directly Do not write TODO/stub placeholders — write complete working code Do not remove existing unrelated code --file C:\Users\winss\Documents\Projects\shorts-uploader-engine\missingFeatures\FEATURE_STATUS.md Aider v0.86.2 Model: ollama/qwen2.5-coder:14b with whole edit format Git repo: .git with 485 files Repo-map: using 4096.0 tokens, auto refresh Added missingFeatures\FEATURE_STATUS.md to the chat.
  AGENT_CONTEXT.md
    -> # AGENT_CONTEXT ## Purpose This repository is a script-driven pipeline for uploading Valorant gameplay clips as short-form content to: YouTube Shorts Instagram Reels Facebook Reels It also includes reporting and audit tooling for comparing the local clip library against live platform upload data. The repository now has two operator-facing UI layers: the existing Tkinter launcher in a newer Electron + React desktop app in named Content Command Center ## Architecture The core automation architecture is still file-based and script-centric. There is no application framework, package layout, or database.
  AI_UNDERSTANDING.md
    -> # AI Understanding ## Project Summary is an operations-focused repository for publishing Valorant clips as short-form video content across YouTube Shorts, Instagram Reels, and Facebook Reels. The repository is centered on Python scripts and local JSON state files rather than a packaged backend application or database-backed service. It also contains two desktop operator interfaces: a mature Tkinter launcher in a newer Electron + React desktop app in The core mental model is: discover local source videos identify each clip by a stable file key generate metadata and derived media artifacts upload to one or more platforms persist local state and upload ledgers audit live platform inventories against the local library ## Architecture Summary ### Script-first automation The repository's primary business logic lives in top-level Python scripts: There is no shared Python package layout.

FILE REGISTRY (what each file does):
  AGENT_CONTEXT.md
    -> Agent-facing architecture and workflow summary.
  README.md
    -> Human-facing operational overview and setup guide.
  app/electron/ipc/systemHandlers.js
    -> Add IPC handlers for loading and saving Electron UI workflow settings so the renderer can persist advanced upload configuration.
  app/electron/main.js
    -> Electron main process bootstrap for the Content Command Center desktop app.
  app/electron/preload.js
    -> Renderer bridge exposing safe APIs from Electron to the React frontend.
  app/electron/services/dataService.js
    -> Reads root JSON state and ledgers to build video rows and status summaries for the Electron UI.
  app/electron/services/pathService.js
    -> Resolves repo paths, renderer build path, and the active video root.
  app/electron/services/uploadService.js
    -> Runs Python upload scripts as child processes, tracks status, and streams logs back to the renderer.
  app/useAppStore.js
    -> Central Zustand store for page state, logs, upload status, metadata editing, and video filtering.
  generateLiveUploadAudit.py
    -> Fetches live platform uploads and compares them against local video inventory, producing audit snapshots and comparison output.
  generateUploadStatusReport.py
    -> Builds a local aggregate report of total clips and per-platform upload coverage.
  metaBatchReelsUpload.py
    -> Instagram and Facebook reels publisher built on Meta Graph API using YouTube-uploaded items as source inventory.
  musicOverlaySample.py
    -> Utility/experimental script for music inventory and background audio overlay workflows.
  projectUiLauncher.py
    -> Tkinter desktop launcher that wraps script CLIs, validates inputs, previews commands, and streams output.
  rebuildUploadComparison.py
    -> Recomputes upload_comparison.json from saved audit snapshots without making network calls.
  youtubeBatchUpload.py
    -> Primary orchestration script for upload workflows, Shorts conversion, metadata generation, YouTube publishing, and optional Meta cross-posting.
  youtubeFixRepeatedMetadata.py
    -> Maintenance utility for correcting repeated or problematic YouTube metadata.

CODE PATTERNS:
  -script-first orchestration
  -file-based JSON state
  -two desktop operator UIs over shared scripts and ledgers
  -platform upload pipeline plus live audit pipeline

ALREADY IMPLEMENTED: Per-video generated metadata artifacts., Converted or remixed video outputs for upload pipelines., Offline inventory, live platform snapshots, and upload comparison outputs., preload, systemHandlers, pathService

USER CLARIFICATIONS:
  -No test suite was found.
  -Operational state is stored as mutable root JSON files.
  -Large generated media and audit artifacts can dirty the repository quickly.
  -The upload flow depends on local credentials and API access.
  -youtubeBatchUpload.py imports from a sibling valorant_clip_data_extractor_v3 project.

LAST RUN: 2026-04-04 | 3 tasks | "Identify features currently in progress based on the content of FEATURE_STATUS.md."
```
