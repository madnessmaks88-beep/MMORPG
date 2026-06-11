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
  createPanel,
  createSceneBackground,
  createSmallText,
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

    this.add.text(width / 2, 48, `Ярус ${tier} — Этаж ${floor}`, {
      fontFamily: UI.font.title,
      fontSize: '31px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 92, modifierName, {
      fontFamily: UI.font.title,
      fontSize: '32px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
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

    const panelY = 165;

    createPanel(this, width / 2, panelY, 620, 95, {
      alpha: 0.58,
      stroke: false,
      warm: true,
    });

    createSmallText(this, width / 2, panelY, getFloorDescription(floor), {
      fontSize: '16px',
      color: UI.colors.textMuted,
      width: 540,
    });
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

    const y = 260;
    const gap = 90;
    const startX = width / 2 - ((rooms.length - 1) * gap) / 2;

    rooms.forEach((room, index) => {
      const x = startX + index * gap;

      const isCompleted = room.completed || index < currentIndex;
      const isCurrent = index === currentIndex;
      const isLocked = index > currentIndex;

      const fillColor = isCompleted
        ? 0x1c3a24
        : isCurrent
          ? 0x2b1d13
          : 0x111111;

      const strokeColor = isCompleted
        ? 0x75d184
        : isCurrent
          ? UI.colors.gold
          : 0x3a2518;

      if (index > 0) {
        this.add.rectangle(
          x - gap / 2,
          y,
          gap - 38,
          4,
          0x3a2518,
          0.7
        );
      }

      this.add.circle(x, y + 4, isCurrent ? 30 : 27, 0x000000, 0.32);

      this.add.circle(x, y, isCurrent ? 29 : 26, fillColor, isLocked ? 0.55 : 0.98)
        .setStrokeStyle(isCurrent ? 3 : 2, strokeColor, isCurrent ? 0.95 : 0.6);

      this.add.text(x, y, this.getRoomIcon(room.type), {
        fontFamily: UI.font.body,
        fontSize: isCurrent ? '25px' : '22px',
        color: isLocked
          ? '#555555'
          : isCompleted
            ? UI.colors.green
            : UI.colors.goldText,
      }).setOrigin(0.5);
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

    const panelY = 600;

    const isBossRoom = room.type === 'boss' || room.type === 'tier_boss';
    const panelHeight = isBossRoom ? 470 : 410;

    createPanel(this, width / 2, panelY, 620, panelHeight, {
      alpha: 0.88,
      stroke: true,
      warm: isBossRoom,
    });

    this.add.circle(width / 2, panelY - 135, 42, 0x2a1d13, 1)
      .setStrokeStyle(2, this.getRoomStrokeColor(room.type), 0.65);

    this.add.text(width / 2, panelY - 135, this.getRoomIcon(room.type), {
      fontFamily: UI.font.body,
      fontSize: '34px',
      color: this.getRoomTextColor(room.type),
    }).setOrigin(0.5);

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

    this.add.text(width / 2, panelY - 78, roomTitle, {
      fontFamily: UI.font.title,
      fontSize: '38px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    createSmallText(this, width / 2, panelY - 20, room.description, {
      fontSize: '19px',
      color: UI.colors.text,
      width: 540,
    });

    createSmallText(this, width / 2, panelY + 50, this.getRoomInfo(room.type) + this.getModifierWarning(), {
      fontSize: '16px',
      color: UI.colors.textMuted,
      width: 540,
    });

    if (room.type === 'boss' || room.type === 'tier_boss') {
      this.createBossRequirementInfo(panelY + 130);
    }

    this.createRoomButton(room.type, room.enemyId);
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

    this.add.rectangle(width / 2, y, 540, 86, isReady ? 0x102016 : 0x241010, 0.72)
      .setStrokeStyle(2, isReady ? 0x75d184 : 0xff6b6b, 0.65);

    this.add.text(width / 2, y - 27, 'Рекомендуется для босса', {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: isReady ? UI.colors.green : UI.colors.red,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const text = [
      `Ур. ${recommendedLevel} / ${player.level}`,
      `Сила ${recommendedStrength} / ${stats.attack}`,
      `HP ${recommendedHp} / ${stats.maxHp}`,
    ].join('  •  ');

    this.add.text(width / 2, y + 12, text, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 500,
      },
    }).setOrigin(0.5);
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

    let buttonText = 'Продолжить';

    const isBattleRoom =
    type === 'monster' ||
    type === 'elite' ||
    type === 'boss' ||
    type === 'tier_boss';

    if (type === 'monster') buttonText = 'В бой';
    if (type === 'elite') buttonText = 'Сразиться с элитой';
    if (type === 'boss') buttonText = 'Войти к боссу';
    if (type === 'tier_boss') buttonText = 'Финальный бой';
    if (type === 'chest') buttonText = 'Открыть сундук';
    if (type === 'trap') buttonText = 'Пройти осторожно';

    const buttonY =
    type === 'boss' || type === 'tier_boss'
      ? 815
      : 745;

    if (isBattleRoom) {
  if (!enemyId) return;

  const isBoss = type === 'boss' || type === 'tier_boss';

  createButton(
      this,
      width / 2,
      isBoss ? 785 : 710,
      'Подготовиться',
      () => {
        this.scene.start('InventoryScene', {
          returnScene: 'DungeonScene',
        });
      },
      430,
      54
    );
  
    createButton(
      this,
      width / 2,
      isBoss ? 850 : 775,
      buttonText,
      () => {
        this.scene.start('BattleScene', {
          enemyId,
          returnToDungeon: true,
        });
      },
      430,
      60,
      {
        danger: isBoss,
      }
    );
  
    return;
  }


    createButton(
      this,
      width / 2,
      buttonY,
      buttonText,
      () => {
        if (
          type === 'monster' ||
          type === 'elite' ||
          type === 'boss' ||
          type === 'tier_boss'
        ) {
          if (!enemyId) return;

          this.scene.start('BattleScene', {
            enemyId,
            returnToDungeon: true,
          });

          return;
        }

        if (type === 'chest') {
          this.openChest();
          return;
        }

        if (type === 'trap') {
          this.triggerTrap();
        }
      },
      430,
      60,
      {
        danger: type === 'boss' || type === 'tier_boss',
      }
    );
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