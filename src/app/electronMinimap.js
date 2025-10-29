const { BrowserWindow, app } = require("electron");
const path = require("path");
const fs = require("fs");

const userDataPath = app.getPath("userData");
const debugLogPath = path.join(userDataPath, "debug.log");

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [Minimap] ${message}\n`;
  console.log(logMessage.trim());
  try {
    fs.appendFileSync(debugLogPath, logMessage);
  } catch (err) {
    console.error("Failed to write to debug log:", err);
  }
}

let mainWindow = null;

function createMinimapWindow(serverPort = 8989) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    log("Minimap window already exists, focusing it");
    mainWindow.focus();
    return mainWindow;
  }

  log("Creating minimap window...");

  mainWindow = new BrowserWindow({
    width: 420,
    height: 500,
    minWidth: 420,
    minHeight: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Set always on top with screen-saver level for fullscreen game compatibility
  mainWindow.setAlwaysOnTop(true, "screen-saver");

  log(`Loading minimap from http://localhost:${serverPort}/minimap-view.html`);
  mainWindow.loadURL(`http://localhost:${serverPort}/minimap-view.html`);

  // Open DevTools in development mode
  const isDev = process.defaultApp || process.env.NODE_ENV === "development";
  if (isDev) {
    log("Development mode detected, opening DevTools");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    log("Minimap window closed");
    mainWindow = null;
  });

  mainWindow.webContents.on("did-finish-load", () => {
    log("Minimap window loaded successfully");
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      log(`Failed to load minimap: ${errorCode} - ${errorDescription}`);
    },
  );

  log("Minimap window created");
  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

// Global error handlers
process.on("uncaughtException", (error) => {
  log(`Uncaught exception: ${error.message}`);
  log(error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  log(`Unhandled rejection: ${reason}`);
});

module.exports = {
  createMinimapWindow,
  getMainWindow,
};
