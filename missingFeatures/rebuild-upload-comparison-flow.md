# Rebuild Upload Comparison Flow

The Electron UI does not expose `rebuildUploadComparison.py`.

Why it matters:

- this is the fast local fix when platform snapshots are already present
- it avoids unnecessary API calls

Expected outcome:

- one-click local rebuild action
- result status in the audit area
- clear distinction from the full live audit fetch
