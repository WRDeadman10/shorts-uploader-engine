# Meta Publishing Advanced Options

The Electron UI does not expose the deeper Meta upload controls from `metaBatchReelsUpload.py`.

Missing options include:

- graph version
- poll attempts
- poll interval
- request timeout
- skip uploaded toggle
- delete converted after upload toggle
- dry-run mode

Why it matters:

- Meta publishing is the most failure-prone part of the workflow
- retry and polling controls are operationally important

Expected outcome:

- Meta-specific advanced settings panel
- proper argument mapping to `metaBatchReelsUpload.py`
