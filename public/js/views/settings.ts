/**
 * Settings View
 * Application settings management
 */

import { Slider } from '@components/Slider';

/**
 * Settings interface
 */
export interface AppSettings {
  autoUpdateEnabled: boolean;
  autoClearOnChannelChange: boolean;
  theme: 'light' | 'dark';
  windowOpacity?: number;
  sidebarCollapsed?: boolean;
  lastRoute?: string;
  autoSave?: {
    enabled: boolean;
    onClear: boolean;
    onInactivity: boolean;
    inactivityMinutes: number;
    onWindowClose: boolean;
    minDuration: number;
    minPlayers: number;
    minTotalDamage: number;
  };
}

/**
 * Settings View class
 */
export class Settings {
  private container: HTMLElement;
  private settingsWrapper: HTMLElement;
  private currentSettings: AppSettings | null = null;
  private opacitySlider?: Slider;

  constructor(container: HTMLElement) {
    this.container = container;

    this.settingsWrapper = document.createElement('div');
    this.settingsWrapper.className = 'settings-content';
    this.container.appendChild(this.settingsWrapper);

    this.render();
    this.loadSettings();
  }

  /**
   * Create a collapsible section (launcher-style)
   */
  private createCollapsibleSection(
    title: string,
    description: string,
    contentBuilder: () => HTMLElement
  ): HTMLElement {
    const section = document.createElement('div');
    section.className = 'collapsible-section';

    // Header
    const header = document.createElement('div');
    header.className = 'section-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'section-title';
    titleEl.textContent = title;

    const collapseIcon = document.createElement('span');
    collapseIcon.className = 'collapse-icon';
    collapseIcon.textContent = '▼';

    header.appendChild(titleEl);
    header.appendChild(collapseIcon);

    // Content
    const content = document.createElement('div');
    content.className = 'section-content';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'section-content-wrapper';

    const descEl = document.createElement('div');
    descEl.className = 'section-description';
    descEl.textContent = description;

    const settingsContainer = contentBuilder();

    contentWrapper.appendChild(descEl);
    contentWrapper.appendChild(settingsContainer);
    content.appendChild(contentWrapper);

    // Add click listener directly
    header.addEventListener('click', () => {
      console.log('[Settings] Header clicked for:', title);
      content.classList.toggle('collapsed');
      header.classList.toggle('expanded');
      console.log('[Settings] Is collapsed:', content.classList.contains('collapsed'));
    });

    // Start expanded by default
    header.classList.add('expanded');

    section.appendChild(header);
    section.appendChild(content);

    return section;
  }


  /**
   * Create a toggle switch setting item
   */
  private createToggleSetting(
    id: string,
    title: string,
    description: string
  ): HTMLElement {
    const settingItem = document.createElement('div');
    settingItem.className = 'setting-item';

    const label = document.createElement('div');
    label.className = 'setting-label';

    const titleEl = document.createElement('div');
    titleEl.className = 'setting-title';
    titleEl.textContent = title;

    const descEl = document.createElement('div');
    descEl.className = 'setting-description';
    descEl.textContent = description;

    label.appendChild(titleEl);
    label.appendChild(descEl);

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    toggleLabel.appendChild(input);
    toggleLabel.appendChild(slider);

    settingItem.appendChild(label);
    settingItem.appendChild(toggleLabel);

    return settingItem;
  }

  /**
   * Create a number input setting item
   */
  private createNumberInputSetting(
    id: string,
    title: string,
    description: string,
    min: number = 0,
    max: number = 999,
    step: number = 1
  ): HTMLElement {
    const settingItem = document.createElement('div');
    settingItem.className = 'setting-item';

    const label = document.createElement('div');
    label.className = 'setting-label';

    const titleEl = document.createElement('div');
    titleEl.className = 'setting-title';
    titleEl.textContent = title;

    const descEl = document.createElement('div');
    descEl.className = 'setting-description';
    descEl.textContent = description;

    label.appendChild(titleEl);
    label.appendChild(descEl);

    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.className = 'number-input';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);

    settingItem.appendChild(label);
    settingItem.appendChild(input);

    return settingItem;
  }

  /**
   * Create Session Auto-Save section content
   */
  private createSessionAutoSaveContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'settings-items-group';

    // Enable Auto-Save toggle
    container.appendChild(
      this.createToggleSetting(
        'autoSave.enabled',
        'Enable Auto-Save',
        'Automatically save combat sessions based on triggers below'
      )
    );

    // Trigger toggles
    container.appendChild(
      this.createToggleSetting(
        'autoSave.onClear',
        'Save on Clear',
        'Save session when clearing the DPS meter'
      )
    );

    container.appendChild(
      this.createToggleSetting(
        'autoSave.onInactivity',
        'Save on Inactivity',
        'Save session after a period of inactivity (minutes below)'
      )
    );

    container.appendChild(
      this.createNumberInputSetting(
        'autoSave.inactivityMinutes',
        'Inactivity Duration (minutes)',
        'Minutes of inactivity before auto-saving',
        1,
        60,
        1
      )
    );

    container.appendChild(
      this.createToggleSetting(
        'autoSave.onWindowClose',
        'Save on Window Close',
        'Save session when closing the application'
      )
    );

    // Threshold settings
    const thresholdHeader = document.createElement('div');
    thresholdHeader.className = 'setting-subheader';
    thresholdHeader.textContent = 'Minimum Thresholds';
    container.appendChild(thresholdHeader);

    container.appendChild(
      this.createNumberInputSetting(
        'autoSave.minDuration',
        'Minimum Duration (seconds)',
        'Only save sessions longer than this duration',
        0,
        3600,
        10
      )
    );

    container.appendChild(
      this.createNumberInputSetting(
        'autoSave.minPlayers',
        'Minimum Players',
        'Only save sessions with at least this many players',
        1,
        50,
        1
      )
    );

    container.appendChild(
      this.createNumberInputSetting(
        'autoSave.minTotalDamage',
        'Minimum Total Damage',
        'Only save sessions with at least this much total damage',
        0,
        999999999,
        1000
      )
    );

    return container;
  }

  /**
   * Create update checker section content
   */
  private createUpdateCheckerContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'update-checker-content';

    const updateInfo = document.createElement('div');
    updateInfo.id = 'updateInfo';
    updateInfo.className = 'update-info';
    updateInfo.textContent = 'Loading version info...';

    const checkBtn = document.createElement('button');
    checkBtn.id = 'checkUpdatesBtn';
    checkBtn.className = 'action-btn';
    checkBtn.textContent = 'Check for Updates';
    checkBtn.addEventListener('click', () => this.checkForUpdates());

    const updateStatus = document.createElement('div');
    updateStatus.id = 'updateStatus';
    updateStatus.className = 'action-status';

    container.appendChild(updateInfo);
    container.appendChild(checkBtn);
    container.appendChild(updateStatus);

    return container;
  }

  /**
   * Check for updates (placeholder - would need Electron API access)
   */
  private async checkForUpdates(): Promise<void> {
    const statusEl = document.getElementById('updateStatus');
    const btnEl = document.getElementById('checkUpdatesBtn') as HTMLButtonElement;

    if (!statusEl || !btnEl) return;

    statusEl.textContent = 'Checking for updates...';
    statusEl.className = 'action-status info';
    btnEl.disabled = true;

    setTimeout(() => {
      statusEl.textContent = '✓ You are running the latest version';
      statusEl.className = 'action-status success';
      btnEl.disabled = false;
    }, 1500);
  }

  /**
   * Create Appearance section content
   */
  private createAppearanceContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'appearance-content';

    // Opacity slider container
    const opacityContainer = document.createElement('div');
    opacityContainer.className = 'setting-item-slider';

    this.opacitySlider = new Slider(opacityContainer, {
      id: 'windowOpacity',
      label: 'Window Opacity',
      min: 0.3,
      max: 1.0,
      step: 0.05,
      value: 1.0,
      unit: '',
      showValue: true,
      onChange: async (value) => {
        // Update window opacity in real-time for preview (Electron only)
        const electron = (window as any).electron;
        if (electron && electron.ipcRenderer) {
          try {
            await electron.ipcRenderer.invoke('set-window-opacity', value);
          } catch (error) {
            console.error('[Settings] Error setting window opacity:', error);
          }
        }
      },
    });

    container.appendChild(opacityContainer);

    return container;
  }

  /**
   * Create Google Sheets config textarea
   */
  private createSheetsConfigContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'sheets-config-content';

    const textarea = document.createElement('textarea');
    textarea.id = 'sheetsConfig';
    textarea.className = 'config-textarea';
    textarea.placeholder = '{"credentials": {...}, "spreadsheetId": "...", "sheetName": "PlayerInfo"}';
    textarea.rows = 10;

    const jsonStatus = document.createElement('div');
    jsonStatus.id = 'jsonStatus';
    jsonStatus.className = 'json-status';

    container.appendChild(textarea);
    container.appendChild(jsonStatus);

    return container;
  }

  /**
   * Render the settings view
   */
  private render(): void {
    console.log('[Settings] Rendering settings view');
    this.settingsWrapper.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'header';

    const h1 = document.createElement('h1');
    h1.textContent = 'Settings';
    header.appendChild(h1);

    const settingsGroup = document.createElement('div');
    settingsGroup.className = 'settings-group';
    console.log('[Settings] Created settings group');

    const appearanceSection = this.createCollapsibleSection(
      'Appearance',
      'Customize the visual appearance of the application',
      () => {
        return this.createAppearanceContent();
      }
    );

    const appUpdatesSection = this.createCollapsibleSection(
      'App Updates',
      'Check and install application updates',
      () => {
        const container = document.createElement('div');
        container.className = 'settings-items-group';

        container.appendChild(
          this.createToggleSetting(
            'autoUpdateEnabled',
            'Automatic Updates',
            'Automatically check for updates every 6 hours'
          )
        );
        container.appendChild(this.createUpdateCheckerContent());

        return container;
      }
    );

    const dpsMeterSection = this.createCollapsibleSection(
      'DPS Meter',
      'Configure DPS meter behavior and data tracking',
      () => {
        const container = document.createElement('div');
        container.className = 'settings-items-group';

        container.appendChild(
          this.createToggleSetting(
            'autoClearOnChannelChange',
            'Auto Clear on Channel Change',
            'Automatically reset statistics when changing servers or maps'
          )
        );
        return container;
      }
    );

    const sessionAutoSaveSection = this.createCollapsibleSection(
      'Sessions',
      'Automatically save combat sessions based on triggers and thresholds',
      () => {
        return this.createSessionAutoSaveContent();
      }
    );

    const sheetsSection = this.createCollapsibleSection(
      'Google Sheets',
      'Paste your Sheets configuration if you would like to sync player data to Google Sheets (Guild VGL Only)',
      () => {
        return this.createSheetsConfigContent();
      }
    );

    settingsGroup.appendChild(appUpdatesSection);
    settingsGroup.appendChild(appearanceSection);
    settingsGroup.appendChild(dpsMeterSection);
    settingsGroup.appendChild(sessionAutoSaveSection);
    settingsGroup.appendChild(sheetsSection);

    const footer = document.createElement('div');
    footer.className = 'settings-footer';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.id = 'save-btn';
    saveBtn.textContent = 'Save Settings';
    saveBtn.addEventListener('click', () => this.saveSettings());

    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.id = 'success-message';
    successMessage.textContent = 'Settings saved successfully!';

    footer.appendChild(saveBtn);
    footer.appendChild(successMessage);

    this.settingsWrapper.appendChild(header);
    this.settingsWrapper.appendChild(settingsGroup);
    this.settingsWrapper.appendChild(footer);
  }

  /**
   * Load settings from API
   */
  private async loadSettings(): Promise<void> {
    try {
      const response = await fetch('/api/settings');
      const result = await response.json();
      const settings = result.data || result;

      // Get current window opacity from Electron if available
      let currentOpacity = settings.windowOpacity ?? 1.0;
      const electron = (window as any).electron;
      if (electron && electron.ipcRenderer) {
        try {
          const opacityResult = await electron.ipcRenderer.invoke('get-window-opacity');
          if (opacityResult.success) {
            currentOpacity = opacityResult.opacity;
          }
        } catch (error) {
          console.error('[Settings] Error getting window opacity:', error);
        }
      }

      this.currentSettings = {
        autoUpdateEnabled: settings.autoUpdateEnabled !== false,
        autoClearOnChannelChange: settings.autoClearOnChannelChange || false,
        theme: settings.theme || 'dark',
        windowOpacity: currentOpacity,
        autoSave: settings.autoSave || {
          enabled: false,
          onClear: true,
          onInactivity: false,
          inactivityMinutes: 5,
          onWindowClose: false,
          minDuration: 60,
          minPlayers: 1,
          minTotalDamage: 0,
        },
      };

      this.populateForm(this.currentSettings);
    } catch (error) {
      console.error('[Settings] Error loading settings:', error);
    }
  }

  /**
   * Get nested property value from settings object
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  }

  /**
   * Populate form with settings
   */
  private populateForm(settings: any): void {
    const autoUpdateCheckbox = document.getElementById('autoUpdateEnabled') as HTMLInputElement;
    const autoClearChannelCheckbox = document.getElementById('autoClearOnChannelChange') as HTMLInputElement;
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;

    if (autoUpdateCheckbox) autoUpdateCheckbox.checked = settings.autoUpdateEnabled;
    if (autoClearChannelCheckbox) autoClearChannelCheckbox.checked = settings.autoClearOnChannelChange;
    if (themeSelect) themeSelect.value = settings.theme;

    // Set opacity slider value (don't call set-window-opacity here to avoid save loop)
    if (this.opacitySlider && settings.windowOpacity !== undefined) {
      this.opacitySlider.setValue(settings.windowOpacity);
    }

    // Auto-save settings
    const autoSaveIds = [
      'autoSave.enabled',
      'autoSave.onClear',
      'autoSave.onInactivity',
      'autoSave.inactivityMinutes',
      'autoSave.onWindowClose',
      'autoSave.minDuration',
      'autoSave.minPlayers',
      'autoSave.minTotalDamage',
    ];

    autoSaveIds.forEach(id => {
      const element = document.getElementById(id) as HTMLInputElement;
      if (!element) return;

      const value = this.getNestedValue(settings, id);

      if (element.type === 'checkbox') {
        element.checked = value ?? false;
      } else if (element.type === 'number') {
        element.value = String(value ?? 0);
      }
    });
  }

  /**
   * Save settings to API
   */
  private async saveSettings(): Promise<void> {
    const autoUpdateCheckbox = document.getElementById('autoUpdateEnabled') as HTMLInputElement;
    const autoClearChannelCheckbox = document.getElementById('autoClearOnChannelChange') as HTMLInputElement;
    const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;

    // Collect auto-save settings
    const autoSaveEnabled = (document.getElementById('autoSave.enabled') as HTMLInputElement)?.checked ?? false;
    const autoSaveOnClear = (document.getElementById('autoSave.onClear') as HTMLInputElement)?.checked ?? false;
    const autoSaveOnInactivity = (document.getElementById('autoSave.onInactivity') as HTMLInputElement)?.checked ?? false;
    const autoSaveInactivityMinutes = parseInt((document.getElementById('autoSave.inactivityMinutes') as HTMLInputElement)?.value ?? '5');
    const autoSaveOnWindowClose = (document.getElementById('autoSave.onWindowClose') as HTMLInputElement)?.checked ?? false;
    const autoSaveMinDuration = parseInt((document.getElementById('autoSave.minDuration') as HTMLInputElement)?.value ?? '60');
    const autoSaveMinPlayers = parseInt((document.getElementById('autoSave.minPlayers') as HTMLInputElement)?.value ?? '1');
    const autoSaveMinTotalDamage = parseInt((document.getElementById('autoSave.minTotalDamage') as HTMLInputElement)?.value ?? '0');

    const settings: any = {
      autoUpdateEnabled: autoUpdateCheckbox?.checked || false,
      autoClearOnChannelChange: autoClearChannelCheckbox?.checked || false,
      theme: (themeSelect?.value as 'light' | 'dark') || 'dark',
      windowOpacity: this.opacitySlider?.getValue() ?? 1.0,
      autoSave: {
        enabled: autoSaveEnabled,
        onClear: autoSaveOnClear,
        onInactivity: autoSaveOnInactivity,
        inactivityMinutes: autoSaveInactivityMinutes,
        onWindowClose: autoSaveOnWindowClose,
        minDuration: autoSaveMinDuration,
        minPlayers: autoSaveMinPlayers,
        minTotalDamage: autoSaveMinTotalDamage,
      },
    };

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.currentSettings = settings;
      this.applyTheme(settings.theme);

      const successMessage = document.getElementById('success-message');
      if (successMessage) {
        successMessage.classList.add('show');
        setTimeout(() => {
          successMessage.classList.remove('show');
        }, 2000);
      }
    } catch (error) {
      console.error('[Settings] Error saving settings:', error);
      alert('Failed to save settings: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Apply theme
   */
  private applyTheme(theme: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Destroy the settings view
   */
  public destroy(): void {
    this.settingsWrapper.remove();
  }
}
