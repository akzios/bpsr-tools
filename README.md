# BPSR Tools

A real-time DPS (Damage Per Second) meter for Blue Protocol that captures and decodes network packets to display detailed combat statistics.

**Forked from:** [mrsnakke/BPSR-Meter](https://github.com/mrsnakke/BPSR-Meter)

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-AGPL--3.0-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)

## Features

- **Real-time Combat Tracking**: Monitor DPS, HPS, damage taken, and more
- **Monster Type Filtering**: Filter data by Boss, Elite, Normal, or Support Doll
- **Pause/Resume Controls**: Pause tracking without clearing data
- **Multiple Modes**: CLI, Web Server, or Electron Overlay (all can run simultaneously)
- **Network Packet Capture**: Non-invasive monitoring without modifying game files
- **Skill Analysis**: Detailed breakdowns with charts and statistics
- **Google Sheets Integration**: Sync combat data for analysis
- **Auto-Update System**: Automatic updates via GitHub Releases
- **Multi-Device Support**: Access from iPad, phone, or other devices on your network

## How It Works

BPSR Tools captures and decodes network traffic between Blue Protocol and its servers:

```
Game Server → Network → Npcap Driver → Packet Capture → Protocol Decoder → DPS Meter
```

**Detailed Flow:**

1. **Game Server** sends binary data (Protobuf) over TCP port 9002
2. **Npcap** captures raw network packets at kernel level (no game modification)
3. **Sniffer** (`sniffer.js`) decodes network layers (Ethernet → IP → TCP) and reassembles TCP streams
4. **Packet Processor** (`packet.js`) extracts Blue Protocol protocol and decompresses (Zstd)
5. **Protobuf Decoder** (`blueprotobuf.js`) converts binary data to JavaScript objects
6. **Data Manager** (`dataManager.js`) calculates real-time DPS/HPS statistics
7. **API Server** serves data to all modes (CLI, Web, Overlay) via REST + WebSocket

**Non-invasive:** No game files modified, no code injection, no memory reading

## Installation

### Requirements

- **Windows** (x64)
- **Npcap** (network packet capture driver)
- **Administrator Privileges** (required for packet capture)

### Download

1. Go to [Releases](https://github.com/akzios/bpsr-tools/releases)
2. Download the latest `BPSR Tools Setup X.X.X.exe`
3. Run the installer
4. Install Npcap if prompted

## Usage

### Launcher

1. Run **BPSR Tools** from your desktop or start menu
2. Select your preferred mode:
   - **CLI Mode** - Terminal-based display
   - **Web Server** - Network-accessible interface
   - **Electron Overlay** - Transparent in-game overlay
3. All modes can run simultaneously
4. Access Settings for configuration

### CLI Mode

Terminal-style interface with real-time stats table.

**Controls:**

- `S` - Sync to Google Sheets
- `C` - Clear combat data
- `Ctrl+C` - Exit

### Web Server Mode

Access from any device on your network:

- **This PC**: `http://localhost:8989`
- **Other Devices**: `http://YOUR_IP:8989`

### Electron Overlay

Always-on-top transparent overlay for in-game monitoring with monster type filtering, pause/resume controls, and customizable view modes.

## Configuration

Configure the app through the launcher's Settings page:

- **App Updates**: Enable/disable automatic updates, check manually
- **DPS Meter**: Auto-clear settings, logging options
- **Google Sheets**: Configure spreadsheet sync

## Development

### Setup

```bash
# Install dependencies
npm install

# Seed the database (REQUIRED after first clone)
npm run preseed
```

**Important:** The database is NOT auto-seeded. You MUST run `npm run preseed` after cloning.

### Running

```bash
# Start launcher (recommended)
npm start

# Or run specific modes directly
node src/app/cli.js          # CLI mode
node server.js               # Web server
electron src/app/electronGUI.js  # Overlay
```

### Building

```bash
# Format code
npm run lint:prettier

# Seed database before building (REQUIRED)
npm run preseed

# Build Electron installer
npm run dist

# Build and publish to GitHub
npm run publish
```

## API Endpoints

### Core Endpoints

- `GET /-/health` - Server health check
- `GET /api/data` - Current combat data
- `GET /api/skill/:uid` - Player skill breakdown
- `GET /api/settings` - App settings
- `POST /api/settings` - Update settings

### Google Sheets

- `POST /api/sync-sheets` - Sync to Google Sheets
- `GET /api/sheets-configured` - Check configuration

### Combat Controls

- `GET /api/clear` - Clear combat data
- `GET /api/pause` - Get pause state
- `POST /api/pause` - Set pause state (body: `{paused: boolean}`)

## Troubleshooting

### No Data Showing

- Ensure Npcap is installed
- Run as administrator
- Verify connection to Blue Protocol

### Port Conflicts

App auto-finds available port starting from 8989.

### Build Issues

- Node.js version must be ^22.15.0
- Use PowerShell 7.5.3 for development
- Run `npm run postinstall` to rebuild native modules

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

**Code Style:**

- All code and comments in English
- Use Prettier: `npm run lint:prettier`
- Follow existing conventions

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

## Support

- **Issues**: [GitHub Issues](https://github.com/akzios/bpsr-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/akzios/bpsr-tools/discussions)

## Disclaimer

This tool is for educational and personal use only. It does not modify game files or inject code. Use at your own risk. We are not affiliated with Bandai Namco or Blue Protocol.

---

**Made with ❤️ for the Arrogance Guild**
