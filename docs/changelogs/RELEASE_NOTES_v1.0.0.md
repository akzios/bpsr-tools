# BPSR Tools v1.0.0 - Initial Release

**Release Date:** October 24, 2025

We're excited to announce the first official release of **BPSR Tools** - a real-time DPS meter for Blue Protocol that provides detailed combat statistics through non-invasive network packet capture.

---

## 🎮 What is BPSR Tools?

BPSR Tools is a desktop application that monitors your Blue Protocol gameplay in real-time, providing detailed combat statistics including DPS, HPS, damage taken, critical hits, and more. It works by capturing and decoding network packets without modifying game files or injecting code.

---

## ✨ Key Features

### Three Modes to Choose From

**🖥️ CLI Mode**

- Terminal-based interface with real-time statistics table
- Color-coded player stats by class and role
- Google Sheets integration (manual and auto-sync)
- Lightweight and keyboard-friendly
- Perfect for streamers who want minimal overlay

**🌐 Web Server Mode**

- Network-accessible web interface
- Access from iPad, tablet, phone, or any device on your network
- Real-time WebSocket updates
- Modern, responsive design
- Ideal for multi-monitor setups

**🎯 Electron Overlay Mode**

- Transparent, always-on-top desktop overlay
- Multiple view modes (Advanced/Lite, DPS/Healer)
- Resizable and movable
- Zoom in/out support
- Traditional in-game overlay experience

### Combat Statistics

- **Real-time DPS/HPS Tracking**: Live damage and healing per second calculations
- **Skill Breakdown**: Detailed analysis of damage/healing by skill
- **Element Damage**: Track damage by element type
- **Critical Hit %**: Monitor critical hit rates
- **Luck %**: Track luck stat effectiveness
- **Gear Score Display**: View player equipment levels
- **Sub-Profession Detection**: Automatically detects player specializations

### Data Management

- **SQLite Database**: Player and monster data caching
- **Google Sheets Integration**: Sync combat data for analysis
- **Combat History**: Save and review past encounters (optional)
- **Auto-Clear Options**: Configure when to reset statistics
- **Fight Logs**: Export detailed combat logs (optional)

### User Experience

- **Beautiful Launcher**: Gradient UI for selecting your preferred mode
- **Settings Page**: Configure all app settings from one place
- **Auto-Update System**: Automatic updates via GitHub Releases
- **Multi-Language Support**: Chinese to English class name translations
- **Database Seeding**: Pre-populate monster and skill names

---

## 📦 What's Included

### Installation

- **One-Click Installer**: NSIS installer for Windows (x64)
- **Automatic Npcap Check**: Prompts to install required network driver
- **Desktop & Start Menu Shortcuts**: Easy access after installation
- **Auto-Update**: Checks for updates on startup and every 6 hours

### Configuration

- **Pre-configured Settings**: Sensible defaults for immediate use
- **Customizable Options**: Auto-clear, timeout, elite dummy tracking
- **Google Sheets Template**: Easy setup for data syncing
- **Database Management**: Seed and update player data with one click

### Documentation

- Comprehensive README with usage instructions
- Setup guides for GitHub Releases and auto-updates
- Configuration file examples

---

## 🚀 Getting Started

### Installation

1. Download `BPSR Tools Setup 1.0.0.exe` from the release assets below
2. Run the installer (installs to `%LOCALAPPDATA%\bpsr-tools`)
3. Launch from desktop shortcut or start menu
4. If prompted, install Npcap (required for packet capture)
5. Choose your preferred mode from the launcher

### First Run

1. **Run as Administrator** (required for network packet capture)
2. Select your mode:
   - **CLI Mode**: For terminal-based display
   - **Web Server**: For network-accessible interface
   - **Overlay**: For in-game transparent overlay
3. Start Blue Protocol and connect to a server
4. Combat statistics will appear automatically!

### Optional Setup

**Google Sheets Sync (CLI Mode):**

1. Click ⚙️ Settings in launcher
2. Expand "Google Sheets" section
3. Paste your service account credentials JSON
4. Save settings
5. In CLI mode, press `S` to sync or use `--sync` flag for auto-sync

**Database Seeding:**

1. Click ⚙️ Settings in launcher
2. Expand "Database Management"
3. Click "Seed Database" to populate monster/skill names
4. Optional: Click "Update Player Data" to fetch online leaderboard data

---

## 🛠️ Technical Details

### System Requirements

- **OS**: Windows 10/11 (x64)
- **Node.js**: 22.15.0 (embedded in installer, not required for end users)
- **Npcap**: Required for packet capture (installer will prompt)
- **Permissions**: Administrator privileges for packet capture

### Architecture

- **Electron**: Desktop application framework
- **Node.js**: Backend server with Express and Socket.IO
- **cap/Npcap**: Network packet capture
- **Protobuf + Zstd**: Game protocol decoding
- **SQLite**: Local database for caching
- **Google Sheets API**: Optional data sync

### Security

- **Non-invasive**: Does not modify game files or inject code
- **Local Processing**: All packet analysis happens on your machine
- **No Cloud**: No data sent to external servers (except Google Sheets if configured)
- **Open Source**: AGPL-3.0 license for full transparency

---

## 📊 Performance

- **Real-time Updates**: 100ms DPS calculation interval
- **Low Overhead**: Minimal CPU/memory usage in CLI mode
- **Efficient Packet Processing**: Handles fragmentation and out-of-order packets
- **Auto-Cleanup**: Removes stale data to prevent memory leaks

---

## 🔧 Developer Information

### Building from Source

```bash
# Install Volta for Node.js version management
# Visit https://volta.sh/

# Clone the repository
git clone https://github.com/akzios/bpsr-tools.git
cd bpsr-tools

# Install dependencies (Volta will auto-select Node.js 22.15.0)
npm install

# Run in development
npm start

# Build installer
npm run dist

# Build and publish to GitHub
npm run publish
```

### Contributing

We welcome contributions! Please:

- Fork the repository
- Create a feature branch
- Make your changes (all code in English)
- Use Prettier for formatting: `npm run lint:prettier`
- Submit a pull request

---

## 📝 Known Issues

- **Windows Firewall**: May prompt on first run (allow access for packet capture)
- **Multiple Network Interfaces**: Auto-selects first non-loopback interface
- **Protocol Updates**: Game updates may break packet decoding (we'll release fixes)
- **High DPS Numbers**: Some skills may report inflated damage (work in progress)

---

## 🙏 Acknowledgments

- **Blue Protocol** by Bandai Namco
- **Npcap** for packet capture library
- **Electron** for desktop framework
- **Community** for testing and feedback

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/akzios/bpsr-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/akzios/bpsr-tools/discussions)

---

## ⚠️ Disclaimer

This tool is for educational and personal use only. It does not modify game files or inject code. Use at your own risk. We are not affiliated with Bandai Namco or Blue Protocol.

---

## 📥 Download

Download the installer from the **Assets** section below:

- `BPSR Tools Setup 1.0.0.exe` - Windows installer (recommended)
- `latest.yml` - Auto-update configuration (included in installer)

---

**Thank you for using BPSR Tools!**

Made with ❤️ for the Blue Protocol community

---

### Full Changelog

This is the initial release. See future releases for changelog updates.

**v1.0.0 Initial Features:**

- ✅ CLI, Web Server, and Electron Overlay modes
- ✅ Real-time DPS/HPS tracking
- ✅ Skill breakdown and analysis
- ✅ Google Sheets integration
- ✅ SQLite database caching
- ✅ Auto-update system
- ✅ Beautiful launcher with settings page
- ✅ Database seeding and player data updates
- ✅ Chinese to English translations
- ✅ Combat history (optional)
- ✅ Multi-device support (web mode)
