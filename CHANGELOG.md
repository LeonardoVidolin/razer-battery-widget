# Changelog

## [1.2.0] — 2026-04-02

### Added

- **Resizable frameless window** — Drag edges and corners (including invisible border hit-zones); bounds are saved.
- **Volume panel toggle** — Show or hide the volume section from the divider control; state is persisted.
- **Compact layout** — When the window is very small, rings and typography scale down; battery percentage stays visible.

### Changed

- **Minimum size** — Floor at **50%** of the default footprint (**220×146** with volume hidden, **220×266** with volume shown).
- **Build reliability (Windows)** — `forceCodeSigning: false` and `signAndEditExecutable: false` to avoid symlink/signing issues during packaging.
- **Alternate dist outputs** — `npm run dist:fresh` → `dist-new/`, `npm run dist:install` → `dist-install/` when `dist/` or `app.asar` is locked.

### Documentation

- README: resize behavior, compact mode, and troubleshooting for locked build folders.

### Build

- NSIS installer: `npm run dist` → `dist/Razer Battery Widget Setup 1.2.0.exe`.

## [1.1.0] — 2026-04-09

### Added

- **Windows audio:** output (headphones) and microphone level sliders (PowerShell + Core Audio), with mouse drag and keyboard adjustment.
- **Always on top** tray option, with Windows Z-order levels and periodic re-application.
- Main-process battery polling and centralized push to the renderer for more reliable updates.

### Fixed / improved

- **Synapse 4:** battery `level` read as number or string; systray log discovery aligned; keeps last valid battery when the field is missing from JSON.
- **Synapse 3:** alternate regex for `_OnBatteryLevelChanged` (e.g. wireless headsets); reduces spurious **0%** when the latest log line contradicts the previous one.
- **UI:** when duplicate entries exist for the same model, prefers the more plausible battery reading (by name / type).

### Build

- NSIS installer: `npm run dist` → `dist/Razer Battery Widget Setup 1.1.0.exe`.

## [1.0.0] — earlier

- Initial version published in this repository.

