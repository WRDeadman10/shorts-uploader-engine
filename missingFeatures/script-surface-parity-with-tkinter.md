# Script Surface Parity With Tkinter

The Electron UI does not yet match the script surface already exposed by `projectUiLauncher.py`.

Tkinter currently provides structured forms for:

- `youtubeBatchUpload.py`
- `metaBatchReelsUpload.py`
- `youtubeFixRepeatedMetadata.py`
- `musicOverlaySample.py`

The Electron app only exposes a subset of the first two.

Why it matters:

- the old launcher is still the real operations UI for many workflows
- the Electron app cannot replace it yet

Expected outcome:

- explicit parity plan
- either complete replacement of the Tkinter launcher
- or clear scoping that the Electron UI is intentionally narrower
