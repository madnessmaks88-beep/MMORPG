import Phaser from 'phaser';

import { player, type EquipmentSlot, type InventoryItem } from '../data/player';
import { createBottomNav } from '../ui/createBottomNav';
import { saveGameAsync } from '../systems/SaveSystem';

import { materials } from '../data/materials';

import {
  createItemStatsText,
  equipItem,
  getBaseItemFromInventoryItem,
  getItemSellPrice,
  getPlayerStats,
  getRarityColorHex,
  getRarityStrokeColor,
  getRarityText,
  getSlotIcon,
  getSlotText,
  getWeaponTypeDescription,
  getWeaponTypeText,
  isItemEquipped,
  sellItem,
  unequipItem,
} from '../systems/InventorySystem';

import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type InventoryCategory = 'all' | 'weapon' | 'armor' | 'trinket' | 'potions' | 'materials';

type InventoryLayout = {
  width: number;
  height: number;
  centerX: number;

  safeX: number;
  safeTop: number;
  safeBottom: number;

  contentWidth: number;
  compact: boolean;

  headerY: number;

  statsY: number;
  statsHeight: number;

  equipmentY: number;
  equipmentHeight: number;

  tabsY: number;
  tabHeight: number;

  listPanelTop: number;
  listPanelBottom: number;
  listPanelHeight: number;

  listTop: number;
  listBottom: number;
  listHeight: number;

  actionButtonY: number;
};

export class InventoryScene extends Phaser.Scene {
  private isItemInfoOpen = false;

  private returnScene = 'CampScene';

  private itemInfoContainer?: Phaser.GameObjects.Container;

  private inventoryContainer?: Phaser.GameObjects.Container;
  private inventoryMaskGraphics?: Phaser.GameObjects.Graphics;

  private inventoryScrollY = 0;
  private inventoryTargetScrollY = 0;
  private inventoryMaxScrollY = 0;

  private inventoryListTop = 0;
  private inventoryListHeight = 0;
  private inventoryListBottom = 0;

  private inventoryLastRenderedScrollY = -1;

  private initialInventoryScrollY = 0;

  private isDraggingInventory = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  private didDragInventory = false;

  private selectedCategory: InventoryCategory = 'all';

  constructor() {
    super('InventoryScene');
  }

  init(data?: {
    inventoryScrollY?: number;
    selectedCategory?: InventoryCategory;
    returnScene?: string;
  }) {
    this.initialInventoryScrollY = data?.inventoryScrollY ?? 0;
    this.selectedCategory = data?.selectedCategory ?? 'all';
    this.returnScene = data?.returnScene ?? 'CampScene';

    this.isItemInfoOpen = false;
    this.isDraggingInventory = false;
    this.didDragInventory = false;
    this.itemInfoContainer = undefined;
  }

  create(data?: {
    returnScene?: string;
  }) {
    if (data?.returnScene) {
      this.returnScene = data.returnScene;
    }

    if (!data?.returnScene && this.returnScene !== 'DungeonScene') {
      this.returnScene = 'CampScene';
    }

    const layout = this.getLayout();

    createSceneBackground(this);
    this.createInventoryBackdrop(layout);

    this.createInventoryHeader(layout);
    this.createQuickStatsPanel(layout);
    this.createEquipmentPanel(layout);
    this.createCategoryTabs(layout);
    this.createInventoryList(layout);

    if (this.returnScene === 'DungeonScene') {
      this.createReturnButton(layout);
    } else {
      createBottomNav(this, {
        activeScene: 'InventoryScene',
      });
    }
  }

  private getLayout(): InventoryLayout {
    const { width, height } = this.scale;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.025), 20, 34);
    const safeBottom = this.returnScene === 'DungeonScene' ? 92 : 116;

    const contentWidth = Math.min(width - safeX * 2, 640);
    const compact = height < 1120;

    const headerY = safeTop + 28;

    const statsHeight = compact ? 80 : 86;
    const statsY = safeTop + 112;

    const equipmentHeight = compact ? 166 : 184;
    const equipmentY = statsY + statsHeight / 2 + 12 + equipmentHeight / 2;

    const tabHeight = compact ? 50 : 56;
    const tabsY = equipmentY + equipmentHeight / 2 + 14 + tabHeight / 2;

    const listPanelTop = tabsY + tabHeight / 2 + 14;
    const listPanelBottom = height - safeBottom - 18;
    const listPanelHeight = Math.max(360, listPanelBottom - listPanelTop);

    const listTop = listPanelTop + 70;
    const listBottom = listPanelBottom - 76;
    const listHeight = Math.max(170, listBottom - listTop);

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      contentWidth,
      compact,

      headerY,

      statsY,
      statsHeight,

      equipmentY,
      equipmentHeight,

      tabsY,
      tabHeight,

      listPanelTop,
      listPanelBottom,
      listPanelHeight,

      listTop,
      listBottom,
      listHeight,

      actionButtonY: listPanelBottom - 36,
    };
  }

  private createInventoryBackdrop(layout: InventoryLayout) {
    const { width, height, centerX } = layout;

    this.add.circle(centerX, layout.safeTop + 140, width * 0.42, 0x5a341b, 0.1).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 140, width * 0.22, 0xf0d58a, 0.035).setDepth(0);

    this.add.rectangle(centerX, height - 240, width, 430, 0x040302, 0.3).setDepth(0);

    for (let i = 0; i < 18; i += 1) {
      const x = layout.safeX + 20 + i * ((width - layout.safeX * 2 - 40) / 17);
      const y = layout.safeTop + 95 + (i % 6) * 74;

      this.add.circle(x, y, 2 + (i % 2), 0xf0d58a, 0.055).setDepth(1);
    }

    this.add.text(centerX, layout.safeTop + 156, '▦', {
      fontFamily: UI.font.body,
      fontSize: '96px',
      color: '#ffffff',
    })
      .setOrigin(0.5)
      .setAlpha(0.025)
      .setDepth(1);
  }

  private createInventoryHeader(layout: InventoryLayout) {
    this.add.text(layout.centerX, layout.headerY, 'Сумка героя', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '30px' : '34px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth,
      },
    }).setOrigin(0.5).setDepth(100);

    this.add.text(layout.centerX, layout.headerY + 36, 'Катакомбы забвения • добыча и снаряжение', {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 40,
      },
    }).setOrigin(0.5).setDepth(100);
  }

  private createQuickStatsPanel(layout: InventoryLayout) {
    const stats = getPlayerStats(player);

    this.createRoundedPanel({
      x: layout.centerX,
      y: layout.statsY,
      width: layout.contentWidth,
      height: layout.statsHeight,
      radius: 26,
      color: 0x0d0a08,
      alpha: 0.93,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.48,
      depth: 2,
    });

    const chipGap = 8;
    const chipWidth = (layout.contentWidth - 36 - chipGap * 3) / 4;
    const startX = layout.centerX - layout.contentWidth / 2 + 18 + chipWidth / 2;

    this.createStatusChip(startX, layout.statsY, chipWidth, 'HP', `${player.hp}/${stats.maxHp}`, '♥', UI.colors.redHex);
    this.createStatusChip(startX + (chipWidth + chipGap), layout.statsY, chipWidth, 'АТК', `${stats.attack}`, '⚔', UI.colors.gold);
    this.createStatusChip(startX + (chipWidth + chipGap) * 2, layout.statsY, chipWidth, 'ЗАЩ', `${stats.defense}`, '🛡', UI.colors.goldDark);
    this.createStatusChip(startX + (chipWidth + chipGap) * 3, layout.statsY, chipWidth, 'Золото', `${player.gold}`, '◆', UI.colors.gold);
  }

  private createStatusChip(
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    icon: string,
    accentColor: number
  ) {
    this.createRoundedPanel({
      x,
      y,
      width,
      height: 56,
      radius: 18,
      color: 0x17100c,
      alpha: 0.95,
      strokeColor: accentColor,
      strokeAlpha: 0.28,
      strokeWidth: 1,
      depth: 4,
    });

    const iconX = x - width / 2 + 25;
    const textX = x - width / 2 + 48;
    const textWidth = Math.max(30, width - 56);

    this.add.circle(iconX, y, 16, accentColor, 0.16)
      .setStrokeStyle(1, accentColor, 0.5)
      .setDepth(6);

    this.add.text(iconX, y, icon, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7);

    this.add.text(textX, y - 10, label, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: textWidth,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7);

    this.add.text(textX, y + 10, value, {
      fontFamily: UI.font.title,
      fontSize: '14px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: textWidth,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7);
  }

  private createEquipmentPanel(layout: InventoryLayout) {
    this.createRoundedPanel({
      x: layout.centerX,
      y: layout.equipmentY,
      width: layout.contentWidth,
      height: layout.equipmentHeight,
      radius: 30,
      color: 0x100c09,
      alpha: 0.94,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.48,
      depth: 2,
    });

    this.add.text(layout.centerX, layout.equipmentY - layout.equipmentHeight / 2 + 28, 'Экипировка', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '23px' : '26px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 40,
      },
    }).setOrigin(0.5).setDepth(10);

    const slotGap = 10;
    const slotWidth = (layout.contentWidth - 40 - slotGap * 2) / 3;
    const y = layout.equipmentY + 26;
    const startX = layout.centerX - slotWidth - slotGap;

    this.createEquipmentSlotCard('weapon', startX, y, slotWidth);
    this.createEquipmentSlotCard('armor', layout.centerX, y, slotWidth);
    this.createEquipmentSlotCard('trinket', startX + (slotWidth + slotGap) * 2, y, slotWidth);
  }

  private createEquipmentSlotCard(slot: EquipmentSlot, x: number, y: number, width: number) {
    const instanceId = player.equipment[slot];

    const inventoryItem = instanceId
      ? player.inventory.find(item => item.instanceId === instanceId)
      : undefined;

    const item = inventoryItem
      ? getBaseItemFromInventoryItem(inventoryItem)
      : undefined;

    const slotName = getSlotText(slot);

    const rarityColor = item ? getRarityColorHex(item) : UI.colors.goldDark;
    const rarityStrokeColor = item ? getRarityStrokeColor(item) : UI.colors.goldDark;

    const height = 104;

    this.createRoundedPanel({
      x,
      y,
      width,
      height,
      radius: 22,
      color: item ? 0x1a130f : 0x0d0d0d,
      alpha: item ? 0.98 : 0.82,
      strokeColor: item ? rarityStrokeColor : UI.colors.goldDark,
      strokeAlpha: item ? 0.75 : 0.28,
      strokeWidth: 2,
      depth: 4,
    });

    this.add.circle(x, y - 29, 22, item ? rarityColor : 0x17100c, item ? 0.88 : 0.7)
      .setStrokeStyle(2, item ? rarityStrokeColor : UI.colors.goldDark, 0.65)
      .setDepth(6);

    this.add.text(x, y - 29, getSlotIcon(slot), {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: item ? '#ffffff' : UI.colors.textMuted,
    }).setOrigin(0.5).setDepth(7);

    this.add.text(x, y + 3, slotName, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: width - 18,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(7);

    const itemText = item && inventoryItem
      ? `${item.name}${inventoryItem.upgradeLevel > 0 ? ` +${inventoryItem.upgradeLevel}` : ''}`
      : 'Пусто';

    this.add.text(x, y + 31, itemText, {
      fontFamily: UI.font.title,
      fontSize: item ? '12px' : '14px',
      color: item ? UI.colors.goldText : UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: width - 18,
      },
      maxLines: 2,
      stroke: '#000000',
      strokeThickness: item ? 2 : 0,
    }).setOrigin(0.5).setDepth(7);

    if (!item || !inventoryItem) {
      return;
    }

    const zone = this.add.zone(x, y, width, height)
      .setDepth(30)
      .setInteractive({
        useHandCursor: true,
      });

    zone.on('pointerup', () => {
      if (this.isItemInfoOpen) {
        return;
      }

      this.showUnequipConfirm(slot, inventoryItem);
    });
  }

  private createCategoryTabs(layout: InventoryLayout) {
    const tabs: {
      id: InventoryCategory;
      label: string;
      icon: string;
    }[] = [
      { id: 'all', label: 'Все', icon: '▦' },
      { id: 'weapon', label: 'Оруж.', icon: '⚔' },
      { id: 'armor', label: 'Броня', icon: '🛡' },
      { id: 'trinket', label: 'Амул.', icon: '☥' },
      { id: 'potions', label: 'Зелья', icon: '✚' },
      { id: 'materials', label: 'Мат.', icon: '◇' },
    ];

    const gap = 7;
    const tabWidth = (layout.contentWidth - gap * (tabs.length - 1)) / tabs.length;
    const startX = layout.centerX - layout.contentWidth / 2 + tabWidth / 2;

    tabs.forEach((tab, index) => {
      const x = startX + index * (tabWidth + gap);
      const isActive = this.selectedCategory === tab.id;

      const tabBg = this.createRoundedButtonBg({
        x,
        y: layout.tabsY,
        width: tabWidth,
        height: layout.tabHeight,
        radius: 17,
        color: isActive ? 0x2b1d13 : 0x12100d,
        alpha: isActive ? 0.98 : 0.78,
        strokeColor: isActive ? UI.colors.gold : UI.colors.goldDark,
        strokeAlpha: isActive ? 0.92 : 0.35,
        strokeWidth: isActive ? 2 : 1,
        depth: 50,
      });

      const icon = this.add.text(x, layout.tabsY - 12, tab.icon, {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: isActive ? UI.colors.goldText : UI.colors.textMuted,
      }).setOrigin(0.5).setDepth(53);

      const label = this.add.text(x, layout.tabsY + 15, tab.label, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: isActive ? UI.colors.goldText : UI.colors.textMuted,
        align: 'center',
        wordWrap: {
          width: tabWidth - 8,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(53);

      tabBg.zone.on('pointerover', () => {
        if (isActive) {
          return;
        }

        icon.setColor(UI.colors.goldText);
        label.setColor(UI.colors.goldText);
      });

      tabBg.zone.on('pointerout', () => {
        if (isActive) {
          return;
        }

        icon.setColor(UI.colors.textMuted);
        label.setColor(UI.colors.textMuted);
      });

      tabBg.zone.on('pointerdown', () => {
        if (this.selectedCategory === tab.id) {
          return;
        }

        this.selectedCategory = tab.id;
        this.inventoryScrollY = 0;
        this.inventoryTargetScrollY = 0;

        this.scene.restart({
          selectedCategory: this.selectedCategory,
          inventoryScrollY: 0,
          returnScene: this.returnScene,
        });
      });
    });
  }

  private createInventoryList(layout: InventoryLayout) {
    this.inventoryListTop = layout.listTop;
    this.inventoryListHeight = layout.listHeight;
    this.inventoryListBottom = layout.listBottom;

    this.createRoundedPanel({
      x: layout.centerX,
      y: layout.listPanelTop + layout.listPanelHeight / 2,
      width: layout.contentWidth,
      height: layout.listPanelHeight,
      radius: 30,
      color: 0x120d0a,
      alpha: 0.95,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.6,
      depth: 2,
    });

    const title = this.getCategoryTitle();
    const counter = this.getCategoryCounter();

    this.add.text(layout.centerX - layout.contentWidth / 2 + 24, layout.listPanelTop + 34, title, {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '24px' : '27px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      wordWrap: {
        width: layout.contentWidth - 170,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);

    this.add.text(layout.centerX + layout.contentWidth / 2 - 24, layout.listPanelTop + 34, counter, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.textMuted,
      align: 'right',
      wordWrap: {
        width: 130,
      },
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(10);

    this.inventoryContainer = this.add.container(0, 0).setDepth(20);

    this.inventoryMaskGraphics?.destroy();

    this.inventoryMaskGraphics = this.add.graphics();
    this.inventoryMaskGraphics.setVisible(false);
    this.inventoryMaskGraphics.fillStyle(0xffffff, 1);
    this.inventoryMaskGraphics.fillRect(
      layout.centerX - layout.contentWidth / 2 + 18,
      this.inventoryListTop,
      layout.contentWidth - 36,
      this.inventoryListHeight
    );

    this.inventoryContainer.setMask(this.inventoryMaskGraphics.createGeometryMask());

    this.inventoryScrollY = this.initialInventoryScrollY;
    this.inventoryTargetScrollY = this.initialInventoryScrollY;
    this.inventoryLastRenderedScrollY = -1;

    const contentHeight = this.getInventoryContentHeight(layout);

    this.inventoryMaxScrollY = Math.max(
      0,
      contentHeight - this.inventoryListHeight
    );

    this.inventoryScrollY = Phaser.Math.Clamp(
      this.inventoryScrollY,
      0,
      this.inventoryMaxScrollY
    );

    this.inventoryTargetScrollY = Phaser.Math.Clamp(
      this.inventoryTargetScrollY,
      0,
      this.inventoryMaxScrollY
    );

    this.renderInventoryContent(layout);
    this.createInventoryTouchScrollHandlers(layout);

    this.input.off('wheel');

    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        if (this.inventoryMaxScrollY <= 0 || this.isItemInfoOpen) {
          return;
        }

        this.inventoryTargetScrollY = Phaser.Math.Clamp(
          this.inventoryTargetScrollY + deltaY * 0.45,
          0,
          this.inventoryMaxScrollY
        );
      }
    );

    if (
      this.selectedCategory !== 'potions' &&
      this.selectedCategory !== 'materials'
    ) {
      this.createMassSellButton(layout);
    }
  }

  private getCategoryTitle() {
    if (this.selectedCategory === 'materials') return 'Материалы';
    if (this.selectedCategory === 'potions') return 'Зелья здоровья';
    if (this.selectedCategory === 'all') return 'Все предметы';
    if (this.selectedCategory === 'weapon') return 'Оружие';
    if (this.selectedCategory === 'armor') return 'Броня';
    if (this.selectedCategory === 'trinket') return 'Амулеты и талисманы';

    return 'Предметы';
  }

  private getCategoryCounter() {
    if (this.selectedCategory === 'materials') {
      return `${this.getTotalMaterialsCount()} шт.`;
    }

    if (this.selectedCategory === 'potions') {
      return `${player.potions} шт.`;
    }

    return `${this.getFilteredInventoryItems().length} шт.`;
  }

  private getFilteredInventoryItems() {
    const itemCategories: InventoryCategory[] = ['weapon', 'armor', 'trinket'];

    if (this.selectedCategory === 'all') {
      return this.sortInventoryItemsByRarity(player.inventory);
    }

    if (!itemCategories.includes(this.selectedCategory)) {
      return [];
    }

    return this.sortInventoryItemsByRarity(
      player.inventory.filter(inventoryItem => {
        const item = getBaseItemFromInventoryItem(inventoryItem);

        if (!item) {
          return false;
        }

        return item.slot === this.selectedCategory;
      })
    );
  }

  private sortInventoryItemsByRarity(items: InventoryItem[]) {
    return [...items].sort((leftItem, rightItem) => {
      const leftBase = getBaseItemFromInventoryItem(leftItem);
      const rightBase = getBaseItemFromInventoryItem(rightItem);

      const rightRank = rightBase ? this.getRaritySortRank(rightBase.rarity) : -1;
      const leftRank = leftBase ? this.getRaritySortRank(leftBase.rarity) : -1;

      if (rightRank !== leftRank) {
        return rightRank - leftRank;
      }

      const leftEquipped = isItemEquipped(player, leftItem.instanceId) ? 1 : 0;
      const rightEquipped = isItemEquipped(player, rightItem.instanceId) ? 1 : 0;

      if (rightEquipped !== leftEquipped) {
        return rightEquipped - leftEquipped;
      }

      const leftName = leftBase?.name ?? '';
      const rightName = rightBase?.name ?? '';

      return leftName.localeCompare(rightName, 'ru');
    });
  }

  private getRaritySortRank(rarity: string) {
    if (rarity === 'common') return 1;
    if (rarity === 'rare') return 2;
    if (rarity === 'epic') return 3;
    if (rarity === 'legendary') return 4;
    if (rarity === 'mythic') return 5;

    return 0;
  }

  private getVisibleMaterials() {
    return materials.filter(material => {
      return (player.materials?.[material.id] ?? 0) > 0;
    });
  }

  private getInventoryContentHeight(layout: InventoryLayout) {
    if (this.selectedCategory === 'potions') {
      return 230;
    }

    if (this.selectedCategory === 'materials') {
      const count = Math.max(1, this.getVisibleMaterials().length);
      return 28 + count * 92 + 20;
    }

    const count = Math.max(1, this.getFilteredInventoryItems().length);
    const itemSpacing = layout.compact ? 108 : 116;

    return 20 + count * itemSpacing + 20;
  }

  private renderInventoryContent(layout: InventoryLayout) {
    if (!this.inventoryContainer) {
      return;
    }

    this.inventoryContainer.removeAll(true);

    if (this.selectedCategory === 'potions') {
      this.renderPotionCategory(layout);
      this.inventoryLastRenderedScrollY = this.inventoryScrollY;
      return;
    }

    if (this.selectedCategory === 'materials') {
      this.renderMaterialsCategory(layout);
      this.inventoryLastRenderedScrollY = this.inventoryScrollY;
      return;
    }

    this.renderItemCategory(layout);
    this.inventoryLastRenderedScrollY = this.inventoryScrollY;
  }

  private renderItemCategory(layout: InventoryLayout) {
    const filteredItems = this.getFilteredInventoryItems();

    if (player.inventory.length === 0) {
      this.createEmptyState(
        layout.centerX,
        this.inventoryListTop + this.inventoryListHeight / 2,
        layout.contentWidth - 80,
        'В сумке пока нет предметов.\nИх можно найти в катакомбах или купить в лавке.'
      );
      return;
    }

    if (filteredItems.length === 0) {
      this.createEmptyState(
        layout.centerX,
        this.inventoryListTop + this.inventoryListHeight / 2,
        layout.contentWidth - 80,
        'В этой категории пока нет предметов.'
      );
      return;
    }

    const itemSpacing = layout.compact ? 108 : 116;
    const cardHeight = layout.compact ? 96 : 104;
    const cardHalfHeight = cardHeight / 2;
    const topPadding = 24;
    const fadeZone = 50;

    filteredItems.forEach((inventoryItem, index) => {
      const y =
        this.inventoryListTop +
        topPadding +
        cardHalfHeight +
        index * itemSpacing -
        this.inventoryScrollY;

      if (y + cardHalfHeight < this.inventoryListTop - fadeZone) {
        return;
      }

      if (y - cardHalfHeight > this.inventoryListBottom + fadeZone) {
        return;
      }

      let alpha = 1;

      if (y - cardHalfHeight < this.inventoryListTop) {
        const distance = y + cardHalfHeight - this.inventoryListTop;
        alpha = Phaser.Math.Clamp(distance / fadeZone, 0, 1);
      }

      if (y + cardHalfHeight > this.inventoryListBottom) {
        const distance = this.inventoryListBottom - (y - cardHalfHeight);
        alpha = Math.min(alpha, Phaser.Math.Clamp(distance / fadeZone, 0, 1));
      }

      this.createInventoryItemCard(layout, inventoryItem, y, cardHeight, alpha);
    });
  }

  private renderPotionCategory(layout: InventoryLayout) {
    const stats = getPlayerStats(player);

    const canUsePotion = player.potions > 0 && player.hp < stats.maxHp;

    const cardWidth = layout.contentWidth - 70;
    const cardHeight = 170;
    const cardX = layout.centerX;
    const cardY = this.inventoryListTop + 95 - this.inventoryScrollY;

    const objects: Phaser.GameObjects.GameObject[] = [];

    objects.push(
      ...this.createRoundedPanelAsObjects({
        x: cardX,
        y: cardY,
        width: cardWidth,
        height: cardHeight,
        radius: 26,
        color: 0x14100d,
        alpha: 0.96,
        strokeColor: UI.colors.goldDark,
        strokeAlpha: 0.65,
        strokeWidth: 2,
        depth: 20,
      })
    );

    const left = cardX - cardWidth / 2;

    objects.push(
      this.add.circle(left + 50, cardY - 37, 34, 0x2a1d13, 1)
        .setStrokeStyle(2, UI.colors.goldDark, 0.75)
        .setDepth(24)
    );

    objects.push(
      this.add.text(left + 50, cardY - 37, '✚', {
        fontFamily: UI.font.body,
        fontSize: '28px',
        color: UI.colors.goldText,
      }).setOrigin(0.5).setDepth(25)
    );

    objects.push(
      this.add.text(left + 96, cardY - 58, 'Зелье здоровья', {
        fontFamily: UI.font.title,
        fontSize: '22px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: cardWidth - 120,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(25)
    );

    objects.push(
      this.add.text(left + 96, cardY - 25, `Количество: ${player.potions}`, {
        fontFamily: UI.font.body,
        fontSize: '16px',
        color: UI.colors.text,
        wordWrap: {
          width: cardWidth - 120,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(25)
    );

    objects.push(
      this.add.text(left + 96, cardY + 5, 'Восстанавливает 35% максимального HP.', {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: cardWidth - 120,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(25)
    );

    objects.push(
      this.add.text(left + 96, cardY + 34, `HP: ${player.hp}/${stats.maxHp}`, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: canUsePotion ? UI.colors.green : UI.colors.textMuted,
        wordWrap: {
          width: cardWidth - 120,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(25)
    );

    const button = this.createUiButton({
      x: cardX,
      y: cardY + 72,
      width: Math.min(cardWidth - 58, 430),
      height: 46,
      text: canUsePotion ? 'Выпить зелье' : 'Нельзя использовать',
      accentColor: UI.colors.greenHex,
      disabled: !canUsePotion,
      onClick: () => {
        this.usePotionOutsideBattle();
      },
      depth: 26,
    });

    objects.push(...button.objects);

    this.inventoryContainer?.add(objects);
  }

  private renderMaterialsCategory(layout: InventoryLayout) {
    const visibleMaterials = this.getVisibleMaterials();

    if (visibleMaterials.length === 0) {
      this.createEmptyState(
        layout.centerX,
        this.inventoryListTop + this.inventoryListHeight / 2,
        layout.contentWidth - 80,
        'Материалов пока нет.\nИх можно получить с монстров, элиты, мини-боссов и Морвеина.'
      );
      return;
    }

    const cardHeight = 78;
    const cardHalfHeight = cardHeight / 2;
    const spacing = 92;
    const topPadding = 24;
    const fadeZone = 50;

    visibleMaterials.forEach((material, index) => {
      const y =
        this.inventoryListTop +
        topPadding +
        cardHalfHeight +
        index * spacing -
        this.inventoryScrollY;

      if (y + cardHalfHeight < this.inventoryListTop - fadeZone) {
        return;
      }

      if (y - cardHalfHeight > this.inventoryListBottom + fadeZone) {
        return;
      }

      let alpha = 1;

      if (y - cardHalfHeight < this.inventoryListTop) {
        const distance = y + cardHalfHeight - this.inventoryListTop;
        alpha = Phaser.Math.Clamp(distance / fadeZone, 0, 1);
      }

      if (y + cardHalfHeight > this.inventoryListBottom) {
        const distance = this.inventoryListBottom - (y - cardHalfHeight);
        alpha = Math.min(alpha, Phaser.Math.Clamp(distance / fadeZone, 0, 1));
      }

      this.createMaterialCard(layout, material.id, y, alpha);
    });
  }

  private createEmptyState(
    x: number,
    y: number,
    width: number,
    text: string
  ) {
    if (!this.inventoryContainer) {
      return;
    }

    const icon = this.add.text(x, y - 42, '◇', {
      fontFamily: UI.font.body,
      fontSize: '34px',
      color: UI.colors.textMuted,
    }).setOrigin(0.5).setDepth(25);

    const label = this.add.text(x, y + 20, text, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.textMuted,
      align: 'center',
      lineSpacing: 6,
      wordWrap: {
        width,
      },
    }).setOrigin(0.5).setDepth(25);

    this.inventoryContainer.add([icon, label]);
  }

  private createMaterialCard(
    layout: InventoryLayout,
    materialId: string,
    y: number,
    alpha = 1
  ) {
    const material = materials.find(item => item.id === materialId);

    if (!material || !this.inventoryContainer) {
      return;
    }

    const amount = player.materials?.[material.id] ?? 0;

    const cardX = layout.centerX;
    const cardWidth = layout.contentWidth - 70;
    const cardHeight = 78;

    const color =
      material.tier === 'forge_core'
        ? 0xff6b6b
        : material.tier === 'medium'
          ? 0x70a6ff
          : material.tier === 'crystal'
            ? 0xc084fc
            : 0xd8c7a3;

    const objects: Phaser.GameObjects.GameObject[] = [
      ...this.createRoundedPanelAsObjects({
        x: cardX,
        y,
        width: cardWidth,
        height: cardHeight,
        radius: 20,
        color: 0x14100d,
        alpha: 0.96,
        strokeColor: color,
        strokeAlpha: 0.55,
        strokeWidth: 2,
        depth: 20,
      }),
    ];

    const left = cardX - cardWidth / 2;
    const right = cardX + cardWidth / 2;

    objects.push(
      this.add.circle(left + 36, y, 24, color, 0.16)
        .setStrokeStyle(1, color, 0.65)
        .setDepth(24)
    );

    objects.push(
      this.add.text(left + 36, y, this.getMaterialIcon(material.tier), {
        fontFamily: UI.font.body,
        fontSize: '19px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(25)
    );

    objects.push(
      this.add.text(left + 74, y - 16, material.name, {
        fontFamily: UI.font.title,
        fontSize: '17px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: cardWidth - 150,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(25)
    );

    objects.push(
      this.add.text(left + 74, y + 13, this.getMaterialTierText(material.tier), {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: cardWidth - 150,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(25)
    );

    objects.push(
      this.add.text(right - 22, y, `x${amount}`, {
        fontFamily: UI.font.title,
        fontSize: '23px',
        color: UI.colors.text,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'right',
        wordWrap: {
          width: 70,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(25)
    );

    this.setObjectsAlpha(objects, alpha);

    this.inventoryContainer.add(objects);
  }

  private createInventoryItemCard(
    layout: InventoryLayout,
    inventoryItem: InventoryItem,
    y: number,
    cardHeight: number,
    alpha = 1
  ) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item || !this.inventoryContainer) {
      return;
    }

    const upgrade =
      inventoryItem.upgradeLevel > 0
        ? ` +${inventoryItem.upgradeLevel}`
        : '';

    const isEquipped = isItemEquipped(player, inventoryItem.instanceId);

    const rarityColor = getRarityColorHex(item);
    const rarityStrokeColor = getRarityStrokeColor(item);

    const cardX = layout.centerX;
    const cardWidth = layout.contentWidth - 70;

    const cardObjects: Phaser.GameObjects.GameObject[] = [
      ...this.createRoundedPanelAsObjects({
        x: cardX,
        y,
        width: cardWidth,
        height: cardHeight,
        radius: 20,
        color: isEquipped ? 0x2a1d13 : 0x17100c,
        alpha: isEquipped ? 0.98 : 0.95,
        strokeColor: isEquipped ? UI.colors.gold : rarityStrokeColor,
        strokeAlpha: isEquipped ? 0.95 : 0.68,
        strokeWidth: isEquipped ? 2 : 1,
        depth: 10,
      }),
    ];

    const left = cardX - cardWidth / 2;
    const iconX = left + 39;
    const textX = left + 76;
    const buttonWidth = Math.min(94, Math.max(76, cardWidth * 0.18));
    const buttonX = cardX + cardWidth / 2 - buttonWidth / 2 - 16;
    const textWidth = Math.max(120, cardWidth - 76 - buttonWidth - 34);

    let actionButtonPressed = false;

    const cardZone = this.add.zone(cardX, y, cardWidth, cardHeight)
      .setDepth(17)
      .setInteractive({
        useHandCursor: true,
      });

    cardZone.on('pointerup', () => {
      if (this.isItemInfoOpen) {
        return;
      }

      if (this.didDragInventory) {
        this.didDragInventory = false;
        return;
      }

      if (actionButtonPressed) {
        actionButtonPressed = false;
        return;
      }

      this.showItemInfo(inventoryItem);
    });

    cardObjects.push(cardZone);

    cardObjects.push(
      this.add.circle(iconX, y, 27, rarityColor, 0.18).setDepth(12)
    );

    cardObjects.push(
      this.add.circle(iconX, y, 22, rarityColor, 0.92)
        .setStrokeStyle(2, rarityStrokeColor, 0.85)
        .setDepth(13)
    );

    cardObjects.push(
      this.add.text(iconX, y, getSlotIcon(item.slot), {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(14)
    );

    cardObjects.push(
      this.add.text(textX, y - 28, `${item.name}${upgrade}`, {
        fontFamily: UI.font.title,
        fontSize: '15px',
        color: isEquipped ? UI.colors.goldText : UI.colors.text,
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(14)
    );

    cardObjects.push(
      this.add.text(
        textX,
        y + 1,
        `${item.slot === 'weapon' ? getWeaponTypeText(item.weaponType) : getSlotText(item.slot)} • ${getRarityText(item)}`,
        {
          fontFamily: UI.font.body,
          fontSize: '12px',
          color: '#b8aa91',
          wordWrap: {
            width: textWidth,
          },
          maxLines: 1,
        }
      ).setOrigin(0, 0.5).setDepth(14)
    );

    cardObjects.push(
      this.add.text(textX, y + 24, createItemStatsText(inventoryItem) || 'Без бонусов', {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(14)
    );

    const equipButton = this.createUiButton({
      x: buttonX,
      y: y - 22,
      width: buttonWidth,
      height: 38,
      text: isEquipped ? 'Надето' : 'Надеть',
      accentColor: UI.colors.greenHex,
      disabled: isEquipped,
      onClick: () => {
        actionButtonPressed = true;

        if (this.isItemInfoOpen || isEquipped) {
          return;
        }

        equipItem(player, inventoryItem.instanceId);
        void saveGameAsync();

        this.scene.restart({
          inventoryScrollY: this.inventoryTargetScrollY,
          selectedCategory: this.selectedCategory,
          returnScene: this.returnScene,
        });
      },
      depth: 18,
      small: true,
    });

    const sellButton = this.createUiButton({
      x: buttonX,
      y: y + 24,
      width: buttonWidth,
      height: 38,
      text: 'Продать',
      accentColor: UI.colors.redHex,
      danger: true,
      disabled: isEquipped,
      onClick: () => {
        actionButtonPressed = true;

        if (this.isItemInfoOpen || isEquipped) {
          return;
        }

        this.showSellConfirm(inventoryItem);
      },
      depth: 18,
      small: true,
    });

    cardObjects.push(...equipButton.objects, ...sellButton.objects);

    this.setObjectsAlpha(cardObjects, alpha);

    if (alpha < 0.65) {
      cardZone.disableInteractive();
      equipButton.zone?.disableInteractive();
      sellButton.zone?.disableInteractive();
    }

    this.inventoryContainer.add(cardObjects);
  }

  private createMassSellButton(layout: InventoryLayout) {
    const button = this.createUiButton({
      x: layout.centerX,
      y: layout.actionButtonY,
      width: Math.min(layout.contentWidth - 90, 470),
      height: 44,
      text: 'Продать обычные ненадетые',
      accentColor: UI.colors.redHex,
      danger: true,
      onClick: () => {
        this.showMassSellConfirm();
      },
      depth: 32,
    });

    // Кнопка не внутри списка, поэтому добавлять в inventoryContainer не нужно.
    void button;
  }

  private createReturnButton(layout: InventoryLayout) {
    const text =
      this.returnScene === 'DungeonScene'
        ? 'Вернуться к комнате'
        : 'Вернуться в город';

    this.createUiButton({
      x: layout.centerX,
      y: layout.height - 46,
      width: Math.min(layout.contentWidth - 60, 500),
      height: 54,
      text,
      accentColor: UI.colors.gold,
      onClick: () => {
        this.scene.start(this.returnScene);
      },
      depth: 200,
    });
  }

  private createInventoryTouchScrollHandlers(layout: InventoryLayout) {
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.input.off('pointerupoutside');

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.inventoryMaxScrollY <= 0 || this.isItemInfoOpen) {
        return;
      }

      if (!this.isPointerInsideInventoryList(pointer, layout)) {
        return;
      }

      this.isDraggingInventory = true;
      this.didDragInventory = false;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.inventoryTargetScrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDraggingInventory || this.isItemInfoOpen) {
        return;
      }

      const dragDistance = pointer.y - this.dragStartY;

      if (Math.abs(dragDistance) < 8) {
        return;
      }

      this.didDragInventory = true;

      this.inventoryTargetScrollY = Phaser.Math.Clamp(
        this.dragStartScrollY - dragDistance,
        0,
        this.inventoryMaxScrollY
      );

      this.inventoryScrollY = this.inventoryTargetScrollY;
      this.renderInventoryContent(layout);
    });

    this.input.on('pointerup', () => {
      this.isDraggingInventory = false;
    });

    this.input.on('pointerupoutside', () => {
      this.isDraggingInventory = false;
      this.didDragInventory = false;
    });
  }

  private isPointerInsideInventoryList(
    pointer: Phaser.Input.Pointer,
    layout: InventoryLayout
  ) {
    const left = layout.centerX - layout.contentWidth / 2;
    const right = layout.centerX + layout.contentWidth / 2;

    return (
      pointer.x >= left &&
      pointer.x <= right &&
      pointer.y >= this.inventoryListTop &&
      pointer.y <= this.inventoryListBottom
    );
  }

  update() {
    const layout = this.getLayout();

    if (!this.inventoryContainer || this.isItemInfoOpen || this.isDraggingInventory) {
      return;
    }

    const oldScrollY = this.inventoryScrollY;

    if (Math.abs(this.inventoryScrollY - this.inventoryTargetScrollY) < 0.5) {
      this.inventoryScrollY = this.inventoryTargetScrollY;
    } else {
      this.inventoryScrollY = Phaser.Math.Linear(
        this.inventoryScrollY,
        this.inventoryTargetScrollY,
        0.18
      );
    }

    const scrollChanged = Math.abs(oldScrollY - this.inventoryScrollY) > 0.25;
    const renderChanged =
      Math.abs(this.inventoryLastRenderedScrollY - this.inventoryScrollY) > 0.75;

    if (scrollChanged && renderChanged) {
      this.renderInventoryContent(layout);
    }
  }

  private showUnequipConfirm(slot: EquipmentSlot, inventoryItem: InventoryItem) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return;
    }

    const itemName = `${item.name}${inventoryItem.upgradeLevel > 0 ? ` +${inventoryItem.upgradeLevel}` : ''}`;

    this.showConfirmModal({
      title: 'Снять предмет?',
      message: [
        itemName,
        '',
        `Слот: ${getSlotText(slot)}`,
        `Редкость: ${getRarityText(item)}`,
        `Характеристики: ${createItemStatsText(inventoryItem) || 'нет'}`,
        '',
        'Предмет останется в сумке.',
      ].join('\n'),
      confirmText: 'Снять',
      cancelText: 'Отмена',
      onConfirm: () => {
        unequipItem(player, slot);
        void saveGameAsync();
        this.restartInventory();
      },
    });
  }

  private showItemInfo(inventoryItem: InventoryItem) {
    if (this.isItemInfoOpen) {
      return;
    }

    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return;
    }

    this.isItemInfoOpen = true;

    const layout = this.getLayout();

    const equipped = isItemEquipped(player, inventoryItem.instanceId);
    const sellPrice = getItemSellPrice(item, inventoryItem.upgradeLevel);

    const rarityColor = getRarityColorHex(item);
    const rarityStrokeColor = getRarityStrokeColor(item);

    const upgrade =
      inventoryItem.upgradeLevel > 0
        ? ` +${inventoryItem.upgradeLevel}`
        : '';

    const itemTypeText =
      item.slot === 'weapon'
        ? getWeaponTypeText(item.weaponType)
        : getSlotText(item.slot);

    const weaponDescription =
      item.slot === 'weapon'
        ? getWeaponTypeDescription(item.weaponType)
        : '';

    const modal = this.add.container(0, 0).setDepth(1000);
    this.itemInfoContainer = modal;

    const overlay = this.add.rectangle(
      layout.centerX,
      layout.height / 2,
      layout.width,
      layout.height,
      0x000000,
      0.72
    ).setInteractive();

    const panelWidth = Math.min(layout.contentWidth, 620);
    const panelHeight = Math.min(690, layout.height - layout.safeTop - layout.safeBottom - 24);
    const panelY = layout.height / 2;

    const panelObjects = this.createRoundedPanelAsObjects({
      x: layout.centerX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius: 30,
      color: 0x17100c,
      alpha: 0.985,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.9,
      strokeWidth: 3,
      depth: 1001,
    });

    const top = panelY - panelHeight / 2;
    const bottom = panelY + panelHeight / 2;

    const iconY = top + 58;

    const iconBg = this.add.circle(
      layout.centerX,
      iconY,
      32,
      rarityColor,
      0.95
    ).setStrokeStyle(3, rarityStrokeColor, 0.9);

    const icon = this.add.text(layout.centerX, iconY, getSlotIcon(item.slot), {
      fontFamily: UI.font.body,
      fontSize: '26px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    const title = this.add.text(
      layout.centerX,
      top + 116,
      `${item.name}${upgrade}`,
      {
        fontFamily: UI.font.title,
        fontSize: '25px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: panelWidth - 70,
        },
        maxLines: 2,
      }
    ).setOrigin(0.5);

    const typeText = this.add.text(
      layout.centerX,
      top + 168,
      `${itemTypeText} • ${getRarityText(item)}`,
      {
        fontFamily: UI.font.body,
        fontSize: '16px',
        color: UI.colors.textMuted,
        align: 'center',
        wordWrap: {
          width: panelWidth - 70,
        },
        maxLines: 1,
      }
    ).setOrigin(0.5);

    const description = this.add.text(
      layout.centerX,
      top + 225,
      item.description,
      {
        fontFamily: UI.font.body,
        fontSize: '16px',
        color: UI.colors.text,
        align: 'center',
        lineSpacing: 5,
        wordWrap: {
          width: panelWidth - 80,
        },
        maxLines: 4,
      }
    ).setOrigin(0.5);

    const comparisonText = this.createItemComparisonText(inventoryItem);

    const statsLines = [
      `Характеристики: ${createItemStatsText(inventoryItem) || 'нет'}`,
      comparisonText,
      weaponDescription,
      `Цена продажи: ${sellPrice} золота`,
      equipped ? 'Статус: надето' : 'Статус: в сумке',
    ].filter(Boolean);

    const statsText = this.add.text(
      layout.centerX,
      top + 346,
      statsLines.join('\n'),
      {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: UI.colors.goldText,
        align: 'center',
        lineSpacing: 4,
        wordWrap: {
          width: panelWidth - 80,
          useAdvancedWrap: true,
        },
        maxLines: 12,
      }
    ).setOrigin(0.5);

    const buttonWidth = Math.min(panelWidth - 150, 360);
    const equipButton = this.createUiButton({
      x: layout.centerX,
      y: bottom - 150,
      width: buttonWidth,
      height: 48,
      text: equipped ? 'Уже надето' : 'Надеть',
      accentColor: UI.colors.greenHex,
      disabled: equipped,
      onClick: () => {
        if (equipped) {
          return;
        }

        equipItem(player, inventoryItem.instanceId);
        void saveGameAsync();

        this.closeItemInfo();

        this.scene.restart({
          inventoryScrollY: this.inventoryTargetScrollY,
          selectedCategory: this.selectedCategory,
          returnScene: this.returnScene,
        });
      },
      depth: 1010,
    });

    const sellButton = this.createUiButton({
      x: layout.centerX,
      y: bottom - 94,
      width: buttonWidth,
      height: 48,
      text: `Продать за ${sellPrice}`,
      accentColor: UI.colors.redHex,
      danger: true,
      disabled: equipped,
      onClick: () => {
        this.closeItemInfo();
        this.showSellConfirm(inventoryItem);
      },
      depth: 1010,
    });

    const closeButton = this.createUiButton({
      x: layout.centerX,
      y: bottom - 38,
      width: buttonWidth,
      height: 48,
      text: 'Закрыть',
      accentColor: UI.colors.gold,
      onClick: () => {
        this.closeItemInfo();
      },
      depth: 1010,
    });

    modal.add([
      overlay,
      ...panelObjects,
      iconBg,
      icon,
      title,
      typeText,
      description,
      statsText,
      ...equipButton.objects,
      ...sellButton.objects,
      ...closeButton.objects,
    ]);
  }

  private getEquippedInventoryItemForSlot(slot: EquipmentSlot) {
    const equippedInstanceId = player.equipment[slot];

    if (!equippedInstanceId) {
      return undefined;
    }

    return player.inventory.find(item => item.instanceId === equippedInstanceId);
  }

  private getItemBonusValues(inventoryItem?: InventoryItem) {
    const item = inventoryItem
      ? getBaseItemFromInventoryItem(inventoryItem)
      : undefined;

    const upgradeLevel = inventoryItem?.upgradeLevel ?? 0;

    if (!item) {
      return {
        hp: 0,
        attack: 0,
        defense: 0,
        critChance: 0,
      };
    }

    return {
      hp: (item.bonusHp ?? 0) + upgradeLevel * 4,
      attack: (item.bonusAttack ?? 0) + upgradeLevel * 2,
      defense: (item.bonusDefense ?? 0) + upgradeLevel,
      critChance: (item.bonusCritChance ?? 0) + upgradeLevel * 0.005,
    };
  }

  private createItemComparisonText(inventoryItem: InventoryItem) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return '';
    }

    const equippedInventoryItem = this.getEquippedInventoryItemForSlot(item.slot);

    if (!equippedInventoryItem) {
      return `Сравнение с надетым:\nВ слоте «${getSlotText(item.slot)}» сейчас ничего не надето.`;
    }

    const equippedItem = getBaseItemFromInventoryItem(equippedInventoryItem);

    if (!equippedItem) {
      return '';
    }

    if (equippedInventoryItem.instanceId === inventoryItem.instanceId) {
      return 'Сравнение с надетым:\nЭтот предмет уже надет.';
    }

    const selectedBonus = this.getItemBonusValues(inventoryItem);
    const equippedBonus = this.getItemBonusValues(equippedInventoryItem);

    const equippedUpgrade = equippedInventoryItem.upgradeLevel > 0
      ? ` +${equippedInventoryItem.upgradeLevel}`
      : '';

    const lines = [
      `Сравнение с надетым: ${equippedItem.name}${equippedUpgrade}`,
      this.createComparisonLine('HP', selectedBonus.hp, equippedBonus.hp),
      this.createComparisonLine('Атака', selectedBonus.attack, equippedBonus.attack),
      this.createComparisonLine('Защита', selectedBonus.defense, equippedBonus.defense),
      this.createComparisonLine('Крит', selectedBonus.critChance, equippedBonus.critChance, true),
    ];

    return lines.join('\n');
  }

  private createComparisonLine(
    label: string,
    selectedValue: number,
    equippedValue: number,
    percent = false
  ) {
    const diff = selectedValue - equippedValue;

    return `${label}: ${this.formatStatValue(selectedValue, percent)} / ${this.formatStatValue(equippedValue, percent)} (${this.formatDelta(diff, percent)})`;
  }

  private formatStatValue(value: number, percent = false) {
    const displayValue = percent
      ? `${Math.round(value * 100)}%`
      : `${value}`;

    return value > 0
      ? `+${displayValue}`
      : displayValue;
  }

  private formatDelta(value: number, percent = false) {
    const displayValue = percent
      ? `${Math.abs(Math.round(value * 100))}%`
      : `${Math.abs(value)}`;

    if (value > 0) {
      return `+${displayValue}`;
    }

    if (value < 0) {
      return `-${displayValue}`;
    }

    return percent ? '0%' : '0';
  }

  private showSellConfirm(inventoryItem: InventoryItem) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return;
    }

    if (isItemEquipped(player, inventoryItem.instanceId)) {
      this.showMessage('Сначала сними предмет, потом его можно будет продать.');
      return;
    }

    const sellPrice = getItemSellPrice(item, inventoryItem.upgradeLevel);

    const upgrade =
      inventoryItem.upgradeLevel > 0
        ? ` +${inventoryItem.upgradeLevel}`
        : '';

    this.showConfirmModal({
      title: 'Продать предмет?',
      message: [
        `${item.name}${upgrade}`,
        '',
        `${item.slot === 'weapon' ? getWeaponTypeText(item.weaponType) : getSlotText(item.slot)} • ${getRarityText(item)}`,
        `Характеристики: ${createItemStatsText(inventoryItem) || 'нет'}`,
        '',
        `Ты получишь: ${sellPrice} золота.`,
      ].join('\n'),
      confirmText: `Продать за ${sellPrice}`,
      cancelText: 'Отмена',
      danger: true,
      onConfirm: () => {
        const result = sellItem(player, inventoryItem.instanceId);

        if (!result.success) {
          this.showMessage(result.message ?? 'Не удалось продать предмет.');
          return;
        }

        void saveGameAsync();
        this.restartInventory();
      },
    });
  }

  private showMassSellConfirm() {
    const itemsToSell = player.inventory.filter(inventoryItem => {
      const item = getBaseItemFromInventoryItem(inventoryItem);

      if (!item) {
        return false;
      }

      if (isItemEquipped(player, inventoryItem.instanceId)) {
        return false;
      }

      return item.rarity === 'common';
    });

    const totalGold = itemsToSell.reduce((sum, inventoryItem) => {
      const item = getBaseItemFromInventoryItem(inventoryItem);

      if (!item) {
        return sum;
      }

      return sum + getItemSellPrice(item, inventoryItem.upgradeLevel);
    }, 0);

    const itemNames = itemsToSell
      .slice(0, 5)
      .map(inventoryItem => {
        const item = getBaseItemFromInventoryItem(inventoryItem);

        if (!item) {
          return '';
        }

        const upgrade =
          inventoryItem.upgradeLevel > 0
            ? ` +${inventoryItem.upgradeLevel}`
            : '';

        return `• ${item.name}${upgrade}`;
      })
      .filter(line => line.length > 0);

    const moreText =
      itemsToSell.length > 5
        ? `\nи ещё ${itemsToSell.length - 5} предметов...`
        : '';

    this.showConfirmModal({
      title: 'Массовая продажа',
      message:
        itemsToSell.length > 0
          ? [
              'Будут проданы только ненадетые предметы обычной редкости.',
              '',
              `Обычных предметов: ${itemsToSell.length}`,
              `Ты получишь: ${totalGold} золота`,
              '',
              itemNames.join('\n') + moreText,
            ].join('\n')
          : 'Нет ненадетых предметов обычной редкости для продажи.',
      confirmText: itemsToSell.length > 0 ? `Продать за ${totalGold}` : 'Понятно',
      cancelText: 'Отмена',
      danger: itemsToSell.length > 0,
      hideCancel: itemsToSell.length === 0,
      onConfirm: () => {
        if (itemsToSell.length === 0) {
          this.isItemInfoOpen = false;
          return;
        }

        itemsToSell.forEach(inventoryItem => {
          sellItem(player, inventoryItem.instanceId);
        });

        void saveGameAsync();
        this.restartInventory();
      },
    });
  }

  private usePotionOutsideBattle() {
    const stats = getPlayerStats(player);

    if (player.potions <= 0) {
      this.showMessage('Зелий больше нет.');
      return;
    }

    if (player.hp >= stats.maxHp) {
      this.showMessage('HP уже полное. Зелье не потрачено.');
      return;
    }

    const healAmount = Math.max(1, Math.floor(stats.maxHp * 0.35));

    player.potions = Math.max(0, player.potions - 1);
    player.hp = Math.min(stats.maxHp, player.hp + healAmount);

    void saveGameAsync();

    this.showMessage(`Ты выпил зелье и восстановил ${healAmount} HP.`);
  }

  private showMessage(message: string) {
    this.showConfirmModal({
      title: 'Сумка',
      message,
      confirmText: 'Понятно',
      hideCancel: true,
      onConfirm: () => {
        this.isItemInfoOpen = false;
        this.restartInventory();
      },
    });
  }

  private showConfirmModal(config: {
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    danger?: boolean;
    hideCancel?: boolean;
    onConfirm: () => void;
  }) {
    if (this.isItemInfoOpen) {
      return;
    }

    this.isItemInfoOpen = true;

    const layout = this.getLayout();

    const modal = this.add.container(0, 0).setDepth(1000);
    this.itemInfoContainer = modal;

    const overlay = this.add.rectangle(
      layout.centerX,
      layout.height / 2,
      layout.width,
      layout.height,
      0x000000,
      0.72
    ).setInteractive();

    const panelWidth = Math.min(layout.contentWidth, 620);
    const panelHeight = Math.min(config.hideCancel ? 340 : 420, layout.height - 120);
    const panelY = layout.height / 2;

    const panelObjects = this.createRoundedPanelAsObjects({
      x: layout.centerX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius: 28,
      color: 0x17100c,
      alpha: 0.985,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.9,
      strokeWidth: 3,
      depth: 1001,
    });

    const top = panelY - panelHeight / 2;
    const bottom = panelY + panelHeight / 2;

    const titleText = this.add.text(layout.centerX, top + 48, config.title, {
      fontFamily: UI.font.title,
      fontSize: '28px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: panelWidth - 60,
      },
      maxLines: 2,
    }).setOrigin(0.5);

    const messageText = this.add.text(layout.centerX, top + panelHeight / 2 - 12, config.message, {
      fontFamily: UI.font.body,
      fontSize: '17px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 6,
      wordWrap: {
        width: panelWidth - 70,
      },
      maxLines: config.hideCancel ? 7 : 8,
    }).setOrigin(0.5);

    const buttonWidth = Math.min(panelWidth - 150, 360);
    const confirmY = config.hideCancel ? bottom - 55 : bottom - 112;

    const confirmButton = this.createUiButton({
      x: layout.centerX,
      y: confirmY,
      width: buttonWidth,
      height: 52,
      text: config.confirmText,
      accentColor: config.danger ? UI.colors.redHex : UI.colors.gold,
      danger: config.danger,
      onClick: () => {
        const callback = config.onConfirm;
        this.closeItemInfo();
        callback();
      },
      depth: 1010,
    });

    const objects: Phaser.GameObjects.GameObject[] = [
      overlay,
      ...panelObjects,
      titleText,
      messageText,
      ...confirmButton.objects,
    ];

    if (!config.hideCancel) {
      const cancelButton = this.createUiButton({
        x: layout.centerX,
        y: bottom - 50,
        width: buttonWidth,
        height: 52,
        text: config.cancelText ?? 'Отмена',
        accentColor: UI.colors.goldDark,
        onClick: () => {
          this.closeItemInfo();
        },
        depth: 1010,
      });

      objects.push(...cancelButton.objects);
    }

    modal.add(objects);
  }

  private closeItemInfo() {
    if (this.itemInfoContainer) {
      this.itemInfoContainer.destroy(true);
      this.itemInfoContainer = undefined;
    }

    this.isItemInfoOpen = false;
  }

  private restartInventory() {
    this.isItemInfoOpen = false;
    this.isDraggingInventory = false;
    this.didDragInventory = false;

    if (this.itemInfoContainer) {
      this.itemInfoContainer.destroy(true);
      this.itemInfoContainer = undefined;
    }

    this.scene.restart({
      inventoryScrollY: this.inventoryTargetScrollY,
      selectedCategory: this.selectedCategory,
      returnScene: this.returnScene,
    });
  }

  private getTotalMaterialsCount() {
    return Object.values(player.materials ?? {}).reduce((sum, amount) => {
      return sum + (amount ?? 0);
    }, 0);
  }

  private getMaterialIcon(tier: string) {
    if (tier === 'forge_core') return '◆';
    if (tier === 'medium') return '◇';
    if (tier === 'crystal') return '✦';

    return '•';
  }

  private getMaterialTierText(tier: string) {
    if (tier === 'small') return 'Малый материал для улучшений до +3';
    if (tier === 'medium') return 'Средний материал для улучшений до +5';
    if (tier === 'forge_core') return 'Главный материал для прокачки наковальни';
    if (tier === 'crystal') return 'Кристалл усиления';

    return 'Материал';
  }

  private createUiButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    accentColor: number;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
    depth?: number;
    small?: boolean;
  }) {
    const radius = Math.min(18, config.height / 2);
    const danger = config.danger ?? false;
    const disabled = config.disabled ?? false;
    const depth = config.depth ?? 40;

    const bgColor = disabled
      ? 0x151515
      : danger
        ? 0x2a1010
        : 0x17100c;

    const hoverColor = disabled
      ? bgColor
      : danger
        ? 0x3a1515
        : 0x2b1d13;

    const textColor = disabled
      ? '#555555'
      : danger
        ? '#ffb3b3'
        : UI.colors.goldText;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 4,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(depth);

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, disabled ? 0.7 : 0.96);
    bg.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    bg.lineStyle(2, config.accentColor, disabled ? 0.35 : 0.85);
    bg.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    bg.setDepth(depth + 1);

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: config.small ? '12px' : '16px',
      color: textColor,
      align: 'center',
      wordWrap: {
        width: config.width - 14,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(depth + 2);

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(depth + 3);

    if (!disabled) {
      zone.setInteractive({
        useHandCursor: true,
      });

      zone.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(hoverColor, 1);
        bg.fillRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          radius
        );
        bg.lineStyle(2, config.accentColor, 1);
        bg.strokeRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          radius
        );

        label.setColor(danger ? '#ffd0d0' : '#ffffff');
      });

      zone.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(bgColor, 0.96);
        bg.fillRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          radius
        );
        bg.lineStyle(2, config.accentColor, 0.85);
        bg.strokeRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          radius
        );

        label.setColor(textColor);
		bg.setAlpha(1);
		label.setY(config.y);
      });

      zone.on('pointerdown', () => {
	    bg.setAlpha(0.78);
	    label.setY(config.y + 1);
	  });
	  
	  zone.on('pointerup', () => {
	    bg.setAlpha(1);
	    label.setY(config.y);
	  
	    config.onClick();
	  });
	  
	  zone.on('pointerupoutside', () => {
	    bg.setAlpha(1);
	    label.setY(config.y);
	  });
    }

    return {
      objects: [shadow, bg, label, zone],
      zone,
    };
  }

  private createRoundedPanel(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: number;
    color?: number;
    alpha?: number;
    strokeColor?: number;
    strokeAlpha?: number;
    strokeWidth?: number;
    depth?: number;
  }) {
    const objects = this.createRoundedPanelAsObjects(config);

    return {
      shadow: objects[0],
      panel: objects[1],
    };
  }

  private createRoundedPanelAsObjects(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: number;
    color?: number;
    alpha?: number;
    strokeColor?: number;
    strokeAlpha?: number;
    strokeWidth?: number;
    depth?: number;
  }) {
    const radius = config.radius ?? 22;
    const color = config.color ?? 0x14100d;
    const alpha = config.alpha ?? 0.9;
    const strokeColor = config.strokeColor ?? UI.colors.goldDark;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const depth = config.depth ?? 1;

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const safeX = Phaser.Math.Clamp(
      config.x,
      safeWidth / 2 + 12,
      this.scale.width - safeWidth / 2 - 12
    );

    const safeY = Phaser.Math.Clamp(
      config.y,
      safeHeight / 2 + 12,
      this.scale.height - safeHeight / 2 - 12
    );

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(
      safeX - safeWidth / 2,
      safeY - safeHeight / 2 + 6,
      safeWidth,
      safeHeight,
      radius
    );
    shadow.setDepth(depth);

    const panel = this.add.graphics();
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(
      safeX - safeWidth / 2,
      safeY - safeHeight / 2,
      safeWidth,
      safeHeight,
      radius
    );

    panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    panel.strokeRoundedRect(
      safeX - safeWidth / 2,
      safeY - safeHeight / 2,
      safeWidth,
      safeHeight,
      radius
    );

    panel.setDepth(depth + 1);

    return [shadow, panel];
  }

  private createRoundedButtonBg(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: number;
    color?: number;
    alpha?: number;
    strokeColor?: number;
    strokeAlpha?: number;
    strokeWidth?: number;
    depth?: number;
  }) {
    const objects = this.createRoundedPanelAsObjects(config);
    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth((config.depth ?? 10) + 3)
      .setInteractive({
        useHandCursor: true,
      });

    return {
      shadow: objects[0],
      bg: objects[1],
      zone,
    };
  }

  private setObjectsAlpha(objects: Phaser.GameObjects.GameObject[], alpha: number) {
    objects.forEach(object => {
      const alphaObject = object as Phaser.GameObjects.GameObject & {
        setAlpha?: (alpha: number) => void;
      };

      alphaObject.setAlpha?.(alpha);
    });
  }
}
