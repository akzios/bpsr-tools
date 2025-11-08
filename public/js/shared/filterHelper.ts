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
            if (target.monsterType === 2 && target.monsterClassification) {
              const classification = target.monsterClassification.toLowerCase();
              return classification.includes('elite');
            }
            return false;
          } else if (filterValue === 'boss') {
            if (target.monsterType === 2 && target.monsterClassification) {
              const classification = target.monsterClassification.toLowerCase();
              return classification.includes('boss');
            }
            if (target.monsterType === 2 && !target.monsterClassification) {
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
