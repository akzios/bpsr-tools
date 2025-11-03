/**
 * Skill Analysis Type Definitions
 */

export interface SkillData {
  skillId: string;
  displayName: string;
  type: 'damage' | 'healing';
  totalDamage: number;
  totalCount: number;
  critCount: number;
  luckyCount: number;
  critRate: number;
  luckyRate: number;
  countBreakdown: {
    normal: number;
    critical: number;
    lucky: number;
    crit_lucky: number;
  };
  damageBreakdown: {
    normal: number;
    critical: number;
    lucky: number;
    crit_lucky: number;
  };
  minMaxBreakdown: {
    normal: { min: number; max: number };
    critical: { min: number; max: number };
    lucky: { min: number; max: number };
    crit_lucky: { min: number; max: number };
  };
}

export interface TargetDamage {
  monsterName: string;
  monsterType: number;
  monsterClassification: string;
  totalDamage: number;
}

export interface PlayerAttribute {
  fight_point: number;
  combat_duration: number;
  hits_taken: number;
}

export interface SkillAnalysisData {
  uid: string;
  name: string;
  professionDetails: {
    id: number;
    name_en: string;
    name_cn: string;
    icon: string;
    role: string;
  };
  skills: Record<string, SkillData>;
  targetDamage: TargetDamage[];
  attr: PlayerAttribute;
  fightPoint?: number;
}

export interface SummaryStats {
  totalDamage: number;
  totalHits: number;
  totalCritHits: number;
  totalLuckyHits: number;
  totalNormalHits: number;
  normalDamage: number;
  critDamage: number;
  luckyDamage: number;
  critRate: number;
  luckyRate: number;
  avgPerHit: number;
  dps: number;
  hitsTaken: number;
  duration: number;
}

export interface EnrichedSkillData extends SkillData {
  damagePercent: number;
  dpsHps: number;
  avgPerHit: number;
  normAvg: number;
  critAvg: number;
  hitsPerMinute: number;
  hitsPerSecond: number;
}
