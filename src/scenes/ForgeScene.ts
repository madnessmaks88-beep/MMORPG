import Phaser from 'phaser';

import { player } from '../data/player';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

import {
  createItemStatsText,
  getBaseItemFromInventoryItem,
  getItemUpgradeLevel,
  getPlayerStats,
  getRarityColor,
  getRarityStrokeColor,
  getRarityText,
  getSlotIcon,
  getSlotText,
  getUpgradeCost,
  upgradeItem,
} from '../systems/InventorySystem';

import { saveGameAsync } from '../systems/SaveSystem';

export class ForgeScene extends Phaser.Scene {
  private currentPage = 0;
  private readonly itemsPerPage = 5;

  constructor() {
    super('ForgeScene');
  }

  init(data: { page?: number }) {
    this.currentPage = data.page ?? 0;
  }

  create() {
    const { width, height } = this.scale;
    const stats = getPlayerStats(player);

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.add.text(width / 2, 65, 'Кузница', {
      fontFamily: 'Arial',
      fontSize: '56px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.text(width / 2, 122, 'Железо помнит боль. Золото заставляет его стать сильнее.', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#9c8f7a',
      align: 'center',
      wordWrap: {
        width: 600,
      },
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, 220, 620, 100, 0x171313);

    this.add.text(
      width / 2,
      220,
      `Золото: ${player.gold}\nАтака: ${stats.attack}    Защита: ${stats.defense}    HP: ${stats.maxHp}`,
      {
        fontFamily: 'Arial',
        fontSize: '23px',
        color: '#e6d2aa',
        align: 'center',
        lineSpacing: 7,
      }
    ).setOrigin(0.5);

    this.add.text(width / 2, 315, 'Предметы для улучшения', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#e6d2aa',
    }).setOrigin(0.5);

    this.createUpgradeList();

    createBottomNav(this, {
      active: 'camp',
    });
  }

  private createUpgradeList() {
    const { width } = this.scale;

    if (player.inventory.length === 0) {
      this.add.rectangle(width / 2, 650, 620, 300, 0x121212);

      this.add.text(width / 2, 650, 'У тебя нет предметов.\nНайди лут в катакомбах.', {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#8f826d',
        align: 'center',
        lineSpacing: 8,
      }).setOrigin(0.5);

      return;
    }

    const totalPages = Math.max(1, Math.ceil(player.inventory.length / this.itemsPerPage));

    if (this.currentPage > totalPages - 1) {
      this.currentPage = totalPages - 1;
    }

    if (this.currentPage < 0) {
      this.currentPage = 0;
    }

    const startIndex = this.currentPage * this.itemsPerPage;
    const visibleItems = player.inventory.slice(startIndex, startIndex + this.itemsPerPage);

    visibleItems.forEach((inventoryItem, index) => {
      const item = getBaseItemFromInventoryItem(inventoryItem);

      if (!item) {
        return;
      }

      const y = 400 + index * 105;
      const upgradeLevel = getItemUpgradeLevel(inventoryItem);
      const cost = getUpgradeCost(inventoryItem);
      const statsText = createItemStatsText(inventoryItem);
      const isMax = upgradeLevel >= 5;

      const itemBg = this.add.rectangle(width / 2, y, 620, 88, 0x121212);
      itemBg.setStrokeStyle(2, getRarityStrokeColor(item));

      this.add.text(75, y, getSlotIcon(item), {
        fontFamily: 'Arial',
        fontSize: '34px',
        color: getRarityColor(item),
      }).setOrigin(0.5);

      this.add.text(
        115,
        y - 24,
        `${item.name} +${upgradeLevel}`,
        {
          fontFamily: 'Arial',
          fontSize: '20px',
          color: getRarityColor(item),
          wordWrap: {
            width: 360,
          },
        }
      ).setOrigin(0, 0.5);

      this.add.text(
        115,
        y + 2,
        `${getSlotText(item)} • ${getRarityText(item)}`,
        {
          fontFamily: 'Arial',
          fontSize: '17px',
          color: '#8f826d',
        }
      ).setOrigin(0, 0.5);

      this.add.text(
        115,
        y + 27,
        statsText,
        {
          fontFamily: 'Arial',
          fontSize: '17px',
          color: '#b8aa91',
          wordWrap: {
            width: 360,
          },
        }
      ).setOrigin(0, 0.5);

      if (isMax) {
        this.add.text(560, y, 'MAX', {
          fontFamily: 'Arial',
          fontSize: '21px',
          color: '#d8b56d',
        }).setOrigin(0.5);

        return;
      }

      createButton(this, 560, y, `${cost} зол.`, () => {
        const result = upgradeItem(player, inventoryItem.instanceId);

        void saveGameAsync();

        this.showMessage(result.message);
      }, 135, 52);
    });

    this.createPageControls(totalPages);
  }

  private createPageControls(totalPages: number) {
    const { width } = this.scale;

    const y = 1085;

    createButton(this, 160, y, '<', () => {
      if (this.currentPage <= 0) {
        return;
      }

      this.scene.restart({
        page: this.currentPage - 1,
      });
    }, 120, 52);

    this.add.text(width / 2, y, `Страница ${this.currentPage + 1}/${totalPages}`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#e6d2aa',
    }).setOrigin(0.5);

    createButton(this, width - 160, y, '>', () => {
      if (this.currentPage >= totalPages - 1) {
        return;
      }

      this.scene.restart({
        page: this.currentPage + 1,
      });
    }, 120, 52);
  }

  private showMessage(message: string) {
    const { width, height } = this.scale;

    this.children.removeAll();

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.add.rectangle(width / 2, height / 2, 620, 330, 0x181414);
    this.add.rectangle(width / 2, height / 2, 580, 290, 0x0d0d0d);

    this.add.text(width / 2, height / 2 - 35, message, {
      fontFamily: 'Arial',
      fontSize: '29px',
      color: '#e6d2aa',
      align: 'center',
      wordWrap: {
        width: 520,
      },
    }).setOrigin(0.5);

    createButton(this, width / 2, height / 2 + 105, 'Продолжить', () => {
      this.scene.restart({
        page: this.currentPage,
      });
    }, 440, 70);
  }
}