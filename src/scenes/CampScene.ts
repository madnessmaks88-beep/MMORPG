import Phaser from 'phaser';

import { player } from '../data/player';
import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';
import { getPlayerStats } from '../systems/InventorySystem';
import { saveGameAsync } from '../systems/SaveSystem';
import { getCachedVKUser } from '../systems/VKBridgeSystem';

export class CampScene extends Phaser.Scene {
  constructor() {
    super('CampScene');
  }

  create() {
    const { width } = this.scale;
    const stats = getPlayerStats(player);
    const vkUser = getCachedVKUser();

    this.createBackground();

    this.add.text(width / 2, 58, 'Лагерь у входа', {
      fontFamily: 'Arial',
      fontSize: '46px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 106, 'Последнее тёплое место перед тьмой.', {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#9c8f7a',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      136,
      vkUser
        ? `Игрок VK: ${vkUser.first_name} ${vkUser.last_name}`
        : 'Локальный режим',
      {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: vkUser ? '#75d184' : '#70675a',
        align: 'center',
      }
    ).setOrigin(0.5);

    this.createCampfire(width / 2, 230);
    this.createHeroCard(stats);
    this.createActionCards();

    createBottomNav(this, {
      activeScene: 'CampScene',
    });
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x090909);

    this.add.rectangle(width / 2, height / 2, width, height, 0x160f0c, 0.75);

    for (let i = 0; i < 26; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const size = Phaser.Math.Between(1, 3);

      this.add.circle(x, y, size, 0xd8b56d, 0.08);
    }

    this.add.rectangle(width / 2, height - 170, width, 300, 0x050505, 0.45);
  }

  private createCampfire(x: number, y: number) {
    this.add.ellipse(x, y + 58, 250, 70, 0x000000, 0.35);

    this.add.circle(x, y, 115, 0xe0772f, 0.08);
    this.add.circle(x, y, 75, 0xf0d58a, 0.1);

    this.add.rectangle(x - 35, y + 40, 100, 18, 0x4a2a16).setAngle(-18);
    this.add.rectangle(x + 35, y + 40, 100, 18, 0x4a2a16).setAngle(18);

    const flame1 = this.add.triangle(
      x,
      y + 18,
      0,
      95,
      38,
      0,
      76,
      95,
      0xc24747,
      0.95
    ).setOrigin(0.5);

    const flame2 = this.add.triangle(
      x,
      y + 5,
      0,
      72,
      30,
      0,
      60,
      72,
      0xe0772f,
      0.95
    ).setOrigin(0.5);

    const flame3 = this.add.triangle(
      x,
      y,
      0,
      48,
      20,
      0,
      40,
      48,
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

    this.add.rectangle(width / 2, 500, 620, 350, 0x0d0d0d, 0.92);
    this.add.rectangle(width / 2, 500, 590, 320, 0x171313, 0.95)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 360, player.name, {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const statsText = [
      `Уровень: ${player.level}`,
      `Опыт: ${player.exp}/${player.expToNextLevel}`,
      `Золото: ${player.gold}`,
      `HP: ${player.hp}/${stats.maxHp}`,
      `Энергия: ${player.energy}/${player.maxEnergy}`,
      `Атака: ${stats.attack}`,
      `Защита: ${stats.defense}`,
      `Крит: ${Math.round(stats.critChance * 100)}%`,
      `Ловкость: ${stats.agility}`,
      `Уклонение: ${Math.round(stats.dodgeChance * 100)}%`,
      `Удача: ${stats.luck}`,
      `Добыча: +${Math.round(stats.lootChanceBonus * 100)}%`,
      `Зелья: ${player.potions}`,
    ].join('\n');

    this.add.text(width / 2, 520, statsText, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);
  }

  private createActionCards() {
    const { width } = this.scale;

    createButton(
      this,
      width / 2,
      720,
      'Войти в катакомбы',
      () => {
        this.scene.start('DungeonSelectScene');
      },
      540,
      76
    );

    createButton(
      this,
      width / 2,
      812,
      'Задания',
      () => {
        this.scene.start('QuestScene');
      },
      540,
      76
    );

    createButton(
      this,
      width / 2,
      904,
      'Кузница',
      () => {
        this.scene.start('ForgeScene');
      },
      540,
      76
    );

    createButton(
      this,
      width / 2,
      996,
      'Отдохнуть у костра',
      () => {
        const stats = getPlayerStats(player);

        player.hp = stats.maxHp;
        player.energy = player.maxEnergy;
        player.potions = Math.max(player.potions, 2);

        void saveGameAsync();

        this.showRestMessage();
      },
      540,
      76
    );
  }

  private showRestMessage() {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
      .setDepth(100);

    const panel = this.add.rectangle(width / 2, height / 2, 560, 300, 0x171313)
      .setStrokeStyle(3, 0x8b5a2b)
      .setDepth(101);

    const title = this.add.text(width / 2, height / 2 - 85, 'Отдых у костра', {
      fontFamily: 'Arial',
      fontSize: '34px',
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
        fontSize: '23px',
        color: '#d8c7a3',
        align: 'center',
        lineSpacing: 8,
      }
    ).setOrigin(0.5).setDepth(102);

    const closeBg = this.add.rectangle(width / 2, height / 2 + 95, 260, 60, 0x241515)
      .setStrokeStyle(2, 0x8b5a2b)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);

    const closeText = this.add.text(width / 2, height / 2 + 95, 'Хорошо', {
      fontFamily: 'Arial',
      fontSize: '24px',
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