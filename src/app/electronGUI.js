const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const configPaths = require(
  path.join(__dirname, "..", "server", "utilities", "configPaths"),
);
const { loadSettings, saveSettings } = require(
  path.join(__dirname, "..", "server", "utilities", "settings"),
);

// Function to log to file safely for packaged environment
function logToFile(msg) {
  try {
    const userData = app.getPath("userData");
    const logPath = path.join(userData, "debug.log");
    const timestamp = new Date().toISOString();
    fs.mkdirSync(userData, { recursive: true });
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
  } catch (e) {
    // If there's an error, show in console
    console.error("Error writing log:", e);
  }
}

let mainWindow;
logToFile("==== STARTING ELECTRON OVERLAY ====");

// Global error handlers for debugging
process.on("uncaughtException", (error) => {
  logToFile(`UNCAUGHT EXCEPTION: ${error.message}`);
  logToFile(`Stack: ${error.stack}`);
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  logToFile(`UNHANDLED REJECTION: ${reason}`);
  console.error("Unhandled Rejection:", reason);
});

// Register IPC handlers at module level (only once)
// This prevents duplicate event listeners when createWindow() is called multiple times

// Handle event to make window movable/non-movable
ipcMain.on("set-window-movable", (event, movable) => {
  if (mainWindow) {
    mainWindow.setMovable(movable);
  }
});

// Handle event to close window
ipcMain.on("close-window", (event) => {
  // Get the window that sent the event and close it
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
});

// Handle event to resize window
ipcMain.on("resize-window", (event, width, height) => {
  // Get the window that sent the event and resize it
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.setSize(width, height);
  }
});

// Handle event to open skill analysis window
ipcMain.on("open-skill-analysis-window", (event, uid) => {
  logToFile(`Opening skill analysis window for UID: ${uid}`);
  createSkillAnalysisWindow(uid);
});

// Handle event to toggle always on top
ipcMain.on("set-always-on-top", (event, alwaysOnTop) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    if (alwaysOnTop) {
      window.setAlwaysOnTop(true, "screen-saver");
    } else {
      window.setAlwaysOnTop(false);
    }
    logToFile(`Window always on top set to: ${alwaysOnTop}`);
  }
});

// Handle event to get always on top state
ipcMain.handle("get-always-on-top", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    return window.isAlwaysOnTop();
  }
  return true; // Default to true for overlay
});

// Handle event to set window bounds (position and size)
ipcMain.on("set-bounds", (event, bounds) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.setBounds(bounds);
  }
});

// Handle event to get window bounds
ipcMain.handle("get-bounds", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    return window.getBounds();
  }
  return null;
});

// Handle event to save file to desktop
ipcMain.handle("save-file-to-desktop", async (event, filename, dataUrl) => {
  try {
    const desktopPath = app.getPath("desktop");
    const filePath = path.join(desktopPath, filename);

    // Convert data URL to buffer
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Write file to desktop
    fs.writeFileSync(filePath, buffer);

    logToFile(`File saved to desktop: ${filePath}`);
    return { success: true, path: filePath };
  } catch (error) {
    logToFile(`Error saving file to desktop: ${error.message}`);
    return { success: false, error: error.message };
  }
});

async function createWindow() {
  try {
    logToFile("createWindow() called");

    // If window already exists and is not destroyed, focus it instead of creating new one
    if (mainWindow && !mainWindow.isDestroyed()) {
      logToFile("Window already exists, focusing existing window");
      mainWindow.focus();
      return mainWindow;
    }

    // Load saved window bounds from settings
    configPaths.initializeUserConfigs();
    const settings = loadSettings();
    const savedBounds = settings.guiWindowBounds;

    // Default window configuration
    const windowConfig = {
      width: savedBounds?.width || 724,
      height: savedBounds?.height || 800,
      minWidth: 350,
      minHeight: 200,
      x: savedBounds?.x,
      y: savedBounds?.y,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
      },
      icon: path.join(__dirname, "..", "..", "icon.ico"),
    };

    mainWindow = new BrowserWindow(windowConfig);
    logToFile(
      `Window created with bounds: ${JSON.stringify(mainWindow.getBounds())}`,
    );

    // Save bounds on resize or move
    let boundsTimeout;
    const saveBounds = () => {
      clearTimeout(boundsTimeout);
      boundsTimeout = setTimeout(() => {
        const bounds = mainWindow.getBounds();
        const currentSettings = loadSettings();
        currentSettings.guiWindowBounds = bounds;
        saveSettings(currentSettings);
        logToFile(`Window bounds saved: ${JSON.stringify(bounds)}`);
      }, 500); // Debounce 500ms
    };

    mainWindow.on("resize", saveBounds);
    mainWindow.on("move", saveBounds);

    // Set highest window level to stay on top of fullscreen apps (like games)
    // 'screen-saver' level ensures overlay stays visible even over fullscreen games
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    logToFile(
      "Window level set to 'screen-saver' for fullscreen compatibility",
    );

    // Determine if running in development mode
    const isDev = process.defaultApp || process.env.NODE_ENV === "development";

    // Open DevTools in development mode
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }

    const url = "http://localhost:8989/gui-view.html";
    logToFile(`Loading URL: ${url}`);
    console.log(`Loading overlay: ${url}`);
    mainWindow.loadURL(url);

    // Log any load failures
    mainWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        logToFile(
          `Overlay window failed to load: ${errorCode} - ${errorDescription}`,
        );
        console.error(
          `Overlay load failed: ${errorCode} - ${errorDescription}`,
        );
      },
    );

    mainWindow.on("closed", () => {
      logToFile("Overlay window closed");
      mainWindow = null;
    });

    logToFile("Window created successfully");
  } catch (error) {
    logToFile(`ERROR in createWindow: ${error.message}`);
    logToFile(`Stack: ${error.stack}`);
    console.error("Error in createWindow:", error);
    throw error;
  }
}

// Function to create skill analysis window
function createSkillAnalysisWindow(uid) {
  try {
    logToFile(`Creating skill analysis window for UID: ${uid}`);

    const skillWindow = new BrowserWindow({
      width: 1400,
      height: 1000,
      minWidth: 1200,
      minHeight: 800,
      transparent: false,
      frame: false,
      alwaysOnTop: true,
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
      },
      icon: path.join(__dirname, "..", "..", "icon.ico"),
      title: "Skill Analysis",
      backgroundColor: "#1a1a2e",
    });

    // Set window level higher than main overlay to ensure it stays on top
    skillWindow.setAlwaysOnTop(true, "floating", 1);

    // Determine if running in development mode
    const isDev = process.defaultApp || process.env.NODE_ENV === "development";

    // Open DevTools in development mode
    if (isDev) {
      skillWindow.webContents.openDevTools();
    }

    const url = `http://localhost:8989/gui-skills-view.html?uid=${uid}`;
    logToFile(`Loading skill analysis URL: ${url}`);
    skillWindow.loadURL(url);

    // Log any load failures
    skillWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        logToFile(
          `Skill analysis window failed to load: ${errorCode} - ${errorDescription}`,
        );
        console.error(
          `Skill analysis window load failed: ${errorCode} - ${errorDescription}`,
        );
      },
    );

    skillWindow.on("closed", () => {
      logToFile("Skill analysis window closed");
    });

    logToFile("Skill analysis window created successfully");
    return skillWindow;
  } catch (error) {
    logToFile(`ERROR in createSkillAnalysisWindow: ${error.message}`);
    logToFile(`Stack: ${error.stack}`);
    console.error("Error in createSkillAnalysisWindow:", error);
    throw error;
  }
}

// Only auto-start if this is the main entry point
if (require.main === module) {
  logToFile("Running as main module (standalone mode)");
  app.whenReady().then(() => {
    createWindow().catch((err) => {
      logToFile(`ERROR starting standalone: ${err.message}`);
      console.error("Failed to create window:", err);
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch((err) => {
          logToFile(`ERROR on activate: ${err.message}`);
          console.error("Failed to create window on activate:", err);
        });
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
} else {
  // Being required by launcher - create window when app is ready
  logToFile("Running as module (launcher mode)");

  if (app.isReady()) {
    logToFile("App is already ready, creating window immediately");
    createWindow().catch((err) => {
      logToFile(`ERROR creating window from launcher: ${err.message}`);
      logToFile(`Stack: ${err.stack}`);
      console.error("Failed to create window from launcher:", err);
    });
  } else {
    logToFile("App not ready yet, waiting...");
    app.whenReady().then(() => {
      logToFile("App now ready, creating window");
      createWindow().catch((err) => {
        logToFile(`ERROR creating window after ready: ${err.message}`);
        logToFile(`Stack: ${err.stack}`);
        console.error("Failed to create window after ready:", err);
      });
    });
  }

  app.on("window-all-closed", () => {
    // Don't quit - let launcher stay open for mode switching
    logToFile("All overlay windows closed (launcher mode active)");
  });
}

// Export getters and functions for mode tracking
module.exports = {
  getMainWindow: () => mainWindow,
  createWindow: createWindow,
};
