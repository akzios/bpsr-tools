/**
 * Filter Component
 * Generic multi-select dropdown filter for any filterable data
 */

export interface FilterOption {
  value: string;
  label: string;
  checked?: boolean;
  icon?: string;
  color?: string;
}

export interface FilterOptions {
  container: HTMLElement;
  options: FilterOption[];
  placeholder?: string;
  onChange?: (selected: string[]) => void;
  storageKey?: string;
  filterButtonId?: string;
  allowSelectAll?: boolean;
  allowDeselectAll?: boolean;
  multiSelect?: boolean;
  closeOnSelect?: boolean;
  showCount?: boolean;
}

/**
 * Generic filter component for multi-select filtering
 */
export class Filter {
  private container: HTMLElement;
  private options: FilterOptions;
  private selectedValues: Set<string>;

  private dropdownButton!: HTMLElement;
  private dropdownMenu!: HTMLElement;
  private buttonText!: HTMLElement;
  private checkboxes: HTMLInputElement[] = [];
  private filterButton?: HTMLElement;

  constructor(options: FilterOptions) {
    this.options = {
      placeholder: 'Select options...',
      allowSelectAll: true,
      allowDeselectAll: true,
      multiSelect: true,
      closeOnSelect: false,
      showCount: true,
      ...options,
    };

    this.container = options.container;
    this.selectedValues = new Set();

    this.initialize();
  }

  /**
   * Initialize the filter component
   */
  private initialize(): void {
    this.createFilterHTML();
    this.setupEventListeners();
    this.loadSavedFilters();
    this.updateButtonText();
  }

  /**
   * Create filter HTML structure
   */
  private createFilterHTML(): void {
    const inputType = this.options.multiSelect ? 'checkbox' : 'radio';
    const selectAllButton =
      this.options.allowSelectAll && this.options.multiSelect
        ? `<button type="button" class="filter-action-button select-all">Select All</button>`
        : '';
    const deselectAllButton =
      this.options.allowDeselectAll && this.options.multiSelect
        ? `<button type="button" class="filter-action-button deselect-all">Deselect All</button>`
        : '';

    this.container.innerHTML = `
      <div class="filter-multiselect-container">
        <button type="button" class="filter-multiselect-button">
          <span class="filter-multiselect-text">${this.options.placeholder}</span>
          <i class="fa-solid fa-chevron-down filter-multiselect-icon"></i>
        </button>
        <div class="filter-multiselect-dropdown" style="display: none;">
          ${selectAllButton || deselectAllButton ? `<div class="filter-actions">${selectAllButton}${deselectAllButton}</div>` : ''}
          <div class="filter-options">
            ${this.options.options
              .map(
                (option) => `
              <label class="filter-checkbox-item">
                <input type="${inputType}" name="filter-${this.getUniqueId()}" value="${option.value}" ${option.checked ? 'checked' : ''}>
                ${option.icon ? `<i class="${option.icon}" style="${option.color ? `color: ${option.color};` : ''}"></i>` : ''}
                <span>${option.label}</span>
              </label>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    // Get element references
    this.dropdownButton = this.container.querySelector('.filter-multiselect-button')!;
    this.dropdownMenu = this.container.querySelector('.filter-multiselect-dropdown')!;
    this.buttonText = this.container.querySelector('.filter-multiselect-text')!;
    this.checkboxes = Array.from(
      this.container.querySelectorAll('input[type="checkbox"], input[type="radio"]')
    ) as HTMLInputElement[];

    // Get filter button reference if provided
    if (this.options.filterButtonId) {
      this.filterButton = document.getElementById(this.options.filterButtonId) || undefined;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Toggle dropdown
    this.dropdownButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });

    // Handle checkbox/radio changes
    this.checkboxes.forEach((input) => {
      input.addEventListener('change', () => {
        this.handleFilterChange();

        // Close dropdown on selection if single-select or closeOnSelect is true
        if (!this.options.multiSelect || this.options.closeOnSelect) {
          this.closeDropdown();
        }
      });
    });

    // Select All button
    const selectAllBtn = this.container.querySelector('.select-all');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectAll();
      });
    }

    // Deselect All button
    const deselectAllBtn = this.container.querySelector('.deselect-all');
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deselectAll();
      });
    }
  }

  /**
   * Generate unique ID for radio button groups
   */
  private getUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Toggle dropdown visibility
   */
  private toggleDropdown(): void {
    const isOpen = this.dropdownMenu.style.display === 'block';
    if (isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  /**
   * Open dropdown
   */
  private openDropdown(): void {
    this.dropdownMenu.style.display = 'block';
    this.dropdownButton.classList.add('open');
  }

  /**
   * Close dropdown
   */
  private closeDropdown(): void {
    this.dropdownMenu.style.display = 'none';
    this.dropdownButton.classList.remove('open');
  }

  /**
   * Handle filter change
   */
  private handleFilterChange(): void {
    const selectedValues = this.getSelectedValues();
    this.selectedValues = new Set(selectedValues);

    // Save to localStorage
    if (this.options.storageKey) {
      localStorage.setItem(this.options.storageKey, JSON.stringify(selectedValues));
    }

    // Update UI
    this.updateButtonText();

    // Trigger callback
    this.options.onChange?.(selectedValues);
  }

  /**
   * Get currently selected values
   */
  private getSelectedValues(): string[] {
    return this.checkboxes
      .filter((input) => input.checked)
      .map((input) => input.value);
  }

  /**
   * Update button text based on selected items
   */
  private updateButtonText(): void {
    const selectedItems = this.checkboxes
      .filter((input) => input.checked)
      .map((input) => {
        const label = input.nextElementSibling?.textContent || input.value;
        return label.trim();
      });

    // Update button text
    if (selectedItems.length === 0) {
      this.buttonText.textContent = 'None Selected';
    } else if (this.options.multiSelect && selectedItems.length === this.checkboxes.length) {
      this.buttonText.textContent = 'All Selected';
    } else if (selectedItems.length === 1) {
      this.buttonText.textContent = selectedItems[0];
    } else if (this.options.showCount && selectedItems.length > 3) {
      this.buttonText.textContent = `${selectedItems.length} selected`;
    } else {
      this.buttonText.textContent = selectedItems.join(', ');
    }

    // Update filter button icon and color
    this.updateFilterButton();
  }

  /**
   * Update filter button visual state
   */
  private updateFilterButton(): void {
    if (!this.filterButton) return;

    const isFiltered =
      this.selectedValues.size > 0 &&
      this.selectedValues.size < this.checkboxes.length;

    if (isFiltered) {
      this.filterButton.classList.add('active');
    } else {
      this.filterButton.classList.remove('active');
    }
  }

  /**
   * Load saved filters from localStorage
   */
  private loadSavedFilters(): void {
    if (!this.options.storageKey) {
      // Initialize with checked options from config
      this.selectedValues = new Set(
        this.options.options.filter((opt) => opt.checked).map((opt) => opt.value)
      );
      return;
    }

    const savedFilters = localStorage.getItem(this.options.storageKey);
    if (savedFilters) {
      try {
        const selectedValues = JSON.parse(savedFilters) as string[];
        this.selectedValues = new Set(selectedValues);

        this.checkboxes.forEach((input) => {
          input.checked = selectedValues.includes(input.value);
        });
      } catch (error) {
        console.error('Failed to load saved filters:', error);
        // Fallback to default checked options
        this.selectedValues = new Set(
          this.options.options.filter((opt) => opt.checked).map((opt) => opt.value)
        );
      }
    } else {
      // Initialize with checked options from config
      this.selectedValues = new Set(
        this.options.options.filter((opt) => opt.checked).map((opt) => opt.value)
      );
    }
  }

  /**
   * Get selected filter values
   */
  public getSelected(): string[] {
    return Array.from(this.selectedValues);
  }

  /**
   * Set selected filter values
   */
  public setSelected(values: string[]): void {
    this.selectedValues = new Set(values);

    this.checkboxes.forEach((input) => {
      input.checked = values.includes(input.value);
    });

    this.updateButtonText();

    // Save to localStorage
    if (this.options.storageKey) {
      localStorage.setItem(this.options.storageKey, JSON.stringify(values));
    }

    // Trigger callback
    this.options.onChange?.(values);
  }

  /**
   * Select all options
   */
  public selectAll(): void {
    const allValues = this.checkboxes.map((input) => input.value);
    this.setSelected(allValues);
  }

  /**
   * Deselect all options
   */
  public deselectAll(): void {
    this.setSelected([]);
  }

  /**
   * Check if a specific value is selected
   */
  public isSelected(value: string): boolean {
    return this.selectedValues.has(value);
  }

  /**
   * Check if all options are selected
   */
  public isAllSelected(): boolean {
    return this.selectedValues.size === this.checkboxes.length;
  }

  /**
   * Check if no options are selected
   */
  public isNoneSelected(): boolean {
    return this.selectedValues.size === 0;
  }

  /**
   * Add a new option dynamically
   */
  public addOption(option: FilterOption): void {
    this.options.options.push(option);
    this.createFilterHTML();
    this.setupEventListeners();
    this.loadSavedFilters();
    this.updateButtonText();
  }

  /**
   * Remove an option by value
   */
  public removeOption(value: string): void {
    this.options.options = this.options.options.filter((opt) => opt.value !== value);
    this.selectedValues.delete(value);
    this.createFilterHTML();
    this.setupEventListeners();
    this.loadSavedFilters();
    this.updateButtonText();
  }

  /**
   * Update an existing option
   */
  public updateOption(value: string, updates: Partial<FilterOption>): void {
    const option = this.options.options.find((opt) => opt.value === value);
    if (option) {
      Object.assign(option, updates);
      this.createFilterHTML();
      this.setupEventListeners();
      this.loadSavedFilters();
      this.updateButtonText();
    }
  }

  /**
   * Clear all saved filters
   */
  public clearSavedFilters(): void {
    if (this.options.storageKey) {
      localStorage.removeItem(this.options.storageKey);
    }
  }

  /**
   * Get the container element
   */
  public getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Destroy the component
   */
  public destroy(): void {
    this.container.innerHTML = '';
  }
}

/**
 * Create a filter instance
 */
export function createFilter(options: FilterOptions): Filter {
  return new Filter(options);
}
