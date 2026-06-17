import Phaser from 'phaser';

import { player } from '../data/player';
import {
  gameState,
  goToNextRoom,
  getCurrentTierByFloor,
  isTierBossFloor,
  resetFloorRun,
} from '../data/gameState';

import { createRelicBonusText, giveRelicForTier } from '../systems/RelicSystem';
import { getCryptDepthTheme } from '../systems/CryptThemeSystem';
import { triggerTrapResult } from '../systems/TrapSystem';
import {
  createFloorMaterialsShortText,
  createFloorMaterialsText,
} from '../systems/FloorMaterialLogSystem';

import {
  completeCurrentFloor,
  getCurrentRoom,
  getFloorDescription,
  getFloorRequirement,
  getFloorModifierName,
  getNextFloorAfterCurrent,
  isCurrentFloorCompleted,
  markCurrentRoomCompleted,
  startFloorRun,
} from '../systems/FloorSystem';

import { createButton } from '../ui/createButton';

import {
  applyRoomRegeneration,
  blockRoomRegenerationUntilFloorEnd,
  clearRoomRegenerationBlock,
  isRoomRegenerationBlocked,
} from '../systems/RoomRegenerationSystem';

import {
  UI,
  createSceneBackground,
} from '../ui/theme';

import {
  getPlayerStats,
  restorePlayerVitalsToMaximum,
} from '../systems/InventorySystem';

import { giveFloorReward } from '../systems/FloorRewardSystem';

import { claimChestReward } from '../systems/ChestRewardSystem';
import {
  trackCampfireUsed,
  trackDungeonCompleted,
  trackFloorCleared,
  trackGoldEarned,
  trackHighestReachedFloor,
  trackRelicCollected,
  trackTrapTriggered,
} from '../systems/QuestSystem';
import {
  clearResumePoint,
  flushSaveNow,
  markDungeonResumePoint,
  saveGameAsync,
} from '../systems/SaveSystem';
import { getMaterialName, type MaterialId } from '../data/materials';
import {
  getDungeonEventById,
  getDungeonEventChoiceById,
  type DungeonEventChoice,
  type DungeonEventChoiceId,
  type DungeonEventId,
} from '../systems/DungeonEventSystem';
import { addExperience, createLevelUpText } from '../systems/LevelSystem';
import { addMaterial } from '../systems/MaterialSystem';
import {
  clearCampfireBattleCheckpoint,
  createCampfireBattleCheckpoint,
  getActiveCampfireBattleCheckpoint,
  formatCheckpointTimeLeft,
  type CheckpointFlintType,
  type CampfireStateSnapshot,
} from '../systems/CampfireCheckpointSystem';


type FlintType = 'none' | 'dim' | 'black' | 'ruby';

type CampfireState = {
  tier: number;
  selectedFlint: FlintType | null;
  remainingCampfireUses: number;
  campfireFloors: number[];
  usedCampfireFloors: number[];
  selectionDone: boolean;
};

type CampfirePlayer = typeof player & {
  rubyFlintUnlocked?: boolean;
  redRubyFlintUnlocked?: boolean;
  donorFlintUnlocked?: boolean;
  premiumFlintUnlocked?: boolean;
};


type DungeonLayout = {
  width: number;
  height: number;
  centerX: number;
  safeX: number;
  safeTop: number;
  safeBottom: number;
  contentWidth: number;
  compact: boolean;
  veryCompact: boolean;
  headerY: number;
  floorInfoY: number;
  routeY: number;
  roomCardTop: number;
  roomCardHeight: number;
  actionDockTop: number;
  mainButtonY: number;
  prepareButtonY: number;
  exitButtonY: number;
  primaryButtonHeight: number;
  secondaryButtonHeight: number;
};

const DUNGEON_DARK = {
  black: 0x030304,
  void: 0x050607,
  graphite: 0x0c0d10,
  stone: 0x11141a,
  stoneLight: 0x191a21,
  soot: 0x080504,
  brown: 0x17100c,
  bronze: 0x6b4b2d,
  gold: 0xb89a5e,
  goldSoft: 0xd8c088,
  ash: 0x8d877b,
  blood: 0x8d2f2f,
  cold: 0x5f7f9d,
  violet: 0x62518a,
  green: 0x5f8f66,
};

export class DungeonScene extends Phaser.Scene {

  private readonly maxPotionCount = 6;
  private modalObjects: Phaser.GameObjects.GameObject[] = [];
  
  constructor() {
    super('DungeonScene');
  }

  create() {
    if (!gameState.floorRun.active || gameState.floorRun.rooms.length === 0) {
      startFloorRun(gameState.highestClearedFloor + 1);
      void saveGameAsync();
    }

    this.ensureCampfireState();
    this.injectCampfireRoomIfNeeded();
    markDungeonResumePoint('enter-dungeon');
    void flushSaveNow('enter-dungeon');

    createSceneBackground(this);
    this.createDungeonBackdrop();

    this.createHeader();
    this.createFloorProgress();
    this.createRoomMap();
    this.createCurrentRoom();

    const campfireState = this.getCampfireState();

    if (!campfireState.selectionDone) {
      this.time.delayedCall(80, () => {
        this.showFlintSelectionModal();
      });
    }
  }

  private getLayout(): DungeonLayout {
    const { width, height } = this.scale;

    const compact = height < 1120;
    const veryCompact = height < 940;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 34);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.022), 16, 34);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.035), 28, 46);
    const contentWidth = Math.min(width - safeX * 2, 640);

    const primaryButtonHeight = veryCompact ? 64 : 72;
    const secondaryButtonHeight = veryCompact ? 54 : 58;

    // Нижняя зона теперь предназначена только для кнопки выхода в город.
    // Все действия текущей комнаты находятся выше — внутри основной карточки комнаты.
    const exitButtonY = height - safeBottom - secondaryButtonHeight / 2;
    const actionDockTop = exitButtonY - secondaryButtonHeight / 2 - 18;

    const headerY = safeTop + (compact ? 44 : 50);
    const floorInfoY = headerY + (compact ? 82 : 92);
    const routeY = floorInfoY + (veryCompact ? 86 : compact ? 98 : 112);
    const roomCardTop = routeY + (veryCompact ? 50 : 62);

    const minRoomCardHeight = veryCompact ? 390 : compact ? 450 : 500;
    const maxRoomCardHeight = veryCompact ? 430 : compact ? 540 : 620;
    const availableRoomCardHeight = actionDockTop - roomCardTop - 16;
    const roomCardHeight = Phaser.Math.Clamp(
      availableRoomCardHeight,
      minRoomCardHeight,
      maxRoomCardHeight
    );

    const roomCardBottom = roomCardTop + roomCardHeight;
    const actionGap = veryCompact ? 10 : 12;
    const actionBottomPadding = veryCompact ? 18 : 24;

    const prepareButtonY = roomCardBottom - actionBottomPadding - secondaryButtonHeight / 2;
    const mainButtonY = prepareButtonY - secondaryButtonHeight / 2 - actionGap - primaryButtonHeight / 2;

    return {
      width,
      height,
      centerX: width / 2,
      safeX,
      safeTop,
      safeBottom,
      contentWidth,
      compact,
      veryCompact,
      headerY,
      floorInfoY,
      routeY,
      roomCardTop,
      roomCardHeight,
      actionDockTop,
      mainButtonY,
      prepareButtonY,
      exitButtonY,
      primaryButtonHeight,
      secondaryButtonHeight,
    };
  }

  private createHeader() {
    const layout = this.getLayout();
    const floor = gameState.floorRun.currentFloor;
    const tier = getCurrentTierByFloor(floor);
    const modifierName = getFloorModifierName(gameState.floorRun.modifier);
    const theme = getCryptDepthTheme(floor);

    this.createRoundedPanel({
      x: layout.centerX,
      y: layout.headerY,
      width: layout.contentWidth,
      height: layout.compact ? 78 : 88,
      radius: 28,
      color: DUNGEON_DARK.graphite,
      alpha: 0.94,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.56,
      strokeWidth: 2,
      depth: 2,
    });

    this.add.circle(layout.centerX, layout.headerY - 4, layout.contentWidth * 0.35, theme.glow, 0.035)
      .setDepth(3);

    this.add.text(layout.centerX, layout.headerY - (layout.compact ? 15 : 18), `Ярус ${tier}  •  Этаж ${floor}  •  Ур. ${player.level}`, {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '22px' : '26px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(6);

    this.add.text(layout.centerX, layout.headerY + (layout.compact ? 18 : 22), `${theme.name}  •  ${modifierName}  •  HP ${player.hp}`, {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '13px' : '15px',
      color: theme.mutedText,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 56,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(6);
  }

  private createDungeonBackdrop() {
    const layout = this.getLayout();
    const { width, height } = this.scale;

    const floor = gameState.floorRun.currentFloor || 1;
    trackHighestReachedFloor(floor);
    const theme = getCryptDepthTheme(floor);

    this.add.rectangle(width / 2, height / 2, width, height, DUNGEON_DARK.black, 1).setDepth(0);
    this.add.rectangle(width / 2, height / 2, width, height, theme.background, 0.7).setDepth(0);
    this.add.rectangle(width / 2, height - 170, width, 340, 0x020202, 0.56).setDepth(0);

    this.add.circle(width / 2, layout.safeTop + 116, width * 0.48, theme.glow, 0.08).setDepth(0);
    this.add.circle(width / 2, layout.safeTop + 130, width * 0.30, theme.accent, 0.035).setDepth(0);
    this.add.circle(width / 2, layout.safeTop + 145, width * 0.16, DUNGEON_DARK.gold, 0.024).setDepth(0);

    for (let i = 0; i < 18; i += 1) {
      const x = layout.safeX + 8 + i * ((width - layout.safeX * 2 - 16) / 17);
      const y = layout.safeTop + 150 + (i % 7) * 84;
      const radius = 26 + (i % 4) * 9;

      this.add.circle(x, y, radius, theme.fog, 0.014 + (i % 3) * 0.004).setDepth(0);
    }

    for (let i = 0; i < 42; i += 1) {
      const x = Phaser.Math.Between(layout.safeX, width - layout.safeX);
      const y = Phaser.Math.Between(layout.safeTop + 70, height - layout.safeBottom - 110);
      const size = Phaser.Math.Between(1, 2);
      const color = i % 5 === 0 ? theme.accent : DUNGEON_DARK.ash;

      this.add.circle(x, y, size, color, 0.035 + (i % 4) * 0.006).setDepth(1);
    }

    for (let i = 0; i < 8; i += 1) {
      const y = height - 320 + i * 42;
      this.add.line(
        0,
        0,
        layout.safeX,
        y,
        width - layout.safeX,
        y + (i % 2) * 8,
        0x211a14,
        0.18
      ).setOrigin(0, 0).setDepth(1);
    }
  }

  private createFloorProgress() {
    const layout = this.getLayout();
    const floor = gameState.floorRun.currentFloor;
    const theme = getCryptDepthTheme(floor);

    const panelHeight = layout.veryCompact ? 78 : layout.compact ? 86 : 96;

    this.createRoundedPanel({
      x: layout.centerX,
      y: layout.floorInfoY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 24,
      color: theme.panel,
      alpha: 0.88,
      strokeColor: theme.stroke,
      strokeAlpha: 0.42,
      strokeWidth: 2,
      depth: 2,
    });

    this.add.text(layout.centerX, layout.floorInfoY, getFloorDescription(floor), {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '12px' : layout.compact ? '13px' : '14px',
      color: theme.mutedText,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 56,
        useAdvancedWrap: true,
      },
      lineSpacing: 2,
      maxLines: layout.veryCompact ? 4 : 5,
    }).setOrigin(0.5).setDepth(6);
  }

  private getRewardLineColor(line: string) {
    const lower = line.toLowerCase();

    if (lower.includes('золото')) {
      return UI.colors.goldText;
    }

    if (lower.includes('опыт')) {
      return UI.colors.green;
    }

    if (
      lower.includes('легендар') ||
      lower.includes('legendary')
    ) {
      return '#f0d58a';
    }

    if (
      lower.includes('эпичес') ||
      lower.includes('эпический') ||
      lower.includes('epic')
    ) {
      return '#c084fc';
    }

    if (
      lower.includes('редк') ||
      lower.includes('редкий') ||
      lower.includes('rare')
    ) {
      return '#70a6ff';
    }

    if (
      lower.includes('обычн') ||
      lower.includes('обычный') ||
      lower.includes('common')
    ) {
      return '#b8aa91';
    }

    if (
      lower.includes('предмет') ||
      lower.includes('найден')
    ) {
      return UI.colors.goldText;
    }

    if (
      lower.includes('материалы') ||
      lower.includes('кость') ||
      lower.includes('самоцвет') ||
      lower.includes('кожа') ||
      lower.includes('печать') ||
      lower.includes('пламени') ||
      lower.includes('саркофага')
    ) {
      return '#70a6ff';
    }
    return UI.colors.text;
  }

  private completeRoomAndApplyRegeneration() {
    markCurrentRoomCompleted();
    goToNextRoom();

    const regeneration = applyRoomRegeneration();

    return regeneration.text
      ? `\n\n${regeneration.text}`
      : '';
  }

  private isCurrentTrapCursed() {
    const room = getCurrentRoom();

    const roomId = String(room?.id ?? '').toLowerCase();
    const roomTitle = String(room?.title ?? '').toLowerCase();

    return (
      gameState.floorRun.modifier === 'cursed' ||
      roomId.includes('trap_cursed') ||
      roomTitle.includes('проклят')
    );
  }

  private tryBreakRegenerationByCursedTrap(trapWasAvoided: boolean) {
    if (trapWasAvoided) {
      return '';
    }

    if (!this.isCurrentTrapCursed()) {
      return '';
    }

    if (isRoomRegenerationBlocked()) {
      return '';
    }

    const breakChance = 0.5;

    if (Math.random() > breakChance) {
      return '';
    }

    blockRoomRegenerationUntilFloorEnd();

    return '\n\nПроклятие ловушки подавило регенерацию до конца этажа.';
  }

  private getTownExitSubtitle() {
    const checkpoint = getActiveCampfireBattleCheckpoint();

    if (!checkpoint) {
      return 'Без костра вернуться в этот бой нельзя';
    }

    return `Костёр активен ещё ${formatCheckpointTimeLeft(checkpoint.expiresAt - Date.now())}`;
  }

  private createRoundedActionButton(config: {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  onClick: () => void;
  variant?: 'green' | 'brown';
  depth?: number;
}) {
  const radius = 18;
  const variant = config.variant ?? 'brown';
  const depth = config.depth ?? 110;

  const bgColor = variant === 'green' ? 0x102016 : 0x21150f;
  const bgHoverColor = variant === 'green' ? 0x183322 : 0x2c1d14;

  const strokeColor = variant === 'green' ? 0x75d184 : UI.colors.goldDark;
  const textColor = variant === 'green' ? UI.colors.green : UI.colors.text;
  const hoverTextColor = variant === 'green' ? '#a8f0b4' : UI.colors.goldText;

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.3);
  shadow.fillRoundedRect(
    config.x - config.width / 2,
    config.y - config.height / 2 + 5,
    config.width,
    config.height,
    radius
  );
  shadow.setDepth(depth);

  const bg = this.add.graphics();
  bg.fillStyle(bgColor, 0.96);
  bg.fillRoundedRect(
    config.x - config.width / 2,
    config.y - config.height / 2,
    config.width,
    config.height,
    radius
  );
  bg.lineStyle(2, strokeColor, 0.9);
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
    fontSize: '19px',
    color: textColor,
  }).setOrigin(0.5).setDepth(depth + 2);

  const redrawButton = (
    fillColor: number,
    fillAlpha: number,
    strokeAlpha: number,
    labelColor: string,
    labelOffsetY = 0
  ) => {
    bg.clear();

    bg.fillStyle(fillColor, fillAlpha);
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

  let isPressed = false;
  let isLocked = false;

  bg.setInteractive(
    new Phaser.Geom.Rectangle(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height
    ),
    Phaser.Geom.Rectangle.Contains
  );

  bg.on('pointerover', () => {
    if (isPressed || isLocked) return;

    redrawButton(bgHoverColor, 1, 1, hoverTextColor);
  });

  bg.on('pointerout', () => {
    isPressed = false;

    if (isLocked) return;

    redrawButton(bgColor, 0.96, 0.9, textColor);
  });

  bg.on('pointerdown', () => {
    if (isLocked) return;

    isPressed = true;

    redrawButton(bgHoverColor, 0.92, 1, hoverTextColor, 1);
  });

  bg.on('pointerup', () => {
    if (!isPressed) return;

    isPressed = false;

    redrawButton(bgHoverColor, 1, 1, hoverTextColor);

    this.time.delayedCall(40, () => {
      redrawButton(bgColor, 0.96, 0.9, textColor);
      config.onClick();
    });
  });

  bg.on('pointerupoutside', () => {
    isPressed = false;

    if (isLocked) return;

    redrawButton(bgColor, 0.96, 0.9, textColor);
  });

  bg.on('pointercancel', () => {
    isPressed = false;

    if (isLocked) return;

    redrawButton(bgColor, 0.96, 0.9, textColor);
  });

  return {
    shadow,
    bg,
    label,
  };
}

  private createRoomMap() {
    const layout = this.getLayout();

    const rooms = gameState.floorRun.rooms;
    const currentIndex = gameState.floorRun.currentRoomIndex;
    const theme = getCryptDepthTheme(gameState.floorRun.currentFloor || 1);

    const y = layout.routeY;
    const roomCount = Math.max(1, rooms.length);
    const maxRouteWidth = layout.contentWidth - 44;
    const gap = roomCount <= 1 ? 0 : Math.min(76, maxRouteWidth / (roomCount - 1));
    const startX = layout.centerX - ((roomCount - 1) * gap) / 2;
    const nodeRadius = Phaser.Math.Clamp(Math.floor(gap * 0.28), 18, layout.veryCompact ? 23 : 27);

    this.add.text(layout.centerX, y - (layout.veryCompact ? 37 : 44), 'Маршрут этажа', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '18px' : '21px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 44,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(6);

    this.createRoundedPanel({
      x: layout.centerX,
      y,
      width: layout.contentWidth,
      height: layout.veryCompact ? 58 : 68,
      radius: 24,
      color: DUNGEON_DARK.soot,
      alpha: 0.7,
      strokeColor: theme.stroke,
      strokeAlpha: 0.18,
      strokeWidth: 1,
      depth: 2,
    });

    rooms.forEach((room, index) => {
      const x = startX + index * gap;

      const isCompleted = room.completed || index < currentIndex;
      const isCurrent = index === currentIndex;
      const isLocked = index > currentIndex;

      const fillColor = isCompleted
        ? 0x102016
        : isCurrent
          ? 0x2b1d13
          : 0x0d0d0d;

      const strokeColor = isCompleted
        ? 0x75d184
        : isCurrent
          ? UI.colors.gold
          : 0x3a2518;

      if (index > 0) {
        this.add.rectangle(
          x - gap / 2,
          y,
          Math.max(8, gap - nodeRadius * 1.9),
          3,
          isCompleted ? 0x75d184 : 0x3a2518,
          isCompleted ? 0.42 : 0.56
        ).setDepth(4);
      }

      this.add.circle(x, y + 4, isCurrent ? nodeRadius + 5 : nodeRadius + 2, 0x000000, 0.32).setDepth(4);

      this.add.circle(x, y, isCurrent ? nodeRadius + 2 : nodeRadius, fillColor, isLocked ? 0.52 : 0.98)
        .setStrokeStyle(isCurrent ? 3 : 2, strokeColor, isCurrent ? 0.95 : 0.58)
        .setDepth(5);

      this.add.text(x, y, this.getRoomIcon(room.type), {
        fontFamily: UI.font.body,
        fontSize: isCurrent ? (layout.compact ? '20px' : '23px') : (layout.compact ? '17px' : '20px'),
        color: isLocked
          ? '#555555'
          : isCompleted
            ? UI.colors.green
            : this.getRoomTextColor(room.type),
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(6);
    });
  }

  private createCurrentRoom() {
    const layout = this.getLayout();

    if (isCurrentFloorCompleted()) {
      this.showFloorCompleted();
      return;
    }

    const room = getCurrentRoom();
    const floor = gameState.floorRun.currentFloor || 1;
    trackHighestReachedFloor(floor);
    const theme = getCryptDepthTheme(floor);

    if (!room) {
      this.showFloorCompleted();
      return;
    }

    const roomType = String(room.type);
    const isBossRoom = roomType === 'boss' || roomType === 'tier_boss';
    const isCampfireRoom = roomType === 'campfire';

    const cardTop = layout.roomCardTop;
    const cardHeight = layout.roomCardHeight;
    const cardY = cardTop + cardHeight / 2;
    const cardWidth = layout.contentWidth;

    this.createRoundedPanel({
      x: layout.centerX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      radius: layout.compact ? 28 : 34,
      color: isBossRoom
        ? 0x160908
        : isCampfireRoom
          ? 0x1a0f08
          : theme.panel,
      alpha: 0.95,
      strokeColor: this.getRoomStrokeColor(roomType),
      strokeAlpha: isBossRoom || isCampfireRoom ? 0.82 : 0.52,
      strokeWidth: isBossRoom || isCampfireRoom ? 3 : 2,
      depth: 2,
    });

    const iconColor = this.getRoomTextColor(roomType);
    const strokeColor = this.getRoomStrokeColor(roomType);
    const iconY = cardTop + (layout.veryCompact ? 44 : 56);

    this.add.circle(layout.centerX, iconY, layout.veryCompact ? 42 : 52, strokeColor, isCampfireRoom ? 0.16 : 0.11).setDepth(5);

    this.add.circle(layout.centerX, iconY, layout.veryCompact ? 31 : 38, 0x20150f, 1)
      .setStrokeStyle(2, strokeColor, 0.76)
      .setDepth(6);

    this.add.text(layout.centerX, iconY, this.getRoomIcon(roomType), {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '27px' : isCampfireRoom ? '36px' : '32px',
      color: iconColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(7);

    const roomTitle =
      roomType === 'monster'
        ? 'Обычная комната'
        : roomType === 'elite'
          ? 'Опасная комната'
          : roomType === 'boss'
            ? 'Комната босса'
            : roomType === 'tier_boss'
              ? 'Финальный босс'
              : roomType === 'campfire'
                ? 'Забытый костёр'
                : roomType === 'event'
                  ? getDungeonEventById(room.eventId)?.shortTitle ?? 'Событие катакомб'
                  : room.title;

    this.add.text(layout.centerX, cardTop + (layout.veryCompact ? 94 : 122), roomTitle, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '24px' : isBossRoom ? '32px' : '30px',
      color: isBossRoom ? UI.colors.red : isCampfireRoom ? UI.colors.goldText : theme.text,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: cardWidth - 70,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: -2,
    }).setOrigin(0.5).setDepth(7);

    const roomDescription = roomType === 'event'
      ? getDungeonEventById(room.eventId)?.description ?? room.description
      : room.description;

    this.add.text(layout.centerX, cardTop + (layout.veryCompact ? 150 : 182), roomDescription, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '14px' : '16px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: cardWidth - 78,
        useAdvancedWrap: true,
      },
      lineSpacing: 4,
      maxLines: layout.veryCompact ? 3 : 4,
    }).setOrigin(0.5).setDepth(7);

    const infoY = cardTop + (layout.veryCompact ? 222 : 270);
    this.createRoomInfoBox(
      layout.centerX,
      infoY,
      this.getRoomInfo(roomType),
      this.getModifierWarning()
    );

    const detailsY = infoY + (layout.veryCompact ? 74 : 92);
    const actionAreaTop = layout.mainButtonY - layout.primaryButtonHeight / 2 - 12;

    if (isBossRoom && detailsY + 42 < actionAreaTop) {
      this.createBossRequirementInfo(detailsY);
    }

    if (isCampfireRoom && detailsY + 45 < actionAreaTop) {
      this.createCampfireStatusBox(detailsY);
    }

    this.createRoomButton(roomType, room.enemyId);
  }

  private createRoomInfoBox(
    x: number,
    y: number,
    info: string,
    modifierWarning: string
  ) {
    const layout = this.getLayout();
    const text = `${info}${modifierWarning}`;
    const boxWidth = Math.min(layout.contentWidth - 58, 540);
    const boxHeight = layout.veryCompact ? 64 : 78;

    this.createRoundedPanel({
      x,
      y,
      width: boxWidth,
      height: boxHeight,
      radius: 20,
      color: DUNGEON_DARK.brown,
      alpha: 0.88,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.3,
      strokeWidth: 1,
      depth: 5,
    });

    this.add.text(x, y, text, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '11px' : '13px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: boxWidth - 46,
        useAdvancedWrap: true,
      },
      lineSpacing: 3,
      maxLines: layout.veryCompact ? 3 : 4,
    }).setOrigin(0.5).setDepth(8);
  }

  private createBossRequirementInfo(y: number) {
    const layout = this.getLayout();

    const floor = gameState.floorRun.currentFloor;
    const requirement = getFloorRequirement(floor);
    const stats = getPlayerStats(player);

    const recommendedLevel = requirement.level + 1;
    const recommendedStrength = Math.ceil(requirement.attack * 1.25);
    const recommendedHp = Math.ceil(requirement.hp * 1.25);

    const levelOk = player.level >= recommendedLevel;
    const strengthOk = stats.attack >= recommendedStrength;
    const hpOk = stats.maxHp >= recommendedHp;

    const isReady = levelOk && strengthOk && hpOk;
    const boxWidth = Math.min(layout.contentWidth - 58, 540);
    const boxHeight = layout.veryCompact ? 66 : 78;

    this.createRoundedPanel({
      x: layout.centerX,
      y,
      width: boxWidth,
      height: boxHeight,
      radius: 20,
      color: isReady ? 0x102016 : 0x241010,
      alpha: 0.88,
      strokeColor: isReady ? 0x75d184 : 0xff6b6b,
      strokeAlpha: 0.68,
      strokeWidth: 2,
      depth: 5,
    });

    this.add.text(layout.centerX, y - (layout.veryCompact ? 18 : 22), isReady ? 'Герой готов к боссу' : 'Босс опасен', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '14px' : '17px',
      color: isReady ? UI.colors.green : UI.colors.red,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      maxLines: 1,
      wordWrap: {
        width: boxWidth - 40,
      },
    }).setOrigin(0.5).setDepth(8);

    const text = [
      `Ур. ${recommendedLevel}/${player.level}`,
      `Атака ${recommendedStrength}/${stats.attack}`,
      `HP ${recommendedHp}/${stats.maxHp}`,
    ].join('  •  ');

    this.add.text(layout.centerX, y + (layout.veryCompact ? 13 : 16), text, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '12px' : '14px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: boxWidth - 36,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(8);
  }

  private getRoomTextColor(type: string) {
    switch (type) {
      case 'chest':
        return UI.colors.goldText;
      case 'trap':
        return UI.colors.red;
      case 'campfire':
        return UI.colors.goldText;
      case 'event':
        return '#c0a5ff';
      case 'elite':
        return '#c9a4ff';
      case 'boss':
      case 'tier_boss':
        return UI.colors.red;
      default:
        return UI.colors.text;
    }
  }

  private createRoomButton(type: string, enemyId?: string) {
    const isBattleRoom =
      type === 'monster' ||
      type === 'elite' ||
      type === 'boss' ||
      type === 'tier_boss';

    const isBoss = type === 'boss' || type === 'tier_boss';

    let buttonText = 'Продолжить';
    let icon = '➤';
    let description = 'Перейти дальше.';

    if (type === 'monster') {
      buttonText = 'Войти в бой';
      icon = '☠';
      description = 'Обычное сражение. Победи врага, чтобы пройти дальше.';
    }

    if (type === 'elite') {
      buttonText = 'Войти в бой';
      icon = '◆';
      description = 'Элитный враг. Опаснее обычного, но награда выше.';
    }

    if (type === 'boss') {
      buttonText = 'Войти к боссу';
      icon = '♛';
      description = 'Финальная битва этажа. Проверь HP, энергию и зелья.';
    }

    if (type === 'tier_boss') {
      buttonText = 'Войти в финальный бой';
      icon = '♚';
      description = 'Битва за завершение яруса и переход глубже.';
    }

    if (type === 'chest') {
      buttonText = 'Открыть сундук';
      icon = '✦';
      description = 'Золото и материалы для кузницы.';
    }

    if (type === 'trap') {
      buttonText = 'Пройти осторожно';
      icon = '!';
      description = 'Ловкость может помочь избежать урона.';
    }

    if (type === 'event') {
      buttonText = 'Изучить событие';
      icon = '◈';
      description = 'Выбери исход. Риск может дать награду или оставить шрам.';
    }

    if (type === 'campfire') {
      this.createCampfireButtons();
      return;
    }

    if (type === 'event') {
      this.createEventButtons();
      return;
    }

    if (isBattleRoom) {
      if (!enemyId) return;

      if (isBoss) {
        this.createBossBattleButtons({
          enemyId,
          buttonText,
          icon,
          description,
        });
      } else {
        this.createNormalBattleButtons({
          enemyId,
          buttonText,
          icon,
          description,
          type,
        });
      }

      return;
    }

    const layout = this.getLayout();
    this.createActionDock(layout);

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.mainButtonY,
      width: Math.min(layout.contentWidth, 560),
      height: layout.primaryButtonHeight,
      icon,
      title: buttonText,
      subtitle: description,
      accentColor: this.getRoomStrokeColor(type),
      danger: type === 'trap',
      large: true,
      onClick: () => {
        if (type === 'chest') {
          this.openChest();
          return;
        }

        if (type === 'trap') {
          this.triggerTrap();
        }
      },
    });

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.exitButtonY,
      width: Math.min(layout.contentWidth, 560),
      height: layout.secondaryButtonHeight,
      icon: '⌂',
      title: 'Выйти в город',
      subtitle: this.getTownExitSubtitle(),
      accentColor: UI.colors.goldDark,
      danger: !getActiveCampfireBattleCheckpoint(),
      onClick: () => {
        this.showExitToTownConfirm();
      },
    });
  }


  private createEventButtons() {
    const room = getCurrentRoom();
    const event = getDungeonEventById(room?.eventId);

    if (!room || !event) {
      return;
    }

    const layout = this.getLayout();

    this.createActionDock(layout);

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.mainButtonY,
      width: Math.min(layout.contentWidth, 560),
      height: layout.primaryButtonHeight,
      icon: event.icon,
      title: 'Изучить событие',
      subtitle: 'Открыть выбор и решить, стоит ли рисковать.',
      accentColor: event.accent,
      danger: false,
      large: true,
      onClick: () => {
        this.showDungeonEventModal(event.id);
      },
    });

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.exitButtonY,
      width: Math.min(layout.contentWidth, 560),
      height: layout.secondaryButtonHeight,
      icon: '⌂',
      title: 'Выйти в город',
      subtitle: this.getTownExitSubtitle(),
      accentColor: UI.colors.goldDark,
      danger: !getActiveCampfireBattleCheckpoint(),
      onClick: () => {
        this.showExitToTownConfirm();
      },
    });
  }

  private clearModalObjects() {
    this.modalObjects.forEach(object => {
      object.destroy();
    });

    this.modalObjects = [];
  }

  private showDungeonEventModal(eventId: DungeonEventId) {
    const event = getDungeonEventById(eventId);

    if (!event) {
      return;
    }

    const { width, height } = this.scale;

    this.clearModalObjects();

    const modalWidth = Math.min(width - 34, 640);
    const modalHeight = Math.min(height - 72, 660);
    const centerX = width / 2;
    const centerY = height / 2;
    const top = centerY - modalHeight / 2;
    const buttonWidth = modalWidth - 44;
    const buttonHeight = height < 940 ? 74 : 82;
    const buttonGap = height < 940 ? 10 : 12;
    const firstButtonY = top + (height < 940 ? 278 : 306);

    const overlay = this.add.rectangle(
      centerX,
      centerY,
      width,
      height,
      0x000000,
      0.76
    ).setDepth(100).setInteractive();

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.42);
    shadow.fillRoundedRect(
      centerX - modalWidth / 2,
      top + 8,
      modalWidth,
      modalHeight,
      28
    );
    shadow.setDepth(101);

    const panel = this.add.graphics();
    panel.fillStyle(0x111016, 0.985);
    panel.fillRoundedRect(
      centerX - modalWidth / 2,
      top,
      modalWidth,
      modalHeight,
      28
    );
    panel.lineStyle(3, event.accent, 0.78);
    panel.strokeRoundedRect(
      centerX - modalWidth / 2,
      top,
      modalWidth,
      modalHeight,
      28
    );
    panel.setDepth(102);

    const iconCircle = this.add.circle(centerX, top + 58, 35, event.accent, 0.16)
      .setStrokeStyle(2, event.accent, 0.72)
      .setDepth(103);

    const icon = this.add.text(centerX, top + 58, event.icon, {
      fontFamily: UI.font.body,
      fontSize: '31px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(104);

    const title = this.add.text(centerX, top + 112, event.title, {
      fontFamily: UI.font.title,
      fontSize: height < 940 ? '23px' : '27px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: modalWidth - 54,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(104);

    const divider = this.add.rectangle(
      centerX,
      top + 154,
      modalWidth - 80,
      2,
      event.accent,
      0.22
    ).setDepth(104);

    const description = this.add.text(centerX, top + 176, event.description, {
      fontFamily: UI.font.body,
      fontSize: height < 940 ? '15px' : '17px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 5,
      wordWrap: {
        width: modalWidth - 66,
        useAdvancedWrap: true,
      },
      maxLines: height < 940 ? 4 : 5,
    }).setOrigin(0.5, 0).setDepth(104);

    this.modalObjects.push(
      overlay,
      shadow,
      panel,
      iconCircle,
      icon,
      title,
      divider,
      description
    );

    event.choices.forEach((choice, index) => {
      const y = firstButtonY + index * (buttonHeight + buttonGap);

      this.createEventChoiceButton({
        x: centerX,
        y,
        width: buttonWidth,
        height: buttonHeight,
        eventAccent: event.accent,
        choice,
        onClick: () => {
          this.resolveDungeonEventChoice(event.id, choice.id);
        },
      });
    });

    const closeY = top + modalHeight - 38;
    const close = this.add.text(centerX, closeY, 'Нажми вариант выше, чтобы завершить событие', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: modalWidth - 70,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(104);

    this.modalObjects.push(close);
  }

  private createEventChoiceButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    eventAccent: number;
    choice: DungeonEventChoice;
    onClick: () => void;
  }) {
    const danger = config.choice.danger ?? false;
    const radius = 20;
    const bgColor = danger ? 0x221011 : 0x17100c;
    const hoverColor = danger ? 0x331719 : 0x24180f;
    const strokeColor = danger ? 0x8d2f2f : config.eventAccent;
    const titleColor = danger ? '#ff9a9a' : UI.colors.goldText;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 5,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(104);

    const bg = this.add.graphics();
    const drawBg = (fill: number, alpha: number, strokeAlpha: number) => {
      bg.clear();
      bg.fillStyle(fill, alpha);
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
    };

    drawBg(bgColor, 0.96, danger ? 0.82 : 0.62);
    bg.setDepth(105);

    const iconX = config.x - config.width / 2 + 42;
    const textX = config.x - config.width / 2 + 78;
    const textWidth = config.width - 100;

    const iconCircle = this.add.circle(iconX, config.y, 22, strokeColor, danger ? 0.18 : 0.14)
      .setStrokeStyle(1, strokeColor, 0.58)
      .setDepth(106);

    const icon = this.add.text(iconX, config.y, config.choice.icon, {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(107);

    const title = this.add.text(textX, config.y - 15, config.choice.title, {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(107);

    const subtitle = this.add.text(textX, config.y + 16, config.choice.subtitle, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      lineSpacing: 2,
      maxLines: 2,
    }).setOrigin(0, 0.5).setDepth(107);

    let pressed = false;
    let locked = false;

    bg.setInteractive(
      new Phaser.Geom.Rectangle(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height
      ),
      Phaser.Geom.Rectangle.Contains
    );

    bg.on('pointerover', () => {
      if (pressed || locked) return;
      drawBg(hoverColor, 1, 0.96);
      title.setColor('#ffffff');
      icon.setColor('#ffffff');
    });

    bg.on('pointerout', () => {
      pressed = false;
      if (locked) return;
      drawBg(bgColor, 0.96, danger ? 0.82 : 0.62);
      title.setColor(titleColor);
      icon.setColor(titleColor);
    });

    bg.on('pointerdown', () => {
      if (locked) return;
      pressed = true;
      drawBg(hoverColor, 0.92, 1);
      title.setY(config.y - 14);
      subtitle.setY(config.y + 17);
      iconCircle.setY(config.y + 1);
      icon.setY(config.y + 1);
    });

    bg.on('pointerup', () => {
      if (!pressed || locked) return;
      pressed = false;
      locked = true;

      this.time.delayedCall(40, () => {
        config.onClick();
      });
    });

    bg.on('pointerupoutside', () => {
      pressed = false;
      if (locked) return;
      drawBg(bgColor, 0.96, danger ? 0.82 : 0.62);
      title.setY(config.y - 15);
      subtitle.setY(config.y + 16);
      iconCircle.setY(config.y);
      icon.setY(config.y);
      title.setColor(titleColor);
      icon.setColor(titleColor);
    });

    this.modalObjects.push(
      shadow,
      bg,
      iconCircle,
      icon,
      title,
      subtitle
    );
  }

  private resolveDungeonEventChoice(eventId: DungeonEventId, choiceId: DungeonEventChoiceId) {
    const room = getCurrentRoom();

    if (!room || room.completed) {
      return;
    }

    const event = getDungeonEventById(eventId);
    const choice = getDungeonEventChoiceById(eventId, choiceId);

    if (!event || !choice) {
      return;
    }

    this.clearModalObjects();

    const floor = gameState.floorRun.currentFloor || 1;
    const stats = getPlayerStats(player);
    const baseGold = 65 + floor * 14;
    const baseExp = 25 + floor * 6;

    let title = event.shortTitle;
    let text = '';

    switch (choiceId) {
      case 'altar_drink': {
        const damage = this.applyEventDamage(Math.ceil(Math.max(1, player.hp) * 0.2));
        const energyBefore = player.energy;
        player.energy = Math.min(stats.maxEnergy, player.energy + 2);
        const restored = player.energy - energyBefore;

        title = 'Вода вошла в кровь';
        text = [
          `Чёрная вода обожгла горло холодом.`,
          `-${damage} HP`,
          restored > 0 ? `+${restored} энергии` : 'Энергия уже полна.',
        ].join('\n');
        break;
      }

      case 'altar_weapon': {
        const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.12));
        const expText = this.addEventExp(Math.ceil(baseExp * 0.8));

        title = 'Оружие почернело';
        text = [
          `Кромка оружия впитала мёртвую воду.`,
          `-${damage} HP`,
          expText,
        ].join('\n');
        break;
      }

      case 'altar_break': {
        const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.15));
        const materialId: MaterialId = floor >= 18 ? 'black_gem' : 'dark_flame_heart';

        title = 'Алтарь расколот';
        text = [
          `Каменная чаша треснула, и внутри открылся тёмный сгусток.`,
          `-${damage} HP`,
          this.addEventMaterial(materialId, 1),
        ].join('\n');
        break;
      }

      case 'prisoner_open': {
        const roll = Math.random();

        title = 'Крышка сдвинулась';

        if (roll < 0.58 + Math.min(0.2, stats.luck * 0.01)) {
          text = [
            'Внутри лежали только сухие кости и мешочек с погребальной платой.',
            this.addEventGold(baseGold + Phaser.Math.Between(20, 80)),
            this.addEventMaterial('darkened_bone', 1),
          ].join('\n');
        } else {
          const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.18));

          text = [
            'Из саркофага вылетела костяная рука и рассекла кожу.',
            `-${damage} HP`,
            this.addEventExp(Math.ceil(baseExp * 0.6)),
          ].join('\n');
        }

        break;
      }

      case 'prisoner_demand': {
        const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.08));

        title = 'Плата получена';
        text = [
          'Голос внутри замолчал. Между плитами появилась старая монета.',
          this.addEventGold(Math.ceil(baseGold * 1.35)),
          `-${damage} HP от холодного проклятия`,
        ].join('\n');
        break;
      }

      case 'prisoner_leave': {
        title = 'Голос остался позади';
        text = 'Ты не стал открывать саркофаг. Стук продолжался ещё несколько шагов.';
        break;
      }

      case 'trader_buy': {
        title = 'Тёмный свёрток куплен';

        if (player.gold < 350) {
          text = 'Торговец молча смотрит на пустой кошель. Не хватает золота.';
        } else {
          player.gold -= 350;

          const materialId: MaterialId = Math.random() < 0.5 ? 'cursed_seal' : 'dark_flame_heart';

          text = [
            '-350 золота',
            this.addEventMaterial(materialId, 1),
            'Могильный торговец спрятал монеты под маской.',
          ].join('\n');
        }

        break;
      }

      case 'trader_potion': {
        title = 'Обмен совершён';

        if (player.potions <= 0) {
          text = 'У тебя нет зелий. Торговец больше не смотрит в твою сторону.';
        } else {
          player.potions -= 1;

          text = [
            '-1 зелье',
            this.addEventGold(Math.ceil(baseGold * 0.9)),
            this.addEventMaterial('old_leather', 1),
          ].join('\n');
        }

        break;
      }

      case 'trader_leave': {
        title = 'Сделки не было';
        text = 'Ты прошёл мимо. Торговец тихо пересчитал чужие зубы.';
        break;
      }

      case 'chains_break': {
        const successChance = Phaser.Math.Clamp(0.35 + stats.strength * 0.018, 0.35, 0.78);
        const success = Math.random() < successChance;

        title = success ? 'Цепи разорваны' : 'Цепи не поддались';

        if (success) {
          text = [
            'Старое железо лопнуло, и с потолка посыпалась пыль.',
            this.addEventExp(baseExp),
            this.addEventMaterial('darkened_bone', 1),
          ].join('\n');
        } else {
          const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.14));

          text = [
            'Цепь дёрнулась назад и ударила в грудь.',
            `-${damage} HP`,
          ].join('\n');
        }

        break;
      }

      case 'chains_search': {
        const roll = Math.random();

        title = 'Останки осмотрены';

        if (roll < 0.65 + Math.min(0.18, stats.luck * 0.008)) {
          text = [
            'Среди обломков брони нашлась полезная добыча.',
            this.addEventGold(Math.ceil(baseGold * 0.75)),
            this.addEventMaterial('old_leather', 1),
          ].join('\n');
        } else {
          const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.12));

          text = [
            'Ты задел спрятанный крюк, и цепи резко натянулись.',
            `-${damage} HP`,
          ].join('\n');
        }

        break;
      }

      case 'chains_take': {
        const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.1));

        title = 'Цепь снята';
        text = [
          'Ржавая цепь обожгла ладонь, но её можно использовать в кузнице.',
          `-${damage} HP`,
          this.addEventMaterial('cursed_seal', 1),
        ].join('\n');
        break;
      }

      case 'mirror_look': {
        const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.12));

        title = 'Зеркало показало смерть';
        text = [
          'Ты увидел удар, которого ещё не было. Боль пришла раньше времени.',
          `-${damage} HP`,
          this.addEventExp(Math.ceil(baseExp * 1.15)),
        ].join('\n');
        break;
      }

      case 'mirror_break': {
        const roll = Math.random();

        title = 'Осколки упали на пол';

        if (roll < 0.34) {
          const energyBefore = player.energy;
          player.energy = Math.min(stats.maxEnergy, player.energy + 1);
          text = `В осколках вспыхнул холодный свет.\n+${player.energy - energyBefore} энергии`;
        } else if (roll < 0.68) {
          text = [
            'За зеркалом лежал тайник Морвеина.',
            this.addEventGold(Math.ceil(baseGold * 1.1)),
          ].join('\n');
        } else {
          const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.16));
          text = `Один осколок сам вошёл под кожу.\n-${damage} HP`;
        }

        break;
      }

      case 'mirror_touch': {
        const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.25));

        title = 'Отражение коснулось тебя';
        text = [
          `-${damage} HP`,
          this.addEventExp(Math.ceil(baseExp * 1.75)),
        ].join('\n');
        break;
      }

      case 'lottery_throw':
      case 'lottery_load': {
        const paid = choiceId === 'lottery_load';
        let bonus = Math.floor(stats.luck / 5);

        if (paid) {
          if (player.gold >= 100) {
            player.gold -= 100;
            bonus += 2;
          } else {
            title = 'Не хватает золота';
            text = 'Кости не принимают пустые обещания. Нужно 100 золота.';
            break;
          }
        }

        const roll = Phaser.Math.Clamp(Phaser.Math.Between(1, 6) + bonus, 1, 6);

        title = `Выпало: ${roll}`;

        if (roll <= 2) {
          const damage = this.applyEventDamage(Math.ceil(stats.maxHp * 0.16));
          text = `${paid ? '-100 золота\n' : ''}Кости треснули и выпустили костяную пыль.\n-${damage} HP`;
        } else if (roll <= 4) {
          text = [
            paid ? '-100 золота' : '',
            this.addEventGold(Math.ceil(baseGold * (roll === 4 ? 1.25 : 0.85))),
          ].filter(Boolean).join('\n');
        } else if (roll === 5) {
          text = [
            paid ? '-100 золота' : '',
            this.addEventMaterial(Math.random() < 0.5 ? 'dim_gem' : 'darkened_bone', 2),
          ].filter(Boolean).join('\n');
        } else {
          text = [
            paid ? '-100 золота' : '',
            this.addEventGold(Math.ceil(baseGold * 1.5)),
            this.addEventMaterial('dark_flame_heart', 1),
          ].filter(Boolean).join('\n');
        }

        break;
      }

      case 'lottery_leave': {
        title = 'Кости не брошены';
        text = 'Ты оставил кубики лежать на плите. Они тихо повернулись сами.';
        break;
      }

      default:
        text = 'Событие завершено.';
    }

    if (player.hp <= 0) {
      this.handleDungeonEventDeath(title, text);
      return;
    }

    this.finishDungeonEvent(title, text);
  }

  private addEventGold(amount: number) {
    const safeAmount = Math.max(0, Math.floor(amount));

    player.gold += safeAmount;
    gameState.floorRun.goldEarned += safeAmount;
    trackGoldEarned(safeAmount);

    return `+${safeAmount} золота`;
  }

  private addEventExp(amount: number) {
    const safeAmount = Math.max(0, Math.floor(amount));
    const result = addExperience(player, safeAmount);
    const levelText = createLevelUpText(result);

    gameState.floorRun.expEarned += safeAmount;

    return levelText
      ? `+${safeAmount} опыта\n\n${levelText}`
      : `+${safeAmount} опыта`;
  }

  private addEventMaterial(materialId: MaterialId, amount = 1) {
    const safeAmount = Math.max(1, Math.floor(amount));

    addMaterial(materialId, safeAmount);

    gameState.floorRun.materialsEarned[materialId] =
      (gameState.floorRun.materialsEarned[materialId] ?? 0) + safeAmount;

    return `+${safeAmount} ${getMaterialName(materialId)}`;
  }

  private applyEventDamage(amount: number) {
    const damage = Math.max(1, Math.floor(amount));

    player.hp = Math.max(0, player.hp - damage);

    return damage;
  }

  private finishDungeonEvent(title: string, text: string) {
    const regenerationText = this.completeRoomAndApplyRegeneration();

    void saveGameAsync();

    this.showMessage(
      title,
      `${text}${regenerationText}`,
      () => {
        this.scene.restart();
      }
    );
  }

  private handleDungeonEventDeath(title: string, text: string) {
    this.showMessage(
      'Ты погиб',
      `${title}\n\n${text}\n\nСобытие оказалось смертельным.\nТы очнулся в лагере.`,
      () => {
        const freshStats = getPlayerStats(player);

        player.hp = freshStats.maxHp;
        player.energy = freshStats.maxEnergy;

        resetFloorRun();
        clearRoomRegenerationBlock();
        this.resetCampfireState(!getActiveCampfireBattleCheckpoint());
        clearResumePoint('event-death');

        void saveGameAsync();

        this.scene.start('CampScene');
      }
    );
  }


  private createCampfireStatusBox(y: number) {
    const layout = this.getLayout();
    const campfireState = this.getCampfireState();
    const flintName = this.getFlintDisplayName(campfireState.selectedFlint ?? 'none');
    const potionText = `Зелья: ${player.potions}/${this.maxPotionCount}`;
    const chargeText = `Зарядов огнива: ${campfireState.remainingCampfireUses}`;
    const boxWidth = Math.min(layout.contentWidth - 58, 540);
    const boxHeight = layout.veryCompact ? 70 : 84;

    this.createRoundedPanel({
      x: layout.centerX,
      y,
      width: boxWidth,
      height: boxHeight,
      radius: 22,
      color: DUNGEON_DARK.brown,
      alpha: 0.9,
      strokeColor: 0xf0a040,
      strokeAlpha: 0.42,
      strokeWidth: 1,
      depth: 5,
    });

    this.add.text(layout.centerX, y - (layout.veryCompact ? 19 : 23), flintName, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '15px' : '18px',
      color: campfireState.remainingCampfireUses > 0 ? UI.colors.goldText : UI.colors.textMuted,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: boxWidth - 42,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(8);

    this.add.text(layout.centerX, y + (layout.veryCompact ? 14 : 18), `${potionText}  •  ${chargeText}`, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '12px' : '15px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: boxWidth - 42,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(8);
  }


  private createCampfireButtons() {
    const layout = this.getLayout();
    const campfireState = this.getCampfireState();
    const canUseCampfire = campfireState.remainingCampfireUses > 0;

    this.createActionDock(layout);

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.mainButtonY,
      width: Math.min(layout.contentWidth, 560),
      height: layout.primaryButtonHeight,
      icon: '♨',
      title: canUseCampfire ? 'Разжечь костёр' : 'Огниво погасло',
      subtitle: canUseCampfire
        ? `Полное HP/энергия • зелья до ${this.maxPotionCount} • чекпоинт`
        : 'Нет зарядов выбранного огнива',
      accentColor: canUseCampfire ? 0xf0a040 : UI.colors.goldDark,
      danger: false,
      large: true,
      onClick: () => {
        this.handleCampfireUse();
      },
    });

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.prepareButtonY,
      width: Math.min(layout.contentWidth, 560),
      height: layout.secondaryButtonHeight,
      icon: '➤',
      title: 'Пройти мимо',
      subtitle: 'Не тратить заряд огнива',
      accentColor: UI.colors.goldDark,
      danger: false,
      onClick: () => {
        this.skipCampfire();
      },
    });

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.exitButtonY,
      width: Math.min(layout.contentWidth, 560),
      height: layout.secondaryButtonHeight,
      icon: '⌂',
      title: 'Выйти в город',
      subtitle: this.getTownExitSubtitle(),
      accentColor: UI.colors.goldDark,
      danger: !getActiveCampfireBattleCheckpoint(),
      onClick: () => {
        this.showExitToTownConfirm();
      },
    });
  }


  private createCampfireStateSnapshot(): CampfireStateSnapshot {
    const state = this.getCampfireState();

    return {
      tier: state.tier,
      selectedFlint: state.selectedFlint,
      remainingCampfireUses: state.remainingCampfireUses,
      campfireFloors: [...state.campfireFloors],
      usedCampfireFloors: [...state.usedCampfireFloors],
      selectionDone: state.selectionDone,
    };
  }



  private handleCampfireUse() {
    const room = getCurrentRoom();

    if (!room || room.completed) {
      return;
    }

    const campfireState = this.getCampfireState();

    if (campfireState.remainingCampfireUses <= 0) {
      this.showMessage(
        'Нет огня',
        'У выбранного огнива больше нет зарядов. Можно только пройти мимо костра.',
        () => {
          this.scene.restart();
        }
      );
      return;
    }

    // Важно: максимум HP/энергии берём через итоговые характеристики героя.
    // Так костёр учитывает дерево характеристик, предметы и реликвии.
    const restoredBeforeCheckpoint = restorePlayerVitalsToMaximum(player, this.maxPotionCount);

    campfireState.remainingCampfireUses = Math.max(0, campfireState.remainingCampfireUses - 1);
    campfireState.usedCampfireFloors = Array.from(new Set([
      ...campfireState.usedCampfireFloors,
      gameState.floorRun.currentFloor,
    ]));

    markCurrentRoomCompleted();
    trackCampfireUsed();
    goToNextRoom();

    const checkpoint = createCampfireBattleCheckpoint({
      tier: campfireState.tier,
      floor: gameState.floorRun.currentFloor,
      selectedFlint: (campfireState.selectedFlint ?? 'none') as CheckpointFlintType,
      campfireStateSnapshot: this.createCampfireStateSnapshot(),
    });

    // Повторно применяем после создания чекпоинта, чтобы в сохранение и UI точно ушли
    // текущие максимумы после дерева характеристик.
    const restored = restorePlayerVitalsToMaximum(player, this.maxPotionCount);
    const checkpointTime = formatCheckpointTimeLeft(checkpoint.expiresAt - Date.now());

    void saveGameAsync();

    this.showMessage(
      'Костёр разожжён',
      `Пламя восстановило силы.
HP: ${restoredBeforeCheckpoint.hpBefore}/${restored.hpMax} → ${restored.hpAfter}/${restored.hpMax} (+${restored.hpRestored})
Энергия: ${restoredBeforeCheckpoint.energyBefore}/${restored.energyMax} → ${restored.energyAfter}/${restored.energyMax} (+${restored.energyRestored})
Зелья: ${restoredBeforeCheckpoint.potionsBefore}/${this.maxPotionCount} → ${restored.potionsAfter}/${this.maxPotionCount}

Осталось зарядов: ${campfireState.remainingCampfireUses}.
Костёр стал чекпоинтом. При смерти можно вернуться сюда ещё ${checkpointTime}.`,
      () => {
        this.scene.restart();
      }
    );
  }

  private skipCampfire() {
    const room = getCurrentRoom();

    if (!room || room.completed) {
      return;
    }

    const regenerationText = this.completeRoomAndApplyRegeneration();

    void saveGameAsync();

    this.showMessage(
      'Костёр остался позади',
      `Ты не стал тратить огниво и пошёл дальше.${regenerationText}`,
      () => {
        this.scene.restart();
      }
    );
  }

  private createActionDock(layout = this.getLayout()) {
    const dockHeight = layout.height - layout.actionDockTop;

    this.add.rectangle(
      layout.centerX,
      layout.actionDockTop + dockHeight / 2,
      layout.width,
      dockHeight,
      0x020202,
      0.78
    ).setDepth(18);

    this.add.rectangle(
      layout.centerX,
      layout.actionDockTop + 1,
      layout.contentWidth,
      1,
      UI.colors.goldDark,
      0.28
    ).setDepth(19);
  }

  private createNormalBattleButtons(config: {
    enemyId: string;
    buttonText: string;
    icon: string;
    description: string;
    type: string;
  }) {
    const layout = this.getLayout();
    const buttonWidth = Math.min(layout.contentWidth, 560);

    this.createActionDock(layout);

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.mainButtonY,
      width: buttonWidth,
      height: layout.primaryButtonHeight,
      icon: config.icon,
      title: config.buttonText,
      subtitle: config.description,
      accentColor: this.getRoomStrokeColor(config.type),
      danger: config.type === 'elite',
      large: true,
      onClick: () => {
        markDungeonResumePoint('before-battle');
        void flushSaveNow('before-battle');

        this.scene.start('BattleScene', {
          enemyId: config.enemyId,
          returnToDungeon: true,
        });
      },
    });

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.prepareButtonY,
      width: buttonWidth,
      height: layout.secondaryButtonHeight,
      icon: '▣',
      title: 'Подготовка',
      subtitle: 'Открыть сумку и проверить снаряжение перед боем',
      accentColor: UI.colors.gold,
      onClick: () => {
        this.scene.start('InventoryScene', {
          returnScene: 'DungeonScene',
          selectedCategory: 'all',
          inventoryScrollY: 0,
        });
      },
    });

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.exitButtonY,
      width: buttonWidth,
      height: layout.secondaryButtonHeight,
      icon: '⌂',
      title: 'Выйти в город',
      subtitle: this.getTownExitSubtitle(),
      accentColor: UI.colors.goldDark,
      danger: !getActiveCampfireBattleCheckpoint(),
      onClick: () => {
        this.showExitToTownConfirm();
      },
    });
  }
  

  private createBossBattleButtons(config: {
    enemyId: string;
    buttonText: string;
    icon: string;
    description: string;
  }) {
    const layout = this.getLayout();
    const buttonWidth = Math.min(layout.contentWidth, 570);

    this.createActionDock(layout);

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.mainButtonY,
      width: buttonWidth,
      height: layout.primaryButtonHeight,
      icon: config.icon,
      title: config.buttonText,
      subtitle: config.description,
      accentColor: 0xff6b6b,
      danger: true,
      large: true,
      onClick: () => {
        markDungeonResumePoint('before-battle');
        void flushSaveNow('before-battle');

        this.scene.start('BattleScene', {
          enemyId: config.enemyId,
          returnToDungeon: true,
        });
      },
    });

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.prepareButtonY,
      width: buttonWidth,
      height: layout.secondaryButtonHeight,
      icon: '▣',
      title: 'Подготовка',
      subtitle: 'Проверить экипировку, зелья и характеристики перед боссом',
      accentColor: UI.colors.gold,
      onClick: () => {
        this.scene.start('InventoryScene', {
          returnScene: 'DungeonScene',
          selectedCategory: 'all',
          inventoryScrollY: 0,
        });
      },
    });

    this.createRoomActionButton({
      x: layout.centerX,
      y: layout.exitButtonY,
      width: buttonWidth,
      height: layout.secondaryButtonHeight,
      icon: '⌂',
      title: 'Выйти в город',
      subtitle: this.getTownExitSubtitle(),
      accentColor: UI.colors.goldDark,
      danger: !getActiveCampfireBattleCheckpoint(),
      onClick: () => {
        this.showExitToTownConfirm();
      },
    });
  }

  private createRoomActionButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    title: string;
    subtitle: string;
    accentColor: number;
    danger?: boolean;
    large?: boolean;
    onClick: () => void;
  }) {
    const danger = config.danger ?? false;
    const large = config.large ?? false;

    const bgColor = danger ? 0x241010 : 0x17100c;
    const hoverColor = danger ? 0x321515 : 0x21150f;
    const textColor = danger ? UI.colors.red : UI.colors.goldText;
    const hoverTextColor = danger ? '#ff9a9a' : UI.colors.text;

    const radius = large ? 24 : 20;
    const titleSize = large ? '22px' : '18px';
    const subtitleSize = large ? '14px' : '12px';
    const iconX = config.x - config.width / 2 + (large ? 48 : 42);
    const textX = config.x - config.width / 2 + (large ? 88 : 78);
    const textWidth = config.width - (large ? 112 : 104);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.36);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 5,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(20);

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.96);
    bg.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );
    bg.lineStyle(large ? 3 : 2, config.accentColor, danger ? 0.9 : large ? 0.82 : 0.62);
    bg.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );
    bg.setDepth(21);

    const iconCircle = this.add.circle(iconX, config.y, large ? 26 : 22, config.accentColor, danger ? 0.18 : 0.14)
      .setStrokeStyle(1, config.accentColor, 0.58)
      .setDepth(22);

    const iconText = this.add.text(iconX, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: large ? '23px' : '19px',
      color: textColor,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(23);

    const titleText = this.add.text(textX, config.y - (large ? 14 : 11), config.title, {
      fontFamily: UI.font.title,
      fontSize: titleSize,
      color: textColor,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(23);

    const subtitleText = this.add.text(textX, config.y + (large ? 18 : 16), config.subtitle, {
      fontFamily: UI.font.body,
      fontSize: subtitleSize,
      color: UI.colors.textMuted,
      wordWrap: {
        width: textWidth,
        useAdvancedWrap: true,
      },
      maxLines: large ? 2 : 1,
      lineSpacing: 2,
    }).setOrigin(0, 0.5).setDepth(23);

    const redrawButton = (
      fillColor: number,
      fillAlpha: number,
      strokeAlpha: number,
      titleColor: string,
      offsetY = 0
    ) => {
      bg.clear();

      bg.fillStyle(fillColor, fillAlpha);
      bg.fillRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );

      bg.lineStyle(large ? 3 : 2, config.accentColor, strokeAlpha);
      bg.strokeRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );

      iconCircle.setY(config.y + offsetY);
      iconText.setY(config.y + offsetY);
      titleText.setY(config.y - (large ? 14 : 11) + offsetY);
      subtitleText.setY(config.y + (large ? 18 : 16) + offsetY);

      titleText.setColor(titleColor);
      iconText.setColor(titleColor);
    };

    let isPressed = false;
    let isLocked = false;

    bg.setInteractive(
      new Phaser.Geom.Rectangle(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height
      ),
      Phaser.Geom.Rectangle.Contains
    );

    bg.on('pointerover', () => {
      if (isPressed || isLocked) return;

      redrawButton(hoverColor, 1, 0.96, hoverTextColor);
    });

    bg.on('pointerout', () => {
      isPressed = false;

      if (isLocked) return;

      redrawButton(bgColor, 0.96, danger ? 0.9 : large ? 0.82 : 0.62, textColor);
    });

    bg.on('pointerdown', () => {
      if (isLocked) return;

      isPressed = true;

      redrawButton(hoverColor, 0.92, 0.98, hoverTextColor, 1);
    });

    bg.on('pointerup', () => {
      if (!isPressed || isLocked) return;

      isPressed = false;
      isLocked = true;

      redrawButton(hoverColor, 1, 0.98, hoverTextColor);

      this.time.delayedCall(40, () => {
        redrawButton(bgColor, 0.96, danger ? 0.9 : large ? 0.82 : 0.62, textColor);
        config.onClick();
      });
    });

    bg.on('pointerupoutside', () => {
      isPressed = false;

      if (isLocked) return;

      redrawButton(bgColor, 0.96, danger ? 0.9 : large ? 0.82 : 0.62, textColor);
    });

    bg.on('pointercancel', () => {
      isPressed = false;

      if (isLocked) return;

      redrawButton(bgColor, 0.96, danger ? 0.9 : large ? 0.82 : 0.62, textColor);
    });

    return {
      shadow,
      bg,
      iconCircle,
      iconText,
      titleText,
      subtitleText,
    };
  }

private exitToTownKeepingCampfireCheckpoint() {
  const checkpoint = getActiveCampfireBattleCheckpoint();

  resetFloorRun();

  if (!checkpoint) {
    this.resetCampfireState(true);
  } else {
    // Активный костёр остаётся жить после выхода в город.
    // Не сбрасываем dungeonCampfireState, чтобы при возврате не предлагался выбор огнива заново.
    const state = this.getCampfireState();
    state.selectionDone = true;
  }

  clearResumePoint('exit-to-town');
  void saveGameAsync();

  this.scene.start('CampScene');
}

  private createRoundedPanel(config: {
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
    const color = config.color ?? 0x14100d;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? UI.colors.goldDark;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const depth = config.depth ?? 1;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 6,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(depth);

    const panel = this.add.graphics();
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    panel.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    panel.setDepth(depth + 1);

    return {
      shadow,
      panel,
    };
  }

  private openChest() {
  const room = getCurrentRoom();

  if (!room || room.completed) {
    return;
  }

  const reward = claimChestReward();

  const regenerationText = this.completeRoomAndApplyRegeneration();

  void saveGameAsync();

  this.showMessage(
    'Сундук открыт',
    `${reward.text}${regenerationText}`,
    () => {
      this.scene.restart();
    }
  );
}

  private triggerTrap() {
    const room = getCurrentRoom();

    if (!room || room.completed) {
      return;
    }

    const result = triggerTrapResult();
    trackTrapTriggered();

    if (player.hp <= 0) {
      this.showMessage(
        'Ты погиб',
        `${result.text}\n\nЛовушка оказалась смертельной.\nТы очнулся в лагере.`,
        () => {
          const freshStats = getPlayerStats(player);

          player.hp = freshStats.maxHp;
          player.energy = freshStats.maxEnergy;

          resetFloorRun();
          clearRoomRegenerationBlock();
          this.resetCampfireState(!getActiveCampfireBattleCheckpoint());
          clearResumePoint('trap-death');

          void saveGameAsync();

          this.scene.start('CampScene');
        }
      );

      return;
    }

    const curseText = this.tryBreakRegenerationByCursedTrap(result.avoided);

    const regenerationText = this.completeRoomAndApplyRegeneration();

    void saveGameAsync();

    this.showMessage(
      result.avoided ? 'Ловушка обезврежена' : 'Проклятая ловушка',
      `${result.text}${curseText}${regenerationText}`,
      () => {
        this.scene.restart();
      }
    );
  }


  private showFloorCompleted() {
    const floor = gameState.floorRun.currentFloor;
    const nextFloor = getNextFloorAfterCurrent();

    completeCurrentFloor();
    clearRoomRegenerationBlock();

    if (gameState.floorRun.runType === 'tier_gate') {
      void saveGameAsync();
      this.showTierGateCompleted();
      return;
    }

    let rewardText = '';

    if (!gameState.floorRun.rewardClaimed) {
      const reward = giveFloorReward(floor);
      rewardText = reward.fullText;
      trackFloorCleared(floor);

      if (isTierBossFloor(floor)) {
        trackDungeonCompleted();
      }

      gameState.floorRun.rewardClaimed = true;
    } else {
      rewardText = `Награда за этаж ${floor} уже получена.`;
    }

    void saveGameAsync();

    if (isTierBossFloor(floor)) {
      this.showTierCompleted(rewardText);
      return;
    }

    this.showFloorResultScreen({
      title: 'ЭТАЖ ЗАЧИЩЕН',
      subtitle: `Этаж ${floor} полностью пройден`,
      accent: 0x75d184,
      rewardText: `${rewardText}\n${createFloorMaterialsText()}`,
      nextFloor,
      primaryText: 'Продолжить ниже',
      primaryAction: () => {
        startFloorRun(nextFloor);
        clearRoomRegenerationBlock();
        void saveGameAsync();
        this.scene.restart();
      },
      secondaryAction: () => {
        this.showExitToTownConfirm();
      },
    });
  }


  private getRunLootSummary() {
    type RunWithItems = typeof gameState.floorRun & {
      itemsEarned?: number;
    };

    const run = gameState.floorRun as RunWithItems;
    const gold = Math.max(0, Math.floor(run.goldEarned ?? 0));
    const itemCount = Math.max(0, Math.floor(run.itemsEarned ?? 0));
    const materialEntries = Object.entries(run.materialsEarned ?? {})
      .map(([id, amount]) => ({
        id: id as MaterialId,
        amount: Math.max(0, Math.floor(Number(amount) || 0)),
      }))
      .filter(material => material.amount > 0)
      .sort((left, right) => right.amount - left.amount);

    const materialCount = materialEntries.reduce((sum, material) => sum + material.amount, 0);
    const hasLoot = gold > 0 || itemCount > 0 || materialCount > 0;

    const lines: string[] = [];

    if (gold > 0) {
      lines.push(`Золото: +${gold}`);
    }

    if (itemCount > 0) {
      lines.push(`Предметы: ${itemCount} шт.`);
    }

    if (materialCount > 0) {
      lines.push(`Материалы: ${materialCount} шт.`);
    }

    const materialDetails = materialEntries
      .slice(0, 4)
      .map(material => `+${material.amount} ${getMaterialName(material.id)}`)
      .join('\n');

    const hiddenMaterialsCount = Math.max(0, materialEntries.length - 4);
    const hiddenMaterialsText = hiddenMaterialsCount > 0
      ? `\nи ещё ${hiddenMaterialsCount} вида материалов`
      : '';

    return {
      hasLoot,
      lines,
      materialDetails: `${materialDetails}${hiddenMaterialsText}`.trim(),
    };
  }

  private createExitLootCard(config: {
    centerX: number;
    top: number;
    width: number;
    loot: ReturnType<DungeonScene['getRunLootSummary']>;
    depth: number;
  }) {
    const cardHeight = config.loot.materialDetails ? 136 : 104;
    const left = config.centerX - config.width / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0b09, 0.96);
    bg.fillRoundedRect(left, config.top, config.width, cardHeight, 20);
    bg.lineStyle(2, UI.colors.goldDark, 0.68);
    bg.strokeRoundedRect(left, config.top, config.width, cardHeight, 20);
    bg.setDepth(config.depth);

    const title = this.add.text(config.centerX, config.top + 25, 'ДОБЫЧА ЗАБЕГА', {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: config.width - 34,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(config.depth + 1);

    const lootLine = this.add.text(config.centerX, config.top + 58, config.loot.lines.join('  •  '), {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: config.width - 34,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(config.depth + 1);

    const objects: Phaser.GameObjects.GameObject[] = [bg, title, lootLine];

    if (config.loot.materialDetails) {
      const materialsText = this.add.text(config.centerX, config.top + 101, config.loot.materialDetails, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: UI.colors.textMuted,
        align: 'center',
        lineSpacing: 2,
        wordWrap: {
          width: config.width - 42,
          useAdvancedWrap: true,
        },
        maxLines: 3,
      }).setOrigin(0.5).setDepth(config.depth + 1);

      objects.push(materialsText);
    }

    return {
      height: cardHeight,
      objects,
    };
  }


  private showExitToTownConfirm() {
    const { width, height } = this.scale;
    const layout = this.getLayout();
    const loot = this.getRunLootSummary();

    const modalObjects: Phaser.GameObjects.GameObject[] = [];
    const modalWidth = Math.min(width - layout.safeX * 2, 600);
    const modalHeight = Math.min(
      height - layout.safeTop - layout.safeBottom - 74,
      loot.hasLoot ? 454 : 312
    );
    const centerX = width / 2;
    const centerY = height / 2;

    const overlay = this.add.rectangle(
      centerX,
      centerY,
      width,
      height,
      0x000000,
      0.78
    )
      .setDepth(200)
      .setInteractive();

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.42);
    shadow.fillRoundedRect(
      centerX - modalWidth / 2,
      centerY - modalHeight / 2 + 8,
      modalWidth,
      modalHeight,
      30
    );
    shadow.setDepth(201);

    const panel = this.add.graphics();
    panel.fillStyle(0x14100d, 0.985);
    panel.fillRoundedRect(
      centerX - modalWidth / 2,
      centerY - modalHeight / 2,
      modalWidth,
      modalHeight,
      30
    );
    panel.lineStyle(3, UI.colors.goldDark, 0.85);
    panel.strokeRoundedRect(
      centerX - modalWidth / 2,
      centerY - modalHeight / 2,
      modalWidth,
      modalHeight,
      30
    );
    panel.lineStyle(1, 0x6b5a3c, 0.34);
    panel.strokeRoundedRect(
      centerX - modalWidth / 2 + 10,
      centerY - modalHeight / 2 + 10,
      modalWidth - 20,
      modalHeight - 20,
      22
    );
    panel.setDepth(202);

    const glow = this.add.circle(centerX, centerY - modalHeight / 2 + 62, 90, 0xf0a040, 0.07)
      .setDepth(203);

    const title = this.add.text(centerX, centerY - modalHeight / 2 + 56, 'Выйти в город?', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '27px' : '31px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: modalWidth - 60,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(204);

    const mainTextY = centerY - modalHeight / 2 + (loot.hasLoot ? 102 : 138);
    const text = this.add.text(
      centerX,
      mainTextY,
      'Ты покинешь подземелье и вернёшься в город.\nТекущий забег будет завершён.',
      {
        fontFamily: UI.font.body,
        fontSize: layout.compact ? '16px' : '18px',
        color: UI.colors.text,
        align: 'center',
        lineSpacing: 6,
        wordWrap: {
          width: modalWidth - 82,
          useAdvancedWrap: true,
        },
        maxLines: 4,
      }
    ).setOrigin(0.5).setDepth(204);

    modalObjects.push(overlay, shadow, panel, glow, title, text);

    if (loot.hasLoot) {
      const lootCard = this.createExitLootCard({
        centerX,
        top: centerY - modalHeight / 2 + 156,
        width: modalWidth - 58,
        loot,
        depth: 204,
      });

      modalObjects.push(...lootCard.objects);
    }

    const closeModal = () => {
      modalObjects.forEach(object => {
        object.destroy();
      });

      modalObjects.length = 0;
    };

    const buttonWidth = Math.min((modalWidth - 84) / 2, 230);
    const buttonY = centerY + modalHeight / 2 - 48;

    const cancelButton = this.createRoundedActionButton({
      x: centerX - buttonWidth / 2 - 12,
      y: buttonY,
      width: buttonWidth,
      height: 54,
      text: 'Отмена',
      onClick: () => {
        closeModal();

        // После отмены заново собираем сцену, чтобы не оставлять невидимые
        // интерактивные объекты модального окна поверх кнопки выхода.
        this.scene.restart();
      },
      variant: 'brown',
      depth: 204,
    });

    const confirmButton = this.createRoundedActionButton({
      x: centerX + buttonWidth / 2 + 12,
      y: buttonY,
      width: buttonWidth,
      height: 54,
      text: 'Да, выйти',
      onClick: () => {
        closeModal();

        this.exitToTownKeepingCampfireCheckpoint();
      },
      variant: 'green',
      depth: 204,
    });

    modalObjects.push(
      cancelButton.shadow,
      cancelButton.bg,
      cancelButton.label,
      confirmButton.shadow,
      confirmButton.bg,
      confirmButton.label
    );
  }


  private showFloorResultScreen(config: {
    title: string;
    subtitle: string;
    accent: number;
    rewardText: string;
    nextFloor: number;
    primaryText: string;
    primaryAction: () => void;
    secondaryAction: () => void;
    relic?: {
      name: string;
      description: string;
      bonus: string;
    };
  }) {
    const layout = this.getLayout();
    const { width, height } = this.scale;
    const centerX = width / 2;

    const overlayDepth = 180;
    const safeX = layout.safeX;
    const top = layout.safeTop + 10;
    const bottom = height - layout.safeBottom - 10;
    const panelWidth = Math.min(width - safeX * 2, 650);
    const headerHeight = layout.veryCompact ? 118 : 136;
    const footerHeight = layout.veryCompact ? 144 : 158;
    const panelHeight = bottom - top;
    const panelY = top + panelHeight / 2;

    this.add.rectangle(centerX, height / 2, width, height, 0x000000, 0.82)
      .setDepth(overlayDepth)
      .setInteractive();

    const backGlow = this.add.circle(centerX, top + 118, panelWidth * 0.42, config.accent, 0.055)
      .setDepth(overlayDepth + 1);

    this.tweens.add({
      targets: backGlow,
      alpha: { from: 0.03, to: 0.09 },
      scale: { from: 0.96, to: 1.04 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.createResultStonePanel({
      x: centerX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius: 34,
      stroke: config.accent,
      depth: overlayDepth + 2,
    });

    this.add.text(centerX, top + 34, '✦', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '20px' : '24px',
      color: '#d6bf82',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(overlayDepth + 5);

    this.add.text(centerX, top + (layout.veryCompact ? 63 : 70), config.title, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '29px' : '34px',
      color: this.toHexColor(config.accent),
      stroke: '#000000',
      strokeThickness: 7,
      align: 'center',
      wordWrap: {
        width: panelWidth - 46,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(overlayDepth + 5);

    this.add.text(centerX, top + (layout.veryCompact ? 99 : 112), config.subtitle, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '16px' : '18px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: panelWidth - 54,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(overlayDepth + 5);

    this.add.rectangle(centerX, top + headerHeight - 10, panelWidth - 54, 1, config.accent, 0.28)
      .setDepth(overlayDepth + 5);

    const scrollTop = top + headerHeight;
    const scrollBottom = bottom - footerHeight;
    const scrollHeight = Math.max(120, scrollBottom - scrollTop);
    const scrollMask = this.add.graphics().setVisible(false);
    scrollMask.fillStyle(0xffffff);
    scrollMask.fillRect(
      centerX - panelWidth / 2 + 18,
      scrollTop,
      panelWidth - 36,
      scrollHeight
    );

    const geometryMask = scrollMask.createGeometryMask();
    const content = this.add.container(0, scrollTop)
      .setDepth(overlayDepth + 6)
      .setMask(geometryMask);

    let y = 0;
    y = this.addResultRewardCard(content, centerX, y, panelWidth - 54, config.rewardText, config.accent);

    if (config.relic) {
      y += layout.veryCompact ? 10 : 14;
      y = this.addResultRelicCard(content, centerX, y, panelWidth - 54, config.relic);
    }

    y += layout.veryCompact ? 10 : 14;
    y = this.addResultJournalAndNextFloor(content, centerX, y, panelWidth - 54, config.nextFloor);

    y += 24;

    const maxScroll = Math.max(0, y - scrollHeight + 12);
    let scrollY = 0;
    let dragStartY = 0;
    let dragStartScrollY = 0;

    const applyScroll = () => {
      scrollY = Phaser.Math.Clamp(scrollY, -maxScroll, 0);
      content.y = scrollTop + scrollY;
    };

    const scrollHit = this.add.rectangle(centerX, scrollTop + scrollHeight / 2, panelWidth - 34, scrollHeight, 0xffffff, 0.001)
      .setDepth(overlayDepth + 20)
      .setInteractive({ useHandCursor: false });

    scrollHit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      dragStartY = pointer.y;
      dragStartScrollY = scrollY;
    });

    scrollHit.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || maxScroll <= 0) {
        return;
      }

      scrollY = dragStartScrollY + (pointer.y - dragStartY);
      applyScroll();
    });

    scrollHit.on('wheel', (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => {
      if (maxScroll <= 0) {
        return;
      }

      scrollY -= dy * 0.55;
      applyScroll();
    });

    if (maxScroll > 0) {
      this.add.text(centerX, scrollBottom + 10, 'Потяни список, чтобы посмотреть все награды', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '12px' : '13px',
        color: '#7f765f',
        align: 'center',
      }).setOrigin(0.5).setDepth(overlayDepth + 8);
    }

    const buttonWidth = Math.min(panelWidth - 88, 470);
    const primaryY = bottom - (layout.veryCompact ? 92 : 102);
    const secondaryY = bottom - (layout.veryCompact ? 32 : 36);

    this.createRoundedActionButton({
      x: centerX,
      y: primaryY,
      width: buttonWidth,
      height: layout.veryCompact ? 54 : 58,
      text: config.primaryText,
      variant: 'green',
      depth: overlayDepth + 30,
      onClick: config.primaryAction,
    });

    this.createRoundedActionButton({
      x: centerX,
      y: secondaryY,
      width: buttonWidth,
      height: layout.veryCompact ? 50 : 54,
      text: 'Вернуться в город',
      variant: 'brown',
      depth: overlayDepth + 30,
      onClick: config.secondaryAction,
    });
  }

  private createResultStonePanel(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    stroke: number;
    depth: number;
  }) {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 10,
      config.width,
      config.height,
      config.radius
    );
    shadow.setDepth(config.depth);

    const panel = this.add.graphics();
    panel.fillGradientStyle(0x0d0b09, 0x0d0b09, 0x050505, 0x050505, 0.99, 0.99, 0.99, 0.99);
    panel.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      config.radius
    );
    panel.lineStyle(3, config.stroke, 0.76);
    panel.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      config.radius
    );
    panel.lineStyle(1, 0x6b5a3c, 0.28);
    panel.strokeRoundedRect(
      config.x - config.width / 2 + 10,
      config.y - config.height / 2 + 10,
      config.width - 20,
      config.height - 20,
      Math.max(12, config.radius - 9)
    );
    panel.setDepth(config.depth + 1);
  }

  private addResultRewardCard(
    container: Phaser.GameObjects.Container,
    centerX: number,
    y: number,
    width: number,
    rewardText: string,
    accent: number
  ) {
    const lines = rewardText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const normalizedLines = lines.length > 0 ? lines : ['Награда уже получена'];
    const contentWidth = width - 42;
    const titleHeight = 44;
    const lineGap = 30;
    const cardHeight = Phaser.Math.Clamp(titleHeight + normalizedLines.length * lineGap + 30, 132, 284);
    const top = y;

    const bg = this.add.graphics();
    bg.fillStyle(0x18110d, 0.97);
    bg.fillRoundedRect(centerX - width / 2, top, width, cardHeight, 24);
    bg.lineStyle(2, UI.colors.gold, 0.72);
    bg.strokeRoundedRect(centerX - width / 2, top, width, cardHeight, 24);
    container.add(bg);

    const title = this.add.text(centerX, top + 28, 'ПОЛУЧЕННЫЕ НАГРАДЫ', {
      fontFamily: UI.font.title,
      fontSize: '20px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: { width: contentWidth },
      maxLines: 1,
    }).setOrigin(0.5);
    container.add(title);

    const line = this.add.rectangle(centerX, top + 54, width - 70, 1, accent, 0.24);
    container.add(line);

    normalizedLines.forEach((text, index) => {
      const lineY = top + 78 + index * lineGap;
      const color = this.getRewardLineColor(text);
      const icon = this.getRewardLineIcon(text);

      const iconText = this.add.text(centerX - width / 2 + 34, lineY, icon, {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);

      const rewardLine = this.add.text(centerX - width / 2 + 62, lineY, text, {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: width - 96,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }).setOrigin(0, 0.5);

      container.add([iconText, rewardLine]);
    });

    return top + cardHeight;
  }

  private addResultRelicCard(
    container: Phaser.GameObjects.Container,
    centerX: number,
    y: number,
    width: number,
    relic: {
      name: string;
      description: string;
      bonus: string;
    }
  ) {
    const cardHeight = 166;
    const top = y;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x171018, 0x171018, 0x0d0912, 0x0d0912, 0.98, 0.98, 0.98, 0.98);
    bg.fillRoundedRect(centerX - width / 2, top, width, cardHeight, 24);
    bg.lineStyle(2, 0x8f6bd8, 0.78);
    bg.strokeRoundedRect(centerX - width / 2, top, width, cardHeight, 24);
    container.add(bg);

    const title = this.add.text(centerX, top + 28, 'РЕЛИКВИЯ ЯРУСА', {
      fontFamily: UI.font.title,
      fontSize: '18px',
      color: '#c8a0ff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: { width: width - 44 },
      maxLines: 1,
    }).setOrigin(0.5);

    const name = this.add.text(centerX, top + 61, relic.name, {
      fontFamily: UI.font.title,
      fontSize: '19px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: width - 44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5);

    const description = this.add.text(centerX, top + 98, relic.description, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: width - 54,
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 3,
    }).setOrigin(0.5);

    const bonus = this.add.text(centerX, top + 139, `Бонус: ${relic.bonus}`, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: width - 54,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5);

    container.add([title, name, description, bonus]);

    return top + cardHeight;
  }

  private addResultJournalAndNextFloor(
    container: Phaser.GameObjects.Container,
    centerX: number,
    y: number,
    width: number,
    nextFloor: number
  ) {
    const stats = getPlayerStats(player);
    const requirement = getFloorRequirement(nextFloor);
    const nextTier = getCurrentTierByFloor(nextFloor);
    const isDangerous = player.level < requirement.level;
    const gap = 12;
    const cardWidth = (width - gap) / 2;
    const cardHeight = 176;
    const leftX = centerX - width / 2 + cardWidth / 2;
    const rightX = centerX + width / 2 - cardWidth / 2;

    this.addResultInfoCard(container, {
      x: leftX,
      y,
      width: cardWidth,
      height: cardHeight,
      title: 'ЖУРНАЛ',
      titleColor: UI.colors.goldText,
      lines: [
        `Монстры: ${gameState.floorRun.monstersDefeated}`,
        `Сундуки: ${gameState.floorRun.chestsOpened}`,
        `Ловушки: ${gameState.floorRun.trapsTriggered}`,
        `Золото: +${gameState.floorRun.goldEarned}`,
        `Опыт: +${gameState.floorRun.expEarned}`,
        `Материалы: ${createFloorMaterialsShortText()}`,
      ],
    });

    this.addResultInfoCard(container, {
      x: rightX,
      y,
      width: cardWidth,
      height: cardHeight,
      title: `ЭТАЖ ${nextFloor}`,
      titleColor: isDangerous ? UI.colors.red : UI.colors.green,
      lines: [
        `Ярус: ${nextTier}`,
        `Уровень: ${player.level} / ${requirement.level}`,
        `Атака: ${stats.attack} / ${requirement.attack}`,
        `Защита: ${stats.defense} / ${requirement.defense}`,
        `HP: ${player.hp} / ${stats.maxHp}`,
        isDangerous ? 'Опасно' : 'Можно идти',
      ],
      dangerLastLine: isDangerous,
    });

    return y + cardHeight;
  }

  private addResultInfoCard(
    container: Phaser.GameObjects.Container,
    config: {
      x: number;
      y: number;
      width: number;
      height: number;
      title: string;
      titleColor: string | number;
      lines: string[];
      dangerLastLine?: boolean;
    }
  ) {
    const bg = this.add.graphics();
    bg.fillStyle(0x0d0c0b, 0.94);
    bg.fillRoundedRect(config.x - config.width / 2, config.y, config.width, config.height, 20);
    bg.lineStyle(1, 0x6b5a3c, 0.48);
    bg.strokeRoundedRect(config.x - config.width / 2, config.y, config.width, config.height, 20);
    container.add(bg);

    const title = this.add.text(config.x, config.y + 24, config.title, {
      fontFamily: UI.font.title,
      fontSize: '16px',
      color: typeof config.titleColor === 'number' ? this.toHexColor(config.titleColor) : config.titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: config.width - 18,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5);
    container.add(title);

    config.lines.forEach((line, index) => {
      const isLast = index === config.lines.length - 1;
      const text = this.add.text(config.x, config.y + 53 + index * 19, line, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: config.dangerLastLine && isLast ? UI.colors.red : UI.colors.textMuted,
        align: 'center',
        wordWrap: {
          width: config.width - 20,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5);
      container.add(text);
    });
  }

  private toHexColor(color: number) {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  private getRewardLineIcon(line: string) {
   const lower = line.toLowerCase();

   if (lower.includes('золото')) {
     return '◆';
   }

   if (lower.includes('опыт')) {
     return '✦';
   }

   if (lower.includes('предмет') || lower.includes('найден')) {
     return '▣';
   }
   if (
      lower.includes('материалы') ||
      lower.includes('кость') ||
      lower.includes('самоцвет') ||
      lower.includes('кожа') ||
      lower.includes('печать') ||
      lower.includes('пламени') ||
      lower.includes('саркофага')
    ) {
      return '◇';
    }

   if (lower.includes('награда')) {
     return '★';
   }

   return '•';
  }

  private showTierGateCompleted() {
    const targetTier = gameState.floorRun.targetTier;
    const startFloor = (targetTier - 1) * 25 + 1;

    const { width } = this.scale;

    this.add.rectangle(width / 2, 555, 620, 430, 0x0d0d0d, 0.96)
      .setStrokeStyle(3, 0xf0d58a);

    this.add.text(width / 2, 390, 'Путь открыт', {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      500,
      `Ты снова победил финального босса прошлого яруса.\nТеперь можно начать ${targetTier}-й ярус с ${startFloor} этажа.`,
      {
        fontFamily: 'Arial',
        fontSize: '23px',
        color: '#d8c7a3',
        align: 'center',
        wordWrap: {
          width: 560,
        },
        lineSpacing: 8,
      }
    ).setOrigin(0.5);

    this.createRoundedActionButton({
      x: width / 2,
      y: 650,
      width: 450,
      height: 56,
      text: `Начать ${targetTier}-й ярус`,
      variant: 'green',
      onClick: () => {
        startFloorRun(startFloor);
      
        void saveGameAsync();
      
        this.scene.restart();
      },
    });

    this.createRoundedActionButton({
      x: width / 2,
      y: 715,
      width: 450,
      height: 56,
      text: 'Вернуться в город',
      variant: 'brown',
      onClick: () => {
        this.exitToTownKeepingCampfireCheckpoint();
      },
    });
  }


  private showTierCompleted(rewardText: string) {
    const floor = gameState.floorRun.currentFloor;
    const tier = getCurrentTierByFloor(floor);
    const nextFloor = floor + 1;

    const relic = giveRelicForTier(tier);

    if (relic) {
      trackRelicCollected();
    }

    void saveGameAsync();

    this.showFloorResultScreen({
      title: `ЯРУС ${tier} ПРОЙДЕН`,
      subtitle: `Финальный босс ${tier}-го яруса повержен`,
      accent: UI.colors.gold,
      rewardText: `${rewardText}\n${createFloorMaterialsText()}`,
      relic: relic
        ? {
            name: relic.name,
            description: relic.description,
            bonus: createRelicBonusText(relic),
          }
        : undefined,
      nextFloor,
      primaryText: 'Продолжить на новый ярус',
      primaryAction: () => {
        startFloorRun(nextFloor);
        clearRoomRegenerationBlock();

        void saveGameAsync();

        this.scene.restart();
      },
      secondaryAction: () => {
        this.exitToTownKeepingCampfireCheckpoint();
      },
    });
  }

  private showMessage(title: string, message: string, onContinue?: () => void) {
  const { width, height } = this.scale;

  this.modalObjects.forEach(object => {
    object.destroy();
  });

  this.modalObjects = [];

  const modalWidth = Math.min(width - 48, 620);
  const modalHeight = Math.min(height - 140, 460);
  const centerX = width / 2;
  const centerY = height / 2;

  const overlay = this.add.rectangle(
    centerX,
    centerY,
    width,
    height,
    0x000000,
    0.72
  ).setDepth(100).setInteractive();

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.38);
  shadow.fillRoundedRect(
    centerX - modalWidth / 2,
    centerY - modalHeight / 2 + 8,
    modalWidth,
    modalHeight,
    26
  );
  shadow.setDepth(101);

  const panel = this.add.graphics();
  panel.fillStyle(0x17100c, 0.98);
  panel.fillRoundedRect(
    centerX - modalWidth / 2,
    centerY - modalHeight / 2,
    modalWidth,
    modalHeight,
    26
  );
  panel.lineStyle(3, UI.colors.goldDark, 0.9);
  panel.strokeRoundedRect(
    centerX - modalWidth / 2,
    centerY - modalHeight / 2,
    modalWidth,
    modalHeight,
    26
  );
  panel.setDepth(102);

  const titleText = this.add.text(
    centerX,
    centerY - modalHeight / 2 + 42,
    title,
    {
      fontFamily: UI.font.title,
      fontSize: '29px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: modalWidth - 70,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }
  ).setOrigin(0.5).setDepth(103);

  const divider = this.add.rectangle(
    centerX,
    centerY - modalHeight / 2 + 78,
    modalWidth - 90,
    2,
    UI.colors.gold,
    0.25
  ).setDepth(103);

  const messageText = this.add.text(
    centerX,
    centerY - modalHeight / 2 + 100,
    message,
    {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 7,
      wordWrap: {
        width: modalWidth - 82,
        useAdvancedWrap: true,
      },
      maxLines: 9,
    }
  ).setOrigin(0.5, 0).setDepth(103);

  const button = createButton(
    this,
    centerX,
    centerY + modalHeight / 2 - 48,
    'Продолжить',
    () => {
      this.modalObjects.forEach(object => {
        object.destroy();
      });

      this.modalObjects = [];

      if (onContinue) {
        onContinue();
      }
    },
    Math.min(300, modalWidth - 120),
    56
  );

  button.shadow.setDepth(102);
  button.bg.setDepth(103);
  button.label.setDepth(104);

  this.modalObjects.push(
    overlay,
    shadow,
    panel,
    titleText,
    divider,
    messageText,
    button.shadow,
    button.bg,
    button.label
  );
}

  private getCampfireState(): CampfireState {
    const stateOwner = gameState as typeof gameState & {
      dungeonCampfireState?: CampfireState;
    };

    if (!stateOwner.dungeonCampfireState) {
      this.ensureCampfireState();
    }

    return stateOwner.dungeonCampfireState as CampfireState;
  }

  private ensureCampfireState() {
    const floor = gameState.floorRun.currentFloor || 1;
    const tier = getCurrentTierByFloor(floor);
    const stateOwner = gameState as typeof gameState & {
      dungeonCampfireState?: CampfireState;
    };

    if (stateOwner.dungeonCampfireState?.tier === tier) {
      return;
    }

    stateOwner.dungeonCampfireState = {
      tier,
      selectedFlint: null,
      remainingCampfireUses: 0,
      campfireFloors: this.createCampfireFloorsForTier(tier),
      usedCampfireFloors: [],
      selectionDone: false,
    };
  }

  private resetCampfireState(clearCheckpoint = true) {
    const stateOwner = gameState as typeof gameState & {
      dungeonCampfireState?: CampfireState;
    };

    stateOwner.dungeonCampfireState = undefined;

    if (clearCheckpoint) {
      clearCampfireBattleCheckpoint();
    }
  }

  private createCampfireFloorsForTier(tier: number) {
    const tierStart = (tier - 1) * 25;

    return [
      tierStart + Phaser.Math.Between(3, 11),
      tierStart + Phaser.Math.Between(12, 18),
      tierStart + Phaser.Math.Between(19, 24),
    ];
  }

  private injectCampfireRoomIfNeeded() {
    const campfireState = this.getCampfireState();
    const floor = gameState.floorRun.currentFloor || 1;

    if (!campfireState.campfireFloors.includes(floor)) {
      return;
    }

    if (campfireState.usedCampfireFloors.includes(floor)) {
      return;
    }

    const rooms = gameState.floorRun.rooms as Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      enemyId?: string;
      completed: boolean;
    }>;

    if (rooms.some(room => room.type === 'campfire')) {
      return;
    }

    const maxInsertIndex = Math.max(1, rooms.length - 1);
    const insertIndex = Phaser.Math.Clamp(
      Phaser.Math.Between(1, maxInsertIndex),
      1,
      maxInsertIndex
    );

    rooms.splice(insertIndex, 0, {
      id: `floor_${floor}_campfire`,
      type: 'campfire',
      title: 'Забытый костёр',
      description: 'В нише мерцают старые угли. Если у тебя есть заряд огнива, можно восстановить запас зелий.',
      completed: false,
    });
  }

  private showFlintSelectionModal() {
    const campfireState = this.getCampfireState();

    if (campfireState.selectionDone) {
      return;
    }

    const { width, height } = this.scale;

    this.modalObjects.forEach(object => object.destroy());
    this.modalObjects = [];

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.76)
      .setDepth(200)
      .setInteractive();

    const panel = this.createRoundedPanel({
      x: width / 2,
      y: height / 2,
      width: Math.min(width - 42, 640),
      height: 710,
      radius: 34,
      color: 0x14100d,
      alpha: 0.985,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.92,
      strokeWidth: 3,
      depth: 201,
    });

    const title = this.add.text(width / 2, height / 2 - 305, 'Выбор огнива', {
      fontFamily: UI.font.title,
      fontSize: '34px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: Math.min(width - 90, 560),
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(204);

    const subtitle = this.add.text(
      width / 2,
      height / 2 - 252,
      'Огниво выбирается в начале яруса. Один заряд активирует костёр, восстанавливает силы и создаёт чекпоинт: обычное — 1 час, редкое — сутки, донатное — навсегда.',
      {
        fontFamily: UI.font.body,
        fontSize: '16px',
        color: UI.colors.text,
        align: 'center',
        lineSpacing: 5,
        wordWrap: {
          width: Math.min(width - 90, 550),
        },
        maxLines: 4,
      }
    ).setOrigin(0.5).setDepth(204);

    const dimCard = this.createFlintCard({
      x: width / 2,
      y: height / 2 - 145,
      type: 'dim',
      title: 'Тусклое огниво',
      description: 'Обычное огниво. 1 костёр в ярусе. Чекпоинт действует 1 час.',
      accentColor: 0xd8c7a3,
    });

    const blackCard = this.createFlintCard({
      x: width / 2,
      y: height / 2 + 15,
      type: 'black',
      title: 'Чёрное огниво',
      description: 'Редкое огниво. 2 костра в ярусе. Чекпоинт действует сутки.',
      accentColor: 0x70a6ff,
    });

    const rubyCard = this.createFlintCard({
      x: width / 2,
      y: height / 2 + 175,
      type: 'ruby',
      title: 'Огниво с красным рубином',
      description: 'Донатное огниво. 3 костра в ярусе. Чекпоинт действует всегда.',
      accentColor: 0xff6b6b,
    });

    const noFlintButton = this.createSimpleModalButton({
      x: width / 2,
      y: height / 2 + 312,
      width: 430,
      height: 50,
      text: 'Идти без огнива',
      accentColor: UI.colors.goldDark,
      onClick: () => {
        this.selectFlint('none');
      },
      depth: 204,
    });

    this.modalObjects.push(
      overlay,
      panel.shadow,
      panel.panel,
      title,
      subtitle,
      ...dimCard,
      ...blackCard,
      ...rubyCard,
      ...noFlintButton
    );
  }

  private createFlintCard(config: {
    x: number;
    y: number;
    type: FlintType;
    title: string;
    description: string;
    accentColor: number;
  }) {
    const { width } = this.scale;
    const cardWidth = Math.min(width - 86, 560);
    const cardHeight = 136;
    const left = config.x - cardWidth / 2;
    const canSelect = this.canSelectFlint(config.type);
    const uses = this.getFlintMaxUses(config.type);
    const costText = this.getFlintCostText(config.type);

    const panel = this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: cardWidth,
      height: cardHeight,
      radius: 24,
      color: canSelect ? 0x17100c : 0x0d0d0d,
      alpha: canSelect ? 0.97 : 0.72,
      strokeColor: config.accentColor,
      strokeAlpha: canSelect ? 0.72 : 0.28,
      strokeWidth: 2,
      depth: 204,
    });

    const icon = this.add.circle(left + 42, config.y - 28, 28, config.accentColor, 0.16)
      .setStrokeStyle(2, config.accentColor, canSelect ? 0.72 : 0.3)
      .setDepth(207);

    const iconText = this.add.text(left + 42, config.y - 28, this.getFlintIcon(config.type), {
      fontFamily: UI.font.body,
      fontSize: '22px',
      color: canSelect ? UI.colors.goldText : UI.colors.textMuted,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(208);

    const title = this.add.text(left + 84, config.y - 50, config.title, {
      fontFamily: UI.font.title,
      fontSize: '19px',
      color: canSelect ? UI.colors.goldText : UI.colors.textMuted,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: cardWidth - 220,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(208);

    const desc = this.add.text(left + 84, config.y - 12, config.description, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.text,
      wordWrap: {
        width: cardWidth - 220,
      },
      maxLines: 2,
      lineSpacing: 3,
    }).setOrigin(0, 0.5).setDepth(208);

    const cost = this.add.text(left + 84, config.y + 38, costText, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: canSelect ? UI.colors.textMuted : UI.colors.red,
      wordWrap: {
        width: cardWidth - 220,
      },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0, 0.5).setDepth(208);

    const button = this.createSimpleModalButton({
      x: config.x + cardWidth / 2 - 72,
      y: config.y + 22,
      width: 116,
      height: 44,
      text: canSelect ? `Взять x${uses}` : 'Нет',
      accentColor: config.accentColor,
      disabled: !canSelect,
      onClick: () => {
        this.selectFlint(config.type);
      },
      depth: 208,
      small: true,
    });

    return [
      panel.shadow,
      panel.panel,
      icon,
      iconText,
      title,
      desc,
      cost,
      ...button,
    ];
  }

  private createSimpleModalButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    accentColor: number;
    onClick: () => void;
    disabled?: boolean;
    depth?: number;
    small?: boolean;
  }) {
    const disabled = config.disabled ?? false;
    const depth = config.depth ?? 205;
    const radius = Math.min(18, config.height / 2);
    const fillColor = disabled ? 0x111111 : 0x21150f;
    const hoverColor = disabled ? fillColor : 0x2c1d14;
    const textColor = disabled ? '#555555' : UI.colors.goldText;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(config.x - config.width / 2, config.y - config.height / 2 + 4, config.width, config.height, radius);
    shadow.setDepth(depth);

    const bg = this.add.graphics();
    bg.fillStyle(fillColor, disabled ? 0.55 : 0.96);
    bg.fillRoundedRect(config.x - config.width / 2, config.y - config.height / 2, config.width, config.height, radius);
    bg.lineStyle(2, config.accentColor, disabled ? 0.32 : 0.86);
    bg.strokeRoundedRect(config.x - config.width / 2, config.y - config.height / 2, config.width, config.height, radius);
    bg.setDepth(depth + 1);

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: config.small ? '12px' : '16px',
      color: textColor,
      align: 'center',
      wordWrap: {
        width: config.width - 14,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(depth + 2);

    if (!disabled) {
      let isPressed = false;

      bg.setInteractive(
        new Phaser.Geom.Rectangle(config.x - config.width / 2, config.y - config.height / 2, config.width, config.height),
        Phaser.Geom.Rectangle.Contains
      );

      const redraw = (color: number, alpha: number, offsetY = 0) => {
        bg.clear();
        bg.fillStyle(color, alpha);
        bg.fillRoundedRect(config.x - config.width / 2, config.y - config.height / 2, config.width, config.height, radius);
        bg.lineStyle(2, config.accentColor, 0.95);
        bg.strokeRoundedRect(config.x - config.width / 2, config.y - config.height / 2, config.width, config.height, radius);
        label.setY(config.y + offsetY);
      };

      bg.on('pointerover', () => {
        if (!isPressed) redraw(hoverColor, 1);
      });

      bg.on('pointerout', () => {
        isPressed = false;
        redraw(fillColor, 0.96);
      });

      bg.on('pointerdown', () => {
        isPressed = true;
        redraw(hoverColor, 0.9, 1);
      });

      bg.on('pointerup', () => {
        if (!isPressed) return;
        isPressed = false;
        redraw(hoverColor, 1);
        this.time.delayedCall(40, config.onClick);
      });
    }

    return [shadow, bg, label];
  }

  private canSelectFlint(type: FlintType) {
    if (type === 'none') {
      return true;
    }

    if (type === 'ruby') {
      return this.hasRubyFlintUnlocked();
    }

    return this.hasMaterials(this.getFlintCost(type));
  }

  private selectFlint(type: FlintType) {
    if (!this.canSelectFlint(type)) {
      return;
    }

    const campfireState = this.getCampfireState();

    if (type !== 'none' && type !== 'ruby') {
      this.spendMaterials(this.getFlintCost(type));
    }

    campfireState.selectedFlint = type;
    campfireState.remainingCampfireUses = this.getFlintMaxUses(type);
    campfireState.selectionDone = true;

    this.modalObjects.forEach(object => object.destroy());
    this.modalObjects = [];

    void saveGameAsync();

    this.showMessage(
      'Огниво выбрано',
      type === 'none'
        ? 'Ты идёшь без огнива. Найденные костры нельзя будет активировать.'
        : `${this.getFlintDisplayName(type)} взято в ярус.\nДоступно активаций костра: ${campfireState.remainingCampfireUses}.`,
      () => {
        this.scene.restart();
      }
    );
  }

  private getFlintMaxUses(type: FlintType) {
    if (type === 'dim') return 1;
    if (type === 'black') return 2;
    if (type === 'ruby') return 3;

    return 0;
  }

  private getFlintDisplayName(type: FlintType) {
    if (type === 'dim') return 'Тусклое огниво';
    if (type === 'black') return 'Чёрное огниво';
    if (type === 'ruby') return 'Огниво с красным рубином';

    return 'Без огнива';
  }

  private getFlintIcon(type: FlintType) {
    if (type === 'dim') return '◇';
    if (type === 'black') return '◆';
    if (type === 'ruby') return '✦';

    return '×';
  }

  private getFlintCost(type: FlintType): Array<{ id: MaterialId; amount: number }> {
    if (type === 'dim') {
      return [
        { id: 'darkened_bone', amount: 2 },
        { id: 'dim_gem', amount: 1 },
        { id: 'old_leather', amount: 1 },
      ];
    }

    if (type === 'black') {
      return [
        { id: 'darkened_bone', amount: 3 },
        { id: 'dim_gem', amount: 2 },
        { id: 'black_gem', amount: 1 },
        { id: 'cursed_seal', amount: 1 },
      ];
    }

    return [];
  }

  private getFlintCostText(type: FlintType) {
    if (type === 'ruby') {
      return this.hasRubyFlintUnlocked()
        ? 'Донатное огниво разблокировано'
        : 'Доступно после доната';
    }

    const cost = this.getFlintCost(type);

    if (cost.length === 0) {
      return 'Без стоимости';
    }

    return cost
      .map(material => `${getMaterialName(material.id)} x${material.amount}`)
      .join(' • ');
  }

  private hasRubyFlintUnlocked() {
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

  private getRoomIcon(type: string) {
    switch (type) {
      case 'monster':
        return '☠';
      case 'elite':
        return '◆';
      case 'chest':
        return '✦';
      case 'trap':
        return '!';
      case 'campfire':
        return '♨';
      case 'event':
        return '◈';
      case 'boss':
        return '♛';
      case 'tier_boss':
        return '♚';
      default:
        return '?';
    }
  }

  private getRoomInfo(type: string) {

    if (type === 'monster') {
      return 'Обычный бой. Победи врага, чтобы пройти дальше.';
    }

    if (type === 'elite') {
      return 'Усиленный враг. Награды выше, но бой опаснее.';
    }

    if (type === 'chest') {
      return 'Можно получить золото и материалы для улучшения оружия.';
    }

    if (type === 'trap') {
      return 'Ловкость может помочь избежать урона. Некоторые ловушки также отнимают энергию.';
    }

    if (type === 'campfire') {
      return `Костёр может восстановить запас зелий до ${this.maxPotionCount}. Для активации нужен заряд выбранного огнива.`;
    }

    if (type === 'event') {
      return 'Комната выбора. Можно рискнуть ради золота, опыта или материалов — либо уйти без последствий.';
    }

    if (type === 'boss') {
      return 'Босс этажа. После победы этаж будет зачищен.';
    }

    if (type === 'tier_boss') {
      return 'Финальный босс яруса. После победы откроется следующий ярус.';
    }

    return '';
  }

  private getModifierWarning() {
    const modifier = gameState.floorRun.modifier;

    if (modifier === 'elite') {
      return '\n\nОсобенность этажа: элитные враги сильнее.';
    }

    if (modifier === 'traps') {
      return '\n\nОсобенность этажа: ловушки наносят больше урона.';
    }

    if (modifier === 'treasure') {
      return '\n\nОсобенность этажа: сундуки ценнее.';
    }

    if (modifier === 'cursed') {
      return '\n\nОсобенность этажа: враги и ловушки опаснее, но награды выше.';
    }

    if (modifier === 'tier_boss') {
      return '\n\nОсобенность этажа: финальный бой яруса.';
    }

    return '';
  }

  private getRoomStrokeColor(type: string) {
    switch (type) {
      case 'chest':
        return UI.colors.gold;
      case 'trap':
        return 0xff6b6b;
      case 'campfire':
        return 0xf0a040;
      case 'event':
        return 0x9b7cff;
      case 'elite':
        return 0xb07cff;
      case 'boss':
      case 'tier_boss':
        return 0xff6b6b;
      default:
        return UI.colors.goldDark;
    }
  }
}