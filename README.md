# BPSR Tools

A real-time DPS (Damage Per Second) meter for Blue Protocol that captures and decodes network packets to display detailed combat statistics.

**Forked from:** [mrsnakke/BPSR-Meter](https://github.com/mrsnakke/BPSR-Meter)

![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)
![License](https://img.shields.io/badge/license-AGPL--3.0-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)

## Features

- **Real-time Combat Tracking**: Monitor DPS, HPS, damage taken, critical hits, and more
- **Multiple Modes**: Choose between CLI, Web Server, or Electron Overlay (all can run simultaneously)
- **Network Packet Capture**: Non-invasive monitoring without game file modification
- **Advanced Statistics**: Skill breakdown, element damage, sub-profession detection
- **Profession System**: Bilingual profession support (Chinese/English) with role-based coloring
- **Pre-seeded Database**: Packaged with monster names, skill names, and profession data
- **Google Sheets Integration**: Sync combat data to Google Sheets for analysis
- **Auto-Update System**: Automatic updates via GitHub Releases
- **Multi-Device Support**: Web mode accessible from iPad, phone, or other devices
- **Shared Backend**: Single server instance (port 8989) serves all modes efficiently

## Installation

### Requirements

- **Windows** (x64)
- **Node.js** ^22.15.0 (for development - use [Volta](https://volta.sh/) for version management)
- **Npcap** (network packet capture driver)
- **Administrator Privileges** (required for packet capture)

### Download

1. Go to [Releases](https://github.com/akzios/bpsr-tools/releases)
2. Download the latest `BPSR Tools Setup X.X.X.exe`
3. Run the installer
4. The app will install to `%LOCALAPPDATA%\bpsr-tools`

### Npcap Installation

If Npcap is not installed, the app will prompt you to install it:

1. Download from [npcap.com](https://npcap.com/)
2. Install with "WinPcap API-compatible Mode" enabled
3. Restart the app

## Usage

### For End Users (Installed App)

1. Run **BPSR Tools** from your desktop or start menu
2. You'll see a beautiful launcher with three mode buttons:
   - **CLI Mode** - Terminal-based table display
   - **Web Server** - Network-accessible interface (iPad, phone, etc.)
   - **Electron Overlay** - Transparent in-game overlay
3. Click your preferred mode button(s) - **all modes can run simultaneously!**
4. Access Settings via the settings icon for configuration

**Multi-Mode Support:** You can run CLI, Web Server, and Electron Overlay at the same time. All modes share the same backend server (port 8989) and display identical combat data in real-time.

### 1. CLI Mode

Terminal-based interface with real-time statistics table:

**Features:**

- Color-coded player stats by class/role
- Real-time DPS/HPS tracking
- English class name translations
- Google Sheets sync (manual or auto)

**Controls:**

- `S` - Sync to Google Sheets (manual)
- `C` - Clear combat data
- `Ctrl+C` - Exit

**Auto-sync**: Enable the checkbox in the launcher for automatic sync every 60 seconds.

### 2. Web Server Mode

Network-accessible web interface:

**Access from:**

- **This PC**: `http://localhost:8989`
- **Other Devices**: `http://YOUR_IP:8989` (IP shown on startup)

Perfect for viewing on iPad, phone, or other devices on your network.

### 3. Electron Overlay

Always-on-top transparent overlay for in-game monitoring:

**Features:**

- Transparent window overlays the game
- Resizable and movable
- Always on top
- Multiple view modes (Advanced/Lite, DPS/Healer)
- Zoom in/out support

**Controls:**

- 🧹 Clear - Reset combat data
- 🔄 Advanced/Lite - Toggle view mode
- ❤️ DPS/Healer - Switch metrics (Lite mode)
- ➕➖ Zoom - Adjust UI scale
- 🔵 Drag - Move overlay
- 🔴 Close - Exit application

## Configuration

### Settings

Configure the app through the launcher's Settings page:

**App Updates:**

- Enable/disable automatic updates
- Check for updates manually

**DPS Meter:**

- Auto-clear on server change
- Auto-clear on timeout (80s inactivity)
- Record elite dummy only
- Enable fight logging
- Enable DPS logging
- Enable history save

**Google Sheets:**

- Configure spreadsheet ID
- Set sheet name
- Add service account credentials (JSON)

**Database Management:**

- **Seed Database**: Initialize database with monster/skill names from seed files
- **Update Database**: Manually fetch and merge latest player data from online leaderboard
  - Fetches fresh player data from external API
  - Merges professions, monsters, skills, and players into database
  - Uses INSERT OR IGNORE strategy (preserves existing data, removes duplicates)
  - Preserves your combat history while adding new entries
  - Shows statistics: how many new entries were added to each table

### Configuration Files

**In Development:**
All configs stored in `config/`:

- `settings.json` - App settings
- `sheets.json` - Google Sheets credentials (user-specific, not packaged)
- `dictionary.json` - Translation dictionary

**In Packaged App:**
Configs stored in `%APPDATA%/BPSR Tools/config/`:

- Default configs copied from app bundle on first run
- User modifications persist across updates
- `sheets.json` must be configured manually (not included in installer)

### Database

**SQLite Database:** `db/bpsr-tools.db`

**Pre-seeded Data (included in packaged app):**

- ✅ **Professions** (8 main classes): Stormblade, Frost Mage, Wind Knight, Marksman, Heavy Guardian, Shield Knight, Verdant Oracle, Soul Musician
- ✅ **Monsters**: Common monster names (Chinese with English translations)
- ✅ **Skills** (447+ skills): Skill IDs mapped to Chinese and English names

**Schema:**

- `professions` - Class data with Chinese/English names, icons, roles (dps/tank/healer)
- `players` - Player data cache (INTEGER PRIMARY KEY, name, profession, gear score, max HP)
- `monsters` - Monster name translations
- `skills` - Skill name translations

**Automatic Handling:**

- In development: Database created in project's `db/` directory
- In packaged app:
  - **First run**: Pre-seeded database copied to `%APPDATA%/BPSR Tools/db/`
  - **Subsequent runs**: Seed data merged from installation to user database
  - **Updates**: New professions/monsters/skills automatically added
  - **User data**: Player history preserved across updates
- Dynamically updated as new players/monsters/skills are encountered

**Update Strategy:**

- Installation database in `%LOCALAPPDATA%/Programs/bpsr-tools/resources/db/` (template)
- Working database in `%APPDATA%/BPSR Tools/db/` (user data)
- **Automatic updates** (on app start): Merges new seed data using INSERT OR IGNORE
  - Only merges: professions, monsters, skills (not player data)
  - Console logs show what was added (e.g., "Added 2 new professions")
- **Manual updates** (via launcher settings): Update Database button
  - Fetches latest player data from online leaderboard
  - Merges all seed data (professions, monsters, skills, players)
  - Provides statistics on how many new entries were added
  - Accessible via Settings > Database Management > Update Database

## Development

### Setup

**Recommended: Use Volta for Node.js version management**

```bash
# Install Volta (if not already installed)
# Visit https://volta.sh/ and follow installation instructions

# Volta will automatically use Node.js 22.15.0 when you enter this directory
# (configured in package.json)

# Install dependencies
npm install
```

### Running Development

```bash
# Start launcher GUI (default) - select mode via interface
npm start

# Or directly launch specific modes (advanced):

# CLI mode - terminal-based display
node src/app/cli.js

# CLI mode with auto-sync to Google Sheets (every 60s)
node src/app/cli.js --sync

# Web server mode (accessible from network)
node server.js

# Electron overlay mode (bypassing launcher)
electron src/app/electronGUI.js

# Server only (for testing backend)
node server.js [port] [deviceNum]
```

### Building

```bash
# Format code
npm run lint:prettier

# Build standalone executable (pkg)
npm run build

# Build Electron installer
npm run dist

# Build and publish to GitHub
npm run publish
```

### Project Structure

```
BPSR-Tools/
├── src/
│   ├── algo/                  # Packet decoding, protobuf
│   ├── app/                   # Electron apps
│   │   ├── electronCLI.js     # CLI mode Electron app
│   │   ├── electronGUI.js     # Overlay mode Electron app
│   │   └── preload.js         # Electron preload script
│   ├── server/                # Backend server
│   │   ├── api.js             # Express API routes
│   │   ├── dataManager.js     # Combat data management
│   │   ├── googleSheets.js    # Google Sheets integration
│   │   ├── sniffer.js         # Network packet capture
│   │   ├── model/             # Database models
│   │   │   ├── player.js      # Player model
│   │   │   ├── monster.js     # Monster model
│   │   │   ├── skill.js       # Skill model
│   │   │   ├── profession.js  # Profession model
│   │   │   └── seed.js        # Database seeder
│   │   └── utilities/         # Utilities
│   │       ├── configPaths.js # Config/DB path management
│   │       ├── logger.js      # Winston logger
│   │       ├── settings.js    # Settings management
│   │       └── autoUpdate.js  # Auto-update system
├── public/                    # Frontend files
│   ├── css/
│   │   └── style.css          # Centralized styles
│   ├── js/
│   │   ├── launcher.js        # Launcher client
│   │   ├── cliClient.js       # CLI display client
│   │   └── guiClient.js       # Overlay/web client
│   ├── launcher-view.html     # Launcher UI
│   ├── cli-view.html          # CLI terminal UI
│   └── gui-view.html          # Overlay/web UI
├── config/                    # Configuration files
│   ├── settings.json          # App settings
│   └── dictionary.json        # Translation dictionary
├── db/                        # Database directory
│   ├── bpsr-tools.db          # Pre-seeded SQLite database
│   └── seed/                  # Seed data (JSON)
│       ├── professions.json   # Class definitions
│       ├── monsters.json      # Monster names
│       ├── skills.json        # Skill names
│       └── players.json       # Player data (optional)
├── tables/                    # Game data tables
├── main.js                    # Launcher entry point
├── server.js                  # Shared backend server
└── electron-builder.yml       # Build configuration
```

## Architecture

### Multi-Mode Design

All three modes share a **single backend server** running on port 8989:

1. **Launcher** (`main.js`) - Beautiful GUI for mode selection and settings
2. **Shared Backend** (`server.js`) - Express HTTP + Socket.IO WebSocket server
   - Manages network packet capture (Npcap)
   - Processes combat data in real-time
   - Serves all modes simultaneously
3. **CLI Mode** (`electronCLI.js`) - Electron window with terminal-style HTML table
4. **Web Server Mode** - Browser-based interface (same as overlay but in browser)
5. **Electron Overlay** (`electronGUI.js`) - Transparent always-on-top overlay

### Data Flow

1. **Network Capture**: Uses Npcap to capture raw network packets
2. **TCP Reassembly**: Reconstructs TCP streams from fragmented packets
3. **Protocol Decoding**: Decodes Blue Protocol's custom protocol (Zstd + Protobuf)
4. **Data Extraction**: Parses game events (damage, healing, entity spawns)
5. **Profession Lookup**: Matches player professions (Chinese/English) to database
6. **Statistics**: Calculates real-time DPS/HPS metrics (updates every 100ms)
7. **API Layer**: Express routes + Socket.IO push updates
8. **Display**: All clients receive identical data via HTTP/WebSocket

### Profession System

**Bilingual Support:**

- All professions stored with Chinese (`name_cn`) and English (`name_en`) names
- API returns `professionDetails` object: `{id, name_cn, name_en, icon, role}`
- Frontend uses English names for display
- Backend accepts both Chinese and English for lookups

**Role-Based Features:**

- **Tank** (cyan): Heavy Guardian, Shield Knight
- **Healer** (green): Verdant Oracle, Soul Musician
- **DPS** (red): Stormblade, Frost Mage, Wind Knight, Marksman

**Smart Lookup:**

- `ProfessionModel.getByName()` tries both Chinese and English lookups
- Handles profession data from game packets (Chinese) and external APIs (English)
- Sub-profession detection from skill usage patterns

## API Endpoints

### Health Check

- `GET /-/health` - Server readiness check (returns `{ status: "ok" }`)

### Combat Data

- `GET /api/data` - Current combat data with `professionDetails` objects
- `GET /api/enemies` - Enemy data
- `GET /api/skill/:uid` - Player skill breakdown with profession info

### Settings & Configuration

- `GET /api/settings` - App settings
- `POST /api/settings` - Update settings
- `GET /api/professions` - Get profession translation map (Chinese → English)
- `GET /api/dictionary` - Translation dictionary

### Google Sheets

- `POST /api/sync-sheets` - Sync player data to Google Sheets
- `GET /api/sheets-configured` - Check if sheets.json exists

### Combat Controls

- `GET /api/clear` - Clear combat data
- `POST /api/pause` - Pause/resume tracking
- `POST /api/set-username` - Set player username

### History

- `GET /api/history/list` - List combat history
- `GET /api/history/:timestamp/summary` - Combat summary
- `GET /api/history/:timestamp/data` - Full combat data
- `GET /api/history/:timestamp/skill/:uid` - Player skill data
- `GET /api/history/:timestamp/download` - Download fight log

### WebSocket (Socket.IO)

- **Event**: `data` - Real-time combat updates (emitted every 100ms)
- Clients receive same data structure as `GET /api/data`

## Google Sheets Integration

### Setup

1. Create a Google Cloud project
2. Enable Google Sheets API
3. Create a service account
4. Download credentials JSON
5. Share your spreadsheet with the service account email
6. Configure in Settings > Google Sheets

### Usage

**CLI Mode:**

- Press `S` to sync manually
- Use `--sync` flag for auto-sync every 60s

**Web/Overlay:**

- Configure in settings
- Data syncs based on settings

## Auto-Update

The app automatically checks for updates:

- On startup (10 seconds after launch)
- Every 6 hours (if enabled)
- Manual check via Settings > Check for Updates

Updates are downloaded from GitHub Releases and installed on app restart.

## Troubleshooting

### No Data Showing

- **Check Npcap**: Ensure Npcap is installed
- **Administrator**: Run as administrator
- **Network Interface**: App auto-detects, but verify correct interface
- **Game Server**: Ensure you're connected to Blue Protocol

### Port Conflicts

App auto-finds available port starting from 8989. Check console output for actual port.

### Packet Decode Errors

Game protocol may change with updates. Check for app updates or report issues.

### Build Issues

- **Node.js Version**: Must be ^22.15.0 (requires zlib.zstdDecompressSync)
- **PowerShell**: Use PowerShell 7.5.3 for development
- **Native Modules**: Run `npm run postinstall` to rebuild

### Database Issues

**Empty Database in Packaged App:**

- Ensure `db/bpsr-tools.db` exists before building
- Database is copied to `extraResources` (outside asar)
- First run copies pre-seeded database to `%APPDATA%/BPSR Tools/db/`

**Missing Professions:**

- Database should be pre-seeded with 8 professions
- Manually seed: Use launcher Settings > Database Management > Seed Database
- Or run: `node -e "require('./src/server/model/seed.js').seedAll()"`

**Overlay Silently Dying:**

- Check logs: `%APPDATA%/BPSR Tools/debug.log` and `debug-cli.log`
- Ensure backend server is running on port 8989
- Overlay uses shared backend (doesn't start its own server)
- Check for uncaught exceptions in debug logs

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

**Code Style:**

- All code and comments in English
- Use Prettier for formatting: `npm run lint:prettier`
- Follow existing code conventions

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

See [LICENSE](LICENSE) for details.

## Acknowledgments

- Blue Protocol by Bandai Namco
- Npcap for packet capture
- Electron for desktop framework
- All contributors and users

## Support

- **Issues**: [GitHub Issues](https://github.com/akzios/bpsr-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/akzios/bpsr-tools/discussions)

## Disclaimer

This tool is for educational and personal use only. It does not modify game files or inject code. Use at your own risk. We are not affiliated with Bandai Namco or Blue Protocol.

---

**Made with ❤️ for the Arrogance Guild**
