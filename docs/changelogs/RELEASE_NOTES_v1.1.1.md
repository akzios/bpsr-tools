# BPSR Tools v1.1.1 Release Notes

## 🎨 UI/UX Improvements

### Skill Analysis Window Refinements

- **Simplified Naming** - Renamed "Advanced Skill Analysis" to "Skill Analysis" throughout the application
  - Cleaner, more concise window title
  - Updated all UI text, comments, and documentation
  - Streamlined user experience with simpler terminology

### Theme Improvements

- **Enhanced Collapsible Card Backgrounds** - Added theme-aware background colors for card bodies
  - **Dark Mode**: Semi-transparent dark background `rgba(20, 20, 30, 0.4)` for better visual depth
  - **Light Mode**: Light gray surface background `#f5f7fa` for improved readability
  - New CSS variables: `--brand-dark-bg-card-body` and `--brand-light-bg-card-body`
  - Consistent color inheritance across both themes

### Code Cleanup

- **Removed Unused Modal Code** - Cleaned up legacy skill modal HTML and CSS
  - Removed modal HTML structure from GUI view (~24 lines)
  - Removed ~450 lines of unused modal CSS
  - Skill analysis button now directly opens dedicated window
  - Faster, more direct user experience

## 🔧 Technical Changes

### CSS Architecture

- Added new theme variables to `:root`:
  - `--brand-dark-bg-card-body`: Semi-transparent dark card body background
  - `--brand-light-bg-card-body`: Light surface background for cards
- Updated skill analysis window theme mappings
- Improved CSS organization and maintainability

### JavaScript & IPC Updates

- Renamed IPC events and functions for consistency:
  - `open-advanced-skill-window` → `open-skill-analysis-window`
  - `createAdvancedSkillWindow()` → `createSkillAnalysisWindow()`
  - `openAdvancedSkillWindow()` → `openSkillAnalysisWindow()`
- Simplified skill analysis window opening logic
- Removed modal display and animation code

### File Changes

- Updated: `public/gui-skills-view.html` - Window title
- Updated: `src/app/electronGUI.js` - Function names, IPC events, window title, log messages
- Updated: `src/app/preload.js` - IPC event names
- Updated: `public/js/guiClient.js` - Comments and API calls
- Updated: `public/js/guiSkillAnalysis.js` - File header comments
- Updated: `public/css/style.css` - Theme variables, removed modal CSS
- Cleaned: `public/gui.html` - Removed modal HTML

## 🔄 Breaking Changes

### IPC Event Names (for custom integrations)

If you have custom integrations using the skill analysis window, update the IPC event name:

```javascript
// Old
ipcRenderer.send("open-advanced-skill-window", uid);

// New
ipcRenderer.send("open-skill-analysis-window", uid);
```

### API Method Names

If calling the skill analysis window from custom code:

```javascript
// Old
window.electronAPI.openAdvancedSkillWindow(uid);

// New
window.electronAPI.openSkillAnalysisWindow(uid);
```

## 📦 Installation

### Windows Installer

Download `BPSR-Tools-Setup-1.1.1.exe` from the [releases page](https://github.com/akzios/bpsr-tools/releases/tag/v1.1.1).

**Requirements:**

- Windows 10/11 (x64)
- Npcap (network packet capture driver)
- Administrator privileges for packet capture

### Upgrading from v1.1.0

The auto-updater will notify you when v1.1.1 is available:

1. Click "Download Update" when prompted
2. Restart the application when download completes
3. Settings and data are automatically preserved

**Manual Update:**

1. Download the new installer
2. Run the installer (upgrades in place)
3. Your settings are preserved in `%APPDATA%\BPSR Tools`

## 🙏 Credits

Thank you to all users who provided feedback on the UI improvements!

## 🔗 Links

- [GitHub Repository](https://github.com/akzios/bpsr-tools)
- [Report Issues](https://github.com/akzios/bpsr-tools/issues)
- [Full Changelog](./CHANGELOG.md)

---

**Full Changelog**: v1.1.0...v1.1.1
