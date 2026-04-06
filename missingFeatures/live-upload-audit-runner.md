# Live Upload Audit Runner

The Electron UI does not provide a first-class flow for `generateLiveUploadAudit.py`.

Why it matters:

- live auditing is one of the repo's major product capabilities
- it fetches platform inventories and produces `live_upload_audit/` outputs

Current gap:

- no page or action launches the live audit script
- no credential-aware audit form exists in the Electron app

Expected outcome:

- audit run form
- progress and logs
- generated snapshot visibility after completion
