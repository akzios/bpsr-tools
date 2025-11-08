/**
 * FilterPanel Component
 * Collapsible panel containing filter components
 */

import { createFilter, Filter, FilterOption } from '@components/Filter';
import { MONSTER_FILTER_COLORS } from '@shared/index';

export interface FilterPanelOptions {
  monsterTypeOptions?: FilterOption[];
  onMonsterFilterChange?: (selected: string[]) => void;
  onPlayerSearchChange?: (searchTerm: string) => void;
}

export class FilterPanel {
  private element: HTMLElement;
  private monsterFilter: Filter | null = null;
  private playerSearchInput: HTMLInputElement | null = null;

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

    // Player Search (at top)
    const playerSearchGroup = document.createElement('div');
    playerSearchGroup.className = 'filter-group search-group';
    const playerSearchInput = document.createElement('input');
    playerSearchInput.type = 'text';
    playerSearchInput.id = 'player-search-input';
    playerSearchInput.className = 'filter-search-input';
    playerSearchInput.placeholder = 'Search player...';
    playerSearchInput.setAttribute('autocomplete', 'off');
    playerSearchInput.setAttribute('spellcheck', 'false');
    playerSearchGroup.appendChild(playerSearchInput);
    content.appendChild(playerSearchGroup);

    // Filter Section
    const filterSection = document.createElement('div');
    filterSection.className = 'filter-section';
    const filterHeading = document.createElement('h4');
    filterHeading.textContent = 'Filter';
    filterHeading.className = 'filter-section-heading';
    filterSection.appendChild(filterHeading);

    // Monster Type Filter
    const monsterFilterGroup = document.createElement('div');
    monsterFilterGroup.className = 'filter-group monster-type';
    const monsterLabel = document.createElement('label');
    monsterLabel.setAttribute('for', 'monster-type-filter');
    monsterLabel.textContent = 'Monster Type:';
    const filterContainer = document.createElement('div');
    filterContainer.id = 'monster-type-filter';
    filterContainer.className = 'filter-multiselect';
    monsterFilterGroup.appendChild(monsterLabel);
    monsterFilterGroup.appendChild(filterContainer);
    filterSection.appendChild(monsterFilterGroup);

    content.appendChild(filterSection);
    panel.appendChild(content);

    this.playerSearchInput = playerSearchInput;

    // Initialize filters after element is created
    setTimeout(() => {
      // Monster Type Filter
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

      // Player Search Input (case insensitive)
      if (this.playerSearchInput) {
        this.playerSearchInput.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          options.onPlayerSearchChange?.(target.value.toLowerCase());
        });
      }
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
   * Get player search term
   */
  public getPlayerSearchTerm(): string {
    return this.playerSearchInput?.value.toLowerCase() || '';
  }

  /**
   * Remove the filter panel from DOM
   */
  public destroy(): void {
    this.monsterFilter?.destroy();
    this.element.remove();
  }
}
