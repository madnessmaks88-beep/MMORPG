import Phaser from 'phaser';

import { player, type EquipmentSlot } from '../data/player';
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

type ShopOffer = {
  id: string;
  itemId: string;
  discountPercent: number;
  purchased: boolean;
};

type ShopAssortment = {
  version: number;
  generatedAt: number;
  potionDiscountPercent: number;
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

export class ShopScene extends Phaser.Scene {
  private readonly shopStorageKey = 'catacombs_shop_assortment_v2';

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

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.025), 20, 34);
    const safeBottom = 154;

    const contentTop = safeTop + 190;
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

  private createShopBackdrop(layout: ShopLayout) {
    const { width, height, centerX } = layout;

    this.add.circle(centerX, layout.safeTop + 130, width * 0.46, 0x4a2b14, 0.12).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 145, width * 0.28, 0xf0a040, 0.055).setDepth(0);

    this.add.rectangle(centerX, height - 230, width, 430, 0x030202, 0.38).setDepth(0);

    for (let i = 0; i < 18; i += 1) {
      const x = layout.safeX + 18 + i * ((width - layout.safeX * 2 - 36) / 17);
      const y = layout.safeTop + 95 + (i % 6) * 76;

      this.add.circle(x, y, 2, 0xf0d58a, 0.055).setDepth(1);
    }

    this.add.text(centerX, layout.safeTop + 142, '⚖', {
      fontFamily: UI.font.body,
      fontSize: '92px',
      color: '#ffffff',
    })
      .setOrigin(0.5)
      .setAlpha(0.028)
      .setDepth(1);
  }

  private createHeader(layout: ShopLayout) {
    this.add.text(layout.centerX, layout.safeTop + 26, 'Лавка снабжения', {
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

    this.add.text(layout.centerX, layout.safeTop + 64, 'Катакомбы забвения • товары меняются за купоны', {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 40,
      },
    }).setOrigin(0.5).setDepth(100);
  }

  private createResourcePanel(layout: ShopLayout) {
    const panelY = layout.safeTop + 128;

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: 82,
      radius: 26,
      color: 0x100c09,
      alpha: 0.95,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.56,
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
      icon: '✚',
      title: 'Зелья',
      value: `${player.potions}`,
      color: 0x75d184,
    });

    this.createResourceChip({
      x: layout.centerX + chipWidth + 10,
      y: panelY,
      width: chipWidth,
      icon: '券',
      title: 'Купоны',
      value: `${this.getRefreshCoupons()}`,
      color: 0x70a6ff,
    });
  }

  private createScrollableContent(layout: ShopLayout) {
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
    
    cursorY = this.createItemSection(layout, cursorY + 16, 'weapons', 'Оружие', '⚔');
    cursorY = this.createItemSection(layout, cursorY + 16, 'armors', 'Броня', '🛡');
    cursorY = this.createItemSection(layout, cursorY + 16, 'trinkets', 'Талисманы', '✦');
    cursorY = this.createInfoSection(layout, cursorY + 16);

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

  private createItemSection(
    layout: ShopLayout,
    topY: number,
    sectionId: ShopSectionId,
    title: string,
    icon: string
  ) {
    const container = this.requireContentContainer();

    const offers = this.assortment[sectionId];
    const cardHeight = 126;
    const cardGap = 14;
    const headerHeight = 92;
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
      color: 0x100c09,
      alpha: 0.96,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.52,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX - layout.contentWidth / 2 + 30, topY + 34, `${icon} ${title}`, {
        fontFamily: UI.font.title,
        fontSize: '24px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 60,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(layout.centerX + layout.contentWidth / 2 - 30, topY + 34, `${offers.length} товара`, {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: UI.colors.textMuted,
        align: 'right',
        wordWrap: {
          width: 120,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(7)
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
      color: config.offer.purchased ? 0x0b0b0b : 0x17100c,
      alpha: config.offer.purchased ? 0.72 : 0.96,
      strokeColor: config.offer.purchased ? UI.colors.goldDark : rarityStrokeColor,
      strokeAlpha: config.offer.purchased ? 0.28 : 0.72,
      strokeWidth: config.offer.purchased ? 1 : 2,
      depth: 4,
    });

    const iconX = left + 46;
    const textX = left + 86;
    const buttonWidth = Phaser.Math.Clamp(Math.round(config.width * 0.24), 98, 132);
    const buttonX = right - buttonWidth / 2 - 18;
    const textWidth = Math.max(150, buttonX - buttonWidth / 2 - textX - 18);

    this.addTo(
      container,
      this.add.circle(iconX, config.y - 26, 27, rarityColor, 0.22)
        .setStrokeStyle(2, rarityStrokeColor, 0.76)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.circle(iconX, config.y - 26, 20, rarityColor, 0.86)
        .setStrokeStyle(1, rarityStrokeColor, 0.95)
        .setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(iconX, config.y - 26, getSlotIcon(item.slot), {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(textX, config.y - 42, item.name, {
        fontFamily: UI.font.title,
        fontSize: '17px',
        color: config.offer.purchased ? UI.colors.textMuted : UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 2,
      }).setOrigin(0, 0).setDepth(9)
    );

    const typeText =
      item.slot === 'weapon'
        ? getWeaponTypeText(item.weaponType)
        : getSlotText(item.slot as EquipmentSlot);

    this.addTo(
      container,
      this.add.text(textX, config.y + 4, `${typeText} • ${getRarityText(item)}`, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: '#b8aa91',
        wordWrap: {
          width: textWidth,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(textX, config.y + 29, this.createItemStatsText(item), {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(9)
    );

    this.createPriceText(container, {
      x: buttonX,
      y: config.y - 31,
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
      height: 42,
      text: config.offer.purchased
        ? 'Куплено'
        : canBuy
          ? 'Купить'
          : 'Мало',
      accentColor: config.offer.purchased ? UI.colors.goldDark : rarityStrokeColor,
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

    const panelHeight = 124;
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
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 35, 'Правила лавки', {
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
      }).setOrigin(0.5).setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(
        layout.centerX,
        topY + 78,
        'Один купон обновляет сразу оружие, броню и талисманы. Легендарные и мифические товары стоят значительно дороже, но иногда появляются со скидкой.',
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
      ).setOrigin(0.5).setDepth(7)
    );

    return topY + panelHeight;
  }

  private createBottomActions(layout: ShopLayout) {
    const refreshY = layout.height - 112;

    const canRefresh = this.getRefreshCoupons() > 0;

    this.createUiButton({
      x: layout.centerX,
      y: refreshY,
      width: Math.min(layout.contentWidth, 540),
      height: 52,
      text: canRefresh
        ? 'Обновить ассортимент за 1 купон'
        : 'Нет купонов для обновления',
      accentColor: canRefresh ? 0x70a6ff : UI.colors.goldDark,
      disabled: !canRefresh,
      onClick: () => {
        this.handleRefreshAssortment();
      },
      depth: 240,
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
    this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: 54,
      radius: 18,
      color: 0x17100c,
      alpha: 0.96,
      strokeColor: config.color,
      strokeAlpha: 0.3,
      strokeWidth: 1,
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
        this.add.text(config.x, config.y - 9, `-${config.discount}%`, {
          fontFamily: UI.font.title,
          fontSize: config.small ? '13px' : '15px',
          color: '#75d184',
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
        this.add.text(config.x, config.y + 10, `${config.price} зол.`, {
          fontFamily: UI.font.title,
          fontSize: config.small ? '15px' : '17px',
          color: UI.colors.goldText,
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
        color: UI.colors.goldText,
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

    const objects: Phaser.GameObjects.GameObject[] = [shadow, bg, label, zone];

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
        redraw(hoverColor, 1, 1);
        label.setColor(danger ? '#ffd0d0' : '#ffffff');
      });

      zone.on('pointerout', () => {
        redraw(bgColor, 0.96, 0.85);
        bg.setAlpha(1);
        label.setY(config.y);
        label.setColor(textColor);
      });

      zone.on('pointerdown', () => {
        bg.setAlpha(0.78);
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
    const { width, height } = this.scale;

    this.isModalOpen = true;

    const modal = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.72
    ).setInteractive();

    modal.add(overlay);

    this.createRoundedPanel({
      parent: modal,
      x: width / 2,
      y: height / 2,
      width: Math.min(width - 52, 610),
      height: 500,
      radius: 30,
      color: 0x17100c,
      alpha: 0.98,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.9,
      depth: 1001,
    });

    const titleText = this.add.text(width / 2, height / 2 - 180, config.title, {
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

    const descriptionText = this.add.text(width / 2, height / 2 - 38, config.description, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: Math.min(width - 100, 520),
      },
      maxLines: 10,
      lineSpacing: 5,
    }).setOrigin(0.5).setDepth(1004);

    modal.add([titleText, descriptionText]);

    const close = () => {
      modal.destroy(true);
      this.isModalOpen = false;
    };

    this.createUiButton({
      parent: modal,
      x: width / 2,
      y: height / 2 + 152,
      width: 360,
      height: 54,
      text: config.confirmText,
      accentColor: 0x75d184,
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
      y: height / 2 + 216,
      width: 360,
      height: 54,
      text: 'Отмена',
      accentColor: UI.colors.goldDark,
      onClick: () => {
        close();
      },
      depth: 1004,
    });
  }

  private showMessage(message: string) {
    const { width, height } = this.scale;

    this.isModalOpen = true;

    const modal = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.72
    ).setInteractive();

    modal.add(overlay);

    this.createRoundedPanel({
      parent: modal,
      x: width / 2,
      y: height / 2,
      width: Math.min(width - 52, 600),
      height: 290,
      radius: 28,
      color: 0x17100c,
      alpha: 0.98,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.9,
      depth: 1001,
    });

    const titleText = this.add.text(width / 2, height / 2 - 92, 'Лавка', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1004);

    const messageText = this.add.text(width / 2, height / 2 - 12, message, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: Math.min(width - 100, 520),
      },
      maxLines: 6,
      lineSpacing: 5,
    }).setOrigin(0.5).setDepth(1004);

    modal.add([titleText, messageText]);

    this.createUiButton({
      parent: modal,
      x: width / 2,
      y: height / 2 + 98,
      width: 260,
      height: 54,
      text: 'Понятно',
      accentColor: UI.colors.goldDark,
      onClick: () => {
        modal.destroy(true);
        this.isModalOpen = false;
        this.scene.restart();
      },
      depth: 1004,
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
    if (!assortment || assortment.version !== 2) {
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
      return Boolean(items.find(item => item.id === offer.itemId));
    });
  }

  private generateAssortment(): ShopAssortment {
    return {
      version: 2,
      generatedAt: Date.now(),
      potionDiscountPercent: this.rollDiscount(),
      weapons: this.generateOffersForSlot('weapon', 2),
      armors: this.generateOffersForSlot('armor', 2),
      trinkets: this.generateOffersForSlot('trinket', 2),
    };
  }

  private generateOffersForSlot(slot: EquipmentSlot, count: number) {
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

  private pickWeightedItem(slot: EquipmentSlot, usedIds: Set<string>) {
    let pool = items.filter(item => item.slot === slot && !usedIds.has(item.id));

    if (pool.length === 0) {
      pool = items.filter(item => item.slot === slot);
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
    const rarityBase = {
      common: 260,
      rare: 820,
      epic: 2100,
      legendary: 6200,
      mythic: 12800,
    }[item.rarity];

    const statPrice =
      (item.bonusAttack ?? 0) * 62 +
      (item.bonusDefense ?? 0) * 62 +
      (item.bonusHp ?? 0) * 8 +
      Math.round((item.bonusCritChance ?? 0) * 12000);

    const slotMultiplier =
      item.slot === 'weapon'
        ? 1.12
        : item.slot === 'armor'
          ? 1.04
          : 1.18;

    const rawPrice = Math.round((rarityBase + statPrice) * slotMultiplier);

    return Math.ceil(rawPrice / 10) * 10;
  }

  private applyDiscount(price: number, discountPercent: number) {
    if (discountPercent <= 0) {
      return price;
    }

    return Math.max(1, Math.ceil((price * (1 - discountPercent / 100)) / 10) * 10);
  }

  private createItemStatsText(item: ItemData) {
    const parts: string[] = [];

    if (item.bonusHp) parts.push(`HP +${item.bonusHp}`);
    if (item.bonusAttack) parts.push(`АТК +${item.bonusAttack}`);
    if (item.bonusDefense) parts.push(`ЗАЩ +${item.bonusDefense}`);
    if (item.bonusCritChance) parts.push(`Крит +${Math.round(item.bonusCritChance * 100)}%`);

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
  }) {
    const radius = config.radius ?? 24;
    const color = config.color ?? 0x14100d;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? UI.colors.goldDark;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const depth = config.depth ?? 1;

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2 + 6,
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

    if (config.parent) {
      config.parent.add([shadow, panel]);
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