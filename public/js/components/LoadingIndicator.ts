/**
 * LoadingIndicator Component
 * Displays a loading overlay with spinner and messages
 */

export interface LoadingIndicatorOptions {
  text?: string;
  hint?: string;
}

export class LoadingIndicator {
  private element: HTMLElement;
  private textElement: HTMLElement;
  private hintElement: HTMLElement;

  /**
   * Create a new LoadingIndicator
   * @param options - Configuration options for text and hint
   */
  constructor(options: LoadingIndicatorOptions = {}) {
    this.element = this.createElement(options);
    this.textElement = this.element.querySelector('.gui-loading-text')!;
    this.hintElement = this.element.querySelector('.gui-loading-hint')!;
  }

  /**
   * Create the loading overlay DOM structure
   * @param options - Configuration options
   * @returns The loading overlay element
   */
  private createElement(options: LoadingIndicatorOptions): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'loading-indicator';
    overlay.className = 'gui-loading-overlay';
    overlay.style.display = 'none';

    const content = document.createElement('div');
    content.className = 'gui-loading-content';

    const spinner = document.createElement('div');
    spinner.className = 'gui-spinner';

    const text = document.createElement('p');
    text.className = 'gui-loading-text';
    text.textContent = options.text || 'Waiting for combat data...';

    const hint = document.createElement('p');
    hint.className = 'gui-loading-hint';
    hint.textContent = options.hint || 'Start a fight to see DPS metrics';

    content.appendChild(spinner);
    content.appendChild(text);
    content.appendChild(hint);
    overlay.appendChild(content);

    return overlay;
  }

  /**
   * Show the loading indicator
   */
  public show(): void {
    this.element.style.display = 'flex';
  }

  /**
   * Hide the loading indicator
   */
  public hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Update the main loading text
   * @param text - New text to display
   */
  public setText(text: string): void {
    this.textElement.textContent = text;
  }

  /**
   * Update the hint text
   * @param hint - New hint text to display
   */
  public setHint(hint: string): void {
    this.hintElement.textContent = hint;
  }

  /**
   * Get the loading indicator DOM element
   * @returns The loading overlay element
   */
  public getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Remove the loading indicator from DOM
   */
  public destroy(): void {
    this.element.remove();
  }
}
