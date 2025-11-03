/**
 * Container Component
 * Provides reusable layout containers with different variants
 * Supports header, body, and footer sections
 */

export interface ContainerOptions {
  variant?: 'card' | 'panel' | 'section' | 'bare';
  className?: string;
  padding?: 'none' | 'small' | 'medium' | 'large';
  header?: {
    title?: string;
    subtitle?: string;
    actions?: HTMLElement[];
  };
  body?: {
    content?: HTMLElement | HTMLElement[] | string;
    scrollable?: boolean;
    maxHeight?: string;
  };
  footer?: {
    content?: HTMLElement | HTMLElement[];
    align?: 'left' | 'center' | 'right' | 'space-between';
  };
  collapsible?: boolean;
  collapsed?: boolean;
  bordered?: boolean;
  rounded?: boolean;
  shadow?: boolean;
}

/**
 * Container component for layout structure
 */
export class Container {
  private element: HTMLDivElement;
  private options: Required<
    Omit<ContainerOptions, 'header' | 'body' | 'footer'>
  > & {
    header?: ContainerOptions['header'];
    body?: ContainerOptions['body'];
    footer?: ContainerOptions['footer'];
  };

  private headerElement?: HTMLDivElement;
  private bodyElement?: HTMLDivElement;
  private footerElement?: HTMLDivElement;
  private isCollapsed: boolean = false;

  constructor(options: ContainerOptions) {
    this.options = {
      variant: 'card',
      className: '',
      padding: 'medium',
      collapsible: false,
      collapsed: false,
      bordered: true,
      rounded: true,
      shadow: true,
      ...options,
    };

    this.isCollapsed = this.options.collapsed;
    this.element = this.createElement();
  }

  /**
   * Create the container element
   */
  private createElement(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = this.buildClassName();

    // Create header if provided
    if (this.options.header) {
      this.headerElement = this.createHeader();
      container.appendChild(this.headerElement);
    }

    // Create body if provided
    if (this.options.body) {
      this.bodyElement = this.createBody();
      container.appendChild(this.bodyElement);

      // Handle collapsed state
      if (this.isCollapsed && this.bodyElement) {
        this.bodyElement.style.display = 'none';
      }
    }

    // Create footer if provided
    if (this.options.footer) {
      this.footerElement = this.createFooter();
      container.appendChild(this.footerElement);

      // Handle collapsed state
      if (this.isCollapsed && this.footerElement) {
        this.footerElement.style.display = 'none';
      }
    }

    return container;
  }

  /**
   * Build className string based on options
   */
  private buildClassName(): string {
    const classes: string[] = ['container'];

    // Variant
    classes.push(`container--${this.options.variant}`);

    // Padding
    if (this.options.padding !== 'none') {
      classes.push(`container--padding-${this.options.padding}`);
    }

    // Modifiers
    if (this.options.bordered) classes.push('container--bordered');
    if (this.options.rounded) classes.push('container--rounded');
    if (this.options.shadow) classes.push('container--shadow');
    if (this.options.collapsible) classes.push('container--collapsible');
    if (this.isCollapsed) classes.push('container--collapsed');

    // Custom className
    if (this.options.className) {
      classes.push(this.options.className);
    }

    return classes.join(' ');
  }

  /**
   * Create header section
   */
  private createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.className = 'container__header';

    const headerContent = document.createElement('div');
    headerContent.className = 'container__header-content';

    // Title section
    if (
      this.options.header?.title ||
      this.options.header?.subtitle
    ) {
      const titleSection = document.createElement('div');
      titleSection.className = 'container__header-title';

      if (this.options.header.title) {
        const title = document.createElement('h3');
        title.className = 'container__title';
        title.textContent = this.options.header.title;
        titleSection.appendChild(title);
      }

      if (this.options.header.subtitle) {
        const subtitle = document.createElement('p');
        subtitle.className = 'container__subtitle';
        subtitle.textContent = this.options.header.subtitle;
        titleSection.appendChild(subtitle);
      }

      headerContent.appendChild(titleSection);
    }

    // Actions section
    if (
      this.options.header?.actions &&
      this.options.header.actions.length > 0
    ) {
      const actionsSection = document.createElement('div');
      actionsSection.className = 'container__header-actions';

      this.options.header.actions.forEach((action) => {
        actionsSection.appendChild(action);
      });

      headerContent.appendChild(actionsSection);
    }

    header.appendChild(headerContent);

    // Add collapse toggle if collapsible
    if (this.options.collapsible) {
      const collapseIcon = document.createElement('i');
      collapseIcon.className = this.isCollapsed
        ? 'fa-solid fa-chevron-down'
        : 'fa-solid fa-chevron-up';
      collapseIcon.style.cursor = 'pointer';
      collapseIcon.style.marginLeft = 'auto';

      collapseIcon.addEventListener('click', () => {
        this.toggleCollapse();
      });

      headerContent.appendChild(collapseIcon);
    }

    return header;
  }

  /**
   * Create body section
   */
  private createBody(): HTMLDivElement {
    const body = document.createElement('div');
    body.className = 'container__body';

    if (this.options.body?.scrollable) {
      body.style.overflowY = 'auto';
      if (this.options.body.maxHeight) {
        body.style.maxHeight = this.options.body.maxHeight;
      }
    }

    // Add content
    if (this.options.body?.content) {
      const content = this.options.body.content;

      if (typeof content === 'string') {
        body.textContent = content;
      } else if (Array.isArray(content)) {
        content.forEach((child) => body.appendChild(child));
      } else {
        body.appendChild(content);
      }
    }

    return body;
  }

  /**
   * Create footer section
   */
  private createFooter(): HTMLDivElement {
    const footer = document.createElement('div');
    footer.className = 'container__footer';

    const align = this.options.footer?.align || 'right';
    footer.style.display = 'flex';
    footer.style.justifyContent =
      align === 'space-between'
        ? 'space-between'
        : align === 'center'
        ? 'center'
        : align === 'left'
        ? 'flex-start'
        : 'flex-end';

    // Add content
    if (this.options.footer?.content) {
      const content = this.options.footer.content;

      if (Array.isArray(content)) {
        content.forEach((child) => footer.appendChild(child));
      } else {
        footer.appendChild(content);
      }
    }

    return footer;
  }

  /**
   * Toggle collapse state
   */
  public toggleCollapse(): void {
    if (!this.options.collapsible) return;

    this.isCollapsed = !this.isCollapsed;
    this.element.classList.toggle('container--collapsed', this.isCollapsed);

    // Toggle body visibility
    if (this.bodyElement) {
      this.bodyElement.style.display = this.isCollapsed ? 'none' : '';
    }

    // Toggle footer visibility
    if (this.footerElement) {
      this.footerElement.style.display = this.isCollapsed ? 'none' : '';
    }

    // Update collapse icon
    if (this.headerElement) {
      const icon = this.headerElement.querySelector('i.fa-chevron-down, i.fa-chevron-up');
      if (icon) {
        icon.className = this.isCollapsed
          ? 'fa-solid fa-chevron-down'
          : 'fa-solid fa-chevron-up';
      }
    }
  }

  /**
   * Set collapsed state
   */
  public setCollapsed(collapsed: boolean): void {
    if (this.isCollapsed !== collapsed) {
      this.toggleCollapse();
    }
  }

  /**
   * Update header content
   */
  public updateHeader(options: ContainerOptions['header']): void {
    if (!this.headerElement) return;

    this.options.header = options;

    // Recreate header
    const newHeader = this.createHeader();
    this.element.replaceChild(newHeader, this.headerElement);
    this.headerElement = newHeader;
  }

  /**
   * Update body content
   */
  public updateBody(content: HTMLElement | HTMLElement[] | string): void {
    if (!this.bodyElement) {
      // Create body if it doesn't exist
      this.options.body = { content };
      this.bodyElement = this.createBody();

      // Insert before footer if it exists
      if (this.footerElement) {
        this.element.insertBefore(this.bodyElement, this.footerElement);
      } else {
        this.element.appendChild(this.bodyElement);
      }
      return;
    }

    // Clear existing content
    this.bodyElement.innerHTML = '';

    // Add new content
    if (typeof content === 'string') {
      this.bodyElement.textContent = content;
    } else if (Array.isArray(content)) {
      content.forEach((child) => this.bodyElement!.appendChild(child));
    } else {
      this.bodyElement.appendChild(content);
    }
  }

  /**
   * Update footer content
   */
  public updateFooter(options: ContainerOptions['footer']): void {
    if (!this.footerElement) {
      // Create footer if it doesn't exist
      this.options.footer = options;
      this.footerElement = this.createFooter();
      this.element.appendChild(this.footerElement);
      return;
    }

    this.options.footer = options;

    // Recreate footer
    const newFooter = this.createFooter();
    this.element.replaceChild(newFooter, this.footerElement);
    this.footerElement = newFooter;
  }

  /**
   * Add class to container
   */
  public addClass(className: string): void {
    this.element.classList.add(className);
  }

  /**
   * Remove class from container
   */
  public removeClass(className: string): void {
    this.element.classList.remove(className);
  }

  /**
   * Get the container element
   */
  public getElement(): HTMLDivElement {
    return this.element;
  }

  /**
   * Get the body element
   */
  public getBody(): HTMLDivElement | undefined {
    return this.bodyElement;
  }

  /**
   * Get the header element
   */
  public getHeader(): HTMLDivElement | undefined {
    return this.headerElement;
  }

  /**
   * Get the footer element
   */
  public getFooter(): HTMLDivElement | undefined {
    return this.footerElement;
  }

  /**
   * Show the container
   */
  public show(): void {
    this.element.style.display = '';
  }

  /**
   * Hide the container
   */
  public hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Destroy the container
   */
  public destroy(): void {
    this.element.remove();
  }
}

/**
 * Create a container instance
 */
export function createContainer(options: ContainerOptions): Container {
  return new Container(options);
}
