import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getRaceById } from '../data/races';

import { getPlayerStats, restorePlayerVitalsToMaximum } from '../systems/InventorySystem';
import { loadGameAsync, saveGameAsync } from '../systems/SaveSystem';
import {
  SANITY_COST_PER_FLOOR,
  getSanityTimeToFullMs,
  hasEnoughSanityForFloor,
  restoreSanityByTime,
} from '../systems/SanitySystem';
import { getCachedVKUser, getVKUser, initVKBridge } from '../systems/VKBridgeSystem';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';
import { getActiveCampfireBattleCheckpoint } from '../systems/CampfireCheckpointSystem';
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
  actionsHeight: number;

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

  private restButtonLabel?: Phaser.GameObjects.Text;
  private restButtonDescription?: Phaser.GameObjects.Text;
  private cityCampfireWarmOverlay?: Phaser.GameObjects.Rectangle;
  private cityCampfireGlowObjects: Phaser.GameObjects.GameObject[] = [];
  private cityCampfireVisualTweens: Phaser.Tweens.Tween[] = [];
  private campfireTimerEvent?: Phaser.Time.TimerEvent;
  private sanityTimerEvent?: Phaser.Time.TimerEvent;
  private sanityValueText?: Phaser.GameObjects.Text;
  private sanityHintText?: Phaser.GameObjects.Text;
  private sanityFill?: Phaser.GameObjects.Rectangle;
  private sanityFillWidth = 0;
  private cityCampfireIsVisuallyActive = false;

  private readonly CITY_CAMPFIRE_KEY = 'catacombs_city_campfire_v1';
  private readonly CITY_COMMON_FLINT_MS = 60 * 60 * 1000;
  private readonly CITY_RARE_FLINT_MS = 24 * 60 * 60 * 1000;

  constructor() {
    super('CampScene');
  }

  async create() {
    const layout = this.getLayout();

    createSceneBackground(this);

    await this.prepareStartupOnce();
      
    this.grantStartGoldOnce();
    this.extinguishCityCampfireIfExpired();
    this.restoreSanityAndSaveIfValueChanged();
      
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
      this.sanityTimerEvent?.remove(false);
      this.sanityTimerEvent = undefined;
      this.cityCampfireVisualTweens.forEach(tween => tween.stop());
      this.cityCampfireVisualTweens = [];
      this.sanityValueText = undefined;
      this.sanityHintText = undefined;
      this.sanityFill = undefined;
    });
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
    const heroHeight = veryCompact ? 164 : compact ? 178 : 196;
    const actionsTop = heroTop + heroHeight + (veryCompact ? 12 : 16);
    const actionsBottom = bottomNavTop - (veryCompact ? 16 : 20);
    const actionsHeight = Math.max(206, actionsBottom - actionsTop);

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
      actionsHeight,

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

    const shrineX = centerX + Math.min(layout.contentWidth * 0.27, 138);
    const shrineY = fireY + (layout.veryCompact ? 6 : 2);
    const shrineGlow = this.add.circle(shrineX, shrineY - 22, layout.veryCompact ? 46 : 56, 0x6b4a8c, 0.09)
      .setDepth(2);
    const shrineRune = this.add.text(shrineX, shrineY - 6, '✦', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '16px' : '19px',
      color: '#d6c08a',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0.56).setDepth(3);

    this.tweens.add({
      targets: [shrineGlow, shrineRune],
      alpha: { from: 0.07, to: 0.18 },
      scale: { from: 0.97, to: 1.05 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

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

    const barY = top + layout.heroHeight - (layout.veryCompact ? 94 : 104);
    const barGap = layout.veryCompact ? 10 : 16;
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

    this.createSanityBar({
      x: layout.centerX,
      y: top + layout.heroHeight - (layout.veryCompact ? 58 : 66),
      width: Math.min(layout.contentWidth - 56, 520),
    });

    const resourceY = top + layout.heroHeight - 19;
    const resourceWidth = Math.min((layout.contentWidth - 52) / 3, 150);

    this.createTinyResource(layout.centerX - resourceWidth - 8, resourceY, '◆', `${player.gold}`, resourceWidth);
    this.createTinyResource(layout.centerX, resourceY, '✚', `${player.potions}`, resourceWidth);
    this.createTinyResource(layout.centerX + resourceWidth + 8, resourceY, '★', `${player.relicIds.length}`, resourceWidth);

    this.startSanityTimer();
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
    const ascensionPoints = this.getAvailableAscensionPoints();
    const hasAscensionPoints = ascensionPoints > 0;

    const panelHeight = layout.actionsHeight;
    const panelY = layout.actionsTop + panelHeight / 2;

    const panel = this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: layout.veryCompact ? 12 : 16,
      color: cityCampfireActive ? 0x0d0a08 : 0x050609,
      alpha: cityCampfireActive ? 0.9 : 0.86,
      strokeColor: cityCampfireActive ? 0x8f6238 : 0x5b4932,
      strokeAlpha: cityCampfireActive ? 0.72 : 0.58,
      strokeWidth: 1,
      depth: 4,
    });

    const runeTop = this.add.rectangle(
      layout.centerX,
      layout.actionsTop + 8,
      layout.contentWidth - 34,
      1,
      cityCampfireActive ? 0xd28a3a : 0xb9985b,
      cityCampfireActive ? 0.22 : 0.13
    ).setDepth(6);

    const runeBottom = this.add.rectangle(
      layout.centerX,
      layout.actionsBottom - 8,
      layout.contentWidth - 34,
      1,
      0x6e5634,
      0.16
    ).setDepth(6);

    const pad = layout.veryCompact ? 10 : layout.compact ? 12 : 14;
    const gap = layout.veryCompact ? 7 : layout.compact ? 8 : 10;
    const innerWidth = layout.contentWidth - pad * 2;
    const availableHeight = Math.max(180, panelHeight - pad * 2);
    const primaryHeight = Phaser.Math.Clamp(
      Math.round(availableHeight * (layout.veryCompact ? 0.23 : 0.25)),
      layout.veryCompact ? 52 : 60,
      layout.veryCompact ? 62 : layout.compact ? 74 : 82
    );
    const gridHeight = availableHeight - primaryHeight - gap;
    const tileGap = layout.veryCompact ? 7 : 9;
    const tileHeight = Phaser.Math.Clamp(
      Math.floor((gridHeight - tileGap * 2) / 3),
      layout.veryCompact ? 44 : 54,
      layout.veryCompact ? 62 : layout.compact ? 88 : 96
    );
    const contentGroupHeight = primaryHeight + gap + tileHeight * 3 + tileGap * 2;
    const verticalPad = Math.max(pad, Math.floor((panelHeight - contentGroupHeight) / 2));
    const tileWidth = Math.floor((innerWidth - tileGap) / 2);
    const leftX = layout.centerX - tileWidth / 2 - tileGap / 2;
    const rightX = layout.centerX + tileWidth / 2 + tileGap / 2;
    const primaryY = layout.actionsTop + verticalPad + primaryHeight / 2;
    const firstRowY = primaryY + primaryHeight / 2 + gap + tileHeight / 2;

    const dungeonTitle = hasActiveRun || hasActiveCheckpoint
      ? 'Продолжить спуск'
      : 'Вход в подземелье';

    const dungeonStatus = activeCheckpoint
      ? `Костёр: эт. ${activeCheckpoint.floor}`
      : hasActiveRun
        ? `Этаж ${gameState.floorRun.currentFloor}`
        : hasEnoughSanityForFloor()
          ? `Рассудок -${SANITY_COST_PER_FLOOR}`
          : 'Мало рассудка';

    this.createPrimaryDungeonPlate({
      layout,
      x: layout.centerX,
      y: primaryY,
      width: innerWidth,
      height: primaryHeight,
      title: dungeonTitle,
      status: dungeonStatus,
      highlighted: hasActiveRun || hasActiveCheckpoint,
      onClick: () => {
        this.tryEnterCatacombs();
      },
      delay: 140,
    });

    const tiles = [
      {
        x: leftX,
        y: firstRowY,
        icon: '♨',
        title: 'Костёр',
        status: this.getCityCampfireButtonStatus(),
        accentColor: cityCampfireActive ? 0xd28a3a : 0x7b5632,
        highlighted: cityCampfireActive,
        onClick: () => {
          this.restAtCampfire();
        },
      },
      {
        x: rightX,
        y: firstRowY,
        icon: hasAscensionPoints ? '!' : '✦',
        title: 'Храм',
        status: hasAscensionPoints ? `${ascensionPoints} очк.` : 'Древо силы',
        accentColor: hasAscensionPoints ? 0xd6c08a : 0x6b4a8c,
        highlighted: hasAscensionPoints,
        onClick: () => {
          this.scene.start('StatsTreeScene');
        },
      },
      {
        x: leftX,
        y: firstRowY + tileHeight + tileGap,
        icon: '☕',
        title: 'Таверна',
        status: 'Отдых',
        accentColor: 0x7a6040,
        highlighted: false,
        onClick: () => {
          this.scene.start('TavernScene');
        },
      },
      {
        x: rightX,
        y: firstRowY + tileHeight + tileGap,
        icon: hasQuestReward ? '!' : '◆',
        title: 'Задания',
        status: hasQuestReward ? 'Есть награда' : 'Награды',
        accentColor: hasQuestReward ? 0x6d875e : 0x6f5635,
        highlighted: hasQuestReward,
        onClick: () => {
          this.scene.start('QuestScene');
        },
      },
      {
        x: leftX,
        y: firstRowY + (tileHeight + tileGap) * 2,
        icon: '▣',
        title: 'Рынок',
        status: 'Торговцы',
        accentColor: 0xb89a5e,
        highlighted: false,
        onClick: () => {
          this.scene.start('MarketScene');
        },
      },
      {
        x: rightX,
        y: firstRowY + (tileHeight + tileGap) * 2,
        icon: '⌂',
        title: 'Дом',
        status: 'Убежище',
        accentColor: 0x8b7652,
        highlighted: false,
        onClick: () => {
          this.scene.start('HomeScene');
        },
      },
    ];

    tiles.forEach((tile, index) => {
      const createdTile = this.createStoneActionTile({
        layout,
        x: tile.x,
        y: tile.y,
        width: tileWidth,
        height: tileHeight,
        icon: tile.icon,
        title: tile.title,
        status: tile.status,
        accentColor: tile.accentColor,
        highlighted: tile.highlighted,
        onClick: tile.onClick,
        delay: 190 + index * 45,
      });

      if (tile.title === 'Костёр') {
        this.restButtonLabel = createdTile.titleText;
        this.restButtonDescription = createdTile.descriptionText;
      }
    });

    this.tweens.add({
      targets: [panel.shadow, panel.panel, runeTop, runeBottom],
      alpha: { from: 0, to: 1 },
      duration: 260,
      delay: 90,
      ease: 'Sine.easeOut',
    });

    this.startCampfireTimer();
  }

  private createPrimaryDungeonPlate(config: {
    layout: CampLayout;
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    status: string;
    highlighted: boolean;
    onClick: () => void;
    delay: number;
  }) {
    const accent = config.highlighted ? 0x4d7c5c : 0x8c2f32;
    const titleColor = config.highlighted ? '#a7dfad' : '#d9bd7a';
    const left = config.x - config.width / 2;
    const iconSize = config.height <= 58 ? 28 : 34;
    const iconX = left + Phaser.Math.Clamp(Math.round(config.height * 0.56), 34, 52);
    const textX = left + Phaser.Math.Clamp(Math.round(config.height * 1.02), 64, 88);
    const textWidth = Math.max(170, config.width - (textX - left) - 30);

    const panel = this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: config.layout.veryCompact ? 8 : 10,
      color: config.highlighted ? 0x0b1712 : 0x150d0c,
      alpha: 0.98,
      strokeColor: accent,
      strokeAlpha: config.highlighted ? 0.84 : 0.74,
      strokeWidth: 2,
      depth: 8,
    });

    const glow = this.add.circle(iconX, config.y, iconSize + 8, accent, config.highlighted ? 0.18 : 0.1)
      .setDepth(10);
    const iconFrame = this.add.rectangle(iconX, config.y, iconSize + 12, iconSize + 12, 0x050505, 0.26)
      .setStrokeStyle(1, accent, 0.58)
      .setDepth(11);
    const icon = this.add.text(iconX, config.y, config.highlighted ? '▼' : '☠', {
      fontFamily: UI.font.body,
      fontSize: config.height <= 58 ? '21px' : '25px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(12);

    const titleText = this.add.text(textX, config.y - config.height * 0.16, config.title, {
      fontFamily: UI.font.title,
      fontSize: config.layout.veryCompact ? '17px' : config.layout.compact ? '21px' : '23px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(12);

    const statusText = this.add.text(textX, config.y + config.height * 0.18, config.status, {
      fontFamily: UI.font.body,
      fontSize: config.layout.veryCompact ? '10px' : '12px',
      color: '#a09688',
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(12);

    const topRune = this.add.rectangle(config.x, config.y - config.height / 2 + 6, config.width - 36, 1, accent, 0.22)
      .setDepth(11);
    const bottomRune = this.add.rectangle(config.x, config.y + config.height / 2 - 6, config.width - 36, 2, accent, config.highlighted ? 0.28 : 0.18)
      .setDepth(11);

    const cornerMarks = this.createActionCornerMarks(config.x, config.y, config.width, config.height, accent, 0.74, 12);

    const objects = [panel.shadow, panel.panel, glow, iconFrame, icon, titleText, statusText, topRune, bottomRune, ...cornerMarks];
    this.playActionIntro(objects, config.delay);
    this.createActionPressZone({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      onClick: config.onClick,
      titleText,
      normalColor: titleColor,
      pressTargets: [glow, icon, titleText, statusText, iconFrame],
    });

    this.tweens.add({
      targets: [glow, bottomRune],
      alpha: config.highlighted ? '+=0.08' : '+=0.04',
      scale: { from: 0.98, to: config.highlighted ? 1.06 : 1.03 },
      duration: config.highlighted ? 900 : 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createStoneActionTile(config: {
    layout: CampLayout;
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    title: string;
    status: string;
    accentColor: number;
    highlighted: boolean;
    onClick: () => void;
    delay: number;
  }): CampActionButton {
    const titleColor = config.highlighted ? '#e5d08d' : '#cdb682';
    const left = config.x - config.width / 2;
    const iconBox = Phaser.Math.Clamp(config.height - 18, 28, 42);
    const iconX = left + iconBox / 2 + 9;
    const textX = left + iconBox + 18;
    const textWidth = Math.max(72, config.width - iconBox - 28);
    const titleFontSize = config.height <= 52 ? '12px' : config.height <= 64 ? '14px' : '16px';
    const statusFontSize = config.height <= 52 ? '9px' : config.height <= 64 ? '10px' : '11px';

    const panel = this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: config.layout.veryCompact ? 7 : 9,
      color: config.highlighted ? 0x11170f : 0x0b0c0f,
      alpha: config.highlighted ? 0.98 : 0.94,
      strokeColor: config.accentColor,
      strokeAlpha: config.highlighted ? 0.74 : 0.44,
      strokeWidth: config.highlighted ? 2 : 1,
      depth: 8,
    });

    const glow = this.add.circle(iconX, config.y, iconBox * 0.58, config.accentColor, config.highlighted ? 0.16 : 0.08)
      .setDepth(10);
    const iconPlate = this.add.rectangle(iconX, config.y, iconBox, iconBox, 0x040405, 0.38)
      .setStrokeStyle(1, config.accentColor, config.highlighted ? 0.62 : 0.38)
      .setDepth(11);
    const icon = this.add.text(iconX, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: config.height <= 52 ? '15px' : '17px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setDepth(12);

    const titleText = this.add.text(textX, config.y - config.height * 0.14, config.title, {
      fontFamily: UI.font.title,
      fontSize: titleFontSize,
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'left',
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(12);

    const statusText = this.add.text(textX, config.y + config.height * 0.2, config.status, {
      fontFamily: UI.font.body,
      fontSize: statusFontSize,
      color: config.highlighted ? '#bdae86' : '#8f887b',
      align: 'left',
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(12);

    const accentLine = this.add.rectangle(
      config.x,
      config.y + config.height / 2 - 5,
      config.width - 22,
      1,
      config.accentColor,
      config.highlighted ? 0.28 : 0.12
    ).setDepth(11);

    const cornerMarks = this.createActionCornerMarks(config.x, config.y, config.width, config.height, config.accentColor, config.highlighted ? 0.72 : 0.42, 8);

    const objects = [panel.shadow, panel.panel, glow, iconPlate, icon, titleText, statusText, accentLine, ...cornerMarks];
    this.playActionIntro(objects, config.delay);

    this.createActionPressZone({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      onClick: config.onClick,
      titleText,
      normalColor: titleColor,
      pressTargets: [glow, iconPlate, icon, titleText, statusText],
    });

    if (config.highlighted) {
      this.tweens.add({
        targets: [glow, titleText, accentLine],
        alpha: '+=0.07',
        scale: { from: 0.99, to: 1.045 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    return {
      titleText,
      descriptionText: statusText,
    };
  }

  private createActionCornerMarks(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha: number,
    size: number
  ) {
    const left = x - width / 2;
    const right = x + width / 2;
    const top = y - height / 2;
    const bottom = y + height / 2;
    const marks = [
      this.add.rectangle(left + size / 2 + 3, top + 4, size, 2, color, alpha),
      this.add.rectangle(left + 4, top + size / 2 + 3, 2, size, color, alpha),
      this.add.rectangle(right - size / 2 - 3, top + 4, size, 2, color, alpha),
      this.add.rectangle(right - 4, top + size / 2 + 3, 2, size, color, alpha),
      this.add.rectangle(left + size / 2 + 3, bottom - 4, size, 2, color, alpha * 0.72),
      this.add.rectangle(left + 4, bottom - size / 2 - 3, 2, size, color, alpha * 0.72),
      this.add.rectangle(right - size / 2 - 3, bottom - 4, size, 2, color, alpha * 0.72),
      this.add.rectangle(right - 4, bottom - size / 2 - 3, 2, size, color, alpha * 0.72),
    ];

    marks.forEach(mark => mark.setDepth(13));
    return marks;
  }

  private playActionIntro(objects: Phaser.GameObjects.GameObject[], delay: number) {
    objects.forEach(object => {
      const alphaObject = object as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha;
      if (typeof alphaObject.setAlpha === 'function') {
        alphaObject.setAlpha(0);
      }
    });

    this.tweens.add({
      targets: objects,
      alpha: 1,
      duration: 260,
      delay,
      ease: 'Cubic.easeOut',
    });
  }

  private createActionPressZone(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    onClick: () => void;
    titleText?: Phaser.GameObjects.Text;
    normalColor?: string;
    pressTargets: Phaser.GameObjects.GameObject[];
  }) {
    const normalColor = config.normalColor ?? UI.colors.goldText;
    let isPressed = false;
    let isLocked = false;

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(30)
      .setInteractive({
        useHandCursor: true,
      });

    zone.on('pointerover', () => {
      if (isLocked) {
        return;
      }

      config.titleText?.setColor('#eee1c6');
    });

    zone.on('pointerout', () => {
      isPressed = false;
      config.titleText?.setColor(normalColor);
      this.tweens.add({
        targets: config.pressTargets,
        scaleX: 1,
        scaleY: 1,
        duration: 80,
        ease: 'Sine.easeOut',
      });
    });

    zone.on('pointerdown', () => {
      if (isLocked) {
        return;
      }

      isPressed = true;
      this.tweens.add({
        targets: config.pressTargets,
        scaleX: 0.985,
        scaleY: 0.985,
        duration: 70,
        ease: 'Sine.easeOut',
      });
    });

    zone.on('pointerupoutside', () => {
      isPressed = false;
      this.tweens.add({
        targets: config.pressTargets,
        scaleX: 1,
        scaleY: 1,
        duration: 80,
        ease: 'Sine.easeOut',
      });
    });

    zone.on('pointerup', () => {
      if (!isPressed || isLocked) {
        return;
      }

      isPressed = false;
      isLocked = true;

      this.time.delayedCall(350, () => {
        isLocked = false;
      });

      this.tweens.add({
        targets: config.pressTargets,
        scaleX: 1,
        scaleY: 1,
        duration: 90,
        ease: 'Back.easeOut',
        onComplete: () => {
          config.onClick();
        },
      });
    });

    return zone;
  }

  private hasClaimableQuests() {
    return getQuests().some(quest => {
      return isQuestCompleted(quest) && !isQuestClaimed(quest.id);
    });
  }

  private getAvailableAscensionPoints() {
    return Math.max(player.characterTreePoints ?? 0, player.upgradePoints ?? 0, 0);
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

  private getCityCampfireButtonStatus() {
    if (!this.isCityCampfireActive()) {
      return 'Зажечь огниво';
    }

    const state = this.getCityCampfireState();

    if (state.flintType === 'donate') {
      return 'Горит всегда';
    }

    return `Горит ${this.formatCityCampfireTimeLeft(this.getCityCampfireTimeLeft())}`;
  }

  private updateCampfireButtonText() {
    this.extinguishCityCampfireIfExpired();

    this.restButtonLabel?.setText('Костёр');
    this.restButtonDescription?.setText(this.getCityCampfireButtonStatus());
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
      config.x - config.width / 2,
      config.y + 8,
      Math.max(0, config.width * progress),
      barHeight,
      config.color,
      0.88
    ).setOrigin(0, 0.5).setDepth(9);

    this.add.rectangle(config.x, config.y + 8, config.width, barHeight)
      .setStrokeStyle(1, 0x5c503d, 0.5)
      .setDepth(10);
  }

  private createSanityBar(config: {
    x: number;
    y: number;
    width: number;
  }) {
    restoreSanityByTime();

    const progress = Phaser.Math.Clamp(player.maxSanity > 0 ? player.sanity / player.maxSanity : 1, 0, 1);
    const barHeight = 12;
    const left = config.x - config.width / 2;
    const fillColor = progress <= 0.25 ? 0x8f3d67 : 0x6f5a91;
    const fillWidth = Math.max(0, config.width * progress);

    this.add.text(left, config.y - 15, '☾ Рассудок', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#a99bc6',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: Math.floor(config.width * 0.58),
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(9);

    this.sanityValueText = this.add.text(left + config.width, config.y - 15, `${player.sanity}/${player.maxSanity}`, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#d8d0e8',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: Math.floor(config.width * 0.38),
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(9);

    this.add.rectangle(config.x, config.y + 6, config.width, barHeight, 0x030305, 0.94)
      .setDepth(8);

    const glow = this.add.rectangle(left, config.y + 6, Math.max(1, fillWidth), barHeight + 4, fillColor, 0.16)
      .setOrigin(0, 0.5)
      .setDepth(8);

    this.sanityFill = this.add.rectangle(left, config.y + 6, Math.max(1, fillWidth), barHeight, fillColor, 0.9)
      .setOrigin(0, 0.5)
      .setDepth(9)
      .setScale(0.01, 1);

    this.sanityFillWidth = config.width;

    this.add.rectangle(config.x, config.y + 6, config.width, barHeight)
      .setStrokeStyle(1, 0x6b5a7f, 0.62)
      .setDepth(10);

    this.sanityHintText = this.add.text(config.x, config.y + 24, this.formatSanityTimeToFull(), {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#817891',
      align: 'center',
      wordWrap: {
        width: config.width,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(9);

    this.tweens.add({
      targets: [this.sanityFill, glow],
      scaleX: 1,
      duration: 430,
      delay: 170,
      ease: 'Cubic.easeOut',
    });
  }

  private startSanityTimer() {
    this.sanityTimerEvent?.remove(false);

    this.sanityTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        const previousSanity = player.sanity;
        restoreSanityByTime();
        this.updateSanityUi();

        if (player.sanity !== previousSanity) {
          void saveGameAsync();
        }
      },
    });
  }

  private restoreSanityAndSaveIfValueChanged() {
    const previousSanity = player.sanity;
    restoreSanityByTime();

    if (player.sanity !== previousSanity) {
      void saveGameAsync();
    }
  }

  private updateSanityUi() {
    const progress = Phaser.Math.Clamp(player.maxSanity > 0 ? player.sanity / player.maxSanity : 1, 0, 1);
    const fillWidth = Math.max(1, this.sanityFillWidth * progress);
    const fillColor = progress <= 0.25 ? 0x8f3d67 : 0x6f5a91;

    this.sanityValueText?.setText(`${player.sanity}/${player.maxSanity}`);
    this.sanityHintText?.setText(this.formatSanityTimeToFull());

    if (this.sanityFill) {
      this.sanityFill.setFillStyle(fillColor, 0.9);
      this.sanityFill.setDisplaySize(fillWidth, this.sanityFill.displayHeight);
      this.sanityFill.setScale(1, 1);
      this.sanityFill.setAlpha(player.sanity <= 0 ? 0.2 : 1);
    }
  }

  private formatSanityTimeToFull() {
    const timeLeftMs = getSanityTimeToFullMs();

    if (timeLeftMs <= 0) {
      return 'Рассудок полон';
    }

    const totalMinutes = Math.ceil(timeLeftMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) {
      return `До полного: ${minutes} мин`;
    }

    return `До полного: ${hours} ч ${minutes} мин`;
  }

  private showNotEnoughSanityMessage() {
    this.showMessage(
      'Недостаточно рассудка',
      `Для прохождения этажа нужно ${SANITY_COST_PER_FLOOR} рассудка. Рассудок восстанавливается со временем: 1 единица в минуту.`
    );
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
  }

  private updateCityCampfireVisualState() {
    const active = this.isCityCampfireActive();

    if (active !== this.cityCampfireIsVisuallyActive) {
      this.createCityCampfireVisualState(this.getLayout());
      return;
    }

    this.cityCampfireWarmOverlay?.setVisible(true);
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
        'Открой профиль, пролистай вниз до «Опасной зоны» и начни новую игру, чтобы выбрать расу перед первым спуском.'
      );
      return;
    }

    const hasActiveRun = gameState.floorRun.active && gameState.floorRun.rooms.length > 0;
    const hasActiveCheckpoint = Boolean(getActiveCampfireBattleCheckpoint());

    if (!hasActiveRun && !hasActiveCheckpoint && !hasEnoughSanityForFloor()) {
      this.showNotEnoughSanityMessage();
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
