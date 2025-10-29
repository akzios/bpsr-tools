// Skill Analysis Client - Detailed view with charts
// This runs in the skill analysis window

let currentData = null;
let currentCharts = {
  dpsGraph: null,
  skillDistribution: null,
  damageDistribution: null,
};

// DPS history tracking (60 data points for 60 seconds)
let dpsHistory = {
  labels: [],
  dpsValues: [],
  hpsValues: [],
  maxPoints: 60,
};

// Initialize with zeros and labels showing every 5 seconds
for (let i = 0; i < 60; i++) {
  // Show labels every 5 seconds, otherwise empty string
  dpsHistory.labels.push(i % 5 === 0 ? `${i}s` : "");
  dpsHistory.dpsValues.push(0);
  dpsHistory.hpsValues.push(0);
}

// Get UID from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const playerUid = urlParams.get("uid");

// Format large numbers with K/M suffix
function formatStat(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return (value / 1000).toFixed(1) + "K";
  return Math.round(value).toString();
}

// Load player skill data
async function loadSkillData() {
  if (!playerUid) {
    console.error("No player UID provided");
    return;
  }

  try {
    const response = await fetch(`/api/skill/${playerUid}`);
    const result = await response.json();

    if (result.code === 0 && result.data) {
      currentData = result.data;
      renderSkillAnalysis(result.data);
    } else {
      console.error("Failed to load skill data:", result.msg);
    }
  } catch (error) {
    console.error("Error fetching skill data:", error);
  }
}

// Main render function
function renderSkillAnalysis(data) {
  const skills = data.skills;
  const playerName = data.name || `Player ${data.uid}`;
  const profession = data.professionDetails?.name_en || "Unknown";
  const professionIcon = data.professionDetails?.icon || "icon.png";

  // Update page title with GS
  const gearScore = data.attr?.fight_point || 0;
  document.getElementById("page-title").textContent =
    `${playerName} - ${profession} (${formatStat(gearScore)})`;

  // Set class icon in header
  const classIconElement = document.getElementById("class-icon");
  if (classIconElement) {
    classIconElement.src = `assets/images/icons/${professionIcon}`;
    classIconElement.alt = profession;
  }

  // Convert skills to array
  const skillsArray = Object.entries(skills).map(([skillId, skillInfo]) => ({
    skillId,
    ...skillInfo,
  }));

  // Calculate summary statistics
  const summary = calculateSummaryStats(skillsArray, data);

  // Populate summary cards
  populateSummaryCards(summary);

  // Build skills table - pass duration for DPS calculation
  buildSkillsTable(skillsArray, summary.totalDamage, summary.duration);

  // Build monster damage table
  buildMonsterDamageTable(data.targetDamage || [], summary.totalDamage);

  // Initialize charts
  initializeCharts(skillsArray, summary);
}

function calculateSummaryStats(skillsArray, data) {
  let totalDamage = 0;
  let totalHits = 0;
  let totalCritHits = 0;
  let totalLuckyHits = 0;
  let totalNormalHits = 0;
  let normalDamage = 0;
  let critDamage = 0;
  let luckyDamage = 0;
  let hitsTaken = data.attr?.hits_taken || 0;

  skillsArray.forEach((skill) => {
    totalDamage += skill.totalDamage || 0;
    totalHits += skill.totalCount || 0;
    totalCritHits += skill.critCount || 0;
    totalLuckyHits += skill.luckyCount || 0;

    // Calculate normal hits (total - crit - lucky + crit_lucky overlap)
    const breakdown = skill.countBreakdown || {};
    totalNormalHits += breakdown.normal || 0;

    // Damage breakdown
    const damageBreakdown = skill.damageBreakdown || {};
    normalDamage += damageBreakdown.normal || 0;
    critDamage += damageBreakdown.critical || 0;
    luckyDamage += damageBreakdown.lucky || 0;
  });

  const critRate = totalHits > 0 ? totalCritHits / totalHits : 0;
  const luckyRate = totalHits > 0 ? totalLuckyHits / totalHits : 0;
  const avgPerHit = totalHits > 0 ? totalDamage / totalHits : 0;

  // DPS calculation (if we have duration data)
  const duration = data.attr?.combat_duration || 1; // Default to 1 second if not available
  const dps = totalDamage / duration;

  console.log(
    "Combat duration:",
    duration,
    "Total damage:",
    totalDamage,
    "Calculated DPS:",
    dps,
  );

  return {
    totalDamage,
    totalHits,
    totalCritHits,
    totalLuckyHits,
    totalNormalHits,
    normalDamage,
    critDamage,
    luckyDamage,
    critRate,
    luckyRate,
    avgPerHit,
    dps,
    hitsTaken,
    duration, // Return duration for per-skill DPS calculation
  };
}

function populateSummaryCards(summary) {
  // First card
  document.getElementById("summary-total-dmg").textContent = formatStat(
    summary.totalDamage,
  );
  document.getElementById("summary-crit").textContent =
    Math.round(summary.critRate * 100) + "%";
  document.getElementById("summary-dps").textContent = formatStat(summary.dps);
  document.getElementById("summary-lucky").textContent =
    Math.round(summary.luckyRate * 100) + "%";
  document.getElementById("summary-hits").textContent = formatStat(
    summary.totalHits,
  );
  document.getElementById("summary-crit-rate").textContent = formatStat(
    summary.totalCritHits,
  );

  // Second card
  document.getElementById("summary-normal").textContent = formatStat(
    summary.normalDamage,
  );
  document.getElementById("summary-lucky-hits").textContent = formatStat(
    summary.luckyDamage,
  );
  document.getElementById("summary-crit-hits").textContent = formatStat(
    summary.critDamage,
  );
  document.getElementById("summary-avg").textContent = formatStat(
    summary.avgPerHit,
  );
  document.getElementById("summary-lucky-count").textContent = formatStat(
    summary.totalLuckyHits,
  );
  document.getElementById("summary-hits-taken").textContent = formatStat(
    summary.hitsTaken,
  );
}

function buildSkillsTable(
  skillsArray,
  totalDamage,
  duration = 1,
  skipSort = false,
) {
  const tbody = document.getElementById("skill-items");

  if (!tbody) {
    console.error("Skills table body not found");
    return;
  }

  console.log("Building skills table with duration:", duration);

  // Sort by damage by default (only if not already sorted)
  if (!skipSort) {
    skillsArray.sort((a, b) => (b.totalDamage || 0) - (a.totalDamage || 0));
  }

  let html = "";

  if (skillsArray.length === 0) {
    html =
      '<tr><td colspan="7" style="text-align:center; padding:40px 20px; color: #9ca3af;">No skills recorded yet</td></tr>';
  } else {
    skillsArray.forEach((skill, index) => {
      const damagePercent =
        totalDamage > 0
          ? ((skill.totalDamage / totalDamage) * 100).toFixed(1)
          : 0;
      const avgPerHit =
        skill.totalCount > 0 ? skill.totalDamage / skill.totalCount : 0;

      // Calculate actual DPS/HPS (damage/healing per second)
      const dpsHps = duration > 0 ? skill.totalDamage / duration : 0;

      if (index === 0) {
        console.log(
          "First skill example:",
          skill.displayName,
          "Total:",
          skill.totalDamage,
          "Duration:",
          duration,
          "DPS/HPS:",
          dpsHps,
        );
      }

      // Add emoji icon based on skill type
      const skillIcon = skill.type === "healing" ? "💚 " : "⚔️ ";

      html += `
        <tr>
          <td>${skillIcon}${skill.displayName}</td>
          <td>${formatStat(skill.totalDamage)}</td>
          <td>${formatStat(dpsHps)}</td>
          <td>${formatStat(skill.totalCount)}</td>
          <td>${Math.round((skill.critRate || 0) * 100)}%</td>
          <td>${formatStat(avgPerHit)}</td>
          <td>${damagePercent}%</td>
        </tr>
      `;
    });
  }

  tbody.innerHTML = html;
}

function buildMonsterDamageTable(targetDamageArray, totalDamage) {
  const tbody = document.getElementById("monster-damage-items");

  if (!tbody) {
    console.error("Monster damage table body not found");
    return;
  }

  if (!targetDamageArray || targetDamageArray.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No target damage data</td></tr>';
    cachedMonsterData = [];
    return;
  }

  // Filter out unknown monsters (ones with "Unknown" in the name)
  const filteredData = targetDamageArray.filter(
    (target) => !target.monsterName.includes("Unknown"),
  );

  if (filteredData.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No target damage data</td></tr>';
    cachedMonsterData = [];
    return;
  }

  // Cache the filtered data for sorting
  cachedMonsterData = filteredData;

  // Apply current sort
  sortAndRenderMonsterTable();
  updateMonsterSortIndicators();
}

// Monster table sorting
let currentMonsterSort = { column: "damage", ascending: false };
let cachedMonsterData = [];

function setupMonsterTableSort() {
  const tableHeaders = document.querySelectorAll(
    "#monster-damage-table th[data-sort-monster]",
  );

  tableHeaders.forEach((header) => {
    header.style.cursor = "pointer";
    header.addEventListener("click", () => {
      const column = header.getAttribute("data-sort-monster");

      // Toggle sort direction if clicking same column
      if (currentMonsterSort.column === column) {
        currentMonsterSort.ascending = !currentMonsterSort.ascending;
      } else {
        currentMonsterSort.column = column;
        currentMonsterSort.ascending = false; // Default to descending for new column
      }

      sortAndRenderMonsterTable();
      updateMonsterSortIndicators();
    });
  });
}

function sortAndRenderMonsterTable() {
  if (cachedMonsterData.length === 0) return;

  const sorted = [...cachedMonsterData].sort((a, b) => {
    let aVal, bVal;

    switch (currentMonsterSort.column) {
      case "name":
        aVal = a.monsterName.toLowerCase();
        bVal = b.monsterName.toLowerCase();
        break;
      case "type":
        aVal = a.monsterType || -1;
        bVal = b.monsterType || -1;
        break;
      case "classification":
        aVal = a.classification || "";
        bVal = b.classification || "";
        break;
      case "damage":
        aVal = a.damage;
        bVal = b.damage;
        break;
      case "percent":
        const totalDamage = cachedMonsterData.reduce(
          (sum, t) => sum + t.damage,
          0,
        );
        aVal = totalDamage > 0 ? (a.damage / totalDamage) * 100 : 0;
        bVal = totalDamage > 0 ? (b.damage / totalDamage) * 100 : 0;
        break;
      default:
        return 0;
    }

    if (typeof aVal === "string") {
      return currentMonsterSort.ascending
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    } else {
      return currentMonsterSort.ascending ? aVal - bVal : bVal - aVal;
    }
  });

  const totalDamage = cachedMonsterData.reduce((sum, t) => sum + t.damage, 0);
  renderMonsterTableRows(sorted, totalDamage);
}

function renderMonsterTableRows(targetDamageArray, totalDamage) {
  const tbody = document.getElementById("monster-damage-items");
  if (!tbody) return;

  let html = "";
  targetDamageArray.forEach((target) => {
    const damagePercent =
      totalDamage > 0 ? (target.damage / totalDamage) * 100 : 0;

    const typeColor =
      target.monsterType === 2
        ? "#ff6b6b"
        : target.monsterType === 1
          ? "#a0a0a0"
          : "#4dabf7";
    const typeLabel = target.monsterTypeLabel || "Unknown";

    const classification = target.classification || "-";
    const classificationColor = classification.includes("Boss")
      ? "#e03131"
      : classification === "Elite"
        ? "#fd7e14"
        : classification === "Normal monster"
          ? "#20c997"
          : "var(--text-secondary)";

    html += `
      <tr>
        <td style="font-weight: 500;">${target.monsterName}</td>
        <td><span style="color: ${typeColor}; font-weight: 500;">${typeLabel}</span></td>
        <td><span style="color: ${classificationColor}; font-weight: 500;">${classification}</span></td>
        <td>${formatStat(target.damage)}</td>
        <td>${damagePercent.toFixed(1)}%</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function updateMonsterSortIndicators() {
  const tableHeaders = document.querySelectorAll(
    "#monster-damage-table th[data-sort-monster]",
  );
  tableHeaders.forEach((header) => {
    const headerText = header.textContent.replace(" ▲", "").replace(" ▼", "");

    if (
      header.getAttribute("data-sort-monster") === currentMonsterSort.column
    ) {
      header.textContent =
        headerText + (currentMonsterSort.ascending ? " ▲" : " ▼");
    } else {
      header.textContent = headerText;
    }
  });
}

function initializeCharts(skillsArray, summary) {
  // Destroy existing charts if they exist
  if (currentCharts.dpsGraph) currentCharts.dpsGraph.destroy();
  if (currentCharts.skillDistribution)
    currentCharts.skillDistribution.destroy();
  if (currentCharts.damageDistribution)
    currentCharts.damageDistribution.destroy();

  // Get theme-aware colors
  const isLight = document.body.classList.contains("light-theme");
  const textColor = isLight ? "#1f2937" : "#e0e0e0";
  const gridColor = isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)";

  // DPS/HPS Real-time Graph (Line Chart)
  const dpsGraphCanvas = document.getElementById("dps-graph-chart");
  if (dpsGraphCanvas) {
    currentCharts.dpsGraph = new Chart(dpsGraphCanvas, {
      type: "line",
      data: {
        labels: dpsHistory.labels,
        datasets: [
          {
            label: "DPS",
            data: dpsHistory.dpsValues,
            borderColor: "#667eea",
            backgroundColor: "rgba(102, 126, 234, 0.1)",
            tension: 0.4,
            fill: true,
            pointRadius: 0,
          },
          {
            label: "HPS",
            data: dpsHistory.hpsValues,
            borderColor: "#28a745",
            backgroundColor: "rgba(40, 167, 69, 0.1)",
            tension: 0.4,
            fill: true,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0, // Disable animation for smoother real-time updates
        },
        plugins: {
          legend: {
            display: true,
            labels: { color: textColor },
            position: "bottom",
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return `${context.dataset.label}: ${formatStat(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: textColor,
              autoSkip: false, // Show all our manually set labels
            },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: textColor,
              callback: function (value) {
                return formatStat(value);
              },
            },
            grid: { display: false },
            beginAtZero: true,
          },
        },
      },
    });
  }

  // Skill Distribution (Pie Chart)
  const skillDistCanvas = document.getElementById("skill-distribution-chart");
  if (skillDistCanvas) {
    // Top 5 skills by damage
    const topSkills = [...skillsArray]
      .sort((a, b) => (b.totalDamage || 0) - (a.totalDamage || 0))
      .slice(0, 5);

    currentCharts.skillDistribution = new Chart(skillDistCanvas, {
      type: "pie",
      data: {
        labels: topSkills.map((s) => s.displayName),
        datasets: [
          {
            data: topSkills.map((s) => s.totalDamage),
            backgroundColor: [
              "#667eea",
              "#764ba2",
              "#f093fb",
              "#4facfe",
              "#43e97b",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: textColor, font: { size: 11 } },
            position: "bottom",
          },
        },
      },
    });
  }

  // Damage Distribution (Bar Chart)
  const damageDistCanvas = document.getElementById("damage-distribution-chart");
  if (damageDistCanvas) {
    currentCharts.damageDistribution = new Chart(damageDistCanvas, {
      type: "bar",
      data: {
        labels: ["Normal", "Crit", "Lucky"],
        datasets: [
          {
            label: "Damage",
            data: [
              summary.normalDamage,
              summary.critDamage,
              summary.luckyDamage,
            ],
            backgroundColor: ["#667eea", "#764ba2", "#f093fb"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: {
            ticks: { color: textColor },
            grid: { color: gridColor },
          },
        },
      },
    });
  }
}

// Setup collapsible cards
function setupCollapsibleCards() {
  const cardHeaders = document.querySelectorAll(
    ".collapsible-card .card-header",
  );

  cardHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const card = header.closest(".collapsible-card");
      card.classList.toggle("collapsed");

      const icon = header.querySelector(".collapse-icon");
      if (icon) {
        icon.classList.toggle("fa-chevron-down");
        icon.classList.toggle("fa-chevron-up");
      }
    });
  });
}

// Setup sort functionality
let currentSort = { column: "damage", ascending: false }; // Default sort by damage descending

function setupSortFunctionality() {
  const tableHeaders = document.querySelectorAll(".skills-table th[data-sort]");

  tableHeaders.forEach((header) => {
    header.style.cursor = "pointer";
    header.addEventListener("click", () => {
      if (!currentData) return;

      const sortBy = header.dataset.sort;

      // Toggle sort direction if clicking same column
      if (currentSort.column === sortBy) {
        currentSort.ascending = !currentSort.ascending;
      } else {
        currentSort.column = sortBy;
        currentSort.ascending = false; // Default to descending for new column
      }

      const skillsArray = Object.entries(currentData.skills).map(
        ([skillId, skillInfo]) => ({
          skillId,
          ...skillInfo,
        }),
      );

      const summary = calculateSummaryStats(skillsArray, currentData);
      const duration = summary.duration || 1;

      // Sort based on selected criteria
      switch (sortBy) {
        case "name":
          skillsArray.sort((a, b) => {
            const nameA = a.displayName || "";
            const nameB = b.displayName || "";
            return currentSort.ascending
              ? nameA.localeCompare(nameB)
              : nameB.localeCompare(nameA);
          });
          break;
        case "damage":
          skillsArray.sort((a, b) => {
            const diff = (b.totalDamage || 0) - (a.totalDamage || 0);
            return currentSort.ascending ? -diff : diff;
          });
          break;
        case "dps":
          skillsArray.sort((a, b) => {
            const aDps = (a.totalDamage || 0) / duration;
            const bDps = (b.totalDamage || 0) / duration;
            const diff = bDps - aDps;
            return currentSort.ascending ? -diff : diff;
          });
          break;
        case "hits":
          skillsArray.sort((a, b) => {
            const diff = (b.totalCount || 0) - (a.totalCount || 0);
            return currentSort.ascending ? -diff : diff;
          });
          break;
        case "crit":
          skillsArray.sort((a, b) => {
            const diff = (b.critRate || 0) - (a.critRate || 0);
            return currentSort.ascending ? -diff : diff;
          });
          break;
        case "avg":
          skillsArray.sort((a, b) => {
            const aAvg = a.totalCount > 0 ? a.totalDamage / a.totalCount : 0;
            const bAvg = b.totalCount > 0 ? b.totalDamage / b.totalCount : 0;
            const diff = bAvg - aAvg;
            return currentSort.ascending ? -diff : diff;
          });
          break;
        case "dmgpercent":
          // Percent is already calculated from damage, so sort by damage
          skillsArray.sort((a, b) => {
            const diff = (b.totalDamage || 0) - (a.totalDamage || 0);
            return currentSort.ascending ? -diff : diff;
          });
          break;
      }

      // Update header indicators
      updateSortIndicators();

      buildSkillsTable(
        skillsArray,
        summary.totalDamage,
        summary.duration,
        true,
      ); // Skip default sort
    });
  });
}

function updateSortIndicators() {
  const tableHeaders = document.querySelectorAll(".skills-table th[data-sort]");
  tableHeaders.forEach((header) => {
    // Remove existing indicators
    header.textContent = header.textContent.replace(" ▲", "").replace(" ▼", "");

    // Add indicator to current sort column
    if (header.dataset.sort === currentSort.column) {
      header.textContent += currentSort.ascending ? " ▲" : " ▼";
    }
  });
}

// Setup refresh button
function setupRefreshButton() {
  const refreshBtn = document.getElementById("refresh-button");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadSkillData();
    });
  }
}

// Setup close button
function setupCloseButton() {
  const closeBtn = document.getElementById("close-button");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      // Check if we're in Electron or browser
      if (window.electronAPI) {
        window.electronAPI.closeWindow();
      } else {
        window.close();
      }
    });
  }
}

// Theme toggle functionality
async function setupThemeToggle() {
  const themeToggleBtn = document.getElementById("theme-toggle-button");
  const body = document.body;

  // Load theme from settings API
  async function loadTheme() {
    try {
      const response = await fetch("/api/settings");
      const result = await response.json();
      // Unwrap API response: { code: 0, data: { theme: "dark" } }
      const settings = result.data || result;
      const theme = settings.theme || "dark";
      if (theme === "light") {
        body.classList.add("light-theme");
      } else {
        body.classList.remove("light-theme");
      }
      updateThemeIcon(theme === "light");
    } catch (error) {
      console.error("Error loading theme:", error);
      // Fallback to dark theme
      body.classList.remove("light-theme");
      updateThemeIcon(false);
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

  // Load theme on startup
  await loadTheme();

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", async () => {
      const isLight = body.classList.toggle("light-theme");
      const newTheme = isLight ? "light" : "dark";
      updateThemeIcon(isLight);
      await saveTheme(newTheme);

      // Re-render charts with new colors if they exist
      if (currentData) {
        const skillsArray = Object.entries(currentData.skills).map(
          ([skillId, skillInfo]) => ({
            skillId,
            ...skillInfo,
          }),
        );
        const summary = calculateSummaryStats(skillsArray, currentData);
        initializeCharts(skillsArray, summary);
      }
    });
  }
}

function updateThemeIcon(isLight) {
  const themeToggleBtn = document.getElementById("theme-toggle-button");
  if (themeToggleBtn) {
    const icon = themeToggleBtn.querySelector("i");
    if (icon) {
      icon.className = isLight ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }
  }
}

// Update DPS history with new real-time data
function updateDpsHistory(realtimeDps, realtimeHps) {
  // Shift data to the left (remove oldest point)
  dpsHistory.dpsValues.shift();
  dpsHistory.hpsValues.shift();

  // Add new data point at the end
  dpsHistory.dpsValues.push(realtimeDps || 0);
  dpsHistory.hpsValues.push(realtimeHps || 0);

  // Update chart if it exists
  if (currentCharts.dpsGraph) {
    currentCharts.dpsGraph.data.datasets[0].data = dpsHistory.dpsValues;
    currentCharts.dpsGraph.data.datasets[1].data = dpsHistory.hpsValues;
    currentCharts.dpsGraph.update("none"); // Update without animation
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  setupThemeToggle();
  setupCollapsibleCards();
  setupSortFunctionality();
  setupRefreshButton();
  setupCloseButton();
  loadSkillData();

  // Initialize sort indicator (default is damage descending)
  updateSortIndicators();

  // Setup Socket.IO for real-time updates
  const socket = io();

  socket.on("connect", () => {
    console.log("Socket.IO connected, player UID:", playerUid);
  });

  socket.on("disconnect", () => {
    console.log("Socket.IO disconnected");
  });

  // Listen for real-time data updates
  socket.on("data", (response) => {
    if (!playerUid) {
      console.log("No playerUid available");
      return;
    }

    // Unwrap API response: { code: 0, user: { uid: {...}, uid2: {...} } }
    const data = response.user || response;

    // Convert playerUid to number for comparison (data keys are integers)
    const uid = parseInt(playerUid);

    const playerData = data[uid];

    if (!playerData) {
      return; // Player not in current data (may have left combat)
    }

    // Update DPS/HPS graph with real-time values
    const realtimeDps = playerData.realtime_dps || 0;
    const realtimeHps = playerData.realtime_hps || 0;
    updateDpsHistory(realtimeDps, realtimeHps);
  });

  socket.on("theme-changed", (data) => {
    if (data.theme) {
      const body = document.body;
      if (data.theme === "light") {
        body.classList.add("light-theme");
      } else {
        body.classList.remove("light-theme");
      }
      updateThemeIcon(data.theme === "light");
      console.log(`Theme updated to ${data.theme} via Socket.IO`);

      // Re-render charts with new colors if they exist
      if (currentData) {
        const skillsArray = Object.entries(currentData.skills).map(
          ([skillId, skillInfo]) => ({
            skillId,
            ...skillInfo,
          }),
        );
        const summary = calculateSummaryStats(skillsArray, currentData);
        initializeCharts(skillsArray, summary);
      }
    }
  });

  // Setup monster damage table sorting
  setupMonsterTableSort();
});
