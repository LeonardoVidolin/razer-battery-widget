## Summary

Release **v1.2.0**: resizable frameless window, collapsible volume panel, compact layout at small sizes, persisted bounds/settings, and more reliable Windows packaging.

## User-facing changes

- Resize the widget by dragging window edges/corners (invisible grips on the border); minimum size scales from the default layout (**220×146** collapsed, **220×266** with volume open).
- Toggle the volume block from the divider; choice is saved with other settings.
- Very small windows use a **compact** layout (smaller rings and % text).
- Build: `dist:fresh` / `dist:install` when `app.asar` in `dist/` is locked; `forceCodeSigning: false` for friction-free local builds.

## Checklist

- [x] `package.json` / lockfile version **1.2.0**
- [x] `CHANGELOG.md` updated
- [ ] After merge: tag `v1.2.0`, run `npm run dist`, attach **Razer Battery Widget Setup 1.2.0.exe** to the GitHub release

## Test notes

- Resize from all edges/corners; restart app — bounds and volume panel visibility persist.
- With volume hidden vs shown, confirm minimum height behaves as documented.
- Shrink below compact threshold — % still visible, layout usable.
- `npm run dist` (or `dist:fresh`) with app closed — installer produced.
