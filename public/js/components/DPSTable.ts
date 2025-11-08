/**
 * DPSTable Component
 * Manages the display of player DPS/HPS bars in both lite and advanced modes
 */

import type { CombatData, ViewMode, LiteModeType } from '@app-types/index';
import { formatStat, getProfessionName } from '@shared/dataFormatter';
import { PLAYER_COLORS, STAT_COLORS, HEALTH_COLORS } from '@shared/constants';

export interface DPSTableOptions {
  container: HTMLElement;
  viewMode?: ViewMode;
  liteModeType?: LiteModeType;
  onSkillAnalysisClick?: (uid: string) => void;
}

export interface EnrichedCombatData extends CombatData {
  rank: number;
  damagePercent: number;
  healingPercent: number;
  isLocalPlayer?: boolean;
}

/**
 * DPSTable class manages player combat statistics display
 */
export class DPSTable {
  private container: HTMLElement;
  private viewMode: ViewMode;
  private liteModeType: LiteModeType;
  private onSkillAnalysisClick?: (uid: string) => void;
  private playerBars: Map<string, HTMLElement> = new Map();

  constructor(options: DPSTableOptions) {
    this.container = options.container;
    this.viewMode = options.viewMode || 'advanced';
    this.liteModeType = options.liteModeType || 'dps';
    this.onSkillAnalysisClick = options.onSkillAnalysisClick;

    this.setupEventListeners();
  }

  /**
   * Setup event listeners for the container (event delegation)
   */
  private setupEventListeners(): void {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('.skill-analysis-button') as HTMLElement;

      if (button) {
        console.log('[DPSTable] Skill analysis button clicked');
        console.log('[DPSTable] onSkillAnalysisClick callback exists:', !!this.onSkillAnalysisClick);

        if (this.onSkillAnalysisClick) {
          const uid = button.getAttribute('data-uid');
          console.log('[DPSTable] UID:', uid);
          if (uid) {
            this.onSkillAnalysisClick(uid);
          }
        }
      }
    });
  }

  /**
   * Update the table with new combat data
   */
  public update(players: EnrichedCombatData[]): void {
    const newUids = new Set(players.map((p) => String(p.uid)));

    this.playerBars.forEach((bar, uid) => {
      if (!newUids.has(uid)) {
        bar.remove();
        this.playerBars.delete(uid);
      }
    });

    players.forEach((player, index) => {
      const uid = String(player.uid);
      const existingBar = this.playerBars.get(uid);

      if (existingBar) {
        // Check if mode changed
        const hasLiteBar = existingBar.querySelector('.lite-bar') !== null;
        const hasAdvancedBar = existingBar.querySelector('.player-bar') !== null;
        const modeChanged =
          (this.viewMode === 'lite' && !hasLiteBar) ||
          (this.viewMode === 'advanced' && !hasAdvancedBar);

        if (modeChanged) {
          // Recreate bar
          const newBar = this.createPlayerBar(player, index);
          existingBar.replaceWith(newBar);
          this.playerBars.set(uid, newBar);
        } else {
          // Update existing bar
          this.updatePlayerBar(existingBar, player, index);
        }
      } else {
        const newBar = this.createPlayerBar(player, index);
        this.container.appendChild(newBar);
        this.playerBars.set(uid, newBar);
      }
    });

    this.reorderBars(players);
  }

  /**
   * Create a new player bar element
   */
  private createPlayerBar(player: EnrichedCombatData, index: number): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'player-bar-wrapper';

    if (player.isLocalPlayer) {
      wrapper.classList.add('local-player');
    }

    if (this.viewMode === 'lite') {
      wrapper.innerHTML = this.renderLiteBar(player, index);
    } else {
      wrapper.innerHTML = this.renderAdvancedBar(player, index);
    }

    return wrapper;
  }

  /**
   * Update an existing player bar
   */
  private updatePlayerBar(
    wrapper: HTMLElement,
    player: EnrichedCombatData,
    index: number
  ): void {
    if (player.isLocalPlayer) {
      wrapper.classList.add('local-player');
    } else {
      wrapper.classList.remove('local-player');
    }

    if (this.viewMode === 'lite') {
      this.updateLiteBar(wrapper, player, index);
    } else {
      this.updateAdvancedBar(wrapper, player, index);
    }
  }

  /**
   * Render lite mode bar HTML
   */
  private renderLiteBar(player: EnrichedCombatData, index: number): string {
    const professionIcon = player.professionDetails?.icon || 'unknown.png';
    const playerName = player.name?.trim() || 'Unknown';
    const color = PLAYER_COLORS[index % PLAYER_COLORS.length];

    let barFillWidth: number;
    let barFillBackground: string;
    let value1: string;
    let value2: string;
    let iconHtml: string;

    if (this.liteModeType === 'dps') {
      barFillWidth = player.damagePercent || 0;
      barFillBackground =
        (player.totalDps || 0) > 0
          ? `linear-gradient(90deg, transparent, ${color})`
          : 'none';
      iconHtml = "<span style='font-size:1.1em;margin-right:2px;'>🔥</span>";
      value1 = formatStat(player.totalDamage?.total || 0);
      value2 = `${Math.round(barFillWidth)}%`;
    } else if (this.liteModeType === 'healer') {
      barFillWidth = player.healingPercent || 0;
      barFillBackground =
        (player.totalHealing?.total || 0) > 0
          ? `linear-gradient(90deg, transparent, ${STAT_COLORS.hps})`
          : 'none';
      iconHtml = `<span style='font-size:1.1em;margin-right:2px; color: ${STAT_COLORS.hps}; text-shadow: 0 0 2px white, 0 0 2px white, 0 0 2px white, 0 0 2px white;'>⛨</span>`;
      value1 = formatStat(player.totalHealing?.total || 0);
      value2 = `${Math.round(barFillWidth)}%`;
    } else {
      barFillWidth = player.damagePercent || 0;
      barFillBackground =
        (player.takenDamage || 0) > 0
          ? `linear-gradient(90deg, transparent, ${STAT_COLORS.takenDamage})`
          : 'none';
      iconHtml = `<span style='font-size:1.1em;margin-right:2px; color: ${STAT_COLORS.takenDamage}; text-shadow: 0 0 2px white, 0 0 2px white, 0 0 2px white, 0 0 2px white;'>🛡</span>`;
      value1 = formatStat(player.takenDamage || 0);
      value2 = `${Math.round(barFillWidth)}%`;
    }

    return `
      <div class="lite-bar" data-lite="true" data-rank="${player.rank || 0}">
        <div class="lite-bar-fill" style="width: ${barFillWidth}%; background: ${barFillBackground};"></div>
        <div class="lite-bar-content" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; justify-content: space-between;">
          <div class="skill-analysis-button" data-uid="${player.uid}" title="Skill Analysis">
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
  }

  /**
   * Render advanced mode bar HTML
   */
  private renderAdvancedBar(player: EnrichedCombatData, index: number): string {
    const professionName = getProfessionName(player.professionDetails);
    const professionIcon = player.professionDetails?.icon || 'unknown.png';
    const playerName = player.name?.trim() || 'Unknown';
    const color = PLAYER_COLORS[index % PLAYER_COLORS.length];

    const dps = Number(player.totalDps) || 0;
    const dpsColor = dps > 0 ? `linear-gradient(90deg, transparent, ${color})` : 'none';
    const damagePercent = player.damagePercent || 0;

    const totalHits = player.totalCount?.total || 0;
    const crit =
      player.totalCount?.critical !== undefined && totalHits > 0
        ? Math.round((player.totalCount.critical / totalHits) * 100)
        : 0;
    const lucky =
      player.totalCount?.lucky !== undefined && totalHits > 0
        ? Math.round((player.totalCount.lucky / totalHits) * 100)
        : 0;
    const peak = player.realtimeDpsMax || 0;

    const hpPercent = ((player.hp || 0) / (player.maxHp || 1)) * 100;
    const hpColor = this.getHealthColor(hpPercent);

    return `
      <div class="player-bar" data-rank="${player.rank || 0}">
        <div class="progress-fill" style="width: ${damagePercent}%; background: ${dpsColor}"></div>
        <div class="bar-content">
          <div class="skill-analysis-button" data-uid="${player.uid}" title="Skill Analysis">
            <i class="fa-solid fa-chart-line"></i>
          </div>
          <div class="column name-col">
            <span class="player-name">${playerName}</span>
            <div class="additional-stat-row" style="height: 18px; margin-top: 1px; margin-bottom: 1px;">
              <span class="additional-stat-icon" style="color: ${STAT_COLORS.hp}; position: absolute; left: 0; z-index: 2;">❤</span>
              <div class="hp-bar-background">
                <div class="hp-bar-fill" style="width: ${hpPercent}%; background-color: ${hpColor};"></div>
              </div>
              <span class="additional-stat-value" style="width: 100%; text-align: center; font-size: 0.8rem; color: white; text-shadow: 1px 1px 1px black;">${formatStat(player.hp || 0)}/${formatStat(player.maxHp || 0)}</span>
            </div>
            <span class="player-id">${professionName}</span>
          </div>
          <div class="column stats-col" style="margin-left: 40px;">
            <div class="stats-group">
              <div class="stat-row"><span class="stat-value">${formatStat(dps)}</span><span class="stat-label">DPS</span></div>
              <div class="stat-row"><span class="stat-value">${formatStat(player.totalHps || 0)}</span><span class="stat-label" style="color: ${STAT_COLORS.hps};">HPS</span></div>
              <div class="stat-row"><span class="stat-value">${formatStat(player.takenDamage || 0)}</span><span class="stat-label" style="color: ${STAT_COLORS.takenDamage};">DT</span></div>
            </div>
          </div>
          <div class="column icon-col" style="flex-direction: column; justify-content: center; align-items: center; text-align: center; min-width: 65px; position: relative; margin-left: -10px;">
            <img class="class-icon" src="assets/images/icons/${professionIcon}" alt="icon" style="height: 42px; width: 42px;">
            <span style="font-size: 0.8rem; font-weight: 600; color: #fff; background: rgba(0, 0, 0, 0.5); padding: 0 4px; border-radius: 5px; position: absolute; top: 12.5px; left: 50%; transform: translateX(-50%); text-shadow: 0 0 2px rgba(0,0,0,0.7);">${Math.round(damagePercent)}%</span>
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
                <span class="additional-stat-value">${formatStat(player.fightPoint || 0)}</span>
              </div>
              <div class="additional-stat-row">
                <span class="additional-stat-icon">🔥</span>
                <span class="additional-stat-value">${formatStat(player.totalDamage?.total || 0)}</span>
              </div>
              <div class="additional-stat-row">
                <span class="additional-stat-icon" style="color: ${STAT_COLORS.hps};">⛨</span>
                <span class="additional-stat-value">${formatStat(player.totalHealing?.total || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Update lite bar values
   */
  private updateLiteBar(
    wrapper: HTMLElement,
    player: EnrichedCombatData,
    index: number
  ): void {
    const bar = wrapper.querySelector('.lite-bar');
    if (!bar) return;

    const professionIcon = player.professionDetails?.icon || 'unknown.png';
    const color = PLAYER_COLORS[index % PLAYER_COLORS.length];

    let barFillWidth: number;
    let barFillBackground: string;
    let value1: string;
    let value2: string;

    if (this.liteModeType === 'dps') {
      barFillWidth = player.damagePercent || 0;
      barFillBackground =
        (player.totalDps || 0) > 0
          ? `linear-gradient(90deg, transparent, ${color})`
          : 'none';
      value1 = formatStat(player.totalDamage?.total || 0);
      value2 = `${Math.round(barFillWidth)}%`;
    } else if (this.liteModeType === 'healer') {
      barFillWidth = player.healingPercent || 0;
      barFillBackground =
        (player.totalHealing?.total || 0) > 0
          ? `linear-gradient(90deg, transparent, ${STAT_COLORS.hps})`
          : 'none';
      value1 = formatStat(player.totalHealing?.total || 0);
      value2 = `${Math.round(barFillWidth)}%`;
    } else {
      barFillWidth = player.damagePercent || 0;
      barFillBackground =
        (player.takenDamage || 0) > 0
          ? `linear-gradient(90deg, transparent, ${STAT_COLORS.takenDamage})`
          : 'none';
      value1 = formatStat(player.takenDamage || 0);
      value2 = `${Math.round(barFillWidth)}%`;
    }

    // Update elements
    const fillEl = bar.querySelector('.lite-bar-fill') as HTMLElement;
    const iconEl = bar.querySelector('.lite-bar-icon') as HTMLImageElement;
    const nameEl = bar.querySelector('.lite-bar-name') as HTMLElement;
    const damageEl = bar.querySelector('.lite-bar-damage') as HTMLElement;
    const percentEl = bar.querySelector('.lite-bar-percent') as HTMLElement;

    if (fillEl) {
      fillEl.style.width = `${barFillWidth}%`;
      fillEl.style.background = barFillBackground;
    }
    if (iconEl) iconEl.src = `assets/images/icons/${professionIcon}`;
    if (nameEl) nameEl.textContent = player.name?.trim() || 'Unknown';
    if (damageEl) {
      let iconHtml: string;
      if (this.liteModeType === 'dps') {
        iconHtml = "<span style='font-size:1.1em;margin-right:2px;'>🔥</span>";
      } else if (this.liteModeType === 'healer') {
        iconHtml = `<span style='font-size:1.1em;margin-right:2px; color: ${STAT_COLORS.hps}; text-shadow: 0 0 2px white, 0 0 2px white, 0 0 2px white, 0 0 2px white;'>⛨</span>`;
      } else {
        iconHtml = `<span style='font-size:1.1em;margin-right:2px; color: ${STAT_COLORS.takenDamage}; text-shadow: 0 0 2px white, 0 0 2px white, 0 0 2px white, 0 0 2px white;'>🛡</span>`;
      }
      damageEl.innerHTML = `${value1} ${iconHtml}`;
    }
    if (percentEl) percentEl.textContent = value2;
  }

  /**
   * Update advanced bar values
   */
  private updateAdvancedBar(
    wrapper: HTMLElement,
    player: EnrichedCombatData,
    index: number
  ): void {
    const bar = wrapper.querySelector('.player-bar');
    if (!bar) return;

    const professionName = getProfessionName(player.professionDetails);
    const professionIcon = player.professionDetails?.icon || 'unknown.png';

    // Debug logging to see what data we're receiving
    console.log(`[DPSTable] Full player data for ${player.name}:`, player);

    const color = PLAYER_COLORS[index % PLAYER_COLORS.length];

    const dps = Number(player.totalDps) || 0;
    const dpsColor = dps > 0 ? `linear-gradient(90deg, transparent, ${color})` : 'none';
    const damagePercent = player.damagePercent || 0;

    const totalHits = player.totalCount?.total || 0;
    const crit =
      player.totalCount?.critical !== undefined && totalHits > 0
        ? Math.round((player.totalCount.critical / totalHits) * 100)
        : 0;
    const lucky =
      player.totalCount?.lucky !== undefined && totalHits > 0
        ? Math.round((player.totalCount.lucky / totalHits) * 100)
        : 0;
    const peak = player.realtimeDpsMax || 0;

    const hpPercent = ((player.hp || 0) / (player.maxHp || 1)) * 100;
    const hpColor = this.getHealthColor(hpPercent);

    // Update elements
    const progressFill = bar.querySelector('.progress-fill') as HTMLElement;
    if (progressFill) {
      progressFill.style.width = `${damagePercent}%`;
      progressFill.style.background = dpsColor;
    }

    // Update player name and profession
    const playerNameEl = bar.querySelector('.player-name') as HTMLElement;
    const professionEl = bar.querySelector('.player-id') as HTMLElement;
    const iconEl = bar.querySelector('.class-icon') as HTMLImageElement;

    if (playerNameEl) playerNameEl.textContent = player.name?.trim() || 'Unknown';
    if (professionEl) professionEl.textContent = professionName;
    if (iconEl) {
      const newIconSrc = `assets/images/icons/${professionIcon}`;
      iconEl.src = newIconSrc;
    } else {
      console.warn(`[DPSTable] Could not find .class-icon element for player ${player.name}`);
    }

    // Update percentage overlay on icon
    const iconCol = bar.querySelector('.icon-col');
    const percentOverlay = iconCol?.querySelector('span') as HTMLElement;
    if (percentOverlay) {
      percentOverlay.textContent = `${Math.round(damagePercent)}%`;
    }

    // Update HP bar
    const hpFill = bar.querySelector('.hp-bar-fill') as HTMLElement;
    if (hpFill) {
      hpFill.style.width = `${hpPercent}%`;
      hpFill.style.backgroundColor = hpColor;
    }

    // Update stat values
    const statValues = bar.querySelectorAll('.stat-value');
    if (statValues[0]) statValues[0].textContent = formatStat(dps);
    if (statValues[1]) statValues[1].textContent = formatStat(player.totalHps || 0);
    if (statValues[2]) statValues[2].textContent = formatStat(player.takenDamage || 0);
    if (statValues[3]) statValues[3].textContent = `${crit}%`;
    if (statValues[4]) statValues[4].textContent = `${lucky}%`;
    if (statValues[5]) statValues[5].textContent = formatStat(peak);

    // Update additional stats (HP, GS, Total Damage, Total Healing)
    const additionalStats = bar.querySelectorAll('.additional-stat-value');
    if (additionalStats[0]) additionalStats[0].textContent = formatStat(player.hp || 0) + '/' + formatStat(player.maxHp || 0);
    if (additionalStats[1]) additionalStats[1].textContent = formatStat(player.fightPoint || 0);
    if (additionalStats[2]) additionalStats[2].textContent = formatStat(player.totalDamage?.total || 0);
    if (additionalStats[3]) additionalStats[3].textContent = formatStat(player.totalHealing?.total || 0);
  }

  /**
   * Reorder bars to match player order
   */
  private reorderBars(players: EnrichedCombatData[]): void {
    const currentBars = Array.from(this.container.querySelectorAll('.player-bar-wrapper'));
    let needsReorder = false;

    for (let i = 0; i < players.length; i++) {
      const uid = String(players[i].uid);
      const currentBar = currentBars[i];
      const currentUid = currentBar
        ?.querySelector('.skill-analysis-button')
        ?.getAttribute('data-uid');

      if (currentUid !== uid) {
        needsReorder = true;
        break;
      }
    }

    if (needsReorder) {
      players.forEach((player) => {
        const uid = String(player.uid);
        const bar = this.playerBars.get(uid);
        if (bar) {
          this.container.appendChild(bar);
        }
      });
    }
  }

  /**
   * Get health bar color based on percentage
   * @param percentage - HP percentage (0-100)
   * @returns Color string for the health bar
   */
  private getHealthColor(percentage: number): string {
    if (percentage > 50) {
      return HEALTH_COLORS.high;
    } else if (percentage > 25) {
      return HEALTH_COLORS.medium;
    } else {
      return HEALTH_COLORS.low;
    }
  }

  /**
   * Set view mode
   */
  public setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  /**
   * Set lite mode type
   */
  public setLiteModeType(type: LiteModeType): void {
    this.liteModeType = type;
  }

  /**
   * Get current view mode
   */
  public getViewMode(): ViewMode {
    return this.viewMode;
  }

  /**
   * Get current lite mode type
   */
  public getLiteModeType(): LiteModeType {
    return this.liteModeType;
  }

  /**
   * Clear all player bars
   */
  public clear(): void {
    this.container.innerHTML = '';
    this.playerBars.clear();
  }

  /**
   * Destroy the component
   */
  public destroy(): void {
    this.clear();
    // Remove event listeners would go here if we stored them
  }
}
