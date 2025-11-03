/**
 * Table Component
 * Fluent Design-inspired data table with icons, badges, and actions
 */

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: any, row: any) => HTMLElement | string;
}

export interface TableAction {
  label: string;
  onClick: (row: any) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: string;
}

export interface TableOptions {
  columns: TableColumn[];
  data: any[];
  actions?: TableAction[];
  onRowClick?: (row: any) => void;
  emptyMessage?: string;
  className?: string;
  sortable?: boolean;
  defaultSortColumn?: string;
  defaultSortDirection?: 'asc' | 'desc';
}

export class Table {
  private container: HTMLElement;
  private options: TableOptions;
  private tableElement?: HTMLElement;
  private sortColumn?: string;
  private sortDirection: 'asc' | 'desc' = 'desc';

  constructor(container: HTMLElement, options: TableOptions) {
    this.container = container;
    this.options = options;

    // Initialize sorting
    if (options.sortable || options.columns.some(col => col.sortable)) {
      this.sortColumn = options.defaultSortColumn;
      this.sortDirection = options.defaultSortDirection || 'desc';
    }

    this.render();
  }

  /**
   * Render the table
   */
  private render(): void {
    this.container.innerHTML = '';
    this.container.className = `fluent-table-container ${this.options.className || ''}`;

    // Sort data if sorting is enabled
    if (this.sortColumn) {
      this.options.data = this.sortData([...this.options.data]);
    }

    // Create table
    this.tableElement = document.createElement('div');
    this.tableElement.className = 'fluent-table';

    // Render header
    this.renderHeader();

    // Render body
    this.renderBody();

    this.container.appendChild(this.tableElement);
  }

  /**
   * Render table header
   */
  private renderHeader(): void {
    if (!this.tableElement) return;

    const header = document.createElement('div');
    header.className = 'fluent-table-header';

    // Render column headers
    this.options.columns.forEach((column) => {
      const th = document.createElement('div');
      const isSortable = this.options.sortable || column.sortable;

      th.className = `fluent-table-th ${isSortable ? 'sortable' : ''}`;

      if (column.width) {
        th.style.width = column.width;
        th.style.flexShrink = '0';
      }

      if (column.align) {
        th.style.textAlign = column.align;
      }

      // Add label and sort icon
      if (isSortable) {
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        th.style.display = 'flex';
        th.style.alignItems = 'center';
        th.style.gap = '4px';

        const label = document.createElement('span');
        label.textContent = column.label;
        th.appendChild(label);

        const sortIcon = document.createElement('i');
        const isActive = this.sortColumn === column.key;
        sortIcon.className = `fa-solid fa-sort${isActive ? (this.sortDirection === 'asc' ? '-up' : '-down') : ''}`;
        sortIcon.style.fontSize = '0.65rem';
        sortIcon.style.opacity = isActive ? '1' : '0.3';
        th.appendChild(sortIcon);

        // Add click handler
        th.addEventListener('click', () => {
          if (this.sortColumn === column.key) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            this.sortColumn = column.key;
            this.sortDirection = 'desc';
          }
          this.render();
        });

        // Add hover effect
        th.addEventListener('mouseenter', () => {
          th.style.backgroundColor = 'var(--surface-hover)';
        });

        th.addEventListener('mouseleave', () => {
          th.style.backgroundColor = '';
        });
      } else {
        th.textContent = column.label;
      }

      header.appendChild(th);
    });

    // Add actions column if actions exist
    if (this.options.actions && this.options.actions.length > 0) {
      const actionsTh = document.createElement('div');
      actionsTh.className = 'fluent-table-th';
      actionsTh.textContent = 'ACTIONS';
      actionsTh.style.textAlign = 'right';
      header.appendChild(actionsTh);
    }

    this.tableElement.appendChild(header);
  }

  /**
   * Render table body
   */
  private renderBody(): void {
    if (!this.tableElement) return;

    const body = document.createElement('div');
    body.className = 'fluent-table-body';

    if (this.options.data.length === 0) {
      // Empty state
      const emptyRow = document.createElement('div');
      emptyRow.className = 'fluent-table-empty';
      emptyRow.textContent = this.options.emptyMessage || 'No data available';
      body.appendChild(emptyRow);
    } else {
      // Render rows
      this.options.data.forEach((row) => {
        const tr = this.renderRow(row);
        body.appendChild(tr);
      });
    }

    this.tableElement.appendChild(body);
  }

  /**
   * Render a single row
   */
  private renderRow(row: any): HTMLElement {
    const tr = document.createElement('div');
    tr.className = 'fluent-table-row';

    // Add click handler if provided
    if (this.options.onRowClick) {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', (e) => {
        // Don't trigger row click if clicking on action buttons
        if ((e.target as HTMLElement).closest('.fluent-table-actions')) {
          return;
        }
        this.options.onRowClick?.(row);
      });
    }

    // Render cells
    this.options.columns.forEach((column) => {
      const td = document.createElement('div');
      td.className = 'fluent-table-td';

      if (column.width) {
        td.style.width = column.width;
        td.style.flexShrink = '0';
      }

      if (column.align) {
        td.style.textAlign = column.align;
      }

      // Render cell content
      const value = row[column.key];
      if (column.render) {
        const rendered = column.render(value, row);
        if (typeof rendered === 'string') {
          td.innerHTML = rendered;
        } else {
          td.appendChild(rendered);
        }
      } else {
        td.textContent = value ?? '';
      }

      tr.appendChild(td);
    });

    // Add actions column if actions exist
    if (this.options.actions && this.options.actions.length > 0) {
      const actionsTd = document.createElement('div');
      actionsTd.className = 'fluent-table-td fluent-table-actions';
      actionsTd.style.textAlign = 'right';

      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'fluent-table-actions-container';

      this.options.actions.forEach((action) => {
        const btn = document.createElement('button');
        btn.className = `fluent-table-action-btn ${action.variant || 'secondary'}`;

        if (action.icon) {
          const icon = document.createElement('i');
          icon.className = action.icon;
          btn.appendChild(icon);
          btn.appendChild(document.createTextNode(' '));
        }

        btn.appendChild(document.createTextNode(action.label));

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          action.onClick(row);
        });

        actionsContainer.appendChild(btn);
      });

      actionsTd.appendChild(actionsContainer);
      tr.appendChild(actionsTd);
    }

    return tr;
  }

  /**
   * Sort data by current sort column and direction
   */
  private sortData(data: any[]): any[] {
    if (!this.sortColumn) return data;

    return data.sort((a, b) => {
      const aVal = a[this.sortColumn!];
      const bVal = b[this.sortColumn!];

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Handle string comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return this.sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Handle number comparison
      const aNum = typeof aVal === 'number' ? aVal : 0;
      const bNum = typeof bVal === 'number' ? bVal : 0;

      return this.sortDirection === 'asc'
        ? aNum - bNum
        : bNum - aNum;
    });
  }

  /**
   * Update table data
   */
  public setData(data: any[]): void {
    this.options.data = data;
    this.render();
  }

  /**
   * Get current data
   */
  public getData(): any[] {
    return this.options.data;
  }

  /**
   * Update table columns
   */
  public setColumns(columns: TableColumn[]): void {
    this.options.columns = columns;
    this.render();
  }

  /**
   * Clear table
   */
  public clear(): void {
    this.options.data = [];
    this.render();
  }

  /**
   * Destroy the table
   */
  public destroy(): void {
    this.container.innerHTML = '';
  }
}

/**
 * Helper function to create an icon cell
 */
export function createIconCell(icon: string, color: string, title: string, subtitle?: string): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'fluent-table-icon-cell';

  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'fluent-table-icon';
  iconWrapper.style.backgroundColor = color;

  const iconEl = document.createElement('i');
  iconEl.className = icon;
  iconWrapper.appendChild(iconEl);

  const textWrapper = document.createElement('div');
  textWrapper.className = 'fluent-table-icon-text';

  const titleEl = document.createElement('div');
  titleEl.className = 'fluent-table-icon-title';
  titleEl.textContent = title;
  textWrapper.appendChild(titleEl);

  if (subtitle) {
    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'fluent-table-icon-subtitle';
    subtitleEl.textContent = subtitle;
    textWrapper.appendChild(subtitleEl);
  }

  cell.appendChild(iconWrapper);
  cell.appendChild(textWrapper);

  return cell;
}

/**
 * Helper function to create a badge
 */
export function createBadge(text: string, variant: 'success' | 'error' | 'warning' | 'info' = 'info'): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `fluent-table-badge ${variant}`;
  badge.textContent = text;
  return badge;
}

/**
 * Helper function to format numbers
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Helper function to create highlighted number cell
 */
export function createHighlightedNumber(num: number, color?: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'fluent-table-highlighted-number';
  span.textContent = formatNumber(num);
  if (color) {
    span.style.color = color;
  }
  return span;
}
