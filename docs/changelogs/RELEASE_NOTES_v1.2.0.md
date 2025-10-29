# Release Notes - v1.2.0

**Release Date:** 2025-01-XX

## Overview

Version 1.2.0 introduces monster type filtering, pause/resume controls, and UI refinements to enhance your combat analysis experience.

## New Features

### Monster Type Filtering

Filter combat data by monster type (Boss, Elite, Normal, Support Doll) using the new multi-select dropdown in the control bar. The filter icon indicates when filters are active, and selections persist across sessions.

**Use Cases:**

- Analyze boss DPS separately from trash
- Exclude support dolls from calculations
- Compare performance by monster tier

### Pause/Resume Tracking

The new pause button (next to Clear) lets you freeze tracking without losing data. State persists across refreshes. Useful for separating trash from boss pulls or capturing stats for screenshots.

### Healer Support

Healers now appear in the overlay when providing healing, not just when dealing damage.

## UI Improvements

- Icon-only Clear and Pause buttons for cleaner look
- Filter button replaces zoom controls
- Improved button spacing and hover states
- Enhanced drag region in control bar
- Fixed accidental text selection during drag

## Technical Changes

- Services moved to `src/server/service/` directory
- Database models use capitalized naming (Monster.js, Seed.js, etc.)
- Assets reorganized to `public/assets/` structure
- Auto-clear timeout increased from 60s to 80s
- Suppressed verbose packet logs for better performance

## API Changes

**New Endpoint:** `/api/pause`

- GET: Returns current pause state
- POST: Sets pause state (body: `{paused: boolean}`)

**Modified:** `/api/data` now respects pause state

## Migration Notes

**For Users:** Auto-updates via built-in updater. New Filter and Pause buttons in control bar.

**For Developers:**

- Services moved to `src/server/service/`
- Assets moved to `public/assets/`

---

**Full Changelog:** https://github.com/akzios/bpsr-tools/blob/main/docs/changelogs/CHANGELOG.md
