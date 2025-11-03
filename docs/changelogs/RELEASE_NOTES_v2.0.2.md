# Release Notes - Version 2.0.2

**Release Date:** 2025-02-11
**Type:** Patch Release

## Overview

Version 2.0.2 is a patch release that fixes always-on-top state inconsistency where the pin button could become out of sync with the actual window state.

---

## Bug Fixes

### Always-On-Top State Inconsistency Fixed

**Problem:** Pin button state could become inconsistent with actual window state after clicking or switching windows

**Root Causes:**
1. Missing `get-always-on-top` IPC handler - frontend couldn't query actual window state
2. Header component didn't initialize button state from window on startup
3. Window level was `floating` instead of `screen-saver` (less compatible with fullscreen games)

**Fixed:**
- Added `get-always-on-top` IPC handler in `main.js` to query window state
- Header component now queries actual window state on initialization
- Changed window level from `floating` to `screen-saver` for better fullscreen compatibility
- Button visual state stays synchronized with actual window behavior

**Files Modified:**
- `main.js:230-255` - Added `get-always-on-top` handler and changed level to `screen-saver`
- `public/js/components/Header.ts:33-63` - Added `initializeAlwaysOnTopState()` method

---

## Technical Details

### New IPC Handler
```javascript
// main.js
ipcMain.handle("get-always-on-top", async (event) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow) {
      return { success: true, enabled: senderWindow.isAlwaysOnTop() };
    }
    return { success: false };
  } catch (error) {
    console.error('[Main] Error getting always on top:', error);
    return { success: false, error: error.message };
  }
});
```

### State Initialization
```typescript
// Header.ts
private async initializeAlwaysOnTopState(): Promise<void> {
  if (!this.options.isElectron || !this.options.onAlwaysOnTopToggle) return;

  const electronAPI = (window as any).electronAPI;
  if (electronAPI && electronAPI.getAlwaysOnTop) {
    try {
      const result = await electronAPI.getAlwaysOnTop();
      if (result.success) {
        this.isAlwaysOnTop = result.enabled;
        this.updateAlwaysOnTopButton();
        console.log('[Header] Initialized always-on-top state:', this.isAlwaysOnTop);
      }
    } catch (error) {
      console.error('[Header] Error getting initial always-on-top state:', error);
    }
  }
}
```

### Window Level Change
```javascript
// Before
senderWindow.setAlwaysOnTop(enabled, enabled ? "floating" : "normal", 1);

// After
senderWindow.setAlwaysOnTop(enabled, enabled ? "screen-saver" : "normal", 1);
```

**Why `screen-saver` Level?**
- Better compatibility with fullscreen games (matches overlay mode)
- Stays on top even when game is in fullscreen mode
- Consistent behavior across all BPSR Tools windows

---

## Benefits

✅ **State Synchronization** - Button always reflects actual window state
✅ **Initialization Fix** - Correct state shown on app startup
✅ **Fullscreen Compatibility** - Better behavior with fullscreen games
✅ **Consistent UX** - Pin button behavior matches user expectations

---

## Known Issues

None at this time.

---

## Upgrade Notes

No migration steps required. Simply update to v2.0.2 and the pin button will maintain consistent state.
