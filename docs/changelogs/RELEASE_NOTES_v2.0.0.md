# Release Notes - Version 2.0.0

**Release Date:** TBD
**Type:** Major Release

## Overview

Version 2.0.0 is a major architectural update featuring a complete TypeScript migration of the frontend, component-based architecture, critical path fixes, and simplified settings. This release improves maintainability, type safety, and user data handling.

---

## Breaking Changes

### Configuration Directory Removed from Installation
- Config directory no longer shipped in installation packages
- Settings now exclusively use `%APPDATA%\bpsr-tools\config\`
- **Impact:** Fresh installs will create settings on first run; existing users unaffected

### Auto-Clear on Timeout Feature Removed
- Removed automatic clearing after inactivity timeout
- Simplifies codebase and reduces unexpected behavior
- **Alternative:** Use manual clear button or auto-clear on channel change

---

## Major Features

### TypeScript Migration
Complete frontend refactored to TypeScript with strict mode:
- **Type Safety:** Compile-time error detection across entire codebase
- **Better IDE Support:** Full autocomplete and intelligent refactoring
- **Path Aliases:** Clean imports using `@shared/*`, `@components/*`, `@app-types/*`
- **Zero Framework Overhead:** Compiles to vanilla JavaScript (~130KB saved vs React)

### Component-Based Architecture
New modular component system for 100% code reuse:
- **14 Reusable Components:** Button, Toggle, Modal, DPSTable, ControlPanel, Header, Sidebar, Filter, Slider, etc.
- **4 Shared Utilities:** socketManager, router, dataFormatter, uiHelpers (40+ helper functions)
- **Zero Duplication:** Same components used across all views (DPS meter, CLI, settings, sessions, skill analysis)

### Multi-View Shell
New app shell with navigation and routing:
- **Hash-based Routing:** Client-side routing with `/dpsmeter`, `/sessions`, `/settings` routes
- **Header Component:** Unified header with theme toggle, pin, zoom, close buttons
- **Sidebar Component:** Collapsible navigation menu with persistent state
- **Route Persistence:** Remembers last visited route between sessions

### Sessions Tracking System
Complete combat session management with history and analysis:
- **Session Save/Load:** Save combat data with custom names and auto-detected types
- **Session History View:** Browse all saved sessions with sortable columns
- **Session Detail View:** View complete session breakdown with players and skills
- **Auto-Save System:** Configurable triggers and thresholds
  - On Clear: Save before clearing DPS meter
  - On Inactivity: Save after N minutes of no combat
  - On Window Close: Save before closing overlay
  - Thresholds: Minimum duration, players, total damage
- **Session Type Detection:** Automatically detects Parse, Dungeon, Raid, Guild Hunt, Boss Crusade, Open World
- **Complete Data Preservation:**
  - All player statistics (DPS, HPS, damage taken, deaths, HP)
  - Full skill breakdowns with calculated stats (DPS, crit%, hit rate, etc.)
  - Time-series DPS data for charts
  - Damage breakdown by target
- **Real-time Session Dashboard:**
  - Live stats cards (Current DPS, Average DPS, Session Time)
  - DPS over time chart with smoothed curves
  - Top 5 players with profession colors
  - Top 10 skills with damage/healing icons
- **Database Schema:** 2 tables (sessions, session_players) with CASCADE delete
- **Migration Support:** Automatically adds new columns to existing databases

---

## Critical Fixes

### Settings & Database Path Issues (CRITICAL)
**Problem:** Settings and database were being saved to read-only installation directory
**Fixed:** Proper user data directory detection for all execution contexts
- **Main process:** Uses `electron.app.getPath('userData')`
- **Child process (packaged):** Manually constructs path using `process.resourcesPath`
- **Dev mode:** Uses `process.cwd()`
- **Verification:** Added extensive logging showing exact save locations

**Locations:**
- Installation: `C:\Users\{user}\AppData\Local\Programs\bpsr-tools` (read-only)
- User Data: `C:\Users\{user}\AppData\Roaming\bpsr-tools` (writable) ✅

### Auto-Save Functionality Fixed
**Issues:**
1. DEFAULT_SETTINGS missing `autoSave` object → settings lost on merge
2. Duration calculation using wrong data type (object vs number)
3. Total damage sum using incorrect property path

**Fixed:**
- Added complete autoSave defaults to settings.js
- Fixed duration calculation: `totalDamage.total` from stats breakdown object
- Fixed damage sum: properly handles both object and number formats
- Auto-save now triggers correctly based on thresholds

### Skill Data in Sessions
**Issue:** Skill names not appearing in session history
**Fixed:** `getSummary()` now includes `skill_breakdown: this.getSkillSummary()`
- Skill names properly display in session top 10 skills
- Full skill data persisted with sessions

### Database Merge Completeness
**Issue:** Monster merge missing `monster_type` and `score` columns
**Fixed:** Updated INSERT statement to include all monster table columns
- Monsters now merge with complete data on updates

---

## Enhancements

### Settings UI Improvements
- **Smooth Animations:** Enhanced collapsible sections with grid-based animations
- **Better Transitions:** Opacity fades, hover effects (translateX, scale), optimized icon rotation
- **Improved Feel:** Uses `ease-emphasized` for more dynamic interactions
- **Cleaner Code:** Removed auto-clear on timeout controls (2 UI elements)

### Sessions UI/UX Improvements
- **Unified Save Modal:** Same modal component across DPS meter and sessions views
- **Green Success Button:** Visual consistency for save actions (`.btn-success` class)
- **Responsive Grid Layout:** Stats cards adapt from 3 to 2 columns on tablets
- **Scrollable History:** Session history table with max-height and smooth scrolling
- **Empty States:** Centered empty state messages with icons
- **Route Animations:** Smooth fadeIn/fadeOut transitions between views
- **Real-time Updates:** Live Socket.IO updates during active sessions
- **Profession Color Coding:** Top players displayed with their class colors

### Build System Updates
- **Asset Copying:** New `scripts/copyAssets.js` for production builds
- **Unified Build:** `npm run build:full` compiles TypeScript + copies assets
- **Production Ready:** `predist`/`prepublish` hooks ensure complete builds

### Static File Serving
- **Dev Mode Only:** Source files served from `public/` only in development
- **Production:** Serves compiled assets from `dist/public/` only
- **Smaller Installs:** No duplicate source files in production builds

---

## Technical Improvements

### Path Detection System
Robust multi-context path detection:
```javascript
const isElectron = !!(process.versions && process.versions.electron);
const isPackaged = !!(process.resourcesPath);

if (app) {
  // Main process - use electron.app
} else if (isPackaged) {
  // Child process in production - manual path construction
} else {
  // Dev mode - use process.cwd()
}
```

### Database Update Flow
Improved merge strategy with validation:
1. **First Install:** Copy entire pre-seeded database
2. **Updates:** Merge only seed data (professions, monsters, skills)
3. **User Data Preserved:** Sessions, collections, player combat history untouched
4. **Validation:** Logs skill counts before/after merge

### Frontend Architecture
- **ES6 Modules:** Native browser support, no bundler required
- **Directory Structure:**
  ```
  public/js/
  ├── components/    # 14 reusable UI components
  ├── shared/        # 4 utility modules (40+ functions)
  ├── views/         # 6 view controllers
  └── (compiled to dist/public/js/)
  ```

---

## Bug Fixes

- Fixed Settings button not appearing at bottom of sidebar when CLI menu absent
- Fixed config file copying (now unnecessary, removed entirely)
- Fixed electron-builder to exclude config directory
- Fixed TypeScript compilation errors across all views
- Removed checkTimeoutClear() calls from combat event handlers
- Fixed session modal input clearing between saves (no persistence bug)
- Fixed parse mode auto-pause to preserve combat data for session save
- Fixed DPS chart alignment with stats cards in sessions view

---

## Migration Guide

### For Developers

**TypeScript Imports:**
```typescript
// Path aliases (preferred)
import { COLORS } from '@shared/index';
import { Button } from '@components/Button';
import type { CombatData } from '@app-types/index';

// Relative imports (same directory only)
import { util } from './util';
```

**Building:**
```bash
npm run build:ts        # Compile TypeScript
npm run build:assets    # Copy CSS/HTML/images
npm run build:full      # Both (recommended)
npm run preseed         # Required before dist
npm run dist            # Build installer
```

### For Users

**Automatic:**
- Settings migrate automatically on first run
- Database merges new game data on updates
- Old installation directory files ignored

**Manual (if needed):**
- Settings location: `%APPDATA%\bpsr-tools\config\settings.json`
- Database location: `%APPDATA%\bpsr-tools\db\bpsr-tools.db`

---

## Known Issues

None at this time.

---

## Deprecations

- Auto-clear on timeout feature (removed entirely)
- Config directory in installation (no longer shipped)
- Legacy JavaScript views (migrated to TypeScript)

---

## Contributors

- Testing and feedback by the BPSR Tools community

---

## Next Steps

See `docs/FEATURE_TODO.md` for planned features:
- Collectibles system integration
- Session detail view enhancements
- Additional parse mode improvements
- Performance optimizations
