import Phaser from 'phaser';

import { player, type EquipmentSlot, type InventoryItem } from '../data/player';
import type { ItemData } from '../data/items';

import {
  createItemStatsText,
  getBaseItemFromInventoryItem,
  getRarityColorHex,
  getRarityStrokeColor,
  getRarityText,
  getSlotIcon,
  getSlotText,
  getWeaponTypeText,
  isItemEquipped,
} from '../systems/InventorySystem';

import {
  canUpgradeAnvil,
  getAnvilUpgradeCost,
  upgradeAnvil,
} from '../systems/ForgeSystem';
import { trackWeaponUpgraded } from '../systems/QuestSystem';

import { getMaterialName, type MaterialId } from '../data/materials';
import { saveGameAsync } from '../systems/SaveSystem';

import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type ForgeCategory = 'weapon' | 'armor' | 'trinket';

type ForgeLayout = {
  width: number;
  height: number;
  centerX: number;

  safeX: number;
  safeTop: number;
  safeBottom: number;

  contentWidth: number;

  headerTop: number;
  headerHeight: number;

  resourcesTop: number;
  resourcesHeight: number;

  anvilTop: number;
  anvilHeight: number;

  materialsTop: number;
  materialsHeight: number;

  tabsTop: number;
  tabsHeight: number;

  itemsPanelTop: number;
  itemsPanelHeight: number;
  itemsListTop: number;
  itemsListBottom: number;
  itemsListHeight: number;
  itemsPanelBottom: number;
  itemsActionBottom: number;

  bottomBarHeight: number;
  bottomButtonY: number;

  compact: boolean;
  veryCompact: boolean;
};

type UpgradeCost = {
  gold: number;
  materials: Array<{
    id: MaterialId;
    amount: number;
  }>;
};

type ForgeButtonVariant = 'gold' | 'green' | 'red' | 'dark' | 'disabled';

type ForgeButton = {
  objects: Phaser.GameObjects.GameObject[];
  zone: Phaser.GameObjects.Zone;
};

const FORGE = {
  black: 0x020203,
  void: 0x050607,
  graphite: 0x0b0d11,
  graphiteSoft: 0x11141a,
  stone: 0x151820,
  stoneLight: 0x1e222b,
  soot: 0x080604,
  ash: 0x8f8879,
  ashText: '#9f9788',

  bronze: 0x6f5434,
  bronzeDark: 0x342416,
  gold: 0xb9985b,
  goldSoft: 0xd6c08a,

  ember: 0x9a4a25,
  emberDark: 0x4a1c13,
  red: 0x9c3532,

  cold: 0x5f7f9d,
  coldText: '#8fb6d8',
  violet: 0x5d457d,
  green: 0x6f8f76,
};

const MATERIAL_IDS: MaterialId[] = [
  'darkened_bone',
  'dim_gem',
  'old_leather',
  'dark_flame_heart',
  'black_gem',
  'cursed_seal',
  'black_sarcophagus_shard',
];

export class ForgeScene extends Phaser.Scene {
  private contentContainer?: Phaser.GameObjects.Container;
  private contentMaskGraphics?: Phaser.GameObjects.Graphics;
  private itemsContainer?: Phaser.GameObjects.Container;
  private itemsMaskGraphics?: Phaser.GameObjects.Graphics;
  private itemsGeometryMask?: ReturnType<Phaser.GameObjects.Graphics['createGeometryMask']>;
  private itemsScrollbarTrack?: Phaser.GameObjects.Rectangle;
  private itemsScrollbarThumb?: Phaser.GameObjects.Rectangle;
  private itemsViewportCoverObjects: Phaser.GameObjects.GameObject[] = [];
  private itemsTopCover?: Phaser.GameObjects.Rectangle;
  private itemsBottomCover?: Phaser.GameObjects.Rectangle;
  private modalContainer?: Phaser.GameObjects.Container;

  private selectedCategory: ForgeCategory = 'weapon';

  private itemsScrollY = 0;
  private itemsTargetScrollY = 0;
  private itemsMaxScrollY = 0;

  private itemsListTop = 0;
  private itemsListBottom = 0;
  private itemsListHeight = 0;

  private itemsLastRenderedScrollY = -1;

  private isDraggingItems = false;
  private didDragItems = false;
  private itemsDragStartY = 0;
  private itemsDragStartScrollY = 0;

  private isModalOpen = false;
  private isActionLocked = false;

  constructor() {
    super('ForgeScene');
  }

  init(data?: {
    selectedCategory?: ForgeCategory;
    scrollY?: number;
  }) {
    this.selectedCategory = data?.selectedCategory ?? 'weapon';

    this.itemsScrollY = data?.scrollY ?? 0;
    this.itemsTargetScrollY = data?.scrollY ?? 0;
    this.itemsMaxScrollY = 0;
    this.itemsLastRenderedScrollY = -1;

    this.isDraggingItems = false;
    this.didDragItems = false;
    this.itemsDragStartY = 0;
    this.itemsDragStartScrollY = 0;

    this.isModalOpen = false;
    this.isActionLocked = false;

    this.contentContainer = undefined;
    this.contentMaskGraphics = undefined;
    this.itemsContainer = undefined;
    this.itemsMaskGraphics = undefined;
    this.itemsGeometryMask = undefined;
    this.itemsScrollbarTrack = undefined;
    this.itemsScrollbarThumb = undefined;
    this.itemsViewportCoverObjects = [];
    this.itemsTopCover = undefined;
    this.itemsBottomCover = undefined;
    this.modalContainer = undefined;
  }

  create() {
    const layout = this.getLayout();

    createSceneBackground(this);
    this.createForgeBackdrop(layout);
    this.createHeader(layout);
    this.createResourcePanel(layout);
    this.createScrollableContent(layout);
    this.createItemsViewport(layout);
    this.createBottomBar(layout);
  }

  update() {
    if (!this.itemsContainer || this.isModalOpen || this.isDraggingItems) {
      return;
    }

    if (Math.abs(this.itemsScrollY - this.itemsTargetScrollY) < 0.4) {
      this.itemsScrollY = this.itemsTargetScrollY;
    } else {
      this.itemsScrollY = Phaser.Math.Linear(
        this.itemsScrollY,
        this.itemsTargetScrollY,
        0.22
      );
    }

    const layout = this.getLayout();

    this.renderVisibleForgeItems(layout);
    this.updateItemsScrollbar(layout);
  }

  private getLayout(): ForgeLayout {
    const { width, height } = this.scale;

    const compact = height < 900;
    const veryCompact = height < 740;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 16, 30);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.014), 8, 20);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.018), 12, 26);

    const contentWidth = Math.min(width - safeX * 2, 640);

    const bottomBarHeight = veryCompact ? 60 : compact ? 68 : 78;
    const bottomButtonY = height - safeBottom - bottomBarHeight / 2 + (veryCompact ? 3 : 5);
    const itemsActionBottom = height - bottomBarHeight - safeBottom - (veryCompact ? 14 : compact ? 18 : 22);

    const gapTiny = veryCompact ? 4 : compact ? 5 : 7;
    const gap = veryCompact ? 5 : compact ? 7 : 8;

    const headerTop = safeTop;
    const headerHeight = veryCompact ? 42 : compact ? 52 : 60;

    const resourcesTop = headerTop + headerHeight + gapTiny;
    const resourcesHeight = veryCompact ? 38 : compact ? 44 : 50;

    const anvilTop = resourcesTop + resourcesHeight + gap;
    const anvilHeight = veryCompact ? 68 : compact ? 78 : 88;

    const materialsTop = anvilTop + anvilHeight + gap;
    const materialsHeight = veryCompact ? 48 : compact ? 70 : 84;

    const tabsTop = materialsTop + materialsHeight + gap;
    const tabsHeight = veryCompact ? 40 : compact ? 46 : 50;

    const itemsPanelTop = tabsTop + tabsHeight + (veryCompact ? 12 : 14);
    const minItemsHeight = veryCompact ? 174 : compact ? 224 : 274;
    const itemsPanelHeight = Math.max(minItemsHeight, itemsActionBottom - itemsPanelTop);
    const itemsListTop = itemsPanelTop + (veryCompact ? 46 : compact ? 54 : 58);
    const itemsListBottom = Math.min(
      itemsPanelTop + itemsPanelHeight - (veryCompact ? 22 : compact ? 26 : 30),
      itemsActionBottom - (veryCompact ? 24 : compact ? 28 : 32)
    );
    const itemsListHeight = Math.max(132, itemsListBottom - itemsListTop);
    const itemsPanelBottom = itemsPanelTop + itemsPanelHeight;

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      contentWidth,

      headerTop,
      headerHeight,

      resourcesTop,
      resourcesHeight,

      anvilTop,
      anvilHeight,

      materialsTop,
      materialsHeight,

      tabsTop,
      tabsHeight,

      itemsPanelTop,
      itemsPanelHeight,
      itemsListTop,
      itemsListBottom,
      itemsListHeight,
      itemsPanelBottom,
      itemsActionBottom,

      bottomBarHeight,
      bottomButtonY,

      compact,
      veryCompact,
    };
  }

  private createForgeBackdrop(layout: ForgeLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, 0x020203, 1).setDepth(0);

    const wall = this.add.graphics().setDepth(1);
    wall.fillStyle(0x06070a, 0.94);
    wall.fillRect(0, 0, width, height);

    for (let i = 0; i < 9; i += 1) {
      const y = layout.safeTop + 72 + i * Math.max(42, height * 0.065);
      wall.lineStyle(1, 0x1b1714, 0.2);
      wall.beginPath();
      wall.moveTo(layout.safeX, y);
      wall.lineTo(width - layout.safeX, y + (i % 2 === 0 ? 7 : -5));
      wall.strokePath();
    }

    const forgeY = layout.safeTop + (layout.veryCompact ? 96 : layout.compact ? 116 : 132);
    const archWidth = Math.min(layout.contentWidth * 0.86, 520);
    const archHeight = layout.veryCompact ? 92 : layout.compact ? 112 : 134;

    this.add.ellipse(centerX, forgeY + 18, archWidth, archHeight, 0x0b0807, 0.86)
      .setStrokeStyle(2, FORGE.bronzeDark, 0.54)
      .setDepth(2);

    this.add.rectangle(centerX, forgeY + archHeight * 0.34, archWidth + 54, layout.veryCompact ? 16 : 22, 0x120c08, 0.92)
      .setStrokeStyle(1, FORGE.bronze, 0.26)
      .setDepth(3);

    const emberGlow = this.add.circle(centerX, forgeY + archHeight * 0.42, width * 0.44, FORGE.ember, 0.075)
      .setDepth(2);
    const hotCore = this.add.circle(centerX, forgeY + archHeight * 0.44, width * 0.17, FORGE.gold, 0.06)
      .setDepth(2);
    const violetBack = this.add.circle(centerX, forgeY + archHeight * 0.18, width * 0.5, FORGE.violet, 0.045)
      .setDepth(1);

    this.tweens.add({
      targets: [emberGlow, hotCore],
      alpha: { from: 0.045, to: 0.12 },
      scaleX: { from: 0.96, to: 1.04 },
      scaleY: { from: 0.96, to: 1.04 },
      duration: 1650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tweens.add({
      targets: violetBack,
      alpha: { from: 0.026, to: 0.055 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const runeY = forgeY - archHeight * 0.22;
    ['ᚱ', 'ᚨ', 'ᚾ', 'ᛟ', 'ᛉ'].forEach((rune, index) => {
      this.add.text(centerX - 84 + index * 42, runeY + (index % 2 === 0 ? 0 : 7), rune, {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '15px' : '18px',
        color: '#6f5434',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0.22).setDepth(3);
    });

    const sparkCount = layout.veryCompact ? 13 : 18;
    for (let i = 0; i < sparkCount; i += 1) {
      const x = centerX - archWidth * 0.36 + (i * 37) % Math.max(1, Math.floor(archWidth * 0.72));
      const y = forgeY + archHeight * 0.36 + (i % 5) * 7;
      const spark = this.add.circle(x, y, i % 3 === 0 ? 2 : 1.25, i % 2 === 0 ? FORGE.gold : FORGE.ember, 0.44)
        .setDepth(4);

      this.tweens.add({
        targets: spark,
        y: y - Phaser.Math.Clamp(34 + (i % 4) * 10, 30, 74),
        x: x + (i % 2 === 0 ? 9 : -7),
        alpha: { from: 0.5, to: 0 },
        duration: 1550 + i * 80,
        delay: i * 110,
        repeat: -1,
        ease: 'Sine.easeOut',
      });
    }

    const dustCount = layout.veryCompact ? 18 : 26;
    for (let i = 0; i < dustCount; i += 1) {
      const x = layout.safeX + 10 + (i * 71) % Math.max(1, width - layout.safeX * 2 - 20);
      const y = layout.safeTop + 62 + (i * 97) % Math.max(1, height - layout.safeTop - layout.safeBottom - 130);
      const dust = this.add.circle(x, y, 1 + (i % 2), i % 4 === 0 ? FORGE.cold : FORGE.ash, 0.026)
        .setDepth(2);

      if (i < 12) {
        this.tweens.add({
          targets: dust,
          y: y - 14 - (i % 3) * 6,
          alpha: { from: 0.018, to: 0.05 },
          duration: 2600 + i * 70,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }

  private createHeader(layout: ForgeLayout) {
    const panelY = layout.headerTop + layout.headerHeight / 2;

    this.createStonePanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: layout.headerHeight,
      radius: 24,
      fill: FORGE.graphite,
      alpha: 0.94,
      stroke: FORGE.bronze,
      strokeAlpha: 0.52,
      glow: FORGE.ember,
      depth: 120,
    });

    this.add.circle(
      layout.centerX - layout.contentWidth / 2 + 34,
      panelY,
      layout.veryCompact ? 15 : 18,
      FORGE.ember,
      0.18
    ).setStrokeStyle(1, FORGE.gold, 0.44).setDepth(126);

    this.add.text(layout.centerX - layout.contentWidth / 2 + 34, panelY, '⚒', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '14px' : '17px',
      color: '#d6c08a',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5).setDepth(127);

    this.add.text(layout.centerX + 10, panelY, 'Кузница Пепельного Молота', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '21px' : layout.compact ? '24px' : '27px',
      color: '#d6c08a',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 92,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(127);
  }

  private createResourcePanel(layout: ForgeLayout) {
    const panelY = layout.resourcesTop + layout.resourcesHeight / 2;

    this.createStonePanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: layout.resourcesHeight,
      radius: 22,
      fill: FORGE.soot,
      alpha: 0.96,
      stroke: FORGE.bronze,
      strokeAlpha: 0.4,
      glow: FORGE.gold,
      depth: 110,
    });

    const gap = layout.veryCompact ? 6 : 9;
    const chipWidth = Math.floor((layout.contentWidth - 36 - gap * 2) / 3);
    const startX = layout.centerX - chipWidth - gap;

    this.createResourceChip({
      x: startX,
      y: panelY,
      width: chipWidth,
      height: layout.veryCompact ? 44 : 50,
      icon: '◆',
      label: 'Золото',
      value: `${player.gold}`,
      color: FORGE.gold,
      compact: layout.veryCompact,
    });

    this.createResourceChip({
      x: layout.centerX,
      y: panelY,
      width: chipWidth,
      height: layout.veryCompact ? 44 : 50,
      icon: '◇',
      label: 'Материалы',
      value: `${this.getTotalMaterialCount()}`,
      color: FORGE.cold,
      compact: layout.veryCompact,
    });

    this.createResourceChip({
      x: layout.centerX + chipWidth + gap,
      y: panelY,
      width: chipWidth,
      height: layout.veryCompact ? 44 : 50,
      icon: '⚒',
      label: 'Наковальня',
      value: `Ур. ${player.anvilLevel}`,
      color: player.anvilLevel >= 2 ? FORGE.green : FORGE.ember,
      compact: layout.veryCompact,
    });
  }

  private createScrollableContent(layout: ForgeLayout) {
    this.contentContainer?.destroy(true);
    this.contentMaskGraphics?.destroy();

    this.contentContainer = this.add.container(0, 0).setDepth(250);

    this.createAnvilPanel(layout, layout.anvilTop);
    this.createMaterialsPanel(layout, layout.materialsTop);
    this.createCategoryTabs(layout, layout.tabsTop);
  }

  private createItemsViewport(layout: ForgeLayout) {
    this.itemsContainer?.destroy(true);
    this.itemsMaskGraphics?.destroy();
    this.itemsScrollbarTrack?.destroy();
    this.itemsScrollbarThumb?.destroy();
    this.clearItemsViewportCovers();

    this.itemsListTop = layout.itemsListTop;
    this.itemsListBottom = layout.itemsListBottom;
    this.itemsListHeight = layout.itemsListHeight;

    const itemsContainer = this.add.container(0, 0).setDepth(80);
    const maskGraphics = this.add.graphics().setDepth(79);

    maskGraphics.setVisible(false);
    maskGraphics.fillStyle(0xffffff, 1);
    const listLeft = layout.centerX - layout.contentWidth / 2 + 22;
    const listWidth = layout.contentWidth - 44;

    maskGraphics.fillRect(
      listLeft,
      this.itemsListTop,
      listWidth,
      this.itemsListHeight
    );

    const geometryMask = maskGraphics.createGeometryMask();
    itemsContainer.setMask(geometryMask);

    this.itemsContainer = itemsContainer;
    this.itemsMaskGraphics = maskGraphics;
    this.itemsGeometryMask = geometryMask;

    const items = this.getForgeItemsByCategory(this.selectedCategory);
    const title = this.getCategoryTitle(this.selectedCategory);
    const icon = this.getCategoryIcon(this.selectedCategory);

    this.createStonePanel({
      x: layout.centerX,
      y: layout.itemsPanelTop + layout.itemsPanelHeight / 2,
      width: layout.contentWidth,
      height: layout.itemsPanelHeight,
      radius: layout.veryCompact ? 22 : 28,
      fill: FORGE.soot,
      alpha: 0.965,
      stroke: FORGE.bronze,
      strokeAlpha: 0.42,
      glow: FORGE.violet,
      depth: 62,
    });

    const left = layout.centerX - layout.contentWidth / 2;
    const right = layout.centerX + layout.contentWidth / 2;
    const headerY = layout.itemsPanelTop + (layout.veryCompact ? 28 : 32);

    this.add.circle(left + 34, headerY, layout.veryCompact ? 18 : 21, FORGE.ember, 0.14)
      .setStrokeStyle(1, FORGE.gold, 0.5)
      .setDepth(230);

    this.add.text(left + 34, headerY, icon, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '14px' : '17px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5).setDepth(231);

    this.add.text(left + 62, headerY - (layout.veryCompact ? 8 : 10), title, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '17px' : layout.compact ? '19px' : '22px',
      color: '#d6c08a',
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: layout.contentWidth - 170,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(231);

    this.add.text(left + 62, headerY + (layout.veryCompact ? 11 : 13), 'Закалка выбранной добычи.', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '11px',
      color: '#8f8879',
      wordWrap: {
        width: layout.contentWidth - 170,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(231);

    this.add.text(right - 24, headerY, `${items.length} шт.`, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '11px' : '12px',
      color: '#9f9788',
      align: 'right',
      wordWrap: {
        width: 96,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(231);

    this.createItemsCovers(layout);
    this.createItemsFadeCovers(layout);
    this.itemsMaxScrollY = Math.max(0, this.getForgeItemsContentHeight(layout) - this.itemsListHeight);
    this.itemsScrollY = Phaser.Math.Clamp(this.itemsScrollY, 0, this.itemsMaxScrollY);
    this.itemsTargetScrollY = Phaser.Math.Clamp(this.itemsTargetScrollY, 0, this.itemsMaxScrollY);
    this.itemsLastRenderedScrollY = -1;

    this.createItemsScrollHandlers(layout);
    this.createItemsScrollbar(layout);
    this.renderVisibleForgeItems(layout, true);
    this.updateItemsScrollbar(layout);

    this.tweens.add({
      targets: itemsContainer,
      alpha: { from: 0, to: 1 },
      duration: 220,
      ease: 'Sine.easeOut',
    });
  }


  private clearItemsViewportCovers() {
    this.itemsViewportCoverObjects.forEach(object => {
      object.destroy();
    });

    this.itemsViewportCoverObjects = [];
    this.itemsTopCover = undefined;
    this.itemsBottomCover = undefined;
  }

  private createItemsCovers(layout: ForgeLayout) {
    const coverColor = FORGE.soot;
    const coverDepth = 100;
    const coverWidth = layout.width;

    this.itemsTopCover?.destroy();
    this.itemsBottomCover?.destroy();

    const topCoverHeight = Math.max(0, this.itemsListTop);
    const bottomCoverHeight = Math.max(0, layout.height - this.itemsListBottom);

    if (topCoverHeight > 0) {
      const topCover = this.add.rectangle(
        layout.centerX,
        topCoverHeight / 2,
        coverWidth,
        topCoverHeight,
        coverColor,
        0.985
      ).setDepth(coverDepth);

      this.itemsTopCover = topCover;
      this.itemsViewportCoverObjects.push(topCover);
    }

    if (bottomCoverHeight > 0) {
      const bottomCover = this.add.rectangle(
        layout.centerX,
        this.itemsListBottom + bottomCoverHeight / 2,
        coverWidth,
        bottomCoverHeight,
        coverColor,
        0.985
      ).setDepth(coverDepth);

      this.itemsBottomCover = bottomCover;
      this.itemsViewportCoverObjects.push(bottomCover);
    }

    const sideShadeWidth = 22;
    const leftShade = this.add.rectangle(
      layout.centerX - layout.contentWidth / 2 + sideShadeWidth / 2,
      this.itemsListTop + this.itemsListHeight / 2,
      sideShadeWidth,
      this.itemsListHeight,
      coverColor,
      0.76
    ).setDepth(coverDepth + 1);

    const rightShade = this.add.rectangle(
      layout.centerX + layout.contentWidth / 2 - sideShadeWidth / 2,
      this.itemsListTop + this.itemsListHeight / 2,
      sideShadeWidth,
      this.itemsListHeight,
      coverColor,
      0.76
    ).setDepth(coverDepth + 1);

    this.itemsViewportCoverObjects.push(leftShade, rightShade);
  }

  private getForgeItemsContentHeight(layout: ForgeLayout) {
    const items = this.getForgeItemsByCategory(this.selectedCategory);

    if (items.length === 0) {
      return this.itemsListHeight;
    }

    const cardHeight = this.getForgeItemCardHeight(layout);
    const spacing = this.getForgeItemSpacing(layout);

    return items.length * spacing - (spacing - cardHeight) + 28;
  }

  private renderVisibleForgeItems(layout: ForgeLayout, force = false) {
    if (!this.itemsContainer) {
      return;
    }

    if (!force && Math.abs(this.itemsScrollY - this.itemsLastRenderedScrollY) < 0.75) {
      return;
    }

    const container = this.itemsContainer;

    this.itemsLastRenderedScrollY = this.itemsScrollY;
    this.clearVisibleForgeItems();

    const items = this.getForgeItemsByCategory(this.selectedCategory);

    if (items.length === 0) {
      this.createEmptyState(container, layout, this.itemsListTop + this.itemsListHeight / 2);
      return;
    }

    const cardHeight = this.getForgeItemCardHeight(layout);
    const spacing = this.getForgeItemSpacing(layout);
    const renderBuffer = 100;
    const topPadding = layout.veryCompact ? 8 : 10;

    items.forEach((inventoryItem, index) => {
      const y = this.itemsListTop + topPadding + cardHeight / 2 + index * spacing - this.itemsScrollY;

      if (y + cardHeight / 2 < this.itemsListTop - renderBuffer) {
        return;
      }

      if (y - cardHeight / 2 > this.itemsListBottom + renderBuffer) {
        return;
      }

      const alpha = this.getItemCardEdgeAlpha(y, cardHeight);

      if (alpha <= 0.02) {
        return;
      }

      this.createItemCard(container, layout, inventoryItem, y, cardHeight, alpha);
    });
  }

  private getItemsEdgeFadeZone() {
    return 72;
  }

  private getItemCardEdgeAlpha(y: number, cardHeight: number) {
    const fadeZone = this.getItemsEdgeFadeZone();
    const half = cardHeight / 2;

    let alpha = 1;

    const topFadeStart = this.itemsListTop + fadeZone;
    const bottomFadeStart = this.itemsListBottom - fadeZone;

    if (y - half < topFadeStart) {
      const visibleDistance = y + half - this.itemsListTop;
      alpha = Math.min(
        alpha,
        Phaser.Math.Clamp(visibleDistance / fadeZone, 0, 1)
      );
    }

    if (y + half > bottomFadeStart) {
      const visibleDistance = this.itemsListBottom - (y - half);
      alpha = Math.min(
        alpha,
        Phaser.Math.Clamp(visibleDistance / fadeZone, 0, 1)
      );
    }

    return Phaser.Math.Clamp(alpha, 0, 1);
  }

  private setCardObjectsAlpha(objects: Phaser.GameObjects.GameObject[], alpha: number) {
    objects.forEach(object => {
      const target = object as Phaser.GameObjects.GameObject & {
        setAlpha?: (value: number) => unknown;
        disableInteractive?: () => unknown;
      };

      target.setAlpha?.(alpha);

      if (alpha < 0.45) {
        target.disableInteractive?.();
      }
    });
  }

  private applyItemsMask(object: Phaser.GameObjects.GameObject) {
    if (!this.itemsGeometryMask) {
      return;
    }

    const target = object as Phaser.GameObjects.GameObject & {
      setMask?: (mask: ReturnType<Phaser.GameObjects.Graphics['createGeometryMask']>) => unknown;
    };

    target.setMask?.(this.itemsGeometryMask);
  }

  private applyItemsMaskToContainer(container: Phaser.GameObjects.Container) {
    this.applyItemsMask(container);

    const children = (container as Phaser.GameObjects.Container & {
      list?: Phaser.GameObjects.GameObject[];
    }).list ?? [];

    children.forEach(child => {
      this.applyItemsMask(child);

      if (child instanceof Phaser.GameObjects.Container) {
        this.applyItemsMaskToContainer(child);
      }
    });
  }

  private clearVisibleForgeItems() {
    this.itemsContainer?.removeAll(true);
  }

  private getForgeItemCardHeight(layout: ForgeLayout) {
    return layout.veryCompact ? 164 : layout.compact ? 176 : 188;
  }

  private getForgeItemSpacing(layout: ForgeLayout) {
    return this.getForgeItemCardHeight(layout) + (layout.veryCompact ? 10 : 12);
  }

  private createItemsFadeCovers(layout: ForgeLayout) {
    const listWidth = layout.contentWidth - 36;
    const steps = 8;
    const stepHeight = 10;
    const maxAlpha = 0.44;
    const fadeDepth = 106;

    for (let i = 0; i < steps; i += 1) {
      const alpha = maxAlpha * (1 - i / steps);

      const topCover = this.add.rectangle(
        layout.centerX,
        this.itemsListTop + i * stepHeight + stepHeight / 2,
        listWidth,
        stepHeight + 1,
        FORGE.soot,
        alpha
      ).setDepth(fadeDepth);

      const bottomCover = this.add.rectangle(
        layout.centerX,
        this.itemsListBottom - i * stepHeight - stepHeight / 2,
        listWidth,
        stepHeight + 1,
        FORGE.soot,
        alpha
      ).setDepth(fadeDepth);

      this.itemsViewportCoverObjects.push(topCover, bottomCover);
    }
  }

  private createItemsScrollHandlers(layout: ForgeLayout) {
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.input.off('pointerupoutside');
    this.input.off('wheel');

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isModalOpen || this.itemsMaxScrollY <= 0) {
        return;
      }

      if (!this.isPointerInsideItemsList(pointer, layout)) {
        return;
      }

      this.isDraggingItems = true;
      this.didDragItems = false;
      this.itemsDragStartY = pointer.y;
      this.itemsDragStartScrollY = this.itemsTargetScrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDraggingItems || this.isModalOpen) {
        return;
      }

      const distance = pointer.y - this.itemsDragStartY;

      if (Math.abs(distance) < 7) {
        return;
      }

      this.didDragItems = true;
      this.itemsTargetScrollY = Phaser.Math.Clamp(
        this.itemsDragStartScrollY - distance,
        0,
        this.itemsMaxScrollY
      );
      this.itemsScrollY = this.itemsTargetScrollY;

      this.renderVisibleForgeItems(layout);
      this.updateItemsScrollbar(layout);
    });

    this.input.on('pointerup', () => {
      this.isDraggingItems = false;

      this.time.delayedCall(80, () => {
        this.didDragItems = false;
      });
    });

    this.input.on('pointerupoutside', () => {
      this.isDraggingItems = false;

      this.time.delayedCall(80, () => {
        this.didDragItems = false;
      });
    });

    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _objects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        if (this.isModalOpen || this.itemsMaxScrollY <= 0) {
          return;
        }

        if (!this.isPointerInsideItemsList(pointer, layout)) {
          return;
        }

        this.itemsTargetScrollY = Phaser.Math.Clamp(
          this.itemsTargetScrollY + deltaY * 0.55,
          0,
          this.itemsMaxScrollY
        );
      }
    );
  }

  private isPointerInsideItemsList(pointer: Phaser.Input.Pointer, layout: ForgeLayout) {
    const listLeft = layout.centerX - layout.contentWidth / 2 + 22;
    const listRight = layout.centerX + layout.contentWidth / 2 - 22;

    return (
      pointer.x >= listLeft &&
      pointer.x <= listRight &&
      pointer.y >= this.itemsListTop &&
      pointer.y <= this.itemsListBottom
    );
  }

  private createItemsScrollbar(layout: ForgeLayout) {
    const trackX = layout.centerX + layout.contentWidth / 2 - 12;
    const trackHeight = this.itemsListHeight;
    const trackY = this.itemsListTop + trackHeight / 2;
    const visible = this.itemsMaxScrollY > 0;

    this.itemsScrollbarTrack = this.add.rectangle(trackX, trackY, 4, trackHeight, 0x000000, visible ? 0.28 : 0)
      .setDepth(108);

    this.itemsScrollbarThumb = this.add.rectangle(trackX, this.itemsListTop + 18, 4, 36, FORGE.gold, visible ? 0.55 : 0)
      .setDepth(109);
  }

  private updateItemsScrollbar(layout: ForgeLayout) {
    if (!this.itemsScrollbarTrack || !this.itemsScrollbarThumb) {
      return;
    }

    if (this.itemsMaxScrollY <= 0) {
      this.itemsScrollbarTrack.setAlpha(0);
      this.itemsScrollbarThumb.setAlpha(0);
      return;
    }

    const trackHeight = this.itemsListHeight;
    const thumbHeight = Phaser.Math.Clamp(
      trackHeight * (trackHeight / Math.max(trackHeight, this.getForgeItemsContentHeight(layout))),
      34,
      Math.max(34, trackHeight - 8)
    );
    const progress = this.itemsMaxScrollY <= 0 ? 0 : this.itemsScrollY / this.itemsMaxScrollY;
    const thumbY = this.itemsListTop + thumbHeight / 2 + progress * (trackHeight - thumbHeight);

    this.itemsScrollbarTrack.setAlpha(0.26);
    this.itemsScrollbarThumb.setAlpha(0.62);
    this.itemsScrollbarThumb.setDisplaySize(4, thumbHeight);
    this.itemsScrollbarThumb.setY(thumbY);
  }

  private createAnvilPanel(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const isUpgraded = player.anvilLevel >= 2;
    const canUpgrade = canUpgradeAnvil();
    const anvilCost = getAnvilUpgradeCost();
    const anvilMaterialId = anvilCost.materialId as MaterialId;
    const materialOwned = player.materials[anvilMaterialId] ?? 0;
    const enoughMaterials = materialOwned >= anvilCost.amount;
    const enoughGold = player.gold >= anvilCost.gold;
    const costReady = enoughMaterials && enoughGold;

    const panelHeight = layout.anvilHeight;
    const panelY = topY + panelHeight / 2;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 24,
      fill: isUpgraded ? 0x0b1710 : 0x120b08,
      alpha: 0.965,
      stroke: isUpgraded ? FORGE.green : FORGE.gold,
      strokeAlpha: isUpgraded ? 0.56 : 0.44,
      glow: isUpgraded ? FORGE.green : FORGE.ember,
      depth: 2,
    });

    const left = layout.centerX - layout.contentWidth / 2;
    const right = layout.centerX + layout.contentWidth / 2;
    const iconX = left + (layout.veryCompact ? 34 : 40);
    const iconRadius = layout.veryCompact ? 22 : 26;

    this.addTo(
      container,
      this.add.circle(iconX, panelY, iconRadius, isUpgraded ? 0x132019 : 0x24120b, 0.98)
        .setStrokeStyle(2, isUpgraded ? FORGE.green : FORGE.gold, 0.76)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(iconX, panelY, '⚒', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '22px' : '26px',
        color: isUpgraded ? '#9fd0a6' : '#d6c08a',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(8)
    );

    const textX = left + (layout.veryCompact ? 66 : 78);
    const buttonWidth = layout.veryCompact ? 96 : 116;
    const textWidth = Math.max(140, layout.contentWidth - buttonWidth - (layout.veryCompact ? 104 : 128));

    this.addTo(
      container,
      this.add.text(textX, topY + (layout.veryCompact ? 17 : 20), `Наковальня ${player.anvilLevel >= 2 ? 'II' : 'I'} уровня`, {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '16px' : '19px',
        color: isUpgraded ? '#9fd0a6' : '#d6c08a',
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    const stateText = isUpgraded
      ? 'Закалка высокого ранга открыта.'
      : 'Для улучшений выше +5 нужна II ступень.';

    this.addTo(
      container,
      this.add.text(textX, topY + (layout.veryCompact ? 38 : 44), stateText, {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '11px' : '12px',
        color: '#a9a091',
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.createAnvilProgress(
      container,
      textX,
      topY + panelHeight - (layout.veryCompact ? 13 : 16),
      Math.min(textWidth - 34, 260),
      8
    );

    if (!isUpgraded) {
      const costText = `${enoughGold ? '✓' : '!'} ${player.gold}/${anvilCost.gold} зол.  ${enoughMaterials ? '✓' : '!'} ${this.getShortMaterialName(anvilMaterialId)} ${materialOwned}/${anvilCost.amount}`;

      this.addTo(
        container,
        this.add.text(right - buttonWidth - 20, topY + panelHeight - (layout.veryCompact ? 14 : 17), costText, {
          fontFamily: UI.font.body,
          fontSize: layout.veryCompact ? '9px' : '10px',
          color: costReady ? '#9fd0a6' : '#d28f85',
          stroke: '#000000',
          strokeThickness: 1,
          align: 'right',
          wordWrap: {
            width: buttonWidth + 36,
            useAdvancedWrap: true,
          },
          maxLines: 1,
        }).setOrigin(1, 0.5).setDepth(8)
      );
    }

    this.createForgeButton({
      parent: container,
      x: right - buttonWidth / 2 - 18,
      y: panelY - (isUpgraded ? 0 : layout.veryCompact ? 7 : 9),
      width: buttonWidth,
      height: layout.veryCompact ? 38 : 42,
      text: isUpgraded ? 'Готово' : 'Усилить',
      disabled: isUpgraded || !canUpgrade,
      variant: isUpgraded ? 'green' : costReady ? 'gold' : 'dark',
      small: true,
      depth: 8,
      onClick: () => {
        this.handleAnvilUpgrade();
      },
    });

    return topY + panelHeight;
  }

  private createMaterialsPanel(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = layout.materialsHeight;
    const panelY = topY + panelHeight / 2;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 24,
      fill: FORGE.graphite,
      alpha: 0.945,
      stroke: FORGE.cold,
      strokeAlpha: 0.34,
      glow: FORGE.cold,
      depth: 2,
    });

    const left = layout.centerX - layout.contentWidth / 2;

    this.addTo(
      container,
      this.add.text(left + 20, topY + (layout.veryCompact ? 13 : 16), 'Склад материалов', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '14px' : '17px',
        color: '#d6c08a',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'left',
        wordWrap: {
          width: layout.contentWidth - 40,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    if (layout.veryCompact) {
      const summary = MATERIAL_IDS
        .map(id => `${this.getMaterialIcon(id)} ${this.getShortMaterialName(id)} ${player.materials[id] ?? 0}`)
        .join('   ');

      this.addTo(
        container,
        this.add.text(left + 20, topY + 34, summary, {
          fontFamily: UI.font.body,
          fontSize: '9px',
          color: '#a9a091',
          align: 'left',
          wordWrap: {
            width: layout.contentWidth - 40,
            useAdvancedWrap: true,
          },
          maxLines: 1,
        }).setOrigin(0, 0.5).setDepth(8)
      );

      return topY + panelHeight;
    }

    const chipGap = 7;
    const chipWidth = (layout.contentWidth - 44 - chipGap) / 2;
    const leftX = layout.centerX - chipWidth / 2 - chipGap / 2;
    const rightX = layout.centerX + chipWidth / 2 + chipGap / 2;
    const rowGap = layout.compact ? 15 : 17;
    const firstRowY = topY + (layout.compact ? 34 : 38);

    MATERIAL_IDS.forEach((id, index) => {
      const x = index % 2 === 0 ? leftX : rightX;
      const y = firstRowY + Math.floor(index / 2) * rowGap;

      this.createMaterialLine(container, x, y, chipWidth, id, 8);
    });

    return topY + panelHeight;
  }

  private createCategoryTabs(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = layout.tabsHeight;
    const panelY = topY + panelHeight / 2;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 26,
      fill: FORGE.soot,
      alpha: 0.96,
      stroke: FORGE.bronze,
      strokeAlpha: 0.34,
      glow: FORGE.ember,
      depth: 2,
    });

    const tabs: Array<{
      id: ForgeCategory;
      icon: string;
      label: string;
    }> = [
      { id: 'weapon', icon: '⚔', label: 'Оружие' },
      { id: 'armor', icon: '🛡', label: 'Броня' },
      { id: 'trinket', icon: '◆', label: 'Талисм.' },
    ];

    const gap = 8;
    const tabWidth = (layout.contentWidth - 44 - gap * 2) / 3;
    const startX = layout.centerX - layout.contentWidth / 2 + 22 + tabWidth / 2;

    tabs.forEach((tab, index) => {
      const isActive = this.selectedCategory === tab.id;
      const x = startX + index * (tabWidth + gap);

      this.createForgeButton({
        parent: container,
        x,
        y: panelY,
        width: tabWidth,
        height: layout.veryCompact ? 38 : 44,
        text: `${tab.icon} ${tab.label}`,
        variant: isActive ? 'gold' : 'dark',
        small: true,
        depth: 8,
        onClick: () => {
          if (this.selectedCategory === tab.id || this.didDragItems) {
            return;
          }

          this.switchForgeCategory(tab.id);
        },
      });
    });

    return topY + panelHeight;
  }

  private createEmptyState(
    container: Phaser.GameObjects.Container,
    layout: ForgeLayout,
    y: number
  ) {
    const icon = this.getCategoryIcon(this.selectedCategory);

    this.addTo(
      container,
      this.add.circle(layout.centerX, y - 36, 46, 0x19120e, 0.96)
        .setStrokeStyle(2, FORGE.bronze, 0.64)
        .setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(layout.centerX, y - 36, icon, {
        fontFamily: UI.font.body,
        fontSize: '32px',
        color: '#d6c08a',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(layout.centerX, y + 48, 'В сумке нет предметов этого типа.\nНайди добычу в катакомбах, купи её в лавке или забери с босса.', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '14px' : '16px',
        color: '#9f9788',
        align: 'center',
        lineSpacing: 5,
        wordWrap: {
          width: layout.contentWidth - 70,
          useAdvancedWrap: true,
        },
        maxLines: 4,
      }).setOrigin(0.5).setDepth(9)
    );
  }

  private createItemCard(
    container: Phaser.GameObjects.Container,
    layout: ForgeLayout,
    inventoryItem: InventoryItem,
    y: number,
    cardHeight: number,
    alpha = 1
  ) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return;
    }

    const cardContainer = this.add.container(0, 0).setDepth(0);
    container.add(cardContainer);

    const equipped = isItemEquipped(player, inventoryItem.instanceId);
    const upgradeLevel = inventoryItem.upgradeLevel ?? 0;

    const rarityMax = this.getRarityMaxLevel(item);
    const anvilMax = this.getAnvilMaxLevel();
    const availableMax = this.getAvailableMaxLevel(item);

    const isRarityMax = upgradeLevel >= rarityMax;
    const isAnvilLocked = player.anvilLevel < 2 && upgradeLevel >= anvilMax && upgradeLevel < rarityMax;
    const isMax = isRarityMax || isAnvilLocked;

    const cost = this.getUpgradeCost(inventoryItem);
    const canUpgrade = this.canUpgradeItem(inventoryItem);

    const rarityColor = getRarityColorHex(item);
    const rarityStroke = getRarityStrokeColor(item);

    const cardWidth = layout.contentWidth - 30;
    const left = layout.centerX - cardWidth / 2;
    const top = y - cardHeight / 2;
    const bottom = y + cardHeight / 2;

    this.createStonePanel({
      parent: cardContainer,
      x: layout.centerX,
      y,
      width: cardWidth,
      height: cardHeight,
      radius: 24,
      fill: equipped ? 0x1a140f : FORGE.graphite,
      alpha: 0.97,
      stroke: equipped ? FORGE.gold : rarityStroke,
      strokeAlpha: equipped ? 0.78 : 0.56,
      strokeWidth: equipped ? 2 : 1,
      glow: rarityColor,
      depth: 5,
    });

    const rarityStrip = this.add.graphics();
    rarityStrip.fillStyle(rarityColor, 0.78);
    rarityStrip.fillRoundedRect(left + 8, top + 12, 7, cardHeight - 24, 5);
    rarityStrip.setDepth(8);
    cardContainer.add(rarityStrip);

    const iconX = left + 42;
    const textX = left + 78;
    const innerLeft = left + 22;
    const innerWidth = cardWidth - 44;
    const buttonHeight = layout.veryCompact ? 42 : 46;
    const buttonY = bottom - (layout.veryCompact ? 28 : 31);
    const costY = buttonY - buttonHeight / 2 - (layout.veryCompact ? 8 : 10) - 20;
    const statsY = Math.min(top + (layout.veryCompact ? 82 : 88), costY - 38);
    const progressY = Math.min(top + (layout.veryCompact ? 66 : 70), statsY - 17);
    const metaY = Math.min(top + (layout.veryCompact ? 47 : 50), progressY - 18);
    const titleWidth = equipped ? cardWidth - 184 : cardWidth - 108;

    this.addTo(
      cardContainer,
      this.add.circle(iconX, top + (layout.veryCompact ? 34 : 38), 24, rarityColor, 0.18)
        .setStrokeStyle(2, rarityStroke, 0.72)
        .setDepth(9)
    );

    this.addTo(
      cardContainer,
      this.add.text(iconX, top + (layout.veryCompact ? 34 : 38), getSlotIcon(item.slot), {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: '#f1eadc',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(10)
    );

    this.addTo(
      cardContainer,
      this.add.text(textX, top + (layout.veryCompact ? 13 : 15), `${item.name} +${upgradeLevel}`, {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '14px' : '16px',
        color: equipped ? '#d6c08a' : '#d8d0bf',
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: titleWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
        lineSpacing: -2,
      }).setOrigin(0, 0).setDepth(10)
    );

    if (equipped) {
      this.createEquippedBadge(cardContainer, left + cardWidth - 58, top + (layout.veryCompact ? 25 : 28), 10);
    }

    this.addTo(
      cardContainer,
      this.add.text(textX, metaY, `${getRarityText(item)} • ${this.getItemTypeText(item)} • предел +${rarityMax}`, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: this.getRarityTextColor(item),
        wordWrap: {
          width: titleWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    this.createUpgradeProgressBar(
      cardContainer,
      innerLeft,
      progressY,
      Math.min(innerWidth - 58, 380),
      upgradeLevel,
      rarityMax,
      rarityColor,
      10
    );

    this.addTo(
      cardContainer,
      this.add.text(innerLeft, statsY, createItemStatsText(inventoryItem) || 'Без бонусов', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '11px' : '12px',
        color: '#a9a091',
        lineSpacing: 2,
        wordWrap: {
          width: innerWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    if (isMax) {
      const lockedText = isRarityMax
        ? `Достигнут предел редкости: +${rarityMax}`
        : `Нужна наковальня II для улучшения выше +${availableMax}`;

      this.createLockedPanel(
        cardContainer,
        innerLeft,
        costY,
        innerWidth,
        lockedText,
        isRarityMax,
        10
      );
    } else {
      this.createCostPanel(
        cardContainer,
        innerLeft,
        costY,
        innerWidth,
        cost,
        canUpgrade,
        10
      );
    }

    const upgradeButton = this.createForgeButton({
      parent: cardContainer,
      x: layout.centerX,
      y: buttonY,
      width: innerWidth,
      height: buttonHeight,
      text: isRarityMax
        ? 'Предмет закалён до предела'
        : isAnvilLocked
          ? 'Нужна наковальня II'
          : 'Улучшить предмет',
      disabled: isMax || !canUpgrade,
      variant: isMax ? 'green' : canUpgrade ? 'gold' : 'dark',
      small: layout.veryCompact,
      depth: 11,
      onClick: () => {
        if (this.didDragItems) {
          return;
        }

        this.showUpgradeConfirm(inventoryItem);
      },
    });

    this.applyItemsMaskToContainer(cardContainer);
    cardContainer.setAlpha(alpha);
    this.setCardObjectsAlpha([cardContainer, upgradeButton.zone], alpha);
  }

  private switchForgeCategory(category: ForgeCategory) {
    this.selectedCategory = category;
    this.itemsScrollY = 0;
    this.itemsTargetScrollY = 0;
    this.itemsLastRenderedScrollY = -1;

    const layout = this.getLayout();
    this.createScrollableContent(layout);
    this.createItemsViewport(layout);
  }

  private refreshForgeView() {
    const layout = this.getLayout();

    this.itemsScrollY = Phaser.Math.Clamp(this.itemsScrollY, 0, this.itemsMaxScrollY);
    this.itemsTargetScrollY = Phaser.Math.Clamp(this.itemsTargetScrollY, 0, this.itemsMaxScrollY);

    this.createResourcePanel(layout);
    this.createScrollableContent(layout);
    this.createItemsViewport(layout);
  }

  private createBottomBar(layout: ForgeLayout) {
    const y = layout.height - layout.bottomBarHeight / 2;

    this.add.rectangle(layout.centerX, y, layout.width, layout.bottomBarHeight + 22, 0x020202, 0.78)
      .setDepth(300);

    this.add.rectangle(layout.centerX, y - layout.bottomBarHeight / 2 + 5, layout.contentWidth, 1, FORGE.bronze, 0.28)
      .setDepth(301);

    this.createForgeButton({
      x: layout.centerX,
      y: layout.bottomButtonY,
      width: Math.min(layout.contentWidth, 540),
      height: layout.veryCompact ? 50 : 56,
      text: 'Вернуться в лагерь',
      variant: 'gold',
      depth: 310,
      onClick: () => {
        this.scene.start('CampScene');
      },
    });
  }

  private showUpgradeConfirm(inventoryItem: InventoryItem) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return;
    }

    const currentLevel = inventoryItem.upgradeLevel ?? 0;
    const maxLevel = this.getAvailableMaxLevel(item);
    const cost = this.getUpgradeCost(inventoryItem);
    const canUpgrade = this.canUpgradeItem(inventoryItem);

    const description = [
      `${getRarityText(item)} • ${this.getItemTypeText(item)}`,
      `Текущий уровень: +${currentLevel}/${maxLevel}`,
      '',
      createItemStatsText(inventoryItem) || 'Без бонусов',
      '',
      currentLevel >= maxLevel
        ? 'Предмет уже достиг доступного предела.'
        : `Цена закалки:\n${this.createUpgradeCostText(cost)}`,
    ].join('\n');

    this.showModal({
      title: item.name,
      description,
      confirmText: canUpgrade ? 'Закалить' : 'Не хватает ресурсов',
      confirmVariant: 'green',
      disabled: !canUpgrade,
      onConfirm: () => {
        this.handleItemUpgrade(inventoryItem);
      },
    });
  }

  private showModal(config: {
    title: string;
    description: string;
    confirmText: string;
    confirmVariant?: ForgeButtonVariant;
    disabled?: boolean;
    onConfirm: () => void;
  }) {
    const { width, height } = this.scale;

    this.closeModal();

    this.isModalOpen = true;
    const modalContainer = this.add.container(0, 0).setDepth(1000);
    this.modalContainer = modalContainer;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.76)
      .setInteractive();

    modalContainer.add(overlay);

    const modalWidth = Math.min(width - 48, 620);
    const modalHeight = Math.min(height - 132, 520);
    const modalY = height / 2;

    this.createStonePanel({
      parent: modalContainer,
      x: width / 2,
      y: modalY,
      width: modalWidth,
      height: modalHeight,
      radius: 30,
      fill: 0x17100c,
      alpha: 0.98,
      stroke: FORGE.gold,
      strokeAlpha: 0.76,
      strokeWidth: 3,
      glow: FORGE.ember,
      depth: 1001,
    });

    const top = modalY - modalHeight / 2;
    const bottom = modalY + modalHeight / 2;

    const titleText = this.add.text(width / 2, top + 54, config.title, {
      fontFamily: UI.font.title,
      fontSize: height < 920 ? '21px' : '25px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: modalWidth - 68,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(1005);

    const descriptionText = this.add.text(width / 2, top + modalHeight * 0.44, config.description, {
      fontFamily: UI.font.body,
      fontSize: height < 920 ? '14px' : '16px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 5,
      wordWrap: {
        width: modalWidth - 70,
        useAdvancedWrap: true,
      },
      maxLines: height < 920 ? 10 : 12,
    }).setOrigin(0.5).setDepth(1005);

    modalContainer.add([titleText, descriptionText]);

    this.createForgeButton({
      parent: modalContainer,
      x: width / 2,
      y: bottom - 106,
      width: Math.min(modalWidth - 80, 380),
      height: 54,
      text: config.confirmText,
      variant: config.confirmVariant ?? 'green',
      disabled: config.disabled ?? false,
      depth: 1005,
      onClick: () => {
        this.closeModal();
        config.onConfirm();
      },
    });

    this.createForgeButton({
      parent: modalContainer,
      x: width / 2,
      y: bottom - 42,
      width: Math.min(modalWidth - 80, 380),
      height: 54,
      text: 'Отмена',
      variant: 'gold',
      depth: 1005,
      onClick: () => {
        this.closeModal();
      },
    });
  }

  private showMessage(message: string) {

    this.isActionLocked = false;

    this.showModal({
      title: 'Кузница',
      description: message,
      confirmText: 'Понятно',
      confirmVariant: 'gold',
      onConfirm: () => {
        this.refreshForgeView();
      },
    });
  }

  private closeModal() {
    this.modalContainer?.destroy(true);
    this.modalContainer = undefined;
    this.isModalOpen = false;
  }

  private handleItemUpgrade(inventoryItem: InventoryItem) {
    if (this.isActionLocked) {
      return;
    }

    this.isActionLocked = true;

    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      this.showMessage('Предмет не найден.');
      return;
    }

    if (!this.canUpgradeItem(inventoryItem)) {
      this.showMessage('Недостаточно ресурсов или достигнут предел закалки.');
      return;
    }

    const cost = this.getUpgradeCost(inventoryItem);

    player.gold = Math.max(0, player.gold - cost.gold);

    cost.materials.forEach(material => {
      player.materials[material.id] = Math.max(
        0,
        (player.materials[material.id] ?? 0) - material.amount
      );
    });

    inventoryItem.upgradeLevel = (inventoryItem.upgradeLevel ?? 0) + 1;
    trackWeaponUpgraded();

    void saveGameAsync();

    this.showMessage(`${item.name} улучшен до +${inventoryItem.upgradeLevel}.`);
  }

  private handleAnvilUpgrade() {
    if (this.isActionLocked) {
      return;
    }

    this.isActionLocked = true;

    const result = upgradeAnvil();

    if (!result.success) {
      this.showMessage(result.message ?? 'Не удалось улучшить наковальню.');
      return;
    }

    void saveGameAsync();

    this.showMessage(result.message ?? 'Наковальня улучшена.');
  }

  private getForgeItemsByCategory(category: ForgeCategory) {
    return player.inventory
      .filter(inventoryItem => {
        const item = getBaseItemFromInventoryItem(inventoryItem);

        if (!item) {
          return false;
        }

        return item.slot === category;
      })
      .sort((a, b) => {
        const itemA = getBaseItemFromInventoryItem(a);
        const itemB = getBaseItemFromInventoryItem(b);

        if (!itemA || !itemB) {
          return 0;
        }

        const equippedA = isItemEquipped(player, a.instanceId);
        const equippedB = isItemEquipped(player, b.instanceId);

        if (equippedA !== equippedB) {
          return equippedA ? -1 : 1;
        }

        const rarityDiff = this.getRarityWeight(itemB) - this.getRarityWeight(itemA);

        if (rarityDiff !== 0) {
          return rarityDiff;
        }

        const upgradeDiff = (b.upgradeLevel ?? 0) - (a.upgradeLevel ?? 0);

        if (upgradeDiff !== 0) {
          return upgradeDiff;
        }

        return itemA.name.localeCompare(itemB.name, 'ru');
      });
  }

  private getUpgradeCost(inventoryItem: InventoryItem): UpgradeCost {
    const item = getBaseItemFromInventoryItem(inventoryItem);
    const nextLevel = (inventoryItem.upgradeLevel ?? 0) + 1;

    if (!item) {
      return {
        gold: 0,
        materials: [],
      };
    }

    const rarityMultiplier = this.getRarityCostMultiplier(item);
    const slotMultiplier = item.slot === 'weapon'
      ? 1.15
      : item.slot === 'armor'
        ? 1.05
        : 1.2;

    const gold = Math.ceil(
      (70 + nextLevel * 48 + nextLevel * nextLevel * 18) *
      rarityMultiplier *
      slotMultiplier /
      10
    ) * 10;

    const materials: UpgradeCost['materials'] = [];

    if (nextLevel <= 3) {
      materials.push({
        id: this.getPrimaryMaterialForSlot(item.slot),
        amount: 1 + Math.floor(nextLevel / 2),
      });
    } else if (nextLevel <= 5) {
      materials.push({
        id: this.getPrimaryMaterialForSlot(item.slot),
        amount: 2,
      });

      materials.push({
        id: this.getAdvancedMaterialForSlot(item.slot),
        amount: nextLevel - 3,
      });
    } else if (nextLevel <= 7) {
      materials.push({
        id: this.getAdvancedMaterialForSlot(item.slot),
        amount: 2 + (nextLevel - 5),
      });

      materials.push({
        id: 'cursed_seal',
        amount: nextLevel - 5,
      });
    } else {
      materials.push({
        id: 'cursed_seal',
        amount: 2 + Math.max(0, nextLevel - 8),
      });

      materials.push({
        id: 'black_gem',
        amount: Math.max(1, nextLevel - 8),
      });

      materials.push({
        id: 'black_sarcophagus_shard',
        amount: nextLevel - 7,
      });
    }

    return {
      gold,
      materials: this.mergeMaterialCosts(materials),
    };
  }

  private canUpgradeItem(inventoryItem: InventoryItem) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return false;
    }

    const currentLevel = inventoryItem.upgradeLevel ?? 0;
    const maxLevel = this.getAvailableMaxLevel(item);

    if (currentLevel >= maxLevel) {
      return false;
    }

    const cost = this.getUpgradeCost(inventoryItem);

    if (player.gold < cost.gold) {
      return false;
    }

    return cost.materials.every(material => {
      return (player.materials[material.id] ?? 0) >= material.amount;
    });
  }

  private getAvailableMaxLevel(item: ItemData) {
    return Math.min(this.getRarityMaxLevel(item), this.getAnvilMaxLevel());
  }

  private getAnvilMaxLevel() {
    return player.anvilLevel >= 2 ? 10 : 5;
  }

  private getRarityMaxLevel(item: ItemData) {
    if (item.rarity === 'common') return 3;
    if (item.rarity === 'rare') return 5;
    if (item.rarity === 'epic') return 7;
    if (item.rarity === 'legendary') return 10;
    if (item.rarity === 'mythic') return 10;

    return 3;
  }

  private getRarityWeight(item: ItemData) {
    if (item.rarity === 'common') return 1;
    if (item.rarity === 'rare') return 2;
    if (item.rarity === 'epic') return 3;
    if (item.rarity === 'legendary') return 4;
    if (item.rarity === 'mythic') return 5;

    return 0;
  }

  private getRarityCostMultiplier(item: ItemData) {
    if (item.rarity === 'common') return 1;
    if (item.rarity === 'rare') return 1.45;
    if (item.rarity === 'epic') return 2.15;
    if (item.rarity === 'legendary') return 3.35;
    if (item.rarity === 'mythic') return 4.4;

    return 1;
  }

  private getPrimaryMaterialForSlot(slot: EquipmentSlot): MaterialId {
    if (slot === 'weapon') return 'darkened_bone';
    if (slot === 'armor') return 'old_leather';
    return 'dim_gem';
  }

  private getAdvancedMaterialForSlot(slot: EquipmentSlot): MaterialId {
    if (slot === 'weapon') return 'dark_flame_heart';
    if (slot === 'armor') return 'black_gem';
    return 'cursed_seal';
  }

  private mergeMaterialCosts(materials: UpgradeCost['materials']) {
    const merged = new Map<MaterialId, number>();

    materials.forEach(material => {
      merged.set(material.id, (merged.get(material.id) ?? 0) + material.amount);
    });

    return Array.from(merged.entries()).map(([id, amount]) => ({
      id,
      amount,
    }));
  }

  private createCostPanel(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    cost: UpgradeCost,
    canUpgrade: boolean,
    depth: number
  ) {
    const panelHeight = 40;

    this.createStonePanel({
      parent: container,
      x: x + width / 2,
      y,
      width,
      height: panelHeight,
      radius: 15,
      fill: canUpgrade ? 0x0f1711 : 0x17100c,
      alpha: 0.84,
      stroke: canUpgrade ? FORGE.green : FORGE.red,
      strokeAlpha: canUpgrade ? 0.38 : 0.5,
      glow: canUpgrade ? FORGE.green : FORGE.red,
      depth,
    });

    const goldEnough = player.gold >= cost.gold;
    const materialSummary = cost.materials.length === 0
      ? 'Материалы не нужны'
      : cost.materials
        .map(material => {
          const owned = player.materials[material.id] ?? 0;
          return `${owned >= material.amount ? '✓' : '!'} ${this.getShortMaterialName(material.id)} ${owned}/${material.amount}`;
        })
        .join('  ');

    this.addTo(
      container,
      this.add.text(x + 12, y - 9, `${goldEnough ? '✓' : '!'} Золото ${player.gold}/${cost.gold}`, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: goldEnough ? UI.colors.text : UI.colors.red,
        stroke: '#000000',
        strokeThickness: 1,
        wordWrap: {
          width: width - 24,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(depth + 3)
    );

    this.addTo(
      container,
      this.add.text(x + 12, y + 10, materialSummary, {
        fontFamily: UI.font.body,
        fontSize: '10px',
        color: canUpgrade ? '#a9a091' : '#d28f85',
        stroke: '#000000',
        strokeThickness: 1,
        wordWrap: {
          width: width - 24,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(depth + 3)
    );
  }

  private createLockedPanel(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    text: string,
    success: boolean,
    depth: number
  ) {
    this.createStonePanel({
      parent: container,
      x: x + width / 2,
      y,
      width,
      height: 40,
      radius: 15,
      fill: success ? 0x0f1711 : 0x17100c,
      alpha: 0.84,
      stroke: success ? FORGE.green : FORGE.gold,
      strokeAlpha: 0.42,
      glow: success ? FORGE.green : FORGE.gold,
      depth,
    });

    this.addTo(
      container,
      this.add.text(x + 12, y, text, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: success ? UI.colors.green : UI.colors.goldText,
        lineSpacing: 3,
        wordWrap: {
          width: width - 24,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(depth + 3)
    );
  }

  private createUpgradeCostText(cost: UpgradeCost) {
    const goldEnough = player.gold >= cost.gold;

    const lines = [
      `${goldEnough ? '✓' : '!'} Золото: ${player.gold}/${cost.gold}`,
      ...cost.materials.map(material => {
        const owned = player.materials[material.id] ?? 0;
        const enough = owned >= material.amount;

        return `${enough ? '✓' : '!'} ${this.getShortMaterialName(material.id)}: ${owned}/${material.amount}`;
      }),
    ];

    return lines.join('\n');
  }

  private getShortMaterialName(id: MaterialId) {
    if (id === 'darkened_bone') return 'Кость';
    if (id === 'dim_gem') return 'Самоцв.';
    if (id === 'old_leather') return 'Кожа';
    if (id === 'dark_flame_heart') return 'Пламя';
    if (id === 'black_gem') return 'Чёрн.кам.';
    if (id === 'cursed_seal') return 'Печать';
    if (id === 'black_sarcophagus_shard') return 'Оскол.';

    return getMaterialName(id);
  }

  private getTotalMaterialCount() {
    return MATERIAL_IDS.reduce((sum, id) => {
      return sum + (player.materials[id] ?? 0);
    }, 0);
  }

  private getItemTypeText(item: ItemData) {
    if (item.slot === 'weapon') {
      return getWeaponTypeText(item.weaponType);
    }

    return getSlotText(item.slot);
  }

  private getCategoryTitle(category: ForgeCategory) {
    if (category === 'weapon') return 'Оружие для закалки';
    if (category === 'armor') return 'Броня для усиления';
    return 'Талисманы для огранки';
  }

  private getCategoryIcon(category: ForgeCategory) {
    if (category === 'weapon') return '⚔';
    if (category === 'armor') return '🛡';
    return '◆';
  }

  private getMaterialIcon(id: MaterialId) {
    if (id === 'darkened_bone') return '◇';
    if (id === 'dim_gem') return '✦';
    if (id === 'old_leather') return '▱';
    if (id === 'dark_flame_heart') return '◆';
    if (id === 'black_gem') return '✧';
    if (id === 'cursed_seal') return '✣';
    if (id === 'black_sarcophagus_shard') return '♜';

    return '•';
  }

  private getRarityTextColor(item: ItemData) {
    if (item.rarity === 'common') return '#b8aa91';
    if (item.rarity === 'rare') return '#8fb6d8';
    if (item.rarity === 'epic') return '#c0a0d8';
    if (item.rarity === 'legendary') return '#d6c08a';
    if (item.rarity === 'mythic') return '#c9a2ff';

    return UI.colors.textMuted;
  }

  private createResourceChip(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    label: string;
    value: string;
    color: number;
    compact: boolean;
  }) {
    this.createStonePanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 16,
      fill: 0x15100d,
      alpha: 0.95,
      stroke: config.color,
      strokeAlpha: 0.3,
      glow: config.color,
      depth: 114,
    });

    const left = config.x - config.width / 2;

    this.add.circle(left + 24, config.y, config.compact ? 13 : 15, config.color, 0.18)
      .setStrokeStyle(1, config.color, 0.48)
      .setDepth(118);

    this.add.text(left + 24, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: config.compact ? '11px' : '13px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(119);

    this.add.text(left + 44, config.y - (config.compact ? 8 : 9), config.label, {
      fontFamily: UI.font.body,
      fontSize: config.compact ? '9px' : '10px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: config.width - 48,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(119);

    this.add.text(left + 44, config.y + (config.compact ? 9 : 11), config.value, {
      fontFamily: UI.font.title,
      fontSize: config.compact ? '13px' : '16px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: config.width - 48,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(119);
  }

  private createMaterialLine(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    id: MaterialId,
    depth: number
  ) {
    const amount = player.materials[id] ?? 0;
    const hasMaterial = amount > 0;
    const accent = id === 'dark_flame_heart'
      ? FORGE.ember
      : id === 'black_gem' || id === 'dim_gem'
        ? FORGE.cold
        : id === 'cursed_seal' || id === 'black_sarcophagus_shard'
          ? FORGE.violet
          : FORGE.bronze;

    const chipHeight = 14;
    const bg = this.add.graphics();
    bg.fillStyle(hasMaterial ? 0x11151b : 0x080808, hasMaterial ? 0.82 : 0.5);
    bg.fillRoundedRect(x - width / 2, y - chipHeight / 2, width, chipHeight, 7);
    bg.lineStyle(1, accent, hasMaterial ? 0.34 : 0.12);
    bg.strokeRoundedRect(x - width / 2, y - chipHeight / 2, width, chipHeight, 7);
    bg.setDepth(depth);
    container.add(bg);

    this.addTo(
      container,
      this.add.text(x - width / 2 + 7, y, `${this.getMaterialIcon(id)} ${this.getShortMaterialName(id)}`, {
        fontFamily: UI.font.body,
        fontSize: '9px',
        color: hasMaterial ? '#c6bdad' : '#69645d',
        stroke: '#000000',
        strokeThickness: 1,
        wordWrap: {
          width: width - 48,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(depth + 2)
    );

    this.addTo(
      container,
      this.add.text(x + width / 2 - 8, y, `${amount}`, {
        fontFamily: UI.font.title,
        fontSize: '10px',
        color: hasMaterial ? '#d6c08a' : '#77706a',
        stroke: '#000000',
        strokeThickness: 1,
        align: 'right',
        wordWrap: {
          width: 36,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(depth + 2)
    );
  }

  private createAnvilProgress(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    depth: number
  ) {
    const safeWidth = Math.max(120, width);
    const progress = player.anvilLevel >= 2 ? 1 : 0.45;

    this.addTo(
      container,
      this.add.rectangle(x + safeWidth / 2, y, safeWidth, 8, 0x000000, 0.46)
        .setDepth(depth)
    );

    this.addTo(
      container,
      this.add.rectangle(
        x + safeWidth * progress / 2,
        y,
        safeWidth * progress,
        8,
        player.anvilLevel >= 2 ? FORGE.green : UI.colors.gold,
        0.92
      ).setDepth(depth + 1)
    );

    this.addTo(
      container,
      this.add.text(x + safeWidth + 10, y, player.anvilLevel >= 2 ? 'II' : 'I', {
        fontFamily: UI.font.title,
        fontSize: '13px',
        color: player.anvilLevel >= 2 ? UI.colors.green : UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0, 0.5).setDepth(depth + 1)
    );
  }

  private createUpgradeProgressBar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    level: number,
    maxLevel: number,
    color: number,
    depth: number
  ) {
    const progress = maxLevel <= 0 ? 0 : Phaser.Math.Clamp(level / maxLevel, 0, 1);
    const radius = 5;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(x, y - 4, width, 8, radius);
    bg.setDepth(depth);

    const track = this.add.graphics();
    track.fillStyle(0x2b211a, 0.9);
    track.fillRoundedRect(x, y - 4, width, 8, radius);
    track.setDepth(depth + 1);

    container.add([bg, track]);

    if (progress > 0) {
      const fill = this.add.graphics();
      fill.fillStyle(color, 0.92);
      fill.fillRoundedRect(x, y - 4, width * progress, 8, radius);
      fill.setDepth(depth + 2);
      container.add(fill);
    }

    this.addTo(
      container,
      this.add.text(x + width + 10, y, `+${level}/${maxLevel}`, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: 48,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(depth + 2)
    );
  }

  private createEquippedBadge(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    depth: number
  ) {
    const width = 72;
    const height = 24;
    const radius = 12;

    const bg = this.add.graphics();
    bg.fillStyle(0x2a1d13, 0.96);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    bg.lineStyle(1, UI.colors.gold, 0.78);
    bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    bg.setDepth(depth);

    const label = this.add.text(x, y, 'НАДЕТО', {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: width - 10,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(depth + 1);

    container.add([bg, label]);
  }

  private createForgeButton(config: {
    parent?: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: ForgeButtonVariant;
    depth?: number;
    small?: boolean;
  }): ForgeButton {
    const disabled = config.disabled ?? false;
    const variant = disabled ? 'disabled' : config.variant ?? 'gold';
    const depth = config.depth ?? 8;
    const radius = Math.min(18, config.height / 2);

    const strokeColor =
      variant === 'green'
        ? FORGE.green
        : variant === 'red'
          ? FORGE.red
          : variant === 'dark'
            ? FORGE.bronze
            : variant === 'disabled'
              ? 0x3a332b
              : FORGE.gold;

    const fillColor =
      variant === 'green'
        ? 0x102016
        : variant === 'red'
          ? 0x251111
          : variant === 'dark'
            ? FORGE.graphite
            : variant === 'disabled'
              ? 0x0c0b0a
              : 0x1c130d;

    const hoverColor =
      variant === 'green'
        ? 0x183322
        : variant === 'red'
          ? 0x321515
          : 0x2c1d14;

    const textColor =
      variant === 'green'
        ? UI.colors.green
        : variant === 'red'
          ? UI.colors.red
          : variant === 'disabled'
            ? UI.colors.textMuted
            : UI.colors.goldText;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 4,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(depth);

    const bg = this.add.graphics();
    bg.fillStyle(fillColor, disabled ? 0.55 : 0.96);
    bg.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );
    bg.lineStyle(2, strokeColor, disabled ? 0.28 : 0.74);
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
      fontSize: config.small ? '15px' : '18px',
      color: textColor,
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: config.width - 18,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(depth + 2);

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setInteractive({
        useHandCursor: !disabled,
      })
      .setDepth(depth + 3);

    const objects: Phaser.GameObjects.GameObject[] = [shadow, bg, label, zone];

    if (!disabled) {
      let pressed = false;

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
        bg.lineStyle(2, strokeColor, 0.96);
        bg.strokeRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          radius
        );
        label.setColor('#ffffff');
      });

      zone.on('pointerout', () => {
        pressed = false;
        label.setY(config.y);
        label.setColor(textColor);

        bg.clear();
        bg.fillStyle(fillColor, 0.96);
        bg.fillRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          radius
        );
        bg.lineStyle(2, strokeColor, 0.74);
        bg.strokeRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          radius
        );
      });

      zone.on('pointerdown', () => {
        pressed = true;
        label.setY(config.y + 1);
      });

      zone.on('pointerup', () => {
        if (!pressed) {
          return;
        }

        pressed = false;
        label.setY(config.y);

        this.time.delayedCall(35, () => {
          config.onClick();
        });
      });

      zone.on('pointerupoutside', () => {
        pressed = false;
        label.setY(config.y);
      });
    }

    if (config.parent) {
      config.parent.add(objects);
    }

    return {
      objects,
      zone,
    };
  }

  private createStonePanel(config: {
    parent?: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: number;
    fill?: number;
    alpha?: number;
    stroke?: number;
    strokeAlpha?: number;
    strokeWidth?: number;
    glow?: number;
    depth?: number;
  }) {
    const radius = config.radius ?? 22;
    const fill = config.fill ?? FORGE.graphite;
    const alpha = config.alpha ?? 0.94;
    const stroke = config.stroke ?? FORGE.bronze;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const glow = config.glow ?? FORGE.gold;
    const depth = config.depth ?? 1;

    const width = Math.max(1, config.width);
    const height = Math.max(1, config.height);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(
      config.x - width / 2,
      config.y - height / 2 + 6,
      width,
      height,
      radius
    );
    shadow.setDepth(depth);

    const panel = this.add.graphics();
    panel.fillStyle(fill, alpha);
    panel.fillRoundedRect(
      config.x - width / 2,
      config.y - height / 2,
      width,
      height,
      radius
    );
    panel.lineStyle(strokeWidth, stroke, strokeAlpha);
    panel.strokeRoundedRect(
      config.x - width / 2,
      config.y - height / 2,
      width,
      height,
      radius
    );
    panel.setDepth(depth + 1);

    const glowCircle = this.add.circle(
      config.x,
      config.y - height / 2 + 28,
      width * 0.24,
      glow,
      0.035
    ).setDepth(depth + 2);

    if (config.parent) {
      config.parent.add([shadow, panel, glowCircle]);
    }

    return {
      shadow,
      panel,
      glow: glowCircle,
    };
  }

  private requireContentContainer() {
    if (!this.contentContainer) {
      throw new Error('Forge content container was not created.');
    }

    return this.contentContainer;
  }

  private addTo<T extends Phaser.GameObjects.GameObject>(
    container: Phaser.GameObjects.Container,
    object: T
  ) {
    container.add(object);
    return object;
  }
}
