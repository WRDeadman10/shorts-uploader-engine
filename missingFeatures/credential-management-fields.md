# Credential Management Fields

The Electron UI does not expose required operator credential inputs.

Important missing values:

- YouTube client secrets path
- token file path
- Meta access token
- Instagram user ID
- Facebook page ID

Why it matters:

- real runs often fail because these values are missing or wrong
- the Tkinter launcher already treats them as first-class inputs

Expected outcome:

- secure-looking credential fields
- validation messages before launch
- optional persisted local defaults
