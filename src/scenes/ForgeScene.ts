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

  contentTop: number;
  contentBottom: number;
  viewportHeight: number;

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
  private modalContainer?: Phaser.GameObjects.Container;

  private selectedCategory: ForgeCategory = 'weapon';

  private currentScrollY = 0;
  private targetScrollY = 0;
  private maxScrollY = 0;

  private isDraggingContent = false;
  private didDragContent = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

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

    this.currentScrollY = data?.scrollY ?? 0;
    this.targetScrollY = data?.scrollY ?? 0;
    this.maxScrollY = 0;

    this.isDraggingContent = false;
    this.didDragContent = false;
    this.dragStartY = 0;
    this.dragStartScrollY = 0;

    this.isModalOpen = false;
    this.isActionLocked = false;

    this.contentContainer = undefined;
    this.contentMaskGraphics = undefined;
    this.modalContainer = undefined;
  }

  create() {
    const layout = this.getLayout();

    createSceneBackground(this);
    this.createForgeBackdrop(layout);
    this.createHeader(layout);
    this.createResourcePanel(layout);
    this.createScrollableContent(layout);
    this.createBottomBar(layout);
  }

  update() {
    if (!this.contentContainer || this.isModalOpen || this.isDraggingContent) {
      return;
    }

    if (Math.abs(this.currentScrollY - this.targetScrollY) < 0.4) {
      this.currentScrollY = this.targetScrollY;
    } else {
      this.currentScrollY = Phaser.Math.Linear(
        this.currentScrollY,
        this.targetScrollY,
        0.2
      );
    }

    this.contentContainer.y = -this.currentScrollY;
  }

  private getLayout(): ForgeLayout {
    const { width, height } = this.scale;

    const compact = height < 1120;
    const veryCompact = height < 920;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.022), 16, 32);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.028), 24, 42);

    const contentWidth = Math.min(width - safeX * 2, 640);

    const bottomBarHeight = veryCompact ? 88 : 102;
    const bottomButtonY = height - safeBottom - bottomBarHeight / 2 + 8;

    const headerTop = safeTop + 6;
    const headerHeight = veryCompact ? 74 : compact ? 82 : 90;

    const resourcesTop = headerTop + headerHeight + 10;
    const resourcesHeight = veryCompact ? 60 : 68;

    const contentTop = resourcesTop + resourcesHeight + 12;
    const contentBottom = height - bottomBarHeight - safeBottom - 6;
    const viewportHeight = Math.max(280, contentBottom - contentTop);

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

      contentTop,
      contentBottom,
      viewportHeight,

      bottomBarHeight,
      bottomButtonY,

      compact,
      veryCompact,
    };
  }

  private createForgeBackdrop(layout: ForgeLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, FORGE.black, 0.98).setDepth(0);
    this.add.rectangle(centerX, height * 0.42, width, height * 0.82, FORGE.void, 0.72).setDepth(0);
    this.add.rectangle(centerX, height - 180, width, 360, 0x020202, 0.7).setDepth(0);

    const forgeY = layout.safeTop + (layout.veryCompact ? 132 : layout.compact ? 154 : 170);

    this.add.circle(centerX, forgeY, width * 0.54, FORGE.violet, 0.105).setDepth(0);
    this.add.circle(centerX, forgeY + 20, width * 0.38, FORGE.ember, 0.105).setDepth(0);
    this.add.circle(centerX, forgeY + 34, width * 0.19, FORGE.gold, 0.045).setDepth(0);

    const archWidth = Math.min(layout.contentWidth * 0.86, 520);
    const archHeight = layout.veryCompact ? 132 : layout.compact ? 154 : 178;
    const archTop = forgeY - archHeight / 2 + 48;

    this.add.rectangle(centerX, archTop + archHeight / 2, archWidth, archHeight, 0x070708, 0.62)
      .setStrokeStyle(2, FORGE.bronze, 0.28)
      .setDepth(1);

    this.add.ellipse(centerX, archTop + 8, archWidth * 0.72, 112, 0x100909, 0.7)
      .setStrokeStyle(2, FORGE.bronze, 0.34)
      .setDepth(1);

    this.add.rectangle(centerX, archTop + archHeight - 26, archWidth + 56, 28, 0x100c0a, 0.9)
      .setStrokeStyle(2, FORGE.bronze, 0.24)
      .setDepth(2);

    this.add.circle(centerX, archTop + archHeight - 66, 44, FORGE.ember, 0.16).setDepth(1);
    this.add.circle(centerX, archTop + archHeight - 66, 24, FORGE.gold, 0.055).setDepth(1);

    this.add.text(centerX, archTop + archHeight - 72, '⚒', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '42px' : '58px',
      color: '#b9985b',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0.2).setDepth(2);

    for (let i = 0; i < 42; i += 1) {
      const x = layout.safeX + 10 + (i * 53) % Math.max(1, width - layout.safeX * 2 - 20);
      const y = layout.safeTop + 76 + (i * 89) % Math.max(1, height - layout.safeTop - layout.safeBottom - 160);
      const color = i % 5 === 0 ? FORGE.ember : i % 3 === 0 ? FORGE.cold : FORGE.ash;
      const alpha = 0.018 + (i % 6) * 0.006;

      this.add.circle(x, y, 1 + (i % 3), color, alpha).setDepth(1);
    }

    for (let i = 0; i < 7; i += 1) {
      const y = height - 310 + i * 44;

      this.add.line(
        0,
        0,
        layout.safeX + 12,
        y,
        width - layout.safeX - 12,
        y + (i % 2 === 0 ? 8 : -5),
        0x1f1a15,
        0.18
      ).setOrigin(0, 0).setDepth(1);
    }
  }

  private createHeader(layout: ForgeLayout) {
    const panelY = layout.headerTop + layout.headerHeight / 2;

    this.createStonePanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: layout.headerHeight,
      radius: 26,
      fill: FORGE.graphite,
      alpha: 0.93,
      stroke: FORGE.bronze,
      strokeAlpha: 0.5,
      glow: FORGE.ember,
      depth: 120,
    });

    this.add.text(layout.centerX, panelY - (layout.veryCompact ? 14 : 18), 'Кузница Пепельного Молота', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '23px' : layout.compact ? '26px' : '30px',
      color: '#d6c08a',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 48,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(126);

    this.add.text(layout.centerX, panelY + (layout.veryCompact ? 17 : 22), 'Тихий жар, чёрный металл и вещи, пережившие склеп', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '12px' : '14px',
      color: '#9f9788',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 64,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(126);
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

    this.contentContainer = this.add.container(0, 0).setDepth(10);

    this.contentMaskGraphics = this.add.graphics();
    this.contentMaskGraphics.setVisible(false);
    this.contentMaskGraphics.fillStyle(0xffffff, 1);
    this.contentMaskGraphics.fillRect(
      layout.safeX,
      layout.contentTop,
      layout.width - layout.safeX * 2,
      layout.viewportHeight
    );

    this.contentContainer.setMask(this.contentMaskGraphics.createGeometryMask());

    let cursorY = layout.contentTop + 14;

    cursorY = this.createIntroPanel(layout, cursorY);
    cursorY = this.createAnvilPanel(layout, cursorY + 12);
    cursorY = this.createMaterialsPanel(layout, cursorY + 12);
    cursorY = this.createCategoryTabs(layout, cursorY + 12);
    cursorY = this.createItemsSection(layout, cursorY + 12);

    const contentHeight = cursorY - layout.contentTop + 24;

    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScrollY);
    this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY, 0, this.maxScrollY);

    this.contentContainer.y = -this.currentScrollY;

    this.createScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }
  }

  private createScrollInput(layout: ForgeLayout) {
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.input.off('pointerupoutside');
    this.input.off('wheel');

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isModalOpen || this.maxScrollY <= 0) {
        return;
      }

      if (!this.isPointerInsideContent(pointer, layout)) {
        return;
      }

      this.isDraggingContent = true;
      this.didDragContent = false;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.targetScrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDraggingContent || this.isModalOpen) {
        return;
      }

      const distance = pointer.y - this.dragStartY;

      if (Math.abs(distance) < 7) {
        return;
      }

      this.didDragContent = true;
      this.targetScrollY = Phaser.Math.Clamp(
        this.dragStartScrollY - distance,
        0,
        this.maxScrollY
      );

      this.currentScrollY = this.targetScrollY;

      if (this.contentContainer) {
        this.contentContainer.y = -this.currentScrollY;
      }
    });

    this.input.on('pointerup', () => {
      this.isDraggingContent = false;

      this.time.delayedCall(0, () => {
        this.didDragContent = false;
      });
    });

    this.input.on('pointerupoutside', () => {
      this.isDraggingContent = false;

      this.time.delayedCall(0, () => {
        this.didDragContent = false;
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
        if (this.isModalOpen || this.maxScrollY <= 0) {
          return;
        }

        if (!this.isPointerInsideContent(pointer, layout)) {
          return;
        }

        this.targetScrollY = Phaser.Math.Clamp(
          this.targetScrollY + deltaY * 0.55,
          0,
          this.maxScrollY
        );
      }
    );
  }

  private isPointerInsideContent(pointer: Phaser.Input.Pointer, layout: ForgeLayout) {
    return (
      pointer.x >= layout.safeX &&
      pointer.x <= layout.width - layout.safeX &&
      pointer.y >= layout.contentTop &&
      pointer.y <= layout.contentBottom
    );
  }

  private createScrollHint(layout: ForgeLayout) {
    const y = layout.contentBottom - 16;

    const bg = this.add.rectangle(layout.centerX, y, 250, 28, 0x000000, 0.5)
      .setDepth(180);

    const text = this.add.text(layout.centerX, y, 'Прокручивай кузницу вверх и вниз', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#9f9788',
      align: 'center',
      wordWrap: {
        width: 232,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(181);

    this.tweens.add({
      targets: [bg, text],
      alpha: 0.22,
      duration: 950,
      yoyo: true,
      repeat: -1,
    });
  }

  private createIntroPanel(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = layout.veryCompact ? 104 : 122;
    const panelY = topY + panelHeight / 2;
    const left = layout.centerX - layout.contentWidth / 2 + 24;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 26,
      fill: FORGE.graphite,
      alpha: 0.93,
      stroke: FORGE.bronze,
      strokeAlpha: 0.34,
      glow: FORGE.violet,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(left, topY + 28, 'Что можно улучшать', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '18px' : '21px',
        color: '#d6c08a',
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 48,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(
        left,
        topY + (layout.veryCompact ? 66 : 78),
        'Выбери вкладку, проверь стоимость и закали предмет. Надетая экипировка показана выше, чтобы её не приходилось искать в длинном списке.',
        {
          fontFamily: UI.font.body,
          fontSize: layout.veryCompact ? '12px' : '14px',
          color: '#a9a091',
          lineSpacing: 4,
          wordWrap: {
            width: layout.contentWidth - 48,
            useAdvancedWrap: true,
          },
          maxLines: layout.veryCompact ? 3 : 3,
        }
      ).setOrigin(0, 0.5).setDepth(8)
    );

    return topY + panelHeight;
  }

  private createAnvilPanel(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const isUpgraded = player.anvilLevel >= 2;
    const canUpgrade = canUpgradeAnvil();
    const anvilCost = getAnvilUpgradeCost();

    const panelHeight = layout.veryCompact ? 148 : 168;
    const panelY = topY + panelHeight / 2;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      fill: isUpgraded ? 0x0c1510 : FORGE.soot,
      alpha: 0.96,
      stroke: isUpgraded ? FORGE.green : FORGE.bronze,
      strokeAlpha: isUpgraded ? 0.64 : 0.42,
      glow: isUpgraded ? FORGE.green : FORGE.ember,
      depth: 2,
    });

    const left = layout.centerX - layout.contentWidth / 2;
    const right = layout.centerX + layout.contentWidth / 2;

    this.addTo(
      container,
      this.add.circle(left + 46, topY + 58, 34, isUpgraded ? 0x132018 : 0x1a110d, 0.96)
        .setStrokeStyle(2, isUpgraded ? FORGE.green : FORGE.gold, 0.75)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 46, topY + 58, '⚒', {
        fontFamily: UI.font.body,
        fontSize: '26px',
        color: isUpgraded ? '#9fd0a6' : '#d6c08a',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(left + 92, topY + 28, `Наковальня ${player.anvilLevel} уровня`, {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '18px' : '21px',
        color: '#d6c08a',
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 230,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    const description = isUpgraded
      ? 'Высокая закалка открыта. Легендарные и эпические трофеи можно вести до предела.'
      : `Для улучшений выше +5 нужна наковальня II. ${this.createAnvilCostNeedText(anvilCost)}`;

    this.addTo(
      container,
      this.add.text(left + 92, topY + 70, description, {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '12px' : '13px',
        color: '#a9a091',
        lineSpacing: 3,
        wordWrap: {
          width: layout.contentWidth - 230,
          useAdvancedWrap: true,
        },
        maxLines: 3,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.createAnvilProgress(
      container,
      left + 92,
      topY + (layout.veryCompact ? 112 : 128),
      Math.min(layout.contentWidth - 260, 300),
      8
    );

    this.createForgeButton({
      parent: container,
      x: right - 78,
      y: topY + (layout.veryCompact ? 74 : 84),
      width: 128,
      height: 50,
      text: isUpgraded ? 'Готово' : 'Усилить',
      disabled: isUpgraded || !canUpgrade,
      variant: isUpgraded ? 'green' : 'gold',
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

    const panelHeight = layout.veryCompact ? 166 : 184;
    const panelY = topY + panelHeight / 2;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      fill: FORGE.graphite,
      alpha: 0.93,
      stroke: FORGE.bronze,
      strokeAlpha: 0.34,
      glow: FORGE.cold,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 28, 'Склад материалов', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '19px' : '22px',
        color: '#d6c08a',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 56,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );

    const chipGap = 10;
    const chipWidth = (layout.contentWidth - 56 - chipGap) / 2;
    const leftX = layout.centerX - chipWidth / 2 - chipGap / 2;
    const rightX = layout.centerX + chipWidth / 2 + chipGap / 2;
    const rowGap = layout.veryCompact ? 24 : 27;

    MATERIAL_IDS.forEach((id, index) => {
      const x = index % 2 === 0 ? leftX : rightX;
      const y = topY + 66 + Math.floor(index / 2) * rowGap;

      this.createMaterialLine(container, x, y, chipWidth, id, 8);
    });

    return topY + panelHeight;
  }

  private createCategoryTabs(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = layout.veryCompact ? 74 : 82;
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
        height: layout.veryCompact ? 44 : 48,
        text: `${tab.icon} ${tab.label}`,
        variant: isActive ? 'gold' : 'dark',
        small: true,
        depth: 8,
        onClick: () => {
          if (this.selectedCategory === tab.id || this.didDragContent) {
            return;
          }

          this.scene.restart({
            selectedCategory: tab.id,
            scrollY: 0,
          });
        },
      });
    });

    return topY + panelHeight;
  }

  private createItemsSection(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const items = this.getForgeItemsByCategory(this.selectedCategory);
    const title = this.getCategoryTitle(this.selectedCategory);
    const icon = this.getCategoryIcon(this.selectedCategory);

    const sectionHeaderHeight = layout.veryCompact ? 88 : 100;
    const cardHeight = layout.veryCompact ? 274 : layout.compact ? 292 : 306;
    const cardGap = 14;
    const emptyHeight = layout.veryCompact ? 238 : 260;

    const listHeight = items.length === 0
      ? emptyHeight
      : sectionHeaderHeight + items.length * cardHeight + Math.max(0, items.length - 1) * cardGap + 26;

    const panelY = topY + listHeight / 2;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: listHeight,
      radius: 30,
      fill: FORGE.soot,
      alpha: 0.96,
      stroke: FORGE.bronze,
      strokeAlpha: 0.4,
      glow: FORGE.violet,
      depth: 2,
    });

    const left = layout.centerX - layout.contentWidth / 2;
    const right = layout.centerX + layout.contentWidth / 2;

    this.addTo(
      container,
      this.add.text(left + 24, topY + 30, `${icon} ${title}`, {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '19px' : '22px',
        color: '#d6c08a',
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 150,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(right - 24, topY + 30, `${items.length} шт.`, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: '#9f9788',
        align: 'right',
        wordWrap: {
          width: 96,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(left + 24, topY + 64, 'Стоимость подсвечивается: зелёный — хватает ресурсов, красный — не хватает.', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '11px' : '12px',
        color: '#8f8879',
        wordWrap: {
          width: layout.contentWidth - 48,
          useAdvancedWrap: true,
        },
        maxLines: 2,
        lineSpacing: 2,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    if (items.length === 0) {
      this.createEmptyState(container, layout, topY + 146);
      return topY + listHeight;
    }

    items.forEach((inventoryItem, index) => {
      const y = topY + sectionHeaderHeight + cardHeight / 2 + index * (cardHeight + cardGap);

      this.createItemCard(container, layout, inventoryItem, y, cardHeight);
    });

    return topY + listHeight;
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
    cardHeight: number
  ) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return;
    }

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
      parent: container,
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
    container.add(rarityStrip);

    const iconX = left + 44;
    const textX = left + 80;
    const innerLeft = left + 22;
    const innerWidth = cardWidth - 44;
    const titleWidth = cardWidth - 108;

    this.addTo(
      container,
      this.add.circle(iconX, top + 40, 26, rarityColor, 0.18)
        .setStrokeStyle(2, rarityStroke, 0.72)
        .setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(iconX, top + 40, getSlotIcon(item.slot), {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: '#f1eadc',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(10)
    );

    this.addTo(
      container,
      this.add.text(textX, top + 18, `${item.name} +${upgradeLevel}`, {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '15px' : '17px',
        color: equipped ? '#d6c08a' : '#d8d0bf',
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: titleWidth,
          useAdvancedWrap: true,
        },
        maxLines: 2,
        lineSpacing: -2,
      }).setOrigin(0, 0).setDepth(10)
    );

    if (equipped) {
      this.createEquippedBadge(container, left + cardWidth - 58, top + 30, 10);
    }

    this.addTo(
      container,
      this.add.text(textX, top + 70, `${getRarityText(item)} • ${this.getItemTypeText(item)} • предел +${rarityMax}`, {
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
      container,
      innerLeft,
      top + 98,
      Math.min(innerWidth - 58, 380),
      upgradeLevel,
      rarityMax,
      rarityColor,
      10
    );

    this.addTo(
      container,
      this.add.text(innerLeft, top + 124, createItemStatsText(inventoryItem) || 'Без бонусов', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '11px' : '12px',
        color: '#a9a091',
        lineSpacing: 2,
        wordWrap: {
          width: innerWidth,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    if (isMax) {
      const lockedText = isRarityMax
        ? `Достигнут предел редкости: +${rarityMax}`
        : `Нужна наковальня II для улучшения выше +${availableMax}`;

      this.createLockedPanel(
        container,
        innerLeft,
        bottom - 102,
        innerWidth,
        lockedText,
        isRarityMax,
        10
      );
    } else {
      this.createCostPanel(
        container,
        innerLeft,
        bottom - 102,
        innerWidth,
        cost,
        canUpgrade,
        10
      );
    }

    this.createForgeButton({
      parent: container,
      x: layout.centerX,
      y: bottom - 32,
      width: innerWidth,
      height: 50,
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
        if (this.didDragContent) {
          return;
        }

        this.showUpgradeConfirm(inventoryItem);
      },
    });
  }

  private createBottomBar(layout: ForgeLayout) {
    const y = layout.height - layout.bottomBarHeight / 2;

    this.add.rectangle(layout.centerX, y, layout.width, layout.bottomBarHeight + 22, 0x020202, 0.78)
      .setDepth(220);

    this.add.rectangle(layout.centerX, y - layout.bottomBarHeight / 2 + 5, layout.contentWidth, 1, FORGE.bronze, 0.28)
      .setDepth(221);

    this.createForgeButton({
      x: layout.centerX,
      y: layout.bottomButtonY,
      width: Math.min(layout.contentWidth, 540),
      height: layout.veryCompact ? 50 : 56,
      text: 'Вернуться в лагерь',
      variant: 'gold',
      depth: 230,
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
    this.modalContainer = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.76)
      .setInteractive();

    this.modalContainer.add(overlay);

    const modalWidth = Math.min(width - 48, 620);
    const modalHeight = Math.min(height - 132, 520);
    const modalY = height / 2;

    this.createStonePanel({
      parent: this.modalContainer,
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

    this.modalContainer.add([titleText, descriptionText]);

    this.createForgeButton({
      parent: this.modalContainer,
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
      parent: this.modalContainer,
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
        this.scene.restart({
          selectedCategory: this.selectedCategory,
          scrollY: this.targetScrollY,
        });
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
    const panelHeight = Phaser.Math.Clamp(30 + (1 + cost.materials.length) * 17, 66, 92);

    this.createStonePanel({
      parent: container,
      x: x + width / 2,
      y,
      width,
      height: panelHeight,
      radius: 16,
      fill: canUpgrade ? 0x0f1711 : 0x17100c,
      alpha: 0.84,
      stroke: canUpgrade ? FORGE.green : FORGE.red,
      strokeAlpha: canUpgrade ? 0.36 : 0.5,
      glow: canUpgrade ? FORGE.green : FORGE.red,
      depth,
    });

    const left = x + 12;
    const lineWidth = width - 24;

    this.addTo(
      container,
      this.add.text(left, y - panelHeight / 2 + 14, 'Нужно для закалки', {
        fontFamily: UI.font.body,
        fontSize: '10px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: lineWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(depth + 3)
    );

    let lineY = y - panelHeight / 2 + 32;

    this.createCostLine(
      container,
      left,
      lineY,
      `Золото: ${player.gold} / ${cost.gold}`,
      player.gold >= cost.gold,
      lineWidth,
      depth + 3
    );

    cost.materials.forEach(material => {
      const owned = player.materials[material.id] ?? 0;

      lineY += 17;

      this.createCostLine(
        container,
        left,
        lineY,
        `${this.getShortMaterialName(material.id)}: ${owned} / ${material.amount}`,
        owned >= material.amount,
        lineWidth,
        depth + 3
      );
    });
  }

  private createCostLine(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    text: string,
    enough: boolean,
    width: number,
    depth: number
  ) {
    this.addTo(
      container,
      this.add.text(x, y, `${enough ? '✓' : '!'} ${text}`, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: enough ? UI.colors.text : UI.colors.red,
        stroke: '#000000',
        strokeThickness: 1,
        wordWrap: {
          width,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(depth)
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
      height: 58,
      radius: 16,
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
        fontSize: '12px',
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

  private createAnvilCostNeedText(cost: {
    materialId: MaterialId;
    amount: number;
    gold: number;
  }) {
    const materialOwned = player.materials[cost.materialId] ?? 0;
    const materialEnough = materialOwned >= cost.amount;
    const goldEnough = player.gold >= cost.gold;

    return [
      `${materialEnough ? '✓' : '!'} ${this.getShortMaterialName(cost.materialId)}: ${materialOwned}/${cost.amount}`,
      `${goldEnough ? '✓' : '!'} золото: ${player.gold}/${cost.gold}`,
    ].join(' • ');
  }

  private getShortMaterialName(id: MaterialId) {
    if (id === 'darkened_bone') return 'Кость';
    if (id === 'dim_gem') return 'Самоцвет';
    if (id === 'old_leather') return 'Кожа';
    if (id === 'dark_flame_heart') return 'Сердце пламени';
    if (id === 'black_gem') return 'Чёрный самоцвет';
    if (id === 'cursed_seal') return 'Печать';
    if (id === 'black_sarcophagus_shard') return 'Осколок';

    return getMaterialName(id);
  }

  private getTotalMaterialCount() {
    return Object.values(player.materials ?? {}).reduce((sum, amount) => {
      return sum + (amount ?? 0);
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

    this.addTo(
      container,
      this.add.text(x - width / 2 + 6, y, `${this.getMaterialIcon(id)} ${getMaterialName(id)}: ${amount}`, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: amount > 0 ? UI.colors.text : UI.colors.textMuted,
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: width - 10,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(depth)
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
