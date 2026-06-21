import Phaser from 'phaser';

import { UI, createSceneBackground } from '../ui/theme';

type MarketLayout = {
  width: number;
  height: number;
  centerX: number;
  safeX: number;
  safeTop: number;
  safeBottom: number;
  contentWidth: number;
  compact: boolean;
  veryCompact: boolean;
  titleY: number;
  subtitleY: number;
  firstCardY: number;
  cardHeight: number;
  cardGap: number;
  backButtonY: number;
  backButtonHeight: number;
};

type MarketCardConfig = {
  x: number;
  y: number;
  width: number;
  height: number;
  icon: string;
  title: string;
  description: string;
  status: string;
  accentColor: number;
  disabled?: boolean;
  delay: number;
  onClick: () => void;
};


export class MarketScene extends Phaser.Scene {
  private modalObjects: Phaser.GameObjects.GameObject[] = [];
  private isModalOpen = false;

  constructor() {
    super('MarketScene');
  }

  create() {
    const layout = this.getLayout();

    createSceneBackground(this);
    this.createMarketBackdrop(layout);
    this.createHeader(layout);
    this.createMarketCards(layout);
    this.createBackButton(layout);

    this.cameras.main.fadeIn(260, 0, 0, 0);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearModal();
    });
  }

  private getLayout(): MarketLayout {
    const { width, height } = this.scale;
    const safeX = Math.max(16, Math.round(width * 0.045));
    const safeTop = 22;
    const safeBottom = height - 24;
    const compact = height <= 780 || width <= 420;
    const veryCompact = height <= 700 || width <= 360;
    const contentWidth = Math.min(width - safeX * 2, veryCompact ? 560 : 620);
    const titleY = safeTop + (veryCompact ? 34 : compact ? 42 : 48);
    const subtitleY = titleY + (veryCompact ? 34 : 40);
    const backButtonHeight = veryCompact ? 48 : 54;
    const backButtonY = safeBottom - backButtonHeight / 2;
    const cardGap = veryCompact ? 10 : compact ? 13 : 16;
    const cardsTop = subtitleY + (veryCompact ? 40 : compact ? 48 : 58);
    const availableCardSpace = Math.max(270, backButtonY - backButtonHeight / 2 - cardsTop - 18);
    const maxCardHeight = veryCompact ? 104 : compact ? 116 : 128;
    const minCardHeight = veryCompact ? 84 : compact ? 94 : 104;
    const cardHeight = Math.max(
      minCardHeight,
      Math.min(maxCardHeight, Math.floor((availableCardSpace - cardGap * 2) / 3))
    );
    const firstCardY = cardsTop + cardHeight / 2;

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
      titleY,
      subtitleY,
      firstCardY,
      cardHeight,
      cardGap,
      backButtonY,
      backButtonHeight,
    };
  }

  private createMarketBackdrop(layout: MarketLayout): void {
    this.add.rectangle(layout.centerX, layout.height / 2, layout.width, layout.height, 0x040405, 0.24).setDepth(0);

    const glowY = layout.veryCompact ? 150 : 188;
    this.add.circle(layout.centerX - layout.contentWidth * 0.28, glowY, 120, 0x8a5528, 0.11).setDepth(1);
    this.add.circle(layout.centerX + layout.contentWidth * 0.3, glowY + 12, 96, 0x4c3a66, 0.09).setDepth(1);
    this.add.circle(layout.centerX, layout.height * 0.62, 190, 0x1a1010, 0.15).setDepth(1);

    const floorY = layout.safeBottom - (layout.veryCompact ? 82 : 96);
    this.add.rectangle(layout.centerX, floorY, layout.width, 2, 0x6b4b2d, 0.22).setDepth(2);
    this.add.rectangle(layout.centerX, floorY + 18, layout.width, 38, 0x050404, 0.26).setDepth(2);

    for (let i = 0; i < 34; i += 1) {
      const x = Phaser.Math.Between(layout.safeX, layout.width - layout.safeX);
      const y = Phaser.Math.Between(layout.safeTop + 20, layout.safeBottom - 110);
      const size = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.035, 0.075);
      this.add.circle(x, y, size, 0xd2a65d, alpha).setDepth(2);
    }

    this.createDistantStalls(layout);
  }

  private createDistantStalls(layout: MarketLayout): void {
    const y = layout.veryCompact ? 108 : 126;
    const baseAlpha = 0.18;

    const leftTent = this.add.graphics().setDepth(2);
    leftTent.fillStyle(0x1c110c, baseAlpha);
    leftTent.fillTriangle(
      layout.centerX - layout.contentWidth * 0.47,
      y + 46,
      layout.centerX - layout.contentWidth * 0.25,
      y + 10,
      layout.centerX - layout.contentWidth * 0.04,
      y + 46
    );
    leftTent.fillStyle(0x090807, 0.2);
    leftTent.fillRoundedRect(layout.centerX - layout.contentWidth * 0.42, y + 45, layout.contentWidth * 0.32, 34, 10);

    const rightTent = this.add.graphics().setDepth(2);
    rightTent.fillStyle(0x111621, baseAlpha);
    rightTent.fillTriangle(
      layout.centerX + layout.contentWidth * 0.06,
      y + 52,
      layout.centerX + layout.contentWidth * 0.28,
      y + 12,
      layout.centerX + layout.contentWidth * 0.48,
      y + 52
    );
    rightTent.fillStyle(0x090807, 0.18);
    rightTent.fillRoundedRect(layout.centerX + layout.contentWidth * 0.11, y + 50, layout.contentWidth * 0.3, 32, 10);
  }

  private createHeader(layout: MarketLayout): void {
    const titleFontSize = layout.veryCompact ? '30px' : layout.compact ? '34px' : '38px';
    const subtitleFontSize = layout.veryCompact ? '13px' : '15px';

    this.add.text(layout.centerX, layout.titleY, 'Рынок убежища', {
      fontFamily: UI.font.title,
      fontSize: titleFontSize,
      color: '#e4c884',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(layout.centerX, layout.subtitleY, 'торговцы, кузнецы и хранители знаний', {
      fontFamily: UI.font.body,
      fontSize: subtitleFontSize,
      color: '#9d907a',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 24,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 3,
    }).setOrigin(0.5).setDepth(10);
  }

  private createMarketCards(layout: MarketLayout): void {
    const cardWidth = layout.contentWidth;
    const yStep = layout.cardHeight + layout.cardGap;

    this.createMarketCard({
      x: layout.centerX,
      y: layout.firstCardY,
      width: cardWidth,
      height: layout.cardHeight,
      icon: '▣',
      title: 'Лавка',
      description: 'Снаряжение, зелья и редкие товары',
      status: 'Открыто',
      accentColor: 0xb89a5e,
      delay: 90,
      onClick: () => {
        this.scene.start('ShopScene');
      },
    });

    this.createMarketCard({
      x: layout.centerX,
      y: layout.firstCardY + yStep,
      width: cardWidth,
      height: layout.cardHeight,
      icon: '⚒',
      title: 'Кузнец',
      description: 'Улучшение оружия и брони',
      status: 'Открыто',
      accentColor: 0x8f7653,
      delay: 150,
      onClick: () => {
        this.scene.start('ForgeScene');
      },
    });

    this.createMarketCard({
      x: layout.centerX,
      y: layout.firstCardY + yStep * 2,
      width: cardWidth,
      height: layout.cardHeight,
      icon: '◈',
      title: 'Библиотекарь',
      description: 'Знания, летописи и тайные записи',
      status: 'Позже',
      accentColor: 0x665389,
      disabled: true,
      delay: 210,
      onClick: () => {
        this.showMessageModal('Библиотекарь', 'Библиотекарь пока недоступен.');
      },
    });
  }

  private createMarketCard(config: MarketCardConfig): void {
    const container = this.add.container(config.x, config.y + 22).setDepth(10).setAlpha(0).setScale(0.985);
    const disabled = config.disabled ?? false;
    const baseFill = disabled ? 0x0b0b10 : 0x11100e;
    const hoverFill = disabled ? 0x101017 : 0x18130e;
    const downFill = disabled ? 0x0b0b10 : 0x21170f;
    const baseStrokeAlpha = disabled ? 0.42 : 0.68;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(-config.width / 2, -config.height / 2 + 6, config.width, config.height, 24);

    const bg = this.add.graphics();
    const redrawBg = (fillColor: number, strokeAlpha: number, scale = 1): void => {
      bg.clear();
      bg.fillStyle(fillColor, disabled ? 0.78 : 0.92);
      bg.fillRoundedRect(-config.width / 2, -config.height / 2, config.width, config.height, 24);
      bg.lineStyle(2, config.accentColor, strokeAlpha);
      bg.strokeRoundedRect(-config.width / 2, -config.height / 2, config.width, config.height, 24);
      container.setScale(scale);
    };

    redrawBg(baseFill, baseStrokeAlpha);

    const leftAccent = this.add.rectangle(
      -config.width / 2 + 4,
      0,
      4,
      config.height - 24,
      config.accentColor,
      disabled ? 0.32 : 0.58
    ).setOrigin(0.5);

    const iconGlow = this.add.circle(
      -config.width / 2 + (config.height > 112 ? 62 : 54),
      0,
      config.height > 112 ? 30 : 26,
      config.accentColor,
      disabled ? 0.08 : 0.15
    );

    const icon = this.add.text(iconGlow.x, -1, config.icon, {
      fontFamily: UI.font.body,
      fontSize: config.height > 112 ? '34px' : '30px',
      color: disabled ? '#786f82' : '#ead29a',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5);

    const textLeft = -config.width / 2 + (config.height > 112 ? 112 : 100);
    const statusWidth = config.width < 390 ? 74 : 86;
    const textWidth = Math.max(150, config.width - (textLeft + config.width / 2) - statusWidth - 24);

    const title = this.add.text(textLeft, -config.height * 0.17, config.title, {
      fontFamily: UI.font.title,
      fontSize: config.height > 112 ? '24px' : '21px',
      color: disabled ? '#afa0bd' : '#f0d58a',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const description = this.add.text(textLeft, config.height * 0.16, config.description, {
      fontFamily: UI.font.body,
      fontSize: config.height > 112 ? '15px' : '13px',
      color: disabled ? '#7d7685' : '#b7aa94',
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0, 0.5);

    const statusX = config.width / 2 - statusWidth / 2 - 18;
    const statusPill = this.add.graphics();
    statusPill.fillStyle(disabled ? 0x18121f : 0x1b1510, 0.94);
    statusPill.fillRoundedRect(statusX - statusWidth / 2, -16, statusWidth, 32, 13);
    statusPill.lineStyle(1, config.accentColor, disabled ? 0.34 : 0.58);
    statusPill.strokeRoundedRect(statusX - statusWidth / 2, -16, statusWidth, 32, 13);

    const status = this.add.text(statusX, 0, config.status, {
      fontFamily: UI.font.body,
      fontSize: config.width < 390 ? '11px' : '12px',
      color: disabled ? '#a692bd' : '#d8c088',
      align: 'center',
      wordWrap: {
        width: statusWidth - 12,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5);

    const arrow = this.add.text(config.width / 2 - 18, config.height / 2 - 20, disabled ? '×' : '›', {
      fontFamily: UI.font.body,
      fontSize: disabled ? '16px' : '24px',
      color: disabled ? '#6f6477' : '#a88b57',
      align: 'center',
    }).setOrigin(0.5);

    const zone = this.add.zone(0, 0, config.width, config.height).setOrigin(0.5).setInteractive({ useHandCursor: true });

    container.add([
      shadow,
      bg,
      leftAccent,
      iconGlow,
      icon,
      title,
      description,
      statusPill,
      status,
      arrow,
      zone,
    ]);

    let pressed = false;
    let locked = false;

    const reset = (): void => {
      pressed = false;
      redrawBg(baseFill, baseStrokeAlpha, 1);
    };

    zone.on('pointerover', () => {
      if (pressed || locked || this.isModalOpen) {
        return;
      }

      redrawBg(hoverFill, disabled ? 0.52 : 0.9, 1.01);
    });

    zone.on('pointerout', () => {
      if (locked) {
        return;
      }

      reset();
    });

    zone.on('pointerdown', () => {
      if (locked || this.isModalOpen) {
        return;
      }

      pressed = true;
      redrawBg(downFill, disabled ? 0.56 : 1, 0.985);
    });

    zone.on('pointerup', () => {
      if (!pressed || locked || this.isModalOpen) {
        reset();
        return;
      }

      locked = true;
      pressed = false;
      redrawBg(hoverFill, disabled ? 0.52 : 0.95, 1);

      this.time.delayedCall(45, () => {
        config.onClick();
        locked = false;
        reset();
      });
    });

    zone.on('pointerupoutside', () => {
      reset();
    });

    zone.on('pointercancel', () => {
      reset();
    });

    this.tweens.add({
      targets: container,
      alpha: 1,
      y: config.y,
      scale: 1,
      delay: config.delay,
      duration: 280,
      ease: 'Cubic.easeOut',
    });
  }

  private createBackButton(layout: MarketLayout): void {
    const buttonWidth = Math.min(layout.contentWidth, layout.veryCompact ? 420 : 500);
    const buttonHeight = layout.backButtonHeight;
    const x = layout.centerX;
    const y = layout.backButtonY;
    const radius = 18;
    const shadow = this.add.graphics().setDepth(20);
    shadow.fillStyle(0x000000, 0.32);
    shadow.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2 + 5, buttonWidth, buttonHeight, radius);

    const bg = this.add.graphics().setDepth(21);
    const redraw = (fill: number, strokeAlpha: number): void => {
      bg.clear();
      bg.fillStyle(fill, 0.94);
      bg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, radius);
      bg.lineStyle(2, 0x6b4b2d, strokeAlpha);
      bg.strokeRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, radius);
    };
    redraw(0x15100d, 0.72);

    const label = this.add.text(x, y, 'Назад в город', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '17px' : '19px',
      color: '#d8c7a3',
      align: 'center',
      wordWrap: {
        width: buttonWidth - 34,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(22);

    const zone = this.add.zone(x, y, buttonWidth, buttonHeight).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(23);
    let pressed = false;
    let locked = false;

    const reset = (): void => {
      pressed = false;
      redraw(0x15100d, 0.72);
      label.setColor('#d8c7a3');
      label.setY(y);
    };

    zone.on('pointerover', () => {
      if (pressed || locked || this.isModalOpen) {
        return;
      }

      redraw(0x21160f, 0.95);
      label.setColor('#f0d58a');
    });

    zone.on('pointerout', () => {
      reset();
    });

    zone.on('pointerdown', () => {
      if (locked || this.isModalOpen) {
        return;
      }

      pressed = true;
      redraw(0x2a1b10, 1);
      label.setY(y + 1);
      label.setColor('#f0d58a');
    });

    zone.on('pointerup', () => {
      if (!pressed || locked || this.isModalOpen) {
        reset();
        return;
      }

      locked = true;
      pressed = false;
      this.time.delayedCall(45, () => {
        this.scene.start('CampScene');
      });
    });

    zone.on('pointerupoutside', () => {
      reset();
    });

    zone.on('pointercancel', () => {
      reset();
    });
  }

  private showMessageModal(title: string, message: string): void {
    if (this.isModalOpen) {
      return;
    }

    this.isModalOpen = true;
    const { width, height } = this.scale;
    const compact = height <= 760 || width <= 400;
    const panelWidth = Math.min(width - 36, compact ? 430 : 500);
    const panelHeight = compact ? 218 : 236;
    const panelX = width / 2;
    const panelY = height / 2;

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.62)
      .setDepth(90)
      .setInteractive();

    const shadow = this.add.graphics().setDepth(91);
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2 + 7, panelWidth, panelHeight, 26);

    const panel = this.add.graphics().setDepth(92);
    panel.fillStyle(0x111013, 0.98);
    panel.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 26);
    panel.lineStyle(2, 0x665389, 0.72);
    panel.strokeRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 26);

    const titleText = this.add.text(panelX, panelY - panelHeight / 2 + 48, title, {
      fontFamily: UI.font.title,
      fontSize: compact ? '25px' : '28px',
      color: '#e4c884',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: panelWidth - 48,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(93);

    const messageText = this.add.text(panelX, panelY - 4, message, {
      fontFamily: UI.font.body,
      fontSize: compact ? '16px' : '17px',
      color: '#cbbda3',
      align: 'center',
      wordWrap: {
        width: panelWidth - 64,
        useAdvancedWrap: true,
      },
      maxLines: 3,
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(93);

    const closeWidth = Math.min(panelWidth - 80, 260);
    const closeHeight = compact ? 46 : 50;
    const closeY = panelY + panelHeight / 2 - 46;
    const closeBg = this.add.graphics().setDepth(93);
    const redrawClose = (fill: number, strokeAlpha: number): void => {
      closeBg.clear();
      closeBg.fillStyle(fill, 0.96);
      closeBg.fillRoundedRect(panelX - closeWidth / 2, closeY - closeHeight / 2, closeWidth, closeHeight, 16);
      closeBg.lineStyle(2, 0x8b6a3c, strokeAlpha);
      closeBg.strokeRoundedRect(panelX - closeWidth / 2, closeY - closeHeight / 2, closeWidth, closeHeight, 16);
    };
    redrawClose(0x1a120d, 0.78);

    const closeText = this.add.text(panelX, closeY, 'Понятно', {
      fontFamily: UI.font.body,
      fontSize: compact ? '16px' : '18px',
      color: '#d8c7a3',
      align: 'center',
    }).setOrigin(0.5).setDepth(94);

    const closeZone = this.add.zone(panelX, closeY, closeWidth, closeHeight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(95);

    closeZone.on('pointerover', () => {
      redrawClose(0x24170f, 1);
      closeText.setColor('#f0d58a');
    });

    closeZone.on('pointerout', () => {
      redrawClose(0x1a120d, 0.78);
      closeText.setColor('#d8c7a3');
    });

    closeZone.on('pointerup', () => {
      this.clearModal();
    });

    this.modalObjects = [dim, shadow, panel, titleText, messageText, closeBg, closeText, closeZone];
  }

  private clearModal(): void {
    this.modalObjects.forEach(object => object.destroy());
    this.modalObjects = [];
    this.isModalOpen = false;
  }
}
