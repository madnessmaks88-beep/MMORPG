import Phaser from 'phaser';

import { player } from '../data/player';
import { getRandomLootItem } from '../data/items';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

import {
  addItemToInventory,
  getPlayerStats,
  getRarityColor,
  getRarityText,
} from '../systems/InventorySystem';

import { saveGameAsync } from '../systems/SaveSystem';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  create() {
    const { width, height } = this.scale;
    const stats = getPlayerStats(player);

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.createBackground();

    this.add.text(width / 2, 65, 'Магазин', {
      fontFamily: 'Arial',
      fontSize: '56px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.text(width / 2, 120, 'Лавка умирающего света', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#9c8f7a',
      align: 'center',
    }).setOrigin(0.5);

    this.createMerchantCard();

    this.createGoldPanel(stats);

    this.add.text(width / 2, 445, 'Товары', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#e6d2aa',
    }).setOrigin(0.5);

    this.createShopItems();

    this.add.text(
      width / 2,
      1080,
      'Лишний лут можно продать в инвентаре.\nКузница усилит найденное снаряжение.',
      {
        fontFamily: 'Arial',
        fontSize: '21px',
        color: '#70675a',
        align: 'center',
        lineSpacing: 7,
        wordWrap: {
          width: 580,
        },
      }
    ).setOrigin(0.5);

    createBottomNav(this, {
      activeScene: 'ShopScene',
    });
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0808);

    for (let i = 0; i < 24; i++) {
      const x = Phaser.Math.Between(20, width - 20);
      const y = Phaser.Math.Between(150, height - 160);
      const size = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.05, 0.14);

      this.add.circle(x, y, size, 0xd8b56d, alpha);
    }

    this.add.rectangle(width / 2, 520, 620, 760, 0x111111, 0.72);
    this.add.rectangle(width / 2, 520, 580, 720, 0x0a0a0a, 0.68);
  }

  private createMerchantCard() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 250, 620, 200, 0x171313);
    const inner = this.add.rectangle(width / 2, 250, 580, 160, 0x121212);
    inner.setStrokeStyle(2, 0x8b5a2b);

    this.add.text(160, 230, '☽', {
      fontFamily: 'Arial',
      fontSize: '62px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.text(390, 210, 'Старый торговец', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#e6d2aa',
    }).setOrigin(0.5);

    this.add.text(
      390,
      265,
      '“Золото пахнет одинаково —\nи у живых, и у мёртвых.”',
      {
        fontFamily: 'Arial',
        fontSize: '21px',
        color: '#9c8f7a',
        align: 'center',
        lineSpacing: 6,
      }
    ).setOrigin(0.5);
  }

  private createGoldPanel(stats: ReturnType<typeof getPlayerStats>) {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 375, 620, 90, 0x171313);

    this.add.text(
      width / 2,
      375,
      `Золото: ${player.gold}     Зелья: ${player.potions}\nHP: ${player.hp}/${stats.maxHp}     Атака: ${stats.attack}`,
      {
        fontFamily: 'Arial',
        fontSize: '23px',
        color: '#e6d2aa',
        align: 'center',
        lineSpacing: 7,
      }
    ).setOrigin(0.5);
  }

  private createShopItems() {
    const { width } = this.scale;

    this.createShopCard({
      y: 535,
      icon: '🧪',
      title: 'Зелье лечения',
      description: 'Восстанавливает здоровье в бою.',
      priceText: '10 золота',
      onBuy: () => {
        this.buyPotion();
      },
    });

    this.createShopCard({
      y: 640,
      icon: '🎲',
      title: 'Случайный предмет',
      description: 'Оружие, броня или амулет случайной редкости.',
      priceText: '60 золота',
      onBuy: () => {
        this.buyRandomItem();
      },
    });

    this.createShopCard({
      y: 745,
      icon: '❤',
      title: 'Усилить здоровье',
      description: 'Навсегда увеличивает максимальное здоровье.',
      priceText: '35 золота',
      onBuy: () => {
        this.buyHpUpgrade();
      },
    });

    this.createShopCard({
      y: 850,
      icon: '⚔',
      title: 'Усилить атаку',
      description: 'Навсегда увеличивает базовую атаку героя.',
      priceText: '45 золота',
      onBuy: () => {
        this.buyAttackUpgrade();
      },
    });

    this.add.rectangle(width / 2, 960, 620, 85, 0x121212);
    this.add.text(
      width / 2,
      960,
      'Совет: сначала купи пару зелий,\nа потом трать золото на кузницу.',
      {
        fontFamily: 'Arial',
        fontSize: '21px',
        color: '#8f826d',
        align: 'center',
        lineSpacing: 6,
      }
    ).setOrigin(0.5);
  }

  private createShopCard(options: {
    y: number;
    icon: string;
    title: string;
    description: string;
    priceText: string;
    onBuy: () => void;
  }) {
    const { width } = this.scale;

    const bg = this.add.rectangle(width / 2, options.y, 620, 88, 0x121212);
    bg.setStrokeStyle(2, 0x8b5a2b);

    this.add.text(78, options.y, options.icon, {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.text(120, options.y - 22, options.title, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#e6d2aa',
    }).setOrigin(0, 0.5);

    this.add.text(120, options.y + 16, options.description, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#8f826d',
      wordWrap: {
        width: 310,
      },
    }).setOrigin(0, 0.5);

    createButton(this, 555, options.y, options.priceText, options.onBuy, 155, 52);
  }

  private buyPotion() {
    const cost = 10;

    if (player.gold < cost) {
      this.showMessage('Недостаточно золота.', '#c24747');
      return;
    }

    player.gold -= cost;
    player.potions += 1;

    void saveGameAsync();

    this.showMessage('Куплено зелье лечения.', '#75d184');
  }

  private buyRandomItem() {
    const cost = 60;

    if (player.gold < cost) {
      this.showMessage('Недостаточно золота.', '#c24747');
      return;
    }

    const item = getRandomLootItem();

    player.gold -= cost;
    addItemToInventory(player, item.id);

    void saveGameAsync();

    this.showMessage(
      `Получен ${getRarityText(item).toLowerCase()} предмет:\n${item.name} +0`,
      getRarityColor(item)
    );
  }

  private buyHpUpgrade() {
    const cost = 35;

    if (player.gold < cost) {
      this.showMessage('Недостаточно золота.', '#c24747');
      return;
    }

    player.gold -= cost;
    player.maxHp += 8;
    player.hp += 8;

    void saveGameAsync();

    this.showMessage('Максимальное здоровье увеличено на 8.', '#75d184');
  }

  private buyAttackUpgrade() {
    const cost = 45;

    if (player.gold < cost) {
      this.showMessage('Недостаточно золота.', '#c24747');
      return;
    }

    player.gold -= cost;
    player.attack += 1;

    void saveGameAsync();

    this.showMessage('Базовая атака увеличена на 1.', '#75d184');
  }

  private showMessage(message: string, color = '#e6d2aa') {
    const { width, height } = this.scale;

    this.children.removeAll();

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.add.rectangle(width / 2, height / 2, 620, 330, 0x181414);
    this.add.rectangle(width / 2, height / 2, 580, 290, 0x0d0d0d);

    this.add.text(width / 2, height / 2 - 40, message, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color,
      align: 'center',
      lineSpacing: 8,
      wordWrap: {
        width: 520,
      },
    }).setOrigin(0.5);

    createButton(this, width / 2, height / 2 + 105, 'Продолжить', () => {
      this.scene.restart();
    }, 440, 70);
  }
}