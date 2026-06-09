import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState, resetFloorRun } from '../data/gameState';
import { getRaceById } from '../data/races';
import { getRelicById } from '../data/relics';

import { getPlayerStats } from '../systems/InventorySystem';
import { saveGameAsync } from '../systems/SaveSystem';
import { getCachedVKUser } from '../systems/VKBridgeSystem';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

export class CampScene extends Phaser.Scene {
  private readonly campfireCooldownMs = 5 * 60 * 1000;

  constructor() {
    super('CampScene');
  }

  create() {
    this.createBackground();
    this.createHeader();
    this.createHeroSummary();
    this.createMainActions();
    this.createRunInfo();

    createBottomNav(this, {
      activeScene: 'CampScene',
    });
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x070605);
    this.add.rectangle(width / 2, height / 2, width, height, 0x120d0a, 0.94);

    for (let i = 0; i < 46; i++) {
      const x = Phaser.Math.Between(24, width - 24);
      const y = Phaser.Math.Between(30, height - 145);
      const size = Phaser.Math.Between(1, 3);

      this.add.circle(x, y, size, 0xd8b56d, 0.055);
    }

    this.add.circle(width / 2, 186, 120, 0x9b3519, 0.13);
    this.add.circle(width / 2, 186, 70, 0xf0a348, 0.12);
    this.add.circle(width / 2, 186, 34, 0xf0d58a, 0.08);

    this.add.rectangle(width / 2, height - 160, width, 300, 0x050505, 0.58);
    this.add.rectangle(width / 2, height - 112, width, 2, 0x8b5a2b, 0.7);
  }

  private createHeader() {
    const { width } = this.scale;

    const vkUser = getCachedVKUser();
    const vkName = vkUser ? vkUser.first_name : 'локальный режим';

    this.add.text(width / 2, 48, 'Лагерь у входа', {
      fontFamily: 'Arial',
      fontSize: '40px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 88, `Игрок: ${vkName}`, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#9c8f7a',
    }).setOrigin(0.5);

    this.add.text(width / 2, 126, 'Тихое место перед спуском в катакомбы', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#70675a',
    }).setOrigin(0.5);
  }

  private createHeroSummary() {
    const { width } = this.scale;

    const race = player.raceId ? getRaceById(player.raceId) : null;
    const relicNames = player.relicIds
      .map(id => getRelicById(id)?.name)
      .filter(Boolean);

    const panelY = 270;

    this.add.rectangle(width / 2, panelY, 620, 220, 0x0d0d0d, 0.96)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, panelY - 78, player.name, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, panelY - 42, race ? race.name : 'Раса не выбрана', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d8c7a3',
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, panelY - 12, 540, 1, 0x8b5a2b, 0.45);

    const summary = [
      `Уровень ${player.level}`,
      `Золото: ${player.gold}`,
      `Зелья: ${player.potions}`,
    ].join('  •  ');

    this.add.text(width / 2, panelY + 24, summary, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#d8c7a3',
      align: 'center',
    }).setOrigin(0.5);

    const relicText =
      relicNames.length > 0
        ? `Реликвии: ${relicNames.join(', ')}`
        : 'Реликвии: нет';

    this.add.text(width / 2, panelY + 66, relicText, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: relicNames.length > 0 ? '#f0d58a' : '#70675a',
      align: 'center',
      wordWrap: {
        width: 540,
      },
    }).setOrigin(0.5);
  }

  private createMainActions() {
    const { width } = this.scale;

    const panelY = 620;

    this.add.rectangle(width / 2, panelY, 620, 430, 0x0d0d0d, 0.95)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, panelY - 180, 'Что делаем?', {
      fontFamily: 'Arial',
      fontSize: '31px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const hasActiveRun =
      gameState.floorRun.active &&
      gameState.floorRun.rooms.length > 0;

    const dungeonButtonText = hasActiveRun
      ? `Продолжить спуск: этаж ${gameState.floorRun.currentFloor}`
      : 'Войти в катакомбы';

    let y = panelY - 112;

    createButton(
      this,
      width / 2,
      y,
      dungeonButtonText,
      () => {
        if (hasActiveRun) {
          this.scene.start('DungeonScene');
          return;
        }

        this.scene.start('DungeonSelectScene');
      },
      540,
      62
    );

    y += 72;

    if (hasActiveRun) {
      createButton(
        this,
        width / 2,
        y,
        'Покинуть спуск',
        () => {
          this.showLeaveRunMessage();
        },
        540,
        56
      );

      y += 66;
    }

    createButton(
      this,
      width / 2,
      y,
      'Задания',
      () => {
        this.scene.start('QuestScene');
      },
      540,
      56
    );

    y += 66;

    createButton(
      this,
      width / 2,
      y,
      'Кузница',
      () => {
        this.scene.start('ForgeScene');
      },
      540,
      56
    );

    y += 66;

    const cooldownLeft = this.getCampfireCooldownLeft();
    const restButtonText =
      cooldownLeft > 0
        ? `Костёр: ${this.formatCooldown(cooldownLeft)}`
        : 'Отдохнуть у костра';

    createButton(
      this,
      width / 2,
      y,
      restButtonText,
      () => {
        const currentCooldownLeft = this.getCampfireCooldownLeft();

        if (currentCooldownLeft > 0) {
          this.showRestCooldownMessage(currentCooldownLeft);
          return;
        }

        const stats = getPlayerStats(player);

        player.hp = stats.maxHp;
        player.energy = stats.maxEnergy;
        player.potions = Math.max(player.potions, 2);

        gameState.lastCampRestAt = Date.now();

        void saveGameAsync();

        this.showRestMessage();
      },
      540,
      56
    );
  }

  private createRunInfo() {
    const { width } = this.scale;

    const panelY = 900;

    this.add.rectangle(width / 2, panelY, 620, 135, 0x0d0d0d, 0.92)
      .setStrokeStyle(2, 0x3a2518);

    this.add.text(width / 2, panelY - 42, 'Прогресс', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#f0d58a',
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
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 5,
    }).setOrigin(0.5);
  }

  private getCampfireCooldownLeft() {
    const lastRestAt = gameState.lastCampRestAt ?? 0;

    if (lastRestAt <= 0) {
      return 0;
    }

    const passed = Date.now() - lastRestAt;
    const left = this.campfireCooldownMs - passed;

    return Math.max(0, left);
  }

  private formatCooldown(ms: number) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private showRestMessage() {
    this.showMessage(
      'Отдых у костра',
      'Ты восстановил здоровье, энергию и пополнил запас зелий.'
    );
  }

  private showRestCooldownMessage(cooldownLeft: number) {
    this.showMessage(
      'Костёр ещё тлеет',
      `Перед следующим отдыхом нужно подождать: ${this.formatCooldown(cooldownLeft)}.`
    );
  }

  private showLeaveRunMessage() {
    this.showConfirmMessage(
      'Покинуть спуск?',
      'Если выйти сейчас, текущий ярус придётся проходить заново.',
      () => {
        resetFloorRun();

        void saveGameAsync();

        this.scene.restart();
      }
    );
  }

  private showMessage(title: string, message: string) {
    const { width } = this.scale;

    const overlay = this.add.rectangle(width / 2, 610, 620, 280, 0x050505, 0.98)
      .setStrokeStyle(3, 0xf0d58a)
      .setDepth(100);

    const titleText = this.add.text(width / 2, 535, title, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(101);

    const messageText = this.add.text(width / 2, 610, message, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#d8c7a3',
      align: 'center',
      wordWrap: {
        width: 540,
      },
      lineSpacing: 7,
    }).setOrigin(0.5).setDepth(101);

    const okButton = this.add.rectangle(width / 2, 705, 220, 54, 0x241515)
      .setStrokeStyle(2, 0xf0d58a)
      .setInteractive({ useHandCursor: true })
      .setDepth(101);

    const okText = this.add.text(width / 2, 705, 'Понятно', {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#f0d58a',
    }).setOrigin(0.5).setDepth(102);

    okButton.on('pointerdown', () => {
      overlay.destroy();
      titleText.destroy();
      messageText.destroy();
      okButton.destroy();
      okText.destroy();

      this.scene.restart();
    });
  }

  private showConfirmMessage(title: string, message: string, onConfirm: () => void) {
    const { width } = this.scale;

    const overlay = this.add.rectangle(width / 2, 610, 620, 320, 0x050505, 0.98)
      .setStrokeStyle(3, 0xf0d58a)
      .setDepth(100);

    const titleText = this.add.text(width / 2, 510, title, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(101);

    const messageText = this.add.text(width / 2, 590, message, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#d8c7a3',
      align: 'center',
      wordWrap: {
        width: 540,
      },
      lineSpacing: 7,
    }).setOrigin(0.5).setDepth(101);

    const cancelButton = this.add.rectangle(width / 2 - 125, 715, 220, 54, 0x151515)
      .setStrokeStyle(2, 0x8b5a2b)
      .setInteractive({ useHandCursor: true })
      .setDepth(101);

    const confirmButton = this.add.rectangle(width / 2 + 125, 715, 220, 54, 0x241515)
      .setStrokeStyle(2, 0xf0d58a)
      .setInteractive({ useHandCursor: true })
      .setDepth(101);

    const cancelText = this.add.text(width / 2 - 125, 715, 'Отмена', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d8c7a3',
    }).setOrigin(0.5).setDepth(102);

    const confirmText = this.add.text(width / 2 + 125, 715, 'Выйти', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#f0d58a',
    }).setOrigin(0.5).setDepth(102);

    const destroyAll = () => {
      overlay.destroy();
      titleText.destroy();
      messageText.destroy();
      cancelButton.destroy();
      confirmButton.destroy();
      cancelText.destroy();
      confirmText.destroy();
    };

    cancelButton.on('pointerdown', () => {
      destroyAll();
    });

    confirmButton.on('pointerdown', () => {
      destroyAll();
      onConfirm();
    });
  }
}