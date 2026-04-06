# YouTube Privacy And Playlist

The Electron UI does not expose YouTube publishing controls for privacy or playlist placement.

Script support already exists for:

- `--privacy`
- `--playlist-name`

Why it matters:

- privacy is a publishing decision
- playlist placement is part of post-upload organization

Current gap:

- no fields in the React upload flow
- no arguments passed from `uploadService.js`

Expected outcome:

- privacy selector
- playlist name input
- preview and process launch include those values
