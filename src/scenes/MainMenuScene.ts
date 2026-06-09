import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState, resetFloorRun } from '../data/gameState';

import { getRaceById } from '../data/races';

import { clearSave, saveGameAsync } from '../systems/SaveSystem';

import { createButton } from '../ui/createButton';

import {
  UI,
  createPanel,
  createSceneBackground,
  createSmallText,
  createTitle,
} from '../ui/theme';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    createSceneBackground(this);

    createTitle(this, 'Ниже Пепла', 'Мрачное фэнтези о спуске в катакомбы');

    this.createHeroPanel();
    this.createMainButtons();
    this.createFooter();
  }

  private createHeroPanel() {
    const { width } = this.scale;

    createPanel(this, width / 2, 310, 620, 260, {
      alpha: 0.82,
      stroke: true,
      warm: true,
    });

    const raceName = player.raceId ? getRaceById(player.raceId).name : 'Раса не выбрана';

    this.add.text(width / 2, 220, player.name, {
      fontFamily: UI.font.title,
      fontSize: '34px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, 265, raceName, {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: UI.colors.textMuted,
    }).setOrigin(0.5);

    const text = [
      `Уровень: ${player.level}`,
      `HP: ${player.hp}/${player.maxHp}`,
      `Золото: ${player.gold}`,
      `Рекорд этажа: ${gameState.highestClearedFloor}`,
      `Пройдено ярусов: ${gameState.highestClearedTier}`,
    ].join('\n');

    this.add.text(width / 2, 355, text, {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 7,
    }).setOrigin(0.5);
  }

  private createMainButtons() {
    const { width } = this.scale;

    createPanel(this, width / 2, 690, 620, 430, {
      alpha: 0.86,
      stroke: true,
      warm: false,
    });

    createButton(
      this,
      width / 2,
      570,
      'Продолжить',
      () => {
        if (!player.raceId) {
          this.scene.start('RaceSelectScene');
          return;
        }

        this.scene.start('CampScene');
      },
      520,
      64
    );

    createButton(
      this,
      width / 2,
      650,
      'Лагерь',
      () => {
        this.scene.start('CampScene');
      },
      520,
      64,
      {
        disabled: !player.raceId,
      }
    );

    createButton(
      this,
      width / 2,
      730,
      'Профиль героя',
      () => {
        this.scene.start('ProfileScene');
      },
      520,
      64,
      {
        disabled: !player.raceId,
      }
    );

    createButton(
      this,
      width / 2,
      830,
      'Новая игра',
      () => {
        this.showResetConfirm();
      },
      520,
      60,
      {
        danger: true,
      }
    );
  }

  private showResetConfirm() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setDepth(100);

    createPanel(this, width / 2, height / 2, 610, 330, {
      alpha: 0.98,
      stroke: true,
      warm: true,
    }).setDepth(101);

    this.add.text(width / 2, height / 2 - 105, 'Начать заново?', {
      fontFamily: UI.font.title,
      fontSize: '31px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(102);

    this.add.text(
      width / 2,
      height / 2 - 30,
      'Текущий прогресс будет сброшен.\nЭто действие нельзя отменить.',
      {
        fontFamily: UI.font.body,
        fontSize: '20px',
        color: UI.colors.text,
        align: 'center',
        lineSpacing: 6,
        wordWrap: {
          width: 520,
        },
      }
    ).setOrigin(0.5).setDepth(102);

    const yes = createButton(
      this,
      width / 2,
      height / 2 + 70,
      'Да, начать заново',
      () => {
        clearSave();
        this.resetRuntimeState();
        this.scene.start('RaceSelectScene');
      },
      420,
      56,
      {
        danger: true,
      }
    );

    yes.shadow.setDepth(101);
    yes.bg.setDepth(102);
    yes.label.setDepth(103);

    const no = createButton(
      this,
      width / 2,
      height / 2 + 140,
      'Отмена',
      () => {
        this.scene.restart();
      },
      420,
      56
    );

    no.shadow.setDepth(101);
    no.bg.setDepth(102);
    no.label.setDepth(103);
  }

  private resetRuntimeState() {
    player.name = 'Безымянный';
    player.raceId = undefined;

    player.level = 1;
    player.exp = 0;
    player.expToNextLevel = 70;
    player.gold = 0;

    player.maxHp = 100;
    player.hp = 100;

    player.maxEnergy = 3;
    player.energy = 3;

    player.potions = 2;

    player.attack = 12;
    player.defense = 3;
    player.critChance = 0.1;

    player.agility = 5;
    player.luck = 5;
    player.strength = 11;
    player.intelligence = 11;

    player.relicIds = [];

    player.inventory = [];
    player.equipment = {};

    gameState.highestClearedFloor = 0;
    gameState.highestClearedTier = 0;
    gameState.lastCampRestAt = 0;

    gameState.questProgress.enemiesKilled = 0;
    gameState.questProgress.chestsOpened = 0;
    gameState.questProgress.dungeonsCompleted = 0;
    gameState.questProgress.goldEarned = 0;
    gameState.questProgress.claimedQuestIds = [];

    resetFloorRun();

    void saveGameAsync();
  }

  private createFooter() {
    const { width, height } = this.scale;

    createSmallText(
      this,
      width / 2,
      height - 55,
      'Версия прототипа • VK Games',
      {
        fontSize: '15px',
        color: UI.colors.textMuted,
        width: 520,
      }
    );
  }
}