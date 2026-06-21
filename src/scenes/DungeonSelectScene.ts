import Phaser from 'phaser';

import {
  gameState,
  getTierEndFloor,
  getTierStartFloor,
} from '../data/gameState';

import {
  canStartTier,
  getHighestUnlockedTier,
  startTierGateBoss,
  startTierRun,
} from '../systems/FloorSystem';

import { saveGameAsync } from '../systems/SaveSystem';
import { SANITY_COST_PER_FLOOR, hasEnoughSanityForFloor } from '../systems/SanitySystem';
import { createBottomNav } from '../ui/createBottomNav';

import {
  formatCheckpointTimeLeft,

  getActiveCampfireBattleCheckpoints,
  restoreCampfireBattleCheckpoint,
  type CampfireBattleCheckpoint,
} from '../systems/CampfireCheckpointSystem';

import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type FlintType = 'none' | 'dim' | 'black' | 'ruby' | 'ordinary' | 'regular' | 'red_ruby';

type DungeonCampfireState = {
  tier: number;
  selectedFlint: FlintType | null;
  remainingCampfireUses: number;
  campfireFloors: number[];
  usedCampfireFloors: number[];
  selectionDone: boolean;
};

type DungeonSelectLayout = {
  width: number;
  height: number;
  centerX: number;

  safeX: number;
  safeTop: number;
  safeBottom: number;

  contentWidth: number;
  contentTop: number;
  contentBottom: number;
  viewportHeight: number;

  compact: boolean;
};

type CountdownText = {
  text: Phaser.GameObjects.Text;
  checkpoint: CampfireBattleCheckpoint;
  prefix: string;
};

export class DungeonSelectScene extends Phaser.Scene {
  private contentContainer?: Phaser.GameObjects.Container;
  private currentScrollY = 0;
  private targetScrollY = 0;
  private maxScrollY = 0;

  private isDragging = false;
  private didDrag = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  private countdownTexts: CountdownText[] = [];
  private countdownTimer?: Phaser.Time.TimerEvent;
  private modalObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('DungeonSelectScene');
  }

  create() {
    this.resetSceneState();

    const layout = this.getLayout();

    createSceneBackground(this);
    this.createCatacombBackdrop(layout);
    this.createScrollableContent(layout);

    createBottomNav(this, {
      activeScene: 'CampScene',
    });

    this.countdownTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.updateCountdownTexts(),
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.countdownTimer?.remove(false);
      this.countdownTimer = undefined;
    });
  }

  update() {
    if (!this.contentContainer || this.isDragging) {
      return;
    }

    if (Math.abs(this.currentScrollY - this.targetScrollY) < 0.5) {
      this.currentScrollY = this.targetScrollY;
    } else {
      this.currentScrollY = Phaser.Math.Linear(this.currentScrollY, this.targetScrollY, 0.18);
    }

    this.contentContainer.y = -this.currentScrollY;
  }

  private resetSceneState() {
    this.contentContainer = undefined;
    this.currentScrollY = 0;
    this.targetScrollY = 0;
    this.maxScrollY = 0;
    this.isDragging = false;
    this.didDrag = false;
    this.dragStartY = 0;
    this.dragStartScrollY = 0;
    this.countdownTexts = [];
    this.modalObjects = [];
  }

  private getLayout(): DungeonSelectLayout {
    const { width, height } = this.scale;

    const compact = height < 1120;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.025), 20, 34);
    const safeBottom = 116;
    const contentWidth = Math.min(width - safeX * 2, 640);
    const contentTop = safeTop + 10;
    const contentBottom = height - safeBottom - 10;

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      contentWidth,
      contentTop,
      contentBottom,
      viewportHeight: Math.max(320, contentBottom - contentTop),

      compact,
    };
  }

  private createCatacombBackdrop(layout: DungeonSelectLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, 0x050608, 0.78).setDepth(0);
    this.add.rectangle(centerX, height - 160, width, 340, 0x020202, 0.55).setDepth(0);

    this.add.circle(centerX, layout.safeTop + 210, width * 0.54, 0x151c2c, 0.18).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 235, width * 0.34, 0x2b1828, 0.14).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 260, width * 0.18, 0x8d5d32, 0.055).setDepth(0);

    const archWidth = Math.min(layout.contentWidth * 0.78, 450);
    const archY = layout.safeTop + 260;

    this.add.rectangle(centerX, archY + 35, archWidth, 250, 0x060709, 0.72)
      .setStrokeStyle(2, 0x3f362c, 0.58)
      .setDepth(1);

    this.add.ellipse(centerX, archY - 72, archWidth, 175, 0x07080a, 0.9)
      .setStrokeStyle(2, 0x53442f, 0.42)
      .setDepth(1);

    this.add.rectangle(centerX, archY + 168, archWidth + 46, 28, 0x11100f, 0.95)
      .setStrokeStyle(1, 0x5f5039, 0.5)
      .setDepth(2);

    for (let i = 0; i < 7; i += 1) {
      const x = centerX - archWidth / 2 + 42 + i * ((archWidth - 84) / 6);
      this.add.rectangle(x, archY + 30, 24, 245, 0x0d0e10, 0.72)
        .setStrokeStyle(1, 0x313131, 0.36)
        .setDepth(2);
    }

    for (let i = 0; i < 34; i += 1) {
      const x = layout.safeX + 12 + (i * 47) % Math.max(1, width - layout.safeX * 2 - 24);
      const y = layout.safeTop + 84 + (i * 67) % Math.max(1, height - layout.safeTop - layout.safeBottom - 80);
      const alpha = 0.025 + (i % 4) * 0.01;

      this.add.circle(x, y, 1 + (i % 3), i % 5 === 0 ? 0x8f6bd1 : 0xa88d63, alpha)
        .setDepth(3);
    }

    this.add.text(centerX, layout.safeTop + 232, '☥', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '92px' : '118px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    })
      .setOrigin(0.5)
      .setAlpha(0.035)
      .setDepth(3);
  }

  private createScrollableContent(layout: DungeonSelectLayout) {
    this.contentContainer = this.add.container(0, 0).setDepth(10);

    const maskGraphics = this.add.graphics();
    maskGraphics.setVisible(false);
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.fillRect(
      layout.safeX,
      layout.contentTop,
      layout.width - layout.safeX * 2,
      layout.viewportHeight
    );

    this.contentContainer.setMask(maskGraphics.createGeometryMask());

    let cursorY = layout.contentTop + 10;

    cursorY = this.createHeader(layout, cursorY);
    cursorY = this.createProgressPanel(layout, cursorY + 14);

    const unlockedTier = getHighestUnlockedTier();
    const maxVisibleTier = Math.max(2, unlockedTier);

    for (let tier = 1; tier <= maxVisibleTier; tier += 1) {
      const available = canStartTier(tier);

      cursorY = available
        ? this.createTierCard(layout, tier, cursorY + 16)
        : this.createLockedTierCard(layout, tier, cursorY + 16);
    }

    const contentHeight = cursorY - layout.contentTop + 24;

    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = 0;
    this.targetScrollY = 0;

    this.createScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }
  }

  private createHeader(layout: DungeonSelectLayout, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = layout.compact ? 108 : 122;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel(container, {
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: 0x08090c,
      alpha: 0.92,
      strokeColor: 0x6e5634,
      strokeAlpha: 0.64,
      strokeWidth: 2,
      depth: 2,
    });

    this.addTo(container, this.add.text(layout.centerX, topY + 32, 'Врата ярусов', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '30px' : '34px',
      color: '#c9a86a',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 46,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(6));

    this.addTo(container, this.add.text(layout.centerX, topY + 72, 'Выбери ярус или вернись к активному костру', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '13px' : '15px',
      color: '#8f8a80',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 68,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0.5).setDepth(6));

    return topY + panelHeight;
  }

  private createProgressPanel(layout: DungeonSelectLayout, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = 128;
    const panelY = topY + panelHeight / 2;
    const unlockedTier = getHighestUnlockedTier();

    this.createRoundedPanel(container, {
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: 0x090b0d,
      alpha: 0.94,
      strokeColor: 0x4b4031,
      strokeAlpha: 0.55,
      depth: 2,
    });

    this.addTo(container, this.add.text(layout.centerX, topY + 28, 'Следы прежних спусков', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '21px' : '24px',
      color: '#d2b87a',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 50,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(6));

    const cardWidth = Math.min((layout.contentWidth - 62) / 3, 178);
    const cardY = topY + 82;

    this.createMiniStat(container, layout.centerX - cardWidth - 10, cardY, cardWidth, 'Рекорд', `${gameState.highestClearedFloor}`, '▼', 0x8c2f32);
    this.createMiniStat(container, layout.centerX, cardY, cardWidth, 'Ярусы', `${gameState.highestClearedTier}`, '▲', 0x9a7a45);
    this.createMiniStat(container, layout.centerX + cardWidth + 10, cardY, cardWidth, 'Доступен', `${unlockedTier}`, '◆', 0x4f6f82);

    return topY + panelHeight;
  }

  private createTierCard(layout: DungeonSelectLayout, tier: number, topY: number) {
    const container = this.requireContentContainer();
    const startFloor = getTierStartFloor(tier);
    const endFloor = getTierEndFloor(tier);
    const isCleared = gameState.highestClearedTier >= tier;
    const activeCheckpoint = this.getActiveCheckpointForTier(tier);
    const campfireState = this.getCampfireStateForTier(tier);
    const campfireFloors = this.getCampfireFloorsForTier(campfireState);
    const hasGateButton = tier > 1 && gameState.highestClearedTier >= tier - 1;

    const campfireSectionHeight = campfireFloors.length > 0
      ? 68 + campfireFloors.length * (layout.compact ? 76 : 82)
      : 118;

    const panelHeight = (layout.compact ? 306 : 326) + campfireSectionHeight + (hasGateButton ? 62 : 0);
    const panelY = topY + panelHeight / 2;
    const accent = activeCheckpoint ? 0x4f8f76 : isCleared ? 0x6e5634 : 0x8c2f32;

    this.createRoundedPanel(container, {
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 34,
      color: activeCheckpoint ? 0x08120e : 0x0a0b0d,
      alpha: 0.95,
      strokeColor: accent,
      strokeAlpha: activeCheckpoint ? 0.82 : 0.58,
      strokeWidth: activeCheckpoint ? 3 : 2,
      depth: 2,
    });

    const left = layout.centerX - layout.contentWidth / 2 + 26;
    const right = layout.centerX + layout.contentWidth / 2 - 26;

    this.addTo(container, this.add.circle(left + 38, topY + 50, 34, 0x17100c, 0.96)
      .setStrokeStyle(2, accent, 0.8)
      .setDepth(6));

    this.addTo(container, this.add.text(left + 38, topY + 50, `${tier}`, {
      fontFamily: UI.font.title,
      fontSize: '26px',
      color: activeCheckpoint ? '#8fc89b' : '#c9a86a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(7));

    this.addTo(container, this.add.text(left + 90, topY + 35, `${tier}-й ярус`, {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '25px' : '29px',
      color: '#d2b87a',
      stroke: '#000000',
      strokeThickness: 5,
      wordWrap: {
        width: layout.contentWidth - 210,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7));

    const statusText = activeCheckpoint
      ? 'Есть активный костёр'
      : isCleared
        ? 'Пройден, можно повторить'
        : 'Доступен для спуска';

    this.addTo(container, this.add.text(left + 90, topY + 68, statusText, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: activeCheckpoint ? '#8fc89b' : '#8f8a80',
      wordWrap: {
        width: layout.contentWidth - 210,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7));

    this.createDarkTag(container, {
      x: right - 62,
      y: topY + 51,
      width: 124,
      height: 34,
      text: `${startFloor}–${endFloor} эт.`,
      accentColor: 0x6e5634,
      depth: 7,
    });

    const descriptionY = topY + 116;

    this.addTo(container, this.add.text(layout.centerX, descriptionY, [
      `Финальный босс ждёт на ${endFloor} этаже.`,
      'Если выйти в город до конца яруса — маршрут начнётся заново.',
    ].join('\n'), {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '14px' : '15px',
      color: '#c7bba5',
      align: 'center',
      lineSpacing: 4,
      wordWrap: {
        width: layout.contentWidth - 66,
        useAdvancedWrap: true,
      },
      maxLines: 3,
    }).setOrigin(0.5).setDepth(7));

    const mainButtonY = topY + (layout.compact ? 184 : 194);
    const mainButtonText = activeCheckpoint
      ? `Вернуться к костру: этаж ${activeCheckpoint.floor}`
      : `Начать с ${startFloor} этажа`;

    this.createUiButton(container, {
      x: layout.centerX,
      y: mainButtonY,
      width: Math.min(layout.contentWidth - 82, 500),
      height: 54,
      icon: activeCheckpoint ? '♨' : '▼',
      title: mainButtonText,
      subtitle: activeCheckpoint
        ? `Осталось ${formatCheckpointTimeLeft(activeCheckpoint.expiresAt - Date.now())}`
        : 'Активного костра нет — начнётся обычный спуск.',
      accentColor: activeCheckpoint ? 0x4f8f76 : 0x8c2f32,
      onClick: () => {
        if (activeCheckpoint) {
          this.restoreCheckpointAndEnter(activeCheckpoint);
          return;
        }

        this.startTierFromBeginning(tier);
      },
      depth: 8,
    });

    if (activeCheckpoint) {
      const lastText = this.countdownTexts[this.countdownTexts.length - 1];
      if (lastText) {
        lastText.prefix = 'Осталось ';
      }
    }

    if (hasGateButton) {
      this.createUiButton(container, {
        x: layout.centerX,
        y: mainButtonY + 66,
        width: Math.min(layout.contentWidth - 112, 460),
        height: 48,
        icon: '♛',
        title: `Победить босса ${tier - 1}-го яруса`,
        subtitle: 'Быстрый допуск к следующему ярусу.',
        accentColor: 0x6e5634,
        onClick: () => {
          if (!hasEnoughSanityForFloor()) {
            this.showNotEnoughSanityMessage();
            return;
          }

          startTierGateBoss(tier);
          void saveGameAsync();
          this.scene.start('DungeonScene');
        },
        depth: 8,
        small: true,
      });
    }

    const campfireTop = topY + (layout.compact ? 250 : 268) + (hasGateButton ? 62 : 0);

    this.createCampfireSection(layout, container, tier, campfireTop, campfireFloors, activeCheckpoint, campfireState);

    return topY + panelHeight;
  }

  private createLockedTierCard(layout: DungeonSelectLayout, tier: number, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = 236;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel(container, {
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 32,
      color: 0x09090b,
      alpha: 0.72,
      strokeColor: 0x333333,
      strokeAlpha: 0.42,
      depth: 2,
    });

    this.addTo(container, this.add.circle(layout.centerX, topY + 58, 32, 0x111111, 0.96)
      .setStrokeStyle(2, 0x444444, 0.5)
      .setDepth(6));

    this.addTo(container, this.add.text(layout.centerX, topY + 58, '×', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: '#666666',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(7));

    this.addTo(container, this.add.text(layout.centerX, topY + 106, `${tier}-й ярус`, {
      fontFamily: UI.font.title,
      fontSize: '29px',
      color: '#666666',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 60,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(7));

    this.addTo(container, this.add.text(layout.centerX, topY + 164, `Закрыт.\nСначала пройди ${tier - 1}-й ярус и победи его финального босса.`, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: '#777777',
      align: 'center',
      lineSpacing: 5,
      wordWrap: {
        width: layout.contentWidth - 70,
        useAdvancedWrap: true,
      },
      maxLines: 3,
    }).setOrigin(0.5).setDepth(7));

    return topY + panelHeight;
  }

  private createCampfireSection(
    layout: DungeonSelectLayout,
    container: Phaser.GameObjects.Container,
    tier: number,
    topY: number,
    campfireFloors: number[],
    activeCheckpoint: CampfireBattleCheckpoint | undefined,
    campfireState?: DungeonCampfireState
  ) {
    const innerWidth = layout.contentWidth - 58;

    this.addTo(container, this.add.text(layout.centerX, topY, 'Костры яруса', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '19px' : '21px',
      color: '#c9a86a',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: innerWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(7));

    const hint = activeCheckpoint
      ? 'Активный костёр можно выбрать как точку возвращения.'
      : 'Активных костров нет — кнопка яруса начнёт обычный спуск.';

    this.addTo(container, this.add.text(layout.centerX, topY + 28, hint, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8f8a80',
      align: 'center',
      wordWrap: {
        width: innerWidth,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0.5).setDepth(7));

    if (campfireFloors.length === 0) {
      this.createEmptyCampfireState(layout, container, topY + 86, tier);
      return;
    }

    const rowHeight = layout.compact ? 66 : 72;
    let rowY = topY + 78;

    const activeCheckpoints = getActiveCampfireBattleCheckpoints()
      .filter(checkpoint => checkpoint.tier === tier);

    campfireFloors.forEach((floor, index) => {
      const checkpointForFloor = activeCheckpoints.find(checkpoint => checkpoint.floor === floor);
      const isActive = Boolean(checkpointForFloor);
      const isUsed = Boolean(campfireState?.usedCampfireFloors?.includes(floor));
      const title = `${index + 1}-й костёр • этаж ${floor}`;
      const status = isActive
        ? `Активен • ${formatCheckpointTimeLeft(checkpointForFloor!.expiresAt - Date.now())}`
        : isUsed
          ? 'Найден, но сейчас не активен'
          : 'Ещё не найден в этом ярусе';

      const rowObjects = this.createCampfireRow(container, {
        x: layout.centerX,
        y: rowY,
        width: innerWidth,
        height: rowHeight,
        title,
        status,
        active: isActive,
        disabledText: isUsed ? 'Погас' : 'Нет',
        onClick: () => {
          if (!checkpointForFloor) {
            return;
          }

          this.restoreCheckpointAndEnter(checkpointForFloor);
        },
      });

      if (isActive && checkpointForFloor) {
        this.countdownTexts.push({
          text: rowObjects.statusText,
          checkpoint: checkpointForFloor,
          prefix: 'Активен • ',
        });
      }

      rowY += rowHeight + 10;
    });
  }

  private createEmptyCampfireState(
    layout: DungeonSelectLayout,
    container: Phaser.GameObjects.Container,
    y: number,
    tier: number
  ) {
    const width = layout.contentWidth - 58;

    this.createRoundedPanel(container, {
      x: layout.centerX,
      y,
      width,
      height: 88,
      radius: 22,
      color: 0x09090b,
      alpha: 0.88,
      strokeColor: 0x3b3328,
      strokeAlpha: 0.48,
      strokeWidth: 1,
      depth: 5,
    });

    this.addTo(container, this.add.text(layout.centerX, y - 18, 'Активных костров нет', {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: '#9f9788',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: width - 44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(7));

    this.addTo(container, this.add.text(layout.centerX, y + 17, `Нажми «Начать ярус», чтобы войти с ${getTierStartFloor(tier)} этажа.`, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: '#827c70',
      align: 'center',
      wordWrap: {
        width: width - 54,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0.5).setDepth(7));
  }

  private createCampfireRow(
    container: Phaser.GameObjects.Container,
    config: {
      x: number;
      y: number;
      width: number;
      height: number;
      title: string;
      status: string;
      active: boolean;
      disabledText: string;
      onClick: () => void;
    }
  ) {
    const accent = config.active ? 0x4f8f76 : 0x4b4031;
    const bgColor = config.active ? 0x0b1712 : 0x0a0a0c;

    this.createRoundedPanel(container, {
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 22,
      color: bgColor,
      alpha: 0.96,
      strokeColor: accent,
      strokeAlpha: config.active ? 0.82 : 0.42,
      strokeWidth: config.active ? 2 : 1,
      depth: 5,
    });

    const left = config.x - config.width / 2;
    const right = config.x + config.width / 2;

    this.addTo(container, this.add.circle(left + 36, config.y, 23, accent, config.active ? 0.2 : 0.11)
      .setStrokeStyle(1, accent, config.active ? 0.7 : 0.42)
      .setDepth(7));

    this.addTo(container, this.add.text(left + 36, config.y, '♨', {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: config.active ? '#8fc89b' : '#8a8173',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 72, config.y - 15, config.title, {
      fontFamily: UI.font.title,
      fontSize: '15px',
      color: config.active ? '#d2b87a' : '#a39a8c',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: config.width - 178,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8));

    const statusText = this.add.text(left + 72, config.y + 14, config.status, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: config.active ? '#8fc89b' : '#827c70',
      wordWrap: {
        width: config.width - 178,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8);

    this.addTo(container, statusText);

    this.createSmallButton(container, {
      x: right - 48,
      y: config.y,
      width: 82,
      height: 38,
      text: config.active ? 'К костру' : config.disabledText,
      accentColor: accent,
      disabled: !config.active,
      onClick: config.onClick,
      depth: 8,
    });

    return {
      statusText,
    };
  }

  private startTierFromBeginning(tier: number) {
    if (!canStartTier(tier)) {
      this.showMessage(
        'Ярус закрыт',
        `Сначала пройди предыдущий ярус и победи его финального босса.`
      );
      return;
    }

    if (!hasEnoughSanityForFloor()) {
      this.showNotEnoughSanityMessage();
      return;
    }

    startTierRun(tier);
    void saveGameAsync();
    this.scene.start('DungeonScene');
  }

  private restoreCheckpointAndEnter(checkpoint: CampfireBattleCheckpoint) {
    const activeCheckpoint = this.getActiveCheckpointForTier(checkpoint.tier);

    if (!activeCheckpoint || activeCheckpoint.floor !== checkpoint.floor) {
      this.showMessage(
        'Костёр погас',
        'Время этого костра уже истекло. Начни ярус заново.'
      );
      return;
    }

    const result = restoreCampfireBattleCheckpoint(activeCheckpoint.id);

    if (!result.success) {
      this.showMessage('Костёр погас', result.message);
      return;
    }

    void saveGameAsync();
    this.scene.start('DungeonScene');
  }

  private getActiveCheckpointForTier(tier: number) {
    const checkpoints = getActiveCampfireBattleCheckpoints()
      .filter(checkpoint => checkpoint.tier === tier)
      .sort((a, b) => b.createdAt - a.createdAt);

    return checkpoints[0];
  }

  private getCampfireStateForTier(tier: number) {
    const stateOwner = gameState as typeof gameState & {
      dungeonCampfireState?: DungeonCampfireState;
    };

    const campfireState = stateOwner.dungeonCampfireState;

    if (!campfireState || campfireState.tier !== tier) {
      return undefined;
    }

    return campfireState;
  }

  private getCampfireFloorsForTier(campfireState?: DungeonCampfireState) {
    if (!campfireState?.campfireFloors || campfireState.campfireFloors.length === 0) {
      return [];
    }

    return [...campfireState.campfireFloors].sort((left, right) => left - right);
  }

  private createMiniStat(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    icon: string,
    accentColor: number
  ) {
    this.createRoundedPanel(container, {
      x,
      y,
      width,
      height: 54,
      radius: 18,
      color: 0x101012,
      alpha: 0.96,
      strokeColor: accentColor,
      strokeAlpha: 0.38,
      strokeWidth: 1,
      depth: 4,
    });

    const left = x - width / 2;

    this.addTo(container, this.add.text(left + 26, y, icon, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: '#c9a86a',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7));

    this.addTo(container, this.add.text(left + 48, y - 10, label, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#8f8a80',
      wordWrap: {
        width: width - 58,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7));

    this.addTo(container, this.add.text(left + 48, y + 11, value, {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: '#d2b87a',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: width - 58,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7));
  }

  private createDarkTag(
    container: Phaser.GameObjects.Container,
    config: {
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      accentColor: number;
      depth: number;
    }
  ) {
    this.createRoundedPanel(container, {
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: config.height / 2,
      color: 0x0d0d0f,
      alpha: 0.96,
      strokeColor: config.accentColor,
      strokeAlpha: 0.46,
      strokeWidth: 1,
      depth: config.depth,
    });

    this.addTo(container, this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#bfb39f',
      align: 'center',
      wordWrap: {
        width: config.width - 16,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(config.depth + 2));
  }

  private createUiButton(
    container: Phaser.GameObjects.Container,
    config: {
      x: number;
      y: number;
      width: number;
      height: number;
      icon: string;
      title: string;
      subtitle: string;
      accentColor: number;
      onClick: () => void;
      disabled?: boolean;
      depth?: number;
      small?: boolean;
    }
  ) {
    const disabled = config.disabled ?? false;
    const depth = config.depth ?? 8;
    const radius = Math.min(22, config.height / 2);
    const bgColor = disabled ? 0x111111 : 0x17100c;
    const titleColor = disabled ? '#555555' : '#d2b87a';
    const subtitleColor = disabled ? '#444444' : '#8f8a80';

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

    const bg = this.add.graphics();
    const redraw = (fill: number, fillAlpha: number, borderAlpha: number) => {
      bg.clear();
      bg.fillStyle(fill, fillAlpha);
      bg.fillRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );
      bg.lineStyle(2, config.accentColor, borderAlpha);
      bg.strokeRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );
    };

    redraw(bgColor, disabled ? 0.62 : 0.97, disabled ? 0.28 : 0.82);
    bg.setDepth(depth + 1);

    const left = config.x - config.width / 2;
    const iconX = left + 34;

    const iconBg = this.add.circle(iconX, config.y, 19, config.accentColor, disabled ? 0.08 : 0.18)
      .setStrokeStyle(1, config.accentColor, disabled ? 0.26 : 0.62)
      .setDepth(depth + 2);

    const icon = this.add.text(iconX, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: disabled ? '#555555' : '#c9a86a',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(depth + 3);

    const textX = left + 64;
    const textWidth = config.width - 84;

    const title = this.add.text(textX, config.y - 10, config.title, {
      fontFamily: UI.font.title,
      fontSize: config.small ? '13px' : '15px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(depth + 3);

    const subtitle = this.add.text(textX, config.y + 14, config.subtitle, {
      fontFamily: UI.font.body,
      fontSize: config.small ? '11px' : '12px',
      color: subtitleColor,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(depth + 3);

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(depth + 4);

    container.add([shadow, bg, iconBg, icon, title, subtitle, zone]);

    if (!disabled) {
      zone.setInteractive({ useHandCursor: true });

      zone.on('pointerover', () => {
        redraw(0x24180f, 1, 1);
        title.setColor('#eee1c6');
      });

      zone.on('pointerout', () => {
        redraw(bgColor, 0.97, 0.82);
        title.setColor(titleColor);
      });

      zone.on('pointerup', () => {
        if (this.didDrag) {
          return;
        }

        config.onClick();
      });
    }
  }

  private createSmallButton(
    container: Phaser.GameObjects.Container,
    config: {
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      accentColor: number;
      disabled?: boolean;
      onClick: () => void;
      depth?: number;
    }
  ) {
    const disabled = config.disabled ?? false;
    const depth = config.depth ?? 8;
    const radius = Math.min(16, config.height / 2);
    const bgColor = disabled ? 0x121212 : 0x17100c;
    const textColor = disabled ? '#555555' : '#d2b87a';

    const bg = this.add.graphics();
    const redraw = (fill: number, alpha: number, borderAlpha: number) => {
      bg.clear();
      bg.fillStyle(fill, alpha);
      bg.fillRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );
      bg.lineStyle(1, config.accentColor, borderAlpha);
      bg.strokeRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );
    };

    redraw(bgColor, disabled ? 0.6 : 0.96, disabled ? 0.25 : 0.75);
    bg.setDepth(depth + 1);

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: textColor,
      align: 'center',
      wordWrap: {
        width: config.width - 10,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(depth + 2);

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(depth + 3);

    container.add([bg, label, zone]);

    if (!disabled) {
      zone.setInteractive({ useHandCursor: true });

      zone.on('pointerover', () => {
        redraw(0x24180f, 1, 1);
        label.setColor('#eee1c6');
      });

      zone.on('pointerout', () => {
        redraw(bgColor, 0.96, 0.75);
        label.setColor(textColor);
      });

      zone.on('pointerup', () => {
        if (this.didDrag) {
          return;
        }

        config.onClick();
      });
    }
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
    const color = config.color ?? 0x111113;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? 0x4b4031;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const depth = config.depth ?? 1;

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
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

  private createScrollInput(layout: DungeonSelectLayout) {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.maxScrollY <= 0 || !this.isPointerInsideViewport(pointer, layout)) {
        return;
      }

      this.isDragging = true;
      this.didDrag = false;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.targetScrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) {
        return;
      }

      const deltaY = pointer.y - this.dragStartY;

      if (Math.abs(deltaY) > 8) {
        this.didDrag = true;
      }

      this.targetScrollY = Phaser.Math.Clamp(
        this.dragStartScrollY - deltaY,
        0,
        this.maxScrollY
      );
      this.currentScrollY = this.targetScrollY;

      if (this.contentContainer) {
        this.contentContainer.y = -this.currentScrollY;
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
      this.time.delayedCall(0, () => {
        this.didDrag = false;
      });
    });

    this.input.on('pointerupoutside', () => {
      this.isDragging = false;
      this.didDrag = false;
    });

    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _objects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        if (!this.isPointerInsideViewport(pointer, layout) || this.maxScrollY <= 0) {
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

  private isPointerInsideViewport(pointer: Phaser.Input.Pointer, layout: DungeonSelectLayout) {
    return (
      pointer.x >= layout.safeX &&
      pointer.x <= layout.width - layout.safeX &&
      pointer.y >= layout.contentTop &&
      pointer.y <= layout.contentBottom
    );
  }

  private createScrollHint(layout: DungeonSelectLayout) {
    const hintY = layout.contentBottom - 18;

    const bg = this.add.rectangle(layout.centerX, hintY, 250, 28, 0x000000, 0.44)
      .setDepth(300);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай список ярусов', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8e887b',
      align: 'center',
    }).setOrigin(0.5).setDepth(301);

    this.tweens.add({
      targets: [bg, text],
      alpha: 0.24,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private updateCountdownTexts() {
    let shouldRefresh = false;

    this.countdownTexts.forEach(item => {
      const timeLeft = item.checkpoint.expiresAt - Date.now();

      if (timeLeft <= 0) {
        shouldRefresh = true;
        item.text.setText('Погас');
        return;
      }

      item.text.setText(`${item.prefix}${formatCheckpointTimeLeft(timeLeft)}`);
    });

    if (shouldRefresh) {
      this.time.delayedCall(350, () => this.scene.restart());
    }
  }

  private showNotEnoughSanityMessage() {
    this.showMessage(
      'Недостаточно рассудка',
      `Для прохождения этажа нужно ${SANITY_COST_PER_FLOOR} рассудка. Рассудок восстанавливается со временем: 1 единица в минуту.`
    );
  }

  private showMessage(title: string, message: string) {
    this.clearModal();

    const layout = this.getLayout();
    const panelWidth = Math.min(layout.contentWidth, 620);
    const panelHeight = Math.min(310, layout.height - 130);
    const centerY = layout.height / 2;

    const overlay = this.add.rectangle(layout.centerX, centerY, layout.width, layout.height, 0x000000, 0.78)
      .setDepth(1000)
      .setInteractive();

    const panel = this.add.rectangle(layout.centerX, centerY, panelWidth, panelHeight, 0x101012, 0.98)
      .setStrokeStyle(3, 0x6e5634, 0.86)
      .setDepth(1001);

    const titleText = this.add.text(layout.centerX, centerY - 92, title, {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '26px' : '29px',
      color: '#c9a86a',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: panelWidth - 70,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(1002);

    const messageText = this.add.text(layout.centerX, centerY - 8, message, {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '16px' : '18px',
      color: '#d1c7b4',
      align: 'center',
      lineSpacing: 6,
      wordWrap: {
        width: panelWidth - 76,
        useAdvancedWrap: true,
      },
      maxLines: 6,
    }).setOrigin(0.5).setDepth(1002);

    const closeButton = this.createModalButton({
      x: layout.centerX,
      y: centerY + 96,
      width: 260,
      height: 52,
      text: 'Понятно',
      onClick: () => this.clearModal(),
    });

    this.modalObjects.push(overlay, panel, titleText, messageText, ...closeButton);
  }

  private createModalButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    onClick: () => void;
  }) {
    const bg = this.add.rectangle(config.x, config.y, config.width, config.height, 0x17100c, 0.96)
      .setStrokeStyle(2, 0x9a7a45, 0.86)
      .setDepth(1002)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: '#d2b87a',
      align: 'center',
      wordWrap: {
        width: config.width - 20,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(1003);

    bg.on('pointerup', config.onClick);

    return [bg, label];
  }

  private clearModal() {
    this.modalObjects.forEach(object => object.destroy());
    this.modalObjects = [];
  }

  private requireContentContainer() {
    if (!this.contentContainer) {
      throw new Error('DungeonSelect content container was not created.');
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
