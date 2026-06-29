import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getRaceById } from '../data/races';

import { getPlayerStats, restorePlayerVitalsToMaximum } from '../systems/InventorySystem';
import { loadGameAsync, saveGameAsync } from '../systems/SaveSystem';
import {getVKUser, initVKBridge} from '../systems/VKBridgeSystem';
import {
  SANITY_COST_PER_FLOOR,
  hasEnoughSanityForFloor,
  restoreSanityByTime,
} from '../systems/SanitySystem';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';
import { NAV_BACKPACK_ASSET } from '../data/itemSprites';
import { preloadRaceAvatars } from '../data/raceSprites';
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

type CampMapHotspot = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accentColor: number;
  onClick: () => void;
};

type CampMapViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CampMapHotspotVisual = {
  hotspot: CampMapHotspot;
  glow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  debugBox?: Phaser.GameObjects.Rectangle;
  debugLabel?: Phaser.GameObjects.Text;
  activeTween?: Phaser.Tweens.Tween;
};

const DEBUG_CAMP_HOTSPOTS = false;

export class CampScene extends Phaser.Scene {
  private static startupPrepared = false;
  private static startupPromise?: Promise<void>;
  private static pixelFontPromise?: Promise<void>;

  private restButtonLabel?: Phaser.GameObjects.Text;
  private restButtonDescription?: Phaser.GameObjects.Text;
  private cityCampfireWarmOverlay?: Phaser.GameObjects.Rectangle;
  private cityCampfireGlowObjects: Phaser.GameObjects.GameObject[] = [];
  private cityCampfireVisualTweens: Phaser.Tweens.Tween[] = [];

  private campMapContainer?: Phaser.GameObjects.Container;

  private campMapMaskGraphics?: Phaser.GameObjects.Graphics;
  private campMapViewport?: CampMapViewport;
  private campMapHotspots: CampMapHotspot[] = [];
  private campMapHotspotVisuals = new Map<string, CampMapHotspotVisual>();
  private hoveredCampMapHotspotId?: string;
  private campMapScale = 1;
  private campMapImageWidth = 0;
  private campMapImageHeight = 0;
  private campMapMinX = 0;
  private campMapMaxX = 0;
  private campMapMinY = 0;
  private campMapMaxY = 0;
  private campMapTargetX = 0;
  private campMapTargetY = 0;
  private campMapDragging = false;
  private campMapDidDrag = false;
  private campMapDragStartPointerX = 0;
  private campMapDragStartPointerY = 0;
  private campMapDragStartX = 0;
  private campMapDragStartY = 0;
  private campMapClickLocked = false;
  private campMapPointerDownHandler?: (pointer: Phaser.Input.Pointer) => void;
  private campMapPointerMoveHandler?: (pointer: Phaser.Input.Pointer) => void;
  private campMapPointerUpHandler?: (pointer: Phaser.Input.Pointer) => void;
  private campMapWheelHandler?: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number
  ) => void;

  private campfireTimerEvent?: Phaser.Time.TimerEvent;
  private sanityTimerEvent?: Phaser.Time.TimerEvent;
  private sanityValueText?: Phaser.GameObjects.Text;
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

  private readonly CAMP_INTERACTIVE_MAP_ASSET = {
    key: 'campInteractiveMap',
    url: new URL('../assets/images/camp/camp_interactive_map.png', import.meta.url).href,
  } as const;

  constructor() {
    super('CampScene');
  }

  preload() {
    if (!this.textures.exists(this.CAMP_BACKGROUND_ASSET.key)) {
      this.load.image(this.CAMP_BACKGROUND_ASSET.key, this.CAMP_BACKGROUND_ASSET.url);
    }

    if (!this.textures.exists(this.CAMP_INTERACTIVE_MAP_ASSET.key)) {
      this.load.image(this.CAMP_INTERACTIVE_MAP_ASSET.key, this.CAMP_INTERACTIVE_MAP_ASSET.url);
    }

    if (!this.textures.exists(NAV_BACKPACK_ASSET.key)) {
      this.load.image(NAV_BACKPACK_ASSET.key, NAV_BACKPACK_ASSET.url);
    }

    preloadRaceAvatars(this);

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.applyNearestFilterToCampTextures();
    });
  }

  private applyNearestFilterToCampTextures() {
    const keys = [
      this.CAMP_BACKGROUND_ASSET.key,
      this.CAMP_INTERACTIVE_MAP_ASSET.key,
    ];

    keys.forEach(key => {
      const texture = this.textures.get(key);

      try {
        (texture as any).setFilter?.(Phaser.Textures.FilterMode.NEAREST);
      } catch {
        // Фильтр нужен только PNG-текстурам. Текст и PixeloidMono не трогаем.
      }
    });
  }

  async create() {
    this.notifyVKAppReady();

    console.info('[CampScene] create started');

    const loadingOverlay = this.createInternalLoadingScreen();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.campfireTimerEvent?.remove(false);
      this.campfireTimerEvent = undefined;
      this.sanityTimerEvent?.remove(false);
      this.sanityTimerEvent = undefined;
      this.cleanupCampMapInput();
      this.clearCampMapHotspotVisuals();
      this.campMapMaskGraphics?.destroy();
      this.campMapMaskGraphics = undefined;
      this.campMapContainer = undefined;
      this.campMapClickLocked = false;
      this.campMapDragging = false;
      this.campMapDidDrag = false;
      this.hoveredCampMapHotspotId = undefined;
      this.campMapHotspots = [];
      this.campMapHotspotVisuals.clear();
      this.cityCampfireVisualTweens.forEach(tween => tween.stop());
      this.cityCampfireVisualTweens = [];
      this.sanityValueText = undefined;
      this.sanityFill = undefined;
    });

    try {
      await Promise.all([
        this.prepareStartupOnce(),
        this.loadPixelFontOnce(),
      ]);
    } catch (error) {
      console.warn('[CampScene] startup/load finished with fallback:', error);
    }

    if (!this.scene.isActive()) {
      return;
    }

    loadingOverlay.destroy();

    const layout = this.getLayout();

    try {
      this.grantStartGoldOnce();
      this.extinguishCityCampfireIfExpired();
      this.restoreSanityAndSaveIfValueChanged();

      this.applyNearestFilterToCampTextures();
      this.createCampBackdrop(layout);
      this.createCityCampfireVisualState(layout);

      this.createCompactTopHud(layout);
      this.createMainActions(layout);

      createBottomNav(this, {
        activeScene: 'CampScene',
      });

      this.applyPixelFontToSceneTexts();

      console.info('[CampScene] UI rendered after save load', {
        name: player.name,
        level: player.level,
        raceId: player.raceId,
        gold: player.gold,
      });
    } catch (error) {
      console.error('[CampScene] render failed:', error);
      this.showCampSceneFatalError(error);
      return;
    }
  }

  update() {
    if (!this.campMapContainer || this.campMapDragging) {
      return;
    }

    const dx = Math.abs(this.campMapContainer.x - this.campMapTargetX);
    const dy = Math.abs(this.campMapContainer.y - this.campMapTargetY);

    if (dx < 0.35 && dy < 0.35) {
      this.campMapContainer.setPosition(this.campMapTargetX, this.campMapTargetY);
      return;
    }

    this.campMapContainer.setPosition(
      Phaser.Math.Linear(this.campMapContainer.x, this.campMapTargetX, 0.18),
      Phaser.Math.Linear(this.campMapContainer.y, this.campMapTargetY, 0.18)
    );
  }

  private createInternalLoadingScreen() {
    const { width, height } = this.scale;
    const container = this.add.container(width / 2, height / 2).setDepth(9999);

    const bg = this.add.rectangle(0, 0, width, height, 0x050607, 0.94);
    const panel = this.add.rectangle(0, 0, Math.min(width - 44, 420), 132, 0x090b0f, 0.96)
      .setStrokeStyle(2, 0x8b6a3f, 0.75);

    const title = this.add.text(0, -24, 'Загрузка героя', {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '18px',
      color: '#e0c585',
      align: 'center',
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, 18, 'получаем сохранение Supabase...', {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '12px',
      color: '#9f9078',
      align: 'center',
      wordWrap: {
        width: Math.min(width - 82, 360),
        useAdvancedWrap: true,
      },
    }).setOrigin(0.5);

    container.add([bg, panel, title, subtitle]);

    this.tweens.add({
      targets: subtitle,
      alpha: { from: 0.45, to: 1 },
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return container;
  }

  private notifyVKAppReady() {
    void initVKBridge()
      .then(isReady => {
        console.info(`[CampScene] VKWebAppInit ${isReady ? 'sent' : 'skipped/failed'}`);
      })
      .catch(error => {
        console.warn('[CampScene] VKWebAppInit failed:', error);
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

    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error('CampScene startup timeout: server save was not loaded in time.'));
      }, 9000);
    });

    try {
      await initVKBridge();

      const vkUser = await getVKUser();

      if (!vkUser?.id) {
        throw new Error('VK user id is missing. Supabase save cannot be loaded safely.');
      }

      console.info('[CampScene] Loading Supabase save for VK user:', vkUser.id);

      const result = await Promise.race([
        loadGameAsync({
          preferVK: true,
          blockLocalFallback: true,
        }),
        timeoutPromise,
      ]);

      console.info('[CampScene] save loaded', result);
    } catch (error) {
      console.warn('CampScene cloud save loading failed. Local fallback is blocked to avoid wrong account:', error);
      throw error;
    } finally {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
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

    // Верх сцены теперь занимает только тонкий RPG HUD.
    const headerHeight = veryCompact ? 56 : compact ? 60 : 64;
    const heroTop = safeTop;
    const heroHeight = headerHeight;
    const actionsTop = safeTop + headerHeight + 2;
    const actionsBottom = bottomNavTop;
    const actionsHeight = Math.max(320, actionsBottom - actionsTop);

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

    // Мягкое затемнение только сверху и снизу. Боковые полосы убраны,
    // чтобы карта не выглядела обрезанной по вертикальным краям.
    this.add.rectangle(centerX, 12, width, 24, 0x000000, 0.24)
      .setDepth(1);
    this.add.rectangle(centerX, height - 12, width, 24, 0x000000, 0.28)
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

  // REAL COMPACT HUD: replaces old createHeader/createHeroStatusCard panels.
  private createCompactTopHud(layout: CampLayout) {
    restoreSanityByTime();

    const race = player.raceId ? getRaceById(player.raceId) : undefined;
    const stats = getPlayerStats(player);

    const hudHeight = layout.headerHeight;
    const hudTop = layout.safeTop;
    const hudY = hudTop + hudHeight / 2;
    const hudWidth = layout.width;

    // Единая лёгкая подложка HUD без тяжёлых панелей и блоков.
    const hudBack = this.add.rectangle(
      layout.centerX,
      hudY,
      hudWidth,
      hudHeight + 8,
      0x050608,
      layout.veryCompact ? 0.50 : 0.46
    ).setDepth(38);

    const hudShadow = this.add.rectangle(
      layout.centerX,
      hudTop + hudHeight + 3,
      hudWidth,
      8,
      0x000000,
      0.22
    ).setDepth(38);

    const bronzeLine = this.add.rectangle(
      layout.centerX,
      hudTop + hudHeight,
      hudWidth - layout.safeX * 1.4,
      1,
      0xb99257,
      0.42
    ).setDepth(39);

    const avatarRadius = layout.veryCompact ? 20 : layout.compact ? 22 : 23;
    const avatarX = layout.safeX + avatarRadius + 6;
    const avatarY = hudY;

    const avatarGlow = this.add.circle(avatarX, avatarY, avatarRadius + 5, 0x7d55ff, 0.06)
      .setDepth(39)
      .setBlendMode(Phaser.BlendModes.ADD);

    const avatarBack = this.add.circle(avatarX, avatarY, avatarRadius, 0x09090d, 0.96)
      .setStrokeStyle(2, 0xb99257, 0.76)
      .setDepth(40);

    const avatarInner = this.add.circle(avatarX, avatarY, Math.max(4, avatarRadius - 5), 0x131018, 0.78)
      .setDepth(40);

    const raceTextureKey = player.raceId ? `race_${player.raceId}` : undefined;
    let avatarObject: Phaser.GameObjects.GameObject;

    if (raceTextureKey && this.textures.exists(raceTextureKey)) {
      const avatarImage = this.add.image(avatarX, avatarY, raceTextureKey)
        .setOrigin(0.5)
        .setDisplaySize(avatarRadius * 1.65, avatarRadius * 1.65)
        .setDepth(41);

      const avatarMask = this.add.graphics();
      avatarMask.fillStyle(0xffffff, 1);
      avatarMask.fillCircle(avatarX, avatarY, avatarRadius - 3);
      avatarMask.setVisible(false);
      avatarImage.setMask(avatarMask.createGeometryMask());

      avatarObject = avatarImage;
    } else {
      avatarObject = this.add.text(avatarX, avatarY, race ? this.getRaceIcon(race.id) : '◆', {
        fontFamily: this.PIXEL_FONT_FAMILY,
        fontSize: layout.veryCompact ? '21px' : '24px',
        color: '#d8b56d',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
      }).setOrigin(0.5).setDepth(41);
    }

    const goldPanelWidth = layout.veryCompact ? 76 : layout.compact ? 86 : 92;
    const goldPanelHeight = 20;
    const goldPanelX = layout.width - layout.safeX - goldPanelWidth / 2 - 2;
    const goldPanelY = hudTop + (layout.veryCompact ? 14 : 15);

    const goldPill = this.add.graphics().setDepth(40);
    goldPill.fillStyle(0x0b0908, 0.86);
    goldPill.fillRoundedRect(
      goldPanelX - goldPanelWidth / 2,
      goldPanelY - goldPanelHeight / 2,
      goldPanelWidth,
      goldPanelHeight,
      8
    );
    goldPill.lineStyle(1, 0xb99257, 0.58);
    goldPill.strokeRoundedRect(
      goldPanelX - goldPanelWidth / 2,
      goldPanelY - goldPanelHeight / 2,
      goldPanelWidth,
      goldPanelHeight,
      8
    );

    const goldText = this.add.text(goldPanelX, goldPanelY, `◆ ${player.gold}`, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: layout.veryCompact ? '9px' : '10px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: goldPanelWidth - 10,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(41);

    const infoX = avatarX + avatarRadius + (layout.veryCompact ? 9 : 11);
    const goldLeft = goldPanelX - goldPanelWidth / 2;
    const titleWidth = Math.max(96, goldLeft - infoX - 10);
    const raceTitle = race ? race.name : player.name || 'Безымянный';

    const titleText = this.add.text(infoX, hudTop + (layout.veryCompact ? 12 : 13), raceTitle, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: layout.veryCompact ? '11px' : layout.compact ? '12px' : '13px',
      color: '#e0c585',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: titleWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(41);

    const labelWidth = layout.veryCompact ? 22 : 26;
    const valueWidth = layout.veryCompact ? 42 : 48;
    const barGapX = layout.veryCompact ? 4 : 5;
    const availableTotalWidth = Math.max(132, goldLeft - infoX - 10);
    const maxBarWidth = Math.max(70, availableTotalWidth - labelWidth - valueWidth - barGapX * 2);

    const hpBarWidth = maxBarWidth;
    const energyBarWidth = Math.max(54, Math.floor(maxBarWidth * 0.78));
    const sanityBarWidth = Math.max(48, Math.floor(maxBarWidth * 0.62));

    const barsStartY = hudTop + (layout.veryCompact ? 28 : 30);
    const rowGap = layout.veryCompact ? 8 : 9;

    this.createCompactHudBar({
      x: infoX,
      y: barsStartY,
      width: hpBarWidth,
      label: 'HP',
      value: `${player.hp}/${stats.maxHp}`,
      progress: stats.maxHp > 0 ? player.hp / stats.maxHp : 1,
      color: 0x9f3535,
      textColor: '#f0b1a8',
      depth: 41,
      veryCompact: layout.veryCompact,
    });

    this.createCompactHudBar({
      x: infoX,
      y: barsStartY + rowGap,
      width: energyBarWidth,
      label: 'ЭН',
      value: `${player.energy}/${stats.maxEnergy}`,
      progress: stats.maxEnergy > 0 ? player.energy / stats.maxEnergy : 1,
      color: 0x356ea6,
      textColor: '#b9d8ff',
      depth: 41,
      veryCompact: layout.veryCompact,
    });

    const sanityBar = this.createCompactHudBar({
      x: infoX,
      y: barsStartY + rowGap * 2,
      width: sanityBarWidth,
      label: 'РАЗ',
      value: `${player.sanity}/${player.maxSanity}`,
      progress: player.maxSanity > 0 ? player.sanity / player.maxSanity : 1,
      color: player.sanity <= player.maxSanity * 0.25 ? 0x8f3d67 : 0x6f5a91,
      textColor: '#d7cbff',
      depth: 41,
      veryCompact: layout.veryCompact,
    });

    this.sanityFill = sanityBar.fill;
    this.sanityFillWidth = sanityBar.maxFillWidth;
    this.sanityValueText = sanityBar.valueText;

    if (player.maxSanity > 0 && player.sanity / player.maxSanity <= 0.25) {
      this.tweens.add({
        targets: this.sanityFill,
        alpha: { from: 0.62, to: 1 },
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    const introObjects: Phaser.GameObjects.GameObject[] = [
      hudBack,
      hudShadow,
      bronzeLine,
      avatarGlow,
      avatarBack,
      avatarInner,
      avatarObject,
      goldPill,
      goldText,
      titleText,
    ];

    this.playPixelIntro(introObjects, 20);

    this.tweens.add({
      targets: [avatarGlow, avatarBack, avatarInner, avatarObject],
      alpha: { from: 0.25, to: 1 },
      duration: 170,
      delay: 55,
      ease: 'Sine.easeOut',
    });

    this.startSanityTimer();
  }

  private createCompactHudBar(config: {
    x: number;
    y: number;
    width: number;
    label: string;
    value: string;
    progress: number;
    color: number;
    textColor: string;
    depth: number;
    veryCompact: boolean;
  }) {
    const progress = Phaser.Math.Clamp(config.progress, 0, 1);
    const labelWidth = config.veryCompact ? 22 : 26;
    const valueWidth = config.veryCompact ? 42 : 48;
    const gap = config.veryCompact ? 4 : 5;
    const barHeight = config.veryCompact ? 4 : 5;
    const barLeft = config.x + labelWidth + gap;
    const barWidth = Math.max(28, config.width);
    const valueX = barLeft + barWidth + gap + valueWidth;

    const labelText = this.add.text(config.x, config.y, config.label, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: config.veryCompact ? '7px' : '8px',
      color: config.textColor,
      stroke: '#000000',
      strokeThickness: 2,
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(config.depth);

    const barBack = this.add.rectangle(barLeft, config.y, barWidth, barHeight, 0x030305, 0.88)
      .setOrigin(0, 0.5)
      .setDepth(config.depth);

    const backLine = this.add.rectangle(barLeft, config.y + barHeight / 2 + 1, barWidth, 1, 0x000000, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(config.depth);

    const fill = this.add.rectangle(
      barLeft,
      config.y,
      Math.max(1, barWidth * progress),
      Math.max(2, barHeight - 1),
      config.color,
      0.96
    )
      .setOrigin(0, 0.5)
      .setDepth(config.depth + 1);

    const highlight = this.add.rectangle(
      barLeft,
      config.y - Math.max(1, barHeight / 3),
      Math.max(1, barWidth * progress),
      1,
      0xffffff,
      0.16
    )
      .setOrigin(0, 0.5)
      .setDepth(config.depth + 2);

    const valueText = this.add.text(valueX, config.y, config.value, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: config.veryCompact ? '7px' : '8px',
      color: '#d8c7a3',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'right',
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(config.depth);

    this.tweens.add({
      targets: [fill, highlight],
      scaleX: { from: 0.01, to: 1 },
      duration: 220,
      delay: 70,
      ease: 'Sine.easeOut',
    });

    return {
      fill,
      highlight,
      barBack,
      backLine,
      labelText,
      valueText,
      maxFillWidth: barWidth,
    };
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
    this.createInteractiveCampMap(layout);
    this.startCampfireTimer();
  }

  private createInteractiveCampMap(layout: CampLayout) {
    this.cleanupCampMapInput();
    this.clearCampMapHotspotVisuals();
    this.campMapMaskGraphics?.destroy();
    this.campMapMaskGraphics = undefined;

    // ВАЖНО: сброс состояния при каждом новом входе в CampScene.
    // Без этого после перехода на другую сцену и возврата hotspot могут остаться заблокированными.
    this.campMapClickLocked = false;
    this.campMapDragging = false;
    this.campMapDidDrag = false;
    this.hoveredCampMapHotspotId = undefined;
    this.campMapTargetX = 0;
    this.campMapTargetY = 0;

    const viewport: CampMapViewport = {
      x: 0,
      y: layout.actionsTop,
      width: layout.width,
      height: layout.actionsHeight,
    };

    this.campMapViewport = viewport;

    const viewportCenterX = viewport.x + viewport.width / 2;
    const viewportCenterY = viewport.y + viewport.height / 2;

    this.add.rectangle(viewportCenterX, viewportCenterY, viewport.width, viewport.height, 0x020304, 0.35)
      .setDepth(2);

    const mapContainer = this.add.container(0, 0).setDepth(3);
    this.campMapContainer = mapContainer;

    const mapImage = this.add.image(0, 0, this.CAMP_INTERACTIVE_MAP_ASSET.key)
      .setOrigin(0.5)
      .setAlpha(1);

    this.campMapImageWidth = Math.max(1, mapImage.width);
    this.campMapImageHeight = Math.max(1, mapImage.height);

    const baseScale = Math.max(
      viewport.width / this.campMapImageWidth,
      viewport.height / this.campMapImageHeight
    );
    const zoom = layout.veryCompact ? 1.72 : layout.compact ? 1.64 : 1.56;

    this.campMapScale = baseScale * zoom;
    mapContainer.setScale(this.campMapScale);
    mapContainer.add(mapImage);

    const maskGraphics = this.add.graphics();
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
    maskGraphics.setVisible(false);
    this.campMapMaskGraphics = maskGraphics;
    mapContainer.setMask(maskGraphics.createGeometryMask());

    this.createCampMapVignette(viewport);
    this.createCampMapHotspots(mapContainer);
    this.calculateCampMapBounds(viewport);

    const startFocus = this.getCampMapStartFocusPoint();
    const startPosition = this.getCampMapPositionForFocus(startFocus.x, startFocus.y, viewport);

    this.setCampMapPosition(startPosition.x, startPosition.y, true);
    this.installCampMapInputHandlers();
    this.updateCampMapHotspotStates();

    console.info('[CampScene] interactive map recreated', {
      scale: this.campMapScale,
      hotspots: this.campMapHotspots.length,
      clickLocked: this.campMapClickLocked,
    });

    this.tweens.add({
      targets: mapContainer,
      alpha: { from: 0, to: 1 },
      duration: 260,
      ease: 'Sine.easeOut',
    });
  }

  private createCampMapVignette(viewport: CampMapViewport) {
    const centerX = viewport.x + viewport.width / 2;

    // Только мягкое затемнение сверху/снизу. Боковые вертикальные полосы
    // специально не рисуем, чтобы по краям карты не было серых линий.
    this.add.rectangle(centerX, viewport.y + 10, viewport.width, 20, 0x000000, 0.22)
      .setDepth(4);

    this.add.rectangle(
      centerX,
      viewport.y + viewport.height - 12,
      viewport.width,
      24,
      0x000000,
      0.28
    ).setDepth(4);
  }

  private createCampMapHotspots(mapContainer: Phaser.GameObjects.Container) {
    this.campMapHotspots = [
      {
        id: 'dungeon',
        label: 'Вход в подземелье',
        x: 944,
        y: 261,
        width: 511,
        height: 347,
        accentColor: 0x7f55ff,
        onClick: () => this.tryEnterCatacombs(),
      },
      {
        id: 'temple',
        label: 'Храм',
        x: 449,
        y: 1174,
        width: 531,
        height: 429,
        accentColor: 0x7d55ff,
        onClick: () => this.scene.start('StatsTreeScene'),
      },
      {
        id: 'campfire',
        label: 'Костёр',
        x: 1379,
        y: 1194,
        width: 470,
        height: 367,
        accentColor: 0xf08a3c,
        onClick: () => this.restAtCampfire(),
      },
      {
        id: 'quests',
        label: 'Доска заданий',
        x: 511,
        y: 1908,
        width: 511,
        height: 286,
        accentColor: 0xd8c088,
        onClick: () => this.scene.start('QuestScene'),
      },
      {
        id: 'tavern',
        label: 'Таверна',
        x: 1317,
        y: 1949,
        width: 551,
        height: 510,
        accentColor: 0xf1b76a,
        onClick: () => this.scene.start('TavernScene'),
      },
      {
        id: 'market',
        label: 'Рынок',
        x: 878,
        y: 2602,
        width: 1409,
        height: 735,
        accentColor: 0xc98b55,
        onClick: () => this.scene.start('MarketScene'),
      },
      {
        id: 'home',
        label: 'Дом',
        x: 1307,
        y: 3609,
        width: 694,
        height: 612,
        accentColor: 0xd8b56d,
        onClick: () => this.scene.start('HomeScene'),
      },
    ];

    this.campMapHotspots.forEach(hotspot => {
      const localX = hotspot.x - this.campMapImageWidth / 2;
      const localY = hotspot.y - this.campMapImageHeight / 2;

      const glow = this.add.ellipse(
        localX,
        localY,
        hotspot.width,
        hotspot.height,
        hotspot.accentColor,
        0
      ).setBlendMode(Phaser.BlendModes.ADD);

      const label = this.add.text(localX, localY - hotspot.height / 2 - 18, hotspot.label, {
        fontFamily: this.PIXEL_FONT_FAMILY,
        fontSize: '18px',
        color: '#f2dfac',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
        wordWrap: {
          width: Math.max(160, hotspot.width),
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setAlpha(0);

      const zone = this.add.zone(localX, localY, hotspot.width, hotspot.height)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      const visual: CampMapHotspotVisual = {
        hotspot,
        glow,
        label,
        zone,
      };

      if (DEBUG_CAMP_HOTSPOTS) {
        visual.debugBox = this.add.rectangle(
          localX,
          localY,
          hotspot.width,
          hotspot.height,
          hotspot.accentColor,
          0.16
        ).setStrokeStyle(3, hotspot.accentColor, 0.85);

        visual.debugLabel = this.add.text(localX, localY, hotspot.label, {
          fontFamily: this.PIXEL_FONT_FAMILY,
          fontSize: '20px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 5,
          align: 'center',
          wordWrap: {
            width: hotspot.width - 12,
            useAdvancedWrap: true,
          },
        }).setOrigin(0.5);
      }

      zone.on('pointerover', () => {
        if (!this.isCampMapTouchDevice() && !this.campMapDragging) {
          this.setCampMapHoveredHotspot(hotspot.id);
        }
      });

      zone.on('pointerout', () => {
        if (this.hoveredCampMapHotspotId === hotspot.id) {
          this.setCampMapHoveredHotspot(undefined);
        }
      });

      mapContainer.add([
        glow,
        label,
        ...(visual.debugBox ? [visual.debugBox] : []),
        ...(visual.debugLabel ? [visual.debugLabel] : []),
        zone,
      ]);

      this.campMapHotspotVisuals.set(hotspot.id, visual);
    });
  }

  private getCampMapStartFocusPoint() {
    const hasActiveRun = gameState.floorRun.active && gameState.floorRun.rooms.length > 0;
    const hasActiveCheckpoint = Boolean(getActiveCampfireBattleCheckpoint());
    
    if (hasActiveRun || hasActiveCheckpoint) {
      return { x: 944, y: 261 };
    }
  
    if (this.hasClaimableQuests()) {
      return { x: 511, y: 1908 };
    }
  
    if (this.getAvailableAscensionPoints() > 0) {
      return { x: 449, y: 1174 };
    }
  
    if (this.isCityCampfireActive()) {
      return { x: 1379, y: 1194 };
    }
  
    return { x: 960, y: 2041 };
  }

  private getCampMapPositionForFocus(mapX: number, mapY: number, viewport: CampMapViewport) {
    const viewportCenterX = viewport.x + viewport.width / 2;
    const viewportCenterY = viewport.y + viewport.height / 2;

    return {
      x: viewportCenterX - (mapX - this.campMapImageWidth / 2) * this.campMapScale,
      y: viewportCenterY - (mapY - this.campMapImageHeight / 2) * this.campMapScale,
    };
  }

  private calculateCampMapBounds(viewport: CampMapViewport) {
    const displayWidth = this.campMapImageWidth * this.campMapScale;
    const displayHeight = this.campMapImageHeight * this.campMapScale;
    const viewportLeft = viewport.x;
    const viewportRight = viewport.x + viewport.width;
    const viewportTop = viewport.y;
    const viewportBottom = viewport.y + viewport.height;

    if (displayWidth <= viewport.width) {
      this.campMapMinX = viewport.x + viewport.width / 2;
      this.campMapMaxX = this.campMapMinX;
    } else {
      this.campMapMinX = viewportRight - displayWidth / 2;
      this.campMapMaxX = viewportLeft + displayWidth / 2;
    }

    if (displayHeight <= viewport.height) {
      this.campMapMinY = viewport.y + viewport.height / 2;
      this.campMapMaxY = this.campMapMinY;
    } else {
      this.campMapMinY = viewportBottom - displayHeight / 2;
      this.campMapMaxY = viewportTop + displayHeight / 2;
    }
  }

  private setCampMapPosition(x: number, y: number, immediate = false) {
    const clampedX = Phaser.Math.Clamp(x, this.campMapMinX, this.campMapMaxX);
    const clampedY = Phaser.Math.Clamp(y, this.campMapMinY, this.campMapMaxY);

    this.campMapTargetX = clampedX;
    this.campMapTargetY = clampedY;

    if (immediate) {
      this.campMapContainer?.setPosition(clampedX, clampedY);
    }
  }

  private installCampMapInputHandlers() {
    this.cleanupCampMapInput();

    this.campMapPointerDownHandler = (pointer) => {
      if (!this.campMapContainer || !this.isPointerInsideCampMapViewport(pointer) || this.hasBlockingModalOpen()) {
        return;
      }

      this.campMapDragging = true;
      this.campMapDidDrag = false;
      this.campMapDragStartPointerX = pointer.x;
      this.campMapDragStartPointerY = pointer.y;
      this.campMapDragStartX = this.campMapContainer.x;
      this.campMapDragStartY = this.campMapContainer.y;
    };

    this.campMapPointerMoveHandler = (pointer) => {
      if (!this.campMapContainer) {
        return;
      }

      if (this.campMapDragging) {
        const dx = pointer.x - this.campMapDragStartPointerX;
        const dy = pointer.y - this.campMapDragStartPointerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 10) {
          this.campMapDidDrag = true;
          this.setCampMapHoveredHotspot(undefined);
        }

        this.setCampMapPosition(this.campMapDragStartX + dx, this.campMapDragStartY + dy, true);
        return;
      }

      if (!this.isCampMapTouchDevice() && this.isPointerInsideCampMapViewport(pointer)) {
        const hotspot = this.getCampMapHotspotAtPointer(pointer);
        this.setCampMapHoveredHotspot(hotspot?.id);
      }
    };

    this.campMapPointerUpHandler = (pointer) => {
      if (!this.campMapDragging) {
        return;
      }

      this.campMapDragging = false;

      if (!this.campMapDidDrag && this.isPointerInsideCampMapViewport(pointer) && !this.hasBlockingModalOpen()) {
        const hotspot = this.getCampMapHotspotAtPointer(pointer);

        if (hotspot) {
          this.triggerCampMapHotspot(hotspot);
        }
      }
    };

    this.campMapWheelHandler = (pointer, _gameObjects, _deltaX, deltaY) => {
      if (!this.campMapContainer || !this.isPointerInsideCampMapViewport(pointer) || this.hasBlockingModalOpen()) {
        return;
      }

      this.setCampMapPosition(
        this.campMapTargetX,
        this.campMapTargetY - deltaY * 0.42,
        false
      );
    };

    this.input.on('pointerdown', this.campMapPointerDownHandler);
    this.input.on('pointermove', this.campMapPointerMoveHandler);
    this.input.on('pointerup', this.campMapPointerUpHandler);
    this.input.on('pointerupoutside', this.campMapPointerUpHandler);
    this.input.on('wheel', this.campMapWheelHandler);
  }

  private cleanupCampMapInput() {
    if (this.campMapPointerDownHandler) {
      this.input.off('pointerdown', this.campMapPointerDownHandler);
      this.campMapPointerDownHandler = undefined;
    }

    if (this.campMapPointerMoveHandler) {
      this.input.off('pointermove', this.campMapPointerMoveHandler);
      this.campMapPointerMoveHandler = undefined;
    }

    if (this.campMapPointerUpHandler) {
      this.input.off('pointerup', this.campMapPointerUpHandler);
      this.input.off('pointerupoutside', this.campMapPointerUpHandler);
      this.campMapPointerUpHandler = undefined;
    }

    if (this.campMapWheelHandler) {
      this.input.off('wheel', this.campMapWheelHandler);
      this.campMapWheelHandler = undefined;
    }

    this.campMapDragging = false;
    this.campMapDidDrag = false;
    this.campMapClickLocked = false;
    this.hoveredCampMapHotspotId = undefined;
  }

  private getCampMapHotspotAtPointer(pointer: Phaser.Input.Pointer): CampMapHotspot | undefined {
    if (!this.campMapContainer || this.campMapScale <= 0) {
      return undefined;
    }

    const mapX = (pointer.x - this.campMapContainer.x) / this.campMapScale + this.campMapImageWidth / 2;
    const mapY = (pointer.y - this.campMapContainer.y) / this.campMapScale + this.campMapImageHeight / 2;

    return this.campMapHotspots.find(hotspot => (
      mapX >= hotspot.x - hotspot.width / 2 &&
      mapX <= hotspot.x + hotspot.width / 2 &&
      mapY >= hotspot.y - hotspot.height / 2 &&
      mapY <= hotspot.y + hotspot.height / 2
    ));
  }

  private triggerCampMapHotspot(hotspot: CampMapHotspot) {
    if (this.campMapClickLocked || this.hasBlockingModalOpen()) {
      return;
    }

    this.campMapClickLocked = true;
    this.campMapDragging = false;
    this.campMapDidDrag = false;
    this.setCampMapHoveredHotspot(hotspot.id);

    const visual = this.campMapHotspotVisuals.get(hotspot.id);

    const runHotspotAction = () => {
      // ВАЖНО: сбрасываем lock ДО scene.start / открытия модалки.
      // Иначе после возврата в CampScene hotspot могут перестать работать.
      this.campMapClickLocked = false;
      this.campMapDragging = false;
      this.campMapDidDrag = false;
      this.setCampMapHoveredHotspot(undefined);

      hotspot.onClick();
    };

    if (visual) {
      this.tweens.killTweensOf([visual.glow, visual.label]);

      this.tweens.add({
        targets: [visual.glow, visual.label],
        alpha: { from: 0.32, to: 0.12 },
        scale: { from: 1.05, to: 1 },
        duration: 110,
        ease: 'Sine.easeOut',
        onComplete: runHotspotAction,
      });
    } else {
      runHotspotAction();
    }

    // Дополнительная страховка, если hotspot не сменил сцену, а открыл модальное окно.
    this.time.delayedCall(300, () => {
      if (this.scene.isActive()) {
        this.campMapClickLocked = false;
      }
    });
  }

  private setCampMapHoveredHotspot(hotspotId?: string) {
    if (this.hoveredCampMapHotspotId === hotspotId) {
      return;
    }

    const previousId = this.hoveredCampMapHotspotId;
    this.hoveredCampMapHotspotId = hotspotId;

    if (previousId) {
      this.applyCampMapHotspotVisualState(previousId);
    }

    if (hotspotId) {
      this.applyCampMapHotspotVisualState(hotspotId);
    }
  }

  private updateCampMapHotspotStates() {
    this.campMapHotspotVisuals.forEach((_visual, hotspotId) => {
      this.applyCampMapHotspotVisualState(hotspotId);
    });
  }

  private applyCampMapHotspotVisualState(hotspotId: string) {
    const visual = this.campMapHotspotVisuals.get(hotspotId);

    if (!visual) {
      return;
    }

    const isHovered = this.hoveredCampMapHotspotId === hotspotId;
    const isActive = this.isCampMapHotspotActive(hotspotId);
    const targetAlpha = isHovered ? 0.22 : isActive ? 0.105 : 0;
    const labelAlpha = isHovered && !this.isCampMapTouchDevice() ? 1 : 0;

    visual.activeTween?.stop();
    visual.activeTween = undefined;

    visual.glow.setFillStyle(visual.hotspot.accentColor, targetAlpha);
    visual.glow.setAlpha(targetAlpha);
    visual.label.setAlpha(labelAlpha);

    if (isActive && !isHovered) {
      visual.activeTween = this.tweens.add({
        targets: visual.glow,
        alpha: { from: 0.06, to: 0.16 },
        scale: { from: 0.96, to: 1.04 },
        duration: hotspotId === 'campfire' ? 1150 : 1450,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private isCampMapHotspotActive(hotspotId: string) {
    if (hotspotId === 'dungeon') {
      return (
        gameState.floorRun.active &&
        gameState.floorRun.rooms.length > 0
      ) || Boolean(getActiveCampfireBattleCheckpoint());
    }

    if (hotspotId === 'campfire') {
      return this.isCityCampfireActive();
    }

    if (hotspotId === 'quests') {
      return this.hasClaimableQuests();
    }

    if (hotspotId === 'temple') {
      return this.getAvailableAscensionPoints() > 0;
    }

    return false;
  }

  private clearCampMapHotspotVisuals() {
    this.campMapHotspotVisuals.forEach(visual => {
      visual.activeTween?.stop();
    });

    this.campMapHotspotVisuals.clear();
    this.campMapHotspots = [];
    this.hoveredCampMapHotspotId = undefined;
  }

  private isPointerInsideCampMapViewport(pointer: Phaser.Input.Pointer) {
    const viewport = this.campMapViewport;

    if (!viewport) {
      return false;
    }

    return (
      pointer.x >= viewport.x &&
      pointer.x <= viewport.x + viewport.width &&
      pointer.y >= viewport.y &&
      pointer.y <= viewport.y + viewport.height
    );
  }

  private hasBlockingModalOpen() {
    return this.children.list.some(object => {
      const displayObject = object as Phaser.GameObjects.GameObject & {
        visible?: boolean;
        depth?: number;
      };

      return (
        displayObject.active &&
        displayObject.visible === true &&
        typeof displayObject.depth === 'number' &&
        displayObject.depth >= 1000
      );
    });
  }

  private isCampMapTouchDevice() {
    return Boolean((this.sys.game.device.input as { touch?: boolean }).touch);
  }

  private showCampSceneFatalError(error: unknown) {
    const { width, height } = this.scale;
    const message = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);

    this.add.rectangle(width / 2, height / 2, Math.min(width - 32, 620), 190, 0x140606, 0.94)
      .setDepth(5000)
      .setStrokeStyle(2, 0xff4c4c, 0.85);

    this.add.text(width / 2, height / 2 - 48, 'CampScene не смогла отрисоваться', {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '18px',
      color: '#ffd0d0',
      align: 'center',
      wordWrap: {
        width: Math.min(width - 64, 560),
        useAdvancedWrap: true,
      },
    }).setOrigin(0.5).setDepth(5001);

    this.add.text(width / 2, height / 2 + 24, message, {
      fontFamily: this.PIXEL_FONT_FAMILY,
      fontSize: '12px',
      color: '#ffffff',
      align: 'center',
      wordWrap: {
        width: Math.min(width - 70, 550),
        useAdvancedWrap: true,
      },
      maxLines: 5,
    }).setOrigin(0.5).setDepth(5001);
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
    this.updateCampMapHotspotStates();
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

    if (this.sanityFill) {
      this.sanityFill.setFillStyle(fillColor, 0.95);
      this.sanityFill.setAlpha(player.sanity <= 0 ? 0.2 : 1);

      this.tweens.killTweensOf(this.sanityFill);
      this.tweens.add({
        targets: this.sanityFill,
        displayWidth: fillWidth,
        duration: 180,
        ease: 'Sine.easeOut',
      });
    }
  }

  private showNotEnoughSanityMessage() {
    this.showMessage(
      'Недостаточно рассудка',
      `Для прохождения этажа нужно ${SANITY_COST_PER_FLOOR} рассудка. Рассудок восстанавливается со временем: 1 единица в минуту.`
    );
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
