# Changelog

All notable changes to BPSR Tools will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2025-01-29

### Added

- Parse Mode for dummy testing with configurable duration (1-5 minutes)
- PNG export feature for parse results with optional toggle
- Cryptographic verification system (SHA-256 hash) to prevent tampering
- Desktop save location for PNG exports in Electron mode
- Comprehensive anti-tampering visual elements:
  - Verification hash displayed in header and footer
  - Subtle background patterns and watermarks
  - Verification badge watermark in center background
- Detailed stats in PNG export matching player bar format:
  - DPS, HPS, DT (Damage Taken)
  - CRIT%, LUCK%, MAX (Peak DPS)
  - GS (Gear Score), Total Damage, Total Healing
  - Class icons with damage percentage overlay
- Toggle switch component shared across all views
- Console logging of verification data for manual checking

### Changed

- Parse panel uses collapsible layout with duration slider
- Parse mode waits for local player damage before starting countdown
- PNG exports to Desktop folder (Electron) or Downloads folder (Web)
- Toggle switch styles now global instead of scoped to launcher
- Player row height increased to 85px in PNG exports for comprehensive stats

### Fixed

- Duplicate `timestamp` variable declaration causing JavaScript errors
- Collapsible panels using proper flex layout
- Toggle switch styling consistency across GUI and launcher views

## [1.2.0] - 2025-01-XX

### Added

- Monster type filtering (Boss, Elite, Normal, Support Doll) with multi-select dropdown
- Pause/resume button to control tracking without clearing data
- Healer visibility in overlay when providing healing (not just damage dealers)

### Changed

- Streamlined UI with icon-only Clear/Pause buttons and new Filter button
- Services refactored to `src/server/service/` directory
- Database models use capitalized naming convention
- Assets reorganized to `public/assets/` structure
- Auto-clear timeout increased from 60s to 80s
- Suppressed verbose packet logs for better performance

### Fixed

- Accidental text selection during window drag
- Control button icon alignment
- Loading message when filter excludes all data

## [1.1.3] - 2025-01-XX

### Fixed

- Line chart not displaying in skill analysis window when using packaged installer
- Chart.js CDN loading issues in Electron packaged apps

### Changed

- Chart.js now bundled locally instead of loaded from CDN
- Skill analysis window loads Chart.js from `public/libs/chart.umd.min.js`

### Added

- Local Chart.js bundle in `public/libs/` directory
- `chart.js@^4.5.1` dependency to package.json

## [1.1.2] - 2025-01-XX

### Fixed

- Skill analysis button not working in web browser mode (iPad, phone, desktop browsers)
- Skill analysis now opens in centered popup window for web browsers instead of failing silently

### Changed

- Web browser mode now opens skill analysis in 1400x1000 centered popup window
- Popup window is resizable and reuses same window when clicked multiple times

## [1.1.1] - 2025-01-XX

### Changed

- Renamed "Advanced Skill Analysis" to "Skill Analysis" throughout the application
- IPC event renamed: `open-advanced-skill-window` → `open-skill-analysis-window`
- Function renamed: `createAdvancedSkillWindow` → `createSkillAnalysisWindow`
- API method renamed: `openAdvancedSkillWindow` → `openSkillAnalysisWindow`
- Collapsible card body backgrounds now use theme-aware CSS variables
- Dark mode card bodies: `rgba(20, 20, 30, 0.4)` for visual depth
- Light mode card bodies: `#f5f7fa` for improved readability

### Added

- New CSS variables: `--brand-dark-bg-card-body` and `--brand-light-bg-card-body`
- Theme-specific card body background colors in skill analysis window

### Removed

- Unused skill modal HTML structure (~24 lines)
- Unused modal CSS (~450 lines)
- Legacy modal JavaScript functions

## [1.1.0] - 2025-01-XX

### Added

- Dynamic profession icon loading in advanced skill analysis window header
- Full-window drag support for advanced skill analysis window (drag from anywhere except interactive elements)
- Additional 100px vertical space in advanced skill analysis window (1400x1000)

### Changed

- Advanced skill analysis window dimensions increased from 1400x900 to 1400x1000
- Minimum window height increased from 700px to 800px
- Drag functionality now works from entire window surface instead of just header bar

### Fixed

- Inconsistent drag behavior previously limited to header bar only
- Limited vertical space causing chart visibility issues in skill analysis window

## [1.0.2] - 2025-01-XX

### Added

- Documentation conventions in CLAUDE.md
- Simplified README.md structure

### Changed

- README.md streamlined from 519 to 183 lines for better readability
- Moved detailed documentation to release notes

## [1.0.1] - 2025-01-XX

### Added

- Manual database update feature via launcher UI
- "Update Database" button in launcher settings (Database Management section)
- Real-time status updates during database operations
- Statistics display showing entries added to each table
- Player data fetching from external leaderboard API
- Seed file packaging in extraResources for packaged apps
- Text selection enabled in launcher settings for informational areas
- Info box CSS class using brand design variables

### Changed

- Advanced skill analysis modal positioning from absolute to fixed
- Modal backdrop positioning to fixed for better interaction
- fetchPlayerSeed.js now exportable with optional targetPath parameter
- Seed directory auto-creation if it doesn't exist

### Fixed

- Skill analysis modal clickability issues with zoom transforms
- "showModal is not defined" error (changed to showConfirm)
- fetch("/api/update-database") file:// protocol error (switched to IPC)
- Hardcoded colors in HTML (migrated to CSS class with brand variables)
- Seed file path resolution for packaged apps

## [1.0.0] - 2025-01-XX

### Added

- Initial release
- Real-time DPS/HPS tracking
- Three operational modes: CLI, Web Server, Electron Overlay
- Multi-mode support (all modes can run simultaneously)
- Shared backend server on port 8989
- Network packet capture using Npcap
- Profession system with bilingual support (Chinese/English)
- Pre-seeded SQLite database with professions, monsters, and skills
- Google Sheets integration for combat data sync
- Auto-update system via GitHub Releases
- Advanced skill analysis window with charts and detailed breakdowns
- Launcher GUI for mode selection and settings
- Database seeding and update system
- Multi-device support (accessible from iPad, phone, etc.)
- Real-time Socket.IO updates (100ms intervals)
- Sub-profession detection from skill usage
- Combat history tracking
- Configurable auto-clear on channel change and timeout
- Role-based class color coding (DPS/Tank/Healer)

### Technical

- Electron desktop framework
- Express HTTP server with Socket.IO WebSocket
- SQLite database with INTEGER PRIMARY KEYs
- Protobuf message decoding
- Zstd compression handling
- TCP stream reassembly
- BPF packet filtering
- Chart.js for data visualization
- Winston logging system
- electron-updater for auto-updates

[1.2.0]: https://github.com/akzios/bpsr-tools/releases/tag/v1.2.0
[1.1.3]: https://github.com/akzios/bpsr-tools/releases/tag/v1.1.3
[1.1.2]: https://github.com/akzios/bpsr-tools/releases/tag/v1.1.2
[1.1.1]: https://github.com/akzios/bpsr-tools/releases/tag/v1.1.1
[1.1.0]: https://github.com/akzios/bpsr-tools/releases/tag/v1.1.0
[1.0.2]: https://github.com/akzios/bpsr-tools/releases/tag/v1.0.2
[1.0.1]: https://github.com/akzios/bpsr-tools/releases/tag/v1.0.1
[1.0.0]: https://github.com/akzios/bpsr-tools/releases/tag/v1.0.0
