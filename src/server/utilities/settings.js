const fs = require("fs");
const configPaths = require("./configPaths");

/**
 * Default settings for the application
 */
const DEFAULT_SETTINGS = {
  autoUpdateEnabled: true,
  autoClearOnChannelChange: false,
  autoClearOnTimeout: true,
  enableFightLog: false,
  enableDpsLog: false,
  enableHistorySave: false,
  playerDataSyncProgress: null,
  guiWindowBounds: null, // { x, y, width, height }
};

/**
 * Load settings from config file
 * @returns {Object} Settings object
 */
function loadSettings() {
  try {
    let settingsPath;

    // Check if running in dev mode (not packaged)
    const isDev = process.defaultApp || process.env.NODE_ENV === "development";

    if (isDev) {
      // Dev mode: load from source config directory
      const path = require("path");
      settingsPath = path.join(process.cwd(), "config", "settings.json");
      console.log("[Settings] Dev mode: Loading from source file");
    } else {
      // Production: load from user data directory
      settingsPath = configPaths.getConfigPath("settings.json");
    }

    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf8");
      const loadedSettings = JSON.parse(data);
      console.log("[Settings] Loaded settings from:", settingsPath);
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_SETTINGS, ...loadedSettings };
    }
  } catch (error) {
    console.error("[Settings] Error loading settings:", error.message);
  }

  console.log("[Settings] Using default settings");
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to config file
 * In dev mode (not packaged), saves to source config/ directory
 * In production (packaged), saves to user data directory
 * @param {Object} settings - Settings object to save
 * @returns {boolean} Success status
 */
function saveSettings(settings) {
  try {
    // Filter out runtime-only properties that should never be persisted
    const { isPaused, ...settingsToSave } = settings;

    let settingsPath;

    // Check if running in dev mode (not packaged)
    const isDev = process.defaultApp || process.env.NODE_ENV === "development";

    if (isDev) {
      // Dev mode: save to source config directory
      const path = require("path");
      settingsPath = path.join(process.cwd(), "config", "settings.json");
      console.log("[Settings] Dev mode: Saving to source file");
    } else {
      // Production: save to user data directory
      settingsPath = configPaths.getConfigPath("settings.json");
    }

    fs.writeFileSync(
      settingsPath,
      JSON.stringify(settingsToSave, null, 2),
      "utf8",
    );
    console.log("[Settings] Saved settings to:", settingsPath);
    return true;
  } catch (error) {
    console.error("[Settings] Error saving settings:", error.message);
    return false;
  }
}

/**
 * Get the settings file path
 * @returns {string} Path to settings.json
 */
function getSettingsPath() {
  return configPaths.getConfigPath("settings.json");
}

module.exports = {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  getSettingsPath,
};
