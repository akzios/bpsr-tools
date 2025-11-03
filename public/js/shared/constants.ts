/**
 * Application Constants
 * Shared constants used across the application
 */

// ============================================================================
// Brand Colors
// ============================================================================

export const COLORS = {
  // Brand Colors - Purple/Blue Gaming Theme
  primary: '#667eea',           // --brand-primary
  primaryDark: '#5568d3',        // --brand-primary-dark
  primaryLight: '#7c96ff',       // --brand-primary-light
  accent: '#764ba2',             // --brand-accent
  accentDark: '#5d3a82',         // --brand-accent-dark

  // Semantic Colors
  success: '#10b981',            // --success
  successDark: '#059669',        // --success-dark
  warning: '#f59e0b',            // --warning
  warningDark: '#d97706',        // --warning-dark
  error: '#ef4444',              // --error
  errorDark: '#dc2626',          // --error-dark
  info: '#3b82f6',               // --info
  infoDark: '#2563eb',           // --info-dark

  // Additional utility colors
  cyan: '#06b6d4',
  white: '#ffffff',
  gray: '#9ca3af',
} as const;

// ============================================================================
// Role Colors (for profession role indicators)
// ============================================================================

export const ROLE_COLORS = {
  dps: '#ef4444',    // Red (--error)
  tank: '#06b6d4',   // Cyan
  healer: '#22c55e', // Green (for role color)
} as const;

// ============================================================================
// Stat Display Colors (used in UI for HPS/healing stats)
// ============================================================================

export const STAT_COLORS = {
  hps: '#28a745',    // Green (healing stat color used in UI)
  dps: '#ef4444',    // Red
  damage: '#ef4444', // Red
  takenDamage: '#ffc107', // Yellow/warning
  hp: '#dc3545',     // Red for HP indicator
} as const;

// ============================================================================
// Player Bar Colors (for charts/graphs)
// ============================================================================

export const PLAYER_COLORS = [
  'rgba(255, 99, 132, 0.7)',  // Red
  'rgba(54, 162, 235, 0.7)',  // Blue
  'rgba(255, 206, 86, 0.7)',  // Yellow
  'rgba(75, 192, 192, 0.7)',  // Teal
  'rgba(153, 102, 255, 0.7)', // Purple
  'rgba(255, 159, 64, 0.7)',  // Orange
  'rgba(199, 199, 199, 0.7)', // Gray
  'rgba(83, 102, 255, 0.7)',  // Indigo
] as const;

// ============================================================================
// Chart Colors
// ============================================================================

export const CHART_COLORS = {
  skill1: '#667eea',
  skill2: '#764ba2',
  skill3: '#f093fb',
  skill4: '#4facfe',
  skill5: '#43e97b',
  dps: '#667eea',
  hps: '#28a745',
  healing: '#28a745',
} as const;

// ============================================================================
// HP/Health Colors
// ============================================================================

export const HEALTH_COLORS = {
  high: '#10b981',   // Green (>50%)
  medium: '#f59e0b', // Yellow/Orange (25-50%)
  low: '#ef4444',    // Red (<25%)
} as const;

// ============================================================================
// Monster Type Colors
// ============================================================================

export const MONSTER_TYPE_COLORS = {
  boss: '#ff6b6b',      // Red (type 2)
  elite: '#a0a0a0',     // Gray (type 1)
  normal: '#4dabf7',    // Blue (type 0)
} as const;

export const MONSTER_CLASSIFICATION_COLORS = {
  boss: '#e03131',
  elite: '#fd7e14',
  normal: '#20c997',
} as const;

export const MONSTER_FILTER_COLORS = {
  normal: '#868e96',  // Gray
  dummy: '#51cf66',   // Green
  elite: '#fd7e14',   // Orange
  boss: '#e03131',    // Red
} as const;

// ============================================================================
// Zoom Levels
// ============================================================================

export const ZOOM = {
  MIN: 0.5,
  MAX: 2.0,
  DEFAULT: 1.0,
  STEP: 0.1,
  AUTO_SCALE_THRESHOLD: 650, // Width threshold for auto-scaling
  AUTO_SCALE_MIN: 0.5,       // Minimum auto-scale value
} as const;

// ============================================================================
// UI Constants
// ============================================================================

export const UI = {
  UPDATE_INTERVAL: 100,           // ms - Real-time DPS update interval
  DISPLAY_UPDATE_INTERVAL: 500,   // ms - UI display update interval
  AUTO_CLEAR_TIMEOUT: 80000,      // ms - Auto-clear timeout (80s)
  LOG_PREVIEW_TIMEOUT: 7000,      // ms - Log preview display duration
  SYNC_INTERVAL: 60000,           // ms - Google Sheets auto-sync interval (60s)
  DEBOUNCE_DELAY: 300,            // ms - Default debounce delay
  THROTTLE_LIMIT: 100,            // ms - Default throttle limit
} as const;

// ============================================================================
// API Endpoints
// ============================================================================

export const API_ENDPOINTS = {
  HEALTH: '/-/health',
  DATA: '/api/data',
  ENEMIES: '/api/enemies',
  SKILL: '/api/skill',
  PROFESSIONS: '/api/professions',
  SETTINGS: '/api/settings',
  SYNC_SHEETS: '/api/sync-sheets',
  SHEETS_CONFIGURED: '/api/sheets-configured',
  CLEAR: '/api/clear',
  PAUSE: '/api/pause',
  SET_USERNAME: '/api/set-username',
  HISTORY: '/api/history',
} as const;

// ============================================================================
// Entity Types
// ============================================================================

export const ENTITY_TYPES = {
  PLAYER: 0x01,
  MONSTER: 0x02,
  NPC: 0x03,
} as const;

// ============================================================================
// Window Dimensions
// ============================================================================

export const WINDOW = {
  MIN_WIDTH: 350,
  MIN_HEIGHT: 200,
  DEFAULT_WIDTH: 700,
  DEFAULT_HEIGHT: 400,
  SCALE_DOWN_WIDTH: 650,
  SCALE_DOWN_HEIGHT: 250,
  SKILL_ANALYSIS_WIDTH: 1400,
  SKILL_ANALYSIS_HEIGHT: 1000,
} as const;

// ============================================================================
// Layer System (Z-Index Hierarchy - Fluent v2)
// ============================================================================

export const LAYERS = {
  BASE: 0,           // Default layer
  ELEVATED: 100,     // Elevated cards, dropdowns
  OVERLAY: 1000,     // Modals, dialogs
  STICKY: 1100,      // Sticky headers
  NAVIGATION: 1200,  // Navigation bars
  TOAST: 9999,       // Notifications, tooltips
} as const;

// ============================================================================
// Profession Roles
// ============================================================================

export const PROFESSION_ROLES = {
  DPS: 'dps',
  TANK: 'tank',
  HEALER: 'healer',
} as const;

// ============================================================================
// Theme
// ============================================================================

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

// ============================================================================
// Icon Paths
// ============================================================================

export const ICON_PATHS = {
  DEFAULT: 'unknown.png',
  BASE_PATH: 'assets/images/icons/',
  PROFESSION_PATH: 'assets/images/icons/',
} as const;

// ============================================================================
// Format Suffixes
// ============================================================================

export const NUMBER_SUFFIXES = {
  THOUSAND: 'K',
  MILLION: 'M',
  BILLION: 'G',
  TRILLION: 'T',
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type Color = typeof COLORS[keyof typeof COLORS];
export type RoleColor = typeof ROLE_COLORS[keyof typeof ROLE_COLORS];
export type PlayerColor = typeof PLAYER_COLORS[number];
export type Theme = typeof THEMES[keyof typeof THEMES];
export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];
export type ProfessionRole = typeof PROFESSION_ROLES[keyof typeof PROFESSION_ROLES];
export type Layer = typeof LAYERS[keyof typeof LAYERS];
