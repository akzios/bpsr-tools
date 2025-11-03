/**
 * Session Type Auto-Detection
 * Intelligently detects session type based on combat data
 */

import type { SessionType } from '@app-types/index';

export interface DetectionContext {
  playerCount: number;
  isParseMode: boolean;
  monsters?: Array<{
    name_en: string;
    name_cn: string;
    monster_type: number; // 0=normal, 1=elite, 2=boss
  }>;
  totalDamage: number;
  duration: number; // in seconds
}

/**
 * Detect session type based on combat context
 * @param context Combat data context
 * @returns Detected session type
 */
export function detectSessionType(context: DetectionContext): SessionType {
  // Parse mode takes highest priority
  if (context.isParseMode) {
    return 'Parse';
  }

  const { playerCount, monsters = [] } = context;

  // Find if there's a boss monster (type 2)
  const hasBoss = monsters.some(m => m.monster_type === 2);
  const bossMonsters = monsters.filter(m => m.monster_type === 2);

  // Check for specific content keywords in boss names
  if (bossMonsters.length > 0) {
    const bossName = bossMonsters[0].name_en.toLowerCase();
    const bossNameCn = bossMonsters[0].name_cn;

    // Guild Hunt detection (specific hunt bosses)
    if (
      bossName.includes('hunt') ||
      bossNameCn.includes('狩猎') ||
      bossName.includes('wandering') ||
      bossNameCn.includes('徘徊')
    ) {
      return 'Guild Hunt';
    }

    // Boss Crusade detection
    if (
      bossName.includes('crusade') ||
      bossNameCn.includes('讨伐') ||
      bossName.includes('expedition') ||
      bossNameCn.includes('远征')
    ) {
      return 'Boss Crusade';
    }

    // Raid detection (8+ players with boss)
    if (playerCount >= 8 && hasBoss) {
      return 'Raid';
    }

    // Dungeon detection (4-7 players with boss)
    if (playerCount >= 4 && playerCount <= 7 && hasBoss) {
      return 'Dungeon';
    }
  }

  // Default fallback
  return 'Open World';
}

/**
 * Get session type confidence level
 * @param context Combat data context
 * @returns Confidence score (0-1)
 */
export function getDetectionConfidence(context: DetectionContext): number {
  if (context.isParseMode) return 1.0; // Parse mode is 100% confident

  const { playerCount, monsters = [] } = context;
  const hasBoss = monsters.some(m => m.monster_type === 2);

  // High confidence for specific patterns
  if (playerCount >= 8 && hasBoss) return 0.9; // Raid
  if (playerCount >= 4 && playerCount <= 7 && hasBoss) return 0.85; // Dungeon

  // Medium confidence for keyword matches
  if (hasBoss) {
    const bossMonster = monsters.find(m => m.monster_type === 2);
    if (bossMonster) {
      const name = bossMonster.name_en.toLowerCase();
      if (name.includes('hunt') || name.includes('crusade')) return 0.8;
    }
  }

  // Low confidence fallback
  return 0.5; // Open World guess
}
