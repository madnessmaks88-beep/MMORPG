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

  contentTop: number;
  contentBottom: number;
  contentWidth: number;
  viewportHeight: number;

  compact: boolean;
};

type UpgradeCost = {
  gold: number;
  materials: Array<{
    id: MaterialId;
    amount: number;
  }>;
};

type ForgeButton = {
  objects: Phaser.GameObjects.GameObject[];
  zone: Phaser.GameObjects.Zone;
};

const FORGE_DARK = {
  black: 0x030304,
  void: 0x060607,
  graphite: 0x0c0d10,
  stone: 0x111217,
  stoneLight: 0x191a21,
  soot: 0x0a0706,
  iron: 0x232127,
  bronze: 0x5e4630,
  gold: 0xb89a5e,
  goldSoft: 0xd8c088,
  ash: 0x8d877b,
  red: 0x8d2f2f,
  ember: 0xa85a2a,
  cold: 0x5f7f9d,
  violet: 0x62518a,
};

export class ForgeScene extends Phaser.Scene {
  private contentContainer?: Phaser.GameObjects.Container;

  private currentScrollY = 0;
  private targetScrollY = 0;
  private maxScrollY = 0;

  private isDraggingContent = false;
  private didDragContent = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  private isModalOpen = false;
  private isActionLocked = false;

  private selectedCategory: ForgeCategory = 'weapon';

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
    this.isModalOpen = false;
    this.isActionLocked = false;
  }

  create() {
    const layout = this.getLayout();

    createSceneBackground(this);
    this.createForgeBackdrop(layout);
    this.createHeader(layout);
    this.createResourcePanel(layout);
    this.createScrollableContent(layout);
    this.createBottomActions(layout);
  }

  update() {
    if (!this.contentContainer) {
      return;
    }

    if (this.isModalOpen || this.isDraggingContent) {
      return;
    }

    if (Math.abs(this.currentScrollY - this.targetScrollY) < 0.5) {
      this.currentScrollY = this.targetScrollY;
    } else {
      this.currentScrollY = Phaser.Math.Linear(
        this.currentScrollY,
        this.targetScrollY,
        0.18
      );
    }

    this.contentContainer.y = -this.currentScrollY;
  }

  private getLayout(): ForgeLayout {
    const { width, height } = this.scale;

    const compact = height < 1120;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.024), 18, 34);
    const safeBottom = compact ? 118 : 126;

    const headerBlockHeight = compact ? 176 : 188;
    const contentTop = safeTop + headerBlockHeight;
    const contentBottom = height - safeBottom;
    const contentWidth = Math.min(width - safeX * 2, 640);

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      contentTop,
      contentBottom,
      contentWidth,
      viewportHeight: Math.max(300, contentBottom - contentTop),

      compact,
    };
  }

  private createForgeBackdrop(layout: ForgeLayout) {
    const { width, height, centerX } = layout;
    const forgeY = layout.safeTop + (layout.compact ? 148 : 160);

    this.add.rectangle(centerX, height / 2, width, height, FORGE_DARK.black, 0.96).setDepth(0);
    this.add.rectangle(centerX, height - 170, width, 340, 0x020202, 0.62).setDepth(0);

    this.add.circle(centerX, forgeY, width * 0.54, FORGE_DARK.violet, 0.13).setDepth(0);
    this.add.circle(centerX, forgeY + 10, width * 0.38, FORGE_DARK.ember, 0.10).setDepth(0);
    this.add.circle(centerX, forgeY + 18, width * 0.18, FORGE_DARK.gold, 0.045).setDepth(0);

    const archWidth = Math.min(layout.contentWidth * 0.82, 500);
    const archHeight = layout.compact ? 176 : 198;
    const archY = forgeY + 32;

    this.add.rectangle(centerX, archY + 26, archWidth, archHeight, 0x070708, 0.68)
      .setStrokeStyle(2, FORGE_DARK.bronze, 0.38)
      .setDepth(1);

    this.add.ellipse(centerX, archY - 34, archWidth * 0.72, 120, 0x120b09, 0.82)
      .setStrokeStyle(2, FORGE_DARK.bronze, 0.46)
      .setDepth(1);

    const pillarOffset = archWidth / 2 + 12;
    this.add.rectangle(centerX - pillarOffset, archY + 24, 34, archHeight + 54, FORGE_DARK.stone, 0.86)
      .setStrokeStyle(1, 0x4b4235, 0.48)
      .setDepth(2);
    this.add.rectangle(centerX + pillarOffset, archY + 24, 34, archHeight + 54, FORGE_DARK.stone, 0.86)
      .setStrokeStyle(1, 0x4b4235, 0.48)
      .setDepth(2);

    this.add.rectangle(centerX, archY + 86, archWidth + 56, 30, 0x100c0a, 0.96)
      .setStrokeStyle(2, FORGE_DARK.bronze, 0.36)
      .setDepth(3);

    this.add.circle(centerX, archY + 42, 54, FORGE_DARK.ember, 0.18).setDepth(2);
    this.add.circle(centerX, archY + 46, 32, FORGE_DARK.gold, 0.055).setDepth(2);

    this.add.text(centerX, archY + 36, '⚒', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '58px' : '70px',
      color: '#c4a265',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0.28).setDepth(4);

    for (let i = 0; i < 34; i += 1) {
      const x = layout.safeX + 8 + (i * 47) % Math.max(1, width - layout.safeX * 2 - 16);
      const y = layout.safeTop + 78 + (i * 83) % Math.max(1, height - layout.safeTop - layout.safeBottom - 120);
      const color = i % 4 === 0 ? FORGE_DARK.ember : FORGE_DARK.ash;
      const alpha = 0.025 + (i % 5) * 0.008;

      this.add.circle(x, y, 1 + (i % 3), color, alpha).setDepth(2);
    }

    for (let i = 0; i < 6; i += 1) {
      const y = height - 270 + i * 42;
      this.add.line(0, 0, layout.safeX + 10, y, width - layout.safeX - 10, y + (i % 2) * 8, 0x211a14, 0.25)
        .setOrigin(0, 0)
        .setDepth(1);
    }
  }

  private createHeader(layout: ForgeLayout) {
    const panelHeight = layout.compact ? 82 : 92;
    const panelY = layout.safeTop + panelHeight / 2;

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: FORGE_DARK.graphite,
      alpha: 0.9,
      strokeColor: FORGE_DARK.bronze,
      strokeAlpha: 0.56,
      strokeWidth: 2,
      glowColor: FORGE_DARK.ember,
      depth: 160,
    });

    this.add.text(layout.centerX, panelY - 18, 'Кузница Пепельного Молота', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '25px' : '29px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(166);

    this.add.text(layout.centerX, panelY + 19, 'Закалка оружия, брони и талисманов перед спуском', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '12px' : '14px',
      color: '#928a7d',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 64,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(166);
  }

  private createResourcePanel(layout: ForgeLayout) {
    const panelY = layout.safeTop + (layout.compact ? 124 : 136);

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: layout.compact ? 66 : 72,
      radius: 24,
      color: FORGE_DARK.soot,
      alpha: 0.96,
      strokeColor: FORGE_DARK.bronze,
      strokeAlpha: 0.52,
      strokeWidth: 2,
      glowColor: FORGE_DARK.ember,
      depth: 120,
    });

    const chipWidth = Math.min((layout.contentWidth - 46) / 3, 178);
    const startX = layout.centerX - chipWidth - 9;

    this.createResourceChip({
      x: startX,
      y: panelY,
      width: chipWidth,
      icon: '◆',
      title: 'Золото',
      value: `${player.gold}`,
      color: FORGE_DARK.gold,
    });

    this.createResourceChip({
      x: layout.centerX,
      y: panelY,
      width: chipWidth,
      icon: '◇',
      title: 'Материалы',
      value: `${this.getTotalMaterialsCount()}`,
      color: FORGE_DARK.cold,
    });

    this.createResourceChip({
      x: layout.centerX + chipWidth + 9,
      y: panelY,
      width: chipWidth,
      icon: '⚒',
      title: 'Наковальня',
      value: `Ур. ${player.anvilLevel}`,
      color: player.anvilLevel >= 2 ? 0x75a982 : FORGE_DARK.ember,
    });
  }

  private createScrollableContent(layout: ForgeLayout) {
    this.contentContainer?.destroy(true);

    this.contentContainer = this.add.container(0, 0).setDepth(5);

    const maskGraphics = this.add.graphics();
    maskGraphics.setVisible(false);
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.fillRect(
      layout.safeX,
      layout.contentTop,
      layout.width - layout.safeX * 2,
      layout.viewportHeight
    );

    const mask = maskGraphics.createGeometryMask();
    this.contentContainer.setMask(mask);

    let cursorY = layout.contentTop + 16;

    cursorY = this.createInfoPanel(layout, cursorY);
    cursorY = this.createAnvilPanel(layout, cursorY + 14);
    cursorY = this.createMaterialPanel(layout, cursorY + 14);
    cursorY = this.createCategoryTabs(layout, cursorY + 14);
    cursorY = this.createItemListPanel(layout, cursorY + 14);

    const contentHeight = cursorY - layout.contentTop + 24;

    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScrollY);
    this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY, 0, this.maxScrollY);

    if (this.contentContainer) {
      this.contentContainer.y = -this.currentScrollY;
    }

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

      if (!this.isPointerInsideScrollArea(pointer, layout)) {
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

      if (Math.abs(distance) < 8) {
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

        if (!this.isPointerInsideScrollArea(pointer, layout)) {
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

  private isPointerInsideScrollArea(pointer: Phaser.Input.Pointer, layout: ForgeLayout) {
    return (
      pointer.x >= layout.safeX &&
      pointer.x <= layout.width - layout.safeX &&
      pointer.y >= layout.contentTop &&
      pointer.y <= layout.contentBottom
    );
  }

  private createScrollHint(layout: ForgeLayout) {
    const hintY = layout.contentBottom - 18;

    const bg = this.add.rectangle(layout.centerX, hintY, 246, 28, 0x000000, 0.48)
      .setDepth(230);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай список закалки', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#928a7d',
      align: 'center',
      wordWrap: {
        width: 230,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(231);

    this.tweens.add({
      targets: [bg, text],
      alpha: 0.22,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private createAnvilPanel(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = layout.compact ? 166 : 178;
    const panelY = topY + panelHeight / 2;

    const anvilCost = getAnvilUpgradeCost();
    const canUpgrade = canUpgradeAnvil();
    const isUpgraded = player.anvilLevel >= 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: isUpgraded ? 0x0c1611 : FORGE_DARK.soot,
      alpha: 0.96,
      strokeColor: isUpgraded ? 0x75a982 : FORGE_DARK.bronze,
      strokeAlpha: isUpgraded ? 0.72 : 0.52,
      glowColor: isUpgraded ? 0x75a982 : FORGE_DARK.ember,
      depth: 2,
    });

    const left = layout.centerX - layout.contentWidth / 2;
    const right = layout.centerX + layout.contentWidth / 2;

    this.addTo(
      container,
      this.add.circle(left + 52, topY + 70, 38, 0x1b120d, 0.98)
        .setStrokeStyle(2, isUpgraded ? 0x75a982 : FORGE_DARK.gold, 0.82)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 52, topY + 70, '⚒', {
        fontFamily: UI.font.body,
        fontSize: '28px',
        color: isUpgraded ? '#9fd0a6' : '#d8c088',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(left + 102, topY + 32, `Наковальня ${player.anvilLevel} уровня`, {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '19px' : '22px',
        color: '#d8c088',
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 252,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    const description = isUpgraded
      ? 'Железо помнит удар. Высокая закалка открыта для редких трофеев.'
      : `Усиление откроет предел выше +5. Нужно: ${this.createAnvilCostNeedText(anvilCost)}.`;

    this.addTo(
      container,
      this.add.text(left + 102, topY + 72, description, {
        fontFamily: UI.font.body,
        fontSize: layout.compact ? '12px' : '13px',
        color: '#b9ad9b',
        lineSpacing: 3,
        wordWrap: {
          width: layout.contentWidth - 260,
          useAdvancedWrap: true,
        },
        maxLines: 3,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.createAnvilProgress(container, left + 102, topY + 124, Math.min(layout.contentWidth - 290, 310));

    this.createForgeButton({
      parent: container,
      x: right - 82,
      y: topY + 84,
      width: 132,
      height: 50,
      text: isUpgraded ? 'Усилено' : 'Усилить',
      disabled: isUpgraded || !canUpgrade,
      variant: isUpgraded ? 'green' : 'gold',
      onClick: () => {
        this.handleAnvilUpgrade();
      },
      depth: 8,
      small: true,
    });

    return topY + panelHeight;
  }

  private createMaterialPanel(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const materialIds: MaterialId[] = [
      'darkened_bone',
      'dim_gem',
      'old_leather',
      'dark_flame_heart',
      'black_gem',
      'cursed_seal',
      'black_sarcophagus_shard',
    ];

    const panelHeight = layout.compact ? 170 : 184;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: FORGE_DARK.graphite,
      alpha: 0.94,
      strokeColor: FORGE_DARK.bronze,
      strokeAlpha: 0.42,
      glowColor: FORGE_DARK.cold,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 30, 'Склад материалов', {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '21px' : '24px',
        color: '#d8c088',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 60,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );

    const chipWidth = (layout.contentWidth - 68) / 2;
    const leftX = layout.centerX - chipWidth / 2 - 8;
    const rightX = layout.centerX + chipWidth / 2 + 8;

    materialIds.forEach((id, index) => {
      const x = index % 2 === 0 ? leftX : rightX;
      const y = topY + 68 + Math.floor(index / 2) * (layout.compact ? 24 : 27);

      this.createMaterialLine(container, x, y, id, chipWidth);
    });

    return topY + panelHeight;
  }

  private createCategoryTabs(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = layout.compact ? 78 : 84;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: FORGE_DARK.soot,
      alpha: 0.95,
      strokeColor: FORGE_DARK.bronze,
      strokeAlpha: 0.42,
      glowColor: FORGE_DARK.ember,
      depth: 2,
    });

    const tabs: Array<{
      id: ForgeCategory;
      label: string;
      icon: string;
    }> = [
      { id: 'weapon', label: 'Оружие', icon: '⚔' },
      { id: 'armor', label: 'Броня', icon: '▣' },
      { id: 'trinket', label: 'Талисм.', icon: '✦' },
    ];

    const tabWidth = (layout.contentWidth - 58) / 3;
    const startX = layout.centerX - layout.contentWidth / 2 + 29 + tabWidth / 2;

    tabs.forEach((tab, index) => {
      const isActive = this.selectedCategory === tab.id;
      const x = startX + index * tabWidth;

      this.createForgeButton({
        parent: container,
        x,
        y: panelY,
        width: tabWidth - 8,
        height: layout.compact ? 44 : 48,
        text: `${tab.icon} ${tab.label}`,
        disabled: false,
        variant: isActive ? 'gold' : 'dark',
        onClick: () => {
          if (this.selectedCategory === tab.id) {
            return;
          }

          this.scene.restart({
            selectedCategory: tab.id,
            scrollY: 0,
          });
        },
        depth: 8,
        small: true,
      });
    });

    return topY + panelHeight;
  }

  private createItemListPanel(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();
    const itemsForForge = this.getForgeItemsByCategory(this.selectedCategory);

    const title = this.getCategoryTitle(this.selectedCategory);
    const icon = this.getCategoryIcon(this.selectedCategory);

    const cardHeight = layout.compact ? 300 : 316;
    const cardGap = 14;
    const headerHeight = layout.compact ? 96 : 104;
    const bottomPadding = 26;

    const emptyHeight = layout.compact ? 248 : 270;
    const listHeight = itemsForForge.length === 0
      ? emptyHeight
      : headerHeight + itemsForForge.length * cardHeight + Math.max(0, itemsForForge.length - 1) * cardGap + bottomPadding;

    const panelY = topY + listHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: listHeight,
      radius: 32,
      color: FORGE_DARK.soot,
      alpha: 0.96,
      strokeColor: FORGE_DARK.bronze,
      strokeAlpha: 0.5,
      glowColor: FORGE_DARK.violet,
      depth: 2,
    });

    const left = layout.centerX - layout.contentWidth / 2;
    const right = layout.centerX + layout.contentWidth / 2;

    this.addTo(
      container,
      this.add.text(left + 28, topY + 34, `${icon} ${title}`, {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '21px' : '24px',
        color: '#d8c088',
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 168,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(right - 28, topY + 34, `${itemsForForge.length} шт.`, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: '#928a7d',
        align: 'right',
        wordWrap: {
          width: 100,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(left + 28, topY + 68, 'Список прокручивается вместе с кузницей. Надетые вещи и редкость поднимаются выше.', {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: '#8c8478',
        wordWrap: {
          width: layout.contentWidth - 56,
          useAdvancedWrap: true,
        },
        maxLines: 2,
        lineSpacing: 2,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    if (itemsForForge.length === 0) {
      this.createEmptyList(container, layout, topY + 142);
      return topY + listHeight;
    }

    itemsForForge.forEach((inventoryItem, index) => {
      const y = topY + headerHeight + cardHeight / 2 + index * (cardHeight + cardGap);

      this.createForgeItemCard(container, layout, inventoryItem, y, cardHeight);
    });

    return topY + listHeight;
  }

  private createEmptyList(
    container: Phaser.GameObjects.Container,
    layout: ForgeLayout,
    y: number
  ) {
    const icon = this.getCategoryIcon(this.selectedCategory);

    this.addTo(
      container,
      this.add.circle(layout.centerX, y - 30, 48, 0x21150f, 0.92)
        .setStrokeStyle(2, UI.colors.goldDark, 0.7)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(layout.centerX, y - 30, icon, {
        fontFamily: UI.font.body,
        fontSize: '34px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(layout.centerX, y + 58, `В сумке нет предметов этого типа.\nИх можно найти в катакомбах, купить в лавке или получить с боссов.`, {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: UI.colors.textMuted,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 70,
        },
        maxLines: 3,
        lineSpacing: 5,
      }).setOrigin(0.5).setDepth(8)
    );
  }

  private createForgeItemCard(
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
    const rarityMaxUpgrade = this.getRarityMaxUpgradeLevel(item);
    const availableMaxUpgrade = this.getAvailableMaxUpgradeLevel(item);
    const anvilMaxUpgrade = this.getAnvilMaxUpgradeLevel();
    const cost = this.getUpgradeCost(inventoryItem);
    const canUpgrade = this.canUpgradeItem(inventoryItem);
    const isRarityMaxLevel = upgradeLevel >= rarityMaxUpgrade;
    const isAnvilLocked = upgradeLevel >= availableMaxUpgrade && upgradeLevel < rarityMaxUpgrade;
    const isMaxLevel = isRarityMaxLevel || isAnvilLocked;

    const rarityColor = getRarityColorHex(item);
    const rarityStrokeColor = getRarityStrokeColor(item);

    const cardX = layout.centerX;
    const cardWidth = layout.contentWidth - 32;
    const left = cardX - cardWidth / 2;
    const top = y - cardHeight / 2;
    const bottom = y + cardHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: cardX,
      y,
      width: cardWidth,
      height: cardHeight,
      radius: 26,
      color: equipped ? 0x1c1510 : FORGE_DARK.graphite,
      alpha: 0.97,
      strokeColor: equipped ? FORGE_DARK.gold : rarityStrokeColor,
      strokeAlpha: equipped ? 0.9 : 0.68,
      strokeWidth: equipped ? 2 : 1,
      glowColor: rarityColor,
      depth: 5,
    });

    const rarityBar = this.add.graphics();
    rarityBar.fillStyle(rarityColor, 0.9);
    rarityBar.fillRoundedRect(left + 7, top + 12, 8, cardHeight - 24, 6);
    rarityBar.setDepth(8);
    container.add(rarityBar);

    const iconX = left + 46;
    const textX = left + 84;
    const titleWidth = cardWidth - 112;
    const innerLeft = left + 22;
    const innerWidth = cardWidth - 44;

    this.addTo(
      container,
      this.add.circle(iconX, top + 42, 27, rarityColor, 0.2)
        .setStrokeStyle(2, rarityStrokeColor, 0.78)
        .setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(iconX, top + 42, getSlotIcon(item.slot), {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: '#f1eadc',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(10)
    );

    this.addTo(
      container,
      this.add.text(textX, top + 20, `${item.name} +${upgradeLevel}`, {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '15px' : '17px',
        color: equipped ? '#d8c088' : '#d8d0bf',
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
      this.createEquippedBadge(container, left + cardWidth - 58, top + 31, 10);
    }

    this.addTo(
      container,
      this.add.text(textX, top + 72, `${getRarityText(item)} • ${this.getItemTypeText(item)} • предел +${rarityMaxUpgrade}`, {
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
      top + 100,
      Math.min(innerWidth - 58, 360),
      upgradeLevel,
      rarityMaxUpgrade,
      rarityColor
    );

    this.addTo(
      container,
      this.add.text(innerLeft, top + 130, createItemStatsText(inventoryItem) || 'Без бонусов', {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: '#9b9488',
        wordWrap: {
          width: innerWidth,
          useAdvancedWrap: true,
        },
        maxLines: 2,
        lineSpacing: 2,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    if (isRarityMaxLevel || isAnvilLocked) {
      const lockedText = isRarityMaxLevel
        ? `Достигнут предел редкости: +${rarityMaxUpgrade}`
        : `Нужна наковальня II для улучшения выше +${anvilMaxUpgrade}`;

      this.createLockedCostPanel(
        container,
        innerLeft,
        bottom - 106,
        innerWidth,
        lockedText,
        isRarityMaxLevel,
        10
      );
    } else {
      this.createUpgradeCostPanel(
        container,
        innerLeft,
        bottom - 106,
        innerWidth,
        cost,
        canUpgrade,
        10
      );
    }

    this.createForgeButton({
      parent: container,
      x: cardX,
      y: bottom - 34,
      width: innerWidth,
      height: 50,
      text: isRarityMaxLevel
        ? 'Предмет закалён до предела'
        : isAnvilLocked
          ? 'Нужна наковальня II'
          : 'Улучшить предмет',
      disabled: isRarityMaxLevel || isAnvilLocked || !canUpgrade,
      variant: isMaxLevel ? 'green' : canUpgrade ? 'gold' : 'dark',
      onClick: () => {
        this.showUpgradeConfirm(inventoryItem);
      },
      depth: 11,
      small: layout.compact,
    });
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
    bg.fillRoundedRect(
      x - width / 2,
      y - height / 2,
      width,
      height,
      radius
    );

    bg.lineStyle(1, UI.colors.gold, 0.86);
    bg.strokeRoundedRect(
      x - width / 2,
      y - height / 2,
      width,
      height,
      radius
    );

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
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(depth + 1);

    container.add([bg, label]);

    return {
      bg,
      label,
    };
  }

  private getRarityMaxUpgradeLevel(item: NonNullable<ReturnType<typeof getBaseItemFromInventoryItem>>) {
    if (item.rarity === 'common') return 3;
    if (item.rarity === 'rare') return 5;
    if (item.rarity === 'epic') return 7;
    if (item.rarity === 'legendary') return 10;
    if (item.rarity === 'mythic') return 10;

    return 3;
  }

  private getAnvilMaxUpgradeLevel() {
    return player.anvilLevel >= 2 ? 10 : 5;
  }

  private getAvailableMaxUpgradeLevel(item: NonNullable<ReturnType<typeof getBaseItemFromInventoryItem>>) {
    return Math.min(
      this.getRarityMaxUpgradeLevel(item),
      this.getAnvilMaxUpgradeLevel()
    );
  }

  private createInfoPanel(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = layout.compact ? 124 : 134;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: FORGE_DARK.graphite,
      alpha: 0.94,
      strokeColor: FORGE_DARK.bronze,
      strokeAlpha: 0.46,
      glowColor: FORGE_DARK.violet,
      depth: 2,
    });

    const left = layout.centerX - layout.contentWidth / 2 + 28;

    this.addTo(
      container,
      this.add.text(left, topY + 32, 'Правила закалки', {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '20px' : '22px',
        color: '#d8c088',
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 56,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(
        left,
        topY + 79,
        'Выбери тип предмета, проверь стоимость и улучши вещь. Надетая экипировка в списке поднимается выше, а предметы прокручиваются внутри общей безопасной области.',
        {
          fontFamily: UI.font.body,
          fontSize: layout.compact ? '13px' : '14px',
          color: '#9b9488',
          lineSpacing: 4,
          wordWrap: {
            width: layout.contentWidth - 56,
            useAdvancedWrap: true,
          },
          maxLines: 3,
        }
      ).setOrigin(0, 0.5).setDepth(8)
    );

    return topY + panelHeight;
  }

  private createBottomActions(layout: ForgeLayout) {
    const y = layout.height - 52;

    this.add.rectangle(layout.centerX, y + 32, layout.width, 112, 0x020202, 0.72).setDepth(236);
    this.add.rectangle(layout.centerX, y - 33, layout.contentWidth, 1, FORGE_DARK.bronze, 0.26).setDepth(237);

    this.createForgeButton({
      x: layout.centerX,
      y,
      width: Math.min(layout.contentWidth, 540),
      height: 54,
      text: 'Вернуться в лагерь',
      variant: 'gold',
      onClick: () => {
        this.scene.start('CampScene');
      },
      depth: 240,
    });
  }

  private showUpgradeConfirm(inventoryItem: InventoryItem) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return;
    }

    const currentLevel = inventoryItem.upgradeLevel ?? 0;
    const maxLevel = this.getMaxUpgradeLevelForItem(inventoryItem);
    const cost = this.getUpgradeCost(inventoryItem);
    const canUpgrade = this.canUpgradeItem(inventoryItem);

    const description = [
      `${getRarityText(item)} • ${this.getItemTypeText(item)}`,
      `Текущий уровень: +${currentLevel}/${maxLevel}`,
      '',
      createItemStatsText(inventoryItem) || 'Без бонусов',
      '',
      currentLevel >= maxLevel
        ? 'Предмет уже достиг максимального уровня.'
        : `Цена улучшения:\n${this.createUpgradeCostText(cost)}`,
    ].join('\n');

    this.showConfirmModal({
      title: item.name,
      description,
      confirmText: canUpgrade ? 'Улучшить' : 'Недостаточно ресурсов',
      disabled: !canUpgrade,
      onConfirm: () => {
        this.handleItemUpgrade(inventoryItem);
      },
    });
  }

  private showConfirmModal(config: {
    title: string;
    description: string;
    confirmText: string;
    disabled?: boolean;
    onConfirm: () => void;
  }) {
    const { width, height } = this.scale;

    this.isModalOpen = true;

    const modal = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.74)
      .setInteractive();

    modal.add(overlay);

    this.createRoundedPanel({
      parent: modal,
      x: width / 2,
      y: height / 2,
      width: Math.min(width - 52, 620),
      height: 500,
      radius: 32,
      color: 0x17100c,
      alpha: 0.98,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.9,
      strokeWidth: 3,
      glowColor: 0xf0a040,
      depth: 1001,
    });

    const titleText = this.add.text(width / 2, height / 2 - 182, config.title, {
      fontFamily: UI.font.title,
      fontSize: '25px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: Math.min(width - 100, 520),
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(1004);

    const descriptionText = this.add.text(width / 2, height / 2 - 40, config.description, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: Math.min(width - 100, 520),
      },
      maxLines: 11,
      lineSpacing: 5,
    }).setOrigin(0.5).setDepth(1004);

    modal.add([titleText, descriptionText]);

    const close = () => {
      modal.destroy(true);
      this.isModalOpen = false;
    };

    this.createForgeButton({
      parent: modal,
      x: width / 2,
      y: height / 2 + 152,
      width: 360,
      height: 54,
      text: config.confirmText,
      variant: 'green',
      disabled: config.disabled ?? false,
      onClick: () => {
        close();
        config.onConfirm();
      },
      depth: 1004,
    });

    this.createForgeButton({
      parent: modal,
      x: width / 2,
      y: height / 2 + 216,
      width: 360,
      height: 54,
      text: 'Отмена',
      variant: 'gold',
      onClick: () => {
        close();
      },
      depth: 1004,
    });
  }

  private showMessage(message: string) {
    const { width, height } = this.scale;

    this.isModalOpen = true;
    this.isActionLocked = false;

    const modal = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.74)
      .setInteractive();

    modal.add(overlay);

    this.createRoundedPanel({
      parent: modal,
      x: width / 2,
      y: height / 2,
      width: Math.min(width - 52, 600),
      height: 300,
      radius: 30,
      color: 0x17100c,
      alpha: 0.98,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.9,
      strokeWidth: 3,
      glowColor: 0xf0a040,
      depth: 1001,
    });

    const titleText = this.add.text(width / 2, height / 2 - 96, 'Кузница', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: Math.min(width - 100, 520),
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(1004);

    const messageText = this.add.text(width / 2, height / 2 - 10, message, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 6,
      wordWrap: {
        width: Math.min(width - 100, 520),
      },
      maxLines: 6,
    }).setOrigin(0.5).setDepth(1004);

    modal.add([titleText, messageText]);

    this.createForgeButton({
      parent: modal,
      x: width / 2,
      y: height / 2 + 102,
      width: 260,
      height: 54,
      text: 'Понятно',
      variant: 'gold',
      onClick: () => {
        modal.destroy(true);
        this.isModalOpen = false;
        this.scene.restart({
          selectedCategory: this.selectedCategory,
          scrollY: this.targetScrollY,
        });
      },
      depth: 1004,
    });
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
      this.showMessage('Недостаточно ресурсов или достигнут предел улучшения.');
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

        // Сначала показываем то, что сейчас надето: игрок чаще всего хочет
        // улучшать активную экипировку, а не искать её в середине списка.
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
    const currentLevel = inventoryItem.upgradeLevel ?? 0;
    const nextLevel = currentLevel + 1;

    if (!item) {
      return {
        gold: 0,
        materials: [],
      };
    }

    const rarityMultiplier = this.getRarityCostMultiplier(item);
    const slotMultiplier = item.slot === 'weapon'
      ? 1.12
      : item.slot === 'armor'
        ? 1.02
        : 1.18;

    const gold = Math.ceil((90 + nextLevel * 52 + nextLevel * nextLevel * 18) * rarityMultiplier * slotMultiplier / 10) * 10;
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
        amount: 2 + (nextLevel - 8),
      });
      materials.push({
        id: 'black_sarcophagus_shard',
        amount: nextLevel - 7,
      });
      materials.push({
        id: 'black_gem',
        amount: Math.max(1, nextLevel - 8),
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
    const maxLevel = this.getMaxUpgradeLevelForItem(inventoryItem);

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

  private getMaxUpgradeLevelForItem(inventoryItem: InventoryItem) {
    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return 0;
    }

    const rarityMax = this.getRarityMaxLevel(item);

    if (player.anvilLevel >= 2) {
      return rarityMax;
    }

    return Math.min(rarityMax, 5);
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
    if (slot === 'trinket') return 'dim_gem';

    return 'darkened_bone';
  }

  private getAdvancedMaterialForSlot(slot: EquipmentSlot): MaterialId {
    if (slot === 'weapon') return 'dark_flame_heart';
    if (slot === 'armor') return 'black_sarcophagus_shard';
    if (slot === 'trinket') return 'black_gem';

    return 'dark_flame_heart';
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

  private createUpgradeCostPanel(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    cost: UpgradeCost,
    canUpgrade: boolean,
    depth: number
  ) {
    const lineCount = 1 + cost.materials.length;
    const panelHeight = Phaser.Math.Clamp(28 + lineCount * 17, 66, 90);
    const panelX = x + width / 2;

    this.createRoundedPanel({
      parent: container,
      x: panelX,
      y,
      width,
      height: panelHeight,
      radius: 16,
      color: canUpgrade ? 0x0f1510 : 0x17100c,
      alpha: 0.82,
      strokeColor: canUpgrade ? 0x75d184 : 0xff6b6b,
      strokeAlpha: canUpgrade ? 0.34 : 0.5,
      strokeWidth: 1,
      glowColor: canUpgrade ? 0x75d184 : 0xff6b6b,
      depth,
    });

    const left = x + 12;
    const lineWidth = width - 24;

    this.addTo(
      container,
      this.add.text(left, y - panelHeight / 2 + 13, 'Нужно для улучшения', {
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

    let lineY = y - panelHeight / 2 + 30;

    this.createUpgradeCostLine(
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
      const enough = owned >= material.amount;

      lineY += 17;

      this.createUpgradeCostLine(
        container,
        left,
        lineY,
        `${this.getShortMaterialName(material.id)}: ${owned} / ${material.amount}`,
        enough,
        lineWidth,
        depth + 3
      );
    });
  }

  private createUpgradeCostLine(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    text: string,
    enough: boolean,
    width: number,
    depth: number
  ) {
    const mark = enough ? '✓' : '!';

    this.addTo(
      container,
      this.add.text(x, y, `${mark} ${text}`, {
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

  private createLockedCostPanel(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    text: string,
    success: boolean,
    depth: number
  ) {
    const panelX = x + width / 2;
    const panelHeight = 58;

    this.createRoundedPanel({
      parent: container,
      x: panelX,
      y,
      width,
      height: panelHeight,
      radius: 16,
      color: success ? 0x0f1510 : 0x17100c,
      alpha: 0.82,
      strokeColor: success ? 0x75d184 : UI.colors.goldDark,
      strokeAlpha: 0.44,
      strokeWidth: 1,
      glowColor: success ? 0x75d184 : 0xf0a040,
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
    const goldLine = `${goldEnough ? '✓' : '!'} Золото: ${player.gold}/${cost.gold}`;

    const materialText = cost.materials
      .map(material => {
        const owned = player.materials[material.id] ?? 0;
        const enough = owned >= material.amount;

        return `${enough ? '✓' : '!'} ${this.getShortMaterialName(material.id)}: ${owned}/${material.amount}`;
      })
      .join('\\n');

    return [goldLine, materialText].filter(Boolean).join('\\n');
  }

  private createAnvilCostNeedText(cost: {
    materialId: MaterialId;
    amount: number;
    gold: number;
  }) {
    const ownedMaterial = player.materials[cost.materialId] ?? 0;
    const materialEnough = ownedMaterial >= cost.amount;
    const goldEnough = player.gold >= cost.gold;

    return [
      `${materialEnough ? '✓' : '!'} ${this.getShortMaterialName(cost.materialId)}: ${ownedMaterial}/${cost.amount}`,
      `${goldEnough ? '✓' : '!'} золото: ${player.gold}/${cost.gold}`,
    ].join(', ');
  }

  private getShortMaterialName(id: MaterialId) {
    if (id === 'darkened_bone') return 'Кость';
    if (id === 'dim_gem') return 'Самоцвет';
    if (id === 'old_leather') return 'Кожа';
    if (id === 'dark_flame_heart') return 'Сердце';
    if (id === 'black_gem') return 'Чёрн. самоцвет';
    if (id === 'cursed_seal') return 'Печать';
    if (id === 'black_sarcophagus_shard') return 'Осколок';

    return getMaterialName(id);
  }

  private getTotalMaterialsCount() {
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
    return '✦';
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
    if (item.rarity === 'rare') return '#70a6ff';
    if (item.rarity === 'epic') return '#c084fc';
    if (item.rarity === 'legendary') return '#f0d58a';
    if (item.rarity === 'mythic') return '#ff6b6b';

    return UI.colors.textMuted;
  }

  private createResourceChip(config: {
    x: number;
    y: number;
    width: number;
    icon: string;
    title: string;
    value: string;
    color: number;
  }) {
    this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: 52,
      radius: 18,
      color: 0x17100c,
      alpha: 0.96,
      strokeColor: config.color,
      strokeAlpha: 0.32,
      strokeWidth: 1,
      glowColor: config.color,
      depth: 12,
    });

    const left = config.x - config.width / 2;

    this.add.circle(left + 27, config.y, 16, config.color, 0.18)
      .setStrokeStyle(1, config.color, 0.55)
      .setDepth(15);

    this.add.text(left + 27, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(16);

    this.add.text(left + 50, config.y - 9, config.title, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: config.width - 56,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(16);

    this.add.text(left + 50, config.y + 11, config.value, {
      fontFamily: UI.font.title,
      fontSize: '16px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: config.width - 56,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(16);
  }

  private createMaterialLine(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    id: MaterialId,
    width: number
  ) {
    const amount = player.materials[id] ?? 0;

    this.addTo(
      container,
      this.add.text(x - width / 2 + 8, y, `${this.getMaterialIcon(id)} ${getMaterialName(id)}: ${amount}`, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: amount > 0 ? UI.colors.text : UI.colors.textMuted,
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: width - 12,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );
  }

  private createAnvilProgress(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number
  ) {
    const progress = player.anvilLevel >= 2 ? 1 : 0.45;
    const safeWidth = Math.max(120, width);

    this.addTo(
      container,
      this.add.rectangle(x + safeWidth / 2, y, safeWidth, 8, 0x000000, 0.42).setDepth(7)
    );

    this.addTo(
      container,
      this.add.rectangle(
        x + (safeWidth * progress) / 2,
        y,
        safeWidth * progress,
        8,
        player.anvilLevel >= 2 ? 0x75d184 : UI.colors.gold,
        0.9
      ).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(x + safeWidth + 12, y, player.anvilLevel >= 2 ? 'II' : 'I', {
        fontFamily: UI.font.title,
        fontSize: '14px',
        color: player.anvilLevel >= 2 ? UI.colors.green : UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0, 0.5).setDepth(8)
    );
  }

  private createUpgradeProgressBar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    level: number,
    maxLevel: number,
    color: number
  ) {
    const progress = maxLevel <= 0 ? 0 : Phaser.Math.Clamp(level / maxLevel, 0, 1);
    const radius = 5;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.48);
    bg.fillRoundedRect(x, y - 4, width, 8, radius);
    bg.setDepth(9);

    const track = this.add.graphics();
    track.fillStyle(0x2b211a, 0.9);
    track.fillRoundedRect(x, y - 4, width, 8, radius);
    track.setDepth(10);

    container.add([bg, track]);

    if (progress > 0) {
      const fill = this.add.graphics();
      fill.fillStyle(color, 0.95);
      fill.fillRoundedRect(x, y - 4, width * progress, 8, radius);
      fill.setDepth(11);
      container.add(fill);
    }

    this.addTo(
      container,
      this.add.text(x + width + 10, y, `+${level}/${maxLevel}`, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: UI.colors.textMuted,
      }).setOrigin(0, 0.5).setDepth(11)
    );
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
    variant?: 'gold' | 'green' | 'red' | 'dark';
    depth?: number;
    small?: boolean;
  }): ForgeButton {
    const disabled = config.disabled ?? false;
    const variant = config.variant ?? 'gold';
    const depth = config.depth ?? 8;
    const radius = Math.min(18, config.height / 2);

    const strokeColor = disabled
      ? 0x3c342c
      : variant === 'green'
        ? 0x75d184
        : variant === 'red'
          ? 0xff6b6b
          : variant === 'dark'
            ? UI.colors.goldDark
            : UI.colors.gold;

    const fillColor = disabled
      ? FORGE_DARK.soot
      : variant === 'green'
        ? 0x102016
        : variant === 'red'
          ? 0x241010
          : variant === 'dark'
            ? FORGE_DARK.graphite
            : 0x1c130d;

    const hoverColor = variant === 'green'
      ? 0x183322
      : variant === 'red'
        ? 0x321515
        : 0x2c1d14;

    const textColor = disabled
      ? UI.colors.textMuted
      : variant === 'green'
        ? UI.colors.green
        : variant === 'red'
          ? UI.colors.red
          : UI.colors.goldText;

    const hoverTextColor = disabled ? UI.colors.textMuted : '#ffffff';

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
    bg.lineStyle(2, strokeColor, disabled ? 0.35 : 0.85);
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
      fontSize: config.small ? '12px' : '15px',
      color: textColor,
      stroke: '#000000',
      strokeThickness: disabled ? 1 : 2,
      align: 'center',
      wordWrap: {
        width: config.width - 12,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(depth + 2);

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(depth + 3);

    const objects: Phaser.GameObjects.GameObject[] = [shadow, bg, label, zone];

    if (config.parent) {
      config.parent.add(objects);
    }

    const redrawButton = (
      color: number,
      alpha: number,
      strokeAlpha: number,
      labelColor: string,
      labelOffsetY = 0
    ) => {
      bg.clear();

      bg.fillStyle(color, alpha);
      bg.fillRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );

      bg.lineStyle(2, strokeColor, strokeAlpha);
      bg.strokeRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );

      label.setY(config.y + labelOffsetY);
      label.setColor(labelColor);
    };

    if (!disabled) {
      let isPressed = false;

      zone.setInteractive({
        useHandCursor: true,
      });

      zone.on('pointerover', () => {
        if (isPressed) {
          return;
        }

        redrawButton(hoverColor, 1, 1, hoverTextColor);
      });

      zone.on('pointerout', () => {
        isPressed = false;
        redrawButton(fillColor, 0.96, 0.85, textColor);
      });

      zone.on('pointerdown', () => {
        isPressed = true;
        redrawButton(hoverColor, 0.92, 0.95, hoverTextColor, 1);
      });

      zone.on('pointerup', () => {
        if (!isPressed) {
          return;
        }

        isPressed = false;
        redrawButton(hoverColor, 1, 1, hoverTextColor);

        if (this.didDragContent) {
          return;
        }

        this.time.delayedCall(40, () => {
          config.onClick();
        });
      });

      zone.on('pointerupoutside', () => {
        isPressed = false;
        redrawButton(fillColor, 0.96, 0.85, textColor);
      });

      zone.on('pointercancel', () => {
        isPressed = false;
        redrawButton(fillColor, 0.96, 0.85, textColor);
      });
    }

    return {
      objects,
      zone,
    };
  }

  private createRoundedPanel(config: {
    parent?: Phaser.GameObjects.Container;
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
    glowColor?: number;
    depth?: number;
  }) {
    const radius = config.radius ?? 28;
    const color = config.color ?? 0x100b08;
    const alpha = config.alpha ?? 0.94;
    const strokeColor = config.strokeColor ?? UI.colors.goldDark;
    const strokeAlpha = config.strokeAlpha ?? 0.48;
    const strokeWidth = config.strokeWidth ?? 2;
    const glowColor = config.glowColor ?? 0xf0a040;
    const depth = config.depth ?? 2;

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2 + 8,
      safeWidth,
      safeHeight,
      radius
    );
    shadow.setDepth(depth);

    const panel = this.add.graphics();
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2,
      safeWidth,
      safeHeight,
      radius
    );

    panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    panel.strokeRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2,
      safeWidth,
      safeHeight,
      radius
    );
    panel.setDepth(depth + 1);

    const glow = this.add.circle(
      config.x,
      config.y - safeHeight / 2 + 28,
      safeWidth * 0.26,
      glowColor,
      0.045
    ).setDepth(depth + 2);

    if (config.parent) {
      config.parent.add([shadow, panel, glow]);
    }

    return {
      shadow,
      panel,
      glow,
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
