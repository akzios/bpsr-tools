/**
 * Shared Utilities Exports
 * Central export file for all shared utilities
 */

// Socket Manager
export { SocketManager, createSocketManager } from './socketManager';
export type { SocketEventHandlers } from './socketManager';

// Data Formatters
export {
  formatStat,
  formatNumber,
  formatDuration,
  formatTimer,
  formatTimeSince,
  formatPercentage,
  formatCritPercentage,
  getProfessionName,
  getProfessionColor,
  getRoleColor,
  truncateText,
  formatTimestamp,
  formatPlayerCount,
} from './dataFormatter';

// UI Helpers
export {
  $,
  $$,
  createElement,
  toggleClass,
  addClass,
  removeClass,
  hasClass,
  show,
  hide,
  toggle,
  setAttr,
  getAttr,
  removeAttr,
  setTheme,
  getTheme,
  getCSSVar,
  setCSSVar,
  debounce,
  throttle,
  waitForElement,
  scrollToElement,
  copyToClipboard,
  getUrlParam,
  setUrlParam,
} from './uiHelpers';

// Constants
export {
  COLORS,
  ROLE_COLORS,
  STAT_COLORS,
  PLAYER_COLORS,
  CHART_COLORS,
  HEALTH_COLORS,
  MONSTER_TYPE_COLORS,
  MONSTER_CLASSIFICATION_COLORS,
  MONSTER_FILTER_COLORS,
  ZOOM,
  UI,
  API_ENDPOINTS,
  ENTITY_TYPES,
  WINDOW,
  PROFESSION_ROLES,
  THEMES,
  ICON_PATHS,
  NUMBER_SUFFIXES,
} from './constants';

export type {
  Color,
  RoleColor,
  PlayerColor,
  Theme,
  EntityType,
  ProfessionRole,
} from './constants';

// PNG Exporter
export {
  generateHash,
  injectPNGMetadata,
  downloadCanvasAsBlob,
  exportParseToPNG,
} from './pngExporter';
export type { ParseMetadata } from './pngExporter';

// Filter Helpers
export { applyMonsterTypeFilter } from './filterHelper';

// Router
export { Router, router } from './router';
export type { RouteConfig } from './router';

// Session Helpers
export {
  saveCurrentSession,
  deleteSession,
  fetchSessions,
  detectCurrentSessionType,
  checkAndAutoSave,
} from './sessionHelpers';

// Session Type Detector
export {
  detectSessionType,
  getDetectionConfidence,
} from './sessionTypeDetector';
export type { DetectionContext } from './sessionTypeDetector';
