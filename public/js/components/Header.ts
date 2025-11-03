/**
 * Header Component
 * Application header with logo, title, and controls
 */

import { Button } from '@components/Button';
import { COLORS } from '@shared/constants';
import type { Theme } from '@app-types/index';

export interface HeaderOptions {
  title?: string;
  showLogo?: boolean;
  onThemeToggle?: (theme: Theme) => void;
  onAlwaysOnTopToggle?: (enabled: boolean) => void;
  onSettings?: () => void;
  onClose?: () => void;
  onSidebarToggle?: () => void;
  isElectron?: boolean;
}

export class Header {
  private container: HTMLElement;
  private options: HeaderOptions;
  private theme: Theme = 'dark';
  private isAlwaysOnTop: boolean = false;

  // Button components
  private themeBtn?: Button;
  private alwaysOnTopBtn?: Button;
  private settingsBtn?: Button;
  private closeBtn?: Button;

  constructor(container: HTMLElement, options: HeaderOptions = {}) {
    this.container = container;
    this.options = {
      showLogo: true,
      ...options,
    };

    this.render();
    this.initializeAlwaysOnTopState();
  }

  /**
   * Initialize always-on-top state from actual window state (Electron only)
   */
  private async initializeAlwaysOnTopState(): Promise<void> {
    if (!this.options.isElectron || !this.options.onAlwaysOnTopToggle) return;

    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.getAlwaysOnTop) {
      try {
        const result = await electronAPI.getAlwaysOnTop();
        if (result.success) {
          this.isAlwaysOnTop = result.enabled;
          this.updateAlwaysOnTopButton();
          console.log('[Header] Initialized always-on-top state:', this.isAlwaysOnTop);
        }
      } catch (error) {
        console.error('[Header] Error getting initial always-on-top state:', error);
      }
    }
  }

  /**
   * Render the header
   */
  private render(): void {
    this.container.className = 'app-header';
    this.container.innerHTML = '';

    // Left section: sidebar toggle, logo, and title
    const leftSection = document.createElement('div');
    leftSection.className = 'header-left';

    // Sidebar toggle
    if (this.options.onSidebarToggle) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'sidebar-toggle-btn';
      toggleBtn.title = 'Toggle Sidebar';
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-bars';
      toggleBtn.appendChild(icon);
      toggleBtn.addEventListener('click', () => this.options.onSidebarToggle?.());
      leftSection.appendChild(toggleBtn);
    }

    if (this.options.showLogo) {
      const logo = document.createElement('img');
      logo.src = 'icon.png';
      logo.alt = 'Logo';
      logo.className = 'header-logo';
      leftSection.appendChild(logo);
    }

    if (this.options.title) {
      const title = document.createElement('h1');
      title.className = 'header-title';
      title.textContent = this.options.title;
      leftSection.appendChild(title);
    }

    this.container.appendChild(leftSection);

    // Right section: Controls
    const rightSection = document.createElement('div');
    rightSection.className = 'header-right';

    // Theme toggle
    this.themeBtn = new Button({
      icon: 'fa-solid fa-moon',
      className: 'icon-button',
      title: 'Toggle Light/Dark Mode',
      onClick: () => this.handleThemeToggle(),
    });
    rightSection.appendChild(this.themeBtn.getElement());

    // Always on top (Electron only)
    if (this.options.isElectron && this.options.onAlwaysOnTopToggle) {
      this.alwaysOnTopBtn = new Button({
        icon: 'fa-solid fa-thumbtack',
        className: 'icon-button',
        title: 'Toggle Always on Top',
        onClick: () => this.handleAlwaysOnTopToggle(),
      });
      rightSection.appendChild(this.alwaysOnTopBtn.getElement());
    }

    // Settings
    if (this.options.onSettings) {
      this.settingsBtn = new Button({
        icon: 'fa-solid fa-gear',
        className: 'icon-button',
        title: 'Settings',
        onClick: () => this.options.onSettings?.(),
      });
      rightSection.appendChild(this.settingsBtn.getElement());
    }

    // Close button
    if (this.options.onClose) {
      this.closeBtn = new Button({
        icon: 'fa-solid fa-xmark',
        className: 'icon-button',
        title: 'Close',
        onClick: () => this.options.onClose?.(),
      });
      this.closeBtn.getElement().id = 'close-button';
      rightSection.appendChild(this.closeBtn.getElement());
    }

    this.container.appendChild(rightSection);
  }

  /**
   * Handle theme toggle
   */
  private handleThemeToggle(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.updateThemeButton();
    this.options.onThemeToggle?.(this.theme);
  }

  /**
   * Handle always on top toggle
   */
  private handleAlwaysOnTopToggle(): void {
    this.isAlwaysOnTop = !this.isAlwaysOnTop;
    this.updateAlwaysOnTopButton();
    this.options.onAlwaysOnTopToggle?.(this.isAlwaysOnTop);
  }

  /**
   * Update theme button icon
   */
  private updateThemeButton(): void {
    if (!this.themeBtn) return;

    if (this.theme === 'light') {
      this.themeBtn.setIcon('fa-solid fa-sun');
    } else {
      this.themeBtn.setIcon('fa-solid fa-moon');
    }
  }

  /**
   * Update always on top button
   */
  private updateAlwaysOnTopButton(): void {
    if (!this.alwaysOnTopBtn) return;

    const btnElement = this.alwaysOnTopBtn.getElement();
    if (this.isAlwaysOnTop) {
      btnElement.style.color = COLORS.primary;
      btnElement.title = 'Always on Top: ON (click to disable)';
    } else {
      btnElement.style.color = '';
      btnElement.title = 'Toggle Always on Top';
    }
  }

  /**
   * Set theme programmatically
   */
  public setTheme(theme: Theme): void {
    this.theme = theme;
    this.updateThemeButton();
  }

  /**
   * Set always on top programmatically
   */
  public setAlwaysOnTop(enabled: boolean): void {
    this.isAlwaysOnTop = enabled;
    this.updateAlwaysOnTopButton();
  }

  /**
   * Set title
   */
  public setTitle(title: string): void {
    const titleEl = this.container.querySelector('.header-title') as HTMLElement;
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  /**
   * Get container element
   */
  public getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Destroy the header
   */
  public destroy(): void {
    const buttons = [
      this.themeBtn,
      this.alwaysOnTopBtn,
      this.settingsBtn,
      this.closeBtn,
    ];
    buttons.forEach((btn) => btn?.destroy());
    this.container.innerHTML = '';
  }
}

/**
 * Create a header instance
 */
export function createHeader(container: HTMLElement, options: HeaderOptions = {}): Header {
  return new Header(container, options);
}
