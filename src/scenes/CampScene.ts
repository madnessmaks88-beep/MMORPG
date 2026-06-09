import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState, resetFloorRun } from '../data/gameState';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

import { getPlayerStats } from '../systems/InventorySystem';
import { saveGameAsync } from '../systems/SaveSystem';
import { getCachedVKUser } from '../systems/VKBridgeSystem';

import { getRelicById } from '../data/relics';

export class CampScene extends Phaser.Scene {
  private readonly campfireCooldownMs = 5 * 60 * 1000;

  constructor() {
    super('CampScene');
  }

  create() {
    const { width } = this.scale;
    const stats = getPlayerStats(player);
    const vkUser = getCachedVKUser();

    this.createBackground();

    this.add.text(width / 2, 45, 'Лагерь у входа', {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 83, 'Последнее тёплое место перед тьмой.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#9c8f7a',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      110,
      vkUser
        ? `Игрок VK: ${vkUser.first_name} ${vkUser.last_name}`
        : 'Локальный режим',
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: vkUser ? '#75d184' : '#70675a',
        align: 'center',
      }
    ).setOrigin(0.5);

    this.createCampfire(width / 2, 185);
    this.createHeroCard(stats);
    this.createActionCards();

    createBottomNav(this, {
      activeScene: 'CampScene',
    });
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x090909);
    this.add.rectangle(width / 2, height / 2, width, height, 0x130d0b, 0.9);

    this.add.circle(width / 2, 185, 160, 0xe0772f, 0.04);
    this.add.circle(width / 2, 185, 95, 0xf0d58a, 0.05);

    for (let i = 0; i < 32; i++) {
      const x = Phaser.Math.Between(40, width - 40);
      const y = Phaser.Math.Between(40, height - 170);
      const size = Phaser.Math.Between(1, 3);

      this.add.circle(x, y, size, 0xd8b56d, 0.06);
    }

    this.add.rectangle(width / 2, height - 165, width, 280, 0x050505, 0.5);
    this.add.rectangle(width / 2, height - 130, width, 2, 0x8b5a2b, 0.6);
  }

  private createCampfire(x: number, y: number) {
    this.add.ellipse(x, y + 48, 210, 55, 0x000000, 0.35);

    this.add.circle(x, y, 95, 0xe0772f, 0.08);
    this.add.circle(x, y, 62, 0xf0d58a, 0.1);

    this.add.rectangle(x - 30, y + 34, 88, 15, 0x4a2a16).setAngle(-18);
    this.add.rectangle(x + 30, y + 34, 88, 15, 0x4a2a16).setAngle(18);

    const flame1 = this.add.triangle(
      x,
      y + 12,
      0,
      78,
      34,
      0,
      68,
      78,
      0xc24747,
      0.95
    ).setOrigin(0.5);

    const flame2 = this.add.triangle(
      x,
      y + 2,
      0,
      58,
      25,
      0,
      50,
      58,
      0xe0772f,
      0.95
    ).setOrigin(0.5);

    const flame3 = this.add.triangle(
      x,
      y,
      0,
      38,
      17,
      0,
      34,
      38,
      0xf0d58a,
      0.95
    ).setOrigin(0.5);

    this.tweens.add({
      targets: [flame1, flame2, flame3],
      scaleX: 1.08,
      scaleY: 0.94,
      duration: 520,
      yoyo: true,
      repeat: -1,
    });
  }

  private createHeroCard(stats: ReturnType<typeof getPlayerStats>) {
    const { width } = this.scale;

    const cardY = 385;

    this.add.rectangle(width / 2, cardY, 600, 260, 0x0d0d0d, 0.92)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.rectangle(width / 2, cardY - 100, 560, 48, 0x171313, 0.95)
      .setStrokeStyle(1, 0x2a2117);

    this.add.text(width / 2, cardY - 100, player.name, {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const leftStats = [
      `Уровень: ${player.level}`,
      `Опыт: ${player.exp}/${player.expToNextLevel}`,
      `Золото: ${player.gold}`,
      `HP: ${player.hp}/${stats.maxHp}`,
      `Энергия: ${player.energy}/${player.maxEnergy}`,
      `Зелья: ${player.potions}`,
    ].join('\n');

    const rightStats = [
      `Атака: ${stats.attack}`,
      `Защита: ${stats.defense}`,
      `Крит: ${Math.round(stats.critChance * 100)}%`,
      `Ловкость: ${stats.agility}`,
      `Уклонение: ${Math.round(stats.dodgeChance * 100)}%`,
      `Удача: ${stats.luck}`,
      `Добыча: +${Math.round(stats.lootChanceBonus * 100)}%`,
    ].join('\n');

    this.add.text(width / 2 - 240, cardY - 57, leftStats, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#d8c7a3',
      lineSpacing: 6,
    }).setOrigin(0, 0);

    this.add.text(width / 2 + 25, cardY - 57, rightStats, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#d8c7a3',
      lineSpacing: 6,
    }).setOrigin(0, 0);

    const relicNames = player.relicIds
      .map(id => getRelicById(id)?.name)
      .filter(Boolean);
      
    const relicText =
      relicNames.length > 0
        ? `Реликвии: ${relicNames.join(', ')}`
        : 'Реликвии: нет';
      
    this.add.text(width / 2, cardY + 105, relicText, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: relicNames.length > 0 ? '#f0d58a' : '#70675a',
      align: 'center',
      wordWrap: {
        width: 540,
      },
    }).setOrigin(0.5);
  }

  private createActionCards() {
    const { width } = this.scale;

    const hasActiveRun =
    gameState.floorRun.active &&
    gameState.floorRun.rooms.length > 0;

    const questsY = hasActiveRun ? 710 : 650;
    const forgeY = hasActiveRun ? 790 : 730;
    const restY = hasActiveRun ? 870 : 810;
    
    const dungeonButtonText = hasActiveRun
      ? `Продолжить спуск: этаж ${gameState.floorRun.currentFloor}`
      : 'Войти в катакомбы';

      if (hasActiveRun) {
        createButton(
          this,
          width / 2,
          635,
          'Покинуть спуск',
          () => {
            this.showLeaveRunMessage();
          },
          540,
          58
        );
      }

    createButton(
      this,
      width / 2,
      570,
      dungeonButtonText,
      () => {
        if (hasActiveRun) {
          this.scene.start('DungeonScene');
          return;
        }
      
        this.scene.start('DungeonSelectScene');
      },
      540,
      68
    );

    if (hasActiveRun) {
      this.add.text(
        width / 2,
        615,
        `Комната ${gameState.floorRun.currentRoomIndex + 1}/${gameState.floorRun.rooms.length}`,
        {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#9c8f7a',
        }
      ).setOrigin(0.5);
    }

    createButton(
      this,
      width / 2,
      questsY,
      'Задания',
      () => {
        this.scene.start('QuestScene');
      },
      540,
      68
    );

    createButton(
      this,
      width / 2,
      forgeY,
      'Кузница',
      () => {
        this.scene.start('ForgeScene');
      },
      540,
      68
    );

    const restCooldownLeft = this.getCampfireCooldownLeft();

    const restButtonText =
      restCooldownLeft > 0
        ? `Костёр: ${this.formatCooldown(restCooldownLeft)}`
        : 'Отдохнуть у костра';

    createButton(
      this,
      width / 2,
      restY,
      restButtonText,
      () => {
        const cooldownLeft = this.getCampfireCooldownLeft();

        if (cooldownLeft > 0) {
          this.showRestCooldownMessage(cooldownLeft);
          return;
        }

        const stats = getPlayerStats(player);

        player.hp = stats.maxHp;
        player.energy = player.maxEnergy;
        player.potions = Math.max(player.potions, 2);

        gameState.lastCampRestAt = Date.now();

        void saveGameAsync();

        this.showRestMessage();
      },
      540,
      68
    );
  }

  private showLeaveRunMessage() {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.68)
      .setDepth(100);

    const panel = this.add.rectangle(width / 2, height / 2, 580, 340, 0x171313)
      .setStrokeStyle(3, 0x8b5a2b)
      .setDepth(101);

    const title = this.add.text(width / 2, height / 2 - 110, 'Покинуть спуск?', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(102);

    const text = this.add.text(
      width / 2,
      height / 2 - 25,
      `Текущий забег будет сброшен.\n\nЭтаж: ${gameState.floorRun.currentFloor}\nКомната: ${gameState.floorRun.currentRoomIndex + 1}/${gameState.floorRun.rooms.length}`,
      {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#d8c7a3',
        align: 'center',
        lineSpacing: 7,
      }
    ).setOrigin(0.5).setDepth(102);

    const leaveBg = this.add.rectangle(width / 2 - 145, height / 2 + 105, 240, 58, 0x2a1111)
      .setStrokeStyle(2, 0xff6b6b)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);

    const leaveText = this.add.text(width / 2 - 145, height / 2 + 105, 'Покинуть', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#ff6b6b',
    }).setOrigin(0.5).setDepth(103);

    const cancelBg = this.add.rectangle(width / 2 + 145, height / 2 + 105, 240, 58, 0x241515)
      .setStrokeStyle(2, 0xf0d58a)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);

    const cancelText = this.add.text(width / 2 + 145, height / 2 + 105, 'Остаться', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#f0d58a',
    }).setOrigin(0.5).setDepth(103);

    const closeModal = () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      text.destroy();
      leaveBg.destroy();
      leaveText.destroy();
      cancelBg.destroy();
      cancelText.destroy();
    };

    cancelBg.on('pointerdown', () => {
      closeModal();
    });

    leaveBg.on('pointerdown', () => {
      resetFloorRun();

      void saveGameAsync();

      closeModal();

      this.scene.restart();
    });
  }

  private getCampfireCooldownLeft() {
    const now = Date.now();
    const elapsed = now - gameState.lastCampRestAt;

    return Math.max(0, this.campfireCooldownMs - elapsed);
  }

  private formatCooldown(ms: number) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private showRestMessage() {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
      .setDepth(100);

    const panel = this.add.rectangle(width / 2, height / 2, 560, 280, 0x171313)
      .setStrokeStyle(3, 0x8b5a2b)
      .setDepth(101);

    const title = this.add.text(width / 2, height / 2 - 80, 'Отдых у костра', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(102);

    const text = this.add.text(
      width / 2,
      height / 2,
      'Ты восстановил здоровье и энергию.\nЗелья пополнены минимум до 2.',
      {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#d8c7a3',
        align: 'center',
        lineSpacing: 8,
      }
    ).setOrigin(0.5).setDepth(102);

    const closeBg = this.add.rectangle(width / 2, height / 2 + 88, 250, 58, 0x241515)
      .setStrokeStyle(2, 0x8b5a2b)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);

    const closeText = this.add.text(width / 2, height / 2 + 88, 'Хорошо', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#f0d58a',
    }).setOrigin(0.5).setDepth(103);

    closeBg.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      text.destroy();
      closeBg.destroy();
      closeText.destroy();

      this.scene.restart();
    });
  }

  private showRestCooldownMessage(cooldownLeft: number) {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
      .setDepth(100);

    const panel = this.add.rectangle(width / 2, height / 2, 560, 260, 0x171313)
      .setStrokeStyle(3, 0x8b5a2b)
      .setDepth(101);

    const title = this.add.text(width / 2, height / 2 - 78, 'Костёр ещё не готов', {
      fontFamily: 'Arial',
      fontSize: '31px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(102);

    const text = this.add.text(
      width / 2,
      height / 2 - 5,
      `Ты уже недавно отдыхал.\n\nДо следующего отдыха: ${this.formatCooldown(cooldownLeft)}`,
      {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#d8c7a3',
        align: 'center',
        lineSpacing: 8,
      }
    ).setOrigin(0.5).setDepth(102);

    const closeBg = this.add.rectangle(width / 2, height / 2 + 88, 240, 58, 0x241515)
      .setStrokeStyle(2, 0x8b5a2b)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);

    const closeText = this.add.text(width / 2, height / 2 + 88, 'Понятно', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#f0d58a',
    }).setOrigin(0.5).setDepth(103);

    closeBg.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      text.destroy();
      closeBg.destroy();
      closeText.destroy();

      this.scene.restart();
    });
  }
}