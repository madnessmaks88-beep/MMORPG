import Phaser from 'phaser';

import { player } from '../data/player';
import { saveGameAsync } from '../systems/SaveSystem';
import { restoreSanityByTime } from '../systems/SanitySystem';
import { UI } from '../ui/theme';

type TavernCategory = 'drinks' | 'food';

type TavernItem = {
  id: string;
  category: TavernCategory;
  name: string;
  description: string;
  icon: string;
  price: number;
  restorePercent: number;
  fullRestore?: boolean;
};

type TavernLayout = {
  width: number;
  height: number;
  centerX: number;
  safeTop: number;
  safeBottom: number;
  contentLeft: number;
  contentWidth: number;
  compact: boolean;
  veryCompact: boolean;
  headerY: number;
  resourcePanelY: number;
  resourcePanelHeight: number;
  tabsY: number;
  tabHeight: number;
  itemsTop: number;
  cardHeight: number;
  cardGap: number;
  bottomButtonY: number;
  bottomButtonHeight: number;
  contentBottom: number;
};

type TavernCardRefs = {
  item: TavernItem;
  container: Phaser.GameObjects.Container;
  cooldownText?: Phaser.GameObjects.Text;
  buyLabel: Phaser.GameObjects.Text;
  buttonBg: Phaser.GameObjects.Rectangle;
  blockedOverlay?: Phaser.GameObjects.Rectangle;
};

type ConfirmModal = {
  overlay: Phaser.GameObjects.Rectangle;
  container: Phaser.GameObjects.Container;
};

const TAVERN_CATEGORY_COOLDOWN_MS = 4 * 60 * 60 * 1000;

const TAVERN_ITEMS: TavernItem[] = [
  {
    id: 'cheap_drink',
    category: 'drinks',
    name: 'Дешёвое пойло',
    description: 'Резкий напиток, который немного возвращает ясность.',
    icon: '⚱',
    price: 200,
    restorePercent: 0.25,
  },
  {
    id: 'medium_drink',
    category: 'drinks',
    name: 'Среднее пойло',
    description: 'Крепкий напиток для тех, кто ещё собирается идти вглубь.',
    icon: '☾',
    price: 800,
    restorePercent: 0.5,
  },
  {
    id: 'quality_drink',
    category: 'drinks',
    name: 'Качественное пойло',
    description: 'Редкое пойло, полностью возвращающее рассудок.',
    icon: '✦',
    price: 2000,
    restorePercent: 1,
    fullRestore: true,
  },
  {
    id: 'soup',
    category: 'food',
    name: 'Похлёбка',
    description: 'Горячая миска простой еды после сырости катакомб.',
    icon: '♨',
    price: 200,
    restorePercent: 0.25,
  },
  {
    id: 'stew',
    category: 'food',
    name: 'Рагу',
    description: 'Плотная еда, возвращающая силы и ясность.',
    icon: '◆',
    price: 800,
    restorePercent: 0.5,
  },
  {
    id: 'dragon_ham',
    category: 'food',
    name: 'Драконий окорок',
    description: 'Дорогое блюдо для тех, кто готов к тяжёлому спуску.',
    icon: '✹',
    price: 2000,
    restorePercent: 1,
    fullRestore: true,
  },
];

export class TavernScene extends Phaser.Scene {
  private selectedCategory: TavernCategory = 'drinks';
  private modal?: ConfirmModal;
  private isModalOpen = false;
  private isPurchasing = false;
  private goldText?: Phaser.GameObjects.Text;
  private sanityText?: Phaser.GameObjects.Text;
  private sanityHintText?: Phaser.GameObjects.Text;
  private sanityFill?: Phaser.GameObjects.Rectangle;
  private categoryStatusText?: Phaser.GameObjects.Text;
  private cardsContainer?: Phaser.GameObjects.Container;
  private cardRefs: TavernCardRefs[] = [];
  private cooldownTimerEvent?: Phaser.Time.TimerEvent;
  private lastCooldownSecond = -1;

  constructor() {
    super('TavernScene');
  }

  create() {
    const restored = restoreSanityByTime();

    if (restored) {
      void saveGameAsync();
    }

    const layout = this.getLayout();

    this.cameras.main.setBackgroundColor(0x030405);
    this.createBackdrop(layout);
    this.createHeader(layout);
    this.createResourcePanel(layout);
    this.createCategoryTabs(layout);
    this.createItemsList(layout);
    this.createBottomReturnButton(layout);
    this.startCooldownTimer();

    this.cameras.main.fadeIn(260, 3, 4, 5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cooldownTimerEvent?.remove(false);
      this.cooldownTimerEvent = undefined;
      this.destroyModal();
    });
  }

  update() {
    const now = Date.now();
    const cooldownSecond = Math.floor(now / 1000);

    if (cooldownSecond === this.lastCooldownSecond) {
      return;
    }

    this.lastCooldownSecond = cooldownSecond;

    const restored = restoreSanityByTime(now);

    if (restored) {
      void saveGameAsync();
      this.updateResourceUi();
    }

    this.updateCooldownUi();
  }

  private getLayout(): TavernLayout {
    const width = this.scale.width;
    const height = this.scale.height;
    const veryCompact = height < 650 || width < 360;
    const compact = height < 760 || width < 400;
    const safeTop = 18;
    const safeBottom = 18;
    const horizontalPadding = veryCompact ? 16 : 20;
    const contentWidth = Math.min(width - horizontalPadding * 2, 430);
    const contentLeft = (width - contentWidth) / 2;
    const bottomButtonHeight = compact ? 54 : 60;
    const bottomButtonY = height - safeBottom - bottomButtonHeight / 2;
    const contentBottom = bottomButtonY - bottomButtonHeight / 2 - (veryCompact ? 10 : 14);
    const headerY = safeTop + (veryCompact ? 32 : 40);
    const resourcePanelHeight = veryCompact ? 92 : compact ? 100 : 108;
    const resourcePanelY = headerY + (veryCompact ? 74 : 84);
    const tabsY = resourcePanelY + resourcePanelHeight / 2 + (veryCompact ? 28 : 34);
    const tabHeight = veryCompact ? 42 : 46;
    const itemsTop = tabsY + tabHeight / 2 + (veryCompact ? 12 : 16);
    const cardGap = veryCompact ? 8 : compact ? 10 : 12;
    const availableForCards = Math.max(260, contentBottom - itemsTop);
    const cardHeight = Phaser.Math.Clamp(
      Math.floor((availableForCards - cardGap * 2) / 3),
      veryCompact ? 84 : 94,
      compact ? 110 : 126
    );

    return {
      width,
      height,
      centerX: width / 2,
      safeTop,
      safeBottom,
      contentLeft,
      contentWidth,
      compact,
      veryCompact,
      headerY,
      resourcePanelY,
      resourcePanelHeight,
      tabsY,
      tabHeight,
      itemsTop,
      cardHeight,
      cardGap,
      bottomButtonY,
      bottomButtonHeight,
      contentBottom,
    };
  }

  private createBackdrop(layout: TavernLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, 0x030405, 1).setDepth(0);
    this.add.rectangle(centerX, height * 0.42, width, height * 0.9, 0x0b0705, 0.62).setDepth(0);
    this.add.ellipse(centerX, height * 0.18, width * 0.88, height * 0.24, 0x2b190c, 0.22).setDepth(1);
    this.add.ellipse(centerX, height * 0.5, width * 0.92, height * 0.55, 0x0b1118, 0.22).setDepth(1);

    for (let i = 0; i < 16; i += 1) {
      const x = Phaser.Math.Between(18, Math.max(18, width - 18));
      const y = Phaser.Math.Between(54, Math.max(56, Math.floor(height - 110)));
      const radius = Phaser.Math.FloatBetween(0.8, 2.2);
      const alpha = Phaser.Math.FloatBetween(0.08, 0.2);
      const ember = this.add.circle(x, y, radius, 0xd28a3a, alpha).setDepth(1);

      this.tweens.add({
        targets: ember,
        y: y - Phaser.Math.Between(12, 30),
        alpha: 0,
        duration: Phaser.Math.Between(1800, 3200),
        repeat: -1,
        delay: Phaser.Math.Between(0, 1800),
        ease: 'Sine.easeInOut',
      });
    }

    const counterY = height * 0.79;
    this.add.rectangle(centerX, counterY, width * 0.88, 24, 0x1a1110, 0.36).setDepth(1);
    this.add.rectangle(centerX, counterY + 13, width * 0.92, 2, 0x6b4a2b, 0.18).setDepth(1);
  }

  private createHeader(layout: TavernLayout) {
    const title = this.add.text(layout.centerX, layout.headerY - 10, 'Таверна у катакомб', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '25px' : '29px',
      color: '#d2b87a',
      stroke: '#120b06',
      strokeThickness: 4,
      align: 'center',
      wordWrap: { width: layout.contentWidth, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(4).setAlpha(0);

    const subtitle = this.add.text(layout.centerX, layout.headerY + 22, 'тёплый свет перед холодом глубин', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '12px' : '13px',
      color: '#8f887b',
      align: 'center',
      wordWrap: { width: layout.contentWidth - 18, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(4).setAlpha(0);

    this.tweens.add({
      targets: [title, subtitle],
      alpha: 1,
      y: '+=4',
      duration: 320,
      ease: 'Cubic.easeOut',
    });
  }

  private createResourcePanel(layout: TavernLayout) {
    const panel = this.add.rectangle(
      layout.centerX,
      layout.resourcePanelY,
      layout.contentWidth,
      layout.resourcePanelHeight,
      0x11141a,
      0.9
    ).setOrigin(0.5).setDepth(4);
    panel.setStrokeStyle(1, 0x7b5d35, 0.62);

    const topY = layout.resourcePanelY - layout.resourcePanelHeight / 2 + 20;
    const chipWidth = (layout.contentWidth - 34) / 2;

    this.createResourceChip(layout.contentLeft + 12 + chipWidth / 2, topY, chipWidth, '◆ Золото', `${player.gold}`);
    this.createResourceChip(layout.contentLeft + 22 + chipWidth * 1.5, topY, chipWidth, '☾ Рассудок', `${player.sanity}/${player.maxSanity}`);

    const barWidth = layout.contentWidth - 44;
    const barY = layout.resourcePanelY + 25;
    const track = this.add.rectangle(layout.centerX, barY, barWidth, 13, 0x050608, 0.95)
      .setOrigin(0.5)
      .setDepth(5);
    track.setStrokeStyle(1, 0x4f81a8, 0.45);

    const fillWidth = Math.max(0, barWidth * this.getSanityProgress());
    this.sanityFill = this.add.rectangle(layout.centerX - barWidth / 2, barY, fillWidth, 13, 0x6f5a91, 0.92)
      .setOrigin(0, 0.5)
      .setDepth(6);

    this.sanityText = this.add.text(layout.centerX, barY - 1, `Рассудок ${player.sanity}/${player.maxSanity}`, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '11px' : '12px',
      color: '#d9d2c6',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: { width: barWidth - 18, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(7);

    this.sanityHintText = this.add.text(layout.centerX, barY + 21, this.getSanityHint(), {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '11px',
      color: '#8f887b',
      align: 'center',
      wordWrap: { width: barWidth - 12, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(6);
  }

  private createResourceChip(x: number, y: number, width: number, label: string, value: string) {
    const bg = this.add.rectangle(x, y, width, 30, 0x07090d, 0.88)
      .setOrigin(0.5)
      .setDepth(5);
    bg.setStrokeStyle(1, 0x4b3928, 0.72);

    const text = this.add.text(x, y, `${label}: ${value}`, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#d1c7b4',
      align: 'center',
      wordWrap: { width: width - 10, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(6);

    if (label.includes('Золото')) {
      this.goldText = text;
    }
  }

  private createCategoryTabs(layout: TavernLayout) {
    const tabWidth = (layout.contentWidth - 10) / 2;
    const leftX = layout.contentLeft + tabWidth / 2;
    const rightX = layout.contentLeft + tabWidth + 10 + tabWidth / 2;

    this.createCategoryTab(leftX, layout.tabsY, tabWidth, layout.tabHeight, 'Напитки', 'drinks');
    this.createCategoryTab(rightX, layout.tabsY, tabWidth, layout.tabHeight, 'Еда', 'food');

    this.categoryStatusText = this.add.text(layout.centerX, layout.tabsY + layout.tabHeight / 2 + 14, this.getCategoryStatusText(), {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '11px',
      color: '#9d927f',
      align: 'center',
      wordWrap: { width: layout.contentWidth - 10, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(8);
  }

  private createCategoryTab(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    category: TavernCategory
  ) {
    const selected = this.selectedCategory === category;
    const bg = this.add.rectangle(x, y, width, height, selected ? 0x2a2116 : 0x090b0f, selected ? 0.95 : 0.82)
      .setOrigin(0.5)
      .setDepth(7);
    bg.setStrokeStyle(selected ? 2 : 1, selected ? 0xd2b87a : 0x4b3928, selected ? 0.84 : 0.54);

    const text = this.add.text(x, y, label, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: selected ? '#f0d28a' : '#9f9585',
      align: 'center',
      wordWrap: { width: width - 10, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(8);

    const zone = this.add.zone(x, y, width, height).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      if (this.isModalOpen || selected) return;
      bg.setFillStyle(0x141115, 0.92);
      text.setColor('#c9b88b');
    });

    zone.on('pointerout', () => {
      if (this.isModalOpen || selected) return;
      bg.setFillStyle(0x090b0f, 0.82);
      text.setColor('#9f9585');
    });

    zone.on('pointerdown', () => {
      if (this.isModalOpen) return;
      bg.setScale(0.98);
      text.setScale(0.98);
    });

    zone.on('pointerupoutside', () => {
      bg.setScale(1);
      text.setScale(1);
    });

    zone.on('pointerup', () => {
      bg.setScale(1);
      text.setScale(1);

      if (this.isModalOpen || this.selectedCategory === category) {
        return;
      }

      this.selectedCategory = category;
      this.scene.restart({ selectedCategory: category });
    });
  }

  init(data?: { selectedCategory?: TavernCategory }) {
    if (data?.selectedCategory === 'drinks' || data?.selectedCategory === 'food') {
      this.selectedCategory = data.selectedCategory;
    }
  }

  private createItemsList(layout: TavernLayout) {
    this.cardsContainer?.destroy(true);
    this.cardRefs = [];

    const container = this.add.container(0, 0).setDepth(8);
    this.cardsContainer = container;

    const items = TAVERN_ITEMS.filter(item => item.category === this.selectedCategory);
    const left = layout.contentLeft;

    items.forEach((item, index) => {
      const y = layout.itemsTop + layout.cardHeight / 2 + index * (layout.cardHeight + layout.cardGap);
      const card = this.createItemCard(layout, item, left, y, index);
      container.add(card.container);
      this.cardRefs.push(card);
    });
  }

  private createItemCard(
    layout: TavernLayout,
    item: TavernItem,
    left: number,
    y: number,
    index: number
  ): TavernCardRefs {
    const categoryAvailable = this.canBuyFromCategory(item.category);
    const canAfford = player.gold >= item.price;
    const sanityFull = player.sanity >= player.maxSanity;
    const disabled = !categoryAvailable || !canAfford || sanityFull;
    const width = layout.contentWidth;
    const height = layout.cardHeight;
    const x = left + width / 2;
    const container = this.add.container(0, 0).setDepth(8);

    const bg = this.add.rectangle(x, y, width, height, disabled ? 0x090a0d : 0x14100d, disabled ? 0.82 : 0.94)
      .setOrigin(0.5)
      .setDepth(8);
    bg.setStrokeStyle(1, disabled ? 0x3a3028 : 0x7b5d35, disabled ? 0.5 : 0.78);

    const iconX = left + 34;
    const titleX = left + 64;
    const titleY = y - height / 2 + (layout.veryCompact ? 16 : 18);

    const icon = this.add.text(iconX, y - 6, item.icon, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '25px' : '30px',
      color: disabled ? '#6f675f' : '#d2b87a',
      align: 'center',
    }).setOrigin(0.5).setDepth(9);

    const title = this.add.text(titleX, titleY, item.name, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '14px' : '16px',
      color: disabled ? '#8f887b' : '#e0cfaa',
      fontStyle: 'bold',
      wordWrap: { width: width - 156, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(9);

    const description = this.add.text(titleX, titleY + (layout.veryCompact ? 18 : 21), item.description, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '11px',
      color: disabled ? '#706b65' : '#9f9585',
      wordWrap: { width: width - 156, useAdvancedWrap: true },
      maxLines: 2,
    }).setOrigin(0, 0.5).setDepth(9);

    const effectText = this.add.text(titleX, y + height / 2 - (layout.veryCompact ? 23 : 27), this.getEffectLabel(item), {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '11px',
      color: disabled ? '#726a7c' : '#b6a6d2',
      wordWrap: { width: width - 156, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(9);

    const price = this.add.text(left + width - 76, titleY, `${item.price} зол.`, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '11px' : '12px',
      color: canAfford ? '#d2b87a' : '#c05a4b',
      align: 'right',
      wordWrap: { width: 68, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(9);

    const buttonWidth = layout.veryCompact ? 80 : 88;
    const buttonHeight = layout.veryCompact ? 30 : 34;
    const buttonX = left + width - buttonWidth / 2 - 14;
    const buttonY = y + height / 2 - buttonHeight / 2 - 12;
    const buttonBg = this.add.rectangle(buttonX, buttonY, buttonWidth, buttonHeight, disabled ? 0x171717 : 0x2b2113, disabled ? 0.86 : 0.96)
      .setOrigin(0.5)
      .setDepth(9);
    buttonBg.setStrokeStyle(1, disabled ? 0x3d352c : 0xd2b87a, disabled ? 0.5 : 0.76);

    const buyLabelText = !categoryAvailable
      ? this.getShortCooldownLabel(item.category)
      : sanityFull
        ? 'Полон'
        : canAfford
          ? 'Купить'
          : 'Мало зол.';

    const buyLabel = this.add.text(buttonX, buttonY, buyLabelText, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '11px',
      color: disabled ? '#8f887b' : '#f0d28a',
      align: 'center',
      wordWrap: { width: buttonWidth - 8, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(10);

    let cooldownText: Phaser.GameObjects.Text | undefined;
    let blockedOverlay: Phaser.GameObjects.Rectangle | undefined;

    if (!categoryAvailable) {
      blockedOverlay = this.add.rectangle(x, y, width - 8, height - 8, 0x030405, 0.34)
        .setOrigin(0.5)
        .setDepth(10);
      cooldownText = this.add.text(x, y + height / 2 - 12, `Доступно через ${this.formatCooldown(this.getCategoryCooldownLeft(item.category))}`, {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '10px' : '11px',
        color: '#c7b784',
        align: 'center',
        wordWrap: { width: width - 42, useAdvancedWrap: true },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(11);
    }

    const zone = this.add.zone(x, y, width, height).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      if (this.isModalOpen) return;
      bg.setStrokeStyle(1, disabled ? 0x5a4935 : 0xd2b87a, disabled ? 0.55 : 0.9);
      if (!disabled) {
        bg.setFillStyle(0x1b1510, 0.98);
      }
    });

    zone.on('pointerout', () => {
      if (this.isModalOpen) return;
      bg.setStrokeStyle(1, disabled ? 0x3a3028 : 0x7b5d35, disabled ? 0.5 : 0.78);
      bg.setFillStyle(disabled ? 0x090a0d : 0x14100d, disabled ? 0.82 : 0.94);
      buttonBg.setScale(1);
    });

    zone.on('pointerdown', () => {
      if (this.isModalOpen) return;
      buttonBg.setScale(0.96);
      container.setScale(0.992);
    });

    zone.on('pointerupoutside', () => {
      buttonBg.setScale(1);
      container.setScale(1);
    });

    zone.on('pointerup', () => {
      buttonBg.setScale(1);
      container.setScale(1);
      this.handleItemClick(item);
    });

    container.add([
      bg,
      icon,
      title,
      description,
      effectText,
      price,
      buttonBg,
      buyLabel,
      zone,
    ]);

    if (blockedOverlay) {
      container.add(blockedOverlay);
    }

    if (cooldownText) {
      container.add(cooldownText);
    }

    container.setAlpha(0).setY(18);
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: 0,
      duration: 260,
      delay: 90 + index * 70,
      ease: 'Cubic.easeOut',
    });

    return {
      item,
      container,
      cooldownText,
      buyLabel,
      buttonBg,
      blockedOverlay,
    };
  }

  private createBottomReturnButton(layout: TavernLayout) {
    const width = Math.min(layout.contentWidth, 380);
    const bg = this.add.rectangle(layout.centerX, layout.bottomButtonY, width, layout.bottomButtonHeight, 0x11141a, 0.94)
      .setOrigin(0.5)
      .setDepth(30);
    bg.setStrokeStyle(2, 0xb9985b, 0.76);

    const glow = this.add.rectangle(layout.centerX, layout.bottomButtonY + layout.bottomButtonHeight / 2 - 4, width - 32, 2, 0xd2b87a, 0.28)
      .setOrigin(0.5)
      .setDepth(31);

    const text = this.add.text(layout.centerX, layout.bottomButtonY, '← Вернуться в город', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '15px' : '16px',
      color: '#f0d28a',
      align: 'center',
      wordWrap: { width: width - 28, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(32);

    const zone = this.add.zone(layout.centerX, layout.bottomButtonY, width, layout.bottomButtonHeight)
      .setOrigin(0.5)
      .setDepth(33)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      if (this.isModalOpen) return;
      bg.setFillStyle(0x19140f, 0.98);
      glow.setAlpha(0.42);
    });

    zone.on('pointerout', () => {
      bg.setFillStyle(0x11141a, 0.94);
      glow.setAlpha(0.28);
      bg.setScale(1);
      text.setScale(1);
    });

    zone.on('pointerdown', () => {
      if (this.isModalOpen) return;
      bg.setScale(0.985);
      text.setScale(0.985);
    });

    zone.on('pointerupoutside', () => {
      bg.setScale(1);
      text.setScale(1);
    });

    zone.on('pointerup', () => {
      bg.setScale(1);
      text.setScale(1);

      if (this.isModalOpen) {
        return;
      }

      this.scene.start('CampScene');
    });

    bg.setAlpha(0);
    glow.setAlpha(0);
    text.setAlpha(0);

    this.tweens.add({
      targets: [bg, glow, text],
      alpha: 1,
      y: '+=2',
      duration: 260,
      delay: 210,
      ease: 'Sine.easeOut',
    });
  }

  private handleItemClick(item: TavernItem) {
    if (this.isModalOpen || this.isPurchasing) {
      return;
    }

    if (!this.canBuyFromCategory(item.category)) {
      this.showMessageModal(
        'Категория уже использована',
        `Следующая покупка будет доступна через ${this.formatCooldown(this.getCategoryCooldownLeft(item.category))}.`
      );
      return;
    }

    if (player.sanity >= player.maxSanity) {
      this.showMessageModal('Рассудок уже полон', 'Сейчас герой не нуждается в отдыхе.');
      return;
    }

    if (player.gold < item.price) {
      this.showMessageModal('Недостаточно золота', `Нужно ${item.price} золота.`);
      return;
    }

    this.showConfirmPurchaseModal(item);
  }

  private showConfirmPurchaseModal(item: TavernItem) {
    this.showModalBase();

    if (!this.modal) {
      return;
    }

    const { width, height } = this.scale;
    const panelWidth = Math.min(width - 34, 390);
    const panelHeight = 282;
    const panelX = width / 2;
    const panelY = height / 2;
    const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x11141a, 0.97)
      .setOrigin(0.5)
      .setDepth(51);
    panel.setStrokeStyle(2, 0xb9985b, 0.76);

    const title = this.add.text(0, -104, `Купить: ${item.name}?`, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: '#f0d28a',
      align: 'center',
      wordWrap: { width: panelWidth - 44, useAdvancedWrap: true },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(52);

    const body = this.add.text(0, -28, `Цена: ${item.price} золота\nЭффект: ${this.getEffectLabel(item).toLowerCase()}\n\nПосле покупки категория будет закрыта на 4 часа.`, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: '#d1c7b4',
      align: 'center',
      lineSpacing: 5,
      wordWrap: { width: panelWidth - 48, useAdvancedWrap: true },
      maxLines: 6,
    }).setOrigin(0.5).setDepth(52);

    const buyButton = this.createModalButton(-74, 100, 118, 42, 'Купить', 0x5a2f1d, 0xd28a3a, () => {
      void this.completePurchase(item);
    });
    const cancelButton = this.createModalButton(74, 100, 118, 42, 'Отмена', 0x171717, 0x6f5a42, () => {
      this.destroyModal();
    });

    this.modal.container.setPosition(panelX, panelY);
    this.modal.container.add([panel, title, body, ...buyButton, ...cancelButton]);
    this.modal.container.setAlpha(0).setScale(0.96);

    this.tweens.add({
      targets: this.modal.container,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  private async completePurchase(item: TavernItem) {
    if (this.isPurchasing) {
      return;
    }

    if (!this.canBuyFromCategory(item.category) || player.gold < item.price || player.sanity >= player.maxSanity) {
      this.destroyModal();
      this.handleItemClick(item);
      return;
    }

    this.isPurchasing = true;
    const now = Date.now();
    player.gold = Math.max(0, player.gold - item.price);

    if (item.fullRestore) {
      player.sanity = player.maxSanity;
    } else {
      const restoreAmount = Math.round(player.maxSanity * item.restorePercent);
      player.sanity = Math.min(player.maxSanity, player.sanity + restoreAmount);
    }

    player.sanityUpdatedAt = now;

    if (item.category === 'drinks') {
      player.tavernDrinkPurchasedAt = now;
    } else {
      player.tavernFoodPurchasedAt = now;
    }

    await saveGameAsync();
    this.isPurchasing = false;
    this.destroyModal();
    this.updateResourceUi();
    this.redrawItemsOnly();
    this.showMessageModal('Рассудок восстановлен', 'Герой снова готов к дороге.');
  }

  private showMessageModal(titleText: string, message: string) {
    if (this.isModalOpen) {
      return;
    }

    this.showModalBase();

    if (!this.modal) {
      return;
    }

    const { width, height } = this.scale;
    const panelWidth = Math.min(width - 36, 360);
    const panelHeight = 206;
    const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x11141a, 0.97)
      .setOrigin(0.5)
      .setDepth(51);
    panel.setStrokeStyle(2, 0xb9985b, 0.72);

    const title = this.add.text(0, -58, titleText, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: '#f0d28a',
      align: 'center',
      wordWrap: { width: panelWidth - 44, useAdvancedWrap: true },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(52);

    const body = this.add.text(0, -10, message, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: '#d1c7b4',
      align: 'center',
      wordWrap: { width: panelWidth - 44, useAdvancedWrap: true },
      maxLines: 4,
    }).setOrigin(0.5).setDepth(52);

    const okButton = this.createModalButton(0, 66, 138, 42, 'Понятно', 0x2b2113, 0xd2b87a, () => {
      this.destroyModal();
    });

    this.modal.container.setPosition(width / 2, height / 2);
    this.modal.container.add([panel, title, body, ...okButton]);
    this.modal.container.setAlpha(0).setScale(0.96);

    this.tweens.add({
      targets: this.modal.container,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  private showModalBase() {
    this.destroyModal();
    this.isModalOpen = true;

    const overlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.68
    ).setOrigin(0.5).setDepth(49).setInteractive();
    const container = this.add.container(0, 0).setDepth(50);

    this.modal = {
      overlay,
      container,
    };
  }

  private createModalButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    fillColor: number,
    strokeColor: number,
    onClick: () => void
  ) {
    const bg = this.add.rectangle(x, y, width, height, fillColor, 0.96).setOrigin(0.5).setDepth(53);
    bg.setStrokeStyle(1, strokeColor, 0.78);

    const text = this.add.text(x, y, label, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: '#f0d28a',
      align: 'center',
      wordWrap: { width: width - 10, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(54);

    const zone = this.add.zone(x, y, width, height).setOrigin(0.5).setDepth(55).setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      bg.setScale(0.96);
      text.setScale(0.96);
    });

    zone.on('pointerupoutside', () => {
      bg.setScale(1);
      text.setScale(1);
    });

    zone.on('pointerup', () => {
      bg.setScale(1);
      text.setScale(1);
      onClick();
    });

    return [bg, text, zone] as const;
  }

  private destroyModal() {
    this.modal?.overlay.destroy();
    this.modal?.container.destroy(true);
    this.modal = undefined;
    this.isModalOpen = false;
  }

  private redrawItemsOnly() {
    const layout = this.getLayout();
    this.cardsContainer?.destroy(true);
    this.cardsContainer = undefined;
    this.cardRefs = [];
    this.createItemsList(layout);
    this.updateCooldownUi();
  }

  private updateResourceUi() {
    this.goldText?.setText(`◆ Золото: ${player.gold}`);
    this.sanityText?.setText(`Рассудок ${player.sanity}/${player.maxSanity}`);
    this.sanityHintText?.setText(this.getSanityHint());

    if (this.sanityFill) {
      const layout = this.getLayout();
      const barWidth = layout.contentWidth - 44;
      this.sanityFill.width = Math.max(0, barWidth * this.getSanityProgress());
    }
  }

  private updateCooldownUi() {
    this.categoryStatusText?.setText(this.getCategoryStatusText());

    this.cardRefs.forEach(ref => {
      if (!this.canBuyFromCategory(ref.item.category)) {
        ref.cooldownText?.setText(`Доступно через ${this.formatCooldown(this.getCategoryCooldownLeft(ref.item.category))}`);
        ref.buyLabel.setText(this.getShortCooldownLabel(ref.item.category));
        ref.buttonBg.setFillStyle(0x171717, 0.86);
        ref.buttonBg.setStrokeStyle(1, 0x3d352c, 0.5);
        return;
      }

      if (ref.cooldownText || ref.blockedOverlay) {
        this.redrawItemsOnly();
        return;
      }

      ref.buyLabel.setText(player.sanity >= player.maxSanity ? 'Полон' : player.gold >= ref.item.price ? 'Купить' : 'Мало зол.');
    });
  }

  private startCooldownTimer() {
    this.cooldownTimerEvent?.remove(false);
    this.cooldownTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.updateCooldownUi();
      },
    });
  }

  private canBuyFromCategory(category: TavernCategory): boolean {
    return this.getCategoryCooldownLeft(category) <= 0;
  }

  private getCategoryCooldownLeft(category: TavernCategory): number {
    const now = Date.now();
    const lastPurchasedAt = category === 'drinks'
      ? player.tavernDrinkPurchasedAt
      : player.tavernFoodPurchasedAt;

    if (!lastPurchasedAt) {
      return 0;
    }

    return Math.max(0, TAVERN_CATEGORY_COOLDOWN_MS - (now - lastPurchasedAt));
  }

  private formatCooldown(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours} ч ${minutes.toString().padStart(2, '0')} мин`;
    }

    if (minutes > 0) {
      return `${minutes} мин ${seconds.toString().padStart(2, '0')} сек`;
    }

    return `${seconds} сек`;
  }

  private getShortCooldownLabel(category: TavernCategory): string {
    const ms = this.getCategoryCooldownLeft(category);
    const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));

    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return minutes > 0 ? `${hours}ч ${minutes}м` : `${hours}ч`;
    }

    return `${totalMinutes}м`;
  }

  private getCategoryStatusText(): string {
    const label = this.selectedCategory === 'drinks' ? 'Напитки' : 'Еда';
    const left = this.getCategoryCooldownLeft(this.selectedCategory);

    if (left <= 0) {
      return `${label} доступны`;
    }

    return `${label} будут доступны через ${this.formatCooldown(left)}`;
  }

  private getEffectLabel(item: TavernItem): string {
    if (item.fullRestore) {
      return 'Полностью восстановит рассудок';
    }

    return `Восстановит ${Math.round(item.restorePercent * 100)}% рассудка`;
  }

  private getSanityProgress(): number {
    if (player.maxSanity <= 0) {
      return 1;
    }

    return Phaser.Math.Clamp(player.sanity / player.maxSanity, 0, 1);
  }

  private getSanityHint(): string {
    if (player.sanity >= player.maxSanity) {
      return 'Рассудок полон';
    }

    return '+1 рассудок в минуту';
  }
}
