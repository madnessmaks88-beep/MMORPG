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

  headerTop: number;
  headerHeight: number;

  contentTop: number;
  contentBottom: number;
  contentWidth: number;
  viewportHeight: number;

  bottomBarHeight: number;
  bottomButtonY: number;

  compact: boolean;
  veryCompact: boolean;
};

type RaceButton = {
  objects: Phaser.GameObjects.GameObject[];
  zone: Phaser.GameObjects.Zone;
};

const RACE_SCENE = {
  black: 0x030405,
  void: 0x06070a,
  graphite: 0x0c0d11,
  stone: 0x11131a,
  stoneSoft: 0x181a22,
  panel: 0x0d0a08,
  panelWarm: 0x15100c,
  bronze: 0x6a4d30,
  bronzeDark: 0x342418,
  gold: 0xb9985b,
  goldSoft: 0xd8c088,
  ash: 0x9b9488,
  red: 0x8f2f2f,
  blue: 0x4f789f,
  violet: 0x65458f,
  green: 0x5c8b66,
};

export class RaceSelectScene extends Phaser.Scene {
  private selectedRace?: RaceData;
  private bottomActionObjects: Phaser.GameObjects.GameObject[] = [];
  private modalObjects: Phaser.GameObjects.GameObject[] = [];

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
    this.selectedRace = this.getInitialRace();
    this.layout = this.getLayout();

    createSceneBackground(this);
    this.createCatacombBackground(this.layout);
    this.createFixedHeader(this.layout);
    this.createScrollableContent(this.layout);
    this.createBottomAction(this.layout);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown');
      this.input.off('pointermove');
      this.input.off('pointerup');
      this.input.off('pointerupoutside');
      this.input.off('wheel');
    });
  }

  update() {
    if (!this.contentContainer || this.isDraggingContent) {
      return;
    }

    if (Math.abs(this.currentScrollY - this.targetScrollY) < 0.45) {
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

  private getInitialRace() {
    if (player.raceId) {
      return races.find(race => race.id === player.raceId) ?? races[0];
    }

    return races[0];
  }

  private getLayout(): RaceLayout {
    const { width, height } = this.scale;

    const compact = height < 1120;
    const veryCompact = height < 920;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.023), 18, 34);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.02), 18, 28);

    const contentWidth = Math.min(width - safeX * 2, 640);
    const headerHeight = veryCompact ? 118 : compact ? 130 : 142;
    const bottomBarHeight = veryCompact ? 102 : 112;

    const headerTop = safeTop;
    const contentTop = headerTop + headerHeight + 10;
    const contentBottom = height - bottomBarHeight - safeBottom;

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      headerTop,
      headerHeight,

      contentTop,
      contentBottom,
      contentWidth,
      viewportHeight: Math.max(300, contentBottom - contentTop),

      bottomBarHeight,
      bottomButtonY: height - safeBottom - bottomBarHeight / 2,

      compact,
      veryCompact,
    };
  }

  private createCatacombBackground(layout: RaceLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, RACE_SCENE.black, 0.94).setDepth(0);
    this.add.rectangle(centerX, height * 0.38, width, height * 0.78, RACE_SCENE.void, 0.64).setDepth(0);
    this.add.rectangle(centerX, height - 190, width, 380, 0x020202, 0.56).setDepth(0);

    const haloY = layout.safeTop + 118;
    this.add.circle(centerX, haloY, width * 0.55, RACE_SCENE.violet, 0.08).setDepth(0);
    this.add.circle(centerX, haloY + 12, width * 0.34, RACE_SCENE.bronze, 0.09).setDepth(0);
    this.add.circle(centerX, haloY + 18, width * 0.16, RACE_SCENE.gold, 0.045).setDepth(0);

    const archWidth = Math.min(layout.contentWidth * 0.84, 520);
    const archY = layout.safeTop + 158;

    this.add.rectangle(centerX, archY + 22, archWidth, 170, 0x070708, 0.32)
      .setStrokeStyle(2, RACE_SCENE.bronze, 0.22)
      .setDepth(1);

    this.add.ellipse(centerX, archY - 42, archWidth * 0.72, 112, 0x111018, 0.32)
      .setStrokeStyle(2, RACE_SCENE.bronze, 0.24)
      .setDepth(1);

    for (let i = 0; i < 38; i += 1) {
      const x = layout.safeX + 10 + (i * 53) % Math.max(1, width - layout.safeX * 2 - 20);
      const y = layout.safeTop + 72 + (i * 89) % Math.max(1, height - layout.safeTop - layout.safeBottom - 160);
      const color = i % 5 === 0 ? RACE_SCENE.gold : i % 3 === 0 ? RACE_SCENE.violet : RACE_SCENE.ash;
      const alpha = 0.022 + (i % 4) * 0.006;

      this.add.circle(x, y, 1 + (i % 3), color, alpha).setDepth(1);
    }

    for (let i = 0; i < 8; i += 1) {
      const y = height - 330 + i * 48;
      this.add.line(
        0,
        0,
        layout.safeX + 8,
        y,
        width - layout.safeX - 8,
        y + (i % 2) * 10,
        0x211a14,
        0.2
      )
        .setOrigin(0, 0)
        .setDepth(1);
    }
  }

  private createFixedHeader(layout: RaceLayout) {
    const panelY = layout.headerTop + layout.headerHeight / 2;

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: layout.headerHeight,
      radius: 30,
      color: RACE_SCENE.panel,
      alpha: 0.94,
      strokeColor: RACE_SCENE.bronze,
      strokeAlpha: 0.58,
      strokeWidth: 2,
      glowColor: RACE_SCENE.violet,
      depth: 180,
    });

    this.add.text(layout.centerX, layout.headerTop + (layout.veryCompact ? 26 : 30), 'Создание героя', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '27px' : layout.compact ? '31px' : '35px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 42,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(190);

    this.add.text(layout.centerX, layout.headerTop + (layout.veryCompact ? 62 : 72), 'Выбери кровь, с которой герой спустится под пепел', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '12px' : '14px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 60,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 3,
    }).setOrigin(0.5).setDepth(190);

    if (this.selectedRace) {
      const raceColor = this.getRaceColor(this.selectedRace.id);
      const chipY = layout.headerTop + layout.headerHeight - (layout.veryCompact ? 24 : 28);

      this.createMiniSelectedChip({
        x: layout.centerX,
        y: chipY,
        width: Math.min(layout.contentWidth - 58, 430),
        height: layout.veryCompact ? 32 : 36,
        race: this.selectedRace,
        raceColor,
        depth: 190,
      });
    }
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

    let cursorY = layout.contentTop + 16;

    cursorY = this.createIntroPanel(layout, cursorY);
    cursorY = this.createRaceListPanel(layout, cursorY + 14);
    cursorY = this.createAdvicePanel(layout, cursorY + 14);

    const contentHeight = cursorY - layout.contentTop + 26;

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
      if (this.maxScrollY <= 0 || this.modalObjects.length > 0) {
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
      if (!this.isDraggingContent || this.modalObjects.length > 0) {
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
        if (this.maxScrollY <= 0 || this.modalObjects.length > 0) {
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

    const bg = this.add.rectangle(layout.centerX, hintY, 238, 28, 0x000000, 0.44)
      .setDepth(230);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай список происхождений', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#928a7d',
      align: 'center',
      wordWrap: {
        width: 224,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(231);

    this.tweens.add({
      targets: [bg, text],
      alpha: 0.24,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private createIntroPanel(layout: RaceLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = layout.veryCompact ? 116 : 132;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: RACE_SCENE.graphite,
      alpha: 0.94,
      strokeColor: RACE_SCENE.bronze,
      strokeAlpha: 0.48,
      glowColor: RACE_SCENE.violet,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 34, 'Раса задаёт стиль выживания', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '20px' : '23px',
        color: '#d8c088',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 58,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(
        layout.centerX,
        topY + (layout.veryCompact ? 76 : 86),
        'Смотри на характеристики, пассивку и активный навык. Одни расы прощают ошибки, другие дают силу только на грани смерти.',
        {
          fontFamily: UI.font.body,
          fontSize: layout.veryCompact ? '12px' : '14px',
          color: '#b9ad9b',
          align: 'center',
          wordWrap: {
            width: layout.contentWidth - 64,
            useAdvancedWrap: true,
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

    const collapsedCardHeight = layout.veryCompact ? 126 : 138;
    // Раскрытая карточка должна вмещать полное описание, преимущества, статы и навыки.
    // Поэтому делаем её заметно выше, чтобы блоки не налезали друг на друга.
    const expandedCardHeight = layout.veryCompact ? 720 : 800;
    const cardGap = 16;
    const headerHeight = layout.veryCompact ? 66 : 74;
    const bottomPadding = 24;

    const cardsHeight = races.reduce((sum, race) => {
      const selected = this.selectedRace?.id === race.id;
      return sum + (selected ? expandedCardHeight : collapsedCardHeight);
    }, 0);

    const panelHeight =
      headerHeight +
      cardsHeight +
      Math.max(0, races.length - 1) * cardGap +
      bottomPadding;

    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 32,
      color: RACE_SCENE.panel,
      alpha: 0.96,
      strokeColor: RACE_SCENE.bronze,
      strokeAlpha: 0.5,
      glowColor: RACE_SCENE.bronze,
      depth: 2,
    });

    const left = layout.centerX - layout.contentWidth / 2;
    const right = layout.centerX + layout.contentWidth / 2;

    this.addTo(
      container,
      this.add.text(left + 28, topY + 34, 'Доступные происхождения', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '20px' : '23px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: layout.contentWidth - 152,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(right - 28, topY + 34, `${races.length} рас`, {
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

    let cardTop = topY + headerHeight;

    races.forEach((race) => {
      const selected = this.selectedRace?.id === race.id;
      const cardHeight = selected ? expandedCardHeight : collapsedCardHeight;
      const y = cardTop + cardHeight / 2;

      this.createRaceCard(container, layout, race, y, cardHeight);

      cardTop += cardHeight + cardGap;
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
    const cardWidth = layout.contentWidth - 36;
    const cardX = layout.centerX;
    const left = cardX - cardWidth / 2;
    const right = cardX + cardWidth / 2;
    const top = y - cardHeight / 2;
    const raceColor = this.getRaceColor(race.id);
    const raceIcon = this.getRaceIcon(race.id);

    this.createRoundedPanel({
      parent: container,
      x: cardX,
      y,
      width: cardWidth,
      height: cardHeight,
      radius: selected ? 30 : 26,
      color: selected ? 0x21150f : RACE_SCENE.stone,
      alpha: selected ? 0.98 : 0.94,
      strokeColor: selected ? UI.colors.gold : raceColor,
      strokeAlpha: selected ? 0.92 : 0.46,
      strokeWidth: selected ? 3 : 1,
      glowColor: raceColor,
      depth: 5,
    });

    const marker = this.add.graphics();
    marker.fillStyle(raceColor, selected ? 0.96 : 0.58);
    marker.fillRoundedRect(left + 8, top + 12, 8, cardHeight - 24, 5);
    marker.setDepth(9);
    container.add(marker);

    const iconX = left + 52;
    const textX = left + 92;
    const buttonWidth = selected ? (layout.veryCompact ? 112 : 126) : (layout.veryCompact ? 104 : 116);
    const buttonX = right - buttonWidth / 2 - 18;
    const textWidth = Math.max(160, buttonX - buttonWidth / 2 - textX - 12);

    this.addTo(
      container,
      this.add.circle(iconX, top + 52, selected ? 33 : 30, raceColor, selected ? 0.22 : 0.14)
        .setStrokeStyle(2, raceColor, selected ? 0.82 : 0.56)
        .setDepth(10)
    );

    this.addTo(
      container,
      this.add.text(iconX, top + 52, raceIcon, {
        fontFamily: UI.font.body,
        fontSize: selected ? (layout.veryCompact ? '23px' : '26px') : (layout.veryCompact ? '21px' : '24px'),
        color: '#f1eadc',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(11)
    );

    this.addTo(
      container,
      this.add.text(textX, top + 31, race.name, {
        fontFamily: UI.font.title,
        fontSize: selected ? (layout.veryCompact ? '19px' : '22px') : (layout.veryCompact ? '17px' : '20px'),
        color: selected ? UI.colors.goldText : '#ded4bd',
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: selected ? 2 : 1,
        lineSpacing: -1,
      }).setOrigin(0, 0.5).setDepth(11)
    );

    this.addTo(
      container,
      this.add.text(textX, top + (selected ? 67 : 58), selected
        ? `${this.getRaceRole(race.id)}  •  ${this.getRaceDifficulty(race.id)}`
        : this.getRaceRole(race.id), {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '11px' : '12px',
        color: this.getRaceColorText(race.id),
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: selected ? 2 : 1,
        lineSpacing: 2,
      }).setOrigin(0, 0.5).setDepth(11)
    );

    this.createUiButton({
      parent: container,
      x: buttonX,
      y: top + (selected ? 68 : 96),
      width: buttonWidth,
      height: layout.veryCompact ? 40 : 44,
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
      depth: 22,
    });

    if (selected) {
      this.createExpandedRaceCardDetails(container, layout, race, {
        cardX,
        cardWidth,
        top,
        raceColor,
      });
    } else {
      this.addTo(
        container,
        this.add.text(textX, top + 84, race.description, {
          fontFamily: UI.font.body,
          fontSize: layout.veryCompact ? '11px' : '12px',
          color: '#9b9488',
          lineSpacing: 3,
          wordWrap: {
            width: textWidth,
            useAdvancedWrap: true,
          },
          maxLines: 2,
        }).setOrigin(0, 0.5).setDepth(11)
      );

      this.addTo(
        container,
        this.add.text(textX, top + 124, this.createShortStatsText(race), {
          fontFamily: UI.font.body,
          fontSize: layout.veryCompact ? '10px' : '11px',
          color: '#d8c7a3',
          wordWrap: {
            width: textWidth,
            useAdvancedWrap: true,
          },
          maxLines: 2,
          lineSpacing: 3,
        }).setOrigin(0, 0.5).setDepth(11)
      );
    }

    const zone = this.add.zone(cardX, y, cardWidth, cardHeight)
      .setDepth(15)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerup', () => {
      if (this.didDragContent) {
        return;
      }

      this.selectRacePreview(race);
    });

    container.add(zone);
  }

  private createExpandedRaceCardDetails(
    container: Phaser.GameObjects.Container,
    layout: RaceLayout,
    race: RaceData,
    config: {
      cardX: number;
      cardWidth: number;
      top: number;
      raceColor: number;
    }
  ) {
    const innerWidth = config.cardWidth - 42;
    const innerLeft = config.cardX - innerWidth / 2;
    const descriptionTop = config.top + (layout.veryCompact ? 110 : 120);
    const descriptionHeight = layout.veryCompact ? 92 : 112;
    const advantagesTop = descriptionTop + descriptionHeight + 14;
    const advantagesHeight = layout.veryCompact ? 100 : 122;

    this.createRoundedPanel({
      parent: container,
      x: config.cardX,
      y: descriptionTop + descriptionHeight / 2,
      width: innerWidth,
      height: descriptionHeight,
      radius: 20,
      color: RACE_SCENE.panelWarm,
      alpha: 0.92,
      strokeColor: config.raceColor,
      strokeAlpha: 0.28,
      strokeWidth: 1,
      glowColor: config.raceColor,
      depth: 8,
    });

    this.addTo(
      container,
      this.add.text(innerLeft + 18, descriptionTop + 16, 'Описание расы', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '13px' : '15px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 2,
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(12)
    );

    this.addTo(
      container,
      this.add.text(innerLeft + 18, descriptionTop + (layout.veryCompact ? 38 : 42), race.description, {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '12px' : '13px',
        color: '#d8c7a3',
        lineSpacing: 4,
        wordWrap: {
          width: innerWidth - 36,
          useAdvancedWrap: true,
        },
        maxLines: layout.veryCompact ? 4 : 5,
      }).setOrigin(0, 0).setDepth(12)
    );

    this.createRoundedPanel({
      parent: container,
      x: config.cardX,
      y: advantagesTop + advantagesHeight / 2,
      width: innerWidth,
      height: advantagesHeight,
      radius: 20,
      color: 0x10141a,
      alpha: 0.9,
      strokeColor: RACE_SCENE.blue,
      strokeAlpha: 0.3,
      strokeWidth: 1,
      glowColor: RACE_SCENE.violet,
      depth: 8,
    });

    this.addTo(
      container,
      this.add.text(innerLeft + 18, advantagesTop + 16, 'Преимущества', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '13px' : '15px',
        color: '#d8c088',
        stroke: '#000000',
        strokeThickness: 2,
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(12)
    );

    this.getRaceAdvantages(race.id).forEach((line, index) => {
      this.addTo(
        container,
        this.add.text(innerLeft + 20, advantagesTop + 38 + index * (layout.veryCompact ? 24 : 26), `• ${line}`, {
          fontFamily: UI.font.body,
          fontSize: layout.veryCompact ? '11px' : '12px',
          color: '#b8aa91',
          lineSpacing: 2,
          wordWrap: {
            width: innerWidth - 40,
            useAdvancedWrap: true,
          },
          maxLines: 2,
        }).setOrigin(0, 0.5).setDepth(12)
      );
    });

    this.createStatsGrid(
      container,
      layout,
      race,
      config.top + (layout.veryCompact ? 390 : 456)
    );

    this.createSkillBox({
      parent: container,
      x: config.cardX,
      y: config.top + (layout.veryCompact ? 524 : 590),
      width: innerWidth,
      height: layout.veryCompact ? 112 : 120,
      icon: '◇',
      title: `Пассивка: ${race.passiveName}`,
      description: race.passiveDescription,
      color: 0x75d184,
      compact: layout.veryCompact,
    });

    this.createSkillBox({
      parent: container,
      x: config.cardX,
      y: config.top + (layout.veryCompact ? 646 : 722),
      width: innerWidth,
      height: layout.veryCompact ? 118 : 130,
      icon: '✦',
      title: `Активка: ${race.activeName}`,
      description: race.activeDescription,
      color: 0x70a6ff,
      compact: layout.veryCompact,
    });
  }

  private selectRacePreview(race: RaceData) {
    this.selectedRace = race;
    this.targetScrollY = 0;
    this.currentScrollY = 0;

    this.children.removeAll();

    createSceneBackground(this);
    this.createCatacombBackground(this.layout);
    this.createFixedHeader(this.layout);
    this.createScrollableContent(this.layout);
    this.createBottomAction(this.layout);
  }

  private createStatsGrid(
    container: Phaser.GameObjects.Container,
    layout: RaceLayout,
    race: RaceData,
    centerY: number
  ) {
    const gridWidth = layout.contentWidth - 42;
    const chipGap = layout.veryCompact ? 8 : 10;
    const chipWidth = (gridWidth - chipGap * 2) / 3;
    const chipHeight = layout.veryCompact ? 52 : 58;
    const startX = layout.centerX - gridWidth / 2 + chipWidth / 2;

    const stats = [
      { label: 'HP', value: `${race.hp * 10}`, icon: '♥', color: 0xff6b6b },
      { label: 'Сила', value: `${race.strength}`, icon: '⚔', color: 0xf0d58a },
      { label: 'Защита', value: `${race.defense}`, icon: '▣', color: 0x9ca3af },
      { label: 'Ловк.', value: `${race.agility}`, icon: '↯', color: 0x70a6ff },
      { label: 'Интел.', value: `${race.intelligence}`, icon: '✧', color: 0xc084fc },
      { label: 'Удача', value: `${race.luck}`, icon: '✦', color: 0x75d184 },
    ];

    stats.forEach((stat, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = startX + col * (chipWidth + chipGap);
      const y = centerY - (layout.veryCompact ? 30 : 34) + row * (chipHeight + 10);

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
        compact: layout.veryCompact,
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
    compact: boolean;
  }) {
    this.createRoundedPanel({
      parent: config.parent,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 17,
      color: RACE_SCENE.panelWarm,
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
        fontSize: config.compact ? '12px' : '14px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(11)
    );

    this.addTo(
      config.parent,
      this.add.text(left + 34, config.y - 10, config.label, {
        fontFamily: UI.font.body,
        fontSize: config.compact ? '10px' : '11px',
        color: '#928a7d',
        wordWrap: {
          width: config.width - 40,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(11)
    );

    this.addTo(
      config.parent,
      this.add.text(left + 34, config.y + 11, config.value, {
        fontFamily: UI.font.title,
        fontSize: config.compact ? '14px' : '16px',
        color: '#ded4bd',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: config.width - 40,
          useAdvancedWrap: true,
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
    compact: boolean;
  }) {
    this.createRoundedPanel({
      parent: config.parent,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 24,
      color: RACE_SCENE.panelWarm,
      alpha: 0.96,
      strokeColor: config.color,
      strokeAlpha: 0.54,
      strokeWidth: 2,
      glowColor: config.color,
      depth: 8,
    });

    const left = config.x - config.width / 2;
    const top = config.y - config.height / 2;
    const textX = left + 76;
    const textWidth = config.width - 104;

    this.addTo(
      config.parent,
      this.add.circle(left + 39, top + 40, 25, config.color, 0.18)
        .setStrokeStyle(2, config.color, 0.68)
        .setDepth(11)
    );

    this.addTo(
      config.parent,
      this.add.text(left + 39, top + 40, config.icon, {
        fontFamily: UI.font.body,
        fontSize: config.compact ? '18px' : '20px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(12)
    );

    this.addTo(
      config.parent,
      this.add.text(textX, top + 24, config.title, {
        fontFamily: UI.font.title,
        fontSize: config.compact ? '14px' : '16px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: 2,
        lineSpacing: 2,
      }).setOrigin(0, 0).setDepth(12)
    );

    this.addTo(
      config.parent,
      this.add.text(textX, top + (config.compact ? 64 : 68), config.description, {
        fontFamily: UI.font.body,
        fontSize: config.compact ? '12px' : '13px',
        color: '#d8c7a3',
        lineSpacing: 4,
        wordWrap: {
          width: textWidth,
          useAdvancedWrap: true,
        },
        maxLines: config.compact ? 4 : 5,
      }).setOrigin(0, 0).setDepth(12)
    );
  }

  private createAdvicePanel(layout: RaceLayout, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = layout.veryCompact ? 118 : 132;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: RACE_SCENE.panel,
      alpha: 0.93,
      strokeColor: RACE_SCENE.bronze,
      strokeAlpha: 0.4,
      glowColor: RACE_SCENE.bronze,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 34, 'Подсказка перед первым спуском', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '19px' : '22px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 60,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(
        layout.centerX,
        topY + (layout.veryCompact ? 78 : 86),
        'Для спокойного старта подойдут Человек и Камнерожденный. Для риска и высокого урона — Демон или Полукровка Скверны. Для добычи — Гоблин.',
        {
          fontFamily: UI.font.body,
          fontSize: layout.veryCompact ? '12px' : '14px',
          color: '#9b9488',
          align: 'center',
          wordWrap: {
            width: layout.contentWidth - 64,
            useAdvancedWrap: true,
          },
          maxLines: 3,
          lineSpacing: 4,
        }
      ).setOrigin(0.5).setDepth(8)
    );

    return topY + panelHeight;
  }

  private createBottomAction(layout: RaceLayout) {
    this.bottomActionObjects.forEach(object => object.destroy());
    this.bottomActionObjects = [];

    const barY = layout.height - layout.safeBottom - layout.bottomBarHeight / 2;

    const shadow = this.add.rectangle(
      layout.centerX,
      barY,
      layout.width,
      layout.bottomBarHeight + layout.safeBottom * 2,
      0x020202,
      0.78
    ).setDepth(232);

    const divider = this.add.rectangle(
      layout.centerX,
      barY - layout.bottomBarHeight / 2 + 6,
      layout.contentWidth,
      1,
      RACE_SCENE.bronze,
      0.28
    ).setDepth(233);

    const button = this.createUiButton({
      x: layout.centerX,
      y: layout.bottomButtonY,
      width: Math.min(layout.contentWidth, 540),
      height: layout.veryCompact ? 54 : 58,
      text: this.selectedRace ? `Начать путь: ${this.selectedRace.name}` : 'Выбери расу',
      accentColor: UI.colors.gold,
      disabled: !this.selectedRace,
      variant: 'gold',
      onClick: () => {
        this.showRaceConfirm();
      },
      depth: 240,
    });

    this.bottomActionObjects = [shadow, divider, ...button.objects];
  }

  private showRaceConfirm() {
    if (!this.selectedRace) {
      return;
    }

    const race = this.selectedRace;
    const raceColor = this.getRaceColor(race.id);
    const { width, height } = this.scale;
    const modalWidth = Math.min(width - 48, 610);
    const modalHeight = Math.min(height - 150, 430);
    const centerX = width / 2;
    const centerY = height / 2;

    this.clearModalObjects();

    const modal = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.76)
      .setInteractive();

    modal.add(overlay);

    const panel = this.createRoundedPanel({
      parent: modal,
      x: centerX,
      y: centerY,
      width: modalWidth,
      height: modalHeight,
      radius: 32,
      color: RACE_SCENE.panelWarm,
      alpha: 0.99,
      strokeColor: raceColor,
      strokeAlpha: 0.82,
      strokeWidth: 3,
      glowColor: raceColor,
      depth: 1001,
    });

    const title = this.add.text(centerX, centerY - modalHeight / 2 + 48, 'Подтвердить происхождение', {
      fontFamily: UI.font.title,
      fontSize: this.layout.veryCompact ? '24px' : '28px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: modalWidth - 72,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(1005);

    const icon = this.add.circle(centerX, centerY - modalHeight / 2 + 118, 40, raceColor, 0.18)
      .setStrokeStyle(2, raceColor, 0.82)
      .setDepth(1005);

    const iconText = this.add.text(centerX, centerY - modalHeight / 2 + 118, this.getRaceIcon(race.id), {
      fontFamily: UI.font.body,
      fontSize: '31px',
      color: '#f1eadc',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1006);

    const body = this.add.text(
      centerX,
      centerY - modalHeight / 2 + 190,
      `${race.name}\n${this.getRaceRole(race.id)}\n\nПосле выбора герой получит стартовые характеристики этой расы и начнёт путь в лагере.`,
      {
        fontFamily: UI.font.body,
        fontSize: this.layout.veryCompact ? '15px' : '17px',
        color: UI.colors.text,
        align: 'center',
        lineSpacing: 6,
        wordWrap: {
          width: modalWidth - 82,
          useAdvancedWrap: true,
        },
        maxLines: 7,
      }
    ).setOrigin(0.5).setDepth(1005);

    const cancel = this.createUiButton({
      parent: modal,
      x: centerX,
      y: centerY + modalHeight / 2 - 104,
      width: Math.min(modalWidth - 90, 390),
      height: 54,
      text: 'Вернуться к выбору',
      accentColor: UI.colors.goldDark,
      variant: 'dark',
      onClick: () => {
        this.clearModalObjects();
      },
      depth: 1006,
    });

    const confirm = this.createUiButton({
      parent: modal,
      x: centerX,
      y: centerY + modalHeight / 2 - 42,
      width: Math.min(modalWidth - 90, 390),
      height: 56,
      text: 'Начать путь',
      accentColor: raceColor,
      variant: 'gold',
      onClick: () => {
        this.clearModalObjects();
        this.selectRace(race);
      },
      depth: 1006,
    });

    this.modalObjects = [
      modal,
      overlay,
      panel.shadow,
      panel.panel,
      panel.glow,
      title,
      icon,
      iconText,
      body,
      ...cancel.objects,
      ...confirm.objects,
    ];
  }

  private clearModalObjects() {
    this.modalObjects.forEach(object => object.destroy());
    this.modalObjects = [];
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

  private createMiniSelectedChip(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    race: RaceData;
    raceColor: number;
    depth: number;
  }) {
    const radius = config.height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x17100c, 0.92);
    bg.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );
    bg.lineStyle(1, config.raceColor, 0.48);
    bg.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );
    bg.setDepth(config.depth);

    this.add.text(config.x, config.y, `${this.getRaceIcon(config.race.id)}  Выбрано: ${config.race.name}`, {
      fontFamily: UI.font.body,
      fontSize: this.layout.veryCompact ? '12px' : '14px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: config.width - 28,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(config.depth + 1);
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
    if (id === 'demon') return '♦';

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

  private getRaceDifficulty(id: RaceId | string) {
    if (id === 'human') return 'сложность: лёгкая';
    if (id === 'stoneborn') return 'сложность: лёгкая';
    if (id === 'goblin') return 'сложность: средняя';
    if (id === 'night_elf') return 'сложность: средняя';
    if (id === 'tainted_halfblood') return 'сложность: высокая';
    if (id === 'demon') return 'сложность: высокая';

    return 'сложность: средняя';
  }

  private getRaceAdvantages(id: RaceId | string) {
    if (id === 'human') {
      return [
        'Ровный старт без слабых сторон.',
        'Хорош для первого прохождения и обучения.',
        'Становится сильнее на низком HP.',
      ];
    }

    if (id === 'tainted_halfblood') {
      return [
        'Высокий урон на грани смерти.',
        'Подходит для агрессивной игры через крит.',
        'Активный навык быстро добивает опасных врагов.',
      ];
    }

    if (id === 'stoneborn') {
      return [
        'Лучшее выживание и защита на старте.',
        'Прощает ошибки в ловушках и тяжёлых боях.',
        'Хорош против боссов и длинных этажей.',
      ];
    }

    if (id === 'night_elf') {
      return [
        'Высокая ловкость и частые уклонения.',
        'Силен в темповой игре без лишнего урона.',
        'Активка спасает от опасного удара.',
      ];
    }

    if (id === 'goblin') {
      return [
        'Больше золота и добычи за счёт удачи.',
        'Быстрее развивает кузницу и экипировку.',
        'Хорош для фарма материалов и предметов.',
      ];
    }

    if (id === 'demon') {
      return [
        'Самый агрессивный стиль через силу.',
        'Урон растёт после полученных ударов.',
        'Силен, если быстро заканчивать бой.',
      ];
    }

    return [
      'Сбалансированный стиль боя.',
      'Подходит для прохождения катакомб.',
      'Имеет пассивный и активный навык.',
    ];
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
      fontSize: config.small ? '12px' : '16px',
      color: textColor,
      stroke: '#000000',
      strokeThickness: disabled ? 1 : 2,
      align: 'center',
      wordWrap: {
        width: config.width - 18,
        useAdvancedWrap: true,
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
    const color = config.color ?? RACE_SCENE.stone;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? UI.colors.goldDark;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const glowColor = config.glowColor ?? RACE_SCENE.bronze;
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
      config.y - safeHeight / 2 + 30,
      safeWidth * 0.24,
      glowColor,
      0.04
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
