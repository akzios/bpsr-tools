// Global state for Lite mode
let isLiteMode = false;
let liteModeType = "dps"; // 'dps' or 'healer'

console.log("main.js loaded successfully");

// Professions are now included in /api/data response
// Each user has: professionDetails object containing {id, name_cn, name_en, icon, role, created_at}

let lastTotalDamage = 0;
let lastDamageChangeTime = Date.now();
let logPreviewTimeout; // Declare logPreviewTimeout here
let lastRenderedData = null; // Store last rendered data to prevent unnecessary re-renders

const playerBarsContainer = document.getElementById("player-bars-container");
const logsSection = document.getElementById("logs-section"); // Declare logsSection here
const loadingIndicator = document.getElementById("loading-indicator"); // Loading indicator

document.addEventListener("DOMContentLoaded", async () => {
  // Theme Management
  const themeToggleBtn = document.getElementById("theme-toggle-button");
  const rootElement = document.documentElement;

  // Load theme from settings API
  async function loadTheme() {
    try {
      const response = await fetch("/api/settings");
      const result = await response.json();
      // Unwrap API response: { code: 0, data: { theme: "dark" } }
      const settings = result.data || result;
      const theme = settings.theme || "dark";
      rootElement.setAttribute("data-theme", theme);
      updateThemeIcon(theme);
    } catch (error) {
      console.error("Error loading theme:", error);
      // Fallback to dark theme
      rootElement.setAttribute("data-theme", "dark");
      updateThemeIcon("dark");
    }
  }

  // Save theme to settings API
  async function saveTheme(theme) {
    try {
      const response = await fetch("/api/settings");
      let settings = await response.json();

      // Ensure we're working with the actual settings object, not the API response wrapper
      if (settings.data) {
        settings = settings.data;
      }

      settings.theme = theme;
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  }

  function updateThemeIcon(theme) {
    if (themeToggleBtn) {
      const icon = themeToggleBtn.querySelector("i");
      if (icon) {
        icon.className =
          theme === "light" ? "fa-solid fa-sun" : "fa-solid fa-moon";
      }
    }
  }

  // Load theme on startup
  await loadTheme();

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", async () => {
      const currentTheme = rootElement.getAttribute("data-theme") || "dark";
      const newTheme = currentTheme === "light" ? "dark" : "light";
      rootElement.setAttribute("data-theme", newTheme);
      updateThemeIcon(newTheme);
      await saveTheme(newTheme);
    });
  }

  // Setup always on top toggle (Electron only)
  if (window.electronAPI) {
    const alwaysOnTopBtn = document.getElementById("always-on-top-button");
    if (alwaysOnTopBtn) {
      // Show the button in Electron mode
      alwaysOnTopBtn.style.display = "";

      // Load initial state
      window.electronAPI.getAlwaysOnTop().then((isOnTop) => {
        updateAlwaysOnTopIcon(isOnTop);
      });

      // Handle button click
      alwaysOnTopBtn.addEventListener("click", async () => {
        const currentState = await window.electronAPI.getAlwaysOnTop();
        const newState = !currentState;
        window.electronAPI.setAlwaysOnTop(newState);
        updateAlwaysOnTopIcon(newState);
      });
    }

    function updateAlwaysOnTopIcon(isOnTop) {
      if (alwaysOnTopBtn) {
        const icon = alwaysOnTopBtn.querySelector("i");
        if (icon) {
          // Update icon color/style to indicate state
          if (isOnTop) {
            alwaysOnTopBtn.style.color = "#667eea";
            alwaysOnTopBtn.title = "Always on Top: ON (click to disable)";
          } else {
            alwaysOnTopBtn.style.color = "";
            alwaysOnTopBtn.title = "Always on Top: OFF (click to enable)";
          }
        }
      }
    }
  } else {
    // Hide Electron-only buttons when running in web mode
    const electronOnlyButtons = ["close-button", "always-on-top-button"];
    electronOnlyButtons.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = "none";
      }
    });
    // Also disable dragging in web mode
    const controls = document.querySelector(".controls");
    if (controls) {
      controls.style.webkitAppRegion = "no-drag";
      controls.style.cursor = "default";
    }
  }

  // Setup Socket.IO for real-time theme sync
  const socket = io();
  socket.on("theme-changed", (data) => {
    if (data.theme) {
      rootElement.setAttribute("data-theme", data.theme);
      updateThemeIcon(data.theme);
      console.log(`Theme updated to ${data.theme} via Socket.IO`);
    }
  });

  // Declare pause-related variables at function scope
  let isPaused = false;
  let updatePauseButton;

  const resetButton = document.getElementById("reset-button");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      resetDpsMeter();
    });
  }

  // Pause Button
  const pauseButton = document.getElementById("pause-button");
  if (pauseButton) {
    // Load initial pause state
    fetch("/api/pause")
      .then((res) => res.json())
      .then((data) => {
        isPaused = data.paused || false;
        updatePauseButton();
      })
      .catch((err) => console.error("Error loading pause state:", err));

    pauseButton.addEventListener("click", async () => {
      isPaused = !isPaused;
      try {
        const response = await fetch("/api/pause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paused: isPaused }),
        });
        const data = await response.json();
        isPaused = data.paused;
        updatePauseButton();
      } catch (err) {
        console.error("Error toggling pause:", err);
        isPaused = !isPaused; // Revert on error
      }
    });

    updatePauseButton = function () {
      const icon = pauseButton.querySelector("i");
      if (isPaused) {
        pauseButton.classList.add("paused");
        pauseButton.title = "Resume Tracking";
        icon.className = "fa-solid fa-play";
      } else {
        pauseButton.classList.remove("paused");
        pauseButton.title = "Pause Tracking";
        icon.className = "fa-solid fa-pause";
      }
    };
  }

  // Listen for pause state changes from other clients
  socket.on("pause-state-changed", (data) => {
    isPaused = data.paused;
    if (updatePauseButton) {
      updatePauseButton();
    }
    console.log(`Pause state synced: ${isPaused ? "paused" : "resumed"}`);
  });

  // Advanced/Lite Button
  const advLiteBtn = document.getElementById("advanced-lite-btn");
  const liteDpsHealerBtn = document.getElementById("lite-dps-healer-btn");
  if (advLiteBtn) {
    advLiteBtn.addEventListener("click", () => {
      isLiteMode = !isLiteMode;
      advLiteBtn.classList.toggle("lite", isLiteMode);
      advLiteBtn.textContent = isLiteMode ? "Lite" : "Advanced";
      // Show/hide the DPS/Healer button
      if (liteDpsHealerBtn) {
        liteDpsHealerBtn.style.display = isLiteMode ? "inline-flex" : "none";
      }
      fetchDataAndRender();
    });
  }
  if (liteDpsHealerBtn) {
    liteDpsHealerBtn.addEventListener("click", () => {
      liteModeType = liteModeType === "dps" ? "healer" : "dps";
      liteDpsHealerBtn.textContent = liteModeType === "dps" ? "DPS" : "Healer";
      // Update color classes
      liteDpsHealerBtn.classList.remove("mode-dps", "mode-healer");
      liteDpsHealerBtn.classList.add(
        liteModeType === "dps" ? "mode-dps" : "mode-healer",
      );
      fetchDataAndRender();
    });
  }
  // Initialize button visibility and style on load
  if (liteDpsHealerBtn) {
    liteDpsHealerBtn.style.display = isLiteMode ? "inline-flex" : "none";
    // Set initial color based on mode
    liteDpsHealerBtn.classList.add(
      liteModeType === "dps" ? "mode-dps" : "mode-healer",
    );
  }

  const closeButton = document.getElementById("close-button");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      if (window.electronAPI) {
        window.electronAPI.closeWindow();
      }
    });
  }

  // Modal close handlers
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalBackdrop = document.querySelector(".modal-backdrop");
  const modal = document.getElementById("skill-modal");

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeSkillModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", closeSkillModal);
  }

  // Close modal on Escape key
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && modal.classList.contains("active")) {
      closeSkillModal();
    }
  });
});

function updateWindowSize() {
  const dpsMeter = document.querySelector(".bpsr-tools");
  const container = document.getElementById("player-bars-container");
  if (!dpsMeter || !container || !window.electronAPI) return;

  const baseWidth = 724 + 24; // 700px content + 12px left margin + 12px right margin + 24px shadow space (12px each side)
  const headerHeight = document.querySelector(".controls")?.offsetHeight || 58; // Header height (40px buttons + 16px padding)
  const marginTop = 54; // Top margin of player bars container
  const borderWidth = 2; // Top and bottom border of container
  const bprsToolsMargin = 24; // 12px top + 12px bottom margin on .bpsr-tools

  // Count player bar wrappers (which include skill breakdowns)
  const playerWrappers = container.querySelectorAll(".player-bar-wrapper");
  const numPlayersCapped = Math.min(playerWrappers.length, 10); // Limit to 10 bars

  let barsHeight = 0;
  if (numPlayersCapped > 0) {
    // Calculate total height of player bars
    playerWrappers.forEach((wrapper, index) => {
      if (index < numPlayersCapped) {
        const bar = wrapper.querySelector(".player-bar, .lite-bar");

        if (bar) {
          barsHeight += bar.offsetHeight || 60; // Default to 60px if not measurable
        }
        barsHeight += 8; // Gap between wrappers
      }
    });
  } else {
    // Minimum height for "Waiting for data..." message
    barsHeight = 50;
  }

  // Calculate total height, including header, margins, and shadow space
  const shadowSpace = 24; // Box-shadow blur radius (0 0 24px)
  const totalContentHeight =
    headerHeight +
    marginTop +
    borderWidth +
    barsHeight +
    bprsToolsMargin +
    shadowSpace +
    20; // Include shadow space + buffer

  const finalWidth = Math.round(baseWidth);
  const finalHeight = Math.round(totalContentHeight);

  window.electronAPI.resizeWindow(finalWidth, finalHeight);
}

function resetDpsMeter() {
  fetch("/api/clear");
  console.log("Meter Restarted");
  lastTotalDamage = 0;
  lastDamageChangeTime = Date.now();
}

function formatTimer(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

async function fetchLogs() {
  const res = await fetch("/logs-dps");
  return await res.json();
}

function renderLogs(logs) {
  let html = "";
  if (logs.length === 0) {
    logsSection.style.display = "none"; // Hide section if no logs
    return;
  } else {
    logsSection.style.display = "block"; // Show section if there are logs
    html =
      '<select id="logs-dropdown" style="width:100%;padding:6px 4px;border-radius:6px;font-size:1rem;">' +
      `<option value="-1">LOG</option>` +
      logs
        .map((log, i) => `<option value="${i}">${log.fecha}</option>`)
        .join("") +
      "</select>";
    html += '<div id="log-preview"></div>';
  }
  logsSection.innerHTML = html;
  if (logs.length > 0) {
    let lastValue = -1;
    const dropdown = document.getElementById("logs-dropdown");
    dropdown.onchange = function () {
      if (this.value == lastValue || this.value == -1) {
        showLogPreview(null);
        this.value = -1;
        lastValue = -1;
      } else {
        showLogPreview(logs[this.value]);
        lastValue = this.value;
      }
    };
  }
}

function showLogPreview(log) {
  const logPreview = document.getElementById("log-preview");
  if (logPreviewTimeout) {
    clearTimeout(logPreviewTimeout);
  }

  if (!log) {
    logPreview.innerHTML = "";
    return;
  }

  // Note: Log preview shows historical data - profession name can be added to log structure if needed
  logPreview.innerHTML = `<div class=\"player-bar\" style=\"margin-top:10px;\">\n            <div class=\"progress-fill\" style=\"width: 100%; background: #444b5a;\"></div>\n            <div class=\"bar-content\">\n                <div class=\"player-info\">\n                    <span class=\"player-name\">${log.nombre}</span>\n                    <span class=\"player-id\">ID: ${log.id}</span>\n                </div>\n                <div class=\"player-performance\">\n                    <div class=\"stats-list\">\n                        <span class=\"main-stat\">DPS ${formatStat(log.dps)}</span>\n                        <span class=\"secondary-stat\">HPS ${formatStat(log.hps)}</span>\n                        <span class=\"secondary-stat\">DTPS ${formatStat(log.dtps)}</span>\n                    </div>\n                    <img class=\"class-icon\" src=\"assets/images/icons/${log.icon}\" alt=\"icon\">\n                </div>\n            </div>\n        </div>`;
  logPreviewTimeout = setTimeout(() => {
    logPreview.innerHTML = "";
  }, 7000);
}

async function updateLogsUI() {
  const logs = await fetchLogs();
  renderLogs(logs);
}

function getHealthColor(percentage) {
  // Solid colors based on HP percentage: green (>50%), yellow (25-50%), red (<25%)
  if (percentage > 50) {
    return "#10b981"; // Green (var(--success))
  } else if (percentage > 25) {
    return "#f59e0b"; // Yellow/Orange
  } else {
    return "#ef4444"; // Red (var(--error))
  }
}

function formatStat(value) {
  if (value >= 1000000000000) {
    return (value / 1000000000000).toFixed(1) + "T";
  }
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(1) + "G";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "k";
  }
  return value.toFixed(0);
}

const playerColors = [
  "rgba(255, 99, 132, 0.7)", // Red
  "rgba(54, 162, 235, 0.7)", // Blue
  "rgba(255, 206, 86, 0.7)", // Yellow
  "rgba(75, 192, 192, 0.7)", // Green
  "rgba(153, 102, 255, 0.7)", // Purple
  "rgba(255, 159, 64, 0.7)", // Orange
];

async function fetchDataAndRender() {
  const container = document.getElementById("player-bars-container");
  try {
    const [dataRes, settingsRes] = await Promise.all([
      fetch("/api/data"),
      fetch("/api/settings"),
    ]);
    const userData = await dataRes.json();
    const currentGlobalSettings = await settingsRes.json();

    let userArray = Object.values(userData.user);

    // Debug: Log first user's profession data
    if (userArray.length > 0) {
      console.log("[GUI Debug] Sample user data:", {
        name: userArray[0].name,
        professionDetails: userArray[0].professionDetails,
      });
    }
    // Filter to show users who have dealt damage OR provided healing
    userArray = userArray.filter(
      (u) =>
        (u.total_damage && u.total_damage.total > 0) ||
        (u.total_healing && u.total_healing.total > 0),
    );

    // Apply monster type filter
    const originalUserArrayLength = userArray.length;
    userArray = applyMonsterTypeFilter(userArray);

    if (!userArray || userArray.length === 0) {
      loadingIndicator.style.display = "flex"; // Show loading indicator
      playerBarsContainer.style.display = "none"; // Hide player bars container

      // Update loading message based on whether we had data before filtering
      const loadingText = document.querySelector(".gui-loading-text");
      const loadingHint = document.querySelector(".gui-loading-hint");
      if (originalUserArrayLength > 0 && userArray.length === 0) {
        loadingText.textContent = "No data matches the current filter";
        loadingHint.textContent =
          "Adjust your monster type filter to see results";
      } else {
        loadingText.textContent = "Waiting for combat data...";
        loadingHint.textContent = "Start a fight to see DPS metrics";
      }

      lastRenderedData = null; // Reset signature when no data
      return;
    }

    loadingIndicator.style.display = "none"; // Hide loading indicator
    playerBarsContainer.style.display = "flex"; // Show player bars container

    const sumaTotalDamage = userArray.reduce(
      (acc, u) =>
        acc +
        (u.total_damage && u.total_damage.total
          ? Number(u.total_damage.total)
          : 0),
      0,
    );

    // Auto-clear logic: reset if no damage change for 80 seconds
    if (sumaTotalDamage > 0) {
      if (sumaTotalDamage !== lastTotalDamage) {
        lastTotalDamage = sumaTotalDamage;
        lastDamageChangeTime = Date.now();
      } else {
        const AUTO_CLEAR_TIME_MS = 80 * 1000; // 80 seconds
        if (Date.now() - lastDamageChangeTime > AUTO_CLEAR_TIME_MS) {
          resetDpsMeter();
          return;
        }
      }
    } else {
      lastTotalDamage = 0;
      lastDamageChangeTime = Date.now();
    }

    // Calculate damagePercent for all users (base for Advanced and Lite DPS)
    userArray.forEach((u) => {
      const userDamage =
        u.total_damage && u.total_damage.total
          ? Number(u.total_damage.total)
          : 0;
      u.damagePercent =
        sumaTotalDamage > 0
          ? Math.max(0, Math.min(100, (userDamage / sumaTotalDamage) * 100))
          : 0;
    });

    if (isLiteMode && liteModeType === "healer") {
      const totalHealingContribution = userArray.reduce(
        (acc, u) =>
          acc +
          (u.total_healing && u.total_healing.total
            ? Number(u.total_healing.total)
            : 0),
        0,
      );
      userArray.forEach((u) => {
        const userHealing =
          u.total_healing && u.total_healing.total
            ? Number(u.total_healing.total)
            : 0;
        u.healingPercent =
          totalHealingContribution > 0
            ? Math.max(
                0,
                Math.min(100, (userHealing / totalHealingContribution) * 100),
              )
            : 0;
      });
      userArray.sort((a, b) => b.healingPercent - a.healingPercent);
    } else {
      // DPS Mode (Lite or Advanced)
      userArray.sort(
        (a, b) =>
          (b.total_damage && b.total_damage.total
            ? Number(b.total_damage.total)
            : 0) -
          (a.total_damage && a.total_damage.total
            ? Number(a.total_damage.total)
            : 0),
      );
    }

    userArray = userArray.slice(0, 20);

    // Assign rank based on position in sorted array
    userArray.forEach((u, index) => {
      u.rank = index + 1;
    });

    // Smart DOM update: only update changed values, preserve structure
    updatePlayerBarsSmartly(userArray, isLiteMode, liteModeType);
  } catch (err) {
    if (container) {
      container.innerHTML =
        '<div id="message-display">Connection error...</div>';
    }
  }
}

function updatePlayerBarsSmartly(userArray, isLiteMode, liteModeType) {
  const container = document.getElementById("player-bars-container");

  // Get existing wrappers
  const existingWrappers = Array.from(
    container.querySelectorAll(".player-bar-wrapper"),
  );
  const existingUids = new Set();

  existingWrappers.forEach((wrapper) => {
    const button = wrapper.querySelector(".skill-analysis-button");
    if (button) {
      existingUids.add(button.getAttribute("data-uid"));
    }
  });

  // Track which UIDs are in the new data
  const newUids = new Set(userArray.map((u) => String(u.uid)));

  // Remove wrappers for players no longer in data
  existingWrappers.forEach((wrapper) => {
    const button = wrapper.querySelector(".skill-analysis-button");
    const uid = button?.getAttribute("data-uid");
    if (uid && !newUids.has(uid)) {
      wrapper.remove();
    }
  });

  // Process each user
  userArray.forEach((u, index) => {
    const uid = String(u.uid);
    let wrapper = existingWrappers.find((w) => {
      const btn = w.querySelector(".skill-analysis-button");
      return btn?.getAttribute("data-uid") === uid;
    });

    if (wrapper) {
      // Check if mode has changed (lite vs advanced)
      const hasLiteBar = wrapper.querySelector(".lite-bar") !== null;
      const hasAdvancedBar = wrapper.querySelector(".player-bar") !== null;
      const modeChanged =
        (isLiteMode && !hasLiteBar) || (!isLiteMode && !hasAdvancedBar);

      if (modeChanged) {
        // Mode changed, recreate the bar
        const newWrapper = createNewBar(u, index, isLiteMode, liteModeType);
        wrapper.replaceWith(newWrapper);
      } else {
        // Update existing bar
        updateExistingBar(wrapper, u, index, isLiteMode, liteModeType);
      }
    } else {
      // Create new bar
      const newWrapper = createNewBar(u, index, isLiteMode, liteModeType);
      container.appendChild(newWrapper);
    }
  });

  // Reorder wrappers to match userArray order (only if needed)
  const currentWrappers = Array.from(
    container.querySelectorAll(".player-bar-wrapper"),
  );
  let needsReorder = false;

  for (let i = 0; i < userArray.length; i++) {
    const uid = String(userArray[i].uid);
    const currentWrapper = currentWrappers[i];
    const currentUid = currentWrapper
      ?.querySelector(".skill-analysis-button")
      ?.getAttribute("data-uid");

    if (currentUid !== uid) {
      needsReorder = true;
      break;
    }
  }

  if (needsReorder) {
    userArray.forEach((u) => {
      const uid = String(u.uid);
      const wrapper = container
        .querySelector(`.skill-analysis-button[data-uid="${uid}"]`)
        ?.closest(".player-bar-wrapper");
      if (wrapper) {
        container.appendChild(wrapper); // Moves to end, maintains order
      }
    });
  }
}

function updateExistingBar(wrapper, u, index, isLiteMode, liteModeType) {
  const bar = wrapper.querySelector(".player-bar, .lite-bar");
  if (!bar) return;

  // Update local-player class
  if (u.isLocalPlayer) {
    wrapper.classList.add("local-player");
  } else {
    wrapper.classList.remove("local-player");
  }

  if (isLiteMode) {
    // Update Lite mode bar
    const professionIcon = u.professionDetails?.icon || "unknown.png";
    const color = playerColors[index % playerColors.length];

    let barFillWidth, barFillBackground, value1, value2;
    if (liteModeType === "dps") {
      barFillWidth = u.damagePercent;
      barFillBackground =
        u.total_dps > 0
          ? `linear-gradient(90deg, transparent, ${color})`
          : "none";
      value1 = `${formatStat(u.total_damage.total || 0)}`;
      value2 = `${Math.round(u.damagePercent)}%`;
    } else {
      barFillWidth = u.healingPercent;
      barFillBackground =
        u.total_healing && u.total_healing.total > 0
          ? `linear-gradient(90deg, transparent, #28a745)`
          : "none";
      value1 = `${formatStat((u.total_healing && u.total_healing.total) || 0)}`;
      value2 = `${Math.round(u.healingPercent)}%`;
    }

    // Update fill bar
    const fill = bar.querySelector(".lite-bar-fill");
    if (fill) {
      fill.style.width = `${barFillWidth}%`;
      fill.style.background = barFillBackground;
    }

    // Update name
    const nameEl = bar.querySelector(".lite-bar-name");
    if (nameEl) {
      const displayName =
        u.name && typeof u.name === "string" && u.name.trim() !== ""
          ? u.name
          : "Unknown";
      nameEl.textContent = displayName;
    }

    // Update damage value
    const damageEl = bar.querySelector(".lite-bar-damage");
    if (damageEl) {
      const iconHtml =
        liteModeType === "dps"
          ? "<span style='font-size:1.1em;margin-right:2px;'>🔥</span>"
          : "<span style='font-size:1.1em;margin-right:2px; color: #28a745; text-shadow: 0 0 2px white, 0 0 2px white, 0 0 2px white, 0 0 2px white;'>⛨</span>";
      damageEl.innerHTML = `${value1} ${iconHtml}`;
    }

    // Update percent
    const percentEl = bar.querySelector(".lite-bar-percent");
    if (percentEl) percentEl.textContent = value2;

    // Update icon
    const iconEl = bar.querySelector(".lite-bar-icon");
    if (iconEl) iconEl.src = `assets/images/icons/${professionIcon}`;
  } else {
    // Update Advanced mode bar
    const professionName = u.professionDetails?.name_en || "Unknown";
    const professionIcon = u.professionDetails?.icon || "unknown.png";

    const dps = Number(u.total_dps) || 0;
    const color = playerColors[index % playerColors.length];
    const dpsColor =
      dps > 0 ? `linear-gradient(90deg, transparent, ${color})` : "none";
    const totalHits = u.total_count.total || 0;
    const crit =
      u.total_count.critical !== undefined && totalHits > 0
        ? Math.round((u.total_count.critical / totalHits) * 100)
        : "0";
    const lucky =
      u.total_count.lucky !== undefined && totalHits > 0
        ? Math.round((u.total_count.lucky / totalHits) * 100)
        : "0";
    const peak = u.realtime_dps_max !== undefined ? u.realtime_dps_max : 0;

    // Update progress fill
    const progressFill = bar.querySelector(".progress-fill");
    if (progressFill) {
      progressFill.style.width = `${u.damagePercent}%`;
      progressFill.style.background = dpsColor;
    }

    // Update player name
    const nameEl = bar.querySelector(".player-name");
    if (nameEl) {
      const displayName =
        u.name && typeof u.name === "string" && u.name.trim() !== ""
          ? u.name
          : "Unknown";
      nameEl.textContent = displayName;
    }

    // Update HP bar
    const hpFill = bar.querySelector(".hp-bar-fill");
    if (hpFill) {
      const hpPercent = ((u.hp || 0) / (u.max_hp || 1)) * 100;
      hpFill.style.width = `${hpPercent}%`;
      hpFill.style.backgroundColor = getHealthColor(hpPercent);
    }

    // Update HP text
    const hpText = bar.querySelector(
      ".additional-stat-row .additional-stat-value",
    );
    if (hpText && hpText.textContent.includes("/")) {
      hpText.textContent = `${formatStat(u.hp || 0)}/${formatStat(u.max_hp || 0)}`;
    }

    // Update profession
    const profEl = bar.querySelector(".player-id");
    if (profEl) profEl.textContent = professionName;

    // Update DPS, HPS, DT
    const statValues = bar.querySelectorAll(".stats-col .stat-value");
    if (statValues[0]) statValues[0].textContent = formatStat(dps);
    if (statValues[1]) statValues[1].textContent = formatStat(u.total_hps || 0);
    if (statValues[2]) statValues[2].textContent = formatStat(u.taken_damage);

    // Update class icon
    const classIcon = bar.querySelector(".class-icon");
    if (classIcon) classIcon.src = `assets/images/icons/${professionIcon}`;

    // Update percentage overlay on icon
    const percentOverlay = bar.querySelector(".icon-col span");
    if (percentOverlay)
      percentOverlay.textContent = `${Math.round(u.damagePercent)}%`;

    // Update CRIT, LUCK, MAX
    const extraStatValues = bar.querySelectorAll(".extra-col .stat-value");
    if (extraStatValues[0]) extraStatValues[0].textContent = `${crit}%`;
    if (extraStatValues[1]) extraStatValues[1].textContent = `${lucky}%`;
    if (extraStatValues[2]) extraStatValues[2].textContent = formatStat(peak);

    // Update GS, Total Damage, Total Healing
    const additionalStatValues = bar.querySelectorAll(
      ".additional-stats-col .additional-stat-value",
    );
    if (additionalStatValues[0])
      additionalStatValues[0].textContent = formatStat(u.fightPoint);
    if (additionalStatValues[1])
      additionalStatValues[1].textContent = formatStat(
        u.total_damage.total || 0,
      );
    if (additionalStatValues[2])
      additionalStatValues[2].textContent = formatStat(
        u.total_healing.total || 0,
      );
  }
}

function createNewBar(u, index, isLiteMode, liteModeType) {
  const wrapper = document.createElement("div");
  wrapper.className = "player-bar-wrapper";
  // Add local-player class if this is the current player
  if (u.isLocalPlayer) {
    wrapper.classList.add("local-player");
  }

  const professionName = u.professionDetails?.name_en || "Unknown";
  const professionIcon = u.professionDetails?.icon || "unknown.png";
  const color = playerColors[index % playerColors.length];

  if (isLiteMode) {
    const playerName =
      u.name && typeof u.name === "string" && u.name.trim() !== ""
        ? u.name
        : "Unknown";
    let barFillWidth, barFillBackground, value1, value2, iconHtml;

    if (liteModeType === "dps") {
      barFillWidth = u.damagePercent;
      barFillBackground =
        u.total_dps > 0
          ? `linear-gradient(90deg, transparent, ${color})`
          : "none";
      iconHtml = "<span style='font-size:1.1em;margin-right:2px;'>🔥</span>";
      value1 = `${formatStat(u.total_damage.total || 0)}`;
      value2 = `${Math.round(u.damagePercent)}%`;
    } else {
      barFillWidth = u.healingPercent;
      barFillBackground =
        u.total_healing && u.total_healing.total > 0
          ? `linear-gradient(90deg, transparent, #28a745)`
          : "none";
      iconHtml =
        "<span style='font-size:1.1em;margin-right:2px; color: #28a745; text-shadow: 0 0 2px white, 0 0 2px white, 0 0 2px white, 0 0 2px white;'>⛨</span>";
      value1 = `${formatStat((u.total_healing && u.total_healing.total) || 0)}`;
      value2 = `${Math.round(u.healingPercent)}%`;
    }

    wrapper.innerHTML = `
                <div class="lite-bar" data-lite="true" data-rank="${u.rank}">
                    <div class="lite-bar-fill" style="width: ${barFillWidth}%; background: ${barFillBackground};"></div>
                    <div class="lite-bar-content" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; justify-content: space-between;">
                        <div class="skill-analysis-button" data-uid="${u.uid}" title="Skill Analysis">
                            <i class="fa-solid fa-chart-line"></i>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <img class="lite-bar-icon" src="assets/images/icons/${professionIcon}" alt="icon" style="margin-left:2px; margin-right:5px;" />
                            <span class="lite-bar-name">${playerName}</span>
                        </div>
                        <div class="lite-bar-values">
                            <span class="lite-bar-damage">${value1} ${iconHtml}</span>
                            <span class="lite-bar-percent">${value2}</span>
                        </div>
                    </div>
                </div>
            `;
  } else {
    // Advanced mode
    const dps = Number(u.total_dps) || 0;
    const dpsColor =
      dps > 0 ? `linear-gradient(90deg, transparent, ${color})` : "none";
    const playerName =
      u.name && typeof u.name === "string" && u.name.trim() !== ""
        ? u.name
        : "Unknown";
    const totalHits = u.total_count.total || 0;
    const crit =
      u.total_count.critical !== undefined && totalHits > 0
        ? Math.round((u.total_count.critical / totalHits) * 100)
        : "0";
    const lucky =
      u.total_count.lucky !== undefined && totalHits > 0
        ? Math.round((u.total_count.lucky / totalHits) * 100)
        : "0";
    const peak = u.realtime_dps_max !== undefined ? u.realtime_dps_max : 0;

    wrapper.innerHTML = `
                <div class="player-bar" data-rank="${u.rank}">
                    <div class="progress-fill" style="width: ${u.damagePercent}%; background: ${dpsColor}"></div>
                    <div class="bar-content">
                        <div class="skill-analysis-button" data-uid="${u.uid}" title="Skill Analysis">
                            <i class="fa-solid fa-chart-line"></i>
                        </div>
                        <div class="column name-col">
                            <span class="player-name">${playerName}</span>
                            <div class="additional-stat-row" style="height: 18px; margin-top: 1px; margin-bottom: 1px;">
                                <span class="additional-stat-icon" style="color: #dc3545; position: absolute; left: 0; z-index: 2;">❤</span>
                                <div class="hp-bar-background">
                                    <div class="hp-bar-fill" style="width: ${((u.hp || 0) / (u.max_hp || 1)) * 100}%; background-color: ${getHealthColor(((u.hp || 0) / (u.max_hp || 1)) * 100)};"></div>
                                </div>
                                <span class="additional-stat-value" style="width: 100%; text-align: center; font-size: 0.8rem; color: white; text-shadow: 1px 1px 1px black;">${formatStat(u.hp || 0)}/${formatStat(u.max_hp || 0)}</span>
                            </div>
                            <span class="player-id">${professionName}</span>
                        </div>
                        <div class="column stats-col" style="margin-left: 40px;">
                            <div class="stats-group">
                                <div class="stat-row"><span class="stat-value">${formatStat(dps)}</span><span class="stat-label">DPS</span></div>
                                <div class="stat-row"><span class="stat-value">${formatStat(u.total_hps || 0)}</span><span class="stat-label" style="color: #28a745;">HPS</span></div>
                                <div class="stat-row"><span class="stat-value">${formatStat(u.taken_damage)}</span><span class="stat-label" style="color: #ffc107;">DT</span></div>
                            </div>
                        </div>
                        <div class="column icon-col" style="flex-direction: column; justify-content: center; align-items: center; text-align: center; min-width: 65px; position: relative; margin-left: -10px;">
                            <img class="class-icon" src="assets/images/icons/${professionIcon}" alt="icon" style="height: 42px; width: 42px;">
                            <span style="font-size: 0.8rem; font-weight: 600; color: #fff; background: rgba(0, 0, 0, 0.5); padding: 0 4px; border-radius: 5px; position: absolute; top: 12.5px; left: 50%; transform: translateX(-50%); text-shadow: 0 0 2px rgba(0,0,0,0.7);">${Math.round(u.damagePercent)}%</span>
                        </div>
                        <div class="column extra-col" style="margin-left: -10px;">
                            <div class="stats-extra">
                                <div class="stat-row">
                                    <span class="stat-label">CRIT</span>
                                    <span class="stat-icon"> ✸</span>
                                    <span class="stat-value">${crit}%</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">LUCK</span>
                                    <span class="stat-icon"> ☘</span>
                                    <span class="stat-value">${lucky}%</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">MAX</span>
                                    <span class="stat-icon"> ⚔</span>
                                    <span class="stat-value">${formatStat(peak)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="column additional-stats-col">
                            <div class="additional-stats-group">
                                <div class="additional-stat-row">
                                    <span class="additional-stat-icon" style="font-weight: bold;">GS</span>
                                    <span class="additional-stat-value">${formatStat(u.fightPoint)}</span>
                                </div>
                                <div class="additional-stat-row">
                                    <span class="additional-stat-icon">🔥</span>
                                    <span class="additional-stat-value">${formatStat(u.total_damage.total || 0)}</span>
                                </div>
                                <div class="additional-stat-row">
                                    <span class="additional-stat-icon" style="color: #28a745;">⛨</span>
                                    <span class="additional-stat-value">${formatStat(u.total_healing.total || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
  }

  return wrapper;
}

// Event delegation for skill analysis buttons - using event delegation on container
function setupSkillAnalysisHandlers() {
  const container = document.getElementById("player-bars-container");
  if (!container) {
    console.error("player-bars-container not found!");
    return;
  }

  container.addEventListener(
    "click",
    async (event) => {
      // Check if click is on or inside skill analysis button
      const button = event.target.closest(".skill-analysis-button");

      if (button) {
        event.preventDefault();
        event.stopPropagation();

        const uid = button.getAttribute("data-uid");

        if (!uid) {
          console.error("No UID found for skill analysis");
          return;
        }

        // Open skill analysis window directly
        if (window.electronAPI && window.electronAPI.openSkillAnalysisWindow) {
          // Electron mode - open in new window
          window.electronAPI.openSkillAnalysisWindow(uid);
        } else {
          // Web browser mode - open in popup window
          const width = 1400;
          const height = 1000;
          const left = (screen.width - width) / 2;
          const top = (screen.height - height) / 2;
          window.open(
            `/gui-skills-view.html?uid=${uid}`,
            "skillAnalysis",
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
          );
        }
      }
    },
    true,
  ); // Use capture phase
}

// Call setup after a short delay to ensure DOM is ready
setTimeout(() => {
  setupSkillAnalysisHandlers();
}, 100);

// Expose updateWindowSize to window for inline onclick handlers
window.updateWindowSize = updateWindowSize;

// Setup resize handles for Electron frameless window
if (window.electronAPI) {
  document.addEventListener("DOMContentLoaded", () => {
    const resizeHandles = document.querySelectorAll(".resize-handle");

    // Enable resize handles in Electron mode
    resizeHandles.forEach((handle) => {
      handle.style.display = "block";
    });

    resizeHandles.forEach((handle) => {
      handle.addEventListener("mousedown", async (e) => {
        e.preventDefault();

        const startX = e.screenX;
        const startY = e.screenY;
        const startBounds = await window.electronAPI.getBounds();

        const direction = handle.className.replace("resize-handle resize-", "");

        function onMouseMove(e) {
          const deltaX = e.screenX - startX;
          const deltaY = e.screenY - startY;

          let newX = startBounds.x;
          let newY = startBounds.y;
          let newWidth = startBounds.width;
          let newHeight = startBounds.height;

          // Calculate new dimensions and position based on resize direction
          if (direction.includes("right")) {
            newWidth = startBounds.width + deltaX;
          } else if (direction.includes("left")) {
            const widthDelta = startBounds.width - deltaX;
            newWidth = widthDelta;
            newX = startBounds.x + deltaX;
          }

          if (direction.includes("bottom")) {
            newHeight = startBounds.height + deltaY;
          } else if (direction.includes("top")) {
            const heightDelta = startBounds.height - deltaY;
            newHeight = heightDelta;
            newY = startBounds.y + deltaY;
          }

          // Apply size constraints (allow very small sizes with auto-scaling)
          const minWidth = 350;
          const minHeight = 200;
          const maxWidth = 1400;
          const maxHeight = 1200;
          newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
          newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

          // Adjust position if we hit minimum size constraint
          if (direction.includes("left") && newWidth === minWidth) {
            newX = startBounds.x + (startBounds.width - minWidth);
          }
          if (direction.includes("top") && newHeight === minHeight) {
            newY = startBounds.y + (startBounds.height - minHeight);
          }

          // Set window bounds (position + size)
          window.electronAPI.setBounds({
            x: Math.round(newX),
            y: Math.round(newY),
            width: Math.round(newWidth),
            height: Math.round(newHeight),
          });
        }

        function onMouseUp() {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        }

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
  });
}

// Monster Type Filter Function
function initializeMonsterTypeFilter() {
  const filterGroup = document.getElementById("monster-type-filter");
  if (!filterGroup) return;

  const dropdownButton = filterGroup.querySelector(
    ".filter-multiselect-button",
  );
  const dropdownMenu = filterGroup.querySelector(
    ".filter-multiselect-dropdown",
  );
  const buttonText = filterGroup.querySelector(".filter-multiselect-text");
  const checkboxes = filterGroup.querySelectorAll('input[type="checkbox"]');
  const filterButton = document.getElementById("filter-button");
  const filterIcon = filterButton?.querySelector("i");

  // Update button text and filter icon based on selected items
  function updateButtonText() {
    const selectedItems = Array.from(checkboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.nextElementSibling.textContent);

    if (selectedItems.length === 0) {
      buttonText.textContent = "None Selected";
    } else if (selectedItems.length === checkboxes.length) {
      buttonText.textContent = "All Selected";
    } else {
      buttonText.textContent = selectedItems.join(", ");
    }

    // Update filter button icon and color
    if (filterIcon) {
      if (
        selectedItems.length === 0 ||
        selectedItems.length === checkboxes.length
      ) {
        // No filter applied - use regular filter icon
        filterIcon.className = "fa-solid fa-filter";
        filterButton.style.color = "";
        filterButton.classList.remove("active");
      } else {
        // Filter applied - use filled filter icon with brand color
        filterIcon.className = "fa-solid fa-filter-circle-xmark";
        filterButton.style.color = "var(--brand-primary)";
        filterButton.classList.add("active");
      }
    }
  }

  // Toggle dropdown
  dropdownButton.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdownMenu.style.display === "block";
    dropdownMenu.style.display = isOpen ? "none" : "block";
    dropdownButton.classList.toggle("open", !isOpen);
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!filterGroup.contains(e.target)) {
      dropdownMenu.style.display = "none";
      dropdownButton.classList.remove("open");
    }
  });

  // Load saved filter preferences from localStorage
  const savedFilters = localStorage.getItem("monsterTypeFilter");
  if (savedFilters) {
    const selectedValues = JSON.parse(savedFilters);
    checkboxes.forEach((checkbox) => {
      checkbox.checked = selectedValues.includes(checkbox.value);
    });
  }
  updateButtonText();

  // Handle filter change on any checkbox
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const selectedValues = Array.from(checkboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
      localStorage.setItem("monsterTypeFilter", JSON.stringify(selectedValues));
      console.log(`Filter changed to: ${selectedValues.join(", ")}`);
      updateButtonText();
      // Trigger immediate re-render with new filter
      fetchDataAndRender();
    });
  });
}

// Apply monster type filter to user data
function applyMonsterTypeFilter(users) {
  const filterGroup = document.getElementById("monster-type-filter");
  if (!filterGroup) return users;

  // Get selected filter values from checkboxes
  const checkboxes = filterGroup.querySelectorAll('input[type="checkbox"]');
  const selectedValues = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);

  // If no options are selected, return empty array
  if (selectedValues.length === 0) {
    return [];
  }

  // If all options are selected, return all users (no filtering)
  if (selectedValues.length === checkboxes.length) {
    return users;
  }

  // Filter users based on monster type they damaged
  return users
    .map((user) => {
      if (!user.targetDamage || user.targetDamage.length === 0) return user;

      // Filter target damage by selected monster types and classifications
      const filteredTargetDamage = user.targetDamage.filter((target) => {
        // Check if target matches any of the selected filters
        return selectedValues.some((filterValue) => {
          if (filterValue === "normal") {
            return target.monsterType === 0;
          } else if (filterValue === "dummy") {
            return target.monsterType === 1;
          } else if (filterValue === "elite") {
            // Elite includes any classification containing "elite"
            // OR type 2 without classification (assume both boss and elite)
            if (
              target.classification &&
              target.classification.toLowerCase().includes("elite")
            ) {
              return true;
            }
            return target.monsterType === 2 && !target.classification;
          } else if (filterValue === "boss") {
            // Boss includes any classification containing "boss"
            // OR type 2 without classification (assume both boss and elite)
            if (
              target.classification &&
              target.classification.toLowerCase().includes("boss")
            ) {
              return true;
            }
            return target.monsterType === 2 && !target.classification;
          }
          return false;
        });
      });

      // Recalculate total damage based on filtered targets
      const filteredTotalDamage = filteredTargetDamage.reduce(
        (sum, target) => sum + target.damage,
        0,
      );

      // Return user with filtered data
      return {
        ...user,
        targetDamage: filteredTargetDamage,
        total_damage: {
          ...user.total_damage,
          total: filteredTotalDamage,
        },
      };
    })
    .filter((user) => user.total_damage && user.total_damage.total > 0);
}

// Initialize collapsible panels
function initializeCollapsiblePanels() {
  const filterButton = document.getElementById("filter-button");
  const filterPanel = document.getElementById("filter-panel");
  const parseButton = document.getElementById("parse-button");
  const parsePanel = document.getElementById("parse-panel");
  const collapsiblePanels = document.getElementById("collapsible-panels");

  // Toggle filter panel
  if (filterButton && filterPanel) {
    filterButton.addEventListener("click", () => {
      const isHidden = !filterPanel.style.display || filterPanel.style.display === "none";
      // Close parse panel if opening filter panel
      if (parsePanel && isHidden) {
        parsePanel.style.display = "none";
      }
      filterPanel.style.display = isHidden ? "flex" : "none";

      // Update collapsible panels container class
      if (collapsiblePanels) {
        if (isHidden) {
          collapsiblePanels.classList.add("has-open-panel");
        } else {
          collapsiblePanels.classList.remove("has-open-panel");
        }
      }
    });
  }

  // Toggle parse panel (handled below with parse mode logic)
}

// Update UI every 50ms (fast updates with smart DOM preservation)
setInterval(fetchDataAndRender, 50);
fetchDataAndRender();
updateLogsUI();
initializeMonsterTypeFilter();
initializeCollapsiblePanels();

// Auto-scale GUI when window is resized below minimum width
function updateGUIScale() {
  const bpsrTools = document.querySelector('.bpsr-tools');
  if (!bpsrTools) return;

  const minWidth = 676; // Minimum natural width before scaling
  const minScale = 0.5; // Minimum scale factor
  const currentWidth = window.innerWidth;

  if (currentWidth < minWidth) {
    // Calculate scale factor: 1.0 at minWidth, 0.5 at (minWidth * 0.5)
    const scale = Math.max(minScale, currentWidth / minWidth);

    // Debug log (only log when scale changes significantly)
    const lastScale = parseFloat(bpsrTools.dataset.lastScale || '1');
    if (Math.abs(scale - lastScale) > 0.01) {
      console.log(`[Scale] Window: ${currentWidth}px, Scale: ${scale.toFixed(2)}x`);
      bpsrTools.dataset.lastScale = scale;
    }

    // Apply scaling transform
    bpsrTools.style.transform = `scale(${scale})`;
    bpsrTools.style.transformOrigin = 'top left';

    // Adjust container dimensions to account for scaling
    // The element needs to be larger to fill the viewport when scaled down
    const scaledWidth = minWidth;
    const scaledHeight = (window.innerHeight - 24) / scale;

    bpsrTools.style.width = `${scaledWidth}px`;
    bpsrTools.style.height = `${scaledHeight}px`;
    bpsrTools.style.minWidth = `${scaledWidth}px`;

    // Ensure proper overflow handling
    bpsrTools.style.overflowX = 'hidden';
    bpsrTools.style.overflowY = 'auto'; // Allow vertical scroll if needed
    document.body.style.overflow = 'hidden';
  } else {
    // Reset to normal
    bpsrTools.style.transform = '';
    bpsrTools.style.transformOrigin = '';
    bpsrTools.style.width = 'calc(100vw - 24px)';
    bpsrTools.style.height = 'calc(100vh - 24px)';
    bpsrTools.style.minWidth = '';
    bpsrTools.style.overflowX = '';
    bpsrTools.style.overflowY = '';
    document.body.style.overflow = '';
    delete bpsrTools.dataset.lastScale;
  }
}

// Update scale on window resize
window.addEventListener('resize', updateGUIScale);
// Initial scale check
document.addEventListener('DOMContentLoaded', updateGUIScale);
// Call immediately and frequently to catch all resize events
updateGUIScale();
setInterval(updateGUIScale, 100); // Check every 100ms to catch Electron setBounds

// Script to remove VSCode debug text
document.addEventListener("DOMContentLoaded", () => {
  const debugTexts = [
    "# VSCode Visible Files",
    "# VSCode Open Tabs",
    "# Current Time",
    "# Context Window Usage",
    "# Current Mode",
  ];

  // Function to search and remove text nodes or elements containing the text
  function removeDebugText() {
    const allElements = document.body.querySelectorAll("*");
    allElements.forEach((element) => {
      debugTexts.forEach((debugText) => {
        if (element.textContent.includes(debugText)) {
          // If the text is directly in the element, or it's an element containing only that text
          if (
            element.childNodes.length === 1 &&
            element.firstChild.nodeType === Node.TEXT_NODE &&
            element.firstChild.textContent.includes(debugText)
          ) {
            element.remove();
          } else {
            // If the text is part of a larger text node, try to remove only the text node
            Array.from(element.childNodes).forEach((node) => {
              if (
                node.nodeType === Node.TEXT_NODE &&
                node.textContent.includes(debugText)
              ) {
                node.remove();
              }
            });
          }
        }
      });
    });

    // Also search directly in body for loose text nodes
    Array.from(document.body.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        debugTexts.forEach((debugText) => {
          if (node.textContent.includes(debugText)) {
            node.remove();
          }
        });
      }
    });
  }

  // Execute the function immediately and then with a small delay to capture late injections
  removeDebugText();
  setTimeout(removeDebugText, 500); // Retry after 500ms
});

// Parse Mode
let parseMode = "inactive"; // "inactive", "waiting", "active"
let parseDuration = 0;
let parseStartTime = null;
let parseEndTime = null;
let parseCountdownInterval = null;
let lastDamageTime = 0;

const parseButton = document.getElementById("parse-button");
const parsePanel = document.getElementById("parse-panel");
const filterPanel = document.getElementById("filter-panel");
const collapsiblePanels = document.getElementById("collapsible-panels");
const parseDurationSlider = document.getElementById("parse-duration-slider");
const parseDurationDisplay = document.getElementById("parse-duration-display");
const parseStartBtn = document.getElementById("parse-start-btn");
const parseCancelBtn = document.getElementById("parse-cancel-btn");
const parseSingleTargetCheckbox = document.getElementById("parse-single-target-checkbox");

// Parse single target state
let parseSingleTargetEnabled = false;
let parseSingleTargetMonster = null; // Will store { monsterId, monsterName } when detected

if (parseButton && parsePanel) {
  // Update duration display when slider changes
  parseDurationSlider.addEventListener("input", () => {
    parseDurationDisplay.textContent = parseDurationSlider.value;
  });

  // Toggle panel visibility
  parseButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // If parse is active, cancel it
    if (parseMode !== "inactive") {
      endParse();
      return;
    }

    const isHidden = parsePanel.style.display === "none" || parsePanel.style.display === "";
    // Close filter panel if opening parse panel
    if (filterPanel && isHidden) {
      filterPanel.style.display = "none";
    }
    parsePanel.style.display = isHidden ? "flex" : "none";

    // Update collapsible panels container class
    if (collapsiblePanels) {
      if (isHidden) {
        collapsiblePanels.classList.add("has-open-panel");
      } else {
        collapsiblePanels.classList.remove("has-open-panel");
      }
    }
  });

  // Cancel button
  parseCancelBtn.addEventListener("click", () => {
    parsePanel.style.display = "none";
    if (collapsiblePanels) {
      collapsiblePanels.classList.remove("has-open-panel");
    }
  });

  // Start parse
  parseStartBtn.addEventListener("click", async () => {
    const duration = parseInt(parseDurationSlider.value);
    parseDuration = duration * 60; // Convert to seconds

    // Capture single target setting
    parseSingleTargetEnabled = parseSingleTargetCheckbox ? parseSingleTargetCheckbox.checked : false;
    parseSingleTargetMonster = null; // Reset - will be detected on first damage

    // Clear current data and ensure tracking is resumed
    await fetch("/api/clear");
    await fetch("/api/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: false })
    });

    // Set parse mode to waiting for player damage
    parseMode = "waiting";
    parseButton.classList.add("waiting");
    parseButton.title = "Waiting for your damage...";

    // Disable start button, slider, checkbox and update text
    parseStartBtn.disabled = true;
    parseDurationSlider.disabled = true;
    if (parseSingleTargetCheckbox) parseSingleTargetCheckbox.disabled = true;
    parseStartBtn.textContent = "Waiting for damage...";

    // Update button to show waiting state
    const icon = parseButton.querySelector("i");
    if (icon) {
      icon.className = "fa-solid fa-hourglass-start";
    }

    console.log(`Parse starting - Single target: ${parseSingleTargetEnabled ? "enabled" : "disabled"}`);

    // Keep panel open - don't hide or remove class
  });

  function startParseCountdown() {
    parseMode = "active";
    parseStartTime = Date.now();
    parseEndTime = parseStartTime + (parseDuration * 1000);

    parseButton.classList.remove("waiting");
    parseButton.classList.add("active");

    // Ensure start button is disabled and update text immediately
    parseStartBtn.disabled = true;

    // Start countdown display immediately
    updateCountdown();
    parseCountdownInterval = setInterval(updateCountdown, 1000);
  }

  function updateCountdown() {
    if (parseMode !== "active") return;

    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((parseEndTime - now) / 1000));

    if (remaining <= 0) {
      endParse();
      return;
    }

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Update button text and icon
    parseButton.title = `Parse Active: ${timeStr}`;
    parseStartBtn.textContent = `Parsing ${timeStr}`;

    // Update button icon with countdown
    const icon = parseButton.querySelector("i");
    if (icon) {
      icon.className = "fa-solid fa-stopwatch";
    }
  }

  // Helper function to inject metadata into PNG
  function injectPNGMetadata(dataUrl, metadata) {
    console.log("Injecting metadata into PNG:", metadata);

    // Convert data URL to ArrayBuffer
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    console.log("PNG size:", bytes.length, "bytes");

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    // Find IEND chunk by walking through chunks properly
    let iendPos = -1;
    let pos = 8; // Skip PNG signature
    let chunksFound = [];

    while (pos <= bytes.length - 12) {
      // Read chunk length (big-endian)
      const length = (bytes[pos] << 24) | (bytes[pos+1] << 16) | (bytes[pos+2] << 8) | bytes[pos+3];

      // Read chunk type
      const type = String.fromCharCode(bytes[pos+4], bytes[pos+5], bytes[pos+6], bytes[pos+7]);
      chunksFound.push(type);

      console.log(`Chunk at ${pos}: ${type}, length: ${length}`);

      if (type === "IEND") {
        iendPos = pos;
        console.log("Found IEND at position:", iendPos);
        break;
      }

      // Move to next chunk (skip length field + type field + data + CRC)
      pos += 4 + 4 + length + 4;

      // Safety check to prevent infinite loop
      if (pos > bytes.length) {
        console.error("Walked past end of PNG data");
        break;
      }
    }

    console.log("Chunks found:", chunksFound.join(", "));

    if (iendPos === -1) {
      console.error("Could not find IEND chunk in PNG");
      return dataUrl; // Return original if we can't find IEND
    }

    console.log("Will inject tEXt chunk before IEND at position:", iendPos);

    // Create tEXt chunk with verification data
    const keyword = "BPSR-Verification";
    const jsonData = JSON.stringify(metadata);
    const textData = keyword + '\0' + jsonData;

    // Calculate chunk length (keyword + null + data)
    const chunkLength = textData.length;
    const chunkType = [0x74, 0x45, 0x58, 0x74]; // "tEXt"

    // Build tEXt chunk
    const textChunk = new Uint8Array(4 + 4 + chunkLength + 4); // length + type + data + CRC

    // Length (big-endian)
    textChunk[0] = (chunkLength >> 24) & 0xFF;
    textChunk[1] = (chunkLength >> 16) & 0xFF;
    textChunk[2] = (chunkLength >> 8) & 0xFF;
    textChunk[3] = chunkLength & 0xFF;

    // Type
    textChunk.set(chunkType, 4);

    // Data
    for (let i = 0; i < textData.length; i++) {
      textChunk[8 + i] = textData.charCodeAt(i);
    }

    // CRC (simplified - using type + data)
    const crcData = new Uint8Array(4 + chunkLength);
    crcData.set(chunkType, 0);
    crcData.set(textChunk.slice(8, 8 + chunkLength), 4);
    const crc = calculateCRC32(crcData);
    textChunk[8 + chunkLength] = (crc >> 24) & 0xFF;
    textChunk[8 + chunkLength + 1] = (crc >> 16) & 0xFF;
    textChunk[8 + chunkLength + 2] = (crc >> 8) & 0xFF;
    textChunk[8 + chunkLength + 3] = crc & 0xFF;

    // Combine: original PNG up to IEND + our tEXt chunk + IEND chunk
    const newBytes = new Uint8Array(iendPos + textChunk.length + (bytes.length - iendPos));
    newBytes.set(bytes.slice(0, iendPos), 0);
    newBytes.set(textChunk, iendPos);
    newBytes.set(bytes.slice(iendPos), iendPos + textChunk.length);

    // Convert back to data URL
    let binary2 = '';
    for (let i = 0; i < newBytes.length; i++) {
      binary2 += String.fromCharCode(newBytes[i]);
    }
    console.log("Metadata injected successfully. New PNG size:", newBytes.length, "bytes");
    return 'data:image/png;base64,' + btoa(binary2);
  }

  // CRC32 calculation for PNG chunks
  function calculateCRC32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // Helper function to download canvas as blob (for web mode)
  function downloadCanvasAsBlob(canvas, filename, metadata) {
    const dataUrl = canvas.toDataURL("image/png");
    const dataUrlWithMetadata = injectPNGMetadata(dataUrl, metadata);

    // Convert data URL to blob
    const base64 = dataUrlWithMetadata.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Parse results exported to Downloads folder");
  }

  // Helper function to generate SHA-256 hash
  async function generateHash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function exportParseToPNG() {
    try {
      // Fetch current data
      const response = await fetch("/api/data");
      const userData = await response.json();
      let userArray = Object.values(userData.user || {});

      // If single target is enabled, filter damage to only that monster
      if (parseSingleTargetEnabled && parseSingleTargetMonster) {
        console.log(`Filtering parse results for single target: ${parseSingleTargetMonster.monsterName}`);

        userArray = userArray.map(user => {
          // Find damage to the selected monster
          let targetDamage = 0;
          if (user.targetDamage && Array.isArray(user.targetDamage)) {
            const targetEntry = user.targetDamage.find(t => t.monsterId === parseSingleTargetMonster.monsterId);
            if (targetEntry) {
              targetDamage = targetEntry.damage;
            }
          }

          // Recalculate DPS for single target (damage / parse duration)
          const singleTargetDps = parseDuration > 0 ? targetDamage / parseDuration : 0;

          // Create filtered user object with single target damage
          return {
            ...user,
            total_damage: {
              ...user.total_damage,
              total: targetDamage
            },
            total_dps: singleTargetDps,
            _singleTarget: true // Flag to indicate this is filtered
          };
        });
      }

      userArray = userArray
        .filter(u => (u.total_damage && u.total_damage.total > 0) || (u.total_healing && u.total_healing.total > 0))
        .sort((a, b) => (b.total_damage?.total || 0) - (a.total_damage?.total || 0))
        .slice(0, 10);

      if (userArray.length === 0) {
        console.log("No data to export");
        return;
      }

      // Generate verification hash from parse data
      const timestamp = new Date().toISOString();
      const parseData = userArray.map(u => ({
        name: u.name,
        dps: Number(u.total_dps) || 0,
        damage: u.total_damage?.total || 0,
        profession: u.professionDetails?.name_en || "Unknown"
      }));
      const dataString = JSON.stringify({ timestamp, duration: parseDuration, players: parseData });
      const verificationHash = await generateHash(dataString);
      const shortHash = verificationHash.substring(0, 16).toUpperCase();

      // Get current theme
      const isDarkTheme = document.documentElement.getAttribute("data-theme") === "dark";

      // Create canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Calculate canvas size based on number of players
      const width = 950; // Width to fit all stat columns
      const headerHeight = 120;
      const playerRowHeight = 85; // Increased for more stats
      const footerHeight = 60;
      const badgeHeight = 150; // Space for verification badge
      const height = headerHeight + Math.max((userArray.length * playerRowHeight), badgeHeight) + footerHeight + 60;

      canvas.width = width;
      canvas.height = height;

      // Theme colors
      const bgColor = isDarkTheme ? "#1a1d2e" : "#ffffff";
      const textColor = isDarkTheme ? "#e4e7eb" : "#1f2937";
      const subTextColor = isDarkTheme ? "#94a3b8" : "#6b7280";
      const brandPrimary = "#667eea";
      const brandSecondary = "#764ba2";

      // Draw background with gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, isDarkTheme ? "#1a1d2e" : "#f9fafb");
      gradient.addColorStop(1, isDarkTheme ? "#252a41" : "#ffffff");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw subtle anti-tampering pattern in background
      ctx.save();
      ctx.globalAlpha = 0.03;
      ctx.strokeStyle = brandPrimary;
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 40) {
        for (let j = 0; j < height; j += 40) {
          ctx.beginPath();
          ctx.arc(i, j, 15, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Draw header with brand gradient
      const headerGradient = ctx.createLinearGradient(0, 0, width, 0);
      headerGradient.addColorStop(0, brandPrimary);
      headerGradient.addColorStop(1, brandSecondary);
      ctx.fillStyle = headerGradient;
      ctx.fillRect(0, 0, width, headerHeight);

      // Draw title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 42px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BPSR Tools - Parse Results", width / 2, 45);

      // Draw timestamp and duration
      const displayTimestamp = new Date(timestamp).toLocaleString();
      ctx.font = "16px 'Inter', sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      const durationMinutes = Math.floor(parseDuration / 60);
      const targetInfo = parseSingleTargetEnabled && parseSingleTargetMonster ? ` • Target: ${parseSingleTargetMonster.monsterName}` : '';
      ctx.fillText(`${displayTimestamp} • ${durationMinutes} min${targetInfo}`, width / 2, 75);

      // Draw verification hash with shield icon
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fillText(`🛡️ ID: ${shortHash}`, width / 2, 100);

      // Draw player rows
      let yOffset = headerHeight + 20;

      // Load profession icons (we'll handle errors gracefully)
      const iconPromises = userArray.map(async (u) => {
        const professionIcon = u.professionDetails?.icon || "unknown.png";
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ user: u, img });
          img.onerror = () => resolve({ user: u, img: null });
          img.src = `assets/images/icons/${professionIcon}`;
        });
      });

      const iconData = await Promise.all(iconPromises);

      iconData.forEach((data, index) => {
        const u = data.user;
        const img = data.img;
        const dps = Number(u.total_dps) || 0;
        const hps = Number(u.total_hps) || 0;
        const dt = u.taken_damage || 0;
        const totalDamage = u.total_damage?.total || 0;
        const totalHealing = u.total_healing?.total || 0;
        const professionName = u.professionDetails?.name_en || "Unknown";
        const playerName = (u.name && typeof u.name === "string" && u.name.trim() !== "") ? u.name : "Unknown";
        const totalHits = u.total_count?.total || 0;
        const crit = (u.total_count?.critical !== undefined && totalHits > 0) ? Math.round((u.total_count.critical / totalHits) * 100) : 0;
        const lucky = (u.total_count?.lucky !== undefined && totalHits > 0) ? Math.round((u.total_count.lucky / totalHits) * 100) : 0;
        const peak = u.realtime_dps_max !== undefined ? u.realtime_dps_max : 0;
        const gs = u.fightPoint || 0;
        const damagePercent = totalDamage > 0 ? Math.round((totalDamage / userArray.reduce((sum, user) => sum + (user.total_damage?.total || 0), 0)) * 100) : 0;

        // Row background (alternating)
        ctx.fillStyle = index % 2 === 0
          ? (isDarkTheme ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)")
          : (isDarkTheme ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)");
        ctx.fillRect(20, yOffset, width - 40, playerRowHeight);

        // Rank badge
        const rankSize = 40;
        const rankX = 45;
        const rankY = yOffset + playerRowHeight / 2;
        ctx.fillStyle = brandPrimary;
        ctx.beginPath();
        ctx.arc(rankX, rankY, rankSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${index + 1}`, rankX, rankY);

        // Name column (left side)
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const nameX = 85;

        // Player name
        ctx.fillStyle = textColor;
        ctx.font = "bold 16px 'Inter', sans-serif";
        ctx.fillText(playerName, nameX, yOffset + 15);

        // Profession name
        ctx.fillStyle = subTextColor;
        ctx.font = "12px 'Inter', sans-serif";
        ctx.fillText(professionName, nameX, yOffset + 62);

        // DPS/HPS/DT column
        const statsX = 290;
        ctx.textAlign = "left";

        // DPS
        ctx.fillStyle = textColor;
        ctx.font = "bold 14px 'Inter', sans-serif";
        ctx.fillText(formatStat(dps), statsX, yOffset + 15);
        ctx.fillStyle = subTextColor;
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText("DPS", statsX + 60, yOffset + 17);

        // HPS
        ctx.fillStyle = textColor;
        ctx.font = "bold 14px 'Inter', sans-serif";
        ctx.fillText(formatStat(hps), statsX, yOffset + 38);
        ctx.fillStyle = "#28a745";
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText("HPS", statsX + 60, yOffset + 40);

        // DT
        ctx.fillStyle = textColor;
        ctx.font = "bold 14px 'Inter', sans-serif";
        ctx.fillText(formatStat(dt), statsX, yOffset + 61);
        ctx.fillStyle = "#ffc107";
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText("DT", statsX + 60, yOffset + 63);

        // Class icon with percentage overlay
        const iconSize = 50;
        const iconX = 460;
        const iconY = yOffset + (playerRowHeight - iconSize) / 2;
        if (img) {
          ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
        }
        // Percentage overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(iconX, iconY + iconSize - 18, iconSize, 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${damagePercent}%`, iconX + iconSize / 2, iconY + iconSize - 8);

        // CRIT/LUCK/MAX column
        const extraX = 560;
        ctx.textAlign = "left";

        // CRIT
        ctx.fillStyle = subTextColor;
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText("CRIT ✸", extraX, yOffset + 20);
        ctx.fillStyle = textColor;
        ctx.font = "bold 13px 'Inter', sans-serif";
        ctx.fillText(`${crit}%`, extraX + 60, yOffset + 18);

        // LUCK
        ctx.fillStyle = subTextColor;
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText("LUCK ☘", extraX, yOffset + 43);
        ctx.fillStyle = textColor;
        ctx.font = "bold 13px 'Inter', sans-serif";
        ctx.fillText(`${lucky}%`, extraX + 60, yOffset + 41);

        // MAX
        ctx.fillStyle = subTextColor;
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText("MAX ⚔", extraX, yOffset + 66);
        ctx.fillStyle = textColor;
        ctx.font = "bold 13px 'Inter', sans-serif";
        ctx.fillText(formatStat(peak), extraX + 60, yOffset + 64);

        // Additional stats column (right side)
        const additionalX = 710;

        // GS
        ctx.fillStyle = subTextColor;
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText("GS", additionalX, yOffset + 20);
        ctx.fillStyle = textColor;
        ctx.font = "bold 13px 'Inter', sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(formatStat(gs), width - 30, yOffset + 18);

        // Total Damage
        ctx.textAlign = "left";
        ctx.fillStyle = subTextColor;
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText("🔥", additionalX, yOffset + 43);
        ctx.fillStyle = textColor;
        ctx.font = "bold 13px 'Inter', sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(formatStat(totalDamage), width - 30, yOffset + 41);

        // Total Healing
        ctx.textAlign = "left";
        ctx.fillStyle = subTextColor;
        ctx.font = "10px 'Inter', sans-serif";
        ctx.fillText("⛨", additionalX, yOffset + 66);
        ctx.fillStyle = "#28a745";
        ctx.font = "bold 13px 'Inter', sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(formatStat(totalHealing), width - 30, yOffset + 64);

        yOffset += playerRowHeight;
      });

      // Draw subtle verification badge watermark in center background
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.translate(width / 2, (headerHeight + yOffset) / 2);

      // Large shield icon
      ctx.font = "120px 'Inter', sans-serif";
      ctx.fillStyle = brandPrimary;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🛡️", 0, -20);

      // VERIFIED text
      ctx.font = "bold 30px 'Inter', sans-serif";
      ctx.fillText("VERIFIED", 0, 70);

      // Hash code
      ctx.font = "18px 'Courier New', monospace";
      ctx.fillText(shortHash, 0, 105);

      ctx.restore();

      // Draw semi-transparent watermarks across data
      ctx.save();
      ctx.globalAlpha = 0.015;
      ctx.font = "bold 80px 'Inter', sans-serif";
      ctx.fillStyle = brandPrimary;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.rotate(-Math.PI / 12);
      for (let i = 0; i < 3; i++) {
        ctx.fillText("BPSR TOOLS", width / 2, (height / 4) * (i + 1));
      }
      ctx.restore();

      // Draw footer with verification info
      ctx.fillStyle = textColor;
      ctx.font = "14px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Generated with BPSR Tools • Verification Code: " + shortHash, width / 2, height - 35);

      ctx.font = "11px 'Inter', sans-serif";
      ctx.fillStyle = subTextColor;
      ctx.fillText("This parse result contains cryptographic verification. Any modifications will invalidate the code.", width / 2, height - 15);

      // Prepare metadata for embedding
      const metadata = {
        hash: verificationHash,
        timestamp: timestamp,
        duration: parseDuration,
        players: parseData,
        version: "1.2.1"
      };

      // Convert canvas to data URL or blob depending on mode
      const fileTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      const filename = `bpsr-parse-${fileTimestamp}.png`;

      if (window.electronAPI && window.electronAPI.saveFileToDesktop) {
        // Electron mode - save to desktop
        const dataUrl = canvas.toDataURL("image/png");
        const dataUrlWithMetadata = injectPNGMetadata(dataUrl, metadata);
        const result = await window.electronAPI.saveFileToDesktop(filename, dataUrlWithMetadata);

        if (result.success) {
          console.log(`Parse results exported to Desktop: ${result.path}`);
          console.log(`Verification Code: ${shortHash}`);
          console.log(`Full Hash: ${verificationHash}`);
          console.log(`Metadata embedded in PNG`);
        } else {
          console.error(`Error saving to Desktop: ${result.error}`);
          // Fallback to download
          downloadCanvasAsBlob(canvas, filename, metadata);
        }
      } else {
        // Web mode - download as blob
        downloadCanvasAsBlob(canvas, filename, metadata);
        console.log(`Parse results exported to Downloads folder`);
        console.log(`Verification Code: ${shortHash}`);
        console.log(`Full Hash: ${verificationHash}`);
        console.log(`Metadata embedded in PNG`);
      }

      // Log verification data for manual checking
      console.log("Parse verification data:", {
        timestamp,
        duration: `${durationMinutes} minutes`,
        players: parseData.length,
        verificationCode: shortHash,
        fullHash: verificationHash,
        metadataEmbedded: true
      });

    } catch (error) {
      console.error("Error exporting parse to PNG:", error);
    }
  }

  async function endParse() {
    // Check if PNG export is enabled before pausing
    const exportCheckbox = document.getElementById("parse-export-checkbox");
    const shouldExport = exportCheckbox && exportCheckbox.checked;

    if (shouldExport) {
      // Export to PNG before pausing
      await exportParseToPNG();
    }

    // Pause tracking
    await fetch("/api/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: true })
    });

    // Clear state
    parseMode = "inactive";
    parseStartTime = null;
    parseEndTime = null;
    parseDuration = 0;

    if (parseCountdownInterval) {
      clearInterval(parseCountdownInterval);
      parseCountdownInterval = null;
    }

    parseButton.classList.remove("waiting", "active");
    parseButton.title = "Parse Mode";

    // Re-enable start button, slider, checkbox and reset text
    parseStartBtn.disabled = false;
    parseDurationSlider.disabled = false;
    if (parseSingleTargetCheckbox) parseSingleTargetCheckbox.disabled = false;
    parseStartBtn.textContent = "Start";

    // Reset icon
    const icon = parseButton.querySelector("i");
    if (icon) {
      icon.className = "fa-solid fa-crosshairs";
    }
  }

  // Monitor for player damage to start countdown
  setInterval(async () => {
    if (parseMode === "waiting") {
      try {
        const response = await fetch("/api/data");
        const userData = await response.json();

        // Get user array from userData.user object
        const userArray = Object.values(userData.user || {});

        // Check if local player has dealt damage
        if (userArray.length > 0) {
          // Find local player
          const playerData = userArray.find(user => user.isLocalPlayer === true);

          if (playerData && playerData.total_damage && playerData.total_damage.total > 0) {
            // If single target is enabled, detect the first monster damaged
            if (parseSingleTargetEnabled && !parseSingleTargetMonster) {
              // Find the monster with the most damage (likely the first one hit)
              if (playerData.targetDamage && playerData.targetDamage.length > 0) {
                const firstTarget = playerData.targetDamage.reduce((max, target) =>
                  target.damage > max.damage ? target : max
                , playerData.targetDamage[0]);

                parseSingleTargetMonster = {
                  monsterId: firstTarget.monsterId,
                  monsterName: firstTarget.monsterName
                };
                console.log("Single target detected:", parseSingleTargetMonster);
              }
            }

            startParseCountdown();
          }
        }
      } catch (error) {
        console.error("Error checking for player damage:", error);
      }
    }
  }, 500);

  // PNG Verification Feature
  const verifyDropZone = document.getElementById("verify-drop-zone");
  const verifyFileInput = document.getElementById("verify-file-input");
  const verifyResult = document.getElementById("verify-result");

  if (verifyDropZone && verifyFileInput && verifyResult) {
    // Click to select file
    verifyDropZone.addEventListener("click", () => {
      verifyFileInput.click();
    });

    // File selected via input
    verifyFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        verifyPNG(e.target.files[0]);
      }
    });

    // Drag and drop
    verifyDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      verifyDropZone.style.borderColor = "var(--brand-primary)";
      verifyDropZone.style.backgroundColor = "rgba(102, 126, 234, 0.05)";
    });

    verifyDropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      verifyDropZone.style.borderColor = "var(--border-default)";
      verifyDropZone.style.backgroundColor = "var(--surface-base)";
    });

    verifyDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      verifyDropZone.style.borderColor = "var(--border-default)";
      verifyDropZone.style.backgroundColor = "var(--surface-base)";

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        verifyPNG(e.dataTransfer.files[0]);
      }
    });

    async function verifyPNG(file) {
      if (!file.type === "image/png") {
        showVerifyResult(false, "Please select a PNG file");
        return;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Extract metadata from PNG tEXt chunk
        const metadata = extractPNGMetadata(bytes);

        if (!metadata) {
          showVerifyResult(false, "No verification metadata found in PNG. This file was not created by BPSR Tools or is from an older version.");
          return;
        }

        // Recalculate hash from metadata
        const dataString = JSON.stringify({
          timestamp: metadata.timestamp,
          duration: metadata.duration,
          players: metadata.players
        });
        const recalculatedHash = await generateHash(dataString);

        // Compare hashes
        if (recalculatedHash === metadata.hash) {
          showVerifyResult(true, `✅ Verified! This parse is authentic and unmodified.<br><br><strong>Verification Code:</strong> ${metadata.hash.substring(0, 16).toUpperCase()}<br><strong>Timestamp:</strong> ${new Date(metadata.timestamp).toLocaleString()}<br><strong>Duration:</strong> ${Math.floor(metadata.duration / 60)} minutes<br><strong>Players:</strong> ${metadata.players.length}`);
        } else {
          showVerifyResult(false, `❌ Verification Failed! This parse has been modified.<br><br><strong>Expected Hash:</strong> ${metadata.hash.substring(0, 16).toUpperCase()}<br><strong>Calculated Hash:</strong> ${recalculatedHash.substring(0, 16).toUpperCase()}`);
        }
      } catch (error) {
        console.error("Error verifying PNG:", error);
        showVerifyResult(false, "Error reading PNG file: " + error.message);
      }
    }

    function extractPNGMetadata(bytes) {
      console.log("Extracting metadata from PNG, size:", bytes.length, "bytes");
      // Look for tEXt chunk with keyword "BPSR-Verification"
      let pos = 8; // Skip PNG signature
      let chunksFound = [];

      while (pos <= bytes.length - 12) {
        // Read chunk length (big-endian)
        const length = (bytes[pos] << 24) | (bytes[pos+1] << 16) | (bytes[pos+2] << 8) | bytes[pos+3];

        // Read chunk type (type is at pos+4 to pos+7)
        const type = String.fromCharCode(bytes[pos+4], bytes[pos+5], bytes[pos+6], bytes[pos+7]);

        chunksFound.push(type);

        if (type === "tEXt") {
          console.log("Found tEXt chunk at position:", pos, "length:", length);
          // Read chunk data (starts at pos+8)
          const chunkData = bytes.slice(pos + 8, pos + 8 + length);

          // Find null separator
          let nullPos = -1;
          for (let i = 0; i < chunkData.length; i++) {
            if (chunkData[i] === 0) {
              nullPos = i;
              break;
            }
          }

          if (nullPos !== -1) {
            const keyword = String.fromCharCode(...chunkData.slice(0, nullPos));
            console.log("tEXt keyword:", keyword);
            if (keyword === "BPSR-Verification") {
              const jsonData = String.fromCharCode(...chunkData.slice(nullPos + 1));
              console.log("Found BPSR-Verification metadata!");
              return JSON.parse(jsonData);
            }
          }
        }

        // Stop at IEND
        if (type === "IEND") break;

        // Move to next chunk (skip length + type + data + CRC)
        pos += 4 + 4 + length + 4;

        // Safety check to prevent infinite loop
        if (pos > bytes.length) {
          console.error("Walked past end of PNG data while extracting");
          break;
        }
      }

      console.log("Chunks found in PNG:", chunksFound.join(", "));
      console.log("No BPSR-Verification metadata found");
      return null;
    }

    function showVerifyResult(success, message) {
      verifyResult.style.display = "block";
      verifyResult.style.padding = "12px";
      verifyResult.style.borderRadius = "6px";
      verifyResult.style.fontSize = "0.85rem";
      verifyResult.style.lineHeight = "1.5";

      if (success) {
        verifyResult.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
        verifyResult.style.border = "1px solid rgba(16, 185, 129, 0.3)";
        verifyResult.style.color = "#10b981";
      } else {
        verifyResult.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
        verifyResult.style.border = "1px solid rgba(239, 68, 68, 0.3)";
        verifyResult.style.color = "#ef4444";
      }

      verifyResult.innerHTML = message;
    }
  }
} else {
  console.error("Parse mode elements not found:", {
    parseButton,
    parsePanel
  });
}
