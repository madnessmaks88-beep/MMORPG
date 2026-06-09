import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getRaceById } from '../data/races';
import { getRelicById } from '../data/relics';

import { getPlayerStats } from '../systems/InventorySystem';

import { createBottomNav } from '../ui/createBottomNav';

import {
  UI,
  createPanel,
  createSceneBackground,
  createSectionTitle,
  createSmallText,
  createTitle,
} from '../ui/theme';

export class ProfileScene extends Phaser.Scene {
  constructor() {
    super('ProfileScene');
  }

  create() {
    createSceneBackground(this);
    createTitle(this, 'Профиль героя', 'Путь того, кто спускается ниже');

    this.createHeroPanel();
    this.createStatsPanel();
    this.createProgressPanel();
    this.createRelicsPanel();

    createBottomNav(this, {
      activeScene: 'ProfileScene',
    });
  }

  private createHeroPanel() {
    const { width } = this.scale;

    const race = player.raceId ? getRaceById(player.raceId) : null;

    const panelY = 205;

    createPanel(this, width / 2, panelY, 620, 165, {
      alpha: 0.88,
      stroke: true,
      warm: true,
    });

    this.add.circle(width / 2, panelY - 48, 32, 0x2a1d13, 1)
      .setStrokeStyle(2, UI.colors.goldDark, 0.55);

    this.add.text(width / 2, panelY - 48, '◆', {
      fontFamily: UI.font.body,
      fontSize: '27px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    this.add.text(width / 2, panelY - 8, player.name, {
      fontFamily: UI.font.title,
      fontSize: '31px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const text = [
      `Раса: ${race?.name ?? 'Не выбрана'}`,
      `Уровень: ${player.level}`,
      `Опыт: ${player.exp}/${player.expToNextLevel}`,
      `Золото: ${player.gold}`,
    ].join('  •  ');

    createSmallText(this, width / 2, panelY + 45, text, {
      fontSize: '16px',
      color: UI.colors.text,
      width: 560,
    });
  }

  private createStatsPanel() {
    const { width } = this.scale;

    const stats = getPlayerStats(player);

    const panelY = 430;

    createPanel(this, width / 2, panelY, 620, 285, {
      alpha: 0.86,
      stroke: true,
      warm: false,
    });

    createSectionTitle(this, width / 2, panelY - 112, 'Характеристики');

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

    this.createStatColumn(width / 2 - 250, panelY - 55, leftStats);
    this.createStatColumn(width / 2 + 25, panelY - 55, rightStats);
  }

  private createStatColumn(x: number, y: number, text: string) {
    this.add.text(x, y, text, {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: UI.colors.text,
      lineSpacing: 7,
    }).setOrigin(0, 0);
  }

  private createProgressPanel() {
    const { width } = this.scale;

    const panelY = 660;

    createPanel(this, width / 2, panelY, 620, 145, {
      alpha: 0.68,
      stroke: false,
      warm: true,
    });

    this.add.text(width / 2, panelY - 42, 'Прогресс спуска', {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    const activeRunText = gameState.floorRun.active
      ? `Активный спуск: этаж ${gameState.floorRun.currentFloor}`
      : 'Активный спуск: нет';

    const text = [
      `Рекорд этажа: ${gameState.highestClearedFloor}`,
      `Пройдено ярусов: ${gameState.highestClearedTier}`,
      `Следующий ярус: ${gameState.highestClearedTier + 1}`,
      activeRunText,
    ].join('\n');

    this.add.text(width / 2, panelY + 18, text, {
      fontFamily: UI.font.body,
      fontSize: '17px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 5,
    }).setOrigin(0.5);
  }

  private createRelicsPanel() {
    const { width } = this.scale;

    const panelY = 870;

    createPanel(this, width / 2, panelY, 620, 250, {
      alpha: 0.86,
      stroke: true,
      warm: false,
    });

    createSectionTitle(this, width / 2, panelY - 95, 'Реликвии');

    if (player.relicIds.length === 0) {
      createSmallText(
        this,
        width / 2,
        panelY + 20,
        'Реликвий пока нет.\nПобеди финального босса яруса, чтобы получить первую.',
        {
          fontSize: '19px',
          color: UI.colors.textMuted,
          width: 520,
        }
      );

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

    this.add.text(width / 2, panelY + 20, relicTexts, {
      fontFamily: UI.font.body,
      fontSize: '17px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 540,
      },
      lineSpacing: 6,
    }).setOrigin(0.5);
  }
}