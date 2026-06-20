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

type InventoryCategory = 'all' | 'weapon' | 'armor' | 'trinket' | 'ring' | 'potions' | 'materials';

const INVENTORY_DARK = {
  black: 0x030405,
  void: 0x060608,
  graphite: 0x0c0d10,
  stone: 0x121319,
  stoneLight: 0x1b1c24,
  brown: 0x18100c,
  bronze: 0x5e4630,
  gold: 0xb89a5e,
  goldSoft: 0xd8c088,
  ash: 0x9b978d,
  muted: '#9a9183',
  text: '#ded4bd',
  cold: 0x6f8fb4,
  violet: 0x6f5a91,
  red: 0x9d3a35,
};


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

  listHeaderTop: number;
  listHeaderHeight: number;

  itemsViewportTop: number;
  itemsViewportBottom: number;
  itemsViewportHeight: number;

  listTop: number;
  listBottom: number;
  listHeight: number;

  massSellButtonY: number;
  massSellButtonHeight: number;
  showMassSellButton: boolean;
  bottomNavSafeTop: number;

  actionButtonY: number;
};

export class InventoryScene extends Phaser.Scene {
  private isItemInfoOpen = false;

  private returnScene = 'CampScene';

  private itemInfoContainer?: Phaser.GameObjects.Container;

  private inventoryItemsLayer?: Phaser.GameObjects.Container;
  private inventoryMaskGraphics?: Phaser.GameObjects.Graphics;
  private inventoryGeometryMask?: Phaser.Display.Masks.GeometryMask;
  private inventoryScrollbarTrack?: Phaser.GameObjects.Rectangle;
  private inventoryScrollbarThumb?: Phaser.GameObjects.Rectangle;

  private inventoryViewportTop = 0;
  private inventoryViewportBottom = 0;
  private inventoryViewportHeight = 0;

  private inventoryScrollY = 0;
  private inventoryTargetScrollY = 0;
  private inventoryMaxScrollY = 0;

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
    this.inventoryItemsLayer = undefined;
    this.inventoryMaskGraphics = undefined;
    this.inventoryGeometryMask = undefined;
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

    this.cameras.main.fadeIn(260, 0, 0, 0);

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

    const compact = height < 1120;
    const veryCompact = height < 920;
    const ultraCompact = height < 740;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.018), 10, 24);
    const bottomNavSafeTop = this.returnScene === 'DungeonScene'
      ? height - 82
      : height - 106;
    const safeBottom = height - bottomNavSafeTop;

    const contentWidth = Math.min(width - safeX * 2, 640);

    const headerY = safeTop;

    const statsHeight = ultraCompact ? 74 : veryCompact ? 82 : compact ? 96 : 108;
    const statsY = safeTop + statsHeight / 2;

    const equipmentGap = ultraCompact ? 6 : veryCompact ? 8 : 10;
    const equipmentHeight = ultraCompact ? 118 : veryCompact ? 136 : compact ? 158 : 174;
    const equipmentY = statsY + statsHeight / 2 + equipmentGap + equipmentHeight / 2;

    const tabsGap = ultraCompact ? 7 : veryCompact ? 9 : 10;
    const tabHeight = ultraCompact ? 52 : veryCompact ? 56 : compact ? 62 : 68;
    const tabsY = equipmentY + equipmentHeight / 2 + tabsGap + tabHeight / 2;

    const tabsBottom = tabsY + tabHeight / 2;
    const listGap = ultraCompact ? 10 : 12;
    const listPanelTop = tabsBottom + listGap;
    const listPanelBottom = bottomNavSafeTop - (ultraCompact ? 6 : 8);
    const listPanelHeight = Math.max(150, listPanelBottom - listPanelTop);

    const showMassSellButton = this.selectedCategory !== 'potions' && this.selectedCategory !== 'materials';
    const massSellButtonHeight = ultraCompact ? 36 : compact ? 40 : 42;
    const massSellBottomPadding = ultraCompact ? 8 : 10;
    const massSellButtonY = listPanelBottom - massSellButtonHeight / 2 - massSellBottomPadding;

    const listHeaderTop = listPanelTop;
    const listHeaderHeight = ultraCompact ? 48 : veryCompact ? 52 : 58;
    const itemsViewportTop = listPanelTop + listHeaderHeight + (ultraCompact ? 8 : 10);
    const itemsViewportBottom = showMassSellButton
      ? massSellButtonY - massSellButtonHeight / 2 - (ultraCompact ? 10 : 14)
      : listPanelBottom - (ultraCompact ? 10 : 14);
    const itemsViewportHeight = Math.max(88, itemsViewportBottom - itemsViewportTop);

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

      listHeaderTop,
      listHeaderHeight,

      itemsViewportTop,
      itemsViewportBottom,
      itemsViewportHeight,

      listTop: itemsViewportTop,
      listBottom: itemsViewportBottom,
      listHeight: itemsViewportHeight,

      massSellButtonY,
      massSellButtonHeight,
      showMassSellButton,
      bottomNavSafeTop,

      actionButtonY: massSellButtonY,
    };
  }

  private createInventoryBackdrop(layout: InventoryLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, INVENTORY_DARK.black, 1).setDepth(0);
    this.add.rectangle(centerX, height * 0.34, width, height * 0.72, 0x0a0b12, 0.72).setDepth(0);
    this.add.rectangle(centerX, height - 210, width, 420, 0x020202, 0.5).setDepth(0);

    const haloY = layout.safeTop + Math.round(height * 0.17);
    this.add.circle(centerX, haloY, width * 0.5, INVENTORY_DARK.violet, 0.055).setDepth(0);
    this.add.circle(centerX, haloY + 18, width * 0.28, INVENTORY_DARK.gold, 0.035).setDepth(0);
    this.add.circle(centerX, haloY + 28, width * 0.16, INVENTORY_DARK.cold, 0.03).setDepth(0);

    const pillarWidth = Math.max(24, width * 0.075);
    const pillarAlpha = 0.22;

    [layout.safeX * 0.55, width - layout.safeX * 0.55].forEach((x, index) => {
      this.add.rectangle(x, height / 2, pillarWidth, height, 0x050608, pillarAlpha).setDepth(1);
      this.add.rectangle(x, height / 2, 2, height, INVENTORY_DARK.bronze, 0.16).setDepth(2);
      this.add.text(x, layout.safeTop + 120 + index * 34, '▥', {
        fontFamily: UI.font.body,
        fontSize: '42px',
        color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0.035).setDepth(2);
    });

    for (let i = 0; i < 24; i += 1) {
      const x = layout.safeX + 18 + i * ((width - layout.safeX * 2 - 36) / 23);
      const y = layout.safeTop + 92 + (i % 8) * 63;
      const size = 1.5 + (i % 3) * 0.8;

      this.add.circle(x, y, size, INVENTORY_DARK.goldSoft, 0.035 + (i % 2) * 0.012).setDepth(2);
    }

    this.add.text(centerX, layout.safeTop + 158, '☥', {
      fontFamily: UI.font.body,
      fontSize: '118px',
      color: '#ffffff',
    })
      .setOrigin(0.5)
      .setAlpha(0.026)
      .setDepth(1);
  }

  private createInventoryHeader(layout: InventoryLayout) {
    // Большой верхний заголовок убран по ТЗ.
    // Метод оставлен и вызывается только для совместимости структуры сцены.
    void layout;
  }

  private createQuickStatsPanel(layout: InventoryLayout) {
    const stats = getPlayerStats(player);
    const veryCompact = layout.height < 920;

    const panel = this.createRoundedPanel({
      x: layout.centerX,
      y: layout.statsY,
      width: layout.contentWidth,
      height: layout.statsHeight,
      radius: veryCompact ? 22 : 26,
      color: INVENTORY_DARK.stone,
      alpha: 0.94,
      strokeColor: INVENTORY_DARK.bronze,
      strokeAlpha: 0.44,
      strokeWidth: 2,
      depth: 2,
    });

    panel.shadow.setAlpha(0);
    panel.panel.setAlpha(0);

    this.tweens.add({
      targets: [panel.shadow, panel.panel],
      alpha: 1,
      duration: 230,
      delay: 60,
      ease: 'Sine.easeOut',
    });

    const left = layout.centerX - layout.contentWidth / 2;
    const top = layout.statsY - layout.statsHeight / 2;
    const paddingX = veryCompact ? 12 : 14;
    const paddingY = veryCompact ? 10 : 12;
    const gapX = veryCompact ? 8 : 10;
    const gapY = veryCompact ? 8 : 10;
    const chipWidth = (layout.contentWidth - paddingX * 2 - gapX) / 2;
    const chipHeight = (layout.statsHeight - paddingY * 2 - gapY) / 2;

    const chips = [
      { label: 'HP', value: `${player.hp}/${stats.maxHp}`, icon: '♥', color: INVENTORY_DARK.red },
      { label: 'Урон', value: `${stats.attack}`, icon: '⚔', color: INVENTORY_DARK.gold },
      { label: 'Броня', value: `${stats.defense}`, icon: '▣', color: INVENTORY_DARK.cold },
      { label: 'Золото', value: `${player.gold}`, icon: '◆', color: INVENTORY_DARK.gold },
    ];

    chips.forEach((chip, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = left + paddingX + chipWidth / 2 + column * (chipWidth + gapX);
      const y = top + paddingY + chipHeight / 2 + row * (chipHeight + gapY);

      this.createStatusChip(
        x,
        y,
        chipWidth,
        chipHeight,
        chip.label,
        chip.value,
        chip.icon,
        chip.color,
        index
      );
    });
  }

  private createStatusChip(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    icon: string,
    accentColor: number,
    index = 0
  ) {
    const radius = Math.min(18, height / 2);
    const objects = this.createRoundedPanelAsObjects({
      x,
      y,
      width,
      height,
      radius,
      color: 0x0b0d11,
      alpha: 0.96,
      strokeColor: accentColor,
      strokeAlpha: 0.38,
      strokeWidth: 1,
      depth: 4,
    });

    const iconX = x - width / 2 + Math.min(30, height * 0.58);
    const textX = x - width / 2 + Math.min(55, height * 0.96);
    const textWidth = Math.max(42, width - (textX - (x - width / 2)) - 8);

    const glow = this.add.circle(iconX, y, Math.min(17, height * 0.34), accentColor, 0.18)
      .setStrokeStyle(1, accentColor, 0.58)
      .setDepth(6);

    const iconText = this.add.text(iconX, y, icon, {
      fontFamily: UI.font.body,
      fontSize: height < 40 ? '12px' : '14px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7);

    const labelText = this.add.text(textX, y - height * 0.18, label, {
      fontFamily: UI.font.body,
      fontSize: height < 42 ? '9px' : '10px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: textWidth,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7);

    const valueText = this.add.text(textX, y + height * 0.18, value, {
      fontFamily: UI.font.title,
      fontSize: height < 42 ? '15px' : '17px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: textWidth,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7);

    const animatedObjects = [...objects, glow, iconText, labelText, valueText];
    this.setObjectsAlpha(animatedObjects, 0);

    this.tweens.add({
      targets: animatedObjects,
      alpha: 1,
      y: '+=0',
      duration: 210,
      delay: 100 + index * 45,
      ease: 'Sine.easeOut',
    });
  }



  private createEquipmentPanel(layout: InventoryLayout) {
    const veryCompact = layout.height < 920;
    const panelTop = layout.equipmentY - layout.equipmentHeight / 2;

    const panel = this.createRoundedPanel({
      x: layout.centerX,
      y: layout.equipmentY,
      width: layout.contentWidth,
      height: layout.equipmentHeight,
      radius: veryCompact ? 24 : 28,
      color: INVENTORY_DARK.brown,
      alpha: 0.94,
      strokeColor: INVENTORY_DARK.bronze,
      strokeAlpha: 0.56,
      strokeWidth: 2,
      depth: 2,
    });

    panel.shadow.setAlpha(0);
    panel.panel.setAlpha(0);

    this.tweens.add({
      targets: [panel.shadow, panel.panel],
      alpha: 1,
      scale: { from: 0.985, to: 1 },
      duration: 240,
      delay: 120,
      ease: 'Back.easeOut',
    });

    this.add.text(layout.centerX - layout.contentWidth / 2 + 22, panelTop + (veryCompact ? 20 : 24), 'Снаряжение', {
      fontFamily: UI.font.title,
      fontSize: veryCompact ? '18px' : layout.compact ? '20px' : '22px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'left',
      wordWrap: {
        width: layout.contentWidth - 44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);

    this.add.text(layout.centerX + layout.contentWidth / 2 - 22, panelTop + (veryCompact ? 20 : 24), 'нажми слот', {
      fontFamily: UI.font.body,
      fontSize: veryCompact ? '9px' : '10px',
      color: INVENTORY_DARK.muted,
      align: 'right',
      wordWrap: {
        width: 110,
      },
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(10);

    const slotGap = veryCompact ? 8 : 10;
    const slotWidth = (layout.contentWidth - 44 - slotGap) / 2;
    const startX = layout.centerX - slotWidth / 2 - slotGap / 2;
    const endX = layout.centerX + slotWidth / 2 + slotGap / 2;
    const slotHeight = veryCompact ? 46 : layout.compact ? 50 : 54;
    const rowGap = veryCompact ? 50 : 56;
    const firstRowY = panelTop + (veryCompact ? 66 : 74);
    const secondRowY = firstRowY + rowGap;

    this.createEquipmentSlotCard('weapon', startX, firstRowY, slotWidth, slotHeight, 0);
    this.createEquipmentSlotCard('armor', endX, firstRowY, slotWidth, slotHeight, 1);
    this.createEquipmentSlotCard('trinket', startX, secondRowY, slotWidth, slotHeight, 2);
    this.createEquipmentSlotCard('ring', endX, secondRowY, slotWidth, slotHeight, 3);
  }

  private createEquipmentSlotCard(slot: EquipmentSlot, x: number, y: number, width: number, height?: number, index = 0) {
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

    const cardHeight = height ?? (this.scale.height < 1120 ? 52 : 56);

    const objects = this.createRoundedPanelAsObjects({
      x,
      y,
      width,
      height: cardHeight,
      radius: Math.min(18, cardHeight / 2),
      color: item ? INVENTORY_DARK.stoneLight : INVENTORY_DARK.graphite,
      alpha: item ? 0.98 : 0.78,
      strokeColor: item ? rarityStrokeColor : UI.colors.goldDark,
      strokeAlpha: item ? 0.82 : 0.26,
      strokeWidth: item ? 2 : 1,
      depth: 4,
    });

    const left = x - width / 2;
    const iconX = left + Math.min(28, cardHeight * 0.58);
    const nameX = left + Math.min(54, cardHeight + 8);
    const nameWidth = Math.max(44, width - (nameX - left) - 10);

    const glow = this.add.circle(iconX, y, Math.min(17, cardHeight * 0.34), item ? rarityColor : 0x17100c, item ? 0.88 : 0.56)
      .setStrokeStyle(2, item ? rarityStrokeColor : UI.colors.goldDark, item ? 0.72 : 0.32)
      .setDepth(6);

    const icon = this.add.text(iconX, y, getSlotIcon(slot), {
      fontFamily: UI.font.body,
      fontSize: cardHeight < 50 ? '13px' : '15px',
      color: item ? '#ffffff' : UI.colors.textMuted,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7);

    const slotText = this.add.text(nameX, y - cardHeight * 0.18, slotName, {
      fontFamily: UI.font.body,
      fontSize: cardHeight < 50 ? '9px' : '10px',
      color: UI.colors.textMuted,
      align: 'left',
      wordWrap: {
        width: nameWidth,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7);

    const itemText = item && inventoryItem
      ? `${item.name}${inventoryItem.upgradeLevel > 0 ? ` +${inventoryItem.upgradeLevel}` : ''}`
      : 'Пусто';

    const itemLabel = this.add.text(nameX, y + cardHeight * 0.18, itemText, {
      fontFamily: UI.font.title,
      fontSize: item ? (cardHeight < 50 ? '10px' : '11px') : '12px',
      color: item ? UI.colors.goldText : UI.colors.textMuted,
      align: 'left',
      wordWrap: {
        width: nameWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
      stroke: '#000000',
      strokeThickness: item ? 2 : 0,
    }).setOrigin(0, 0.5).setDepth(7);

    const animatedObjects = [...objects, glow, icon, slotText, itemLabel];
    this.setObjectsAlpha(animatedObjects, 0);

    this.tweens.add({
      targets: animatedObjects,
      alpha: 1,
      duration: 230,
      delay: 150 + index * 45,
      ease: 'Sine.easeOut',
    });

    if (item) {
      this.tweens.add({
        targets: glow,
        alpha: {
          from: 0.58,
          to: 0.95,
        },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        delay: 420 + index * 90,
        ease: 'Sine.easeInOut',
      });
    }

    if (!item || !inventoryItem) {
      return;
    }

    const zone = this.add.zone(x, y, width, cardHeight)
      .setDepth(30)
      .setInteractive({
        useHandCursor: true,
      });

    zone.on('pointerdown', () => {
      objects[1].setAlpha(0.78);
    });

    zone.on('pointerup', () => {
      objects[1].setAlpha(1);

      if (this.isItemInfoOpen) {
        return;
      }

      this.showUnequipConfirm(slot, inventoryItem);
    });

    zone.on('pointerout', () => {
      objects[1].setAlpha(1);
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
      { id: 'armor', label: 'Броня', icon: '▣' },
      { id: 'trinket', label: 'Амул.', icon: '☥' },
      { id: 'ring', label: 'Кольца', icon: '◈' },
      { id: 'potions', label: 'Зелья', icon: '✚' },
      { id: 'materials', label: 'Мат.', icon: '◇' },
    ];

    const columns = 4;
    const gapX = 6;
    const gapY = 6;
    const tabButtonHeight = layout.height < 920 ? 26 : layout.compact ? 29 : 31;
    const tabWidth = (layout.contentWidth - gapX * (columns - 1)) / columns;
    const startX = layout.centerX - layout.contentWidth / 2 + tabWidth / 2;
    const startY = layout.tabsY - (tabButtonHeight + gapY) / 2;

    tabs.forEach((tab, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (tabWidth + gapX);
      const y = startY + row * (tabButtonHeight + gapY);
      const isActive = this.selectedCategory === tab.id;

      const tabBg = this.createRoundedButtonBg({
        x,
        y,
        width: tabWidth,
        height: tabButtonHeight,
        radius: 12,
        color: isActive ? 0x2c1d13 : 0x11100e,
        alpha: isActive ? 0.98 : 0.76,
        strokeColor: isActive ? UI.colors.gold : UI.colors.goldDark,
        strokeAlpha: isActive ? 0.95 : 0.34,
        strokeWidth: isActive ? 2 : 1,
        depth: 80,
      });

      tabBg.shadow.setAlpha(0);
      tabBg.bg.setAlpha(0);

      const icon = this.add.text(x - tabWidth * 0.27, y, tab.icon, {
        fontFamily: UI.font.body,
        fontSize: layout.contentWidth < 390 ? '10px' : '12px',
        color: isActive ? UI.colors.goldText : UI.colors.textMuted,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(83).setAlpha(0);

      const label = this.add.text(x - tabWidth * 0.08, y, tab.label, {
        fontFamily: UI.font.body,
        fontSize: layout.contentWidth < 390 ? '8px' : '9px',
        color: isActive ? UI.colors.goldText : UI.colors.textMuted,
        align: 'left',
        wordWrap: {
          width: tabWidth * 0.68,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(83).setAlpha(0);

      this.tweens.add({
        targets: [tabBg.shadow, tabBg.bg, icon, label],
        alpha: 1,
        duration: 180,
        delay: 200 + index * 25,
        ease: 'Sine.easeOut',
      });

      if (isActive) {
        this.tweens.add({
          targets: tabBg.bg,
          alpha: {
            from: 0.82,
            to: 1,
          },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      tabBg.zone.on('pointerover', () => {
        if (isActive) {
          return;
        }

        icon.setColor(UI.colors.goldText);
        label.setColor(UI.colors.goldText);
        tabBg.bg.setAlpha(0.95);
      });

      tabBg.zone.on('pointerout', () => {
        if (isActive) {
          return;
        }

        icon.setColor(UI.colors.textMuted);
        label.setColor(UI.colors.textMuted);
        tabBg.bg.setAlpha(1);
      });

      tabBg.zone.on('pointerdown', () => {
        tabBg.bg.setAlpha(0.78);
      });

      tabBg.zone.on('pointerup', () => {
        tabBg.bg.setAlpha(isActive ? 1 : 0.95);

        if (this.selectedCategory === tab.id) {
          return;
        }

        this.selectedCategory = tab.id;
        this.inventoryScrollY = 0;
        this.inventoryTargetScrollY = 0;
        this.initialInventoryScrollY = 0;

        this.scene.restart({
          returnScene: this.returnScene,
          selectedCategory: tab.id,
          inventoryScrollY: 0,
        });
      });

      tabBg.zone.on('pointerupoutside', () => {
        tabBg.bg.setAlpha(isActive ? 1 : 0.76);
      });
    });
  }

  private createInventoryList(layout: InventoryLayout) {
    this.inventoryItemsLayer?.destroy(true);
    this.inventoryMaskGraphics?.destroy();
    this.inventoryScrollbarTrack?.destroy();
    this.inventoryScrollbarThumb?.destroy();
    this.inventoryGeometryMask = undefined;

    this.inventoryViewportTop = layout.itemsViewportTop;
    this.inventoryViewportBottom = layout.itemsViewportBottom;
    this.inventoryViewportHeight = Math.max(1, layout.itemsViewportHeight);

    this.createRoundedPanel({
      x: layout.centerX,
      y: layout.listPanelTop + layout.listPanelHeight / 2,
      width: layout.contentWidth,
      height: layout.listPanelHeight,
      radius: 30,
      color: INVENTORY_DARK.graphite,
      alpha: 0.96,
      strokeColor: INVENTORY_DARK.bronze,
      strokeAlpha: 0.58,
      depth: 20,
    });

    const title = this.getCategoryTitle();
    const counter = this.getCategoryCounter();
    const listHeaderDepth = 90;
    const headerY = layout.listHeaderTop + Math.min(30, layout.listHeaderHeight * 0.48);

    this.add.text(layout.centerX - layout.contentWidth / 2 + 24, headerY, title, {
      fontFamily: UI.font.title,
      fontSize: layout.height < 740 ? '18px' : layout.compact ? '21px' : '24px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: layout.contentWidth - 170,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(listHeaderDepth);

    this.add.text(layout.centerX + layout.contentWidth / 2 - 24, headerY, counter, {
      fontFamily: UI.font.body,
      fontSize: layout.height < 740 ? '11px' : '13px',
      color: INVENTORY_DARK.muted,
      align: 'right',
      wordWrap: {
        width: 120,
      },
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(listHeaderDepth);

    if (layout.listHeaderHeight >= 54) {
      this.add.text(layout.centerX, layout.listHeaderTop + layout.listHeaderHeight - 13, 'Редкость: божественная → обычная', {
        fontFamily: UI.font.body,
        fontSize: '10px',
        color: '#716a60',
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 68,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(listHeaderDepth);
    }

    const viewportLeft = layout.centerX - layout.contentWidth / 2 + 18;
    const viewportWidth = layout.contentWidth - 36;

    const maskGraphics = this.add.graphics();
    this.inventoryMaskGraphics = maskGraphics;
    maskGraphics.setVisible(false);
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.fillRect(
      viewportLeft,
      this.inventoryViewportTop,
      viewportWidth,
      this.inventoryViewportHeight
    );

    this.inventoryGeometryMask = maskGraphics.createGeometryMask();
    this.inventoryItemsLayer = this.add.container(0, this.inventoryViewportTop).setDepth(40);
    this.inventoryItemsLayer.setMask(this.inventoryGeometryMask);

    this.inventoryScrollY = this.initialInventoryScrollY;
    this.inventoryTargetScrollY = this.initialInventoryScrollY;
    this.inventoryLastRenderedScrollY = -1;

    const contentHeight = this.getInventoryContentHeight(layout);

    this.inventoryMaxScrollY = Math.max(
      0,
      contentHeight - this.inventoryViewportHeight
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

    this.updateInventoryLayerPosition();
    this.createInventoryScrollbar(layout);
    this.updateInventoryScrollbar(layout);

    this.renderInventoryContent(layout);
    this.createInventoryTouchScrollHandlers(layout);

    this.input.off('wheel');

    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        if (this.inventoryMaxScrollY <= 0 || this.isItemInfoOpen) {
          return;
        }

        if (!this.isPointerInsideInventoryList(pointer, layout)) {
          return;
        }

        this.inventoryTargetScrollY = Phaser.Math.Clamp(
          this.inventoryTargetScrollY + deltaY * 0.45,
          0,
          this.inventoryMaxScrollY
        );

        this.updateInventoryScrollbar(layout);
      }
    );

    if (layout.showMassSellButton) {
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
    if (this.selectedCategory === 'ring') return 'Божественные кольца';

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
    const itemCategories: InventoryCategory[] = ['weapon', 'armor', 'trinket', 'ring'];

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
    if (rarity === 'divine') return 6;

    return 0;
  }

  private getVisibleMaterials() {
    return materials.filter(material => {
      return (player.materials?.[material.id] ?? 0) > 0;
    });
  }

  private getInventoryContentHeight(layout: InventoryLayout) {
    const topPadding = layout.height < 740 ? 10 : 14;
    const bottomPadding = layout.height < 740 ? 12 : 18;

    if (this.selectedCategory === 'potions') {
      return topPadding + 170 + bottomPadding;
    }

    if (this.selectedCategory === 'materials') {
      const count = Math.max(1, this.getVisibleMaterials().length);
      const spacing = layout.height < 740 ? 84 : 92;
      return topPadding + count * spacing - (spacing - 78) + bottomPadding;
    }

    const count = Math.max(1, this.getFilteredInventoryItems().length);
    const cardHeight = layout.height < 740 ? 88 : layout.compact ? 96 : 104;
    const spacing = cardHeight + (layout.height < 740 ? 8 : 12);

    return topPadding + count * spacing - (spacing - cardHeight) + bottomPadding;
  }

  private renderInventoryContent(layout: InventoryLayout) {
    if (!this.inventoryItemsLayer) {
      return;
    }

    this.inventoryItemsLayer.removeAll(true);

    if (this.selectedCategory === 'potions') {
      this.renderPotionCategory(layout);
      this.inventoryLastRenderedScrollY = this.inventoryScrollY;
      this.updateInventoryLayerPosition();
      return;
    }

    if (this.selectedCategory === 'materials') {
      this.renderMaterialsCategory(layout);
      this.inventoryLastRenderedScrollY = this.inventoryScrollY;
      this.updateInventoryLayerPosition();
      return;
    }

    this.renderItemCategory(layout);
    this.inventoryLastRenderedScrollY = this.inventoryScrollY;
    this.updateInventoryLayerPosition();
  }

  private renderItemCategory(layout: InventoryLayout) {
    const filteredItems = this.getFilteredInventoryItems();

    if (player.inventory.length === 0) {
      this.createEmptyState(
        layout,
        'В сумке пока нет предметов.\nИх можно найти в катакомбах или купить в лавке.'
      );
      return;
    }

    if (filteredItems.length === 0) {
      this.createEmptyState(
        layout,
        'В этой категории пока нет предметов.'
      );
      return;
    }

    const cardHeight = layout.height < 740 ? 88 : layout.compact ? 96 : 104;
    const itemSpacing = cardHeight + (layout.height < 740 ? 8 : 12);
    const cardHalfHeight = cardHeight / 2;
    const topPadding = layout.height < 740 ? 10 : 14;
    const renderBuffer = 120;

    filteredItems.forEach((inventoryItem, index) => {
      const localY = topPadding + cardHalfHeight + index * itemSpacing;
      const worldY = this.inventoryViewportTop + localY - this.inventoryScrollY;

      if (worldY + cardHalfHeight < this.inventoryViewportTop - renderBuffer) {
        return;
      }

      if (worldY - cardHalfHeight > this.inventoryViewportBottom + renderBuffer) {
        return;
      }

      this.createInventoryItemCard(layout, inventoryItem, localY, cardHeight);
    });
  }

  private renderPotionCategory(layout: InventoryLayout) {
    const stats = getPlayerStats(player);
    const canUsePotion = player.potions > 0 && player.hp < stats.maxHp;

    const cardWidth = layout.contentWidth - 70;
    const cardHeight = 170;
    const localY = 14 + cardHeight / 2;
    const worldY = this.inventoryViewportTop + localY - this.inventoryScrollY;

    if (worldY + cardHeight / 2 < this.inventoryViewportTop - 120) {
      return;
    }

    if (worldY - cardHeight / 2 > this.inventoryViewportBottom + 120) {
      return;
    }

    if (!this.inventoryItemsLayer) {
      return;
    }

    const card = this.add.container(layout.centerX, localY).setDepth(0);
    const objects: Phaser.GameObjects.GameObject[] = [];

    objects.push(
      ...this.createLocalRoundedPanelAsObjects({
        x: 0,
        y: 0,
        width: cardWidth,
        height: cardHeight,
        radius: 26,
        color: INVENTORY_DARK.stone,
        alpha: 0.96,
        strokeColor: UI.colors.goldDark,
        strokeAlpha: 0.65,
        strokeWidth: 2,
        depth: 0,
      })
    );

    const left = -cardWidth / 2;

    objects.push(
      this.add.circle(left + 50, -37, 34, 0x2a1d13, 1)
        .setStrokeStyle(2, UI.colors.goldDark, 0.75)
        .setDepth(4)
    );

    objects.push(
      this.add.text(left + 50, -37, '✚', {
        fontFamily: UI.font.body,
        fontSize: '28px',
        color: UI.colors.goldText,
      }).setOrigin(0.5).setDepth(5)
    );

    objects.push(
      this.add.text(left + 96, -58, 'Зелье здоровья', {
        fontFamily: UI.font.title,
        fontSize: '22px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: cardWidth - 120,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(5)
    );

    objects.push(
      this.add.text(left + 96, -25, `Количество: ${player.potions}`, {
        fontFamily: UI.font.body,
        fontSize: '16px',
        color: UI.colors.text,
        wordWrap: {
          width: cardWidth - 120,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(5)
    );

    objects.push(
      this.add.text(left + 96, 5, 'Восстанавливает 35% максимального HP.', {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: cardWidth - 120,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(5)
    );

    objects.push(
      this.add.text(left + 96, 34, `HP: ${player.hp}/${stats.maxHp}`, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: canUsePotion ? UI.colors.green : UI.colors.textMuted,
        wordWrap: {
          width: cardWidth - 120,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(5)
    );

    const button = this.createUiButton({
      x: 0,
      y: 72,
      width: Math.min(cardWidth - 58, 430),
      height: 46,
      text: canUsePotion ? 'Выпить зелье' : 'Нельзя использовать',
      accentColor: INVENTORY_DARK.cold,
      disabled: !canUsePotion,
      onClick: () => {
        if (this.didDragInventory) {
          return;
        }

        this.usePotionOutsideBattle();
      },
      depth: 6,
    });

    objects.push(...button.objects);
    card.add(objects);
    this.applyInventoryMask([card, ...objects]);
    this.inventoryItemsLayer.add(card);
  }

  private renderMaterialsCategory(layout: InventoryLayout) {
    const visibleMaterials = this.getVisibleMaterials();

    if (visibleMaterials.length === 0) {
      this.createEmptyState(
        layout,
        'Материалов пока нет.\nИх можно получить с монстров, элиты, мини-боссов и Морвеина.'
      );
      return;
    }

    const cardHeight = 78;
    const cardHalfHeight = cardHeight / 2;
    const spacing = layout.height < 740 ? 84 : 92;
    const topPadding = layout.height < 740 ? 10 : 14;
    const renderBuffer = 120;

    visibleMaterials.forEach((material, index) => {
      const localY = topPadding + cardHalfHeight + index * spacing;
      const worldY = this.inventoryViewportTop + localY - this.inventoryScrollY;

      if (worldY + cardHalfHeight < this.inventoryViewportTop - renderBuffer) {
        return;
      }

      if (worldY - cardHalfHeight > this.inventoryViewportBottom + renderBuffer) {
        return;
      }

      this.createMaterialCard(layout, material.id, localY);
    });
  }

  private createEmptyState(
    layout: InventoryLayout,
    text: string
  ) {
    if (!this.inventoryItemsLayer) {
      return;
    }

    const card = this.add.container(layout.centerX, Math.max(72, this.inventoryViewportHeight / 2));
    const objects: Phaser.GameObjects.GameObject[] = [];

    objects.push(
      this.add.text(0, -42, '◇', {
        fontFamily: UI.font.body,
        fontSize: '34px',
        color: UI.colors.textMuted,
      }).setOrigin(0.5).setDepth(5)
    );

    objects.push(
      this.add.text(0, 20, text, {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: UI.colors.textMuted,
        align: 'center',
        lineSpacing: 6,
        wordWrap: {
          width: layout.contentWidth - 80,
        },
      }).setOrigin(0.5).setDepth(5)
    );

    card.add(objects);
    this.applyInventoryMask([card, ...objects]);
    this.inventoryItemsLayer.add(card);
  }

  private createMaterialCard(
    layout: InventoryLayout,
    materialId: string,
    localY: number
  ) {
    const material = materials.find(item => item.id === materialId);

    if (!material || !this.inventoryItemsLayer) {
      return;
    }

    const amount = player.materials?.[material.id] ?? 0;

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

    const card = this.add.container(layout.centerX, localY).setDepth(0);
    const objects: Phaser.GameObjects.GameObject[] = [
      ...this.createLocalRoundedPanelAsObjects({
        x: 0,
        y: 0,
        width: cardWidth,
        height: cardHeight,
        radius: 20,
        color: INVENTORY_DARK.stone,
        alpha: 0.96,
        strokeColor: color,
        strokeAlpha: 0.55,
        strokeWidth: 2,
        depth: 0,
      }),
    ];

    const left = -cardWidth / 2;
    const right = cardWidth / 2;

    objects.push(
      this.add.circle(left + 36, 0, 24, color, 0.16)
        .setStrokeStyle(1, color, 0.65)
        .setDepth(4)
    );

    objects.push(
      this.add.text(left + 36, 0, this.getMaterialIcon(material.tier), {
        fontFamily: UI.font.body,
        fontSize: '19px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(5)
    );

    objects.push(
      this.add.text(left + 74, -16, material.name, {
        fontFamily: UI.font.title,
        fontSize: '17px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: cardWidth - 150,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(5)
    );

    objects.push(
      this.add.text(left + 74, 13, this.getMaterialTierText(material.tier), {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: cardWidth - 150,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(5)
    );

    objects.push(
      this.add.text(right - 22, 0, `x${amount}`, {
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
      }).setOrigin(1, 0.5).setDepth(5)
    );

    card.add(objects);
    this.applyInventoryMask([card, ...objects]);
    this.inventoryItemsLayer.add(card);
  }

  private createInventoryItemCard(
    layout: InventoryLayout,
    inventoryItem: InventoryItem,
    localY: number,
    cardHeight: number
  ) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item || !this.inventoryItemsLayer) {
      return;
    }

    const upgrade =
      inventoryItem.upgradeLevel > 0
        ? ` +${inventoryItem.upgradeLevel}`
        : '';

    const isEquipped = isItemEquipped(player, inventoryItem.instanceId);

    const rarityColor = getRarityColorHex(item);
    const rarityStrokeColor = getRarityStrokeColor(item);

    const cardWidth = layout.contentWidth - 70;
    const card = this.add.container(layout.centerX, localY).setDepth(0);

    const cardObjects: Phaser.GameObjects.GameObject[] = [
      ...this.createLocalRoundedPanelAsObjects({
        x: 0,
        y: 0,
        width: cardWidth,
        height: cardHeight,
        radius: 20,
        color: isEquipped ? 0x231b13 : INVENTORY_DARK.stone,
        alpha: isEquipped ? 0.98 : 0.95,
        strokeColor: isEquipped ? UI.colors.gold : rarityStrokeColor,
        strokeAlpha: isEquipped ? 0.95 : 0.68,
        strokeWidth: isEquipped ? 2 : 1,
        depth: 0,
      }),
    ];

    const left = -cardWidth / 2;
    const iconX = left + 39;
    const textX = left + 76;
    const buttonWidth = Math.min(94, Math.max(76, cardWidth * 0.18));
    const buttonX = cardWidth / 2 - buttonWidth / 2 - 16;
    const textWidth = Math.max(120, cardWidth - 76 - buttonWidth - 34);

    let actionButtonPressed = false;

    const cardZone = this.add.zone(0, 0, cardWidth, cardHeight)
      .setDepth(7)
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
      this.add.circle(iconX, 0, 27, rarityColor, 0.18).setDepth(2)
    );

    cardObjects.push(
      this.add.circle(iconX, 0, 22, rarityColor, 0.92)
        .setStrokeStyle(2, rarityStrokeColor, 0.85)
        .setDepth(3)
    );

    cardObjects.push(
      this.add.text(iconX, 0, getSlotIcon(item.slot), {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(4)
    );

    cardObjects.push(
      this.add.text(textX, -28, `${item.name}${upgrade}`, {
        fontFamily: UI.font.title,
        fontSize: '15px',
        color: isEquipped ? UI.colors.goldText : UI.colors.text,
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(4)
    );

    cardObjects.push(
      this.add.text(
        textX,
        1,
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
      ).setOrigin(0, 0.5).setDepth(4)
    );

    cardObjects.push(
      this.add.text(textX, 24, createItemStatsText(inventoryItem) || 'Без бонусов', {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(4)
    );

    const equipButton = this.createUiButton({
      x: buttonX,
      y: -22,
      width: buttonWidth,
      height: 38,
      text: isEquipped ? 'Надето' : 'Надеть',
      accentColor: INVENTORY_DARK.cold,
      disabled: isEquipped,
      onClick: () => {
        actionButtonPressed = true;

        if (this.isItemInfoOpen || isEquipped || this.didDragInventory) {
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
      depth: 8,
      small: true,
    });

    const sellButton = this.createUiButton({
      x: buttonX,
      y: 24,
      width: buttonWidth,
      height: 38,
      text: 'Продать',
      accentColor: UI.colors.redHex,
      danger: true,
      disabled: isEquipped,
      onClick: () => {
        actionButtonPressed = true;

        if (this.isItemInfoOpen || isEquipped || this.didDragInventory) {
          return;
        }

        this.showSellConfirm(inventoryItem);
      },
      depth: 8,
      small: true,
    });

    cardObjects.push(...equipButton.objects, ...sellButton.objects);

    card.add(cardObjects);
    this.applyInventoryMask([card, ...cardObjects]);
    this.inventoryItemsLayer.add(card);
  }

  private createMassSellButton(layout: InventoryLayout) {
    if (!layout.showMassSellButton) {
      return;
    }

    this.createUiButton({
      x: layout.centerX,
      y: layout.massSellButtonY,
      width: Math.min(layout.contentWidth - 92, 420),
      height: layout.massSellButtonHeight,
      text: 'Сдать обычный хлам',
      accentColor: UI.colors.redHex,
      danger: true,
      onClick: () => {
        this.showMassSellConfirm();
      },
      depth: 120,
    });
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


  private hasSetMask(object: Phaser.GameObjects.GameObject): object is Phaser.GameObjects.GameObject & {
    setMask: (mask: Phaser.Display.Masks.GeometryMask) => unknown;
  } {
    return typeof (object as { setMask?: unknown }).setMask === 'function';
  }

  private applyInventoryMask(objects: Phaser.GameObjects.GameObject[]) {
    if (!this.inventoryGeometryMask) {
      return;
    }

    objects.forEach(object => {
      if (this.hasSetMask(object)) {
        object.setMask(this.inventoryGeometryMask as Phaser.Display.Masks.GeometryMask);
      }
    });
  }

  private updateInventoryLayerPosition() {
    if (!this.inventoryItemsLayer) {
      return;
    }

    this.inventoryItemsLayer.setY(this.inventoryViewportTop - this.inventoryScrollY);
  }

  private createLocalRoundedPanelAsObjects(config: {
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
    const color = config.color ?? INVENTORY_DARK.stone;
    const alpha = config.alpha ?? 0.9;
    const strokeColor = config.strokeColor ?? INVENTORY_DARK.bronze;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const depth = config.depth ?? 1;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 6,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(depth);

    const panel = this.add.graphics();
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    panel.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );
    panel.setDepth(depth + 1);

    return [shadow, panel];
  }

  private createInventoryScrollbar(layout: InventoryLayout) {
    this.inventoryScrollbarTrack?.destroy();
    this.inventoryScrollbarThumb?.destroy();

    const trackTop = this.inventoryViewportTop + 6;
    const trackBottom = this.inventoryViewportBottom - 6;
    const trackHeight = Math.max(36, trackBottom - trackTop);
    const x = layout.centerX + layout.contentWidth / 2 - 13;
    const y = trackTop + trackHeight / 2;

    this.inventoryScrollbarTrack = this.add.rectangle(
      x,
      y,
      4,
      trackHeight,
      0x17110d,
      0.72
    ).setDepth(100);

    this.inventoryScrollbarThumb = this.add.rectangle(
      x,
      trackTop + 12,
      5,
      24,
      INVENTORY_DARK.gold,
      0.92
    ).setDepth(101);
  }

  private updateInventoryScrollbar(layout: InventoryLayout) {
    if (!this.inventoryScrollbarTrack || !this.inventoryScrollbarThumb) {
      return;
    }

    if (this.inventoryMaxScrollY <= 0) {
      this.inventoryScrollbarTrack.setVisible(false);
      this.inventoryScrollbarThumb.setVisible(false);
      return;
    }

    this.inventoryScrollbarTrack.setVisible(true);
    this.inventoryScrollbarThumb.setVisible(true);

    const trackTop = this.inventoryViewportTop + 6;
    const trackBottom = this.inventoryViewportBottom - 6;
    const trackHeight = Math.max(36, trackBottom - trackTop);
    const contentHeight = this.inventoryViewportHeight + this.inventoryMaxScrollY;
    const thumbHeight = Phaser.Math.Clamp(
      (this.inventoryViewportHeight / Math.max(1, contentHeight)) * trackHeight,
      22,
      trackHeight
    );

    const progress = this.inventoryTargetScrollY / Math.max(1, this.inventoryMaxScrollY);
    const y = trackTop + thumbHeight / 2 + (trackHeight - thumbHeight) * progress;

    const x = layout.centerX + layout.contentWidth / 2 - 13;

    this.inventoryScrollbarTrack.setPosition(x, trackTop + trackHeight / 2);
    this.inventoryScrollbarTrack.setSize(4, trackHeight);
    this.inventoryScrollbarThumb.setPosition(x, y);
    this.inventoryScrollbarThumb.setSize(5, thumbHeight);
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
      this.updateInventoryLayerPosition();
      this.renderInventoryContent(layout);
      this.updateInventoryScrollbar(layout);
    });

    this.input.on('pointerup', () => {
      this.isDraggingInventory = false;

      this.time.delayedCall(80, () => {
        this.didDragInventory = false;
      });
    });

    this.input.on('pointerupoutside', () => {
      this.isDraggingInventory = false;

      this.time.delayedCall(80, () => {
        this.didDragInventory = false;
      });
    });
  }

  private isPointerInsideInventoryList(
    pointer: Phaser.Input.Pointer,
    layout: InventoryLayout
  ) {
    const left = layout.centerX - layout.contentWidth / 2 + 18;
    const right = layout.centerX + layout.contentWidth / 2 - 18;

    return (
      pointer.x >= left &&
      pointer.x <= right &&
      pointer.y >= this.inventoryViewportTop &&
      pointer.y <= this.inventoryViewportBottom
    );
  }

  update() {
    const layout = this.getLayout();

    if (!this.inventoryItemsLayer || this.isItemInfoOpen || this.isDraggingInventory) {
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

    this.updateInventoryLayerPosition();

    const scrollChanged = Math.abs(oldScrollY - this.inventoryScrollY) > 0.25;
    const renderChanged =
      Math.abs(this.inventoryLastRenderedScrollY - this.inventoryScrollY) > 0.75;

    if (scrollChanged && renderChanged) {
      this.renderInventoryContent(layout);
      this.updateInventoryScrollbar(layout);
      return;
    }

    if (scrollChanged) {
      this.updateInventoryScrollbar(layout);
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
      0.78
    ).setInteractive();

    const panelWidth = Math.min(layout.contentWidth, 620);
    const panelHeight = Math.min(700, layout.height - layout.safeTop - layout.safeBottom - 24);
    const panelY = layout.height / 2;

    const panelObjects = this.createRoundedPanelAsObjects({
      x: layout.centerX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius: 30,
      color: INVENTORY_DARK.graphite,
      alpha: 0.99,
      strokeColor: rarityStrokeColor,
      strokeAlpha: 0.82,
      strokeWidth: 3,
      depth: 1001,
    });

    const top = panelY - panelHeight / 2;
    const bottom = panelY + panelHeight / 2;
    const actionsTop = bottom - 176;
    const iconY = top + 52;
    const titleY = top + 108;
    const typeY = top + 154;
    const descriptionY = Math.min(top + 214, actionsTop - 220);
    const statsY = Math.min(top + 348, actionsTop - 84);

    const iconBg = this.add.circle(
      layout.centerX,
      iconY,
      32,
      rarityColor,
      0.88
    ).setStrokeStyle(3, rarityStrokeColor, 0.95);

    const icon = this.add.text(layout.centerX, iconY, getSlotIcon(item.slot), {
      fontFamily: UI.font.body,
      fontSize: '26px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    const title = this.add.text(
      layout.centerX,
      titleY,
      `${item.name}${upgrade}`,
      {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '21px' : '24px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: panelWidth - 70,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }
    ).setOrigin(0.5);

    const typeText = this.add.text(
      layout.centerX,
      typeY,
      `${itemTypeText} • ${getRarityText(item)}`,
      {
        fontFamily: UI.font.body,
        fontSize: '15px',
        color: INVENTORY_DARK.muted,
        align: 'center',
        wordWrap: {
          width: panelWidth - 70,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }
    ).setOrigin(0.5);

    const description = this.add.text(
      layout.centerX,
      descriptionY,
      item.description,
      {
        fontFamily: UI.font.body,
        fontSize: layout.compact ? '13px' : '15px',
        color: INVENTORY_DARK.text,
        align: 'center',
        lineSpacing: 4,
        wordWrap: {
          width: panelWidth - 82,
          useAdvancedWrap: true,
        },
        maxLines: layout.compact ? 3 : 4,
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
      statsY,
      statsLines.join('\n'),
      {
        fontFamily: UI.font.body,
        fontSize: layout.compact ? '11px' : '12px',
        color: UI.colors.goldText,
        align: 'center',
        lineSpacing: 3,
        wordWrap: {
          width: panelWidth - 86,
          useAdvancedWrap: true,
        },
        maxLines: layout.compact ? 10 : 12,
      }
    ).setOrigin(0.5);

    const buttonWidth = Math.min(panelWidth - 150, 360);
    const equipButton = this.createUiButton({
      x: layout.centerX,
      y: bottom - 150,
      width: buttonWidth,
      height: 48,
      text: equipped ? 'Уже надето' : 'Надеть',
      accentColor: INVENTORY_DARK.cold,
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
      accentColor: INVENTORY_DARK.red,
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
      accentColor: INVENTORY_DARK.gold,
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
        energy: 0,
        attack: 0,
        defense: 0,
        critChance: 0,
        agility: 0,
        luck: 0,
        strength: 0,
        intelligence: 0,
      };
    }

    return {
      hp: (item.bonusHp ?? 0) + upgradeLevel * 4,
      energy: item.bonusEnergy ?? 0,
      attack: (item.bonusAttack ?? 0) + upgradeLevel * 2,
      defense: (item.bonusDefense ?? 0) + upgradeLevel,
      critChance: (item.bonusCritChance ?? 0) + upgradeLevel * 0.005,
      agility: item.bonusAgility ?? 0,
      luck: item.bonusLuck ?? 0,
      strength: item.bonusStrength ?? 0,
      intelligence: item.bonusIntelligence ?? 0,
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

    const rows = [
      this.createComparisonLine('HP', selectedBonus.hp, equippedBonus.hp),
      this.createComparisonLine('Энергия', selectedBonus.energy, equippedBonus.energy),
      this.createComparisonLine('Атака', selectedBonus.attack, equippedBonus.attack),
      this.createComparisonLine('Защита', selectedBonus.defense, equippedBonus.defense),
      this.createComparisonLine('Крит', selectedBonus.critChance, equippedBonus.critChance, true),
      this.createComparisonLine('Ловкость', selectedBonus.agility, equippedBonus.agility),
      this.createComparisonLine('Удача', selectedBonus.luck, equippedBonus.luck),
      this.createComparisonLine('Сила', selectedBonus.strength, equippedBonus.strength),
      this.createComparisonLine('Интеллект', selectedBonus.intelligence, equippedBonus.intelligence),
    ].filter(line => !line.endsWith('(0)') && !line.endsWith('(0%)'));

    if (rows.length === 0) {
      rows.push('Разницы по характеристикам нет.');
    }

    return [
      `Сравнение с надетым: ${equippedItem.name}${equippedUpgrade}`,
      ...rows.slice(0, 6),
    ].join('\n');
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
      color: INVENTORY_DARK.stone,
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
    return Object.values(player.materials ?? {}).reduce((sum: number, amount) => {
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
      ? 0x101114
      : danger
        ? 0x211013
        : INVENTORY_DARK.stone;

    const hoverColor = disabled
      ? bgColor
      : danger
        ? 0x32151a
        : 0x221a13;

    const textColor = disabled
      ? '#5f5b53'
      : danger
        ? '#d8a5a0'
        : UI.colors.goldText;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.36);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 4,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(depth);

    const bg = this.add.graphics();
    const drawBg = (color: number, alpha: number, strokeAlpha: number) => {
      bg.clear();
      bg.fillStyle(color, alpha);
      bg.fillRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );
      bg.lineStyle(2, config.accentColor, strokeAlpha);
      bg.strokeRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );
    };

    drawBg(bgColor, disabled ? 0.68 : 0.96, disabled ? 0.28 : 0.74);
    bg.setDepth(depth + 1);

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: config.small ? '12px' : '16px',
      color: textColor,
      align: 'center',
      wordWrap: {
        width: config.width - 16,
        useAdvancedWrap: true,
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
        drawBg(hoverColor, 1, 0.95);
        label.setColor(danger ? '#efd0cc' : '#ffffff');
      });

      zone.on('pointerout', () => {
        drawBg(bgColor, 0.96, 0.74);
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
    const color = config.color ?? INVENTORY_DARK.stone;
    const alpha = config.alpha ?? 0.9;
    const strokeColor = config.strokeColor ?? INVENTORY_DARK.bronze;
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
    shadow.fillStyle(0x000000, 0.34);
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
      const target = object as Phaser.GameObjects.GameObject & {
        setAlpha?: (alpha: number) => void;
        disableInteractive?: () => void;
      };

      target.setAlpha?.(alpha);
    });
  }
}
