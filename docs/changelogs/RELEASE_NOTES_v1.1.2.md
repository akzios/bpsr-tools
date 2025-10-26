# BPSR Tools v1.1.2 Release Notes

## 🐛 Bug Fixes

### Web Browser Mode Improvements

- **Fixed skill analysis button not working in web browser mode** - Skill analysis button now works correctly when accessing the DPS meter from web browsers (iPad, phone, desktop)
  - Previously only worked in Electron overlay mode
  - Now opens skill analysis in a centered popup window for web browsers
  - Popup window dimensions: 1400x1000 (matches Electron window size)
  - Popup is centered on screen, resizable, and reuses the same window when clicked multiple times
  - Seamless experience across all access methods (Electron, web browser, mobile devices)

## 🔧 Technical Changes

### Skill Analysis Window Opening Logic

- Added platform detection to handle Electron vs web browser differently
- **Electron mode**: Opens native Electron window via IPC (existing behavior)
- **Web browser mode**: Opens centered popup window with `window.open()`
- Popup window features:
  - Width: 1400px, Height: 1000px
  - Centered position: calculated based on screen dimensions
  - Resizable and scrollable
  - Named window ('skillAnalysis') to prevent duplicate popups

### Code Changes

- Updated: `public/js/guiClient.js` - Added web browser fallback for skill analysis button
- Logic now checks for `window.electronAPI` and provides appropriate behavior for each platform

## 📦 Installation

### Windows Installer

Download `BPSR-Tools-Setup-1.1.2.exe` from the [releases page](https://github.com/akzios/bpsr-tools/releases/tag/v1.1.2).

**Requirements:**
- Windows 10/11 (x64)
- Npcap (network packet capture driver)
- Administrator privileges for packet capture

### Upgrading from v1.1.1

The auto-updater will notify you when v1.1.2 is available:
1. Click "Download Update" when prompted
2. Restart the application when download completes
3. Settings and data are automatically preserved

**Manual Update:**
1. Download the new installer
2. Run the installer (upgrades in place)
3. Your settings are preserved in `%APPDATA%\BPSR Tools`

## 🙏 Credits

Thank you to all users accessing BPSR Tools from multiple devices!

## 🔗 Links

- [GitHub Repository](https://github.com/akzios/bpsr-tools)
- [Report Issues](https://github.com/akzios/bpsr-tools/issues)
- [Full Changelog](./CHANGELOG.md)

---

**Full Changelog**: v1.1.1...v1.1.2
