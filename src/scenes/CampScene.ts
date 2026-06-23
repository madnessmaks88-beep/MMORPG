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

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';
import { getActiveCampfireBattleCheckpoint } from '../systems/CampfireCheckpointSystem';
import { getMaterialName, type MaterialId } from '../data/materials';

import {
  getQuests,
  isQuestCompleted,
  isQuestClaimed,
} from '../systems/QuestSystem';

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
  private static pixelFontPromise?: Promise<void>;

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
  private readonly PIXEL_FONT_FACE_NAME = 'PixeloidMono';
  private readonly PIXEL_FONT_FAMILY = '"PixeloidMono", monospace';
  private readonly PIXEL_FONT_ASSET_URL = new URL('../assets/fonts/PixeloidMono.ttf', import.meta.url).href;

  private readonly CAMP_BACKGROUND_ASSET = {
    key: 'campBackground',
    url: new URL('../assets/images/camp/camp_background.png', import.meta.url).href,
  } as const;

  private readonly CAMP_ACTION_ASSETS = {
    board: {
      key: 'campActionBoard',
      url: new URL('../assets/images/camp/ui/oblast1.png', import.meta.url).href,
    },
    dungeon: {
      key: 'campButtonDungeon',
      url: new URL('../assets/images/camp/ui/VHOD1.png', import.meta.url).href,
    },
    campfire: {
      key: 'campButtonCampfire',
      url: new URL('../assets/images/camp/ui/KOSTER1.png', import.meta.url).href,
    },
    temple: {
      key: 'campButtonTemple',
      url: new URL('../assets/images/camp/ui/XRAM1.png', import.meta.url).href,
    },
    tavern: {
      key: 'campButtonTavern',
      url: new URL('../assets/images/camp/ui/taverna1.png', import.meta.url).href,
    },
    quests: {
      key: 'campButtonQuests',
      url: new URL('../assets/images/camp/ui/zadania1.png', import.meta.url).href,
    },
    market: {
      key: 'campButtonMarket',
      url: new URL('../assets/images/camp/ui/rinok1.png', import.meta.url).href,
    },
    home: {
      key: 'campButtonHome',
      url: new URL('../assets/images/camp/ui/home1.png', import.meta.url).href,
    },
  } as const;

  constructor() {
    super('CampScene');
  }

  preload() {
    if (!this.textures.exists(this.CAMP_BACKGROUND_ASSET.key)) {
      this.load.image(this.CAMP_BACKGROUND_ASSET.key, this.CAMP_BACKGROUND_ASSET.url);
    }

    Object.values(this.CAMP_ACTION_ASSETS).forEach(asset => {
      if (!this.textures.exists(asset.key)) {
        this.load.image(asset.key, asset.url);
      }
    });
  }

  async create() {
    const layout = this.getLayout();
    const fontLoadPromise = this.loadPixelFontOnce();

    await this.prepareStartupOnce();
    await fontLoadPromise;
      
    this.grantStartGoldOnce();
    this.extinguishCityCampfireIfExpired();
    this.restoreSanityAndSaveIfValueChanged();
      
    this.createCampBackdrop(layout);
    this.createCityCampfireVisualState(layout);

    this.createHeader(layout);
    this.createHeroStatusCard(layout);
    this.createMainActions(layout);

    createBottomNav(this, {
      activeScene: 'CampScene',
    });

    this.applyPixelFontToSceneTexts();

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

  private async loadPixelFontOnce() {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !document.fonts) {
      return;
    }

    if (!CampScene.pixelFontPromise) {
      CampScene.pixelFontPromise = new Promise<void>((resolve) => {
        const styleId = 'camp-scene-pixeloid-mono-font';

        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
@font-face {
  font-family: "${this.PIXEL_FONT_FACE_NAME}";
  src: url("${this.PIXEL_FONT_ASSET_URL}") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}`;
          document.head.appendChild(style);
        }

        const font = new FontFace(
          this.PIXEL_FONT_FACE_NAME,
          `url("${this.PIXEL_FONT_ASSET_URL}") format("truetype")`,
          {
            weight: '400',
            style: 'normal',
          }
        );

        font.load()
          .then(loadedFont => {
            document.fonts.add(loadedFont);
            return document.fonts.load(`18px "${this.PIXEL_FONT_FACE_NAME}"`);
          })
          .then(() => document.fonts.ready)
          .then(() => {
            console.info(`[CampScene] Pixel font loaded: ${this.PIXEL_FONT_FACE_NAME}`);
            resolve();
          })
          .catch(error => {
            console.warn(
              'CampScene pixel font was not loaded. Check this file exists: src/assets/fonts/PixeloidMono.ttf',
              error
            );
            resolve();
          });
      });
    }

    await CampScene.pixelFontPromise;
  }

  private applyPixelFontToSceneTexts() {
    const applyToObject = (object: Phaser.GameObjects.GameObject) => {
      if (object instanceof Phaser.GameObjects.Text) {
        object.setFontFamily(this.PIXEL_FONT_FAMILY);
        object.updateText();
        return;
      }

      if (object instanceof Phaser.GameObjects.Container) {
        object.list.forEach(child => {
          applyToObject(child as Phaser.GameObjects.GameObject);
        });
      }
    };

    this.children.list.forEach(child => {
      applyToObject(child);
    });

    // Повторное применение через кадр нужно для Canvas/Phaser Text,
    // когда браузер подтвердил загрузку шрифта, но текстуры текста ещё не перерисовались.
    this.time.delayedCall(80, () => {
      this.children.list.forEach(child => {
        applyToObject(child);
      });
    });
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

    this.cameras.main.fadeIn(220, 0, 0, 0);

    if (this.textures.exists(this.CAMP_BACKGROUND_ASSET.key)) {
      const bg = this.add.image(centerX, height / 2, this.CAMP_BACKGROUND_ASSET.key)
        .setOrigin(0.5)
        .setDepth(0);

      const scale = Math.max(
        width / Math.max(1, bg.width),
        height / Math.max(1, bg.height)
      );

      bg.setScale(scale);

      // Небольшой сдвиг вверх: вход в катакомбы и двор остаются видимыми за UI.
      bg.setY(height / 2 - height * 0.035);
    } else {
      // Fallback только на случай, если ассет реально не найден.
      this.add.rectangle(centerX, height / 2, width, height, 0x05070a, 1)
        .setDepth(0);
    }

    // Общий слой читаемости: не скрывает фон полностью.
    this.add.rectangle(centerX, height / 2, width, height, 0x000000, 0.28)
      .setDepth(1);

    // Локальные затемнения под UI, вместо огромного чёрного фона.
    this.add.rectangle(centerX, height * 0.17, width, height * 0.34, 0x000000, 0.24)
      .setDepth(1);
    this.add.rectangle(centerX, height * 0.52, width, height * 0.22, 0x000000, 0.12)
      .setDepth(1);
    this.add.rectangle(centerX, height * 0.81, width, height * 0.42, 0x000000, 0.32)
      .setDepth(1);

    // Виньетка по краям.
    this.add.rectangle(8, height / 2, 16, height, 0x000000, 0.26)
      .setDepth(1);
    this.add.rectangle(width - 8, height / 2, 16, height, 0x000000, 0.26)
      .setDepth(1);
    this.add.rectangle(centerX, 12, width, 24, 0x000000, 0.32)
      .setDepth(1);
    this.add.rectangle(centerX, height - 12, width, 24, 0x000000, 0.38)
      .setDepth(1);

    // Очень лёгкий тёплый акцент, чтобы костры на фоне поддерживали атмосферу.
    const torchGlow = this.add.circle(
      centerX,
      height * 0.58,
      Math.min(width * 0.28, 112),
      0xd28a3a,
      0.045
    ).setDepth(1.2);

    this.tweens.add({
      targets: torchGlow,
      alpha: { from: 0.025, to: 0.07 },
      scale: { from: 0.96, to: 1.04 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: layout.veryCompact ? '20px' : layout.compact ? '24px' : '28px',
      color: '#e0c585',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12);

    const subtitle = this.add.text(layout.centerX, panelY + (layout.veryCompact ? 14 : 18), 'последний пиксельный огонь перед тьмой', {
      fontFamily: this.PIXEL_FONT_FAMILY,
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
          fontFamily: this.PIXEL_FONT_FAMILY,
          fontSize: '14px',
          color: '#b99257',
          stroke: '#000000',
          strokeThickness: 1,
        }
      ).setOrigin(0.5).setDepth(12);
    });

    this.playPixelIntro([panel.shadow, panel.panel, topLine, bottomLine, title, subtitle], 40);
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
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: layout.veryCompact ? '22px' : '26px',
      color: '#d8b56d',
      stroke: '#000000',
      strokeThickness: 2,
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
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: layout.veryCompact ? '15px' : layout.compact ? '18px' : '20px',
      color: '#e0c585',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: titleWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);

    this.add.text(titleX, top + (layout.veryCompact ? 45 : 54), race ? race.description : 'Путь ещё не выбран.', {
      fontFamily: this.PIXEL_FONT_FAMILY,
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

    const boardWidth = layout.contentWidth + 20;
    const boardHeight = layout.actionsHeight + 30;
    const boardY = layout.actionsTop + boardHeight / 2;
    const board = this.add.container(layout.centerX, boardY).setDepth(8);

    const boardBg = this.add.image(0, 0, this.CAMP_ACTION_ASSETS.board.key)
      .setDisplaySize(boardWidth, boardHeight)
      .setOrigin(0.5)
      .setAlpha(cityCampfireActive ? 1 : 0.96);

    board.add(boardBg);

    // oblast1.png остаётся прежнего размера. Меняем только кнопки:
    // они становятся крупнее и попадают в нарисованные слоты области.
    const sidePadding = layout.veryCompact ? 40 : layout.compact ? 44 : 48;
    const innerWidth = boardWidth - sidePadding * 2;
    const columnGap = layout.veryCompact ? 12 : layout.compact ? 16 : 18;

    const bigButtonWidth = innerWidth;
    const smallButtonWidth = Math.floor((innerWidth - columnGap) / 2);

    const dungeonHeight = layout.veryCompact ? 120 : layout.compact ? 128 : 134;
    const smallHeight = layout.veryCompact ? 106 : layout.compact ? 114 : 118;
    const wideHeight = layout.veryCompact ? 106 : layout.compact ? 114 : 120;

    const leftX = -bigButtonWidth / 2 + smallButtonWidth / 2;
    const rightX = bigButtonWidth / 2 - smallButtonWidth / 2;

    // Центры слотов подобраны под саму картинку oblast1.png.
    // Так область не меняет размер, а кнопки попадают в готовые места.
    const topSlot = -boardHeight * (layout.veryCompact ? 0.260 : 0.265);
    const row1Y = -boardHeight * (layout.veryCompact ? 0.115 : 0.120);
    const row2Y = boardHeight * (layout.veryCompact ? 0.020 : 0.015);
    const marketY = boardHeight * (layout.veryCompact ? 0.160 : 0.155);
    const homeY = boardHeight * (layout.veryCompact ? 0.300 : 0.295);

    const dungeonY = topSlot;

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

    this.createImageActionButton({
      board,
      x: 0,
      y: dungeonY,
      width: bigButtonWidth,
      height: dungeonHeight,
      textureKey: this.CAMP_ACTION_ASSETS.dungeon.key,
      title: dungeonTitle,
      status: dungeonStatus,
      titleFontSize: layout.veryCompact ? '17px' : layout.compact ? '20px' : '21px',
      statusFontSize: layout.veryCompact ? '10px' : '12px',
      textX: -bigButtonWidth / 2 + (layout.veryCompact ? 114 : layout.compact ? 132 : 146),
      rightPadding: 50,
      titleColor: '#fff0c2',
      statusColor: '#e7c89a',
      highlighted: hasActiveRun || hasActiveCheckpoint,
      onClick: () => {
        this.tryEnterCatacombs();
      },
      delay: 120,
    });

    const smallButtons = [
      {
        x: leftX,
        y: row1Y,
        textureKey: this.CAMP_ACTION_ASSETS.campfire.key,
        title: 'Костёр',
        status: this.getCityCampfireButtonStatus(),
        titleColor: '#f6dfae',
        statusColor: '#d8bd86',
        highlighted: cityCampfireActive,
        onClick: () => {
          this.restAtCampfire();
        },
      },
      {
        x: rightX,
        y: row1Y,
        textureKey: this.CAMP_ACTION_ASSETS.temple.key,
        title: 'Храм',
        status: hasAscensionPoints ? `Очки: ${ascensionPoints}` : 'Древо силы',
        titleColor: '#e5ddff',
        statusColor: '#c8bee8',
        highlighted: hasAscensionPoints,
        onClick: () => {
          this.scene.start('StatsTreeScene');
        },
      },
      {
        x: leftX,
        y: row2Y,
        textureKey: this.CAMP_ACTION_ASSETS.tavern.key,
        title: 'Таверна',
        status: 'Отдых',
        titleColor: '#f1d0a5',
        statusColor: '#c7aa80',
        highlighted: false,
        onClick: () => {
          this.scene.start('TavernScene');
        },
      },
      {
        x: rightX,
        y: row2Y,
        textureKey: this.CAMP_ACTION_ASSETS.quests.key,
        title: 'Задания',
        status: hasQuestReward ? 'Есть награда' : 'Награды',
        titleColor: '#e5f4d5',
        statusColor: '#bed8a8',
        highlighted: hasQuestReward,
        onClick: () => {
          this.scene.start('QuestScene');
        },
      },
    ];

    smallButtons.forEach((button, index) => {
      const created = this.createImageActionButton({
        board,
        x: button.x,
        y: button.y,
        width: smallButtonWidth,
        height: smallHeight,
        textureKey: button.textureKey,
        title: button.title,
        status: button.status,
        titleFontSize: layout.veryCompact ? '13px' : layout.compact ? '15px' : '16px',
        statusFontSize: layout.veryCompact ? '9px' : '10px',
        textX: -smallButtonWidth / 2 + (layout.veryCompact ? 102 : layout.compact ? 114 : 122),
        rightPadding: 14,
        titleColor: button.titleColor,
        statusColor: button.statusColor,
        highlighted: button.highlighted,
        onClick: button.onClick,
        delay: 170 + index * 45,
      });

      if (button.title === 'Костёр') {
        this.restButtonLabel = created.titleText;
        this.restButtonDescription = created.descriptionText;
      }
    });

    this.createImageActionButton({
      board,
      x: 0,
      y: marketY,
      width: bigButtonWidth,
      height: wideHeight,
      textureKey: this.CAMP_ACTION_ASSETS.market.key,
      title: 'Рынок',
      status: 'Торговцы',
      titleFontSize: layout.veryCompact ? '16px' : layout.compact ? '18px' : '19px',
      statusFontSize: layout.veryCompact ? '10px' : '11px',
      textX: -bigButtonWidth / 2 + (layout.veryCompact ? 92 : layout.compact ? 110 : 124),
      rightPadding: 50,
      titleColor: '#f2dfac',
      statusColor: '#ccb98a',
      highlighted: false,
      onClick: () => {
        this.scene.start('MarketScene');
      },
      delay: 350,
    });

    this.createImageActionButton({
      board,
      x: 0,
      y: homeY,
      width: bigButtonWidth,
      height: wideHeight,
      textureKey: this.CAMP_ACTION_ASSETS.home.key,
      title: 'Дом',
      status: 'Убежище',
      titleFontSize: layout.veryCompact ? '16px' : layout.compact ? '18px' : '19px',
      statusFontSize: layout.veryCompact ? '10px' : '11px',
      textX: -bigButtonWidth / 2 + (layout.veryCompact ? 92 : layout.compact ? 110 : 124),
      rightPadding: 50,
      titleColor: '#e4edf6',
      statusColor: '#bcc9d6',
      highlighted: false,
      onClick: () => {
        this.scene.start('HomeScene');
      },
      delay: 395,
    });

    this.playPixelContainerIntro(board, 80);
    this.startCampfireTimer();
  }

  private async prepareStartupOnce() {
    if (CampScene.startupPrepared) {
      return;
    }

    if (!CampScene.startupPromise) {
      CampScene.startupPromise = this.prepareStartup()
        .catch(error => {
          console.warn('CampScene startup failed:', error);
        })
        .finally(() => {
          CampScene.startupPrepared = true;
        });
    }

    await CampScene.startupPromise;
  }

  private async prepareStartup() {
    let timeoutId: number | undefined;

    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutId = window.setTimeout(() => {
        console.warn('CampScene startup timeout. Continue without blocking scene.');
        resolve();
      }, 2500);
    });

    try {
      await Promise.race([
        loadGameAsync(),
        timeoutPromise,
      ]);
    } catch (error) {
      console.warn('CampScene loadGameAsync failed. Continue with current/local data:', error);
    } finally {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  private createImageActionButton(config: {
    board: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    textureKey: string;
    title: string;
    status: string;
    titleFontSize: string;
    statusFontSize: string;
    textX: number;
    rightPadding: number;
    titleColor: string;
    statusColor: string;
    highlighted: boolean;
    onClick: () => void;
    delay: number;
  }): CampActionButton {
    const container = this.add.container(config.x, config.y);

    const glow = this.add.rectangle(
      0,
      0,
      config.width - 16,
      Math.max(10, config.height - 14),
      0xf0a64a,
      config.highlighted ? 0.045 : 0
    );

    const buttonImage = this.add.image(0, 0, config.textureKey)
      .setOrigin(0.5)
      .setDisplaySize(config.width, config.height)
      .setAlpha(config.highlighted ? 1 : 0.97);

    const textWidth = Math.max(
      70,
      config.width / 2 - config.textX - config.rightPadding
    );

    const titleY = -config.height * 0.15;
    const statusY = config.height * 0.18;

    const titleText = this.add.text(config.textX, titleY, config.title, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: config.titleFontSize,
      color: config.titleColor,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const statusText = this.add.text(config.textX, statusY, config.status, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: config.statusFontSize,
      color: config.statusColor,
      stroke: '#000000',
      strokeThickness: 1,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    container.add([
      glow,
      buttonImage,
      titleText,
      statusText,
    ]);

    config.board.add(container);

    // ВАЖНО:
    // press zone создаётся ДО intro-анимации.
    // Тогда baseY в createImagePressZone запоминается правильно,
    // и кнопка не остаётся съехавшей вниз после pointerout.
    this.createImagePressZone({
      container,
      width: config.width,
      height: config.height,
      buttonImage,
      glow,
      onClick: config.onClick,
    });

    this.playPixelContainerIntro(container, config.delay);

    if (config.highlighted) {
      this.tweens.add({
        targets: [buttonImage, glow],
        alpha: { from: 0.78, to: 1 },
        duration: 560,
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

  private createImagePressZone(config: {
    container: Phaser.GameObjects.Container;
    width: number;
    height: number;
    buttonImage: Phaser.GameObjects.Image;
    glow: Phaser.GameObjects.Rectangle;
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
      config.buttonImage.setAlpha(1);
      config.glow.setAlpha(0);
    };

    zone.on('pointerdown', () => {
      if (isLocked) return;
      isPressed = true;
      config.container.setY(baseY + 2);
      config.buttonImage.setAlpha(0.9);
      config.glow.setAlpha(0.08);
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
          config.buttonImage.setAlpha(1);
          config.glow.setAlpha(0);
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
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '10px',
      color: '#a99d8a',
      wordWrap: { width: config.width * 0.45, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);

    this.add.text(left + config.width, config.y - 12, config.value, {
      fontFamily: this.PIXEL_FONT_FAMILY,
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
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '10px',
      color: '#b8aee0',
      wordWrap: { width: config.width * 0.55, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);

    this.sanityValueText = this.add.text(left + config.width, config.y - 12, `${player.sanity}/${player.maxSanity}`, {
      fontFamily: this.PIXEL_FONT_FAMILY,
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
      fontFamily: this.PIXEL_FONT_FAMILY,
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
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '11px',
      color: '#d8b56d',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(x - width / 2 + 35, y, value, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '12px',
      color: '#d8c7a3',
      stroke: '#000000',
      strokeThickness: 1,
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
        fontFamily: this.PIXEL_FONT_FAMILY,
        fontSize: '10px',
        color: '#d8b56d',
      }).setOrigin(0.5).setDepth(config.depth + 2);
    }

    this.add.text(textX, config.y, config.text, {
      fontFamily: this.PIXEL_FONT_FAMILY,
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
      fontFamily: this.PIXEL_FONT_FAMILY,
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
        fontFamily: this.PIXEL_FONT_FAMILY,
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
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '20px',
      color: canSelect
        ? config.flintType === 'donate' ? '#d7b7ff' : '#f0c17d'
        : '#6b6258',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(1005);

    const title = this.add.text(textX, config.y - 25, config.title, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '17px',
      color: canSelect ? '#d8c088' : '#766d62',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: config.width - 168,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(1005);

    const description = this.add.text(textX, config.y + 1, config.description, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '12px',
      color: canSelect ? '#b8aa91' : '#6f665b',
      wordWrap: {
        width: config.width - 168,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(1005);

    const cost = this.add.text(textX, config.y + 25, costText, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '10px',
      color: canSelect ? '#8f877a' : '#c4877f',
      wordWrap: {
        width: config.width - 168,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(1005);

    const action = this.add.text(left + config.width - 50, config.y, buttonText, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '12px',
      color: canSelect ? '#f0d58a' : '#7d6860',
      stroke: '#000000',
      strokeThickness: 1,
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
      fontFamily: this.PIXEL_FONT_FAMILY,
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
        fontFamily: this.PIXEL_FONT_FAMILY,
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
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: layout.compact ? '26px' : '29px',
      color: '#c9a86a',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 80,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(1002);

    const messageText = this.add.text(layout.centerX, layout.height / 2 - 10, message, {
      fontFamily: this.PIXEL_FONT_FAMILY,
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
