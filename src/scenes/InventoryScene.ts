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
  private readonly itemsPerPage = 4;

  constructor() {
    super('InventoryScene');
  }

  init(data: { page?: number }) {
    this.currentPage = data.page ?? 0;
  }

  create() {
    const { width, height } = this.scale;
    const stats = getPlayerStats(player);

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.add.text(width / 2, 70, 'Инвентарь', {
      fontFamily: 'Arial',
      fontSize: '56px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, 185, 620, 120, 0x171313);

    this.add.text(
      width / 2,
      185,
      `HP: ${player.hp}/${stats.maxHp}    Атака: ${stats.attack}\nЗащита: ${stats.defense}    Крит: ${Math.round(stats.critChance * 100)}%`,
      {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#e6d2aa',
        align: 'center',
        lineSpacing: 8,
      }
    ).setOrigin(0.5);

    this.add.text(width / 2, 290, 'Экипировка', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#e6d2aa',
    }).setOrigin(0.5);

    this.createEquipmentBlock();

    this.add.text(width / 2, 560, 'Предметы', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#e6d2aa',
    }).setOrigin(0.5);

    this.createInventoryList();

    createBottomNav(this, {
      active: 'inventory',
    });
  }

  private createEquipmentBlock() {
    const { width } = this.scale;

    const weaponInventoryItem = player.equipment.weapon
      ? player.inventory.find(item => item.instanceId === player.equipment.weapon)
      : undefined;

    const armorInventoryItem = player.equipment.armor
      ? player.inventory.find(item => item.instanceId === player.equipment.armor)
      : undefined;

    const trinketInventoryItem = player.equipment.trinket
      ? player.inventory.find(item => item.instanceId === player.equipment.trinket)
      : undefined;

    const weapon = weaponInventoryItem
      ? getBaseItemFromInventoryItem(weaponInventoryItem)
      : undefined;

    const armor = armorInventoryItem
      ? getBaseItemFromInventoryItem(armorInventoryItem)
      : undefined;

    const trinket = trinketInventoryItem
      ? getBaseItemFromInventoryItem(trinketInventoryItem)
      : undefined;

    const lines = [
      `Оружие: ${weapon ? `${weapon.name} +${weaponInventoryItem?.upgradeLevel ?? 0}` : 'пусто'}`,
      `Броня: ${armor ? `${armor.name} +${armorInventoryItem?.upgradeLevel ?? 0}` : 'пусто'}`,
      `Амулет: ${trinket ? `${trinket.name} +${trinketInventoryItem?.upgradeLevel ?? 0}` : 'пусто'}`,
    ];

    this.add.rectangle(width / 2, 405, 620, 185, 0x121212);

    this.add.text(width / 2, 375, lines.join('\n'), {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#b8aa91',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5);

    createButton(this, width / 2, 485, 'Снять всё', () => {
      unequipItem(player, 'weapon');
      unequipItem(player, 'armor');
      unequipItem(player, 'trinket');

      void saveGameAsync();

      this.scene.restart({
        page: this.currentPage,
      });
    }, 360, 58);
  }

  private createInventoryList() {
    const { width } = this.scale;

    if (player.inventory.length === 0) {
      this.add.rectangle(width / 2, 780, 620, 320, 0x121212);

      this.add.text(width / 2, 780, 'Инвентарь пуст.\nОткрой сундук или победи врага.', {
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

      const y = 640 + index * 105;
      const isEquipped = isItemEquipped(player, inventoryItem.instanceId);
      const sellPrice = getItemSellPrice(item, inventoryItem.upgradeLevel);
      const upgradeLevel = getItemUpgradeLevel(inventoryItem);
      const statsText = createItemStatsText(inventoryItem);
      const equippedText = isEquipped ? ' [надето]' : '';

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
        `${item.name} +${upgradeLevel}${equippedText}`,
        {
          fontFamily: 'Arial',
          fontSize: '20px',
          color: isEquipped ? '#d8b56d' : getRarityColor(item),
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

      createButton(this, 560, y - 20, 'Надеть', () => {
        equipItem(player, inventoryItem.instanceId);

        void saveGameAsync();

        this.scene.restart({
          page: this.currentPage,
        });
      }, 135, 40);

      createButton(this, 560, y + 24, `${sellPrice} зол.`, () => {
        const result = sellItem(player, inventoryItem.instanceId);

        void saveGameAsync();

        this.showMessage(result.message);
      }, 135, 40);
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