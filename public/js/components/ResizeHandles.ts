/**
 * ResizeHandles Component
 * Creates resize handles for frameless Electron windows
 */

export interface ResizeHandlesOptions {
  container: HTMLElement;
}

export class ResizeHandles {
  private container: HTMLElement;
  private handles: HTMLElement[] = [];

  /**
   * Create resize handles for Electron frameless window
   * @param options - Configuration with container element
   */
  constructor(options: ResizeHandlesOptions) {
    this.container = options.container;
    this.createHandles();
  }

  /**
   * Create and attach resize handle elements to container
   */
  private createHandles(): void {
    const positions = [
      'top',
      'right',
      'bottom',
      'left',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ];

    positions.forEach((position) => {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-${position}`;
      this.container.appendChild(handle);
      this.handles.push(handle);
    });
  }

  /**
   * Remove all resize handles from DOM
   */
  public destroy(): void {
    this.handles.forEach((handle) => handle.remove());
    this.handles = [];
  }
}
