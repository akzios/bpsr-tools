const { app, BrowserWindow, ipcMain, Menu, Tray, globalShortcut } = require("electron");
const path = require("path");
const { fork } = require("child_process");
const autoUpdateManager = require("./src/server/utilities/autoUpdate");
const configPaths = require("./src/server/utilities/configPaths");
const {
  loadSettings,
  saveSettings,
} = require("./src/server/utilities/settings");

let mainWindow;
let tray = null;
let isQuitting = false;
let backendServerProcess = null;
const BACKEND_PORT = 8989;
let backendServerReady = false;

const isPackaged = app.isPackaged;

function createTray() {
  if (tray) return;

  tray = new Tray(path.join(__dirname, "icon.ico"));
  tray.setToolTip("BPSR Tools");

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });

  updateTrayMenu();
}

function updateTrayMenu() {
  const menuTemplate = [
    {
      label: "Show / Hide",
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ];

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
}

async function waitForBackendServer(maxWaitMs = 10000) {
  const startTime = Date.now();
  const checkInterval = 200;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const http = require("http");
      const options = {
        hostname: "localhost",
        port: BACKEND_PORT,
        path: "/-/health",
        method: "GET",
        timeout: 1000,
      };

      await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          if (res.statusCode === 200) {
            backendServerReady = true;
            console.log("[Main] Backend server is ready");
            resolve(true);
          } else {
            reject(new Error(`Server responded with status ${res.statusCode}`));
          }
        });

        req.on("error", (err) => {
          reject(err);
        });

        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Request timeout"));
        });

        req.end();
      });

      return true;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }
  }

  console.error("[Main] Backend server failed to start within timeout");
  return false;
}

function startBackendServer() {
  console.log("[Main] Starting backend server...");

  const serverPath = path.join(__dirname, "server.js");

  // Pass dev mode to forked server process
  const isDev = !app.isPackaged;
  console.log(`[Main] Forking backend server in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

  backendServerProcess = fork(serverPath, [], {
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: isDev ? "development" : "production",
    },
  });

  backendServerProcess.on("error", (error) => {
    console.error("[Main] Backend server error:", error);
  });

  backendServerProcess.on("exit", (code, signal) => {
    console.log(`[Main] Backend server exited with code ${code}, signal ${signal}`);
    backendServerReady = false;
  });
}

function createMainWindow() {
  const settings = loadSettings();
  const bounds = settings.guiWindowBounds || { x: 100, y: 100, width: 763, height: 486 };

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 350,
    minHeight: 200,
    frame: false,
    show: false,
    backgroundColor: "#0f1419",
    webPreferences: {
      preload: path.join(__dirname, "src", "app", "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, "icon.ico"),
  });

  Menu.setApplicationMenu(null);

  const url = `http://localhost:${BACKEND_PORT}/app.html`;
  console.log(`[Main] Loading main window from: ${url}`);
  mainWindow.loadURL(url);

  if (!isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    // Apply clickthrough setting if enabled
    if (settings.clickthrough) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
    // Apply always-on-top setting if enabled
    if (settings.alwaysOnTop) {
      mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
      console.log('[Main] Always on top restored from settings');
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
      saveWindowBounds();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("resize", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowBounds();
    }
  });

  mainWindow.on("move", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowBounds();
    }
  });
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const bounds = mainWindow.getBounds();
  const settings = loadSettings();
  settings.guiWindowBounds = bounds;
  saveSettings(settings);
}

ipcMain.on("get-version", (event) => {
  event.returnValue = app.getVersion();
});

ipcMain.on("check-for-updates", async (event) => {
  try {
    const result = await autoUpdateManager.checkForUpdates();
    event.reply("update-check-result", result);
  } catch (error) {
    event.reply("update-check-result", {
      success: false,
      error: error.message,
    });
  }
});

ipcMain.handle("set-always-on-top", async (event, enabled) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow) {
      senderWindow.setAlwaysOnTop(enabled, enabled ? "screen-saver" : "normal", 1);

      // Save to settings for persistence
      const settings = loadSettings();
      settings.alwaysOnTop = enabled;
      saveSettings(settings);
      console.log('[Main] Always on top saved to settings:', enabled);

      return { success: true };
    }
    return { success: false };
  } catch (error) {
    console.error('[Main] Error setting always on top:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-always-on-top", async (event) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow) {
      // Return actual window state (always authoritative)
      const actualState = senderWindow.isAlwaysOnTop();
      return { success: true, enabled: actualState };
    }
    return { success: false };
  } catch (error) {
    console.error('[Main] Error getting always on top:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("set-window-opacity", async (event, opacity) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow) {
      senderWindow.setOpacity(opacity);
      return { success: true };
    }
    return { success: false };
  } catch (error) {
    console.error('[Main] Error setting window opacity:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-window-opacity", async (event) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow) {
      return { success: true, opacity: senderWindow.getOpacity() };
    }
    return { success: false };
  } catch (error) {
    console.error('[Main] Error getting window opacity:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("set-clickthrough", async (event, enabled) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow) {
      senderWindow.setIgnoreMouseEvents(enabled, { forward: true });
      return { success: true };
    }
    return { success: false };
  } catch (error) {
    console.error('[Main] Error setting clickthrough:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-clickthrough", async (event) => {
  try {
    // Reload settings to get current state
    const currentSettings = loadSettings();
    return { success: true, enabled: currentSettings.clickthrough || false };
  } catch (error) {
    console.error('[Main] Error getting clickthrough:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on("close-window", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Handle opening skill analysis window
ipcMain.on("open-skill-analysis-window", (event, uid) => {
  console.log(`[Main] Received open-skill-analysis-window for UID: ${uid}`);

  const skillWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    transparent: false,
    frame: false,
    titleBarStyle: 'hidden',
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "src", "app", "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "icon.ico"),
    backgroundColor: "#1a1a2e",
  });

  skillWindow.setAlwaysOnTop(true, "floating", 1);

  const url = `http://localhost:8989/skill-analysis.html?uid=${uid}`;
  console.log(`[Main] Loading skill analysis URL: ${url}`);
  skillWindow.loadURL(url);
  skillWindow.show();

  skillWindow.on("closed", () => {
    console.log("[Main] Skill analysis window closed");
  });
});

ipcMain.handle("get-settings", async () => {
  try {
    const settings = loadSettings();
    return { success: true, data: settings };
  } catch (error) {
    console.error("[Main] Error loading settings:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("save-settings", async (event, settings) => {
  try {
    saveSettings(settings);
    return { success: true };
  } catch (error) {
    console.error("[Main] Error saving settings:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("save-file-to-desktop", async (event, filename, dataUrl) => {
  try {
    const { app } = require("electron");
    const fs = require("fs");
    const desktopPath = app.getPath("desktop");
    const filePath = path.join(desktopPath, filename);

    // Convert data URL to buffer
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Write file to desktop
    fs.writeFileSync(filePath, buffer);

    console.log(`[Main] File saved to desktop: ${filePath}`);
    return { success: true, path: filePath };
  } catch (error) {
    console.error("[Main] Error saving file to desktop:", error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  configPaths.initializeUserConfigs();

  startBackendServer();

  console.log("[Main] Waiting for backend server to be ready...");
  const serverReady = await waitForBackendServer();
  if (!serverReady) {
    console.error("[Main] Failed to start: backend server not ready");
    app.quit();
    return;
  }
  console.log("[Main] Backend server ready, creating main window");

  createMainWindow();
  createTray();

  // Register global shortcut for clickthrough toggle
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+K', () => {
    console.log('[Main] Global shortcut Ctrl+Shift+K triggered');
    if (mainWindow && !mainWindow.isDestroyed()) {
      const settings = loadSettings();
      const newClickthrough = !settings.clickthrough;

      console.log('[Main] Toggling clickthrough:', settings.clickthrough, '->', newClickthrough);

      // Update window state
      mainWindow.setIgnoreMouseEvents(newClickthrough, { forward: true });

      // Save to settings
      settings.clickthrough = newClickthrough;
      saveSettings(settings);

      // Notify renderer
      mainWindow.webContents.send('clickthrough-changed', newClickthrough);

      console.log('[Main] Clickthrough toggled successfully to:', newClickthrough);
    }
  });

  if (shortcutRegistered) {
    console.log('[Main] Global shortcut Ctrl+Shift+K registered successfully');
  } else {
    console.error('[Main] Failed to register global shortcut Ctrl+Shift+K');
  }

  try {
    const settings = loadSettings();
    if (settings.autoUpdateEnabled !== false) {
      autoUpdateManager.startPeriodicUpdateCheck();
    }
  } catch (error) {
    console.error("[Main] Error loading settings for auto-update:", error);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (!tray) {
      app.quit();
    }
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  } else {
    mainWindow.show();
  }
});

app.on("before-quit", () => {
  isQuitting = true;

  // Unregister global shortcuts
  globalShortcut.unregisterAll();
  console.log('[Main] Global shortcuts unregistered');

  if (backendServerProcess) {
    console.log("[Main] Stopping backend server...");
    backendServerProcess.kill();
  }
});
