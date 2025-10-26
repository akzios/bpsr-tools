// Skill Analysis Client - Advanced view with charts
// This runs in the advanced skill analysis window

let currentData = null;
let currentCharts = {
  dpsGraph: null,
  skillDistribution: null,
  damageDistribution: null,
};

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

  // Update page title
  document.getElementById("page-title").textContent = `${playerName} - ${profession}`;

  // Set class icon in header
  const classIconElement = document.getElementById("class-icon");
  if (classIconElement) {
    classIconElement.src = `icons/${professionIcon}`;
    classIconElement.alt = profession;
  }

  // Set player info card
  document.getElementById("player-name").textContent = playerName;
  document.getElementById("player-uid").textContent = `UID: ${data.uid}`;
  document.getElementById("player-power").textContent = `Power: ${formatStat(data.attr?.fight_point || 0)}`;
  document.getElementById("player-level").textContent = `Lv: ${data.attr?.level || "-"}`;

  // Convert skills to array
  const skillsArray = Object.entries(skills).map(([skillId, skillInfo]) => ({
    skillId,
    ...skillInfo,
  }));

  // Calculate summary statistics
  const summary = calculateSummaryStats(skillsArray, data);

  // Populate summary cards
  populateSummaryCards(summary);

  // Build skills table
  buildSkillsTable(skillsArray, summary.totalDamage);

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

function buildSkillsTable(skillsArray, totalDamage, skipSort = false) {
  const tbody = document.getElementById("skill-items");

  if (!tbody) {
    console.error("Skills table body not found");
    return;
  }

  // Sort by damage by default (only if not already sorted)
  if (!skipSort) {
    skillsArray.sort((a, b) => (b.totalDamage || 0) - (a.totalDamage || 0));
  }

  let html = "";

  if (skillsArray.length === 0) {
    html =
      '<tr><td colspan="7" style="text-align:center; padding:40px 20px; color: #9ca3af;">No skills recorded yet</td></tr>';
  } else {
    skillsArray.forEach((skill) => {
      const damagePercent =
        totalDamage > 0
          ? ((skill.totalDamage / totalDamage) * 100).toFixed(1)
          : 0;
      const avgPerHit =
        skill.totalCount > 0 ? skill.totalDamage / skill.totalCount : 0;
      const dps = skill.totalDamage; // Could calculate based on duration if available

      html += `
        <tr>
          <td>${skill.displayName}</td>
          <td>${formatStat(skill.totalDamage)}</td>
          <td>${formatStat(dps)}</td>
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
  const gridColor = isLight
    ? "rgba(0, 0, 0, 0.1)"
    : "rgba(255, 255, 255, 0.1)";

  // DPS/HPS Real-time Graph (Line Chart)
  // For now, show placeholder data. In future, could track DPS over time
  const dpsGraphCanvas = document.getElementById("dps-graph-chart");
  if (dpsGraphCanvas) {
    currentCharts.dpsGraph = new Chart(dpsGraphCanvas, {
      type: "line",
      data: {
        labels: ["0s", "10s", "20s", "30s", "40s", "50s", "60s"],
        datasets: [
          {
            label: "DPS",
            data: [0, 0, 0, 0, 0, 0, summary.dps], // Placeholder - would need historical data
            borderColor: "#667eea",
            backgroundColor: "rgba(102, 126, 234, 0.1)",
            tension: 0.4,
            fill: true,
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
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor },
          },
          y: {
            ticks: { color: textColor },
            grid: { color: gridColor },
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
  const cardHeaders = document.querySelectorAll(".collapsible-card .card-header");

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
function setupSortFunctionality() {
  const sortSelect = document.getElementById("sort-select");

  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      if (!currentData) return;

      const sortBy = e.target.value;
      const skillsArray = Object.entries(currentData.skills).map(
        ([skillId, skillInfo]) => ({
          skillId,
          ...skillInfo,
        }),
      );

      // Sort based on selected criteria
      switch (sortBy) {
        case "damage":
          skillsArray.sort((a, b) => (b.totalDamage || 0) - (a.totalDamage || 0));
          break;
        case "dps":
          skillsArray.sort((a, b) => (b.totalDamage || 0) - (a.totalDamage || 0)); // Same as damage for now
          break;
        case "hits":
          skillsArray.sort((a, b) => (b.totalCount || 0) - (a.totalCount || 0));
          break;
        case "crit":
          skillsArray.sort((a, b) => (b.critRate || 0) - (a.critRate || 0));
          break;
      }

      const summary = calculateSummaryStats(skillsArray, currentData);
      buildSkillsTable(skillsArray, summary.totalDamage, true); // Skip default sort
    });
  }
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

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  setupThemeToggle();
  setupCollapsibleCards();
  setupSortFunctionality();
  setupRefreshButton();
  setupCloseButton();
  loadSkillData();

  // Setup Socket.IO for real-time theme sync
  const socket = io();
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
});
