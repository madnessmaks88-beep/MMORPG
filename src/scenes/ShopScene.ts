import Phaser from 'phaser';

import { player, type EquipmentSlot } from '../data/player';
import { gameState } from '../data/gameState';
import { items, type ItemData } from '../data/items';

import { createBottomNav } from '../ui/createBottomNav';

import {
  addItemToInventory,
  getRarityColorHex,
  getRarityStrokeColor,
  getRarityText,
  getSlotIcon,
  getSlotText,
  getWeaponTypeText,
} from '../systems/InventorySystem';

import { saveGameAsync } from '../systems/SaveSystem';

import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type ShopSectionId = 'weapons' | 'armors' | 'trinkets';

type ShopEquipmentSlot = Exclude<EquipmentSlot, 'ring'>;

type ShopOffer = {
  id: string;
  itemId: string;
  discountPercent: number;
  purchased: boolean;
};

type ShopAssortment = {
  version: number;
  generatedAt: number;
  weapons: ShopOffer[];
  armors: ShopOffer[];
  trinkets: ShopOffer[];
};

type ShopLayout = {
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

type ShopButton = {
  objects: Phaser.GameObjects.GameObject[];
  zone: Phaser.GameObjects.Zone;
};

type CouponPlayer = typeof player & {
  shopRefreshCoupons?: number;
  refreshCoupons?: number;
  dailyCoupons?: number;
};

type ExpandedShopItemData = ItemData & {
  bonusEnergy?: number;
  bonusAgility?: number;
  bonusLuck?: number;
  bonusStrength?: number;
  bonusIntelligence?: number;
};

const SHOP_COLORS = {
  ink: 0x050608,
  panel: 0x0a0b0d,
  panelWarm: 0x11100d,
  card: 0x101014,
  cardWarm: 0x17110c,
  stone: 0x24262b,
  ash: 0x8f887b,
  bronze: 0x705434,
  gold: 0xb99257,
  goldLight: 0xd2b87a,
  red: 0x8c2f32,
  blue: 0x3e688f,
  violet: 0x7253a8,
  green: 0x4e745d,
};

export class ShopScene extends Phaser.Scene {
  private readonly shopStorageKey = 'catacombs_shop_assortment_v3';

  private contentContainer?: Phaser.GameObjects.Container;

  private assortment!: ShopAssortment;
  private layout!: ShopLayout;

  private currentScrollY = 0;
  private targetScrollY = 0;
  private maxScrollY = 0;

  private isDraggingShop = false;
  private didDragShop = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  private isModalOpen = false;

  constructor() {
    super('ShopScene');
  }

  create() {
    this.assortment = this.loadOrCreateAssortment();
    this.layout = this.getLayout();

    createSceneBackground(this);

    this.createShopBackdrop(this.layout);
    this.createHeader(this.layout);
    this.createResourcePanel(this.layout);
    this.createScrollableContent(this.layout);
    this.createBottomActions(this.layout);

    createBottomNav(this, {
      activeScene: 'ShopScene',
    });
  }

  update() {
    if (!this.contentContainer) {
      return;
    }

    if (this.isModalOpen || this.isDraggingShop) {
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

  private getLayout(): ShopLayout {
    const { width, height } = this.scale;

    const compact = height < 1120;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.022), 16, 30);
    const safeBottom = height < 760 ? 142 : 154;

    const contentWidth = Math.min(width - safeX * 2, 640);
    const headerHeight = compact ? 206 : 224;
    const contentTop = safeTop + headerHeight;
    const contentBottom = height - safeBottom;

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
      viewportHeight: Math.max(280, contentBottom - contentTop),

      compact,
    };
  }
  private createShopBackdrop(layout: ShopLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, SHOP_COLORS.ink, 0.96).setDepth(0);
    this.add.rectangle(centerX, height / 2, width, height, 0x140d08, 0.28).setDepth(0);
    this.add.rectangle(centerX, height - 188, width, 376, 0x020202, 0.66).setDepth(0);

    const candleY = layout.safeTop + 132;
    this.add.circle(centerX, candleY, width * 0.68, SHOP_COLORS.bronze, 0.075).setDepth(0);
    this.add.circle(centerX, candleY + 8, width * 0.44, SHOP_COLORS.gold, 0.075).setDepth(0);
    this.add.circle(centerX, candleY + 10, width * 0.22, 0xffb45d, 0.05).setDepth(0);

    const shelfWidth = Math.min(layout.contentWidth * 0.92, 560);
    const shelfTop = layout.safeTop + 72;

    for (let row = 0; row < 3; row += 1) {
      const y = shelfTop + row * 48;
      this.add.rectangle(centerX, y + 24, shelfWidth, 38, 0x0a0807, 0.58)
        .setStrokeStyle(1, 0x3f3324, 0.36)
        .setDepth(1);
      this.add.rectangle(centerX, y + 46, shelfWidth + 28, 10, 0x1a120d, 0.88)
        .setStrokeStyle(1, 0x5d4d33, 0.34)
        .setDepth(2);
    }

    const leftColumnX = centerX - shelfWidth / 2 - 20;
    const rightColumnX = centerX + shelfWidth / 2 + 20;

    [leftColumnX, rightColumnX].forEach(x => {
      this.add.rectangle(x, shelfTop + 66, 22, 160, 0x101012, 0.86)
        .setStrokeStyle(1, 0x4a4034, 0.42)
        .setDepth(2);
      this.add.rectangle(x, shelfTop - 16, 40, 16, 0x17130f, 0.9)
        .setStrokeStyle(1, 0x5b513e, 0.38)
        .setDepth(3);
      this.add.rectangle(x, shelfTop + 146, 44, 18, 0x17130f, 0.92)
        .setStrokeStyle(1, 0x5b513e, 0.38)
        .setDepth(3);
    });

    this.add.text(centerX, shelfTop + 60, '⚖', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '72px' : '84px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    })
      .setOrigin(0.5)
      .setAlpha(0.045)
      .setDepth(2);

    for (let i = 0; i < 42; i += 1) {
      const x = layout.safeX + 12 + ((i * 43) % Math.max(1, width - layout.safeX * 2 - 24));
      const y = layout.safeTop + 62 + ((i * 71) % Math.max(1, height - layout.safeTop - layout.safeBottom - 120));
      const color = i % 6 === 0 ? SHOP_COLORS.blue : i % 3 === 0 ? SHOP_COLORS.gold : 0x7a6043;
      const alpha = 0.018 + (i % 4) * 0.008;

      const mote = this.add.circle(x, y, 1 + (i % 3), color, alpha).setDepth(1);

      this.tweens.add({
        targets: mote,
        alpha: { from: alpha * 0.55, to: alpha * 1.65 },
        y: y - Phaser.Math.Between(4, 18),
        duration: Phaser.Math.Between(1700, 3100),
        yoyo: true,
        repeat: -1,
        delay: i * 35,
        ease: 'Sine.easeInOut',
      });
    }

    for (let i = 0; i < 4; i += 1) {
      const x = i % 2 === 0 ? layout.safeX + 34 : width - layout.safeX - 34;
      const y = layout.safeTop + 92 + i * 62;

      const flameGlow = this.add.circle(x, y, 34, 0xff9d3a, 0.08).setDepth(2);
      const flame = this.add.text(x, y, '♨', {
        fontFamily: UI.font.body,
        fontSize: '24px',
        color: '#d2a060',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(3);

      this.tweens.add({
        targets: [flameGlow, flame],
        alpha: { from: 0.42, to: 0.9 },
        scale: { from: 0.95, to: 1.08 },
        duration: 1100 + i * 160,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.add.rectangle(18, height / 2, 36, height, 0x000000, 0.36).setDepth(4);
    this.add.rectangle(width - 18, height / 2, 36, height, 0x000000, 0.36).setDepth(4);
  }
  private createHeader(layout: ShopLayout) {
    const panelHeight = layout.compact ? 68 : 76;
    const panelY = layout.safeTop + panelHeight / 2 + 2;
    const panelParts = this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 26,
      color: SHOP_COLORS.panel,
      alpha: 0.92,
      strokeColor: SHOP_COLORS.bronze,
      strokeAlpha: 0.58,
      strokeWidth: 2,
      depth: 96,
      glowColor: SHOP_COLORS.gold,
    });

    panelParts.shadow.setAlpha(0);
    panelParts.panel.setAlpha(0);

    this.tweens.add({
      targets: [panelParts.shadow, panelParts.panel],
      alpha: 1,
      y: '+=0',
      duration: 260,
      ease: 'Sine.easeOut',
    });

    const title = this.add.text(layout.centerX, panelY - 14, 'Лавка Пепельного торговца', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '22px' : '26px',
      color: '#d2b87a',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 42,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(100).setAlpha(0).setY(panelY - 22);

    const subtitle = this.add.text(layout.centerX, panelY + 18, 'Оружие • броня • талисманы у входа в катакомбы', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '11px' : '13px',
      color: '#9b9386',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 60,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(100).setAlpha(0).setY(panelY + 26);

    this.tweens.add({
      targets: [title, subtitle],
      alpha: 1,
      y: '-=8',
      duration: 280,
      delay: 80,
      ease: 'Cubic.easeOut',
    });
  }
  private createResourcePanel(layout: ShopLayout) {
    const panelHeight = layout.compact ? 118 : 128;
    const panelY = layout.safeTop + (layout.compact ? 140 : 154);

    const panel = this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 26,
      color: 0x08080a,
      alpha: 0.955,
      strokeColor: 0x4f3d28,
      strokeAlpha: 0.72,
      strokeWidth: 1,
      depth: 10,
      glowColor: SHOP_COLORS.gold,
    });

    panel.shadow.setAlpha(0);
    panel.panel.setAlpha(0);

    this.tweens.add({
      targets: [panel.shadow, panel.panel],
      alpha: 1,
      duration: 240,
      delay: 90,
      ease: 'Sine.easeOut',
    });

    const chipGap = 10;
    const chipWidth = Math.min((layout.contentWidth - 44 - chipGap) / 2, 250);
    const leftX = layout.centerX - chipWidth / 2 - chipGap / 2;
    const rightX = layout.centerX + chipWidth / 2 + chipGap / 2;
    const chipY = panelY - (layout.compact ? 29 : 32);

    this.createResourceChip({
      x: leftX,
      y: chipY,
      width: chipWidth,
      icon: '◆',
      title: 'Золото',
      value: `${player.gold}`,
      color: SHOP_COLORS.gold,
    });

    this.createResourceChip({
      x: rightX,
      y: chipY,
      width: chipWidth,
      icon: '☾',
      title: 'Купоны',
      value: `${this.getRefreshCoupons()}`,
      color: SHOP_COLORS.blue,
    });

    this.createCouponBanner({
      x: layout.centerX,
      y: panelY + (layout.compact ? 32 : 36),
      width: layout.contentWidth - 44,
      height: layout.compact ? 50 : 56,
    });
  }
  private createScrollableContent(layout: ShopLayout) {
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

    let cursorY = layout.contentTop + 12;

    cursorY = this.createInfoSection(layout, cursorY + 10);
    cursorY = this.createItemSection(layout, cursorY + 14, 'weapons', 'Оружие', '⚔');
    cursorY = this.createItemSection(layout, cursorY + 14, 'armors', 'Броня', '▣');
    cursorY = this.createItemSection(layout, cursorY + 14, 'trinkets', 'Талисманы', '☥');

    const contentHeight = cursorY - layout.contentTop + 28;

    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = 0;
    this.targetScrollY = 0;

    this.createScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }
  }
  private createScrollInput(layout: ShopLayout) {
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

      this.isDraggingShop = true;
      this.didDragShop = false;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.targetScrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDraggingShop || this.isModalOpen) {
        return;
      }

      const distance = pointer.y - this.dragStartY;

      if (Math.abs(distance) < 8) {
        return;
      }

      this.didDragShop = true;

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
      this.isDraggingShop = false;

      this.time.delayedCall(0, () => {
        this.didDragShop = false;
      });
    });

    this.input.on('pointerupoutside', () => {
      this.isDraggingShop = false;

      this.time.delayedCall(0, () => {
        this.didDragShop = false;
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

  private isPointerInsideScrollArea(pointer: Phaser.Input.Pointer, layout: ShopLayout) {
    return (
      pointer.x >= layout.safeX &&
      pointer.x <= layout.width - layout.safeX &&
      pointer.y >= layout.contentTop &&
      pointer.y <= layout.contentBottom
    );
  }

  private createScrollHint(layout: ShopLayout) {
    const hintY = layout.contentBottom - 18;

    const bg = this.add.rectangle(layout.centerX, hintY, 230, 28, 0x000000, 0.34)
      .setDepth(230);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай лавку', {
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


  private getSectionDescription(sectionId: ShopSectionId) {
    if (sectionId === 'weapons') return 'Клинки, топоры и иное железо для спуска.';
    if (sectionId === 'armors') return 'Пластины, кольчуги и тяжёлые одеяния.';
    return 'Обереги, печати и вещи с тихой магией.';
  }

  private getSectionAccentColor(sectionId: ShopSectionId) {
    if (sectionId === 'weapons') return SHOP_COLORS.red;
    if (sectionId === 'armors') return SHOP_COLORS.blue;
    return SHOP_COLORS.violet;
  }

  private createItemSection(
    layout: ShopLayout,
    topY: number,
    sectionId: ShopSectionId,
    title: string,
    icon: string
  ) {
    const container = this.requireContentContainer();

    const offers = this.assortment[sectionId];
    const accentColor = this.getSectionAccentColor(sectionId);
    const cardHeight = layout.compact ? 136 : 146;
    const cardGap = 14;
    const headerHeight = layout.compact ? 94 : 102;
    const bottomPadding = 22;

    const panelHeight =
      headerHeight +
      offers.length * cardHeight +
      Math.max(0, offers.length - 1) * cardGap +
      bottomPadding;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: SHOP_COLORS.panel,
      alpha: 0.95,
      strokeColor: accentColor,
      strokeAlpha: 0.42,
      strokeWidth: 2,
      depth: 2,
      glowColor: accentColor,
    });

    const headerX = layout.centerX - layout.contentWidth / 2 + 30;
    const counterX = layout.centerX + layout.contentWidth / 2 - 30;

    this.addTo(
      container,
      this.add.circle(headerX + 16, topY + 35, 21, accentColor, 0.16)
        .setStrokeStyle(1, accentColor, 0.6)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(headerX + 16, topY + 35, icon, {
        fontFamily: UI.font.body,
        fontSize: '16px',
        color: '#d2b87a',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(headerX + 48, topY + 28, title, {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '22px' : '25px',
        color: '#d2b87a',
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 190,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(headerX + 48, topY + 60, this.getSectionDescription(sectionId), {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: '#8f887b',
        wordWrap: {
          width: layout.contentWidth - 120,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(counterX, topY + 35, `${offers.length} товара`, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: '#8f887b',
        align: 'right',
        wordWrap: {
          width: 118,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(8)
    );

    offers.forEach((offer, index) => {
      const y = topY + headerHeight + cardHeight / 2 + index * (cardHeight + cardGap);

      this.createShopItemCard({
        parent: container,
        layout,
        sectionId,
        offerIndex: index,
        offer,
        y,
        width: layout.contentWidth - 44,
        height: cardHeight,
      });
    });

    return topY + panelHeight;
  }
  private createShopItemCard(config: {
    parent: Phaser.GameObjects.Container;
    layout: ShopLayout;
    sectionId: ShopSectionId;
    offerIndex: number;
    offer: ShopOffer;
    y: number;
    width: number;
    height: number;
  }) {
    const item = this.getItemByOffer(config.offer);

    if (!item) {
      return;
    }

    const container = config.parent;

    const rarityColor = getRarityColorHex(item);
    const rarityStrokeColor = getRarityStrokeColor(item);

    const basePrice = this.getBaseItemPrice(item);
    const price = this.applyDiscount(basePrice, config.offer.discountPercent);

    const canBuy = !config.offer.purchased && player.gold >= price;
    const cardX = config.layout.centerX;
    const left = cardX - config.width / 2;
    const right = cardX + config.width / 2;

    this.createRoundedPanel({
      parent: container,
      x: cardX,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 24,
      color: config.offer.purchased ? 0x090909 : SHOP_COLORS.cardWarm,
      alpha: config.offer.purchased ? 0.68 : 0.96,
      strokeColor: config.offer.purchased ? 0x40372e : rarityStrokeColor,
      strokeAlpha: config.offer.purchased ? 0.28 : 0.72,
      strokeWidth: config.offer.purchased ? 1 : 2,
      depth: 4,
      glowColor: config.offer.purchased ? undefined : rarityColor,
    });

    const iconX = left + 48;
    const textX = left + 92;
    const buttonWidth = Phaser.Math.Clamp(Math.round(config.width * 0.25), 104, 138);
    const buttonX = right - buttonWidth / 2 - 18;
    const textWidth = Math.max(145, buttonX - buttonWidth / 2 - textX - 16);

    this.addTo(
      container,
      this.add.circle(iconX, config.y - 34, 31, rarityColor, config.offer.purchased ? 0.08 : 0.18)
        .setStrokeStyle(2, rarityStrokeColor, config.offer.purchased ? 0.32 : 0.76)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.circle(iconX, config.y - 34, 22, rarityColor, config.offer.purchased ? 0.38 : 0.9)
        .setStrokeStyle(1, rarityStrokeColor, config.offer.purchased ? 0.42 : 0.95)
        .setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(iconX, config.y - 34, getSlotIcon(item.slot), {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: config.offer.purchased ? '#7b746b' : '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(textX, config.y - 53, item.name, {
        fontFamily: UI.font.title,
        fontSize: config.layout.compact ? '15px' : '17px',
        color: config.offer.purchased ? '#6f675c' : '#d2b87a',
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: 2,
        lineSpacing: -2,
      }).setOrigin(0, 0).setDepth(9)
    );

    const typeText =
      item.slot === 'weapon'
        ? getWeaponTypeText(item.weaponType)
        : getSlotText(item.slot as EquipmentSlot);

    this.addTo(
      container,
      this.add.text(textX, config.y - 5, `${typeText} • ${getRarityText(item)}`, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: config.offer.purchased ? '#5f5a52' : '#b8aa91',
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(textX, config.y + 23, this.createItemStatsText(item), {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: config.offer.purchased ? '#5f5a52' : '#9b9386',
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: 2,
        lineSpacing: 2,
      }).setOrigin(0, 0.5).setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(textX, config.y + 55, item.description, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: config.offer.purchased ? '#4f4b45' : '#756f66',
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(9)
    );

    this.createPriceText(container, {
      x: buttonX,
      y: config.y - 35,
      basePrice,
      price,
      discount: config.offer.discountPercent,
      width: buttonWidth + 32,
      small: true,
    });

    this.createUiButton({
      parent: container,
      x: buttonX,
      y: config.y + 34,
      width: buttonWidth,
      height: 44,
      text: config.offer.purchased
        ? 'Куплено'
        : canBuy
          ? 'Купить'
          : 'Мало',
      accentColor: config.offer.purchased ? 0x4c4031 : rarityStrokeColor,
      disabled: config.offer.purchased || !canBuy,
      onClick: () => {
        this.showItemBuyModal(config.sectionId, config.offerIndex);
      },
      depth: 10,
      small: true,
    });
  }
  private createInfoSection(layout: ShopLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = layout.compact ? 116 : 128;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: 0x0b0908,
      alpha: 0.93,
      strokeColor: 0x4d3a25,
      strokeAlpha: 0.54,
      strokeWidth: 1,
      depth: 2,
      glowColor: SHOP_COLORS.gold,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 30, 'Прилавок у катакомб', {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '20px' : '22px',
        color: '#c9a86a',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 60,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(
        layout.centerX,
        topY + 78,
        'Торговец меняет ассортимент за купоны лавки. Купленные товары отмечаются до следующего обновления. Чем выше редкость — тем дороже и реже предмет.',
        {
          fontFamily: UI.font.body,
          fontSize: layout.compact ? '12px' : '13px',
          color: '#9b9386',
          align: 'center',
          wordWrap: {
            width: layout.contentWidth - 64,
            useAdvancedWrap: true,
          },
          maxLines: 4,
          lineSpacing: 4,
        }
      ).setOrigin(0.5).setDepth(7)
    );

    return topY + panelHeight;
  }
  private createBottomActions(layout: ShopLayout) {
    const dockY = layout.height - 112;
    const panelHeight = 58;

    this.createRoundedPanel({
      x: layout.centerX,
      y: dockY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 22,
      color: 0x050506,
      alpha: 0.82,
      strokeColor: 0x30271e,
      strokeAlpha: 0.5,
      strokeWidth: 1,
      depth: 232,
    });

    this.add.text(layout.centerX, dockY, 'Купоны лавки можно получить за задания. Обновление ассортимента — в верхней панели.', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '11px' : '12px',
      color: '#8f887b',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 58,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0.5).setDepth(236);
  }
  private createCouponBanner(config: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    const coupons = this.getRefreshCoupons();
    const hasCoupons = coupons > 0;
    const radius = 20;
    const left = config.x - config.width / 2;
    const accent = hasCoupons ? SHOP_COLORS.green : SHOP_COLORS.bronze;
    const titleColor = hasCoupons ? '#bfe4b9' : '#b8aa91';
    const subtitle = hasCoupons
      ? 'Обнови ассортимент редких товаров за 1 купон'
      : 'Купонов нет. Их можно получить за задания.';

    const shadow = this.add.graphics().setDepth(17);
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(left, config.y - config.height / 2 + 5, config.width, config.height, radius);

    const glow = this.add.graphics().setDepth(18);
    glow.fillStyle(accent, hasCoupons ? 0.12 : 0.045);
    glow.fillRoundedRect(left + 5, config.y - config.height / 2 + 5, config.width - 10, config.height - 10, radius - 3);

    const bg = this.add.graphics().setDepth(19);
    const drawBg = (fill: number, strokeAlpha: number) => {
      bg.clear();
      bg.fillStyle(fill, hasCoupons ? 0.98 : 0.88);
      bg.fillRoundedRect(left, config.y - config.height / 2, config.width, config.height, radius);
      bg.lineStyle(2, accent, strokeAlpha);
      bg.strokeRoundedRect(left, config.y - config.height / 2, config.width, config.height, radius);
      bg.lineStyle(1, 0xffffff, hasCoupons ? 0.06 : 0.03);
      bg.strokeRoundedRect(left + 4, config.y - config.height / 2 + 4, config.width - 8, config.height - 8, Math.max(1, radius - 4));
    };

    drawBg(hasCoupons ? 0x0f1711 : 0x10100e, hasCoupons ? 0.82 : 0.38);

    const iconX = left + 34;
    const iconHalo = this.add.circle(iconX, config.y, 20, accent, hasCoupons ? 0.2 : 0.08)
      .setStrokeStyle(1, accent, hasCoupons ? 0.62 : 0.28)
      .setDepth(20);

    const icon = this.add.text(iconX, config.y, '券', {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: hasCoupons ? '#e5ffd0' : '#8f887b',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21);

    const title = this.add.text(left + 66, config.y - 11, `Купоны лавки: ${coupons}`, {
      fontFamily: UI.font.title,
      fontSize: '16px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: config.width - 150,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(21);

    const description = this.add.text(left + 66, config.y + 12, subtitle, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: hasCoupons ? '#aebda4' : '#756f66',
      wordWrap: {
        width: config.width - 150,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(21);

    const action = this.add.text(left + config.width - 48, config.y, hasCoupons ? 'ОБМЕН' : 'ПУСТО', {
      fontFamily: UI.font.title,
      fontSize: '11px',
      color: hasCoupons ? '#d8f7b8' : '#786f63',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: 82,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(21);

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    const objects = [shadow, glow, bg, iconHalo, icon, title, description, action];
    objects.forEach(object => object.setAlpha(0));

    this.tweens.add({
      targets: objects,
      alpha: 1,
      scale: { from: 0.985, to: 1 },
      duration: 300,
      delay: 190,
      ease: 'Back.easeOut',
    });

    if (hasCoupons) {
      this.tweens.add({
        targets: [glow, iconHalo, title, action],
        alpha: { from: 0.72, to: 1 },
        scale: { from: 0.99, to: 1.035 },
        duration: 1050,
        yoyo: true,
        repeat: -1,
        delay: 520,
        ease: 'Sine.easeInOut',
      });
    }

    zone.on('pointerover', () => {
      drawBg(hasCoupons ? 0x152018 : 0x151310, hasCoupons ? 1 : 0.5);
      title.setColor(hasCoupons ? '#e7ffd0' : '#d2b87a');
      action.setColor(hasCoupons ? '#ffffff' : '#b8aa91');
    });

    zone.on('pointerout', () => {
      drawBg(hasCoupons ? 0x0f1711 : 0x10100e, hasCoupons ? 0.82 : 0.38);
      title.setColor(titleColor);
      action.setColor(hasCoupons ? '#d8f7b8' : '#786f63');
      bg.setScale(1);
    });

    zone.on('pointerdown', () => {
      bg.setScale(0.992);
      title.setY(config.y - 10);
    });

    zone.on('pointerup', () => {
      bg.setScale(1);
      title.setY(config.y - 11);

      if (hasCoupons) {
        this.showCouponRefreshModal();
        return;
      }

      this.showCouponInfoModal();
    });

    zone.on('pointerupoutside', () => {
      bg.setScale(1);
      title.setY(config.y - 11);
    });
  }

  private showCouponRefreshModal() {
    this.showConfirmModal({
      title: 'Купоны лавки',
      description: [
        `Купонов доступно: ${this.getRefreshCoupons()}`,
        '',
        'Один купон полностью обновит ассортимент торговца.',
        'Купленные товары исчезнут из текущего списка, а лавка предложит новые оружие, броню и талисманы.',
      ].join('\n'),
      confirmText: 'Обновить за 1 купон',
      disabled: this.getRefreshCoupons() <= 0,
      onConfirm: () => {
        this.handleRefreshAssortment();
      },
    });
  }

  private showCouponInfoModal() {
    this.showConfirmModal({
      title: 'Купоны лавки',
      description: [
        'Купонов сейчас нет.',
        '',
        'Купоны можно получить за задания. Позже их можно потратить на обновление ассортимента торговца.',
      ].join('\n'),
      confirmText: 'Понятно',
      onConfirm: () => undefined,
    });
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
    const panel = this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: 46,
      radius: 17,
      color: SHOP_COLORS.card,
      alpha: 0.96,
      strokeColor: config.color,
      strokeAlpha: 0.34,
      strokeWidth: 1,
      depth: 12,
      glowColor: config.color,
    });

    const left = config.x - config.width / 2;

    const iconGlow = this.add.circle(left + 27, config.y, 15, config.color, 0.16)
      .setStrokeStyle(1, config.color, 0.5)
      .setDepth(15);

    const icon = this.add.text(left + 27, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: '#d2b87a',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(16);

    const title = this.add.text(left + 50, config.y - 9, config.title, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#9b9386',
      wordWrap: {
        width: config.width - 56,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(16);

    const value = this.add.text(left + 50, config.y + 10, config.value, {
      fontFamily: UI.font.title,
      fontSize: '16px',
      color: '#d1c7b4',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: config.width - 56,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(16);

    [panel.shadow, panel.panel, iconGlow, icon, title, value].forEach(object => {
      object.setAlpha(0);
    });

    this.tweens.add({
      targets: [panel.shadow, panel.panel, iconGlow, icon, title, value],
      alpha: 1,
      duration: 260,
      delay: 130,
      ease: 'Sine.easeOut',
    });
  }
  private createPriceText(
    parent: Phaser.GameObjects.Container,
    config: {
      x: number;
      y: number;
      basePrice: number;
      price: number;
      discount: number;
      width: number;
      small?: boolean;
    }
  ) {
    const hasDiscount = config.discount > 0;

    if (hasDiscount) {
      this.addTo(
        parent,
        this.add.text(config.x, config.y - 15, `${config.basePrice} зол.`, {
          fontFamily: UI.font.body,
          fontSize: config.small ? '10px' : '12px',
          color: '#665f55',
          align: 'center',
          wordWrap: {
            width: config.width,
          },
          maxLines: 1,
        }).setOrigin(0.5).setDepth(12)
      );

      this.addTo(
        parent,
        this.add.text(config.x, config.y + 1, `−${config.discount}%`, {
          fontFamily: UI.font.title,
          fontSize: config.small ? '12px' : '14px',
          color: '#8fc89b',
          stroke: '#000000',
          strokeThickness: 2,
          align: 'center',
          wordWrap: {
            width: config.width,
          },
          maxLines: 1,
        }).setOrigin(0.5).setDepth(12)
      );

      this.addTo(
        parent,
        this.add.text(config.x, config.y + 19, `${config.price} зол.`, {
          fontFamily: UI.font.title,
          fontSize: config.small ? '14px' : '17px',
          color: '#d2b87a',
          stroke: '#000000',
          strokeThickness: 2,
          align: 'center',
          wordWrap: {
            width: config.width,
          },
          maxLines: 1,
        }).setOrigin(0.5).setDepth(12)
      );

      return;
    }

    this.addTo(
      parent,
      this.add.text(config.x, config.y, `${config.price} зол.`, {
        fontFamily: UI.font.title,
        fontSize: config.small ? '15px' : '17px',
        color: '#d2b87a',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
        wordWrap: {
          width: config.width,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(12)
    );
  }
  private createUiButton(config: {
    parent?: Phaser.GameObjects.Container;
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
  }): ShopButton {
    const radius = Math.min(18, config.height / 2);
    const danger = config.danger ?? false;
    const disabled = config.disabled ?? false;
    const depth = config.depth ?? 40;

    const bgColor = disabled
      ? 0x101010
      : danger
        ? 0x241010
        : 0x12100d;

    const hoverColor = disabled
      ? bgColor
      : danger
        ? 0x351515
        : 0x241a12;

    const textColor = disabled
      ? '#545454'
      : danger
        ? '#d9928c'
        : '#d2b87a';

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 5,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(depth);

    const glow = this.add.graphics();
    glow.fillStyle(config.accentColor, disabled ? 0.025 : 0.075);
    glow.fillRoundedRect(
      config.x - config.width / 2 + 4,
      config.y - config.height / 2 + 4,
      config.width - 8,
      config.height - 8,
      radius
    );
    glow.setDepth(depth + 1);

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, disabled ? 0.66 : 0.98);
    bg.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    bg.lineStyle(2, config.accentColor, disabled ? 0.28 : 0.8);
    bg.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    bg.setDepth(depth + 2);

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: config.small ? '12px' : '16px',
      color: textColor,
      align: 'center',
      wordWrap: {
        width: config.width - 14,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(depth + 3);

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(depth + 4);

    const objects: Phaser.GameObjects.GameObject[] = [shadow, glow, bg, label, zone];

    if (config.parent) {
      config.parent.add(objects);
    }

    const redraw = (color: number, alpha: number, strokeAlpha: number) => {
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

    if (!disabled) {
      zone.setInteractive({
        useHandCursor: true,
      });

      zone.on('pointerover', () => {
        redraw(hoverColor, 1, 0.98);
        label.setColor(danger ? '#ffd0d0' : '#f2e4bf');
      });

      zone.on('pointerout', () => {
        redraw(bgColor, 0.98, 0.8);
        bg.setAlpha(1);
        label.setY(config.y);
        label.setColor(textColor);
      });

      zone.on('pointerdown', () => {
        bg.setAlpha(0.76);
        label.setY(config.y + 1);
      });

      zone.on('pointerup', () => {
        bg.setAlpha(1);
        label.setY(config.y);

        if (this.didDragShop) {
          return;
        }

        config.onClick();
      });

      zone.on('pointerupoutside', () => {
        bg.setAlpha(1);
        label.setY(config.y);
      });
    }

    return {
      objects,
      zone,
    };
  }
  private showItemBuyModal(sectionId: ShopSectionId, offerIndex: number) {
    const offer = this.assortment[sectionId][offerIndex];
    const item = this.getItemByOffer(offer);

    if (!item || offer.purchased) {
      return;
    }

    const price = this.applyDiscount(
      this.getBaseItemPrice(item),
      offer.discountPercent
    );

    this.showConfirmModal({
      title: item.name,
      description: [
        `${getRarityText(item)} • ${item.slot === 'weapon' ? getWeaponTypeText(item.weaponType) : getSlotText(item.slot as EquipmentSlot)}`,
        this.createItemStatsText(item),
        '',
        item.description,
        '',
        `Цена: ${price} золота`,
      ].join('\n'),
      confirmText: player.gold >= price ? 'Купить' : 'Недостаточно золота',
      disabled: player.gold < price,
      onConfirm: () => {
        this.buyOffer(sectionId, offerIndex, price);
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
    const layout = this.layout ?? this.getLayout();
    const { width, height } = this.scale;

    this.isModalOpen = true;

    const modal = this.add.container(0, 0).setDepth(1000).setAlpha(0).setScale(0.96);

    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.78
    ).setInteractive();

    modal.add(overlay);

    const panelWidth = Math.min(layout.contentWidth, 620);
    const panelHeight = Math.min(540, height - layout.safeTop - layout.safeBottom - 34);
    const panelY = height / 2;
    const top = panelY - panelHeight / 2;
    const bottom = panelY + panelHeight / 2;

    this.createRoundedPanel({
      parent: modal,
      x: width / 2,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius: 30,
      color: 0x0f0d0c,
      alpha: 0.985,
      strokeColor: SHOP_COLORS.bronze,
      strokeAlpha: 0.9,
      strokeWidth: 3,
      depth: 1001,
      glowColor: SHOP_COLORS.gold,
    });

    const titleText = this.add.text(width / 2, top + 54, config.title, {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '23px' : '26px',
      color: '#d2b87a',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: panelWidth - 58,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(1004);

    const descriptionText = this.add.text(width / 2, top + panelHeight / 2 - 18, config.description, {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '14px' : '16px',
      color: '#d1c7b4',
      align: 'center',
      wordWrap: {
        width: panelWidth - 70,
        useAdvancedWrap: true,
      },
      maxLines: layout.compact ? 10 : 12,
      lineSpacing: 5,
    }).setOrigin(0.5).setDepth(1004);

    modal.add([titleText, descriptionText]);

    const close = () => {
      modal.destroy(true);
      this.isModalOpen = false;
    };

    const buttonWidth = Math.min(panelWidth - 130, 380);

    this.createUiButton({
      parent: modal,
      x: width / 2,
      y: bottom - 118,
      width: buttonWidth,
      height: 52,
      text: config.confirmText,
      accentColor: SHOP_COLORS.green,
      disabled: config.disabled ?? false,
      onClick: () => {
        close();
        config.onConfirm();
      },
      depth: 1004,
    });

    this.createUiButton({
      parent: modal,
      x: width / 2,
      y: bottom - 54,
      width: buttonWidth,
      height: 52,
      text: 'Отмена',
      accentColor: SHOP_COLORS.bronze,
      onClick: () => {
        close();
      },
      depth: 1004,
    });

    this.tweens.add({
      targets: modal,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }
  private showMessage(message: string) {
    const layout = this.layout ?? this.getLayout();
    const { width, height } = this.scale;

    this.isModalOpen = true;

    const modal = this.add.container(0, 0).setDepth(1000).setAlpha(0).setScale(0.96);

    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.78
    ).setInteractive();

    modal.add(overlay);

    const panelWidth = Math.min(layout.contentWidth, 600);
    const panelHeight = Math.min(310, height - 130);
    const panelY = height / 2;

    this.createRoundedPanel({
      parent: modal,
      x: width / 2,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius: 28,
      color: 0x0f0d0c,
      alpha: 0.985,
      strokeColor: SHOP_COLORS.bronze,
      strokeAlpha: 0.86,
      strokeWidth: 3,
      depth: 1001,
      glowColor: SHOP_COLORS.gold,
    });

    const titleText = this.add.text(width / 2, panelY - panelHeight / 2 + 52, 'Лавка', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '27px' : '30px',
      color: '#d2b87a',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: panelWidth - 60,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(1004);

    const messageText = this.add.text(width / 2, panelY - 4, message, {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '16px' : '18px',
      color: '#d1c7b4',
      align: 'center',
      wordWrap: {
        width: panelWidth - 72,
        useAdvancedWrap: true,
      },
      maxLines: 7,
      lineSpacing: 5,
    }).setOrigin(0.5).setDepth(1004);

    modal.add([titleText, messageText]);

    this.createUiButton({
      parent: modal,
      x: width / 2,
      y: panelY + panelHeight / 2 - 54,
      width: Math.min(280, panelWidth - 110),
      height: 52,
      text: 'Понятно',
      accentColor: SHOP_COLORS.bronze,
      onClick: () => {
        modal.destroy(true);
        this.isModalOpen = false;
        this.scene.restart();
      },
      depth: 1004,
    });

    this.tweens.add({
      targets: modal,
      alpha: 1,
      scale: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }
  private buyOffer(sectionId: ShopSectionId, offerIndex: number, price: number) {
    const offer = this.assortment[sectionId][offerIndex];
    const item = this.getItemByOffer(offer);

    if (!item || offer.purchased) {
      return;
    }

    if (player.gold < price) {
      this.showMessage('Недостаточно золота.');
      return;
    }

    player.gold -= price;
    offer.purchased = true;

    addItemToInventory(player, item.id);

    this.saveAssortment();

    void saveGameAsync();

    this.showMessage([
      'Покупка совершена.',
      '',
      `${getRarityText(item)}: ${item.name}`,
      `Потрачено золота: ${price}.`,
    ].join('\n'));
  }

  private handleRefreshAssortment() {
    if (this.getRefreshCoupons() <= 0) {
      this.showMessage('Нет купонов для обновления ассортимента.');
      return;
    }

    this.spendRefreshCoupon();

    this.assortment = this.generateAssortment();
    this.saveAssortment();

    void saveGameAsync();

    this.scene.restart();
  }

  private loadOrCreateAssortment() {
    try {
      const raw = localStorage.getItem(this.shopStorageKey);

      if (!raw) {
        const generated = this.generateAssortment();
        this.assortment = generated;
        this.saveAssortment();
        return generated;
      }

      const parsed = JSON.parse(raw) as ShopAssortment;

      if (!this.isValidAssortment(parsed)) {
        const generated = this.generateAssortment();
        this.assortment = generated;
        this.saveAssortment();
        return generated;
      }

      return parsed;
    } catch {
      const generated = this.generateAssortment();
      this.assortment = generated;
      this.saveAssortment();
      return generated;
    }
  }

  private saveAssortment() {
    localStorage.setItem(this.shopStorageKey, JSON.stringify(this.assortment));
  }

  private isValidAssortment(assortment: ShopAssortment) {
    if (!assortment || assortment.version !== 3) {
      return false;
    }

    const allOffers = [
      ...(assortment.weapons ?? []),
      ...(assortment.armors ?? []),
      ...(assortment.trinkets ?? []),
    ];

    if (allOffers.length < 6) {
      return false;
    }

    return allOffers.every(offer => {
      const item = items.find(item => item.id === offer.itemId);
      return Boolean(item && this.isItemAvailableInShop(item));
    });
  }

  private generateAssortment(): ShopAssortment {
    return {
      version: 3,
      generatedAt: Date.now(),
      weapons: this.generateOffersForSlot('weapon', 2),
      armors: this.generateOffersForSlot('armor', 2),
      trinkets: this.generateOffersForSlot('trinket', 2),
    };
  }

  private generateOffersForSlot(slot: ShopEquipmentSlot, count: number) {
    const usedIds = new Set<string>();
    const offers: ShopOffer[] = [];

    for (let i = 0; i < count; i += 1) {
      const item = this.pickWeightedItem(slot, usedIds);

      usedIds.add(item.id);

      offers.push({
        id: `${slot}_${Date.now()}_${i}_${Phaser.Math.Between(1000, 9999)}`,
        itemId: item.id,
        discountPercent: this.rollDiscount(),
        purchased: false,
      });
    }

    return offers;
  }

  private isItemAvailableInShop(item: ItemData) {
    // Божественные фарм-кольца — секретные/квестовые предметы, не товар обычной лавки.
    if (item.rarity === 'divine' || item.slot === 'ring') {
      return false;
    }

    if (item.bossOnly) {
      return false;
    }

    const availableFloor = Math.max(1, gameState.highestClearedFloor + 1);
    const minFloor = item.minFloor ?? 1;
    const maxFloor = item.maxFloor ?? Number.MAX_SAFE_INTEGER;

    return availableFloor >= minFloor && availableFloor <= maxFloor;
  }

  private pickWeightedItem(slot: ShopEquipmentSlot, usedIds: Set<string>) {
    let pool = items.filter(item => {
      return item.slot === slot && !usedIds.has(item.id) && this.isItemAvailableInShop(item);
    });

    if (pool.length === 0) {
      pool = items.filter(item => item.slot === slot && this.isItemAvailableInShop(item));
    }

    if (pool.length === 0) {
      pool = items.filter(item => item.slot === slot && !item.bossOnly);
    }

    const weighted = pool.map(item => ({
      item,
      weight: this.getShopWeight(item),
    }));

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const entry of weighted) {
      roll -= entry.weight;

      if (roll <= 0) {
        return entry.item;
      }
    }

    return weighted[weighted.length - 1].item;
  }

  private getShopWeight(item: ItemData) {
    if (item.rarity === 'common') return 60;
    if (item.rarity === 'rare') return 28;
    if (item.rarity === 'epic') return 10;
    if (item.rarity === 'legendary') return 3;
    if (item.rarity === 'mythic') return 1;
    if (item.rarity === 'divine') return 0;

    return 10;
  }

  private rollDiscount() {
    const roll = Math.random();

    if (roll < 0.58) return 0;
    if (roll < 0.78) return 10;
    if (roll < 0.92) return 15;
    if (roll < 0.985) return 20;

    return 25;
  }

  private getBaseItemPrice(item: ItemData) {
    const expanded = item as ExpandedShopItemData;

    const rarityBase = {
      common: 260,
      rare: 820,
      epic: 2100,
      legendary: 6200,
      mythic: 12800,
      divine: 50000,
    }[item.rarity];

    const statPrice =
      (expanded.bonusAttack ?? 0) * 62 +
      (expanded.bonusDefense ?? 0) * 62 +
      (expanded.bonusHp ?? 0) * 8 +
      (expanded.bonusEnergy ?? 0) * 380 +
      (expanded.bonusAgility ?? 0) * 72 +
      (expanded.bonusLuck ?? 0) * 82 +
      (expanded.bonusStrength ?? 0) * 72 +
      (expanded.bonusIntelligence ?? 0) * 72 +
      Math.round((expanded.bonusCritChance ?? 0) * 12000);

    const slotMultiplier =
      item.slot === 'weapon'
        ? 1.12
        : item.slot === 'armor'
          ? 1.04
          : item.slot === 'ring'
            ? 1.35
            : 1.18;

    const rawPrice = Math.round((rarityBase + statPrice) * slotMultiplier);

    let price = Math.ceil(rawPrice / 10) * 10;

    if (item.slot === 'weapon' && item.rarity === 'common') {
      price = Math.max(1, Math.ceil((price / 2) / 10) * 10);
    }

    return price;
  }
  private applyDiscount(price: number, discountPercent: number) {
    if (discountPercent <= 0) {
      return price;
    }

    return Math.max(1, Math.ceil((price * (1 - discountPercent / 100)) / 10) * 10);
  }

  private createItemStatsText(item: ItemData) {
    const expanded = item as ExpandedShopItemData;
    const parts: string[] = [];

    if (expanded.bonusHp) parts.push(`HP +${expanded.bonusHp}`);
    if (expanded.bonusAttack) parts.push(`АТК +${expanded.bonusAttack}`);
    if (expanded.bonusDefense) parts.push(`ЗАЩ +${expanded.bonusDefense}`);
    if (expanded.bonusEnergy) parts.push(`ЭН +${expanded.bonusEnergy}`);
    if (expanded.bonusStrength) parts.push(`СИЛ +${expanded.bonusStrength}`);
    if (expanded.bonusAgility) parts.push(`ЛОВ +${expanded.bonusAgility}`);
    if (expanded.bonusLuck) parts.push(`УДАЧ +${expanded.bonusLuck}`);
    if (expanded.bonusIntelligence) parts.push(`ИНТ +${expanded.bonusIntelligence}`);
    if (expanded.bonusCritChance) parts.push(`Крит +${Math.round(expanded.bonusCritChance * 100)}%`);

    return parts.length > 0 ? parts.join(' • ') : 'Без характеристик';
  }
  private getItemByOffer(offer: ShopOffer) {
    return items.find(item => item.id === offer.itemId);
  }

  private getRefreshCoupons() {
    const couponPlayer = player as CouponPlayer;

    return (
      couponPlayer.shopRefreshCoupons ??
      couponPlayer.refreshCoupons ??
      couponPlayer.dailyCoupons ??
      0
    );
  }

  private spendRefreshCoupon() {
    const couponPlayer = player as CouponPlayer;
    const current = this.getRefreshCoupons();

    if (couponPlayer.shopRefreshCoupons !== undefined) {
      couponPlayer.shopRefreshCoupons = Math.max(0, current - 1);
      return;
    }

    if (couponPlayer.refreshCoupons !== undefined) {
      couponPlayer.refreshCoupons = Math.max(0, current - 1);
      return;
    }

    if (couponPlayer.dailyCoupons !== undefined) {
      couponPlayer.dailyCoupons = Math.max(0, current - 1);
      return;
    }

    couponPlayer.shopRefreshCoupons = Math.max(0, current - 1);
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
    depth?: number;
    glowColor?: number;
  }) {
    const radius = config.radius ?? 24;
    const color = config.color ?? SHOP_COLORS.panel;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? SHOP_COLORS.bronze;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const depth = config.depth ?? 1;

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const objects: Phaser.GameObjects.GameObject[] = [];

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.36);
    shadow.fillRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2 + 7,
      safeWidth,
      safeHeight,
      radius
    );
    shadow.setDepth(depth);
    objects.push(shadow);

    if (config.glowColor !== undefined) {
      const glow = this.add.graphics();
      glow.fillStyle(config.glowColor, 0.045);
      glow.fillRoundedRect(
        config.x - safeWidth / 2 + 7,
        config.y - safeHeight / 2 + 7,
        safeWidth - 14,
        safeHeight - 14,
        radius
      );
      glow.setDepth(depth + 0.5);
      objects.push(glow);
    }

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

    panel.lineStyle(1, 0xffffff, 0.035);
    panel.strokeRoundedRect(
      config.x - safeWidth / 2 + 3,
      config.y - safeHeight / 2 + 3,
      safeWidth - 6,
      safeHeight - 6,
      Math.max(1, radius - 4)
    );

    panel.setDepth(depth + 1);
    objects.push(panel);

    if (config.parent) {
      config.parent.add(objects);
    }

    return {
      shadow,
      panel,
    };
  }
  private requireContentContainer() {
    if (!this.contentContainer) {
      throw new Error('Shop content container was not created.');
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