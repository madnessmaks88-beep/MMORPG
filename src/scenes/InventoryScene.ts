import Phaser from 'phaser';

import { player, type InventoryItem } from '../data/player';
import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';
import { saveGameAsync } from '../systems/SaveSystem';

import {
  equipItem,
  getBaseItemFromInventoryItem,
  getEquippedInventoryItems,
  getPlayerStats,
  getRarityStrokeColor,
  getRarityText,
  getSlotIcon,
  getSlotText,
  isItemEquipped,
	getRarityColorHex,
} from '../systems/InventorySystem';

import {
  UI,
  createPanel,
  createSceneBackground,
  createSectionTitle,
  createSmallText,
  createTitle,
} from '../ui/theme';

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
	  createSceneBackground(this);
	  createTitle(this, 'Сумка героя', 'Снаряжение, добыча и найденные вещи');

	  this.createStatsPanel();
	  this.createEquipmentPanel();
	  this.createInventoryList();

	  createBottomNav(this, {
	    activeScene: 'InventoryScene',
	  });
	}

  private createStatsPanel() {
	  const { width } = this.scale;

	  const stats = getPlayerStats(player);

	  const panelY = 185;

	  createPanel(this, width / 2, panelY, 620, 145, {
	    alpha: 0.72,
	    stroke: false,
	    warm: true,
	  });

	  this.add.text(width / 2, panelY - 42, 'Краткие характеристики', {
	    fontFamily: UI.font.title,
	    fontSize: '23px',
	    color: UI.colors.goldText,
	  }).setOrigin(0.5);

	  const text = [
	    `HP: ${player.hp}/${stats.maxHp}`,
	    `Атака: ${stats.attack}`,
	    `Защита: ${stats.defense}`,
	    `Крит: ${Math.round(stats.critChance * 100)}%`,
	    `Уклонение: ${Math.round(stats.dodgeChance * 100)}%`,
	    `Добыча: +${Math.round(stats.lootChanceBonus * 100)}%`,
	  ].join('  •  ');

	  createSmallText(this, width / 2, panelY + 22, text, {
	    fontSize: '16px',
	    color: UI.colors.text,
	    width: 560,
	  });
	}

  private createEquipmentPanel() {
	  const { width } = this.scale;

	  const panelY = 360;

	  createPanel(this, width / 2, panelY, 620, 185, {
	    alpha: 0.86,
	    stroke: true,
	    warm: false,
	  });

	  createSectionTitle(this, width / 2, panelY - 65, 'Экипировка');

	  const equippedItems = getEquippedInventoryItems(player);

	  if (equippedItems.length === 0) {
	    createSmallText(this, width / 2, panelY + 20, 'Снаряжение не надето.', {
	      fontSize: '19px',
	      color: UI.colors.textMuted,
	      width: 540,
	    });

	    return;
	  }

	  const text = equippedItems
	    .map(inventoryItem => {
	      const item = getBaseItemFromInventoryItem(inventoryItem);

	      if (!item) {
	        return '';
	      }

	      const upgrade = inventoryItem.upgradeLevel > 0
	        ? ` +${inventoryItem.upgradeLevel}`
	        : '';

	      return `${getSlotText(item.slot)}: ${item.name}${upgrade}`;
	    })
	    .filter(Boolean)
	    .join('\n');

	  this.add.text(width / 2, panelY + 25, text, {
	    fontFamily: UI.font.body,
	    fontSize: '18px',
	    color: UI.colors.text,
	    align: 'center',
	    wordWrap: {
	      width: 540,
	    },
	    lineSpacing: 7,
	  }).setOrigin(0.5);
	}

  private createInventoryList() {
	  const { width } = this.scale;

	  const panelY = 715;

	  createPanel(this, width / 2, panelY, 620, 470, {
	    alpha: 0.86,
	    stroke: true,
	    warm: false,
	  });

	  createSectionTitle(this, width / 2, panelY - 205, 'Предметы');

	  if (player.inventory.length === 0) {
	    createSmallText(
	      this,
	      width / 2,
	      panelY,
	      'В сумке пока пусто.\nПредметы можно найти в сундуках и после боя.',
	      {
	        fontSize: '20px',
	        color: UI.colors.textMuted,
	        width: 540,
	      }
	    );

	    return;
	  }

	  const visibleItems = player.inventory.slice(0, 5);

	  visibleItems.forEach((inventoryItem, index) => {
	    this.createInventoryItemCard(inventoryItem, panelY - 145 + index * 72);
	  });

	  if (player.inventory.length > visibleItems.length) {
	    createSmallText(
	      this,
	      width / 2,
	      panelY + 210,
	      `Показано ${visibleItems.length} из ${player.inventory.length}. Позже добавим прокрутку.`,
	      {
	        fontSize: '15px',
	        color: UI.colors.textMuted,
	        width: 540,
	      }
	    );
	  }
		this.createPageControls();
	}

	private createInventoryItemCard(inventoryItem: InventoryItem, y: number) {
	  const { width } = this.scale;

	  const item = getBaseItemFromInventoryItem(inventoryItem);

	  if (!item) {
	    return;
	  }

	  const isEquipped = isItemEquipped(player, inventoryItem.instanceId);

	  const rarityColor = getRarityColorHex(item);
		const rarityStrokeColor = getRarityStrokeColor(item);

	  this.add.rectangle(width / 2, y + 3, 560, 62, 0x000000, 0.22);

	  this.add.rectangle(width / 2, y, 560, 62, 0x14100d, 0.86)
	    .setStrokeStyle(2, rarityStrokeColor, 0.55);

	  this.add.circle(width / 2 - 250, y, 22, rarityColor, 0.92)
	    .setStrokeStyle(2, rarityStrokeColor, 0.7);

	  this.add.text(width / 2 - 250, y, getSlotIcon(item.slot), {
	    fontFamily: UI.font.body,
	    fontSize: '17px',
	    color: '#ffffff',
	  }).setOrigin(0.5);

	  const upgrade = inventoryItem.upgradeLevel > 0
	    ? ` +${inventoryItem.upgradeLevel}`
	    : '';

	  this.add.text(width / 2 - 215, y - 13, `${item.name}${upgrade}`, {
	    fontFamily: UI.font.body,
	    fontSize: '17px',
	    color: isEquipped ? UI.colors.goldText : UI.colors.text,
	  }).setOrigin(0, 0.5);

	  this.add.text(width / 2 - 215, y + 14, `${getSlotText(item.slot)} • ${getRarityText(item)}`, {
	    fontFamily: UI.font.body,
	    fontSize: '14px',
	    color: UI.colors.textMuted,
	  }).setOrigin(0, 0.5);

	  const buttonText = isEquipped ? 'Надето' : 'Надеть';

	  const button = this.add.rectangle(width / 2 + 220, y, 100, 38, isEquipped ? 0x1c3a24 : 0x21150f, 0.92)
	    .setStrokeStyle(2, isEquipped ? 0x75d184 : UI.colors.goldDark, 0.65)
	    .setInteractive({ useHandCursor: !isEquipped });

	  this.add.text(width / 2 + 220, y, buttonText, {
	    fontFamily: UI.font.body,
	    fontSize: '14px',
	    color: isEquipped ? UI.colors.green : UI.colors.goldText,
	  }).setOrigin(0.5);

	  if (!isEquipped) {
	    button.on('pointerdown', () => {
	      equipItem(player, inventoryItem.instanceId);

	      void saveGameAsync();

	      this.scene.restart();
	    });
	  }
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
}