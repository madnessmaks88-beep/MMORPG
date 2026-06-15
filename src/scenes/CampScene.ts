import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState, resetFloorRun } from '../data/gameState';
import { getRaceById } from '../data/races';

import { getPlayerStats } from '../systems/InventorySystem';
import { loadGameAsync, saveGameAsync } from '../systems/SaveSystem';
import { getCachedVKUser, getVKUser, initVKBridge } from '../systems/VKBridgeSystem';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

import {
  getActiveCampfireBattleCheckpoint,
  restoreCampfireBattleCheckpoint,
  formatCheckpointTimeLeft,
  clearCampfireBattleCheckpoint,
} from '../systems/CampfireCheckpointSystem';

import {
  getQuests,
  isQuestCompleted,
  isQuestClaimed,
} from '../systems/QuestSystem';

import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type CampLayout = {
  width: number;
  height: number;
  centerX: number;

  safeX: number;
  safeTop: number;
  safeBottom: number;

  contentWidth: number;
  bottomNavTop: number;

  headerHeight: number;
  heroTop: number;
  heroHeight: number;
  actionsTop: number;
  actionsBottom: number;
  actionsViewportHeight: number;

  compact: boolean;
};

type CampActionButton = {
  titleText: Phaser.GameObjects.Text;
};

export class CampScene extends Phaser.Scene {
  private static startupPrepared = false;
  private static startupPromise?: Promise<void>;

  private actionContainer?: Phaser.GameObjects.Container;
  private currentScrollY = 0;
  private targetScrollY = 0;
  private maxScrollY = 0;
  private isDragging = false;
  private didDrag = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  private restButtonLabel?: Phaser.GameObjects.Text;
  private campfireTimerEvent?: Phaser.Time.TimerEvent;

  private readonly CAMPFIRE_COOLDOWN_MS = 30 * 60 * 1000;
  private readonly CAMPFIRE_LAST_USE_KEY = 'campfire_last_rest_at';

  constructor() {
    super('CampScene');
  }

  async create() {
    this.resetScrollState();

    const layout = this.getLayout();

    createSceneBackground(this);
    this.createCampBackdrop(layout);

    await this.prepareStartupOnce();

    this.grantStartGoldOnce();

    this.createHeader(layout);
    this.createPlayerLine(layout);
    this.createHeroStatusCard(layout);
    this.createMainActions(layout);

    createBottomNav(this, {
      activeScene: 'CampScene',
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.campfireTimerEvent?.remove(false);
      this.campfireTimerEvent = undefined;
    });
  }

  update() {
    if (!this.actionContainer || this.isDragging) {
      return;
    }

    if (Math.abs(this.currentScrollY - this.targetScrollY) < 0.5) {
      this.currentScrollY = this.targetScrollY;
    } else {
      this.currentScrollY = Phaser.Math.Linear(this.currentScrollY, this.targetScrollY, 0.2);
    }

    this.actionContainer.y = -this.currentScrollY;
  }

  private resetScrollState() {
    this.actionContainer = undefined;
    this.currentScrollY = 0;
    this.targetScrollY = 0;
    this.maxScrollY = 0;
    this.isDragging = false;
    this.didDrag = false;
    this.dragStartY = 0;
    this.dragStartScrollY = 0;
  }

  private async prepareStartupOnce() {
    if (CampScene.startupPrepared) {
      return;
    }

    if (!CampScene.startupPromise) {
      CampScene.startupPromise = this.prepareStartup();
    }

    await CampScene.startupPromise;
    CampScene.startupPrepared = true;
  }

  private async prepareStartup() {
    try {
      await initVKBridge();
      await getVKUser();
      await loadGameAsync();
    } catch (error) {
      console.warn('CampScene startup failed:', error);
    }
  }

  private getLayout(): CampLayout {
    const { width, height } = this.scale;

    const compact = height < 1120;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.025), 20, 34);
    const safeBottom = 116;
    const contentWidth = Math.min(width - safeX * 2, 620);
    const bottomNavTop = height - safeBottom;

    const headerHeight = compact ? 106 : 118;
    const heroTop = safeTop + headerHeight + 10;
    const heroHeight = compact ? 142 : 158;
    const actionsTop = heroTop + heroHeight + 14;
    const actionsBottom = bottomNavTop - 12;
    const actionsViewportHeight = Math.max(260, actionsBottom - actionsTop);

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      contentWidth,
      bottomNavTop,

      headerHeight,
      heroTop,
      heroHeight,
      actionsTop,
      actionsBottom,
      actionsViewportHeight,

      compact,
    };
  }

  private createCampBackdrop(layout: CampLayout) {
    const { width, height, centerX } = layout;
    const cryptY = Phaser.Math.Clamp(height * 0.33, 300, 420);

    this.add.rectangle(centerX, height / 2, width, height, 0x050608, 0.72).setDepth(0);
    this.add.rectangle(centerX, height - 150, width, 320, 0x030202, 0.54).setDepth(0);

    this.add.circle(centerX, cryptY, width * 0.52, 0x1a2134, 0.16).setDepth(0);
    this.add.circle(centerX, cryptY + 18, width * 0.34, 0x392418, 0.13).setDepth(0);
    this.add.circle(centerX, cryptY + 28, width * 0.18, 0xb06a2c, 0.08).setDepth(0);

    const gateWidth = Math.min(layout.contentWidth * 0.74, 430);
    const gateHeight = layout.compact ? 164 : 190;
    const gateX = centerX;
    const gateY = cryptY + 22;

    this.add.rectangle(gateX, gateY + 42, gateWidth, gateHeight, 0x070809, 0.76)
      .setStrokeStyle(2, 0x3b352c, 0.7)
      .setDepth(1);

    this.add.rectangle(gateX, gateY - gateHeight / 2 + 14, gateWidth + 28, 20, 0x17130f, 0.9)
      .setStrokeStyle(1, 0x6d5430, 0.52)
      .setDepth(2);

    this.add.rectangle(gateX, gateY + gateHeight / 2 + 42, gateWidth + 40, 26, 0x13100e, 0.96)
      .setStrokeStyle(1, 0x5c503d, 0.5)
      .setDepth(2);

    const columnOffset = gateWidth / 2 + 14;
    this.createStoneColumn(gateX - columnOffset, gateY + 22, gateHeight + 70);
    this.createStoneColumn(gateX + columnOffset, gateY + 22, gateHeight + 70);

    this.add.circle(centerX, cryptY + 92, 46, 0x000000, 0.38).setDepth(2);
    this.add.circle(centerX, cryptY + 80, 34, 0xb86b2e, 0.16).setDepth(2);
    this.add.text(centerX, cryptY + 76, '♨', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '38px' : '44px',
      color: '#b99257',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(3);

    for (let i = 0; i < 20; i += 1) {
      const x = layout.safeX + 10 + i * ((width - layout.safeX * 2 - 20) / 19);
      const y = layout.safeTop + 88 + (i % 5) * 58;
      const alpha = 0.025 + (i % 3) * 0.012;

      this.add.circle(x, y, 2 + (i % 2), 0x9f8a67, alpha).setDepth(1);
    }

    this.add.text(centerX, cryptY - 96, 'КАТАКОМБЫ', {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: '#6f6655',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0.32).setDepth(2);
  }

  private createStoneColumn(x: number, y: number, height: number) {
    this.add.rectangle(x, y, 26, height, 0x121315, 0.9)
      .setStrokeStyle(1, 0x4d473b, 0.5)
      .setDepth(2);

    this.add.rectangle(x, y - height / 2 + 10, 40, 18, 0x17130f, 0.95)
      .setStrokeStyle(1, 0x5b513e, 0.44)
      .setDepth(3);

    this.add.rectangle(x, y + height / 2 - 10, 44, 20, 0x17130f, 0.95)
      .setStrokeStyle(1, 0x5b513e, 0.44)
      .setDepth(3);

    for (let i = 0; i < 4; i += 1) {
      this.add.rectangle(x, y - height / 2 + 42 + i * 42, 22, 2, 0x303030, 0.5)
        .setDepth(3);
    }
  }

  private createHeader(layout: CampLayout) {
    const panelHeight = layout.headerHeight;
    const panelY = layout.safeTop + panelHeight / 2;

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: 0x09090b,
      alpha: 0.88,
      strokeColor: 0x6e5634,
      strokeAlpha: 0.55,
      strokeWidth: 2,
      depth: 8,
    });

    this.add.text(layout.centerX, panelY - 34, 'Убежище у катакомб', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '27px' : '31px',
      color: '#c9a86a',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 36,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12);

    this.add.text(layout.centerX, panelY - 3, 'Последний огонь перед спуском во тьму', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '13px' : '15px',
      color: '#8e887b',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 58,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12);
  }

  private createPlayerLine(layout: CampLayout) {
    const vkUser = getCachedVKUser();
    const vkName = vkUser ? vkUser.first_name : 'локальный режим';
    const y = layout.safeTop + layout.headerHeight - 22;
    const width = Math.min(layout.contentWidth - 86, 360);

    this.createDarkTag({
      x: layout.centerX,
      y,
      width,
      height: 30,
      icon: '◆',
      text: `Игрок: ${vkName}`,
      accentColor: 0x6e5634,
      depth: 13,
    });
  }

  private createHeroStatusCard(layout: CampLayout) {
    const race = player.raceId ? getRaceById(player.raceId) : undefined;
    const stats = getPlayerStats(player);

    const cardY = layout.heroTop + layout.heroHeight / 2;

    this.createRoundedPanel({
      x: layout.centerX,
      y: cardY,
      width: layout.contentWidth,
      height: layout.heroHeight,
      radius: 30,
      color: 0x090b0d,
      alpha: 0.95,
      strokeColor: 0x4e4637,
      strokeAlpha: 0.72,
      strokeWidth: 2,
      depth: 6,
    });

    const left = layout.centerX - layout.contentWidth / 2 + 22;
    const right = layout.centerX + layout.contentWidth / 2 - 22;
    const top = layout.heroTop;

    const heroName = race
      ? player.name === race.name
        ? player.name
        : `${player.name} • ${race.name}`
      : player.name;

    this.add.circle(left + 34, top + 43, 31, 0x16120f, 0.96)
      .setStrokeStyle(2, 0x7d633b, 0.78)
      .setDepth(8);

    this.add.text(left + 34, top + 43, race ? this.getRaceIcon(race.id) : '◆', {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: '#c9a86a',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(9);

    this.add.text(left + 76, top + 31, heroName, {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '19px' : '22px',
      color: '#d2b87a',
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: layout.contentWidth - 174,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(9);

    this.add.text(left + 76, top + 60, race ? race.description : 'Герой ещё не выбрал путь.', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8f8a80',
      wordWrap: {
        width: layout.contentWidth - 174,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 1,
    }).setOrigin(0, 0.5).setDepth(9);

    this.createDarkTag({
      x: right - 37,
      y: top + 34,
      width: 74,
      height: 32,
      icon: '',
      text: `Ур. ${player.level}`,
      accentColor: 0x3f6d5a,
      depth: 9,
    });

    const barY = top + layout.heroHeight - 57;
    const barGap = 16;
    const barWidth = Math.min((layout.contentWidth - 64 - barGap) / 2, 258);

    this.createSmallBar({
      x: layout.centerX - barWidth / 2 - barGap / 2,
      y: barY,
      width: barWidth,
      label: 'HP',
      value: `${player.hp}/${stats.maxHp}`,
      progress: stats.maxHp > 0 ? player.hp / stats.maxHp : 1,
      color: 0x8c2f32,
    });

    this.createSmallBar({
      x: layout.centerX + barWidth / 2 + barGap / 2,
      y: barY,
      width: barWidth,
      label: 'Энергия',
      value: `${player.energy}/${stats.maxEnergy}`,
      progress: stats.maxEnergy > 0 ? player.energy / stats.maxEnergy : 1,
      color: 0x3d6e9f,
    });

    const resourceY = top + layout.heroHeight - 19;
    const resourceWidth = Math.min((layout.contentWidth - 52) / 3, 150);

    this.createTinyResource(layout.centerX - resourceWidth - 8, resourceY, '◆', `${player.gold}`, resourceWidth);
    this.createTinyResource(layout.centerX, resourceY, '✚', `${player.potions}`, resourceWidth);
    this.createTinyResource(layout.centerX + resourceWidth + 8, resourceY, '★', `${player.relicIds.length}`, resourceWidth);
  }

  private getRaceIcon(id: string) {
    if (id === 'human') return '◆';
    if (id === 'tainted_halfblood') return '☾';
    if (id === 'stoneborn') return '▣';
    if (id === 'night_elf') return '◐';
    if (id === 'goblin') return '!';
    if (id === 'demon') return '✦';

    return '◆';
  }

  private grantStartGoldOnce() {
    const key = 'start_gold_500_v1';

    if (localStorage.getItem(key)) {
      return;
    }

    player.gold = Math.max(player.gold, 500);

    localStorage.setItem(key, '1');

    void saveGameAsync();
  }

  private createMainActions(layout: CampLayout) {
    const hasActiveRun =
      gameState.floorRun.active &&
      gameState.floorRun.rooms.length > 0;

    const activeCheckpoint = getActiveCampfireBattleCheckpoint();
    const hasActiveCheckpoint = Boolean(activeCheckpoint);
    const hasQuestReward = this.hasClaimableQuests();

    this.createRoundedPanel({
      x: layout.centerX,
      y: layout.actionsTop + layout.actionsViewportHeight / 2,
      width: layout.contentWidth,
      height: layout.actionsViewportHeight,
      radius: 32,
      color: 0x070708,
      alpha: 0.7,
      strokeColor: 0x3b3328,
      strokeAlpha: 0.6,
      strokeWidth: 1,
      depth: 4,
    });

    this.actionContainer = this.add.container(0, 0).setDepth(7);

    const maskGraphics = this.add.graphics();
    maskGraphics.setVisible(false);
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.fillRect(
      layout.safeX,
      layout.actionsTop,
      layout.width - layout.safeX * 2,
      layout.actionsViewportHeight
    );

    this.actionContainer.setMask(maskGraphics.createGeometryMask());

    const gap = layout.compact ? 12 : 14;
    const mainHeight = layout.compact ? 92 : 104;
    const wideHeight = layout.compact ? 68 : 74;
    const tileHeight = layout.compact ? 88 : 96;
    const dangerHeight = layout.compact ? 62 : 66;
    const innerWidth = layout.contentWidth - 44;
    const tileGap = 12;
    const tileWidth = Math.min((innerWidth - tileGap) / 2, 278);
    const leftX = layout.centerX - tileWidth / 2 - tileGap / 2;
    const rightX = layout.centerX + tileWidth / 2 + tileGap / 2;

    let currentY = layout.actionsTop + 22;

    this.createSectionLabel(layout.centerX, currentY, innerWidth, 'Выход к глубинам');
    currentY += 24 + mainHeight / 2;

    const dungeonTitle = activeCheckpoint
      ? 'Вернуться к костру'
      : hasActiveRun
        ? 'Продолжить спуск'
        : 'Войти в катакомбы';

    const dungeonDesc = activeCheckpoint
      ? `Чекпоинт: этаж ${activeCheckpoint.floor}. Осталось ${formatCheckpointTimeLeft(activeCheckpoint.expiresAt - Date.now())}.`
      : hasActiveRun
        ? `Ты остановился на этаже ${gameState.floorRun.currentFloor}.`
        : 'Начать новый спуск в холодные нижние залы.';

    this.createMainDungeonButton({
      layout,
      x: layout.centerX,
      y: currentY,
      width: innerWidth,
      height: mainHeight,
      title: dungeonTitle,
      description: dungeonDesc,
      hasActiveRun: hasActiveRun || hasActiveCheckpoint,
      onClick: () => {
        if (activeCheckpoint) {
          this.returnToCampfireCheckpoint();
          return;
        }

        this.tryEnterCatacombs(hasActiveRun);
      },
    });

    currentY += mainHeight / 2 + gap;

    if (hasActiveRun) {
      currentY += wideHeight / 2;

      this.createWideActionButton({
        x: layout.centerX,
        y: currentY,
        width: innerWidth,
        height: wideHeight,
        icon: '!',
        title: 'Покинуть спуск',
        description: hasActiveCheckpoint
          ? 'Ярус начнётся заново, чекпоинт костра будет потерян.'
          : 'Текущий ярус придётся проходить заново.',
        accentColor: 0x8c2f32,
        danger: true,
        onClick: () => {
          this.showLeaveRunMessage();
        },
      });

      currentY += wideHeight / 2 + gap;
    }

    this.createSectionLabel(layout.centerX, currentY, innerWidth, 'Городские места');
    currentY += 24 + tileHeight / 2;

    this.createCampTile({
      x: leftX,
      y: currentY,
      width: tileWidth,
      height: tileHeight,
      icon: '▣',
      title: 'Лавка',
      description: 'Зелья и припасы',
      accentColor: 0x9a7a45,
      onClick: () => {
        this.scene.start('ShopScene');
      },
    });

    this.createCampTile({
      x: rightX,
      y: currentY,
      width: tileWidth,
      height: tileHeight,
      icon: '▲',
      title: 'Тренировка',
      description: 'Сила героя',
      accentColor: 0x51715e,
      onClick: () => {
        this.scene.start('TrainingScene');
      },
    });

    currentY += tileHeight + gap;

    this.createCampTile({
      x: leftX,
      y: currentY,
      width: tileWidth,
      height: tileHeight,
      icon: hasQuestReward ? '!' : '◆',
      title: hasQuestReward ? 'Задания!' : 'Задания',
      description: hasQuestReward ? 'Есть награда' : 'Цели и награды',
      accentColor: hasQuestReward ? 0x5d7f65 : 0x6f5635,
      highlighted: hasQuestReward,
      onClick: () => {
        this.scene.start('QuestScene');
      },
    });

    this.createCampTile({
      x: rightX,
      y: currentY,
      width: tileWidth,
      height: tileHeight,
      icon: '⚒',
      title: 'Кузница',
      description: 'Оружие и броня',
      accentColor: 0x7b6b52,
      onClick: () => {
        this.scene.start('ForgeScene');
      },
    });

    currentY += tileHeight / 2 + gap + 8;

    this.createSectionLabel(layout.centerX, currentY, innerWidth, 'Подготовка');
    currentY += 24 + wideHeight / 2;

    const restCard = this.createWideActionButton({
      x: layout.centerX,
      y: currentY,
      width: innerWidth,
      height: wideHeight,
      icon: '♨',
      title: this.getRestButtonText(),
      description: 'Восстановить HP, энергию и зелья у последнего огня.',
      accentColor: 0x9a6b3b,
      onClick: () => {
        this.restAtCampfire();
      },
    });

    this.restButtonLabel = restCard.titleText;
    this.startCampfireTimer();

    currentY += wideHeight + gap;

    this.createWideActionButton({
      x: layout.centerX,
      y: currentY,
      width: innerWidth,
      height: wideHeight,
      icon: '✦',
      title: 'Дерево характеристик',
      description: 'Потратить очки прокачки героя.',
      accentColor: 0x4f6f82,
      onClick: () => {
        this.scene.start('StatsTreeScene');
      },
    });

    currentY += wideHeight + gap + 2;

    this.createWideActionButton({
      x: layout.centerX,
      y: currentY,
      width: innerWidth,
      height: dangerHeight,
      icon: '✕',
      title: 'Новая игра',
      description: 'Стереть прогресс и выбрать героя заново.',
      accentColor: 0x7d2b2f,
      danger: true,
      onClick: () => {
        this.showNewGameConfirm();
      },
    });

    currentY += dangerHeight / 2 + 24;

    const contentHeight = currentY - layout.actionsTop;
    this.maxScrollY = Math.max(0, contentHeight - layout.actionsViewportHeight + 12);
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScrollY);
    this.targetScrollY = this.currentScrollY;

    this.createActionScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }
  }

  private createSectionLabel(x: number, y: number, width: number, text: string) {
    const container = this.requireActionContainer();

    const lineLeft = this.add.rectangle(x - width / 4, y, width / 2 - 72, 1, 0x4b4031, 0.45).setDepth(8);
    const lineRight = this.add.rectangle(x + width / 4, y, width / 2 - 72, 1, 0x4b4031, 0.45).setDepth(8);
    const label = this.add.text(x, y, text, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8e806b',
      align: 'center',
      wordWrap: {
        width: 138,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(9);

    container.add([lineLeft, lineRight, label]);
  }

  private createActionScrollInput(layout: CampLayout) {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isPointerInsideActions(pointer, layout) || this.maxScrollY <= 0) {
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

      if (this.actionContainer) {
        this.actionContainer.y = -this.currentScrollY;
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
      this.time.delayedCall(0, () => {
        this.didDrag = false;
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
        if (!this.isPointerInsideActions(pointer, layout) || this.maxScrollY <= 0) {
          return;
        }

        this.targetScrollY = Phaser.Math.Clamp(
          this.targetScrollY + deltaY * 0.5,
          0,
          this.maxScrollY
        );
      }
    );
  }

  private isPointerInsideActions(pointer: Phaser.Input.Pointer, layout: CampLayout) {
    return (
      pointer.x >= layout.safeX &&
      pointer.x <= layout.width - layout.safeX &&
      pointer.y >= layout.actionsTop &&
      pointer.y <= layout.actionsBottom
    );
  }

  private createScrollHint(layout: CampLayout) {
    const hintY = layout.actionsBottom - 16;

    const bg = this.add.rectangle(layout.centerX, hintY, 236, 28, 0x000000, 0.44)
      .setDepth(250);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай список мест', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8e887b',
      align: 'center',
    }).setOrigin(0.5).setDepth(251);

    this.tweens.add({
      targets: [bg, text],
      alpha: 0.24,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private hasClaimableQuests() {
    return getQuests().some(quest => {
      return isQuestCompleted(quest) && !isQuestClaimed(quest.id);
    });
  }

  private getRestButtonText() {
    const cooldownLeft = this.getCampfireCooldownLeft();

    return cooldownLeft > 0
      ? `Костёр: ${this.formatCooldown(cooldownLeft)}`
      : 'Отдохнуть у костра';
  }

  private updateCampfireButtonText() {
    if (!this.restButtonLabel) {
      return;
    }

    this.restButtonLabel.setText(this.getRestButtonText());
  }

  private startCampfireTimer() {
    if (this.campfireTimerEvent) {
      this.campfireTimerEvent.remove(false);
    }

    this.updateCampfireButtonText();

    this.campfireTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.updateCampfireButtonText();
      },
    });
  }

  private createMainDungeonButton(config: {
    layout: CampLayout;
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    description: string;
    hasActiveRun: boolean;
    onClick: () => void;
  }) {
    const container = this.requireActionContainer();
    const accent = config.hasActiveRun ? 0x4d7c5c : 0x8c2f32;
    const titleColor = config.hasActiveRun ? '#8fc89b' : '#d2b87a';

    this.createRoundedPanel({
      parent: container,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 28,
      color: config.hasActiveRun ? 0x0b1712 : 0x17100d,
      alpha: 0.98,
      strokeColor: accent,
      strokeAlpha: 0.72,
      strokeWidth: 2,
      depth: 4,
    });

    const left = config.x - config.width / 2;
    const iconX = left + 48;
    const textX = left + 92;

    const ring = this.add.circle(iconX, config.y, 32, accent, 0.16)
      .setStrokeStyle(2, accent, 0.72)
      .setDepth(6);

    const icon = this.add.text(iconX, config.y, config.hasActiveRun ? '▼' : '☠', {
      fontFamily: UI.font.body,
      fontSize: '27px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(7);

    const titleText = this.add.text(textX, config.y - 21, config.title, {
      fontFamily: UI.font.title,
      fontSize: config.layout.compact ? '21px' : '24px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: config.width - 122,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7);

    const description = this.add.text(textX, config.y + 19, config.description, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: '#91887b',
      wordWrap: {
        width: config.width - 122,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0, 0.5).setDepth(7);

    container.add([ring, icon, titleText, description]);

    this.createClickZone({
      parent: container,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      onClick: config.onClick,
      titleText,
      normalColor: titleColor,
    });
  }

  private createCampTile(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    title: string;
    description: string;
    accentColor: number;
    highlighted?: boolean;
    onClick: () => void;
  }) {
    const container = this.requireActionContainer();
    const highlighted = config.highlighted ?? false;

    this.createRoundedPanel({
      parent: container,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 24,
      color: highlighted ? 0x0e1812 : 0x0d0d0f,
      alpha: highlighted ? 0.98 : 0.95,
      strokeColor: config.accentColor,
      strokeAlpha: highlighted ? 0.78 : 0.42,
      strokeWidth: highlighted ? 2 : 1,
      depth: 4,
    });

    const top = config.y - config.height / 2;
    const iconY = top + 25;
    const titleY = top + 54;
    const descY = top + 76;
    const titleColor = highlighted ? '#9fd0a6' : '#c9a86a';

    const iconBg = this.add.circle(config.x, iconY, 21, config.accentColor, 0.13)
      .setStrokeStyle(1, config.accentColor, 0.55)
      .setDepth(6);

    const icon = this.add.text(config.x, iconY, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7);

    const titleText = this.add.text(config.x, titleY, config.title, {
      fontFamily: UI.font.title,
      fontSize: '16px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: config.width - 18,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(7);

    const description = this.add.text(config.x, descY, config.description, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: '#8c8579',
      align: 'center',
      wordWrap: {
        width: config.width - 18,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(7);

    container.add([iconBg, icon, titleText, description]);

    this.createClickZone({
      parent: container,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      onClick: config.onClick,
      titleText,
      normalColor: titleColor,
    });

    if (highlighted) {
      this.tweens.add({
        targets: titleText,
        alpha: 0.55,
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private createWideActionButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    title: string;
    description: string;
    accentColor: number;
    danger?: boolean;
    onClick: () => void;
  }): CampActionButton {
    const container = this.requireActionContainer();
    const danger = config.danger ?? false;
    const titleColor = danger ? '#c76d68' : '#c9a86a';

    this.createRoundedPanel({
      parent: container,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 24,
      color: danger ? 0x1b0c0d : 0x0d0d0f,
      alpha: 0.96,
      strokeColor: config.accentColor,
      strokeAlpha: danger ? 0.68 : 0.44,
      strokeWidth: danger ? 2 : 1,
      depth: 4,
    });

    const left = config.x - config.width / 2;
    const iconX = left + 44;
    const textX = left + 82;

    const iconBg = this.add.circle(iconX, config.y, 24, config.accentColor, 0.13)
      .setStrokeStyle(1, config.accentColor, 0.55)
      .setDepth(6);

    const icon = this.add.text(iconX, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7);

    const titleText = this.add.text(textX, config.y - 15, config.title, {
      fontFamily: UI.font.title,
      fontSize: '18px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: config.width - 110,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(7);

    const description = this.add.text(textX, config.y + 16, config.description, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8d8578',
      wordWrap: {
        width: config.width - 110,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0, 0.5).setDepth(7);

    container.add([iconBg, icon, titleText, description]);

    this.createClickZone({
      parent: container,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      onClick: config.onClick,
      titleText,
      normalColor: titleColor,
    });

    return {
      titleText,
    };
  }

  private createClickZone(config: {
    parent?: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    onClick: () => void;
    titleText?: Phaser.GameObjects.Text;
    normalColor?: string;
  }) {
    const normalColor = config.normalColor ?? UI.colors.goldText;
    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(30)
      .setInteractive({
        useHandCursor: true,
      });

    if (config.parent) {
      config.parent.add(zone);
    }

    zone.on('pointerover', () => {
      config.titleText?.setColor('#eee1c6');
    });

    zone.on('pointerout', () => {
      config.titleText?.setColor(normalColor);
    });

    zone.on('pointerup', () => {
      if (this.didDrag) {
        return;
      }

      config.onClick();
    });

    return zone;
  }

  private createSmallBar(config: {
    x: number;
    y: number;
    width: number;
    label: string;
    value: string;
    progress: number;
    color: number;
  }) {
    const progress = Phaser.Math.Clamp(config.progress, 0, 1);
    const barHeight = 10;

    this.add.text(config.x - config.width / 2, config.y - 13, config.label, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8f887b',
    }).setOrigin(0, 0.5).setDepth(9);

    this.add.text(config.x + config.width / 2, config.y - 13, config.value, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#d1c7b4',
    }).setOrigin(1, 0.5).setDepth(9);

    this.add.rectangle(config.x, config.y + 8, config.width, barHeight, 0x030303, 0.92)
      .setDepth(8);

    this.add.rectangle(
      config.x - config.width / 2 + (config.width * progress) / 2,
      config.y + 8,
      config.width * progress,
      barHeight,
      config.color,
      0.88
    ).setDepth(9);

    this.add.rectangle(config.x, config.y + 8, config.width, barHeight)
      .setStrokeStyle(1, 0x5c503d, 0.5)
      .setDepth(10);
  }

  private createTinyResource(
    x: number,
    y: number,
    icon: string,
    value: string,
    width: number
  ) {
    this.createRoundedPanel({
      x,
      y,
      width,
      height: 34,
      radius: 15,
      color: 0x101012,
      alpha: 0.95,
      strokeColor: 0x4b4031,
      strokeAlpha: 0.42,
      strokeWidth: 1,
      depth: 8,
    });

    this.add.text(x - width / 2 + 31, y, icon, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: '#b99257',
    }).setOrigin(0.5).setDepth(10);

    this.add.text(x - width / 2 + 52, y, value, {
      fontFamily: UI.font.title,
      fontSize: '15px',
      color: '#d1c7b4',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: width - 62,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);
  }

  private createDarkTag(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    text: string;
    accentColor: number;
    depth: number;
  }) {
    this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: config.height / 2,
      color: 0x0d0d0f,
      alpha: 0.96,
      strokeColor: config.accentColor,
      strokeAlpha: 0.42,
      strokeWidth: 1,
      depth: config.depth,
    });

    const textX = config.icon ? config.x - config.width / 2 + 42 : config.x;
    const originX = config.icon ? 0 : 0.5;

    if (config.icon) {
      this.add.text(config.x - config.width / 2 + 24, config.y, config.icon, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: '#b99257',
      }).setOrigin(0.5).setDepth(config.depth + 2);
    }

    this.add.text(textX, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#9f9788',
      align: 'center',
      wordWrap: {
        width: config.icon ? config.width - 54 : config.width - 20,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(originX, 0.5).setDepth(config.depth + 2);
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

    if (config.parent) {
      config.parent.add([shadow, panel]);
    }

    return {
      shadow,
      panel,
    };
  }

  private requireActionContainer() {
    if (!this.actionContainer) {
      throw new Error('Camp action container was not created.');
    }

    return this.actionContainer;
  }

  private restAtCampfire() {
    const stats = getPlayerStats(player);

    const maxPotions = 6;
    const hpIsFull = player.hp >= stats.maxHp;
    const potionsAreFull = player.potions >= maxPotions;

    const cooldownLeft = this.getCampfireCooldownLeft();

    if (cooldownLeft > 0) {
      this.showMessage(
        'Костёр остывает',
        `Костёр можно использовать снова через ${this.formatCooldown(cooldownLeft)}.`
      );
      return;
    }

    if (hpIsFull && potionsAreFull) {
      this.showMessage(
        'Костёр не нужен',
        `HP уже полное, а зелий максимум: ${player.potions}/${maxPotions}.`
      );
      return;
    }

    player.hp = stats.maxHp;
    player.energy = stats.maxEnergy;
    player.potions = maxPotions;

    localStorage.setItem(
      this.CAMPFIRE_LAST_USE_KEY,
      String(Date.now())
    );

    void saveGameAsync();

    this.showMessage(
      'Отдых у костра',
      `HP полностью восстановлено.\nЗелья восстановлены до ${maxPotions}.\n\nКостёр снова будет доступен через 30 минут.`
    );
  }

  private getCampfireCooldownLeft() {
    const lastUse = Number(localStorage.getItem(this.CAMPFIRE_LAST_USE_KEY) ?? 0);

    if (!lastUse) {
      return 0;
    }

    const passed = Date.now() - lastUse;
    const left = this.CAMPFIRE_COOLDOWN_MS - passed;

    return Math.max(0, left);
  }

  private tryEnterCatacombs(hasActiveRun: boolean) {
    if (!player.raceId) {
      this.showMessage(
        'Герой не создан',
        'Нажми «Новая игра» внизу убежища и выбери расу перед первым спуском.'
      );
      return;
    }

    const stats = getPlayerStats(player);

    const hpPercent = stats.maxHp > 0
      ? player.hp / stats.maxHp
      : 1;

    if (hpPercent < 0.7) {
      this.showLowHpWarning(hasActiveRun);
      return;
    }

    if (hasActiveRun) {
      this.scene.start('DungeonScene');
      return;
    }

    this.scene.start('DungeonSelectScene');
  }

  private showLowHpWarning(hasActiveRun: boolean) {
    const layout = this.getLayout();
    const stats = getPlayerStats(player);

    const hpPercent = Math.round((player.hp / stats.maxHp) * 100);
    const cooldownLeft = this.getCampfireCooldownLeft();
    const canRest = cooldownLeft <= 0;

    const modal = this.createModalShell(layout, layout.compact ? 430 : 460);
    const centerY = layout.height / 2;

    const title = this.add.text(layout.centerX, centerY - 178, 'Ты ранен', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '28px' : '32px',
      color: '#c76d68',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 60,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(1002);

    const message = this.add.text(
      layout.centerX,
      centerY - 80,
      [
        `Здоровье: ${player.hp}/${stats.maxHp} HP`,
        `Осталось примерно ${hpPercent}% здоровья.`,
        '',
        'Перед спуском лучше отдохнуть у костра.',
        canRest
          ? 'Костёр сейчас доступен.'
          : `Костёр будет доступен через ${this.formatCooldown(cooldownLeft)}.`,
      ].join('\n'),
      {
        fontFamily: UI.font.body,
        fontSize: layout.compact ? '17px' : '19px',
        color: '#d1c7b4',
        align: 'center',
        lineSpacing: 6,
        wordWrap: {
          width: layout.contentWidth - 80,
          useAdvancedWrap: true,
        },
        maxLines: 7,
      }
    ).setOrigin(0.5).setDepth(1002);

    const buttonWidth = Math.min(layout.contentWidth - 120, 430);

    const closePopup = () => {
      modal.destroy();
      title.destroy();
      message.destroy();
      restButton.shadow.destroy();
      restButton.bg.destroy();
      restButton.label.destroy();
      continueButton.shadow.destroy();
      continueButton.bg.destroy();
      continueButton.label.destroy();
      cancelButton.shadow.destroy();
      cancelButton.bg.destroy();
      cancelButton.label.destroy();
    };

    const restButton = createButton(
      this,
      layout.centerX,
      centerY + 44,
      canRest ? 'Отдохнуть у костра' : 'Костёр недоступен',
      () => {
        if (!canRest) {
          return;
        }

        closePopup();
        this.restAtCampfire();
      },
      buttonWidth,
      52,
      {
        disabled: !canRest,
      }
    );

    this.setButtonDepth(restButton, 1001);

    const continueButton = createButton(
      this,
      layout.centerX,
      centerY + 108,
      'Всё равно идти',
      () => {
        if (hasActiveRun) {
          this.scene.start('DungeonScene');
          return;
        }

        this.scene.start('DungeonSelectScene');
      },
      buttonWidth,
      52,
      {
        danger: true,
      }
    );

    this.setButtonDepth(continueButton, 1001);

    const cancelButton = createButton(
      this,
      layout.centerX,
      centerY + 172,
      'Остаться в городе',
      () => {
        closePopup();
      },
      buttonWidth,
      52
    );

    this.setButtonDepth(cancelButton, 1001);
  }

  private formatCooldown(ms: number) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private returnToCampfireCheckpoint() {
    const result = restoreCampfireBattleCheckpoint();

    if (!result.success) {
      this.showMessage(
        'Костёр погас',
        `${result.message}\n\nВернуться к чекпоинту уже нельзя.`
      );

      return;
    }

    void saveGameAsync();

    this.scene.start('DungeonScene');
  }

  private showLeaveRunMessage() {
    const activeCheckpoint = getActiveCampfireBattleCheckpoint();

    this.showConfirmMessage(
      'Покинуть спуск?',
      activeCheckpoint
        ? 'Если выйти сейчас, текущий ярус придётся проходить заново. Чекпоинт костра тоже будет потерян.'
        : 'Если выйти сейчас, текущий ярус придётся проходить заново.',
      () => {
        resetFloorRun();
        clearCampfireBattleCheckpoint();

        void saveGameAsync();

        this.scene.restart();
      }
    );
  }

  private showNewGameConfirm() {
    this.showConfirmMessage(
      'Начать новую игру?',
      'Текущий прогресс будет удалён: герой, спуск, чекпоинт костра, магазин и временные награды. После подтверждения сразу откроется выбор расы, без перезагрузки.',
      () => {
        this.startNewGame();
      },
      'Новая игра'
    );
  }

  private startNewGame() {
    this.resetGameStateInMemory();
    clearCampfireBattleCheckpoint();
    this.clearLocalProgress();
    this.resetPlayerInMemory();

    CampScene.startupPrepared = true;
    CampScene.startupPromise = undefined;

    this.scene.start('RaceSelectScene');
  }

  private resetGameStateInMemory() {
    resetFloorRun();

    const state = gameState as typeof gameState & {
      highestClearedFloor?: number;
      highestClearedTier?: number;
      dungeonCampfireState?: unknown;
    };

    state.highestClearedFloor = 0;
    state.highestClearedTier = 0;
    state.dungeonCampfireState = undefined;
  }

  private clearLocalProgress() {
    const saveKeys = [
      'below_ashes_save_v3',
      'below_ashes_save_v2',
      'below_ashes_save_v1',
      'catacombs_save_v3',
      'catacombs_save_v2',
      'catacombs_save_v1',
      'catacombs_shop_assortment_v2',
      'catacombs_shop_assortment_v1',
      'campfire_battle_checkpoint_v1',
      'campfire_checkpoint_v1',
      'quest_state_v1',
      'quests_state_v1',
      'stats_tree_v1',
      'character_tree_v1',
      this.CAMPFIRE_LAST_USE_KEY,
      'start_gold_500_v1',
    ];

    saveKeys.forEach(key => {
      localStorage.removeItem(key);
    });
  }

  private resetPlayerInMemory() {
    Object.assign(player, {
      name: 'Безымянный',
      raceId: undefined,
      level: 1,
      exp: 0,
      expToNextLevel: 100,
      gold: 0,
      hp: 100,
      maxHp: 100,
      energy: 3,
      maxEnergy: 3,
      potions: 3,
      attack: 1,
      defense: 0,
      agility: 1,
      strength: 1,
      luck: 0,
      intelligence: 1,
      critChance: 0.1,
      inventory: [],
      equipment: {},
      relicIds: [],
      materials: {},
      anvilLevel: 1,
      characterTreePoints: 0,
      characterTree: {},
      upgradePoints: 0,
      totalUpgradePointsEarned: 0,
    });
  }

  private createModalShell(layout: CampLayout, height: number) {
    const modal = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add.rectangle(
      layout.centerX,
      layout.height / 2,
      layout.width,
      layout.height,
      0x000000,
      0.78
    ).setInteractive();

    const panelWidth = Math.min(layout.contentWidth, 620);
    const panelHeight = Math.min(height, layout.height - 120);

    const panel = this.add.rectangle(
      layout.centerX,
      layout.height / 2,
      panelWidth,
      panelHeight,
      0x101012,
      0.98
    ).setStrokeStyle(3, 0x6e5634, 0.85);

    modal.add([overlay, panel]);

    return {
      container: modal,
      destroy: () => {
        modal.destroy(true);
      },
    };
  }

  private showMessage(title: string, message: string) {
    const layout = this.getLayout();
    const modal = this.createModalShell(layout, 310);

    const titleText = this.add.text(layout.centerX, layout.height / 2 - 96, title, {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '26px' : '29px',
      color: '#c9a86a',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 80,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(1002);

    const messageText = this.add.text(layout.centerX, layout.height / 2 - 10, message, {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '17px' : '19px',
      color: '#d1c7b4',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 80,
        useAdvancedWrap: true,
      },
      maxLines: 6,
      lineSpacing: 7,
    }).setOrigin(0.5).setDepth(1002);

    const ok = createButton(
      this,
      layout.centerX,
      layout.height / 2 + 96,
      'Понятно',
      () => {
        modal.destroy();
        this.scene.restart();
      },
      260,
      54
    );

    this.setButtonDepth(ok, 1001);

    modal.container.add([
      titleText,
      messageText,
      ok.shadow,
      ok.bg,
      ok.label,
    ]);
  }

  private showConfirmMessage(
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Выйти'
  ) {
    const layout = this.getLayout();
    const modal = this.createModalShell(layout, 350);
    const centerY = layout.height / 2;

    const titleText = this.add.text(layout.centerX, centerY - 116, title, {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '26px' : '29px',
      color: '#c9a86a',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 80,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(1002);

    const messageText = this.add.text(layout.centerX, centerY - 34, message, {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '16px' : '18px',
      color: '#d1c7b4',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 80,
        useAdvancedWrap: true,
      },
      maxLines: 7,
      lineSpacing: 6,
    }).setOrigin(0.5).setDepth(1002);

    const buttonWidth = Math.min((layout.contentWidth - 90) / 2, 230);
    const leftX = layout.centerX - buttonWidth / 2 - 10;
    const rightX = layout.centerX + buttonWidth / 2 + 10;

    const cancel = createButton(
      this,
      leftX,
      centerY + 104,
      'Отмена',
      () => {
        modal.destroy();
      },
      buttonWidth,
      54
    );

    this.setButtonDepth(cancel, 1001);

    const confirm = createButton(
      this,
      rightX,
      centerY + 104,
      confirmText,
      () => {
        modal.destroy();
        onConfirm();
      },
      buttonWidth,
      54,
      {
        danger: true,
      }
    );

    this.setButtonDepth(confirm, 1001);

    modal.container.add([
      titleText,
      messageText,
      cancel.shadow,
      cancel.bg,
      cancel.label,
      confirm.shadow,
      confirm.bg,
      confirm.label,
    ]);
  }

  private setButtonDepth(
    button: {
      shadow: Phaser.GameObjects.GameObject & { setDepth: (depth: number) => unknown };
      bg: Phaser.GameObjects.GameObject & { setDepth: (depth: number) => unknown };
      label: Phaser.GameObjects.GameObject & { setDepth: (depth: number) => unknown };
    },
    baseDepth: number
  ) {
    button.shadow.setDepth(baseDepth);
    button.bg.setDepth(baseDepth + 1);
    button.label.setDepth(baseDepth + 2);
  }
}
