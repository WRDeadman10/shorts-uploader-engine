# Metadata Page Not Persisted

The Metadata page is currently a local editor shell, not a real metadata workflow.

Current behavior:

- selecting a video hydrates fields in Zustand
- edits change only in-memory UI state
- nothing writes metadata JSON files
- nothing triggers regeneration or upload updates

Why it matters:

- metadata is a core part of the pipeline
- a fake editor can mislead operators into thinking edits are saved

Expected outcome:

- either wire metadata edits to real files and flows
- or clearly mark the page as preview-only until implemented
