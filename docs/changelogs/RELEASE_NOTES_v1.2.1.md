# BPSR Tools v1.2.1 Release Notes

## 🎯 New Features

### Parse Mode for Dummy Testing

- **Configurable parse duration** - Test your DPS on training dummies with timed sessions (1-5 minutes)
  - Select duration with slider in parse panel
  - Click Start to begin - meter clears and waits for your first damage
  - Live countdown display showing remaining time
  - Automatically pauses tracking when timer expires
  - Perfect for comparing builds, rotations, and gear setups

### PNG Export with Anti-Tampering

- **Export parse results to PNG** - Share your DPS parses with confidence
  - Optional toggle in parse panel - enable to auto-export when parse completes
  - Saves to Desktop (Electron mode) or Downloads (web browser mode)
  - Comprehensive stats matching the player bar format:
    - Player names, professions, and class icons
    - DPS, HPS, DT (Damage Taken)
    - CRIT%, LUCK%, MAX (Peak DPS)
    - GS (Gear Score), Total Damage, Total Healing
    - Damage percentage contribution per player

- **Cryptographic verification system** - Prevent fake/edited parses
  - SHA-256 hash generated from all parse data
  - 16-character verification code displayed in header, footer, and watermark
  - Full hash logged to console for manual verification
  - Any edits to player names, numbers, or stats will invalidate the hash

- **Anti-tampering visual elements**
  - Subtle background patterns (3% opacity circular grid)
  - Semi-transparent watermarks ("BPSR TOOLS" diagonal text)
  - Verification badge watermark in center (4% opacity shield icon with hash)
  - Theme-aware design (light/dark mode support)

## 🔧 Improvements

### UI/UX Enhancements

- **Toggle switch component standardization** - Shared toggle styles across all views
  - Removed `.launcher-root` scope restriction
  - Added `-webkit-app-region: no-drag` for Electron compatibility
  - Added focus state for keyboard accessibility
  - Consistent brand gradient styling when enabled

- **Collapsible panel layout** - Proper flex stacking for controls, panels, and player bars
  - Panels take 45% of window height when open
  - Only one panel open at a time (mutual exclusivity)
  - Smooth height transitions with animations

## 🐛 Bug Fixes

### JavaScript Errors

- **Fixed duplicate timestamp declaration** - Resolved `SyntaxError` causing all buttons to stop working
  - Renamed conflicting variable to `fileTimestamp` in PNG export
  - Restored full functionality to controls and collapsible panels

### Layout Issues

- **Fixed collapsible panels flex layout** - Panels now properly push down player bars
  - Removed absolute positioning from loading indicator
  - Added proper flex-shrink values to prevent layout conflicts

## 📋 Technical Details

### New API Methods

**Electron IPC:**
- `saveFileToDesktop(filename, dataUrl)` - Saves PNG files directly to user's Desktop
  - Returns `{success: true, path: string}` on success
  - Converts base64 data URL to buffer and writes to file system
  - Available in Electron mode only

**Parse Mode States:**
- `inactive` - Parse not running
- `waiting` - Waiting for player to deal damage
- `active` - Countdown in progress

**Verification Hash:**
- Generated from: `{timestamp, duration, players: [{name, dps, damage, profession}]}`
- Algorithm: SHA-256 via Web Crypto API
- Displayed as: 16-character uppercase hex string

### Canvas Export Specifications

- **Dimensions:** 950px width × dynamic height (85px per player + header/footer)
- **Fonts:** Inter (stats), Courier New (hash codes)
- **Max Players:** Top 10 by damage
- **Anti-aliasing:** Enabled for smooth text rendering
- **Format:** PNG with maximum quality

## 📦 Installation

### Windows Installer

Download `BPSR-Tools-Setup-1.2.1.exe` from the [releases page](https://github.com/akzios/bpsr-tools/releases/tag/v1.2.1).

**Requirements:**

- Windows 10/11 (x64)
- Npcap (network packet capture driver)
- Administrator privileges for packet capture

### Upgrading from v1.2.0

The auto-updater will notify you when v1.2.1 is available:

1. Click "Download Update" when prompted
2. Restart the application when download completes
3. Settings and data are automatically preserved

**Manual Update:**

1. Download the new installer
2. Run the installer (upgrades in place)
3. Your settings are preserved in `%APPDATA%\BPSR Tools`

## 🎮 Usage Guide

### How to Use Parse Mode

1. Click the **Parse button** (crosshairs icon) in the header
2. Adjust duration slider (1-5 minutes)
3. Enable "Export to PNG" toggle if you want automatic screenshot
4. Click **Start**
5. Deal damage to a dummy - countdown begins automatically
6. Parse stops when timer reaches zero
7. If export enabled, PNG saves to Desktop

### Verifying PNG Authenticity

1. Check verification code appears in 3 locations:
   - Header (with shield emoji)
   - Footer (with warning message)
   - Center watermark (subtle shield badge)
2. All three codes must match
3. Check console logs for full 64-character hash
4. Any tampering with stats will create a mismatch

## 🙏 Credits

Thank you to all users testing the parse mode and providing feedback on the PNG export features!

## 🔗 Links

- [GitHub Repository](https://github.com/akzios/bpsr-tools)
- [Report Issues](https://github.com/akzios/bpsr-tools/issues)
- [Full Changelog](./CHANGELOG.md)

---

**Full Changelog**: v1.2.0...v1.2.1
