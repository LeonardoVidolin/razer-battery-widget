## Summary

**Razer Battery Widget v1.1.0** (Windows): more stable battery readings with Razer Synapse 3 and 4, optional always-on-top window, and system audio level controls.

## What changed

### Added

- **Windows audio:** output (headphones) and microphone sliders in the widget via Core Audio (PowerShell).
- **Always on top:** tray toggle; on Windows uses topmost levels (`screen-saver` → `pop-up-menu` → `floating`) with re-apply on show and a light poll.
- **Battery:** timer in `main` with periodic `refresh()` + `pushDevicesToRenderer()`; renderer fallback via `getDevices()`; push after `did-finish-load`.

### Fixed

- **Synapse 4:** string `powerStatus.level` no longer forces 0%; systray log filename regex matches discovery; merge-by-name avoids duplicate rows stuck at 0%.
- **Synapse 3:** alternate `_OnBatteryLevelChanged` regex and heuristic when the last event is 0% right after a valid reading (common on wireless headsets).

### Notes

- `package.json` version: **1.1.0**.
- Release artifact: `npm run dist` → `dist/Razer Battery Widget Setup 1.1.0.exe`.
