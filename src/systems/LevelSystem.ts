import type { PlayerData } from '../data/player';
import { getPlayerStats } from './InventorySystem';

export type LevelUpResult = {
  leveledUp: boolean;
  levelsGained: number;
  oldLevel: number;
  newLevel: number;
};

export function addExperience(player: PlayerData, amount: number): LevelUpResult {
  const oldLevel = player.level;
  let levelsGained = 0;

  player.exp += amount;

  while (player.exp >= player.expToNextLevel) {
    player.exp -= player.expToNextLevel;

    player.level += 1;
    levelsGained += 1;

    player.expToNextLevel = Math.floor(player.expToNextLevel * 1.35);

    player.maxHp += 18;
    player.attack += 3;
    player.defense += 1;

    player.agility += 1;
    player.luck += 1;

    if (player.level % 3 === 0) {
      player.maxEnergy += 1;
    }
  }

  if (levelsGained > 0) {
    const stats = getPlayerStats(player);

    player.hp = stats.maxHp;
    player.energy = player.maxEnergy;
  }

  return {
    leveledUp: levelsGained > 0,
    levelsGained,
    oldLevel,
    newLevel: player.level,
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
      '+18 к максимальному HP',
      '+3 к атаке',
      '+1 к защите',
      '+1 к ловкости',
      '+1 к удаче',
      result.newLevel % 3 === 0 ? '+1 к максимальной энергии' : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Получено уровней: ${result.levelsGained}`,
    `Новый уровень: ${result.newLevel}`,
    '',
    `+${18 * result.levelsGained} к максимальному HP`,
    `+${3 * result.levelsGained} к атаке`,
    `+${result.levelsGained} к защите`,
    `+${result.levelsGained} к ловкости`,
    `+${result.levelsGained} к удаче`,
  ].join('\n');
}