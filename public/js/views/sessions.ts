/**
 * Sessions View
 * Active session dashboard + session history list
 */

import { Header } from '@components/Header';
import { Button } from '@components/Button';
import { Container } from '@components/Container';
import { Modal } from '@components/Modal';
import { Table } from '@components/Table';
import type { TableColumn, TableAction } from '@components/Table';
import { formatNumber, formatDuration } from '@shared/dataFormatter';
import { API_ENDPOINTS, COLORS } from '@shared/constants';
import { setTheme } from '@shared/uiHelpers';
import { createSocketManager } from '@shared/socketManager';
import type { SocketManager } from '@shared/socketManager';
import type { Theme, Settings, Session, CombatData, SessionType } from '@app-types/index';

export class SessionsView {
  private container: HTMLElement;
  private sessions: Session[] = [];
  private currentTheme: Theme = 'dark';
  private header?: Header;
  private table?: Table;
  private socketManager?: SocketManager;

  // Container components
  private statsCards: Container[] = [];
  private chartCard?: Container;
  private damageCard?: Container;

  // Active session state
  private activeSessionId?: number;
  private currentDPS: number = 0;
  private averageDPS: number = 0;
  private sessionDuration: number = 0;
  private isPaused: boolean = false;
  private combatData: Record<string, CombatData> = {};

  // DPS History (60 data points, rolling window)
  private dpsHistory = {
    labels: Array.from({ length: 60 }, (_, i) => (i % 5 === 0 ? `${i}s` : '')),
    dpsValues: Array(60).fill(0),
    hpsValues: Array(60).fill(0),
  };

  private dpsChart: any = null;
  private lastStatsUpdateTime: number = 0;

  // Auto-save inactivity timer
  private inactivityTimer: NodeJS.Timeout | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadTheme();
    await this.loadPauseState();
    await this.loadSessions();
    this.render();
    this.updatePauseButton(); // Update pause button UI after render
    this.setupSocketListeners();
    this.setupWindowCloseHandler();
  }

  private async loadTheme(): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINTS.SETTINGS);
      const result = await response.json();
      const settings: Settings = result.data || result;

      this.currentTheme = (settings.theme as Theme) || 'dark';
      setTheme(this.currentTheme);
    } catch (error) {
      console.error('[Sessions] Error loading theme:', error);
      this.currentTheme = 'dark';
      setTheme('dark');
    }
  }

  private async loadPauseState(): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINTS.PAUSE);
      const result = await response.json();
      this.isPaused = result.paused || false;
      console.log('[Sessions] Loaded pause state:', this.isPaused);
    } catch (error) {
      console.error('[Sessions] Error loading pause state:', error);
      this.isPaused = false;
    }
  }

  /**
   * Update pause button UI to match current state
   */
  private updatePauseButton(): void {
    const pauseBtn = document.getElementById('sessions-pause-button');
    if (pauseBtn) {
      pauseBtn.classList.toggle('paused', this.isPaused);
      const icon = pauseBtn.querySelector('i');
      if (icon) {
        icon.className = this.isPaused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
      }
    }
  }

  private async loadSessions(): Promise<void> {
    const { fetchSessions } = await import('@shared/sessionHelpers');
    this.sessions = await fetchSessions(50, 0);
    console.log('[Sessions] Loaded sessions:', this.sessions.length);
  }

  private setupSocketListeners(): void {
    this.socketManager = createSocketManager();

    this.socketManager.on({
      onDataUpdate: async (data: Record<string, CombatData>) => {
        // Extract player data from response (handles both {user: {...}} and direct {...} formats)
        const playerData = (data as any).user || data;

        // Always store combat data
        this.combatData = playerData;

        // Reset inactivity timer when combat data is updated
        this.resetInactivityTimer();

        const now = Date.now();

        // Track local player's DPS and HPS over time
        const localPlayer = this.getLocalPlayer(playerData);
        console.log('[Sessions] Local player:', localPlayer);

        // Use realtimeDps/realtimeHps
        const dps = localPlayer?.realtimeDps || 0;
        const hps = localPlayer?.realtimeHps || 0;
        console.log('[Sessions] DPS value:', dps, 'HPS value:', hps);

        // Update DPS history (rolling window)
        this.updateDpsHistory(dps, hps);

        // Throttle expensive operations (stats and skills) to 1000ms
        if (now - this.lastStatsUpdateTime < 1000) {
          return; // Skip expensive updates
        }
        this.lastStatsUpdateTime = now;

        // Fetch temporary session stats from backend
        await this.updateTemporarySessionStats();

        // Update damage breakdown
        this.updateDamageBreakdown();
      },

      onPauseStateChanged: (paused: boolean) => {
        this.isPaused = paused;
        console.log('[Sessions] Pause state changed:', paused ? 'paused' : 'resumed');
        this.updatePauseButton();
      },
    });
  }

  /**
   * Get local player from combat data (player with isLocalPlayer flag or first player)
   */
  private getLocalPlayer(data: Record<string, CombatData>): CombatData | null {
    console.log('[Sessions] getLocalPlayer - data type:', typeof data, 'is array:', Array.isArray(data));
    console.log('[Sessions] getLocalPlayer - data keys:', Object.keys(data));

    const players = Object.values(data);
    console.log('[Sessions] getLocalPlayer - players count:', players.length);

    if (players.length === 0) return null;

    // Find player with isLocalPlayer flag
    const localPlayer = players.find((p) => (p as any).isLocalPlayer);
    if (localPlayer) {
      console.log('[Sessions] Found local player with flag:', localPlayer.name);
      return localPlayer;
    }

    // Fallback: return first player
    console.log('[Sessions] Using first player:', players[0]);
    return players[0];
  }

  /**
   * Fetch and update temporary session stats from backend
   */
  private async updateTemporarySessionStats(): Promise<void> {
    try {
      const response = await fetch('/api/sessions/temporary');
      const result = await response.json();

      console.log('[Sessions] Temporary session response:', result);

      if (result.code === 0 && result.data) {
        const tempSession = result.data;

        console.log('[Sessions] Updating with temp session data:', tempSession);

        // Update stats from temporary session
        this.currentDPS = tempSession.currentDps || 0;
        this.averageDPS = tempSession.avgDps || 0;
        this.sessionDuration = tempSession.duration || 0;
        this.activeSessionId = tempSession.isActive ? -1 : undefined; // -1 indicates temp session

        // Update stats cards
        this.updateStatsCards(tempSession.isActive);
      } else {
        // No temporary session - keep current values or reset
        console.log('[Sessions] No temporary session active');
        this.updateStatsCards(false);
      }
    } catch (error) {
      console.error('[Sessions] Error fetching temporary session:', error);
    }
  }

  private updateStatsCards(isTemporary: boolean = false): void {
    console.log('[Sessions] updateStatsCards called:', {
      cardsCount: this.statsCards.length,
      currentDPS: this.currentDPS,
      averageDPS: this.averageDPS,
      sessionDuration: this.sessionDuration,
      isTemporary,
    });

    if (this.statsCards.length !== 3) {
      console.warn('[Sessions] Stats cards not initialized yet, count:', this.statsCards.length);
      return;
    }

    // Current DPS card
    const currentDPSBody = document.createElement('div');
    const currentDPSValue = document.createElement('div');
    currentDPSValue.className = 'stat-card-value';
    currentDPSValue.textContent = formatNumber(Math.round(this.currentDPS));
    currentDPSBody.appendChild(currentDPSValue);

    // Average DPS card
    const averageDPSBody = document.createElement('div');
    const averageDPSValue = document.createElement('div');
    averageDPSValue.className = 'stat-card-value';
    averageDPSValue.textContent = formatNumber(Math.round(this.averageDPS));
    averageDPSBody.appendChild(averageDPSValue);

    // Session Time card
    const sessionTimeBody = document.createElement('div');
    const sessionTimeValue = document.createElement('div');
    sessionTimeValue.className = 'stat-card-value';
    sessionTimeValue.textContent = formatDuration(this.sessionDuration);
    sessionTimeBody.appendChild(sessionTimeValue);

    // Add subtitle with temporary session indicator
    if (this.sessionDuration > 0) {
      const sessionTimeSubtitle = document.createElement('div');
      sessionTimeSubtitle.className = 'stat-card-subtitle';

      if (isTemporary) {
        // Add visual indicator for unsaved/temporary session
        sessionTimeSubtitle.innerHTML = '<span style="color: var(--warning); font-weight: 600;">⚠ Unsaved Session</span>';
      } else if (this.activeSessionId && this.activeSessionId !== -1) {
        sessionTimeSubtitle.textContent = 'Active session';
      }

      if (sessionTimeSubtitle.textContent || sessionTimeSubtitle.innerHTML) {
        sessionTimeBody.appendChild(sessionTimeSubtitle);
      }
    }

    this.statsCards[0].updateBody(currentDPSBody);
    this.statsCards[1].updateBody(averageDPSBody);
    this.statsCards[2].updateBody(sessionTimeBody);

    console.log('[Sessions] Stats cards updated successfully');
  }

  private render(): void {
    this.container.innerHTML = '';

    // Create wrapper div (like dpsmeter-content)
    const wrapper = document.createElement('div');
    wrapper.className = 'sessions-content';

    // Content with scroll
    const content = document.createElement('div');
    content.className = 'sessions-body';
    this.renderContent(content);
    wrapper.appendChild(content);

    this.container.appendChild(wrapper);
  }

  private renderContent(container: HTMLElement): void {
    // Always render the dashboard to allow real-time updates via socket

    // Active Session Dashboard section
    const dashboardSection = document.createElement('div');
    dashboardSection.className = 'session-dashboard';
    this.renderDashboard(dashboardSection);
    container.appendChild(dashboardSection);

    // Session History section
    const historySection = document.createElement('div');
    historySection.className = 'session-history';
    this.renderHistory(historySection);
    container.appendChild(historySection);
  }

  private renderDashboard(container: HTMLElement): void {
    console.log('[Sessions] Rendering dashboard');

    // Section title with action buttons
    const titleRow = document.createElement('div');
    titleRow.className = 'dashboard-title-row';

    const title = document.createElement('h2');
    title.textContent = 'Active Session';
    title.style.margin = '0';
    titleRow.appendChild(title);

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '4px';

    // Save Session button
    const saveBtn = new Button({
      icon: 'fa-solid fa-floppy-disk',
      size: 'medium',
      className: 'control-button',
      title: 'Save Session',
      onClick: () => this.handleSaveSession(),
    });
    saveBtn.addClass('btn-medium');
    saveBtn.addClass('btn-success');
    buttonContainer.appendChild(saveBtn.getElement());

    // Pause/Resume button
    const pauseBtn = new Button({
      icon: 'fa-solid fa-pause',
      size: 'medium',
      className: 'control-button',
      title: 'Pause/Resume Tracking',
      onClick: () => this.handlePause(),
    });
    pauseBtn.addClass('btn-medium');
    pauseBtn.getElement().id = 'sessions-pause-button';
    buttonContainer.appendChild(pauseBtn.getElement());

    // Clear button
    const clearBtn = new Button({
      icon: 'fa-solid fa-broom',
      size: 'medium',
      className: 'control-button',
      title: 'Clear Meter',
      onClick: () => this.handleClear(),
    });
    clearBtn.addClass('btn-medium');
    clearBtn.getElement().id = 'sessions-clear-button';
    buttonContainer.appendChild(clearBtn.getElement());

    titleRow.appendChild(buttonContainer);
    container.appendChild(titleRow);

    // Stats cards grid
    const statsGrid = document.createElement('div');
    statsGrid.className = 'session-stats-grid';
    this.renderStatsCards(statsGrid);
    container.appendChild(statsGrid);

    // Charts row (DPS chart + Damage breakdown)
    const chartsRow = document.createElement('div');
    chartsRow.className = 'session-charts-row';
    this.renderDPSChart(chartsRow);
    this.renderDamageBreakdown(chartsRow);
    container.appendChild(chartsRow);

    console.log('[Sessions] Dashboard rendering complete');
  }

  private renderStatsCards(container: HTMLElement): void {
    const cards = [
      { title: 'Current DPS', value: '0', icon: 'fa-solid fa-bolt', color: COLORS.warning },
      { title: 'Average DPS', value: '0', icon: 'fa-solid fa-chart-line', color: COLORS.info },
      { title: 'Session Time', value: '00:00:00', icon: 'fa-solid fa-clock', color: COLORS.primary },
    ];

    cards.forEach(card => {
      // Create body content as DOM elements
      const bodyContent = document.createElement('div');
      const valueDiv = document.createElement('div');
      valueDiv.className = 'stat-card-value';
      valueDiv.textContent = card.value;
      bodyContent.appendChild(valueDiv);

      const statCard = new Container({
        variant: 'card',
        className: 'stat-card',
        padding: 'medium',
        header: {
          title: card.title,
          actions: [this.createIconElement(card.icon, card.color)],
        },
        body: {
          content: bodyContent,
        },
      });

      this.statsCards.push(statCard);
      container.appendChild(statCard.getElement());
    });
  }

  private createIconElement(iconClass: string, color: string): HTMLElement {
    const icon = document.createElement('i');
    icon.className = iconClass;
    icon.style.color = color;
    icon.style.fontSize = '16px';
    return icon;
  }

  private renderDPSChart(container: HTMLElement): void {
    console.log('[Sessions] Rendering DPS chart');

    // Create canvas for Chart.js
    const canvas = document.createElement('canvas');
    canvas.id = 'dps-time-chart';
    canvas.style.maxHeight = '300px';

    const canvasContainer = document.createElement('div');
    canvasContainer.style.position = 'relative';
    canvasContainer.style.height = '300px';
    canvasContainer.appendChild(canvas);

    this.chartCard = new Container({
      variant: 'card',
      className: 'dps-chart-card',
      padding: 'medium',
      header: {
        title: 'DPS Over Time (Last 60 seconds)',
      },
      body: {
        content: canvasContainer,
      },
    });

    container.appendChild(this.chartCard.getElement());

    // Initialize Chart.js
    this.initializeDPSChart(canvas);
    console.log('[Sessions] DPS chart rendered');
  }

  private initializeDPSChart(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check if Chart.js is available
    if (typeof (window as any).Chart === 'undefined') {
      console.error('[Sessions] Chart.js not loaded');
      return;
    }

    const Chart = (window as any).Chart;

    // Get text color from CSS variables based on theme
    const isDark = this.currentTheme === 'dark';
    const rootStyles = getComputedStyle(document.documentElement);
    const lightTextColor = rootStyles.getPropertyValue('--brand-light-text-primary').trim() || '#1f2937';
    const textColor = isDark ? COLORS.white : lightTextColor;

    this.dpsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.dpsHistory.labels,
        datasets: [
          {
            label: 'DPS',
            data: this.dpsHistory.dpsValues,
            borderColor: COLORS.primary,
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
          {
            label: 'HPS',
            data: this.dpsHistory.hpsValues,
            borderColor: COLORS.success,
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        backgroundColor: 'transparent',
        plugins: {
          legend: {
            display: true,
            labels: {
              color: textColor,
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: textColor,
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              display: false,
            },
            ticks: {
              color: textColor,
            },
          },
        },
      },
    });
  }

  private updateDpsHistory(realtimeDps: number, realtimeHps: number): void {
    // Shift data to the left (remove oldest point)
    this.dpsHistory.dpsValues.shift();
    this.dpsHistory.hpsValues.shift();

    // Add new data point at the end
    this.dpsHistory.dpsValues.push(realtimeDps || 0);
    this.dpsHistory.hpsValues.push(realtimeHps || 0);

    // Update chart if it exists
    if (this.dpsChart) {
      this.dpsChart.data.datasets[0].data = this.dpsHistory.dpsValues;
      this.dpsChart.data.datasets[1].data = this.dpsHistory.hpsValues;
      this.dpsChart.update('none'); // Update without animation for better performance
    }
  }

  private renderDamageBreakdown(container: HTMLElement): void {
    console.log('[Sessions] Rendering damage breakdown');

    // Skills list container
    const skillsList = document.createElement('div');
    skillsList.className = 'skills-breakdown-list';
    skillsList.id = 'damage-breakdown-skills';

    this.damageCard = new Container({
      variant: 'card',
      className: 'damage-breakdown-card',
      padding: 'medium',
      header: {
        title: 'Top 5 Skills',
      },
      body: {
        content: skillsList,
      },
    });

    container.appendChild(this.damageCard.getElement());
    console.log('[Sessions] Damage breakdown rendered');

    // Initial update
    this.updateDamageBreakdown();
  }

  private async updateDamageBreakdown(): Promise<void> {
    const skillsContainer = document.getElementById('damage-breakdown-skills');
    if (!skillsContainer) {
      console.log('[Sessions] Skills container not found');
      return;
    }

    console.log('[Sessions] Updating damage breakdown, combat data players:', Object.keys(this.combatData).length);

    // Clear existing content
    skillsContainer.innerHTML = '';

    // If no players, show empty state
    if (Object.keys(this.combatData).length === 0) {
      skillsContainer.style.textAlign = 'center';
      skillsContainer.style.padding = '40px 20px';
      skillsContainer.style.color = 'var(--text-secondary)';
      skillsContainer.textContent = 'No skill data yet';
      return;
    }

    // Fetch skill data from API for each player (skills not in socket data)
    const skillMap = new Map<string, { name: string; damage: number }>();

    try {
      const playerUids = Object.keys(this.combatData);
      console.log('[Sessions] Fetching skills for', playerUids.length, 'players');

      // Fetch skills for all players in parallel
      const skillPromises = playerUids.map(async (uid) => {
        try {
          const response = await fetch(`/api/skill/${uid}`);
          const result = await response.json();

          if (result.code === 0 && result.data && result.data.skills) {
            return { uid, skills: result.data.skills };
          }
          return null;
        } catch (error) {
          console.error(`[Sessions] Error fetching skills for ${uid}:`, error);
          return null;
        }
      });

      const skillsResults = await Promise.all(skillPromises);

      console.log('[Sessions] Skills results:', skillsResults.length, 'players');

      // Aggregate skills from all players
      skillsResults.forEach((result, index) => {
        if (!result) {
          console.log(`[Sessions] Player ${index}: No result`);
          return;
        }

        const skills = result.skills;
        const skillsEntries = Object.entries(skills);
        console.log(`[Sessions] Player ${result.uid}: ${skillsEntries.length} skills`, skillsEntries.slice(0, 3));

        skillsEntries.forEach(([skillId, skill]: [string, any]) => {
          const skillKey = String(skillId);
          const skillName = skill.displayName || skill.skill_name || 'Unknown Skill';
          const skillDamage = skill.totalDamage || skill.damage || 0;

          console.log(`[Sessions]   Skill: ${skillName} (${skillKey}) - Damage: ${skillDamage}`);

          const existing = skillMap.get(skillKey);
          if (existing) {
            existing.damage += skillDamage;
          } else {
            skillMap.set(skillKey, {
              name: skillName,
              damage: skillDamage,
            });
          }
        });
      });

      console.log('[Sessions] Total unique skills found:', skillMap.size);
      console.log('[Sessions] All skills:', Array.from(skillMap.entries()).slice(0, 10));

      // Sort by damage and get top 5
      const topSkills = Array.from(skillMap.values())
        .sort((a, b) => b.damage - a.damage)
        .slice(0, 5);

      console.log('[Sessions] Top 5 skills:', topSkills);

      if (topSkills.length === 0) {
        skillsContainer.style.textAlign = 'center';
        skillsContainer.style.padding = '40px 20px';
        skillsContainer.style.color = 'var(--text-secondary)';
        skillsContainer.textContent = 'No skill data yet';
        return;
      }

      // Calculate total damage for percentages
      const totalDamage = topSkills.reduce((sum, skill) => sum + skill.damage, 0);

      // Render skill breakdown items
      skillsContainer.style.display = 'flex';
      skillsContainer.style.flexDirection = 'column';
      skillsContainer.style.gap = '8px';
      skillsContainer.style.padding = '0';

      topSkills.forEach((skill, index) => {
        const percentage = totalDamage > 0 ? (skill.damage / totalDamage) * 100 : 0;

        const item = document.createElement('div');
        item.className = 'skill-breakdown-item';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px 12px';
        item.style.borderRadius = '6px';
        item.style.background = 'var(--bg-secondary)';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'skill-breakdown-name';
        nameDiv.textContent = `${index + 1}. ${skill.name}`;
        nameDiv.style.flex = '1';

        const percentSpan = document.createElement('span');
        percentSpan.className = 'skill-breakdown-percent';
        percentSpan.textContent = `${percentage.toFixed(1)}%`;
        percentSpan.style.fontWeight = '600';
        percentSpan.style.color = COLORS.primary;

        item.appendChild(nameDiv);
        item.appendChild(percentSpan);
        skillsContainer.appendChild(item);
      });
    } catch (error) {
      console.error('[Sessions] Error updating damage breakdown:', error);
      skillsContainer.style.textAlign = 'center';
      skillsContainer.style.padding = '40px 20px';
      skillsContainer.style.color = 'var(--error)';
      skillsContainer.textContent = 'Error loading skill data';
    }
  }

  private renderHistory(container: HTMLElement): void {
    // Section title with refresh button
    const titleRow = document.createElement('div');
    titleRow.className = 'history-title-row';

    const title = document.createElement('h2');
    title.textContent = 'Session History';
    title.style.margin = '0';
    titleRow.appendChild(title);

    const refreshBtn = new Button({
      icon: 'fa-solid fa-refresh',
      size: 'medium',
      className: 'control-button',
      title: 'Refresh Sessions',
      onClick: () => this.refreshSessions(),
    });
    refreshBtn.addClass('btn-medium');
    titleRow.appendChild(refreshBtn.getElement());
    container.appendChild(titleRow);

    // Sessions table
    const tableSection = document.createElement('div');
    tableSection.className = 'skill-table-section';
    tableSection.style.marginTop = '16px';
    this.renderSessionsTable(tableSection);
    container.appendChild(tableSection);
  }

  private renderSessionsTable(container: HTMLElement): void {
    const columns: TableColumn[] = [
      {
        key: 'session_name',
        label: 'Session Name',
        width: '18%',
        render: (value, row: Session) => {
          const span = document.createElement('span');
          span.className = 'session-name';
          span.textContent = value || `Session #${row.id}`;
          return span;
        },
      },
      {
        key: 'start_time',
        label: 'Date',
        width: '16%',
        sortable: true,
        render: (value) => {
          const date = new Date(value);
          return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        },
      },
      {
        key: 'duration',
        label: 'Duration',
        width: '10%',
        sortable: true,
        render: (value) => value ? formatDuration(value) : '-',
      },
      {
        key: 'avg_dps',
        label: 'Avg DPS',
        width: '12%',
        align: 'right',
        sortable: true,
        render: (value) => {
          const span = document.createElement('span');
          span.className = 'dps-value';
          span.textContent = formatNumber(value);
          return span;
        },
      },
      {
        key: 'totalDamage',
        label: 'Total Damage',
        width: '12%',
        align: 'right',
        sortable: true,
        render: (value) => formatNumber(value || 0),
      },
      {
        key: 'player_count',
        label: 'Players',
        width: '8%',
        align: 'center',
        sortable: true,
      },
      {
        key: 'type',
        label: 'Type',
        width: '12%',
        render: (_value, row: Session) => {
          return this.getTypeBadge(row.type || 'Open World');
        },
      },
    ];

    const actions: TableAction[] = [
      {
        label: 'View',
        icon: 'fa-solid fa-eye',
        variant: 'primary',
        onClick: (row: Session) => this.viewSession(row.id),
      },
      {
        label: 'Delete',
        icon: 'fa-solid fa-trash',
        variant: 'danger',
        onClick: (row: Session) => this.deleteSession(row.id),
      },
    ];

    this.table = new Table(container, {
      columns,
      data: this.sessions,
      actions,
      emptyMessage: 'No sessions yet.',
      sortable: true,
      defaultSortColumn: 'start_time',
      defaultSortDirection: 'desc',
    });
  }

  private async handleSaveSession(): Promise<void> {
    // Detect session type from current combat data
    const { detectCurrentSessionType } = await import('@shared/sessionHelpers');
    const detectedType = await detectCurrentSessionType(this.isPaused);

    console.log('[Sessions] Detected type for save modal:', detectedType);

    // Create modal for session name input with detected type
    const modal: Modal = new Modal({
      title: 'Save Session',
      content: this.createSessionNameInput(detectedType),
      footer: this.createSessionFooter((): Modal => modal),
    });

    modal.open();
  }

  private createSessionFooter(getModal: () => Modal): HTMLElement {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';
    footer.style.padding = '12px 0 0 0';

    const cancelBtn = new Button({
      text: 'Cancel',
      size: 'medium',
      className: 'btn-danger',
      onClick: () => getModal().destroy(),
    });
    this.styleModalButton(cancelBtn.getElement(), COLORS.error);

    const saveBtn = new Button({
      text: 'Save',
      size: 'medium',
      className: 'btn-success',
      onClick: async () => {
        const modal = getModal();
        const input = modal.getBody()?.querySelector('#session-name-input') as HTMLInputElement;
        const select = modal.getBody()?.querySelector('#session-type-input') as HTMLSelectElement;
        const sessionName = input?.value.trim() || undefined;
        const sessionType = select?.value || 'Open World';
        modal.destroy();

        // Check if we have combat data
        console.log('[Sessions] Combat data available:', Object.keys(this.combatData).length, 'players');
        console.log('[Sessions] Combat data:', this.combatData);

        // Check if combat data exists
        if (!this.combatData || Object.keys(this.combatData).length === 0) {
          this.showErrorModal('No combat data available. Start a fight to generate data first.');
          return;
        }

        // Save session with combat data from this view
        const { saveSession } = await import('@shared/sessionHelpers');
        const sessionId = await saveSession(sessionName, sessionType, this.combatData);

        if (sessionId) {
          console.log('[Sessions] Session saved:', sessionId);
          await this.refreshSessions();
        } else {
          // Show error modal
          this.showErrorModal('Failed to save session. Please try again.');
        }
      },
    });
    this.styleModalButton(saveBtn.getElement(), COLORS.success);

    footer.appendChild(cancelBtn.getElement());
    footer.appendChild(saveBtn.getElement());

    return footer;
  }

  private getTypeBadge(type: SessionType): string {
    const typeConfig: Record<SessionType, { icon: string; color: string; bgColor: string }> = {
      'Parse': { icon: 'fa-solid fa-bullseye', color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.15)' },
      'Dungeon': { icon: 'fa-solid fa-dungeon', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
      'Raid': { icon: 'fa-solid fa-dragon', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
      'Guild Hunt': { icon: 'fa-solid fa-users', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
      'Boss Crusade': { icon: 'fa-solid fa-crown', color: '#dc2626', bgColor: 'rgba(220, 38, 38, 0.15)' },
      'Open World': { icon: 'fa-solid fa-globe', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
    };

    const config = typeConfig[type] || typeConfig['Open World'];
    return `<span class="status-badge" style="background: ${config.bgColor}; color: ${config.color}; border-color: ${config.color};"><i class="${config.icon}"></i> ${type}</span>`;
  }

  private styleModalButton(element: HTMLElement, color: string): void {
    element.style.background = color;
    element.style.color = '#ffffff';
    element.style.border = 'none';
    element.style.padding = '10px 20px';
    element.style.borderRadius = '6px';
    element.style.fontWeight = '700';
    element.style.fontSize = '14px';
    element.style.cursor = 'pointer';
    element.style.transition = 'opacity 0.2s ease';

    element.addEventListener('mouseenter', () => {
      element.style.opacity = '0.85';
    });
    element.addEventListener('mouseleave', () => {
      element.style.opacity = '1';
    });
  }

  private showErrorModal(message: string): void {
    const errorModal: Modal = new Modal({
      title: 'Error',
      content: this.createErrorContent(message),
      footer: this.createErrorFooter((): Modal => errorModal),
    });
    errorModal.open();
  }

  private createErrorFooter(getModal: () => Modal): HTMLElement {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'center';
    footer.style.padding = '12px 0 0 0';

    const okBtn = new Button({
      text: 'OK',
      size: 'medium',
      className: 'btn-primary',
      onClick: () => getModal().destroy(),
    });
    this.styleModalButton(okBtn.getElement(), COLORS.primary);

    footer.appendChild(okBtn.getElement());
    return footer;
  }

  private createSessionNameInput(defaultType: SessionType = 'Open World'): HTMLElement {
    const container = document.createElement('div');
    container.style.padding = '10px 0';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';

    // Session Name Input
    const nameContainer = document.createElement('div');
    const nameLabel = document.createElement('label');
    nameLabel.className = 'input-label';
    nameLabel.textContent = 'Session Name (optional):';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'session-name-input';
    input.className = 'input-field';
    input.value = ''; // Explicitly clear any previous value
    input.placeholder = 'Enter session name...';
    input.autocomplete = 'off'; // Disable browser autocomplete

    nameContainer.appendChild(nameLabel);
    nameContainer.appendChild(input);

    // Session Type Dropdown
    const typeContainer = document.createElement('div');
    const typeLabel = document.createElement('label');
    typeLabel.className = 'input-label';
    typeLabel.textContent = 'Session Type:';

    const select = document.createElement('select');
    select.id = 'session-type-input';
    select.className = 'input-field';

    const sessionTypes = ['Parse', 'Dungeon', 'Raid', 'Guild Hunt', 'Boss Crusade', 'Open World'];
    sessionTypes.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      // Pre-select the detected type
      if (type === defaultType) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    typeContainer.appendChild(typeLabel);
    typeContainer.appendChild(select);

    container.appendChild(nameContainer);
    container.appendChild(typeContainer);

    // Auto-focus and select all text after a short delay
    setTimeout(() => {
      input.focus();
      input.select(); // Select any text if present
    }, 100);

    return container;
  }

  private createErrorContent(message: string): HTMLElement {
    const container = document.createElement('div');
    container.style.padding = '20px 0';
    container.style.textAlign = 'center';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '16px';

    // Error icon
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-circle-exclamation';
    icon.style.fontSize = '48px';
    icon.style.color = COLORS.error;

    // Error message
    const text = document.createElement('p');
    text.textContent = message;
    text.style.color = 'var(--text-primary)';
    text.style.margin = '0';
    text.style.fontSize = '14px';
    text.style.lineHeight = '1.5';

    container.appendChild(icon);
    container.appendChild(text);
    return container;
  }

  private async handlePause(): Promise<void> {
    try {
      // Toggle pause state
      this.isPaused = !this.isPaused;

      await fetch(API_ENDPOINTS.PAUSE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: this.isPaused }),
      });

      console.log('[Sessions] Tracking', this.isPaused ? 'paused' : 'resumed');

      // Update button state
      this.updatePauseButton();
    } catch (error) {
      console.error('[Sessions] Error toggling pause:', error);
    }
  }

  private async handleClear(): Promise<void> {
    try {
      // Check if auto-save should trigger before clearing
      const { checkAndAutoSave } = await import('@shared/sessionHelpers');
      const autoSaved = await checkAndAutoSave('onClear', false);

      if (autoSaved) {
        console.log('[Sessions] Session auto-saved before clear');
        // Refresh the sessions list to show the newly auto-saved session
        await this.refreshSessions();
      }

      // Proceed with clear
      await fetch(API_ENDPOINTS.CLEAR);
      this.currentDPS = 0;
      this.averageDPS = 0;
      this.sessionDuration = 0;

      // Reset DPS history to empty rolling window
      this.dpsHistory = {
        labels: Array.from({ length: 60 }, (_, i) => (i % 5 === 0 ? `${i}s` : '')),
        dpsValues: Array(60).fill(0),
        hpsValues: Array(60).fill(0),
      };
      this.combatData = {};

      // Reset chart
      if (this.dpsChart) {
        this.dpsChart.data.labels = this.dpsHistory.labels;
        this.dpsChart.data.datasets[0].data = this.dpsHistory.dpsValues;
        this.dpsChart.data.datasets[1].data = this.dpsHistory.hpsValues;
        this.dpsChart.update();
      }

      this.updateStatsCards();
      this.updateDamageBreakdown();
      console.log('[Sessions] Meter cleared');
    } catch (error) {
      console.error('[Sessions] Error clearing meter:', error);
    }
  }

  private viewSession(sessionId: number): void {
    window.location.hash = `/sessions/${sessionId}`;
  }

  private async deleteSession(sessionId: number): Promise<void> {
    // Show confirmation modal
    const confirmModal: Modal = new Modal({
      title: 'Delete Session',
      content: this.createDeleteConfirmContent(),
      footer: this.createDeleteConfirmFooter((): Modal => confirmModal, sessionId),
    });
    confirmModal.open();
  }

  private createDeleteConfirmContent(): HTMLElement {
    const container = document.createElement('div');
    container.style.padding = '20px 0';
    container.style.textAlign = 'center';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '16px';

    // Warning icon
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-triangle-exclamation';
    icon.style.fontSize = '48px';
    icon.style.color = COLORS.warning;

    // Warning message
    const text = document.createElement('p');
    text.textContent = 'Are you sure you want to delete this session? This action cannot be undone.';
    text.style.color = 'var(--text-primary)';
    text.style.margin = '0';
    text.style.fontSize = '14px';
    text.style.lineHeight = '1.5';

    container.appendChild(icon);
    container.appendChild(text);
    return container;
  }

  private createDeleteConfirmFooter(getModal: () => Modal, sessionId: number): HTMLElement {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';
    footer.style.padding = '12px 0 0 0';

    const cancelBtn = new Button({
      text: 'Cancel',
      size: 'medium',
      className: 'btn-secondary',
      onClick: () => getModal().destroy(),
    });
    this.styleModalButton(cancelBtn.getElement(), COLORS.gray); // Gray color for cancel

    const deleteBtn = new Button({
      text: 'Delete',
      size: 'medium',
      className: 'btn-danger',
      onClick: async () => {
        getModal().destroy();

        const { deleteSession } = await import('@shared/sessionHelpers');
        const success = await deleteSession(sessionId);

        if (success) {
          console.log('[Sessions] Session deleted:', sessionId);
          await this.refreshSessions();
        } else {
          this.showErrorModal('Failed to delete session. Please try again.');
        }
      },
    });
    this.styleModalButton(deleteBtn.getElement(), COLORS.error);

    footer.appendChild(cancelBtn.getElement());
    footer.appendChild(deleteBtn.getElement());

    return footer;
  }

  private async refreshSessions(): Promise<void> {
    await this.loadSessions();
    if (this.table) {
      this.table.setData(this.sessions);
    } else {
      this.render();
    }
  }

  /**
   * Setup window close handler for auto-save
   */
  private setupWindowCloseHandler(): void {
    window.addEventListener('beforeunload', async () => {
      try {
        // Check if auto-save on window close is enabled
        const { checkAndAutoSave } = await import('@shared/sessionHelpers');

        // Note: In modern browsers, we can't prevent the dialog or delay closing,
        // so we do a synchronous save attempt
        const saved = await checkAndAutoSave('onWindowClose', false);

        if (saved) {
          console.log('[Sessions] Session auto-saved on window close');
        }
      } catch (error) {
        console.error('[Sessions] Error during window close auto-save:', error);
      }
    });

    console.log('[Sessions] Window close handler registered');
  }

  /**
   * Reset inactivity timer
   */
  private resetInactivityTimer(): void {
    // Clear existing timer
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    // Start new inactivity timer
    this.startInactivityTimer();
  }

  /**
   * Start inactivity timer based on settings
   */
  private async startInactivityTimer(): Promise<void> {
    try {
      // Fetch settings to check if inactivity auto-save is enabled
      const response = await fetch(API_ENDPOINTS.SETTINGS);
      const result = await response.json();
      const settings = result.data || result;
      const autoSave = settings.autoSave || {};

      // Only start timer if auto-save is enabled and onInactivity is true
      if (!autoSave.enabled || !autoSave.onInactivity) {
        return;
      }

      const inactivityMinutes = autoSave.inactivityMinutes || 5;
      const inactivityMs = inactivityMinutes * 60 * 1000;

      // Set timeout to trigger auto-save after inactivity period
      this.inactivityTimer = setTimeout(async () => {
        console.log('[Sessions] Inactivity timeout reached, triggering auto-save');
        const { checkAndAutoSave } = await import('@shared/sessionHelpers');
        const saved = await checkAndAutoSave('onInactivity', false);

        if (saved) {
          // Refresh the sessions list to show the newly auto-saved session
          await this.refreshSessions();
        }
      }, inactivityMs);

      console.log(`[Sessions] Inactivity timer started: ${inactivityMinutes} minutes`);
    } catch (error) {
      console.error('[Sessions] Error starting inactivity timer:', error);
    }
  }

  public destroy(): void {
    // Clear inactivity timer
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    this.header?.destroy();
    this.table?.destroy();
    this.statsCards.forEach(card => card.destroy());
    this.chartCard?.destroy();
    this.damageCard?.destroy();
    this.socketManager?.disconnect();
    this.container.innerHTML = '';
  }
}
