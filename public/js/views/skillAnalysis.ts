/**
 * Skill Analysis View
 * Detailed player skill breakdown with charts and statistics
 */

import { Header } from '@components/Header';
import { Table } from '@components/Table';
import { Collapsible } from '@components/Collapsible';
import { SummaryCards } from '@components/SummaryCards';
import { formatNumber, formatPercentage } from '@shared/dataFormatter';
import { COLORS, PLAYER_COLORS, API_ENDPOINTS } from '@shared/constants';
import { setTheme } from '@shared/uiHelpers';
import type { Theme, Settings } from '@app-types/index';
import type {
  SkillAnalysisData,
  SkillData,
  EnrichedSkillData,
  SummaryStats,
  TargetDamage,
} from '@app-types/skillAnalysis';

declare const Chart: any;
declare const io: any;

export class SkillAnalysis {
  private container: HTMLElement;
  private uid: string;
  private data: SkillAnalysisData | null = null;
  private currentTheme: Theme = 'dark';
  private themeButton?: HTMLButtonElement;
  private pinButton?: HTMLButtonElement;
  private isAlwaysOnTop: boolean = false;
  private socket: any = null;
  private lastTargetDamageHash: string = '';
  private lastSkillsHash: string = '';

  // Components
  private header?: Header;
  private summaryCards?: SummaryCards;
  private skillsTable?: Table;
  private monsterTable?: Table;

  // Collapsible sections
  private dpsCollapsible?: Collapsible;
  private skillDistCollapsible?: Collapsible;
  private damageDistCollapsible?: Collapsible;

  // Charts
  private dpsChart: any = null;
  private skillDistChart: any = null;
  private damageDistChart: any = null;

  // DPS History (60 data points)
  private dpsHistory = {
    labels: Array.from({ length: 60 }, (_, i) => (i % 5 === 0 ? `${i}s` : '')),
    dpsValues: Array(60).fill(0),
    hpsValues: Array(60).fill(0),
  };

  constructor(container: HTMLElement, uid: string) {
    this.container = container;
    this.uid = uid;
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadTheme();
    await this.loadData();
    this.render();
    this.setupSocketIO();
  }

  private async loadData(): Promise<void> {
    try {
      console.log('[SkillAnalysis] Fetching data for UID:', this.uid);
      const response = await fetch(`/api/skill/${this.uid}`);
      console.log('[SkillAnalysis] Response status:', response.status);

      const result = await response.json();
      console.log('[SkillAnalysis] Response data:', result);

      if (result.code === 0 && result.data) {
        this.data = result.data;
        console.log('[SkillAnalysis] Data loaded successfully');
      } else {
        console.error('[SkillAnalysis] Failed to load data:', result.msg || 'No data returned');
        this.showError(`Failed to load data: ${result.msg || 'Player not found'}`);
      }
    } catch (error) {
      console.error('[SkillAnalysis] Error fetching data:', error);
      this.showError(`Error loading skill analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private showError(message: string): void {
    this.container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
        <h2 style="color: var(--error); margin-bottom: 16px;">
          <i class="fa-solid fa-triangle-exclamation"></i> Error
        </h2>
        <p>${message}</p>
        <button onclick="window.location.reload()"
                style="margin-top: 20px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
  }

  private render(): void {
    if (!this.data) {
      this.container.innerHTML = '<div style="padding: 20px; text-align: center;">No data available</div>';
      return;
    }

    this.container.className = 'skill-analysis-container';
    this.container.innerHTML = '';

    // Create layout
    const layout = document.createElement('div');
    layout.className = 'skill-analysis-layout';

    // Header
    const headerContainer = document.createElement('header');
    headerContainer.className = 'skill-analysis-header';
    this.renderHeader(headerContainer);

    // Content area
    const content = document.createElement('div');
    content.className = 'skill-analysis-content';

    // Sidebar with charts
    const sidebar = document.createElement('aside');
    sidebar.className = 'skill-sidebar';
    this.renderCharts(sidebar);

    // Main content
    const main = document.createElement('main');
    main.className = 'skill-main-content';
    this.renderMainContent(main);

    content.appendChild(sidebar);
    content.appendChild(main);

    layout.appendChild(headerContainer);
    layout.appendChild(content);
    this.container.appendChild(layout);
  }

  private renderHeader(container: HTMLElement): void {
    const playerName = this.data!.name || `Player ${this.data!.uid}`;
    const profession = this.data!.professionDetails?.name_en || 'Unknown';
    const gearScore = this.data!.fightPoint || 0;
    const professionIcon = this.data!.professionDetails?.icon || 'unknown.png';

    // Left section
    const left = document.createElement('div');
    left.className = 'header-left';

    const icon = document.createElement('img');
    icon.src = `assets/images/icons/${professionIcon}`;
    icon.alt = profession;
    icon.style.height = '32px';
    icon.style.borderRadius = '4px';

    const title = document.createElement('h1');
    title.textContent = `${playerName} - ${profession} (${formatNumber(gearScore)})`;
    title.className = 'skill-analysis-title';

    left.appendChild(icon);
    left.appendChild(title);

    container.appendChild(left);

    // Right section with controls
    const right = document.createElement('div');
    right.className = 'header-controls';

    const themeBtn = document.createElement('button');
    themeBtn.className = 'btn btn-medium icon-button';
    this.themeButton = themeBtn;
    this.updateThemeButton();
    themeBtn.title = 'Toggle Theme';
    themeBtn.addEventListener('click', () => this.toggleTheme());

    // Always on top button (Electron only)
    const isElectron = typeof (window as any).electron !== 'undefined';
    if (isElectron) {
      const pinBtn = document.createElement('button');
      pinBtn.className = 'btn btn-medium icon-button';
      pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
      this.pinButton = pinBtn;
      this.updatePinButton();
      pinBtn.addEventListener('click', () => this.toggleAlwaysOnTop());
      right.appendChild(themeBtn);
      right.appendChild(pinBtn);
    } else {
      right.appendChild(themeBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-medium icon-button';
    closeBtn.id = 'close-button';
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => window.close());

    right.appendChild(closeBtn);
    container.appendChild(right);
  }

  private renderCharts(container: HTMLElement): void {
    // DPS/HPS Chart
    this.dpsCollapsible = new Collapsible({
      title: 'DPS/HPS Real-time Graph',
      icon: 'fa-solid fa-chart-line',
      content: '<canvas id="dps-chart" style="height: 200px;"></canvas>',
      isOpen: true,
    });
    container.appendChild(this.dpsCollapsible.getElement());

    // Skill Distribution Chart
    this.skillDistCollapsible = new Collapsible({
      title: 'Skill Distribution',
      icon: 'fa-solid fa-chart-pie',
      content: '<canvas id="skill-dist-chart" style="height: 250px;"></canvas>',
      isOpen: true,
    });
    container.appendChild(this.skillDistCollapsible.getElement());

    // Damage Distribution Chart
    this.damageDistCollapsible = new Collapsible({
      title: 'Damage Distribution',
      icon: 'fa-solid fa-chart-bar',
      content: '<canvas id="damage-dist-chart" style="height: 200px;"></canvas>',
      isOpen: true,
    });
    container.appendChild(this.damageDistCollapsible.getElement());

    // Initialize charts after DOM is ready
    setTimeout(() => {
      this.initializeCharts();
      // Refresh collapsibles after charts are initialized to ensure proper height
      this.dpsCollapsible?.refresh();
      this.skillDistCollapsible?.refresh();
      this.damageDistCollapsible?.refresh();
    }, 100);
  }

  private renderMainContent(container: HTMLElement): void {
    const stats = this.calculateSummaryStats();

    // Summary Cards
    const summaryContainer = document.createElement('div');
    this.summaryCards = new SummaryCards(summaryContainer, { stats });
    container.appendChild(summaryContainer);

    // Tables Container - wraps both tables to ensure equal height
    const tablesContainer = document.createElement('div');
    tablesContainer.className = 'skill-tables-container';

    // Skills Table
    const skillsSection = document.createElement('div');
    skillsSection.className = 'skill-table-section';
    this.renderSkillsTable(skillsSection, stats);
    tablesContainer.appendChild(skillsSection);

    // Monster Damage Table
    const monsterSection = document.createElement('div');
    monsterSection.className = 'skill-table-section';
    this.renderMonsterTable(monsterSection);
    tablesContainer.appendChild(monsterSection);

    container.appendChild(tablesContainer);
  }

  private calculateSummaryStats(): SummaryStats {
    const skillsArray = Object.values(this.data!.skills);

    let totalDamage = 0;
    let totalHits = 0;
    let totalCritHits = 0;
    let totalLuckyHits = 0;
    let totalNormalHits = 0;
    let normalDamage = 0;
    let critDamage = 0;
    let luckyDamage = 0;

    skillsArray.forEach((skill) => {
      totalDamage += skill.totalDamage || 0;
      totalHits += skill.totalCount || 0;
      totalCritHits += skill.critCount || 0;
      totalLuckyHits += skill.luckyCount || 0;

      const breakdown = skill.countBreakdown || {};
      totalNormalHits += breakdown.normal || 0;

      const damageBreakdown = skill.damageBreakdown || {};
      normalDamage += damageBreakdown.normal || 0;
      critDamage += damageBreakdown.critical || 0;
      luckyDamage += damageBreakdown.lucky || 0;
    });

    const critRate = totalHits > 0 ? totalCritHits / totalHits : 0;
    const luckyRate = totalHits > 0 ? totalLuckyHits / totalHits : 0;
    const avgPerHit = totalHits > 0 ? totalDamage / totalHits : 0;
    const duration = this.data!.attr?.combat_duration || 1;
    const dps = totalDamage / duration;
    const hitsTaken = this.data!.attr?.hits_taken || 0;

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
      duration,
    };
  }

  private renderSkillsTable(container: HTMLElement, stats: SummaryStats): void {
    const skillsArray: EnrichedSkillData[] = Object.values(this.data!.skills).map((skill: SkillData) => ({
      ...skill,
      damagePercent: stats.totalDamage > 0 ? skill.totalDamage / stats.totalDamage : 0,
      dpsHps: stats.duration > 0 ? skill.totalDamage / stats.duration : 0,
      avgPerHit: skill.totalCount > 0 ? skill.totalDamage / skill.totalCount : 0,
      normAvg: skill.countBreakdown.normal > 0 ? skill.damageBreakdown.normal / skill.countBreakdown.normal : 0,
      critAvg: skill.countBreakdown.critical > 0 ? skill.damageBreakdown.critical / skill.countBreakdown.critical : 0,
      hitsPerMinute: stats.duration > 0 ? (skill.totalCount / stats.duration) * 60 : 0,
      hitsPerSecond: stats.duration > 0 ? skill.totalCount / stats.duration : 0,
    }));

    this.skillsTable = new Table(container, {
      columns: [
        {
          key: 'displayName',
          label: 'Skill',
          render: (_value: any, row: any) => {
            const icon = row.type === 'healing' ? '💚 ' : '⚔️ ';
            return `${icon}${row.displayName}`;
          },
        },
        {
          key: 'totalDamage',
          label: 'Damage',
          render: (value: any) => formatNumber(value),
        },
        {
          key: 'damagePercent',
          label: 'Percent',
          render: (value: any) => formatPercentage(value),
        },
        {
          key: 'dpsHps',
          label: 'DPS',
          render: (value: any) => formatNumber(value),
        },
        {
          key: 'totalCount',
          label: 'Hits',
          render: (value: any) => formatNumber(value),
        },
        {
          key: 'hitsPerMinute',
          label: 'HPM (H/s)',
          render: (_value: any, row: any) => `${formatNumber(row.hitsPerMinute)} (${row.hitsPerSecond.toFixed(2)})`,
        },
        {
          key: 'avgPerHit',
          label: 'Average',
          render: (value: any) => formatNumber(value),
        },
        {
          key: 'normAvg',
          label: 'Norm Avg',
          render: (value: any) => formatNumber(value),
        },
        {
          key: 'minMaxBreakdown.normal.min',
          label: 'Norm Low',
          render: (_value: any, row: any) => formatNumber(row.minMaxBreakdown.normal.min),
        },
        {
          key: 'minMaxBreakdown.normal.max',
          label: 'Norm High',
          render: (_value: any, row: any) => formatNumber(row.minMaxBreakdown.normal.max),
        },
        {
          key: 'critCount',
          label: 'Crit Hit',
          render: (value: any) => formatNumber(value),
        },
        {
          key: 'critRate',
          label: 'Crit Rate',
          render: (value: any) => formatPercentage(value),
        },
        {
          key: 'critAvg',
          label: 'Crit Avg',
          render: (value: any) => formatNumber(value),
        },
        {
          key: 'minMaxBreakdown.critical.min',
          label: 'Crit Low',
          render: (_value: any, row: any) => formatNumber(row.minMaxBreakdown.critical.min),
        },
        {
          key: 'minMaxBreakdown.critical.max',
          label: 'Crit High',
          render: (_value: any, row: any) => formatNumber(row.minMaxBreakdown.critical.max),
        },
      ],
      data: skillsArray,
      emptyMessage: 'No skills recorded yet',
      sortable: true,
      defaultSortColumn: 'totalDamage',
      defaultSortDirection: 'desc',
    });
  }

  private renderMonsterTable(container: HTMLElement): void {
    // Filter out unknown monsters
    const filteredTargets = (this.data!.targetDamage || [])
      .filter((target) => !target.monsterName.includes('Unknown'));

    // Calculate total damage to identified monsters only
    const identifiedMonsterDamage = filteredTargets.reduce((sum, target) => sum + target.totalDamage, 0);

    // Map with percentages based on identified monster damage
    const targetData: Array<TargetDamage & { damagePercent: number }> = filteredTargets
      .map((target) => ({
        ...target,
        damagePercent: identifiedMonsterDamage > 0 ? target.totalDamage / identifiedMonsterDamage : 0,
      }));

    this.monsterTable = new Table(container, {
      columns: [
        { key: 'monsterName', label: 'Monster Name' },
        {
          key: 'monsterType',
          label: 'Type',
          render: (value: any) => {
            const types = ['Normal', 'Elite', 'Boss'];
            return types[value] || 'Unknown';
          },
        },
        { key: 'monsterClassification', label: 'Classification' },
        {
          key: 'totalDamage',
          label: 'Total DMG',
          render: (value: any) => formatNumber(value),
        },
        {
          key: 'damagePercent',
          label: 'Damage %',
          render: (value: any) => formatPercentage(value),
        },
      ],
      data: targetData,
      emptyMessage: 'No target damage data',
      sortable: true,
      defaultSortColumn: 'totalDamage',
      defaultSortDirection: 'desc',
    });
  }

  private initializeCharts(): void {
    this.initDPSChart();
    this.initSkillDistributionChart();
    this.initDamageDistributionChart();
  }

  private initDPSChart(): void {
    const canvas = document.getElementById('dps-chart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

  private initSkillDistributionChart(): void {
    const canvas = document.getElementById('skill-dist-chart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get text color from CSS variables based on theme
    const isDark = this.currentTheme === 'dark';
    const rootStyles = getComputedStyle(document.documentElement);
    const lightTextColor = rootStyles.getPropertyValue('--brand-light-text-primary').trim() || '#1f2937';
    const textColor = isDark ? COLORS.white : lightTextColor;

    const skills = Object.values(this.data!.skills)
      .sort((a, b) => b.totalDamage - a.totalDamage)
      .slice(0, 5);

    this.skillDistChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: skills.map((s) => s.displayName),
        datasets: [{
          data: skills.map((s) => s.totalDamage),
          backgroundColor: PLAYER_COLORS.slice(0, 5),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        backgroundColor: 'transparent',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
            },
          },
        },
      },
    });
  }

  private initDamageDistributionChart(): void {
    const canvas = document.getElementById('damage-dist-chart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get text color from CSS variables based on theme
    const isDark = this.currentTheme === 'dark';
    const rootStyles = getComputedStyle(document.documentElement);
    const lightTextColor = rootStyles.getPropertyValue('--brand-light-text-primary').trim() || '#1f2937';
    const textColor = isDark ? COLORS.white : lightTextColor;

    const stats = this.calculateSummaryStats();

    this.damageDistChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Normal', 'Critical', 'Lucky'],
        datasets: [
          {
            label: 'Damage',
            data: [stats.normalDamage, stats.critDamage, stats.luckyDamage],
            backgroundColor: [
              `${COLORS.info}cc`,
              `${COLORS.error}cc`,
              `${COLORS.warning}cc`,
            ],
            borderColor: [COLORS.info, COLORS.error, COLORS.warning],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        backgroundColor: 'transparent',
        plugins: {
          legend: { display: false },
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
              callback: (value: any) => formatNumber(value),
            },
          },
        },
      },
    });
  }

  private async loadTheme(): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINTS.SETTINGS);
      const result = await response.json();
      const settings: Settings = result.data || result;

      this.currentTheme = (settings.theme as Theme) || 'dark';
      setTheme(this.currentTheme);
      console.log('[SkillAnalysis] Theme loaded:', this.currentTheme);
    } catch (error) {
      console.error('[SkillAnalysis] Error loading theme:', error);
      this.currentTheme = 'dark';
      setTheme('dark');
    }
  }

  private async toggleTheme(): Promise<void> {
    const newTheme: Theme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.currentTheme = newTheme;
    setTheme(newTheme);
    this.updateThemeButton();

    // Save to settings
    try {
      await fetch(API_ENDPOINTS.SETTINGS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      });
      console.log('[SkillAnalysis] Theme saved:', newTheme);
    } catch (error) {
      console.error('[SkillAnalysis] Error saving theme:', error);
    }
  }

  private updateThemeButton(): void {
    if (!this.themeButton) return;
    const icon = this.currentTheme === 'dark' ? 'fa-moon' : 'fa-sun';
    this.themeButton.innerHTML = `<i class="fa-solid ${icon}"></i>`;
  }

  private async toggleAlwaysOnTop(): Promise<void> {
    const electron = (window as any).electron;
    if (!electron) return;

    try {
      this.isAlwaysOnTop = !this.isAlwaysOnTop;
      await electron.ipcRenderer.invoke('set-always-on-top', this.isAlwaysOnTop);
      this.updatePinButton();
    } catch (error) {
      console.error('[SkillAnalysis] Error toggling always on top:', error);
    }
  }

  private updatePinButton(): void {
    if (!this.pinButton) return;

    if (this.isAlwaysOnTop) {
      this.pinButton.style.color = COLORS.primary;
      this.pinButton.title = 'Always on Top: ON (click to disable)';
    } else {
      this.pinButton.style.color = '';
      this.pinButton.title = 'Toggle Always on Top';
    }
  }

  private setupSocketIO(): void {
    console.log('[SkillAnalysis] Setting up Socket.IO for UID:', this.uid);

    // Connect to Socket.IO
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('[SkillAnalysis] Socket.IO connected');
    });

    this.socket.on('disconnect', () => {
      console.log('[SkillAnalysis] Socket.IO disconnected');
    });

    // Listen for real-time data updates
    this.socket.on('data', (response: any) => {
      // Unwrap API response: { code: 0, user: { uid: {...}, uid2: {...} } }
      const data = response.user || response;

      // Convert UID to number for comparison (data keys are integers)
      const uid = parseInt(this.uid);
      const playerData = data[uid];

      if (!playerData) {
        return; // Player not in current data (may have left combat)
      }

      // Update DPS/HPS graph with real-time values
      const realtimeDps = playerData.realtimeDps || 0;
      const realtimeHps = playerData.realtimeHps || 0;
      this.updateDpsHistory(realtimeDps, realtimeHps);
    });

    // Listen for skill breakdown updates (emitted every 100ms)
    this.socket.on('skill-data', (response: any) => {
      if (response.code !== 0 || !response.data) {
        return;
      }

      const uid = this.uid;
      const skillData = response.data[uid];

      if (!skillData) {
        return; // No data for this player
      }

      // Create hashes to detect what changed
      const targetDamageHash = JSON.stringify(
        (skillData.targetDamage || []).map((t: TargetDamage) => ({
          name: t.monsterName,
          dmg: t.totalDamage
        }))
      );

      const skillsHash = JSON.stringify(
        Object.entries(skillData.skills || {}).map(([id, skill]: [string, any]) => ({
          id,
          dmg: skill.totalDamage,
          cnt: skill.totalCount,
        }))
      );

      const targetDamageChanged = targetDamageHash !== this.lastTargetDamageHash;
      const skillsChanged = skillsHash !== this.lastSkillsHash;

      // Only log if something changed
      if (targetDamageChanged || skillsChanged) {
        console.log('[SkillAnalysis] Data changed:', {
          targetDamageChanged,
          skillsChanged,
          targetDamageCount: skillData.targetDamage?.length || 0,
          skillCount: Object.keys(skillData.skills || {}).length,
        });
      }

      // Update internal data
      this.data = skillData;

      // Update UI components
      if (skillsChanged) {
        this.lastSkillsHash = skillsHash;
        this.updateSkillTable();
        this.updateSummaryCards();
        this.updateSkillDistributionChart();
        this.updateDamageDistributionChart();
      }

      if (targetDamageChanged) {
        this.lastTargetDamageHash = targetDamageHash;
        this.updateMonsterTable();
      }
    });

    // Listen for theme changes
    this.socket.on('theme-changed', (data: any) => {
      if (data.theme) {
        this.currentTheme = data.theme;
        setTheme(data.theme);
        this.updateThemeButton();
        console.log('[SkillAnalysis] Theme updated to', data.theme);

        // Re-render charts with new theme colors
        if (this.data) {
          this.destroyCharts();
          setTimeout(() => this.initializeCharts(), 100);
        }
      }
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

  /**
   * Update skill table with new data
   */
  private updateSkillTable(): void {
    if (!this.skillsTable || !this.data) return;

    const stats = this.calculateSummaryStats();
    const skillsArray: EnrichedSkillData[] = Object.values(this.data.skills).map((skill: SkillData) => ({
      ...skill,
      damagePercent: stats.totalDamage > 0 ? skill.totalDamage / stats.totalDamage : 0,
      dpsHps: stats.duration > 0 ? skill.totalDamage / stats.duration : 0,
      avgPerHit: skill.totalCount > 0 ? skill.totalDamage / skill.totalCount : 0,
      normAvg: skill.countBreakdown.normal > 0 ? skill.damageBreakdown.normal / skill.countBreakdown.normal : 0,
      critAvg: skill.countBreakdown.critical > 0 ? skill.damageBreakdown.critical / skill.countBreakdown.critical : 0,
      hitsPerMinute: stats.duration > 0 ? (skill.totalCount / stats.duration) * 60 : 0,
      hitsPerSecond: stats.duration > 0 ? skill.totalCount / stats.duration : 0,
    }));

    this.skillsTable.setData(skillsArray);
  }

  /**
   * Update monster table with new data
   */
  private updateMonsterTable(): void {
    if (!this.monsterTable || !this.data) {
      return;
    }

    // Filter out unknown monsters
    const filteredTargets = (this.data.targetDamage || [])
      .filter((target) => !target.monsterName.includes('Unknown'));

    // Calculate total damage to identified monsters only
    const identifiedMonsterDamage = filteredTargets.reduce((sum, target) => sum + target.totalDamage, 0);

    // Map with percentages based on identified monster damage
    const targetData: Array<TargetDamage & { damagePercent: number }> = filteredTargets
      .map((target) => ({
        ...target,
        damagePercent: identifiedMonsterDamage > 0 ? target.totalDamage / identifiedMonsterDamage : 0,
      }));

    this.monsterTable.setData(targetData);
  }

  /**
   * Update summary cards with new data
   */
  private updateSummaryCards(): void {
    if (!this.summaryCards || !this.data) return;

    const stats = this.calculateSummaryStats();
    this.summaryCards.update(stats);
  }

  /**
   * Update skill distribution chart with new data
   */
  private updateSkillDistributionChart(): void {
    if (!this.skillDistChart || !this.data) return;

    const skills = Object.values(this.data.skills)
      .sort((a, b) => b.totalDamage - a.totalDamage)
      .slice(0, 5);

    this.skillDistChart.data.labels = skills.map((s) => s.displayName);
    this.skillDistChart.data.datasets[0].data = skills.map((s) => s.totalDamage);
    this.skillDistChart.update('none'); // Update without animation for better performance
  }

  /**
   * Update damage distribution chart with new data
   */
  private updateDamageDistributionChart(): void {
    if (!this.damageDistChart || !this.data) return;

    const stats = this.calculateSummaryStats();
    this.damageDistChart.data.datasets[0].data = [
      stats.normalDamage,
      stats.critDamage,
      stats.luckyDamage,
    ];
    this.damageDistChart.update('none'); // Update without animation for better performance
  }

  private destroyCharts(): void {
    if (this.dpsChart) this.dpsChart.destroy();
    if (this.skillDistChart) this.skillDistChart.destroy();
    if (this.damageDistChart) this.damageDistChart.destroy();
  }

  public destroy(): void {
    // Disconnect Socket.IO
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.destroyCharts();
    this.header?.destroy();
    this.summaryCards?.destroy();
    this.skillsTable?.destroy();
    this.monsterTable?.destroy();
    this.container.innerHTML = '';
  }
}
