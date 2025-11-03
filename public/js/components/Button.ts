/**
 * Button Component
 * Reusable button with different styles and states
 */

export type ButtonSize = 'small' | 'medium' | 'large';
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error';

export interface ButtonOptions {
  text?: string;
  icon?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
  title?: string;
  id?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
}

/**
 * Button component
 */
export class Button {
  private readonly element: HTMLButtonElement;
  private options: ButtonOptions;

  constructor(options: ButtonOptions = {}) {
    this.options = options;
    this.element = this.createElement();
  }

  /**
   * Create button element
   */
  private createElement(): HTMLButtonElement {
    const button = document.createElement('button');

    // Add base classes
    button.className = this.getClassNames();

    // Set attributes
    if (this.options.id) {
      button.id = this.options.id;
    }

    if (this.options.title) {
      button.title = this.options.title;
    }

    if (this.options.disabled) {
      button.disabled = true;
    }

    // Add content
    if (this.options.icon) {
      const icon = document.createElement('i');
      icon.className = this.options.icon;
      button.appendChild(icon);
    }

    if (this.options.text) {
      const text = this.options.icon
        ? document.createElement('span')
        : document.createTextNode(this.options.text);

      if (this.options.icon) {
        (text as HTMLElement).textContent = this.options.text;
        button.appendChild(text);
      } else {
        button.appendChild(text);
      }
    }

    // Add click handler
    if (this.options.onClick) {
      button.addEventListener('click', this.options.onClick);
    }

    return button;
  }

  /**
   * Get CSS class names based on options
   */
  private getClassNames(): string {
    const classes = ['btn'];

    // Size
    const size = this.options.size || 'medium';
    classes.push(`btn-${size}`);

    // Variant
    if (this.options.variant) {
      classes.push(`btn-${this.options.variant}`);
    }

    // Custom classes
    if (this.options.className) {
      classes.push(this.options.className);
    }

    return classes.join(' ');
  }

  /**
   * Update button text
   */
  public setText(text: string): void {
    this.options.text = text;

    const textNode = this.options.icon
      ? this.element.querySelector('span')
      : this.element.childNodes[0];

    if (textNode) {
      textNode.textContent = text;
    }
  }

  /**
   * Update button icon
   */
  public setIcon(iconClass: string): void {
    const icon = this.element.querySelector('i');
    if (icon) {
      icon.className = iconClass;
    }
  }

  /**
   * Enable button
   */
  public enable(): void {
    this.element.disabled = false;
    this.options.disabled = false;
  }

  /**
   * Disable button
   */
  public disable(): void {
    this.element.disabled = true;
    this.options.disabled = true;
  }

  /**
   * Set loading state
   */
  public setLoading(loading: boolean): void {
    if (loading) {
      this.element.classList.add('loading');
      this.disable();
    } else {
      this.element.classList.remove('loading');
      this.enable();
    }
  }

  /**
   * Add CSS class
   */
  public addClass(className: string): void {
    this.element.classList.add(className);
  }

  /**
   * Remove CSS class
   */
  public removeClass(className: string): void {
    this.element.classList.remove(className);
  }

  /**
   * Toggle CSS class
   */
  public toggleClass(className: string, force?: boolean): void {
    this.element.classList.toggle(className, force);
  }

  /**
   * Get the DOM element
   */
  public getElement(): HTMLButtonElement {
    return this.element;
  }

  /**
   * Destroy the button
   */
  public destroy(): void {
    if (this.options.onClick) {
      this.element.removeEventListener('click', this.options.onClick);
    }
    this.element.remove();
  }
}

/**
 * Create a button instance
 */
export function createButton(options: ButtonOptions): Button {
  return new Button(options);
}
