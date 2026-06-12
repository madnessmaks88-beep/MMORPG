import Phaser from 'phaser';

import { player } from '../data/player';
import { races, type RaceData } from '../data/races';

import { saveGameAsync } from '../systems/SaveSystem';

import { createButton } from '../ui/createButton';

import {
  UI,
  createSceneBackground,
  createSmallText,
  createTitle,
} from '../ui/theme';

export class RaceSelectScene extends Phaser.Scene {
  private selectedRace?: RaceData;

  private raceCardObjects: Phaser.GameObjects.GameObject[] = [];
  private selectedInfoObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('RaceSelectScene');
  }

  create() {
    createSceneBackground(this);
    this.createBackgroundGlow();

    createTitle(
      this,
      'Создание героя',
      'Выбери происхождение перед первым спуском'
    );

    this.createIntroPanel();
    this.createRaceCards();

    if (races.length > 0) {
      this.selectRacePreview(races[0]);
    }
  }

  private createBackgroundGlow() {
    const { width, height } = this.scale;

    this.add.circle(width / 2, 170, 240, 0x8a3f1c, 0.08).setDepth(0);
    this.add.circle(width / 2, 170, 120, 0xf0a040, 0.045).setDepth(0);

    this.add.rectangle(width / 2, height - 180, width, 360, 0x050302, 0.46).setDepth(0);

    for (let i = 0; i < 48; i += 1) {
      const x = Phaser.Math.Between(30, width - 30);
      const y = Phaser.Math.Between(90, height - 130);
      const size = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.035, 0.1);

      this.add.circle(x, y, size, 0xd8b56d, alpha).setDepth(1);
    }
  }

  private createIntroPanel() {
    const { width } = this.scale;

    this.createRoundedPanel({
      x: width / 2,
      y: 170,
      width: 620,
      height: 115,
      radius: 30,
      color: 0x100b08,
      alpha: 0.88,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.52,
      depth: 2,
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
    ).setDepth(6);
  }

  private createRaceCards() {
    const { width } = this.scale;

    this.createRoundedPanel({
      x: width / 2,
      y: 545,
      width: 640,
      height: 620,
      radius: 34,
      color: 0x0d0907,
      alpha: 0.94,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.5,
      depth: 2,
    });

    this.add.text(width / 2, 260, 'Доступные расы', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(7);

    if (races.length === 0) {
      createSmallText(this, width / 2, 545, 'Расы пока не добавлены.', {
        fontSize: '20px',
        color: UI.colors.textMuted,
        width: 540,
      }).setDepth(7);

      return;
    }

    const startX = width / 2 - 155;
    const startY = 365;
    const gapX = 310;
    const gapY = 160;

    races.slice(0, 6).forEach((race: RaceData, index: number) => {
      const col = index % 2;
      const row = Math.floor(index / 2);

      this.createRaceCard(
        race,
        startX + col * gapX,
        startY + row * gapY
      );
    });
  }

  private createRaceCard(race: RaceData, x: number, y: number) {
    const isSelected = this.selectedRace?.id === race.id;

    const cardWidth = 285;
    const cardHeight = 135;

    const raceColor = this.getRaceColor(race.id);
    const raceIcon = this.getRaceIcon(race.id);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(
      x - cardWidth / 2,
      y - cardHeight / 2 + 6,
      cardWidth,
      cardHeight,
      24
    );
    shadow.setDepth(5);

    const card = this.add.graphics();
    card.fillStyle(isSelected ? 0x21150f : 0x14100d, 0.96);
    card.fillRoundedRect(
      x - cardWidth / 2,
      y - cardHeight / 2,
      cardWidth,
      cardHeight,
      24
    );

    card.lineStyle(
      isSelected ? 3 : 2,
      isSelected ? UI.colors.gold : raceColor,
      isSelected ? 0.95 : 0.58
    );

    card.strokeRoundedRect(
      x - cardWidth / 2,
      y - cardHeight / 2,
      cardWidth,
      cardHeight,
      24
    );
    card.setDepth(6);

    const iconBg = this.add.circle(x - 103, y - 37, 25, raceColor, 0.18)
      .setStrokeStyle(2, raceColor, 0.65)
      .setDepth(7);

    const icon = this.add.text(x - 103, y - 37, raceIcon, {
      fontFamily: UI.font.body,
      fontSize: '21px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8);

    const title = this.add.text(x - 70, y - 50, race.name, {
      fontFamily: UI.font.title,
      fontSize: '18px',
      color: isSelected ? UI.colors.goldText : UI.colors.text,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: 180,
      },
    }).setOrigin(0, 0.5).setDepth(8);

    const role = this.add.text(x - 70, y - 19, this.getRaceRole(race.id), {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: raceColor === 0xf0d58a ? UI.colors.goldText : this.getRaceColorText(race.id),
    }).setOrigin(0, 0.5).setDepth(8);

    const stats = this.add.text(x - 118, y + 18, this.createShortStatsText(race), {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: UI.colors.textMuted,
      align: 'left',
      lineSpacing: 3,
      wordWrap: {
        width: 235,
      },
    }).setOrigin(0, 0.5).setDepth(8);

    const hint = this.add.text(x, y + 53, isSelected ? 'Выбрано' : 'Нажми, чтобы выбрать', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: isSelected ? UI.colors.green : UI.colors.textMuted,
    }).setOrigin(0.5).setDepth(8);

    card.setInteractive(
      new Phaser.Geom.Rectangle(
        x - cardWidth / 2,
        y - cardHeight / 2,
        cardWidth,
        cardHeight
      ),
      Phaser.Geom.Rectangle.Contains
    );

    card.on('pointerover', () => {
      if (this.selectedRace?.id === race.id) {
        return;
      }

      card.clear();
      card.fillStyle(0x1b120d, 0.98);
      card.fillRoundedRect(
        x - cardWidth / 2,
        y - cardHeight / 2,
        cardWidth,
        cardHeight,
        24
      );
      card.lineStyle(2, raceColor, 0.9);
      card.strokeRoundedRect(
        x - cardWidth / 2,
        y - cardHeight / 2,
        cardWidth,
        cardHeight,
        24
      );

      title.setColor(UI.colors.goldText);
    });

    card.on('pointerout', () => {
      if (this.selectedRace?.id === race.id) {
        return;
      }

      card.clear();
      card.fillStyle(0x14100d, 0.96);
      card.fillRoundedRect(
        x - cardWidth / 2,
        y - cardHeight / 2,
        cardWidth,
        cardHeight,
        24
      );
      card.lineStyle(2, raceColor, 0.58);
      card.strokeRoundedRect(
        x - cardWidth / 2,
        y - cardHeight / 2,
        cardWidth,
        cardHeight,
        24
      );

      title.setColor(UI.colors.text);
    });

    card.on('pointerdown', () => {
      hint.setY(y + 54);
      card.setAlpha(0.92);
    });

    card.on('pointerup', () => {
      card.setAlpha(1);
      hint.setY(y + 53);
      this.selectRacePreview(race);
    });

    card.on('pointerupoutside', () => {
      card.setAlpha(1);
      hint.setY(y + 53);
    });

    this.raceCardObjects.push(
      shadow,
      card,
      iconBg,
      icon,
      title,
      role,
      stats,
      hint
    );
  }

  private selectRacePreview(race: RaceData) {
    this.selectedRace = race;

    this.raceCardObjects.forEach(object => {
      object.destroy();
    });

    this.raceCardObjects = [];

    this.selectedInfoObjects.forEach(object => {
      object.destroy();
    });

    this.selectedInfoObjects = [];

    this.createRaceCards();
    this.createSelectedRacePanel(race);
  }

  private createSelectedRacePanel(race: RaceData) {
    const { width } = this.scale;

    const panelY = 975;

    const panelObjects = this.createRoundedPanel({
      x: width / 2,
      y: panelY,
      width: 640,
      height: 275,
      radius: 34,
      color: 0x100b08,
      alpha: 0.95,
      strokeColor: UI.colors.gold,
      strokeAlpha: 0.65,
      depth: 2,
    });

    const raceColor = this.getRaceColor(race.id);

    const iconBg = this.add.circle(width / 2 - 260, panelY - 86, 35, raceColor, 0.18)
      .setStrokeStyle(2, raceColor, 0.75)
      .setDepth(7);

    const icon = this.add.text(width / 2 - 260, panelY - 86, this.getRaceIcon(race.id), {
      fontFamily: UI.font.body,
      fontSize: '28px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(8);

    const title = this.add.text(width / 2 - 210, panelY - 106, race.name, {
      fontFamily: UI.font.title,
      fontSize: '28px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(8);

    const role = this.add.text(width / 2 - 210, panelY - 73, this.getRaceRole(race.id), {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: this.getRaceColorText(race.id),
    }).setOrigin(0, 0.5).setDepth(8);

    const description = this.add.text(width / 2 - 285, panelY - 33, race.description, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.text,
      lineSpacing: 4,
      wordWrap: {
        width: 570,
      },
    }).setOrigin(0, 0.5).setDepth(8);

    const stats = this.add.text(width / 2 - 285, panelY + 25, this.createFullStatsText(race), {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: 570,
      },
    }).setOrigin(0, 0.5).setDepth(8);

    const passive = this.add.text(width / 2 - 285, panelY + 67, `Пассивка: ${race.passiveName}`, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.green,
      wordWrap: {
        width: 570,
      },
    }).setOrigin(0, 0.5).setDepth(8);

    const active = this.add.text(width / 2 - 285, panelY + 98, `Навык: ${race.activeName}`, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.blue,
      wordWrap: {
        width: 570,
      },
    }).setOrigin(0, 0.5).setDepth(8);

    const button = createButton(
      this,
      width / 2,
      1165,
      'Начать путь',
      () => {
        this.confirmRace();
      },
      520,
      56
    );

    this.selectedInfoObjects.push(
      panelObjects.shadow,
      panelObjects.panel,
      iconBg,
      icon,
      title,
      role,
      description,
      stats,
      passive,
      active,
      button.shadow,
      button.bg,
      button.label
    );
  }

  private confirmRace() {
    if (!this.selectedRace) {
      return;
    }

    this.selectRace(this.selectedRace);
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

  private createShortStatsText(race: RaceData) {
    return [
      `HP ${race.hp * 10}`,
      `СИЛ ${race.strength}`,
      `ЗАЩ ${race.defense}`,
      `ЛВК ${race.agility}`,
      `УДЧ ${race.luck}`,
    ].join('  •  ');
  }

  private createFullStatsText(race: RaceData) {
    return [
      `HP: ${race.hp * 10}`,
      `Сила: ${race.strength}`,
      `Защита: ${race.defense}`,
      `Ловкость: ${race.agility}`,
      `Интеллект: ${race.intelligence}`,
      `Удача: ${race.luck}`,
    ].join('  •  ');
  }

  private getRaceIcon(id: string) {
    if (id === 'human') return '◆';
    if (id === 'tainted_halfblood') return '☾';
    if (id === 'stoneborn') return '▣';
    if (id === 'night_elf') return '◐';
    if (id === 'goblin') return '!';
    if (id === 'demon') return '◆';

    return '◆';
  }

  private getRaceRole(id: string) {
    if (id === 'human') return 'Универсал';
    if (id === 'tainted_halfblood') return 'Риск / крит / урон';
    if (id === 'stoneborn') return 'Танк / выживание';
    if (id === 'night_elf') return 'Уклонение / темп';
    if (id === 'goblin') return 'Лут / золото / хитрость';
    if (id === 'demon') return 'Урон / жертва HP';

    return 'Боец';
  }

  private getRaceColor(id: string) {
    if (id === 'human') return 0xf0d58a;
    if (id === 'tainted_halfblood') return 0xc084fc;
    if (id === 'stoneborn') return 0x9ca3af;
    if (id === 'night_elf') return 0x70a6ff;
    if (id === 'goblin') return 0x75d184;
    if (id === 'demon') return 0xff6b6b;

    return UI.colors.gold;
  }

  private getRaceColorText(id: string) {
    if (id === 'human') return UI.colors.goldText;
    if (id === 'tainted_halfblood') return '#c084fc';
    if (id === 'stoneborn') return '#c7cbd1';
    if (id === 'night_elf') return '#70a6ff';
    if (id === 'goblin') return '#75d184';
    if (id === 'demon') return '#ff6b6b';

    return UI.colors.textMuted;
  }

  private createRoundedPanel(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: number;
    color?: number;
    alpha?: number;
    strokeColor?: number;
    strokeAlpha?: number;
    strokeWidth?: number;
    depth?: number;
  }) {
    const radius = config.radius ?? 26;
    const color = config.color ?? 0x14100d;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? UI.colors.goldDark;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const depth = config.depth ?? 1;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.32);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 7,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(depth);

    const panel = this.add.graphics();
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    panel.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    panel.setDepth(depth + 1);

    return {
      shadow,
      panel,
    };
  }
}