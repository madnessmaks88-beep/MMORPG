import Phaser from 'phaser';

import { dungeons } from '../data/dungeons';
import { player } from '../data/player';
import { isDungeonUnlocked, resetDungeonProgress } from '../data/gameState';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

export class DungeonSelectScene extends Phaser.Scene {
  constructor() {
    super('DungeonSelectScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.createBackground();

    this.add.text(width / 2, 65, 'Выбор спуска', {
      fontFamily: 'Arial',
      fontSize: '52px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.text(width / 2, 120, 'Каждая дверь вниз требует свою цену.', {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#9c8f7a',
      align: 'center',
      wordWrap: {
        width: 600,
      },
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, 205, 620, 85, 0x171313);

    this.add.text(width / 2, 205, `Уровень героя: ${player.level}`, {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#e6d2aa',
    }).setOrigin(0.5);

    this.createDungeonCards();

    createBottomNav(this, {
      active: 'camp',
    });
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x070707);

    for (let i = 0; i < 28; i++) {
      const x = Phaser.Math.Between(20, width - 20);
      const y = Phaser.Math.Between(150, height - 160);
      const size = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.05, 0.14);

      this.add.circle(x, y, size, 0xd8b56d, alpha);
    }

    this.add.rectangle(width / 2, 575, 620, 780, 0x111111, 0.72);
    this.add.rectangle(width / 2, 575, 580, 740, 0x0a0a0a, 0.68);
  }

  private createDungeonCards() {
    const { width } = this.scale;

    dungeons.forEach((dungeon, index) => {
      const y = 350 + index * 230;

      const unlocked = isDungeonUnlocked(dungeon.id);
      const isTooHard = player.level < dungeon.recommendedLevel;

      let strokeColor = 0x8b5a2b;
      let titleColor = '#e6d2aa';
      let statusText = 'Доступно';
      let statusColor = '#75d184';
      let icon = '▣';

      if (isTooHard && unlocked) {
        strokeColor = 0xc24747;
        statusText = 'Опасно';
        statusColor = '#c24747';
      }

      if (!unlocked) {
        strokeColor = 0x3b3028;
        titleColor = '#5d554c';
        statusText = 'Закрыто';
        statusColor = '#5d554c';
        icon = '×';
      }

      if (dungeon.id === 'old_catacombs') {
        icon = '☠';
      }

      if (dungeon.id === 'rotten_mines') {
        icon = '⚒';
      }

      if (dungeon.id === 'hall_of_nameless') {
        icon = '♛';
      }

      const outer = this.add.rectangle(width / 2, y, 620, 195, unlocked ? 0x171313 : 0x0f0f0f);
      outer.setStrokeStyle(2, strokeColor);

      this.add.rectangle(width / 2, y, 580, 155, unlocked ? 0x121212 : 0x0a0a0a);

      this.add.text(95, y, icon, {
        fontFamily: 'Arial',
        fontSize: '44px',
        color: unlocked ? '#d8b56d' : '#4f4940',
      }).setOrigin(0.5);

      this.add.text(145, y - 62, dungeon.name, {
        fontFamily: 'Arial',
        fontSize: '29px',
        color: titleColor,
      });

      this.add.text(145, y - 22, dungeon.description, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: unlocked ? '#b8aa91' : '#4f4940',
        wordWrap: {
          width: 350,
        },
        lineSpacing: 4,
      });

      this.add.text(145, y + 52, `Рекомендуемый уровень: ${dungeon.recommendedLevel}`, {
        fontFamily: 'Arial',
        fontSize: '19px',
        color: isTooHard && unlocked ? '#c24747' : '#8f826d',
      });

      this.add.text(520, y - 48, statusText, {
        fontFamily: 'Arial',
        fontSize: '21px',
        color: statusColor,
      }).setOrigin(0.5);

      if (!unlocked) {
        this.add.text(520, y + 18, '???', {
          fontFamily: 'Arial',
          fontSize: '30px',
          color: '#3b3028',
        }).setOrigin(0.5);

        return;
      }

      createButton(this, 520, y + 35, 'Войти', () => {
        resetDungeonProgress(dungeon.id);
        this.scene.start('DungeonScene');
      }, 155, 56);
    });

    this.add.text(width / 2, 1055, 'Новые ярусы открываются после победы над боссом.', {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#70675a',
      align: 'center',
      wordWrap: {
        width: 560,
      },
    }).setOrigin(0.5);
  }
}