import Phaser from 'phaser';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

import { player } from '../data/player';

import { getPlayerStats } from '../systems/InventorySystem';
import { saveGameAsync } from '../systems/SaveSystem';
import { getCachedVKUser } from '../systems/VKBridgeSystem';

export class CampScene extends Phaser.Scene {
  constructor() {
    super('CampScene');
  }

  create() {
    const { width, height } = this.scale;
    const stats = getPlayerStats(player);

    const vkUser = getCachedVKUser();

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.createBackground();

    this.add.text(width / 2, 60, 'Лагерь у входа', {
      fontFamily: 'Arial',
      fontSize: '48px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.text(width / 2, 112, 'Последнее тёплое место перед тьмой.', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#9c8f7a',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      142,
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

    this.createCampfire(width / 2, 245);

    this.createHeroCard(stats);

    this.createActionCards();

    createBottomNav(this, {
      active: 'camp',
    });
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b0b);

    for (let i = 0; i < 28; i++) {
      const x = Phaser.Math.Between(20, width - 20);
      const y = Phaser.Math.Between(150, height - 160);
      const size = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.06, 0.16);

      this.add.circle(x, y, size, 0xd8b56d, alpha);
    }

    this.add.rectangle(width / 2, 410, 620, 520, 0x111111, 0.78);
    this.add.rectangle(width / 2, 410, 580, 480, 0x0a0a0a, 0.7);
  }

  private createCampfire(x: number, y: number) {
    this.add.ellipse(x, y + 70, 220, 45, 0x000000, 0.35);

    this.add.rectangle(x - 35, y + 65, 120, 18, 0x4a2a16)
      .setRotation(-0.25);

    this.add.rectangle(x + 35, y + 65, 120, 18, 0x4a2a16)
      .setRotation(0.25);

    const outerFlame = this.add.triangle(
      x,
      y + 10,
      0,
      80,
      42,
      0,
      84,
      80,
      0xc24747,
      0.8
    ).setOrigin(0.5);

    const middleFlame = this.add.triangle(
      x,
      y + 20,
      0,
      65,
      32,
      0,
      64,
      65,
      0xe0772f,
      0.9
    ).setOrigin(0.5);

    const innerFlame = this.add.triangle(
      x,
      y + 32,
      0,
      45,
      22,
      0,
      44,
      45,
      0xf0d58a,
      0.95
    ).setOrigin(0.5);

    this.tweens.add({
      targets: [outerFlame, middleFlame, innerFlame],
      scaleX: 1.08,
      scaleY: 0.94,
      duration: 520,
      yoyo: true,
      repeat: -1,
    });

    this.add.circle(x, y + 45, 120, 0xe0772f, 0.08);
    this.add.circle(x, y + 45, 70, 0xf0d58a, 0.08);
  }

  private createHeroCard(stats: ReturnType<typeof getPlayerStats>) {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 510, 620, 255, 0x171313);
    const inner = this.add.rectangle(width / 2, 510, 580, 215, 0x121212);
    inner.setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 420, player.name, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#e6d2aa',
    }).setOrigin(0.5);

    this.add.text(width / 2, 455, `Уровень ${player.level}`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      525,
      `HP: ${player.hp}/${stats.maxHp}     EN: ${player.energy}/${player.maxEnergy}
  Опыт: ${player.exp}/${player.expToNextLevel}     Золото: ${player.gold}
  Атака: ${stats.attack}     Защита: ${stats.defense}     Крит: ${Math.round(stats.critChance * 100)}%
  Зелья: ${player.potions}`,
      {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#b8aa91',
        align: 'center',
        lineSpacing: 8,
      }
    ).setOrigin(0.5);
  }

  private createActionCards() {
    const { width } = this.scale;

    this.add.text(width / 2, 690, 'Действия', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#e6d2aa',
    }).setOrigin(0.5);

    createButton(this, width / 2, 760, 'Войти в катакомбы', () => {
      this.scene.start('DungeonSelectScene');
    }, 540, 68);

    createButton(this, width / 2, 845, 'Задания', () => {
      this.scene.start('QuestScene');
    }, 540, 68);

    createButton(this, width / 2, 930, 'Кузница', () => {
      this.scene.start('ForgeScene');
    }, 540, 68);

    createButton(this, width / 2, 1015, 'Отдохнуть у костра', () => {
      const currentStats = getPlayerStats(player);
    
      player.hp = currentStats.maxHp;
      player.energy = player.maxEnergy;
      player.potions = 2;
    
      void saveGameAsync();
    
      this.scene.restart();
    }, 540, 68);

    this.add.text(width / 2, 1090, 'Катакомбы ждут тех, кому нечего терять.', {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#70675a',
      align: 'center',
      wordWrap: {
        width: 560,
      },
    }).setOrigin(0.5);
  }
}