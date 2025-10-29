// Custom confirmation modal
function showConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalMessage = document.getElementById("modalMessage");
    const modalCancel = document.getElementById("modalCancel");
    const modalConfirm = document.getElementById("modalConfirm");

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.add("show");

    const cleanup = () => {
      modal.classList.remove("show");
      modalCancel.removeEventListener("click", onCancel);
      modalConfirm.removeEventListener("click", onConfirm);
      modal.removeEventListener("click", onOverlayClick);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onOverlayClick = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    };

    modalCancel.addEventListener("click", onCancel);
    modalConfirm.addEventListener("click", onConfirm);
    modal.addEventListener("click", onOverlayClick);
  });
}

// Set version from package.json
try {
  if (window.launcherAPI && window.launcherAPI.getVersion) {
    document.getElementById("version").textContent =
      "v" + window.launcherAPI.getVersion();
  } else {
    document.getElementById("version").textContent = "v2.3.0";
  }
} catch (e) {
  console.error("Error getting version:", e);
  document.getElementById("version").textContent = "v2.3.0";
}

// Collapsible sections
const sectionHeaders = document.querySelectorAll(".section-header");
sectionHeaders.forEach((header) => {
  header.addEventListener("click", () => {
    const content = header.nextElementSibling;
    const isCollapsed = content.classList.contains("collapsed");

    if (isCollapsed) {
      content.classList.remove("collapsed");
      header.classList.add("expanded");
    } else {
      content.classList.add("collapsed");
      header.classList.remove("expanded");
    }
  });
});

const cliButton = document.getElementById("cli-mode");
const electronButton = document.getElementById("electron-mode");
const minimapButton = document.getElementById("minimap-mode");

// Throttle mode launches to prevent rapid clicking
let isLaunching = false;

function launchModeWithFeedback(mode, button) {
  if (isLaunching) {
    console.log("Mode launch in progress, please wait...");
    return;
  }

  isLaunching = true;

  // Add visual feedback
  button.style.opacity = "0.6";
  button.style.pointerEvents = "none";

  // Disable all mode buttons temporarily
  [cliButton, electronButton, minimapButton].forEach((btn) => {
    if (btn) {
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.6";
    }
  });

  // Launch the mode
  window.launcherAPI.launchMode(mode);

  // Re-enable after delay (2.5 seconds)
  setTimeout(() => {
    isLaunching = false;
    [cliButton, electronButton, minimapButton].forEach((btn) => {
      if (btn) {
        btn.style.pointerEvents = "auto";
        btn.style.opacity = "1";
      }
    });
  }, 2500);
}

cliButton.addEventListener("click", () => {
  launchModeWithFeedback("cli", cliButton);
});

electronButton.addEventListener("click", () => {
  launchModeWithFeedback("electron", electronButton);
});

if (minimapButton) {
  minimapButton.addEventListener("click", () => {
    launchModeWithFeedback("minimap", minimapButton);
  });
}

// Settings functionality
const settingsBtn = document.getElementById("settings-btn");
const backBtn = document.getElementById("back-btn");
const launcherView = document.getElementById("launcher-view");
const settingsView = document.getElementById("settings-view");
const saveBtn = document.getElementById("save-btn");
const successMessage = document.getElementById("success-message");

// Open settings
settingsBtn.addEventListener("click", async () => {
  // Load current settings
  try {
    const settings = await window.launcherAPI.getSettings();
    document.getElementById("autoUpdateEnabled").checked =
      settings.autoUpdateEnabled !== false; // Default to true
    document.getElementById("autoClearOnChannelChange").checked =
      settings.autoClearOnChannelChange || false;
    document.getElementById("autoClearOnTimeout").checked =
      settings.autoClearOnTimeout || false;
  } catch (error) {
    console.error("Error loading settings:", error);
  }

  // Load sheets config
  try {
    const sheetsConfig = await window.launcherAPI.getSheetsConfig();
    if (sheetsConfig) {
      document.getElementById("sheetsConfig").value = JSON.stringify(
        sheetsConfig,
        null,
        2,
      );
      validateJSON();
    } else {
      // Show example template if no config exists
      showExampleTemplate();
    }
  } catch (error) {
    console.log("No sheets config found (this is normal if not configured)");
    showExampleTemplate();
  }

  // Toggle views
  launcherView.style.display = "none";
  settingsView.style.display = "flex";
  settingsBtn.style.display = "none";
});

// Back to launcher
backBtn.addEventListener("click", () => {
  launcherView.style.display = "block";
  settingsView.style.display = "none";
  settingsBtn.style.display = "flex";
  successMessage.classList.remove("show");
});

// JSON validation
const sheetsConfigTextarea = document.getElementById("sheetsConfig");
const jsonStatus = document.getElementById("jsonStatus");

let isExampleTemplate = false;

function showExampleTemplate() {
  const template = {
    credentials: {
      type: "service_account",
      project_id: "YOUR_PROJECT_ID",
      private_key_id: "YOUR_PRIVATE_KEY_ID",
      private_key:
        "-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----\\n",
      client_email:
        "YOUR_SERVICE_ACCOUNT_EMAIL@YOUR_PROJECT.iam.gserviceaccount.com",
      client_id: "YOUR_CLIENT_ID",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url:
        "https://www.googleapis.com/robot/v1/metadata/x509/YOUR_SERVICE_ACCOUNT_EMAIL%40YOUR_PROJECT.iam.gserviceaccount.com",
      universe_domain: "googleapis.com",
    },
    spreadsheetId: "YOUR_SPREADSHEET_ID_HERE",
    sheetName: "PlayerInfo",
  };
  sheetsConfigTextarea.value = JSON.stringify(template, null, 2);
  jsonStatus.textContent =
    "ℹ Example template - click to clear and paste your credentials";
  jsonStatus.className = "json-status";
  jsonStatus.style.color = "#667eea";
  isExampleTemplate = true;
}

// Clear example template on first click
sheetsConfigTextarea.addEventListener("focus", () => {
  if (isExampleTemplate) {
    sheetsConfigTextarea.value = "";
    jsonStatus.textContent = "";
    jsonStatus.className = "json-status";
    isExampleTemplate = false;
  }
});

function validateJSON() {
  const value = sheetsConfigTextarea.value.trim();

  if (!value) {
    jsonStatus.textContent = "";
    jsonStatus.className = "json-status";
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    jsonStatus.textContent = "✓ Valid JSON";
    jsonStatus.className = "json-status valid";
    return parsed;
  } catch (error) {
    jsonStatus.textContent = "✗ Invalid JSON: " + error.message;
    jsonStatus.className = "json-status invalid";
    return null;
  }
}

sheetsConfigTextarea.addEventListener("input", validateJSON);

// Save settings
saveBtn.addEventListener("click", async () => {
  const settings = {
    autoUpdateEnabled: document.getElementById("autoUpdateEnabled").checked,
    autoClearOnChannelChange: document.getElementById(
      "autoClearOnChannelChange",
    ).checked,
    autoClearOnTimeout: document.getElementById("autoClearOnTimeout").checked,
  };

  try {
    // Save general settings
    await window.launcherAPI.saveSettings(settings);

    // Notify auto-update manager about the setting change
    if (window.launcherAPI.updateAutoUpdateSetting) {
      await window.launcherAPI.updateAutoUpdateSetting(
        settings.autoUpdateEnabled,
      );
    }

    // Save sheets config if provided and not just the example template
    const sheetsConfigValue = sheetsConfigTextarea.value.trim();
    if (sheetsConfigValue) {
      const sheetsConfig = validateJSON();
      if (!sheetsConfig) {
        alert("Cannot save: Google Sheets configuration contains invalid JSON");
        return;
      }
      // Don't save if it's still the example template
      if (
        sheetsConfig.credentials &&
        sheetsConfig.credentials.project_id === "YOUR_PROJECT_ID"
      ) {
        // Skip saving example template - it's fine
      } else {
        await window.launcherAPI.saveSheetsConfig(sheetsConfig);
      }
    }

    // Show success message
    successMessage.classList.add("show");

    // Hide after 2 seconds
    setTimeout(() => {
      successMessage.classList.remove("show");
    }, 2000);
  } catch (error) {
    console.error("Error saving settings:", error);
    alert("Failed to save settings: " + error.message);
  }
});

// App Updates functionality
const checkUpdatesBtn = document.getElementById("check-updates-btn");
const updateStatus = document.getElementById("updateStatus");
const updateInfo = document.getElementById("updateInfo");

// Helper function to set update status
function setUpdateStatus(message, type = "") {
  updateStatus.textContent = message;
  updateStatus.className = type ? `action-status ${type}` : "action-status";
}

// Load current version on settings open
async function loadUpdateInfo() {
  try {
    const status = await window.launcherAPI.getUpdateStatus();
    if (status && status.currentVersion) {
      updateInfo.textContent = `Current version: ${status.currentVersion}`;

      if (status.isUpdateAvailable && status.updateInfo) {
        updateInfo.textContent += ` • Update available: ${status.updateInfo.version}`;
        updateInfo.style.color = "#667eea";
      }
    }
  } catch (error) {
    console.error("Error loading update info:", error);
  }
}

// Load update info when settings are opened
settingsBtn.addEventListener("click", () => {
  loadUpdateInfo();
});

// Check for updates
checkUpdatesBtn.addEventListener("click", async () => {
  setUpdateStatus("");
  setUpdateStatus("Checking for updates...", "info");
  checkUpdatesBtn.disabled = true;

  try {
    const result = await window.launcherAPI.checkForUpdates();

    if (result.error) {
      setUpdateStatus(`✗ ${result.error}`, "error");
    } else if (result.isUpdateAvailable && result.updateInfo) {
      const version = result.updateInfo.version;
      updateInfo.textContent = `Current version: ${result.currentVersion} • Update available: ${version}`;
      updateInfo.style.color = "#667eea";
      setUpdateStatus(
        `✓ Update ${version} is available! Download will start automatically.`,
        "success",
      );
    } else {
      setUpdateStatus("✓ You are running the latest version", "success");
      updateInfo.textContent = `Current version: ${result.currentVersion}`;
      updateInfo.style.color = "#6b7280";
    }

    // Re-enable button after 2 seconds
    setTimeout(() => {
      checkUpdatesBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error("Error checking for updates:", error);
    setUpdateStatus(`✗ Error: ${error.message}`, "error");
    checkUpdatesBtn.disabled = false;
  }
});

