import Phaser from 'phaser';

import { player, type InventoryItem } from '../data/player';

import {
  createItemStatsText,
  getBaseItemFromInventoryItem,
  getItemUpgradeLevel,
  getRarityColorHex,
  getRarityStrokeColor,
  getSlotIcon,
  getSlotText,
  getUpgradeCost,
  isItemEquipped,
  upgradeItem,
} from '../systems/InventorySystem';

import { saveGameAsync } from '../systems/SaveSystem';

import { createButton } from '../ui/createButton';

import {
  UI,
  createPanel,
  createSceneBackground,
  createSectionTitle,
  createSmallText,
  createTitle,
} from '../ui/theme';

export class ForgeScene extends Phaser.Scene {

  constructor() {
    super('ForgeScene');
  }

  create() {
    createSceneBackground(this);
    createTitle(this, 'Кузница', 'Улучшение найденного снаряжения');
    
    this.createGoldPanel();
    this.createItemList();
    
    createButton(
      this,
      this.scale.width / 2,
      1180,
      'Вернуться в город',
      () => {
        this.scene.start('CampScene');
      },
      520,
      56
    );
  }

  private createGoldPanel() {
    const { width } = this.scale;

    createPanel(this, width / 2, 170, 620, 110, {
      alpha: 0.72,
      stroke: false,
      warm: true,
    });

    this.add.text(width / 2, 145, 'Ресурсы героя', {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    this.add.text(width / 2, 190, `Золото: ${player.gold}`, {
      fontFamily: UI.font.body,
      fontSize: '24px',
      color: UI.colors.text,
    }).setOrigin(0.5);
  }

  private createItemList() {
    const { width } = this.scale;

    const panelY = 645;

    createPanel(this, width / 2, panelY, 620, 760, {
      alpha: 0.86,
      stroke: true,
      warm: false,
    });

    createSectionTitle(this, width / 2, panelY - 345, 'Снаряжение');

    if (player.inventory.length === 0) {
      createSmallText(
        this,
        width / 2,
        panelY,
        'В сумке пока нет предметов.\nИх можно найти в катакомбах или купить в лавке.',
        {
          fontSize: '20px',
          color: UI.colors.textMuted,
          width: 540,
        }
      );

      return;
    }

    const forgeItems = this.getSortedForgeItems();
    const visibleItems = forgeItems.slice(0, 7);
      
    visibleItems.forEach((inventoryItem: InventoryItem, index: number) => {
      this.createItemCard(inventoryItem, panelY - 260 + index * 88);
    });
    
    if (forgeItems.length > visibleItems.length) {
      createSmallText(
        this,
        width / 2,
        panelY + 330,
        `Показано ${visibleItems.length} из ${forgeItems.length}. Позже добавим прокрутку.`,
        {
          fontSize: '15px',
          color: UI.colors.textMuted,
          width: 540,
        }
      );
    }
  }

  private getSortedForgeItems() {
    const slotOrder = {
      weapon: 0,
      armor: 1,
      trinket: 2,
    };

    return [...player.inventory].sort((a, b) => {
      const aEquipped = isItemEquipped(player, a.instanceId);
      const bEquipped = isItemEquipped(player, b.instanceId);

      if (aEquipped && !bEquipped) return -1;
      if (!aEquipped && bEquipped) return 1;

      const aItem = getBaseItemFromInventoryItem(a);
      const bItem = getBaseItemFromInventoryItem(b);

      if (!aItem || !bItem) return 0;

      return slotOrder[aItem.slot] - slotOrder[bItem.slot];
    });
  }

  private createItemCard(inventoryItem: InventoryItem, y: number) {
    const { width } = this.scale;

    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return;
    }

    const equipped = isItemEquipped(player, inventoryItem.instanceId);
    const upgradeLevel = getItemUpgradeLevel(inventoryItem);
    const upgradeCost = getUpgradeCost(inventoryItem);
    const canUpgrade = player.gold >= upgradeCost;

    const rarityColor = getRarityColorHex(item);
    const rarityStrokeColor = getRarityStrokeColor(item);

    this.add.rectangle(width / 2, y + 4, 560, 76, 0x000000, 0.22);

    this.add.rectangle(width / 2, y, 560, 76, 0x14100d, 0.86)
      .setStrokeStyle(2, rarityStrokeColor, 0.55);

    this.add.circle(width / 2 - 245, y, 24, rarityColor, 0.92)
      .setStrokeStyle(2, rarityStrokeColor, 0.7);

    this.add.text(width / 2 - 245, y, getSlotIcon(item.slot), {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const equippedText = equipped ? '  •  надето' : '';

    this.add.text(width / 2 - 205, y - 20, `${item.name} +${upgradeLevel}${equippedText}`, {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: equipped ? UI.colors.goldText : UI.colors.text,
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 205, y + 2, `${getSlotText(item.slot)} • ${createItemStatsText(inventoryItem)}`, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: 290,
      },
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 205, y + 24, `Цена улучшения: ${upgradeCost} золота`, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: canUpgrade ? UI.colors.textMuted : UI.colors.red,
    }).setOrigin(0, 0.5);

    createButton(
      this,
      width / 2 + 205,
      y + 5,
      'Улучшить',
      () => {
        this.handleUpgrade(inventoryItem);
      },
      130,
      42,
      {
        small: true,
        disabled: !canUpgrade,
      }
    );
  }

  private handleUpgrade(inventoryItem: InventoryItem) {
    const result = upgradeItem(player, inventoryItem.instanceId);

    if (!result.success) {
      this.showMessage(result.message ?? 'Не удалось улучшить предмет.');
      return;
    }

    void saveGameAsync();

    this.showMessage(result.message ?? 'Предмет улучшен.');
  }

  private showMessage(message: string) {
    const { width } = this.scale;

    createPanel(this, width / 2, 610, 600, 240, {
      alpha: 0.98,
      stroke: true,
      warm: true,
    }).setDepth(100);

    this.add.text(width / 2, 550, 'Кузница', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(102);

    this.add.text(width / 2, 615, message, {
      fontFamily: UI.font.body,
      fontSize: '21px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 520,
      },
    }).setOrigin(0.5).setDepth(102);

    const ok = createButton(
      this,
      width / 2,
      700,
      'Понятно',
      () => {
        this.scene.restart();
      },
      220,
      54
    );

    ok.shadow.setDepth(100);
    ok.bg.setDepth(101);
    ok.label.setDepth(102);
  }
}