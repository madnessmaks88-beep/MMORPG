import Phaser from 'phaser';

import {
  gameState,
  getTierEndFloor,
  getTierStartFloor,
} from '../data/gameState';

import {
  canStartTier,
  getHighestUnlockedTier,
  startTierGateBoss,
  startTierRun,
} from '../systems/FloorSystem';

import { saveGameAsync } from '../systems/SaveSystem';
import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

import {
  UI,
  createPanel,
  createSceneBackground,
  createSmallText,
  createTitle,
} from '../ui/theme';

export class DungeonSelectScene extends Phaser.Scene {
  constructor() {
    super('DungeonSelectScene');
  }

  create() {
    createSceneBackground(this);
    createTitle(this, 'Выбор яруса', 'Ярус нужно пройти от начала до конца');

    this.createProgressPanel();
    this.createTierCard(1, 380);

    const unlockedTier = getHighestUnlockedTier();

    if (unlockedTier >= 2) {
      this.createTierCard(2, 710);
    } else {
      this.createLockedTierCard(2, 710);
    }

    createBottomNav(this, {
      activeScene: 'CampScene',
    });
  }

  private createProgressPanel() {
    const { width } = this.scale;

    const panelY = 180;
    const unlockedTier = getHighestUnlockedTier();

    createPanel(this, width / 2, panelY, 620, 135, {
      alpha: 0.72,
      stroke: false,
      warm: true,
    });

    this.add.text(width / 2, panelY - 42, 'Прогресс спуска', {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    const text = [
      `Рекорд этажа: ${gameState.highestClearedFloor}`,
      `Пройдено ярусов: ${gameState.highestClearedTier}`,
      `Доступный ярус: ${unlockedTier}`,
    ].join('\n');

    this.add.text(width / 2, panelY + 20, text, {
      fontFamily: UI.font.body,
      fontSize: '17px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 5,
    }).setOrigin(0.5);
  }

  private createTierCard(tier: number, y: number) {
    const { width } = this.scale;

    const startFloor = getTierStartFloor(tier);
    const endFloor = getTierEndFloor(tier);

    const isCleared = gameState.highestClearedTier >= tier;
    const isAvailable = canStartTier(tier);

    createPanel(this, width / 2, y, 620, 285, {
      alpha: 0.88,
      stroke: true,
      warm: tier === 1,
    });

    this.add.circle(width / 2, y - 95, 34, 0x2a1d13, 1)
      .setStrokeStyle(2, isCleared ? 0x75d184 : UI.colors.goldDark, 0.6);

    this.add.text(width / 2, y - 95, `${tier}`, {
      fontFamily: UI.font.title,
      fontSize: '27px',
      color: isCleared ? UI.colors.green : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(width / 2, y - 54, `${tier}-й ярус`, {
      fontFamily: UI.font.title,
      fontSize: '32px',
      color: isCleared ? UI.colors.green : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const status = isCleared ? 'Пройден' : isAvailable ? 'Доступен' : 'Закрыт';

    this.add.text(width / 2, y - 18, status, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: isCleared ? UI.colors.green : UI.colors.text,
    }).setOrigin(0.5);

    const description = [
      `Этажи: ${startFloor}–${endFloor}`,
      `Если выйти в город до конца яруса — проход начнётся заново.`,
      `Финальный босс ждёт на ${endFloor} этаже.`,
    ].join('\n');

    createSmallText(this, width / 2, y + 42, description, {
      fontSize: '17px',
      color: UI.colors.text,
      width: 540,
    });

    createButton(
      this,
      width / 2,
      y + 112,
      `Начать с ${startFloor} этажа`,
      () => {
        startTierRun(tier);

        void saveGameAsync();

        this.scene.start('DungeonScene');
      },
      360,
      52,
      {
        disabled: !isAvailable,
      }
    );

    if (tier > 1 && gameState.highestClearedTier >= tier - 1) {
      createButton(
        this,
        width / 2,
        y + 174,
        `Победить босса ${tier - 1}-го яруса`,
        () => {
          startTierGateBoss(tier);

          void saveGameAsync();

          this.scene.start('DungeonScene');
        },
        460,
        50,
        {
          small: true,
        }
      );
    }
  }

  private createLockedTierCard(tier: number, y: number) {
    const { width } = this.scale;

    createPanel(this, width / 2, y, 620, 255, {
      alpha: 0.62,
      stroke: false,
      warm: false,
    });

    this.add.circle(width / 2, y - 70, 32, 0x151515, 1)
      .setStrokeStyle(2, 0x444444, 0.5);

    this.add.text(width / 2, y - 70, '×', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: '#666666',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(width / 2, y - 25, `${tier}-й ярус`, {
      fontFamily: UI.font.title,
      fontSize: '31px',
      color: '#666666',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    createSmallText(
      this,
      width / 2,
      y + 40,
      `Закрыт.\nСначала пройди ${tier - 1}-й ярус и победи его финального босса.`,
      {
        fontSize: '19px',
        color: UI.colors.textMuted,
        width: 520,
      }
    );
  }
}