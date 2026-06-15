import type { PlayerData } from '../data/player';
import { getPlayerStats } from './InventorySystem';

export type LevelUpResult = {
  leveledUp: boolean;
  levelsGained: number;
  oldLevel: number;
  newLevel: number;
  upgradePointsGained: number;
};

type PlayerWithUpgradePoints = PlayerData & {
  upgradePoints?: number;
  totalUpgradePointsEarned?: number;
};

const UPGRADE_POINTS_PER_LEVEL = 3;

export function addExperience(player: PlayerData, amount: number): LevelUpResult {
  const progressionPlayer = player as PlayerWithUpgradePoints;

  const oldLevel = player.level;
  let levelsGained = 0;
  let upgradePointsGained = 0;

  player.exp += amount;

  while (player.exp >= player.expToNextLevel) {
    player.exp -= player.expToNextLevel;

    player.level += 1;
    levelsGained += 1;

    player.expToNextLevel = Math.floor(player.expToNextLevel * 1.55);

    progressionPlayer.upgradePoints =
      (progressionPlayer.upgradePoints ?? 0) + UPGRADE_POINTS_PER_LEVEL;

    progressionPlayer.totalUpgradePointsEarned =
      (progressionPlayer.totalUpgradePointsEarned ?? 0) + UPGRADE_POINTS_PER_LEVEL;

    upgradePointsGained += UPGRADE_POINTS_PER_LEVEL;
  }

  if (levelsGained > 0) {
    const stats = getPlayerStats(player);

    player.hp = stats.maxHp;
    player.energy = stats.maxEnergy;
  }

  return {
    leveledUp: levelsGained > 0,
    levelsGained,
    oldLevel,
    newLevel: player.level,
    upgradePointsGained,
  };
}

export function createLevelUpText(result: LevelUpResult): string {
  if (!result.leveledUp) {
    return '';
  }

  if (result.levelsGained === 1) {
    return [
      `Новый уровень: ${result.newLevel}`,
      '',
      `+${result.upgradePointsGained} очка прокачки`,
      '',
      'Открой дерево характеристик в лагере, чтобы усилить героя.',
    ].join('\n');
  }

  return [
    `Получено уровней: ${result.levelsGained}`,
    `Новый уровень: ${result.newLevel}`,
    '',
    `+${result.upgradePointsGained} очков прокачки`,
    '',
    'Открой дерево характеристик в лагере, чтобы распределить очки.',
  ].join('\n');
}