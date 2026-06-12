import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getRaceById } from '../data/races';
import { getRelicById } from '../data/relics';

import { getPlayerStats } from '../systems/InventorySystem';

import { createBottomNav } from '../ui/createBottomNav';

import {
  UI,
  createSceneBackground,
  createTitle,
} from '../ui/theme';

export class ProfileScene extends Phaser.Scene {
  constructor() {
    super('ProfileScene');
  }

  create() {
    createSceneBackground(this);
    createTitle(this, 'Профиль героя');

    this.createHeroPanel();
    this.createStatsPanel();
    this.createProgressPanel();
    this.createRelicsPanel();

    createBottomNav(this, {
      activeScene: 'ProfileScene',
    });
  }

  private createHeroPanel() {
    const { width } = this.scale;

    const race = player.raceId ? getRaceById(player.raceId) : undefined;
    const raceColor = race ? this.getRaceColor(race.id) : UI.colors.goldDark;
    const raceIcon = race ? this.getRaceIcon(race.id) : '◆';
    const raceRole = race ? this.getRaceRole(race.id) : 'Раса не выбрана';

    const panelY = 280;
    const panelHeight = race ? 412 : 190;

    this.createRoundedPanel({
      x: width / 2,
      y: panelY,
      width: 620,
      height: panelHeight,
      radius: 32,
      color: 0x100c09,
      alpha: 0.95,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.78,
      depth: 2,
    });

    // Лёгкое свечение героя
    this.add.circle(width / 2 - 225, panelY - 120, 70, UI.colors.gold, 0.07)
      .setDepth(4);

    // Аватар
    this.add.circle(width / 2 - 225, panelY - 120, 48, 0x2a1d13, 1)
      .setStrokeStyle(3, raceColor, 0.85)
      .setDepth(5);

    this.add.text(width / 2 - 225, panelY - 120, raceIcon, {
      fontFamily: UI.font.body,
      fontSize: '38px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6);

    this.add.text(width / 2 - 160, panelY - 112, raceRole, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: race ? this.getRaceColorText(race.id) : UI.colors.textMuted,
    }).setOrigin(0, 0.5).setDepth(6);

    const heroTitle = player.name;

    this.add.text(width / 2 - 160, panelY - 145, heroTitle, {
      fontFamily: UI.font.title,
      fontSize: '32px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0, 0.5).setDepth(6);

    // Расу показываем отдельной строкой только если имя героя не равно названию расы
    if (race) {
      this.add.text(width / 2 - 160, panelY - 90, race.name, {
        fontFamily: UI.font.title,
        fontSize: '19px',
        color: UI.colors.text,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0, 0.5).setDepth(6);
    } else {
      this.add.text(width / 2 - 160, panelY - 90, 'Раса не выбрана', {
        fontFamily: UI.font.body,
        fontSize: '18px',
        color: UI.colors.textMuted,
      }).setOrigin(0, 0.5).setDepth(6);
    }

    this.add.text(width / 2 - 160, panelY - 58, `Уровень ${player.level}`, {
      fontFamily: UI.font.title,
      fontSize: '21px',
      color: UI.colors.green,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(6);

    this.add.text(width / 2 + 120, panelY - 58, `${player.gold} золота`, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.goldText,
    }).setOrigin(0, 0.5).setDepth(6);

    this.createExpBar(width / 2, panelY - 8, 520);

    if (!race) {
      this.add.text(width / 2, panelY + 82, 'Выбери расу, чтобы открыть расовые навыки героя.', {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: UI.colors.textMuted,
        align: 'center',
        wordWrap: {
          width: 520,
        },
      }).setOrigin(0.5).setDepth(6);

      return;
    }

    this.createAbilityCard({
      x: width / 2 - 150,
      y: panelY + 95,
      width: 280,
      height: 180,
      title: race.passiveName,
      label: 'Пассивный навык',
      description: race.passiveDescription,
      icon: '◇',
    });

    this.createAbilityCard({
      x: width / 2 + 150,
      y: panelY + 95,
      width: 280,
      height: 180,
      title: race.activeName,
      label: 'Активный навык',
      description: race.activeDescription,
      icon: '✦',
    });
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

  private createStatsPanel() {
    const { width } = this.scale;

    const stats = getPlayerStats(player);

    const panelY = 674;

    this.createRoundedPanel({
      x: width / 2,
      y: panelY,
      width: 620,
      height: 360,
      radius: 30,
      color: 0x0d0d0d,
      alpha: 0.93,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.55,
      depth: 2,
    });

    this.add.text(width / 2, panelY - 152, 'Характеристики', {
      fontFamily: UI.font.title,
      fontSize: '29px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(6);

    const leftX = width / 2 - 155;
    const rightX = width / 2 + 155;

    this.createStatPill(leftX, panelY - 96, 'HP', `${player.hp}/${stats.maxHp}`, '♥', UI.colors.redHex);
    this.createStatPill(rightX, panelY - 96, 'Энергия', `${player.energy}/${stats.maxEnergy}`, '✦', UI.colors.blueHex);

    this.createStatPill(leftX, panelY - 36, 'Атака', `${stats.attack}`, '⚔', UI.colors.gold);
    this.createStatPill(rightX, panelY - 36, 'Защита', `${stats.defense}`, '🛡', UI.colors.goldDark);

    this.createStatPill(leftX, panelY + 22, 'Крит', `${Math.round(stats.critChance * 100)}%`, '◆', UI.colors.redHex);
    this.createStatPill(rightX, panelY + 22, 'Уклонение', `${Math.round(stats.dodgeChance * 100)}%`, '◇', UI.colors.greenHex);

    this.createStatPill(leftX, panelY + 82, 'Сила', `${stats.strength}`, '▲', UI.colors.gold);
    this.createStatPill(rightX, panelY + 82, 'Ловкость', `${stats.agility}`, '➤', UI.colors.greenHex);

    this.createStatPill(leftX, panelY + 142, 'Удача', `${stats.luck}`, '★', UI.colors.gold);
    this.createStatPill(rightX, panelY + 142, 'Интеллект', `${stats.intelligence}`, '✧', UI.colors.blueHex);
  }

  private createProgressPanel() {
    const { width } = this.scale;

    const panelY = 940;

    this.createRoundedPanel({
      x: width / 2,
      y: panelY,
      width: 620,
      height: 155,
      radius: 28,
      color: 0x17100c,
      alpha: 0.9,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.45,
      depth: 2,
    });

    this.add.text(width / 2, panelY - 52, 'Прогресс спуска', {
      fontFamily: UI.font.title,
      fontSize: '27px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(6);

    const activeRunText = gameState.floorRun.active
      ? `Активный спуск: этаж ${gameState.floorRun.currentFloor}`
      : 'Активный спуск: нет';

    this.createProgressMiniCard(width / 2 - 205, panelY + 18, 'Рекорд', `${gameState.highestClearedFloor}`, '⌂');
    this.createProgressMiniCard(width / 2, panelY + 18, 'Ярусы', `${gameState.highestClearedTier}`, '▲');
    this.createProgressMiniCard(width / 2 + 205, panelY + 18, 'След. ярус', `${gameState.highestClearedTier + 1}`, '▼');

    this.add.text(width / 2, panelY + 65, activeRunText, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: gameState.floorRun.active ? UI.colors.green : UI.colors.textMuted,
      align: 'center',
    }).setOrigin(0.5).setDepth(6);
  }

  private createRelicsPanel() {
    const { width } = this.scale;

    const panelY = 1115;

    this.createRoundedPanel({
      x: width / 2,
      y: panelY,
      width: 620,
      height: 180,
      radius: 30,
      color: 0x0d0d0d,
      alpha: 0.93,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.55,
      depth: 2,
    });

    this.add.text(width / 2, panelY - 68, 'Реликвии', {
      fontFamily: UI.font.title,
      fontSize: '29px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(6);

    if (player.relicIds.length === 0) {
      this.add.circle(width / 2, panelY - 8, 36, 0x1a130f, 1)
        .setStrokeStyle(2, UI.colors.goldDark, 0.55)
        .setDepth(5);

      this.add.text(width / 2, panelY - 8, '★', {
        fontFamily: UI.font.body,
        fontSize: '29px',
        color: UI.colors.textMuted,
      }).setOrigin(0.5).setDepth(6);

      this.add.text(
        width / 2,
        panelY + 72,
        'Реликвий пока нет.\nПобеди финального босса яруса, чтобы получить первую.',
        {
          fontFamily: UI.font.body,
          fontSize: '18px',
          color: UI.colors.textMuted,
          align: 'center',
          lineSpacing: 6,
          wordWrap: {
            width: 520,
          },
        }
      ).setOrigin(0.5).setDepth(6);

      return;
    }

    const relics = player.relicIds
      .map(id => getRelicById(id))
      .filter(Boolean);

    relics.slice(0, 3).forEach((relic, index) => {
      if (!relic) {
        return;
      }

      this.createRelicCard(
        width / 2,
        panelY - 50 + index * 70,
        relic.name,
        relic.description
      );
    });

    if (relics.length > 3) {
      this.add.text(width / 2, panelY + 105, `И ещё реликвий: ${relics.length - 3}`, {
        fontFamily: UI.font.body,
        fontSize: '15px',
        color: UI.colors.textMuted,
      }).setOrigin(0.5).setDepth(6);
    }
  }

  private createExpBar(x: number, y: number, width: number) {
    const progress = Phaser.Math.Clamp(player.exp / player.expToNextLevel, 0, 1);

    this.add.text(x - width / 2, y - 17, 'Опыт', {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
    }).setOrigin(0, 0.5).setDepth(6);

    this.add.text(x + width / 2, y - 17, `${player.exp}/${player.expToNextLevel}`, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
    }).setOrigin(1, 0.5).setDepth(6);

    this.add.rectangle(x, y + 10, width, 12, 0x050505, 0.9)
      .setDepth(5);

    this.add.rectangle(x - width / 2 + (width * progress) / 2, y + 10, width * progress, 12, UI.colors.greenHex, 0.95)
      .setDepth(6);

    this.add.rectangle(x, y + 10, width, 12)
      .setStrokeStyle(1, UI.colors.goldDark, 0.5)
      .setDepth(7);
  }

  private createAbilityCard(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    label: string;
    description: string;
    icon: string;
  }) {
    this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 22,
      color: 0x17100c,
      alpha: 0.96,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.55,
      depth: 4,
    });

    this.add.circle(config.x - config.width / 2 + 38, config.y - 50, 19, 0x2a1d13, 1)
      .setStrokeStyle(1, UI.colors.goldDark, 0.65)
      .setDepth(6);

    this.add.text(config.x - config.width / 2 + 38, config.y - 50, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '17px',
      color: UI.colors.goldText,
    }).setOrigin(0.5).setDepth(7);

    this.add.text(config.x - config.width / 2 + 70, config.y - 63, config.label, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.textMuted,
    }).setOrigin(0, 0.5).setDepth(6);

    this.add.text(config.x - config.width / 2 + 70, config.y - 40, config.title, {
      fontFamily: UI.font.title,
      fontSize: '18px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: config.width - 100,
      },
    }).setOrigin(0, 0.5).setDepth(6);

    this.add.text(config.x - config.width / 2 + 28, config.y + 25, config.description, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.text,
      wordWrap: {
        width: config.width - 50,
      },
      lineSpacing: 4,
      maxLines: 5,
    }).setOrigin(0, 0.5).setDepth(6);
  }

  private createStatPill(
    x: number,
    y: number,
    label: string,
    value: string,
    icon: string,
    accentColor: number
  ) {
    this.createRoundedPanel({
      x,
      y,
      width: 270,
      height: 48,
      radius: 17,
      color: 0x17100c,
      alpha: 0.96,
      strokeColor: accentColor,
      strokeAlpha: 0.34,
      strokeWidth: 1,
      depth: 4,
    });

    this.add.circle(x - 105, y, 17, accentColor, 0.18)
      .setStrokeStyle(1, accentColor, 0.55)
      .setDepth(6);

    this.add.text(x - 105, y, icon, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.text,
    }).setOrigin(0.5).setDepth(7);

    this.add.text(x - 75, y - 9, label, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
    }).setOrigin(0, 0.5).setDepth(7);

    this.add.text(x - 75, y + 10, value, {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(7);
  }

  private createProgressMiniCard(
    x: number,
    y: number,
    label: string,
    value: string,
    icon: string
  ) {
    this.createRoundedPanel({
      x,
      y,
      width: 175,
      height: 62,
      radius: 18,
      color: 0x100c09,
      alpha: 0.92,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.45,
      strokeWidth: 1,
      depth: 4,
    });

    this.add.text(x - 58, y, icon, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.goldText,
    }).setOrigin(0.5).setDepth(6);

    this.add.text(x - 30, y - 10, label, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.textMuted,
    }).setOrigin(0, 0.5).setDepth(6);

    this.add.text(x - 30, y + 12, value, {
      fontFamily: UI.font.title,
      fontSize: '19px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(6);
  }

  private createRelicCard(
    x: number,
    y: number,
    name: string,
    description: string
  ) {
    this.createRoundedPanel({
      x,
      y,
      width: 540,
      height: 58,
      radius: 18,
      color: 0x17100c,
      alpha: 0.96,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.45,
      strokeWidth: 1,
      depth: 4,
    });

    this.add.text(x - 240, y, '★', {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: UI.colors.goldText,
    }).setOrigin(0.5).setDepth(6);

    this.add.text(x - 210, y - 11, name, {
      fontFamily: UI.font.title,
      fontSize: '16px',
      color: UI.colors.goldText,
    }).setOrigin(0, 0.5).setDepth(6);

    this.add.text(x - 210, y + 12, description, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: 440,
      },
    }).setOrigin(0, 0.5).setDepth(6);
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
    const radius = config.radius ?? 24;
    const color = config.color ?? 0x14100d;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? UI.colors.goldDark;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const depth = config.depth ?? 1;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 6,
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