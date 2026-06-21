import Phaser from 'phaser';

import { createButton } from '../ui/createButton';
import { UI } from '../ui/theme';

type HomeLayout = {
  width: number;
  height: number;
  compact: boolean;
  veryCompact: boolean;
  contentWidth: number;
  safeLeft: number;
  safeRight: number;
  safeTop: number;
  safeBottom: number;
  titleY: number;
  subtitleY: number;
  gridTop: number;
  cardWidth: number;
  cardHeight: number;
  cardGap: number;
  columns: number;
  bottomButtonY: number;
  bottomButtonHeight: number;
};

type HomeCardConfig = {
  icon: string;
  title: string;
  description: string;
  status: string;
  accent: number;
  accentText: string;
  disabled?: boolean;
  onClick: () => void;
};

export class HomeScene extends Phaser.Scene {
  private isModalOpen = false;

  constructor() {
    super('HomeScene');
  }

  create(): void {
    const layout = this.getLayout();

    this.createHomeBackdrop(layout);
    this.createHeader(layout);
    this.createHomeCards(layout);
    this.createBottomReturnButton(layout);

    this.cameras.main.fadeIn(420, 3, 4, 5);
  }

  private getLayout(): HomeLayout {
    const { width, height } = this.scale;

    const veryCompact = height < 690 || width < 360;
    const compact = height < 780 || width < 410;

    const safeLeft = 18;
    const safeRight = 18;
    const safeTop = 28;
    const safeBottom = 22;
    const contentWidth = Math.min(width - safeLeft - safeRight, 680);

    const bottomButtonHeight = veryCompact ? 52 : compact ? 56 : 60;
    const bottomButtonY = height - safeBottom - bottomButtonHeight / 2;

    const availableGridHeight = bottomButtonY - bottomButtonHeight / 2 - 24 - 170;
    const columns = width >= 430 && availableGridHeight >= 300 ? 2 : 1;
    const cardGap = veryCompact ? 10 : compact ? 12 : 16;
    const cardHeight = columns === 2
      ? (veryCompact ? 112 : compact ? 122 : 132)
      : Math.max(82, Math.min(112, Math.floor((availableGridHeight - cardGap * 3) / 4)));
    const cardWidth = columns === 2
      ? Math.floor((contentWidth - cardGap) / 2)
      : contentWidth;

    return {
      width,
      height,
      compact,
      veryCompact,
      contentWidth,
      safeLeft,
      safeRight,
      safeTop,
      safeBottom,
      titleY: safeTop + (veryCompact ? 42 : 52),
      subtitleY: safeTop + (veryCompact ? 78 : 94),
      gridTop: safeTop + (veryCompact ? 118 : compact ? 136 : 154),
      cardWidth,
      cardHeight,
      cardGap,
      columns,
      bottomButtonY,
      bottomButtonHeight,
    };
  }

  private createHomeBackdrop(layout: HomeLayout): void {
    this.add.rectangle(layout.width / 2, layout.height / 2, layout.width, layout.height, 0x030405, 1);

    const g = this.add.graphics();

    g.fillStyle(0x07090d, 0.98);
    g.fillRect(0, 0, layout.width, layout.height);

    g.fillStyle(0x120c08, 0.72);
    g.fillRect(0, layout.height * 0.58, layout.width, layout.height * 0.42);

    g.fillStyle(0x1a120c, 0.44);
    g.fillRect(28, layout.height * 0.18, layout.width - 56, layout.height * 0.62);

    g.fillStyle(0x0b1118, 0.66);
    g.fillRoundedRect(44, layout.height * 0.18, layout.width - 88, layout.height * 0.56, 26);
    g.lineStyle(2, 0x6f5734, 0.22);
    g.strokeRoundedRect(44, layout.height * 0.18, layout.width - 88, layout.height * 0.56, 26);

    g.fillStyle(0x27170d, 0.48);
    for (let x = 32; x < layout.width; x += 74) {
      g.fillRect(x, layout.height * 0.12, 16, layout.height * 0.72);
    }

    g.fillStyle(0xd28a3a, 0.12);
    g.fillCircle(layout.width * 0.28, layout.height * 0.24, 95);
    g.fillStyle(0xb9985b, 0.1);
    g.fillCircle(layout.width * 0.76, layout.height * 0.3, 115);

    this.createDustParticles(layout);
  }

  private createDustParticles(layout: HomeLayout): void {
    for (let i = 0; i < 34; i += 1) {
      const x = Phaser.Math.Between(16, Math.max(16, layout.width - 16));
      const y = Phaser.Math.Between(48, Math.max(48, layout.height - 120));
      const size = Phaser.Math.FloatBetween(1.1, 2.2);
      const alpha = Phaser.Math.FloatBetween(0.08, 0.22);

      const mote = this.add.circle(x, y, size, 0xb9985b, alpha).setDepth(1);

      this.tweens.add({
        targets: mote,
        y: y - Phaser.Math.Between(10, 28),
        alpha: alpha * 0.35,
        duration: Phaser.Math.Between(2600, 4600),
        repeat: -1,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createHeader(layout: HomeLayout): void {
    this.add.text(layout.width / 2, layout.titleY, 'Дом героя', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '30px' : layout.compact ? '34px' : '38px',
      color: '#d2b87a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(layout.width / 2, layout.subtitleY, 'подготовка, ремесло и знания перед спуском', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '13px' : '15px',
      color: '#9f9078',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 26,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(10);
  }

  private createHomeCards(layout: HomeLayout): void {
    const cards: HomeCardConfig[] = [
      {
        icon: '⚔',
        title: 'Тренировка',
        description: 'Усилить характеристики героя за золото',
        status: 'Открыто',
        accent: 0xb9985b,
        accentText: '#e4cf96',
        onClick: () => {
          this.scene.start('TrainingScene');
        },
      },
      {
        icon: '♞',
        title: 'Конюшня',
        description: 'Лошади и дальние переходы',
        status: 'Позже',
        accent: 0x4f81a8,
        accentText: '#9eb7cb',
        disabled: true,
        onClick: () => {
          this.showHomeMessage('Скоро будет доступно', 'Конюшня скоро будет доступна.');
        },
      },
      {
        icon: '⚒',
        title: 'Верстак',
        description: 'Ремесло, улучшения и подготовка припасов',
        status: 'Позже',
        accent: 0xd28a3a,
        accentText: '#d7aa6d',
        disabled: true,
        onClick: () => {
          this.showHomeMessage('Скоро будет доступно', 'Верстак скоро будет доступен.');
        },
      },
      {
        icon: '☰',
        title: 'Бестиарий',
        description: 'Записи о монстрах катакомб',
        status: 'Позже',
        accent: 0x6b4a8c,
        accentText: '#b9a0d2',
        disabled: true,
        onClick: () => {
          this.showHomeMessage('Скоро будет доступно', 'Бестиарий скоро будет доступен.');
        },
      },
    ];

    cards.forEach((card, index) => {
      const row = Math.floor(index / layout.columns);
      const col = index % layout.columns;
      const x = layout.columns === 2
        ? layout.width / 2 - layout.contentWidth / 2 + layout.cardWidth / 2 + col * (layout.cardWidth + layout.cardGap)
        : layout.width / 2;
      const y = layout.gridTop + layout.cardHeight / 2 + row * (layout.cardHeight + layout.cardGap);

      this.createHomeCard(layout, card, x, y, index);
    });
  }

  private createHomeCard(
    layout: HomeLayout,
    config: HomeCardConfig,
    x: number,
    y: number,
    index: number
  ): void {
    const width = layout.cardWidth;
    const height = layout.cardHeight;
    const disabledAlpha = config.disabled ? 0.72 : 0.92;

    const shadow = this.add.rectangle(x, y + 6, width, height, 0x000000, 0.34)
      .setDepth(9);

    const bg = this.add.rectangle(x, y, width, height, config.disabled ? 0x11100f : 0x15100c, disabledAlpha)
      .setStrokeStyle(2, config.accent, config.disabled ? 0.34 : 0.64)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    const glow = this.add.rectangle(x, y, width - 8, height - 8, config.accent, config.disabled ? 0.035 : 0.065)
      .setDepth(11);

    const iconX = x - width / 2 + (layout.columns === 2 ? 34 : 46);

    const iconCircle = this.add.circle(iconX, y - height * 0.12, layout.columns === 2 ? 22 : 27, 0x090706, 0.9)
      .setStrokeStyle(2, config.accent, config.disabled ? 0.34 : 0.72)
      .setDepth(12);

    const icon = this.add.text(iconX, y - height * 0.12, config.icon, {
      fontFamily: UI.font.body,
      fontSize: layout.columns === 2 ? '21px' : '25px',
      color: config.accentText,
    }).setOrigin(0.5).setDepth(13);

    const textLeft = x - width / 2 + (layout.columns === 2 ? 66 : 86);
    const textWidth = Math.max(120, width - (layout.columns === 2 ? 90 : 122));

    const title = this.add.text(textLeft, y - height * 0.25, config.title, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '18px' : layout.columns === 2 ? '19px' : '22px',
      color: config.disabled ? '#9f9078' : '#d2b87a',
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(13);

    const description = this.add.text(textLeft, y + 2, config.description, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '12px' : layout.columns === 2 ? '12px' : '14px',
      color: config.disabled ? '#746b60' : '#d1c7b4',
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: layout.columns === 2 ? 2 : 2,
    }).setOrigin(0, 0.5).setDepth(13);

    const status = this.add.text(textLeft, y + height * 0.27, config.status, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '11px' : '12px',
      color: config.disabled ? '#837769' : config.accentText,
      backgroundColor: '#070504',
      padding: {
        x: 8,
        y: 4,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(13);

    const arrow = this.add.text(x + width / 2 - 24, y, '›', {
      fontFamily: UI.font.title,
      fontSize: layout.columns === 2 ? '25px' : '32px',
      color: config.disabled ? '#5e554b' : config.accentText,
    }).setOrigin(0.5).setDepth(13);

    const animatedObjects = [shadow, bg, glow, iconCircle, icon, title, description, status, arrow];
    animatedObjects.forEach((object) => object.setAlpha(0));

    this.tweens.add({
      targets: animatedObjects,
      alpha: 1,
      y: '+=0',
      duration: 260,
      delay: 120 + index * 90,
      ease: 'Cubic.easeOut',
    });

    bg.on('pointerover', () => {
      if (this.isModalOpen) {
        return;
      }

      bg.setFillStyle(config.disabled ? 0x17120f : 0x21150f, config.disabled ? 0.8 : 0.98);
      bg.setStrokeStyle(2, config.accent, config.disabled ? 0.45 : 0.92);
      glow.setAlpha(config.disabled ? 0.08 : 0.14);
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(config.disabled ? 0x11100f : 0x15100c, disabledAlpha);
      bg.setStrokeStyle(2, config.accent, config.disabled ? 0.34 : 0.64);
      glow.setAlpha(config.disabled ? 0.035 : 0.065);
    });

    bg.on('pointerdown', () => {
      if (this.isModalOpen) {
        return;
      }

      bg.setScale(0.985);
      glow.setScale(0.985);
    });

    bg.on('pointerupoutside', () => {
      bg.setScale(1);
      glow.setScale(1);
    });

    bg.on('pointerup', () => {
      if (this.isModalOpen) {
        return;
      }

      bg.setScale(1);
      glow.setScale(1);
      config.onClick();
    });
  }

  private createBottomReturnButton(layout: HomeLayout): void {
    const button = createButton(
      this,
      layout.width / 2,
      layout.bottomButtonY,
      '← Вернуться в город',
      () => {
        if (this.isModalOpen) {
          return;
        }

        this.scene.start('CampScene');
      },
      Math.min(layout.contentWidth, 560),
      layout.bottomButtonHeight,
      {
        small: layout.veryCompact,
      }
    );

    button.shadow.setDepth(40);
    button.bg.setDepth(41);
    button.label.setDepth(42);

    button.shadow.setAlpha(0);
    button.bg.setAlpha(0);
    button.label.setAlpha(0);

    this.tweens.add({
      targets: [button.shadow, button.bg, button.label],
      alpha: 1,
      duration: 280,
      delay: 420,
      ease: 'Cubic.easeOut',
    });
  }

  private showHomeMessage(titleText: string, message: string): void {
    if (this.isModalOpen) {
      return;
    }

    this.isModalOpen = true;

    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setDepth(1000)
      .setInteractive();

    const panelWidth = Math.min(width - 42, 560);
    const panelHeight = 260;

    const shadow = this.add.rectangle(width / 2, height / 2 + 7, panelWidth, panelHeight, 0x000000, 0.38)
      .setDepth(1001);

    const panel = this.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x17100c, 0.98)
      .setStrokeStyle(3, UI.colors.goldDark, 0.86)
      .setDepth(1002)
      .setInteractive();

    const title = this.add.text(width / 2, height / 2 - 76, titleText, {
      fontFamily: UI.font.title,
      fontSize: width < 380 ? '24px' : '28px',
      color: UI.colors.goldText,
      align: 'center',
      wordWrap: {
        width: panelWidth - 44,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(1003);

    const body = this.add.text(width / 2, height / 2 - 10, message, {
      fontFamily: UI.font.body,
      fontSize: width < 380 ? '16px' : '18px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: panelWidth - 62,
        useAdvancedWrap: true,
      },
      maxLines: 3,
    }).setOrigin(0.5).setDepth(1003);

    const closeButton = createButton(
      this,
      width / 2,
      height / 2 + 82,
      'Понятно',
      () => {
        overlay.destroy();
        shadow.destroy();
        panel.destroy();
        title.destroy();
        body.destroy();
        closeButton.shadow.destroy();
        closeButton.bg.destroy();
        closeButton.label.destroy();
        this.isModalOpen = false;
      },
      Math.min(panelWidth - 90, 280),
      52
    );

    closeButton.shadow.setDepth(1002);
    closeButton.bg.setDepth(1003);
    closeButton.label.setDepth(1004);
  }
}
