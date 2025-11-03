/**
 * Modal Component
 * Reusable modal dialog with overlay
 */

export interface ModalOptions {
  title?: string;
  content?: string | HTMLElement;
  footer?: HTMLElement;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
  onClose?: () => void;
  onOpen?: () => void;
}

/**
 * Modal component
 */
export class Modal {
  private overlay: HTMLElement;
  private modal: HTMLElement;
  private options: ModalOptions;
  private isOpen: boolean = false;

  constructor(options: ModalOptions = {}) {
    this.options = {
      closeOnOverlayClick: true,
      closeOnEscape: true,
      showCloseButton: true,
      ...options,
    };

    this.overlay = this.createOverlay();
    this.modal = this.createModal();
    this.setupEventListeners();
  }

  /**
   * Create overlay element
   */
  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    // Copy theme from document root
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme) {
      overlay.setAttribute('data-theme', theme);
    }

    overlay.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Create modal element
   */
  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'modal';

    modal.style.cssText = `
      background: var(--surface-raised);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      border: 1px solid var(--border-default);
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transform: scale(0.9);
      opacity: 0;
      transition: transform 0.2s ease, opacity 0.2s ease;
    `;

    if (this.options.className) {
      modal.classList.add(this.options.className);
    }

    // Header
    if (this.options.title || this.options.showCloseButton) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      header.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-default);
      `;

      if (this.options.title) {
        const title = document.createElement('h3');
        title.className = 'modal-title';
        title.textContent = this.options.title;
        title.style.cssText = `
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
        `;
        header.appendChild(title);
      }

      if (this.options.showCloseButton) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.onclick = () => this.close();
        closeBtn.style.cssText = `
          background: transparent;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          font-size: 18px;
          transition: background 0.2s ease, color 0.2s ease;
        `;
        closeBtn.onmouseenter = () => {
          closeBtn.style.background = 'var(--bg-secondary)';
          closeBtn.style.color = 'var(--text-primary)';
        };
        closeBtn.onmouseleave = () => {
          closeBtn.style.background = 'transparent';
          closeBtn.style.color = 'var(--text-secondary)';
        };
        header.appendChild(closeBtn);
      }

      modal.appendChild(header);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.cssText = `
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      color: var(--text-primary);
    `;

    if (this.options.content) {
      if (typeof this.options.content === 'string') {
        body.innerHTML = this.options.content;
      } else {
        body.appendChild(this.options.content);
      }
    }

    modal.appendChild(body);

    // Footer
    if (this.options.footer) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      footer.style.cssText = `
        padding: 16px 24px;
        border-top: 1px solid var(--border-default);
        background: var(--bg-secondary);
      `;
      footer.appendChild(this.options.footer);
      modal.appendChild(footer);
    }

    this.overlay.appendChild(modal);
    return modal;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Close on overlay click
    if (this.options.closeOnOverlayClick) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });
    }

    // Close on Escape key
    if (this.options.closeOnEscape) {
      this.handleEscape = this.handleEscape.bind(this);
    }
  }

  /**
   * Handle Escape key
   */
  private handleEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }

  /**
   * Open modal
   */
  public open(): void {
    if (this.isOpen) return;

    this.overlay.style.display = 'flex';
    this.isOpen = true;

    // Add escape listener
    if (this.options.closeOnEscape) {
      document.addEventListener('keydown', this.handleEscape);
    }

    // Trigger animation
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
      this.modal.style.transform = 'scale(1)';
      this.modal.style.opacity = '1';
    });

    this.options.onOpen?.();
  }

  /**
   * Close modal
   */
  public close(): void {
    if (!this.isOpen) return;

    // Animate out
    this.overlay.style.opacity = '0';
    this.modal.style.transform = 'scale(0.9)';
    this.modal.style.opacity = '0';

    // Wait for animation
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.isOpen = false;
    }, 200);

    // Remove escape listener
    if (this.options.closeOnEscape) {
      document.removeEventListener('keydown', this.handleEscape);
    }

    this.options.onClose?.();
  }

  /**
   * Toggle modal
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Update modal title
   */
  public setTitle(title: string): void {
    const titleEl = this.modal.querySelector('.modal-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  /**
   * Update modal content
   */
  public setContent(content: string | HTMLElement): void {
    const body = this.modal.querySelector('.modal-body');
    if (body) {
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else {
        body.innerHTML = '';
        body.appendChild(content);
      }
    }
  }

  /**
   * Get modal body element
   */
  public getBody(): HTMLElement | null {
    return this.modal.querySelector('.modal-body');
  }

  /**
   * Check if modal is open
   */
  public isModalOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Destroy modal
   */
  public destroy(): void {
    this.close();
    if (this.options.closeOnEscape) {
      document.removeEventListener('keydown', this.handleEscape);
    }
    this.overlay.remove();
  }
}

/**
 * Create a modal instance
 */
export function createModal(options: ModalOptions): Modal {
  return new Modal(options);
}
