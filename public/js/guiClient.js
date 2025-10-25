// Global state for Lite mode
let isLiteMode = false;
let liteModeType = "dps"; // 'dps' or 'healer'

console.log("main.js loaded successfully");

// Professions are now included in /api/data response
// Each user has: professionDetails object containing {id, name_cn, name_en, icon, role, created_at}

let lastTotalDamage = 0;
let lastDamageChangeTime = Date.now();
let currentZoom = 1.0; // Initial zoom factor
let syncTimerInterval;
let syncCountdown = 0;
const SYNC_RESET_TIME = 80; // Seconds for automatic reset
let syncTimerDisplayTimeout; // For the 200ms delay
let logPreviewTimeout; // Declare logPreviewTimeout here
let lastRenderedData = null; // Store last rendered data to prevent unnecessary re-renders

const dpsTimerDiv = document.getElementById("dps-timer");
const playerBarsContainer = document.getElementById("player-bars-container");
const syncButton = document.getElementById("sync-button");
const syncIcon = document.querySelector("#sync-button .sync-icon");
const syncTimerSpan = document.querySelector("#sync-button .sync-timer");
const logsSection = document.getElementById("logs-section"); // Declare logsSection here
const loadingIndicator = document.getElementById("loading-indicator"); // Loading indicator

document.addEventListener("DOMContentLoaded", () => {
  // Theme Management
  const themeToggleBtn = document.getElementById("theme-toggle-button");
  const rootElement = document.documentElement;

  // Load saved theme or default to light
  const savedTheme = localStorage.getItem("theme") || "light";
  rootElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);

  function updateThemeIcon(theme) {
    if (themeToggleBtn) {
      const icon = themeToggleBtn.querySelector("i");
      if (icon) {
        icon.className =
          theme === "light" ? "fa-solid fa-moon" : "fa-solid fa-sun";
      }
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = rootElement.getAttribute("data-theme") || "light";
      const newTheme = currentTheme === "light" ? "dark" : "light";
      rootElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      updateThemeIcon(newTheme);
    });
  }

  // Hide Electron-only buttons when running in web mode
  if (!window.electronAPI) {
    const electronOnlyButtons = ["close-button"];
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

  const resetButton = document.getElementById("reset-button");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      resetDpsMeter();
    });
  }

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

  const zoomInButton = document.getElementById("zoom-in-button");
  const zoomOutButton = document.getElementById("zoom-out-button");

  if (zoomInButton) {
    zoomInButton.addEventListener("click", () => {
      currentZoom = Math.min(2.0, currentZoom + 0.1); // Limit maximum zoom to 2.0
      applyZoom();
    });
  }

  if (zoomOutButton) {
    zoomOutButton.addEventListener("click", () => {
      currentZoom = Math.max(0.5, currentZoom - 0.1); // Limit minimum zoom to 0.5
      applyZoom();
    });
  }

  // Sync button is now just a visual indicator, no click handler

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

function applyZoom() {
  const dpsMeter = document.querySelector(".bpsr-tools");
  if (dpsMeter) {
    dpsMeter.style.transform = `scale(${currentZoom})`;
    dpsMeter.style.transformOrigin = "top left";
    updateWindowSize(); // Redimensionar la ventana al aplicar zoom
  }
}

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

  // Calculate total height unscaled, including header, margins, and shadow space
  const shadowSpace = 24; // Box-shadow blur radius (0 0 24px)
  const totalContentHeightUnscaled =
    headerHeight +
    marginTop +
    borderWidth +
    barsHeight +
    bprsToolsMargin +
    shadowSpace +
    20; // Include shadow space + buffer

  // Apply current zoom to window width and height
  const finalWidth = Math.round(baseWidth * currentZoom);
  const finalHeight = Math.round(totalContentHeightUnscaled * currentZoom);

  window.electronAPI.resizeWindow(finalWidth, finalHeight);
}

function resetDpsMeter() {
  fetch("/api/clear");
  dpsTimerDiv.style.display = "none";
  dpsTimerDiv.innerText = "";
  console.log("Meter Restarted");
  lastTotalDamage = 0;
  lastDamageChangeTime = Date.now();
  stopSyncTimer(); // Stop sync timer on reset
}

// The syncData function is no longer called by click, but kept in case used internally
async function syncData() {
  // Don't modify visual state here, managed in updateSyncButtonState
  try {
    await fetch("/api/sync", { method: "POST" });
    console.log("Data synced internally.");
  } catch (error) {
    console.error("Error syncing data:", error);
  }
}

// Function to update the sync indicator visual state
function updateSyncButtonState() {
  clearTimeout(syncTimerDisplayTimeout); // Clear any pending timeout

  if (syncTimerInterval) {
    // If timer is active (countdown running)
    if (syncCountdown <= 60) {
      // Show timer, hide icon
      syncIcon.style.display = "none";
      syncIcon.classList.remove("spinning");
      syncTimerSpan.innerText = `${syncCountdown}s`;
      syncTimerSpan.style.display = "block";
    } else {
      // Show spinning icon, hide timer
      syncIcon.style.display = "block";
      syncIcon.classList.add("spinning"); // Ensures continuous spinning
      syncTimerSpan.style.display = "none";
    }
  } else {
    // If timer is not active (no countdown)
    // Show spinning icon, hide timer
    syncIcon.style.display = "block";
    syncIcon.classList.add("spinning"); // Ensures continuous spinning
    syncTimerSpan.style.display = "none";
    syncTimerSpan.innerText = "";
  }
}

function startSyncTimer() {
  if (syncTimerInterval) return; // Prevent multiple timers
  syncCountdown = SYNC_RESET_TIME;
  updateSyncButtonState(); // Set initial state

  syncTimerInterval = setInterval(() => {
    syncCountdown--;
    updateSyncButtonState(); // Update state on each tick

    if (syncCountdown <= 0) {
      stopSyncTimer();
      resetDpsMeter();
    }
  }, 1000);
}

function stopSyncTimer() {
  clearInterval(syncTimerInterval);
  syncTimerInterval = null;
  clearTimeout(syncTimerDisplayTimeout); // Clear timeout if exists
  updateSyncButtonState(); // Reset indicator state
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
  logPreview.innerHTML = `<div class=\"player-bar\" style=\"margin-top:10px;\">\n            <div class=\"progress-fill\" style=\"width: 100%; background: #444b5a;\"></div>\n            <div class=\"bar-content\">\n                <div class=\"player-info\">\n                    <span class=\"player-name\">${log.nombre}</span>\n                    <span class=\"player-id\">ID: ${log.id}</span>\n                </div>\n                <div class=\"player-performance\">\n                    <div class=\"stats-list\">\n                        <span class=\"main-stat\">DPS ${formatStat(log.dps)}</span>\n                        <span class=\"secondary-stat\">HPS ${formatStat(log.hps)}</span>\n                        <span class=\"secondary-stat\">DTPS ${formatStat(log.dtps)}</span>\n                    </div>\n                    <img class=\"class-icon\" src=\"icons/${log.icon}\" alt=\"icon\">\n                </div>\n            </div>\n        </div>`;
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
    const [dataRes, dictRes, settingsRes] = await Promise.all([
      fetch("/api/data"),
      fetch("/api/dictionary"),
      fetch("/api/settings"),
    ]);
    const userData = await dataRes.json();
    const dictionaryData = await dictRes.json();
    const currentGlobalSettings = await settingsRes.json();

    let userArray = Object.values(userData.user);

    // Debug: Log first user's profession data
    if (userArray.length > 0) {
      console.log('[GUI Debug] Sample user data:', {
        name: userArray[0].name,
        professionDetails: userArray[0].professionDetails
      });
    }
    userArray = userArray.filter(
      (u) => u.total_damage && u.total_damage.total > 0,
    );

    if (!userArray || userArray.length === 0) {
      loadingIndicator.style.display = "flex"; // Show loading indicator
      playerBarsContainer.style.display = "none"; // Hide player bars container
      lastRenderedData = null; // Reset signature when no data
      updateSyncButtonState();
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

    if (sumaTotalDamage > 0) {
      if (sumaTotalDamage !== lastTotalDamage) {
        lastTotalDamage = sumaTotalDamage;
        lastDamageChangeTime = Date.now();
        stopSyncTimer();
      } else {
        if (Date.now() - lastDamageChangeTime > SYNC_RESET_TIME * 1000) {
          resetDpsMeter();
          return;
        }
        if (!syncTimerInterval) {
          startSyncTimer();
        }
      }
    } else {
      lastTotalDamage = 0;
      lastDamageChangeTime = Date.now();
      stopSyncTimer();
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
  } finally {
    updateSyncButtonState();
    updateWindowSize();
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
    if (iconEl) iconEl.src = `icons/${professionIcon}`;
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
    if (classIcon) classIcon.src = `icons/${professionIcon}`;

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
                            <i class="fa-solid fa-scroll"></i>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <img class="lite-bar-icon" src="icons/${professionIcon}" alt="icon" style="margin-left:2px; margin-right:5px;" />
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
                            <i class="fa-solid fa-scroll"></i>
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
                            <img class="class-icon" src="icons/${professionIcon}" alt="icon" style="height: 42px; width: 42px;">
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
          alert("No UID found for this player");
          return;
        }

        try {
          const response = await fetch(`/api/skill/${uid}`);
          const result = await response.json();

          if (result.code === 0 && result.data) {
            // Display skill data
            displaySkillData(result.data, uid);
          } else {
            console.error("Failed to load skill data:", result.msg);
            alert("Skill data not available for this player");
          }
        } catch (error) {
          console.error("Error fetching skill data:", error);
          alert("Error loading skill data: " + error.message);
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

function displaySkillData(data, uid) {
  if (!data || !data.skills) {
    alert("No skill data available for this player");
    return;
  }

  const playerName = data.name || `Player ${uid}`;
  const profession = data.professionDetails?.name_en || "Unknown";

  // Open modal
  openSkillModal(playerName, profession, data.skills);
}

function openSkillModal(playerName, profession, skills) {
  const modal = document.getElementById("skill-modal");
  const modalTitle = document.getElementById("modal-player-name");
  const modalBody = document.getElementById("modal-skill-items");

  if (!modal || !modalTitle || !modalBody) {
    console.error("Modal elements not found");
    return;
  }

  // Set modal title
  modalTitle.textContent = `${playerName} - ${profession}`;

  // Convert skills object to array and sort by total damage/healing
  const skillsArray = Object.entries(skills).map(([skillId, skillInfo]) => ({
    skillId,
    ...skillInfo,
  }));

  skillsArray.sort((a, b) => (b.totalDamage || 0) - (a.totalDamage || 0));

  // Build HTML for skills
  let html = "";

  if (skillsArray.length === 0) {
    html =
      '<div style="text-align:center; padding:40px 20px; color: var(--text-secondary); font-size: 1rem;">No skills recorded yet</div>';
  } else {
    skillsArray.forEach((skill, index) => {
      if (index < 30) {
        // Show top 30 skills in modal
        const skillClass =
          skill.type === "damage" ? "damage-skill" : "healing-skill";
        const icon = skill.type === "damage" ? "⚔️" : "💚";

        html += `
                        <div class="skill-item ${skillClass}">
                            <div class="skill-item-name">
                                <span class="skill-item-icon">${icon}</span>
                                <span>${skill.displayName}</span>
                            </div>
                            <div class="skill-item-stats">
                                <div class="skill-stat">
                                    <span class="skill-stat-label">Total</span>
                                    <span class="skill-stat-value">${formatStat(skill.totalDamage)}</span>
                                </div>
                                <div class="skill-stat">
                                    <span class="skill-stat-label">Hits</span>
                                    <span class="skill-stat-value">${skill.totalCount}</span>
                                </div>
                                ${
                                  skill.critCount > 0
                                    ? `
                                <div class="skill-stat">
                                    <span class="skill-stat-label">Crit</span>
                                    <span class="skill-stat-value">${Math.round(skill.critRate * 100)}%</span>
                                </div>
                                `
                                    : ""
                                }
                            </div>
                        </div>
                    `;
      }
    });

    if (skillsArray.length > 30) {
      html += `<div style="text-align:center; padding:12px 0; color: var(--text-secondary); font-size:0.85rem;">... and ${skillsArray.length - 30} more skills</div>`;
    }
  }

  modalBody.innerHTML = html;

  // Show modal
  modal.classList.add("active");
}

function closeSkillModal() {
  const modal = document.getElementById("skill-modal");
  if (modal) {
    modal.classList.remove("active");
  }
}

// Expose updateWindowSize to window for inline onclick handlers
window.updateWindowSize = updateWindowSize;

// Update UI every 50ms (fast updates with smart DOM preservation)
setInterval(fetchDataAndRender, 50);
fetchDataAndRender();
updateLogsUI();

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
