const { BrowserWindow, app } = require("electron");
const path = require("path");
const fs = require("fs");

// Function to log to file safely for packaged environment
function logToFile(msg) {
  try {
    const userData = app.getPath("userData");
    const logPath = path.join(userData, "debug-cli.log");
    const timestamp = new Date().toISOString();
    fs.mkdirSync(userData, { recursive: true });
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
  } catch (e) {
    console.error("Error writing log:", e);
  }
}

let cliWindow = null;
logToFile("==== ELECTRON CLI MODULE LOADED ====");

// Global error handlers for debugging
process.on("uncaughtException", (error) => {
  logToFile(`CLI UNCAUGHT EXCEPTION: ${error.message}`);
  logToFile(`Stack: ${error.stack}`);
  console.error("CLI Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  logToFile(`CLI UNHANDLED REJECTION: ${reason}`);
  console.error("CLI Unhandled Rejection:", reason);
});

function createCLIWindow() {
  try {
    logToFile("createCLIWindow() called");

    // If CLI window already exists, focus it
    if (cliWindow && !cliWindow.isDestroyed()) {
      logToFile("CLI window already exists, focusing it");
      cliWindow.focus();
      return cliWindow;
    }

    logToFile("Creating new CLI window");
    cliWindow = new BrowserWindow({
      width: 1500,
      height: 800,
      backgroundColor: "#000000",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
      },
      icon: path.join(__dirname, "..", "..", "icon.ico"),
    });

    // Open DevTools in development mode
    const isDev = process.defaultApp || process.env.NODE_ENV === "development";
    if (isDev) {
      logToFile("Opening DevTools (development mode)");
      cliWindow.webContents.openDevTools();
    }

    // Load the CLI view from backend server (allows Socket.IO to work)
    const url = "http://localhost:8989/cli-view.html";
    logToFile(`Loading URL: ${url}`);
    cliWindow.loadURL(url);

    cliWindow.on("closed", () => {
      logToFile("CLI window closed");
      cliWindow = null;
    });

    // Log any load failures
    cliWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        logToFile(
          `CLI window failed to load: ${errorCode} - ${errorDescription}`,
        );
      },
    );

    logToFile("CLI window created successfully");
    return cliWindow;
  } catch (error) {
    logToFile(`ERROR in createCLIWindow: ${error.message}`);
    logToFile(`Stack: ${error.stack}`);
    console.error("Error creating CLI window:", error);
    throw error;
  }
}

function stopCLI() {
  try {
    logToFile("stopCLI() called");
    // Just close the window
    if (cliWindow && !cliWindow.isDestroyed()) {
      logToFile("Closing CLI window");
      cliWindow.close();
    }
    cliWindow = null;
    logToFile("CLI stopped");
  } catch (error) {
    logToFile(`ERROR in stopCLI: ${error.message}`);
    console.error("Error stopping CLI:", error);
  }
}

module.exports = { createCLIWindow, stopCLI };
