/**
 * Sidebar Component
 * Collapsible navigation menu
 */

import { router } from '@shared/router';

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: string;
}

export interface SidebarOptions {
  items: MenuItem[];
  onNavigate?: (item: MenuItem) => void;
  initialCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}

export class Sidebar {
  private container: HTMLElement;
  private options: SidebarOptions;
  private menuContainer?: HTMLElement;
  private collapsed: boolean = false;

  constructor(container: HTMLElement, options: SidebarOptions) {
    this.container = container;
    this.options = options;
    this.collapsed = options.initialCollapsed ?? false;

    this.render();

    // Apply initial collapsed state
    if (this.collapsed) {
      this.container.classList.add('collapsed');
      if (this.menuContainer) {
        this.menuContainer.classList.add('collapsed');
      }
    }

    this.updateActiveItem();

    window.addEventListener('hashchange', () => this.updateActiveItem());
    window.addEventListener('routechange', () => this.updateActiveItem());
  }

  /**
   * Render the sidebar
   */
  private render(): void {
    this.container.className = 'app-sidebar';
    this.container.innerHTML = '';

    this.menuContainer = document.createElement('nav');
    this.menuContainer.className = 'sidebar-menu';
    this.container.appendChild(this.menuContainer);

    this.renderMenuItems();
  }

  /**
   * Render menu items
   */
  private renderMenuItems(): void {
    if (!this.menuContainer) return;

    this.menuContainer.innerHTML = '';

    this.options.items.forEach((item) => {
      if (!this.menuContainer) return;

      const menuItem = document.createElement('a');
      menuItem.className = 'sidebar-menu-item';
      menuItem.href = `#${item.route}`;
      menuItem.dataset.route = item.route;
      menuItem.title = item.label;

      const icon = document.createElement('i');
      icon.className = item.icon;
      menuItem.appendChild(icon);

      menuItem.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate(item.route);
        this.options.onNavigate?.(item);
      });

      this.menuContainer.appendChild(menuItem);
    });
  }

  /**
   * Update active menu item based on current route
   */
  private updateActiveItem(): void {
    if (!this.menuContainer) return;

    const currentRoute = router.getCurrentRoute();
    const menuItems = this.menuContainer.querySelectorAll('.sidebar-menu-item');

    console.log('[Sidebar] Updating active item, current route:', currentRoute);

    menuItems.forEach((item) => {
      const el = item as HTMLElement;
      const route = el.dataset.route;

      if (route === currentRoute) {
        el.classList.add('active');
        console.log('[Sidebar] Set active:', route);
      } else {
        el.classList.remove('active');
      }
    });
  }

  /**
   * Toggle sidebar collapsed state
   */
  public toggle(): void {
    this.collapsed = !this.collapsed;
    this.container.classList.toggle('collapsed', this.collapsed);

    if (this.menuContainer) {
      this.menuContainer.classList.toggle('collapsed', this.collapsed);
    }

    // Notify parent about state change
    this.options.onToggle?.(this.collapsed);
  }

  /**
   * Update menu items
   */
  public setItems(items: MenuItem[]): void {
    this.options.items = items;
    this.renderMenuItems();
    this.updateActiveItem();
  }

  /**
   * Get container element
   */
  public getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Destroy the sidebar
   */
  public destroy(): void {
    window.removeEventListener('hashchange', () => this.updateActiveItem());
    this.container.innerHTML = '';
  }
}

/**
 * Create a sidebar instance
 */
export function createSidebar(container: HTMLElement, options: SidebarOptions): Sidebar {
  return new Sidebar(container, options);
}
