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
  getQuests,
  isQuestCompleted,
  isQuestClaimed,
} from '../systems/QuestSystem';

import {
  UI,
  createPanel,
  createSceneBackground,
  createTitle,
} from '../ui/theme';

export class CampScene extends Phaser.Scene {
  private readonly campfireCooldownMs = 5 * 60 * 1000;

  private restButtonLabel?: Phaser.GameObjects.Text;
  private campfireTimerEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super('CampScene');
  }

  create() {
    createSceneBackground(this);
    this.createCampBackdrop();

    createTitle(this, 'Лагерь у входа', 'Последний огонь перед катакомбами');

    this.createPlayerLine();
    this.createTopStatusStrip();
    this.createMainActions();

    createBottomNav(this, {
      activeScene: 'CampScene',
    });
  }

  private createCampBackdrop() {
    const { width, height } = this.scale;

    // Тёплое свечение костра
    this.add.circle(width / 2, 410, 250, 0x8a3f1c, 0.08).setDepth(0);
    this.add.circle(width / 2, 410, 145, 0xf0a040, 0.07).setDepth(0);
    this.add.circle(width / 2, 410, 70, 0xffc46b, 0.055).setDepth(0);

    // Туман
    for (let i = 0; i < 14; i += 1) {
      const x = 40 + i * 55;
      const y = 155 + (i % 5) * 70;

      this.add.circle(x, y, 28 + (i % 3) * 9, 0xffffff, 0.016).setDepth(0);
    }

    // Тёмная земля снизу
    this.add.rectangle(width / 2, height - 195, width, 310, 0x050403, 0.34).setDepth(0);

    // Центральный костёр
    this.add.circle(width / 2, 405, 52, 0x000000, 0.22).setDepth(1);
    this.add.circle(width / 2, 395, 40, 0xf08a24, 0.13).setDepth(1);

    this.add.text(width / 2, 395, '♨', {
      fontFamily: UI.font.body,
      fontSize: '46px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(2);
  }

  private createPlayerLine() {
    const { width } = this.scale;

    const vkUser = getCachedVKUser();
    const vkName = vkUser ? vkUser.first_name : 'локальный режим';

    this.add.text(width / 2, 120, `Игрок: ${vkName}`, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.textMuted,
    }).setOrigin(0.5).setDepth(10);
  }

  private createTopStatusStrip() {
    const { width } = this.scale;

    const race = player.raceId ? getRaceById(player.raceId) : null;
    const stats = getPlayerStats(player);

    const y = 205;

    this.createRoundedPanel({
      x: width / 2,
      y,
      width: 620,
      height: 120,
      radius: 30,
      color: 0x0d0a08,
      alpha: 0.9,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.42,
      depth: 2,
    });

    const heroName =
      race && player.name === race.name
        ? player.name
        : race
          ? `${player.name} • ${race.name}`
          : player.name;

    this.add.text(width / 2 - 270, y - 37, heroName, {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(6);

    this.add.text(width / 2 + 185, y - 37, `Ур. ${player.level}`, {
      fontFamily: UI.font.title,
      fontSize: '20px',
      color: UI.colors.green,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(6);

    this.createSmallBar({
      x: width / 2 - 135,
      y: y + 3,
      width: 250,
      label: 'HP',
      value: `${player.hp}/${stats.maxHp}`,
      progress: stats.maxHp > 0 ? player.hp / stats.maxHp : 1,
      color: UI.colors.redHex,
    });

    this.createSmallBar({
      x: width / 2 + 155,
      y: y + 3,
      width: 250,
      label: 'Энергия',
      value: `${player.energy}/${stats.maxEnergy}`,
      progress: stats.maxEnergy > 0 ? player.energy / stats.maxEnergy : 1,
      color: UI.colors.blueHex,
    });

    this.createTinyResource(width / 2 - 185, y + 47, '◆', `${player.gold}`);
    this.createTinyResource(width / 2, y + 47, '✚', `${player.potions}`);
    this.createTinyResource(width / 2 + 185, y + 47, '★', `${player.relicIds.length}`);
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

  private createMainActions() {
    const { width } = this.scale;

    const hasActiveRun =
      gameState.floorRun.active &&
      gameState.floorRun.rooms.length > 0;

    const hasQuestReward = this.hasClaimableQuests();

    const panelY = 720;
    const panelHeight = hasActiveRun ? 705 : 640;

    this.createRoundedPanel({
      x: width / 2,
      y: panelY,
      width: 620,
      height: panelHeight,
      radius: 36,
      color: 0x0b0908,
      alpha: 0.9,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.48,
      depth: 2,
    });

    const dungeonTitle = hasActiveRun
      ? 'Продолжить спуск'
      : 'Войти в катакомбы';

    const dungeonDesc = hasActiveRun
      ? `Ты остановился на этаже ${gameState.floorRun.currentFloor}.`
      : 'Начать новый спуск в глубины.';

    this.createMainDungeonButton({
      x: width / 2,
      y: panelY - panelHeight / 2 + 105,
      title: dungeonTitle,
      description: dungeonDesc,
      hasActiveRun,
      onClick: () => {
        this.tryEnterCatacombs(hasActiveRun);
      },
    });

    let gridY = panelY - panelHeight / 2 + 230;

    if (hasActiveRun) {
      this.createWideActionButton({
        x: width / 2,
        y: gridY,
        icon: '!',
        title: 'Покинуть спуск',
        description: 'Текущий ярус придётся проходить заново.',
        accentColor: UI.colors.redHex,
        danger: true,
        onClick: () => {
          this.showLeaveRunMessage();
        },
      });

      gridY += 120;
    }

    const leftX = width / 2 - 142;
    const rightX = width / 2 + 142;

    this.createCampTile({
      x: leftX,
      y: gridY,
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
      y: gridY,
      icon: '▲',
      title: 'Тренировка',
      description: 'Прокачка героя',
      accentColor: UI.colors.greenHex,
      onClick: () => {
        this.scene.start('TrainingScene');
      },
    });

    this.createCampTile({
      x: leftX,
      y: gridY + 120,
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
      y: gridY + 120,
      icon: '⚒',
      title: 'Кузница',
      description: 'Улучшения',
      accentColor: UI.colors.goldDark,
      onClick: () => {
        this.scene.start('ForgeScene');
      },
    });

    const restCard = this.createWideActionButton({
      x: width / 2,
      y: gridY + 250,
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

  private createMainDungeonButton(config: {
  x: number;
  y: number;
  title: string;
  description: string;
  hasActiveRun: boolean;
  onClick: () => void;
}) {
  const accent = config.hasActiveRun ? UI.colors.greenHex : UI.colors.redHex;

  this.createRoundedPanel({
    x: config.x,
    y: config.y,
    width: 560,
    height: 100,
    radius: 28,
    color: config.hasActiveRun ? 0x102016 : 0x1a100d,
    alpha: 0.98,
    strokeColor: accent,
    strokeAlpha: 0.82,
    strokeWidth: 2,
    depth: 4,
  });

  this.add.circle(config.x - 230, config.y, 32, accent, 0.15)
    .setStrokeStyle(2, accent, 0.72)
    .setDepth(6);

  this.add.text(config.x - 230, config.y, config.hasActiveRun ? '▼' : '☠', {
    fontFamily: UI.font.body,
    fontSize: '27px',
    color: config.hasActiveRun ? UI.colors.green : UI.colors.red,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(7);

  const titleText = this.add.text(config.x - 180, config.y - 18, config.title, {
    fontFamily: UI.font.title,
    fontSize: '25px',
    color: config.hasActiveRun ? UI.colors.green : UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0, 0.5).setDepth(7);

  this.add.text(config.x - 180, config.y + 19, config.description, {
    fontFamily: UI.font.body,
    fontSize: '15px',
    color: UI.colors.textMuted,
    wordWrap: {
      width: 400,
    },
  }).setOrigin(0, 0.5).setDepth(7);

  this.createClickZone(config.x, config.y, 560, 100, () => {
    config.onClick();
  }, titleText);
}

private createCampTile(config: {
  x: number;
  y: number;
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
    width: 270,
    height: 100,
    radius: 24,
    color: highlighted ? 0x102016 : 0x17100c,
    alpha: highlighted ? 0.98 : 0.94,
    strokeColor: config.accentColor,
    strokeAlpha: highlighted ? 0.88 : 0.42,
    strokeWidth: highlighted ? 2 : 1,
    depth: 4,
  });

  this.add.circle(config.x - 92, config.y, 25, config.accentColor, 0.14)
    .setStrokeStyle(1, config.accentColor, 0.62)
    .setDepth(6);

  this.add.text(config.x - 92, config.y, config.icon, {
    fontFamily: UI.font.body,
    fontSize: '21px',
    color: highlighted ? UI.colors.green : UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(7);

  const titleText = this.add.text(config.x - 55, config.y - 17, config.title, {
    fontFamily: UI.font.title,
    fontSize: '18px',
    color: highlighted ? UI.colors.green : UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0, 0.5).setDepth(7);

  this.add.text(config.x - 55, config.y + 16, config.description, {
    fontFamily: UI.font.body,
    fontSize: '13px',
    color: UI.colors.textMuted,
    wordWrap: {
      width: 170,
    },
  }).setOrigin(0, 0.5).setDepth(7);

  this.createClickZone(config.x, config.y, 270, 100, () => {
    config.onClick();
  }, titleText);

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
  icon: string;
  title: string;
  description: string;
  accentColor: number;
  danger?: boolean;
  onClick: () => void;
}) {
  const danger = config.danger ?? false;

  this.createRoundedPanel({
    x: config.x,
    y: config.y,
    width: 560,
    height: 78,
    radius: 24,
    color: danger ? 0x241010 : 0x17100c,
    alpha: 0.96,
    strokeColor: config.accentColor,
    strokeAlpha: danger ? 0.72 : 0.44,
    strokeWidth: danger ? 2 : 1,
    depth: 4,
  });

  this.add.circle(config.x - 230, config.y, 24, config.accentColor, 0.14)
    .setStrokeStyle(1, config.accentColor, 0.62)
    .setDepth(6);

  this.add.text(config.x - 230, config.y, config.icon, {
    fontFamily: UI.font.body,
    fontSize: '20px',
    color: danger ? UI.colors.red : UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(7);

  const titleText = this.add.text(config.x - 190, config.y - 13, config.title, {
    fontFamily: UI.font.title,
    fontSize: '20px',
    color: danger ? UI.colors.red : UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0, 0.5).setDepth(7);

  this.add.text(config.x - 190, config.y + 17, config.description, {
    fontFamily: UI.font.body,
    fontSize: '14px',
    color: UI.colors.textMuted,
    wordWrap: {
      width: 390,
    },
  }).setOrigin(0, 0.5).setDepth(7);

  this.createClickZone(config.x, config.y, 560, 78, () => {
    config.onClick();
  }, titleText);

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
  titleText?: Phaser.GameObjects.Text
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
    titleText?.setColor(UI.colors.goldText);
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
  value: string
) {
  this.createRoundedPanel({
    x,
    y,
    width: 150,
    height: 34,
    radius: 15,
    color: 0x17100c,
    alpha: 0.95,
    strokeColor: UI.colors.goldDark,
    strokeAlpha: 0.35,
    strokeWidth: 1,
    depth: 4,
  });

  this.add.text(x - 44, y, icon, {
    fontFamily: UI.font.body,
    fontSize: '15px',
    color: UI.colors.goldText,
  }).setOrigin(0.5).setDepth(6);

  this.add.text(x - 20, y, value, {
    fontFamily: UI.font.title,
    fontSize: '16px',
    color: UI.colors.text,
    stroke: '#000000',
    strokeThickness: 2,
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
  shadow.fillStyle(0x000000, 0.28);
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

  private restAtCampfire() {
    const currentCooldownLeft = this.getCampfireCooldownLeft();

    if (currentCooldownLeft > 0) {
      this.showRestCooldownMessage(currentCooldownLeft);
      return;
    }

    const stats = getPlayerStats(player);

    player.hp = stats.maxHp;
    player.energy = stats.maxEnergy;
    player.potions = Math.max(player.potions, 2);

    gameState.lastCampRestAt = Date.now();

    void saveGameAsync();

    this.updateCampfireButtonText();
    this.showRestMessage();
  }

  private getCampfireCooldownLeft() {
    const lastRestAt = gameState.lastCampRestAt ?? 0;

    if (lastRestAt <= 0) {
      return 0;
    }

    const passed = Date.now() - lastRestAt;
    const left = this.campfireCooldownMs - passed;

    return Math.max(0, left);
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
    const { width, height } = this.scale;

    const stats = getPlayerStats(player);

    const hpPercent = Math.round((player.hp / stats.maxHp) * 100);
    const cooldownLeft = this.getCampfireCooldownLeft();
    const canRest = cooldownLeft <= 0;

    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.72
    )
      .setDepth(1000)
      .setInteractive();

    const panel = createPanel(this, width / 2, height / 2, 620, 430, {
      alpha: 0.98,
      stroke: true,
      warm: true,
    }).setDepth(1001);

    const title = this.add.text(width / 2, height / 2 - 180, 'Ты ранен', {
      fontFamily: UI.font.title,
      fontSize: '34px',
      color: UI.colors.red,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(1002);

    const message = this.add.text(
      width / 2,
      height / 2 - 85,
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
        fontSize: '20px',
        color: UI.colors.text,
        align: 'center',
        lineSpacing: 6,
        wordWrap: {
          width: 540,
        },
      }
    ).setOrigin(0.5).setDepth(1002);

    const closePopup = () => {
      overlay.destroy();
      panel.destroy();
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
      width / 2,
      height / 2 + 45,
      canRest ? 'Отдохнуть у костра' : 'Костёр недоступен',
      () => {
        if (!canRest) {
          return;
        }

        closePopup();
        this.restAtCampfire();
      },
      430,
      52,
      {
        disabled: !canRest,
      }
    );

    restButton.shadow.setDepth(1001);
    restButton.bg.setDepth(1002);
    restButton.label.setDepth(1003);

    const continueButton = createButton(
      this,
      width / 2,
      height / 2 + 110,
      'Всё равно идти',
      () => {
        if (hasActiveRun) {
          this.scene.start('DungeonScene');
          return;
        }

        this.scene.start('DungeonSelectScene');
      },
      430,
      52,
      {
        danger: true,
      }
    );

    continueButton.shadow.setDepth(1001);
    continueButton.bg.setDepth(1002);
    continueButton.label.setDepth(1003);

    const cancelButton = createButton(
      this,
      width / 2,
      height / 2 + 175,
      'Остаться в городе',
      () => {
        closePopup();
      },
      430,
      52
    );

    cancelButton.shadow.setDepth(1001);
    cancelButton.bg.setDepth(1002);
    cancelButton.label.setDepth(1003);
  }

  private formatCooldown(ms: number) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private showRestMessage() {
    this.showMessage(
      'Отдых у костра',
      'Ты восстановил здоровье, энергию и пополнил запас зелий.'
    );
  }

  private showRestCooldownMessage(cooldownLeft: number) {
    this.showMessage(
      'Костёр ещё тлеет',
      `Перед следующим отдыхом нужно подождать: ${this.formatCooldown(cooldownLeft)}.`
    );
  }

  private showLeaveRunMessage() {
    this.showConfirmMessage(
      'Покинуть спуск?',
      'Если выйти сейчас, текущий ярус придётся проходить заново.',
      () => {
        resetFloorRun();

        void saveGameAsync();

        this.scene.restart();
      }
    );
  }

  private showMessage(title: string, message: string) {
    const { width, height } = this.scale;

    const modal = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.72
    ).setInteractive();

    const panel = this.add.rectangle(width / 2, height / 2, 620, 300, 0x17100c, 0.98)
      .setStrokeStyle(3, UI.colors.goldDark, 0.9);

    const titleText = this.add.text(width / 2, height / 2 - 95, title, {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const messageText = this.add.text(width / 2, height / 2 - 10, message, {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 540,
      },
      lineSpacing: 7,
    }).setOrigin(0.5);

    const ok = createButton(
      this,
      width / 2,
      height / 2 + 95,
      'Понятно',
      () => {
        modal.destroy(true);
        this.scene.restart();
      },
      260,
      54
    );

    modal.add([
      overlay,
      panel,
      titleText,
      messageText,
      ok.shadow,
      ok.bg,
      ok.label,
    ]);
  }

  private showConfirmMessage(title: string, message: string, onConfirm: () => void) {
    const { width, height } = this.scale;

    const modal = this.add.container(0, 0).setDepth(1000);

    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.72
    ).setInteractive();

    const panel = this.add.rectangle(width / 2, height / 2, 620, 340, 0x17100c, 0.98)
      .setStrokeStyle(3, UI.colors.goldDark, 0.9);

    const titleText = this.add.text(width / 2, height / 2 - 115, title, {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const messageText = this.add.text(width / 2, height / 2 - 35, message, {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 540,
      },
      lineSpacing: 7,
    }).setOrigin(0.5);

    const cancel = createButton(
      this,
      width / 2 - 130,
      height / 2 + 100,
      'Отмена',
      () => {
        modal.destroy(true);
      },
      230,
      54
    );

    const confirm = createButton(
      this,
      width / 2 + 130,
      height / 2 + 100,
      'Выйти',
      () => {
        modal.destroy(true);
        onConfirm();
      },
      230,
      54,
      {
        danger: true,
      }
    );

    modal.add([
      overlay,
      panel,
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
}