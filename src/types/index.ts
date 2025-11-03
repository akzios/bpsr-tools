/**
 * Shared TypeScript type definitions for BPSR Tools
 * Used across frontend and backend for type safety
 */

// ============================================================================
// Profession Types
// ============================================================================

export type ProfessionRole = 'dps' | 'tank' | 'healer';

export interface ProfessionDetails {
  id: number;
  name_cn: string;
  name_en: string;
  icon: string;
  role: ProfessionRole;
  created_at?: string;
}

// ============================================================================
// Combat Data Types
// ============================================================================

export interface DamageStats {
  total: number;
  critical?: number;
  normal?: number;
}

export interface HitCounts {
  total: number;
  critical?: number;
  normal?: number;
  lucky?: number;
}

export interface PlayerAttributes {
  fight_point?: number; // Gear Score
  [key: string]: any;
}

export interface SkillUsage {
  skill_id: number;
  skill_name: string;
  damage: number;
  hits: number;
  critical_hits?: number;
  dps?: number;
  percentage?: number;
}

export interface CombatData {
  uid: string;
  name: string;
  profession?: string;
  professionDetails: ProfessionDetails;
  player_level?: number;
  level?: number;

  // Damage stats
  totalDamage?: DamageStats;
  totalDps?: number;
  dps?: number;
  realtimeDps?: number;
  realtimeDpsMax?: number;

  // Healing stats
  totalHealing?: DamageStats;
  totalHps?: number;
  hps?: number;
  realtimeHps?: number;
  realtimeHpsMax?: number;

  // Hit stats
  totalCount?: HitCounts;
  takenDamage?: number;

  // Player attributes
  hp?: number;
  maxHp?: number;
  fightPoint?: number;
  attr?: PlayerAttributes;

  // Skills
  skills?: Record<number, SkillUsage>;

  // Combat metadata
  deadCount?: number;
  targetDamage?: any[];

  // Metadata
  isLocalPlayer?: boolean;
  timestamp?: number;
}

// ============================================================================
// Enemy Data Types
// ============================================================================

export interface EnemyData {
  uid: string;
  name: string;
  entity_type: number;
  monster_id?: number;
  level?: number;
  hp_current?: number;
  hp_max?: number;
  damage_taken?: number;
  is_boss?: boolean;
}

// ============================================================================
// Skill Data Types
// ============================================================================

export interface SkillData {
  id: number;
  name_cn: string;
  name_en: string;
  profession_id?: number;
  icon?: string;
  created_at?: string;
}

export interface SkillBreakdown {
  uid: string;
  name: string;
  professionDetails: ProfessionDetails;
  totalDamage?: DamageStats;
  totalDps?: number;
  totalHealing?: DamageStats;
  totalHps?: number;
  attr?: PlayerAttributes;
  skills: Record<number, SkillUsage>;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface Settings {
  theme?: 'light' | 'dark';
  autoUpdate?: boolean;
  autoClear?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  monsterFilter?: string[];
  pauseTracking?: boolean;
  [key: string]: any;
}

export interface SheetsConfig {
  clientEmail?: string;
  privateKey?: string;
  spreadsheetId?: string;
  sheetName?: string;
}

// ============================================================================
// Socket.IO Event Types
// ============================================================================

export interface SocketEvents {
  // Client -> Server
  'request-data': () => void;
  'request-enemies': () => void;
  'clear-data': () => void;
  'pause-tracking': (paused: boolean) => void;

  // Server -> Client
  'dataUpdate': (data: Record<string, CombatData>) => void;
  'enemiesUpdate': (enemies: Record<string, EnemyData>) => void;
  'theme-changed': (data: { theme: 'light' | 'dark' }) => void;
  'pause-state-changed': (data: { paused: boolean }) => void;
  'combat-cleared': () => void;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  code: number;
  message?: string;
  data?: T;
}

export interface CombatHistoryEntry {
  id: number;
  timestamp: number;
  duration: number;
  totalDamage: number;
  totalHealing: number;
  player_count: number;
  created_at: string;
}

export interface HistorySummary {
  timestamp: number;
  duration: number;
  players: Array<{
    name: string;
    dps: number;
    damage: number;
    profession: string;
  }>;
}

// ============================================================================
// UI Component Types
// ============================================================================

export type ViewMode = 'advanced' | 'lite';
export type LiteModeType = 'dps' | 'healer';
export type ZoomLevel = number; // 0.5 - 2.0
export type Theme = 'light' | 'dark';

export interface ComponentState {
  isLiteMode: boolean;
  liteModeType: LiteModeType;
  zoomLevel: ZoomLevel;
  isPaused: boolean;
  theme: Theme;
}

// ============================================================================
// Skill Analysis Types
// ============================================================================

export type {
  SkillData as SkillAnalysisSkillData,
  TargetDamage,
  PlayerAttribute,
  SkillAnalysisData,
  SummaryStats,
} from './skillAnalysis';

// ============================================================================
// Session Types
// ============================================================================

export interface SessionPlayer {
  id: number;
  session_id: number;
  player_id: number;
  player_name: string;
  profession_id?: number;
  totalDamage: number;
  totalHealing: number;
  totalDps: number;
  totalHps: number;
  max_dps: number;
  maxHps: number;
  fight_point: number;
  skill_breakdown?: Record<string, any>;
  time_series_data?: Array<{ timestamp: number; dps: number; hps: number }>;
  professionDetails?: ProfessionDetails;
  created_at: string;
}

export type SessionType = 'Parse' | 'Dungeon' | 'Raid' | 'Guild Hunt' | 'Boss Crusade' | 'Open World';

export interface Session {
  id: number;
  session_name?: string;
  notes?: string;
  type: SessionType;
  start_time: number;
  end_time?: number;
  duration?: number;
  totalDamage: number;
  totalHealing: number;
  avg_dps: number;
  avg_hps: number;
  max_dps: number;
  maxHps: number;
  player_count: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  // Populated when fetching with details
  players?: SessionPlayer[];
}

// ============================================================================
// Utility Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Dictionary<T> = Record<string, T>;
