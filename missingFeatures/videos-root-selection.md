# Videos Root Selection

The Electron UI cannot choose the source video root directory.

Why it matters:

- `youtubeBatchUpload.py` and `metaBatchReelsUpload.py` both depend on a root video directory
- real operator workflows often point at a library outside the repo

Current gap:

- `Upload.jsx` has no field or picker for the root path
- `uploadService.js` does not pass `--root` or `--videos-root`

Expected outcome:

- UI input plus folder picker
- persisted default value
- command builder passes the selected root to the relevant script
