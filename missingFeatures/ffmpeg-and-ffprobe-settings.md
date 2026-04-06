# FFmpeg And FFprobe Settings

The Electron UI does not expose ffmpeg and ffprobe path settings.

Why it matters:

- Shorts conversion and media inspection depend on these tools
- operators may need custom binary paths on Windows systems

Current gap:

- no inputs for `--ffmpeg-bin`
- no inputs for `--ffprobe-bin`

Expected outcome:

- binary path fields with file pickers
- validation before run
- reuse in upload and music-related flows
