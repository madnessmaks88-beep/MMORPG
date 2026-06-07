import Phaser from 'phaser';
import { createButton } from '../ui/createButton';
import { resetSave } from '../systems/SaveSystem';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x090909);

    this.add.text(width / 2, 170, 'НИЖЕ\nПЕПЛА', {
      fontFamily: 'Arial',
      fontSize: '78px',
      color: '#d8b56d',
      align: 'center',
      lineSpacing: -10,
    }).setOrigin(0.5);

    this.add.text(width / 2, 320, 'Пошаговая RPG\nв мире мрачного фэнтези', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#9c8f7a',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, 610, 600, 360, 0x121212);
    this.add.rectangle(width / 2, 610, 560, 320, 0x181414);

    this.add.text(
      width / 2,
      610,
      'Говорят, в катакомбах\nможно найти славу.\n\nГоворят, там можно найти золото.\n\nНо чаще всего там\nнаходят смерть.',
      {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#b8aa91',
        align: 'center',
        lineSpacing: 8,
      }
    ).setOrigin(0.5);

    createButton(this, width / 2, 1010, 'Начать спуск', () => {
      this.scene.start('CampScene');
    });

    createButton(this, width / 2, 1100, 'Новая игра', () => {
      resetSave();
    });

    this.add.text(width / 2, 1185, 'v0.1 prototype', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#5f574d',
    }).setOrigin(0.5);
  }
}