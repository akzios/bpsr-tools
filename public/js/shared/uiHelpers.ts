/**
 * UI Helper Utilities
 * Common DOM manipulation and UI helper functions
 */

/**
 * Query selector with type safety
 * @param selector - CSS selector
 * @returns Element or null
 */
export function $(selector: string): HTMLElement | null {
  return document.querySelector(selector);
}

/**
 * Query all elements with type safety
 * @param selector - CSS selector
 * @returns NodeList of elements
 */
export function $$(selector: string): NodeListOf<HTMLElement> {
  return document.querySelectorAll(selector);
}

/**
 * Create element with optional attributes and children
 * @param tag - HTML tag name
 * @param attributes - Optional attributes object
 * @param children - Optional child elements or text
 * @returns Created element
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes?: Partial<HTMLElementTagNameMap[K]> & { [key: string]: any },
  children?: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        el.className = value as string;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key.startsWith('data-')) {
        el.setAttribute(key, String(value));
      } else if (key in el) {
        (el as any)[key] = value;
      } else {
        el.setAttribute(key, String(value));
      }
    });
  }

  if (children) {
    children.forEach((child) => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    });
  }

  return el;
}

/**
 * Toggle class on element
 * @param element - Target element
 * @param className - Class name to toggle
 * @param force - Optional force value
 */
export function toggleClass(element: HTMLElement, className: string, force?: boolean): void {
  element.classList.toggle(className, force);
}

/**
 * Add class to element
 * @param element - Target element
 * @param className - Class name to add
 */
export function addClass(element: HTMLElement, className: string): void {
  element.classList.add(className);
}

/**
 * Remove class from element
 * @param element - Target element
 * @param className - Class name to remove
 */
export function removeClass(element: HTMLElement, className: string): void {
  element.classList.remove(className);
}

/**
 * Check if element has class
 * @param element - Target element
 * @param className - Class name to check
 * @returns True if element has class
 */
export function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * Show element (display: block)
 * @param element - Target element
 * @param displayType - Display type (default: 'block')
 */
export function show(element: HTMLElement, displayType: string = 'block'): void {
  element.style.display = displayType;
}

/**
 * Hide element (display: none)
 * @param element - Target element
 */
export function hide(element: HTMLElement): void {
  element.style.display = 'none';
}

/**
 * Toggle element visibility
 * @param element - Target element
 * @param displayType - Display type when shown (default: 'block')
 */
export function toggle(element: HTMLElement, displayType: string = 'block'): void {
  if (element.style.display === 'none') {
    show(element, displayType);
  } else {
    hide(element);
  }
}

/**
 * Set attribute on element
 * @param element - Target element
 * @param name - Attribute name
 * @param value - Attribute value
 */
export function setAttr(element: HTMLElement, name: string, value: string): void {
  element.setAttribute(name, value);
}

/**
 * Get attribute from element
 * @param element - Target element
 * @param name - Attribute name
 * @returns Attribute value or null
 */
export function getAttr(element: HTMLElement, name: string): string | null {
  return element.getAttribute(name);
}

/**
 * Remove attribute from element
 * @param element - Target element
 * @param name - Attribute name
 */
export function removeAttr(element: HTMLElement, name: string): void {
  element.removeAttribute(name);
}

/**
 * Set theme on document
 * @param theme - Theme name ('light' or 'dark')
 */
export function setTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Get current theme
 * @returns Current theme ('light' or 'dark')
 */
export function getTheme(): 'light' | 'dark' {
  return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark';
}

/**
 * Get CSS variable value
 * @param varName - CSS variable name (with or without '--' prefix)
 * @param element - Element to get the value from (defaults to :root)
 * @returns CSS variable value
 */
export function getCSSVar(varName: string, element: HTMLElement = document.documentElement): string {
  const name = varName.startsWith('--') ? varName : `--${varName}`;
  return getComputedStyle(element).getPropertyValue(name).trim();
}

/**
 * Set CSS variable value
 * @param varName - CSS variable name (with or without '--' prefix)
 * @param value - Value to set
 * @param element - Element to set the value on (defaults to :root)
 */
export function setCSSVar(varName: string, value: string, element: HTMLElement = document.documentElement): void {
  const name = varName.startsWith('--') ? varName : `--${varName}`;
  element.style.setProperty(name, value);
}

/**
 * Debounce function calls
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;

    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle function calls
 * @param func - Function to throttle
 * @param limit - Limit time in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Wait for element to appear in DOM
 * @param selector - CSS selector
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @returns Promise that resolves with the element
 */
export function waitForElement(selector: string, timeout: number = 5000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const element = $(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = $(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Smooth scroll to element
 * @param element - Target element
 * @param offset - Offset from top in pixels
 */
export function scrollToElement(element: HTMLElement, offset: number = 0): void {
  const elementPosition = element.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - offset;

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth',
  });
}

/**
 * Copy text to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves when copied
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      textArea.remove();
    } catch (error) {
      textArea.remove();
      throw error;
    }
  }
}

/**
 * Get URL parameter
 * @param name - Parameter name
 * @returns Parameter value or null
 */
export function getUrlParam(name: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Set URL parameter without reload
 * @param name - Parameter name
 * @param value - Parameter value
 */
export function setUrlParam(name: string, value: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.pushState({}, '', url.toString());
}
