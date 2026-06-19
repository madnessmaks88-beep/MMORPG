import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState, resetFloorRun } from '../data/gameState';
import { getRaceById } from '../data/races';

import { addItemToInventory, getPlayerStats, restorePlayerVitalsToMaximum } from '../systems/InventorySystem';
import { loadGameAsync, saveGameAsync, startNewGameAsync } from '../systems/SaveSystem';
import { getCachedVKUser, getVKUser, initVKBridge } from '../systems/VKBridgeSystem';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';
import {
  canCompleteIdrisDaughterQuest,
  completeIdrisDaughterQuest,
  getIdrisDaughterQuestPreviewText,
} from '../systems/StoryEncounterSystem';

import {
  getActiveCampfireBattleCheckpoint,
  formatCheckpointTimeLeft,
  clearCampfireBattleCheckpoint,
} from '../systems/CampfireCheckpointSystem';
import { getMaterialName, type MaterialId } from '../data/materials';

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
  veryCompact: boolean;
};

type CampActionButton = {
  titleText: Phaser.GameObjects.Text;
  descriptionText: Phaser.GameObjects.Text;
};

type CityFlintType = 'common' | 'rare' | 'donate';

type CityCampfireState = {
  active: boolean;
  flintType: CityFlintType | null;
  startedAt: number;
  expiresAt: number | null;
};

type CampfirePlayer = typeof player & {
  rubyFlintUnlocked?: boolean;
  redRubyFlintUnlocked?: boolean;
  donorFlintUnlocked?: boolean;
  premiumFlintUnlocked?: boolean;
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

  private actionScrollTrack?: Phaser.GameObjects.Rectangle;
  private actionScrollThumb?: Phaser.GameObjects.Rectangle;

  private restButtonLabel?: Phaser.GameObjects.Text;
  private restButtonDescription?: Phaser.GameObjects.Text;
  private cityCampfireTimerText?: Phaser.GameObjects.Text;
  private cityCampfireWarmOverlay?: Phaser.GameObjects.Rectangle;
  private cityCampfireGlowObjects: Phaser.GameObjects.GameObject[] = [];
  private cityCampfireVisualTweens: Phaser.Tweens.Tween[] = [];
  private campfireTimerEvent?: Phaser.Time.TimerEvent;
  private cityCampfireIsVisuallyActive = false;

  private readonly CITY_CAMPFIRE_KEY = 'catacombs_city_campfire_v1';
  private readonly CITY_COMMON_FLINT_MS = 60 * 60 * 1000;
  private readonly CITY_RARE_FLINT_MS = 24 * 60 * 60 * 1000;

  constructor() {
    super('CampScene');
  }

  async create() {
    this.resetScrollState();

    const layout = this.getLayout();

    createSceneBackground(this);

    await this.prepareStartupOnce();
      
    this.grantStartGoldOnce();
    this.extinguishCityCampfireIfExpired();
      
    this.createCampBackdrop(layout);
    this.createCityCampfireVisualState(layout);

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
      this.cityCampfireVisualTweens.forEach(tween => tween.stop());
      this.cityCampfireVisualTweens = [];
    });
  }

  update() {
    if (!this.actionContainer) {
      return;
    }

    if (!this.isDragging) {
      if (Math.abs(this.currentScrollY - this.targetScrollY) < 0.5) {
        this.currentScrollY = this.targetScrollY;
      } else {
        this.currentScrollY = Phaser.Math.Linear(this.currentScrollY, this.targetScrollY, 0.22);
      }
    }

    this.actionContainer.y = -this.currentScrollY;
    this.updateActionScrollbar();
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
    this.actionScrollTrack = undefined;
    this.actionScrollThumb = undefined;
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

    const veryCompact = height < 760;
    const compact = height < 900;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.048), 16, 34);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.02), 14, 30);
    const safeBottom = veryCompact ? 92 : compact ? 104 : 116;
    const contentWidth = Math.min(width - safeX * 2, 620);
    const bottomNavTop = height - safeBottom;

    const headerHeight = veryCompact ? 82 : compact ? 94 : 112;
    const heroTop = safeTop + headerHeight + (veryCompact ? 8 : 10);
    const heroHeight = veryCompact ? 126 : compact ? 138 : 156;
    const actionsTop = heroTop + heroHeight + (veryCompact ? 10 : 14);
    const actionsBottom = bottomNavTop - (veryCompact ? 8 : 12);
    const actionsViewportHeight = Math.max(190, actionsBottom - actionsTop);

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
      veryCompact,
    };
  }

  private createCampBackdrop(layout: CampLayout) {
    const { width, height, centerX } = layout;
    const cryptY = Phaser.Math.Clamp(height * 0.31, 250, 380);
    const fireY = Phaser.Math.Clamp(height * 0.51, 330, 520);

    this.cameras.main.fadeIn(260, 0, 0, 0);

    this.add.rectangle(centerX, height / 2, width, height, 0x030405, 0.95).setDepth(0);
    this.add.rectangle(centerX, height * 0.28, width, height * 0.58, 0x07101a, 0.2).setDepth(0);
    this.add.rectangle(centerX, height - 140, width, 320, 0x030202, 0.7).setDepth(0);

    const farGlow = this.add.circle(centerX, cryptY + 12, width * 0.56, 0x1d2741, 0.13).setDepth(0);
    this.tweens.add({
      targets: farGlow,
      alpha: { from: 0.08, to: 0.16 },
      scale: { from: 0.98, to: 1.04 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const gateWidth = Math.min(layout.contentWidth * 0.76, 450);
    const gateHeight = layout.veryCompact ? 132 : layout.compact ? 154 : 184;
    const gateX = centerX;
    const gateY = cryptY + 26;

    this.add.rectangle(gateX, gateY + 35, gateWidth, gateHeight, 0x050608, 0.84)
      .setStrokeStyle(2, 0x332a20, 0.72)
      .setDepth(1);

    this.add.rectangle(gateX, gateY - gateHeight / 2 + 10, gateWidth + 30, 18, 0x18130e, 0.96)
      .setStrokeStyle(1, 0x6b5431, 0.58)
      .setDepth(2);

    this.add.rectangle(gateX, gateY + gateHeight / 2 + 36, gateWidth + 46, 24, 0x12100d, 0.96)
      .setStrokeStyle(1, 0x594d3d, 0.5)
      .setDepth(2);

    const columnOffset = gateWidth / 2 + 15;
    this.createStoneColumn(gateX - columnOffset, gateY + 18, gateHeight + 58);
    this.createStoneColumn(gateX + columnOffset, gateY + 18, gateHeight + 58);

    this.add.ellipse(gateX, gateY - 16, gateWidth * 0.68, gateHeight * 0.76, 0x17130f, 0.42)
      .setStrokeStyle(2, 0x4d4030, 0.32)
      .setDepth(2);

    const fireGlow = this.add.circle(centerX, fireY, width * 0.28, 0xb86b2e, 0.09).setDepth(2);
    const fireCore = this.add.circle(centerX, fireY + 8, 38, 0xb86b2e, 0.14).setDepth(2);

    this.tweens.add({
      targets: [fireGlow, fireCore],
      alpha: { from: 0.07, to: 0.18 },
      scale: { from: 0.94, to: 1.08 },
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.text(centerX, fireY, '♨', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '32px' : layout.compact ? '38px' : '46px',
      color: '#c09155',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(3);

    for (let i = 0; i < 24; i += 1) {
      const x = Phaser.Math.Between(layout.safeX, width - layout.safeX);
      const y = Phaser.Math.Between(layout.safeTop + 60, height - layout.safeBottom - 40);
      const ash = this.add.circle(x, y, Phaser.Math.Between(1, 2), i % 4 === 0 ? 0xb99257 : 0x8b8578, 0.045)
        .setDepth(1)
        .setAlpha(0.02);

      this.tweens.add({
        targets: ash,
        alpha: { from: 0.018, to: 0.075 },
        y: y - Phaser.Math.Between(16, 40),
        x: x + Phaser.Math.Between(-10, 10),
        duration: Phaser.Math.Between(1800, 3400),
        yoyo: true,
        repeat: -1,
        delay: i * 80,
        ease: 'Sine.easeInOut',
      });
    }

    for (let i = 0; i < 9; i += 1) {
      const y = layout.safeTop + 90 + i * 64;
      this.add.line(0, 0, layout.safeX, y, width - layout.safeX, y + (i % 2) * 12, 0x2a2119, 0.14)
        .setOrigin(0, 0)
        .setDepth(1);
    }

    this.add.text(centerX, cryptY - (layout.veryCompact ? 72 : 92), 'КАТАКОМБЫ', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '12px' : '15px',
      color: '#6f6655',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0.28).setDepth(2);
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

    const panel = this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: layout.veryCompact ? 22 : 28,
      color: 0x07080b,
      alpha: 0.9,
      strokeColor: 0x755a35,
      strokeAlpha: 0.58,
      strokeWidth: 2,
      depth: 8,
    });

    panel.shadow.setAlpha(0);
    panel.panel.setAlpha(0);

    const title = this.add.text(layout.centerX, panelY - (layout.veryCompact ? 24 : 32), 'Убежище у катакомб', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '22px' : layout.compact ? '26px' : '31px',
      color: '#d2b87a',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 36,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12).setAlpha(0).setY(panelY - (layout.veryCompact ? 31 : 40));

    const subtitle = this.add.text(layout.centerX, panelY + (layout.veryCompact ? 4 : 0), 'Последний огонь перед спуском во тьму', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '11px' : layout.compact ? '13px' : '15px',
      color: '#9a9385',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 58,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12).setAlpha(0);

    this.tweens.add({
      targets: [panel.shadow, panel.panel],
      alpha: 1,
      duration: 260,
      ease: 'Sine.easeOut',
    });

    this.tweens.add({
      targets: [title, subtitle],
      alpha: 1,
      y: '+=8',
      duration: 320,
      delay: 90,
      ease: 'Cubic.easeOut',
    });
  }

  private createPlayerLine(layout: CampLayout) {
    const vkUser = getCachedVKUser();
    const vkName = vkUser ? vkUser.first_name : 'локальный режим';
    const y = layout.safeTop + layout.headerHeight - (layout.veryCompact ? 16 : 22);
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
    const cityCampfireActive = this.isCityCampfireActive();

    const actionsPanel = this.createRoundedPanel({
      x: layout.centerX,
      y: layout.actionsTop + layout.actionsViewportHeight / 2,
      width: layout.contentWidth,
      height: layout.actionsViewportHeight,
      radius: layout.veryCompact ? 24 : 32,
      color: cityCampfireActive ? 0x0d0a08 : 0x06070a,
      alpha: cityCampfireActive ? 0.82 : 0.78,
      strokeColor: cityCampfireActive ? 0x8f6238 : 0x4b3928,
      strokeAlpha: cityCampfireActive ? 0.54 : 0.62,
      strokeWidth: 1,
      depth: 4,
    });

    actionsPanel.shadow.setAlpha(0);
    actionsPanel.panel.setAlpha(0);

    this.tweens.add({
      targets: [actionsPanel.shadow, actionsPanel.panel],
      alpha: 1,
      duration: 260,
      delay: 150,
      ease: 'Sine.easeOut',
    });

    const actionContainer = this.add.container(0, 0).setDepth(7);
    this.actionContainer = actionContainer;

    const maskGraphics = this.add.graphics();
    maskGraphics.setVisible(false);
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.fillRect(
      layout.safeX,
      layout.actionsTop,
      layout.width - layout.safeX * 2,
      layout.actionsViewportHeight
    );

    actionContainer.setMask(maskGraphics.createGeometryMask());

    const gap = layout.veryCompact ? 10 : layout.compact ? 12 : 14;
    const mainHeight = layout.veryCompact ? 82 : layout.compact ? 92 : 104;
    const wideHeight = layout.veryCompact ? 62 : layout.compact ? 68 : 74;
    const tileHeight = layout.veryCompact ? 78 : layout.compact ? 88 : 96;
    const dangerHeight = layout.veryCompact ? 58 : layout.compact ? 62 : 66;
    const innerWidth = layout.contentWidth - 44;
    const tileGap = 12;
    const tileWidth = Math.min((innerWidth - tileGap) / 2, 278);
    const leftX = layout.centerX - tileWidth / 2 - tileGap / 2;
    const rightX = layout.centerX + tileWidth / 2 + tileGap / 2;

    let currentY = layout.actionsTop + (layout.veryCompact ? 16 : 22);

    this.createSectionLabel(layout.centerX, currentY, innerWidth, 'Выход к глубинам');
    currentY += 24 + mainHeight / 2;

    const dungeonTitle = activeCheckpoint
      ? 'Выбрать костёр или ярус'
      : hasActiveRun
        ? 'Выбрать активный спуск'
        : 'Выбрать ярус';

    const dungeonDesc = activeCheckpoint
      ? `В выборе яруса доступен костёр: этаж ${activeCheckpoint.floor}. Осталось ${formatCheckpointTimeLeft(activeCheckpoint.expiresAt - Date.now())}.`
      : hasActiveRun
        ? `Есть активный спуск на этаже ${gameState.floorRun.currentFloor}. Открой выбор яруса.`
        : 'Открыть карту ярусов и начать спуск.';

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
        this.tryEnterCatacombs();
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

    currentY += tileHeight / 2 + gap;

    if (canCompleteIdrisDaughterQuest()) {
      currentY += wideHeight / 2;

      this.createWideActionButton({
        x: layout.centerX,
        y: currentY,
        width: innerWidth,
        height: wideHeight,
        icon: '♞',
        title: 'Дом Идриса',
        description: 'Передать амулет семье рыцаря и завершить тайную просьбу.',
        accentColor: 0xb89a5e,
        onClick: () => {
          this.showIdrisDaughterQuest();
        },
      });

      currentY += wideHeight / 2 + gap;
    }

    currentY += 8;

    this.createSectionLabel(layout.centerX, currentY, innerWidth, 'Подготовка');
    currentY += 24 + wideHeight / 2;

    const restCard = this.createWideActionButton({
      x: layout.centerX,
      y: currentY,
      width: innerWidth,
      height: wideHeight,
      icon: '♨',
      title: this.getCityCampfireButtonTitle(),
      description: this.getCityCampfireButtonDescription(),
      accentColor: this.isCityCampfireActive() ? 0xd28a3a : 0x6f5432,
      onClick: () => {
        this.restAtCampfire();
      },
    });

    this.restButtonLabel = restCard.titleText;
    this.restButtonDescription = restCard.descriptionText;
    this.createCityCampfireButtonFireEffect({
      x: layout.centerX,
      y: currentY,
      width: innerWidth,
      height: wideHeight,
    });
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
    this.createActionScrollbar(layout);

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

  private createCityCampfireButtonFireEffect(config: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    const container = this.requireActionContainer();
    const active = this.isCityCampfireActive();
    const left = config.x - config.width / 2;
    const iconX = left + 44;
    const fireY = config.y;
    const warmColor = active ? 0xd28a3a : 0x6f5432;

    const glow = this.add.circle(iconX, fireY, active ? 30 : 22, warmColor, active ? 0.16 : 0.07)
      .setDepth(10);
    const inner = this.add.circle(iconX, fireY + 2, active ? 18 : 14, active ? 0xffbd64 : 0x5a351d, active ? 0.22 : 0.1)
      .setDepth(11);
    const flame = this.add.text(iconX, fireY - 1, '♨', {
      fontFamily: UI.font.body,
      fontSize: active ? '21px' : '17px',
      color: active ? '#f4c475' : '#9b7043',
      stroke: '#000000',
      strokeThickness: active ? 3 : 3,
      align: 'center',
    }).setOrigin(0.5).setDepth(12).setAlpha(active ? 0.86 : 0.72);

    const warmLine = this.add.rectangle(
      config.x,
      config.y + config.height / 2 - 5,
      config.width - 48,
      1,
      0xd28a3a,
      active ? 0.18 : 0.05
    ).setDepth(9);

    container.add([glow, inner, flame, warmLine]);

    if (!active) {
      return;
    }

    this.tweens.add({
      targets: [glow, inner, flame, warmLine],
      alpha: '+=0.06',
      scale: { from: 0.98, to: 1.06 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    for (let i = 0; i < 6; i += 1) {
      const sparkX = iconX + Phaser.Math.Between(-12, 12);
      const sparkY = fireY + Phaser.Math.Between(-3, 12);
      const spark = this.add.circle(
        sparkX,
        sparkY,
        1,
        i % 2 === 0 ? 0xffd98a : 0xd28a3a,
        0
      ).setDepth(13);

      container.add(spark);

      this.tweens.add({
        targets: spark,
        alpha: { from: 0, to: 0.42 },
        y: sparkY - Phaser.Math.Between(16, 32),
        x: sparkX + Phaser.Math.Between(-8, 8),
        duration: Phaser.Math.Between(900, 1500),
        repeat: -1,
        delay: i * 140,
        ease: 'Sine.easeOut',
        onRepeat: () => {
          spark.setPosition(
            iconX + Phaser.Math.Between(-12, 12),
            fireY + Phaser.Math.Between(-3, 12)
          );
        },
      });
    }
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

  private createActionScrollbar(layout: CampLayout) {
    const trackHeight = Math.max(40, layout.actionsViewportHeight - 40);
    const x = layout.centerX + layout.contentWidth / 2 - 13;
    const y = layout.actionsTop + layout.actionsViewportHeight / 2;

    this.actionScrollTrack = this.add.rectangle(x, y, 4, trackHeight, 0x21170f, 0.5)
      .setDepth(18)
      .setVisible(this.maxScrollY > 0);

    this.actionScrollThumb = this.add.rectangle(x, layout.actionsTop + 24, 4, 28, 0xb89a5e, 0.82)
      .setDepth(19)
      .setVisible(this.maxScrollY > 0);

    this.updateActionScrollbar();
  }

  private updateActionScrollbar() {
    if (!this.actionScrollTrack || !this.actionScrollThumb) {
      return;
    }

    if (this.maxScrollY <= 0) {
      this.actionScrollTrack.setVisible(false);
      this.actionScrollThumb.setVisible(false);
      return;
    }

    this.actionScrollTrack.setVisible(true);
    this.actionScrollThumb.setVisible(true);

    const trackHeight = this.actionScrollTrack.height;
    const viewportHeight = this.getLayout().actionsViewportHeight;
    const contentHeight = viewportHeight + this.maxScrollY;
    const thumbHeight = Phaser.Math.Clamp((viewportHeight / Math.max(1, contentHeight)) * trackHeight, 24, trackHeight);
    const movementRange = Math.max(1, trackHeight - thumbHeight);
    const progress = this.currentScrollY / Math.max(1, this.maxScrollY);

    this.actionScrollThumb.setSize(this.actionScrollThumb.width, thumbHeight);
    this.actionScrollThumb.setY(this.actionScrollTrack.y - trackHeight / 2 + thumbHeight / 2 + movementRange * progress);
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

  private getCityCampfireButtonTitle() {
    return this.isCityCampfireActive()
      ? 'Отдохнуть у костра'
      : 'Зажечь костёр';
  }

  private getCityCampfireButtonDescription() {
    if (!this.isCityCampfireActive()) {
      return 'Скрафти обычное/среднее огниво или используй донатное, чтобы зажечь костёр.';
    }

    const state = this.getCityCampfireState();

    if (state.flintType === 'donate') {
      return 'Донатное огниво горит постоянно.';
    }

    return `Огонь активен ещё ${this.formatCityCampfireTimeLeft(this.getCityCampfireTimeLeft())}.`;
  }

  private updateCampfireButtonText() {
    this.extinguishCityCampfireIfExpired();

    this.restButtonLabel?.setText(this.getCityCampfireButtonTitle());
    this.restButtonDescription?.setText(this.getCityCampfireButtonDescription());

    if (this.cityCampfireTimerText) {
      const active = this.isCityCampfireActive();
      this.cityCampfireTimerText.setVisible(active);
      this.cityCampfireTimerText.setText(this.getCityCampfireTimerVisualText());
    }
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
        this.updateCityCampfireVisualState();
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

    if (config.hasActiveRun) {
      this.tweens.add({
        targets: [ring, titleText],
        alpha: { from: 0.72, to: 1 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
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

    const descriptionText = this.add.text(textX, config.y + 16, config.description, {
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

    container.add([iconBg, icon, titleText, descriptionText]);

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
      descriptionText,
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

    zone.on('pointerdown', () => {
      if (this.didDrag) {
        return;
      }

      this.tweens.add({
        targets: config.titleText,
        scaleX: 0.98,
        scaleY: 0.98,
        duration: 70,
        ease: 'Sine.easeOut',
      });
    });

    zone.on('pointerup', () => {
      this.tweens.add({
        targets: config.titleText,
        scaleX: 1,
        scaleY: 1,
        duration: 90,
        ease: 'Back.easeOut',
      });

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

  private getDefaultCityCampfireState(): CityCampfireState {
    return {
      active: false,
      flintType: null,
      startedAt: 0,
      expiresAt: null,
    };
  }

  private readLocalCityCampfireState(): CityCampfireState | null {
    try {
      const raw = localStorage.getItem(this.CITY_CAMPFIRE_KEY);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<CityCampfireState>;

      if (
        parsed.flintType !== 'common' &&
        parsed.flintType !== 'rare' &&
        parsed.flintType !== 'donate'
      ) {
        return null;
      }

      return {
        active: Boolean(parsed.active),
        flintType: parsed.flintType,
        startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : 0,
        expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null,
      };
    } catch {
      return null;
    }
  }

  private getCityCampfireState(): CityCampfireState {
    const current = gameState.cityCampfire as CityCampfireState | undefined;

    if (current && typeof current === 'object') {
      current.active = Boolean(current.active);

      if (
        current.flintType !== 'common' &&
        current.flintType !== 'rare' &&
        current.flintType !== 'donate'
      ) {
        current.flintType = null;
        current.active = false;
      }

      if (typeof current.startedAt !== 'number') {
        current.startedAt = 0;
      }

      if (current.expiresAt !== null && typeof current.expiresAt !== 'number') {
        current.expiresAt = null;
      }

      return current;
    }

    const localState = this.readLocalCityCampfireState();

    if (localState?.active) {
      gameState.cityCampfire = localState;
      void saveGameAsync();
      return gameState.cityCampfire;
    }

    gameState.cityCampfire = this.getDefaultCityCampfireState();
    return gameState.cityCampfire;
  }

  private saveCityCampfireState(state: CityCampfireState) {
    gameState.cityCampfire = {
      active: state.active,
      flintType: state.flintType,
      startedAt: state.startedAt,
      expiresAt: state.expiresAt,
    };

    try {
      localStorage.setItem(this.CITY_CAMPFIRE_KEY, JSON.stringify(gameState.cityCampfire));
    } catch {
      // localStorage не обязателен, основное сохранение теперь через saveGameAsync().
    }

    void saveGameAsync();
  }

  private clearCityCampfireState() {
    gameState.cityCampfire = this.getDefaultCityCampfireState();

    try {
      localStorage.removeItem(this.CITY_CAMPFIRE_KEY);
    } catch {
      // localStorage не обязателен.
    }

    void saveGameAsync();
  }

  private extinguishCityCampfireIfExpired() {
    const state = this.getCityCampfireState();

    if (!state.active) {
      return;
    }

    if (state.flintType === 'donate') {
      return;
    }

    if (typeof state.expiresAt !== 'number') {
      this.clearCityCampfireState();
      return;
    }

    if (Date.now() >= state.expiresAt) {
      this.clearCityCampfireState();
    }
  }

  private isCityCampfireActive() {
    return this.getCityCampfireState().active;
  }

  private getCityCampfireTimeLeft() {
    const state = this.getCityCampfireState();

    if (!state.active) {
      return 0;
    }

    if (state.flintType === 'donate' || state.expiresAt === null) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(0, state.expiresAt - Date.now());
  }

  private formatCityCampfireTimeLeft(ms: number) {
    if (!Number.isFinite(ms)) {
      return 'постоянно';
    }

    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours} ч ${minutes.toString().padStart(2, '0')} мин`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private getCityCampfireTimerVisualText() {
    const state = this.getCityCampfireState();

    if (!state.active) {
      return 'Городской костёр погас';
    }

    if (state.flintType === 'donate') {
      return 'Донатное огниво • огонь постоянный';
    }

    return `Городской костёр • ${this.formatCityCampfireTimeLeft(this.getCityCampfireTimeLeft())}`;
  }

  private igniteCityCampfire(flintType: CityFlintType) {
    if (!this.canSelectCityFlint(flintType)) {
      this.showMessage(
        'Огниво недоступно',
        flintType === 'donate'
          ? 'Донатное огниво доступно только после покупки/разблокировки. Обычное и редкое можно скрафтить из материалов.'
          : `Не хватает материалов для крафта: ${this.getCityFlintCostText(flintType)}.`
      );
      return;
    }

    if (flintType !== 'donate') {
      this.spendMaterials(this.getCityFlintCost(flintType));
    }

    const now = Date.now();
    const duration = flintType === 'common'
      ? this.CITY_COMMON_FLINT_MS
      : flintType === 'rare'
        ? this.CITY_RARE_FLINT_MS
        : null;

    const state: CityCampfireState = {
      active: true,
      flintType,
      startedAt: now,
      expiresAt: duration === null ? null : now + duration,
    };

    this.saveCityCampfireState(state);

    this.updateCampfireButtonText();
    this.createCityCampfireVisualState(this.getLayout());

    const title = this.getCityFlintTitle(flintType);
    const timeText = flintType === 'donate'
      ? 'Костёр будет гореть постоянно.'
      : `Костёр будет гореть ${this.formatCityCampfireTimeLeft(duration ?? 0)}.`;
    const costText = flintType === 'donate'
      ? 'Донатное огниво не тратит материалы.'
      : `Потрачено: ${this.getCityFlintCostText(flintType)}.`;

    this.showMessage(
      'Костёр зажжён',
      `${title} вспыхнуло в очаге.\n${timeText}\n${costText}\n\nУбежище стало заметно теплее и светлее. Отдых у костра теперь доступен.`
    );
  }

  private createCityCampfireVisualState(layout: CampLayout) {
    this.clearCityCampfireVisualObjects();

    const active = this.isCityCampfireActive();
    this.cityCampfireIsVisuallyActive = active;

    const { width, height, centerX } = layout;
    const glowY = Phaser.Math.Clamp(
      layout.heroTop + layout.heroHeight + (layout.veryCompact ? 16 : 24),
      layout.safeTop + 180,
      layout.actionsTop + 36
    );
    const warmAlpha = active ? 0.11 : 0.018;

    const overlay = this.add.rectangle(centerX, height / 2, width, height, 0xffa23d, 0)
      .setDepth(1.35);

    this.cityCampfireWarmOverlay = overlay;
    this.cityCampfireGlowObjects.push(overlay);

    this.tweens.add({
      targets: overlay,
      alpha: warmAlpha,
      duration: active ? 520 : 260,
      ease: 'Sine.easeOut',
    });

    const horizonGlow = this.add.rectangle(
      centerX,
      layout.actionsTop - 14,
      width,
      active ? 92 : 54,
      0xffb45b,
      active ? 0.045 : 0.012
    ).setDepth(1.55);

    const backLight = this.add.circle(
      centerX,
      glowY + 34,
      active ? width * 0.54 : width * 0.28,
      0xff9d3a,
      active ? 0.06 : 0.018
    ).setDepth(1.6);

    const outerGlow = this.add.circle(
      centerX,
      glowY,
      active ? 126 : 70,
      0xd98a3a,
      active ? 0.075 : 0.024
    ).setDepth(1.65);

    const midGlow = this.add.circle(
      centerX,
      glowY + 8,
      active ? 76 : 42,
      0xf0b35a,
      active ? 0.09 : 0.03
    ).setDepth(1.7);

    this.cityCampfireGlowObjects.push(horizonGlow, backLight, outerGlow, midGlow);

    if (active) {
      this.cityCampfireVisualTweens.push(
        this.tweens.add({
          targets: [horizonGlow, backLight, outerGlow, midGlow],
          alpha: '+=0.025',
          scale: { from: 0.98, to: 1.04 },
          duration: 1550,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      );

      for (let i = 0; i < 12; i += 1) {
        const sparkX = centerX + Phaser.Math.Between(-72, 72);
        const sparkY = glowY + Phaser.Math.Between(4, 42);
        const spark = this.add.circle(
          sparkX,
          sparkY,
          1,
          i % 3 === 0 ? 0xffd98a : 0xc98742,
          0
        ).setDepth(1.9);

        this.cityCampfireGlowObjects.push(spark);
        this.cityCampfireVisualTweens.push(
          this.tweens.add({
            targets: spark,
            alpha: { from: 0, to: 0.24 },
            y: sparkY - Phaser.Math.Between(34, 78),
            x: sparkX + Phaser.Math.Between(-18, 18),
            scale: { from: 0.55, to: 1 },
            duration: Phaser.Math.Between(1500, 2800),
            repeat: -1,
            delay: i * 140,
            ease: 'Sine.easeOut',
            onRepeat: () => {
              spark.setPosition(
                centerX + Phaser.Math.Between(-72, 72),
                glowY + Phaser.Math.Between(4, 42)
              );
            },
          })
        );
      }
    }
  }

  private clearCityCampfireVisualObjects() {
    this.cityCampfireVisualTweens.forEach(tween => tween.stop());
    this.cityCampfireVisualTweens = [];

    this.cityCampfireGlowObjects.forEach(object => object.destroy());
    this.cityCampfireGlowObjects = [];

    this.cityCampfireWarmOverlay = undefined;
    this.cityCampfireTimerText = undefined;
  }

  private updateCityCampfireVisualState() {
    const active = this.isCityCampfireActive();

    if (active !== this.cityCampfireIsVisuallyActive) {
      this.createCityCampfireVisualState(this.getLayout());
      return;
    }

    this.cityCampfireWarmOverlay?.setVisible(true);

    if (this.cityCampfireTimerText) {
      this.cityCampfireTimerText.setText(this.getCityCampfireTimerVisualText());
    }
  }

  private getCityFlintTitle(flintType: CityFlintType) {
    if (flintType === 'common') {
      return 'Обычное огниво';
    }

    if (flintType === 'rare') {
      return 'Среднее огниво';
    }

    return 'Донатное огниво';
  }

  private showCityFlintSelectionModal() {
    const layout = this.getLayout();
    const modalHeight = layout.veryCompact ? 520 : 570;
    const modal = this.createModalShell(layout, modalHeight);
    const panelHeight = Math.min(modalHeight, layout.height - 110);
    const top = layout.height / 2 - panelHeight / 2;
    const optionWidth = Math.min(layout.contentWidth - 52, 540);
    const optionHeight = layout.veryCompact ? 76 : 84;
    const gap = layout.veryCompact ? 10 : 12;
    const startY = top + (layout.veryCompact ? 128 : 142);

    const titleText = this.add.text(layout.centerX, top + 42, 'Выбери огниво', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '27px' : '31px',
      color: '#d8b36f',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 70,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(1002);

    const subtitle = this.add.text(
      layout.centerX,
      top + (layout.veryCompact ? 76 : 84),
      'Обычное и среднее огниво крафтятся из материалов. Донатное доступно только после разблокировки.',
      {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '12px' : '14px',
        color: '#b8aa91',
        align: 'center',
        lineSpacing: 4,
        wordWrap: {
          width: layout.contentWidth - 86,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }
    ).setOrigin(0.5).setDepth(1002);

    modal.container.add([titleText, subtitle]);

    const closeModal = () => {
      modal.destroy();
    };

    this.createCityFlintOption({
      modal: modal.container,
      x: layout.centerX,
      y: startY,
      width: optionWidth,
      height: optionHeight,
      flintType: 'common',
      title: 'Обычное огниво',
      description: 'Крафт. Горит 1 час.',
      accentColor: 0xd28a3a,
      closeModal,
    });

    this.createCityFlintOption({
      modal: modal.container,
      x: layout.centerX,
      y: startY + optionHeight + gap,
      width: optionWidth,
      height: optionHeight,
      flintType: 'rare',
      title: 'Среднее огниво',
      description: 'Крафт. Горит 24 часа.',
      accentColor: 0x70a6ff,
      closeModal,
    });

    this.createCityFlintOption({
      modal: modal.container,
      x: layout.centerX,
      y: startY + (optionHeight + gap) * 2,
      width: optionWidth,
      height: optionHeight,
      flintType: 'donate',
      title: 'Донатное огниво',
      description: 'Только за донат. Горит постоянно.',
      accentColor: 0xc084fc,
      closeModal,
    });

    const cancelY = top + panelHeight - (layout.veryCompact ? 42 : 48);
    const cancel = createButton(
      this,
      layout.centerX,
      cancelY,
      'Отмена',
      () => {
        modal.destroy();
      },
      Math.min(optionWidth, 360),
      52
    );

    this.setButtonDepth(cancel, 1001);
    modal.container.add([cancel.shadow, cancel.bg, cancel.label]);
  }

  private createCityFlintOption(config: {
    modal: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    flintType: CityFlintType;
    title: string;
    description: string;
    accentColor: number;
    closeModal: () => void;
  }) {
    const radius = 22;
    const left = config.x - config.width / 2;
    const iconX = left + 42;
    const textX = left + 82;
    const canSelect = this.canSelectCityFlint(config.flintType);
    const costText = this.getCityFlintCostText(config.flintType);
    const buttonText = canSelect
      ? 'Зажечь'
      : config.flintType === 'donate'
        ? 'Донат'
        : 'Нет рес.';

    const shadow = this.add.graphics().setDepth(1002);
    shadow.fillStyle(0x000000, 0.35);
    shadow.fillRoundedRect(left, config.y - config.height / 2 + 5, config.width, config.height, radius);

    const bg = this.add.graphics().setDepth(1003);
    const drawBg = (fillColor: number, strokeAlpha: number, fillAlpha = 0.96) => {
      bg.clear();
      bg.fillStyle(fillColor, canSelect ? fillAlpha : 0.68);
      bg.fillRoundedRect(left, config.y - config.height / 2, config.width, config.height, radius);
      bg.lineStyle(2, config.accentColor, canSelect ? strokeAlpha : 0.28);
      bg.strokeRoundedRect(left, config.y - config.height / 2, config.width, config.height, radius);
    };

    drawBg(canSelect ? 0x120d0a : 0x0a0a0c, 0.72);

    const iconGlow = this.add.circle(iconX, config.y, 25, config.accentColor, canSelect ? 0.15 : 0.05)
      .setStrokeStyle(1, config.accentColor, canSelect ? 0.55 : 0.22)
      .setDepth(1004);

    const icon = this.add.text(iconX, config.y, config.flintType === 'donate' ? '✦' : config.flintType === 'rare' ? '◆' : '◇', {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: canSelect
        ? config.flintType === 'donate' ? '#d7b7ff' : '#f0c17d'
        : '#6b6258',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(1005);

    const title = this.add.text(textX, config.y - 25, config.title, {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: canSelect ? '#d8c088' : '#766d62',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: config.width - 168,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(1005);

    const description = this.add.text(textX, config.y + 1, config.description, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: canSelect ? '#b8aa91' : '#6f665b',
      wordWrap: {
        width: config.width - 168,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(1005);

    const cost = this.add.text(textX, config.y + 25, costText, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: canSelect ? '#8f877a' : '#c4877f',
      wordWrap: {
        width: config.width - 168,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(1005);

    const action = this.add.text(left + config.width - 50, config.y, buttonText, {
      fontFamily: UI.font.title,
      fontSize: '12px',
      color: canSelect ? '#f0d58a' : '#7d6860',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: 78,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(1005);

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(1006)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      drawBg(canSelect ? 0x21150f : 0x101010, canSelect ? 0.96 : 0.32);
      if (canSelect) {
        title.setColor('#ffffff');
        action.setColor('#ffffff');
      }
    });

    zone.on('pointerout', () => {
      drawBg(canSelect ? 0x120d0a : 0x0a0a0c, 0.72);
      title.setColor(canSelect ? '#d8c088' : '#766d62');
      action.setColor(canSelect ? '#f0d58a' : '#7d6860');
      config.modal.setScale(1);
    });

    zone.on('pointerdown', () => {
      drawBg(canSelect ? 0x2a1a10 : 0x101010, 1);
      config.modal.setScale(0.99);
    });

    zone.on('pointerup', () => {
      config.modal.setScale(1);

      if (!canSelect) {
        this.showMessage(
          'Огниво недоступно',
          config.flintType === 'donate'
            ? 'Донатное огниво можно зажечь только после покупки/разблокировки.'
            : `Не хватает материалов для крафта. Нужно: ${costText}.`
        );
        return;
      }

      config.closeModal();
      this.igniteCityCampfire(config.flintType);
    });

    zone.on('pointerupoutside', () => {
      config.modal.setScale(1);
      drawBg(canSelect ? 0x120d0a : 0x0a0a0c, 0.72);
    });

    config.modal.add([shadow, bg, iconGlow, icon, title, description, cost, action, zone]);
  }

  private canSelectCityFlint(flintType: CityFlintType) {
    if (flintType === 'donate') {
      return this.hasDonateCityFlintUnlocked();
    }

    return this.hasMaterials(this.getCityFlintCost(flintType));
  }

  private getCityFlintCost(flintType: CityFlintType): Array<{ id: MaterialId; amount: number }> {
    if (flintType === 'common') {
      return [
        { id: 'darkened_bone', amount: 2 },
        { id: 'dim_gem', amount: 1 },
        { id: 'old_leather', amount: 1 },
      ];
    }

    if (flintType === 'rare') {
      return [
        { id: 'darkened_bone', amount: 3 },
        { id: 'dim_gem', amount: 2 },
        { id: 'black_gem', amount: 1 },
        { id: 'cursed_seal', amount: 1 },
      ];
    }

    return [];
  }

  private getCityFlintCostText(flintType: CityFlintType) {
    if (flintType === 'donate') {
      return this.hasDonateCityFlintUnlocked()
        ? 'Донатное огниво разблокировано'
        : 'Только после доната';
    }

    const cost = this.getCityFlintCost(flintType);

    return cost
      .map(material => `${getMaterialName(material.id)} x${material.amount}`)
      .join(' • ');
  }

  private hasDonateCityFlintUnlocked() {
    const campfirePlayer = player as CampfirePlayer;

    return Boolean(
      campfirePlayer.rubyFlintUnlocked ||
      campfirePlayer.redRubyFlintUnlocked ||
      campfirePlayer.donorFlintUnlocked ||
      campfirePlayer.premiumFlintUnlocked
    );
  }

  private hasMaterials(cost: Array<{ id: MaterialId; amount: number }>) {
    return cost.every(material => {
      return (player.materials[material.id] ?? 0) >= material.amount;
    });
  }

  private spendMaterials(cost: Array<{ id: MaterialId; amount: number }>) {
    cost.forEach(material => {
      player.materials[material.id] = Math.max(
        0,
        (player.materials[material.id] ?? 0) - material.amount
      );
    });
  }

  private restAtCampfire() {
    if (!this.isCityCampfireActive()) {
      this.showCityFlintSelectionModal();
      return;
    }

    const stats = getPlayerStats(player);
    const maxPotions = 6;
    const hpIsFull = player.hp >= stats.maxHp;
    const energyIsFull = player.energy >= stats.maxEnergy;
    const potionsAreFull = player.potions >= maxPotions;

    if (hpIsFull && energyIsFull && potionsAreFull) {
      this.showMessage(
        'Костёр не нужен',
        `HP и энергия уже полные, а зелий максимум: ${player.potions}/${maxPotions}.\n\nОгонь продолжает гореть.`
      );
      return;
    }

    restorePlayerVitalsToMaximum(player, maxPotions);
    player.hp = stats.maxHp;
    player.energy = stats.maxEnergy;
    player.potions = maxPotions;

    void saveGameAsync();

    this.showMessage(
      'Отдых у костра',
      [
        'HP полностью восстановлено.',
        'Энергия полностью восстановлена.',
        `Зелья восстановлены до ${maxPotions}.`,
        '',
        this.getCityCampfireButtonDescription(),
      ].join('\n')
    );
  }

  private tryEnterCatacombs() {
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
      this.showLowHpWarning();
      return;
    }

    this.scene.start('DungeonSelectScene');
  }


  private showIdrisDaughterQuest() {
    this.showConfirmMessage(
      'Дом Идриса',
      `${getIdrisDaughterQuestPreviewText()}\n\nПередать амулет и завершить просьбу?`,
      () => {
        const result = completeIdrisDaughterQuest();

        if (!result.completed) {
          this.showMessage('Просьба недоступна', 'Амулет Идриса уже передан или просьба больше не может быть завершена.');
          return;
        }

        player.gold += 650;
        addItemToInventory(player, 'idris_last_amulet');
        addItemToInventory(player, 'idris_oath_armor');

        void saveGameAsync();

        this.showMessage(
          'Дочь Идриса спасена',
          [
            'Ты сказал, что Идрис ушёл в дальние глубины искать свет, которого здесь давно нет.',
            'Мать молчала, но не стала спрашивать правду.',
            '',
            'Девочка сжала амулет, и на мгновение в комнате стало теплее.',
            '',
            '+650 золота',
            'Получено: Амулет последнего огонька',
            'Получено: Доспех Идриса',
            'Открыта секретная аватарка: Идрис',
          ].join('\n')
        );
      },
      'Передать'
    );
  }

  private showLowHpWarning() {
    const layout = this.getLayout();
    const stats = getPlayerStats(player);

    const hpPercent = Math.round((player.hp / stats.maxHp) * 100);
    const canRest = this.isCityCampfireActive();

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
          ? this.getCityCampfireButtonDescription()
          : 'Сначала нужно зажечь городской костёр через огниво.',
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
      canRest ? 'Отдохнуть у костра' : 'Зажечь костёр',
      () => {
        closePopup();

        if (!canRest) {
          this.showCityFlintSelectionModal();
          return;
        }

        this.restAtCampfire();
      },
      buttonWidth,
      52
    );

    this.setButtonDepth(restButton, 1001);

    const continueButton = createButton(
      this,
      layout.centerX,
      centerY + 108,
      'Всё равно идти',
      () => {
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

  private async startNewGame() {
    this.resetGameStateInMemory();
    clearCampfireBattleCheckpoint();
    this.clearLocalProgress();
    this.resetPlayerInMemory();

    await startNewGameAsync();

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
      'below_ashes_save_v3_local_backup',
      'below_ashes_save_v3_last_good',
      'below_ashes_save_v2',
      'below_ashes_save_v1',
      'catacombs_save_v3',
      'catacombs_save_v2',
      'catacombs_save_v1',
      'catacombs_shop_assortment_v3',
      'catacombs_shop_assortment_v2',
      'catacombs_shop_assortment_v1',
      'below_ashes_campfire_battle_checkpoint_v1',
      'campfire_battle_checkpoint_v1',
      'campfire_checkpoint_v1',
      'quest_state_v1',
      'quests_state_v1',
      'stats_tree_v1',
      'character_tree_v1',
      this.CITY_CAMPFIRE_KEY,
      'campfire_last_rest_at',
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
      potions: 6,
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
    ).setInteractive().setAlpha(0);

    const panelWidth = Math.min(layout.contentWidth, 620);
    const panelHeight = Math.min(height, layout.height - 110);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.42);
    shadow.fillRoundedRect(
      layout.centerX - panelWidth / 2,
      layout.height / 2 - panelHeight / 2 + 9,
      panelWidth,
      panelHeight,
      28
    );

    const panel = this.add.graphics();
    panel.fillStyle(0x0c0d10, 0.98);
    panel.fillRoundedRect(
      layout.centerX - panelWidth / 2,
      layout.height / 2 - panelHeight / 2,
      panelWidth,
      panelHeight,
      28
    );
    panel.lineStyle(3, 0x6e5634, 0.85);
    panel.strokeRoundedRect(
      layout.centerX - panelWidth / 2,
      layout.height / 2 - panelHeight / 2,
      panelWidth,
      panelHeight,
      28
    );

    const glow = this.add.rectangle(layout.centerX, layout.height / 2 - panelHeight / 2 + 18, panelWidth - 54, 1, 0xb89a5e, 0.32);

    modal.add([overlay, shadow, panel, glow]);
    modal.setScale(0.96);
    modal.setAlpha(0);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 160,
      ease: 'Sine.easeOut',
    });

    this.tweens.add({
      targets: modal,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });

    return {
      container: modal,
      destroy: () => {
        this.tweens.add({
          targets: modal,
          alpha: 0,
          scale: 0.97,
          duration: 120,
          ease: 'Sine.easeIn',
          onComplete: () => {
            modal.destroy(true);
          },
        });
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
