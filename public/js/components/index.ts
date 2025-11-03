/**
 * Component Exports
 * Central export file for all reusable components
 */

// UI Components
export { Button, createButton } from '@components/Button';
export type { ButtonOptions, ButtonSize, ButtonVariant } from '@components/Button';

export { Toggle, createToggle } from '@components/Toggle';
export type { ToggleOptions } from '@components/Toggle';

export { Slider } from '@components/Slider';
export type { SliderOptions } from '@components/Slider';

export { Modal, createModal } from '@components/Modal';
export type { ModalOptions } from '@components/Modal';

export { Collapsible, createCollapsible } from '@components/Collapsible';
export type { CollapsibleOptions } from '@components/Collapsible';

export { Container, createContainer } from '@components/Container';
export type { ContainerOptions } from '@components/Container';

// Feature Components
export { DPSTable } from '@components/DPSTable';
export type {
  DPSTableOptions,
  EnrichedCombatData,
} from '@components/DPSTable';

export { ControlPanel, createControlPanel } from './ControlPanel';
export type { ControlPanelOptions, ControlPanelState } from './ControlPanel';

export { Filter, createFilter } from './Filter';
export type { FilterOptions, FilterOption } from './Filter';

// Layout Components
export { ResizeHandles } from './ResizeHandles';
export type { ResizeHandlesOptions } from './ResizeHandles';

export { LoadingIndicator } from './LoadingIndicator';
export type { LoadingIndicatorOptions } from './LoadingIndicator';

export { ParsePanel } from './ParsePanel';
export type { ParsePanelOptions, ParseConfig } from './ParsePanel';

export { FilterPanel } from './FilterPanel';
export type { FilterPanelOptions } from './FilterPanel';

export { Header, createHeader } from './Header';
export type { HeaderOptions } from './Header';

export { Sidebar, createSidebar } from './Sidebar';
export type { SidebarOptions, MenuItem } from './Sidebar';

export { Table } from './Table';
export type { TableOptions, TableColumn, TableAction } from './Table';
export { createIconCell, createBadge, formatNumber, createHighlightedNumber } from './Table';

export { SummaryCards } from './SummaryCards';
export type { SummaryCardsOptions } from './SummaryCards';
