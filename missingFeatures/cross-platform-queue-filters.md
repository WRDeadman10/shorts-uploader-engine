# Cross Platform Queue Filters

The Electron UI does not expose the queue filtering features used for oldest-first cross-platform operations.

Script features missing from UI:

- `--require-uploaded-on`
- `--require-missing-on`

Why it matters:

- these flags let operators say things like:
  "upload to Instagram only if it is already on YouTube"
- this is central to staged multi-platform rollout

Current gap:

- the Upload page only has simple platform toggles
- no cross-platform queue rules can be expressed in the Electron UI

Expected outcome:

- advanced queue filter controls
- clear preview of the generated command semantics
