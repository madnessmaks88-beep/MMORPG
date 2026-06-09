import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState } from '../data/gameState';

import {
  canStartFloor,
  getFloorPreview,
  getFloorRequirement,
  getFloorTitle,
  startFloorRun,
} from '../systems/FloorSystem';

import { getPlayerStats } from '../systems/InventorySystem';
import { saveGameAsync } from '../systems/SaveSystem';


import { createBottomNav } from '../ui/createBottomNav';

export class DungeonSelectScene extends Phaser.Scene {
  constructor() {
    super('DungeonSelectScene');
  }

  create() {
    const { width } = this.scale;

    this.createBackground();

    this.add.text(width / 2, 58, 'Спуск в глубины', {
      fontFamily: 'Arial',
      fontSize: '44px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 105, 'Выбери этаж для зачистки', {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#9c8f7a',
    }).setOrigin(0.5);

    this.createProgressPanel();
    this.createFloorCards();

    createBottomNav(this, {
      activeScene: 'CampScene',
    });
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x090909);
    this.add.rectangle(width / 2, height / 2, width, height, 0x100c0a, 0.92);

    for (let i = 0; i < 34; i++) {
      const x = Phaser.Math.Between(40, width - 40);
      const y = Phaser.Math.Between(30, height - 160);
      const size = Phaser.Math.Between(1, 3);

      this.add.circle(x, y, size, 0xd8b56d, 0.06);
    }

    this.add.rectangle(width / 2, height - 160, width, 300, 0x050505, 0.5);
  }

  private createProgressPanel() {
    const { width } = this.scale;

    const currentAvailableFloor = gameState.highestClearedFloor + 1;
    const currentTier = Math.ceil(currentAvailableFloor / 25);

    this.add.rectangle(width / 2, 195, 610, 130, 0x0d0d0d, 0.92)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 155, 'Прогресс спуска', {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    const text = [
      `Пройдено этажей: ${gameState.highestClearedFloor}`,
      `Пройдено ярусов: ${gameState.highestClearedTier}`,
      `Следующий этаж: ${currentAvailableFloor}`,
      `Текущий ярус: ${currentTier}`,
    ].join('\n');

    this.add.text(width / 2, 215, text, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 5,
    }).setOrigin(0.5);
  }

  private createFloorCards() {
    const nextFloor = gameState.highestClearedFloor + 1;

    const floorsToShow = [
      Math.max(1, nextFloor - 1),
      nextFloor,
      nextFloor + 1,
    ];

    const uniqueFloors = [...new Set(floorsToShow)];

    uniqueFloors.forEach((floor, index) => {
      this.createFloorCard(floor, 380 + index * 250);
    });
  }

  private createFloorCard(floor: number, y: number) {
    const { width } = this.scale;

    const stats = getPlayerStats(player);
    const requirement = getFloorRequirement(floor);
    const preview = getFloorPreview(floor);
    const isAvailable = canStartFloor(floor);
    const isCleared = gameState.highestClearedFloor >= floor;

    const cardColor = isCleared ? 0x111811 : isAvailable ? 0x171313 : 0x111111;
    const strokeColor = isCleared ? 0x75d184 : isAvailable ? 0x8b5a2b : 0x444444;

    this.add.rectangle(width / 2, y, 610, 225, cardColor, 0.95)
      .setStrokeStyle(2, strokeColor);

    this.add.text(width / 2, y - 78, getFloorTitle(floor), {
      fontFamily: 'Arial',
      fontSize: '27px',
      color: isCleared ? '#75d184' : isAvailable ? '#f0d58a' : '#777777',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const status = isCleared
      ? 'Пройден'
      : isAvailable
        ? 'Доступен'
        : 'Закрыт';

    this.add.text(width / 2, y - 42, status, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: isCleared ? '#75d184' : isAvailable ? '#d8c7a3' : '#666666',
    }).setOrigin(0.5);

    const requirementText = [
      `Рек. уровень: ${requirement.level} / твой: ${player.level}`,
      `Рек. атака: ${requirement.attack} / твоя: ${stats.attack}`,
      `Рек. защита: ${requirement.defense} / твоя: ${stats.defense}`,
      `Рек. HP: ${requirement.hp} / твоё: ${stats.maxHp}`,
    ].join('\n');

    this.add.text(width / 2 - 270, y - 8, requirementText, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: isAvailable ? '#d8c7a3' : '#666666',
      lineSpacing: 4,
    }).setOrigin(0, 0);

    const previewText = [
      preview.modifierName,
      preview.modifierDescription,
      '',
      `Комнат: ${preview.rooms}`,
      `Монстры: ${preview.monsters}`,
      `Особая: ${preview.special}`,
      `Босс: ${preview.boss}`,
      '',
      preview.danger,
    ].join('\n');

    this.add.text(width / 2 + 55, y - 10, previewText, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: isAvailable ? this.getDangerColor(floor) : '#666666',
      align: 'center',
      wordWrap: {
        width: 245,
      },
      lineSpacing: 3,
    }).setOrigin(0.5);

    if (isAvailable) {
      const buttonText = isCleared ? 'Пройти снова' : 'Начать этаж';

      const buttonBg = this.add.rectangle(width / 2 + 190, y + 72, 210, 48, 0x241515)
        .setStrokeStyle(2, 0xf0d58a)
        .setInteractive({ useHandCursor: true });

      this.add.text(width / 2 + 190, y + 72, buttonText, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#f0d58a',
      }).setOrigin(0.5);

      buttonBg.on('pointerdown', () => {
        startFloorRun(floor);
        void saveGameAsync();

        this.scene.start('DungeonScene');
      });
    } else {
      this.add.text(width / 2 + 190, y + 72, 'Сначала пройди\nпредыдущий этаж', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#666666',
        align: 'center',
      }).setOrigin(0.5);
    }
  }

  private getDangerColor(floor: number) {
    if (floor % 25 === 0) {
      return '#ff4d4d';
    }

    if (floor % 5 === 0) {
      return '#f0d58a';
    }

    return '#9c8f7a';
  }
}