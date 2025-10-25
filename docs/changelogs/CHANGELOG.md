# Changelog

All notable changes to BPSR Tools will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-01-25

### Fixed
- Skill analysis modal close button and backdrop now work correctly at all zoom levels
- Modal positioning changed from absolute to fixed to prevent zoom-related click issues
- Minimum height constraint (700px) now properly applied to DPS meter overlay
- Modal elements now properly clickable in Electron overlay mode

### Added
- Automated database rebuild before packaging (dist/publish commands)
- Smart database merging - new player data merges with existing instead of replacing
- Duplicate player removal by player_id during database updates
- New `npm run rebuild-db` command for manual database refresh
- Detailed merge statistics in console output during database rebuild

### Changed
- `fetchPlayerSeed.js` now merges data instead of replacing entire players.json
- Build workflow now automatically fetches latest player data before packaging
- Database rebuild script moved to `src/server/utilities/rebuildDatabase.js`
- Removed min-width constraint from `.bpsr-tools` container

### Technical
- Modal CSS: `.modal` and `.modal-backdrop` use `position: fixed`
- Added `pointer-events: auto` to modal close button
- Added `-webkit-app-region: no-drag` to modal elements
- Map-based deduplication logic for player data merging

## [1.0.0] - 2025-01-XX

### Added
- Initial release of BPSR Tools
- Three operational modes: CLI, Web Server, Electron Overlay
- Beautiful launcher GUI with mode selection
- Real-time DPS/HPS tracking from network packets
- Skill analysis breakdown per player
- Google Sheets integration for data export
- Auto-update system via GitHub Releases
- Bilingual profession system (Chinese/English)
- Database caching for players, monsters, skills, and professions
- Advanced and Lite display modes
- DPS and Healer view toggles
- Dark/Light theme support
- Zoom controls (0.5x to 2.0x)
- System tray integration
- Multi-mode support (run all modes simultaneously)

### Features
- **Network Packet Capture**: Uses Npcap to capture and decode Blue Protocol packets
- **Real-time Metrics**: DPS, HPS, damage taken, crit%, luck%, gear score, HP bars
- **Skill Breakdown**: Detailed per-player skill analysis with damage, hits, and crit rates
- **Auto-sync**: Configurable auto-clear on server change and timeout
- **Database Seeding**: Pre-seeded with 125,000+ players, 447 skills, 8 professions
- **Health Check Endpoint**: Server readiness verification for mode launching
- **Launch Throttling**: Prevents rapid concurrent mode launches with visual feedback
- **Settings UI**: Collapsible sections for Google Sheets, DPS Meter, Auto-Updates, and Database Management

### Technical Details
- Built with Electron 38, Node.js 22.15.0, Express 5, Socket.IO 4
- SQLite database with better-sqlite3
- Protobuf message decoding
- TCP stream reassembly for packet processing
- Winston logging system
- NSIS installer for Windows
- GitHub Releases integration for auto-updates

---

## Release Links

- [v1.0.1](https://github.com/akzios/bpsr-tools/releases/tag/v1.0.1) - Latest
- [v1.0.0](https://github.com/akzios/bpsr-tools/releases/tag/v1.0.0) - Initial Release

---

## Legend

- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Vulnerability fixes
- `Technical` - Internal/developer-focused changes
