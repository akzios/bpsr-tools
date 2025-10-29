# BPSR Tools v1.0.2 Release Notes

## 🐛 Bug Fixes

### Overlay Fullscreen Compatibility

- **Fixed overlay not staying on top of fullscreen games** - Overlay now remains visible even when Blue Protocol is in fullscreen mode
  - Set window level to `screen-saver` priority (highest window level available)
  - Ensures DPS meter stays visible during fullscreen gameplay
  - No more alt-tabbing to check combat stats!
  - Works with DirectX and OpenGL fullscreen applications
  - **File**: `src/app/electronGUI.js:57`

### Skill Analysis Modal

- **Fixed skill names not showing** - Skill analysis modal now displays proper skill names instead of skill IDs
  - Skills now show English names (e.g., "Raincall Surge" instead of "1201")
  - Falls back to Chinese names if English translation not available
  - Uses skill database with 458 pre-seeded skills
  - **Root cause**: UserData instances weren't receiving skillDb reference
  - **Solution**: Updated UserData constructor to accept skillDb parameter
  - **Files**: `src/server/dataManager.js:238-250, 520`

## ✨ Improvements

### Official Skill Translations

- **Updated all skill names with official English translations**
  - Imported 458 official skill translations from game files
  - **366 skills** updated with improved, accurate names
  - **11 new skills** added to database
  - **81 skills** already had correct translations

**Translation Examples:**

| Skill ID | Old Name              | New Official Name    |
| -------- | --------------------- | -------------------- |
| 1201     | Flowing Surge         | **Raincall Surge**   |
| 1210     | Aqua Vortex           | **Maelstrom**        |
| 1401     | Tempest Dance - Sweep | **Windborne Grace**  |
| 1501     | Vine Control - 1      | **Vines' Embrace**   |
| 1701     | Style: Smite          | **Judgment Cut**     |
| 2401     | Sword of Justice - 1  | **Blade of Justice** |

## 🔧 Technical Changes

### Electron Window Management

- **Window Level Hierarchy**: Changed from default `floating` to `screen-saver` level
  - Ensures overlay stays above fullscreen games
  - Compatible with game overlays, screen recording software
  - Uses Electron's `setAlwaysOnTop(true, 'screen-saver')` API

### Database Architecture

- **Skill Database Integration**: UserData now receives skillDb reference
  - Enables skill name lookups during combat data aggregation
  - Improves performance by eliminating redundant database queries
  - Skill names resolved at summary generation time

### Skill Data Update

- **Source**: Official game translation files (`.resx` format)
- **Update Process**: XML parsing → JSON merge → database sync
- **Preservation**: Chinese names retained, only English names updated
- **File**: `db/seed/skills.json` (458 total skills)

## 📊 Database Statistics

- **Total Skills**: 458
- **With English Names**: 458 (100%)
- **With Chinese Names**: 447 (98%)
- **Newly Added**: 11 skills
- **Database Size**: ~90 KB

## 🎯 User Experience

- **Fullscreen Gaming**: Overlay now works seamlessly with fullscreen Blue Protocol
- **Better Readability**: Official skill names match what players see in-game
- **Consistent Translations**: All skill names use official localization
- **Improved Accuracy**: Skill analysis now provides precise combat breakdown

## 🚀 How to Update

### Automatic Update (Recommended)

If you have auto-updates enabled:

1. App will notify you when v1.0.2 is available
2. Click "Download Now"
3. Update installs automatically on app quit
4. Restart the app to use v1.0.2

### Manual Update

1. Download installer from [Releases](https://github.com/akzios/bpsr-tools/releases)
2. Run `BPSR Tools Setup 1.0.2.exe`
3. Installer will update your existing installation
4. Your settings and combat history will be preserved

## ⚠️ Upgrade Notes

- This is a minor bug fix release
- No breaking changes
- All settings and data preserved during update
- Database automatically updates with new skill translations
- First launch may take slightly longer due to skill name updates

## 🐞 Known Issues

- None reported for this version

## 📝 Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

**Download**: Get the installer from the [Releases](https://github.com/akzios/bpsr-tools/releases) page

**Support**: Report issues on [GitHub Issues](https://github.com/akzios/bpsr-tools/issues)

**Previous Version**: [v1.0.1 Release Notes](RELEASE_NOTES_v1.0.1.md)
