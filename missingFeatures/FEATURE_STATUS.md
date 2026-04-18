# Feature Status

Use this file to track which Electron + React parity features are still pending and which have been completed.

Status values:

- `pending`
- `in_progress`
- `done`
- `blocked`

## Tracker

| Feature | Status | Notes |
|---|---|---|
| videos-root-selection | done | Phase 2 — UploadAdvancedOptions.jsx + uploadService |
| video-discovery-filters | done | Phase 2 — extensions, exclude dirs/files wired |
| max-videos-control | done | Phase 2 — dynamic --max-videos arg |
| youtube-privacy-and-playlist | done | Phase 2 — privacy + playlist wired |
| cross-platform-queue-filters | done | Phase 2 — require-uploaded-on / require-missing-on |
| ffmpeg-and-ffprobe-settings | done | Phase 2 — binary path inputs wired |
| advanced-ai-metadata-settings | done | Phase 2 — AI metadata options wired |
| music-workflow-settings | done | Phase 2 — music options wired |
| credential-management-fields | done | Phase 2 — client_secret + token path inputs |
| meta-publishing-advanced-options | done | Phase 2 — Meta retry/timeout/cleanup wired |
| dry-run-and-validation-modes | done | Phase 2 — dry-run and preflight flags |
| youtube-fix-repeated-metadata-flow | done | Phase 3 — Tools page |
| music-overlay-sample-flow | done | Phase 3 — Tools page |
| live-upload-audit-runner | done | Phase 3 — Audit page action panel |
| rebuild-upload-comparison-flow | done | Phase 3 — Audit page action panel |
| upload-status-report-flow | done | Phase 3 — Audit page action panel |
| audit-page-uses-local-status-not-live-audit | done | Phase 4 — reads live_upload_audit/upload_comparison.json |
| library-missing-search-sort-and-details | done | Phase 4 — selected video detail panel + platform badges |
| console-missing-command-history-and-export | done | Phase 4 — command history panel + Run Again |
| dashboard-missing-operational-actions | done | Phase 4 — View Audit / Open Tools / Run Setup buttons |
| ui-state-persistence-parity | done | Phase 5 — uploadPlatforms persisted in settings.json |
| script-surface-parity-with-tkinter | done | Phase 5 — all 5 standalone tools covered; see FEATURE_STATUS.md |
| setup-and-environment-checks | done | Phase 5 — credentials, paths, runtime checks with color indicators |
| metadata-page-not-persisted | pending | Metadata.jsx state not written to disk — known gap |

## Update Rule

When a feature is completed:

1. change its status in the table above
2. add a short dated note below
3. if the feature changed scope, update the corresponding feature brief in this folder

## Completion Log

- 2026-04-02: `ui-state-persistence-parity` moved to `in_progress` after preload/IPC/pathService groundwork approved.
- 2026-04-14: Phase 2 complete — all upload option features done (commits de7ee28 → e95a641).
- 2026-04-17: Phase 3 complete — all 5 standalone tool flows done (commits bfb1708 → 7c167d9).
- 2026-04-18: Phase 4 complete — audit panel, command history, dashboard buttons, library detail (commits 148bb07 → c37627a).
- 2026-04-18: Phase 5 — setup diagnostics, uploadPlatforms persistence, FEATURE_STATUS.md updated.

**Remaining Features Count:** 1 (`metadata-page-not-persisted`)
