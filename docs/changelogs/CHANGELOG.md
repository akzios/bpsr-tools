# Changelog

All notable changes to BPSR Tools will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - TBD

### Breaking Changes

- Config directory no longer shipped in installation packages
  - Settings now exclusively use `%APPDATA%\bpsr-tools\config\`
- Auto-clear on timeout feature removed
  - Use manual clear button or auto-clear on channel change instead

### Added

- **TypeScript Migration:** Complete frontend refactored to TypeScript with strict mode
  - Type safety with compile-time error detection
  - Path aliases: `@shared/*`, `@components/*`, `@app-types/*`
  - Zero framework overhead (compiles to vanilla JavaScript)
- **Component-Based Architecture:** 14 reusable components for 100% code reuse
  - Button, Toggle, Modal, DPSTable, ControlPanel, Header, Sidebar, Filter, Slider, etc.
  - 4 shared utilities: socketManager, router, dataFormatter, uiHelpers (40+ functions)
- **Multi-View Shell:** New app shell with navigation and routing
  - Hash-based routing (`/dpsmeter`, `/sessions`, `/settings`)
  - Header component with theme toggle, pin, zoom, close buttons
  - Collapsible sidebar with persistent state
  - Route persistence between sessions
- **Sessions Tracking System:** Complete combat session management
  - Save/load combat data with custom names and auto-detected types
  - Session history view with sortable columns
  - Session detail view with complete player and skill breakdowns
  - Auto-save system with configurable triggers (on clear, inactivity, window close)
  - Session type detection (Parse, Dungeon, Raid, Guild Hunt, Boss Crusade, Open World)
  - Complete data preservation (player stats, skill breakdowns, time-series DPS, target damage)
  - Real-time dashboard with stats cards, DPS chart, top players/skills
  - Database schema: 2 tables (sessions, session_players) with CASCADE delete
  - Automatic column migration for database schema updates
- Enhanced collapsible animations in settings
  - Grid-based height transitions (smoother than max-height)
  - Opacity fades, hover effects (translateX, scale)
  - Optimized icon rotation with `will-change: transform`
- Build system improvements
  - New `scripts/copyAssets.js` for production builds
  - `npm run build:full` compiles TypeScript + copies assets
  - `predist`/`prepublish` hooks ensure complete builds

### Fixed

- **CRITICAL:** Settings and database save path issues
  - Were being saved to read-only installation directory
  - Now properly use `%APPDATA%\bpsr-tools` for all execution contexts
  - Added extensive logging showing exact save locations
- **CRITICAL:** Auto-save functionality
  - DEFAULT_SETTINGS was missing `autoSave` object
  - Duration calculation using wrong data type (object vs number)
  - Total damage sum using incorrect property path
  - Auto-save now triggers correctly based on thresholds
- Skill data in sessions
  - `getSummary()` now includes `skill_breakdown: this.getSkillSummary()`
  - Skill names properly display in session history
- Database merge completeness
  - Monster merge now includes `monster_type` and `score` columns
- Settings button positioning
  - Now appears at bottom of sidebar when CLI menu is absent
- TypeScript compilation errors across all views

### Changed

- Static file serving strategy
  - Dev mode: Serves from both `dist/public/` and source `public/`
  - Production: Serves only from `dist/public/`
  - Smaller installation size (no duplicate source files)
- Removed `checkTimeoutClear()` calls from combat event handlers
- Removed config file copying (no longer necessary)
- Updated electron-builder to exclude config directory

### Removed

- Auto-clear on timeout feature (entire functionality)
  - Removed UI controls (toggle + number input)
  - Removed `checkTimeoutClear()` method
  - Removed settings: `autoClearOnTimeout`, `clearTimeoutSeconds`
- Config directory from installation packages
  - No longer needed with proper user data directory usage

## [1.2.3] - 2025-10-29

### Added

- Auto-scaling GUI overlay when window is resized below 676px
  - Content scales smoothly from 1.0x down to 0.5x minimum
  - Maintains readability and usability at small sizes
  - Responsive control buttons that wrap instead of getting cut off
- Flexible minimum window size of 350x200 (down from 700x400)
  - Users can resize GUI overlay to any compact size
  - Perfect for small screen setups or minimalist overlays

### Fixed

- Web browser mode now correctly displays rendered HTML instead of source code
  - Fixed Content-Type header from `application/json` to `text/html`
  - Middleware now only applies JSON Content-Type to `/api/*` routes
- Resize handles now allow shrinking below previous 700x400 minimum
  - Electron window `minWidth`/`minHeight` updated to 350x200
  - JavaScript resize constraints updated to match

### Changed

- GUI overlay minimum window dimensions reduced from 700x400 to 350x200
- Control buttons now wrap to multiple rows when window is too narrow
- CSS min-width constraint relaxed from 676px to 350px to allow smaller sizes

## [1.2.2] - 2025-10-29

### Changed

- Collapsible panel scrollbars now match app styling with theme-aware colors

### Fixed

- PNG chunk parsing loop condition preventing IEND chunk detection
  - Changed loop condition from `pos < bytes.length - 12` to `pos <= bytes.length - 12`
  - Loop was stopping one position before IEND chunk
  - Metadata injection now works correctly
  - Verification system now properly finds embedded metadata

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

[1.2.2]: https://github.com/akzios/bpsr-tools/releases/tag/v1.2.2
[1.2.1]: https://github.com/akzios/bpsr-tools/releases/tag/v1.2.1
[1.2.0]: https://github.com/akzios/bpsr-tools/releases/tag/v1.2.0
[1.1.3]: https://github.com/akzios/bpsr-tools/releases/tag/v1.1.3
[1.1.2]: https://github.com/akzios/bpsr-tools/releases/tag/v1.1.2
[1.1.1]: https://github.com/akzios/bpsr-tools/releases/tag/v1.1.1
[1.1.0]: https://github.com/akzios/bpsr-tools/releases/tag/v1.1.0
[1.0.2]: https://github.com/akzios/bpsr-tools/releases/tag/v1.0.2
[1.0.1]: https://github.com/akzios/bpsr-tools/releases/tag/v1.0.1
[1.0.0]: https://github.com/akzios/bpsr-tools/releases/tag/v1.0.0
