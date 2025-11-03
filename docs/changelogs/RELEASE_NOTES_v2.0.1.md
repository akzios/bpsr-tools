# Release Notes - Version 2.0.1

**Release Date:** TBD
**Type:** Patch Release

## Overview

Version 2.0.1 is a patch release that fixes the always-on-top (pin) functionality for both the main application window and skill analysis window.

---

## Bug Fixes

### Always-On-Top Functionality Fixed (CRITICAL)
**Problem:** Pin button (thumbtack icon) in the header was not working to toggle always-on-top behavior
**Root Cause:** IPC communication mismatch between preload and main process
- `preload.js` was using `ipcRenderer.send()` (fire-and-forget, no return value)
- `app.ts` was trying to `await` the result (expecting a promise)
- `main.js` handler was set up with `ipcMain.handle()` which requires `invoke()`

**Fixed:**
- Changed `preload.js` line 18-19 to use `ipcRenderer.invoke()` instead of `send()`
- Always-on-top now works correctly for both main app and skill analysis windows
- Pin button properly toggles window floating behavior

**Files Modified:**
- `src/app/preload.js:18-19` - Changed `setAlwaysOnTop` to use `invoke()` instead of `send()`

---

## Technical Details

### IPC Communication Pattern
```javascript
// Before (broken)
setAlwaysOnTop: (alwaysOnTop) =>
  ipcRenderer.send("set-always-on-top", alwaysOnTop),

// After (fixed)
setAlwaysOnTop: (alwaysOnTop) =>
  ipcRenderer.invoke("set-always-on-top", alwaysOnTop),
```

**Why This Matters:**
- `send()`: Fire-and-forget, returns `undefined` immediately
- `invoke()`: Returns a Promise that resolves when main process responds
- `handle()`: Main process handler that sends response back to renderer
- When renderer uses `await` with `send()`, it resolves immediately with `undefined` before the action completes

---

## Affected Windows

✅ **Main Application Window** - Pin button in header now works
✅ **Skill Analysis Window** - Pin button now works (was already using correct pattern, but benefits from consistency)

---

## Known Issues

None at this time.

---

## Upgrade Notes

No migration steps required. Simply update to v2.0.1 and the pin button will work correctly.
