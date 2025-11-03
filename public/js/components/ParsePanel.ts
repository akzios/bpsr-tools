/**
 * ParsePanel Component
 * Parse mode configuration panel with duration slider and export options
 */

import { COLORS } from '@shared/index';

export interface ParsePanelOptions {
  onStart?: (config: ParseConfig) => void;
  onCancel?: () => void;
}

export interface ParseConfig {
  duration: number; // in minutes
  exportToPng: boolean;
}

export type ParseState = 'inactive' | 'waiting' | 'active';

export class ParsePanel {
  private element: HTMLElement;
  private options: ParsePanelOptions;

  private durationSlider: HTMLInputElement;
  private durationDisplay: HTMLElement;
  private exportCheckbox: HTMLInputElement;
  private startButton: HTMLButtonElement;
  private cancelButton: HTMLElement;
  private verifyDropZone: HTMLElement;
  private verifyFileInput: HTMLInputElement;
  private verifyResult: HTMLElement;

  private state: ParseState = 'inactive';

  /**
   * Create a new ParsePanel
   * @param options - Configuration options for parse panel behavior
   */
  constructor(options: ParsePanelOptions = {}) {
    this.options = options;
    this.element = this.createElement();

    // Get references
    this.durationSlider = this.element.querySelector('#parse-duration-slider')!;
    this.durationDisplay = this.element.querySelector('#parse-duration-display')!;
    this.exportCheckbox = this.element.querySelector('#parse-export-checkbox')!;
    this.startButton = this.element.querySelector('#parse-start-btn')!;
    this.cancelButton = this.element.querySelector('#parse-cancel-btn')!;
    this.verifyDropZone = this.element.querySelector('#verify-drop-zone')!;
    this.verifyFileInput = this.element.querySelector('#verify-file-input')!;
    this.verifyResult = this.element.querySelector('#verify-result')!;

    this.attachEventListeners();
  }

  private createElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'parse-panel';
    panel.className = 'collapsible-panel';
    panel.style.display = 'none';

    const content = document.createElement('div');
    content.className = 'panel-content';

    // Duration slider
    const durationLabel = document.createElement('label');
    durationLabel.style.display = 'block';
    durationLabel.style.marginBottom = '12px';
    durationLabel.style.fontSize = '0.85rem';
    durationLabel.innerHTML = `Parse Duration: <span id="parse-duration-display">3</span> min`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'parse-duration-slider';
    slider.min = '1';
    slider.max = '5';
    slider.value = '3';
    slider.step = '1';

    // Export to PNG toggle
    const exportToggle = this.createToggle(
      'parse-export-checkbox',
      'Export to PNG'
    );

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '6px';
    buttonContainer.style.marginTop = '12px';

    const startBtn = document.createElement('button') as HTMLButtonElement;
    startBtn.id = 'parse-start-btn';
    startBtn.className = 'modal-btn confirm';
    startBtn.style.flex = '1';
    startBtn.textContent = 'Start';
    startBtn.type = 'button';

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'parse-cancel-btn';
    cancelBtn.className = 'modal-btn cancel';
    cancelBtn.style.flex = '1';
    cancelBtn.textContent = 'Cancel';

    buttonContainer.appendChild(startBtn);
    buttonContainer.appendChild(cancelBtn);

    // Verification section
    const verificationSection = this.createVerificationSection();

    // Assemble
    content.appendChild(durationLabel);
    content.appendChild(slider);
    content.appendChild(exportToggle);
    content.appendChild(buttonContainer);
    content.appendChild(verificationSection);

    panel.appendChild(content);

    return panel;
  }

  private createToggle(id: string, label: string): HTMLElement {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    container.style.marginTop = '12px';

    const labelElement = document.createElement('span');
    labelElement.style.fontSize = '0.85rem';
    labelElement.style.color = 'var(--text-primary)';
    labelElement.textContent = label;

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(slider);

    container.appendChild(labelElement);
    container.appendChild(toggleLabel);

    return container;
  }

  private createVerificationSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.marginTop = '20px';
    section.style.paddingTop = '16px';
    section.style.borderTop = '1px solid var(--border-default)';

    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.marginBottom = '8px';
    label.style.fontSize = '0.85rem';
    label.style.fontWeight = '600';
    label.textContent = 'Verify PNG Parse';

    const dropZone = document.createElement('div');
    dropZone.id = 'verify-drop-zone';
    dropZone.style.border = '2px dashed var(--border-default)';
    dropZone.style.borderRadius = '6px';
    dropZone.style.padding = '20px';
    dropZone.style.textAlign = 'center';
    dropZone.style.cursor = 'pointer';
    dropZone.style.transition = 'all 0.2s';
    dropZone.style.background = 'var(--surface-base)';

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-file-image';
    icon.style.fontSize = '2rem';
    icon.style.color = 'var(--text-secondary)';
    icon.style.marginBottom = '8px';
    icon.style.display = 'block';

    const text = document.createElement('p');
    text.style.margin = '0';
    text.style.fontSize = '0.85rem';
    text.style.color = 'var(--text-secondary)';
    text.textContent = 'Drop PNG here or click to select';

    dropZone.appendChild(icon);
    dropZone.appendChild(text);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'verify-file-input';
    fileInput.accept = 'image/png';
    fileInput.style.display = 'none';

    const resultDiv = document.createElement('div');
    resultDiv.id = 'verify-result';
    resultDiv.style.marginTop = '12px';
    resultDiv.style.display = 'none';

    section.appendChild(label);
    section.appendChild(dropZone);
    section.appendChild(fileInput);
    section.appendChild(resultDiv);

    return section;
  }

  private attachEventListeners(): void {
    // Duration slider
    this.durationSlider.addEventListener('input', () => {
      this.durationDisplay.textContent = this.durationSlider.value;
    });

    // Start button
    this.startButton.addEventListener('click', () => {
      const config: ParseConfig = {
        duration: parseInt(this.durationSlider.value),
        exportToPng: this.exportCheckbox.checked,
      };
      this.options.onStart?.(config);
    });

    // Cancel button
    this.cancelButton.addEventListener('click', () => {
      this.options.onCancel?.();
    });

    // Verification drop zone
    this.verifyDropZone.addEventListener('click', () => {
      this.verifyFileInput.click();
    });

    this.verifyFileInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.handleVerify(file);
      }
    });

    // Drag and drop
    this.verifyDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.verifyDropZone.style.borderColor = 'var(--brand-primary)';
      this.verifyDropZone.style.background = 'var(--surface-hover)';
    });

    this.verifyDropZone.addEventListener('dragleave', () => {
      this.verifyDropZone.style.borderColor = 'var(--border-default)';
      this.verifyDropZone.style.background = 'var(--surface-base)';
    });

    this.verifyDropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.verifyDropZone.style.borderColor = 'var(--border-default)';
      this.verifyDropZone.style.background = 'var(--surface-base)';

      const file = e.dataTransfer?.files[0];
      if (file && file.type === 'image/png') {
        await this.handleVerify(file);
      }
    });
  }

  /**
   * Handle PNG verification
   */
  private async handleVerify(file: File): Promise<void> {
    // Import verifyPNG dynamically to avoid circular dependency
    const { verifyPNG } = await import('@shared/pngExporter');
    const result = await verifyPNG(file);
    this.showVerifyResult(result.success, result.message);
  }

  /**
   * Show verification result
   */
  private showVerifyResult(success: boolean, message: string): void {
    this.verifyResult.style.display = 'block';
    this.verifyResult.style.padding = '12px';
    this.verifyResult.style.borderRadius = '6px';
    this.verifyResult.style.fontSize = '0.85rem';
    this.verifyResult.style.lineHeight = '1.5';

    if (success) {
      this.verifyResult.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      this.verifyResult.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      this.verifyResult.style.color = COLORS.success;
    } else {
      this.verifyResult.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      this.verifyResult.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      this.verifyResult.style.color = COLORS.error;
    }

    this.verifyResult.innerHTML = message;
  }

  /**
   * Show the parse panel
   */
  public show(): void {
    this.element.style.display = 'flex';
  }

  /**
   * Hide the parse panel
   */
  public hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Get current parse configuration
   * @returns Parse configuration with duration and export settings
   */
  public getConfig(): ParseConfig {
    return {
      duration: parseInt(this.durationSlider.value),
      exportToPng: this.exportCheckbox.checked,
    };
  }

  /**
   * Set parse to waiting state (waiting for player damage)
   */
  public setWaitingState(): void {
    this.state = 'waiting';
    this.startButton.disabled = true;
    this.durationSlider.disabled = true;
    this.exportCheckbox.disabled = true;
    this.startButton.textContent = 'Waiting for damage...';
  }

  /**
   * Set parse to active state (countdown started)
   */
  public setActiveState(): void {
    this.state = 'active';
    this.startButton.disabled = true;
  }

  /**
   * Update countdown display on start button
   */
  public updateCountdown(minutes: number, seconds: number): void {
    if (this.state === 'active') {
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      this.startButton.textContent = `Parsing ${timeStr}`;
    }
  }

  /**
   * Reset parse panel to initial state
   */
  public reset(): void {
    this.state = 'inactive';
    this.startButton.disabled = false;
    this.durationSlider.disabled = false;
    this.exportCheckbox.disabled = false;
    this.startButton.textContent = 'Start';
  }

  /**
   * Get current parse state
   */
  public getState(): ParseState {
    return this.state;
  }

  /**
   * Get the parse panel DOM element
   * @returns The parse panel element
   */
  public getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Remove the parse panel from DOM
   */
  public destroy(): void {
    this.element.remove();
  }
}
