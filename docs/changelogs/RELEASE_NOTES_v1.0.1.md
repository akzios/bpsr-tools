# BPSR Tools v1.0.1 Release Notes

## ✨ New Features

### Manual Database Update

- **Update Database from Launcher** - New button in Settings > Database Management
  - Fetches latest player data from online leaderboard on demand
  - Merges professions, monsters, skills, and players into database
  - Uses smart INSERT OR IGNORE strategy (preserves existing data, removes duplicates)
  - Preserves your combat history while adding new entries
  - Real-time status updates and statistics display
  - Shows how many new entries were added to each table
  - No console commands required - all via UI

## 🐛 Bug Fixes

### Skill Analysis Modal

- **Fixed close button not working** - The skill analysis modal close button and backdrop now work correctly at all zoom levels
  - Changed modal positioning from `absolute` to `fixed` to prevent zoom-related issues
  - Added `-webkit-app-region: no-drag` for proper mouse interaction
  - Modal elements now clickable regardless of parent transform/zoom
  - Escape key and backdrop click both work to close modal

### UI Improvements

- **Text Selection Enabled** - You can now select and copy text in launcher settings
  - Applied to: textareas, status messages, descriptions, info boxes
  - Improves UX when copying configuration values or error messages
- **Design Consistency** - Removed hardcoded colors in favor of brand design variables
  - Created `.info-box` CSS class using `var(--text-tertiary)`
  - Consistent styling across all informational boxes
  - Better visual hierarchy with brand colors

## 🔧 Technical Improvements

### Database Management System

- **New utility**: `src/server/utilities/updateDatabase.js`
  - Centralized database update function for manual updates via UI
  - Handles both dev and packaged environments with proper path resolution
  - Returns detailed statistics about merge results
- **IPC Communication** for Electron context:
  - Added `updateDatabase()` method to preload API
  - Proper IPC handler in main process
  - Avoids file:// protocol issues with fetch API
- **Seed File Packaging**:
  - Added `seed/*.json` to extraResources in electron-builder.yml
  - Seed templates copied from installation to userData on first update
  - All database operations use writable userData directory

### fetchPlayerSeed.js Updates

- Made exportable with module.exports for programmatic use
- Accepts optional `targetPath` parameter for custom output location
- Creates seed directory if it doesn't exist
- Merges with existing players.json (new data overwrites duplicates by player_id)
- Logs comprehensive statistics: existing, new, and added counts

## 📦 Technical Changes

- Modal CSS: Changed `.modal` and `.modal-backdrop` to `position: fixed`
- Created `.info-box` CSS class for consistent informational styling
- Text selection CSS: `user-select: text !important` for settings areas
- IPC handlers: `update-database` in main.js for database updates
- Path resolution: Proper handling for both `app.isPackaged` and dev environments

## 📊 Database Statistics

- **8 Professions** pre-seeded (all main classes)
- **447 Skills** with Chinese and English names
- **125,000+ Players** available via manual update from online leaderboard
- **Database Size**: ~20 MB (with full player seed data)

## 🎯 User Experience

- **No console commands** - All database operations accessible via launcher UI
- **Safe merging** - INSERT OR IGNORE preserves your combat history
- **Transparent feedback** - Real-time status updates show exactly what's happening
- **Better text handling** - Select and copy text in settings for easier configuration
- **Consistent design** - All UI elements follow brand design language

## 🚀 How to Update Database

1. Open BPSR Tools launcher
2. Click Settings icon (gear)
3. Scroll to "Database Management" section
4. Click "Update Database" button
5. Confirm the action
6. Wait for completion (may take a few minutes)
7. View statistics showing new entries added

## ⚠️ Upgrade Notes

- This is a minor update with UI improvements and new database management features
- Auto-update will handle the upgrade automatically if enabled in settings
- Your combat history and settings will be preserved
- First manual database update will add 125,000+ players from leaderboard

## 🐞 Known Issues

- None reported for this version

## 📝 Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

**Download**: Get the installer from the [Releases](https://github.com/akzios/bpsr-tools/releases) page

**Support**: Report issues on [GitHub Issues](https://github.com/akzios/bpsr-tools/issues)
