const { app, BrowserWindow, ipcMain, Menu, dialog, Tray } = require("electron");
const path = require("path");
const { spawn, fork } = require("child_process");
const fs = require("fs");
const autoUpdateManager = require("./src/server/utilities/autoUpdate");
const configPaths = require("./src/server/utilities/configPaths");
const {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} = require("./src/server/utilities/settings");

let launcherWindow;
let tray = null;
let isQuitting = false;
let backendServerProcess = null; // Shared backend server for all modes
const BACKEND_PORT = 8989; // Fixed port for backend API server
let isLaunchingMode = false; // Prevent rapid mode launches
let backendServerReady = false; // Track backend server readiness

// Check if we're in a packaged app
const isPackaged = app.isPackaged;

// Track active modes and their resources
const activeModes = {
  electron: { window: null, isOpen: false },
  cli: { window: null, isOpen: false },
  minimap: { window: null, isOpen: false },
};

// Close a specific mode
function closeMode(mode) {
  console.log(`Closing ${mode} mode`);

  if (mode === "electron") {
    try {
      const electronMain =
        require.cache[require.resolve("./src/app/electronGUI.js")];
      if (electronMain && electronMain.exports) {
        const overlayWindow = electronMain.exports.getMainWindow();
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.close();
        }
      }
      // Don't delete require cache - IPC handlers should persist
    } catch (e) {
      console.log("Error closing electron mode:", e.message);
    }
    activeModes.electron.isOpen = false;
    activeModes.electron.window = null;
  } else if (mode === "cli") {
    try {
      if (activeModes.cli.window && !activeModes.cli.window.isDestroyed()) {
        activeModes.cli.window.close();
      }
      const { stopCLI } = require("./src/app/electronCLI.js");
      stopCLI();
    } catch (e) {
      console.log("Error closing CLI mode:", e.message);
    }
    activeModes.cli.isOpen = false;
    activeModes.cli.window = null;
  } else if (mode === "minimap") {
    try {
      if (
        activeModes.minimap.window &&
        !activeModes.minimap.window.isDestroyed()
      ) {
        activeModes.minimap.window.close();
      }
      delete require.cache[require.resolve("./src/app/electronMinimap.js")];
    } catch (e) {
      console.log("Error closing minimap mode:", e.message);
    }
    activeModes.minimap.isOpen = false;
    activeModes.minimap.window = null;
  }

  updateTrayMenu();
}

function createTray() {
  // Create tray only once
  if (tray) return;

  tray = new Tray(path.join(__dirname, "icon.ico"));
  tray.setToolTip("BPSR Tools");

  // Add click handler - show launcher
  tray.on("click", () => {
    if (launcherWindow) {
      launcherWindow.show();
    }
  });

  updateTrayMenu();
}

// Check if backend server is ready
async function waitForBackendServer(maxWaitMs = 10000) {
  const startTime = Date.now();
  const checkInterval = 200; // Check every 200ms

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

      return true; // Server is ready
    } catch (error) {
      // Server not ready yet, wait and retry
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }
  }

  console.error("[Main] Backend server failed to start within timeout");
  return false; // Server failed to start
}

// Helper to launch a mode (extracted from IPC handler)
async function launchMode(mode) {
  // Prevent rapid mode launches
  if (isLaunchingMode) {
    console.log(`[Main] Mode launch in progress, please wait...`);
    return;
  }

  // Check if window is already open
  if (mode === "electron" && activeModes.electron.isOpen) {
    if (
      activeModes.electron.window &&
      !activeModes.electron.window.isDestroyed()
    ) {
      activeModes.electron.window.focus();
      console.log(`[Main] ${mode} window already open, focusing`);
    }
    return;
  } else if (mode === "cli" && activeModes.cli.isOpen) {
    if (activeModes.cli.window && !activeModes.cli.window.isDestroyed()) {
      activeModes.cli.window.focus();
      console.log(`[Main] ${mode} window already open, focusing`);
    }
    return;
  } else if (mode === "minimap" && activeModes.minimap.isOpen) {
    if (
      activeModes.minimap.window &&
      !activeModes.minimap.window.isDestroyed()
    ) {
      activeModes.minimap.window.focus();
      console.log(`[Main] ${mode} window already open, focusing`);
    }
    return;
  }

  // Set launching flag
  isLaunchingMode = true;
  console.log(`[Main] Launching ${mode} mode...`);

  // Wait for backend server to be ready
  if (!backendServerReady) {
    console.log("[Main] Waiting for backend server to be ready...");
    const serverReady = await waitForBackendServer();
    if (!serverReady) {
      console.error("[Main] Failed to launch mode: backend server not ready");
      isLaunchingMode = false;
      dialog.showErrorBox(
        "Server Not Ready",
        "The backend server failed to start. Please try again or restart the application.",
      );
      return;
    }
  }

  // Create tray if not exists
  createTray();

  if (mode === "electron") {
    // Load electron-gui module
    const electronMain = require("./src/app/electronGUI.js");

    // Create or focus the window
    electronMain
      .createWindow()
      .then(() => {
        // Track the window (small delay for window creation)
        setTimeout(() => {
          activeModes.electron.window = electronMain.getMainWindow();
          activeModes.electron.isOpen = true;
          updateTrayMenu();

          // Listen for window close to update tray (only if not already listening)
          if (
            activeModes.electron.window &&
            activeModes.electron.window.listenerCount("closed") === 0
          ) {
            activeModes.electron.window.on("closed", () => {
              activeModes.electron.isOpen = false;
              activeModes.electron.window = null;
              updateTrayMenu();
            });
          }
        }, 500);
      })
      .catch((err) => {
        console.error("Failed to create electron window:", err);
        isLaunchingMode = false;
      });

    // Release lock after delay
    setTimeout(() => {
      isLaunchingMode = false;
      console.log(`[Main] ${mode} mode launch complete`);
    }, 1500);
  } else if (mode === "cli") {
    // Launch CLI in Electron window (server is already ready)
    const { createCLIWindow } = require("./src/app/electronCLI.js");
    activeModes.cli.window = createCLIWindow();
    activeModes.cli.isOpen = true;
    updateTrayMenu();

    // Listen for window close to update tray
    activeModes.cli.window.on("closed", () => {
      activeModes.cli.isOpen = false;
      activeModes.cli.window = null;
      updateTrayMenu();
    });

    // Release lock after delay
    setTimeout(() => {
      isLaunchingMode = false;
      console.log(`[Main] ${mode} mode launch complete`);
    }, 1500);
  } else if (mode === "minimap") {
    // Load minimap electron window
    const { createMinimapWindow } = require("./src/app/electronMinimap.js");
    activeModes.minimap.window = createMinimapWindow(BACKEND_PORT);
    activeModes.minimap.isOpen = true;
    updateTrayMenu();

    // Listen for window close to update tray
    activeModes.minimap.window.on("closed", () => {
      activeModes.minimap.isOpen = false;
      activeModes.minimap.window = null;
      updateTrayMenu();
    });

    // Release lock after delay
    setTimeout(() => {
      isLaunchingMode = false;
      console.log(`[Main] ${mode} mode launch complete`);
    }, 1500);
  }
}

function updateTrayMenu() {
  if (!tray) return;

  // Build menu template dynamically based on active modes
  const menuTemplate = [
    {
      label: "Show Launcher",
      click: () => {
        if (launcherWindow) {
          launcherWindow.show();
        }
      },
    },
    { type: "separator" },
    {
      label: "Modes:",
      enabled: false,
    },
    {
      label: activeModes.electron.isOpen
        ? "✓ Electron Overlay"
        : "  Electron Overlay",
      click: () => {
        if (activeModes.electron.isOpen) {
          closeMode("electron");
        } else {
          launchMode("electron");
        }
      },
    },
    {
      label: activeModes.cli.isOpen ? "✓ CLI Mode" : "  CLI Mode",
      click: () => {
        if (activeModes.cli.isOpen) {
          closeMode("cli");
        } else {
          launchMode("cli");
        }
      },
    },
    // Minimap hidden for now
    // {
    //   label: activeModes.minimap.active ? "✓ Minimap" : "  Minimap",
    //   click: () => {
    //     if (activeModes.minimap.active) {
    //       closeMode("minimap");
    //     } else {
    //       launchMode("minimap");
    //     }
    //   },
    // },
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

function createLauncherWindow() {
  launcherWindow = new BrowserWindow({
    width: 500,
    height: 700,
    resizable: false,
    frame: true,
    show: false, // Don't show until ready
    backgroundColor: "#1a1a2e", // Match launcher background
    webPreferences: {
      preload: path.join(__dirname, "src", "app", "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Prevent throttling when hidden
    },
    icon: path.join(__dirname, "icon.ico"),
  });

  // Remove menu bar
  Menu.setApplicationMenu(null);

  launcherWindow.loadFile("public/launcher-view.html");

  // Open DevTools in development mode
  if (!isPackaged) {
    launcherWindow.webContents.openDevTools();
  }

  // Show window as soon as it's ready
  launcherWindow.once("ready-to-show", () => {
    launcherWindow.show();
  });

  // Prevent window close - hide to tray instead (if tray exists)
  launcherWindow.on("close", (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      launcherWindow.hide();
    }
  });

  launcherWindow.on("closed", () => {
    launcherWindow = null;
  });
}

// Handle get-version request
ipcMain.on("get-version", (event) => {
  event.returnValue = app.getVersion();
});

// Handle mode selection
ipcMain.on("launch-mode", (event, { mode }) => {
  console.log(`Launching ${mode} mode...`);

  // Launch the mode using the helper
  launchMode(mode);

  // Hide launcher after launching
  if (launcherWindow) {
    launcherWindow.hide();
  }
});

// Settings handlers
ipcMain.handle("get-settings", async () => {
  try {
    return loadSettings();
  } catch (error) {
    console.error("Error reading settings:", error);
    return DEFAULT_SETTINGS;
  }
});

ipcMain.handle("save-settings", async (event, settings) => {
  try {
    const success = saveSettings(settings);
    return { success };
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
});

ipcMain.handle("get-sheets-config", async () => {
  const sheetsPath = configPaths.getConfigPath("sheets.json");
  try {
    const data = fs.readFileSync(sheetsPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      // File doesn't exist, return null
      return null;
    }
    console.error("Error reading sheets config:", error);
    throw error;
  }
});

ipcMain.handle("save-sheets-config", async (event, config) => {
  const sheetsPath = configPaths.getConfigPath("sheets.json");
  try {
    fs.writeFileSync(sheetsPath, JSON.stringify(config, null, 2), "utf8");
    return { success: true };
  } catch (error) {
    console.error("Error saving sheets config:", error);
    throw error;
  }
});


// Auto-update handlers
ipcMain.handle("check-for-updates", async () => {
  try {
    const result = await autoUpdateManager.checkForUpdates(true);
    return autoUpdateManager.getUpdateStatus();
  } catch (error) {
    console.error("Error checking for updates:", error);
    return { error: error.message };
  }
});

ipcMain.handle("download-update", async () => {
  try {
    await autoUpdateManager.downloadUpdate();
    return { success: true };
  } catch (error) {
    console.error("Error downloading update:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("install-update", async () => {
  try {
    autoUpdateManager.quitAndInstall();
    return { success: true };
  } catch (error) {
    console.error("Error installing update:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-update-status", async () => {
  return autoUpdateManager.getUpdateStatus();
});

ipcMain.handle("update-auto-update-setting", async (event, enabled) => {
  try {
    if (enabled) {
      autoUpdateManager.startPeriodicUpdateCheck();
    } else {
      autoUpdateManager.stopPeriodicUpdateCheck();
    }
    return { success: true };
  } catch (error) {
    console.error("Error updating auto-update setting:", error);
    return { success: false, error: error.message };
  }
});

// Start shared backend server
function startBackendServer() {
  if (backendServerProcess) {
    console.log("Backend server already running");
    return;
  }

  console.log(`Starting shared backend server on port ${BACKEND_PORT}...`);

  if (isPackaged) {
    // Packaged mode: Run server in the same process
    try {
      const appPath = app.getAppPath();
      global.__appPath = appPath;
      global.__isPackaged = true;

      // Require and run the server (it will run in ASAR)
      require(path.join(appPath, "server.js"));
      console.log("Backend server started in-process (packaged mode)");
    } catch (error) {
      console.error("Error starting backend server:", error);
      dialog.showErrorBox(
        "Server Error",
        "Failed to start backend server: " + error.message,
      );
    }
  } else {
    // Development mode: Fork server with Electron's Node.js (cap is built for Electron)
    const serverPath = path.join(__dirname, "server.js");
    const isDev = process.defaultApp || process.env.NODE_ENV === "development";

    const forkOptions = {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        ...(isDev && { DEV_MODE: "true" }),
      },
      execPath: process.execPath, // Use Electron's executable as Node
    };

    if (isDev) {
      forkOptions.cwd = __dirname;
    }

    backendServerProcess = fork(
      serverPath,
      [String(BACKEND_PORT)],
      forkOptions,
    );

    // Log server output to console (only if stdout is writable to avoid EPIPE)
    backendServerProcess.stdout.on("data", (data) => {
      if (process.stdout && process.stdout.writable) {
        console.log("[Backend]", data.toString());
      }
    });

    backendServerProcess.stderr.on("data", (data) => {
      if (process.stderr && process.stderr.writable) {
        console.error("[Backend Error]", data.toString());
      }
    });

    backendServerProcess.on("exit", (code) => {
      if (process.stdout && process.stdout.writable) {
        console.log(`Backend server exited with code ${code}`);
      }
      backendServerProcess = null;
    });

    console.log("Backend server started as child process (dev mode)");
  }
}

// Optimize app startup
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

app.whenReady().then(() => {
  // Initialize user config directory and copy defaults
  configPaths.initializeUserConfigs();

  // Start shared backend server first
  startBackendServer();

  createLauncherWindow();

  // Start automatic update checks (every 6 hours) - only if enabled in settings
  try {
    const settings = loadSettings();
    // Default to true if not set
    if (settings.autoUpdateEnabled !== false) {
      autoUpdateManager.startPeriodicUpdateCheck();
    }
  } catch (error) {
    console.error("Error reading auto-update setting:", error);
    // Default to enabled on error
    autoUpdateManager.startPeriodicUpdateCheck();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLauncherWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Don't quit if tray is active (Web Server mode running)
  if (process.platform !== "darwin" && !tray) {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});
