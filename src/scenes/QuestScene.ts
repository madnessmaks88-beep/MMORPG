import Phaser from 'phaser';

import { gameState } from '../data/gameState';

import {
  claimQuestReward,
  getQuests,
  getQuestProgressValue,
  isQuestCompleted,
  isQuestClaimed,
} from '../systems/QuestSystem';
import { saveGameAsync } from '../systems/SaveSystem';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

import {
  UI,
  createPanel,
  createSceneBackground,
  createSectionTitle,
  createSmallText,
  createTitle,
} from '../ui/theme';

type QuestData = ReturnType<typeof getQuests>[number];



export class QuestScene extends Phaser.Scene {
  constructor() {
    super('QuestScene');
  }

  create() {
    createSceneBackground(this);
    createTitle(this, 'Задания', 'Поручения лагеря и награды за спуск');

    this.createProgressPanel();
    this.createQuestList();

    createBottomNav(this, {
      activeScene: 'CampScene',
    });
  }

  private createProgressPanel() {
    const { width } = this.scale;

    const panelY = 180;

    createPanel(this, width / 2, panelY, 620, 135, {
      alpha: 0.72,
      stroke: false,
      warm: true,
    });

    this.add.text(width / 2, panelY - 42, 'Общий прогресс', {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    const text = [
      `Побеждено врагов: ${gameState.questProgress.enemiesKilled}`,
      `Открыто сундуков: ${gameState.questProgress.chestsOpened}`,
      `Заработано золота: ${gameState.questProgress.goldEarned}`,
      `Пройдено подземелий: ${gameState.questProgress.dungeonsCompleted}`,
    ].join('\n');

    this.add.text(width / 2, panelY + 22, text, {
      fontFamily: UI.font.body,
      fontSize: '17px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 5,
    }).setOrigin(0.5);
  }

  private createQuestList() {
    const { width } = this.scale;

    const panelY = 620;

    createPanel(this, width / 2, panelY, 620, 650, {
      alpha: 0.86,
      stroke: true,
      warm: false,
    });

    createSectionTitle(this, width / 2, panelY - 285, 'Список заданий');

    const questList = getQuests();

  if (questList.length === 0) {
      createSmallText(
        this,
        width / 2,
        panelY,
        'Заданий пока нет.',
        {
          fontSize: '20px',
          color: UI.colors.textMuted,
          width: 540,
        }
      );

      return;
    }

    const visibleQuests = questList.slice(0, 5);

    visibleQuests.forEach((quest: QuestData, index: number) => {
      this.createQuestCard(quest, panelY - 205 + index * 108);
    });

    if (questList.length > visibleQuests.length) {
      createSmallText(
        this,
        width / 2,
        panelY + 285,
        `Показано ${visibleQuests.length} из ${questList.length}. Позже добавим прокрутку.`,
        {
          fontSize: '15px',
          color: UI.colors.textMuted,
          width: 540,
        }
      );
    }
  }

  private createQuestCard(quest: QuestData, y: number) {
    const { width } = this.scale;

    const completed = isQuestCompleted(quest);
    const claimed = isQuestClaimed(quest.id);

    const strokeColor = claimed
      ? 0x3a2518
      : completed
        ? 0x75d184
        : UI.colors.goldDark;

    const titleColor = claimed
      ? UI.colors.textMuted
      : completed
        ? UI.colors.green
        : UI.colors.goldText;

    this.add.rectangle(width / 2, y + 4, 560, 94, 0x000000, 0.22);

    this.add.rectangle(width / 2, y, 560, 94, 0x14100d, 0.86)
      .setStrokeStyle(2, strokeColor, completed ? 0.75 : 0.45);

    this.add.circle(width / 2 - 245, y, 26, completed ? 0x1c3a24 : 0x2a1d13, 1)
      .setStrokeStyle(2, strokeColor, 0.65);

    this.add.text(width / 2 - 245, y, claimed ? '✓' : completed ? '!' : '◆', {
      fontFamily: UI.font.body,
      fontSize: '22px',
      color: claimed ? UI.colors.textMuted : completed ? UI.colors.green : UI.colors.goldText,
    }).setOrigin(0.5);

    this.add.text(width / 2 - 205, y - 28, quest.title, {
      fontFamily: UI.font.title,
      fontSize: '18px',
      color: titleColor,
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 205, y, quest.description, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.text,
      wordWrap: {
        width: 300,
      },
    }).setOrigin(0, 0.5);

    const progressValue = getQuestProgressValue(quest);
    const progressText = `${progressValue}/${quest.target}`;

    this.add.text(width / 2 - 205, y + 28, progressText, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: completed ? UI.colors.green : UI.colors.textMuted,
    }).setOrigin(0, 0.5);

    const rewardText = `+${quest.rewardGold} золота`;

    this.add.text(width / 2 + 115, y - 22, rewardText, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.goldText,
      align: 'center',
    }).setOrigin(0.5);

    const buttonText = claimed
      ? 'Получено'
      : completed
        ? 'Забрать'
        : 'Не готово';

    createButton(
      this,
      width / 2 + 205,
      y + 20,
      buttonText,
      () => {
        if (!completed || claimed) {
          return;
        }

        claimQuestReward(quest.id);
        void saveGameAsync();

        this.scene.restart();
      },
      125,
      38,
      {
        small: true,
        disabled: !completed || claimed,
      }
    );
  }
}