import Phaser from 'phaser';

import { player } from '../data/player';
import { races } from '../data/races';
import type { RaceData } from '../data/races';
import { saveGameAsync } from '../systems/SaveSystem';

export class RaceSelectScene extends Phaser.Scene {
  constructor() {
    super('RaceSelectScene');
  }

  create() {
    const { width, height } = this.scale;

    this.createBackground();

    this.add.text(width / 2, 50, 'Выбор расы', {
      fontFamily: 'Arial',
      fontSize: '48px',
      color: '#f0d58a',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(width / 2, 96, 'Выбери происхождение героя', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#9c8f7a',
    }).setOrigin(0.5);

    races.forEach((race, index) => {
      this.createRaceCard(width / 2, 610 + index * 900, race);
    });

    this.add.text(width / 2, height - 60, 'Позже здесь появятся другие расы', {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#70675a',
    }).setOrigin(0.5);
  }

  private createBackground() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x090909);
    this.add.rectangle(width / 2, height / 2, width, height, 0x120d0b, 0.9);

    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const radius = Phaser.Math.Between(1, 3);

      this.add.circle(x, y, radius, 0xd8b56d, 0.08);
    }
  }

  private createRaceCard(x: number, y: number, race: RaceData) {
	 const card = this.add.rectangle(x, y, 620, 880, 0x171313, 0.96)
	   .setStrokeStyle(3, 0x8b5a2b)
	   .setInteractive({ useHandCursor: true });

	 this.add.rectangle(x, y - 360, 540, 105, 0x0d0d0d, 0.9)
	   .setStrokeStyle(2, 0x2a2117);

	 this.add.text(x, y - 385, race.name, {
	   fontFamily: 'Arial',
	   fontSize: '34px',
	   color: '#f0d58a',
	   stroke: '#000000',
	   strokeThickness: 4,
	 }).setOrigin(0.5);

	 this.add.text(x, y - 342, race.description, {
	   fontFamily: 'Arial',
	   fontSize: '16px',
	   color: '#d8c7a3',
	   align: 'center',
	   wordWrap: {
	     width: 480,
	   },
	 }).setOrigin(0.5);

	 this.add.text(x - 245, y - 270, 'Характеристики', {
	   fontFamily: 'Arial',
	   fontSize: '23px',
	   color: '#f0d58a',
	 }).setOrigin(0, 0.5);

	 const statsText = [
	   `HP: ${race.hp}`,
	   `Защита: ${race.defense}`,
	   `Ловкость: ${race.agility}`,
	   `Сила: ${race.strength}`,
	   `Удача: ${race.luck}`,
	   `Интеллект: ${race.intelligence}`,
	 ].join('\n');

	 this.add.text(x - 245, y - 230, statsText, {
	   fontFamily: 'Arial',
	   fontSize: '19px',
	   color: '#d8c7a3',
	   lineSpacing: 5,
	 }).setOrigin(0, 0);

	 this.add.text(x - 245, y - 45, `Пассивный навык: ${race.passiveName}`, {
	   fontFamily: 'Arial',
	   fontSize: '21px',
	   color: '#75d184',
	 }).setOrigin(0, 0.5);

	 this.add.text(x - 245, y - 10, race.passiveDescription, {
	   fontFamily: 'Arial',
	   fontSize: '16px',
	   color: '#d8c7a3',
	   wordWrap: {
	     width: 500,
	   },
	   lineSpacing: 4,
	 }).setOrigin(0, 0);

	 this.add.text(x - 245, y + 125, `Активный навык: ${race.activeName}`, {
	   fontFamily: 'Arial',
	   fontSize: '21px',
	   color: '#70a6ff',
	 }).setOrigin(0, 0.5);

	 this.add.text(x - 245, y + 160, race.activeDescription, {
	   fontFamily: 'Arial',
	   fontSize: '16px',
	   color: '#d8c7a3',
	   wordWrap: {
	     width: 500,
	   },
	   lineSpacing: 4,
	 }).setOrigin(0, 0);

	 const buttonBg = this.add.rectangle(x, y + 350, 420, 70, 0x241515)
	   .setStrokeStyle(2, 0xf0d58a)
	   .setInteractive({ useHandCursor: true });

	 this.add.text(x, y + 350, 'Выбрать человека', {
	   fontFamily: 'Arial',
	   fontSize: '25px',
	   color: '#f0d58a',
	 }).setOrigin(0.5);

	 const selectRace = () => {
	   this.selectRace(race);
	 };

	 card.on('pointerdown', selectRace);
	 buttonBg.on('pointerdown', selectRace);
	}

  private selectRace(race: RaceData) {
    player.raceId = race.id;

    player.maxHp = race.hp * 10;
    player.hp = player.maxHp;

    player.defense = race.defense;
    player.agility = race.agility;
    player.strength = race.strength;
    player.luck = race.luck;
    player.intelligence = race.intelligence;

    player.attack = race.strength;
    player.critChance = 0.1;

    player.energy = player.maxEnergy;

    void saveGameAsync();

    this.scene.start('MainMenuScene');
  }
}