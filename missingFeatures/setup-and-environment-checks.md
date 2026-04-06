# Setup And Environment Checks

The Electron UI does not provide a proper setup screen or environment validation workflow.

Missing checks:

- Python availability
- Node / Electron expectations
- ffmpeg / ffprobe availability
- required credentials or file presence
- script dependency guidance

Why it matters:

- many failures are environment failures, not code failures
- the bridge app itself already treats setup checks as a first-class UI concern

Expected outcome:

- setup page or diagnostic panel
- preflight validation before launching operational scripts
