import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState, resetFloorRun } from '../data/gameState';
import { getRaceById } from '../data/races';

import { getPlayerStats } from '../systems/InventorySystem';
import { saveGameAsync } from '../systems/SaveSystem';
import { getCachedVKUser } from '../systems/VKBridgeSystem';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

import {
  getActiveCampfireBattleCheckpoint,
  restoreCampfireBattleCheckpoint,
  formatCheckpointTimeLeft,
  clearCampfireBattleCheckpoint,
} from '../systems/CampfireCheckpointSystem';

import {
  getQuests,
  isQuestCompleted,
  isQuestClaimed,
} from '../systems/QuestSystem';

import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type CampLayout = {
  width: number;
  height: number;
  centerX: number;

  safeX: number;
  safeTop: number;
  safeBottom: number;

  contentWidth: number;
  bottomNavTop: number;

  compact: boolean;
};

export class CampScene extends Phaser.Scene {

  private restButtonLabel?: Phaser.GameObjects.Text;
  private campfireTimerEvent?: Phaser.Time.TimerEvent;

  private readonly CAMPFIRE_COOLDOWN_MS = 30 * 60 * 1000;
  private readonly CAMPFIRE_LAST_USE_KEY = 'campfire_last_rest_at';

  private campfireTimerText?: Phaser.GameObjects.Text;

  constructor() {
    super('CampScene');
  }

  create() {
    createSceneBackground(this);

    const layout = this.getLayout();

    this.createCampBackdrop(layout);
    this.createHeader(layout);
    this.createPlayerLine(layout);
    this.createHeroStatusCard(layout);
    this.createMainActions(layout);

    createBottomNav(this, {
      activeScene: 'CampScene',
    });
  }

  private getLayout(): CampLayout {
    const { width, height } = this.scale;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.025), 20, 34);
    const safeBottom = 116;

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      contentWidth: Math.min(width - safeX * 2, 620),
      bottomNavTop: height - safeBottom,

      compact: height < 1120,
    };
  }

  private createCampBackdrop(layout: CampLayout) {
    const { width, height, centerX } = layout;

    const fireY = Phaser.Math.Clamp(height * 0.32, 330, 430);

    this.add.circle(centerX, fireY, width * 0.42, 0x8a3f1c, 0.08).setDepth(0);
    this.add.circle(centerX, fireY, width * 0.24, 0xf0a040, 0.07).setDepth(0);
    this.add.circle(centerX, fireY, width * 0.12, 0xffc46b, 0.055).setDepth(0);

    for (let i = 0; i < 12; i += 1) {
      const x = layout.safeX + 24 + i * ((width - layout.safeX * 2 - 48) / 11);
      const y = layout.safeTop + 110 + (i % 4) * 58;

      this.add.circle(x, y, 26 + (i % 3) * 8, 0xffffff, 0.015).setDepth(0);
    }

    this.add.rectangle(centerX, height - 190, width, 320, 0x050403, 0.34).setDepth(0);

    this.add.circle(centerX, fireY + 3, 52, 0x000000, 0.22).setDepth(1);
    this.add.circle(centerX, fireY - 7, 42, 0xf08a24, 0.13).setDepth(1);

    this.add.text(centerX, fireY - 8, '♨', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '42px' : '48px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(2);
  }

  private createHeader(layout: CampLayout) {
    const titleY = layout.safeTop + 26;

    this.add.text(layout.centerX, titleY, 'Лагерь у входа', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '30px' : '34px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth,
      },
    }).setOrigin(0.5).setDepth(10);

    this.add.text(layout.centerX, titleY + 36, 'Последний огонь перед катакомбами', {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 40,
      },
    }).setOrigin(0.5).setDepth(10);
  }

  private createPlayerLine(layout: CampLayout) {
    const vkUser = getCachedVKUser();
    const vkName = vkUser ? vkUser.first_name : 'локальный режим';

    this.add.text(layout.centerX, layout.safeTop + 82, `Игрок: ${vkName}`, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 40,
      },
    }).setOrigin(0.5).setDepth(10);
  }

  private createHeroStatusCard(layout: CampLayout) {
    const race = player.raceId ? getRaceById(player.raceId) : undefined;
    const stats = getPlayerStats(player);

    const cardTop = layout.safeTop + 110;
    const cardHeight = layout.compact ? 132 : 148;
    const cardY = cardTop + cardHeight / 2;

    this.createRoundedPanel({
      x: layout.centerX,
      y: cardY,
      width: layout.contentWidth,
      height: cardHeight,
      radius: 30,
      color: 0x0d0a08,
      alpha: 0.93,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.5,
      depth: 2,
    });

    const innerLeft = layout.centerX - layout.contentWidth / 2 + 28;
    const innerRight = layout.centerX + layout.contentWidth / 2 - 28;

    const heroName =
      race && player.name === race.name
        ? player.name
        : race
          ? `${player.name} • ${race.name}`
          : player.name;

    this.add.text(innerLeft, cardY - cardHeight / 2 + 28, heroName, {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '20px' : '23px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: layout.contentWidth - 140,
      },
    }).setOrigin(0, 0.5).setDepth(6);

    this.add.text(innerRight, cardY - cardHeight / 2 + 28, `Ур. ${player.level}`, {
      fontFamily: UI.font.title,
      fontSize: '19px',
      color: UI.colors.green,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(6);

    const barWidth = Math.min((layout.contentWidth - 78) / 2, 258);
    const barY = cardY - 6;

    this.createSmallBar({
      x: layout.centerX - barWidth / 2 - 12,
      y: barY,
      width: barWidth,
      label: 'HP',
      value: `${player.hp}/${stats.maxHp}`,
      progress: stats.maxHp > 0 ? player.hp / stats.maxHp : 1,
      color: UI.colors.redHex,
    });

    this.createSmallBar({
      x: layout.centerX + barWidth / 2 + 12,
      y: barY,
      width: barWidth,
      label: 'Энергия',
      value: `${player.energy}/${stats.maxEnergy}`,
      progress: stats.maxEnergy > 0 ? player.energy / stats.maxEnergy : 1,
      color: UI.colors.blueHex,
    });

    const resourceY = cardY + cardHeight / 2 - 27;
    const resourceWidth = Math.min((layout.contentWidth - 40) / 3, 150);

    this.createTinyResource(layout.centerX - resourceWidth - 10, resourceY, '◆', `${player.gold}`, resourceWidth);
    this.createTinyResource(layout.centerX, resourceY, '✚', `${player.potions}`, resourceWidth);
    this.createTinyResource(layout.centerX + resourceWidth + 10, resourceY, '★', `${player.relicIds.length}`, resourceWidth);
  }

  private createMainActions(layout: CampLayout) {
    const hasActiveRun =
      gameState.floorRun.active &&
      gameState.floorRun.rooms.length > 0;

    const activeCheckpoint = getActiveCampfireBattleCheckpoint();
    const hasActiveCheckpoint = Boolean(activeCheckpoint);

    const hasQuestReward = this.hasClaimableQuests();

    const panelTop = layout.compact
      ? layout.safeTop + 260
      : layout.safeTop + 286;

    const panelBottom = layout.bottomNavTop - 18;
    const availableHeight = Math.max(500, panelBottom - panelTop);
    const panelHeight = Math.min(
      availableHeight,
      hasActiveRun || hasActiveCheckpoint ? 700 : 640
    );
    const panelY = panelTop + panelHeight / 2;

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 36,
      color: 0x0b0908,
      alpha: 0.92,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.5,
      depth: 2,
    });

    const innerTop = panelTop + 28;
    const gap = layout.compact ? 12 : 14;

    const mainButtonHeight = layout.compact ? 88 : 98;
    const wideButtonHeight = layout.compact ? 70 : 78;
    const tileHeight = layout.compact ? 86 : 96;

    const dungeonTitle = activeCheckpoint
      ? 'Вернуться к костру'
      : hasActiveRun
        ? 'Продолжить спуск'
        : 'Войти в катакомбы';

    const dungeonDesc = activeCheckpoint
      ? `Чекпоинт на этаже ${activeCheckpoint.floor}. Осталось ${formatCheckpointTimeLeft(activeCheckpoint.expiresAt - Date.now())}.`
      : hasActiveRun
        ? `Ты остановился на этаже ${gameState.floorRun.currentFloor}.`
        : 'Начать новый спуск в глубины.';

    let currentY = innerTop + mainButtonHeight / 2;

    this.createMainDungeonButton({
      layout,
      x: layout.centerX,
      y: currentY,
      width: layout.contentWidth - 60,
      height: mainButtonHeight,
      title: dungeonTitle,
      description: dungeonDesc,
      hasActiveRun: hasActiveRun || hasActiveCheckpoint,
      onClick: () => {
        if (activeCheckpoint) {
          this.returnToCampfireCheckpoint();
          return;
        }

        this.tryEnterCatacombs(hasActiveRun);
      },
    });

    currentY += mainButtonHeight / 2 + gap;

    if (hasActiveRun) {
      currentY += wideButtonHeight / 2;

      this.createWideActionButton({
        x: layout.centerX,
        y: currentY,
        width: layout.contentWidth - 60,
        height: wideButtonHeight,
        icon: '!',
        title: 'Покинуть спуск',
        description: 'Текущий ярус придётся проходить заново.',
        accentColor: UI.colors.redHex,
        danger: true,
        onClick: () => {
          this.showLeaveRunMessage();
        },
      });

      currentY += wideButtonHeight / 2 + gap;
    }

    const tileWidth = Math.min((layout.contentWidth - 78) / 2, 270);
    const leftX = layout.centerX - tileWidth / 2 - 10;
    const rightX = layout.centerX + tileWidth / 2 + 10;

    currentY += tileHeight / 2;

    this.createCampTile({
      x: leftX,
      y: currentY,
      width: tileWidth,
      height: tileHeight,
      icon: '▣',
      title: 'Лавка',
      description: 'Зелья и припасы',
      accentColor: UI.colors.gold,
      onClick: () => {
        this.scene.start('ShopScene');
      },
    });

    this.createCampTile({
      x: rightX,
      y: currentY,
      width: tileWidth,
      height: tileHeight,
      icon: '▲',
      title: 'Тренировка',
      description: 'Прокачка героя',
      accentColor: UI.colors.greenHex,
      onClick: () => {
        this.scene.start('TrainingScene');
      },
    });

    currentY += tileHeight + gap;

    this.createCampTile({
      x: leftX,
      y: currentY,
      width: tileWidth,
      height: tileHeight,
      icon: hasQuestReward ? '!' : '◆',
      title: hasQuestReward ? 'Задания!' : 'Задания',
      description: hasQuestReward ? 'Есть награда' : 'Цели и награды',
      accentColor: hasQuestReward ? UI.colors.greenHex : UI.colors.goldDark,
      highlighted: hasQuestReward,
      onClick: () => {
        this.scene.start('QuestScene');
      },
    });

    this.createCampTile({
      x: rightX,
      y: currentY,
      width: tileWidth,
      height: tileHeight,
      icon: '⚒',
      title: 'Кузница',
      description: 'Улучшения',
      accentColor: UI.colors.goldDark,
      onClick: () => {
        this.scene.start('ForgeScene');
      },
    });

    currentY += tileHeight / 2 + gap + wideButtonHeight / 2;

    const maxRestY = panelTop + panelHeight - 48;

    const restCard = this.createWideActionButton({
      x: layout.centerX,
      y: Math.min(currentY, maxRestY),
      width: layout.contentWidth - 60,
      height: wideButtonHeight,
      icon: '♨',
      title: this.getRestButtonText(),
      description: 'Восстановить HP, энергию и зелья.',
      accentColor: UI.colors.gold,
      onClick: () => {
        this.restAtCampfire();
      },
    });

    this.restButtonLabel = restCard.titleText;
    this.startCampfireTimer();
  }

  private hasClaimableQuests() {
    return getQuests().some(quest => {
      return isQuestCompleted(quest) && !isQuestClaimed(quest.id);
    });
  }

  private getRestButtonText() {
    const cooldownLeft = this.getCampfireCooldownLeft();

    return cooldownLeft > 0
      ? `Костёр: ${this.formatCooldown(cooldownLeft)}`
      : 'Отдохнуть у костра';
  }

  private updateCampfireButtonText() {
    if (!this.restButtonLabel) {
      return;
    }

    this.restButtonLabel.setText(this.getRestButtonText());
  }

  private startCampfireTimer() {
    if (this.campfireTimerEvent) {
      this.campfireTimerEvent.remove(false);
    }

    this.updateCampfireButtonText();

    this.campfireTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.updateCampfireButtonText();
      },
    });
  }

  private createMainDungeonButton(config: {
    layout: CampLayout;
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    description: string;
    hasActiveRun: boolean;
    onClick: () => void;
  }) {
    const accent = config.hasActiveRun ? UI.colors.greenHex : UI.colors.redHex;

    this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 28,
      color: config.hasActiveRun ? 0x102016 : 0x1a100d,
      alpha: 0.98,
      strokeColor: accent,
      strokeAlpha: 0.82,
      strokeWidth: 2,
      depth: 4,
    });

    const left = config.x - config.width / 2;
    const iconX = left + 48;
    const textX = left + 92;

    this.add.circle(iconX, config.y, 31, accent, 0.15)
      .setStrokeStyle(2, accent, 0.72)
      .setDepth(6);

    this.add.text(iconX, config.y, config.hasActiveRun ? '▼' : '☠', {
      fontFamily: UI.font.body,
      fontSize: '27px',
      color: config.hasActiveRun ? UI.colors.green : UI.colors.red,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(7);

    const titleColor = config.hasActiveRun ? UI.colors.green : UI.colors.goldText;

    const titleText = this.add.text(textX, config.y - 18, config.title, {
      fontFamily: UI.font.title,
      fontSize: config.layout.compact ? '21px' : '24px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: config.width - 120,
      },
    }).setOrigin(0, 0.5).setDepth(7);

    this.add.text(textX, config.y + 19, config.description, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: config.width - 120,
      },
    }).setOrigin(0, 0.5).setDepth(7);

    this.createClickZone(config.x, config.y, config.width, config.height, () => {
      config.onClick();
    }, titleText, titleColor);
  }

  private createCampTile(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    title: string;
    description: string;
    accentColor: number;
    highlighted?: boolean;
    onClick: () => void;
  }) {
    const highlighted = config.highlighted ?? false;

    this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 24,
      color: highlighted ? 0x102016 : 0x17100c,
      alpha: highlighted ? 0.98 : 0.94,
      strokeColor: config.accentColor,
      strokeAlpha: highlighted ? 0.88 : 0.42,
      strokeWidth: highlighted ? 2 : 1,
      depth: 4,
    });

    const left = config.x - config.width / 2;
    const iconX = left + 42;
    const textX = left + 78;
    const titleColor = highlighted ? UI.colors.green : UI.colors.goldText;

    this.add.circle(iconX, config.y, 24, config.accentColor, 0.14)
      .setStrokeStyle(1, config.accentColor, 0.62)
      .setDepth(6);

    this.add.text(iconX, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7);

    const titleText = this.add.text(textX, config.y - 16, config.title, {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: config.width - 92,
      },
    }).setOrigin(0, 0.5).setDepth(7);

    this.add.text(textX, config.y + 16, config.description, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: config.width - 92,
      },
    }).setOrigin(0, 0.5).setDepth(7);

    this.createClickZone(config.x, config.y, config.width, config.height, () => {
      config.onClick();
    }, titleText, titleColor);

    if (highlighted) {
      this.tweens.add({
        targets: titleText,
        alpha: 0.55,
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private createWideActionButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    title: string;
    description: string;
    accentColor: number;
    danger?: boolean;
    onClick: () => void;
  }) {
    const danger = config.danger ?? false;
    const titleColor = danger ? UI.colors.red : UI.colors.goldText;

    this.createRoundedPanel({
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      radius: 24,
      color: danger ? 0x241010 : 0x17100c,
      alpha: 0.96,
      strokeColor: config.accentColor,
      strokeAlpha: danger ? 0.72 : 0.44,
      strokeWidth: danger ? 2 : 1,
      depth: 4,
    });

    const left = config.x - config.width / 2;
    const iconX = left + 44;
    const textX = left + 82;

    this.add.circle(iconX, config.y, 24, config.accentColor, 0.14)
      .setStrokeStyle(1, config.accentColor, 0.62)
      .setDepth(6);

    this.add.text(iconX, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(7);

    const titleText = this.add.text(textX, config.y - 13, config.title, {
      fontFamily: UI.font.title,
      fontSize: '19px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: config.width - 110,
      },
    }).setOrigin(0, 0.5).setDepth(7);

    this.add.text(textX, config.y + 17, config.description, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: config.width - 110,
      },
    }).setOrigin(0, 0.5).setDepth(7);

    this.createClickZone(config.x, config.y, config.width, config.height, () => {
      config.onClick();
    }, titleText, titleColor);

    return {
      titleText,
    };
  }

  private createClickZone(
    x: number,
    y: number,
    width: number,
    height: number,
    onClick: () => void,
    titleText?: Phaser.GameObjects.Text,
    normalColor = UI.colors.goldText
  ) {
    const zone = this.add.zone(x, y, width, height)
      .setDepth(30)
      .setInteractive({
        useHandCursor: true,
      });

    zone.on('pointerover', () => {
      titleText?.setColor(UI.colors.text);
    });

    zone.on('pointerout', () => {
      titleText?.setColor(normalColor);
    });

    zone.on('pointerdown', () => {
      onClick();
    });

    return zone;
  }

  private createSmallBar(config: {
    x: number;
    y: number;
    width: number;
    label: string;
    value: string;
    progress: number;
    color: number;
  }) {
    const progress = Phaser.Math.Clamp(config.progress, 0, 1);

    this.add.text(config.x - config.width / 2, config.y - 12, config.label, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
    }).setOrigin(0, 0.5).setDepth(6);

    this.add.text(config.x + config.width / 2, config.y - 12, config.value, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.text,
    }).setOrigin(1, 0.5).setDepth(6);

    this.add.rectangle(config.x, config.y + 8, config.width, 10, 0x050505, 0.88)
      .setDepth(5);

    this.add.rectangle(
      config.x - config.width / 2 + (config.width * progress) / 2,
      config.y + 8,
      config.width * progress,
      10,
      config.color,
      0.95
    ).setDepth(6);

    this.add.rectangle(config.x, config.y + 8, config.width, 10)
      .setStrokeStyle(1, UI.colors.goldDark, 0.45)
      .setDepth(7);
  }

  private createTinyResource(
    x: number,
    y: number,
    icon: string,
    value: string,
    width: number
  ) {
    this.createRoundedPanel({
      x,
      y,
      width,
      height: 34,
      radius: 15,
      color: 0x17100c,
      alpha: 0.95,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.35,
      strokeWidth: 1,
      depth: 4,
    });

    this.add.text(x - width / 2 + 36, y, icon, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.goldText,
    }).setOrigin(0.5).setDepth(6);

    this.add.text(x - width / 2 + 58, y, value, {
      fontFamily: UI.font.title,
      fontSize: '16px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: width - 70,
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

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2 + 6,
      safeWidth,
      safeHeight,
      radius
    );
    shadow.setDepth(depth);

    const panel = this.add.graphics();
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2,
      safeWidth,
      safeHeight,
      radius
    );

    panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    panel.strokeRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2,
      safeWidth,
      safeHeight,
      radius
    );

    panel.setDepth(depth + 1);

    return {
      shadow,
      panel,
    };
  }

  private restAtCampfire() {
    const stats = getPlayerStats(player);

    const maxPotions = 6;
    const hpIsFull = player.hp >= stats.maxHp;
    const potionsAreFull = player.potions >= maxPotions;

    const cooldownLeft = this.getCampfireCooldownLeft();

    if (cooldownLeft > 0) {
      this.showMessage(
        'Костёр остывает',
        `Костёр можно использовать снова через ${this.formatCooldown(cooldownLeft)}.`
      );
      return;
    }

    if (hpIsFull && potionsAreFull) {
      this.showMessage(
        'Костёр не нужен',
        `HP уже полное, а зелий максимум: ${player.potions}/${maxPotions}.`
      );
      return;
    }

    player.hp = stats.maxHp;
    player.energy = stats.maxEnergy;
    player.potions = maxPotions;

    localStorage.setItem(
      this.CAMPFIRE_LAST_USE_KEY,
      String(Date.now())
    );

    void saveGameAsync();

    this.showMessage(
      'Отдых у костра',
      `HP полностью восстановлено.\nЗелья восстановлены до ${maxPotions}.\n\nКостёр снова будет доступен через 30 минут.`
    );
  }

  private getCampfireCooldownLeft() {
    const lastUse = Number(localStorage.getItem(this.CAMPFIRE_LAST_USE_KEY) ?? 0);

    if (!lastUse) {
      return 0;
    }

    const passed = Date.now() - lastUse;
    const left = this.CAMPFIRE_COOLDOWN_MS - passed;

    return Math.max(0, left);
  }

  private createCampfireTimerText(campfireY: number) {
    const { width } = this.scale;

    this.campfireTimerText = this.add.text(width / 2, campfireY + 96, '', {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: Math.min(width - 80, 500),
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(20);

    this.updateCampfireTimerText();

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.updateCampfireTimerText();
      },
    });
  }

  private updateCampfireTimerText() {
    if (!this.campfireTimerText) {
      return;
    }

    const stats = getPlayerStats(player);

    const maxPotions = 6;
    const hpIsFull = player.hp >= stats.maxHp;
    const potionsAreFull = player.potions >= maxPotions;
    const cooldownLeft = this.getCampfireCooldownLeft();

    if (cooldownLeft > 0) {
      this.campfireTimerText.setText(
        `Костёр будет доступен через ${this.formatCooldown(cooldownLeft)}`
      );
      this.campfireTimerText.setColor(UI.colors.red);
      return;
    }

    if (hpIsFull && potionsAreFull) {
      this.campfireTimerText.setText(
        `Костёр не нужен: HP полное, зелья ${player.potions}/${maxPotions}`
      );
      this.campfireTimerText.setColor(UI.colors.textMuted);
      return;
    }

    this.campfireTimerText.setText(
      'Костёр готов: восстановит HP и зелья до 6'
    );
    this.campfireTimerText.setColor(UI.colors.green);
  }

  private tryEnterCatacombs(hasActiveRun: boolean) {
    const stats = getPlayerStats(player);

    const hpPercent = stats.maxHp > 0
      ? player.hp / stats.maxHp
      : 1;

    if (hpPercent < 0.7) {
      this.showLowHpWarning(hasActiveRun);
      return;
    }

    if (hasActiveRun) {
      this.scene.start('DungeonScene');
      return;
    }

    this.scene.start('DungeonSelectScene');
  }

  private showLowHpWarning(hasActiveRun: boolean) {
    const layout = this.getLayout();
    const stats = getPlayerStats(player);

    const campfireY = 620;

    const hpPercent = Math.round((player.hp / stats.maxHp) * 100);
    const cooldownLeft = this.getCampfireCooldownLeft();
    const canRest = cooldownLeft <= 0;

    const modal = this.createModalShell(layout, 430);

    const title = this.add.text(layout.centerX, layout.height / 2 - 178, 'Ты ранен', {
      fontFamily: UI.font.title,
      fontSize: '32px',
      color: UI.colors.red,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 60,
      },
    }).setOrigin(0.5).setDepth(1002);

    const message = this.add.text(
      layout.centerX,
      layout.height / 2 - 82,
      [
        `Здоровье: ${player.hp}/${stats.maxHp} HP`,
        `Осталось примерно ${hpPercent}% здоровья.`,
        '',
        'Перед спуском лучше отдохнуть у костра.',
        canRest
          ? 'Костёр сейчас доступен.'
          : `Костёр будет доступен через ${this.formatCooldown(cooldownLeft)}.`,
      ].join('\n'),
      {
        fontFamily: UI.font.body,
        fontSize: '19px',
        color: UI.colors.text,
        align: 'center',
        lineSpacing: 6,
        wordWrap: {
          width: layout.contentWidth - 80,
        },
      }
    ).setOrigin(0.5).setDepth(1002);

    const buttonWidth = Math.min(layout.contentWidth - 140, 430);

    const closePopup = () => {
      modal.destroy();

      title.destroy();
      message.destroy();

      restButton.shadow.destroy();
      restButton.bg.destroy();
      restButton.label.destroy();

      continueButton.shadow.destroy();
      continueButton.bg.destroy();
      continueButton.label.destroy();

      cancelButton.shadow.destroy();
      cancelButton.bg.destroy();
      cancelButton.label.destroy();
    };

    const restButton = createButton(
      this,
      layout.centerX,
      layout.height / 2 + 42,
      canRest ? 'Отдохнуть у костра' : 'Костёр недоступен',
      () => {
        if (!canRest) {
          return;
        }

        closePopup();
        this.restAtCampfire();
      },
      buttonWidth,
      52,
      {
        disabled: !canRest,
      }
    );

    this.createCampfireTimerText(campfireY);

    this.setButtonDepth(restButton, 1001);

    const continueButton = createButton(
      this,
      layout.centerX,
      layout.height / 2 + 106,
      'Всё равно идти',
      () => {
        if (hasActiveRun) {
          this.scene.start('DungeonScene');
          return;
        }

        this.scene.start('DungeonSelectScene');
      },
      buttonWidth,
      52,
      {
        danger: true,
      }
    );

    this.setButtonDepth(continueButton, 1001);

    const cancelButton = createButton(
      this,
      layout.centerX,
      layout.height / 2 + 170,
      'Остаться в городе',
      () => {
        closePopup();
      },
      buttonWidth,
      52
    );

    this.setButtonDepth(cancelButton, 1001);
  }

  private formatCooldown(ms: number) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
  
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }


  private returnToCampfireCheckpoint() {
    const result = restoreCampfireBattleCheckpoint();

    if (!result.success) {
      this.showMessage(
        'Костёр погас',
        `${result.message}

Вернуться в бой уже нельзя.`
      );
      return;
    }

    void saveGameAsync();

    this.scene.start('DungeonScene');
  }

  private showLeaveRunMessage() {
    const activeCheckpoint = getActiveCampfireBattleCheckpoint();

    this.showConfirmMessage(
      'Покинуть спуск?',
      activeCheckpoint
        ? 'Если выйти сейчас, текущий ярус придётся проходить заново. Чекпоинт костра тоже будет потерян.'
        : 'Если выйти сейчас, текущий ярус придётся проходить заново.',
      () => {
        resetFloorRun();
        clearCampfireBattleCheckpoint();

        void saveGameAsync();

        this.scene.restart();
      }
    );
  }

  

  private createModalShell(layout: CampLayout, height: number) {
    const modal = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add.rectangle(
      layout.centerX,
      layout.height / 2,
      layout.width,
      layout.height,
      0x000000,
      0.72
    ).setInteractive();

    const panelWidth = Math.min(layout.contentWidth, 620);
    const panelHeight = Math.min(height, layout.height - 120);

    const panel = this.add.rectangle(
      layout.centerX,
      layout.height / 2,
      panelWidth,
      panelHeight,
      0x17100c,
      0.98
    ).setStrokeStyle(3, UI.colors.goldDark, 0.9);

    modal.add([overlay, panel]);

    return {
      container: modal,
      destroy: () => {
        modal.destroy(true);
      },
    };
  }

  private showMessage(title: string, message: string) {
    const layout = this.getLayout();
    const modal = this.createModalShell(layout, 300);

    const titleText = this.add.text(layout.centerX, layout.height / 2 - 95, title, {
      fontFamily: UI.font.title,
      fontSize: '29px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 80,
      },
    }).setOrigin(0.5).setDepth(1002);

    const messageText = this.add.text(layout.centerX, layout.height / 2 - 10, message, {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 80,
      },
      lineSpacing: 7,
    }).setOrigin(0.5).setDepth(1002);

    const ok = createButton(
      this,
      layout.centerX,
      layout.height / 2 + 95,
      'Понятно',
      () => {
        modal.destroy();
        this.scene.restart();
      },
      260,
      54
    );

    this.setButtonDepth(ok, 1001);

    modal.container.add([
      titleText,
      messageText,
      ok.shadow,
      ok.bg,
      ok.label,
    ]);
  }

  private showConfirmMessage(
    title: string,
    message: string,
    onConfirm: () => void
  ) {
    const layout = this.getLayout();
    const modal = this.createModalShell(layout, 340);

    const titleText = this.add.text(layout.centerX, layout.height / 2 - 115, title, {
      fontFamily: UI.font.title,
      fontSize: '29px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 80,
      },
    }).setOrigin(0.5).setDepth(1002);

    const messageText = this.add.text(layout.centerX, layout.height / 2 - 35, message, {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 80,
      },
      lineSpacing: 7,
    }).setOrigin(0.5).setDepth(1002);

    const buttonWidth = Math.min((layout.contentWidth - 90) / 2, 230);
    const leftX = layout.centerX - buttonWidth / 2 - 10;
    const rightX = layout.centerX + buttonWidth / 2 + 10;

    const cancel = createButton(
      this,
      leftX,
      layout.height / 2 + 100,
      'Отмена',
      () => {
        modal.destroy();
      },
      buttonWidth,
      54
    );

    this.setButtonDepth(cancel, 1001);

    const confirm = createButton(
      this,
      rightX,
      layout.height / 2 + 100,
      'Выйти',
      () => {
        modal.destroy();
        onConfirm();
      },
      buttonWidth,
      54,
      {
        danger: true,
      }
    );

    this.setButtonDepth(confirm, 1001);

    modal.container.add([
      titleText,
      messageText,
      cancel.shadow,
      cancel.bg,
      cancel.label,
      confirm.shadow,
      confirm.bg,
      confirm.label,
    ]);
  }

  private setButtonDepth(
    button: {
      shadow: Phaser.GameObjects.GameObject & { setDepth: (depth: number) => unknown };
      bg: Phaser.GameObjects.GameObject & { setDepth: (depth: number) => unknown };
      label: Phaser.GameObjects.GameObject & { setDepth: (depth: number) => unknown };
    },
    baseDepth: number
  ) {
    button.shadow.setDepth(baseDepth);
    button.bg.setDepth(baseDepth + 1);
    button.label.setDepth(baseDepth + 2);
  }
}