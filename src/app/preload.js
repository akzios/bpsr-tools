const { contextBridge, ipcRenderer } = require("electron");

// Expose API for DPS Meter overlay window
contextBridge.exposeInMainWorld("electronAPI", {
  setWindowMovable: (movable) =>
    ipcRenderer.send("set-window-movable", movable),
  closeWindow: () => ipcRenderer.send("close-window"),
  resizeWindow: (width, height) =>
    ipcRenderer.send("resize-window", width, height),
});

// Expose API for CLI window
let keypressCallback = null;
contextBridge.exposeInMainWorld("cliAPI", {
  onOutput: (callback) => {
    ipcRenderer.on("cli-output", (event, text) => callback(text));
  },
  onClear: (callback) => {
    ipcRenderer.on("cli-clear", () => callback());
  },
  sendInput: (key) => {
    ipcRenderer.send("cli-input", key);
  },
  onKeypress: (callback) => {
    keypressCallback = callback;
  },
  handleKeypress: (key) => {
    if (keypressCallback) {
      keypressCallback(key);
    }
  },
});

// Expose API for launcher window
contextBridge.exposeInMainWorld("launcherAPI", {
  launchMode: (mode) => {
    ipcRenderer.send("launch-mode", { mode });
  },
  getVersion: () => ipcRenderer.sendSync("get-version"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  getSheetsConfig: () => ipcRenderer.invoke("get-sheets-config"),
  saveSheetsConfig: (config) =>
    ipcRenderer.invoke("save-sheets-config", config),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  getUpdateStatus: () => ipcRenderer.invoke("get-update-status"),
  updateAutoUpdateSetting: (enabled) =>
    ipcRenderer.invoke("update-auto-update-setting", enabled),
  updateDatabase: () => ipcRenderer.invoke("update-database"),
});

// Add DOMContentLoaded listener for version display
window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ["chrome", "node", "electron"]) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});
