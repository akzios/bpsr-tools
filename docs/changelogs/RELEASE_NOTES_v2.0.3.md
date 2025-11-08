# Release Notes - Version 2.0.3

**Release Date:** 2025-11-08
**Type:** Minor Release

## Overview

Version 2.0.3 is a feature-rich release that introduces clickthrough mode for seamless overlay interaction, player search filtering, expanded role support with tank mode, and improved network stability through TCP gap detection.

---

## New Features

### 1. Clickthrough Mode

**What It Does:** Allows the overlay window to ignore mouse events, letting you interact with the game behind it.

**Key Features:**
- **Global Keyboard Shortcut:** Press `Ctrl+Shift+K` to toggle clickthrough on/off
- **Persistent Setting:** Clickthrough state saves and restores between sessions
- **Visual Feedback:** Clear indication when clickthrough is active
- **Dual Control:** Toggle via keyboard shortcut or settings panel

**Use Case:** Perfect for keeping the DPS meter visible while maintaining full mouse interaction with the game. No need to move or hide the overlay during combat.

**Files Modified:**
- `main.js:304-324` - Added IPC handlers for clickthrough control
- `main.js:427-442` - Global shortcut registration (`Ctrl+Shift+K`)
- `public/js/views/gui.ts:1012-1051` - Keyboard shortcut handling and toggle logic
- `src/server/utilities/settings.js:15-16` - Added clickthrough setting to defaults

**Technical Details:**
```javascript
// main.js
ipcMain.handle("set-clickthrough", async (event, enabled) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow) {
    senderWindow.setIgnoreMouseEvents(enabled, { forward: true });
    return { success: true };
  }
});

// Global shortcut
globalShortcut.register('CommandOrControl+Shift+K', () => {
  const settings = loadSettings();
  const newClickthrough = !settings.clickthrough;
  mainWindow.setIgnoreMouseEvents(newClickthrough, { forward: true });
  settings.clickthrough = newClickthrough;
  saveSettings(settings);
});
```

---

### 2. Player Search Filter

**What It Does:** Adds a search bar to quickly filter players by name in the DPS table.

**Key Features:**
- **Case-Insensitive Search:** Finds players regardless of capitalization
- **Real-Time Filtering:** Updates as you type
- **Top Position:** Located at top of filter panel for easy access
- **Clear Input:** Standard text input with modern styling

**Use Case:** Quickly find specific players in crowded raids or guild hunts without scrolling through the entire list.

**Files Modified:**
- `public/js/components/FilterPanel.ts:42-68` - Added search input to panel
- `public/js/components/FilterPanel.ts:130-138` - Search event handling
- `public/js/components/FilterPanel.ts:195-203` - Search term getter
- `public/js/views/gui.ts:249-253` - Search change callback
- `public/js/views/gui.ts:326-337` - Player search filter logic
- `public/js/views/gui.ts:344-346` - Applied search filter before enrichment
- `public/css/style.css:641-661` - Enhanced input styling with focus states

**Technical Details:**
```typescript
// FilterPanel.ts
const playerSearchInput = document.createElement('input');
playerSearchInput.type = 'text';
playerSearchInput.placeholder = 'Search player...';
playerSearchInput.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement;
  options.onPlayerSearchChange?.(target.value.toLowerCase());
});

// gui.ts
private applyPlayerSearchFilter(players: CombatData[]): CombatData[] {
  const searchTerm = this.filterPanel.getPlayerSearchTerm();
  if (!searchTerm || searchTerm.trim() === '') return players;

  return players.filter((player) => {
    const playerName = (player.name || '').toLowerCase();
    return playerName.includes(searchTerm);
  });
}
```

---

### 3. Tank Mode (DPS/Healer/Tank Cycle)

**What It Does:** Expands lite mode role options from 2 (DPS/Healer) to 3 (DPS/Healer/Tank).

**Key Features:**
- **DPS Mode:** Sorts by total damage (red button)
- **Healer Mode:** Sorts by total healing (green button)
- **Tank Mode:** Sorts by damage taken (blue button)
- **Single-Click Cycling:** One button cycles through all 3 modes
- **Role-Specific Sorting:** Each mode sorts by the most relevant metric

**Use Case:** Provides better visibility for tank players who want to track damage mitigation, and allows healers to see healing rankings without DPS clutter.

**Files Modified:**
- `public/js/components/ControlPanel.ts:44` - Renamed to `liteRoleBtn`
- `public/js/components/ControlPanel.ts:129-134` - Updated button title
- `public/js/components/ControlPanel.ts:218-224` - 3-way cycle logic
- `public/js/components/ControlPanel.ts:285-293` - Tank mode button styling
- `public/js/views/gui.ts:347-365` - Role-specific sorting logic
- `public/js/views/gui.ts:742-746` - Re-render on mode change
- `public/css/style.css:535-547` - Tank mode button colors
- `src/types/index.ts` - Updated `LiteModeType` type to include `'tank'`

**Technical Details:**
```typescript
// ControlPanel.ts
private handleLiteModeTypeClick(): void {
  if (this.state.liteModeType === 'dps') {
    this.state.liteModeType = 'healer';
  } else if (this.state.liteModeType === 'healer') {
    this.state.liteModeType = 'tank';
  } else {
    this.state.liteModeType = 'dps';
  }
  this.updateLiteModeTypeButton();
  this.options.onLiteModeTypeToggle?.(this.state.liteModeType);
}

// gui.ts - Role-specific sorting
const sorted = [...filtered].sort((a, b) => {
  if (state.isLiteMode && state.liteModeType === 'healer') {
    return (b.totalHealing?.total || 0) - (a.totalHealing?.total || 0);
  } else if (state.isLiteMode && state.liteModeType === 'tank') {
    return (b.takenDamage || 0) - (a.takenDamage || 0);
  } else {
    return (b.totalDamage?.total || 0) - (a.totalDamage?.total || 0);
  }
});
```

---

### 4. Always-On-Top Persistence

**What It Does:** Pin setting now saves and restores between sessions.

**Key Features:**
- **Session Memory:** Window remembers if it was pinned on last close
- **Auto-Restore:** Automatically restores pinned state on startup
- **Seamless UX:** No need to re-pin after every restart

**Files Modified:**
- `main.js:178-186` - Apply saved settings on window ready
- `main.js:243-249` - Save pin state to settings
- `src/server/utilities/settings.js:16` - Added `alwaysOnTop` to defaults

**Technical Details:**
```javascript
// main.js - On window ready
mainWindow.once("ready-to-show", () => {
  mainWindow.show();
  // Apply always-on-top setting if enabled
  if (settings.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
    console.log('[Main] Always on top restored from settings');
  }
});

// On pin toggle
ipcMain.handle("set-always-on-top", async (event, enabled) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow) {
    senderWindow.setAlwaysOnTop(enabled, enabled ? "screen-saver" : "normal", 1);

    // Save to settings for persistence
    const settings = loadSettings();
    settings.alwaysOnTop = enabled;
    saveSettings(settings);
  }
});
```

---

## Improvements

### 1. Settings Auto-Save

**Change:** Settings now save automatically on every change without requiring a manual save button.

**Details:**
- **Auto-Save on Toggle:** All checkboxes instantly save when toggled
- **Debounced Number Inputs:** Number inputs auto-save 500ms after typing stops
- **Real-Time Opacity:** Opacity slider saves immediately as you drag
- **Removed Save Button:** Cleaner UI with no footer or success message
- **Silent Operation:** No visual feedback needed - changes apply instantly

**Files Modified:**
- `public/js/views/settings.ts:145-147` - Auto-save on checkbox change
- `public/js/views/settings.ts:197-204` - Auto-save on number input with debounce
- `public/js/views/settings.ts:385-387` - Auto-save on opacity change
- `public/js/views/settings.ts:510-514` - Removed footer with save button
- `public/js/views/settings.ts:632-694` - New `autoSaveSettings()` method

**Benefits:**
- ✅ Better UX - No need to remember to click "Save"
- ✅ Instant feedback - See changes apply immediately
- ✅ Cleaner interface - No footer clutter
- ✅ Prevents data loss - Every change is saved

---

### 2. Advanced/Lite Toggle Button Redesign

**Change:** Switched from text-based button to icon-based design.

**Details:**
- **Lite Mode Icon:** `chart-simple` (bar chart icon)
- **Advanced Mode Icon:** `table-list` (table icon)
- **Benefit:** More compact, consistent with other control buttons, and language-independent

**Files Modified:**
- `public/js/components/ControlPanel.ts:119-125` - Icon-based button
- `public/js/components/ControlPanel.ts:268-278` - Update logic with icons

---

### 3. Enhanced Input Styling

**Change:** Improved text input design across all views.

**Details:**
- Smooth focus states with brand color border (`--brand-primary`)
- Hover effects with subtle background tint
- Better visual hierarchy and accessibility
- Consistent focus ring styling for dark/light themes

**Files Modified:**
- `public/css/style.css:637-661` - Enhanced input styles

---

### 4. Filter Panel Reorganization

**Change:** Clearer visual hierarchy with sections and headings.

**Details:**
- **Search Section:** Player search at top for quick access
- **Filter Section:** Separate section with heading for monster type filters
- **Better Spacing:** Visual separation between filter types
- **Collapsible Handling:** Proper overflow handling when dropdowns are open

**Files Modified:**
- `public/js/components/FilterPanel.ts:52-77` - Section structure
- `public/css/style.css:1029-1052` - Section styling

---

## Bug Fixes

### TCP Gap Detection with Timeout-Based Resync

**Problem:** Network instability could cause the packet sniffer to get stuck waiting for missing packets that never arrive.

**Root Cause:** TCP stream reassembly didn't have timeout logic for missing packets, causing indefinite waits.

**Fixed:**
- Added gap detection when expected sequence number doesn't match received packet
- 2-second timeout before forcing resync
- Prevents stuck connections when packets are lost
- Detailed logging for gap detection, timeout, and resolution

**Files Modified:**
- `src/server/service/sniffer.js:87-88` - Gap tracking variables
- `src/server/service/sniffer.js:103` - Reset gap timer on TCP stream reset
- `src/server/service/sniffer.js:283-318` - Gap detection and timeout logic

**Technical Details:**
```javascript
// sniffer.js
this.waitingGapSince = null; // Timestamp when gap was first detected
this.GAP_TIMEOUT = 2000; // 2 seconds timeout for missing packets

// Gap detection logic
if (this.tcp_next_seq !== -1) {
  const seqDiff = (tcpPacket.info.seqno - this.tcp_next_seq) >>> 0;

  // Check if we have a gap
  if (seqDiff > 0 && seqDiff < 0x7FFFFFFF) {
    if (!this.waitingGapSince) {
      this.waitingGapSince = Date.now();
      this.logger.warn(`[TCP Gap] Expected seq ${this.tcp_next_seq}, got ${tcpPacket.info.seqno}`);
    }

    // Force resync after timeout
    if (Date.now() - this.waitingGapSince > this.GAP_TIMEOUT) {
      this.logger.warn(`[TCP Gap Timeout] Forcing resync to seq ${tcpPacket.info.seqno}`);
      this.tcp_cache.clear();
      this._data = Buffer.alloc(0);
      this.tcp_next_seq = tcpPacket.info.seqno;
      this.waitingGapSince = null;
    }
  } else if (seqDiff === 0) {
    // Gap resolved
    if (this.waitingGapSince !== null) {
      this.logger.info(`[TCP Gap Resolved] Received expected seq ${tcpPacket.info.seqno}`);
      this.waitingGapSince = null;
    }
  }
}
```

**Benefits:**
- ✅ More stable network tracking during unstable connections
- ✅ Automatic recovery from packet loss
- ✅ Detailed logging for debugging network issues
- ✅ No manual intervention required

---

## Benefits Summary

✅ **Seamless Overlay Interaction** - Clickthrough mode allows game interaction while viewing DPS
✅ **Quick Player Lookup** - Search filter for finding specific players instantly
✅ **Role Diversity** - Tank mode provides visibility for all three main roles
✅ **State Persistence** - Pin setting survives restarts
✅ **Network Stability** - TCP gap detection prevents stuck connections
✅ **Auto-Save Settings** - No manual save button, changes apply instantly
✅ **Improved UX** - Icon-based buttons, better input styling, clearer filter layout

---

## Known Issues

None at this time.

---

## Upgrade Notes

### New Settings

Two new settings have been added to `config/settings.json`:

```json
{
  "clickthrough": false,  // Clickthrough mode state
  "alwaysOnTop": false    // Always-on-top persistence
}
```

These will be automatically initialized with default values on first run of v2.0.3.

### No Migration Required

Simply update to v2.0.3 and all new features will be available immediately. Existing settings and data are fully compatible.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+K` | Toggle clickthrough mode |

---

## Technical Summary

**Total Files Modified:** 19 files
**Lines Changed:** ~500 insertions, ~100 deletions
**New Dependencies:** None
**Breaking Changes:** None

**Component Changes:**
- `ControlPanel.ts` - 86 lines changed (tank mode, icon buttons)
- `FilterPanel.ts` - 64 lines changed (player search)
- `Gui.ts` - 95 lines changed (search filter, role sorting, clickthrough)
- `main.js` - 81 lines changed (clickthrough IPC, persistence)
- `sniffer.js` - 42 lines changed (TCP gap detection)
- `style.css` - 221 lines changed (input styling, filter layout, tank colors)
