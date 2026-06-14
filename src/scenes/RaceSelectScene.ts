import Phaser from 'phaser';

import { player } from '../data/player';
import { races, type RaceData, type RaceId } from '../data/races';

import { saveGameAsync } from '../systems/SaveSystem';

import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type RaceLayout = {
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

type RaceButton = {
  objects: Phaser.GameObjects.GameObject[];
  zone: Phaser.GameObjects.Zone;
};

export class RaceSelectScene extends Phaser.Scene {
  private selectedRace?: RaceData;
  private bottomActionObjects: Phaser.GameObjects.GameObject[] = [];

  private layout!: RaceLayout;
  private contentContainer?: Phaser.GameObjects.Container;
  private contentMaskGraphics?: Phaser.GameObjects.Graphics;

  private currentScrollY = 0;
  private targetScrollY = 0;
  private maxScrollY = 0;

  private isDraggingContent = false;
  private didDragContent = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  constructor() {
    super('RaceSelectScene');
  }

  create() {
    this.selectedRace = races[0];
    this.layout = this.getLayout();

    createSceneBackground(this);
    this.createBackground(this.layout);
    this.createHeader(this.layout);
    this.createScrollableContent(this.layout);
    this.createBottomAction(this.layout);
  }

  update() {
    if (!this.contentContainer) {
      return;
    }

    if (this.isDraggingContent) {
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

  private getLayout(): RaceLayout {
    const { width, height } = this.scale;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.025), 20, 34);
    const safeBottom = 112;

    const contentTop = safeTop + 118;
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

  private createBackground(layout: RaceLayout) {
    const { width, height, centerX } = layout;

    this.add.circle(centerX, layout.safeTop + 120, width * 0.48, 0x8a3f1c, 0.075).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 125, width * 0.28, 0xf0a040, 0.045).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 125, width * 0.12, 0xf0d58a, 0.028).setDepth(0);

    this.add.rectangle(centerX, height - 190, width, 380, 0x050302, 0.42).setDepth(0);

    for (let i = 0; i < 32; i += 1) {
      const x = layout.safeX + 18 + i * ((width - layout.safeX * 2 - 36) / 31);
      const y = layout.safeTop + 86 + (i % 8) * 72;
      const size = 1 + (i % 3);
      const alpha = 0.035 + (i % 5) * 0.012;

      this.add.circle(x, y, size, 0xd8b56d, alpha).setDepth(1);
    }

    this.add.text(centerX, layout.safeTop + 138, '✦', {
      fontFamily: UI.font.body,
      fontSize: '104px',
      color: '#ffffff',
    })
      .setOrigin(0.5)
      .setAlpha(0.025)
      .setDepth(1);
  }

  private createHeader(layout: RaceLayout) {
    this.add.text(layout.centerX, layout.safeTop + 26, 'Создание героя', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '30px' : '35px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(200);

    this.add.text(layout.centerX, layout.safeTop + 65, 'Выбери расу, пассивку и активный навык перед первым спуском', {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 40,
      },
      maxLines: 2,
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(200);
  }

  private createScrollableContent(layout: RaceLayout) {
    this.contentContainer?.destroy(true);
    this.contentMaskGraphics?.destroy();

    this.contentContainer = this.add.container(0, 0).setDepth(5);

    this.contentMaskGraphics = this.add.graphics();
    this.contentMaskGraphics.setVisible(false);
    this.contentMaskGraphics.fillStyle(0xffffff, 1);
    this.contentMaskGraphics.fillRect(
      layout.safeX,
      layout.contentTop,
      layout.width - layout.safeX * 2,
      layout.viewportHeight
    );

    const mask = this.contentMaskGraphics.createGeometryMask();
    this.contentContainer.setMask(mask);

    let cursorY = layout.contentTop + 18;

    cursorY = this.createIntroPanel(layout, cursorY);
    cursorY = this.createRaceListPanel(layout, cursorY + 16);

    if (this.selectedRace) {
      cursorY = this.createSelectedRacePanel(layout, cursorY + 16, this.selectedRace);
    }

    cursorY = this.createAdvicePanel(layout, cursorY + 16);

    const contentHeight = cursorY - layout.contentTop + 28;

    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScrollY);
    this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY, 0, this.maxScrollY);

    this.contentContainer.y = -this.currentScrollY;

    this.createScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }
  }

  private createScrollInput(layout: RaceLayout) {
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.input.off('pointerupoutside');
    this.input.off('wheel');

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.maxScrollY <= 0) {
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
      if (!this.isDraggingContent) {
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
        if (this.maxScrollY <= 0) {
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

  private isPointerInsideScrollArea(pointer: Phaser.Input.Pointer, layout: RaceLayout) {
    return (
      pointer.x >= layout.safeX &&
      pointer.x <= layout.width - layout.safeX &&
      pointer.y >= layout.contentTop &&
      pointer.y <= layout.contentBottom
    );
  }

  private createScrollHint(layout: RaceLayout) {
    const hintY = layout.contentBottom - 18;

    const bg = this.add.rectangle(layout.centerX, hintY, 230, 28, 0x000000, 0.34)
      .setDepth(230);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай список рас', {
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

  private createIntroPanel(layout: RaceLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = 126;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: 0x100b08,
      alpha: 0.93,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.52,
      glowColor: 0xf0a040,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 35, 'Раса — это стиль игры', {
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

    this.addTo(
      container,
      this.add.text(
        layout.centerX,
        topY + 82,
        'Смотри не только на стартовые характеристики, но и на пассивный эффект, активный навык, цену энергии и перезарядку.',
        {
          fontFamily: UI.font.body,
          fontSize: '14px',
          color: UI.colors.text,
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

  private createRaceListPanel(layout: RaceLayout, topY: number) {
    const container = this.requireContentContainer();

    const cards = races;
    const cardHeight = 134;
    const cardGap = 12;
    const headerHeight = 72;
    const bottomPadding = 22;

    const panelHeight =
      headerHeight +
      cards.length * cardHeight +
      Math.max(0, cards.length - 1) * cardGap +
      bottomPadding;

    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
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
      this.add.text(layout.centerX - layout.contentWidth / 2 + 30, topY + 34, 'Доступные расы', {
        fontFamily: UI.font.title,
        fontSize: '24px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 160,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(layout.centerX + layout.contentWidth / 2 - 30, topY + 34, `${cards.length} рас`, {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: UI.colors.textMuted,
        align: 'right',
        wordWrap: {
          width: 110,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(8)
    );

    if (cards.length === 0) {
      this.addTo(
        container,
        this.add.text(layout.centerX, topY + 132, 'Расы пока не добавлены.', {
          fontFamily: UI.font.body,
          fontSize: '18px',
          color: UI.colors.textMuted,
          align: 'center',
          wordWrap: {
            width: layout.contentWidth - 70,
          },
        }).setOrigin(0.5).setDepth(8)
      );

      return topY + 260;
    }

    cards.forEach((race, index) => {
      const y = topY + headerHeight + cardHeight / 2 + index * (cardHeight + cardGap);
      this.createRaceCard(container, layout, race, y, cardHeight);
    });

    return topY + panelHeight;
  }

  private createRaceCard(
    container: Phaser.GameObjects.Container,
    layout: RaceLayout,
    race: RaceData,
    y: number,
    cardHeight: number
  ) {
    const selected = this.selectedRace?.id === race.id;
    const cardWidth = layout.contentWidth - 44;
    const cardX = layout.centerX;
    const left = cardX - cardWidth / 2;
    const right = cardX + cardWidth / 2;
    const raceColor = this.getRaceColor(race.id);
    const raceIcon = this.getRaceIcon(race.id);

    this.createRoundedPanel({
      parent: container,
      x: cardX,
      y,
      width: cardWidth,
      height: cardHeight,
      radius: 24,
      color: selected ? 0x21150f : 0x14100d,
      alpha: 0.96,
      strokeColor: selected ? UI.colors.gold : raceColor,
      strokeAlpha: selected ? 0.95 : 0.58,
      strokeWidth: selected ? 3 : 2,
      glowColor: raceColor,
      depth: 5,
    });

    this.addTo(
      container,
      this.add.circle(left + 48, y - 34, 29, raceColor, 0.18)
        .setStrokeStyle(2, raceColor, 0.75)
        .setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(left + 48, y - 34, raceIcon, {
        fontFamily: UI.font.body,
        fontSize: '24px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(10)
    );

    const buttonWidth = 112;
    const buttonX = right - buttonWidth / 2 - 18;
    const textX = left + 90;
    const textWidth = Math.max(210, buttonX - buttonWidth / 2 - textX - 16);

    this.addTo(
      container,
      this.add.text(textX, y - 56, race.name, {
        fontFamily: UI.font.title,
        fontSize: '20px',
        color: selected ? UI.colors.goldText : UI.colors.text,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    this.addTo(
      container,
      this.add.text(textX, y - 30, this.getRaceRole(race.id), {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: this.getRaceColorText(race.id),
        wordWrap: {
          width: textWidth,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    this.addTo(
      container,
      this.add.text(textX, y - 2, race.description, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: UI.colors.textMuted,
        lineSpacing: 3,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    this.addTo(
      container,
      this.add.text(textX, y + 36, this.createShortStatsText(race), {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: UI.colors.text,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 2,
        lineSpacing: 3,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    this.createUiButton({
      parent: container,
      x: buttonX,
      y: y + 28,
      width: buttonWidth,
      height: 42,
      text: selected ? 'Выбрано' : 'Выбрать',
      accentColor: selected ? UI.colors.gold : raceColor,
      disabled: false,
      variant: selected ? 'green' : 'gold',
      small: true,
      onClick: () => {
        if (this.didDragContent) {
          return;
        }

        this.selectRacePreview(race);
      },
      depth: 11,
    });

    const zone = this.add.zone(cardX, y, cardWidth, cardHeight)
      .setDepth(14)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerup', () => {
      if (this.didDragContent) {
        return;
      }

      this.selectRacePreview(race);
    });

    container.add(zone);
  }

  private selectRacePreview(race: RaceData) {
    this.selectedRace = race;
    this.targetScrollY = 0;
    this.currentScrollY = 0;
    this.createScrollableContent(this.layout);
    this.createBottomAction(this.layout);
  }

  private createSelectedRacePanel(layout: RaceLayout, topY: number, race: RaceData) {
    const container = this.requireContentContainer();
    const raceColor = this.getRaceColor(race.id);

    const panelHeight = 650;
    const panelY = topY + panelHeight / 2;
    const left = layout.centerX - layout.contentWidth / 2;
    const right = layout.centerX + layout.contentWidth / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 34,
      color: 0x100b08,
      alpha: 0.96,
      strokeColor: raceColor,
      strokeAlpha: 0.72,
      strokeWidth: 2,
      glowColor: raceColor,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.circle(left + 58, topY + 58, 38, raceColor, 0.18)
        .setStrokeStyle(2, raceColor, 0.85)
        .setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(left + 58, topY + 58, this.getRaceIcon(race.id), {
        fontFamily: UI.font.body,
        fontSize: '30px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(left + 112, topY + 37, race.name, {
        fontFamily: UI.font.title,
        fontSize: '27px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 5,
        wordWrap: {
          width: right - left - 150,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(left + 112, topY + 72, this.getRaceRole(race.id), {
        fontFamily: UI.font.body,
        fontSize: '15px',
        color: this.getRaceColorText(race.id),
        wordWrap: {
          width: right - left - 150,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(9)
    );

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 122, race.description, {
        fontFamily: UI.font.body,
        fontSize: '15px',
        color: UI.colors.text,
        align: 'center',
        lineSpacing: 4,
        wordWrap: {
          width: layout.contentWidth - 64,
        },
        maxLines: 3,
      }).setOrigin(0.5).setDepth(9)
    );

    this.createStatsGrid(container, layout, race, topY + 206);

    this.createSkillBox({
      parent: container,
      x: layout.centerX,
      y: topY + 372,
      width: layout.contentWidth - 44,
      height: 128,
      icon: '◇',
      title: `Пассивный навык: ${race.passiveName}`,
      description: race.passiveDescription,
      color: 0x75d184,
    });

    this.createSkillBox({
      parent: container,
      x: layout.centerX,
      y: topY + 518,
      width: layout.contentWidth - 44,
      height: 142,
      icon: '✦',
      title: `Активный навык: ${race.activeName}`,
      description: race.activeDescription,
      color: 0x70a6ff,
    });

    return topY + panelHeight;
  }

  private createStatsGrid(
    container: Phaser.GameObjects.Container,
    layout: RaceLayout,
    race: RaceData,
    centerY: number
  ) {
    const gridWidth = layout.contentWidth - 44;
    const chipGap = 10;
    const chipWidth = (gridWidth - chipGap * 2) / 3;
    const chipHeight = 56;
    const startX = layout.centerX - gridWidth / 2 + chipWidth / 2;

    const stats = [
      { label: 'HP', value: `${race.hp * 10}`, icon: '♥', color: 0xff6b6b },
      { label: 'Сила', value: `${race.strength}`, icon: '⚔', color: 0xf0d58a },
      { label: 'Защита', value: `${race.defense}`, icon: '🛡', color: 0x9ca3af },
      { label: 'Ловкость', value: `${race.agility}`, icon: '↯', color: 0x70a6ff },
      { label: 'Интеллект', value: `${race.intelligence}`, icon: '✧', color: 0xc084fc },
      { label: 'Удача', value: `${race.luck}`, icon: '✦', color: 0x75d184 },
    ];

    stats.forEach((stat, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = startX + col * (chipWidth + chipGap);
      const y = centerY - 34 + row * 68;

      this.createStatChip({
        parent: container,
        x,
        y,
        width: chipWidth,
        height: chipHeight,
        icon: stat.icon,
        label: stat.label,
        value: stat.value,
        color: stat.color,
      });
    });
  }

  private createStatChip(config: {
    parent: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    label: string;
    value: string;
    color: number;
  }) {
    this.createRoundedPanel({
      parent: config.parent,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 18,
      color: 0x17100c,
      alpha: 0.96,
      strokeColor: config.color,
      strokeAlpha: 0.34,
      strokeWidth: 1,
      glowColor: config.color,
      depth: 8,
    });

    const left = config.x - config.width / 2;

    this.addTo(
      config.parent,
      this.add.text(left + 18, config.y, config.icon, {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(11)
    );

    this.addTo(
      config.parent,
      this.add.text(left + 34, config.y - 10, config.label, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: config.width - 40,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(11)
    );

    this.addTo(
      config.parent,
      this.add.text(left + 34, config.y + 11, config.value, {
        fontFamily: UI.font.title,
        fontSize: '16px',
        color: UI.colors.text,
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: config.width - 40,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(11)
    );
  }

  private createSkillBox(config: {
    parent: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    title: string;
    description: string;
    color: number;
  }) {
    this.createRoundedPanel({
      parent: config.parent,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 24,
      color: 0x14100d,
      alpha: 0.96,
      strokeColor: config.color,
      strokeAlpha: 0.58,
      strokeWidth: 2,
      glowColor: config.color,
      depth: 8,
    });

    const left = config.x - config.width / 2;
    const textX = left + 76;
    const textWidth = config.width - 102;

    this.addTo(
      config.parent,
      this.add.circle(left + 39, config.y - config.height / 2 + 42, 25, config.color, 0.18)
        .setStrokeStyle(2, config.color, 0.68)
        .setDepth(11)
    );

    this.addTo(
      config.parent,
      this.add.text(left + 39, config.y - config.height / 2 + 42, config.icon, {
        fontFamily: UI.font.body,
        fontSize: '20px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(12)
    );

    this.addTo(
      config.parent,
      this.add.text(textX, config.y - config.height / 2 + 28, config.title, {
        fontFamily: UI.font.title,
        fontSize: '16px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: textWidth,
        },
        maxLines: 2,
        lineSpacing: 2,
      }).setOrigin(0, 0).setDepth(12)
    );

    this.addTo(
      config.parent,
      this.add.text(textX, config.y - config.height / 2 + 74, config.description, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: UI.colors.text,
        lineSpacing: 4,
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: 4,
      }).setOrigin(0, 0).setDepth(12)
    );
  }

  private createAdvicePanel(layout: RaceLayout, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = 128;
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
      this.add.text(layout.centerX, topY + 34, 'Подсказка', {
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
        topY + 82,
        'Для первого прохождения проще всего Человек или Камнерожденный. Для риска и урона — Демон или Полукровка Скверны. Для добычи — Гоблин.',
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

  private createBottomAction(layout: RaceLayout) {
    this.bottomActionObjects.forEach(object => {
      object.destroy();
    });

    this.bottomActionObjects = [];

    const button = this.createUiButton({
      x: layout.centerX,
      y: layout.height - 52,
      width: Math.min(layout.contentWidth, 540),
      height: 56,
      text: this.selectedRace ? `Начать путь: ${this.selectedRace.name}` : 'Выбери расу',
      accentColor: UI.colors.gold,
      disabled: !this.selectedRace,
      variant: 'gold',
      onClick: () => {
        this.confirmRace();
      },
      depth: 240,
    });

    this.bottomActionObjects = button.objects;
  }

  private confirmRace() {
    if (!this.selectedRace) {
      return;
    }

    this.selectRace(this.selectedRace);
  }

  private selectRace(race: RaceData) {
    player.raceId = race.id;

    if (!player.name || player.name === 'Безымянный') {
      player.name = race.name;
    }

    player.maxHp = race.hp * 10;
    player.hp = player.maxHp;

    player.defense = race.defense;
    player.agility = race.agility;
    player.strength = race.strength;
    player.luck = race.luck;
    player.intelligence = race.intelligence;

    player.attack = race.strength;
    player.critChance = 0.1;

    player.energy = player.maxEnergy;

    void saveGameAsync();

    this.scene.start('CampScene');
  }

  private createShortStatsText(race: RaceData) {
    return [
      `HP ${race.hp * 10}`,
      `СИЛ ${race.strength}`,
      `ЗАЩ ${race.defense}`,
      `ЛВК ${race.agility}`,
      `УДЧ ${race.luck}`,
    ].join('  •  ');
  }

  private getRaceIcon(id: RaceId | string) {
    if (id === 'human') return '◆';
    if (id === 'tainted_halfblood') return '☾';
    if (id === 'stoneborn') return '▣';
    if (id === 'night_elf') return '◐';
    if (id === 'goblin') return '!';
    if (id === 'demon') return '◆';

    return '◆';
  }

  private getRaceRole(id: RaceId | string) {
    if (id === 'human') return 'Универсал / стабильность';
    if (id === 'tainted_halfblood') return 'Риск / крит / урон';
    if (id === 'stoneborn') return 'Танк / выживание';
    if (id === 'night_elf') return 'Уклонение / темп';
    if (id === 'goblin') return 'Лут / золото / хитрость';
    if (id === 'demon') return 'Урон / жертва HP';

    return 'Боец';
  }

  private getRaceColor(id: RaceId | string) {
    if (id === 'human') return 0xf0d58a;
    if (id === 'tainted_halfblood') return 0xc084fc;
    if (id === 'stoneborn') return 0x9ca3af;
    if (id === 'night_elf') return 0x70a6ff;
    if (id === 'goblin') return 0x75d184;
    if (id === 'demon') return 0xff6b6b;

    return UI.colors.gold;
  }

  private getRaceColorText(id: RaceId | string) {
    if (id === 'human') return UI.colors.goldText;
    if (id === 'tainted_halfblood') return '#c084fc';
    if (id === 'stoneborn') return '#c7cbd1';
    if (id === 'night_elf') return '#70a6ff';
    if (id === 'goblin') return '#75d184';
    if (id === 'demon') return '#ff6b6b';

    return UI.colors.textMuted;
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
    disabled?: boolean;
    variant?: 'gold' | 'green' | 'red' | 'dark';
    depth?: number;
    small?: boolean;
  }): RaceButton {
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
            : config.accentColor;

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
    const radius = config.radius ?? 26;
    const color = config.color ?? 0x14100d;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? UI.colors.goldDark;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const glowColor = config.glowColor ?? 0xf0a040;
    const depth = config.depth ?? 1;

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.32);
    shadow.fillRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2 + 7,
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
      0.042
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
      throw new Error('Race select content container was not created.');
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
