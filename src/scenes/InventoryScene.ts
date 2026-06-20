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
  getItemBonusWithUpgrade,
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
  veryCompact: boolean;

  headerY: number;

  statsY: number;
  statsHeight: number;

  equipmentY: number;
  equipmentHeight: number;

  tabsY: number;
  tabHeight: number;
  tabsBottom: number;

  listPanelTop: number;
  listPanelBottom: number;
  listPanelHeight: number;

  listHeaderTop: number;
  listHeaderHeight: number;

  inventoryViewportTop: number;
  inventoryViewportBottom: number;
  inventoryViewportHeight: number;
  inventoryViewportLeft: number;
  inventoryViewportWidth: number;

  listTop: number;
  listBottom: number;
  listHeight: number;

  hasMassSellButton: boolean;
  massSellButtonY: number;
  massSellButtonHeight: number;
  actionButtonY: number;

  bottomNavTop: number;
};

type EquipmentBonusSummary = {
  hp: number;
  energy: number;
  attack: number;
  defense: number;
  critChance: number;
  agility: number;
  luck: number;
  strength: number;
  intelligence: number;
};

type EquipmentBonusLine = {
  label: string;
  value: string;
  color: string;
};

export class InventoryScene extends Phaser.Scene {
  private isItemInfoOpen = false;

  private returnScene = 'CampScene';

  private itemInfoContainer?: Phaser.GameObjects.Container;
  private equipmentTooltipContainer?: Phaser.GameObjects.Container;
  private equipmentTooltipOutsideHandler?: (pointer: Phaser.Input.Pointer) => void;
  private equipmentTooltipHoldTimer?: Phaser.Time.TimerEvent;

  private inventoryItemsContainer?: Phaser.GameObjects.Container;
  private inventoryListCamera?: Phaser.Cameras.Scene2D.Camera;
  private inventoryListObjects: Phaser.GameObjects.GameObject[] = [];
  private inventoryListUiObjects: Phaser.GameObjects.GameObject[] = [];
  private inventoryTabObjects: Phaser.GameObjects.GameObject[] = [];
  private inventoryScrollbarTrack?: Phaser.GameObjects.Rectangle;
  private inventoryScrollbarThumb?: Phaser.GameObjects.Rectangle;

  private inventoryViewportTop = 0;
  private inventoryViewportBottom = 0;
  private inventoryViewportHeight = 0;
  private inventoryViewportLeft = 0;
  private inventoryViewportWidth = 0;

  private inventoryScrollY = 0;
  private inventoryTargetScrollY = 0;
  private inventoryMaxScrollY = 0;

  private inventoryLastRenderedScrollY = -1;

  private initialInventoryScrollY = 0;

  private isDraggingInventory = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  private didDragInventory = false;
  private isRestartingInventory = false;

  private shouldPlayInventoryIntroAnimation = true;
  private shouldAnimateInventoryListItems = true;


  private inventoryPointerDownHandler?: (pointer: Phaser.Input.Pointer) => void;
  private inventoryPointerMoveHandler?: (pointer: Phaser.Input.Pointer) => void;
  private inventoryPointerUpHandler?: () => void;
  private inventoryWheelHandler?: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number
  ) => void;

  private selectedCategory: InventoryCategory = 'all';

  constructor() {
    super('InventoryScene');
  }

  init(data?: {
    inventoryScrollY?: number;
    selectedCategory?: InventoryCategory;
    returnScene?: string;
    skipIntroAnimation?: boolean;
  }) {
    this.initialInventoryScrollY = data?.inventoryScrollY ?? 0;
    this.selectedCategory = data?.selectedCategory ?? 'all';
    this.returnScene = data?.returnScene ?? 'CampScene';
    this.shouldPlayInventoryIntroAnimation = !data?.skipIntroAnimation;
    this.shouldAnimateInventoryListItems = !data?.skipIntroAnimation;

    this.isItemInfoOpen = false;
    this.isDraggingInventory = false;
    this.didDragInventory = false;
    this.isRestartingInventory = false;
    this.itemInfoContainer = undefined;
    this.inventoryListObjects = [];
    this.inventoryListUiObjects = [];
    this.inventoryTabObjects = [];
  }

  create(data?: {
    returnScene?: string;
    skipIntroAnimation?: boolean;
  }) {
    if (data?.returnScene) {
      this.returnScene = data.returnScene;
    }

    if (!data?.returnScene && this.returnScene !== 'DungeonScene') {
      this.returnScene = 'CampScene';
    }

    if (data?.skipIntroAnimation) {
      this.shouldPlayInventoryIntroAnimation = false;
      this.shouldAnimateInventoryListItems = false;
    }

    this.cleanupInventoryScene();
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInventoryScene, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInventoryScene, this);

    const layout = this.getLayout();

    if (this.shouldPlayInventoryIntroAnimation) {
      this.cameras.main.fadeIn(260, 0, 0, 0);
    }

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
    const veryCompact = height < 760;
    const tiny = height < 700;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 16, 30);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.016), 10, 22);
    const safeBottom = this.returnScene === 'DungeonScene' ? 78 : 104;
    const contentWidth = Math.min(width - safeX * 2, 640);

    const hasMassSellButton =
      this.canSellItems() &&
      this.selectedCategory !== 'potions' &&
      this.selectedCategory !== 'materials';

    const headerY = safeTop;

    const statsHeight = tiny ? 92 : veryCompact ? 98 : compact ? 104 : 112;
    const statsY = safeTop + statsHeight / 2;

    const equipmentHeight = tiny ? 118 : veryCompact ? 122 : compact ? 128 : 136;
    const equipmentGap = tiny ? 6 : 8;
    const equipmentY = statsY + statsHeight / 2 + equipmentGap + equipmentHeight / 2;

    const tabHeight = tiny ? 50 : veryCompact ? 54 : compact ? 60 : 64;
    const tabsGap = tiny ? 7 : 9;
    const tabsY = equipmentY + equipmentHeight / 2 + tabsGap + tabHeight / 2;
    const tabsBottom = tabsY + tabHeight / 2;

    const bottomNavTop = this.returnScene === 'DungeonScene'
      ? height - 78
      : height - 104;

    const massSellButtonHeight = tiny ? 38 : 42;
    const massSellButtonY = bottomNavTop - (tiny ? 42 : 48);
    const massSellButtonTop = massSellButtonY - massSellButtonHeight / 2;

    const listPanelTop = tabsBottom + (tiny ? 8 : 10);
    const listPanelBottom = bottomNavTop - (tiny ? 6 : 8);
    const listPanelHeight = Math.max(132, listPanelBottom - listPanelTop);

    const listHeaderTop = listPanelTop;
    const listHeaderHeight = tiny ? 50 : 56;

    const inventoryViewportTop = listHeaderTop + listHeaderHeight + (tiny ? 6 : 10);
    const inventoryViewportBottom = hasMassSellButton
      ? massSellButtonTop - (tiny ? 10 : 14)
      : bottomNavTop - (tiny ? 12 : 14);

    const inventoryViewportHeight = Math.max(0, inventoryViewportBottom - inventoryViewportTop);
    const inventoryViewportLeft = width / 2 - contentWidth / 2 + 18;
    const inventoryViewportWidth = contentWidth - 36;

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      contentWidth,
      compact,
      veryCompact,

      headerY,

      statsY,
      statsHeight,

      equipmentY,
      equipmentHeight,

      tabsY,
      tabHeight,
      tabsBottom,

      listPanelTop,
      listPanelBottom,
      listPanelHeight,

      listHeaderTop,
      listHeaderHeight,

      inventoryViewportTop,
      inventoryViewportBottom,
      inventoryViewportHeight,
      inventoryViewportLeft,
      inventoryViewportWidth,

      listTop: inventoryViewportTop,
      listBottom: inventoryViewportBottom,
      listHeight: inventoryViewportHeight,

      hasMassSellButton,
      massSellButtonY,
      massSellButtonHeight,
      actionButtonY: massSellButtonY,

      bottomNavTop,
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
      radius: veryCompact ? 20 : 24,
      color: INVENTORY_DARK.stone,
      alpha: 0.94,
      strokeColor: INVENTORY_DARK.bronze,
      strokeAlpha: 0.44,
      strokeWidth: 2,
      depth: 2,
    });

    if (this.shouldPlayInventoryIntroAnimation) {
      panel.shadow.setAlpha(0);
      panel.panel.setAlpha(0);

      this.tweens.add({
        targets: [panel.shadow, panel.panel],
        alpha: 1,
        duration: 230,
        delay: 60,
        ease: 'Sine.easeOut',
      });
    } else {
      panel.shadow.setAlpha(1);
      panel.panel.setAlpha(1);
    }

    const left = layout.centerX - layout.contentWidth / 2;
    const top = layout.statsY - layout.statsHeight / 2;
    const paddingX = veryCompact ? 8 : 10;
    const paddingY = veryCompact ? 9 : 10;
    const gapX = veryCompact ? 5 : 7;
    const gapY = veryCompact ? 6 : 8;
    const columns = 4;
    const rows = 2;
    const chipWidth = (layout.contentWidth - paddingX * 2 - gapX * (columns - 1)) / columns;
    const chipHeight = (layout.statsHeight - paddingY * 2 - gapY * (rows - 1)) / rows;

    const chips = [
      { label: 'HP', value: `${player.hp}/${stats.maxHp}`, icon: '♥', color: INVENTORY_DARK.red },
      { label: 'Атака', value: `${stats.attack}`, icon: '⚔', color: INVENTORY_DARK.gold },
      { label: 'Защ.', value: `${stats.defense}`, icon: '▣', color: INVENTORY_DARK.cold },
      { label: 'Золото', value: `${player.gold}`, icon: '◆', color: INVENTORY_DARK.gold },
      { label: 'Крит', value: this.formatPercentStat(stats.critChance), icon: '✦', color: INVENTORY_DARK.violet },
      { label: 'Крит ур.', value: this.formatPercentMultiplier(this.getCriticalDamageMultiplier()), icon: '✷', color: INVENTORY_DARK.violet },
      { label: 'Инт', value: `${stats.intelligence}`, icon: '☥', color: INVENTORY_DARK.cold },
      { label: 'Удача', value: `${stats.luck}`, icon: '◇', color: INVENTORY_DARK.gold },
    ];

    chips.forEach((chip, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
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
    const radius = Math.min(15, height / 2);
    const objects = this.createRoundedPanelAsObjects({
      x,
      y,
      width,
      height,
      radius,
      color: 0x0b0d11,
      alpha: 0.96,
      strokeColor: accentColor,
      strokeAlpha: 0.34,
      strokeWidth: 1,
      depth: 4,
    });

    const iconX = x - width / 2 + Math.min(14, width * 0.18);
    const textX = x - width / 2 + Math.min(26, width * 0.31);
    const textWidth = Math.max(34, width - (textX - (x - width / 2)) - 4);

    const iconText = this.add.text(iconX, y, icon, {
      fontFamily: UI.font.body,
      fontSize: height < 38 ? '9px' : '10px',
      color: UI.colors.textMuted,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7);

    const labelText = this.add.text(textX, y - height * 0.2, label, {
      fontFamily: UI.font.body,
      fontSize: height < 38 ? '7px' : '8px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: textWidth,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7);

    const valueText = this.add.text(textX, y + height * 0.18, value, {
      fontFamily: UI.font.title,
      fontSize: height < 38 ? '10px' : '12px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: textWidth,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7);

    const animatedObjects = [...objects, iconText, labelText, valueText];

    if (this.shouldPlayInventoryIntroAnimation) {
      this.setObjectsAlpha(animatedObjects, 0);

      this.tweens.add({
        targets: animatedObjects,
        alpha: 1,
        y: '+=0',
        duration: 185,
        delay: 80 + index * 26,
        ease: 'Sine.easeOut',
      });
    } else {
      this.setObjectsAlpha(animatedObjects, 1);
    }
  }

  private getCriticalDamageMultiplier(): number {
    const critTreeLevel = Math.max(0, player.characterTree?.crit ?? 0);

    return critTreeLevel >= 2 ? 1.6 : 1.5;
  }

  private formatPercentStat(value: number): string {
    const normalized = Math.abs(value) <= 1
      ? value * 100
      : value;

    return `${Math.round(normalized)}%`;
  }

  private formatPercentMultiplier(value: number): string {
    const normalized = Math.abs(value) <= 2
      ? value * 100
      : value;

    return `${Math.round(normalized)}%`;
  }



  private createEquipmentPanel(layout: InventoryLayout) {
    const veryCompact = layout.height < 920;
    const panelTop = layout.equipmentY - layout.equipmentHeight / 2;

    const panel = this.createRoundedPanel({
      x: layout.centerX,
      y: layout.equipmentY,
      width: layout.contentWidth,
      height: layout.equipmentHeight,
      radius: veryCompact ? 22 : 26,
      color: INVENTORY_DARK.brown,
      alpha: 0.94,
      strokeColor: INVENTORY_DARK.bronze,
      strokeAlpha: 0.56,
      strokeWidth: 2,
      depth: 2,
    });

    if (this.shouldPlayInventoryIntroAnimation) {
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
    } else {
      panel.shadow.setAlpha(1);
      panel.panel.setAlpha(1);
    }

    this.add.text(layout.centerX - layout.contentWidth / 2 + 18, panelTop + (veryCompact ? 18 : 21), 'Снаряжение', {
      fontFamily: UI.font.title,
      fontSize: veryCompact ? '16px' : layout.compact ? '18px' : '20px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'left',
      wordWrap: {
        width: layout.contentWidth * 0.44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);

    this.add.text(layout.centerX + layout.contentWidth / 2 - 18, panelTop + (veryCompact ? 18 : 21), 'удержи слот', {
      fontFamily: UI.font.body,
      fontSize: veryCompact ? '8px' : '9px',
      color: INVENTORY_DARK.muted,
      align: 'right',
      wordWrap: {
        width: layout.contentWidth * 0.42,
      },
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(10);

    this.createEquipmentIconSlots(layout);
    this.createEquipmentSummaryPanel(layout);
  }

  private createEquipmentIconSlots(layout: InventoryLayout): void {
    const metrics = this.getEquipmentPanelMetrics(layout);
    const radius = metrics.slotRadius;
    const iconGapX = metrics.slotGapX;
    const iconGapY = metrics.slotGapY;
    const firstX = metrics.slotAreaLeft + radius + 4;
    const secondX = firstX + radius * 2 + iconGapX;
    const firstY = metrics.slotAreaTop + radius;
    const secondY = firstY + radius * 2 + iconGapY;

    this.createEquipmentIconSlot('weapon', firstX, firstY, radius, 0);
    this.createEquipmentIconSlot('armor', secondX, firstY, radius, 1);
    this.createEquipmentIconSlot('trinket', firstX, secondY, radius, 2);
    this.createEquipmentIconSlot('ring', secondX, secondY, radius, 3);
  }

  private createEquipmentIconSlot(slot: EquipmentSlot, x: number, y: number, radius: number, index = 0): void {
    const instanceId = player.equipment[slot];
    const inventoryItem = instanceId
      ? player.inventory.find((item: InventoryItem) => item.instanceId === instanceId)
      : undefined;
    const item = inventoryItem ? getBaseItemFromInventoryItem(inventoryItem) : undefined;
    const rarityFillColor = item ? getRarityColorHex(item) : INVENTORY_DARK.graphite;
    const rarityStrokeColor = item ? getRarityStrokeColor(item) : UI.colors.goldDark;
    const strokeAlpha = item ? 0.92 : 0.24;
    const fillAlpha = item ? 0.72 : 0.62;

    const shadow = this.add.circle(x, y + 4, radius + 2, 0x000000, 0.28).setDepth(5);
    const bg = this.add.circle(x, y, radius, rarityFillColor, fillAlpha)
      .setStrokeStyle(item ? 3 : 2, rarityStrokeColor, strokeAlpha)
      .setDepth(6);

    const icon = this.add.text(x, y - (item ? 0 : radius * 0.12), getSlotIcon(slot), {
      fontFamily: UI.font.body,
      fontSize: `${Math.max(13, Math.floor(radius * 0.78))}px`,
      color: item ? '#ffffff' : UI.colors.textMuted,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7);

    const emptyHint = item
      ? undefined
      : this.add.text(x, y + radius * 0.43, 'пусто', {
        fontFamily: UI.font.body,
        fontSize: `${Math.max(6, Math.floor(radius * 0.26))}px`,
        color: '#665d50',
        wordWrap: {
          width: radius * 1.6,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(7);

    const objects = [shadow, bg, icon];

    if (emptyHint) {
      objects.push(emptyHint);
    }

    if (this.shouldPlayInventoryIntroAnimation) {
      this.setObjectsAlpha(objects, 0);
      this.tweens.add({
        targets: objects,
        alpha: 1,
        duration: 190,
        delay: 160 + index * 40,
        ease: 'Sine.easeOut',
      });
    }

    if (item) {
      this.tweens.add({
        targets: bg,
        alpha: {
          from: Math.max(0.48, fillAlpha - 0.14),
          to: Math.min(0.92, fillAlpha + 0.12),
        },
        duration: 1450,
        yoyo: true,
        repeat: -1,
        delay: 360 + index * 80,
        ease: 'Sine.easeInOut',
      });
    }

    const zone = this.add.zone(x, y, radius * 2.4, radius * 2.4)
      .setDepth(32)
      .setInteractive({ useHandCursor: true });

    let holdOpenedTooltip = false;

    zone.on('pointerover', () => {
      if (this.isItemInfoOpen) {
        return;
      }

      bg.setStrokeStyle(item ? 3 : 2, rarityStrokeColor, item ? 1 : 0.48);
      this.showEquipmentTooltip(slot, inventoryItem, x, y);
    });

    zone.on('pointerout', () => {
      bg.setStrokeStyle(item ? 3 : 2, rarityStrokeColor, strokeAlpha);
      this.cancelEquipmentTooltipHold();
      this.hideEquipmentTooltip();
    });

    zone.on('pointerdown', () => {
      if (this.isItemInfoOpen) {
        return;
      }

      holdOpenedTooltip = false;
      bg.setAlpha(Math.min(1, fillAlpha + 0.16));
      this.cancelEquipmentTooltipHold();
      this.equipmentTooltipHoldTimer = this.time.delayedCall(430, () => {
        holdOpenedTooltip = true;
        this.showEquipmentTooltip(slot, inventoryItem, x, y);
      });
    });

    zone.on('pointerup', () => {
      bg.setAlpha(fillAlpha);
      this.cancelEquipmentTooltipHold();

      if (this.isItemInfoOpen) {
        return;
      }

      if (holdOpenedTooltip) {
        holdOpenedTooltip = false;
        return;
      }

      this.hideEquipmentTooltip();

      if (inventoryItem) {
        this.showUnequipConfirm(slot, inventoryItem);
      } else {
        this.showEquipmentTooltip(slot, undefined, x, y);
      }
    });

    zone.on('pointerupoutside', () => {
      bg.setAlpha(fillAlpha);
      holdOpenedTooltip = false;
      this.cancelEquipmentTooltipHold();
      this.hideEquipmentTooltip();
    });
  }

  private createEquipmentSummaryPanel(layout: InventoryLayout): void {
    const metrics = this.getEquipmentPanelMetrics(layout);
    const summary = this.getEquippedItemsBonusSummary();
    const lines = this.formatEquipmentBonus(summary);
    const titleFontSize = layout.veryCompact ? '11px' : '12px';
    const lineFontSize = layout.veryCompact ? '9px' : '10px';

    const bgObjects = this.createRoundedPanelAsObjects({
      x: metrics.bonusX,
      y: metrics.bonusY,
      width: metrics.bonusWidth,
      height: metrics.bonusHeight,
      radius: 16,
      color: 0x0b0d11,
      alpha: 0.82,
      strokeColor: INVENTORY_DARK.bronze,
      strokeAlpha: 0.34,
      strokeWidth: 1,
      depth: 5,
    });

    const title = this.add.text(metrics.bonusLeft + 10, metrics.bonusTop + 11, 'Бонусы экипировки', {
      fontFamily: UI.font.title,
      fontSize: titleFontSize,
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: metrics.bonusWidth - 20,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8);

    const objects: Phaser.GameObjects.GameObject[] = [...bgObjects, title];

    if (lines.length === 0) {
      const emptyTitle = this.add.text(metrics.bonusLeft + 10, metrics.bonusTop + 36, 'Нет бонусов', {
        fontFamily: UI.font.body,
        fontSize: lineFontSize,
        color: UI.colors.textMuted,
        wordWrap: {
          width: metrics.bonusWidth - 20,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8);

      const emptyHint = this.add.text(metrics.bonusLeft + 10, metrics.bonusTop + 55, 'Надень предметы, чтобы усилить героя', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '8px' : '9px',
        color: '#756b5c',
        wordWrap: {
          width: metrics.bonusWidth - 20,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(8);

      objects.push(emptyTitle, emptyHint);
    } else {
      const maxLines = layout.veryCompact ? 4 : 5;
      const visibleLines = lines.slice(0, maxLines);
      const hiddenCount = Math.max(0, lines.length - visibleLines.length);
      const lineGap = layout.veryCompact ? 13 : 15;

      visibleLines.forEach((line, index) => {
        const row = this.add.text(metrics.bonusLeft + 10, metrics.bonusTop + 34 + index * lineGap, `${line.value} ${line.label}`, {
          fontFamily: UI.font.body,
          fontSize: lineFontSize,
          color: line.color,
          stroke: '#000000',
          strokeThickness: 1,
          wordWrap: {
            width: metrics.bonusWidth - 20,
          },
          maxLines: 1,
        }).setOrigin(0, 0.5).setDepth(8);

        objects.push(row);
      });

      if (hiddenCount > 0) {
        const moreText = this.add.text(metrics.bonusLeft + 10, metrics.bonusTop + 34 + visibleLines.length * lineGap, `ещё +${hiddenCount}`, {
          fontFamily: UI.font.body,
          fontSize: layout.veryCompact ? '8px' : '9px',
          color: UI.colors.textMuted,
          wordWrap: {
            width: metrics.bonusWidth - 20,
          },
          maxLines: 1,
        }).setOrigin(0, 0.5).setDepth(8);

        objects.push(moreText);
      }
    }

    if (this.shouldPlayInventoryIntroAnimation) {
      this.setObjectsAlpha(objects, 0);
      this.tweens.add({
        targets: objects,
        alpha: 1,
        duration: 210,
        delay: 210,
        ease: 'Sine.easeOut',
      });
    }
  }

  private getEquipmentPanelMetrics(layout: InventoryLayout) {
    const panelLeft = layout.centerX - layout.contentWidth / 2;
    const panelTop = layout.equipmentY - layout.equipmentHeight / 2;
    const innerLeft = panelLeft + 16;
    const innerRight = panelLeft + layout.contentWidth - 16;
    const contentTop = panelTop + (layout.veryCompact ? 36 : 42);
    const contentBottom = panelTop + layout.equipmentHeight - 12;
    const contentHeight = Math.max(54, contentBottom - contentTop);
    const slotAreaWidth = Math.min(layout.contentWidth * 0.42, layout.veryCompact ? 140 : 156);
    const slotRadius = Math.max(13, Math.min(layout.veryCompact ? 17 : 20, (contentHeight - 6) / 4));
    const slotGapX = Math.max(7, Math.min(13, slotAreaWidth - slotRadius * 4 - 8));
    const slotGapY = Math.max(4, Math.min(10, contentHeight - slotRadius * 4));
    const slotAreaLeft = innerLeft;
    const slotAreaTop = contentTop + Math.max(0, (contentHeight - (slotRadius * 4 + slotGapY)) / 2);
    const bonusLeft = slotAreaLeft + slotRadius * 4 + slotGapX + 18;
    const bonusWidth = Math.max(122, innerRight - bonusLeft);
    const bonusHeight = contentHeight;
    const bonusTop = contentTop;

    return {
      panelLeft,
      panelTop,
      slotAreaLeft,
      slotAreaTop,
      slotRadius,
      slotGapX,
      slotGapY,
      bonusLeft,
      bonusTop,
      bonusWidth,
      bonusHeight,
      bonusX: bonusLeft + bonusWidth / 2,
      bonusY: bonusTop + bonusHeight / 2,
    };
  }

  private getEquippedItemsBonusSummary(): EquipmentBonusSummary {
    const summary: EquipmentBonusSummary = {
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

    const slots: EquipmentSlot[] = ['weapon', 'armor', 'trinket', 'ring'];

    slots.forEach(slot => {
      const inventoryItem = this.getEquippedInventoryItemForSlot(slot);

      if (!inventoryItem) {
        return;
      }

      const bonus = getItemBonusWithUpgrade(inventoryItem);

      summary.hp += bonus.bonusHp;
      summary.energy += bonus.bonusEnergy;
      summary.attack += bonus.bonusAttack;
      summary.defense += bonus.bonusDefense;
      summary.critChance += bonus.bonusCritChance;
      summary.agility += bonus.bonusAgility;
      summary.luck += bonus.bonusLuck;
      summary.strength += bonus.bonusStrength;
      summary.intelligence += bonus.bonusIntelligence;
    });

    return summary;
  }

  private formatEquipmentBonus(summary: EquipmentBonusSummary): EquipmentBonusLine[] {
    const lines: EquipmentBonusLine[] = [];

    const pushNumber = (value: number, label: string, color: string) => {
      if (!value) {
        return;
      }

      lines.push({
        label,
        value: value > 0 ? `+${value}` : `${value}`,
        color,
      });
    };

    pushNumber(summary.hp, 'HP', UI.colors.green);
    pushNumber(summary.energy, 'энергия', UI.colors.blue);
    pushNumber(summary.attack, 'атака', UI.colors.goldText);
    pushNumber(summary.defense, 'защита', UI.colors.blue);
    pushNumber(summary.strength, 'сила', UI.colors.text);
    pushNumber(summary.intelligence, 'инт', UI.colors.blue);
    pushNumber(summary.agility, 'ловк.', UI.colors.green);
    pushNumber(summary.luck, 'удача', UI.colors.goldText);

    if (summary.critChance) {
      lines.push({
        label: 'крит',
        value: summary.critChance > 0
          ? `+${this.formatPercentStat(summary.critChance)}`
          : `-${this.formatPercentStat(Math.abs(summary.critChance))}`,
        color: '#c9a4ff',
      });
    }

    return lines;
  }

  private showEquipmentTooltip(slot: EquipmentSlot, inventoryItem: InventoryItem | undefined, x: number, y: number): void {
    if (this.isItemInfoOpen) {
      return;
    }

    this.hideEquipmentTooltip();

    const layout = this.getLayout();
    const item = inventoryItem ? getBaseItemFromInventoryItem(inventoryItem) : undefined;
    const panelWidth = Math.min(286, Math.max(220, layout.contentWidth - 54));
    const hasItem = Boolean(item && inventoryItem);
    const statsText = inventoryItem ? createItemStatsText(inventoryItem) : '';
    const panelHeight = hasItem ? Math.min(194, statsText.length > 74 ? 194 : 174) : 118;
    const openLeft = x > layout.centerX;
    const preferredX = openLeft
      ? x - panelWidth / 2 - 20
      : x + panelWidth / 2 + 20;
    const preferredY = y + panelHeight + 24 > layout.bottomNavTop
      ? y - panelHeight / 2 - 22
      : y + panelHeight / 2 + 22;
    const tooltipX = Phaser.Math.Clamp(
      preferredX,
      layout.safeX + panelWidth / 2,
      layout.width - layout.safeX - panelWidth / 2
    );
    const tooltipY = Phaser.Math.Clamp(
      preferredY,
      layout.safeTop + panelHeight / 2,
      layout.bottomNavTop - panelHeight / 2 - 8
    );
    const left = tooltipX - panelWidth / 2;
    const top = tooltipY - panelHeight / 2;

    const tooltip = this.add.container(0, 0).setDepth(1500);
    this.equipmentTooltipContainer = tooltip;

    const panelObjects = this.createRoundedPanelAsObjects({
      x: tooltipX,
      y: tooltipY,
      width: panelWidth,
      height: panelHeight,
      radius: 18,
      color: INVENTORY_DARK.stone,
      alpha: 0.985,
      strokeColor: item ? getRarityStrokeColor(item) : UI.colors.goldDark,
      strokeAlpha: item ? 0.92 : 0.62,
      strokeWidth: 2,
      depth: 1501,
    });

    const title = this.add.text(left + 16, top + 20, item ? item.name : `${getSlotText(slot)} пусто`, {
      fontFamily: UI.font.title,
      fontSize: hasItem ? '15px' : '14px',
      color: item ? UI.colors.goldText : UI.colors.textMuted,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: panelWidth - 32,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0, 0.5).setDepth(1503);

    const subtitle = this.add.text(left + 16, top + (hasItem ? 51 : 49), item
      ? `${item.slot === 'weapon' ? getWeaponTypeText(item.weaponType) : getSlotText(item.slot)} • ${getRarityText(item)}${inventoryItem && inventoryItem.upgradeLevel > 0 ? ` • +${inventoryItem.upgradeLevel}` : ''}`
      : 'Надень предмет подходящего типа', {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: item ? '#cbb895' : '#7b7164',
        wordWrap: {
          width: panelWidth - 32,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(1503);

    const objects: Phaser.GameObjects.GameObject[] = [
      ...panelObjects,
      title,
      subtitle,
    ];

    if (hasItem && inventoryItem) {
      const stats = this.add.text(left + 16, top + 82, statsText || 'Без бонусов', {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: statsText ? UI.colors.text : UI.colors.textMuted,
        lineSpacing: 3,
        wordWrap: {
          width: panelWidth - 32,
          useAdvancedWrap: true,
        },
        maxLines: 4,
      }).setOrigin(0, 0).setDepth(1503);

      const hint = this.add.text(left + 16, top + panelHeight - 18, 'Короткое нажатие — снять предмет', {
        fontFamily: UI.font.body,
        fontSize: '9px',
        color: '#756b5c',
        wordWrap: {
          width: panelWidth - 32,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(1503);

      objects.push(stats, hint);
    }

    tooltip.add(objects);
    this.inventoryListCamera?.ignore(tooltip);

    this.setObjectsAlpha(objects, 0);
    this.tweens.add({
      targets: objects,
      alpha: 1,
      duration: 120,
      ease: 'Sine.easeOut',
    });

    this.equipmentTooltipOutsideHandler = () => {
      this.hideEquipmentTooltip();
    };

    this.input.once('pointerdown', this.equipmentTooltipOutsideHandler);
  }

  private hideEquipmentTooltip(): void {
    this.cancelEquipmentTooltipHold();

    if (this.equipmentTooltipOutsideHandler) {
      this.input.off('pointerdown', this.equipmentTooltipOutsideHandler);
      this.equipmentTooltipOutsideHandler = undefined;
    }

    if (this.equipmentTooltipContainer) {
      this.equipmentTooltipContainer.destroy(true);
      this.equipmentTooltipContainer = undefined;
    }
  }

  private cancelEquipmentTooltipHold(): void {
    if (this.equipmentTooltipHoldTimer) {
      this.equipmentTooltipHoldTimer.remove(false);
      this.equipmentTooltipHoldTimer = undefined;
    }
  }



  private createCategoryTabs(layout: InventoryLayout) {
    this.destroyObjects(this.inventoryTabObjects);
    this.inventoryTabObjects = [];

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

      if (this.shouldPlayInventoryIntroAnimation) {
        tabBg.shadow.setAlpha(0);
        tabBg.bg.setAlpha(0);
      } else {
        tabBg.shadow.setAlpha(1);
        tabBg.bg.setAlpha(1);
      }

      const icon = this.add.text(x - tabWidth * 0.27, y, tab.icon, {
        fontFamily: UI.font.body,
        fontSize: layout.contentWidth < 390 ? '10px' : '12px',
        color: isActive ? UI.colors.goldText : UI.colors.textMuted,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(83).setAlpha(this.shouldPlayInventoryIntroAnimation ? 0 : 1);

      const label = this.add.text(x - tabWidth * 0.08, y, tab.label, {
        fontFamily: UI.font.body,
        fontSize: layout.contentWidth < 390 ? '8px' : '9px',
        color: isActive ? UI.colors.goldText : UI.colors.textMuted,
        align: 'left',
        wordWrap: {
          width: tabWidth * 0.68,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(83).setAlpha(this.shouldPlayInventoryIntroAnimation ? 0 : 1);

      const tabObjects: Phaser.GameObjects.GameObject[] = [
        tabBg.shadow,
        tabBg.bg,
        tabBg.zone,
        icon,
        label,
      ];

      this.inventoryTabObjects.push(...tabObjects);
      this.inventoryListCamera?.ignore(tabObjects);

      if (this.shouldPlayInventoryIntroAnimation) {
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
      }

      tabBg.zone.on('pointerover', () => {
        if (this.selectedCategory === tab.id) {
          return;
        }

        icon.setColor(UI.colors.goldText);
        label.setColor(UI.colors.goldText);
        tabBg.bg.setAlpha(0.95);
      });

      tabBg.zone.on('pointerout', () => {
        if (this.selectedCategory === tab.id) {
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
        tabBg.bg.setAlpha(this.selectedCategory === tab.id ? 1 : 0.95);

        if (this.isItemInfoOpen || this.isRestartingInventory) {
          return;
        }

        if (this.selectedCategory === tab.id) {
          return;
        }

        this.selectedCategory = tab.id;
        this.inventoryScrollY = 0;
        this.inventoryTargetScrollY = 0;
        this.initialInventoryScrollY = 0;
        this.isDraggingInventory = false;
        this.didDragInventory = false;
        this.setInventoryListModalMode(false);
        this.shouldAnimateInventoryListItems = true;

        this.rebuildCategoryTabsOnly();
        this.rebuildInventoryListOnly();
      });

      tabBg.zone.on('pointerupoutside', () => {
        tabBg.bg.setAlpha(this.selectedCategory === tab.id ? 1 : 0.76);
      });
    });
  }

  private createInventoryList(layout: InventoryLayout) {
    this.cleanupInventoryListOnly(true);

    const panel = this.createRoundedPanel({
      x: layout.centerX,
      y: layout.listPanelTop + layout.listPanelHeight / 2,
      width: layout.contentWidth,
      height: layout.listPanelHeight,
      radius: layout.veryCompact ? 24 : 30,
      color: INVENTORY_DARK.graphite,
      alpha: 0.97,
      strokeColor: INVENTORY_DARK.bronze,
      strokeAlpha: 0.62,
      strokeWidth: 2,
      depth: 20,
    });

    this.inventoryListUiObjects.push(panel.shadow, panel.panel);

    if (this.shouldPlayInventoryIntroAnimation) {
      panel.shadow.setAlpha(0);
      panel.panel.setAlpha(0);
      this.tweens.add({
        targets: [panel.shadow, panel.panel],
        alpha: 1,
        y: '+=0',
        duration: 220,
        delay: 210,
        ease: 'Sine.easeOut',
      });
    } else {
      panel.shadow.setAlpha(1);
      panel.panel.setAlpha(1);
    }

    const title = this.getCategoryTitle();
    const counter = this.getCategoryCounter();
    const headerY = layout.listHeaderTop + (layout.veryCompact ? 22 : 26);
    const listHeaderDepth = 92;

    const titleText = this.add.text(layout.centerX - layout.contentWidth / 2 + 22, headerY, title, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '19px' : layout.compact ? '21px' : '24px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: layout.contentWidth - 162,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(listHeaderDepth);

    const counterText = this.add.text(layout.centerX + layout.contentWidth / 2 - 24, headerY, counter, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '12px' : '14px',
      color: INVENTORY_DARK.muted,
      align: 'right',
      wordWrap: {
        width: 122,
      },
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(listHeaderDepth);

    this.inventoryListUiObjects.push(titleText, counterText);

    if (!layout.veryCompact) {
      const sortText = this.add.text(layout.centerX, layout.listHeaderTop + 50, 'Надетые → кольца → редкость', {
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

      this.inventoryListUiObjects.push(sortText);
    }

    this.createInventoryItemsViewport(layout);

    this.inventoryScrollY = this.initialInventoryScrollY;
    this.inventoryTargetScrollY = this.initialInventoryScrollY;
    this.inventoryLastRenderedScrollY = -1;

    const contentHeight = this.getInventoryContentHeight(layout);
    this.inventoryMaxScrollY = Math.max(0, contentHeight - this.inventoryViewportHeight);

    this.inventoryScrollY = Phaser.Math.Clamp(this.inventoryScrollY, 0, this.inventoryMaxScrollY);
    this.inventoryTargetScrollY = Phaser.Math.Clamp(this.inventoryTargetScrollY, 0, this.inventoryMaxScrollY);

    this.createInventoryScrollbar(layout);
    this.updateInventoryScrollbar(layout);
    this.updateInventoryItemsContainerPosition();
    this.renderInventoryContent(layout);

    this.removeInventoryScrollHandlers();
    this.createInventoryTouchScrollHandlers(layout);

    this.inventoryWheelHandler = (
      pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
      _deltaZ: number
    ) => {
      if (this.inventoryMaxScrollY <= 0 || this.isItemInfoOpen || this.isRestartingInventory) {
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
    };

    this.input.on('wheel', this.inventoryWheelHandler);

    if (layout.hasMassSellButton) {
      this.createMassSellButton(layout);
    }
  }

  private createInventoryItemsViewport(layout: InventoryLayout): void {
    this.inventoryItemsContainer?.destroy(true);
    this.inventoryItemsContainer = undefined;

    // Не вызываем destroy() у дополнительной камеры: в Phaser 4 WebGL
    // при смене/перезапуске сцены это может падать с customViewports = null.
    // Камеру переиспользуем внутри активной сцены, а на SHUTDOWN просто забываем ссылку.
    this.inventoryListObjects = [];

    const viewportLeft = layout.inventoryViewportLeft;
    const viewportWidth = layout.inventoryViewportWidth;

    this.inventoryViewportTop = layout.inventoryViewportTop;
    this.inventoryViewportBottom = layout.inventoryViewportBottom;
    this.inventoryViewportHeight = layout.inventoryViewportHeight;
    this.inventoryViewportLeft = viewportLeft;
    this.inventoryViewportWidth = viewportWidth;

    const fixedObjectsBeforeList = this.children.list.slice();

    // В WebGL нельзя безопасно использовать GameObject.setMask
    // для текущей схемы списка: Phaser начинает сыпать warning'ами
    // `Mask.setMask: This method is not supported in WebGL`.
    //
    // Для инвентаря маска не нужна: отдельная камера уже имеет viewport
    // ровно по области списка и сама отсекает всё, что выходит за границы,
    // как прокручиваемая область в VK/Telegram.
    if (!this.inventoryListCamera) {
      this.inventoryListCamera = this.cameras.add(
        this.inventoryViewportLeft,
        this.inventoryViewportTop,
        this.inventoryViewportWidth,
        this.inventoryViewportHeight
      );
    } else {
      this.inventoryListCamera.setViewport(
        this.inventoryViewportLeft,
        this.inventoryViewportTop,
        this.inventoryViewportWidth,
        this.inventoryViewportHeight
      );
      this.inventoryListCamera.visible = true;
    }

    this.inventoryListCamera.setScroll(
      this.inventoryViewportLeft,
      this.inventoryViewportTop
    );
    this.inventoryListCamera.setBackgroundColor('rgba(0,0,0,0)');
    this.inventoryListCamera.ignore(fixedObjectsBeforeList);

    this.inventoryItemsContainer = this.add
      .container(0, this.inventoryViewportTop)
      .setDepth(40);
  }

  private isRunPreparationMode() {
    return this.returnScene === 'DungeonScene';
  }

  private canSellItems() {
    return !this.isRunPreparationMode();
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
      player.inventory.filter((inventoryItem: InventoryItem) => {
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

      const leftGroup = this.getInventorySortGroup(leftItem);
      const rightGroup = this.getInventorySortGroup(rightItem);

      if (leftGroup !== rightGroup) {
        return leftGroup - rightGroup;
      }

      const rightRank = rightBase ? this.getRaritySortRank(rightBase.rarity) : -1;
      const leftRank = leftBase ? this.getRaritySortRank(leftBase.rarity) : -1;

      if (rightRank !== leftRank) {
        return rightRank - leftRank;
      }

      const leftName = leftBase?.name ?? '';
      const rightName = rightBase?.name ?? '';

      return leftName.localeCompare(rightName, 'ru');
    });
  }

  private getInventorySortGroup(inventoryItem: InventoryItem) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (isItemEquipped(player, inventoryItem.instanceId)) {
      return 0;
    }

    // Ненадетые кольца показываем сразу после всех надетых вещей.
    // Иначе divine-кольца из-за высокой редкости всплывают выше экипировки.
    if (item?.slot === 'ring') {
      return 1;
    }

    return 2;
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
    if (this.selectedCategory === 'potions') {
      return 210;
    }

    if (this.selectedCategory === 'materials') {
      const count = Math.max(1, this.getVisibleMaterials().length);
      return 14 + count * 84 + 18;
    }

    const count = Math.max(1, this.getFilteredInventoryItems().length);
    const itemSpacing = layout.veryCompact ? 98 : layout.compact ? 106 : 112;

    return 14 + count * itemSpacing + 18;
  }

  private renderInventoryContent(layout: InventoryLayout) {
    if (!this.inventoryItemsContainer) {
      return;
    }

    this.inventoryItemsContainer.removeAll(true);
    this.inventoryListObjects = [];

    const animateListItems = this.shouldAnimateInventoryListItems;

    if (this.selectedCategory === 'potions') {
      this.renderPotionCategory(layout, animateListItems);
      this.inventoryLastRenderedScrollY = this.inventoryScrollY;
      this.shouldAnimateInventoryListItems = false;
      return;
    }

    if (this.selectedCategory === 'materials') {
      this.renderMaterialsCategory(layout, animateListItems);
      this.inventoryLastRenderedScrollY = this.inventoryScrollY;
      this.shouldAnimateInventoryListItems = false;
      return;
    }

    this.renderItemCategory(layout, animateListItems);
    this.inventoryLastRenderedScrollY = this.inventoryScrollY;
    this.shouldAnimateInventoryListItems = false;
  }

  private renderItemCategory(layout: InventoryLayout, animateListItems = false) {
    const filteredItems = this.getFilteredInventoryItems();

    if (player.inventory.length === 0) {
      this.createEmptyState(
        layout.centerX,
        this.inventoryViewportHeight / 2,
        layout.contentWidth - 80,
        'В сумке пока нет предметов.\nИх можно найти в катакомбах или купить в лавке.'
      );
      return;
    }

    if (filteredItems.length === 0) {
      this.createEmptyState(
        layout.centerX,
        this.inventoryViewportHeight / 2,
        layout.contentWidth - 80,
        'В этой категории пока нет предметов.'
      );
      return;
    }

    const itemSpacing = layout.veryCompact ? 98 : layout.compact ? 106 : 112;
    const cardHeight = layout.veryCompact ? 88 : layout.compact ? 94 : 100;
    const cardHalfHeight = cardHeight / 2;
    const topPadding = 14;
    const renderBuffer = 120;

    let animationIndex = 0;

    filteredItems.forEach((inventoryItem, index) => {
      const localY = topPadding + cardHalfHeight + index * itemSpacing;
      const worldY = this.inventoryViewportTop + localY - this.inventoryScrollY;

      if (worldY + cardHalfHeight < this.inventoryViewportTop - renderBuffer) {
        return;
      }

      if (worldY - cardHalfHeight > this.inventoryViewportBottom + renderBuffer) {
        return;
      }

      this.createInventoryItemCard(
        layout,
        inventoryItem,
        localY,
        cardHeight,
        animateListItems ? animationIndex : undefined
      );

      animationIndex += 1;
    });
  }

  private renderPotionCategory(layout: InventoryLayout, animateListItems = false) {
    const stats = getPlayerStats(player);
    const canUsePotion = player.potions > 0 && player.hp < stats.maxHp;

    const cardHeight = layout.veryCompact ? 154 : 170;
    const localY = 14 + cardHeight / 2;
    const worldY = this.inventoryViewportTop + localY - this.inventoryScrollY;

    if (worldY + cardHeight / 2 < this.inventoryViewportTop - 120) {
      return;
    }

    if (worldY - cardHeight / 2 > this.inventoryViewportBottom + 120) {
      return;
    }

    if (!this.inventoryItemsContainer) {
      return;
    }

    const cardWidth = layout.contentWidth - 70;
    const card = this.add.container(layout.centerX, localY);
    const cardObjects: Phaser.GameObjects.GameObject[] = [];
    const left = -cardWidth / 2;

    cardObjects.push(
      ...this.createLocalRoundedPanelAsObjects({
        width: cardWidth,
        height: cardHeight,
        radius: 24,
        color: INVENTORY_DARK.stone,
        alpha: 0.97,
        strokeColor: UI.colors.goldDark,
        strokeAlpha: 0.65,
        strokeWidth: 2,
      })
    );

    cardObjects.push(
      this.add.circle(left + 48, -cardHeight * 0.24, 32, 0x2a1d13, 1)
        .setStrokeStyle(2, UI.colors.goldDark, 0.75)
    );

    cardObjects.push(
      this.add.text(left + 48, -cardHeight * 0.24, '✚', {
        fontFamily: UI.font.body,
        fontSize: '27px',
        color: UI.colors.goldText,
      }).setOrigin(0.5)
    );

    cardObjects.push(
      this.add.text(left + 92, -cardHeight * 0.36, 'Зелье здоровья', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '18px' : '21px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: cardWidth - 124,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5)
    );

    cardObjects.push(
      this.add.text(left + 92, -cardHeight * 0.15, `Количество: ${player.potions}`, {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '13px' : '15px',
        color: UI.colors.text,
        wordWrap: {
          width: cardWidth - 124,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5)
    );

    cardObjects.push(
      this.add.text(left + 92, cardHeight * 0.04, 'Восстанавливает 35% максимального HP.', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '11px' : '13px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: cardWidth - 124,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5)
    );

    cardObjects.push(
      this.add.text(left + 92, cardHeight * 0.2, `HP: ${player.hp}/${stats.maxHp}`, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: canUsePotion ? UI.colors.green : UI.colors.textMuted,
        wordWrap: {
          width: cardWidth - 124,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5)
    );

    const button = this.createLocalUiButton({
      x: 0,
      y: cardHeight / 2 - 30,
      width: Math.min(cardWidth - 58, 430),
      height: 42,
      text: canUsePotion ? 'Выпить зелье' : 'Нельзя использовать',
      accentColor: INVENTORY_DARK.cold,
      disabled: !canUsePotion,
      onClick: () => {
        if (this.didDragInventory || !this.isPointerInsideInventoryList(this.input.activePointer, layout)) {
          return;
        }

        this.usePotionOutsideBattle();
      },
      small: false,
    });

    cardObjects.push(...button.objects);

    card.add(cardObjects);
    this.inventoryItemsContainer.add(card);
    this.registerInventoryListObjects([card, ...cardObjects]);

    if (animateListItems) {
      this.animateInventoryListCard(card, 0);
    }
  }

  private renderMaterialsCategory(layout: InventoryLayout, animateListItems = false) {
    const visibleMaterials = this.getVisibleMaterials();

    if (visibleMaterials.length === 0) {
      this.createEmptyState(
        layout.centerX,
        this.inventoryViewportHeight / 2,
        layout.contentWidth - 80,
        'Материалов пока нет.\nИх можно получить с монстров, элиты, мини-боссов и Морвеина.'
      );
      return;
    }

    const cardHeight = layout.veryCompact ? 70 : 76;
    const cardHalfHeight = cardHeight / 2;
    const spacing = layout.veryCompact ? 82 : 88;
    const topPadding = 14;
    const renderBuffer = 120;

    let animationIndex = 0;

    visibleMaterials.forEach((material, index) => {
      const localY = topPadding + cardHalfHeight + index * spacing;
      const worldY = this.inventoryViewportTop + localY - this.inventoryScrollY;

      if (worldY + cardHalfHeight < this.inventoryViewportTop - renderBuffer) {
        return;
      }

      if (worldY - cardHalfHeight > this.inventoryViewportBottom + renderBuffer) {
        return;
      }

      this.createMaterialCard(
        layout,
        material.id,
        localY,
        animateListItems ? animationIndex : undefined
      );

      animationIndex += 1;
    });
  }

  private createEmptyState(
    x: number,
    localY: number,
    width: number,
    text: string
  ) {
    if (!this.inventoryItemsContainer) {
      return;
    }

    const card = this.add.container(x, localY);
    const objects: Phaser.GameObjects.GameObject[] = [];

    objects.push(
      this.add.text(0, -38, '◇', {
        fontFamily: UI.font.body,
        fontSize: '34px',
        color: UI.colors.textMuted,
      }).setOrigin(0.5)
    );

    objects.push(
      this.add.text(0, 20, text, {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: UI.colors.textMuted,
        align: 'center',
        lineSpacing: 6,
        wordWrap: {
          width,
          useAdvancedWrap: true,
        },
      }).setOrigin(0.5)
    );

    card.add(objects);
    this.inventoryItemsContainer.add(card);
    this.registerInventoryListObjects([card, ...objects]);
  }

  private createMaterialCard(
    layout: InventoryLayout,
    materialId: string,
    localY: number,
    animationIndex?: number
  ) {
    const material = materials.find(item => item.id === materialId);

    if (!material || !this.inventoryItemsContainer) {
      return;
    }

    const amount = player.materials?.[material.id] ?? 0;
    const cardWidth = layout.contentWidth - 70;
    const cardHeight = layout.veryCompact ? 70 : 76;
    const left = -cardWidth / 2;
    const right = cardWidth / 2;

    const color =
      material.tier === 'forge_core'
        ? 0xff6b6b
        : material.tier === 'medium'
          ? 0x70a6ff
          : material.tier === 'crystal'
            ? 0xc084fc
            : 0xd8c7a3;

    const card = this.add.container(layout.centerX, localY);
    const objects: Phaser.GameObjects.GameObject[] = [
      ...this.createLocalRoundedPanelAsObjects({
        width: cardWidth,
        height: cardHeight,
        radius: 19,
        color: INVENTORY_DARK.stone,
        alpha: 0.96,
        strokeColor: color,
        strokeAlpha: 0.58,
        strokeWidth: 2,
      }),
    ];

    objects.push(
      this.add.circle(left + 36, 0, 23, color, 0.16)
        .setStrokeStyle(1, color, 0.68)
    );

    objects.push(
      this.add.text(left + 36, 0, this.getMaterialIcon(material.tier), {
        fontFamily: UI.font.body,
        fontSize: '19px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5)
    );

    objects.push(
      this.add.text(left + 74, -14, material.name, {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '15px' : '17px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: cardWidth - 152,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5)
    );

    objects.push(
      this.add.text(left + 74, 13, this.getMaterialTierText(material.tier), {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '10px' : '12px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: cardWidth - 152,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5)
    );

    objects.push(
      this.add.text(right - 22, 0, `x${amount}`, {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '20px' : '23px',
        color: UI.colors.text,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'right',
        wordWrap: {
          width: 70,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5)
    );

    card.add(objects);
    this.inventoryItemsContainer.add(card);
    this.registerInventoryListObjects([card, ...objects]);

    if (animationIndex !== undefined) {
      this.animateInventoryListCard(card, animationIndex);
    }
  }

  private createInventoryItemCard(
    layout: InventoryLayout,
    inventoryItem: InventoryItem,
    localY: number,
    cardHeight: number,
    animationIndex?: number
  ) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item || !this.inventoryItemsContainer) {
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
    const left = -cardWidth / 2;
    const iconX = left + 38;
    const textX = left + 74;
    const buttonWidth = Math.min(88, Math.max(72, cardWidth * 0.18));
    const buttonX = cardWidth / 2 - buttonWidth / 2 - 14;
    const canSellItems = this.canSellItems();
    const equipButtonY = canSellItems ? -cardHeight * 0.22 : 0;
    const textWidth = Math.max(118, cardWidth - 78 - buttonWidth - 30);

    let actionButtonPressed = false;

    const card = this.add.container(layout.centerX, localY);
    const cardObjects: Phaser.GameObjects.GameObject[] = [
      ...this.createLocalRoundedPanelAsObjects({
        width: cardWidth,
        height: cardHeight,
        radius: 20,
        color: isEquipped ? 0x231b13 : INVENTORY_DARK.stone,
        alpha: isEquipped ? 0.98 : 0.95,
        strokeColor: isEquipped ? UI.colors.gold : rarityStrokeColor,
        strokeAlpha: isEquipped ? 0.95 : 0.7,
        strokeWidth: isEquipped ? 2 : 1,
      }),
    ];

    const cardZone = this.add.zone(0, 0, cardWidth, cardHeight)
      .setInteractive({
        useHandCursor: true,
      });

    cardZone.on('pointerup', () => {
      if (this.isItemInfoOpen || this.isRestartingInventory || !this.isPointerInsideInventoryList(this.input.activePointer, layout)) {
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
      this.add.circle(iconX, 0, 27, rarityColor, 0.18)
    );

    cardObjects.push(
      this.add.circle(iconX, 0, 22, rarityColor, 0.92)
        .setStrokeStyle(2, rarityStrokeColor, 0.86)
    );

    cardObjects.push(
      this.add.text(iconX, 0, getSlotIcon(item.slot), {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5)
    );

    cardObjects.push(
      this.add.text(textX, -cardHeight * 0.27, `${item.name}${upgrade}`, {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '13px' : '15px',
        color: isEquipped ? UI.colors.goldText : UI.colors.text,
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5)
    );

    cardObjects.push(
      this.add.text(
        textX,
        0,
        `${item.slot === 'weapon' ? getWeaponTypeText(item.weaponType) : getSlotText(item.slot)} • ${getRarityText(item)}`,
        {
          fontFamily: UI.font.body,
          fontSize: layout.veryCompact ? '10px' : '12px',
          color: '#b8aa91',
          wordWrap: {
            width: textWidth,
          },
          maxLines: 1,
        }
      ).setOrigin(0, 0.5)
    );

    cardObjects.push(
      this.add.text(textX, cardHeight * 0.24, createItemStatsText(inventoryItem) || 'Без бонусов', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '10px' : '11px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5)
    );

    const equipButton = this.createLocalUiButton({
      x: buttonX,
      y: equipButtonY,
      width: buttonWidth,
      height: layout.veryCompact ? 32 : 36,
      text: isEquipped ? 'Надето' : 'Надеть',
      accentColor: INVENTORY_DARK.cold,
      disabled: isEquipped,
      small: true,
      onClick: () => {
        actionButtonPressed = true;

        if (
          this.isItemInfoOpen ||
          this.isRestartingInventory ||
          isEquipped ||
          this.didDragInventory ||
          !this.isPointerInsideInventoryList(this.input.activePointer, layout)
        ) {
          actionButtonPressed = false;
          return;
        }

        actionButtonPressed = false;
        this.isDraggingInventory = false;
        this.didDragInventory = false;

        equipItem(player, inventoryItem.instanceId);
        void saveGameAsync();

        this.refreshInventoryAfterAction();
      },
    });

    const sellButton = canSellItems
      ? this.createLocalUiButton({
          x: buttonX,
          y: cardHeight * 0.24,
          width: buttonWidth,
          height: layout.veryCompact ? 32 : 36,
          text: 'Продать',
          accentColor: UI.colors.redHex,
          danger: true,
          disabled: isEquipped,
          small: true,
          onClick: () => {
            actionButtonPressed = true;

            if (
              this.isItemInfoOpen ||
              this.isRestartingInventory ||
              isEquipped ||
              this.didDragInventory ||
              !this.canSellItems() ||
              !this.isPointerInsideInventoryList(this.input.activePointer, layout)
            ) {
              actionButtonPressed = false;
              return;
            }

            actionButtonPressed = false;
            this.showSellConfirm(inventoryItem);
          },
        })
      : undefined;

    cardObjects.push(...equipButton.objects, ...(sellButton?.objects ?? []));

    card.add(cardObjects);
    this.inventoryItemsContainer.add(card);
    this.registerInventoryListObjects([card, ...cardObjects]);

    if (animationIndex !== undefined) {
      this.animateInventoryListCard(card, animationIndex);
    }
  }


  private animateInventoryListCard(
    card: Phaser.GameObjects.Container,
    animationIndex = 0
  ): void {
    const finalX = card.x;
    const delay = Math.min(animationIndex, 7) * 38;

    card.setAlpha(0);
    card.setX(finalX + 18);
    card.setScale(0.985);

    this.tweens.add({
      targets: card,
      alpha: 1,
      x: finalX,
      scale: 1,
      duration: 210,
      delay,
      ease: 'Sine.easeOut',
    });
  }

  private createMassSellButton(layout: InventoryLayout) {
    if (!layout.hasMassSellButton) {
      return;
    }

    const button = this.createUiButton({
      x: layout.centerX,
      y: layout.massSellButtonY,
      width: Math.min(layout.contentWidth - 92, 420),
      height: layout.massSellButtonHeight,
      text: 'Сдать обычный хлам',
      accentColor: UI.colors.redHex,
      danger: true,
      onClick: () => {
        if (this.isItemInfoOpen || this.isRestartingInventory) {
          return;
        }

        this.showMassSellConfirm();
      },
      depth: 130,
    });

    this.inventoryListCamera?.ignore(button.objects);
    this.inventoryListUiObjects.push(...button.objects);
  }


  private setInventoryListModalMode(isModalOpen: boolean): void {
    const visible = !isModalOpen;

    if (this.inventoryListCamera) {
      this.inventoryListCamera.visible = visible;
    }

    if (this.inventoryItemsContainer) {
      this.inventoryItemsContainer.setVisible(visible);
    }

    const shouldShowScrollbar = visible && this.inventoryMaxScrollY > 0;

    if (this.inventoryScrollbarTrack) {
      this.inventoryScrollbarTrack.setVisible(shouldShowScrollbar);
    }

    if (this.inventoryScrollbarThumb) {
      this.inventoryScrollbarThumb.setVisible(shouldShowScrollbar);
    }

    this.isDraggingInventory = false;

    if (isModalOpen) {
      this.didDragInventory = false;
    }
  }

  private registerInventoryListObjects(objects: Phaser.GameObjects.GameObject[]): void {
    if (objects.length === 0) {
      return;
    }

    this.inventoryListObjects.push(...objects);
    this.cameras.main.ignore(objects);
  }

  private createLocalRoundedPanelAsObjects(config: {
    width: number;
    height: number;
    radius?: number;
    color?: number;
    alpha?: number;
    strokeColor?: number;
    strokeAlpha?: number;
    strokeWidth?: number;
  }): Phaser.GameObjects.GameObject[] {
    const radius = config.radius ?? 20;
    const color = config.color ?? INVENTORY_DARK.stone;
    const alpha = config.alpha ?? 0.95;
    const strokeColor = config.strokeColor ?? INVENTORY_DARK.bronze;
    const strokeAlpha = config.strokeAlpha ?? 0.5;
    const strokeWidth = config.strokeWidth ?? 2;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(
      -config.width / 2,
      -config.height / 2 + 5,
      config.width,
      config.height,
      radius
    );

    const panel = this.add.graphics();
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(
      -config.width / 2,
      -config.height / 2,
      config.width,
      config.height,
      radius
    );
    panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    panel.strokeRoundedRect(
      -config.width / 2,
      -config.height / 2,
      config.width,
      config.height,
      radius
    );

    return [shadow, panel];
  }

  private createLocalUiButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    accentColor: number;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
    small?: boolean;
  }) {
    const radius = Math.min(16, config.height / 2);
    const danger = config.danger ?? false;
    const disabled = config.disabled ?? false;

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
    shadow.fillStyle(0x000000, 0.32);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 3,
      config.width,
      config.height,
      radius
    );

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

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: config.small ? '11px' : '15px',
      color: textColor,
      align: 'center',
      wordWrap: {
        width: config.width - 12,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5);

    const zone = this.add.zone(config.x, config.y, config.width, config.height);

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

  private createInventoryScrollbar(layout: InventoryLayout) {
    this.inventoryScrollbarTrack?.destroy();
    this.inventoryScrollbarThumb?.destroy();

    const trackTop = this.inventoryViewportTop + 6;
    const trackBottom = this.inventoryViewportBottom - 6;
    const trackHeight = Math.max(36, trackBottom - trackTop);
    const x = layout.centerX + layout.contentWidth / 2 - 13;

    this.inventoryScrollbarTrack = this.add.rectangle(
      x,
      trackTop + trackHeight / 2,
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

    this.inventoryListCamera?.ignore([
      this.inventoryScrollbarTrack,
      this.inventoryScrollbarThumb,
    ]);
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
    this.inventoryPointerDownHandler = (pointer: Phaser.Input.Pointer) => {
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
    };

    this.inventoryPointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
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
      this.updateInventoryItemsContainerPosition();
      this.renderInventoryContent(layout);
      this.updateInventoryScrollbar(layout);
    };

    this.inventoryPointerUpHandler = () => {
      this.isDraggingInventory = false;

      this.time.delayedCall(80, () => {
        this.didDragInventory = false;
      });
    };

    this.input.on('pointerdown', this.inventoryPointerDownHandler);
    this.input.on('pointermove', this.inventoryPointerMoveHandler);
    this.input.on('pointerup', this.inventoryPointerUpHandler);
    this.input.on('pointerupoutside', this.inventoryPointerUpHandler);
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

  private updateInventoryItemsContainerPosition(): void {
    if (!this.inventoryItemsContainer) {
      return;
    }

    this.inventoryItemsContainer.setY(this.inventoryViewportTop - this.inventoryScrollY);
  }

  update() {
    const layout = this.getLayout();

    if (!this.inventoryItemsContainer || this.isItemInfoOpen || this.isRestartingInventory || this.isDraggingInventory) {
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

    if (scrollChanged) {
      this.updateInventoryItemsContainerPosition();
    }

    if (scrollChanged && renderChanged) {
      this.renderInventoryContent(layout);
      this.updateInventoryScrollbar(layout);
      return;
    }

    if (scrollChanged) {
      this.updateInventoryScrollbar(layout);
    }
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
        this.closeConfirmModalSafely();
        this.refreshInventoryAfterAction();
      },
    });
  }

  private showItemInfo(inventoryItem: InventoryItem) {
    if (this.isItemInfoOpen || this.isRestartingInventory) {
      return;
    }

    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return;
    }

    this.hideEquipmentTooltip();
    this.isItemInfoOpen = true;
    this.setInventoryListModalMode(true);

    const layout = this.getLayout();

    const equipped = isItemEquipped(player, inventoryItem.instanceId);
    const sellPrice = getItemSellPrice(item, inventoryItem.upgradeLevel);
    const canSellItems = this.canSellItems();

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
      canSellItems ? `Цена продажи: ${sellPrice} золота` : 'Продажа: недоступна во время забега',
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
    const equipButtonY = canSellItems ? bottom - 150 : bottom - 112;
    const closeButtonY = canSellItems ? bottom - 38 : bottom - 56;

    const equipButton = this.createUiButton({
      x: layout.centerX,
      y: equipButtonY,
      width: buttonWidth,
      height: 48,
      text: equipped ? 'Уже надето' : 'Надеть',
      accentColor: INVENTORY_DARK.cold,
      disabled: equipped,
      onClick: () => {
        if (equipped) {
          return;
        }

        this.isDraggingInventory = false;
        this.didDragInventory = false;

        equipItem(player, inventoryItem.instanceId);
        void saveGameAsync();

        this.closeItemInfo(false);
        this.refreshInventoryAfterAction();
      },
      depth: 1010,
    });

    const sellButton = canSellItems
      ? this.createUiButton({
          x: layout.centerX,
          y: bottom - 94,
          width: buttonWidth,
          height: 48,
          text: `Продать за ${sellPrice}`,
          accentColor: INVENTORY_DARK.red,
          danger: true,
          disabled: equipped,
          onClick: () => {
            this.closeItemInfo(false);
            this.showSellConfirm(inventoryItem);
          },
          depth: 1010,
        })
      : undefined;

    const closeButton = this.createUiButton({
      x: layout.centerX,
      y: closeButtonY,
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
      ...(sellButton?.objects ?? []),
      ...closeButton.objects,
    ]);

    this.inventoryListCamera?.ignore(modal);
  }

  private getEquippedInventoryItemForSlot(slot: EquipmentSlot) {
    const equippedInstanceId = player.equipment[slot];

    if (!equippedInstanceId) {
      return undefined;
    }

    return player.inventory.find((item: InventoryItem) => item.instanceId === equippedInstanceId);
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
    if (!this.canSellItems()) {
      this.showMessage('Во время подготовки и забега продавать предметы нельзя.');
      return;
    }

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
        this.closeConfirmModalSafely();
        this.refreshInventoryAfterAction();
      },
    });
  }

  private showMassSellConfirm() {
    if (!this.canSellItems()) {
      this.showMessage('Во время подготовки и забега массовая продажа недоступна.');
      return;
    }

    const itemsToSell = player.inventory.filter((inventoryItem: InventoryItem) => {
      const item = getBaseItemFromInventoryItem(inventoryItem);

      if (!item) {
        return false;
      }

      if (isItemEquipped(player, inventoryItem.instanceId)) {
        return false;
      }

      return item.rarity === 'common';
    });

    const totalGold = itemsToSell.reduce((sum: number, inventoryItem: InventoryItem) => {
      const item = getBaseItemFromInventoryItem(inventoryItem);

      if (!item) {
        return sum;
      }

      return sum + getItemSellPrice(item, inventoryItem.upgradeLevel);
    }, 0);

    const itemNames = itemsToSell
      .slice(0, 5)
      .map((inventoryItem: InventoryItem) => {
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
      .filter((line: string) => line.length > 0);

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
          this.setInventoryListModalMode(false);
          return;
        }

        itemsToSell.forEach((inventoryItem: InventoryItem) => {
          sellItem(player, inventoryItem.instanceId);
        });

        void saveGameAsync();
        this.closeConfirmModalSafely();
        this.refreshInventoryAfterAction();
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
        this.closeConfirmModalSafely();
        this.refreshInventoryAfterAction();
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
    if (this.isRestartingInventory) {
      return;
    }

    if (this.itemInfoContainer) {
      return;
    }

    this.isItemInfoOpen = true;
    this.setInventoryListModalMode(true);

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
        this.closeConfirmModalSafely();
        try {
          callback();
        } catch (error) {
          this.closeConfirmModalSafely();
          throw error;
        }
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
          this.closeConfirmModalSafely();
        },
        depth: 1010,
      });

      objects.push(...cancelButton.objects);
    }

    modal.add(objects);

    this.inventoryListCamera?.ignore(modal);
  }

  private closeItemInfo(restoreInventoryList = true) {
    this.hideEquipmentTooltip();

    if (this.itemInfoContainer) {
      this.itemInfoContainer.destroy(true);
      this.itemInfoContainer = undefined;
    }

    this.isItemInfoOpen = false;
    this.isDraggingInventory = false;
    this.didDragInventory = false;

    if (restoreInventoryList) {
      this.setInventoryListModalMode(false);
    }
  }

  private closeConfirmModalSafely(): void {
    this.closeItemInfo(true);
  }

  private rebuildCategoryTabsOnly(): void {
    this.shouldPlayInventoryIntroAnimation = false;

    const layout = this.getLayout();
    this.createCategoryTabs(layout);
  }

  private rebuildInventoryListOnly(): void {
    this.shouldPlayInventoryIntroAnimation = false;

    const layout = this.getLayout();

    this.initialInventoryScrollY = Phaser.Math.Clamp(
      this.inventoryTargetScrollY,
      0,
      Math.max(0, this.inventoryMaxScrollY)
    );

    this.isItemInfoOpen = false;
    this.isDraggingInventory = false;
    this.didDragInventory = false;
    this.setInventoryListModalMode(false);

    this.createInventoryList(layout);
  }

  private refreshInventoryAfterAction(): void {
    if (this.isRestartingInventory) {
      return;
    }

    this.closeConfirmModalSafely();
    this.setInventoryListModalMode(false);

    this.restartInventory();
  }

  private removeInventoryScrollHandlers(): void {
    if (this.inventoryPointerDownHandler) {
      this.input.off('pointerdown', this.inventoryPointerDownHandler);
      this.inventoryPointerDownHandler = undefined;
    }

    if (this.inventoryPointerMoveHandler) {
      this.input.off('pointermove', this.inventoryPointerMoveHandler);
      this.inventoryPointerMoveHandler = undefined;
    }

    if (this.inventoryPointerUpHandler) {
      this.input.off('pointerup', this.inventoryPointerUpHandler);
      this.input.off('pointerupoutside', this.inventoryPointerUpHandler);
      this.inventoryPointerUpHandler = undefined;
    }

    if (this.inventoryWheelHandler) {
      this.input.off('wheel', this.inventoryWheelHandler);
      this.inventoryWheelHandler = undefined;
    }
  }

  private destroyObjects(objects: Phaser.GameObjects.GameObject[]): void {
    objects.forEach(object => {
      if (!object) {
        return;
      }

      this.tweens.killTweensOf(object);
      object.destroy();
    });
  }

  private cleanupInventoryListOnly(keepCamera = false): void {
    this.removeInventoryScrollHandlers();

    // Не destroy(): в Phaser 4 WebGL ручное уничтожение дополнительной камеры
    // при shutdown/restart может падать с customViewports = null.
    // При перестройке вкладок камеру оставляем и переиспользуем,
    // при полном shutdown просто забываем ссылку — Phaser очистит её сам.
    if (!keepCamera) {
      this.inventoryListCamera = undefined;
    }

    this.inventoryItemsContainer?.destroy(true);
    this.inventoryItemsContainer = undefined;

    this.inventoryScrollbarTrack?.destroy();
    this.inventoryScrollbarThumb?.destroy();
    this.inventoryScrollbarTrack = undefined;
    this.inventoryScrollbarThumb = undefined;

    this.destroyObjects(this.inventoryListUiObjects);
    this.inventoryListUiObjects = [];
    this.inventoryListObjects = [];
  }

  private cleanupInventoryScene(): void {
    this.hideEquipmentTooltip();
    this.closeItemInfo(false);
    this.cleanupInventoryListOnly();
    this.destroyObjects(this.inventoryTabObjects);
    this.inventoryTabObjects = [];

    this.isItemInfoOpen = false;
    this.isDraggingInventory = false;
    this.didDragInventory = false;
    this.isRestartingInventory = false;
  }

  private restartInventory() {
    this.hideEquipmentTooltip();

    if (this.isRestartingInventory) {
      return;
    }

    const scrollY = Phaser.Math.Clamp(
      this.inventoryTargetScrollY,
      0,
      Math.max(0, this.inventoryMaxScrollY)
    );

    const selectedCategory = this.selectedCategory;
    const returnScene = this.returnScene;

    this.isRestartingInventory = true;
    this.isItemInfoOpen = false;
    this.isDraggingInventory = false;
    this.didDragInventory = false;

    if (this.itemInfoContainer) {
      this.itemInfoContainer.destroy(true);
      this.itemInfoContainer = undefined;
    }

    this.setInventoryListModalMode(false);

    this.time.delayedCall(0, () => {
      this.scene.restart({
        inventoryScrollY: scrollY,
        selectedCategory,
        returnScene,
        skipIntroAnimation: true,
      });
    });
  }

  private getTotalMaterialsCount() {
    return Object.values(player.materials ?? {}).reduce((sum: number, amount: unknown) => {
      return sum + (typeof amount === 'number' ? amount : 0);
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
      };

      target.setAlpha?.(alpha);
    });
  }
}
