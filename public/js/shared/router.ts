/**
 * Simple Hash-based Router
 * Manages client-side routing using URL hash (#/route)
 */

export interface RouteConfig {
  path: string;
  handler: (params?: Record<string, string>) => Promise<void> | void;
  title?: string;
  pattern?: RegExp;
  paramNames?: string[];
}

export class Router {
  private routes: Map<string, RouteConfig> = new Map();
  private currentRoute: string = '';
  private defaultRoute: string = '';

  constructor() {
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRouteChange());
    window.addEventListener('load', () => this.handleRouteChange());
  }

  /**
   * Register a route (supports dynamic parameters like /sessions/:id)
   */
  public register(path: string, handler: (params?: Record<string, string>) => Promise<void> | void, title?: string): void {
    const routeConfig: RouteConfig = { path, handler, title };

    // Check if path has dynamic parameters (e.g., :id, :name)
    if (path.includes(':')) {
      const paramNames: string[] = [];
      const patternString = path.replace(/:([^/]+)/g, (_, paramName) => {
        paramNames.push(paramName);
        return '([^/]+)'; // Match any non-slash characters
      });
      routeConfig.pattern = new RegExp(`^${patternString}$`);
      routeConfig.paramNames = paramNames;
    }

    this.routes.set(path, routeConfig);
  }

  /**
   * Set default route (fallback)
   */
  public setDefault(path: string): void {
    this.defaultRoute = path;
  }

  /**
   * Navigate to a route
   */
  public navigate(path: string): void {
    window.location.hash = path;
  }

  /**
   * Get current route path
   */
  public getCurrentRoute(): string {
    return this.currentRoute;
  }

  private async handleRouteChange(): Promise<void> {
    const hash = window.location.hash.slice(1) || '/';

    let route = this.routes.get(hash);
    let params: Record<string, string> = {};

    if (!route) {
      for (const [_, routeConfig] of this.routes) {
        if (routeConfig.pattern && routeConfig.paramNames) {
          const match = hash.match(routeConfig.pattern);
          if (match) {
            route = routeConfig;
            routeConfig.paramNames.forEach((paramName, index) => {
              params[paramName] = match[index + 1];
            });
            break;
          }
        }
      }
    }

    if (route) {
      this.currentRoute = hash;

      if (route.title) {
        document.title = `${route.title} - BPSR Tools`;
      }

      await route.handler(params);

      window.dispatchEvent(new CustomEvent('routechange', { detail: { route: hash, params } }));
    } else if (this.defaultRoute) {
      this.navigate(this.defaultRoute);
    } else {
      console.warn(`[Router] No route found for: ${hash}`);
    }
  }
}

// Export singleton instance
export const router = new Router();
