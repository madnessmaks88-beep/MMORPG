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

  private readonly CAMP_BUTTON_ASSETS = {
    dungeon: { key: 'campButtonDungeon', url: new URL('../assets/images/camp/buttons/button_dungeon.png', import.meta.url).href },
    campfire: { key: 'campButtonCampfire', url: new URL('../assets/images/camp/buttons/button_campfire.png', import.meta.url).href },
    temple: { key: 'campButtonTemple', url: new URL('../assets/images/camp/buttons/button_temple.png', import.meta.url).href },
    tavern: { key: 'campButtonTavern', url: new URL('../assets/images/camp/buttons/button_tavern.png', import.meta.url).href },
    quests: { key: 'campButtonQuests', url: new URL('../assets/images/camp/buttons/button_quests.png', import.meta.url).href },
    market: { key: 'campButtonMarket', url: new URL('../assets/images/camp/buttons/button_market.png', import.meta.url).href },
    home: { key: 'campButtonHome', url: new URL('../assets/images/camp/buttons/button_home.png', import.meta.url).href },
  } as const;

  constructor() {
    super('CampScene');
  }

  preload() {
    Object.values(this.CAMP_BUTTON_ASSETS).forEach(asset => {
      if (!this.textures.exists(asset.key)) {
        this.load.image(asset.key, asset.url);
      }
    });
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

    const veryCompact = height <= 700 || width <= 370;
    const compact = height <= 860 || width <= 410;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.048), 14, 30);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.018), 10, 24);
    const safeBottom = veryCompact ? 90 : compact ? 102 : 112;
    const contentWidth = Math.min(width - safeX * 2, 620);
    const bottomNavTop = height - safeBottom;

    const headerHeight = veryCompact ? 62 : compact ? 74 : 86;
    const heroTop = safeTop + headerHeight + (veryCompact ? 6 : 8);
    const heroHeight = veryCompact ? 136 : compact ? 154 : 172;
    const actionsTop = heroTop + heroHeight + (veryCompact ? 7 : 10);
    const actionsBottom = bottomNavTop - (veryCompact ? 8 : 12);
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
    const gateY = Phaser.Math.Clamp(height * 0.31, 210, 340);
    const fireY = Phaser.Math.Clamp(height * 0.52, 330, 500);

    this.cameras.main.fadeIn(190, 0, 0, 0);

    this.add.rectangle(centerX, height / 2, width, height, 0x040506, 1).setDepth(0);
    this.add.rectangle(centerX, height * 0.24, width, height * 0.42, 0x08101a, 0.78).setDepth(0);
    this.add.rectangle(centerX, height * 0.68, width, height * 0.64, 0x070403, 0.86).setDepth(0);

    // Крупные блоки вместо мягкого градиента — полупиксельная глубина фона.
    for (let i = 0; i < 8; i += 1) {
      const blockW = width - 34 - i * 14;
      this.add.rectangle(centerX, height - 92 - i * 31, blockW, 16, i % 2 === 0 ? 0x0c0a08 : 0x0f0d0a, 0.36)
        .setDepth(1);
    }

    this.add.rectangle(8, height / 2, 16, height, 0x000000, 0.5).setDepth(2);
    this.add.rectangle(width - 8, height / 2, 16, height, 0x000000, 0.5).setDepth(2);
    this.add.rectangle(centerX, 10, width, 20, 0x000000, 0.42).setDepth(2);
    this.add.rectangle(centerX, height - 12, width, 24, 0x000000, 0.55).setDepth(2);

    const gateWidth = Math.min(layout.contentWidth * 0.62, 330);
    const gateHeight = layout.veryCompact ? 98 : layout.compact ? 118 : 140;
    const gateX = centerX;

    this.createPixelBlock(gateX, gateY + 18, gateWidth + 46, 18, 0x17110c, 0.86, 1, 0x4f3f2d, 0.5, 1);
    this.createPixelBlock(gateX, gateY + gateHeight * 0.48, gateWidth + 72, 20, 0x11100d, 0.9, 1, 0x4f3f2d, 0.42, 1);
    this.createPixelBlock(gateX - gateWidth / 2 - 20, gateY + gateHeight * 0.12, 24, gateHeight + 42, 0x111315, 0.9, 1, 0x514a3d, 0.48, 2);
    this.createPixelBlock(gateX + gateWidth / 2 + 20, gateY + gateHeight * 0.12, 24, gateHeight + 42, 0x111315, 0.9, 1, 0x514a3d, 0.48, 2);
    this.createPixelBlock(gateX, gateY + gateHeight * 0.15, gateWidth, gateHeight, 0x050507, 0.78, 2, 0x2f2620, 0.72, 1);

    for (let i = 0; i < 5; i += 1) {
      this.add.rectangle(gateX - gateWidth / 2 + 30 + i * (gateWidth - 60) / 4, gateY + gateHeight * 0.05, 3, gateHeight * 0.78, 0x000000, 0.22)
        .setDepth(2);
    }

    ['ᛟ', 'ᚱ', 'ᛝ'].forEach((rune, index) => {
      const runeText = this.add.text(gateX - 34 + index * 34, gateY - gateHeight * 0.42, rune, {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '9px' : '11px',
        color: '#8b724b',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(3).setAlpha(0.22);

      this.tweens.add({
        targets: runeText,
        alpha: { from: 0.14, to: 0.38 },
        duration: 520 + index * 70,
        yoyo: true,
        repeat: -1,
        ease: 'Linear',
      });
    });

    // Полупиксельный костёр: несколько прямоугольников, без мыльного свечения.
    const fireGlow = this.add.rectangle(centerX, fireY + 4, width * 0.48, 58, 0x8b421c, 0.08).setDepth(1);
    const fireBlocks = [
      this.add.rectangle(centerX - 13, fireY + 10, 8, 20, 0xa65a28, 0.58),
      this.add.rectangle(centerX, fireY + 2, 10, 28, 0xd28a3a, 0.74),
      this.add.rectangle(centerX + 12, fireY + 12, 8, 18, 0x7d2d1d, 0.58),
      this.add.rectangle(centerX, fireY + 24, 42, 6, 0x3a2317, 0.9),
    ].map(object => object.setDepth(3));

    this.tweens.add({
      targets: [fireGlow, ...fireBlocks],
      alpha: '+=0.08',
      duration: 360,
      yoyo: true,
      repeat: -1,
      ease: 'Linear',
    });

    for (let i = 0; i < 26; i += 1) {
      const x = Phaser.Math.Between(layout.safeX, width - layout.safeX);
      const y = Phaser.Math.Between(layout.safeTop + 70, height - layout.safeBottom - 28);
      const size = Phaser.Math.Between(2, 3);
      const ash = this.add.rectangle(x, y, size, size, i % 3 === 0 ? 0xb8965a : 0x69645b, 0.07).setDepth(2);

      this.tweens.add({
        targets: ash,
        alpha: { from: 0.03, to: 0.12 },
        y: y - Phaser.Math.Between(8, 22),
        duration: Phaser.Math.Between(900, 1700),
        yoyo: true,
        repeat: -1,
        delay: i * 45,
        ease: 'Linear',
      });
    }
  }

  private createPixelBlock(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha: number,
    strokeWidth = 0,
    strokeColor = 0x000000,
    strokeAlpha = 1,
    depth = 0
  ) {
    const block = this.add.rectangle(x, y, width, height, color, alpha).setDepth(depth);

    if (strokeWidth > 0) {
      block.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
    }

    return block;
  }

  private createHeader(layout: CampLayout) {
    const panelY = layout.safeTop + layout.headerHeight / 2;
    const panel = this.createPixelPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: layout.headerHeight,
      color: 0x0a0b0d,
      borderColor: 0x111111,
      innerColor: 0x8b6a3f,
      depth: 8,
      cut: layout.veryCompact ? 8 : 10,
    });

    const topLine = this.add.rectangle(layout.centerX, panelY - layout.headerHeight / 2 + 10, layout.contentWidth - 42, 2, 0xb99257, 0.46).setDepth(11);
    const bottomLine = this.add.rectangle(layout.centerX, panelY + layout.headerHeight / 2 - 10, layout.contentWidth - 68, 2, 0x453220, 0.64).setDepth(11);

    const title = this.add.text(layout.centerX, panelY - (layout.veryCompact ? 12 : 16), 'Убежище у катакомб', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '20px' : layout.compact ? '24px' : '28px',
      color: '#e0c585',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12);

    const subtitle = this.add.text(layout.centerX, panelY + (layout.veryCompact ? 14 : 18), 'последний пиксельный огонь перед тьмой', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '12px',
      color: '#9f9078',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 60,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12);

    ['▪', '▪'].forEach((mark, index) => {
      this.add.text(
        index === 0 ? layout.centerX - layout.contentWidth / 2 + 26 : layout.centerX + layout.contentWidth / 2 - 26,
        panelY,
        mark,
        {
          fontFamily: UI.font.title,
          fontSize: '14px',
          color: '#b99257',
          stroke: '#000000',
          strokeThickness: 2,
        }
      ).setOrigin(0.5).setDepth(12);
    });

    this.playPixelIntro([panel.shadow, panel.panel, topLine, bottomLine, title, subtitle], 40);
  }

  private createPlayerLine(layout: CampLayout) {
    const vkUser = getCachedVKUser();
    const vkName = vkUser ? vkUser.first_name : 'локальный режим';
    const y = layout.safeTop + layout.headerHeight - (layout.veryCompact ? 11 : 14);
    const width = Math.min(layout.contentWidth - 92, 340);

    this.createDarkTag({
      x: layout.centerX,
      y,
      width,
      height: layout.veryCompact ? 22 : 24,
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

    const panel = this.createPixelPanel({
      x: layout.centerX,
      y: cardY,
      width: layout.contentWidth,
      height: layout.heroHeight,
      color: 0x08090b,
      borderColor: 0x0e0e0f,
      innerColor: 0x65513a,
      depth: 6,
      cut: layout.veryCompact ? 8 : 10,
    });

    const left = layout.centerX - layout.contentWidth / 2 + 16;
    const right = layout.centerX + layout.contentWidth / 2 - 16;
    const top = layout.heroTop;
    const portraitSize = layout.veryCompact ? 44 : 52;
    const portraitX = left + portraitSize / 2 + 4;
    const portraitY = top + (layout.veryCompact ? 34 : 42);

    this.createPixelPanel({
      x: portraitX,
      y: portraitY,
      width: portraitSize,
      height: portraitSize,
      color: 0x12100d,
      borderColor: 0x020202,
      innerColor: 0x8b6a3f,
      depth: 9,
      cut: 6,
      shadowOffset: 2,
    });

    this.add.text(portraitX, portraitY, race ? this.getRaceIcon(race.id) : '◆', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '22px' : '26px',
      color: '#d8b56d',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setDepth(12);

    const heroName = race
      ? player.name === race.name
        ? player.name
        : `${player.name} • ${race.name}`
      : player.name;

    const titleX = portraitX + portraitSize / 2 + 12;
    const titleWidth = Math.max(130, right - titleX - 72);

    this.add.text(titleX, top + (layout.veryCompact ? 22 : 28), heroName, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '15px' : layout.compact ? '18px' : '20px',
      color: '#e0c585',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: titleWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);

    this.add.text(titleX, top + (layout.veryCompact ? 45 : 54), race ? race.description : 'Путь ещё не выбран.', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '9px' : '11px',
      color: '#9b9283',
      wordWrap: {
        width: titleWidth,
        useAdvancedWrap: true,
      },
      maxLines: layout.veryCompact ? 1 : 2,
      lineSpacing: 1,
    }).setOrigin(0, 0.5).setDepth(10);

    this.createDarkTag({
      x: right - 34,
      y: top + (layout.veryCompact ? 24 : 30),
      width: 66,
      height: 26,
      icon: '',
      text: `Ур. ${player.level}`,
      accentColor: 0x4f6b4b,
      depth: 10,
    });

    const barWidth = Math.min((layout.contentWidth - 48) / 2, 260);
    const barGap = layout.veryCompact ? 8 : 12;
    const barY = top + layout.heroHeight - (layout.veryCompact ? 72 : 86);

    this.createSmallBar({
      x: layout.centerX - barWidth / 2 - barGap / 2,
      y: barY,
      width: barWidth,
      label: 'HP',
      value: `${player.hp}/${stats.maxHp}`,
      progress: stats.maxHp > 0 ? player.hp / stats.maxHp : 1,
      color: 0x9f3535,
    });

    this.createSmallBar({
      x: layout.centerX + barWidth / 2 + barGap / 2,
      y: barY,
      width: barWidth,
      label: 'Энергия',
      value: `${player.energy}/${stats.maxEnergy}`,
      progress: stats.maxEnergy > 0 ? player.energy / stats.maxEnergy : 1,
      color: 0x356ea6,
    });

    this.createSanityBar({
      x: layout.centerX,
      y: top + layout.heroHeight - (layout.veryCompact ? 46 : 54),
      width: Math.min(layout.contentWidth - 42, 520),
    });

    const resourceY = top + layout.heroHeight - 16;
    const resourceWidth = Math.min((layout.contentWidth - 38) / 3, 152);
    this.createTinyResource(layout.centerX - resourceWidth - 6, resourceY, '◆', `${player.gold}`, resourceWidth);
    this.createTinyResource(layout.centerX, resourceY, '✚', `${player.potions}`, resourceWidth);
    this.createTinyResource(layout.centerX + resourceWidth + 6, resourceY, '★', `${player.relicIds.length}`, resourceWidth);

    this.playPixelIntro([panel.shadow, panel.panel], 95);
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
    const panel = this.createPixelPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      color: cityCampfireActive ? 0x0b0806 : 0x050608,
      borderColor: 0x050505,
      innerColor: cityCampfireActive ? 0x9b642f : 0x5b4932,
      depth: 4,
      cut: 12,
    });

    this.createPixelFloor(layout, panelY, panelHeight);

    const pad = layout.veryCompact ? 9 : layout.compact ? 12 : 14;
    const innerWidth = layout.contentWidth - pad * 2;
    const availableHeight = Math.max(236, panelHeight - pad * 2);

    const baseGap = layout.veryCompact ? 6 : layout.compact ? 8 : 10;
    const primaryHeight = Phaser.Math.Clamp(
      Math.round(availableHeight * (layout.veryCompact ? 0.18 : 0.16)),
      layout.veryCompact ? 52 : 62,
      layout.veryCompact ? 62 : layout.compact ? 76 : 82
    );
    const smallTileHeight = Phaser.Math.Clamp(
      Math.round(availableHeight * (layout.veryCompact ? 0.155 : 0.14)),
      layout.veryCompact ? 46 : 54,
      layout.veryCompact ? 58 : layout.compact ? 66 : 68
    );
    const wideHeight = Phaser.Math.Clamp(
      Math.round(availableHeight * (layout.veryCompact ? 0.16 : 0.145)),
      layout.veryCompact ? 48 : 58,
      layout.veryCompact ? 60 : layout.compact ? 72 : 76
    );

    const compactContentHeight = primaryHeight + smallTileHeight * 2 + wideHeight * 2 + baseGap * 4;
    const extraHeight = Math.max(0, availableHeight - compactContentHeight);
    const gap = Phaser.Math.Clamp(baseGap + Math.floor(extraHeight / 8), baseGap, layout.veryCompact ? 9 : 13);
    const contentHeight = primaryHeight + smallTileHeight * 2 + wideHeight * 2 + gap * 4;
    const topPad = pad + Math.max(0, Math.floor((availableHeight - contentHeight) / 2));

    const pairGap = layout.veryCompact ? 8 : 10;
    const tileWidth = Math.floor((innerWidth - pairGap) / 2);
    const leftX = layout.centerX - tileWidth / 2 - pairGap / 2;
    const rightX = layout.centerX + tileWidth / 2 + pairGap / 2;

    const primaryY = layout.actionsTop + topPad + primaryHeight / 2;
    const rowOneY = primaryY + primaryHeight / 2 + gap + smallTileHeight / 2;
    const rowTwoY = rowOneY + smallTileHeight + gap;
    const marketY = rowTwoY + smallTileHeight / 2 + gap + wideHeight / 2;
    const homeY = marketY + wideHeight + gap;
    const decorationTop = homeY + wideHeight / 2 + Math.max(5, gap - 2);
    const decorationHeight = Math.max(0, layout.actionsBottom - pad - decorationTop);

    const dungeonTitle = hasActiveRun || hasActiveCheckpoint
      ? 'Продолжить спуск'
      : 'Вход в подземелье';

    const dungeonStatus = activeCheckpoint
      ? `Эт. ${activeCheckpoint.floor}`
      : hasActiveRun
        ? `Этаж ${gameState.floorRun.currentFloor}`
        : hasEnoughSanityForFloor()
          ? `Рассудок -${SANITY_COST_PER_FLOOR}`
          : 'Мало рассудка';

    this.createSpriteDungeonButton({
      layout,
      x: layout.centerX,
      y: primaryY,
      width: innerWidth,
      height: primaryHeight,
      textureKey: this.CAMP_BUTTON_ASSETS.dungeon.key,
      title: dungeonTitle,
      status: dungeonStatus,
      icon: '☠',
      baseColor: 0x641f22,
      topColor: 0xa7483f,
      bottomColor: 0x2b0d10,
      borderColor: 0x160708,
      innerBorderColor: 0xd27a54,
      textColor: '#ffe3b0',
      statusColor: '#ffd0b6',
      highlighted: hasActiveRun || hasActiveCheckpoint,
      onClick: () => {
        this.tryEnterCatacombs();
      },
      delay: 120,
    });

    const pairedTiles = [
      {
        x: leftX,
        y: rowOneY,
        textureKey: this.CAMP_BUTTON_ASSETS.campfire.key,
        icon: '♨',
        title: 'Костёр',
        status: this.getCityCampfireButtonStatus(),
        baseColor: 0x8f5a18,
        topColor: 0xd89b35,
        bottomColor: 0x3b2109,
        borderColor: 0x151008,
        innerBorderColor: 0xf0c06a,
        textColor: '#fff0bd',
        statusColor: '#ffe1a0',
        highlighted: cityCampfireActive,
        onClick: () => {
          this.restAtCampfire();
        },
      },
      {
        x: rightX,
        y: rowOneY,
        textureKey: this.CAMP_BUTTON_ASSETS.temple.key,
        icon: hasAscensionPoints ? '!' : '✦',
        title: 'Храм',
        status: hasAscensionPoints ? `Очки: ${ascensionPoints}` : 'Древо силы',
        baseColor: 0x313d85,
        topColor: 0x5e6fc0,
        bottomColor: 0x171b45,
        borderColor: 0x090b1e,
        innerBorderColor: 0xb5a1e8,
        textColor: '#eef0ff',
        statusColor: '#d8d5ff',
        highlighted: hasAscensionPoints,
        onClick: () => {
          this.scene.start('StatsTreeScene');
        },
      },
      {
        x: leftX,
        y: rowTwoY,
        textureKey: this.CAMP_BUTTON_ASSETS.tavern.key,
        icon: '☕',
        title: 'Таверна',
        status: 'Отдых',
        baseColor: 0x65401e,
        topColor: 0xa87537,
        bottomColor: 0x2e1a0c,
        borderColor: 0x100b08,
        innerBorderColor: 0xd19a58,
        textColor: '#ffe0b4',
        statusColor: '#d7b88d',
        highlighted: false,
        onClick: () => {
          this.scene.start('TavernScene');
        },
      },
      {
        x: rightX,
        y: rowTwoY,
        textureKey: this.CAMP_BUTTON_ASSETS.quests.key,
        icon: hasQuestReward ? '!' : '◆',
        title: 'Задания',
        status: hasQuestReward ? 'Есть награда' : 'Награды',
        baseColor: 0x255332,
        topColor: 0x4c8956,
        bottomColor: 0x102716,
        borderColor: 0x071008,
        innerBorderColor: 0xa4d078,
        textColor: '#e7ffd6',
        statusColor: '#cbe8ba',
        highlighted: hasQuestReward,
        onClick: () => {
          this.scene.start('QuestScene');
        },
      },
    ];

    pairedTiles.forEach((tile, index) => {
      const created = this.createSpriteLocationButton({
        layout,
        x: tile.x,
        y: tile.y,
        width: tileWidth,
        height: smallTileHeight,
        textureKey: tile.textureKey,
        icon: tile.icon,
        title: tile.title,
        status: tile.status,
        baseColor: tile.baseColor,
        topColor: tile.topColor,
        bottomColor: tile.bottomColor,
        borderColor: tile.borderColor,
        innerBorderColor: tile.innerBorderColor,
        textColor: tile.textColor,
        statusColor: tile.statusColor,
        highlighted: tile.highlighted,
        onClick: tile.onClick,
        delay: 170 + index * 45,
      });

      if (tile.title === 'Костёр') {
        this.restButtonLabel = created.titleText;
        this.restButtonDescription = created.descriptionText;
      }
    });

    this.createSpriteWideLocationButton({
      layout,
      x: layout.centerX,
      y: marketY,
      width: innerWidth,
      height: wideHeight,
      textureKey: this.CAMP_BUTTON_ASSETS.market.key,
      icon: '¤',
      title: 'Рынок',
      status: 'Торговцы',
      baseColor: 0x7e6120,
      topColor: 0xc19a3e,
      bottomColor: 0x332509,
      borderColor: 0x111008,
      innerBorderColor: 0xe5c267,
      textColor: '#fff0b5',
      statusColor: '#e7d090',
      highlighted: false,
      onClick: () => {
        this.scene.start('MarketScene');
      },
      delay: 350,
    });

    this.createSpriteWideLocationButton({
      layout,
      x: layout.centerX,
      y: homeY,
      width: innerWidth,
      height: wideHeight,
      textureKey: this.CAMP_BUTTON_ASSETS.home.key,
      icon: '⌂',
      title: 'Дом',
      status: 'Убежище',
      baseColor: 0x24354c,
      topColor: 0x4f6687,
      bottomColor: 0x111a28,
      borderColor: 0x070b10,
      innerBorderColor: 0x9eb2cf,
      textColor: '#e8f0ff',
      statusColor: '#bfcbdb',
      highlighted: false,
      onClick: () => {
        this.scene.start('HomeScene');
      },
      delay: 395,
    });

    if (decorationHeight >= 18) {
      this.createPixelCampGroundDecoration(layout, decorationTop, decorationHeight);
    }

    this.playPixelIntro([panel.shadow, panel.panel], 80);
    this.startCampfireTimer();
  }
  private createSpriteWideLocationButton(config: {
    layout: CampLayout;
    x: number;
    y: number;
    width: number;
    height: number;
    textureKey: string;
    icon: string;
    title: string;
    status: string;
    baseColor: number;
    topColor: number;
    bottomColor: number;
    borderColor: number;
    innerBorderColor: number;
    textColor: string;
    statusColor: string;
    highlighted: boolean;
    onClick: () => void;
    delay: number;
  }): CampActionButton {
    return this.createSpriteRpgButton({
      ...config,
      iconBoxSize: Phaser.Math.Clamp(config.height - 16, 34, 46),
      titleFontSize: config.layout.veryCompact ? '15px' : config.layout.compact ? '18px' : '20px',
      statusFontSize: config.layout.veryCompact ? '10px' : '11px',
      primary: true,
    });
  }

  private createPixelCampGroundDecoration(
    layout: CampLayout,
    top: number,
    height: number
  ) {
    const centerY = top + height / 2;
    const usableWidth = layout.contentWidth - (layout.veryCompact ? 54 : 74);
    const stoneColor = 0x2b241b;
    const glowColor = 0xb06a2f;

    this.add.rectangle(layout.centerX, centerY, usableWidth, Math.max(6, height * 0.18), 0x000000, 0.12)
      .setDepth(6);

    const tileCount = layout.veryCompact ? 5 : 7;
    for (let i = 0; i < tileCount; i += 1) {
      const tileX = layout.centerX - usableWidth / 2 + 16 + i * (usableWidth - 32) / Math.max(1, tileCount - 1);
      const tileY = top + Phaser.Math.Clamp(height * (0.42 + (i % 2) * 0.14), 8, Math.max(10, height - 8));
      this.add.rectangle(tileX, tileY, layout.veryCompact ? 18 : 24, 3, stoneColor, 0.26).setDepth(7);
      this.add.rectangle(tileX + 5, tileY + 5, layout.veryCompact ? 10 : 14, 2, stoneColor, 0.18).setDepth(7);
    }

    if (height >= 30) {
      const fireX = layout.centerX;
      const fireY = top + height * 0.58;
      const ember = this.add.rectangle(fireX, fireY + 7, 42, 5, 0x000000, 0.22).setDepth(7);
      const flameA = this.add.rectangle(fireX - 5, fireY, 5, 13, glowColor, 0.48).setDepth(8);
      const flameB = this.add.rectangle(fireX + 2, fireY - 3, 5, 17, 0xd08b3e, 0.42).setDepth(8);
      const flameC = this.add.rectangle(fireX + 8, fireY + 2, 4, 10, 0x7b391d, 0.5).setDepth(8);

      this.tweens.add({
        targets: [flameA, flameB, flameC],
        alpha: { from: 0.28, to: 0.58 },
        duration: 460,
        yoyo: true,
        repeat: -1,
        ease: 'Linear',
      });

      this.playPixelIntro([ember, flameA, flameB, flameC], 420);
    }
  }

  private createPixelFloor(layout: CampLayout, panelY: number, panelHeight: number) {
    const top = panelY - panelHeight / 2 + 14;
    const bottom = panelY + panelHeight / 2 - 14;
    const left = layout.centerX - layout.contentWidth / 2 + 14;
    const right = layout.centerX + layout.contentWidth / 2 - 14;

    for (let y = top; y <= bottom; y += 22) {
      this.add.rectangle(layout.centerX, y, right - left, 1, 0x2a2118, 0.12).setDepth(5);
    }

    for (let x = left; x <= right; x += 38) {
      this.add.rectangle(x, panelY, 1, panelHeight - 32, 0x1f1812, 0.09).setDepth(5);
    }

    this.add.rectangle(layout.centerX, bottom - 16, right - left - 18, 6, 0x000000, 0.18).setDepth(5);
  }

  private createSpriteDungeonButton(config: {
    layout: CampLayout;
    x: number;
    y: number;
    width: number;
    height: number;
    textureKey: string;
    title: string;
    status: string;
    icon: string;
    baseColor: number;
    topColor: number;
    bottomColor: number;
    borderColor: number;
    innerBorderColor: number;
    textColor: string;
    statusColor: string;
    highlighted: boolean;
    onClick: () => void;
    delay: number;
  }) {
    this.createSpriteRpgButton({
      ...config,
      iconBoxSize: Phaser.Math.Clamp(config.height - 16, 34, 48),
      titleFontSize: config.layout.veryCompact ? '16px' : config.layout.compact ? '20px' : '22px',
      statusFontSize: config.layout.veryCompact ? '10px' : '12px',
      primary: true,
    });
  }

  private createSpriteLocationButton(config: {
    layout: CampLayout;
    x: number;
    y: number;
    width: number;
    height: number;
    textureKey: string;
    icon: string;
    title: string;
    status: string;
    baseColor: number;
    topColor: number;
    bottomColor: number;
    borderColor: number;
    innerBorderColor: number;
    textColor: string;
    statusColor: string;
    highlighted: boolean;
    onClick: () => void;
    delay: number;
  }): CampActionButton {
    return this.createSpriteRpgButton({
      ...config,
      iconBoxSize: Phaser.Math.Clamp(config.height - 18, 30, 42),
      titleFontSize: config.height <= 54 ? '12px' : config.layout.compact ? '14px' : '16px',
      statusFontSize: config.height <= 54 ? '9px' : '10px',
      primary: false,
    });
  }

  private createSpriteRpgButton(config: {
    layout: CampLayout;
    x: number;
    y: number;
    width: number;
    height: number;
    textureKey: string;
    icon: string;
    title: string;
    status: string;
    baseColor: number;
    topColor: number;
    bottomColor: number;
    borderColor: number;
    innerBorderColor: number;
    textColor: string;
    statusColor: string;
    highlighted: boolean;
    onClick: () => void;
    delay: number;
    iconBoxSize: number;
    titleFontSize: string;
    statusFontSize: string;
    primary: boolean;
  }): CampActionButton {
    const container = this.add.container(config.x, config.y).setDepth(9);
    const shadow = this.add.image(0, 4, config.textureKey)
      .setDisplaySize(config.width, config.height)
      .setTint(0x000000)
      .setAlpha(0.32);

    const buttonImage = this.add.image(0, 0, config.textureKey)
      .setDisplaySize(config.width, config.height)
      .setAlpha(config.highlighted ? 1 : 0.96);

    const accentGlow = this.add.rectangle(
      0,
      0,
      config.width - 12,
      Math.max(10, config.height - 12),
      config.innerBorderColor,
      config.highlighted ? 0.075 : 0.025
    );

    const textX = -config.width / 2 + (config.primary ? Math.min(118, config.width * 0.24) : Math.min(76, config.width * 0.36));
    const textRightPad = config.primary ? 46 : 18;
    const textWidth = Math.max(58, config.width / 2 - textX - textRightPad);
    const titleOffsetY = config.primary ? -config.height * 0.12 : -config.height * 0.13;
    const statusOffsetY = config.primary ? config.height * 0.18 : config.height * 0.21;

    const titleText = this.add.text(textX, titleOffsetY, config.title, {
      fontFamily: UI.font.title,
      fontSize: config.titleFontSize,
      color: config.textColor,
      stroke: '#000000',
      strokeThickness: config.primary ? 4 : 3,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const statusText = this.add.text(textX, statusOffsetY, config.status, {
      fontFamily: UI.font.body,
      fontSize: config.statusFontSize,
      color: config.statusColor,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const marker = this.add.text(config.width / 2 - (config.primary ? 26 : 14), 0, config.primary ? '›' : '▪', {
      fontFamily: UI.font.title,
      fontSize: config.primary ? '25px' : '12px',
      color: config.statusColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(config.primary ? 0.8 : 0.55);

    container.add([
      shadow,
      buttonImage,
      accentGlow,
      titleText,
      statusText,
      marker,
    ]);

    this.playPixelContainerIntro(container, config.delay);

    this.createSpritePressZone({
      container,
      width: config.width,
      height: config.height,
      shadow,
      buttonImage,
      accentGlow,
      onClick: config.onClick,
    });

    if (config.highlighted) {
      this.tweens.add({
        targets: [buttonImage, accentGlow, marker],
        alpha: { from: 0.74, to: 1 },
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Linear',
      });
    }

    return {
      titleText,
      descriptionText: statusText,
    };
  }

  private createSpritePressZone(config: {
    container: Phaser.GameObjects.Container;
    width: number;
    height: number;
    shadow: Phaser.GameObjects.Image;
    buttonImage: Phaser.GameObjects.Image;
    accentGlow: Phaser.GameObjects.Rectangle;
    onClick: () => void;
  }) {
    let isPressed = false;
    let isLocked = false;
    const baseY = config.container.y;
    const zone = this.add.zone(0, 0, config.width, config.height)
      .setInteractive({ useHandCursor: true });

    config.container.add(zone);

    const reset = () => {
      if (isLocked) return;
      isPressed = false;
      config.container.setY(baseY);
      config.shadow.setAlpha(0.32);
      config.buttonImage.setAlpha(1);
      config.accentGlow.setAlpha(0.025);
    };

    zone.on('pointerdown', () => {
      if (isLocked) return;
      isPressed = true;
      config.container.setY(baseY + 2);
      config.shadow.setAlpha(0.14);
      config.buttonImage.setAlpha(0.9);
      config.accentGlow.setAlpha(0.1);
    });

    zone.on('pointerout', reset);
    zone.on('pointerupoutside', reset);

    zone.on('pointerup', () => {
      if (!isPressed || isLocked) return;
      isPressed = false;
      isLocked = true;

      this.tweens.add({
        targets: config.container,
        y: baseY,
        duration: 90,
        ease: 'Linear',
        onComplete: () => {
          config.shadow.setAlpha(0.32);
          config.buttonImage.setAlpha(1);
          config.accentGlow.setAlpha(0.025);
          config.onClick();
        },
      });

      this.time.delayedCall(360, () => {
        isLocked = false;
      });
    });
  }

  private playPixelContainerIntro(container: Phaser.GameObjects.Container, delay: number) {
    container.setAlpha(0);
    container.setY(container.y + 6);

    this.tweens.add({
      targets: container,
      alpha: 1,
      y: container.y - 6,
      duration: 160,
      delay,
      ease: 'Linear',
    });
  }

  private playPixelIntro(objects: Phaser.GameObjects.GameObject[], delay: number) {
    objects.forEach(object => {
      const alphaObject = object as unknown as { setAlpha?: (value: number) => void };
      alphaObject.setAlpha?.(0);
    });

    this.tweens.add({
      targets: objects,
      alpha: 1,
      duration: 150,
      delay,
      ease: 'Linear',
    });
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
      return 'Костёр не горит. Выбери огниво, чтобы зажечь его.';
    }

    const state = this.getCityCampfireState();

    if (state.flintType === 'donate') {
      return 'Костёр горит постоянно.';
    }

    return `Костёр горит ещё ${this.formatCityCampfireTimeLeft(this.getCityCampfireTimeLeft())}.`;
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
    const barHeight = 9;
    const left = config.x - config.width / 2;
    const fillWidth = Math.max(1, config.width * progress);

    this.add.text(left, config.y - 12, config.label, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#a99d8a',
      wordWrap: { width: config.width * 0.45, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);

    this.add.text(left + config.width, config.y - 12, config.value, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#d8c7a3',
      wordWrap: { width: config.width * 0.5, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(10);

    this.add.rectangle(config.x, config.y + 4, config.width, barHeight, 0x010101, 1)
      .setStrokeStyle(2, 0x121212, 1)
      .setDepth(9);
    this.add.rectangle(left, config.y + 4, fillWidth, barHeight - 4, config.color, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(10);

    const segments = 8;
    for (let i = 1; i < segments; i += 1) {
      this.add.rectangle(left + (config.width / segments) * i, config.y + 4, 1, barHeight, 0x000000, 0.38).setDepth(11);
    }
  }

  private createSanityBar(config: {
    x: number;
    y: number;
    width: number;
  }) {
    restoreSanityByTime();

    const progress = Phaser.Math.Clamp(player.maxSanity > 0 ? player.sanity / player.maxSanity : 1, 0, 1);
    const barHeight = 10;
    const left = config.x - config.width / 2;
    const fillColor = progress <= 0.25 ? 0x8f3d67 : 0x6f5a91;
    const fillWidth = Math.max(1, config.width * progress);

    this.add.text(left, config.y - 12, '☾ Рассудок', {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#b8aee0',
      wordWrap: { width: config.width * 0.55, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);

    this.sanityValueText = this.add.text(left + config.width, config.y - 12, `${player.sanity}/${player.maxSanity}`, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#ded5ff',
      wordWrap: { width: config.width * 0.42, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(10);

    this.add.rectangle(config.x, config.y + 4, config.width, barHeight, 0x020204, 1)
      .setStrokeStyle(2, 0x141018, 1)
      .setDepth(9);

    this.sanityFill = this.add.rectangle(left, config.y + 4, fillWidth, barHeight - 4, fillColor, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(10)
      .setScale(0.01, 1);

    this.sanityFillWidth = config.width;

    for (let i = 1; i < 12; i += 1) {
      this.add.rectangle(left + (config.width / 12) * i, config.y + 4, 1, barHeight, 0x000000, 0.35).setDepth(11);
    }

    this.sanityHintText = this.add.text(config.x, config.y + 18, this.formatSanityTimeToFull(), {
      fontFamily: UI.font.body,
      fontSize: '9px',
      color: '#817891',
      align: 'center',
      wordWrap: {
        width: config.width,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(10);

    this.tweens.add({
      targets: this.sanityFill,
      scaleX: 1,
      duration: 260,
      delay: 120,
      ease: 'Linear',
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
      this.sanityFill.setFillStyle(fillColor, 0.95);
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
    this.createPixelPanel({
      x,
      y,
      width,
      height: 26,
      color: 0x101012,
      borderColor: 0x050505,
      innerColor: 0x4b4031,
      depth: 8,
      cut: 4,
      shadowOffset: 2,
    });

    this.add.text(x - width / 2 + 20, y, icon, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: '#d8b56d',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(x - width / 2 + 35, y, value, {
      fontFamily: UI.font.title,
      fontSize: '12px',
      color: '#d8c7a3',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: width - 42,
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
    this.createPixelPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      color: 0x0d0d0f,
      borderColor: 0x040404,
      innerColor: config.accentColor,
      depth: config.depth,
      cut: 4,
      shadowOffset: 1,
    });

    const textX = config.icon ? config.x - config.width / 2 + 34 : config.x;
    const originX = config.icon ? 0 : 0.5;

    if (config.icon) {
      this.add.text(config.x - config.width / 2 + 20, config.y, config.icon, {
        fontFamily: UI.font.body,
        fontSize: '10px',
        color: '#d8b56d',
      }).setOrigin(0.5).setDepth(config.depth + 2);
    }

    this.add.text(textX, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#9f9788',
      align: 'center',
      wordWrap: {
        width: config.icon ? config.width - 44 : config.width - 16,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(originX, 0.5).setDepth(config.depth + 2);
  }

  private drawPixelButtonShape(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    cut: number,
    fillColor: number,
    fillAlpha: number,
    strokeWidth: number,
    strokeColor: number,
    strokeAlpha: number
  ) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const left = x - halfWidth;
    const right = x + halfWidth;
    const top = y - halfHeight;
    const bottom = y + halfHeight;
    const safeCut = Phaser.Math.Clamp(cut, 0, Math.min(halfWidth, halfHeight));

    const points = [
      { x: left + safeCut, y: top },
      { x: right - safeCut, y: top },
      { x: right, y: top + safeCut },
      { x: right, y: bottom - safeCut },
      { x: right - safeCut, y: bottom },
      { x: left + safeCut, y: bottom },
      { x: left, y: bottom - safeCut },
      { x: left, y: top + safeCut },
    ];

    graphics.fillStyle(fillColor, fillAlpha);
    graphics.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        graphics.moveTo(point.x, point.y);
      } else {
        graphics.lineTo(point.x, point.y);
      }
    });
    graphics.closePath();
    graphics.fillPath();

    if (strokeWidth > 0 && strokeAlpha > 0) {
      graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
      graphics.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        graphics.moveTo(point.x, point.y);
      } else {
        graphics.lineTo(point.x, point.y);
      }
    });
    graphics.closePath();
    graphics.strokePath();
    }
  }

  private createPixelPanel(config: {
    parent?: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    color: number;
    alpha?: number;
    borderColor: number;
    innerColor: number;
    innerAlpha?: number;
    depth: number;
    cut?: number;
    shadowOffset?: number;
  }) {
    const cut = config.cut ?? 8;
    const alpha = config.alpha ?? 0.96;
    const shadowOffset = config.shadowOffset ?? 4;

    const shadow = this.add.graphics().setDepth(config.depth);
    this.drawPixelButtonShape(shadow, config.x, config.y + shadowOffset, config.width, config.height, cut, 0x000000, 0.45, 0, 0x000000, 0);

    const panel = this.add.graphics().setDepth(config.depth + 1);
    this.drawPixelButtonShape(panel, config.x, config.y, config.width, config.height, cut, config.borderColor, 1, 0, 0x000000, 0);
    this.drawPixelButtonShape(panel, config.x, config.y, config.width - 6, config.height - 6, Math.max(3, cut - 3), config.color, alpha, 0, 0x000000, 0);
    this.drawPixelButtonShape(panel, config.x, config.y, config.width - 12, config.height - 12, Math.max(2, cut - 5), config.color, alpha, 2, config.innerColor, config.innerAlpha ?? 0.54);

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
    this.drawPixelButtonShape(
      shadow,
      config.x,
      config.y + 5,
      config.width,
      config.height,
      10,
      0x000000,
      0.35,
      0,
      0x000000,
      0
    );

    const bg = this.add.graphics().setDepth(1003);
    const drawBg = (fillColor: number, strokeAlpha: number, fillAlpha = 0.96) => {
      bg.clear();
      this.drawPixelButtonShape(
        bg,
        config.x,
        config.y,
        config.width,
        config.height,
        10,
        fillColor,
        canSelect ? fillAlpha : 0.68,
        2,
        config.accentColor,
        canSelect ? strokeAlpha : 0.28
      );
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

    restorePlayerVitalsToMaximum(player);
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

    const shell = this.createPixelPanel({
      x: layout.centerX,
      y: layout.height / 2,
      width: panelWidth,
      height: panelHeight,
      color: 0x0c0d10,
      alpha: 0.98,
      borderColor: 0x030303,
      innerColor: 0x6e5634,
      innerAlpha: 0.85,
      depth: 1000,
      cut: 14,
      shadowOffset: 9,
    });

    const glow = this.add.rectangle(layout.centerX, layout.height / 2 - panelHeight / 2 + 18, panelWidth - 54, 2, 0xb89a5e, 0.32);

    modal.add([overlay, shell.shadow, shell.panel, glow]);
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
            modal.destroy();
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
        this.scene.start('CampScene');
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
