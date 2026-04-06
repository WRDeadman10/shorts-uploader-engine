# Max Videos Control

The Electron UI hardcodes upload batches to one item.

Current behavior:

- `uploadService.js` always uses `--max-videos 1`

Why it matters:

- operators need to run larger oldest-first batches
- batch size is a core script feature, not an edge case

Expected outcome:

- numeric batch-size control in the UI
- preview updates accordingly
- process launch uses the selected value
