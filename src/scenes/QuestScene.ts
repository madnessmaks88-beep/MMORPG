import Phaser from 'phaser';

import { quests } from '../data/quests';
import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';
import {
  claimQuestReward,
  getQuestProgressValue,
  isQuestClaimed,
  isQuestCompleted,
} from '../systems/QuestSystem';
import { saveGameAsync } from '../systems/SaveSystem';

export class QuestScene extends Phaser.Scene {
  constructor() {
    super('QuestScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.add.text(width / 2, 70, 'Задания', {
      fontFamily: 'Arial',
      fontSize: '56px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.text(width / 2, 125, 'Тьма любит тех, кто возвращается снова.', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#9c8f7a',
      align: 'center',
    }).setOrigin(0.5);

    quests.forEach((quest, index) => {
      const y = 240 + index * 205;
      const progress = getQuestProgressValue(quest);
      const completed = isQuestCompleted(quest);
      const claimed = isQuestClaimed(quest.id);

      this.add.rectangle(width / 2, y, 620, 170, 0x171313);
      this.add.rectangle(width / 2, y, 580, 130, 0x121212);

      this.add.text(80, y - 60, quest.title, {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: completed ? '#d8b56d' : '#e6d2aa',
      });

      this.add.text(80, y - 25, quest.description, {
        fontFamily: 'Arial',
        fontSize: '19px',
        color: '#b8aa91',
        wordWrap: {
          width: 390,
        },
      });

      this.add.text(80, y + 32, `Прогресс: ${Math.min(progress, quest.target)}/${quest.target}`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: completed ? '#75d184' : '#8f826d',
      });

      this.add.text(
        80,
        y + 60,
        `Награда: ${quest.rewardGold} золота, ${quest.rewardExp} опыта${quest.rewardPotions ? `, ${quest.rewardPotions} зелья` : ''}`,
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#70675a',
        }
      );

      if (claimed) {
        this.add.text(520, y, 'Получено', {
          fontFamily: 'Arial',
          fontSize: '22px',
          color: '#70675a',
        }).setOrigin(0.5);

        return;
      }

      if (!completed) {
        this.add.text(520, y, 'Не готово', {
          fontFamily: 'Arial',
          fontSize: '22px',
          color: '#5d554c',
        }).setOrigin(0.5);

        return;
      }

      createButton(this, 520, y, 'Забрать', () => {
        const message = claimQuestReward(quest.id);
        void saveGameAsync();
        this.showMessage(message);
      }, 170, 58);
    });

    createBottomNav(this, {
      active: 'camp',
    });
  }

  private showMessage(message: string) {
    const { width, height } = this.scale;

    this.children.removeAll();

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.add.rectangle(width / 2, height / 2, 620, 430, 0x181414);
    this.add.rectangle(width / 2, height / 2, 580, 390, 0x0d0d0d);

    this.add.text(width / 2, height / 2 - 55, message, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#e6d2aa',
      align: 'center',
      lineSpacing: 8,
      wordWrap: {
        width: 520,
      },
    }).setOrigin(0.5);

    createButton(this, width / 2, height / 2 + 145, 'Продолжить', () => {
      this.scene.restart();
    }, 440, 70);
  }
}