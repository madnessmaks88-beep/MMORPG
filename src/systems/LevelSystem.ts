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

    player.expToNextLevel = Math.floor(player.expToNextLevel * 1.55);

    player.maxHp += 10;
    player.attack += 1;

    if (player.level % 2 === 0) {
      player.defense += 1;
    }

    if (player.level % 2 === 0) {
      player.agility += 1;
    }

    if (player.level % 3 === 0) {
      player.luck += 1;
    }

    if (player.level % 4 === 0) {
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
    const lines = [
      `Новый уровень: ${result.newLevel}`,
      '',
      '+10 к максимальному HP',
      '+1 к атаке',
    ];

    if (result.newLevel % 2 === 0) {
      lines.push('+1 к защите');
      lines.push('+1 к ловкости');
    }

    if (result.newLevel % 3 === 0) {
      lines.push('+1 к удаче');
    }

    if (result.newLevel % 4 === 0) {
      lines.push('+1 к максимальной энергии');
    }

    return lines.join('\n');
  }

  return [
    `Получено уровней: ${result.levelsGained}`,
    `Новый уровень: ${result.newLevel}`,
    '',
    'Характеристики немного выросли.',
  ].join('\n');
}