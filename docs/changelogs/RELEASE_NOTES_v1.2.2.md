# BPSR Tools v1.2.2 Release Notes

## 🐛 Bug Fixes

### PNG Export & Verification

- **Fixed PNG chunk parsing loop** - Resolved critical bug preventing metadata injection
  - Changed loop condition from `pos < bytes.length - 12` to `pos <= bytes.length - 12` in both `injectPNGMetadata()` and `extractPNGMetadata()` functions
  - Loop was stopping one byte position before reaching the IEND chunk at `bytes.length - 12`
  - IEND chunk is always 12 bytes (4 length + 4 type + 0 data + 4 CRC) and located at the end of PNG files
  - Metadata injection now successfully embeds tEXt chunk with verification data
  - Verification system now properly extracts and validates embedded metadata
  - Added detailed chunk-by-chunk logging for debugging
  - Console now shows all chunks found including IEND

**Before:**
```
Chunks found in PNG: IHDR, IDAT, IDAT, IDAT...
(IEND missing - loop stopped too early)
Could not find IEND chunk in PNG
```

**After:**
```
Chunk at 8: IHDR, length: 13
Chunk at 33: IDAT, length: ...
...
Chunk at XXXX: IEND, length: 0
Found IEND at position: XXXX
Chunks found: IHDR, IDAT, ..., tEXt, IEND
```

## 🔧 Improvements

### UI/UX Enhancements

- **Collapsible panel scrollbar styling** - Unified scrollbar appearance across the application
  - Added theme-aware scrollbar styles for `.panel-content`
  - 10px width with rounded corners (5px border-radius)
  - Uses brand purple color (`rgba(102, 126, 234, ...)`) for scrollbar thumb
  - Light mode: Brighter purple with light track background
  - Dark mode: Subtle purple with dark track background
  - Matches styling in filter dropdown, player bars, and skill analysis
  - Includes hover and active states for better interactivity
  - Added `-webkit-app-region: no-drag` for Electron window dragging compatibility

## 📋 Technical Details

### PNG Chunk Structure

PNG files consist of an 8-byte signature followed by chunks with this structure:
- **Length** (4 bytes): Chunk data length in big-endian format
- **Type** (4 bytes): Chunk type identifier (e.g., "IHDR", "IDAT", "tEXt", "IEND")
- **Data** (variable): Chunk data
- **CRC** (4 bytes): Cyclic redundancy check for type + data

The IEND chunk marks the end of a PNG file and has:
- Length: 0x00000000 (no data)
- Type: "IEND"
- Data: (none)
- CRC: 4 bytes
- Total size: 12 bytes
- Position: Always at `bytes.length - 12`

### Loop Condition Fix

**Problem:**
```javascript
while (pos < bytes.length - 12)  // Stops at bytes.length - 13
```
This condition allows the loop to continue while `pos` is **less than** `bytes.length - 12`, meaning the last position checked is `bytes.length - 13`, which is one byte before IEND starts.

**Solution:**
```javascript
while (pos <= bytes.length - 12)  // Includes position bytes.length - 12
```
This allows the loop to continue while `pos` is **less than or equal to** `bytes.length - 12`, ensuring IEND at position `bytes.length - 12` is processed.

### CSS Variables Used

**Scrollbar styling leverages existing brand color variables:**

Dark mode:
- `--brand-dark-scrollbar-track: rgba(255, 255, 255, 0.05)`
- `--brand-dark-scrollbar-thumb: rgba(102, 126, 234, 0.3)`
- `--brand-dark-scrollbar-thumb-hover: rgba(102, 126, 234, 0.5)`
- `--brand-dark-scrollbar-thumb-active: rgba(102, 126, 234, 0.6)`

Light mode:
- `--brand-light-scrollbar-track: rgba(0, 0, 0, 0.05)`
- `--brand-light-scrollbar-thumb: rgba(102, 126, 234, 0.4)`
- `--brand-light-scrollbar-thumb-hover: rgba(102, 126, 234, 0.6)`
- `--brand-light-scrollbar-thumb-active: rgba(102, 126, 234, 0.7)`

## 📦 Installation

### Windows Installer

Download `BPSR-Tools-Setup-1.2.2.exe` from the [releases page](https://github.com/akzios/bpsr-tools/releases/tag/v1.2.2).

**Requirements:**

- Windows 10/11 (x64)
- Npcap (network packet capture driver)
- Administrator privileges for packet capture

### Upgrading from v1.2.1

The auto-updater will notify you when v1.2.2 is available:

1. Click "Download Update" when prompted
2. Restart the application when download completes
3. Settings and data are automatically preserved

**Manual Update:**

1. Download the new installer
2. Run the installer (upgrades in place)
3. Your settings are preserved in `%APPDATA%\BPSR Tools`

## 🎮 Usage Guide

### Testing PNG Verification (Now Fixed!)

1. Click the **Parse button** (crosshairs icon) in the header
2. Enable "Export to PNG" toggle
3. Click **Start** and do damage to begin countdown
4. When parse completes, PNG exports to Desktop
5. In the parse panel, scroll down to **Verify PNG Parse** section
6. Drag and drop the exported PNG or click to select it
7. You should now see:
   - ✅ "Verified! This parse is authentic and unmodified"
   - Verification Code, Timestamp, Duration, and Player count

**Console Output (Success):**
```
Injecting metadata into PNG: {...}
PNG size: 426329 bytes
Chunk at 8: IHDR, length: 13
Chunk at 33: IDAT, length: 16384
...
Chunk at 423456: IEND, length: 0
Found IEND at position: 423456
Will inject tEXt chunk before IEND at position: 423456
Metadata injected successfully. New PNG size: 424567 bytes

Extracting metadata from PNG, size: 424567 bytes
Found tEXt chunk at position: 423456
tEXt keyword: BPSR-Verification
Found BPSR-Verification metadata!
Chunks found in PNG: IHDR, IDAT, ..., tEXt, IEND
✅ Verified! This parse is authentic...
```

## 🙏 Credits

Thank you to all users who reported the PNG verification issue and helped test the fix!

## 🔗 Links

- [GitHub Repository](https://github.com/akzios/bpsr-tools)
- [Report Issues](https://github.com/akzios/bpsr-tools/issues)
- [Full Changelog](./CHANGELOG.md)

---

**Full Changelog**: v1.2.1...v1.2.2
