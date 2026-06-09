import Phaser from 'phaser';

import { gameState, getTierEndFloor, getTierStartFloor } from '../data/gameState';

import {
  canStartTier,
  getHighestUnlockedTier,
  startTierGateBoss,
  startTierRun,
} from '../systems/FloorSystem';

import { saveGameAsync } from '../systems/SaveSystem';
import { createBottomNav } from '../ui/createBottomNav';

export class DungeonSelectScene extends Phaser.Scene {
  constructor() {
    super('DungeonSelectScene');
  }

  create() {
    const { width } = this.scale;

    this.createBackground();

    this.add.text(width / 2, 55, 'Выбор яруса', {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 98, 'Ярус нужно проходить от начала до конца', {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#9c8f7a',
    }).setOrigin(0.5);

    this.createProgressPanel();

    const unlockedTier = getHighestUnlockedTier();

    this.createTierCard(1, 345);

    if (unlockedTier >= 2) {
      this.createTierCard(2, 640);
    } else {
      this.createLockedTierCard(2, 640);
    }

    createBottomNav(this, {
      activeScene: 'CampScene',
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
    this.add.rectangle(width / 2, height - 130, width, 2, 0x8b5a2b, 0.6);
  }

  private createProgressPanel() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 175, 600, 120, 0x0d0d0d, 0.94)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 135, 'Прогресс', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    const text = [
      `Пройдено ярусов: ${gameState.highestClearedTier}`,
      `Рекорд этажа: ${gameState.highestClearedFloor}`,
      `Доступный ярус: ${getHighestUnlockedTier()}`,
    ].join('\n');

    this.add.text(width / 2, 185, text, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5);
  }

  private createTierCard(tier: number, y: number) {
    const { width } = this.scale;

    const startFloor = getTierStartFloor(tier);
    const endFloor = getTierEndFloor(tier);
    const isCleared = gameState.highestClearedTier >= tier;
    const isAvailable = canStartTier(tier);

    this.add.rectangle(width / 2, y, 610, 245, 0x171313, 0.96)
      .setStrokeStyle(2, isCleared ? 0x75d184 : 0x8b5a2b);

    this.add.text(width / 2, y - 90, `${tier}-й ярус`, {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: isCleared ? '#75d184' : '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const status = isCleared ? 'Пройден' : isAvailable ? 'Доступен' : 'Закрыт';

    this.add.text(width / 2, y - 52, status, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: isCleared ? '#75d184' : '#d8c7a3',
    }).setOrigin(0.5);

    const description = [
      `Этажи: ${startFloor}–${endFloor}`,
      `Если выйти в город до конца яруса — придётся начинать ярус заново.`,
      `Финальный босс ждёт на ${endFloor} этаже.`,
    ].join('\n');

    this.add.text(width / 2, y + 4, description, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#d8c7a3',
      align: 'center',
      wordWrap: {
        width: 540,
      },
      lineSpacing: 6,
    }).setOrigin(0.5);

    this.createButton(width / 2, y + 82, 250, 50, `Начать с ${startFloor} этажа`, () => {
      startTierRun(tier);

      void saveGameAsync();

      this.scene.start('DungeonScene');
    });

    if (tier > 1 && gameState.highestClearedTier >= tier - 1) {
      this.createButton(width / 2, y + 140, 430, 48, `Победить босса ${tier - 1}-го яруса`, () => {
        startTierGateBoss(tier);

        void saveGameAsync();

        this.scene.start('DungeonScene');
      });
    }
  }

  private createLockedTierCard(tier: number, y: number) {
    const { width } = this.scale;

    this.add.rectangle(width / 2, y, 610, 220, 0x111111, 0.95)
      .setStrokeStyle(2, 0x444444);

    this.add.text(width / 2, y - 60, `${tier}-й ярус`, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#666666',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, y, `Закрыт.\nСначала пройди ${tier - 1}-й ярус.`, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#777777',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    onClick: () => void
  ) {
    const bg = this.add.rectangle(x, y, width, height, 0x241515)
      .setStrokeStyle(2, 0xf0d58a)
      .setInteractive({ useHandCursor: true });

    this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    bg.on('pointerdown', onClick);
  }
}