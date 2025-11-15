# Release Notes - Version 2.0.6

**Release Date:** 2025-01-15
**Type:** Patch Release

## What's Fixed

- **Google Sheets Update Logic** - Critical fixes for data integrity
  - Fixed GS comparison parsing bug where comma-formatted numbers (e.g., "21,513") were incorrectly parsed as 21, causing lower GS values to overwrite higher ones
  - Fixed name/class preservation to prevent overwriting real player data with "Unknown" placeholder values when API returns empty responses
  - Enhanced data validation to only update rows when GS actually increases
  - Preserves existing player names and professions when new data is unavailable

## What's New

- **Version Info Display** - Settings page now shows your current app version
  - Added `/api/version` API endpoint to retrieve version from package.json
  - Displays "Current version: vX.X.X" in Settings → App Updates section
  - Works correctly in both development and packaged/production modes

---

## Installation

Download the installer from the [Releases](https://github.com/akzios/bpsr-tools/releases) page or use the built-in auto-updater.

Your settings and data will be preserved during the update.

## Impact

**For Guild VGL Members Using Google Sheets:**
This release fixes critical bugs that could have caused player data corruption in your shared spreadsheet. If you noticed player names changing to "Unknown" or GS values decreasing unexpectedly, this update resolves both issues.
