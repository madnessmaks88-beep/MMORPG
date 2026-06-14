import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getRaceById } from '../data/races';
import { getRelicById } from '../data/relics';

import { getPlayerStats } from '../systems/InventorySystem';

import { createBottomNav } from '../ui/createBottomNav';



import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type ProfileLayout = {
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
  twoColumns: boolean;
};

export class ProfileScene extends Phaser.Scene {
  private contentContainer?: Phaser.GameObjects.Container;
  private scrollZone?: Phaser.GameObjects.Rectangle;

  private currentScrollY = 0;
  private maxScrollY = 0;

  private isDragging = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  constructor() {
    super('ProfileScene');
  }

  create() {
    createSceneBackground(this);

    const layout = this.getLayout();

    this.createProfileBackdrop(layout);
    this.createScrollableContent(layout);

    createBottomNav(this, {
      activeScene: 'ProfileScene',
    });
  }

  private getLayout(): ProfileLayout {
    const { width, height } = this.scale;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.025), 20, 34);
    const safeBottom = 116;

    const contentTop = safeTop + 96;
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
      viewportHeight: Math.max(300, contentBottom - contentTop),

      compact: height < 1120,
      twoColumns: contentWidth >= 540,
    };
  }

  private createProfileBackdrop(layout: ProfileLayout) {
    const { width, height, centerX } = layout;

    this.add.circle(centerX, layout.safeTop + 150, width * 0.45, 0x3c2417, 0.12).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 170, width * 0.27, 0x8a4a20, 0.065).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 185, width * 0.15, 0xf0a040, 0.035).setDepth(0);

    this.add.rectangle(centerX, height - 210, width, 380, 0x030202, 0.42).setDepth(0);

    for (let i = 0; i < 18; i += 1) {
      const x = layout.safeX + 20 + i * ((width - layout.safeX * 2 - 40) / 17);
      const y = layout.safeTop + 105 + (i % 6) * 78;

      this.add.circle(x, y, 2, 0xf0d58a, 0.055).setDepth(1);
    }

    this.add.text(centerX, layout.safeTop + 168, '☥', {
      fontFamily: UI.font.body,
      fontSize: '92px',
      color: '#ffffff',
    })
      .setOrigin(0.5)
      .setAlpha(0.025)
      .setDepth(1);
  }

  private createScrollableContent(layout: ProfileLayout) {
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

    cursorY = this.createHeroPanel(layout, cursorY);
    cursorY = this.createStatsPanel(layout, cursorY + 16);
    cursorY = this.createProgressPanel(layout, cursorY + 16);
    cursorY = this.createRelicsPanel(layout, cursorY + 16);

    const contentHeight = cursorY - layout.contentTop + 28;

    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = 0;

    this.createScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }
  }

  private createHeroAvatar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    size: number,
    depth = 20,
    accentColor = UI.colors.goldDark
  ) {
    const race = player.raceId ? getRaceById(player.raceId) : undefined;

    const savedName = player.name?.trim() ?? '';
    const initial =
      savedName.length > 0 && savedName !== 'Безымянный'
        ? savedName[0].toUpperCase()
        : '?';

    const avatarSymbol = race
      ? this.getRaceIcon(race.id)
      : initial;

    const avatarColor = race
      ? this.getRaceColor(race.id)
      : accentColor;

    this.addTo(
      container,
      this.add.circle(x, y + 6, size / 2 + 8, 0x000000, 0.36)
        .setDepth(depth)
    );

    this.addTo(
      container,
      this.add.circle(x, y, size / 2 + 7, avatarColor, 0.92)
        .setDepth(depth + 1)
    );

    this.addTo(
      container,
      this.add.circle(x, y, size / 2 + 2, 0x17100c, 1)
        .setDepth(depth + 2)
    );

    this.addTo(
      container,
      this.add.circle(x - size * 0.15, y - size * 0.17, size * 0.18, 0xffffff, 0.08)
        .setDepth(depth + 3)
    );

    this.addTo(
      container,
      this.add.text(x, y - 1, avatarSymbol, {
        fontFamily: UI.font.title,
        fontSize: `${Math.floor(size * 0.42)}px`,
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: size - 16,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(depth + 4)
    );

    if (race) {
      this.addTo(
        container,
        this.add.text(x, y + size * 0.31, initial, {
          fontFamily: UI.font.body,
          fontSize: `${Math.floor(size * 0.14)}px`,
          color: UI.colors.textMuted,
          stroke: '#000000',
          strokeThickness: 2,
          align: 'center',
          wordWrap: {
            width: size - 22,
          },
          maxLines: 1,
        }).setOrigin(0.5).setDepth(depth + 5)
      );
    }
  }

  private createScrollInput(layout: ProfileLayout) {
    this.scrollZone?.destroy();

    this.scrollZone = this.add.rectangle(
      layout.centerX,
      layout.contentTop + layout.viewportHeight / 2,
      layout.width,
      layout.viewportHeight,
      0x000000,
      0.001
    )
      .setDepth(220)
      .setInteractive({ useHandCursor: false });

    this.scrollZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.currentScrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) {
        return;
      }

      const deltaY = pointer.y - this.dragStartY;
      this.setScrollY(this.dragStartScrollY - deltaY);
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _objects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        if (pointer.y < layout.contentTop || pointer.y > layout.contentBottom) {
          return;
        }

        this.setScrollY(this.currentScrollY + deltaY * 0.55);
      }
    );
  }

  private setScrollY(value: number) {
    this.currentScrollY = Phaser.Math.Clamp(value, 0, this.maxScrollY);

    if (this.contentContainer) {
      this.contentContainer.y = -this.currentScrollY;
    }
  }

  private createScrollHint(layout: ProfileLayout) {
    const hintY = layout.contentBottom - 18;

    const bg = this.add.rectangle(layout.centerX, hintY, 230, 28, 0x000000, 0.34)
      .setDepth(230);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай профиль', {
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

  private createHeroPanel(layout: ProfileLayout, topY: number) {
    const container = this.requireContentContainer();

    const race = player.raceId ? getRaceById(player.raceId) : undefined;
    const raceColor = race ? this.getRaceColor(race.id) : UI.colors.goldDark;
    const raceRole = race ? this.getRaceRole(race.id) : 'Раса не выбрана';

    const panelHeight = race
      ? layout.twoColumns
        ? 440
        : 620
      : 270;

    const panelY = topY + panelHeight / 2;
    const left = layout.centerX - layout.contentWidth / 2;
    const innerLeft = left + 28;
    const innerRight = left + layout.contentWidth - 28;

    this.createRoundedPanel(container, {
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 34,
      color: 0x100c09,
      alpha: 0.97,
      strokeColor: raceColor,
      strokeAlpha: 0.68,
      strokeWidth: 2,
      depth: 2,
    });

    const avatarX = innerLeft + 54;
    const avatarY = topY + 84;

    this.createHeroAvatar(container, avatarX, avatarY, 92, 5, raceColor);

    const textX = innerLeft + 122;
    const titleMaxWidth = Math.max(150, innerRight - textX - 78);
    const displayName = this.getHeroDisplayName();

    this.addTo(
      container,
      this.add.text(textX, topY + 44, displayName, {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '26px' : '30px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 5,
        wordWrap: {
          width: titleMaxWidth,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(innerRight, topY + 45, `Ур. ${player.level}`, {
        fontFamily: UI.font.title,
        fontSize: '19px',
        color: UI.colors.green,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(1, 0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(textX, topY + 80, race ? `Раса: ${race.name}` : 'Раса не выбрана', {
        fontFamily: UI.font.title,
        fontSize: '19px',
        color: race ? UI.colors.text : UI.colors.textMuted,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: titleMaxWidth,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(textX, topY + 110, raceRole, {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: race ? this.getRaceColorText(race.id) : UI.colors.textMuted,
        wordWrap: {
          width: titleMaxWidth,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(innerRight, topY + 110, `${player.gold} золота`, {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: UI.colors.goldText,
        align: 'right',
        wordWrap: {
          width: 120,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(6)
    );

    this.createExpBar(container, layout.centerX, topY + 162, layout.contentWidth - 70);

    if (!race) {
      this.addTo(
        container,
        this.add.text(layout.centerX, topY + 224, 'Выбери расу, чтобы открыть расовые навыки героя.', {
          fontFamily: UI.font.body,
          fontSize: '17px',
          color: UI.colors.textMuted,
          align: 'center',
          wordWrap: {
            width: layout.contentWidth - 70,
          },
          lineSpacing: 5,
        }).setOrigin(0.5).setDepth(6)
      );

      return topY + panelHeight;
    }

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 216, 'Расовые навыки', {
        fontFamily: UI.font.title,
        fontSize: '22px',
        color: UI.colors.text,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 70,
        },
      }).setOrigin(0.5).setDepth(6)
    );

    if (layout.twoColumns) {
      const cardWidth = (layout.contentWidth - 74) / 2;
      const cardHeight = 188;
      const cardY = topY + 332;

      this.createAbilityCard(container, {
        x: layout.centerX - cardWidth / 2 - 10,
        y: cardY,
        width: cardWidth,
        height: cardHeight,
        title: race.passiveName,
        label: 'Пассивный навык',
        description: race.passiveDescription,
        icon: '◇',
      });

      this.createAbilityCard(container, {
        x: layout.centerX + cardWidth / 2 + 10,
        y: cardY,
        width: cardWidth,
        height: cardHeight,
        title: race.activeName,
        label: 'Активный навык',
        description: race.activeDescription,
        icon: '✦',
      });
    } else {
      const cardWidth = layout.contentWidth - 56;

      this.createAbilityCard(container, {
        x: layout.centerX,
        y: topY + 318,
        width: cardWidth,
        height: 164,
        title: race.passiveName,
        label: 'Пассивный навык',
        description: race.passiveDescription,
        icon: '◇',
      });

      this.createAbilityCard(container, {
        x: layout.centerX,
        y: topY + 490,
        width: cardWidth,
        height: 164,
        title: race.activeName,
        label: 'Активный навык',
        description: race.activeDescription,
        icon: '✦',
      });
    }

    return topY + panelHeight;
  }

  private createStatsPanel(layout: ProfileLayout, topY: number) {
    const container = this.requireContentContainer();
    const stats = getPlayerStats(player);

    const panelHeight = 348;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel(container, {
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: 0x0d0d0d,
      alpha: 0.94,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.55,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 33, 'Характеристики', {
        fontFamily: UI.font.title,
        fontSize: '28px',
        color: UI.colors.text,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 50,
        },
      }).setOrigin(0.5).setDepth(6)
    );

    const pillWidth = Math.min((layout.contentWidth - 68) / 2, 270);
    const leftX = layout.centerX - pillWidth / 2 - 10;
    const rightX = layout.centerX + pillWidth / 2 + 10;

    const startY = topY + 88;
    const rowGap = 52;

    this.createStatPill(container, leftX, startY, 'HP', `${player.hp}/${stats.maxHp}`, '♥', UI.colors.redHex, pillWidth);
    this.createStatPill(container, rightX, startY, 'Энергия', `${player.energy}/${stats.maxEnergy}`, '✦', UI.colors.blueHex, pillWidth);

    this.createStatPill(container, leftX, startY + rowGap, 'Атака', `${stats.attack}`, '⚔', UI.colors.gold, pillWidth);
    this.createStatPill(container, rightX, startY + rowGap, 'Защита', `${stats.defense}`, '🛡', UI.colors.goldDark, pillWidth);

    this.createStatPill(container, leftX, startY + rowGap * 2, 'Крит', `${Math.round(stats.critChance * 100)}%`, '◆', UI.colors.redHex, pillWidth);
    this.createStatPill(container, rightX, startY + rowGap * 2, 'Уклонение', `${Math.round(stats.dodgeChance * 100)}%`, '◇', UI.colors.greenHex, pillWidth);

    this.createStatPill(container, leftX, startY + rowGap * 3, 'Сила', `${stats.strength}`, '▲', UI.colors.gold, pillWidth);
    this.createStatPill(container, rightX, startY + rowGap * 3, 'Ловкость', `${stats.agility}`, '➤', UI.colors.greenHex, pillWidth);

    this.createStatPill(container, leftX, startY + rowGap * 4, 'Удача', `${stats.luck}`, '★', UI.colors.gold, pillWidth);
    this.createStatPill(container, rightX, startY + rowGap * 4, 'Интеллект', `${stats.intelligence}`, '✧', UI.colors.blueHex, pillWidth);

    return topY + panelHeight;
  }

  private createProgressPanel(layout: ProfileLayout, topY: number) {
    const container = this.requireContentContainer();

    const panelHeight = 176;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel(container, {
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: 0x17100c,
      alpha: 0.92,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.46,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 32, 'Прогресс спуска', {
        fontFamily: UI.font.title,
        fontSize: '27px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 50,
        },
      }).setOrigin(0.5).setDepth(6)
    );

    const cardWidth = Math.min((layout.contentWidth - 62) / 3, 175);
    const cardY = topY + 92;

    this.createProgressMiniCard(container, layout.centerX - cardWidth - 10, cardY, 'Рекорд', `${gameState.highestClearedFloor}`, '⌂', cardWidth);
    this.createProgressMiniCard(container, layout.centerX, cardY, 'Ярусы', `${gameState.highestClearedTier}`, '▲', cardWidth);
    this.createProgressMiniCard(container, layout.centerX + cardWidth + 10, cardY, 'След.', `${gameState.highestClearedTier + 1}`, '▼', cardWidth);

    const activeRunText = gameState.floorRun.active
      ? `Активный спуск: этаж ${gameState.floorRun.currentFloor}`
      : 'Активный спуск: нет';

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 148, activeRunText, {
        fontFamily: UI.font.body,
        fontSize: '15px',
        color: gameState.floorRun.active ? UI.colors.green : UI.colors.textMuted,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 50,
        },
      }).setOrigin(0.5).setDepth(6)
    );

    return topY + panelHeight;
  }

  private createRelicsPanel(layout: ProfileLayout, topY: number) {
    const container = this.requireContentContainer();

    const relics: {
      name: string;
      description: string;
    }[] = [];

    player.relicIds.forEach(id => {
      const relic = getRelicById(id);

      if (relic) {
        relics.push(relic);
      }
    });

    const visibleRelics = relics.slice(0, 4);

    const panelHeight = relics.length === 0
      ? 222
      : 92 + visibleRelics.length * 70 + (relics.length > 4 ? 42 : 20);

    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel(container, {
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: 0x0d0d0d,
      alpha: 0.94,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.55,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 34, 'Реликвии', {
        fontFamily: UI.font.title,
        fontSize: '28px',
        color: UI.colors.text,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 50,
        },
      }).setOrigin(0.5).setDepth(6)
    );

    if (relics.length === 0) {
      this.addTo(
        container,
        this.add.circle(layout.centerX, topY + 96, 36, 0x1a130f, 1)
          .setStrokeStyle(2, UI.colors.goldDark, 0.55)
          .setDepth(5)
      );

      this.addTo(
        container,
        this.add.text(layout.centerX, topY + 96, '★', {
          fontFamily: UI.font.body,
          fontSize: '29px',
          color: UI.colors.textMuted,
        }).setOrigin(0.5).setDepth(6)
      );

      this.addTo(
        container,
        this.add.text(
          layout.centerX,
          topY + 164,
          'Реликвий пока нет.\nПобеди финального босса яруса, чтобы получить первую.',
          {
            fontFamily: UI.font.body,
            fontSize: '17px',
            color: UI.colors.textMuted,
            align: 'center',
            lineSpacing: 6,
            wordWrap: {
              width: layout.contentWidth - 70,
            },
          }
        ).setOrigin(0.5).setDepth(6)
      );

      return topY + panelHeight;
    }

    visibleRelics.forEach((relic, index) => {
      this.createRelicCard(
        container,
        layout.centerX,
        topY + 88 + index * 70,
        relic.name,
        relic.description,
        layout.contentWidth - 70
      );
    });

    if (relics.length > 4) {
      this.addTo(
        container,
        this.add.text(layout.centerX, topY + panelHeight - 26, `И ещё реликвий: ${relics.length - 4}`, {
          fontFamily: UI.font.body,
          fontSize: '15px',
          color: UI.colors.textMuted,
          align: 'center',
          wordWrap: {
            width: layout.contentWidth - 70,
          },
        }).setOrigin(0.5).setDepth(6)
      );
    }

    return topY + panelHeight;
  }

  private createExpBar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number
  ) {
    const progress = Phaser.Math.Clamp(player.exp / player.expToNextLevel, 0, 1);

    this.addTo(
      container,
      this.add.text(x - width / 2, y - 17, 'Опыт', {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: UI.colors.textMuted,
      }).setOrigin(0, 0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(x + width / 2, y - 17, `${player.exp}/${player.expToNextLevel}`, {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: UI.colors.textMuted,
      }).setOrigin(1, 0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.rectangle(x, y + 10, width, 12, 0x050505, 0.9).setDepth(5)
    );

    this.addTo(
      container,
      this.add.rectangle(
        x - width / 2 + (width * progress) / 2,
        y + 10,
        Math.max(2, width * progress),
        12,
        UI.colors.greenHex,
        0.95
      ).setDepth(6)
    );

    this.addTo(
      container,
      this.add.rectangle(x, y + 10, width, 12)
        .setStrokeStyle(1, UI.colors.goldDark, 0.5)
        .setDepth(7)
    );
  }

  private createAbilityCard(
    container: Phaser.GameObjects.Container,
    config: {
      x: number;
      y: number;
      width: number;
      height: number;
      title: string;
      label: string;
      description: string;
      icon: string;
    }
  ) {
    this.createRoundedPanel(container, {
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 24,
      color: 0x17100c,
      alpha: 0.97,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.58,
      depth: 4,
    });

    const left = config.x - config.width / 2;
    const top = config.y - config.height / 2;

    this.addTo(
      container,
      this.add.circle(left + 33, top + 34, 19, 0x2a1d13, 1)
        .setStrokeStyle(1, UI.colors.goldDark, 0.7)
        .setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(left + 33, top + 34, config.icon, {
        fontFamily: UI.font.body,
        fontSize: '16px',
        color: UI.colors.goldText,
      }).setOrigin(0.5).setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 62, top + 20, config.label, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: config.width - 84,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(left + 62, top + 46, config.title, {
        fontFamily: UI.font.title,
        fontSize: '16px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: config.width - 84,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(left + 24, top + 82, config.description, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: UI.colors.text,
        wordWrap: {
          width: config.width - 48,
        },
        lineSpacing: 4,
        maxLines: 6,
      }).setOrigin(0, 0).setDepth(6)
    );
  }

  private createStatPill(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    value: string,
    icon: string,
    accentColor: number,
    width: number
  ) {
    this.createRoundedPanel(container, {
      x,
      y,
      width,
      height: 46,
      radius: 17,
      color: 0x17100c,
      alpha: 0.96,
      strokeColor: accentColor,
      strokeAlpha: 0.34,
      strokeWidth: 1,
      depth: 4,
    });

    const left = x - width / 2;

    this.addTo(
      container,
      this.add.circle(left + 28, y, 16, accentColor, 0.18)
        .setStrokeStyle(1, accentColor, 0.55)
        .setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(left + 28, y, icon, {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: UI.colors.text,
      }).setOrigin(0.5).setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 52, y - 9, label, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: width - 66,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 52, y + 10, value, {
        fontFamily: UI.font.title,
        fontSize: '16px',
        color: UI.colors.text,
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: width - 66,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(7)
    );
  }

  private createProgressMiniCard(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    value: string,
    icon: string,
    width: number
  ) {
    this.createRoundedPanel(container, {
      x,
      y,
      width,
      height: 58,
      radius: 18,
      color: 0x100c09,
      alpha: 0.93,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.45,
      strokeWidth: 1,
      depth: 4,
    });

    const left = x - width / 2;

    this.addTo(
      container,
      this.add.text(left + 28, y, icon, {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: UI.colors.goldText,
      }).setOrigin(0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(left + 50, y - 10, label, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: width - 56,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(left + 50, y + 12, value, {
        fontFamily: UI.font.title,
        fontSize: '18px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: width - 56,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(6)
    );
  }

  private createRelicCard(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    name: string,
    description: string,
    width: number
  ) {
    this.createRoundedPanel(container, {
      x,
      y,
      width,
      height: 60,
      radius: 18,
      color: 0x17100c,
      alpha: 0.96,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.45,
      strokeWidth: 1,
      depth: 4,
    });

    const left = x - width / 2;

    this.addTo(
      container,
      this.add.text(left + 28, y, '★', {
        fontFamily: UI.font.body,
        fontSize: '19px',
        color: UI.colors.goldText,
      }).setOrigin(0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(left + 56, y - 12, name, {
        fontFamily: UI.font.title,
        fontSize: '15px',
        color: UI.colors.goldText,
        wordWrap: {
          width: width - 80,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(left + 56, y + 13, description, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: UI.colors.textMuted,
        wordWrap: {
          width: width - 80,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5).setDepth(6)
    );
  }

  private createRoundedPanel(
    container: Phaser.GameObjects.Container,
    config: {
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
    }
  ) {
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

    container.add([shadow, panel]);

    return {
      shadow,
      panel,
    };
  }

  private requireContentContainer() {
    if (!this.contentContainer) {
      throw new Error('Profile content container was not created.');
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

  private getHeroDisplayName() {
    const savedName = player.name?.trim() ?? '';

    if (savedName.length > 0 && savedName !== 'Безымянный') {
      return savedName;
    }

    const race = player.raceId ? getRaceById(player.raceId) : undefined;

    if (race) {
      return race.name;
    }

    return 'Безымянный';
  }

  private getRaceIcon(id: string) {
    if (id === 'human') return '◆';
    if (id === 'tainted_halfblood') return '☾';
    if (id === 'stoneborn') return '▣';
    if (id === 'night_elf') return '◐';
    if (id === 'goblin') return '!';
    if (id === 'demon') return '◆';

    return '◆';
  }

  private getRaceRole(id: string) {
    if (id === 'human') return 'Универсал';
    if (id === 'tainted_halfblood') return 'Риск / крит / урон';
    if (id === 'stoneborn') return 'Танк / выживание';
    if (id === 'night_elf') return 'Уклонение / темп';
    if (id === 'goblin') return 'Лут / золото / хитрость';
    if (id === 'demon') return 'Урон / жертва HP';

    return 'Боец';
  }

  private getRaceColor(id: string) {
    if (id === 'human') return 0xf0d58a;
    if (id === 'tainted_halfblood') return 0xc084fc;
    if (id === 'stoneborn') return 0x9ca3af;
    if (id === 'night_elf') return 0x70a6ff;
    if (id === 'goblin') return 0x75d184;
    if (id === 'demon') return 0xff6b6b;

    return UI.colors.gold;
  }

  private getRaceColorText(id: string) {
    if (id === 'human') return UI.colors.goldText;
    if (id === 'tainted_halfblood') return '#c084fc';
    if (id === 'stoneborn') return '#c7cbd1';
    if (id === 'night_elf') return '#70a6ff';
    if (id === 'goblin') return '#75d184';
    if (id === 'demon') return '#ff6b6b';

    return UI.colors.textMuted;
  }
}