1/**
 * Toggle Component
 * Reusable toggle switch for boolean states
 */

export interface ToggleOptions {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
}

/**
 * Toggle switch component
 */
export class Toggle {
  private container: HTMLElement;
  private input: HTMLInputElement;
  private onChange?: (checked: boolean) => void;

  constructor(options: ToggleOptions = {}) {
    this.onChange = options.onChange;
    this.container = this.createElement(options);
    this.input = this.container.querySelector('input[type="checkbox"]')!;
  }

  /**
   * Create toggle element
   */
  private createElement(options: ToggleOptions): HTMLElement {
    const container = document.createElement('div');
    container.className = 'toggle-container';

    if (options.className) {
      container.classList.add(options.className);
    }

    const id = `toggle-${Math.random().toString(36).substr(2, 9)}`;

    container.innerHTML = `
      <input type="checkbox" id="${id}" class="toggle-input" ${options.checked ? 'checked' : ''} ${options.disabled ? 'disabled' : ''}>
      <label for="${id}" class="toggle-label">
        <span class="toggle-switch"></span>
        ${options.label ? `<span class="toggle-text">${options.label}</span>` : ''}
      </label>
    `;

    // Add change listener
    const input = container.querySelector('input') as HTMLInputElement;
    input.addEventListener('change', () => {
      this.onChange?.(input.checked);
    });

    return container;
  }

  /**
   * Get checked state
   */
  public isChecked(): boolean {
    return this.input.checked;
  }

  /**
   * Set checked state
   */
  public setChecked(checked: boolean): void {
    this.input.checked = checked;
  }

  /**
   * Toggle checked state
   */
  public toggle(): void {
    this.input.checked = !this.input.checked;
    this.onChange?.(this.input.checked);
  }

  /**
   * Enable toggle
   */
  public enable(): void {
    this.input.disabled = false;
  }

  /**
   * Disable toggle
   */
  public disable(): void {
    this.input.disabled = true;
  }

  /**
   * Update label text
   */
  public setLabel(label: string): void {
    const textEl = this.container.querySelector('.toggle-text');
    if (textEl) {
      textEl.textContent = label;
    }
  }

  /**
   * Get the DOM element
   */
  public getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Destroy the toggle
   */
  public destroy(): void {
    this.container.remove();
  }
}

/**
 * Create a toggle instance
 */
export function createToggle(options: ToggleOptions): Toggle {
  return new Toggle(options);
}
