/**
 * App Shell
 * Main application wrapper with header, sidebar, and routing
 */

import { Header } from '@components/Header';
import { Sidebar } from '@components/Sidebar';
import type { MenuItem } from '@components/Sidebar';
import { router } from '@shared/router';
import { $, setTheme } from '@shared/uiHelpers';
import { WINDOW, ZOOM } from '@shared/constants';
import type { Theme } from '@app-types/index';

// Import route views
import { Gui, Cli, Settings, SessionsView, SessionDetail } from '@views/index';

class App {
  private header?: Header;
  private sidebar?: Sidebar;
  private contentArea?: HTMLElement;
  private currentView?: any;
  private sheetsConfigured: boolean = false;

  constructor() {
    this.init();
  }

  /**
   * Initialize the application
   */
  private async init(): Promise<void> {
    // Create app structure
    this.createAppStructure();

    // Load settings (theme and sidebar state)
    const settings = await this.loadSettings();

    // Check if Google Sheets is configured
    await this.checkSheetsConfigured();

    // Initialize sidebar with saved state
    this.initSidebar(settings.sidebarCollapsed ?? false);

    // Initialize header
    this.initHeader();

    // Register routes
    this.registerRoutes();

    // Apply theme
    setTheme(settings.theme);
    this.header?.setTheme(settings.theme);

    // Apply window opacity (Electron only)
    if (settings.windowOpacity !== undefined) {
      await this.applyWindowOpacity(settings.windowOpacity);
    }

    // Setup automatic scaling based on window resize
    this.setupAutoScaling();

    // Setup route change listener to save route
    window.addEventListener('routechange', (event: Event) => {
      const customEvent = event as CustomEvent;
      const route = customEvent.detail?.route;
      if (route) {
        this.saveRoute(route);
      }
    });

    // Start router - navigate to saved route if no hash in URL
    const currentHash = window.location.hash.slice(1);
    if (!currentHash) {
      // No hash in URL, navigate to saved route
      router.navigate(settings.lastRoute);
    }
    // If hash exists, router will handle it via its hashchange listener
  }

  /**
   * Create the app HTML structure
   */
  private createAppStructure(): void {
    const appContainer = $('#app');
    if (!appContainer) {
      console.error('[App] #app container not found');
      return;
    }

    appContainer.innerHTML = `
      <div class="app-layout">
        <div id="app-sidebar"></div>
        <div id="app-header"></div>
        <div class="app-body">
          <main id="app-content" class="app-content"></main>
        </div>
      </div>
    `;

    this.contentArea = $('#app-content') as HTMLElement;
  }

  /**
   * Initialize header component
   */
  private initHeader(): void {
    const headerContainer = $('#app-header');
    if (!headerContainer) return;

    const isElectron = typeof (window as any).electronAPI !== 'undefined';

    this.header = new Header(headerContainer, {
      title: '',
      showLogo: true,
      onThemeToggle: (theme) => this.handleThemeToggle(theme),
      onAlwaysOnTopToggle: (enabled: boolean) => this.handleAlwaysOnTopToggle(enabled),
      onSidebarToggle: () => this.handleSidebarToggle(),
      onClose: () => this.handleClose(),
      isElectron,
    });
  }

  /**
   * Initialize sidebar component
   */
  private initSidebar(initialCollapsed: boolean): void {
    const sidebarContainer = $('#app-sidebar');
    if (!sidebarContainer) return;

    const menuItems: MenuItem[] = [
      {
        id: 'dpsmeter',
        label: 'dpsmeter',
        icon: 'fa-solid fa-gauge-high',
        route: '/dpsmeter',
      },
      {
        id: 'sessions',
        label: 'Sessions',
        icon: 'fa-solid fa-clock-rotate-left',
        route: '/sessions',
      },
    ];

    if (this.sheetsConfigured) {
      menuItems.push({
        id: 'cli',
        label: 'CLI',
        icon: 'fa-solid fa-terminal',
        route: '/cli',
      });
    }

    menuItems.push({
      id: 'settings',
      label: 'Settings',
      icon: 'fa-solid fa-gear',
      route: '/settings',
    });

    this.sidebar = new Sidebar(sidebarContainer, {
      items: menuItems,
      initialCollapsed,
      onToggle: (collapsed) => this.saveSidebarState(collapsed),
    });
  }

  /**
   * Register application routes
   */
  private registerRoutes(): void {
    router.register('/dpsmeter', async () => {
      await this.loadView('dpsmeter', () => {
        this.currentView = new Gui(this.contentArea!);
      });
    }, 'dpsmeter');

    router.register('/sessions', async () => {
      await this.loadView('sessions', () => {
        this.currentView = new SessionsView(this.contentArea!);
      });
    }, 'Sessions');

    router.register('/sessions/:id', async (params) => {
      const sessionId = parseInt(params?.id || '0', 10);
      await this.loadView('session-detail', () => {
        this.currentView = new SessionDetail(this.contentArea!, sessionId);
      });
    }, 'Session Detail');

    router.register('/cli', async () => {
      await this.loadView('cli', () => {
        this.currentView = new Cli(this.contentArea!);
      });
    }, 'CLI');

    router.register('/settings', async () => {
      await this.loadView('settings', () => {
        this.currentView = new Settings(this.contentArea!);
      });
    }, 'Settings');
  }

  /**
   * Load a view (cleanup current, load new)
   */
  private async loadView(viewName: string, loadFn: () => void): Promise<void> {
    if (!this.contentArea) return;

    // Add exit animation to current content
    this.contentArea.classList.add('view-exit');

    // Wait for exit animation
    await new Promise(resolve => setTimeout(resolve, 200));

    // Cleanup current view
    if (this.currentView && typeof this.currentView.destroy === 'function') {
      this.currentView.destroy();
    }

    // Clear content area
    this.contentArea.innerHTML = '';

    // Remove exit animation
    this.contentArea.classList.remove('view-exit');

    // Load new view
    try {
      loadFn();

      // Add enter animation
      this.contentArea.classList.add('view-enter');

      // Remove enter animation class after animation completes
      setTimeout(() => {
        this.contentArea?.classList.remove('view-enter');
      }, 300);
    } catch (error) {
      console.error(`[App] Error loading view ${viewName}:`, error);
      this.contentArea.innerHTML = `
        <div class="view-error">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: #e74c3c;"></i>
          <h2>Error Loading View</h2>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;

      // Add enter animation even for error view
      this.contentArea.classList.add('view-enter');
      setTimeout(() => {
        this.contentArea?.classList.remove('view-enter');
      }, 300);
    }
  }

  /**
   * Load settings from settings API
   */
  private async loadSettings(): Promise<{ theme: Theme; sidebarCollapsed: boolean; lastRoute: string; windowOpacity?: number }> {
    try {
      const response = await fetch('/api/settings');
      const result = await response.json();
      const settings = result.data || result;

      return {
        theme: settings.theme || 'dark',
        sidebarCollapsed: settings.sidebarCollapsed ?? false,
        lastRoute: settings.lastRoute || '/dpsmeter',
        windowOpacity: settings.windowOpacity,
      };
    } catch (error) {
      console.error('[App] Error loading settings:', error);
      return {
        theme: 'dark',
        sidebarCollapsed: false,
        lastRoute: '/dpsmeter',
      };
    }
  }

  /**
   * Check if Google Sheets is configured
   */
  private async checkSheetsConfigured(): Promise<void> {
    try {
      const response = await fetch('/api/sheets-configured');
      const result = await response.json();
      if (result.code === 0) {
        this.sheetsConfigured = result.configured;
        console.log('[App] Sheets configured:', this.sheetsConfigured);
      }
    } catch (error) {
      console.error('[App] Error checking sheets config:', error);
      this.sheetsConfigured = false;
    }
  }

  /**
   * Save theme to settings API
   */
  private async saveTheme(theme: Theme): Promise<void> {
    try {
      const response = await fetch('/api/settings');
      let settings = await response.json();

      if (settings.data) {
        settings = settings.data;
      }

      settings.theme = theme;
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      console.error('[App] Error saving theme:', error);
    }
  }

  /**
   * Save sidebar state to settings API
   */
  private async saveSidebarState(collapsed: boolean): Promise<void> {
    try {
      const response = await fetch('/api/settings');
      let settings = await response.json();

      if (settings.data) {
        settings = settings.data;
      }

      settings.sidebarCollapsed = collapsed;
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      console.log('[App] Sidebar state saved:', collapsed);
    } catch (error) {
      console.error('[App] Error saving sidebar state:', error);
    }
  }

  /**
   * Save current route to settings API
   * Excludes routes with dynamic IDs (e.g., /sessions/123)
   */
  private async saveRoute(route: string): Promise<void> {
    try {
      // Check if route contains dynamic segments (IDs)
      // Pattern: /path/[number] or /path/[uuid-like]
      const hasDynamicId = /\/\d+$|\/[a-f0-9-]{8,}$/i.test(route);

      if (hasDynamicId) {
        console.log('[App] Skipping route save (contains dynamic ID):', route);
        return; // Don't save routes with dynamic IDs
      }

      const response = await fetch('/api/settings');
      let settings = await response.json();

      if (settings.data) {
        settings = settings.data;
      }

      settings.lastRoute = route;
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      console.log('[App] Route saved:', route);
    } catch (error) {
      console.error('[App] Error saving route:', error);
    }
  }

  /**
   * Apply window opacity (Electron only)
   */
  private async applyWindowOpacity(opacity: number): Promise<void> {
    const electron = (window as any).electron;
    if (electron && electron.ipcRenderer) {
      try {
        await electron.ipcRenderer.invoke('set-window-opacity', opacity);
        console.log('[App] Window opacity set to:', opacity);
      } catch (error) {
        console.error('[App] Error applying window opacity:', error);
      }
    }
  }

  /**
   * Handle theme toggle
   */
  private async handleThemeToggle(theme: Theme): Promise<void> {
    setTheme(theme);
    await this.saveTheme(theme);
  }

  /**
   * Handle always on top toggle
   */
  private async handleAlwaysOnTopToggle(enabled: boolean): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.setAlwaysOnTop) {
      try {
        await electronAPI.setAlwaysOnTop(enabled);
        console.log('[App] Always on top:', enabled);
      } catch (error) {
        console.error('[App] Error setting always on top:', error);
      }
    }
  }

  /**
   * Handle close window
   */
  private handleClose(): void {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.closeWindow) {
      electronAPI.closeWindow();
    }
  }

  /**
   * Handle sidebar toggle
   */
  private handleSidebarToggle(): void {
    if (this.sidebar) {
      this.sidebar.toggle();
    }
  }

  /**
   * Setup automatic scaling based on window resize
   */
  private setupAutoScaling(): void {
    const appElement = $('#app') as HTMLElement;
    if (!appElement) return;

    const handleResize = () => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let scale: number = ZOOM.DEFAULT;

      if (windowWidth < WINDOW.SCALE_DOWN_WIDTH || windowHeight < WINDOW.SCALE_DOWN_HEIGHT) {
        const widthScale = windowWidth / WINDOW.SCALE_DOWN_WIDTH;
        const heightScale = windowHeight / WINDOW.SCALE_DOWN_HEIGHT;
        scale = Math.max(ZOOM.MIN, Math.min(ZOOM.DEFAULT, Math.min(widthScale, heightScale)));
      }

      appElement.style.transform = scale < ZOOM.DEFAULT ? `scale(${scale})` : '';
      appElement.style.transformOrigin = 'top left';
      appElement.style.width = scale < ZOOM.DEFAULT ? `${100 / scale}%` : '';
      appElement.style.height = scale < ZOOM.DEFAULT ? `${100 / scale}%` : '';
    };

    window.addEventListener('resize', handleResize);
    handleResize();
  }

  /**
   * Cleanup and destroy the app
   */
  public destroy(): void {
    // Cleanup current view
    if (this.currentView && typeof this.currentView.destroy === 'function') {
      this.currentView.destroy();
    }

    // Cleanup components
    if (this.header) {
      this.header.destroy();
    }
    if (this.sidebar) {
      this.sidebar.destroy();
    }

    console.log('[App] Destroyed');
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
