/**
 * GUI Client (Overlay Mode)
 * Main entry point for the GUI overlay view using modern TypeScript components
 * Creates all HTML programmatically - no reliance on HTML templates
 */

import type { CombatData, Settings, LiteModeType } from '@app-types/index';
import {
  DPSTable,
  ControlPanel,
  ResizeHandles,
  LoadingIndicator,
  ParsePanel,
  FilterPanel,
  Modal,
  Button,
} from '@components/index';
import type { EnrichedCombatData, ParseConfig } from '@components/index';
import { createSocketManager } from '@shared/socketManager';
import { setTheme } from '@shared/uiHelpers';
import { API_ENDPOINTS, COLORS } from '@shared/constants';
import { exportParseToPNG } from '@shared/pngExporter';
import { applyMonsterTypeFilter } from '@shared/filterHelper';

/**
 * Gui class manages the overlay view
 */
export class Gui {
  // DOM Elements
  private appContainer: HTMLElement;
  private controlsHeader: HTMLElement;
  private collapsiblePanels: HTMLElement;
  private playerBarsContainer: HTMLElement;

  // Components
  private loadingIndicator: LoadingIndicator;
  private dpsTable: DPSTable;
  private controlPanel: ControlPanel;
  private parsePanel: ParsePanel;
  private filterPanel: FilterPanel;

  // State
  private isPaused: boolean = false;
  private currentTheme: 'light' | 'dark' = 'dark';
  private isElectron: boolean;

  // Parse mode state
  private parseDuration: number = 0; // in seconds
  private parseStartTime: number = 0;
  private parseEndTime: number = 0;
  private parseCountdownInterval: NodeJS.Timeout | null = null;
  private parseDamageCheckInterval: NodeJS.Timeout | null = null;
  private isParseCompleted: boolean = false; // Track if parse just completed

  // Auto-save inactivity timer
  private inactivityTimer: NodeJS.Timeout | null = null;

  /**
   * Create a new Gui instance and initialize the GUI overlay
   */
  constructor(container: HTMLElement) {
    this.isElectron = typeof (window as any).electronAPI !== 'undefined';

    // Create DOM structure in provided container
    this.createDOMStructure(container);

    // Get element references (now inside wrapper)
    this.appContainer = container.querySelector('.dpsmeter-content')!;
    this.controlsHeader = this.appContainer.querySelector('.controls')!;
    this.collapsiblePanels = this.appContainer.querySelector('#collapsible-panels')!;
    this.playerBarsContainer = this.appContainer.querySelector('#player-bars-container')!;

    // Initialize components
    this.initializeSocket();
    this.loadingIndicator = this.initializeLoadingIndicator();
    this.controlPanel = this.initializeControlPanel();
    this.parsePanel = this.initializeParsePanel();
    this.filterPanel = this.initializeFilterPanel();
    this.dpsTable = this.initializeDPSTable();

    // Initialize Electron features (resize handles for frameless window)
    if (this.isElectron) {
      new ResizeHandles({ container: document.body });
    }

    this.initialize();
    this.setupWindowCloseHandler();
    this.setupKeyboardShortcuts();
  }

  /**
   * Create the entire DOM structure programmatically
   */
  private createDOMStructure(container: HTMLElement): void {
    container.innerHTML = ''; // Clear any existing content

    // Create a wrapper to contain all GUI elements (for proper CSS styling)
    const wrapper = document.createElement('div');
    wrapper.className = 'dpsmeter-content';

    // Create controls header
    const header = document.createElement('header');
    header.className = 'controls';
    wrapper.appendChild(header);

    // Create logs section
    const logsSection = document.createElement('div');
    logsSection.id = 'logs-section';
    wrapper.appendChild(logsSection);

    // Create collapsible panels container
    const panelsContainer = document.createElement('div');
    panelsContainer.id = 'collapsible-panels';
    wrapper.appendChild(panelsContainer);

    // Create main content container
    const main = document.createElement('main');
    main.id = 'player-bars-container';
    wrapper.appendChild(main);

    container.appendChild(wrapper);
  }

  /**
   * Initialize the application
   */
  private async initialize(): Promise<void> {
    try {
      await this.loadTheme();
      await this.loadPauseState();

      // Fetch and render any existing data (important when paused)
      await this.fetchAndRenderData();

      this.initializeElectronFeatures();

      console.log('[Gui] Initialized successfully');
    } catch (error) {
      console.error('[Gui] Initialization error:', error);
    }
  }

  /**
   * Initialize Socket.IO connection
   */
  private initializeSocket(): void {
    const socket = createSocketManager();

    socket.on({
      onConnect: () => {
        console.log('[Gui] Connected to server');
        this.loadingIndicator.hide();
      },

      onDisconnect: () => {
        console.log('[Gui] Disconnected from server');
        this.loadingIndicator.show();
      },

      onDataUpdate: (data) => {
        this.handleDataUpdate(data);
      },

      onThemeChanged: (theme) => {
        this.currentTheme = theme;
        setTheme(theme);
      },

      onPauseStateChanged: (paused) => {
        this.isPaused = paused;
        this.controlPanel.setPaused(paused);

        // If unpausing after a parse, clear the parse completed flag
        // since user is continuing combat beyond the parse
        if (!paused && this.isParseCompleted) {
          this.isParseCompleted = false;
          console.log('[Gui] Parse completed flag cleared on unpause (via socket)');
        }
      },

      onCombatCleared: () => {
        this.dpsTable.clear();
      },
    });
  }

  /**
   * Initialize Loading Indicator
   */
  private initializeLoadingIndicator(): LoadingIndicator {
    const indicator = new LoadingIndicator({
      text: 'Waiting for combat data...',
      hint: 'Start a fight to see DPS metrics',
    });
    this.appContainer.appendChild(indicator.getElement());
    indicator.show();
    return indicator;
  }

  /**
   * Initialize DPS Table component
   */
  private initializeDPSTable(): DPSTable {
    return new DPSTable({
      container: this.playerBarsContainer,
      viewMode: 'advanced',
      liteModeType: 'dps',
      onSkillAnalysisClick: (uid) => {
        this.openSkillAnalysis(uid);
      },
    });
  }

  /**
   * Initialize Control Panel
   */
  private initializeControlPanel(): ControlPanel {
    return new ControlPanel(this.controlsHeader, {
      onClear: () => this.handleClear(),
      onPause: (paused: boolean) => this.handlePause(paused),
      onParse: (active: boolean) => this.handleParse(active),
      onSaveSession: () => this.handleSaveSession(),
      onModeToggle: (isLiteMode: boolean) => this.handleModeToggle(isLiteMode),
      onLiteModeTypeToggle: (type: LiteModeType) => this.handleLiteModeTypeToggle(type),
      onFilter: () => this.handleFilterToggle(),
    });
  }

  /**
   * Initialize Parse Panel
   */
  private initializeParsePanel(): ParsePanel {
    const panel = new ParsePanel({
      onStart: (config: ParseConfig) => this.handleParseStart(config),
      onCancel: () => this.handleParseCancel(),
    });
    this.collapsiblePanels.appendChild(panel.getElement());
    return panel;
  }

  /**
   * Initialize Filter Panel
   */
  private initializeFilterPanel(): FilterPanel {
    const panel = new FilterPanel({
      onMonsterFilterChange: (selected: string[]) => {
        console.log('[Gui] Monster filter changed:', selected);
        this.fetchAndRenderData();
      },
      onPlayerSearchChange: (searchTerm: string) => {
        console.log('[Gui] Player search changed:', searchTerm);
        this.controlPanel.setFilterText(searchTerm);
        this.fetchAndRenderData();
      },
    });
    this.collapsiblePanels.appendChild(panel.getElement());
    return panel;
  }

  /**
   * Handle data update from socket
   */
  private handleDataUpdate(data: any, isInitialLoad: boolean = false): void {
    const playerData = data.user || data;
    let players = Object.values(playerData) as CombatData[];

    players = players.filter(
      (u) =>
        (u.totalDamage && u.totalDamage.total > 0) ||
        (u.totalHealing && u.totalHealing.total > 0)
    );

    const originalPlayerCount = players.length;
    let filteredPlayers = this.applyMonsterFilter(players);

    // If paused and no data, keep existing display (don't clear)
    // BUT on initial load, we need to show empty state instead of keeping nothing
    if ((!filteredPlayers || filteredPlayers.length === 0) && this.isPaused && !isInitialLoad) {
      return; // Preserve current state when paused with no data
    }

    if (!filteredPlayers || filteredPlayers.length === 0) {
      this.loadingIndicator.show();
      this.playerBarsContainer.style.display = 'none';

      if (originalPlayerCount > 0 && filteredPlayers.length === 0) {
        this.loadingIndicator.setText('No data matches the current filter');
        this.loadingIndicator.setHint('Adjust your monster type filter to see results');
      } else {
        this.loadingIndicator.setText('Waiting for combat data...');
        this.loadingIndicator.setHint('Start a fight to see DPS metrics');
      }
      return;
    }

    this.loadingIndicator.hide();
    this.playerBarsContainer.style.display = 'flex';

    const enrichedPlayers = this.enrichCombatData(filteredPlayers);
    this.dpsTable.update(enrichedPlayers);

    // Reset inactivity timer when combat data is updated
    this.resetInactivityTimer();
  }

  /**
   * Apply monster type filter to combat data
   */
  private applyMonsterFilter(players: CombatData[]): CombatData[] {
    const selectedFilters = this.filterPanel.getSelectedFilters();

    if (selectedFilters.length === 0) {
      return [];
    }

    if (this.filterPanel.isAllSelected()) {
      return players;
    }

    return applyMonsterTypeFilter(players, selectedFilters);
  }

  /**
   * Apply player search filter
   */
  private applyPlayerSearchFilter(players: CombatData[]): CombatData[] {
    const searchTerm = this.filterPanel.getPlayerSearchTerm();
    if (!searchTerm || searchTerm.trim() === '') {
      return players;
    }

    return players.filter((player) => {
      const playerName = (player.name || '').toLowerCase();
      return playerName.includes(searchTerm);
    });
  }

  /**
   * Enrich combat data with calculated fields
   */
  private enrichCombatData(players: CombatData[]): EnrichedCombatData[] {
    // Apply player search filter
    const filtered = this.applyPlayerSearchFilter(players);

    // Sort based on current lite mode type
    const state = this.controlPanel.getState();
    const sorted = [...filtered].sort((a, b) => {
      if (state.isLiteMode && state.liteModeType === 'healer') {
        // Sort by HPS in healer mode
        const aHealing = a.totalHealing?.total || 0;
        const bHealing = b.totalHealing?.total || 0;
        return bHealing - aHealing;
      } else if (state.isLiteMode && state.liteModeType === 'tank') {
        // Sort by damage taken in tank mode
        const aTaken = a.takenDamage || 0;
        const bTaken = b.takenDamage || 0;
        return bTaken - aTaken;
      } else {
        // Sort by DPS (default for DPS mode and advanced mode)
        const aDamage = a.totalDamage?.total || 0;
        const bDamage = b.totalDamage?.total || 0;
        return bDamage - aDamage;
      }
    });

    const totalDamage = sorted.reduce((sum, p) => sum + (p.totalDamage?.total || 0), 0);
    const totalHealing = sorted.reduce((sum, p) => sum + (p.totalHealing?.total || 0), 0);

    return sorted.map((player, index) => {
      const playerDamage = player.totalDamage?.total || 0;
      const playerHealing = player.totalHealing?.total || 0;

      const damagePercent =
        totalDamage > 0
          ? Math.max(0, Math.min(100, (playerDamage / totalDamage) * 100))
          : 0;
      const healingPercent =
        totalHealing > 0
          ? Math.max(0, Math.min(100, (playerHealing / totalHealing) * 100))
          : 0;

      return {
        ...player,
        rank: index + 1,
        damagePercent,
        healingPercent,
        isLocalPlayer: player.isLocalPlayer || false,
      } as EnrichedCombatData;
    });
  }

  /**
   * Fetch data from API and render
   */
  private async fetchAndRenderData(): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINTS.DATA);
      const result = await response.json();
      const data = result.data || result;

      this.handleDataUpdate(data, true);
    } catch (error) {
      console.error('[Gui] Error fetching data:', error);
    }
  }

  /**
   * Handle clear action
   */
  private async handleClear(): Promise<void> {
    try {
      // Check if auto-save should trigger before clearing
      const { checkAndAutoSave } = await import('@shared/sessionHelpers');
      const isParseActive = this.parseCountdownInterval !== null || this.isParseCompleted;
      const autoSaved = await checkAndAutoSave('onClear', isParseActive);

      if (autoSaved) {
        console.log('[Gui] Session auto-saved before clear');
      }

      // Proceed with clear
      await fetch(API_ENDPOINTS.CLEAR);
      this.dpsTable.clear();
      console.log('[Gui] Meter cleared');

      // Reset parse completed flag since we're starting fresh
      this.isParseCompleted = false;
    } catch (error) {
      console.error('[Gui] Error clearing meter:', error);
    }
  }

  /**
   * Handle save session action
   */
  private async handleSaveSession(): Promise<void> {
    // Detect session type from current combat data
    const { detectCurrentSessionType } = await import('@shared/sessionHelpers');
    // Check if parse is currently active OR just completed
    const isParseActive = this.parseCountdownInterval !== null || this.isParseCompleted;
    const detectedType = await detectCurrentSessionType(isParseActive);

    console.log('[Gui] Detected type for save modal:', detectedType, 'Parse active/completed:', isParseActive);

    // Create modal for session name input with detected type
    const modal: Modal = new Modal({
      title: 'Save Session',
      content: this.createSessionNameInput(detectedType),
      footer: this.createSessionFooter((): Modal => modal),
    });

    modal.open();
  }

  /**
   * Create session name input field
   */
  private createSessionNameInput(defaultType: import('@app-types/index').SessionType = 'Open World'): HTMLElement {
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
    input.id = 'gui-session-name-input';
    input.className = 'input-field';
    input.value = '';
    input.placeholder = 'Enter session name...';
    input.autocomplete = 'off';

    nameContainer.appendChild(nameLabel);
    nameContainer.appendChild(input);

    // Session Type Dropdown
    const typeContainer = document.createElement('div');
    const typeLabel = document.createElement('label');
    typeLabel.className = 'input-label';
    typeLabel.textContent = 'Session Type:';

    const select = document.createElement('select');
    select.id = 'gui-session-type-select';
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

    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);

    return container;
  }

  /**
   * Create session footer with Save/Cancel buttons
   */
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
        const input = modal.getBody()?.querySelector('#gui-session-name-input') as HTMLInputElement;
        const select = modal.getBody()?.querySelector('#gui-session-type-select') as HTMLSelectElement;
        const sessionName = input?.value.trim() || undefined;
        const sessionType = select?.value || 'Open World';
        modal.destroy();

        // Save session using the shared helper
        const { saveCurrentSession } = await import('@shared/sessionHelpers');
        const sessionId = await saveCurrentSession(sessionName, sessionType);

        if (sessionId) {
          console.log('[Gui] Session saved successfully:', sessionId);
          // Reset parse completed flag after manual save to prevent double-save on clear
          this.isParseCompleted = false;
        } else {
          this.showErrorModal('Failed to save session. Please try again.');
        }
      },
    });
    this.styleModalButton(saveBtn.getElement(), COLORS.success);

    footer.appendChild(cancelBtn.getElement());
    footer.appendChild(saveBtn.getElement());

    return footer;
  }

  /**
   * Style modal button
   */
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

  /**
   * Show error modal
   */
  private showErrorModal(message: string): void {
    const errorModal: Modal = new Modal({
      title: 'Error',
      content: this.createErrorContent(message),
      footer: this.createErrorFooter((): Modal => errorModal),
    });
    errorModal.open();
  }

  /**
   * Create error modal content
   */
  private createErrorContent(message: string): HTMLElement {
    const container = document.createElement('div');
    container.style.padding = '20px 0';
    container.style.textAlign = 'center';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '16px';

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-circle-exclamation';
    icon.style.fontSize = '48px';
    icon.style.color = COLORS.error;

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

  /**
   * Create error modal footer
   */
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

  /**
   * Handle pause action
   */
  private async handlePause(paused: boolean): Promise<void> {
    try {
      await fetch(API_ENDPOINTS.PAUSE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused }),
      });
      this.isPaused = paused;

      // If unpausing after a parse, clear the parse completed flag
      // since user is continuing combat beyond the parse
      if (!paused && this.isParseCompleted) {
        this.isParseCompleted = false;
        console.log('[Gui] Parse completed flag cleared on unpause');
      }

      console.log('[Gui] Tracking', paused ? 'paused' : 'resumed');
    } catch (error) {
      console.error('[Gui] Error toggling pause:', error);
    }
  }

  /**
   * Handle parse mode toggle
   */
  private handleParse(active: boolean): void {
    console.log('[Gui] Parse mode:', active ? 'active' : 'inactive');

    if (active) {
      this.parsePanel.show();
      this.filterPanel.hide();
    } else {
      this.parsePanel.hide();
    }

    this.updatePanelsContainerClass();
  }

  /**
   * Handle parse start
   */
  private async handleParseStart(config: ParseConfig): Promise<void> {
    console.log('[Gui] Parse started with config:', config);

    this.parseDuration = config.duration * 60; // Convert to seconds

    // Reset parse completed flag for new parse
    this.isParseCompleted = false;

    // Clear current data and ensure tracking is resumed
    await fetch(API_ENDPOINTS.CLEAR);
    await fetch(API_ENDPOINTS.PAUSE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: false }),
    });

    // Set waiting state
    this.parsePanel.setWaitingState();
    this.controlPanel.setParseMode(true, true); // Set parse button to waiting

    // Start polling for player damage
    this.startDamageDetection();
  }

  /**
   * Handle parse cancel
   */
  private async handleParseCancel(): Promise<void> {
    console.log('[Gui] Parse cancelled');
    await this.endParse();
  }

  /**
   * Handle mode toggle (Advanced/Lite)
   */
  private handleModeToggle(isLiteMode: boolean): void {
    this.dpsTable.setViewMode(isLiteMode ? 'lite' : 'advanced');
    console.log('[Gui] View mode:', isLiteMode ? 'Lite' : 'Advanced');
  }

  /**
   * Handle lite mode type toggle (DPS/Healer)
   */
  private handleLiteModeTypeToggle(type: LiteModeType): void {
    this.dpsTable.setLiteModeType(type);
    console.log('[Gui] Lite mode type:', type);
    // Re-render data to apply new sorting based on mode type
    this.fetchAndRenderData();
  }

  /**
   * Handle filter panel toggle
   */
  private handleFilterToggle(): void {
    const isOpen = this.filterPanel.getElement().style.display === 'flex';

    if (isOpen) {
      this.filterPanel.hide();
    } else {
      this.filterPanel.show();
      this.parsePanel.hide();
      this.controlPanel.setParseMode(false);
    }

    this.updatePanelsContainerClass();
  }

  /**
   * Update the collapsible panels container class based on open panels
   */
  private updatePanelsContainerClass(): void {
    const hasOpenPanel =
      this.filterPanel.getElement().style.display === 'flex' ||
      this.parsePanel.getElement().style.display === 'flex';

    if (hasOpenPanel) {
      this.collapsiblePanels.classList.add('has-open-panel');
    } else {
      this.collapsiblePanels.classList.remove('has-open-panel');
    }
  }

  /**
   * Open skill analysis window
   */
  private openSkillAnalysis(uid: string): void {
    const electronAPI = (window as any).electronAPI;
    console.log('[Gui] Opening skill analysis for UID:', uid);
    console.log('[Gui] electronAPI available:', !!electronAPI);
    console.log('[Gui] openSkillAnalysisWindow available:', !!(electronAPI?.openSkillAnalysisWindow));

    if (electronAPI && electronAPI.openSkillAnalysisWindow) {
      console.log('[Gui] Using Electron IPC to open skill analysis');
      electronAPI.openSkillAnalysisWindow(uid);
    } else {
      console.log('[Gui] Using window.open to open skill analysis');
      const width = 1400;
      const height = 1000;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;

      window.open(
        `/skill-analysis.html?uid=${uid}`,
        'skillAnalysis',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    }
  }

  /**
   * Load theme from settings
   */
  private async loadTheme(): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINTS.SETTINGS);
      const result = await response.json();
      const settings: Settings = result.data || result;

      this.currentTheme = (settings.theme as 'light' | 'dark') || 'dark';
      setTheme(this.currentTheme);
    } catch (error) {
      console.error('[Gui] Error loading theme:', error);
      setTheme('dark');
    }
  }

  /**
   * Load pause state from API
   */
  private async loadPauseState(): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINTS.PAUSE);
      const result = await response.json();
      this.isPaused = result.paused || false;
      this.controlPanel.setPaused(this.isPaused);
    } catch (error) {
      console.error('[Gui] Error loading pause state:', error);
    }
  }

  /**
   * Initialize Electron-specific features
   */
  private initializeElectronFeatures(): void {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    // Electron features are now handled by the Header component in app.ts
    // No need to initialize anything here
  }

  /**
   * Start polling for player damage to begin parse countdown
   */
  private startDamageDetection(): void {
    // Clear any existing interval
    if (this.parseDamageCheckInterval) {
      clearInterval(this.parseDamageCheckInterval);
    }

    this.parseDamageCheckInterval = setInterval(async () => {
      if (this.parsePanel.getState() !== 'waiting') return;

      try {
        const response = await fetch(API_ENDPOINTS.DATA);
        const result = await response.json();
        const userData = result.user || result;
        const userArray = Object.values(userData) as any[];

        // Check if local player has dealt damage
        if (userArray.length > 0) {
          // Find local player
          const localPlayer = userArray.find((p) => p.isLocalPlayer === true);

          if (localPlayer && localPlayer.totalDamage && localPlayer.totalDamage.total > 0) {
            console.log('[Gui] Player damage detected, starting countdown');
            this.startParseCountdown();
          }
        }
      } catch (error) {
        console.error('[Gui] Error checking for damage:', error);
      }
    }, 500) as any; // Check every 500ms
  }

  /**
   * Start the parse countdown timer
   */
  private startParseCountdown(): void {
    // Stop damage detection
    if (this.parseDamageCheckInterval) {
      clearInterval(this.parseDamageCheckInterval);
      this.parseDamageCheckInterval = null;
    }

    this.parseStartTime = Date.now();
    this.parseEndTime = this.parseStartTime + this.parseDuration * 1000;

    this.parsePanel.setActiveState();
    this.controlPanel.setParseMode(true, false); // Active, not waiting

    // Update immediately and then every second
    this.updateCountdown();
    this.parseCountdownInterval = setInterval(() => this.updateCountdown(), 1000) as any;
  }

  /**
   * Update countdown display
   */
  private updateCountdown(): void {
    if (this.parsePanel.getState() !== 'active') return;

    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((this.parseEndTime - now) / 1000));

    if (remaining <= 0) {
      this.endParse();
      return;
    }

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    this.parsePanel.updateCountdown(minutes, seconds);
  }

  /**
   * End parse mode and optionally export PNG
   */
  private async endParse(): Promise<void> {
    // Clear intervals
    if (this.parseCountdownInterval) {
      clearInterval(this.parseCountdownInterval);
      this.parseCountdownInterval = null;
    }
    if (this.parseDamageCheckInterval) {
      clearInterval(this.parseDamageCheckInterval);
      this.parseDamageCheckInterval = null;
    }

    const config = this.parsePanel.getConfig();
    const currentState = this.parsePanel.getState();

    // Mark parse as completed (for session type detection)
    this.isParseCompleted = true;

    console.log('[Gui] endParse() called');
    console.log('[Gui] Export to PNG checkbox:', config.exportToPng);
    console.log('[Gui] Parse panel state:', currentState);

    // Export to PNG if enabled
    if (config.exportToPng && this.parsePanel.getState() === 'active') {
      console.log('[Gui] Starting PNG export...');
      await this.exportToPNG();
      console.log('[Gui] PNG export completed');
    } else {
      console.log('[Gui] Skipping PNG export - exportToPng:', config.exportToPng, 'state:', currentState);
    }

    // Automatically pause the DPS meter when parse ends
    if (!this.isPaused) {
      await this.handlePause(true);
      console.log('[Gui] DPS meter automatically paused after parse ended');
    }

    // Reset UI
    this.parsePanel.reset();
    this.controlPanel.setParseMode(false);
    this.parsePanel.hide();
    this.updatePanelsContainerClass();

    console.log('[Gui] Parse ended');
  }

  /**
   * Export current DPS table to PNG
   */
  private async exportToPNG(): Promise<void> {
    try {
      console.log('[Gui] Exporting to PNG...');

      // Fetch current combat data
      const response = await fetch(API_ENDPOINTS.DATA);
      const result = await response.json();
      const userData = result.user || result;
      const combatData = Object.values(userData) as CombatData[];

      // Export to PNG
      await exportParseToPNG(
        combatData,
        this.parseDuration
      );
    } catch (error) {
      console.error('[Gui] Error exporting PNG:', error);
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
        const isParseActive = this.parseCountdownInterval !== null;

        // Note: In modern browsers, we can't prevent the dialog or delay closing,
        // so we do a synchronous save attempt
        await checkAndAutoSave('onWindowClose', isParseActive);
      } catch (error) {
        console.error('[Gui] Error during window close auto-save:', error);
      }
    });

    console.log('[Gui] Window close handler registered');
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', async (event: KeyboardEvent) => {
      // Ctrl+Shift+K - Toggle clickthrough mode
      if (event.ctrlKey && event.shiftKey && event.key === 'K') {
        event.preventDefault();
        await this.toggleClickthrough();
      }
    });
  }

  /**
   * Toggle clickthrough mode
   */
  private async toggleClickthrough(): Promise<void> {
    if (!this.isElectron) return;

    try {
      const electron = (window as any).electron;
      if (!electron || !electron.ipcRenderer) return;

      // Get current settings
      const response = await fetch('/api/settings');
      const settings = await response.json();
      const currentClickthrough = settings.clickthrough || false;

      // Toggle clickthrough
      const newClickthrough = !currentClickthrough;
      await electron.ipcRenderer.invoke('set-clickthrough', newClickthrough);

      // Save to settings
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, clickthrough: newClickthrough }),
      });

      console.log('[Gui] Clickthrough toggled:', newClickthrough);
    } catch (error) {
      console.error('[Gui] Error toggling clickthrough:', error);
    }
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
        console.log('[Gui] Inactivity timeout reached, triggering auto-save');
        const { checkAndAutoSave } = await import('@shared/sessionHelpers');
        const isParseActive = this.parseCountdownInterval !== null;
        await checkAndAutoSave('onInactivity', isParseActive);
      }, inactivityMs);

      console.log(`[Gui] Inactivity timer started: ${inactivityMinutes} minutes`);
    } catch (error) {
      console.error('[Gui] Error starting inactivity timer:', error);
    }
  }

  /**
   * Cleanup and destroy the view
   */
  public destroy(): void {
    // Clear intervals
    if (this.parseCountdownInterval) {
      clearInterval(this.parseCountdownInterval);
      this.parseCountdownInterval = null;
    }
    if (this.parseDamageCheckInterval) {
      clearInterval(this.parseDamageCheckInterval);
      this.parseDamageCheckInterval = null;
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    // Destroy components
    if (this.dpsTable) this.dpsTable.destroy?.();
    if (this.controlPanel) this.controlPanel.destroy?.();
    if (this.parsePanel) this.parsePanel.destroy?.();
    if (this.filterPanel) this.filterPanel.destroy?.();

    console.log('[Gui] Destroyed');
  }
}

// Exported for use in app.ts router
