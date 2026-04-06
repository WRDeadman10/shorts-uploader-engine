# Upload Status Report Flow

The Electron UI does not expose `generateUploadStatusReport.py`.

Why it matters:

- the report is useful for quick local totals
- `pathService.js` already uses `upload_status_report.json` to infer the active video root

Expected outcome:

- simple local-report action
- report summary rendered in Dashboard or Audit
- optional refresh button
