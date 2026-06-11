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

import { giveFloorReward } from '../systems/FloorRewardSystem';

import {
  addItemToInventory,
  getPlayerStats,
  rollItemDrop,
} from '../systems/InventorySystem';

import { getRandomLootItem } from '../data/items';
import { addExperience, createLevelUpText } from '../systems/LevelSystem';
import { saveGameAsync } from '../systems/SaveSystem';
import { trackChestOpened, trackGoldEarned } from '../systems/QuestSystem';

export class DungeonScene extends Phaser.Scene {

  private modalObjects: Phaser.GameObjects.GameObject[] = [];
  
  constructor() {
    super('DungeonScene');
  }

  create() {
    if (!gameState.floorRun.active || gameState.floorRun.rooms.length === 0) {
      startFloorRun(gameState.highestClearedFloor + 1);
      void saveGameAsync();
    }

    createSceneBackground(this);
    this.createDungeonBackdrop();

    this.createHeader();
    this.createFloorProgress();
    this.createRoomMap();
    this.createCurrentRoom();
  }

  private createHeader() {
    const { width } = this.scale;

    const floor = gameState.floorRun.currentFloor;
    const tier = getCurrentTierByFloor(floor);
    const modifierName = getFloorModifierName(gameState.floorRun.modifier);

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

    this.add.text(width / 2, 100, modifierName, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: UI.colors.textMuted,
    }).setOrigin(0.5).setDepth(6);
  }

  private createDungeonBackdrop() {
    const { width, height } = this.scale;

    // Тёмная глубина
    this.add.rectangle(width / 2, height / 2, width, height, 0x050403, 0.35).setDepth(0);

    // Свет факела сверху
    this.add.circle(width / 2, 120, 250, 0x8b4a1f, 0.06).setDepth(0);
    this.add.circle(width / 2, 120, 120, 0xf0a040, 0.035).setDepth(0);

    // Туман
    for (let i = 0; i < 14; i += 1) {
      const x = 45 + i * 52;
      const y = 165 + (i % 6) * 92;

      this.add.circle(x, y, 34 + (i % 4) * 8, 0xffffff, 0.013).setDepth(0);
    }

    // Нижнее затемнение под UI
    this.add.rectangle(width / 2, height - 180, width, 330, 0x020202, 0.34).setDepth(0);

    // Лёгкие частицы
    for (let i = 0; i < 34; i += 1) {
      const x = Phaser.Math.Between(35, width - 35);
      const y = Phaser.Math.Between(80, height - 170);
      const size = Phaser.Math.Between(1, 2);

      this.add.circle(x, y, size, 0xd8b56d, 0.055).setDepth(1);
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

    this.createRoundedPanel({
      x: width / 2,
      y: 178,
      width: 620,
      height: 94,
      radius: 24,
      color: 0x100c09,
      alpha: 0.86,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.3,
      depth: 2,
    });

    this.add.text(width / 2, 178, getFloorDescription(floor), {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
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
    

    bg.setInteractive(
      new Phaser.Geom.Rectangle(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height
      ),
      Phaser.Geom.Rectangle.Contains
    );

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: textColor,
    }).setOrigin(0.5); label.setDepth(depth + 2);

    bg.on('pointerover', () => {
      bg.clear();

      bg.fillStyle(bgHoverColor, 1);
      bg.fillRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );

      bg.lineStyle(2, strokeColor, 1);
      bg.strokeRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );

      label.setColor(variant === 'green' ? '#a8f0b4' : UI.colors.goldText);
    });

    bg.on('pointerout', () => {
      bg.clear();

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

      label.setColor(textColor);
    });

    bg.on('pointerdown', () => {
      bg.setScale(0.985);
      label.setScale(0.985);
    });

    bg.on('pointerup', () => {
      bg.setScale(1);
      label.setScale(1);
      config.onClick();
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

    if (!room) {
      this.showFloorCompleted();
      return;
    }

    const isBossRoom = room.type === 'boss' || room.type === 'tier_boss';

    const panelY = isBossRoom ? 720 : 695;
    const panelHeight = isBossRoom ? 620 : 500;

    this.createRoundedPanel({
      x: width / 2,
      y: panelY,
      width: 620,
      height: panelHeight,
      radius: 36,
      color: isBossRoom ? 0x160908 : 0x0d0a08,
      alpha: 0.94,
      strokeColor: this.getRoomStrokeColor(room.type),
      strokeAlpha: isBossRoom ? 0.82 : 0.52,
      strokeWidth: isBossRoom ? 3 : 2,
      depth: 2,
    });

    const iconColor = this.getRoomTextColor(room.type);
    const strokeColor = this.getRoomStrokeColor(room.type);

    const topY = panelY - panelHeight / 2;

    this.add.circle(width / 2, topY + 72, 52, strokeColor, 0.11).setDepth(5);

    this.add.circle(width / 2, topY + 72, 40, 0x20150f, 1)
      .setStrokeStyle(2, strokeColor, 0.76)
      .setDepth(6);

    this.add.text(width / 2, topY + 72, this.getRoomIcon(room.type), {
      fontFamily: UI.font.body,
      fontSize: '34px',
      color: iconColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(7);

    const roomTitle =
      room.type === 'monster'
        ? 'Обычная комната'
        : room.type === 'elite'
          ? 'Опасная комната'
          : room.type === 'boss'
            ? 'Комната босса'
            : room.type === 'tier_boss'
              ? 'Финальный босс'
              : room.title;

    this.add.text(width / 2, topY + 140, roomTitle, {
      fontFamily: UI.font.title,
      fontSize: isBossRoom ? '36px' : '34px',
      color: isBossRoom ? UI.colors.red : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
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
    }).setOrigin(0.5).setDepth(7);

    this.createRoomInfoBox(
      width / 2,
      topY + 295,
      this.getRoomInfo(room.type),
      this.getModifierWarning()
    );

    if (isBossRoom) {
      this.createBossRequirementInfo(topY + 415);
    }

    this.createRoomButton(room.type, room.enemyId);
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
      description = 'Золото, опыт и шанс предмета.';
    }

    if (type === 'trap') {
      buttonText = 'Пройти осторожно';
      icon = '!';
      description = 'Ловкость может спасти от урона.';
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

    this.add.circle(iconX, config.y, 23, config.accentColor, 0.15)
      .setStrokeStyle(1, config.accentColor, 0.58)
      .setDepth(22);

    this.add.text(iconX, config.y, config.icon, {
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

    this.add.text(config.x - config.width / 2 + 78, config.y + 17, config.subtitle, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: config.width - 105,
      },
    }).setOrigin(0, 0.5).setDepth(23);

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
      bg.clear();

      bg.fillStyle(hoverColor, 1);
      bg.fillRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );
      bg.lineStyle(2, config.accentColor, 0.95);
      bg.strokeRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );

      titleText.setColor(danger ? '#ff9a9a' : UI.colors.text);
    });

    bg.on('pointerout', () => {
      bg.clear();

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

      titleText.setColor(textColor);
    });

    bg.on('pointerdown', () => {
      bg.setScale(0.985);
      titleText.setScale(0.985);
    });

    bg.on('pointerup', () => {
      bg.setScale(1);
      titleText.setScale(1);
      config.onClick();
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
    let gold = Phaser.Math.Between(6, 16);

    if (gameState.floorRun.modifier === 'treasure') {
      gold += Phaser.Math.Between(12, 28);
    }

    if (gameState.floorRun.modifier === 'cursed') {
      gold += Phaser.Math.Between(8, 20);
    }

    player.gold += gold;

    trackChestOpened();
    trackGoldEarned(gold);

    gameState.floorRun.chestsOpened += 1;
    gameState.floorRun.goldEarned += gold;

    const expResult = addExperience(player, 6);

    gameState.floorRun.expEarned += 6;

    let itemText = '';

    let chestItemChance = 0.25;

    if (gameState.floorRun.modifier === 'treasure') {
      chestItemChance += 0.25;
    }

    if (gameState.floorRun.modifier === 'cursed') {
      chestItemChance += 0.15;
    }

    if (rollItemDrop(player, chestItemChance)) {
      const item = getRandomLootItem();

      addItemToInventory(player, item.id);

      itemText = `\nНайден предмет: ${item.name}`;
    }

    let levelText = '';

    if (expResult.leveledUp) {
      levelText = `\n\n${createLevelUpText(expResult)}`;
    }

    markCurrentRoomCompleted();
    goToNextRoom();

    void saveGameAsync();

    this.showMessage(
      'Сундук открыт',
      `Ты открыл сундук.\n\nЗолото: +${gold}\nОпыт: +6${itemText}${levelText}`,
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
    const stats = getPlayerStats(player);

    gameState.floorRun.trapsTriggered += 1;

    if (Math.random() < stats.trapDodgeChance) {
      markCurrentRoomCompleted();
      goToNextRoom();

      void saveGameAsync();

      this.showMessage(
        'Проклятая ловушка',
        `Ты встретил проклятую ловушку.\n\nЛовкость помогла увернуться.\nУрон: 0.`,
        () => {
          this.scene.restart();
        }
      );

      return;
    }

    let damage = Phaser.Math.Between(14, 28);

    if (gameState.floorRun.modifier === 'traps') {
      damage = Math.floor(damage * 1.35);
    }

    if (gameState.floorRun.modifier === 'cursed') {
      damage = Math.floor(damage * 1.5);
    }

    player.hp = Math.max(0, player.hp - damage);

    if (player.hp <= 0) {
      this.showMessage(
        'Ты погиб',
        'Ловушка оказалась смертельной.\nТы очнулся в лагере.',
        () => {
          const freshStats = getPlayerStats(player);

          player.hp = freshStats.maxHp;
          player.energy = player.maxEnergy;

          resetFloorRun();

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
      'Проклятая ловушка',
      `Ты встретил проклятую ловушку.\n\nЛовкость не помогла увернуться.\nУрон: ${damage}.`,
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
    this.createPremiumRewardBox(width / 2, 420, rewardText);

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
        resetFloorRun();
        void saveGameAsync();
        this.scene.start('CampScene');
      },
    });
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
    ];

    lines.forEach((line, index) => {
      const color = line.includes('Золото')
        ? UI.colors.goldText
        : line.includes('Опыт')
          ? UI.colors.green
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
      return 'Можно получить золото, опыт и шанс на предмет.';
    }

    if (type === 'trap') {
      return 'Ловкость может помочь избежать урона.';
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