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
  
  constructor() {
    super('DungeonScene');
  }

  create() {
    if (!gameState.floorRun.active || gameState.floorRun.rooms.length === 0) {
      startFloorRun(gameState.highestClearedFloor + 1);
      void saveGameAsync();
    }

    this.createBackground();
    this.createHeader();
    this.createFloorProgress();
    this.createCurrentRoom();
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x070707);
    this.add.rectangle(width / 2, height / 2, width, height, 0x100c0a, 0.92);

    for (let i = 0; i < 38; i++) {
      const x = Phaser.Math.Between(35, width - 35);
      const y = Phaser.Math.Between(35, height - 35);
      const size = Phaser.Math.Between(1, 3);

      this.add.circle(x, y, size, 0xd8b56d, 0.06);
    }

    this.add.rectangle(width / 2, height - 80, width, 170, 0x030303, 0.55);
  }

  private createHeader() {
    const { width } = this.scale;

    const floor = gameState.floorRun.currentFloor;
    const tier = getCurrentTierByFloor(floor);

    this.add.text(width / 2, 50, getFloorTitle(floor), {
      fontFamily: 'Arial',
      fontSize: '40px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 92, `Ярус ${tier}`, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#9c8f7a',
    }).setOrigin(0.5);

    this.add.text(width / 2, 118, getFloorModifierName(gameState.floorRun.modifier), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#f0d58a',
    }).setOrigin(0.5);
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
    const currentRoomIndex = gameState.floorRun.currentRoomIndex;
    const totalRooms = gameState.floorRun.rooms.length;

    this.add.rectangle(width / 2, 170, 610, 115, 0x0d0d0d, 0.92)
      .setStrokeStyle(2, 0x8b5a2b);

    this.add.text(width / 2, 135, 'Прогресс этажа', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    this.add.text(width / 2, 173, `Комната ${Math.min(currentRoomIndex + 1, totalRooms)} / ${totalRooms}`, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#d8c7a3',
    }).setOrigin(0.5);

    const barWidth = 500;
    const progress = totalRooms > 0 ? currentRoomIndex / totalRooms : 0;

    this.add.rectangle(width / 2, 215, barWidth, 18, 0x221818)
      .setStrokeStyle(1, 0x3a2a1a);

    this.add.rectangle(
      width / 2 - barWidth / 2,
      215,
      barWidth * progress,
      18,
      0xf0d58a
    ).setOrigin(0, 0.5);

    this.add.text(width / 2, 255, getFloorDescription(floor), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#8f826d',
      align: 'center',
      lineSpacing: 4,
      wordWrap: {
        width: 560,
      },
    }).setOrigin(0.5, 0);
  }

  private createCurrentRoom() {
    if (isCurrentFloorCompleted()) {
      this.showFloorCompleted();
      return;
    }

    const room = getCurrentRoom();

    if (!room) {
      this.showFloorCompleted();
      return;
    }

    const { width } = this.scale;

    const cardY = 520;

    this.add.rectangle(width / 2, cardY, 610, 360, 0x0d0d0d, 0.94)
      .setStrokeStyle(3, this.getRoomStrokeColor(room.type));

    this.add.text(width / 2, cardY - 145, this.getRoomIcon(room.type), {
      fontFamily: 'Arial',
      fontSize: '56px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    this.add.text(width / 2, cardY - 85, room.title, {
      fontFamily: 'Arial',
      fontSize: '31px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, cardY - 25, room.description, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#d8c7a3',
      align: 'center',
      wordWrap: {
        width: 500,
      },
      lineSpacing: 6,
    }).setOrigin(0.5);

    this.add.text(width / 2, cardY + 70, this.getRoomInfo(room.type) + this.getModifierWarning(), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#9c8f7a',
      align: 'center',
      wordWrap: {
        width: 520,
      },
      lineSpacing: 5,
    }).setOrigin(0.5);

    this.createRoomButton(room.type, room.enemyId);
  }

  private createRoomButton(roomType: string, enemyId?: string) {
    const { width } = this.scale;

    const buttonText = this.getActionButtonText(roomType);

    const bg = this.add.rectangle(width / 2, 785, 520, 72, 0x241515)
      .setStrokeStyle(2, 0xf0d58a)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, 785, buttonText, {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    bg.on('pointerdown', () => {
      if (roomType === 'monster' || roomType === 'elite' || roomType === 'boss' || roomType === 'tier_boss') {
        if (!enemyId) {
          return;
        }

        this.scene.start('BattleScene', {
          enemyId,
          returnToDungeon: true,
        });

        return;
      }

      if (roomType === 'chest') {
        this.openChest();
        return;
      }

      if (roomType === 'trap') {
        this.triggerTrap();
        return;
      }
    });
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
        `Ты вовремя заметил ловушку.\n\nЛовкость помогла тебе уклониться.\nУрон не получен.`,
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
        `Ты попал в смертельную ловушку.\n\nПолучено урона: ${damage}\n\nТы едва выбрался обратно в город...`,
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
      `Ты попал в ловушку.\n\nПолучено урона: ${damage}\nHP: ${player.hp}/${stats.maxHp}`,
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

  private createLargeButton(x: number, y: number, text: string, onClick: () => void) {
    const bg = this.add.rectangle(x, y, 520, 70, 0x241515)
      .setStrokeStyle(2, 0xf0d58a)
      .setInteractive({ useHandCursor: true });

    this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    bg.on('pointerdown', onClick);
  }

  private showMessage(message: string, onClose: () => void) {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
      .setDepth(100);

    const panel = this.add.rectangle(width / 2, height / 2, 580, 330, 0x171313)
      .setStrokeStyle(3, 0x8b5a2b)
      .setDepth(101);

    const text = this.add.text(width / 2, height / 2 - 35, message, {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#d8c7a3',
      align: 'center',
      wordWrap: {
        width: 500,
      },
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(102);

    const closeBg = this.add.rectangle(width / 2, height / 2 + 110, 260, 60, 0x241515)
      .setStrokeStyle(2, 0x8b5a2b)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);

    const closeText = this.add.text(width / 2, height / 2 + 110, 'Продолжить', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#f0d58a',
    }).setOrigin(0.5).setDepth(103);

    closeBg.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      text.destroy();
      closeBg.destroy();
      closeText.destroy();

      onClose();
    });
  }

  private getRoomIcon(type: string) {
    if (type === 'monster') return '☠';
    if (type === 'elite') return '♞';
    if (type === 'chest') return '▣';
    if (type === 'trap') return '⚠';
    if (type === 'boss') return '♛';
    if (type === 'tier_boss') return '☼';

    return '?';
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

  private getActionButtonText(type: string) {
    if (type === 'monster') return 'Вступить в бой';
    if (type === 'elite') return 'Сразиться с элитой';
    if (type === 'chest') return 'Открыть сундук';
    if (type === 'trap') return 'Пройти осторожно';
    if (type === 'boss') return 'Сразиться с боссом';
    if (type === 'tier_boss') return 'Битва с финальным боссом';

    return 'Продолжить';
  }

  private getRoomStrokeColor(type: string) {
    if (type === 'monster') return 0x8b5a2b;
    if (type === 'elite') return 0xb46cff;
    if (type === 'chest') return 0xf0d58a;
    if (type === 'trap') return 0xff4d4d;
    if (type === 'boss') return 0xff6b6b;
    if (type === 'tier_boss') return 0xf0d58a;

    return 0x8b5a2b;
  }
}