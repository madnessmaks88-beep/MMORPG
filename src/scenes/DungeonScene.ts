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
  UI,
  createSceneBackground,
} from '../ui/theme';

import {
  getPlayerStats,
} from '../systems/InventorySystem';

import { giveFloorReward } from '../systems/FloorRewardSystem';

import { claimChestReward } from '../systems/ChestRewardSystem';
import { saveGameAsync } from '../systems/SaveSystem';
import { getMaterialName, type MaterialId } from '../data/materials';


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

  private createHeader() {
    const { width } = this.scale;

    const floor = gameState.floorRun.currentFloor;
    const tier = getCurrentTierByFloor(floor);
    const modifierName = getFloorModifierName(gameState.floorRun.modifier);

    const theme = getCryptDepthTheme(floor);

    this.createRoundedPanel({
      x: width / 2,
      y: 82,
      width: 620,
      height: 92,
      radius: 28,
      color: 0x0d0a08,
      alpha: 0.92,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.45,
      depth: 2,
    });

    this.add.text(width / 2, 62, `Ярус ${tier}  •  Этаж ${floor}`, {
      fontFamily: UI.font.title,
      fontSize: '28px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(6);

    this.add.text(width / 2, 100, `${theme.name}  •  ${modifierName}`, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: theme.mutedText,
    }).setOrigin(0.5).setDepth(6);
  }

  private createDungeonBackdrop() {
    const { width, height } = this.scale;

    const floor = gameState.floorRun.currentFloor || 1;
    const theme = getCryptDepthTheme(floor);

    this.add.rectangle(width / 2, height / 2, width, height, theme.background, 0.55).setDepth(0);

    this.add.circle(width / 2, 120, 260, theme.glow, 0.075).setDepth(0);
    this.add.circle(width / 2, 120, 130, theme.accent, 0.035).setDepth(0);

    for (let i = 0; i < 14; i += 1) {
      const x = 45 + i * 52;
      const y = 165 + (i % 6) * 92;

      this.add.circle(x, y, 34 + (i % 4) * 8, theme.fog, 0.018).setDepth(0);
    }

    this.add.rectangle(width / 2, height - 180, width, 330, 0x020202, 0.36).setDepth(0);

    for (let i = 0; i < 34; i += 1) {
      const x = Phaser.Math.Between(35, width - 35);
      const y = Phaser.Math.Between(80, height - 170);
      const size = Phaser.Math.Between(1, 2);

      this.add.circle(x, y, size, theme.accent, 0.055).setDepth(1);
    }
  }

  private createNextFloorInfo(y: number, nextFloor: number, x = this.scale.width / 2) {
    const stats = getPlayerStats(player);
    const requirement = getFloorRequirement(nextFloor);

    const isDangerous =
      player.level < requirement.level ||
      stats.attack < requirement.attack ||
      stats.defense < requirement.defense ||
      stats.maxHp < requirement.hp;

    this.add.text(x, y - 70, `Следующий этаж: ${nextFloor}`, {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: isDangerous ? UI.colors.red : UI.colors.green,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const lines = [
      `Уровень: ${requirement.level} / ${player.level}`,
      `Атака: ${requirement.attack} / ${stats.attack}`,
      `Защита: ${requirement.defense} / ${stats.defense}`,
      `HP: ${requirement.hp} / ${stats.maxHp}`,
    ];

    lines.forEach((line, index) => {
      this.add.text(x, y - 30 + index * 25, line, {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: UI.colors.textMuted,
        align: 'center',
      }).setOrigin(0.5);
    });

    this.add.text(x, y + 88, isDangerous ? 'Опасно' : 'Можно продолжать', {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: isDangerous ? UI.colors.red : UI.colors.green,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
  }

  private createFloorProgress() {
    const { width } = this.scale;

    const floor = gameState.floorRun.currentFloor;

    const theme = getCryptDepthTheme(floor);

    this.createRoundedPanel({
      x: width / 2,
      y: 178,
      width: 620,
      height: 94,
      radius: 24,
      color: theme.panel,
      alpha: 0.86,
      strokeColor: theme.stroke,
      strokeAlpha: 0.3,
      depth: 2,
    });

    this.add.text(width / 2, 178, getFloorDescription(floor), {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: theme.mutedText,
      align: 'center',
      wordWrap: {
        width: 545,
      },
      lineSpacing: 2,
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
   const { width } = this.scale;

   const rooms = gameState.floorRun.rooms;
   const currentIndex = gameState.floorRun.currentRoomIndex;

   const y = 315;
   const gap = 88;
   const startX = width / 2 - ((rooms.length - 1) * gap) / 2;

   this.add.text(width / 2, y - 52, 'Маршрут этажа', {
     fontFamily: UI.font.title,
     fontSize: '21px',
     color: UI.colors.text,
     stroke: '#000000',
     strokeThickness: 4,
   }).setOrigin(0.5).setDepth(6);

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
         gap - 34,
         4,
         isCompleted ? 0x75d184 : 0x3a2518,
         isCompleted ? 0.42 : 0.6
       ).setDepth(4);
     }

     this.add.circle(x, y + 5, isCurrent ? 32 : 28, 0x000000, 0.34).setDepth(4);

     this.add.circle(x, y, isCurrent ? 31 : 27, fillColor, isLocked ? 0.55 : 0.98)
       .setStrokeStyle(isCurrent ? 3 : 2, strokeColor, isCurrent ? 0.95 : 0.58)
       .setDepth(5);

     this.add.text(x, y, this.getRoomIcon(room.type), {
       fontFamily: UI.font.body,
       fontSize: isCurrent ? '25px' : '21px',
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
    const { width } = this.scale;

    if (isCurrentFloorCompleted()) {
      this.showFloorCompleted();
      return;
    }

    const room = getCurrentRoom();
    const floor = gameState.floorRun.currentFloor || 1;
    const theme = getCryptDepthTheme(floor);

    if (!room) {
      this.showFloorCompleted();
      return;
    }

    const roomType = String(room.type);
    const isBossRoom = roomType === 'boss' || roomType === 'tier_boss';
    const isCampfireRoom = roomType === 'campfire';

    const panelY = isBossRoom ? 720 : isCampfireRoom ? 690 : 695;
    const panelHeight = isBossRoom ? 620 : isCampfireRoom ? 530 : 500;

    this.createRoundedPanel({
      x: width / 2,
      y: panelY,
      width: 620,
      height: panelHeight,
      radius: 36,
      color: isBossRoom
        ? 0x160908
        : isCampfireRoom
          ? 0x1a0f08
          : theme.panel,
      alpha: 0.94,
      strokeColor: this.getRoomStrokeColor(roomType),
      strokeAlpha: isBossRoom || isCampfireRoom ? 0.82 : 0.52,
      strokeWidth: isBossRoom || isCampfireRoom ? 3 : 2,
      depth: 2,
    });

    const iconColor = this.getRoomTextColor(roomType);
    const strokeColor = this.getRoomStrokeColor(roomType);

    const topY = panelY - panelHeight / 2;

    this.add.circle(width / 2, topY + 72, 58, strokeColor, isCampfireRoom ? 0.16 : 0.11).setDepth(5);

    this.add.circle(width / 2, topY + 72, 42, 0x20150f, 1)
      .setStrokeStyle(2, strokeColor, 0.76)
      .setDepth(6);

    this.add.text(width / 2, topY + 72, this.getRoomIcon(roomType), {
      fontFamily: UI.font.body,
      fontSize: isCampfireRoom ? '38px' : '34px',
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
                : room.title;

    this.add.text(width / 2, topY + 140, roomTitle, {
      fontFamily: UI.font.title,
      fontSize: isBossRoom ? '36px' : isCampfireRoom ? '33px' : '34px',
      color: isBossRoom ? UI.colors.red : isCampfireRoom ? UI.colors.goldText : theme.text,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: 540,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(7);

    this.add.text(width / 2, topY + 200, room.description, {
      fontFamily: UI.font.body,
      fontSize: '17px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 540,
      },
      lineSpacing: 4,
      maxLines: 4,
    }).setOrigin(0.5).setDepth(7);

    this.createRoomInfoBox(
      width / 2,
      topY + 295,
      this.getRoomInfo(roomType),
      this.getModifierWarning()
    );

    if (isBossRoom) {
      this.createBossRequirementInfo(topY + 415);
    }

    if (isCampfireRoom) {
      this.createCampfireStatusBox(topY + 410);
    }

    this.createRoomButton(roomType, room.enemyId);
  }

  private createRoomInfoBox(
    x: number,
    y: number,
    info: string,
    modifierWarning: string
  ) {
    const text = `${info}${modifierWarning}`;

    this.createRoundedPanel({
      x,
      y,
      width: 540,
      height: 92,
      radius: 22,
      color: 0x17100c,
      alpha: 0.88,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.3,
      strokeWidth: 1,
      depth: 5,
    });

    this.add.text(x, y, text, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: 490,
      },
      lineSpacing: 3,
    }).setOrigin(0.5).setDepth(8);
  }

  private createBossRequirementInfo(y: number) {
    const { width } = this.scale;

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

    this.createRoundedPanel({
      x: width / 2,
      y,
      width: 540,
      height: 82,
      radius: 20,
      color: isReady ? 0x102016 : 0x241010,
      alpha: 0.88,
      strokeColor: isReady ? 0x75d184 : 0xff6b6b,
      strokeAlpha: 0.68,
      strokeWidth: 2,
      depth: 5,
    });

    this.add.text(width / 2, y - 24, isReady ? 'Герой готов к боссу' : 'Босс опасен', {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: isReady ? UI.colors.green : UI.colors.red,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8);

    const text = [
      `Ур. ${recommendedLevel}/${player.level}`,
      `Сила ${recommendedStrength}/${stats.attack}`,
      `HP ${recommendedHp}/${stats.maxHp}`,
    ].join('  •  ');

    this.add.text(width / 2, y + 15, text, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 500,
      },
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
    const { width } = this.scale;

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
      buttonText = 'В бой';
      icon = '☠';
      description = 'Обычное сражение.';
    }

    if (type === 'elite') {
      buttonText = 'Сразиться с элитой';
      icon = '◆';
      description = 'Опасный враг, награда выше.';
    }

    if (type === 'boss') {
      buttonText = 'Войти к боссу';
      icon = '♛';
      description = 'Финальная битва этажа.';
    }

    if (type === 'tier_boss') {
      buttonText = 'Финальный бой';
      icon = '♚';
      description = 'Битва за переход в следующий ярус.';
    }

    if (type === 'chest') {
      buttonText = 'Открыть сундук';
      icon = '✦';
      description = 'Золото и материалы для кузницы.';
    }

    if (type === 'trap') {
      buttonText = 'Пройти осторожно';
      icon = '!';
      description = 'Можно избежать урона, если хватит ловкости.';
    }

    if (type === 'campfire') {
      this.createCampfireButtons();
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

    this.createRoomActionButton({
      x: width / 2,
      y: 875,
      width: 460,
      height: 64,
      icon,
      title: buttonText,
      subtitle: description,
      accentColor: this.getRoomStrokeColor(type),
      danger: type === 'trap',
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
  }

  private createCampfireStatusBox(y: number) {
    const { width } = this.scale;
    const campfireState = this.getCampfireState();
    const flintName = this.getFlintDisplayName(campfireState.selectedFlint ?? 'none');
    const potionText = `Зелья: ${player.potions}/${this.maxPotionCount}`;
    const chargeText = `Зарядов огнива: ${campfireState.remainingCampfireUses}`;

    this.createRoundedPanel({
      x: width / 2,
      y,
      width: 540,
      height: 90,
      radius: 22,
      color: 0x17100c,
      alpha: 0.9,
      strokeColor: 0xf0a040,
      strokeAlpha: 0.42,
      strokeWidth: 1,
      depth: 5,
    });

    this.add.text(width / 2, y - 24, flintName, {
      fontFamily: UI.font.title,
      fontSize: '18px',
      color: campfireState.remainingCampfireUses > 0 ? UI.colors.goldText : UI.colors.textMuted,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: 500,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(8);

    this.add.text(width / 2, y + 18, `${potionText}  •  ${chargeText}`, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: 500,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(8);
  }

  private createCampfireButtons() {
    const { width } = this.scale;
    const campfireState = this.getCampfireState();
    const canUseCampfire = campfireState.remainingCampfireUses > 0 && player.potions < this.maxPotionCount;

    this.createRoomActionButton({
      x: width / 2,
      y: 850,
      width: 470,
      height: 62,
      icon: '♨',
      title: canUseCampfire ? 'Разжечь костёр' : 'Костёр не нужен',
      subtitle: canUseCampfire
        ? `Восстановить зелья до ${this.maxPotionCount}`
        : player.potions >= this.maxPotionCount
          ? `Зелья уже полные: ${player.potions}/${this.maxPotionCount}`
          : 'Нет зарядов выбранного огнива',
      accentColor: canUseCampfire ? 0xf0a040 : UI.colors.goldDark,
      danger: false,
      onClick: () => {
        this.handleCampfireUse();
      },
    });

    this.createRoomActionButton({
      x: width / 2,
      y: 925,
      width: 470,
      height: 58,
      icon: '➤',
      title: 'Пройти мимо',
      subtitle: 'Не тратить заряд огнива',
      accentColor: UI.colors.goldDark,
      danger: false,
      onClick: () => {
        this.skipCampfire();
      },
    });
  }

  private handleCampfireUse() {
    const room = getCurrentRoom();

    if (!room || room.completed) {
      return;
    }

    const campfireState = this.getCampfireState();

    if (player.potions >= this.maxPotionCount) {
      this.showMessage(
        'Костёр не нужен',
        `У тебя уже максимальный запас зелий: ${player.potions}/${this.maxPotionCount}.\nЗаряд огнива не потрачен.`,
        () => {
          this.scene.restart();
        }
      );
      return;
    }

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

    campfireState.remainingCampfireUses = Math.max(0, campfireState.remainingCampfireUses - 1);
    campfireState.usedCampfireFloors = Array.from(new Set([
      ...campfireState.usedCampfireFloors,
      gameState.floorRun.currentFloor,
    ]));

    player.potions = this.maxPotionCount;

    markCurrentRoomCompleted();
    goToNextRoom();

    void saveGameAsync();

    this.showMessage(
      'Костёр разожжён',
      `Пламя наполнило фляги.\nЗелья восстановлены до ${this.maxPotionCount}.\nОсталось зарядов: ${campfireState.remainingCampfireUses}.`,
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

    markCurrentRoomCompleted();
    goToNextRoom();

    void saveGameAsync();

    this.showMessage(
      'Костёр остался позади',
      'Ты не стал тратить огниво и пошёл дальше.',
      () => {
        this.scene.restart();
      }
    );
  }

  private createNormalBattleButtons(config: {
    enemyId: string;
    buttonText: string;
    icon: string;
    description: string;
    type: string;
  }) {
    const { width } = this.scale;

    const prepareY = 830;
    const battleY = 900;

    const prepareHeight = 56;
    const battleHeight = 62;

    const buttonWidth = 460;

    this.createRoomActionButton({
      x: width / 2,
      y: prepareY,
      width: buttonWidth,
      height: prepareHeight,
      icon: '▣',
      title: 'Подготовиться',
      subtitle: 'Открыть сумку перед боем',
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
      x: width / 2,
      y: battleY,
      width: buttonWidth,
      height: battleHeight,
      icon: config.icon,
      title: config.buttonText,
      subtitle: config.description,
      accentColor: this.getRoomStrokeColor(config.type),
      danger: false,
      onClick: () => {
        this.scene.start('BattleScene', {
          enemyId: config.enemyId,
          returnToDungeon: true,
        });
      },
    });
  }

  private createBossBattleButtons(config: {
    enemyId: string;
    buttonText: string;
    icon: string;
    description: string;
  }) {
    const { width } = this.scale;

    const prepareY = 910;
    const battleY = 985;

    const prepareHeight = 60;
    const battleHeight = 68;

    const buttonWidth = 480;

    this.createRoomActionButton({
      x: width / 2,
      y: prepareY,
      width: buttonWidth,
      height: prepareHeight,
      icon: '▣',
      title: 'Подготовиться',
      subtitle: 'Проверить снаряжение перед боссом',
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
      x: width / 2,
      y: battleY,
      width: buttonWidth,
      height: battleHeight,
      icon: config.icon,
      title: config.buttonText,
      subtitle: config.description,
      accentColor: 0xff6b6b,
      danger: true,
      onClick: () => {
        this.scene.start('BattleScene', {
          enemyId: config.enemyId,
          returnToDungeon: true,
        });
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
  onClick: () => void;
}) {
  const danger = config.danger ?? false;

  const bgColor = danger ? 0x241010 : 0x17100c;
  const hoverColor = danger ? 0x321515 : 0x21150f;
  const textColor = danger ? UI.colors.red : UI.colors.goldText;
  const hoverTextColor = danger ? '#ff9a9a' : UI.colors.text;

  const radius = 22;

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.34);
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
  bg.lineStyle(2, config.accentColor, danger ? 0.88 : 0.64);
  bg.strokeRoundedRect(
    config.x - config.width / 2,
    config.y - config.height / 2,
    config.width,
    config.height,
    radius
  );
  bg.setDepth(21);

  const iconX = config.x - config.width / 2 + 42;

  const iconCircle = this.add.circle(iconX, config.y, 23, config.accentColor, 0.15)
    .setStrokeStyle(1, config.accentColor, 0.58)
    .setDepth(22);

  const iconText = this.add.text(iconX, config.y, config.icon, {
    fontFamily: UI.font.body,
    fontSize: '20px',
    color: textColor,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(23);

  const titleText = this.add.text(config.x - config.width / 2 + 78, config.y - 12, config.title, {
    fontFamily: UI.font.title,
    fontSize: '20px',
    color: textColor,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0, 0.5).setDepth(23);

  const subtitleText = this.add.text(config.x - config.width / 2 + 78, config.y + 17, config.subtitle, {
    fontFamily: UI.font.body,
    fontSize: '13px',
    color: UI.colors.textMuted,
    wordWrap: {
      width: config.width - 105,
    },
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

    bg.lineStyle(2, config.accentColor, strokeAlpha);
    bg.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    iconCircle.setY(config.y + offsetY);
    iconText.setY(config.y + offsetY);
    titleText.setY(config.y - 12 + offsetY);
    subtitleText.setY(config.y + 17 + offsetY);

    titleText.setColor(titleColor);
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

    redrawButton(hoverColor, 1, 0.95, hoverTextColor);
  });

  bg.on('pointerout', () => {
    isPressed = false;

    if (isLocked) return;

    redrawButton(bgColor, 0.96, danger ? 0.88 : 0.64, textColor);
  });

  bg.on('pointerdown', () => {
    if (isLocked) return;

    isPressed = true;

    redrawButton(hoverColor, 0.92, 0.95, hoverTextColor, 1);
  });

  bg.on('pointerup', () => {
    if (!isPressed) return;

    isPressed = false;

    redrawButton(hoverColor, 1, 0.95, hoverTextColor);

    this.time.delayedCall(40, () => {
      redrawButton(bgColor, 0.96, danger ? 0.88 : 0.64, textColor);
      config.onClick();
    });
  });

  bg.on('pointerupoutside', () => {
    isPressed = false;

    if (isLocked) return;

    redrawButton(bgColor, 0.96, danger ? 0.88 : 0.64, textColor);
  });

  bg.on('pointercancel', () => {
    isPressed = false;

    if (isLocked) return;

    redrawButton(bgColor, 0.96, danger ? 0.88 : 0.64, textColor);
  });
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

  markCurrentRoomCompleted();
  goToNextRoom();

  void saveGameAsync();

  this.showMessage(
    'Сундук открыт',
    reward.text,
    () => {
      this.scene.restart();
    }
  );
}

  private createFloorJournal(y: number, x = this.scale.width / 2) {
    const run = gameState.floorRun;

    this.add.text(x, y - 70, 'Журнал этажа', {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const lines = [
      `Монстры: ${run.monstersDefeated}`,
      `Сундуки: ${run.chestsOpened}`,
      `Ловушки: ${run.trapsTriggered}`,
      `Золото: +${run.goldEarned}`,
      `Опыт: +${run.expEarned}`,
      createFloorMaterialsShortText(),
    ];

    lines.forEach((line, index) => {
      this.add.text(x, y - 30 + index * 25, line, {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: line.includes('Золото')
          ? UI.colors.goldText
          : line.includes('Опыт')
            ? UI.colors.green
            : UI.colors.textMuted,
        align: 'center',
      }).setOrigin(0.5);
    });
  }

  private triggerTrap() {
    const room = getCurrentRoom();

    if (!room || room.completed) {
      return;
    }

    const result = triggerTrapResult();

    if (player.hp <= 0) {
      this.showMessage(
        'Ты погиб',
        `${result.text}\n\nЛовушка оказалась смертельной.\nТы очнулся в лагере.`,
        () => {
          const freshStats = getPlayerStats(player);

          player.hp = freshStats.maxHp;
          player.energy = freshStats.maxEnergy;

          resetFloorRun();
          this.resetCampfireState();

          void saveGameAsync();

          this.scene.start('CampScene');
        }
      );

      return;
    }

    markCurrentRoomCompleted();
    goToNextRoom();

    void saveGameAsync();

    this.showMessage(
      result.avoided ? 'Ловушка обезврежена' : 'Проклятая ловушка',
      result.text,
      () => {
        this.scene.restart();
      }
    );
  }

  private showFloorCompleted() {
    const floor = gameState.floorRun.currentFloor;
    const nextFloor = getNextFloorAfterCurrent();

    completeCurrentFloor();

    if (gameState.floorRun.runType === 'tier_gate') {
      void saveGameAsync();
      this.showTierGateCompleted();
      return;
    }

    let rewardText = '';

    if (!gameState.floorRun.rewardClaimed) {
      const reward = giveFloorReward(floor);
      rewardText = reward.fullText;
      gameState.floorRun.rewardClaimed = true;
    } else {
      rewardText = `Награда за этаж ${floor} уже получена.`;
    }

    void saveGameAsync();

    if (isTierBossFloor(floor)) {
      this.showTierCompleted(rewardText);
      return;
    }

    const { width, height } = this.scale;

    // Затемнение старой сцены
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.62)
      .setDepth(100);

    // Основная карточка результата
    this.createResultPanel({
      x: width / 2,
      y: 610,
      width: 640,
      height: 760,
      radius: 34,
      fill: 0x0b0807,
      stroke: 0x75d184,
      depth: 101,
    });

    // Верхнее зелёное свечение
    this.add.circle(width / 2, 245, 145, 0x1c6b3a, 0.16).setDepth(102);
    this.add.circle(width / 2, 245, 78, 0x75d184, 0.1).setDepth(102);

    this.add.text(width / 2, 220, 'ЭТАЖ ЗАЧИЩЕН', {
      fontFamily: UI.font.title,
      fontSize: '42px',
      color: UI.colors.green,
      stroke: '#000000',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(103);

    this.add.text(width / 2, 272, `Этаж ${floor} полностью пройден`, {
      fontFamily: UI.font.body,
      fontSize: '21px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(103);

    // Главный reward-блок
    const materialsText = createFloorMaterialsText();

    this.createPremiumRewardBox(
      width / 2,
      420,
      `${rewardText}\n${materialsText}`
    );

    // Две компактные инфо-колонки
    this.createCompactFloorJournal(645, width / 2 - 165);
    this.createCompactNextFloorInfo(645, nextFloor, width / 2 + 165);

    // Кнопки
    this.createRoundedActionButton({
      x: width / 2,
      y: 855,
      width: 460,
      height: 58,
      text: 'Продолжить ниже',
      variant: 'green',
      depth: 120,
      onClick: () => {
        startFloorRun(nextFloor);
        void saveGameAsync();
        this.scene.restart();
      },
    });

    this.createRoundedActionButton({
      x: width / 2,
      y: 925,
      width: 460,
      height: 58,
      text: 'Вернуться в город',
      variant: 'brown',
      depth: 120,
      onClick: () => {
        this.showExitToTownConfirm();
      },
    });
  }

  private showExitToTownConfirm() {
  const { width, height } = this.scale;

  const modalObjects: Phaser.GameObjects.GameObject[] = [];

  const overlay = this.add.rectangle(
    width / 2,
    height / 2,
    width,
    height,
    0x000000,
    0.74
  )
    .setDepth(200)
    .setInteractive();

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.38);
  shadow.fillRoundedRect(
    width / 2 - 300,
    height / 2 - 145 + 8,
    600,
    290,
    30
  );
  shadow.setDepth(201);

  const panel = this.add.graphics();
  panel.fillStyle(0x14100d, 0.98);
  panel.fillRoundedRect(
    width / 2 - 300,
    height / 2 - 145,
    600,
    290,
    30
  );
  panel.lineStyle(3, UI.colors.goldDark, 0.85);
  panel.strokeRoundedRect(
    width / 2 - 300,
    height / 2 - 145,
    600,
    290,
    30
  );
  panel.setDepth(202);

  const glow = this.add.circle(width / 2, height / 2 - 88, 90, 0xf0a040, 0.07)
    .setDepth(203);

  const title = this.add.text(width / 2, height / 2 - 90, 'Выйти в город?', {
    fontFamily: UI.font.title,
    fontSize: '31px',
    color: UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 5,
  }).setOrigin(0.5).setDepth(204);

  const text = this.add.text(
    width / 2,
    height / 2 - 20,
    'Ты покинешь подземелье и вернёшься в город.\nТекущий забег будет завершён.',
    {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 6,
      wordWrap: {
        width: 500,
      },
    }
  ).setOrigin(0.5).setDepth(204);

  const closeModal = () => {
    modalObjects.forEach(object => {
      object.destroy();
    });
  
    modalObjects.length = 0;
  };

  const cancelButton = this.createRoundedActionButton({
    x: width / 2 - 145,
    y: height / 2 + 90,
    width: 230,
    height: 54,
    text: 'Отмена',
    onClick: () => {
      closeModal();
    },
    variant: 'brown',
    depth: 204,
  });

  const confirmButton = this.createRoundedActionButton({
    x: width / 2 + 145,
    y: height / 2 + 90,
    width: 230,
    height: 54,
    text: 'Да, выйти',
    onClick: () => {
      closeModal();

      resetFloorRun();
      this.resetCampfireState();

      void saveGameAsync();

      this.scene.start('CampScene');
    },
    variant: 'green',
    depth: 204,
  });

  modalObjects.push(
    overlay,
    shadow,
    panel,
    glow,
    title,
    text,
    cancelButton.shadow,
    cancelButton.bg,
    cancelButton.label,
    confirmButton.shadow,
    confirmButton.bg,
    confirmButton.label
  );
}

  private createResultPanel(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    fill: number;
    stroke: number;
    depth: number;
  }) {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.42);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 10,
      config.width,
      config.height,
      config.radius
    );
    shadow.setDepth(config.depth);

    const panel = this.add.graphics();
    panel.fillStyle(config.fill, 0.98);
    panel.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      config.radius
    );

    panel.lineStyle(3, config.stroke, 0.86);
    panel.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      config.radius
    );

    panel.setDepth(config.depth + 1);

    return {
      shadow,
      panel,
    };
  }

  private createPremiumRewardBox(x: number, y: number, rewardText: string) {
    const lines = rewardText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Тень
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(x - 285, y - 108 + 7, 570, 216, 28);
    shadow.setDepth(103);

    // Карточка наград
    const panel = this.add.graphics();
    panel.fillStyle(0x1a120c, 0.98);
    panel.fillRoundedRect(x - 285, y - 108, 570, 216, 28);
    panel.lineStyle(3, UI.colors.gold, 0.95);
    panel.strokeRoundedRect(x - 285, y - 108, 570, 216, 28);
    panel.setDepth(104);

    // Верхнее золотое свечение
    this.add.circle(x, y - 62, 120, 0xf0d58a, 0.055).setDepth(105);

    this.add.text(x, y - 78, 'ПОЛУЧЕННЫЕ НАГРАДЫ', {
      fontFamily: UI.font.title,
      fontSize: '27px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(106);

    this.add.rectangle(x, y - 44, 390, 2, UI.colors.gold, 0.28)
      .setDepth(106);

    const rewardLines = lines.length > 0 ? lines : ['Награда уже получена'];

    const startY = y - 10;
    const lineGap = 34;

    rewardLines.slice(0, 4).forEach((line, index) => {
      const color = this.getRewardLineColor(line);
      const icon = this.getRewardLineIcon(line);

      this.add.text(x - 210, startY + index * lineGap, icon, {
        fontFamily: UI.font.body,
        fontSize: '22px',
        color,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(106);

      this.add.text(x - 175, startY + index * lineGap, line, {
        fontFamily: UI.font.body,
        fontSize: '22px',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: 430,
        },
      }).setOrigin(0, 0.5).setDepth(106);
    });
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

  private createCompactFloorJournal(y: number, x = this.scale.width / 2) {
    const run = gameState.floorRun;

    this.add.text(x, y - 72, 'Журнал', {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(104);

    const lines = [
      `Монстры: ${run.monstersDefeated}`,
      `Сундуки: ${run.chestsOpened}`,
      `Ловушки: ${run.trapsTriggered}`,
      `Золото: +${run.goldEarned}`,
      `Опыт: +${run.expEarned}`,
      createFloorMaterialsShortText(),
    ];

    lines.forEach((line, index) => {
      const color = line.includes('Золото')
        ? UI.colors.goldText
        : line.includes('Опыт')
          ? UI.colors.green
          : line.includes('Материалы')
            ? '#70a6ff'
            : UI.colors.textMuted;

      this.add.text(x, y - 32 + index * 25, line, {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(104);
    });
  }

  private createCompactNextFloorInfo(
    y: number,
    nextFloor: number,
    x = this.scale.width / 2
  ) {
    const stats = getPlayerStats(player);
    const requirement = getFloorRequirement(nextFloor);

    const isDangerous =
      player.level < requirement.level ||
      stats.attack < requirement.attack ||
      stats.defense < requirement.defense ||
      stats.maxHp < requirement.hp;

    this.add.text(x, y - 72, `Этаж ${nextFloor}`, {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: isDangerous ? UI.colors.red : UI.colors.green,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(104);

    const lines = [
      `Уровень: ${requirement.level} / ${player.level}`,
      `Атака: ${requirement.attack} / ${stats.attack}`,
      `Защита: ${requirement.defense} / ${stats.defense}`,
      `HP: ${requirement.hp} / ${stats.maxHp}`,
    ];

    lines.forEach((line, index) => {
      this.add.text(x, y - 32 + index * 25, line, {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: UI.colors.textMuted,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(104);
    });

    this.add.text(x, y + 82, isDangerous ? 'Опасно' : 'Можно идти', {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: isDangerous ? UI.colors.red : UI.colors.green,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(104);
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
        resetFloorRun();
        this.resetCampfireState();
      
        void saveGameAsync();
      
        this.scene.start('CampScene');
      },
    });
  }

  private showTierCompleted(rewardText: string) {
    const floor = gameState.floorRun.currentFloor;
    const tier = getCurrentTierByFloor(floor);
    const nextFloor = floor + 1;

    const relic = giveRelicForTier(tier);

    let relicText = '';

    if (relic) {
      relicText =
        `\n\nПолучена реликвия: ${relic.name}\n` +
        `${relic.description}\n` +
        `Бонус: ${createRelicBonusText(relic)}`;
    }

    void saveGameAsync();

    const { width } = this.scale;

    this.add.rectangle(width / 2, 580, 640, 670, 0x0d0d0d, 0.96)
      .setStrokeStyle(3, 0xf0d58a);

    this.add.text(width / 2, 250, `Ярус ${tier} пройден`, {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      335,
      `Ты победил финального босса ${tier}-го яруса.\nТеперь можно вернуться в город или продолжить спуск.`,
      {
        fontFamily: 'Arial',
        fontSize: '21px',
        color: '#d8c7a3',
        align: 'center',
        wordWrap: {
          width: 560,
        },
        lineSpacing: 7,
      }
    ).setOrigin(0.5);

    this.add.text(width / 2, 480, rewardText + relicText, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#d8c7a3',
      align: 'center',
      wordWrap: {
        width: 560,
      },
      lineSpacing: 5,
    }).setOrigin(0.5);

    this.createFloorJournal(600);

    this.createNextFloorInfo(740, nextFloor);

    this.createRoundedActionButton({
      x: width / 2,
      y: 910,
      width: 450,
      height: 56,
      text: 'Продолжить на новый ярус',
      variant: 'green',
      onClick: () => {
        startFloorRun(nextFloor);
      
        void saveGameAsync();
      
        this.scene.restart();
      },
    });

    this.createRoundedActionButton({
      x: width / 2,
      y: 975,
      width: 450,
      height: 56,
      text: 'Вернуться в город',
      variant: 'brown',
      onClick: () => {
        resetFloorRun();
        this.resetCampfireState();
      
        void saveGameAsync();
      
        this.scene.start('CampScene');
      },
    });
  }

  private showMessage(title: string, message: string, onContinue?: () => void) {
    const { width, height } = this.scale;

    // Удаляем старое модальное окно, если оно уже было
    this.modalObjects.forEach(object => {
      object.destroy();
    });

    this.modalObjects = [];

    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.72
    ).setDepth(100);

    const panelShadow = this.add.rectangle(
      width / 2,
      height / 2 + 6,
      590,
      330,
      0x000000,
      0.35
    ).setDepth(101);

    const panel = this.add.rectangle(
      width / 2,
      height / 2,
      590,
      330,
      0x17100c,
      0.98
    )
      .setStrokeStyle(3, UI.colors.goldDark, 0.9)
      .setDepth(102);

    const titleText = this.add.text(width / 2, height / 2 - 115, title, {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(103);

    const messageText = this.add.text(width / 2, height / 2 - 25, message, {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 10,
      wordWrap: {
        width: 500,
        useAdvancedWrap: true,
      },
    }).setOrigin(0.5).setDepth(103);

    const button = createButton(
      this,
      width / 2,
      height / 2 + 115,
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
      300,
      56
    );

    button.shadow.setDepth(102);
    button.bg.setDepth(103);
    button.label.setDepth(104);

    this.modalObjects.push(
      overlay,
      panelShadow,
      panel,
      titleText,
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

  private resetCampfireState() {
    const stateOwner = gameState as typeof gameState & {
      dungeonCampfireState?: CampfireState;
    };

    stateOwner.dungeonCampfireState = undefined;
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
      'Огниво выбирается в начале яруса. Один заряд активирует один найденный костёр. Костёр восстанавливает запас зелий до 6.',
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
      description: 'Обычный вариант. Позволяет активировать 1 костёр в ярусе.',
      accentColor: 0xd8c7a3,
    });

    const blackCard = this.createFlintCard({
      x: width / 2,
      y: height / 2 + 15,
      type: 'black',
      title: 'Чёрное огниво',
      description: 'Улучшенное огниво. Позволяет активировать 2 костра в ярусе.',
      accentColor: 0x70a6ff,
    });

    const rubyCard = this.createFlintCard({
      x: width / 2,
      y: height / 2 + 175,
      type: 'ruby',
      title: 'Огниво с красным рубином',
      description: 'Донатное огниво. Позволяет активировать все 3 костра в ярусе.',
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