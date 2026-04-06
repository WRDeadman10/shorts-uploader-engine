# Audit Page Uses Local Status Not Live Audit

The current Audit page is not a true live-audit view.

Current behavior:

- `Audit.jsx` renders rows derived from merged local status in the shared store
- it does not read `live_upload_audit/upload_comparison.json`
- it does not show count-based vs match-based comparison details

Why it matters:

- the repository distinguishes local ledgers from live audit snapshots
- the current page hides that difference

Expected outcome:

- Audit page should read audit artifacts
- show platform counts, matched state keys, fetch errors, and rebuild/run actions
