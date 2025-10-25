// Brand Colors
const colors = {
  primary: "#667eea",
  accent: "#764ba2",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
  cyan: "#06b6d4",
  white: "#ffffff",
  gray: "#9ca3af",
};

// Connect to Socket.IO
const socket = io();

// Google Sheets sync state
let sheetsConfigured = false;
let lastSyncTime = null;
let lastSyncResult = null;
let autoSyncInterval = null;
let isSyncing = false;
let nextSyncTime = null;
let countdownInterval = null;

// Check if Google Sheets is configured
async function checkSheetsConfigured() {
  try {
    const response = await fetch("/api/sheets-configured");
    const result = await response.json();
    if (result.code === 0) {
      sheetsConfigured = result.configured;
    }
  } catch (error) {
    console.error("[CLI] Error checking sheets config:", error);
    sheetsConfigured = false;
  }
}

// Sync to Google Sheets
async function syncToSheets() {
  if (!sheetsConfigured) {
    console.log("[CLI] Google Sheets not configured");
    return;
  }

  if (isSyncing) {
    console.log("[CLI] Sync already in progress");
    return;
  }

  isSyncing = true;
  console.log("[CLI] Syncing to Google Sheets...");

  try {
    const response = await fetch("/api/sync-sheets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (result.code === 0) {
      lastSyncTime = new Date();
      lastSyncResult = {
        total: result.synced || result.total || 0,
        new: result.new || 0,
        updated: result.updated || 0,
      };
      if (autoSyncInterval) {
        nextSyncTime = new Date(Date.now() + 60000); // 60 seconds from now
      }
      console.log(`[CLI] ✓ ${result.msg}`);
      updateDisplay();
    } else {
      console.error(`[CLI] ✗ Sync failed: ${result.msg}`);
    }
  } catch (error) {
    console.error(`[CLI] ✗ Sync error: ${error.message}`);
  } finally {
    isSyncing = false;
  }
}

// Start auto-sync (every 60 seconds)
function startAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }

  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  if (!sheetsConfigured) {
    return;
  }

  console.log("[CLI] Auto-sync enabled (every 60 seconds)");
  nextSyncTime = new Date(Date.now() + 60000); // First sync in 60 seconds

  // Update countdown every second
  countdownInterval = setInterval(() => {
    updateDisplay();
  }, 1000);

  autoSyncInterval = setInterval(() => {
    syncToSheets();
  }, 60000);
}

// Stop auto-sync
function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  nextSyncTime = null;
  console.log("[CLI] Auto-sync disabled");
}

// Get profession name from professionDetails (English only)
function getProfessionName(professionDetails) {
  if (!professionDetails) return "Unknown";
  return professionDetails.name_en || "Unknown";
}

// Get color for profession by role
function getProfessionColor(professionDetails) {
  if (!professionDetails || !professionDetails.role) {
    return colors.error; // Default to DPS color
  }

  const role = professionDetails.role.toLowerCase();

  if (role === "tank") {
    return colors.cyan;
  }
  if (role === "healer") {
    return colors.success;
  }
  return colors.error; // DPS
}

// Format large numbers
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + "K";
  }
  return num.toFixed(2);
}

// Format duration (seconds to MM:SS)
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Format time since last sync
function formatTimeSince(date) {
  if (!date) return "Never";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins}m ago`;
  } else {
    return date.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit" });
  }
}

// Format countdown to next sync
function formatCountdown() {
  if (!nextSyncTime) return "";

  const seconds = Math.floor((nextSyncTime.getTime() - Date.now()) / 1000);

  if (seconds <= 0) {
    return "Syncing...";
  } else {
    return `Next sync in: ${seconds}s`;
  }
}

// Render proper HTML table
function renderTable(data) {
  if (!data || !data.user || Object.keys(data.user).length === 0) {
    return `<div style="color: ${colors.gray}; padding: 20px;">
      Waiting for combat data...
    </div>`;
  }

  const userData = data.user;
  const duration = data.data?.duration || 0;
  const durationStr = formatDuration(duration);

  // Convert to array and filter/sort by damage
  let userArray = Object.values(userData);
  userArray = userArray.filter((u) => u.total_damage && u.total_damage.total > 0);
  userArray.sort((a, b) => (b.total_damage?.total || 0) - (a.total_damage?.total || 0));

  if (userArray.length === 0) {
    return `<div style="color: ${colors.gray}; padding: 20px;">
      Waiting for combat data...
    </div>`;
  }

  let output = `<div style="padding: 20px; font-family: 'Courier New', monospace;">`;
  output += `<div style="color: ${colors.primary}; font-weight: bold; font-size: 1.2em; margin-bottom: 10px;">BPSR Tools - CLI Mode</div>`;
  output += `<div style="color: ${colors.gray}; margin-bottom: 15px;">Duration: ${durationStr} | Players: ${userArray.length}</div>`;

  output += `<table style="width: 100%; border-collapse: collapse; background: rgba(0,0,0,0.3); border: 2px solid ${colors.primary};">`;

  // Header
  output += `<thead><tr style="border-bottom: 2px solid ${colors.primary};">`;
  output += `<th style="padding: 10px; text-align: center; color: ${colors.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">#</th>`;
  output += `<th style="padding: 10px; text-align: left; color: ${colors.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">Name</th>`;
  output += `<th style="padding: 10px; text-align: left; color: ${colors.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">Class</th>`;
  output += `<th style="padding: 10px; text-align: right; color: ${colors.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">DMG</th>`;
  output += `<th style="padding: 10px; text-align: right; color: ${colors.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">DPS</th>`;
  output += `<th style="padding: 10px; text-align: right; color: ${colors.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">HPS</th>`;
  output += `<th style="padding: 10px; text-align: right; color: ${colors.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">DT</th>`;
  output += `<th style="padding: 10px; text-align: right; color: ${colors.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">Crit%</th>`;
  output += `<th style="padding: 10px; text-align: right; color: ${colors.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">Lucky%</th>`;
  output += `<th style="padding: 10px; text-align: right; color: ${colors.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">Max</th>`;
  output += `<th style="padding: 10px; text-align: right; color: ${colors.primary}; font-weight: bold;">GS</th>`;
  output += `</tr></thead>`;

  // Body
  output += `<tbody>`;
  userArray.forEach((user, index) => {
    const rank = index + 1;
    const name = user.name || "Unknown";
    const profession = getProfessionName(user.professionDetails);
    const profColor = getProfessionColor(user.professionDetails);
    const damage = formatNumber(user.total_damage?.total || 0);
    const dps = formatNumber(user.total_dps || 0);
    const hps = formatNumber(user.total_hps || 0);
    const dt = formatNumber(user.taken_damage || 0);
    const critPct = user.total_damage?.hitCount > 0
      ? ((user.total_damage.critHitCount / user.total_damage.hitCount) * 100).toFixed(1)
      : "0.0";
    const luckyPct = user.total_damage?.hitCount > 0
      ? ((user.total_damage.luckHitCount / user.total_damage.hitCount) * 100).toFixed(1)
      : "0.0";
    const maxHit = formatNumber(user.total_damage?.maxHit || 0);
    const gear = user.fightPoint || 0;

    const rowBg = index % 2 === 0 ? "rgba(255,255,255,0.05)" : "transparent";
    output += `<tr style="background: ${rowBg}; border-bottom: 1px solid rgba(255,255,255,0.1);">`;
    output += `<td style="padding: 10px; text-align: center; color: ${colors.warning}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.1);">${rank}</td>`;
    output += `<td style="padding: 10px; text-align: left; color: ${colors.white}; border-right: 1px solid rgba(255,255,255,0.1);">${name}</td>`;
    output += `<td style="padding: 10px; text-align: left; color: ${profColor}; border-right: 1px solid rgba(255,255,255,0.1);">${profession}</td>`;
    output += `<td style="padding: 10px; text-align: right; color: ${colors.error}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.1);">${damage}</td>`;
    output += `<td style="padding: 10px; text-align: right; color: ${colors.error}; border-right: 1px solid rgba(255,255,255,0.1);">${dps}</td>`;
    output += `<td style="padding: 10px; text-align: right; color: ${colors.success}; border-right: 1px solid rgba(255,255,255,0.1);">${hps}</td>`;
    output += `<td style="padding: 10px; text-align: right; color: ${colors.warning}; border-right: 1px solid rgba(255,255,255,0.1);">${dt}</td>`;
    output += `<td style="padding: 10px; text-align: right; color: ${colors.cyan}; border-right: 1px solid rgba(255,255,255,0.1);">${critPct}%</td>`;
    output += `<td style="padding: 10px; text-align: right; color: ${colors.info}; border-right: 1px solid rgba(255,255,255,0.1);">${luckyPct}%</td>`;
    output += `<td style="padding: 10px; text-align: right; color: ${colors.primary}; border-right: 1px solid rgba(255,255,255,0.1);">${maxHit}</td>`;
    output += `<td style="padding: 10px; text-align: right; color: ${colors.white};">${gear}</td>`;
    output += `</tr>`;
  });
  output += `</tbody></table>`;

  // Footer
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour12: true });
  output += `<div style="margin-top: 15px; color: ${colors.gray};">Last Update: ${timeStr}</div>`;

  // Sync status (if sheets configured)
  if (sheetsConfigured) {
    const lastSyncStr = formatTimeSince(lastSyncTime);
    output += `<div style="color: ${colors.gray};">Last Sync: ${lastSyncStr}`;

    if (lastSyncResult) {
      output += ` - <span style="color: ${colors.success};">${lastSyncResult.total} players</span>`;
      output += ` (<span style="color: ${colors.info};">${lastSyncResult.new} new</span>`;
      output += `, <span style="color: ${colors.warning};">${lastSyncResult.updated} updated</span>)`;
    }

    if (autoSyncInterval && nextSyncTime) {
      const countdownStr = formatCountdown();
      output += ` | <span style="color: ${colors.info};">${countdownStr}</span>`;
    }

    output += `</div>`;
  }

  // Controls
  output += `<div style="margin-top: 10px; color: ${colors.gray};">`;
  if (sheetsConfigured) {
    output += `<span style="color: ${colors.primary};">[A]</span>uto-sync | <span style="color: ${colors.primary};">[S]</span>Sync | `;
  }
  output += `<span style="color: ${colors.primary};">[C]</span>lear | `;
  output += `<span style="color: ${colors.primary};">Ctrl+C</span> Exit</div>`;

  output += `</div>`;

  return output;
}

// Fetch and update display
async function updateDisplay() {
  try {
    const response = await fetch("/api/data");
    const result = await response.json();
    if (result.code === 0) {
      const terminal = document.getElementById("terminal");
      terminal.innerHTML = renderTable(result);
    }
  } catch (error) {
    console.error("[CLI] Error fetching data:", error);
  }
}

// Handle keyboard input
function handleKeypress(key) {
  if (key === "c") {
    fetch("/api/clear")
      .then(() => {
        updateDisplay();
      })
      .catch((err) => console.error("[CLI] Error clearing:", err));
  } else if (key === "s") {
    if (sheetsConfigured) {
      syncToSheets();
    }
  } else if (key === "a") {
    if (sheetsConfigured) {
      if (autoSyncInterval) {
        stopAutoSync();
      } else {
        startAutoSync();
      }
      updateDisplay();
    }
  }
}

// Initialize
async function init() {
  await checkSheetsConfigured();

  updateDisplay();
  setInterval(updateDisplay, 500);

  socket.on("data-update", () => {
    updateDisplay();
  });
}

// Setup keyboard event handlers
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (e.ctrlKey && key === "c") {
    e.preventDefault();
    window.close();
    return;
  }

  if (!e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    handleKeypress(key);
  }
});

// Cleanup on window unload
window.addEventListener("beforeunload", () => {
  stopAutoSync();
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
