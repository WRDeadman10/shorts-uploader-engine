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
| videos-root-selection | pending | Add root path control and command wiring |
| video-discovery-filters | pending | Expose extensions and exclude filters |
| max-videos-control | pending | Remove hardcoded `--max-videos 1` |
| youtube-privacy-and-playlist | pending | Add privacy and playlist controls |
| cross-platform-queue-filters | pending | Add `require-uploaded-on` and `require-missing-on` |
| ffmpeg-and-ffprobe-settings | pending | Expose binary paths for conversion and inspection |
| advanced-ai-metadata-settings | pending | Add advanced metadata generation controls |
| music-workflow-settings | pending | Add music dir, volume, inventory, and related settings |
| credential-management-fields | pending | Add credential and ID inputs for YouTube and Meta |
| meta-publishing-advanced-options | pending | Expose Meta retry, timeout, and cleanup settings |
| dry-run-and-validation-modes | pending | Add dry-run and preflight validation behavior |
| youtube-fix-repeated-metadata-flow | pending | Add dedicated maintenance flow |
| music-overlay-sample-flow | pending | Add dedicated sample-generation flow |
| live-upload-audit-runner | pending | Add UI flow for `generateLiveUploadAudit.py` |
| rebuild-upload-comparison-flow | pending | Add UI flow for `rebuildUploadComparison.py` |
| upload-status-report-flow | pending | Add UI flow for `generateUploadStatusReport.py` |
| audit-page-uses-local-status-not-live-audit | pending | Rebuild Audit page around audit artifacts |
| metadata-page-not-persisted | pending | Make metadata page persist or clearly scope it |
| library-missing-search-sort-and-details | pending | Expand inspection and navigation tooling |
| console-missing-command-history-and-export | pending | Improve run history and console utility |
| dashboard-missing-operational-actions | pending | Add dashboard action surface |
| ui-state-persistence-parity | in_progress | Preload, IPC, and path-service groundwork is approved; shared store wiring timed out on task 5 |
| script-surface-parity-with-tkinter | pending | Close or explicitly document parity gap |
| setup-and-environment-checks | pending | Add setup diagnostics and preflight checks |

## Update Rule

When a feature is completed:

1. change its status in the table above
2. add a short dated note below
3. if the feature changed scope, update the corresponding feature brief in this folder

## Completion Log

- 2026-04-02: `ui-state-persistence-parity` moved to `in_progress` after task 2 (`app/electron/preload.js`), task 3 (`app/electron/ipc/systemHandlers.js`), and task 4 (`app/electron/services/pathService.js`) were approved and auto-committed by the bridge.
- 2026-04-02: task 5 on `app/useAppStore.js` did not complete; the bridge run stopped because Aider timed out after 900 seconds before producing a review request.

**Remaining Features Count:** 17
