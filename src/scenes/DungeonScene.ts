import Phaser from 'phaser';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

import { player } from '../data/player';
import { getDungeonById } from '../data/dungeons';
import { gameState, goToNextRoom, unlockDungeon } from '../data/gameState';
import { getRandomLootItem } from '../data/items';

import { addExperience, createLevelUpText } from '../systems/LevelSystem';
import {
  addItemToInventory,
  getPlayerStats,
  rollItemDrop,
} from '../systems/InventorySystem';
import { saveGameAsync } from '../systems/SaveSystem';

import {
  trackChestOpened,
  trackDungeonCompleted,
  trackGoldEarned,
} from '../systems/QuestSystem';

export class DungeonScene extends Phaser.Scene {
  constructor() {
    super('DungeonScene');
  }

  create() {
    const { width, height } = this.scale;
    const dungeon = getDungeonById(gameState.currentDungeonId);
    const currentRoom = dungeon.rooms[gameState.currentRoomIndex];
    const stats = getPlayerStats(player);

    this.add.rectangle(width / 2, height / 2, width, height, 0x070707);

    this.createBackground();

    this.add.text(width / 2, 60, dungeon.name, {
      fontFamily: 'Arial',
      fontSize: '44px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      112,
      `Спуск ${gameState.currentRoomIndex + 1}/${dungeon.rooms.length}`,
      {
        fontFamily: 'Arial',
        fontSize: '23px',
        color: '#8f826d',
      }
    ).setOrigin(0.5);

    if (!currentRoom) {
      this.showDungeonCompleted();
      return;
    }

    this.createDungeonPath();

    this.add.rectangle(width / 2, 830, 620, 96, 0x171313);

    this.add.text(
      width / 2,
      830,
      `HP: ${player.hp}/${stats.maxHp}    EN: ${player.energy}/${player.maxEnergy}\nЗолото: ${player.gold}    Опыт: ${player.exp}/${player.expToNextLevel}`,
      {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#e6d2aa',
        align: 'center',
        lineSpacing: 7,
      }
    ).setOrigin(0.5);

    this.createRoomInfo(currentRoom);

    this.createRoomAction(currentRoom);

    createBottomNav(this);
  }

  private createBackground() {
    const { width, height } = this.scale;

    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(30, width - 30);
      const y = Phaser.Math.Between(160, height - 180);
      const alpha = Phaser.Math.FloatBetween(0.08, 0.18);

      this.add.circle(x, y, Phaser.Math.Between(1, 3), 0x8b5a2b, alpha);
    }

    this.add.rectangle(width / 2, 500, 500, 680, 0x0b0b0b, 0.65);
  }

  private createDungeonPath() {
    const { width } = this.scale;
    const dungeon = getDungeonById(gameState.currentDungeonId);

    const startY = 220;
    const stepY = 100;
    const centerX = width / 2;

    for (let i = 0; i < dungeon.rooms.length - 1; i++) {
      const y1 = startY + i * stepY;
      const y2 = startY + (i + 1) * stepY;

      const isPassed = i < gameState.currentRoomIndex;

      const line = this.add.rectangle(
        centerX,
        (y1 + y2) / 2,
        8,
        stepY - 48,
        isPassed ? 0xd8b56d : 0x3b3028
      );

      line.setAlpha(isPassed ? 0.9 : 0.45);
    }

    dungeon.rooms.forEach((room, index) => {
      const y = startY + index * stepY;
      const isPassed = index < gameState.currentRoomIndex;
      const isCurrent = index === gameState.currentRoomIndex;
      const isLocked = index > gameState.currentRoomIndex;

      let fillColor = 0x1a1512;
      let strokeColor = 0x5b4632;
      let textColor = '#8f826d';

      if (isPassed) {
        fillColor = 0x2c2115;
        strokeColor = 0xd8b56d;
        textColor = '#d8b56d';
      }

      if (isCurrent) {
        fillColor = 0x3a2020;
        strokeColor = 0xf0d58a;
        textColor = '#f0d58a';
      }

      if (isLocked) {
        fillColor = 0x101010;
        strokeColor = 0x2d2924;
        textColor = '#4f4940';
      }

      const radius = room.type === 'boss' ? 46 : 38;

      const node = this.add.circle(centerX, y, radius, fillColor);
      node.setStrokeStyle(4, strokeColor);

      if (isCurrent) {
        this.tweens.add({
          targets: node,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: 700,
          yoyo: true,
          repeat: -1,
        });
      }

      const icon = this.getRoomIcon(room.type);

      this.add.text(centerX, y - 2, icon, {
        fontFamily: 'Arial',
        fontSize: room.type === 'boss' ? '38px' : '32px',
        color: textColor,
      }).setOrigin(0.5);

      this.add.text(centerX + 78, y, this.getRoomShortLabel(room.type), {
        fontFamily: 'Arial',
        fontSize: '23px',
        color: textColor,
      }).setOrigin(0, 0.5);

      if (isPassed) {
        this.add.text(centerX - 78, y, '✓', {
          fontFamily: 'Arial',
          fontSize: '30px',
          color: '#d8b56d',
        }).setOrigin(1, 0.5);
      }
    });
  }

  private createRoomInfo(currentRoom: any) {
    const { width } = this.scale;

    this.add.rectangle(width / 2, 660, 620, 210, 0x121212);
    this.add.rectangle(width / 2, 660, 580, 170, 0x181414);

    this.add.text(width / 2, 600, currentRoom.title, {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#e6d2aa',
      align: 'center',
      wordWrap: {
        width: 560,
      },
    }).setOrigin(0.5);

    this.add.text(width / 2, 690, currentRoom.description, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#b8aa91',
      align: 'center',
      wordWrap: {
        width: 540,
      },
      lineSpacing: 7,
    }).setOrigin(0.5);
  }

  private createRoomAction(currentRoom: any) {
    const { width } = this.scale;

    if (currentRoom.type === 'enemy' || currentRoom.type === 'boss') {
      const buttonText = currentRoom.type === 'boss'
        ? 'Сразиться с боссом'
        : 'Вступить в бой';

      createButton(this, width / 2, 960, buttonText, () => {
        this.scene.start('BattleScene', {
          enemyId: currentRoom.enemyId,
          returnToDungeon: true,
        });
      }, 520, 72);
    }

    if (currentRoom.type === 'chest') {
      createButton(this, width / 2, 960, 'Открыть сундук', () => {
        this.openChest();
      }, 520, 72);
    }

    if (currentRoom.type === 'trap') {
      createButton(this, width / 2, 960, 'Пройти через ловушку', () => {
        this.triggerTrap();
      }, 520, 72);
    }
  }

  private openChest() {
    const gold = Phaser.Math.Between(12, 28);

    player.gold += gold;

    trackChestOpened();
    trackGoldEarned(gold);

    const expResult = addExperience(player, 12);

    let itemText = '';

    if (rollItemDrop(player, 0.45)) {
      const item = getRandomLootItem();

      addItemToInventory(player, item.id);

      itemText = `\nНайден предмет: ${item.name}`;
    }

    let levelText = '';

    if (expResult.leveledUp) {
      levelText = `\n\n${createLevelUpText(expResult)}`;
    }

    goToNextRoom();

    void saveGameAsync();

    this.showMessage(
      `Ты открыл сундук.\n\nЗолото: +${gold}\nОпыт: +12${itemText}${levelText}`,
      () => {
        this.scene.restart();
      }
    );
  }

  private triggerTrap() {
    const stats = getPlayerStats(player);

    if (Math.random() < stats.trapDodgeChance) {
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

    const damage = Phaser.Math.Between(14, 28);

    player.hp = Math.max(0, player.hp - damage);

    if (player.hp <= 0) {
      this.showMessage(
        `Ты попал в смертельную ловушку.\n\nПолучено урона: ${damage}\n\nТы едва выбрался обратно в лагерь...`,
        () => {
          const freshStats = getPlayerStats(player);

          player.hp = freshStats.maxHp;
          player.energy = player.maxEnergy;

          void saveGameAsync();

          this.scene.start('CampScene');
        }
      );

      return;
    }

    goToNextRoom();

    void saveGameAsync();

    this.showMessage(
      `Ты попал в ловушку.\n\nПолучено урона: ${damage}\nHP: ${player.hp}/${stats.maxHp}`,
      () => {
        this.scene.restart();
      }
    );
  }

  private showDungeonCompleted() {
    const { width, height } = this.scale;

    const dungeon = getDungeonById(gameState.currentDungeonId); 

    if (!gameState.dungeonCompleted) {
      trackDungeonCompleted();
      gameState.dungeonCompleted = true;
    }

    if (dungeon.nextDungeonId) {
      unlockDungeon(dungeon.nextDungeonId);
      void saveGameAsync();
    }

    this.children.removeAll();

    this.add.rectangle(width / 2, height / 2, width, height, 0x070707);

    this.add.text(width / 2, 270, 'Подземелье\nпройдено', {
      fontFamily: 'Arial',
      fontSize: '58px',
      color: '#d8b56d',
      align: 'center',
      lineSpacing: -4,
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      505,
      dungeon.nextDungeonId
        ? 'Ты прошёл этот ярус.\n\nГде-то ниже открылась\nновая дорога.'
        : 'Ты прошёл последний доступный ярус.\n\nНо тьма всё ещё\nне закончилась.',
      {
        fontFamily: 'Arial',
        fontSize: '30px',
        color: '#b8aa91',
        align: 'center',
        lineSpacing: 8,
        wordWrap: {
          width: 560,
        },
      }
    ).setOrigin(0.5);

    createButton(this, width / 2, 760, 'Вернуться в лагерь', () => {
      this.scene.start('CampScene');
    }, 520, 72);

    createBottomNav(this, {
      activeScene: 'DungeonScene',
      disabledScenes: ['CampScene'],
      disabledMessage: 'Нельзя уйти в лагерь, пока ты в подземелье.',
    });
  }

  private showMessage(message: string, onContinue: () => void) {
    const { width, height } = this.scale;

    this.children.removeAll();

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.add.rectangle(width / 2, height / 2, 620, 460, 0x181414);
    this.add.rectangle(width / 2, height / 2, 580, 420, 0x0d0d0d);

    this.add.text(width / 2, height / 2 - 70, message, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#e6d2aa',
      align: 'center',
      lineSpacing: 8,
      wordWrap: {
        width: 520,
      },
    }).setOrigin(0.5);

    createButton(this, width / 2, height / 2 + 165, 'Продолжить', onContinue, 440, 70);
  }

  private getRoomIcon(type: string): string {
    if (type === 'enemy') return '☠';
    if (type === 'chest') return '▣';
    if (type === 'trap') return '⚠';
    if (type === 'boss') return '♛';

    return '?';
  }

  private getRoomShortLabel(type: string): string {
    if (type === 'enemy') return 'Враг';
    if (type === 'chest') return 'Сундук';
    if (type === 'trap') return 'Ловушка';
    if (type === 'boss') return 'Босс';

    return 'Комната';
  }
}