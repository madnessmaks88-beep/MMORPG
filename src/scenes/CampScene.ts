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
import {
  getActiveCampfireBattleCheckpoint,
  formatCheckpointTimeLeft,
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
  private actionBoardObjects: Phaser.GameObjects.GameObject[] = [];
  private actionBoardStateKey = '';

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
      this.clearActionBoard();
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

    const veryCompact = height <= 700 || width <= 370;
    const compact = height <= 860 || width <= 410;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 14, 28);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.018), 10, 24);
    const safeBottom = veryCompact ? 92 : compact ? 104 : 116;
    const contentWidth = Math.min(width - safeX * 2, 620);
    const bottomNavTop = height - safeBottom;

    const headerHeight = veryCompact ? 54 : compact ? 66 : 76;
    const heroTop = safeTop + headerHeight + (veryCompact ? 6 : 8);
    const heroHeight = veryCompact ? 124 : compact ? 146 : 164;
    const actionsTop = heroTop + heroHeight + (veryCompact ? 7 : 10);
    const actionsBottom = bottomNavTop - (veryCompact ? 10 : 14);
    const actionsHeight = Math.max(236, actionsBottom - actionsTop);

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
    const gateY = Phaser.Math.Clamp(height * 0.3, 190, 310);
    const fireY = Phaser.Math.Clamp(height * 0.49, 300, 440);

    this.cameras.main.fadeIn(280, 0, 0, 0);

    this.add.rectangle(centerX, height / 2, width, height, 0x020304, 1).setDepth(0);
    this.add.rectangle(centerX, height * 0.3, width, height * 0.72, 0x07101a, 0.28).setDepth(0);
    this.add.rectangle(centerX, height * 0.82, width, height * 0.42, 0x070504, 0.78).setDepth(0);

    this.add.circle(centerX, gateY + 20, Math.min(width * 0.62, 270), 0x13233a, 0.16).setDepth(0.4);
    this.add.circle(centerX - width * 0.22, fireY + 20, Math.min(width * 0.42, 180), 0x8b3f1f, 0.08).setDepth(0.5);
    this.add.circle(centerX + width * 0.24, fireY - 6, Math.min(width * 0.32, 150), 0x4d2b67, 0.055).setDepth(0.5);

    const gateWidth = Math.min(layout.contentWidth * 0.74, 430);
    const gateHeight = layout.veryCompact ? 96 : layout.compact ? 118 : 144;
    const gateTop = gateY - gateHeight / 2;
    const gateLeft = centerX - gateWidth / 2;

    const gate = this.add.graphics().setDepth(1);
    gate.fillStyle(0x05070a, 0.76);
    gate.fillRoundedRect(gateLeft, gateTop, gateWidth, gateHeight, 24);
    gate.lineStyle(2, 0x2d2924, 0.58);
    gate.strokeRoundedRect(gateLeft, gateTop, gateWidth, gateHeight, 24);
    gate.fillStyle(0x010203, 0.68);
    gate.fillRoundedRect(gateLeft + gateWidth * 0.26, gateTop + gateHeight * 0.2, gateWidth * 0.48, gateHeight * 0.72, 26);
    gate.lineStyle(1, 0x6d5634, 0.24);
    gate.strokeRoundedRect(gateLeft + gateWidth * 0.26, gateTop + gateHeight * 0.2, gateWidth * 0.48, gateHeight * 0.72, 26);

    const gateGlow = this.add.rectangle(centerX, gateY + gateHeight * 0.18, gateWidth * 0.46, 4, 0x5f7f9d, 0.1).setDepth(1.2);
    this.tweens.add({
      targets: gateGlow,
      alpha: { from: 0.055, to: 0.16 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const fireGlow = this.add.circle(centerX - layout.contentWidth * 0.28, fireY, layout.veryCompact ? 42 : 58, 0xd28a3a, 0.08).setDepth(1.3);
    const fire = this.add.text(centerX - layout.contentWidth * 0.28, fireY - 2, '♨', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '24px' : '32px',
      color: '#c48b52',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1.5);

    this.tweens.add({
      targets: [fireGlow, fire],
      alpha: '+=0.08',
      scale: { from: 0.97, to: 1.08 },
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const shrineGlow = this.add.circle(centerX + layout.contentWidth * 0.28, fireY - 4, layout.veryCompact ? 36 : 50, 0x6b4a8c, 0.06).setDepth(1.3);
    const shrineRune = this.add.text(centerX + layout.contentWidth * 0.28, fireY - 4, '✦', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '17px' : '23px',
      color: '#bfa46f',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1.5).setAlpha(0.62);

    this.tweens.add({
      targets: [shrineGlow, shrineRune],
      alpha: '+=0.06',
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    for (let i = 0; i < 18; i += 1) {
      const x = Phaser.Math.Between(layout.safeX, width - layout.safeX);
      const y = Phaser.Math.Between(layout.safeTop + 40, height - layout.safeBottom - 20);
      const mote = this.add.circle(x, y, Phaser.Math.Between(1, 2), i % 4 === 0 ? 0xb99257 : 0x8b8578, 0.035).setDepth(1.1);
      this.tweens.add({
        targets: mote,
        alpha: { from: 0.018, to: 0.07 },
        y: y - Phaser.Math.Between(18, 48),
        x: x + Phaser.Math.Between(-8, 8),
        duration: Phaser.Math.Between(2100, 3900),
        delay: i * 95,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.add.rectangle(centerX, 14, width, 70, 0x000000, 0.38).setDepth(2);
    this.add.rectangle(centerX, height - 12, width, 130, 0x000000, 0.54).setDepth(2);
    this.add.rectangle(6, height / 2, 12, height, 0x000000, 0.34).setDepth(2);
    this.add.rectangle(width - 6, height / 2, 12, height, 0x000000, 0.34).setDepth(2);
  }

  private createHeader(layout: CampLayout) {
    const y = layout.safeTop + layout.headerHeight / 2;
    const width = layout.contentWidth;
    const height = layout.headerHeight;
    const radius = layout.veryCompact ? 18 : 22;

    const container = this.add.container(layout.centerX, y).setDepth(20).setAlpha(0);
    container.setY(y - 8);

    const bg = this.createLocalPanel(container, width, height, radius, 0x07090c, 0.9, 0x8b6a3f, 0.44, 1);
    const glow = this.add.rectangle(0, -height * 0.18, width - 22, Math.max(10, height * 0.3), 0xb9985b, 0.035);
    const line = this.add.rectangle(0, height / 2 - 8, width - 70, 1, 0xb9985b, 0.18);
    container.add([glow, line]);

    const title = this.add.text(0, layout.veryCompact ? -10 : -13, 'Убежище у катакомб', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '20px' : layout.compact ? '24px' : '28px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: { width: width - 34, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, layout.veryCompact ? 13 : 17, 'последний огонь перед тьмой', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '12px',
      color: '#958a78',
      align: 'center',
      wordWrap: { width: width - 58, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5);

    container.add([title, subtitle]);
    bg.setDepth(0);

    this.createSubtleBrackets(container, width, height, 0xb9985b, 0.34, layout.veryCompact ? 9 : 12);

    this.tweens.add({
      targets: container,
      alpha: 1,
      y,
      duration: 320,
      ease: 'Cubic.easeOut',
    });
  }

  private createPlayerLine(layout: CampLayout) {
    const vkUser = getCachedVKUser();
    const vkName = vkUser ? vkUser.first_name : 'локальный режим';
    const y = layout.safeTop + layout.headerHeight - (layout.veryCompact ? 11 : 13);
    const width = Math.min(layout.contentWidth - 100, 320);

    this.createDarkTag({
      x: layout.centerX,
      y,
      width,
      height: layout.veryCompact ? 22 : 25,
      icon: '◆',
      text: `Игрок: ${vkName}`,
      accentColor: 0x6e5634,
      depth: 24,
    });
  }

  private createHeroStatusCard(layout: CampLayout) {
    const race = player.raceId ? getRaceById(player.raceId) : undefined;
    const stats = getPlayerStats(player);
    const y = layout.heroTop + layout.heroHeight / 2;
    const width = layout.contentWidth;
    const height = layout.heroHeight;
    const container = this.add.container(layout.centerX, y).setDepth(18).setAlpha(0);
    container.setY(y + 8);

    this.createLocalPanel(container, width, height, layout.veryCompact ? 18 : 24, 0x080a0d, 0.94, 0x6d5a3b, 0.46, 1);
    const portraitX = -width / 2 + (layout.veryCompact ? 38 : 48);
    const portraitY = layout.veryCompact ? -height / 2 + 31 : -height / 2 + 40;

    const portraitGlow = this.add.circle(portraitX, portraitY, layout.veryCompact ? 28 : 34, 0xb9985b, 0.08);
    const portrait = this.add.circle(portraitX, portraitY, layout.veryCompact ? 23 : 28, 0x14100d, 0.96)
      .setStrokeStyle(2, 0x8b6a3f, 0.62);
    const raceIcon = this.add.text(portraitX, portraitY, race ? this.getRaceIcon(race.id) : '◆', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '19px' : '23px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add([portraitGlow, portrait, raceIcon]);

    this.tweens.add({
      targets: portraitGlow,
      alpha: { from: 0.05, to: 0.15 },
      scale: { from: 0.96, to: 1.08 },
      duration: 1450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const nameX = portraitX + (layout.veryCompact ? 36 : 44);
    const nameY = portraitY - (layout.veryCompact ? 9 : 12);
    const heroName = race && player.name !== race.name ? `${player.name} • ${race.name}` : player.name;
    const levelWidth = layout.veryCompact ? 58 : 68;

    const name = this.add.text(nameX, nameY, heroName, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '15px' : layout.compact ? '18px' : '20px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: { width: width - Math.abs(nameX) - levelWidth - 34, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const raceText = this.add.text(nameX, nameY + (layout.veryCompact ? 20 : 24), race ? race.description : 'Герой ещё не выбрал путь.', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '11px',
      color: '#91877a',
      wordWrap: { width: width - Math.abs(nameX) - 32, useAdvancedWrap: true },
      maxLines: layout.veryCompact ? 1 : 2,
      lineSpacing: 1,
    }).setOrigin(0, 0.5);

    const level = this.createLocalChip(container, width / 2 - levelWidth / 2 - 14, -height / 2 + (layout.veryCompact ? 28 : 34), levelWidth, layout.veryCompact ? 24 : 28, `Ур. ${player.level}`, 0x53735b);
    container.add([name, raceText]);

    const meterTop = layout.veryCompact ? 21 : 34;
    const meterGap = layout.veryCompact ? 5 : 7;
    const meterWidth = (width - 40 - meterGap) / 2;
    this.createHeroMeter(container, -meterWidth / 2 - meterGap / 2, meterTop, meterWidth, 'HP', `${player.hp}/${stats.maxHp}`, stats.maxHp > 0 ? player.hp / stats.maxHp : 1, 0x9a3733);
    this.createHeroMeter(container, meterWidth / 2 + meterGap / 2, meterTop, meterWidth, 'Энергия', `${player.energy}/${stats.maxEnergy}`, stats.maxEnergy > 0 ? player.energy / stats.maxEnergy : 1, 0x4e7fa6);

    const sanityY = meterTop + (layout.veryCompact ? 25 : 30);
    this.createSanityBarInContainer(container, 0, sanityY, width - 42);

    const resY = height / 2 - (layout.veryCompact ? 17 : 20);
    const resWidth = Math.min((width - 46) / 3, 136);
    this.createTinyResourceLocal(container, -resWidth - 7, resY, '◆', `${player.gold}`, resWidth);
    this.createTinyResourceLocal(container, 0, resY, '✚', `${player.potions}`, resWidth);
    this.createTinyResourceLocal(container, resWidth + 7, resY, '★', `${player.relicIds.length}`, resWidth);

    this.createSubtleBrackets(container, width, height, 0x8b7652, 0.24, layout.veryCompact ? 7 : 10);

    this.tweens.add({
      targets: container,
      alpha: 1,
      y,
      delay: 90,
      duration: 300,
      ease: 'Cubic.easeOut',
    });

    void level;
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
    this.clearActionBoard();
    this.actionBoardStateKey = this.getActionBoardStateKey();

    const hasActiveRun = gameState.floorRun.active && gameState.floorRun.rooms.length > 0;
    const activeCheckpoint = getActiveCampfireBattleCheckpoint();
    const hasActiveCheckpoint = Boolean(activeCheckpoint);
    const hasQuestReward = this.hasClaimableQuests();
    const cityCampfireActive = this.isCityCampfireActive();
    const ascensionPoints = this.getAvailableAscensionPoints();
    const hasAscensionPoints = ascensionPoints > 0;

    const boardY = layout.actionsTop + layout.actionsHeight / 2;
    const board = this.add.container(layout.centerX, boardY).setDepth(26).setAlpha(0).setY(boardY + 8);
    this.trackActionObject(board);

    this.createLocalPanel(board, layout.contentWidth, layout.actionsHeight, layout.veryCompact ? 18 : 24, cityCampfireActive ? 0x0b0806 : 0x05070a, 0.92, cityCampfireActive ? 0x8f6238 : 0x5d4a32, cityCampfireActive ? 0.42 : 0.3, 1);
    const boardShade = this.add.rectangle(0, 0, layout.contentWidth - 18, layout.actionsHeight - 18, 0x000000, 0.08);
    const boardLine = this.add.rectangle(0, -layout.actionsHeight / 2 + 12, layout.contentWidth - 58, 1, cityCampfireActive ? 0xd28a3a : 0xb9985b, cityCampfireActive ? 0.16 : 0.1);
    const boardTitle = this.add.text(0, -layout.actionsHeight / 2 + (layout.veryCompact ? 12 : 14), 'КАРТА УБЕЖИЩА', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '8px' : '10px',
      color: '#89714c',
      align: 'center',
      wordWrap: { width: layout.contentWidth - 80, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5).setAlpha(0.42);
    board.add([boardShade, boardLine, boardTitle]);

    const padX = layout.veryCompact ? 10 : 12;
    const padTop = layout.veryCompact ? 22 : 26;
    const padBottom = layout.veryCompact ? 10 : 12;
    const innerWidth = layout.contentWidth - padX * 2;
    const usableHeight = layout.actionsHeight - padTop - padBottom;
    const rowGapBase = layout.veryCompact ? 5 : layout.compact ? 7 : 9;
    const primaryHeight = Phaser.Math.Clamp(Math.round(usableHeight * 0.21), layout.veryCompact ? 50 : 56, layout.veryCompact ? 58 : 72);
    const tileGap = layout.veryCompact ? 7 : 9;
    const tileHeight = Phaser.Math.Clamp(Math.floor((usableHeight - primaryHeight - rowGapBase * 3) / 3), layout.veryCompact ? 48 : 54, layout.veryCompact ? 58 : 68);
    const rowGap = Math.max(rowGapBase, Math.floor((usableHeight - primaryHeight - tileHeight * 3) / 3));
    const groupHeight = primaryHeight + tileHeight * 3 + rowGap * 3;
    const startY = -layout.actionsHeight / 2 + padTop + Math.max(0, (usableHeight - groupHeight) / 2);
    const pairWidth = Math.floor((innerWidth - tileGap) / 2);
    const leftX = -innerWidth / 2 + pairWidth / 2;
    const rightX = innerWidth / 2 - pairWidth / 2;
    const primaryY = startY + primaryHeight / 2;
    const row1Y = primaryY + primaryHeight / 2 + rowGap + tileHeight / 2;
    const row2Y = row1Y + tileHeight + rowGap;
    const row3Y = row2Y + tileHeight + rowGap;

    this.createMapConnectors(board, innerWidth, primaryY, row1Y, row2Y, row3Y, cityCampfireActive ? 0x9a6537 : 0x6d5634);

    const dungeonTitle = hasActiveRun || hasActiveCheckpoint ? 'Продолжить спуск' : 'Вход в подземелье';
    const dungeonStatus = activeCheckpoint
      ? `Эт. ${activeCheckpoint.floor} • ${formatCheckpointTimeLeft(activeCheckpoint.expiresAt - Date.now())}`
      : hasActiveRun
        ? `Этаж ${gameState.floorRun.currentFloor}`
        : hasEnoughSanityForFloor()
          ? `Рассудок -${SANITY_COST_PER_FLOOR}`
          : 'Мало рассудка';

    this.createDungeonAction({
      layout,
      board,
      x: 0,
      y: primaryY,
      width: innerWidth,
      height: primaryHeight,
      title: dungeonTitle,
      status: dungeonStatus,
      highlighted: hasActiveRun || hasActiveCheckpoint,
      onClick: () => this.tryEnterCatacombs(),
      delay: 130,
    });

    const restTile = this.createCampLocationTile({
      layout,
      board,
      x: leftX,
      y: row1Y,
      width: pairWidth,
      height: tileHeight,
      icon: '♨',
      title: 'Костёр',
      status: this.getCityCampfireButtonStatus(),
      accentColor: cityCampfireActive ? 0xd28a3a : 0x9b7043,
      highlighted: cityCampfireActive,
      onClick: () => this.restAtCampfire(),
      delay: 185,
    });
    this.restButtonLabel = restTile.titleText;
    this.restButtonDescription = restTile.descriptionText;

    this.createCampLocationTile({
      layout,
      board,
      x: rightX,
      y: row1Y,
      width: pairWidth,
      height: tileHeight,
      icon: hasAscensionPoints ? '!' : '✦',
      title: 'Храм',
      status: hasAscensionPoints ? `Очки: ${ascensionPoints}` : 'Древо силы',
      accentColor: hasAscensionPoints ? 0xd6c08a : 0x7253a8,
      highlighted: hasAscensionPoints,
      onClick: () => this.scene.start('StatsTreeScene'),
      delay: 220,
    });

    this.createCampLocationTile({
      layout,
      board,
      x: leftX,
      y: row2Y,
      width: pairWidth,
      height: tileHeight,
      icon: '☕',
      title: 'Таверна',
      status: 'Отдых',
      accentColor: 0xa06f43,
      highlighted: false,
      onClick: () => this.scene.start('TavernScene'),
      delay: 255,
    });

    this.createCampLocationTile({
      layout,
      board,
      x: rightX,
      y: row2Y,
      width: pairWidth,
      height: tileHeight,
      icon: hasQuestReward ? '!' : '◆',
      title: 'Доска заданий',
      status: hasQuestReward ? 'Есть награда' : 'Награды',
      accentColor: hasQuestReward ? 0x7fa06d : 0x8b6a3f,
      highlighted: hasQuestReward,
      onClick: () => this.scene.start('QuestScene'),
      delay: 290,
    });

    this.createCampLocationTile({
      layout,
      board,
      x: leftX,
      y: row3Y,
      width: pairWidth,
      height: tileHeight,
      icon: '¤',
      title: 'Рынок',
      status: 'Торговцы',
      accentColor: 0xb89a5e,
      highlighted: false,
      onClick: () => this.scene.start('MarketScene'),
      delay: 325,
    });

    this.createCampLocationTile({
      layout,
      board,
      x: rightX,
      y: row3Y,
      width: pairWidth,
      height: tileHeight,
      icon: '⌂',
      title: 'Дом',
      status: 'Убежище',
      accentColor: 0x8b7652,
      highlighted: false,
      onClick: () => this.scene.start('HomeScene'),
      delay: 360,
    });

    this.createSubtleBrackets(board, layout.contentWidth, layout.actionsHeight, cityCampfireActive ? 0xd28a3a : 0x8b7652, 0.16, 9);

    this.tweens.add({
      targets: board,
      alpha: 1,
      y: boardY,
      delay: 100,
      duration: 300,
      ease: 'Cubic.easeOut',
    });

    this.startCampfireTimer();
  }

  private createDungeonAction(config: {
    layout: CampLayout;
    board: Phaser.GameObjects.Container;
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
    const container = this.add.container(config.x, config.y).setAlpha(0);
    container.setY(config.y + 8);
    config.board.add(container);

    const accent = config.highlighted ? 0x5f9a68 : 0x9d3f36;
    const titleColor = config.highlighted ? '#b6e5b1' : '#e2c27d';
    const iconBox = Phaser.Math.Clamp(config.height * 0.58, 32, 42);
    const iconX = -config.width / 2 + iconBox / 2 + 13;
    const textX = iconX + iconBox / 2 + 15;
    const textWidth = Math.max(150, config.width / 2 - textX + config.width / 2 - 40);

    this.createLocalPanel(container, config.width, config.height, config.layout.veryCompact ? 18 : 24, config.highlighted ? 0x0a1710 : 0x180d0c, 0.98, accent, 0.68, 2);
    const shade = this.add.rectangle(0, config.height * 0.14, config.width - 20, Math.max(12, config.height * 0.38), 0x000000, 0.13);
    const iconGlow = this.add.circle(iconX, 0, iconBox * 0.8, accent, config.highlighted ? 0.16 : 0.12);
    const iconNest = this.add.rectangle(iconX, 0, iconBox, iconBox, 0x040405, 0.5).setStrokeStyle(1, accent, 0.58);
    const icon = this.add.text(iconX, 0, config.highlighted ? '▼' : '☠', {
      fontFamily: UI.font.title,
      fontSize: config.layout.veryCompact ? '19px' : '24px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5);

    const title = this.add.text(textX, -config.height * 0.15, config.title, {
      fontFamily: UI.font.title,
      fontSize: config.layout.veryCompact ? '17px' : config.layout.compact ? '20px' : '23px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const status = this.add.text(textX, config.height * 0.2, config.status, {
      fontFamily: UI.font.body,
      fontSize: config.layout.veryCompact ? '10px' : '12px',
      color: '#b3a796',
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const arrow = this.add.text(config.width / 2 - 22, 0, '›', {
      fontFamily: UI.font.title,
      fontSize: config.layout.veryCompact ? '23px' : '30px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0.76);

    const topLine = this.add.rectangle(0, -config.height / 2 + 7, config.width - 46, 1, accent, 0.22);
    const bottomLine = this.add.rectangle(0, config.height / 2 - 7, config.width - 46, 2, accent, config.highlighted ? 0.28 : 0.2);
    container.add([shade, iconGlow, iconNest, icon, title, status, arrow, topLine, bottomLine]);
    this.createSubtleBrackets(container, config.width, config.height, accent, 0.42, 8);

    this.playContainerIntro(container, config.delay);
    this.createPressableZone({
      board: config.board,
      target: container,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      titleText: title,
      normalColor: titleColor,
      onClick: config.onClick,
    });

    this.tweens.add({
      targets: [iconGlow, bottomLine, arrow],
      alpha: config.highlighted ? '+=0.08' : '+=0.045',
      scale: { from: 0.98, to: config.highlighted ? 1.06 : 1.035 },
      duration: config.highlighted ? 900 : 1450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createCampLocationTile(config: {
    layout: CampLayout;
    board: Phaser.GameObjects.Container;
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
    const container = this.add.container(config.x, config.y).setAlpha(0);
    container.setY(config.y + 8);
    config.board.add(container);

    const titleColor = config.highlighted ? '#ead694' : '#d8c088';
    const statusColor = config.highlighted ? '#cfc29e' : '#a09688';
    const iconBox = Phaser.Math.Clamp(config.height * 0.56, 27, 38);
    const iconX = -config.width / 2 + iconBox / 2 + (config.layout.veryCompact ? 8 : 10);
    const textX = iconX + iconBox / 2 + (config.layout.veryCompact ? 10 : 13);
    const textWidth = Math.max(64, config.width / 2 - textX + config.width / 2 - 10);

    this.createLocalPanel(container, config.width, config.height, config.layout.veryCompact ? 15 : 19, config.highlighted ? 0x11130e : 0x0b0d10, config.highlighted ? 0.98 : 0.94, config.accentColor, config.highlighted ? 0.58 : 0.34, config.highlighted ? 2 : 1);
    const shade = this.add.rectangle(0, config.height * 0.16, config.width - 12, Math.max(10, config.height * 0.34), 0x000000, 0.12);
    const iconGlow = this.add.circle(iconX, 0, iconBox * 0.74, config.accentColor, config.highlighted ? 0.14 : 0.07);
    const iconNest = this.add.rectangle(iconX, 0, iconBox, iconBox, 0x050506, 0.44).setStrokeStyle(1, config.accentColor, config.highlighted ? 0.62 : 0.36);
    const icon = this.add.text(iconX, 0, config.icon, {
      fontFamily: UI.font.title,
      fontSize: config.layout.veryCompact ? '16px' : '19px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5);

    const title = this.add.text(textX, -config.height * 0.17, config.title, {
      fontFamily: UI.font.title,
      fontSize: config.layout.veryCompact ? '12px' : config.layout.compact ? '14px' : '16px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const status = this.add.text(textX, config.height * 0.2, config.status, {
      fontFamily: UI.font.body,
      fontSize: config.layout.veryCompact ? '9px' : '11px',
      color: statusColor,
      wordWrap: { width: textWidth, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const line = this.add.rectangle(0, config.height / 2 - 5, config.width - 22, 1, config.accentColor, config.highlighted ? 0.22 : 0.1);
    const marker = this.add.text(config.width / 2 - 10, -config.height * 0.24, '᛫', {
      fontFamily: UI.font.title,
      fontSize: config.layout.veryCompact ? '8px' : '10px',
      color: '#8f7650',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(config.highlighted ? 0.5 : 0.22);

    container.add([shade, iconGlow, iconNest, icon, title, status, line, marker]);
    this.createSubtleBrackets(container, config.width, config.height, config.accentColor, config.highlighted ? 0.3 : 0.16, 6);

    this.playContainerIntro(container, config.delay);
    this.createPressableZone({
      board: config.board,
      target: container,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      titleText: title,
      normalColor: titleColor,
      onClick: config.onClick,
    });

    if (config.highlighted) {
      this.tweens.add({
        targets: [iconGlow, line, marker],
        alpha: '+=0.07',
        scale: { from: 0.99, to: 1.045 },
        duration: 920,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    return {
      titleText: title,
      descriptionText: status,
    };
  }

  private createMapConnectors(board: Phaser.GameObjects.Container, width: number, primaryY: number, row1Y: number, row2Y: number, row3Y: number, color: number) {
    const alpha = 0.08;
    [row1Y, row2Y, row3Y].forEach(y => {
      board.add(this.add.rectangle(0, y, width * 0.35, 1, color, alpha));
    });
    board.add(this.add.rectangle(0, (primaryY + row3Y) / 2, 2, row3Y - primaryY, color, alpha));
  }

  private createSubtleBrackets(container: Phaser.GameObjects.Container, width: number, height: number, color: number, alpha: number, size: number) {
    const left = -width / 2;
    const right = width / 2;
    const top = -height / 2;
    const bottom = height / 2;
    const marks = [
      this.add.rectangle(left + size / 2 + 5, top + 5, size, 2, color, alpha),
      this.add.rectangle(left + 5, top + size / 2 + 5, 2, size, color, alpha),
      this.add.rectangle(right - size / 2 - 5, top + 5, size, 2, color, alpha),
      this.add.rectangle(right - 5, top + size / 2 + 5, 2, size, color, alpha),
      this.add.rectangle(left + size / 2 + 5, bottom - 5, size, 2, color, alpha * 0.7),
      this.add.rectangle(left + 5, bottom - size / 2 - 5, 2, size, color, alpha * 0.7),
      this.add.rectangle(right - size / 2 - 5, bottom - 5, size, 2, color, alpha * 0.7),
      this.add.rectangle(right - 5, bottom - size / 2 - 5, 2, size, color, alpha * 0.7),
    ];
    container.add(marks);
  }

  private createPressableZone(config: {
    board: Phaser.GameObjects.Container;
    target: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    titleText: Phaser.GameObjects.Text;
    normalColor: string;
    onClick: () => void;
  }) {
    let isPressed = false;
    let isLocked = false;
    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setInteractive({ useHandCursor: true })
      .setDepth(40);

    config.board.add(zone);
    this.trackActionObject(zone);

    zone.on('pointerover', () => {
      if (!isLocked) {
        config.titleText.setColor('#f1dfb2');
      }
    });

    zone.on('pointerout', () => {
      isPressed = false;
      config.titleText.setColor(config.normalColor);
      this.tweens.add({ targets: config.target, scaleX: 1, scaleY: 1, duration: 90, ease: 'Sine.easeOut' });
    });

    zone.on('pointerdown', () => {
      if (isLocked) {
        return;
      }
      isPressed = true;
      config.titleText.setColor('#fff0c4');
      this.tweens.add({ targets: config.target, scaleX: 0.982, scaleY: 0.982, duration: 70, ease: 'Sine.easeOut' });
    });

    zone.on('pointerupoutside', () => {
      isPressed = false;
      config.titleText.setColor(config.normalColor);
      this.tweens.add({ targets: config.target, scaleX: 1, scaleY: 1, duration: 90, ease: 'Sine.easeOut' });
    });

    zone.on('pointerup', () => {
      if (!isPressed || isLocked) {
        return;
      }
      isPressed = false;
      isLocked = true;
      config.titleText.setColor('#fff0c4');
      this.tweens.add({
        targets: config.target,
        scaleX: 1,
        scaleY: 1,
        duration: 105,
        ease: 'Back.easeOut',
        onComplete: () => {
          config.onClick();
          this.time.delayedCall(260, () => {
            isLocked = false;
          });
        },
      });
    });
  }

  private playContainerIntro(container: Phaser.GameObjects.Container, delay: number) {
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: container.y - 8,
      duration: 260,
      delay,
      ease: 'Cubic.easeOut',
    });
  }

  private trackActionObject(object: Phaser.GameObjects.GameObject) {
    this.actionBoardObjects.push(object);
  }

  private clearActionBoard() {
    this.actionBoardObjects.forEach(object => {
      if (object.active) {
        object.destroy();
      }
    });
    this.actionBoardObjects = [];
    this.restButtonLabel = undefined;
    this.restButtonDescription = undefined;
  }

  private refreshActionBoard() {
    this.createMainActions(this.getLayout());
  }

  private getActionBoardStateKey() {
    const checkpoint = getActiveCampfireBattleCheckpoint();
    const cityState = this.getCityCampfireState();
    const hasActiveRun = gameState.floorRun.active && gameState.floorRun.rooms.length > 0;
    return [
      hasActiveRun ? `run:${gameState.floorRun.currentFloor}` : 'run:none',
      checkpoint ? `checkpoint:${checkpoint.id}` : 'checkpoint:none',
      cityState.active ? `campfire:${cityState.flintType}` : 'campfire:none',
      this.hasClaimableQuests() ? 'quest:reward' : 'quest:none',
      `points:${this.getAvailableAscensionPoints()}`,
    ].join('|');
  }

  private hasClaimableQuests() {
    return getQuests().some(quest => isQuestCompleted(quest) && !isQuestClaimed(quest.id));
  }

  private getAvailableAscensionPoints() {
    return Math.max(player.characterTreePoints ?? 0, player.upgradePoints ?? 0, 0);
  }

  private getCityCampfireButtonDescription() {
    if (!this.isCityCampfireActive()) {
      return 'Костёр не горит. Зажги его через огниво, чтобы восстановить силы.';
    }

    const state = this.getCityCampfireState();

    if (state.flintType === 'donate') {
      return 'Донатное огниво горит постоянно.';
    }

    return `Огонь активен ещё ${this.formatCityCampfireTimeLeft(this.getCityCampfireTimeLeft())}.`;
  }

  private getCityCampfireButtonStatus() {
    if (!this.isCityCampfireActive()) {
      return 'Зажечь';
    }

    const state = this.getCityCampfireState();

    if (state.flintType === 'donate') {
      return 'Горит всегда';
    }

    return `Горит ${this.formatCityCampfireTimeLeft(this.getCityCampfireTimeLeft())}`;
  }

  private updateCampfireButtonText() {
    this.extinguishCityCampfireIfExpired();

    const nextKey = this.getActionBoardStateKey();
    if (nextKey !== this.actionBoardStateKey) {
      this.refreshActionBoard();
      return;
    }

    this.restButtonLabel?.setText('Костёр');
    this.restButtonDescription?.setText(this.getCityCampfireButtonStatus());
  }

  private startCampfireTimer() {
    this.campfireTimerEvent?.remove(false);
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

  private createHeroMeter(container: Phaser.GameObjects.Container, x: number, y: number, width: number, label: string, value: string, progress: number, color: number) {
    const pct = Phaser.Math.Clamp(progress, 0, 1);
    const labelText = this.add.text(x - width / 2, y - 9, label, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#908778',
      wordWrap: { width: width * 0.46, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5);
    const valueText = this.add.text(x + width / 2, y - 9, value, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#d1c7b4',
      wordWrap: { width: width * 0.5, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(1, 0.5);
    const bg = this.add.rectangle(x, y + 5, width, 8, 0x030303, 0.9);
    const fill = this.add.rectangle(x - width / 2, y + 5, Math.max(1, width * pct), 8, color, 0.86).setOrigin(0, 0.5).setScale(0.01, 1);
    const stroke = this.add.rectangle(x, y + 5, width, 8).setStrokeStyle(1, 0x5c503d, 0.42);
    container.add([labelText, valueText, bg, fill, stroke]);
    this.tweens.add({ targets: fill, scaleX: 1, duration: 380, delay: 150, ease: 'Cubic.easeOut' });
  }

  private createSanityBarInContainer(container: Phaser.GameObjects.Container, x: number, y: number, width: number) {
    restoreSanityByTime();
    const progress = Phaser.Math.Clamp(player.maxSanity > 0 ? player.sanity / player.maxSanity : 1, 0, 1);
    const fillColor = progress <= 0.25 ? 0x8f3d67 : 0x6f5a91;
    const left = x - width / 2;

    const label = this.add.text(left, y - 10, '☾ Рассудок', {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#a99bc6',
      wordWrap: { width: width * 0.52, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    this.sanityValueText = this.add.text(left + width, y - 10, `${player.sanity}/${player.maxSanity}`, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#d8d0e8',
      wordWrap: { width: width * 0.4, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(1, 0.5);

    const bg = this.add.rectangle(x, y + 5, width, 8, 0x030305, 0.94);
    this.sanityFill = this.add.rectangle(left, y + 5, Math.max(1, width * progress), 8, fillColor, 0.9).setOrigin(0, 0.5).setScale(0.01, 1);
    const stroke = this.add.rectangle(x, y + 5, width, 8).setStrokeStyle(1, 0x6b5a7f, 0.56);
    this.sanityHintText = this.add.text(x, y + 18, this.formatSanityTimeToFull(), {
      fontFamily: UI.font.body,
      fontSize: '9px',
      color: '#817891',
      align: 'center',
      wordWrap: { width, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5);

    this.sanityFillWidth = width;
    container.add([label, this.sanityValueText, bg, this.sanityFill, stroke, this.sanityHintText]);
    this.tweens.add({ targets: this.sanityFill, scaleX: 1, duration: 420, delay: 170, ease: 'Cubic.easeOut' });
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

  private createTinyResourceLocal(container: Phaser.GameObjects.Container, x: number, y: number, icon: string, value: string, width: number) {
    this.createLocalChip(container, x, y, width, 28, `${icon} ${value}`, 0x6e5634);
  }

  private createLocalChip(container: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, text: string, accentColor: number) {
    const chip = this.add.graphics();
    chip.fillStyle(0x101012, 0.94);
    chip.fillRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);
    chip.lineStyle(1, accentColor, 0.38);
    chip.strokeRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);
    const label = this.add.text(x, y, text, {
      fontFamily: UI.font.body,
      fontSize: height <= 24 ? '10px' : '12px',
      color: '#d1c7b4',
      align: 'center',
      wordWrap: { width: width - 12, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0.5);
    container.add([chip, label]);
    return { chip, label };
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
    const container = this.add.container(config.x, config.y).setDepth(config.depth).setAlpha(0);
    this.createLocalChip(container, 0, 0, config.width, config.height, `${config.icon ? `${config.icon} ` : ''}${config.text}`, config.accentColor);
    this.tweens.add({ targets: container, alpha: 1, duration: 240, delay: 110, ease: 'Sine.easeOut' });
  }

  private createLocalPanel(container: Phaser.GameObjects.Container, width: number, height: number, radius: number, color: number, alpha: number, strokeColor: number, strokeAlpha: number, strokeWidth: number) {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, radius);

    const panel = this.add.graphics();
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    panel.fillStyle(0xffffff, 0.025);
    panel.fillRoundedRect(-width / 2 + 6, -height / 2 + 5, width - 12, Math.max(8, height * 0.28), Math.max(4, radius - 6));
    panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    panel.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);

    container.add([shadow, panel]);
    return panel;
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
