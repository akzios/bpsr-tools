import type { CombatData } from '@app-types/index';

/**
 * Filter combat data by monster types damaged
 * @param players - Array of combat data for all players
 * @param selectedFilters - Array of selected filter values (normal, dummy, elite, boss)
 * @returns Filtered array of players with recalculated damage based on monster types
 */
export function applyMonsterTypeFilter(
  players: CombatData[],
  selectedFilters: string[]
): CombatData[] {
  if (selectedFilters.length === 0) {
    return [];
  }

  return players
    .map((player) => {
      if (!player.targetDamage || player.targetDamage.length === 0) {
        return player;
      }

      const filteredTargetDamage = player.targetDamage.filter((target: any) => {
        return selectedFilters.some((filterValue) => {
          if (filterValue === 'normal') {
            return target.monsterType === 0;
          } else if (filterValue === 'dummy') {
            return target.monsterType === 1;
          } else if (filterValue === 'elite') {
            // Elite: monsterType 2 with 'elite' in classification
            if (target.monsterType === 2) {
              if (target.monsterClassification) {
                return target.monsterClassification.toLowerCase().includes('elite');
              }
              // If no classification but monsterType is 2, treat as elite
              return true;
            }
            return false;
          } else if (filterValue === 'boss') {
            // Boss: monsterType 2 with 'boss' in classification, or monsterType 3+
            if (target.monsterClassification && target.monsterClassification.toLowerCase().includes('boss')) {
              return true;
            }
            // monsterType 3 or higher is typically boss
            if (target.monsterType >= 3) {
              return true;
            }
            return false;
          }
          return false;
        });
      });

      const filteredTotalDamage = filteredTargetDamage.reduce(
        (sum, target: any) => sum + (target.totalDamage || 0),
        0
      );

      return {
        ...player,
        targetDamage: filteredTargetDamage,
        totalDamage: {
          ...player.totalDamage,
          total: filteredTotalDamage,
        },
      };
    })
    .filter((player) => player.totalDamage && player.totalDamage.total > 0);
}
