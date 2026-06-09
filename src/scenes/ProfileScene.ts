import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getRaceById } from '../data/races';
import { getRelicById } from '../data/relics';

import { getPlayerStats } from '../systems/InventorySystem';
import { createBottomNav } from '../ui/createBottomNav';

export class ProfileScene extends Phaser.Scene {
  constructor() {
    super('ProfileScene');
  }

  create() {
    const { width } = this.scale;

    const stats = getPlayerStats(player);
    const race = player.raceId ? getRaceById(player.raceId) : null;

    this.createBackground();

    this.add.text(width / 2, 55, 'Профиль героя', {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 98, 'Путь того, кто спускается ниже', {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#9c8f7a',
    }).setOrigin(0.5);

    this.createHeroPanel(race?.name ?? 'Не выбрана');
    this.createStatsPanel(stats);
    this.createProgressPanel();
    this.createRelicsPanel();

    createBottomNav(this, {
      activeScene: 'ProfileScene',
    });
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x090909);
    this.add.rectangle(width / 2, height / 2, width, height, 0x100c0a, 0.94);

    for (let i = 0; i < 34; i++) {
      const x = Phaser.Math.Between(35, width - 35);
      const y = Phaser.Math.Between(35, height - 160);
      const size = Phaser.Math.Between(1, 3);

      this.add.circle(x, y, size, 0xd8b56d, 0.055);
    }

    this.add.rectangle(width / 2, height - 160, width, 300, 0x050505, 0.55);
  }

  private createHeroPanel(raceName: string) {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 190, 600, 130, 0x0d0d0d, 0.94)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 150, player.name, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const text = [
      `Раса: ${raceName}`,
      `Уровень: ${player.level}`,
      `Опыт: ${player.exp}/${player.expToNextLevel}`,
      `Золото: ${player.gold}`,
    ].join('\n');

    this.add.text(width / 2, 215, text, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 5,
    }).setOrigin(0.5);
  }

  private createStatsPanel(stats: ReturnType<typeof getPlayerStats>) {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 400, 600, 260, 0x0d0d0d, 0.94)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 295, 'Характеристики', {
      fontFamily: 'Arial',
      fontSize: '27px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    const leftStats = [
      `HP: ${player.hp}/${stats.maxHp}`,
      `Энергия: ${player.energy}/${stats.maxEnergy}`,
      `Атака: ${stats.attack}`,
      `Защита: ${stats.defense}`,
      `Крит: ${Math.round(stats.critChance * 100)}%`,
    ].join('\n');

    const rightStats = [
      `Сила: ${stats.strength}`,
      `Ловкость: ${stats.agility}`,
      `Уклонение: ${Math.round(stats.dodgeChance * 100)}%`,
      `Удача: ${stats.luck}`,
      `Добыча: +${Math.round(stats.lootChanceBonus * 100)}%`,
      `Интеллект: ${stats.intelligence}`,
    ].join('\n');

    this.add.text(width / 2 - 250, 345, leftStats, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d8c7a3',
      lineSpacing: 7,
    }).setOrigin(0, 0);

    this.add.text(width / 2 + 20, 345, rightStats, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d8c7a3',
      lineSpacing: 7,
    }).setOrigin(0, 0);
  }

  private createProgressPanel() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 610, 600, 145, 0x0d0d0d, 0.94)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 560, 'Прогресс спуска', {
      fontFamily: 'Arial',
      fontSize: '27px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    const nextTier = gameState.highestClearedTier + 1;

    const text = [
      `Рекорд этажа: ${gameState.highestClearedFloor}`,
      `Пройдено ярусов: ${gameState.highestClearedTier}`,
      `Следующий ярус: ${nextTier}`,
      `Активный забег: ${gameState.floorRun.active ? `этаж ${gameState.floorRun.currentFloor}` : 'нет'}`,
    ].join('\n');

    this.add.text(width / 2, 625, text, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5);
  }

  private createRelicsPanel() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 835, 600, 250, 0x0d0d0d, 0.94)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 735, 'Реликвии', {
      fontFamily: 'Arial',
      fontSize: '27px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    if (player.relicIds.length === 0) {
      this.add.text(width / 2, 835, 'Реликвий пока нет.\nПобеди финального босса яруса, чтобы получить первую.', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#70675a',
        align: 'center',
        wordWrap: {
          width: 520,
        },
        lineSpacing: 7,
      }).setOrigin(0.5);

      return;
    }

    const relicTexts = player.relicIds
      .map(id => getRelicById(id))
      .filter(Boolean)
      .map(relic => {
        if (!relic) {
          return '';
        }

        return `${relic.name}\n${relic.description}`;
      })
      .join('\n\n');

    this.add.text(width / 2, 850, relicTexts, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#d8c7a3',
      align: 'center',
      wordWrap: {
        width: 520,
      },
      lineSpacing: 6,
    }).setOrigin(0.5);
  }
}