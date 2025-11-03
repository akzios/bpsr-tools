/**
 * Collapsible Component
 * Expandable/collapsible content panel with header
 */

export interface CollapsibleOptions {
  title: string;
  content?: string | HTMLElement;
  isOpen?: boolean;
  icon?: string;
  className?: string;
  onToggle?: (isOpen: boolean) => void;
}

/**
 * Collapsible component
 */
export class Collapsible {
  private container: HTMLElement;
  private header: HTMLElement;
  private contentWrapper: HTMLElement;
  private content: HTMLElement;
  private isOpen: boolean;
  private onToggle?: (isOpen: boolean) => void;

  constructor(options: CollapsibleOptions) {
    this.isOpen = options.isOpen ?? false;
    this.onToggle = options.onToggle;
    this.container = this.createElement(options);
    this.header = this.container.querySelector('.collapsible-header')!;
    this.contentWrapper = this.container.querySelector('.collapsible-content-wrapper')!;
    this.content = this.container.querySelector('.collapsible-content')!;

    this.setupEventListeners();
    this.updateState();

    // Recalculate height after DOM is fully rendered
    if (this.isOpen) {
      requestAnimationFrame(() => {
        this.updateState();
      });
    }
  }

  /**
   * Create collapsible element
   */
  private createElement(options: CollapsibleOptions): HTMLElement {
    const container = document.createElement('div');
    container.className = 'collapsible';

    if (options.className) {
      container.classList.add(options.className);
    }

    // Header
    const header = document.createElement('div');
    header.className = 'collapsible-header';

    const icon = document.createElement('i');
    icon.className = options.icon || 'fa-solid fa-chevron-right';
    icon.classList.add('collapsible-icon');
    header.appendChild(icon);

    const title = document.createElement('span');
    title.className = 'collapsible-title';
    title.textContent = options.title;
    header.appendChild(title);

    container.appendChild(header);

    // Content wrapper (for animation)
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'collapsible-content-wrapper';

    const content = document.createElement('div');
    content.className = 'collapsible-content';

    if (options.content) {
      if (typeof options.content === 'string') {
        content.innerHTML = options.content;
      } else {
        content.appendChild(options.content);
      }
    }

    contentWrapper.appendChild(content);
    container.appendChild(contentWrapper);

    return container;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.header.addEventListener('click', () => {
      this.toggle();
    });
  }

  /**
   * Update visual state
   */
  private updateState(): void {
    const icon = this.header.querySelector('.collapsible-icon');

    if (this.isOpen) {
      this.container.classList.add('open');
      icon?.classList.remove('fa-chevron-right');
      icon?.classList.add('fa-chevron-down');
      // Use a large max-height to ensure all content is visible
      // This prevents issues with dynamic content that changes size
      const contentHeight = this.content.scrollHeight;
      this.contentWrapper.style.maxHeight = Math.max(contentHeight, 2000) + 'px';
    } else {
      this.container.classList.remove('open');
      icon?.classList.remove('fa-chevron-down');
      icon?.classList.add('fa-chevron-right');
      this.contentWrapper.style.maxHeight = '0';
    }
  }

  /**
   * Open collapsible
   */
  public open(): void {
    if (this.isOpen) return;

    this.isOpen = true;
    this.updateState();
    this.onToggle?.(true);
  }

  /**
   * Close collapsible
   */
  public close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.updateState();
    this.onToggle?.(false);
  }

  /**
   * Toggle collapsible state
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if collapsible is open
   */
  public isCollapsibleOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Update title
   */
  public setTitle(title: string): void {
    const titleEl = this.header.querySelector('.collapsible-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  /**
   * Update content
   */
  public setContent(content: string | HTMLElement): void {
    if (typeof content === 'string') {
      this.content.innerHTML = content;
    } else {
      this.content.innerHTML = '';
      this.content.appendChild(content);
    }

    // Update max height if open
    if (this.isOpen) {
      this.updateState();
    }
  }

  /**
   * Refresh the collapsible height
   * Useful after content has changed or been dynamically added
   */
  public refresh(): void {
    if (this.isOpen) {
      this.updateState();
    }
  }

  /**
   * Get content element
   */
  public getContent(): HTMLElement {
    return this.content;
  }

  /**
   * Get the DOM element
   */
  public getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Destroy collapsible
   */
  public destroy(): void {
    this.container.remove();
  }
}

/**
 * Create a collapsible instance
 */
export function createCollapsible(options: CollapsibleOptions): Collapsible {
  return new Collapsible(options);
}
