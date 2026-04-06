# Video Discovery Filters

The Electron UI does not expose file discovery filters.

Missing controls:

- extensions
- exclude directories
- exclude files

Why it matters:

- the Python scripts already support these filters
- they are useful when the library contains helper outputs, previews, or non-target formats

Current gap:

- no controls in `Upload.jsx`
- command builder in `uploadService.js` uses only a minimal argument set

Expected outcome:

- advanced filter inputs in the upload flow
- values passed to `youtubeBatchUpload.py` and audit scripts where relevant
