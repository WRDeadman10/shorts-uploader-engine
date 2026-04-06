# Music Overlay Sample Flow

The Electron UI does not expose the dedicated sample-generation workflow from `musicOverlaySample.py`.

Why it matters:

- operators need to test music inventory and mixing before full uploads
- the repository already has a separate script for this purpose

Expected outcome:

- dedicated music sample page or modal
- controls for music dir, sample video, sample music, output path, ffmpeg, ffprobe, and bg volume
