const fs = require("fs");
const configPaths = require("./configPaths");

/**
 * Default settings for the application
 */
const DEFAULT_SETTINGS = {
  autoUpdateEnabled: true,
  autoClearOnServerChange: false,
  autoClearOnTimeout: true,
  onlyRecordEliteDummy: false,
  enableFightLog: false,
  enableDpsLog: false,
  enableHistorySave: false,
  isPaused: false,
  playerDataSyncProgress: null,
};

/**
 * Load settings from config file
 * @returns {Object} Settings object
 */
function loadSettings() {
  try {
    const settingsPath = configPaths.getConfigPath("settings.json");
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
 * @param {Object} settings - Settings object to save
 * @returns {boolean} Success status
 */
function saveSettings(settings) {
  try {
    const settingsPath = configPaths.getConfigPath("settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
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
