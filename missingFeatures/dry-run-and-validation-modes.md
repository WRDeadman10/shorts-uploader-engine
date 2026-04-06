# Dry Run And Validation Modes

The Electron UI does not expose dry-run and validation-oriented script modes in a clear way.

Examples:

- upload dry-run
- Meta dry-run
- validation-style preview before launch

Why it matters:

- operators often want to inspect commands and assumptions before touching remote platforms
- the Tkinter launcher provides stronger input validation behavior

Expected outcome:

- dry-run toggles for the relevant flows
- user-visible validation feedback before process start
