const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

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
process.on('uncaughtException', (error) => {
  logToFile(`UNCAUGHT EXCEPTION: ${error.message}`);
  logToFile(`Stack: ${error.stack}`);
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logToFile(`UNHANDLED REJECTION: ${reason}`);
  console.error('Unhandled Rejection:', reason);
});

async function createWindow() {
  try {
    logToFile("createWindow() called");

    mainWindow = new BrowserWindow({
      width: 674,
      height: 800,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
      },
      icon: path.join(__dirname, "..", "..", "icon.ico"),
    });

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
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logToFile(`Overlay window failed to load: ${errorCode} - ${errorDescription}`);
    console.error(`Overlay load failed: ${errorCode} - ${errorDescription}`);
  });

  mainWindow.on("closed", () => {
    logToFile("Overlay window closed");
    mainWindow = null;
  });

  // Handle event to make window movable/non-movable
  ipcMain.on("set-window-movable", (event, movable) => {
    if (mainWindow) {
      mainWindow.setMovable(movable);
    }
  });

  // Handle event to close window
  ipcMain.on("close-window", () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  // Handle event to resize window
  ipcMain.on("resize-window", (event, width, height) => {
    if (mainWindow) {
      mainWindow.setSize(width, height);
    }
  });

    logToFile("Window created successfully");
  } catch (error) {
    logToFile(`ERROR in createWindow: ${error.message}`);
    logToFile(`Stack: ${error.stack}`);
    console.error('Error in createWindow:', error);
    throw error;
  }
}

// Only auto-start if this is the main entry point
if (require.main === module) {
  logToFile("Running as main module (standalone mode)");
  app.whenReady().then(() => {
    createWindow().catch(err => {
      logToFile(`ERROR starting standalone: ${err.message}`);
      console.error('Failed to create window:', err);
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch(err => {
          logToFile(`ERROR on activate: ${err.message}`);
          console.error('Failed to create window on activate:', err);
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
    createWindow().catch(err => {
      logToFile(`ERROR creating window from launcher: ${err.message}`);
      logToFile(`Stack: ${err.stack}`);
      console.error('Failed to create window from launcher:', err);
    });
  } else {
    logToFile("App not ready yet, waiting...");
    app.whenReady().then(() => {
      logToFile("App now ready, creating window");
      createWindow().catch(err => {
        logToFile(`ERROR creating window after ready: ${err.message}`);
        logToFile(`Stack: ${err.stack}`);
        console.error('Failed to create window after ready:', err);
      });
    });
  }

  app.on("window-all-closed", () => {
    // Don't quit - let launcher stay open for mode switching
    logToFile("All overlay windows closed (launcher mode active)");
  });
}

// Export getters for mode tracking
module.exports = {
  getMainWindow: () => mainWindow,
};
