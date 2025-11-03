/**
 * CLI Client (Terminal Mode)
 * Terminal-style Electron window with real-time stats and Google Sheets sync
 */

import type { CombatData } from '@app-types/index';
import { createSocketManager } from '@shared/socketManager';
import {
  formatNumber,
  formatDuration,
  getProfessionName,
  getProfessionColor,
} from '@shared/dataFormatter';
import { COLORS, STAT_COLORS, API_ENDPOINTS } from '@shared/constants';

/**
 * Sync result from Google Sheets API
 */
interface SyncResult {
  total: number;
  new: number;
  updated: number;
}

/**
 * CLI Client class manages terminal view
 */
export class Cli {
  private container: HTMLElement;
  private sheetsConfigured: boolean = false;
  private lastSyncTime: Date | null = null;
  private lastSyncResult: SyncResult | null = null;
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private nextSyncTime: Date | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;
  private terminal: HTMLElement;
  private updateInterval: NodeJS.Timeout | null = null;
  private socket: any;

  constructor(container: HTMLElement) {
    this.container = container;
    console.log('[Cli] Initializing...');

    this.terminal = this.createTerminal();
    this.container.appendChild(this.terminal);

    this.socket = createSocketManager();
    this.initializeSocket();
    this.initialize();
  }

  private createTerminal(): HTMLElement {
    const terminal = document.createElement('div');
    terminal.id = 'terminal';
    terminal.style.cssText = `
      width: 100%;
      height: 100%;
      overflow-y: auto;
      background: #0a0a0a;
      color: #ffffff;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      padding: 20px;
    `;
    return terminal;
  }

  /**
   * Initialize the application
   */
  private async initialize(): Promise<void> {
    try {
      // Check if Google Sheets is configured
      await this.checkSheetsConfigured();

      // Initial update
      await this.updateDisplay();

      // Update every 500ms
      this.updateInterval = setInterval(() => this.updateDisplay(), 500);

      // Setup keyboard handlers
      this.setupKeyboardHandlers();

      // Setup cleanup
      this.setupCleanup();

      console.log('[Cli] Initialized successfully');
    } catch (error) {
      console.error('[Cli] Initialization error:', error);
    }
  }

  /**
   * Initialize Socket.IO connection
   */
  private initializeSocket(): void {
    const socket = createSocketManager();

    socket.on({
      onConnect: () => {
        console.log('[Cli] Connected to server');
      },

      onDisconnect: () => {
        console.log('[Cli] Disconnected from server');
      },

      onDataUpdate: () => {
        this.updateDisplay();
      },
    });
  }

  /**
   * Check if Google Sheets is configured
   */
  private async checkSheetsConfigured(): Promise<void> {
    try {
      const response = await fetch('/api/sheets-configured');
      const result = await response.json();
      if (result.code === 0) {
        this.sheetsConfigured = result.configured;
      }
    } catch (error) {
      console.error('[Cli] Error checking sheets config:', error);
      this.sheetsConfigured = false;
    }
  }

  /**
   * Sync to Google Sheets
   */
  private async syncToSheets(): Promise<void> {
    if (!this.sheetsConfigured) {
      console.log('[Cli] Google Sheets not configured');
      return;
    }

    if (this.isSyncing) {
      console.log('[Cli] Sync already in progress');
      return;
    }

    this.isSyncing = true;
    console.log('[Cli] Syncing to Google Sheets...');

    try {
      const response = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.code === 0) {
        this.lastSyncTime = new Date();
        this.lastSyncResult = {
          total: result.synced || result.total || 0,
          new: result.new || 0,
          updated: result.updated || 0,
        };
        if (this.autoSyncInterval) {
          this.nextSyncTime = new Date(Date.now() + 60000); // 60 seconds from now
        }
        console.log(`[CLIClient] ✓ ${result.msg}`);
        await this.updateDisplay();
      } else {
        console.error(`[CLIClient] ✗ Sync failed: ${result.msg}`);
      }
    } catch (error: any) {
      console.error(`[CLIClient] ✗ Sync error: ${error.message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start auto-sync (every 60 seconds)
   */
  private startAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    if (!this.sheetsConfigured) {
      return;
    }

    console.log('[Cli] Auto-sync enabled (every 60 seconds)');
    this.nextSyncTime = new Date(Date.now() + 60000); // First sync in 60 seconds

    // Update countdown every second
    this.countdownInterval = setInterval(() => {
      this.updateDisplay();
    }, 1000);

    this.autoSyncInterval = setInterval(() => {
      this.syncToSheets();
    }, 60000);
  }

  /**
   * Stop auto-sync
   */
  private stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    this.nextSyncTime = null;
    console.log('[Cli] Auto-sync disabled');
  }

  /**
   * Format time since last sync
   */
  private formatTimeSince(date: Date | null): string {
    if (!date) return 'Never';

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) {
      return `${seconds}s ago`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins}m ago`;
    } else {
      return date.toLocaleTimeString('en-US', {
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }

  /**
   * Format countdown to next sync
   */
  private formatCountdown(): string {
    if (!this.nextSyncTime) return '';

    const seconds = Math.floor((this.nextSyncTime.getTime() - Date.now()) / 1000);

    if (seconds <= 0) {
      return 'Syncing...';
    } else {
      return `Next sync in: ${seconds}s`;
    }
  }

  /**
   * Render HTML table
   */
  private renderTable(data: any): string {
    if (!data || !data.user || Object.keys(data.user).length === 0) {
      return `<div style="color: ${COLORS.gray}; padding: 20px;">
        Waiting for combat data...
      </div>`;
    }

    const userData = data.user;
    const duration = data.data?.duration || 0;
    const durationStr = formatDuration(duration);

    // Convert to array and filter/sort by damage
    let userArray: CombatData[] = Object.values(userData);
    userArray = userArray.filter((u) => u.totalDamage && u.totalDamage.total > 0);
    userArray.sort((a, b) => (b.totalDamage?.total || 0) - (a.totalDamage?.total || 0));

    if (userArray.length === 0) {
      return `<div style="color: ${COLORS.gray}; padding: 20px;">
        Waiting for combat data...
      </div>`;
    }

    let output = `<div style="padding: 20px; font-family: 'Courier New', monospace;">`;
    output += `<div style="color: ${COLORS.primary}; font-weight: bold; font-size: 1.2em; margin-bottom: 10px;">BPSR Tools - CLI Mode</div>`;
    output += `<div style="color: ${COLORS.gray}; margin-bottom: 15px;">Duration: ${durationStr} | Players: ${userArray.length}</div>`;

    output += `<table style="width: 100%; border-collapse: collapse; background: rgba(0,0,0,0.3); border: 2px solid ${COLORS.primary};">`;

    // Header
    output += `<thead><tr style="border-bottom: 2px solid ${COLORS.primary};">`;
    output += `<th style="padding: 10px; text-align: center; color: ${COLORS.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">#</th>`;
    output += `<th style="padding: 10px; text-align: left; color: ${COLORS.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">Name</th>`;
    output += `<th style="padding: 10px; text-align: left; color: ${COLORS.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">Class</th>`;
    output += `<th style="padding: 10px; text-align: right; color: ${COLORS.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">DMG</th>`;
    output += `<th style="padding: 10px; text-align: right; color: ${COLORS.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">DPS</th>`;
    output += `<th style="padding: 10px; text-align: right; color: ${COLORS.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">HPS</th>`;
    output += `<th style="padding: 10px; text-align: right; color: ${COLORS.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">DT</th>`;
    output += `<th style="padding: 10px; text-align: right; color: ${COLORS.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">Crit%</th>`;
    output += `<th style="padding: 10px; text-align: right; color: ${COLORS.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">Lucky%</th>`;
    output += `<th style="padding: 10px; text-align: right; color: ${COLORS.primary}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.2);">Max</th>`;
    output += `<th style="padding: 10px; text-align: right; color: ${COLORS.primary}; font-weight: bold;">GS</th>`;
    output += `</tr></thead>`;

    // Body
    output += `<tbody>`;
    userArray.forEach((user, index) => {
      const rank = index + 1;
      const name = user.name || 'Unknown';
      const profession = getProfessionName(user.professionDetails);
      const profColor = getProfessionColor(user.professionDetails);
      const damage = formatNumber(user.totalDamage?.total || 0);
      const dps = formatNumber(user.totalDps || 0);
      const hps = formatNumber(user.totalHps || 0);
      const dt = formatNumber(user.takenDamage || 0);

      // Calculate crit percentage
      const critPct =
        user.totalCount?.total && user.totalCount.total > 0
          ? ((user.totalCount.critical || 0) / user.totalCount.total * 100).toFixed(1)
          : '0.0';

      // Calculate lucky percentage
      const luckyPct =
        user.totalCount?.total && user.totalCount.total > 0
          ? ((user.totalCount.lucky || 0) / user.totalCount.total * 100).toFixed(1)
          : '0.0';

      const maxHit = formatNumber(
        Math.max(user.totalDamage?.critical || 0, user.totalDamage?.normal || 0)
      );
      const gear = user.fightPoint || 0;

      const rowBg = index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent';
      output += `<tr style="background: ${rowBg}; border-bottom: 1px solid rgba(255,255,255,0.1);">`;
      output += `<td style="padding: 10px; text-align: center; color: ${COLORS.warning}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.1);">${rank}</td>`;
      output += `<td style="padding: 10px; text-align: left; color: ${COLORS.white}; border-right: 1px solid rgba(255,255,255,0.1);">${name}</td>`;
      output += `<td style="padding: 10px; text-align: left; color: ${profColor}; border-right: 1px solid rgba(255,255,255,0.1);">${profession}</td>`;
      output += `<td style="padding: 10px; text-align: right; color: ${STAT_COLORS.dps}; font-weight: bold; border-right: 1px solid rgba(255,255,255,0.1);">${damage}</td>`;
      output += `<td style="padding: 10px; text-align: right; color: ${STAT_COLORS.dps}; border-right: 1px solid rgba(255,255,255,0.1);">${dps}</td>`;
      output += `<td style="padding: 10px; text-align: right; color: ${STAT_COLORS.hps}; border-right: 1px solid rgba(255,255,255,0.1);">${hps}</td>`;
      output += `<td style="padding: 10px; text-align: right; color: ${STAT_COLORS.takenDamage}; border-right: 1px solid rgba(255,255,255,0.1);">${dt}</td>`;
      output += `<td style="padding: 10px; text-align: right; color: ${COLORS.cyan}; border-right: 1px solid rgba(255,255,255,0.1);">${critPct}%</td>`;
      output += `<td style="padding: 10px; text-align: right; color: ${COLORS.info}; border-right: 1px solid rgba(255,255,255,0.1);">${luckyPct}%</td>`;
      output += `<td style="padding: 10px; text-align: right; color: ${COLORS.primary}; border-right: 1px solid rgba(255,255,255,0.1);">${maxHit}</td>`;
      output += `<td style="padding: 10px; text-align: right; color: ${COLORS.white};">${gear}</td>`;
      output += `</tr>`;
    });
    output += `</tbody></table>`;

    // Footer
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true });
    output += `<div style="margin-top: 15px; color: ${COLORS.gray};">Last Update: ${timeStr}</div>`;

    // Sync status (if sheets configured)
    if (this.sheetsConfigured) {
      const lastSyncStr = this.formatTimeSince(this.lastSyncTime);
      output += `<div style="color: ${COLORS.gray};">Last Sync: ${lastSyncStr}`;

      if (this.lastSyncResult) {
        output += ` - <span style="color: ${COLORS.success};">${this.lastSyncResult.total} players</span>`;
        output += ` (<span style="color: ${COLORS.info};">${this.lastSyncResult.new} new</span>`;
        output += `, <span style="color: ${COLORS.warning};">${this.lastSyncResult.updated} updated</span>)`;
      }

      if (this.autoSyncInterval && this.nextSyncTime) {
        const countdownStr = this.formatCountdown();
        output += ` | <span style="color: ${COLORS.info};">${countdownStr}</span>`;
      }

      output += `</div>`;
    }

    // Controls
    output += `<div style="margin-top: 10px; color: ${COLORS.gray};">`;
    if (this.sheetsConfigured) {
      output += `<span style="color: ${COLORS.primary};">[A]</span>uto-sync | <span style="color: ${COLORS.primary};">[S]</span>Sync | `;
    }
    output += `<span style="color: ${COLORS.primary};">[C]</span>lear | `;
    output += `<span style="color: ${COLORS.primary};">Ctrl+C</span> Exit</div>`;

    output += `</div>`;

    return output;
  }

  /**
   * Fetch data and update display
   */
  private async updateDisplay(): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINTS.DATA);
      const result = await response.json();
      if (result.code === 0) {
        this.terminal.innerHTML = this.renderTable(result);
      }
    } catch (error) {
      console.error('[Cli] Error fetching data:', error);
    }
  }

  /**
   * Handle keyboard input
   */
  private handleKeypress(key: string): void {
    if (key === 'c') {
      fetch(API_ENDPOINTS.CLEAR)
        .then(() => {
          this.updateDisplay();
        })
        .catch((err) => console.error('[Cli] Error clearing:', err));
    } else if (key === 's') {
      if (this.sheetsConfigured) {
        this.syncToSheets();
      }
    } else if (key === 'a') {
      if (this.sheetsConfigured) {
        if (this.autoSyncInterval) {
          this.stopAutoSync();
        } else {
          this.startAutoSync();
        }
        this.updateDisplay();
      }
    }
  }

  /**
   * Setup keyboard event handlers
   */
  private setupKeyboardHandlers(): void {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();

      if (e.ctrlKey && key === 'c') {
        e.preventDefault();
        window.close();
        return;
      }

      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        this.handleKeypress(key);
      }
    });
  }

  /**
   * Setup cleanup on window unload
   */
  private setupCleanup(): void {
    window.addEventListener('beforeunload', () => {
      this.destroy();
    });
  }

  /**
   * Cleanup and destroy the CLI view
   */
  public destroy(): void {
    this.stopAutoSync();

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    console.log('[Cli] Destroyed');
  }
}
