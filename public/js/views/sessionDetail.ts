import {Button} from '@components/Button';
import {Modal} from '@components/Modal';
import {Table} from '@components/Table';
import type {TableColumn, TableAction} from '@components/Table';
import {Container} from '@components/Container';
import {formatNumber, formatDuration, formatTimestamp} from '@shared/dataFormatter';
import {API_ENDPOINTS, COLORS, PLAYER_COLORS} from '@shared/constants';
import {setTheme} from '@shared/uiHelpers';
import {router} from '@shared/router';
import type {Theme, Settings, Session, SessionPlayer, SessionType} from '@app-types/index';

declare const Chart: any;

export class SessionDetail {
    private container: HTMLElement;
    private sessionId: number;
    private session: Session | null = null;
    private currentTheme: Theme = 'dark';
    private dpsChart: any = null;
    private playersTable?: Table;
    private playersTableBody?: HTMLElement;
    private expandedRows: Set<number> = new Set();
    private chartMode: 'dps' | 'hps' = 'dps';

    constructor(container: HTMLElement, sessionId: number) {
        this.container = container;
        this.sessionId = sessionId;
        this.init();
    }

    private async init(): Promise<void> {
        await this.loadTheme();
        await this.loadSession();
        if (this.session) {
            this.render();
        } else {
            this.showError('Session not found');
        }
    }

    private async loadTheme(): Promise<void> {
        try {
            const response = await fetch(API_ENDPOINTS.SETTINGS);
            const result = await response.json();
            const settings: Settings = result.data || result;

            this.currentTheme = (settings.theme as Theme) || 'dark';
            setTheme(this.currentTheme);
        } catch (error) {
            console.error('[SessionDetail] Error loading theme:', error);
            this.currentTheme = 'dark';
            setTheme('dark');
        }
    }

    private async loadSession(): Promise<void> {
        try {
            const response = await fetch(`/api/sessions/${this.sessionId}`);
            const result = await response.json();

            if (result.code === 0 && result.data) {
                this.session = result.data;
                console.log('[SessionDetail] Session loaded:', this.session);
            } else {
                console.error('[SessionDetail] Failed to load session:', result.message);
            }
        } catch (error) {
            console.error('[SessionDetail] Error fetching session:', error);
        }
    }

    private render(): void {
        if (!this.session) return;

        this.container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'session-detail-view';

        const headerEl = this.renderHeader();
        const statsEl = this.renderSummaryStats();
        const chartsRow = this.renderChartsRow();
        const playersSection = this.renderPlayersSection();
        const notesSection = this.renderNotesSection();

        wrapper.appendChild(headerEl);
        wrapper.appendChild(statsEl);
        wrapper.appendChild(chartsRow);
        wrapper.appendChild(playersSection);
        wrapper.appendChild(notesSection);

        this.container.appendChild(wrapper);

        requestAnimationFrame(() => {
            this.initDpsChart();
        });
    }

    private renderHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = 'session-detail-header';

        const typeBadge = this.getTypeBadge(this.session!.type || 'Open World');

        const headerContent = document.createElement('div');
        headerContent.className = 'session-detail-header-content';

        const titleSection = document.createElement('div');
        titleSection.className = 'session-detail-title-section';
        titleSection.innerHTML = `
      <button id="back-button" class="icon-button" title="Back to Sessions">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div class="session-detail-title-wrapper">
        <h1 id="session-name" class="session-detail-title">${this.session!.session_name || 'Untitled Session'}</h1>
        <button id="edit-name-button" class="icon-button" title="Edit Name">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button id="delete-button" class="icon-button" title="Delete Session" style="color: ${COLORS.error};">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      ${typeBadge}
    `;

        const meta = document.createElement('div');
        meta.className = 'session-detail-meta';
        meta.innerHTML = `
      <div class="session-detail-meta-item">
        <i class="fa-solid fa-calendar"></i>
        <span>${formatTimestamp(this.session!.start_time)}</span>
      </div>
      <div class="session-detail-meta-item">
        <i class="fa-solid fa-clock"></i>
        <span>${formatDuration(this.session!.duration || 0)}</span>
      </div>
    `;

        headerContent.appendChild(titleSection);
        headerContent.appendChild(meta);
        header.appendChild(headerContent);

        const backButton = header.querySelector('#back-button');
        backButton?.addEventListener('click', () => router.navigate('/sessions'));

        const editButton = header.querySelector('#edit-name-button');
        editButton?.addEventListener('click', () => this.showEditNameModal());

        const deleteButton = header.querySelector('#delete-button');
        deleteButton?.addEventListener('click', () => this.showDeleteConfirmation());

        return header;
    }

    private renderSummaryStats(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'session-summary-stats';

        const avgDps = this.session!.avg_dps || 0;
        const avgHps = this.session!.avg_hps || 0;
        const totalDamage = this.session!.totalDamage || 0;
        const totalHealing = this.session!.totalHealing || 0;
        const playerCount = this.session!.player_count || 0;
        const duration = this.session!.duration || 0;

        const cards = [
            {title: 'Participants', value: playerCount, icon: 'fa-solid fa-users', color: COLORS.primary},
            {title: 'Avg Party DPS', value: formatNumber(avgDps), icon: 'fa-solid fa-gauge-high', color: COLORS.error},
            {
                title: 'Avg Party HPS',
                value: formatNumber(avgHps),
                icon: 'fa-solid fa-heart-pulse',
                color: COLORS.success
            },
            {title: 'Total Damage', value: formatNumber(totalDamage), icon: 'fa-solid fa-burst', color: COLORS.error},
            {
                title: 'Total Healing',
                value: formatNumber(totalHealing),
                icon: 'fa-solid fa-heart',
                color: COLORS.success
            },
            {
                title: 'Duration',
                value: formatDuration(duration),
                icon: 'fa-solid fa-hourglass-half',
                color: COLORS.info
            },
        ];

        cards.forEach(card => {
            const bodyContent = document.createElement('div');
            const valueDiv = document.createElement('div');
            valueDiv.className = 'stat-card-value';
            valueDiv.textContent = String(card.value);
            bodyContent.appendChild(valueDiv);

            const iconEl = document.createElement('i');
            iconEl.className = card.icon;
            iconEl.style.color = card.color;

            const statCard = new Container({
                variant: 'card',
                className: 'stat-card',
                padding: 'medium',
                header: {
                    title: card.title,
                    actions: [iconEl],
                },
                body: {
                    content: bodyContent,
                },
            });

            container.appendChild(statCard.getElement());
        });

        return container;
    }

    private renderChartsRow(): HTMLElement {
        const row = document.createElement('div');
        row.className = 'session-charts-row';

        const dpsChartCard = document.createElement('div');
        dpsChartCard.className = 'chart-card dps-chart-card';

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';

        const title = document.createElement('h3');
        title.className = 'chart-title';
        title.style.margin = '0';
        title.textContent = 'DPS/HPS Over Time';

        const controls = document.createElement('div');
        controls.className = 'chart-controls';

        // Create DPS button using Button component
        const dpsBtn = new Button({
            text: 'DPS',
            className: 'control-button',
            onClick: () => {
                this.chartMode = 'dps';
                dpsBtn.getElement().classList.add('active');
                hpsBtn.getElement().classList.remove('active');
                this.styleChartButton(dpsBtn.getElement(), COLORS.primary, true);
                this.styleChartButton(hpsBtn.getElement(), COLORS.gray, false);
                this.updateChart();
            },
        });
        dpsBtn.getElement().classList.add('chart-filter-btn', 'active');
        this.styleChartButton(dpsBtn.getElement(), COLORS.primary, true);

        // Create HPS button using Button component
        const hpsBtn = new Button({
            text: 'HPS',
            className: 'control-button',
            onClick: () => {
                this.chartMode = 'hps';
                hpsBtn.getElement().classList.add('active');
                dpsBtn.getElement().classList.remove('active');
                this.styleChartButton(hpsBtn.getElement(), COLORS.success, true);
                this.styleChartButton(dpsBtn.getElement(), COLORS.gray, false);
                this.updateChart();
            },
        });
        hpsBtn.getElement().classList.add('chart-filter-btn');
        this.styleChartButton(hpsBtn.getElement(), COLORS.gray, false);

        controls.appendChild(dpsBtn.getElement());
        controls.appendChild(hpsBtn.getElement());

        header.appendChild(title);
        header.appendChild(controls);

        const chartContainer = document.createElement('div');
        chartContainer.id = 'chart-container';
        chartContainer.innerHTML = `
          <canvas id="session-dps-chart"></canvas>
          <div id="chart-no-data" style="display: none; text-align: center; padding: 80px 20px; color: var(--text-secondary);">
            <i class="fa-solid fa-chart-line" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;"></i>
            <p style="margin: 0; font-size: 1rem;">Time series data not available for this session</p>
            <p style="margin: 8px 0 0 0; font-size: 0.875rem; opacity: 0.7;">DPS tracking over time will be available for newly saved sessions</p>
          </div>
        `;

        dpsChartCard.appendChild(header);
        dpsChartCard.appendChild(chartContainer);
        row.appendChild(dpsChartCard);

        return row;
    }

    private renderPlayersSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'session-players-section';
        section.innerHTML = '<h3 class="section-title">Players</h3>';

        const players = this.session!.players || [];

        if (players.length === 0) {
            section.innerHTML += '<p class="empty-state">No players in this session</p>';
            return section;
        }

        const tableContainer = document.createElement('div');
        tableContainer.id = 'players-table-container';
        section.appendChild(tableContainer);

        const columns: TableColumn[] = [
            {
                key: 'rank',
                label: '#',
                sortable: false,
                render: (_value, row) => {
                    const index = players.indexOf(row as SessionPlayer);
                    return `<span class="player-rank">${index + 1}</span>`;
                },
            },
            {
                key: 'player_name',
                label: 'Name',
                sortable: true,
                render: (value, row) => {
                    const player = row as SessionPlayer;
                    const profession = player.professionDetails;
                    const icon = profession?.icon || 'unknown.png';
                    const role = profession?.role || 'dps';
                    const roleColor = role === 'tank' ? COLORS.info : role === 'healer' ? COLORS.success : COLORS.error;

                    return `
            <div class="player-name-cell">
              <img src="assets/images/icons/${icon}" alt="${profession?.name_en || 'Unknown'}" class="profession-icon" style="border-color: ${roleColor};" />
              <span class="player-name">${value}</span>
            </div>
          `;
                },
            },
            {
                key: 'profession',
                label: 'Class',
                sortable: true,
                render: (_value, row) => {
                    const player = row as SessionPlayer;
                    return player.professionDetails?.name_en || 'Unknown';
                },
            },
            {
                key: 'totalDps',
                label: 'DPS',
                sortable: true,
                render: (value) => formatNumber(value as number),
            },
            {
                key: 'totalHps',
                label: 'HPS',
                sortable: true,
                render: (value) => formatNumber(value as number),
            },
            {
                key: 'totalDamage',
                label: 'Damage',
                sortable: true,
                render: (value) => formatNumber(value as number),
            },
            {
                key: 'totalHealing',
                label: 'Healing',
                sortable: true,
                render: (value) => formatNumber(value as number),
            },
            {
                key: 'dead_count',
                label: 'Deaths',
                sortable: true,
                render: (value) => formatNumber((value as number) || 0),
            },
            {
                key: 'fight_point',
                label: 'GS',
                sortable: true,
                render: (value) => formatNumber(value as number),
            },
        ];

        const actions: TableAction[] = [
            {
                icon: 'fa-solid fa-chevron-down',
                label: 'Expand',
                variant: 'secondary',
                onClick: (row) => {
                    const index = players.indexOf(row as SessionPlayer);
                    this.toggleSkillBreakdown(row as SessionPlayer, index);
                },
            },
        ];

        this.playersTable = new Table(tableContainer, {
            columns,
            data: players,
            actions,
            defaultSortColumn: 'totalDps',
            defaultSortDirection: 'desc',
            emptyMessage: 'No players found',
        });

        this.playersTableBody = tableContainer.querySelector('.fluent-table-body') as HTMLElement;

        return section;
    }

    private renderNotesSection(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'session-notes-section';
        section.innerHTML = `
      <h3 class="section-title">Session Notes</h3>
      <textarea
        id="session-notes"
        class="session-notes-editor"
        placeholder="Add notes about this session..."
      ></textarea>
      <div class="notes-status">
        <span id="notes-status-text" class="notes-status-text"></span>
      </div>
    `;

        const textarea = section.querySelector('#session-notes') as HTMLTextAreaElement;

        // Load existing notes
        if (this.session?.notes) {
            textarea.value = this.session.notes;
        }

        let saveTimeout: NodeJS.Timeout;
        textarea.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            const statusText = section.querySelector('#notes-status-text') as HTMLElement;
            statusText.textContent = 'Unsaved changes...';
            statusText.style.color = COLORS.warning;

            saveTimeout = setTimeout(async () => {
                await this.saveNotes(textarea.value);
                statusText.textContent = 'Saved';
                statusText.style.color = COLORS.success;
                setTimeout(() => {
                    statusText.textContent = '';
                }, 2000);
            }, 1000);
        });

        return section;
    }

    private async initDpsChart(): Promise<void> {
        const canvas = document.getElementById('session-dps-chart') as HTMLCanvasElement;
        const noDataDiv = document.getElementById('chart-no-data') as HTMLElement;

        if (!canvas) {
            console.warn('[SessionDetail] Chart canvas not found');
            return;
        }

        if (typeof Chart === 'undefined') {
            console.error('[SessionDetail] Chart.js not loaded');
            return;
        }

        const players = this.session!.players || [];
        if (players.length === 0) {
            console.warn('[SessionDetail] No players in session');
            this.showNoDataMessage(canvas, noDataDiv);
            return;
        }

        const top5Players = [...players]
            .sort((a, b) => b.totalDps - a.totalDps)
            .slice(0, 5);

        if (top5Players.length === 0) {
            console.warn('[SessionDetail] No top players found');
            this.showNoDataMessage(canvas, noDataDiv);
            return;
        }

        const hasTimeSeriesData = top5Players.some(
            (p) => p.time_series_data && p.time_series_data.length > 0
        );

        if (!hasTimeSeriesData) {
            console.warn('[SessionDetail] No time series data available');
            this.showNoDataMessage(canvas, noDataDiv);
            return;
        }

        const datasets = top5Players.map((player, index) => {
            const timeSeriesData = player.time_series_data || [];
            const data = timeSeriesData.map((point) => this.chartMode === 'dps' ? point.dps : point.hps);

            const color = PLAYER_COLORS[index % PLAYER_COLORS.length];

            console.log(`[SessionDetail] Player ${player.player_name}: ${data.length} data points (${this.chartMode.toUpperCase()})`);

            return {
                label: player.player_name,
                data,
                borderColor: color,
                backgroundColor: `${color}33`,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
            };
        });

        const maxLength = Math.max(...top5Players.map((p) => (p.time_series_data || []).length), 1);
        const chartLabels = Array.from({length: maxLength}, (_, i) => (i % 5 === 0 ? `${i}s` : ''));

        console.log('[SessionDetail] Chart data:', {
            players: top5Players.length,
            maxLength,
            datasets: datasets.length,
        });

        const isDark = this.currentTheme === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        // Get text color from CSS variables based on theme
        const rootStyles = getComputedStyle(document.documentElement);
        const lightTextColor = rootStyles.getPropertyValue('--brand-light-text-primary').trim() || '#1f2937';
        const textColor = isDark ? COLORS.white : lightTextColor;

        try {
            if (noDataDiv) noDataDiv.style.display = 'none';
            canvas.style.display = 'block';

            this.dpsChart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets,
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 5,
                            right: 10,
                            bottom: 5,
                            left: 10,
                        },
                    },
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            align: 'start',
                            labels: {
                                color: textColor,
                                usePointStyle: true,
                                padding: 12,
                                boxWidth: 8,
                                boxHeight: 8,
                                font: {
                                    size: 12,
                                },
                            },
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                            titleColor: textColor,
                            bodyColor: textColor,
                            borderColor: gridColor,
                            borderWidth: 1,
                        },
                    },
                    scales: {
                        x: {
                            grid: {
                                color: gridColor,
                            },
                            ticks: {
                                color: textColor,
                                maxRotation: 0,
                                autoSkipPadding: 20,
                            },
                        },
                        y: {
                            grid: {
                                color: gridColor,
                            },
                            ticks: {
                                color: textColor,
                                callback: (value: any) => formatNumber(value as number),
                                maxTicksLimit: 8,
                            },
                        },
                    },
                },
            });
            console.log('[SessionDetail] Chart initialized successfully');
        } catch (error) {
            console.error('[SessionDetail] Error initializing chart:', error);
            this.showNoDataMessage(canvas, noDataDiv);
        }
    }

    private showNoDataMessage(canvas: HTMLCanvasElement, noDataDiv: HTMLElement): void {
        if (canvas) canvas.style.display = 'none';
        if (noDataDiv) noDataDiv.style.display = 'block';
    }

    private updateChart(): void {
        if (this.dpsChart) {
            this.dpsChart.destroy();
            this.dpsChart = null;
        }
        this.initDpsChart();
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

    private styleChartButton(element: HTMLElement, color: string, isActive: boolean): void {
        element.style.padding = '6px 16px';
        element.style.borderRadius = '6px';
        element.style.fontSize = '0.875rem';
        element.style.fontWeight = '500';
        element.style.border = 'none';
        element.style.cursor = 'pointer';
        element.style.transition = 'all 0.2s ease';

        if (isActive) {
            element.style.background = color;
            element.style.color = 'var(--text-inverse)';
        } else {
            element.style.background = 'var(--btn-secondary-bg)';
            element.style.color = 'var(--text-primary)';
        }
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

    private toggleSkillBreakdown(player: SessionPlayer, rowIndex: number): void {
        const isExpanded = this.expandedRows.has(rowIndex);

        if (isExpanded) {
            this.expandedRows.delete(rowIndex);
            const expandedRow = document.getElementById(`skill-breakdown-${rowIndex}`);
            expandedRow?.remove();
        } else {
            this.expandedRows.add(rowIndex);

            const playerRow = this.playersTableBody?.children[rowIndex] as HTMLElement;

            if (playerRow) {
                const breakdownRow = this.createSkillBreakdownRow(player, rowIndex);
                playerRow.insertAdjacentElement('afterend', breakdownRow);
            }
        }
    }

    private createSkillBreakdownRow(player: SessionPlayer, rowIndex: number): HTMLElement {
        const row = document.createElement('tr');
        row.id = `skill-breakdown-${rowIndex}`;
        row.className = 'skill-breakdown-row';

        const skillBreakdown = player.skill_breakdown || {};
        const skills = Object.values(skillBreakdown);

        if (skills.length === 0) {
            row.innerHTML = `
        <td colspan="8" class="skill-breakdown-cell">
          <div class="skill-breakdown-container">
            <p class="empty-state">No skill data available</p>
          </div>
        </td>
      `;
            return row;
        }

        const top10Skills = skills
            .sort((a: any, b: any) => (b.totalDamage || 0) - (a.totalDamage || 0))
            .slice(0, 10);

        const skillsHtml = top10Skills
            .map((skill: any) => {
                const isHealing = skill.type === 'heal';
                const icon = isHealing ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-solid fa-burst"></i>';
                const iconColor = isHealing ? COLORS.success : COLORS.error;

                return `
          <div class="skill-item">
            <div class="skill-icon" style="background: ${iconColor}33; color: ${iconColor};">
              ${icon}
            </div>
            <div class="skill-info">
              <div class="skill-name">${skill.displayName || skill.name || 'Unknown'}</div>
              <div class="skill-stats">
                <span>${formatNumber(skill.totalDamage || 0)}</span>
                <span class="skill-stat-divider">•</span>
                <span>${((skill.damagePercent || 0) * 100).toFixed(1)}%</span>
                <span class="skill-stat-divider">•</span>
                <span>${formatNumber(skill.dpsHps || 0)} ${isHealing ? 'HPS' : 'DPS'}</span>
              </div>
            </div>
          </div>
        `;
            })
            .join('');

        row.innerHTML = `
      <td colspan="8" class="skill-breakdown-cell">
        <div class="skill-breakdown-container">
          <h4 class="skill-breakdown-title">Top 10 Skills</h4>
          <div class="skill-breakdown-grid">
            ${skillsHtml}
          </div>
        </div>
      </td>
    `;

        return row;
    }

    private showEditNameModal(): void {
        const sessionTypes: SessionType[] = ['Parse', 'Dungeon', 'Raid', 'Guild Hunt', 'Boss Crusade', 'Open World'];
        const currentType = this.session!.type || 'Open World';

        const typeOptions = sessionTypes.map(type =>
            `<option value="${type}" ${type === currentType ? 'selected' : ''}>${type}</option>`
        ).join('');

        const modal: Modal = new Modal({
            title: 'Edit Session',
            content: `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label for="edit-session-name-input" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-primary);">
              Session Name
            </label>
            <input
              type="text"
              id="edit-session-name-input"
              class="input-field"
              placeholder="Enter session name"
              value="${this.session!.session_name || ''}"
            />
          </div>
          <div>
            <label for="edit-session-type-select" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-primary);">
              Session Type
            </label>
            <select
              id="edit-session-type-select"
              class="input-field"
              style="cursor: pointer;"
            >
              ${typeOptions}
            </select>
          </div>
        </div>
      `,
            footer: this.createEditNameFooter((): Modal => modal),
            showCloseButton: true,
            closeOnOverlayClick: true,
            onOpen: () => {
                const input = document.getElementById('edit-session-name-input') as HTMLInputElement;
                input?.focus();

                input?.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter') {
                        const select = document.getElementById('edit-session-type-select') as HTMLSelectElement;
                        const newName = input.value.trim() || this.session!.session_name || '';
                        const newType = (select?.value as SessionType) || this.session!.type || 'Open World';

                        await this.updateSessionMetadata(newName, newType);
                        modal.destroy();
                    }
                });
            },
        });

        modal.open();
    }

    private createEditNameFooter(getModal: () => Modal): HTMLElement {
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
                const input = document.getElementById('edit-session-name-input') as HTMLInputElement;
                const select = document.getElementById('edit-session-type-select') as HTMLSelectElement;
                const newName = input?.value.trim() || this.session!.session_name || '';
                const newType = (select?.value as SessionType) || this.session!.type || 'Open World';

                await this.updateSessionMetadata(newName, newType);
                modal.destroy();
            },
        });
        this.styleModalButton(saveBtn.getElement(), COLORS.success);

        footer.appendChild(cancelBtn.getElement());
        footer.appendChild(saveBtn.getElement());
        return footer;
    }

    private async updateSessionMetadata(newName: string, newType: SessionType): Promise<void> {
        try {
            console.log('[SessionDetail] Updating session metadata:', { newName, newType });

            const response = await fetch(`/api/sessions/${this.sessionId}/rename`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name: newName, type: newType}),
            });

            const result = await response.json();
            console.log('[SessionDetail] Update response:', result);

            if (result.code === 0) {
                this.session!.session_name = newName;
                this.session!.type = newType;

                const nameEl = document.getElementById('session-name');
                if (nameEl) {
                    nameEl.textContent = newName;
                    console.log('[SessionDetail] Updated session name to:', newName);
                }

                const badgeEl = document.querySelector('.session-detail-title-section .status-badge');
                console.log('[SessionDetail] Badge element found:', badgeEl);
                console.log('[SessionDetail] New badge HTML:', this.getTypeBadge(newType));

                if (badgeEl) {
                    badgeEl.outerHTML = this.getTypeBadge(newType);
                    console.log('[SessionDetail] Badge updated successfully');
                } else {
                    console.error('[SessionDetail] Badge element not found!');
                }
            } else {
                console.error('[SessionDetail] Failed to update session metadata:', result.message);
            }
        } catch (error) {
            console.error('[SessionDetail] Error updating session metadata:', error);
        }
    }

    private async saveNotes(notes: string): Promise<void> {
        try {
            console.log('[SessionDetail] Saving notes for session', this.sessionId);
            const response = await fetch(`/api/sessions/${this.sessionId}/rename`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({notes}),
            });

            if (!response.ok) {
                console.error('[SessionDetail] HTTP error:', response.status, response.statusText);
                return;
            }

            const result = await response.json();
            console.log('[SessionDetail] API response:', result);

            if (result.code === 0) {
                console.log('[SessionDetail] Notes saved successfully');
                if (this.session) {
                    this.session.notes = notes;
                }
            } else {
                console.error('[SessionDetail] Failed to save notes:', result.msg);
            }
        } catch (error) {
            console.error('[SessionDetail] Error saving notes:', error);
        }
    }

    private showDeleteConfirmation(): void {
        const modal: Modal = new Modal({
            title: 'Delete Session',
            content: `
        <p style="margin-bottom: 16px;">Are you sure you want to delete this session?</p>
        <p style="color: var(--error); margin-bottom: 0;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          This action cannot be undone.
        </p>
      `,
            footer: this.createDeleteFooter((): Modal => modal),
            showCloseButton: true,
            closeOnOverlayClick: true,
        });

        modal.open();
    }

    private createDeleteFooter(getModal: () => Modal): HTMLElement {
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
        this.styleModalButton(cancelBtn.getElement(), COLORS.gray);

        const deleteBtn = new Button({
            text: 'Delete',
            size: 'medium',
            className: 'btn-danger',
            onClick: async () => {
                await this.deleteSession();
                getModal().destroy();
            },
        });
        this.styleModalButton(deleteBtn.getElement(), COLORS.error);

        footer.appendChild(cancelBtn.getElement());
        footer.appendChild(deleteBtn.getElement());
        return footer;
    }

    private async deleteSession(): Promise<void> {
        try {
            const response = await fetch(`/api/sessions/${this.sessionId}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (result.code === 0) {
                router.navigate('/sessions');
            } else {
                console.error('[SessionDetail] Failed to delete session:', result.message);
            }
        } catch (error) {
            console.error('[SessionDetail] Error deleting session:', error);
        }
    }

    private showError(message: string): void {
        this.container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'session-detail-view';

        wrapper.innerHTML = `
      <div class="error-container">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: ${COLORS.error};"></i>
        <h2>Error</h2>
        <p>${message}</p>
        <button id="back-to-sessions" class="btn btn-primary">
          <i class="fa-solid fa-arrow-left"></i> Back to Sessions
        </button>
      </div>
    `;

        this.container.appendChild(wrapper);

        const backButton = document.getElementById('back-to-sessions');
        backButton?.addEventListener('click', () => router.navigate('/sessions'));
    }

    public destroy(): void {
        if (this.dpsChart) {
            this.dpsChart.destroy();
        }
        if (this.playersTable) {
            this.playersTable.destroy();
        }
        this.container.innerHTML = '';
    }
}
