/**
 * FilterPanel Component
 * Collapsible panel containing filter components
 */

import { createFilter, Filter, FilterOption } from '@components/Filter';
import { MONSTER_FILTER_COLORS } from '@shared/index';

export interface FilterPanelOptions {
  monsterTypeOptions?: FilterOption[];
  onMonsterFilterChange?: (selected: string[]) => void;
}

export class FilterPanel {
  private element: HTMLElement;
  private monsterFilter: Filter | null = null;

  /**
   * Create a new FilterPanel
   * @param options - Configuration options for filter panel behavior
   */
  constructor(options: FilterPanelOptions = {}) {
    this.element = this.createElement(options);
  }

  /**
   * Create the filter panel DOM structure
   * @param options - Configuration options
   * @returns The filter panel element
   */
  private createElement(options: FilterPanelOptions): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'filter-panel';
    panel.className = 'collapsible-panel';
    panel.style.display = 'none';

    const content = document.createElement('div');
    content.className = 'panel-content';

    // Create filter group
    const filterGroup = document.createElement('div');
    filterGroup.className = 'filter-group';

    const label = document.createElement('label');
    label.setAttribute('for', 'monster-type-filter');
    label.textContent = 'Monster Type:';

    const filterContainer = document.createElement('div');
    filterContainer.id = 'monster-type-filter';
    filterContainer.className = 'filter-multiselect';

    filterGroup.appendChild(label);
    filterGroup.appendChild(filterContainer);
    content.appendChild(filterGroup);
    panel.appendChild(content);

    // Initialize monster filter after element is created
    setTimeout(() => {
      const defaultOptions: FilterOption[] = options.monsterTypeOptions || [
        {
          value: 'normal',
          label: 'Normal',
          checked: true,
          icon: 'fa-solid fa-shield',
          color: MONSTER_FILTER_COLORS.normal,
        },
        {
          value: 'dummy',
          label: 'Dummy',
          checked: true,
          icon: 'fa-solid fa-bullseye',
          color: MONSTER_FILTER_COLORS.dummy,
        },
        {
          value: 'elite',
          label: 'Elite',
          checked: true,
          icon: 'fa-solid fa-crown',
          color: MONSTER_FILTER_COLORS.elite,
        },
        {
          value: 'boss',
          label: 'Boss',
          checked: true,
          icon: 'fa-solid fa-skull',
          color: MONSTER_FILTER_COLORS.boss,
        },
      ];

      this.monsterFilter = createFilter({
        container: filterContainer,
        options: defaultOptions,
        placeholder: 'Filter by Monster Type',
        storageKey: 'monsterTypeFilter',
        filterButtonId: 'filter-button',
        allowSelectAll: false,
        allowDeselectAll: false,
        onChange: (selected) => {
          options.onMonsterFilterChange?.(selected);
        },
      });
    }, 0);

    return panel;
  }

  /**
   * Show the filter panel
   */
  public show(): void {
    this.element.style.display = 'flex';
  }

  /**
   * Hide the filter panel
   */
  public hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Toggle filter panel visibility
   */
  public toggle(): void {
    const isVisible = this.element.style.display === 'flex';
    if (isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Get currently selected filter values
   * @returns Array of selected filter values
   */
  public getSelectedFilters(): string[] {
    return this.monsterFilter?.getSelected() || [];
  }

  /**
   * Check if all filters are selected
   * @returns True if all filters are selected
   */
  public isAllSelected(): boolean {
    return this.monsterFilter?.isAllSelected() || false;
  }

  /**
   * Get the filter panel DOM element
   * @returns The filter panel element
   */
  public getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Remove the filter panel from DOM
   */
  public destroy(): void {
    this.monsterFilter?.destroy();
    this.element.remove();
  }
}
