import type { PlayerData } from '../data/player';
import { getPlayerStats } from './InventorySystem';

export type LevelUpResult = {
  leveledUp: boolean;
  levelsGained: number;
  oldLevel: number;
  newLevel: number;
  hpGained: number;
  attackGained: number;
  defenseGained: number;
  energyGained: number;
};

export function addExperience(player: PlayerData, amount: number): LevelUpResult {
  const result: LevelUpResult = {
    leveledUp: false,
    levelsGained: 0,
    oldLevel: player.level,
    newLevel: player.level,
    hpGained: 0,
    attackGained: 0,
    defenseGained: 0,
    energyGained: 0,
  };

  player.exp += amount;

  while (player.exp >= player.expToNextLevel) {
    player.exp -= player.expToNextLevel;

    player.level += 1;
    result.levelsGained += 1;
    result.leveledUp = true;

    const hpGain = 18;
    const attackGain = 3;
    const defenseGain = 1;
    const energyGain = player.level % 3 === 0 ? 1 : 0;

    player.maxHp += hpGain;
    player.attack += attackGain;
    player.defense += defenseGain;

    if (energyGain > 0) {
      player.maxEnergy += energyGain;
    }

    result.hpGained += hpGain;
    result.attackGained += attackGain;
    result.defenseGained += defenseGain;
    result.energyGained += energyGain;

    player.expToNextLevel = Math.floor(player.expToNextLevel * 1.35);
  }

  if (result.leveledUp) {
    const stats = getPlayerStats(player);
    player.hp = stats.maxHp;
    player.energy = player.maxEnergy;
  }

  result.newLevel = player.level;

  return result;
}

export function createLevelUpText(result: LevelUpResult): string {
  if (!result.leveledUp) {
    return '';
  }

  const energyText = result.energyGained > 0
    ? `\nМакс. энергия +${result.energyGained}`
    : '';

  return `

Уровень повышен!
${result.oldLevel} → ${result.newLevel}

Макс. здоровье +${result.hpGained}
Атака +${result.attackGained}
Защита +${result.defenseGained}${energyText}

Здоровье и энергия восстановлены.`;
}