# BPSR Tools v1.2.3 Release Notes

## ✨ New Features

### Auto-Scaling GUI Overlay

- **Responsive scaling for compact displays** - GUI overlay now automatically scales when resized below 676px width
  - Content scales smoothly from 1.0x down to 0.5x minimum
  - Maintains perfect readability and usability even at tiny sizes
  - All UI elements (buttons, text, bars, icons) scale proportionally
  - Ideal for minimalist setups, small monitors, or multi-window gaming

**Scaling Behavior:**
- **676px+ width**: Normal 100% scale
- **500px width**: ~0.74x scale (automatically calculated)
- **350px width** (minimum): ~0.52x scale
- **Smooth transition**: Scale adjusts dynamically as you resize

### Flexible Minimum Window Size

- **Resize down to 350x200** (previously locked at 700x400)
  - Perfect for users who want a compact overlay
  - Great for small screen setups (laptops, ultrawide monitors with limited vertical space)
  - Control buttons wrap to multiple rows instead of getting cut off
  - All functionality remains accessible at any size

## 🐛 Bug Fixes

### Web Browser Mode Fixed

- **Fixed HTML rendering issue** - Web browser mode at `http://localhost:8989` now correctly displays the GUI
  - Issue: Server was sending `Content-Type: application/json` for all routes
  - Result: Browsers displayed raw HTML source code instead of rendering the page
  - **Solution**: Middleware now only applies JSON Content-Type to `/api/*` routes
  - HTML pages now correctly use `Content-Type: text/html`
  - Works perfectly on iPad, phones, and desktop browsers

**Before:**
```
User navigates to http://localhost:8989
Browser displays: <!doctype html><html>... (raw HTML source)
```

**After:**
```
User navigates to http://localhost:8989
Browser displays: Rendered DPS meter interface ✅
```

### Resize Constraints Updated

- **Removed restrictive resize limits** - All resize methods now allow 350x200 minimum
  - Electron window `minWidth`/`minHeight` updated from 200x200 to 350x200
  - JavaScript resize handle constraints updated from 700x400 to 350x200
  - CSS min-width relaxed from 676px to 350px
  - Consistent minimum size across all resize methods (drag edges, programmatic, etc.)

## 🔧 Improvements

### Responsive Control Buttons

- **Flexible button layout** - Control buttons now wrap when window is too narrow
  - Added `flex-wrap: wrap` to header controls
  - Buttons flow to multiple rows instead of overflowing/cutting off
  - Logo and spacer sized appropriately to prevent layout issues
  - All buttons remain accessible even at minimum 350px width

**Layout Examples:**
- **700px width**: Single row with all buttons
- **500px width**: Buttons wrap to 2 rows
- **350px width**: Buttons wrap to 2-3 rows (all visible)

## 📋 Technical Details

### Auto-Scaling Implementation

**How it works:**

1. JavaScript monitors `window.innerWidth` every 100ms and on resize events
2. When width drops below 676px, CSS `transform: scale(X)` is applied
3. Scale factor calculated as: `Math.max(0.5, currentWidth / 676)`
4. Container dimensions adjusted to compensate for scaling
5. Overflow handling prevents scrollbars during scale

**Code locations:**
- `public/js/guiClient.js` - `updateGUIScale()` function (lines ~1333-1382)
- `public/css/style.css` - `.controls` flex-wrap styles (line ~871)
- `src/app/electronGUI.js` - Window configuration (lines ~154-155)

**Scale calculation:**
```javascript
const minWidth = 676;  // Natural width before scaling starts
const minScale = 0.5;  // Minimum scale factor (50%)
const scale = Math.max(minScale, window.innerWidth / minWidth);
```

### Content-Type Fix

**Issue:**
Global middleware applied JSON Content-Type to all responses:
```javascript
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
```

**Solution:**
Scoped middleware to API routes only:
```javascript
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
```

Now HTML files served by Express static middleware use their natural `text/html` Content-Type.

**File:** `src/server/api.js` (line ~30)

## 📦 Installation

### Windows Installer

Download `BPSR-Tools-Setup-1.2.3.exe` from the [releases page](https://github.com/akzios/bpsr-tools/releases/tag/v1.2.3).

**Requirements:**

- Windows 10/11 (x64)
- Npcap (network packet capture driver)
- Administrator privileges for packet capture

### Upgrading from v1.2.2

The auto-updater will notify you when v1.2.3 is available:

1. Click "Download Update" when prompted
2. Restart the application when download completes
3. Settings and data are automatically preserved

**Manual Update:**

1. Download the new installer
2. Run the installer (upgrades in place)
3. Your settings are preserved in `%APPDATA%\BPSR Tools`

## 🎮 Usage Guide

### Using Auto-Scale at Small Sizes

1. Launch **GUI Overlay Mode** from the launcher
2. Drag window edges/corners to resize below 676px width
3. Watch content automatically scale down (check console for scale logs)
4. Resize down to 350x200 minimum for ultra-compact overlay
5. All buttons remain clickable even when wrapped to multiple rows

### Testing Web Browser Mode

1. Launch any mode from the launcher (starts backend server)
2. Open browser and navigate to `http://localhost:8989`
3. You should see the rendered DPS meter interface (not HTML source)
4. Works on iPad, phones, and desktop browsers
5. Access from other devices on your network using the IP shown in console

**Network Access Example:**
```
Local access: http://localhost:8989
Network access (iPad/other devices):
  → http://192.168.1.100:8989
```

## 🙏 Credits

Thank you to all users who requested better scaling and reported the web browser issue!

## 🔗 Links

- [GitHub Repository](https://github.com/akzios/bpsr-tools)
- [Report Issues](https://github.com/akzios/bpsr-tools/issues)
- [Full Changelog](./CHANGELOG.md)

---

**Full Changelog**: v1.2.2...v1.2.3
