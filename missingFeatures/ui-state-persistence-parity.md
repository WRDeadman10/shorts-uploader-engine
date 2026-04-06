# UI State Persistence Parity

The Electron UI does not have parity with the Tkinter launcher's persisted per-script state.

Current gap:

- Tkinter persists detailed form state in `.project_ui_launcher_state.json`
- React UI keeps only lightweight runtime state in the renderer

Why it matters:

- the missing advanced options become even more painful without persistence
- operators repeat the same workflows often

Expected outcome:

- persist important form values and last-used workflow configuration
