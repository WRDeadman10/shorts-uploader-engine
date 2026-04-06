# Electron UI Implementation Plan

This plan turns the missing-feature analysis into a practical bridge + Aider workflow.

Goal:

- bring the Electron + React UI closer to operational parity with the existing script surface
- implement features one by one in small, reviewable changes
- keep progress visible in `missingFeatures/FEATURE_STATUS.md`

## Recommended Execution Mode

Use the bridge in:

```powershell
python main.py "Implement shorts-uploader-engine Electron UI parity plan" `
  --repo-root "C:\Users\winss\Documents\Projects\shorts-uploader-engine" `
  --plan-file "C:\Users\winss\Documents\Projects\shorts-uploader-engine\taskJsons\plan_001_electron_ui_parity.json" `
  --workflow-profile micro `
  --manual-supervisor `
  --aider-model ollama/qwen2.5-coder:14b
```

Why:

- one-file tasks fit the current bridge design best
- manual-supervisor keeps architectural review local
- approved tasks can be committed in small recoverable steps

## Execution Order

### Phase 1: Foundation

1. add a shared Electron-side persisted settings model
2. extend preload and IPC so the renderer can read and save upload settings
3. expand upload command building to consume real operator inputs instead of hardcoded defaults

### Phase 2: Core Upload Parity

4. add root-path, batch-size, privacy, playlist, and queue-filter controls
5. add ffmpeg / ffprobe controls
6. add credential and Meta ID controls
7. add advanced metadata and music settings
8. add dry-run and validation-friendly behavior

### Phase 3: Standalone Tool Coverage

9. add flows for:
   - metadata fix
   - music sample
   - upload status report
   - rebuild upload comparison
   - live upload audit

### Phase 4: Page Upgrades

10. upgrade Audit to use real audit artifacts
11. upgrade Metadata so it persists or is explicitly workflow-backed
12. upgrade Library with search, sorting, and richer details
13. upgrade Console with better run utility
14. upgrade Dashboard with action shortcuts

### Phase 5: Reliability

15. add setup diagnostics and environment checks
16. align Electron state persistence with Tkinter launcher expectations
17. review remaining parity gaps and update `FEATURE_STATUS.md`

## Review Rule

After each completed feature:

1. mark the feature `done` in `missingFeatures/FEATURE_STATUS.md`
2. add a one-line completion note
3. if the implementation changed scope, update the matching feature brief in `missingFeatures/`

## Suggested Review Questions

For each feature task, check:

- does the UI actually expose the missing capability
- does the renderer persist or send the right value
- does preload / IPC pass it safely
- does `uploadService.js` or the relevant runner map it to the script correctly
- does the command preview match the executed command
- does the page remain usable on desktop layout

## Notes

- keep generated media and runtime state out of implementation commits unless explicitly required
- prefer implementing parity in the Electron app without breaking the Tkinter launcher
- if a feature is too large, split it into smaller follow-up tasks and update the status tracker accordingly
