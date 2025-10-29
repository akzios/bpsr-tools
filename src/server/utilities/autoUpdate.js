1; /**
 * Auto-Update Utility
 * Handles automatic updates from Google Drive using electron-updater
 */

const { autoUpdater } = require("electron-updater");
const { app, dialog } = require("electron");
const logger = require("./logger");

class AutoUpdateManager {
  constructor() {
    this.updateCheckInterval = null;
    this.isUpdateAvailable = false;
    this.updateInfo = null;

    // Configure auto-updater
    this.configureAutoUpdater();
  }

  configureAutoUpdater() {
    // Disable auto-download - we want to ask user first
    autoUpdater.autoDownload = false;

    // Auto-install when app is quit
    autoUpdater.autoInstallOnAppQuit = true;

    // Set update feed URL (will be configured via electron-builder)
    // For Google Drive, we'll use a generic provider

    // Event: Checking for updates
    autoUpdater.on("checking-for-update", () => {
      logger.info("Checking for updates...");
    });

    // Event: Update available
    autoUpdater.on("update-available", (info) => {
      this.isUpdateAvailable = true;
      this.updateInfo = info;
      logger.info(`Update available: ${info.version}`);
      this.notifyUpdateAvailable(info);
    });

    // Event: Update not available
    autoUpdater.on("update-not-available", (info) => {
      this.isUpdateAvailable = false;
      logger.info("No updates available");
    });

    // Event: Download progress
    autoUpdater.on("download-progress", (progressObj) => {
      const percent = Math.round(progressObj.percent);
      logger.info(
        `Download progress: ${percent}% (${progressObj.transferred}/${progressObj.total})`,
      );

      // Send progress to renderer if needed
      if (this.progressCallback) {
        this.progressCallback(percent, progressObj);
      }
    });

    // Event: Update downloaded
    autoUpdater.on("update-downloaded", (info) => {
      logger.info("Update downloaded successfully");
      this.notifyUpdateDownloaded(info);
    });

    // Event: Error occurred
    autoUpdater.on("error", (error) => {
      logger.error("Auto-update error:", error);
      this.isUpdateAvailable = false;

      // Only show error dialog in development or if user manually checked
      if (this.showErrors) {
        dialog.showErrorBox(
          "Update Error",
          `Failed to check for updates: ${error.message}`,
        );
      }
    });
  }

  /**
   * Check for updates manually
   * @param {boolean} showErrors - Whether to show error dialogs
   * @returns {Promise}
   */
  async checkForUpdates(showErrors = false) {
    this.showErrors = showErrors;

    if (app.isPackaged) {
      try {
        const result = await autoUpdater.checkForUpdates();
        return result;
      } catch (error) {
        logger.error("Failed to check for updates:", error);
        if (showErrors) {
          dialog.showMessageBox({
            type: "info",
            title: "Update Check Failed",
            message: "Unable to check for updates",
            detail: error.message,
            buttons: ["OK"],
          });
        }
        return null;
      }
    } else {
      logger.info("Auto-update disabled in development mode");
      if (showErrors) {
        dialog.showMessageBox({
          type: "info",
          title: "Development Mode",
          message: "Auto-updates are disabled in development mode",
          buttons: ["OK"],
        });
      }
      return null;
    }
  }

  /**
   * Start automatic update checks (every 6 hours)
   */
  startPeriodicUpdateCheck() {
    if (!app.isPackaged) {
      logger.info("Periodic update checks disabled in development mode");
      return;
    }

    // Check on startup (after 10 seconds)
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 10000);

    // Check every 6 hours
    this.updateCheckInterval = setInterval(
      () => {
        this.checkForUpdates(false);
      },
      6 * 60 * 60 * 1000,
    );

    logger.info("Periodic update checks enabled (every 6 hours)");
  }

  /**
   * Stop automatic update checks
   */
  stopPeriodicUpdateCheck() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      logger.info("Periodic update checks stopped");
    }
  }

  /**
   * Download the available update
   * @param {function} progressCallback - Callback for download progress
   */
  async downloadUpdate(progressCallback) {
    this.progressCallback = progressCallback;

    try {
      await autoUpdater.downloadUpdate();
      logger.info("Update download started");
    } catch (error) {
      logger.error("Failed to download update:", error);
      dialog.showErrorBox(
        "Download Error",
        `Failed to download update: ${error.message}`,
      );
    }
  }

  /**
   * Quit and install the downloaded update
   */
  quitAndInstall() {
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Notify user that an update is available
   * @param {object} info - Update information
   */
  notifyUpdateAvailable(info) {
    const version = info.version;
    const releaseNotes = info.releaseNotes || "No release notes available";

    dialog
      .showMessageBox({
        type: "info",
        title: "Update Available",
        message: `BPSR Tools ${version} is available!`,
        detail: `Current version: ${app.getVersion()}\nNew version: ${version}\n\n${releaseNotes}`,
        buttons: ["Download Now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          // User clicked "Download Now"
          this.downloadUpdate((percent, progressObj) => {
            logger.info(`Downloading update: ${percent}%`);
          });
        }
      });
  }

  /**
   * Notify user that update has been downloaded
   * @param {object} info - Update information
   */
  notifyUpdateDownloaded(info) {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message: "Update downloaded successfully",
        detail: `BPSR Tools ${info.version} has been downloaded and is ready to install.\n\nThe update will be installed when you quit the application.`,
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          // User clicked "Restart Now"
          this.quitAndInstall();
        }
      });
  }

  /**
   * Get current update status
   */
  getUpdateStatus() {
    return {
      isUpdateAvailable: this.isUpdateAvailable,
      updateInfo: this.updateInfo,
      currentVersion: app.getVersion(),
    };
  }
}

// Create singleton instance
const autoUpdateManager = new AutoUpdateManager();

module.exports = autoUpdateManager;
