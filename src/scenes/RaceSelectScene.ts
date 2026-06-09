import Phaser from 'phaser';

import { player } from '../data/player';
import { races, type RaceData } from '../data/races';

import { saveGameAsync } from '../systems/SaveSystem';

import { createButton } from '../ui/createButton';

import {
  UI,
  createPanel,
  createSceneBackground,
  createSectionTitle,
  createSmallText,
  createTitle,
} from '../ui/theme';

export class RaceSelectScene extends Phaser.Scene {
  constructor() {
    super('RaceSelectScene');
  }

  create() {
    createSceneBackground(this);
    createTitle(this, 'Создание героя', 'Выбери происхождение перед первым спуском');

    this.createIntroPanel();
    this.createRaceCards();
  }

  private createIntroPanel() {
    const { width } = this.scale;

    createPanel(this, width / 2, 170, 620, 120, {
      alpha: 0.72,
      stroke: false,
      warm: true,
    });

    createSmallText(
      this,
      width / 2,
      170,
      'Раса определяет стартовые характеристики, пассивную способность и особый активный навык.',
      {
        fontSize: '18px',
        color: UI.colors.text,
        width: 540,
      }
    );
  }

  private createRaceCards() {
    const { width } = this.scale;

    const panelY = 660;

    createPanel(this, width / 2, panelY, 620, 760, {
      alpha: 0.86,
      stroke: true,
      warm: false,
    });

    createSectionTitle(this, width / 2, panelY - 345, 'Доступные расы');

    if (races.length === 0) {
      createSmallText(this, width / 2, panelY, 'Расы пока не добавлены.', {
        fontSize: '20px',
        color: UI.colors.textMuted,
        width: 540,
      });

      return;
    }

    races.slice(0, 3).forEach((race: RaceData, index: number) => {
      this.createRaceCard(race, panelY - 215 + index * 220);
    });

    if (races.length > 3) {
      createSmallText(
        this,
        width / 2,
        panelY + 330,
        `Показано 3 из ${races.length}. Позже добавим прокрутку.`,
        {
          fontSize: '15px',
          color: UI.colors.textMuted,
          width: 540,
        }
      );
    }
  }

  private createRaceCard(race: RaceData, y: number) {
    const { width } = this.scale;

    this.add.rectangle(width / 2, y + 5, 560, 190, 0x000000, 0.24);

    this.add.rectangle(width / 2, y, 560, 190, 0x14100d, 0.9)
      .setStrokeStyle(2, UI.colors.goldDark, 0.55);

    this.add.circle(width / 2 - 245, y - 52, 30, 0x2a1d13, 1)
      .setStrokeStyle(2, UI.colors.goldDark, 0.75);

    this.add.text(width / 2 - 245, y - 52, '◆', {
      fontFamily: UI.font.body,
      fontSize: '24px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    this.add.text(width / 2 - 205, y - 70, race.name, {
      fontFamily: UI.font.title,
      fontSize: '24px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 205, y - 38, race.description, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.text,
      wordWrap: {
        width: 330,
      },
    }).setOrigin(0, 0.5);

    const statsText = [
      `HP: ${race.hp * 10}`,
      `Сила: ${race.strength}`,
      `Защита: ${race.defense}`,
      `Ловкость: ${race.agility}`,
      `Интеллект: ${race.intelligence}`,
      `Удача: ${race.luck}`,
    ].join('  •  ');

    this.add.text(width / 2 - 245, y + 18, statsText, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: 490,
      },
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 245, y + 52, `Пассивка: ${race.passiveName}`, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.green,
      wordWrap: {
        width: 330,
      },
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 245, y + 78, `Навык: ${race.activeName}`, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.blue,
      wordWrap: {
        width: 330,
      },
    }).setOrigin(0, 0.5);

    createButton(
      this,
      width / 2 + 205,
      y + 56,
      'Выбрать',
      () => {
        this.selectRace(race);
      },
      130,
      48,
      {
        small: true,
      }
    );
  }

  private selectRace(race: RaceData) {
    player.raceId = race.id;
    player.name = race.name;

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