/**
 * ControlPanel Component
 * Manages all control buttons (Clear, Pause, Parse, Mode toggles, Theme, etc.)
 * Creates buttons programmatically using Button components
 */

import { Button } from '@components/Button';
import type { LiteModeType } from '@app-types/index';

export interface ControlPanelOptions {
  onClear?: () => void;
  onPause?: (paused: boolean) => void;
  onParse?: (active: boolean) => void;
  onSaveSession?: () => void;
  onModeToggle?: (isLiteMode: boolean) => void;
  onLiteModeTypeToggle?: (type: LiteModeType) => void;
  onFilter?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onMove?: () => void;
}

export interface ControlPanelState {
  isPaused: boolean;
  isParseMode: boolean;
  isLiteMode: boolean;
  liteModeType: LiteModeType;
}

/**
 * ControlPanel component manages all control buttons
 */
export class ControlPanel {
  private container: HTMLElement;
  private options: ControlPanelOptions;
  private state: ControlPanelState;

  // Button components
  private clearBtn?: Button;
  private pauseBtn?: Button;
  private saveSessionBtn?: Button;
  private parseBtn?: Button;
  private advancedLiteBtn?: Button;
  private liteDpsHealerBtn?: Button;
  private filterBtn?: Button;
  private zoomInBtn?: Button;
  private zoomOutBtn?: Button;
  private moveBtn?: Button;

  constructor(container: HTMLElement, options: ControlPanelOptions) {
    this.options = options;
    this.container = container;

    // Initialize state
    this.state = {
      isPaused: false,
      isParseMode: false,
      isLiteMode: false,
      liteModeType: 'dps',
    };

    this.createButtons();
  }

  /**
   * Create all control buttons programmatically
   */
  private createButtons(): void {
    this.container.innerHTML = '';

    // Save Session button
    this.saveSessionBtn = new Button({
      icon: 'fa-solid fa-floppy-disk',
      size: 'medium',
      className: 'control-button',
      title: 'Save Session',
      onClick: () => this.options.onSaveSession?.(),
    });
    this.saveSessionBtn.addClass('btn-medium');
    this.saveSessionBtn.addClass('btn-success');
    this.container.appendChild(this.saveSessionBtn.getElement());

    this.pauseBtn = new Button({
      icon: 'fa-solid fa-pause',
      size: 'medium',
      className: 'control-button',
      title: 'Pause/Resume Tracking',
      onClick: () => this.handlePauseClick(),
    });
    this.pauseBtn.addClass('btn-medium');
    this.pauseBtn.getElement().id = 'pause-button';
    this.container.appendChild(this.pauseBtn.getElement());

    this.clearBtn = new Button({
      icon: 'fa-solid fa-broom',
      size: 'medium',
      className: 'control-button',
      title: 'Clear Meter',
      onClick: () => this.options.onClear?.(),
    });
    this.clearBtn.addClass('btn-medium');
    this.clearBtn.getElement().id = 'reset-button';
    this.container.appendChild(this.clearBtn.getElement());

    // Parse button
    this.parseBtn = new Button({
      icon: 'fa-solid fa-crosshairs',
      size: 'medium',
      className: 'control-button',
      title: 'Parse Mode',
      onClick: () => this.handleParseClick(),
    });
    this.parseBtn.addClass('btn-medium');
    this.parseBtn.getElement().id = 'parse-button';
    this.container.appendChild(this.parseBtn.getElement());

    // Advanced/Lite toggle
    this.advancedLiteBtn = new Button({
      text: 'Advanced',
      size: 'large',
      className: 'control-button',
      title: 'Toggle Advanced/Lite',
      onClick: () => this.handleModeClick(),
    });
    this.advancedLiteBtn.addClass('btn-large');
    this.container.appendChild(this.advancedLiteBtn.getElement());

    // DPS/Healer toggle (hidden by default)
    this.liteDpsHealerBtn = new Button({
      text: 'DPS',
      size: 'large',
      className: 'control-button mode-dps',
      title: 'Toggle DPS/Healer',
      onClick: () => this.handleLiteModeTypeClick(),
    });
    this.liteDpsHealerBtn.addClass('btn-large');
    this.liteDpsHealerBtn.getElement().style.display = 'none';
    this.container.appendChild(this.liteDpsHealerBtn.getElement());

    // Filter button
    this.filterBtn = new Button({
      id: 'filter-button',
      icon: 'fa-solid fa-filter',
      className: 'control-button',
      title: 'Filter Options',
      onClick: () => this.options.onFilter?.(),
    });
    this.container.appendChild(this.filterBtn.getElement());

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    this.container.appendChild(spacer);

    // Zoom buttons (if callbacks provided)
    if (this.options.onZoomIn) {
      this.zoomInBtn = new Button({
        icon: 'fa-solid fa-magnifying-glass-plus',
        className: 'control-button',
        title: 'Zoom In',
        onClick: () => this.options.onZoomIn?.(),
      });
      this.container.appendChild(this.zoomInBtn.getElement());
    }

    if (this.options.onZoomOut) {
      this.zoomOutBtn = new Button({
        icon: 'fa-solid fa-magnifying-glass-minus',
        className: 'control-button',
        title: 'Zoom Out',
        onClick: () => this.options.onZoomOut?.(),
      });
      this.container.appendChild(this.zoomOutBtn.getElement());
    }

    // Move button
    if (this.options.onMove) {
      this.moveBtn = new Button({
        icon: 'fa-solid fa-up-down-left-right',
        className: 'control-button',
        title: 'Move Window',
        onClick: () => this.options.onMove?.(),
      });
      this.container.appendChild(this.moveBtn.getElement());
    }
  }

  /**
   * Handle pause button click
   */
  private handlePauseClick(): void {
    this.state.isPaused = !this.state.isPaused;
    this.updatePauseButton();
    this.options.onPause?.(this.state.isPaused);
  }

  /**
   * Handle parse button click
   */
  private handleParseClick(): void {
    this.state.isParseMode = !this.state.isParseMode;
    this.updateParseButton();
    this.options.onParse?.(this.state.isParseMode);
  }

  /**
   * Handle mode toggle click
   */
  private handleModeClick(): void {
    this.state.isLiteMode = !this.state.isLiteMode;
    this.updateModeButtons();
    this.options.onModeToggle?.(this.state.isLiteMode);
  }

  /**
   * Handle lite mode type click
   */
  private handleLiteModeTypeClick(): void {
    this.state.liteModeType = this.state.liteModeType === 'dps' ? 'healer' : 'dps';
    this.updateLiteModeTypeButton();
    this.options.onLiteModeTypeToggle?.(this.state.liteModeType);
  }

  /**
   * Update pause button state
   */
  private updatePauseButton(): void {
    if (!this.pauseBtn) return;

    if (this.state.isPaused) {
      this.pauseBtn.addClass('paused');
      this.pauseBtn.setIcon('fa-solid fa-play');
      this.pauseBtn.getElement().title = 'Resume Tracking';
    } else {
      this.pauseBtn.removeClass('paused');
      this.pauseBtn.setIcon('fa-solid fa-pause');
      this.pauseBtn.getElement().title = 'Pause Tracking';
    }
  }

  /**
   * Update parse button state
   */
  private updateParseButton(): void {
    if (!this.parseBtn) return;

    if (this.state.isParseMode) {
      this.parseBtn.addClass('active');
      this.parseBtn.getElement().title = 'Deactivate Parse Mode';
    } else {
      this.parseBtn.removeClass('active');
      this.parseBtn.removeClass('waiting');
      this.parseBtn.getElement().title = 'Parse Mode';
    }
  }

  /**
   * Update Advanced/Lite mode buttons
   */
  private updateModeButtons(): void {
    if (!this.advancedLiteBtn || !this.liteDpsHealerBtn) return;

    if (this.state.isLiteMode) {
      this.advancedLiteBtn.setText('Lite');
      this.advancedLiteBtn.addClass('lite');
      this.liteDpsHealerBtn.getElement().style.display = '';
    } else {
      this.advancedLiteBtn.setText('Advanced');
      this.advancedLiteBtn.removeClass('lite');
      this.liteDpsHealerBtn.getElement().style.display = 'none';
    }
  }

  /**
   * Update Lite mode type button (DPS/Healer)
   */
  private updateLiteModeTypeButton(): void {
    if (!this.liteDpsHealerBtn) return;

    if (this.state.liteModeType === 'dps') {
      this.liteDpsHealerBtn.setText('DPS');
      this.liteDpsHealerBtn.addClass('mode-dps');
      this.liteDpsHealerBtn.removeClass('mode-healer');
    } else {
      this.liteDpsHealerBtn.setText('Healer');
      this.liteDpsHealerBtn.addClass('mode-healer');
      this.liteDpsHealerBtn.removeClass('mode-dps');
    }
  }

  /**
   * Set pause state programmatically
   */
  public setPaused(paused: boolean): void {
    this.state.isPaused = paused;
    this.updatePauseButton();
  }

  /**
   * Set parse mode programmatically
   */
  public setParseMode(active: boolean, waiting: boolean = false): void {
    this.state.isParseMode = active;
    this.updateParseButton();

    if (this.parseBtn && waiting) {
      this.parseBtn.addClass('waiting');
    }
  }

  /**
   * Set view mode programmatically
   */
  public setViewMode(isLiteMode: boolean): void {
    this.state.isLiteMode = isLiteMode;
    this.updateModeButtons();
  }

  /**
   * Set lite mode type programmatically
   */
  public setLiteModeType(type: LiteModeType): void {
    this.state.liteModeType = type;
    this.updateLiteModeTypeButton();
  }

  /**
   * Get current state
   */
  public getState(): ControlPanelState {
    return { ...this.state };
  }

  /**
   * Enable/disable all controls
   */
  public setEnabled(enabled: boolean): void {
    const buttons = [
      this.clearBtn,
      this.pauseBtn,
      this.parseBtn,
      this.advancedLiteBtn,
      this.liteDpsHealerBtn,
      this.filterBtn,
      this.zoomInBtn,
      this.zoomOutBtn,
      this.moveBtn,
    ];

    buttons.forEach((btn) => {
      if (btn) {
        if (enabled) {
          btn.enable();
        } else {
          btn.disable();
        }
      }
    });
  }

  /**
   * Get container element
   */
  public getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Destroy the control panel
   */
  public destroy(): void {
    const buttons = [
      this.clearBtn,
      this.pauseBtn,
      this.parseBtn,
      this.advancedLiteBtn,
      this.liteDpsHealerBtn,
      this.filterBtn,
      this.zoomInBtn,
      this.zoomOutBtn,
      this.moveBtn,
    ];

    buttons.forEach((btn) => btn?.destroy());
    this.container.innerHTML = '';
  }
}

/**
 * Create a control panel instance
 */
export function createControlPanel(
  container: HTMLElement,
  options: ControlPanelOptions
): ControlPanel {
  return new ControlPanel(container, options);
}
