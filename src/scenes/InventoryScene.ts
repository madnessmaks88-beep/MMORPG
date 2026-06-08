import Phaser from 'phaser';

import { player } from '../data/player';
import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';
import { saveGameAsync } from '../systems/SaveSystem';

import {
  createItemStatsText,
  equipItem,
  getBaseItemFromInventoryItem,
  getItemSellPrice,
  getItemUpgradeLevel,
  getPlayerStats,
  getRarityColor,
  getRarityStrokeColor,
  getRarityText,
  getSlotIcon,
  getSlotText,
  isItemEquipped,
  sellItem,
  unequipItem,
} from '../systems/InventorySystem';

export class InventoryScene extends Phaser.Scene {
  private currentPage = 0;
  private itemsPerPage = 4;

  constructor() {
    super('InventoryScene');
  }

  init(data?: { page?: number }) {
    this.currentPage = data?.page ?? 0;
  }

  create() {
    const { width } = this.scale;
    const stats = getPlayerStats(player);

    this.createBackground();

    this.add.text(width / 2, 56, 'Инвентарь', {
      fontFamily: 'Arial',
      fontSize: '46px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.createStatsPanel(stats);
    this.createEquipmentBlock();
    this.createInventoryList();
    this.createPageControls();

    createBottomNav(this, {
		  activeScene: 'ShopScene',
		});
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x090909);
    this.add.rectangle(width / 2, height / 2, width, height, 0x11100e, 0.9);

    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      this.add.circle(x, y, Phaser.Math.Between(1, 3), 0xd8b56d, 0.07);
    }
  }

  private createStatsPanel(stats: ReturnType<typeof getPlayerStats>) {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 170, 620, 190, 0x0d0d0d, 0.9)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 94, 'Характеристики героя', {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    const leftText = [
      `Уровень: ${player.level}`,
      `HP: ${player.hp}/${stats.maxHp}`,
      `Энергия: ${player.energy}/${player.maxEnergy}`,
      `Атака: ${stats.attack}`,
      `Защита: ${stats.defense}`,
    ].join('\n');

    const rightText = [
      `Крит: ${Math.round(stats.critChance * 100)}%`,
      `Ловкость: ${stats.agility}`,
      `Уклонение: ${Math.round(stats.dodgeChance * 100)}%`,
      `Удача: ${stats.luck}`,
      `Добыча: +${Math.round(stats.lootChanceBonus * 100)}%`,
    ].join('\n');

    this.add.text(95, 135, leftText, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d8c7a3',
      lineSpacing: 5,
    }).setOrigin(0, 0);

    this.add.text(390, 135, rightText, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d8c7a3',
      lineSpacing: 5,
    }).setOrigin(0, 0);
  }

  private createEquipmentBlock() {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 330, 620, 120, 0x0d0d0d, 0.9)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 280, 'Экипировка', {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    const slots = [
      { key: 'weapon', label: 'Оружие' },
      { key: 'armor', label: 'Броня' },
      { key: 'trinket', label: 'Амулет' },
    ] as const;

    slots.forEach((slot, index) => {
      const x = 130 + index * 230;
      const equippedInstanceId = player.equipment[slot.key];
      const inventoryItem = player.inventory.find(
        item => item.instanceId === equippedInstanceId
      );

      const item = inventoryItem
        ? getBaseItemFromInventoryItem(inventoryItem)
        : undefined;

      const text = item && inventoryItem
        ? `${slot.label}\n${item.name} +${getItemUpgradeLevel(inventoryItem)}`
        : `${slot.label}\nПусто`;

      this.add.text(x, 330, text, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: item ? getRarityColor(item) : '#8f826d',
        align: 'center',
        lineSpacing: 5,
      }).setOrigin(0.5);

      if (item && inventoryItem) {
        const unequipBg = this.add.rectangle(x, 385, 120, 34, 0x241515)
          .setStrokeStyle(1, 0x8b5a2b)
          .setInteractive({ useHandCursor: true });

        this.add.text(x, 385, 'Снять', {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#f0d58a',
        }).setOrigin(0.5);

        unequipBg.on('pointerdown', () => {
          unequipItem(player, item.slot);
          void saveGameAsync();

          this.scene.restart({
            page: this.currentPage,
          });
        });
      }
    });
  }

  private createInventoryList() {
    const { width } = this.scale;

    this.add.text(width / 2, 430, `Предметы: ${player.inventory.length}`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    if (player.inventory.length === 0) {
      this.add.text(width / 2, 610, 'Инвентарь пуст.', {
        fontFamily: 'Arial',
        fontSize: '26px',
        color: '#8f826d',
      }).setOrigin(0.5);

      return;
    }

    const start = this.currentPage * this.itemsPerPage;
    const pageItems = player.inventory.slice(start, start + this.itemsPerPage);

    pageItems.forEach((inventoryItem, index) => {
      const item = getBaseItemFromInventoryItem(inventoryItem);

      if (!item) {
        return;
      }

      const y = 520 + index * 118;
      const equipped = isItemEquipped(player, inventoryItem.instanceId);
      const upgradeLevel = getItemUpgradeLevel(inventoryItem);
      const sellPrice = getItemSellPrice(item, upgradeLevel);

      const itemBg = this.add.rectangle(width / 2, y, 620, 100, 0x0d0d0d, 0.92)
        .setStrokeStyle(2, getRarityStrokeColor(item));

      if (equipped) {
        itemBg.setFillStyle(0x142015, 0.95);
      }

      this.add.text(80, y, getSlotIcon(item), {
        fontFamily: 'Arial',
        fontSize: '36px',
        color: getRarityColor(item),
      }).setOrigin(0.5);

      this.add.text(120, y - 31, `${item.name} +${upgradeLevel}`, {
        fontFamily: 'Arial',
        fontSize: '21px',
        color: getRarityColor(item),
      }).setOrigin(0, 0.5);

      this.add.text(120, y - 5, `${getSlotText(item)} • ${getRarityText(item)}`, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#9c8f7a',
      }).setOrigin(0, 0.5);

      this.add.text(120, y + 24, createItemStatsText(inventoryItem), {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#d8c7a3',
      }).setOrigin(0, 0.5);

      const equipText = equipped ? 'Надето' : 'Надеть';

      const equipBg = this.add.rectangle(525, y - 20, 130, 38, equipped ? 0x1b2a1b : 0x241515)
        .setStrokeStyle(1, equipped ? 0x75d184 : 0x8b5a2b)
        .setInteractive({ useHandCursor: !equipped });

      this.add.text(525, y - 20, equipText, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: equipped ? '#75d184' : '#f0d58a',
      }).setOrigin(0.5);

      if (!equipped) {
        equipBg.on('pointerdown', () => {
          equipItem(player, inventoryItem.instanceId);
          void saveGameAsync();

          this.scene.restart({
            page: this.currentPage,
          });
        });
      }

      const sellBg = this.add.rectangle(525, y + 27, 130, 38, equipped ? 0x222222 : 0x241515)
        .setStrokeStyle(1, equipped ? 0x555555 : 0x8b5a2b)
        .setInteractive({ useHandCursor: !equipped });

      this.add.text(525, y + 27, `Продать ${sellPrice}`, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: equipped ? '#777777' : '#f0d58a',
      }).setOrigin(0.5);

      if (!equipped) {
        sellBg.on('pointerdown', () => {
          const result = sellItem(player, inventoryItem.instanceId);

          if (result.success) {
            void saveGameAsync();

            const maxPage = Math.max(
              0,
              Math.ceil(player.inventory.length / this.itemsPerPage) - 1
            );

            this.currentPage = Math.min(this.currentPage, maxPage);

            this.scene.restart({
              page: this.currentPage,
            });
          } else {
            this.showMessage(result.message);
          }
        });
      }
    });
  }

  private createPageControls() {
    const { width } = this.scale;

    const totalPages = Math.max(1, Math.ceil(player.inventory.length / this.itemsPerPage));

    this.add.text(width / 2, 1000, `Страница ${this.currentPage + 1}/${totalPages}`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#d8c7a3',
    }).setOrigin(0.5);

    createButton(
      this,
      190,
      1055,
      'Назад',
      () => {
        if (this.currentPage > 0) {
          this.scene.restart({
            page: this.currentPage - 1,
          });
        }
      },
      220,
      60
    );

    createButton(
      this,
      530,
      1055,
      'Далее',
      () => {
        if (this.currentPage < totalPages - 1) {
          this.scene.restart({
            page: this.currentPage + 1,
          });
        }
      },
      220,
      60
    );
  }

  private showMessage(message: string) {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
      .setDepth(100);

    const panel = this.add.rectangle(width / 2, height / 2, 560, 240, 0x171313)
      .setStrokeStyle(3, 0x8b5a2b)
      .setDepth(101);

    const text = this.add.text(width / 2, height / 2 - 35, message, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(102);

    const closeBg = this.add.rectangle(width / 2, height / 2 + 70, 240, 58, 0x241515)
      .setStrokeStyle(2, 0x8b5a2b)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);

    const closeText = this.add.text(width / 2, height / 2 + 70, 'Ок', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f0d58a',
    }).setOrigin(0.5).setDepth(103);

    closeBg.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      text.destroy();
      closeBg.destroy();
      closeText.destroy();
    });
  }
}