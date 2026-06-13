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

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.025), 20, 34);
    const safeBottom = 96;

    const contentTop = safeTop + 176;
    const contentBottom = height - safeBottom;
    const contentWidth = Math.min(width - safeX * 2, 620);

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
      viewportHeight: Math.max(320, contentBottom - contentTop),

      compact: height < 1120,
    };
  }

  private createForgeBackdrop(layout: ForgeLayout) {
    const { width, height, centerX } = layout;

    this.add.circle(centerX, layout.safeTop + 135, width * 0.46, 0x8a3f1c, 0.09).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 150, width * 0.28, 0xf0a040, 0.055).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 150, width * 0.13, 0xf0d58a, 0.035).setDepth(0);

    this.add.rectangle(centerX, height - 230, width, 430, 0x030202, 0.42).setDepth(0);

    for (let i = 0; i < 28; i += 1) {
      const x = layout.safeX + 18 + i * ((width - layout.safeX * 2 - 36) / 27);
      const y = layout.safeTop + 100 + (i % 7) * 70;

      this.add.circle(x, y, 2, 0xf0d58a, 0.055).setDepth(1);
    }

    this.add.text(centerX, layout.safeTop + 145, '⚒', {
      fontFamily: UI.font.body,
      fontSize: '92px',
      color: '#ffffff',
    })
      .setOrigin(0.5)
      .setAlpha(0.03)
      .setDepth(1);
  }

  private createHeader(layout: ForgeLayout) {
    this.add.text(layout.centerX, layout.safeTop + 26, 'Кузница', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '31px' : '35px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth,
      },
    }).setOrigin(0.5).setDepth(200);

    this.add.text(layout.centerX, layout.safeTop + 64, 'Закалка оружия, брони и талисманов', {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 40,
      },
    }).setOrigin(0.5).setDepth(200);
  }

  private createResourcePanel(layout: ForgeLayout) {
    const panelY = layout.safeTop + 126;

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: 78,
      radius: 26,
      color: 0x100b08,
      alpha: 0.95,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.58,
      glowColor: 0xf0a040,
      depth: 10,
    });

    const chipWidth = Math.min((layout.contentWidth - 52) / 3, 176);
    const startX = layout.centerX - chipWidth - 10;

    this.createResourceChip({
      x: startX,
      y: panelY,
      width: chipWidth,
      icon: '◆',
      title: 'Золото',
      value: `${player.gold}`,
      color: UI.colors.gold,
    });

    this.createResourceChip({
      x: layout.centerX,
      y: panelY,
      width: chipWidth,
      icon: '◇',
      title: 'Материалы',
      value: `${this.getTotalMaterialsCount()}`,
      color: 0x70a6ff,
    });

    this.createResourceChip({
      x: layout.centerX + chipWidth + 10,
      y: panelY,
      width: chipWidth,
      icon: '⚒',
      title: 'Наковальня',
      value: `Ур. ${player.anvilLevel}`,
      color: player.anvilLevel >= 2 ? 0x75d184 : 0xf0a040,
    });
  }

  private createScrollableContent(layout: ForgeLayout) {
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

    let cursorY = layout.contentTop + 18;

    cursorY = this.createAnvilPanel(layout, cursorY);
    cursorY = this.createMaterialPanel(layout, cursorY + 16);
    cursorY = this.createCategoryTabs(layout, cursorY + 16);
    cursorY = this.createItemListPanel(layout, cursorY + 16);
    cursorY = this.createInfoPanel(layout, cursorY + 16);

    const contentHeight = cursorY - layout.contentTop + 28;

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

    const bg = this.add.rectangle(layout.centerX, hintY, 220, 28, 0x000000, 0.34)
      .setDepth(230);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай кузницу', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
    }).setOrigin(0.5).setDepth(231);

    this.tweens.add({
      targets: [bg, text],
      alpha: 0.25,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private createAnvilPanel(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = 174;
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
      color: 0x100b08,
      alpha: 0.96,
      strokeColor: isUpgraded ? 0x75d184 : UI.colors.goldDark,
      strokeAlpha: isUpgraded ? 0.72 : 0.52,
      glowColor: isUpgraded ? 0x75d184 : 0xf0a040,
      depth: 2,
    });

    const left = layout.centerX - layout.contentWidth / 2;
    const right = layout.centerX + layout.contentWidth / 2;

    this.addTo(
      container,
      this.add.circle(left + 54, topY + 78, 42, 0x21150f, 0.98)
        .setStrokeStyle(2, isUpgraded ? 0x75d184 : UI.colors.gold, 0.86)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 54, topY + 78, '⚒', {
        fontFamily: UI.font.body,
        fontSize: '29px',
        color: isUpgraded ? UI.colors.green : UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(left + 108, topY + 34, `Наковальня ${player.anvilLevel} уровня`, {
        fontFamily: UI.font.title,
        fontSize: '22px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 260,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    const description = isUpgraded
      ? 'Наковальня усилена. Можно доводить эпические, легендарные и мифические вещи до предела.'
      : `Усиление откроет высокие уровни закалки. Нужно: ${getMaterialName(anvilCost.materialId)} x${anvilCost.amount} и ${anvilCost.gold} золота.`;

    this.addTo(
      container,
      this.add.text(left + 108, topY + 72, description, {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: UI.colors.text,
        lineSpacing: 4,
        wordWrap: {
          width: layout.contentWidth - 280,
        },
        maxLines: 3,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.createAnvilProgress(container, left + 108, topY + 128, Math.min(layout.contentWidth - 292, 310));

    this.createForgeButton({
      parent: container,
      x: right - 86,
      y: topY + 88,
      width: 140,
      height: 50,
      text: isUpgraded ? 'Усилено' : 'Усилить',
      disabled: isUpgraded || !canUpgrade,
      variant: isUpgraded ? 'green' : 'gold',
      onClick: () => {
        this.handleAnvilUpgrade();
      },
      depth: 8,
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

    const panelHeight = 180;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: 0x0d0907,
      alpha: 0.94,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.45,
      glowColor: 0x8a3f1c,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 32, 'Материалы', {
        fontFamily: UI.font.title,
        fontSize: '24px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 60,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );

    const chipWidth = (layout.contentWidth - 70) / 2;
    const leftX = layout.centerX - chipWidth / 2 - 8;
    const rightX = layout.centerX + chipWidth / 2 + 8;

    materialIds.forEach((id, index) => {
      const x = index % 2 === 0 ? leftX : rightX;
      const y = topY + 74 + Math.floor(index / 2) * 25;

      this.createMaterialLine(container, x, y, id, chipWidth);
    });

    return topY + panelHeight;
  }

  private createCategoryTabs(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = 82;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: 0x100b08,
      alpha: 0.94,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.42,
      glowColor: 0xf0a040,
      depth: 2,
    });

    const tabs: Array<{
      id: ForgeCategory;
      label: string;
      icon: string;
    }> = [
      { id: 'weapon', label: 'Оружие', icon: '⚔' },
      { id: 'armor', label: 'Броня', icon: '🛡' },
      { id: 'trinket', label: 'Талисманы', icon: '✦' },
    ];

    const tabWidth = (layout.contentWidth - 64) / 3;
    const startX = layout.centerX - layout.contentWidth / 2 + 32 + tabWidth / 2;

    tabs.forEach((tab, index) => {
      const isActive = this.selectedCategory === tab.id;
      const x = startX + index * tabWidth;

      this.createForgeButton({
        parent: container,
        x,
        y: panelY,
        width: tabWidth - 10,
        height: 46,
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
        small: layout.compact,
      });
    });

    return topY + panelHeight;
  }

  private createItemListPanel(layout: ForgeLayout, topY: number) {
    const container = this.requireContentContainer();
    const itemsForForge = this.getForgeItemsByCategory(this.selectedCategory);

    const title = this.getCategoryTitle(this.selectedCategory);
    const icon = this.getCategoryIcon(this.selectedCategory);

    const cardHeight = 126;
    const cardGap = 14;
    const headerHeight = 84;
    const bottomPadding = 22;

    const emptyHeight = 270;
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
      color: 0x0d0907,
      alpha: 0.95,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.5,
      glowColor: 0x8a3f1c,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX - layout.contentWidth / 2 + 30, topY + 36, `${icon} ${title}`, {
        fontFamily: UI.font.title,
        fontSize: '25px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 170,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(layout.centerX + layout.contentWidth / 2 - 30, topY + 36, `${itemsForForge.length} шт.`, {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: UI.colors.textMuted,
        align: 'right',
        wordWrap: {
          width: 100,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(8)
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

    const rarityColor = getRarityColorHex(item);
    const rarityStrokeColor = getRarityStrokeColor(item);

    const cardX = layout.centerX;
    const cardWidth = layout.contentWidth - 44;
    const left = cardX - cardWidth / 2;
    const right = cardX + cardWidth / 2;

    this.createRoundedPanel({
      parent: container,
      x: cardX,
      y,
      width: cardWidth,
      height: cardHeight,
      radius: 24,
      color: equipped ? 0x21150f : 0x14100d,
      alpha: 0.96,
      strokeColor: equipped ? UI.colors.gold : rarityStrokeColor,
      strokeAlpha: equipped ? 0.92 : 0.68,
      strokeWidth: equipped ? 2 : 1,
      glowColor: rarityColor,
      depth: 5,
    });

    const rarityBar = this.add.graphics();
    rarityBar.fillStyle(rarityColor, 0.95);
    rarityBar.fillRoundedRect(left + 6, y - cardHeight / 2 + 10, 8, cardHeight - 20, 6);
    rarityBar.setDepth(8);
    container.add(rarityBar);

    const iconX = left + 47;
    const textX = left + 86;
    const buttonWidth = Phaser.Math.Clamp(Math.round(cardWidth * 0.22), 106, 134);
    const buttonX = right - buttonWidth / 2 - 18;
    const costX = buttonX - buttonWidth / 2 - 12;
    const textWidth = Math.max(170, costX - textX - 18);

    this.addTo(
      container,
      this.add.circle(iconX, y - 30, 27, rarityColor, 0.95)
        .setStrokeStyle(2, rarityStrokeColor, 0.9)
        .setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(iconX, y - 30, getSlotIcon(item.slot), {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(10)
    );

    this.addTo(
      container,
      this.add.text(textX, y - 44, `${item.name} +${upgradeLevel}`, {
        fontFamily: UI.font.title,
        fontSize: '15px',
        color: equipped ? UI.colors.goldText : UI.colors.text,
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 2,
      }).setOrigin(0, 0).setDepth(10)
    );

    if (equipped) {
      this.createEquippedBadge(container, textX, y - 50);
    }

    this.addTo(
      container,
      this.add.text(textX, y - 11, `${getRarityText(item)} • ${this.getItemTypeText(item)} • предел +${rarityMaxUpgrade}`, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: this.getRarityTextColor(item),
        wordWrap: {
          width: textWidth,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    this.createUpgradeProgressBar(
      container,
      textX,
      y + 12,
      Math.min(textWidth, 260),
      upgradeLevel,
      rarityMaxUpgrade,
      rarityColor
    );

    this.addTo(
      container,
      this.add.text(textX, y + 43, createItemStatsText(inventoryItem) || 'Без бонусов', {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    const costText =
      isRarityMaxLevel
        ? `Достигнут предел редкости: +${rarityMaxUpgrade}`
        : isAnvilLocked
          ? `Нужна наковальня II\nдля улучшения выше +${anvilMaxUpgrade}`
          : this.createUpgradeCostText(cost);

    this.addTo(
      container,
      this.add.text(costX, y - 14, costText, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: isRarityMaxLevel
          ? UI.colors.green
          : isAnvilLocked
            ? UI.colors.red
            : canUpgrade
              ? UI.colors.textMuted
              : UI.colors.red,
        lineSpacing: 2,
        wordWrap: {
          width: Math.max(92, buttonX - costX - buttonWidth / 2 - 8),
        },
        maxLines: 5,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    this.createForgeButton({
      parent: container,
      x: buttonX,
      y: y + 34,
      width: buttonWidth,
      height: 42,
      text: isRarityMaxLevel
        ? 'Макс.'
        : isAnvilLocked
          ? 'Наков.'
          : 'Улучшить',
          
      disabled: isRarityMaxLevel || isAnvilLocked || !canUpgrade,
      variant: isRarityMaxLevel ? 'green' : 'gold',
      onClick: () => {
        this.showUpgradeConfirm(inventoryItem);
      },
      depth: 11,
      small: true,
    });
  }

  private createEquippedBadge(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number
  ) {
    const width = 70;
    const height = 22;
    const radius = 10;

    const bg = this.add.graphics();

    bg.fillStyle(0x2a1d13, 0.96);
    bg.fillRoundedRect(
      x,
      y,
      width,
      height,
      radius
    );

    bg.lineStyle(1, UI.colors.gold, 0.8);
    bg.strokeRoundedRect(
      x,
      y,
      width,
      height,
      radius
    );

    bg.setDepth(11);

    const label = this.add.text(x + width / 2, y + height / 2, 'НАДЕТО', {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(12);

    container.add([bg, label]);
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

    const panelHeight = 134;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: 0x0d0d0d,
      alpha: 0.92,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.4,
      glowColor: 0x8a3f1c,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 36, 'Правила закалки', {
        fontFamily: UI.font.title,
        fontSize: '22px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 60,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(
        layout.centerX,
        topY + 84,
        'Оружие, броня и талисманы улучшаются разными материалами. Редкость задаёт предел: обычные +3, редкие +5, эпические +7, легендарные и мифические +10.',
        {
          fontFamily: UI.font.body,
          fontSize: '14px',
          color: UI.colors.textMuted,
          align: 'center',
          wordWrap: {
            width: layout.contentWidth - 64,
          },
          maxLines: 3,
          lineSpacing: 4,
        }
      ).setOrigin(0.5).setDepth(8)
    );

    return topY + panelHeight;
  }

  private createBottomActions(layout: ForgeLayout) {
    this.createForgeButton({
      x: layout.centerX,
      y: layout.height - 48,
      width: Math.min(layout.contentWidth, 540),
      height: 54,
      text: 'Вернуться в город',
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

        const rarityDiff = this.getRarityWeight(itemB) - this.getRarityWeight(itemA);

        if (rarityDiff !== 0) {
          return rarityDiff;
        }

        return (b.upgradeLevel ?? 0) - (a.upgradeLevel ?? 0);
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

  private createUpgradeCostText(cost: UpgradeCost) {
    const materialText = cost.materials
      .map(material => `${getMaterialName(material.id)} x${material.amount}`)
      .join('\n');

    return [`Золото x${cost.gold}`, materialText].filter(Boolean).join('\n');
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
      ? 0x4a3a27
      : variant === 'green'
        ? 0x75d184
        : variant === 'red'
          ? 0xff6b6b
          : variant === 'dark'
            ? UI.colors.goldDark
            : UI.colors.gold;

    const fillColor = disabled
      ? 0x120d0a
      : variant === 'green'
        ? 0x102016
        : variant === 'red'
          ? 0x241010
          : variant === 'dark'
            ? 0x12100d
            : 0x21150f;

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
