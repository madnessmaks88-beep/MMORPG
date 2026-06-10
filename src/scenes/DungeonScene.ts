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
  getFloorTitle,
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
  createSectionTitle,
  createSmallText,
  createTitle,
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
    const floor = gameState.floorRun.currentFloor;
    const tier = getCurrentTierByFloor(floor);
    const modifierName = getFloorModifierName(gameState.floorRun.modifier);

    createTitle(
      this,
      getFloorTitle(floor),
      `${tier}-й ярус  •  ${modifierName}`
    );
  }

  private createNextFloorInfo(y: number, nextFloor: number) {
    const { width } = this.scale;

    const stats = getPlayerStats(player);
    const requirement = getFloorRequirement(nextFloor);

    const isDangerous =
      player.level < requirement.level ||
      stats.attack < requirement.attack ||
      stats.defense < requirement.defense ||
      stats.maxHp < requirement.hp;

    this.add.rectangle(width / 2, y, 560, 130, 0x171313, 0.95)
      .setStrokeStyle(2, isDangerous ? 0xff4d4d : 0x75d184);

    this.add.text(width / 2, y - 48, `Следующий этаж: ${nextFloor}`, {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: isDangerous ? '#ff6b6b' : '#75d184',
    }).setOrigin(0.5);

    const text = [
      `Уровень: ${requirement.level} / твой ${player.level}`,
      `Атака: ${requirement.attack} / твоя ${stats.attack}`,
      `Защита: ${requirement.defense} / твоя ${stats.defense}`,
      `HP: ${requirement.hp} / твоё ${stats.maxHp}`,
    ].join('\n');

    this.add.text(width / 2, y + 8, text, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      y + 58,
      isDangerous ? 'Опасно: характеристики ниже рекомендуемых' : 'Можно продолжать спуск',
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: isDangerous ? '#ff6b6b' : '#75d184',
      }
    ).setOrigin(0.5);
  }

  private createFloorProgress() {
    const { width } = this.scale;

    const floor = gameState.floorRun.currentFloor;
    const rooms = gameState.floorRun.rooms;
    const currentIndex = gameState.floorRun.currentRoomIndex;

    const totalRooms = rooms.length;
    const currentRoom = Math.min(currentIndex + 1, totalRooms);

    const progress = totalRooms > 0
      ? Phaser.Math.Clamp(currentIndex / totalRooms, 0, 1)
      : 0;

    const panelY = 175;

    createPanel(this, width / 2, panelY, 620, 135, {
      alpha: 0.72,
      stroke: false,
      warm: true,
    });

    this.add.text(width / 2, panelY - 42, `Комната ${currentRoom}/${totalRooms}`, {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, panelY + 2, 500, 12, 0x080808, 0.9);
    this.add.rectangle(width / 2 - 250 + (500 * progress) / 2, panelY + 2, 500 * progress, 12, UI.colors.goldDark, 0.95);

    createSmallText(this, width / 2, panelY + 42, getFloorDescription(floor), {
      fontSize: '14px',
      color: UI.colors.textMuted,
      width: 540,
    });
  }

  private createRoomMap() {
    const { width } = this.scale;

    const rooms = gameState.floorRun.rooms;
    const currentIndex = gameState.floorRun.currentRoomIndex;

    const y = 285;
    const gap = 76;
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
        this.add.rectangle(x - gap / 2, y, gap - 34, 2, 0x3a2518, 0.55);
      }

      this.add.circle(x, y + 3, 22, 0x000000, 0.28);

      this.add.circle(x, y, 21, fillColor, isLocked ? 0.55 : 0.95)
        .setStrokeStyle(2, strokeColor, isCurrent ? 0.9 : 0.55);

      this.add.text(x, y, this.getRoomIcon(room.type), {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: isLocked ? '#555555' : isCompleted ? UI.colors.green : UI.colors.goldText,
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

    const panelY = 585;

    createPanel(this, width / 2, panelY, 620, 410, {
      alpha: 0.88,
      stroke: true,
      warm: room.type === 'boss' || room.type === 'tier_boss',
    });

    this.add.circle(width / 2, panelY - 135, 42, 0x2a1d13, 1)
      .setStrokeStyle(2, this.getRoomStrokeColor(room.type), 0.65);

    this.add.text(width / 2, panelY - 135, this.getRoomIcon(room.type), {
      fontFamily: UI.font.body,
      fontSize: '34px',
      color: this.getRoomTextColor(room.type),
    }).setOrigin(0.5);

    createSectionTitle(this, width / 2, panelY - 78, room.title);

    createSmallText(this, width / 2, panelY - 20, room.description, {
      fontSize: '19px',
      color: UI.colors.text,
      width: 540,
    });

    createSmallText(this, width / 2, panelY + 68, this.getRoomInfo(room.type) + this.getModifierWarning(), {
      fontSize: '16px',
      color: UI.colors.textMuted,
      width: 540,
    });

    this.createRoomButton(room.type, room.enemyId);
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

    if (type === 'monster') buttonText = 'В бой';
    if (type === 'elite') buttonText = 'Сразиться с элитой';
    if (type === 'boss') buttonText = 'Войти к боссу';
    if (type === 'tier_boss') buttonText = 'Финальный бой';
    if (type === 'chest') buttonText = 'Открыть сундук';
    if (type === 'trap') buttonText = 'Пройти осторожно';

    createButton(
      this,
      width / 2,
      745,
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

  private createFloorJournal(y: number) {
    const { width } = this.scale;

    const run = gameState.floorRun;

    this.add.rectangle(width / 2, y, 560, 125, 0x171313, 0.95)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, y - 45, 'Журнал этажа', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    const text = [
      `Монстров побеждено: ${run.monstersDefeated}`,
      `Сундуков открыто: ${run.chestsOpened}`,
      `Ловушек встречено: ${run.trapsTriggered}`,
      `Всего золота: +${run.goldEarned}`,
      `Всего опыта: +${run.expEarned}`,
    ].join('\n');

    this.add.text(width / 2, y + 20, text, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 3,
    }).setOrigin(0.5);
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

    const { width } = this.scale;

    this.add.rectangle(width / 2, 560, 620, 620, 0x0d0d0d, 0.95)
      .setStrokeStyle(3, 0x75d184);

    this.add.text(width / 2, 285, 'Этаж зачищен', {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#75d184',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 345, `Ты полностью прошёл этаж ${floor}.`, {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#d8c7a3',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(width / 2, 445, rewardText, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#d8c7a3',
      align: 'center',
      wordWrap: {
        width: 560,
      },
      lineSpacing: 5,
    }).setOrigin(0.5);

    this.createFloorJournal(560);

    this.createNextFloorInfo(690, nextFloor);

    this.createLargeButton(width / 2, 850, 'Продолжить ниже', () => {
      startFloorRun(nextFloor);

      void saveGameAsync();

      this.scene.restart();
    });

    this.createLargeButton(width / 2, 935, 'Вернуться в город', () => {
      resetFloorRun();

      void saveGameAsync();

      this.scene.start('CampScene');
    });
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

    this.createLargeButton(width / 2, 650, `Начать ${targetTier}-й ярус`, () => {
      startFloorRun(startFloor);

      void saveGameAsync();

      this.scene.restart();
    });

    this.createLargeButton(width / 2, 735, 'Вернуться в город', () => {
      resetFloorRun();

      void saveGameAsync();

      this.scene.start('CampScene');
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

    this.createLargeButton(width / 2, 910, 'Продолжить на новый ярус', () => {
      startFloorRun(nextFloor);

      void saveGameAsync();

      this.scene.restart();
    });

    this.createLargeButton(width / 2, 995, 'Вернуться в город', () => {
      resetFloorRun();

      void saveGameAsync();

      this.scene.start('CampScene');
    });
  }

  private createLargeButton(
    x: number,
    y: number,
    text: string,
    subtitleOrOnClick: string | (() => void),
    maybeOnClick?: () => void
  ) {
    const onClick =
      typeof subtitleOrOnClick === 'function'
        ? subtitleOrOnClick
        : maybeOnClick;

    if (!onClick) {
      return;
    }

    return createButton(
      this,
      x,
      y,
      text,
      onClick,
      430,
      58
    );
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