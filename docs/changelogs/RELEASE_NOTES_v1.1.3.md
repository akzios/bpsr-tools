# BPSR Tools v1.1.3 Release Notes

## 🐛 Bug Fixes

### Skill Analysis Chart Fix

- **Fixed line chart not displaying in packaged mode** - DPS/HPS real-time graph now works correctly in production builds
  - Previously Chart.js was loaded from CDN, which could fail in packaged Electron apps
  - Now Chart.js is bundled locally in `public/libs/chart.umd.min.js`
  - Issue affected both Electron overlay and web browser modes when using packaged installer
  - Chart now loads reliably in all environments (development, packaged, offline)

## 🔧 Technical Changes

### Chart.js Bundling

- Added `chart.js@^4.5.1` to package dependencies
- Created `public/libs/` directory for bundled JavaScript libraries
- Copied Chart.js UMD bundle to `public/libs/chart.umd.min.js`
- Updated `gui-skills-view.html` to use local Chart.js file instead of CDN
- Benefits:
  - Works offline without internet connection
  - No CDN or CSP (Content Security Policy) issues
  - Faster loading (no external HTTP requests)
  - More reliable in corporate/restricted networks

## 📦 Installation

### Windows Installer

Download `BPSR-Tools-Setup-1.1.3.exe` from the [releases page](https://github.com/akzios/bpsr-tools/releases/tag/v1.1.3).

**Requirements:**

- Windows 10/11 (x64)
- Npcap (network packet capture driver)
- Administrator privileges for packet capture

### Upgrading from v1.1.2

The auto-updater will notify you when v1.1.3 is available:

1. Click "Download Update" when prompted
2. Restart the application when download completes
3. Settings and data are automatically preserved

**Manual Update:**

1. Download the new installer
2. Run the installer (upgrades in place)
3. Your settings are preserved in `%APPDATA%\BPSR Tools`

## 🙏 Credits

Thank you to all users who reported the chart display issue in packaged mode!

## 🔗 Links

- [GitHub Repository](https://github.com/akzios/bpsr-tools)
- [Report Issues](https://github.com/akzios/bpsr-tools/issues)
- [Full Changelog](./CHANGELOG.md)

---

**Full Changelog**: v1.1.2...v1.1.3
