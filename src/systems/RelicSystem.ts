import { player } from '../data/player';
import type { RelicData } from '../data/relics';
import { getRelicByTier } from '../data/relics';

export function hasRelic(relicId: string) {
  return player.relicIds.includes(relicId as any);
}

export function giveRelicForTier(tier: number): RelicData | null {
  const relic = getRelicByTier(tier);

  if (!relic) {
    return null;
  }

  if (player.relicIds.includes(relic.id)) {
    return null;
  }

  player.relicIds.push(relic.id);

  return relic;
}

export function createRelicBonusText(relic: RelicData) {
  const bonuses: string[] = [];

  if (relic.bonusHp) bonuses.push(`+${relic.bonusHp} HP`);
  if (relic.bonusEnergy) bonuses.push(`+${relic.bonusEnergy} энергия`);
  if (relic.bonusAttack) bonuses.push(`+${relic.bonusAttack} атака`);
  if (relic.bonusDefense) bonuses.push(`+${relic.bonusDefense} защита`);
  if (relic.bonusAgility) bonuses.push(`+${relic.bonusAgility} ловкость`);
  if (relic.bonusLuck) bonuses.push(`+${relic.bonusLuck} удача`);
  if (relic.bonusStrength) bonuses.push(`+${relic.bonusStrength} сила`);
  if (relic.bonusIntelligence) bonuses.push(`+${relic.bonusIntelligence} интеллект`);

  return bonuses.join(', ');
}