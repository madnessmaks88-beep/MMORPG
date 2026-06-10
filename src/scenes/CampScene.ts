import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState, resetFloorRun } from '../data/gameState';
import { getRaceById } from '../data/races';
import { getRelicById } from '../data/relics';

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
  createSectionTitle,
  createSmallText,
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
    createTitle(this, 'Лагерь у входа', 'Тихое место перед спуском в катакомбы');

    this.createPlayerLine();
    this.createHeroSummary();
    this.createMainActions();
    this.createRunInfo();

    createBottomNav(this, {
      activeScene: 'CampScene',
    });
  }

  private createPlayerLine() {
    const { width } = this.scale;

    const vkUser = getCachedVKUser();
    const vkName = vkUser ? vkUser.first_name : 'локальный режим';

    this.add.text(width / 2, 122, `Игрок: ${vkName}`, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: UI.colors.textMuted,
    }).setOrigin(0.5);
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

  private createHeroSummary() {
    const { width } = this.scale;

    const race = player.raceId ? getRaceById(player.raceId) : null;

    const relicNames = player.relicIds
      .map(id => getRelicById(id)?.name)
      .filter(Boolean);

    const panelY = 270;

    createPanel(this, width / 2, panelY, 620, 220, {
      alpha: 0.88,
      stroke: true,
      warm: true,
    });

    this.add.circle(width / 2, panelY - 72, 34, 0x2a1d13, 1)
      .setStrokeStyle(2, UI.colors.goldDark, 0.55);

    this.add.text(width / 2, panelY - 72, '◆', {
      fontFamily: UI.font.body,
      fontSize: '28px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    this.add.text(width / 2, panelY - 25, player.name, {
      fontFamily: UI.font.title,
      fontSize: '31px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, panelY + 10, race ? race.name : 'Раса не выбрана', {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: UI.colors.text,
    }).setOrigin(0.5);

    const summary = [
      `Уровень ${player.level}`,
      `Золото: ${player.gold}`,
      `Зелья: ${player.potions}`,
    ].join('  •  ');

    createSmallText(this, width / 2, panelY + 48, summary, {
      fontSize: '18px',
      color: UI.colors.text,
      width: 560,
    });

    const relicText =
      relicNames.length > 0
        ? `Реликвии: ${relicNames.join(', ')}`
        : 'Реликвии: нет';

    createSmallText(this, width / 2, panelY + 82, relicText, {
      fontSize: '15px',
      color: relicNames.length > 0 ? '#f0d58a' : UI.colors.textMuted,
      width: 560,
    });
  }

  private createMainActions() {
    const { width } = this.scale;

    const hasActiveRun =
      gameState.floorRun.active &&
      gameState.floorRun.rooms.length > 0;

    const panelY = 615;
    const panelHeight = hasActiveRun ? 550 : 495;

    createPanel(this, width / 2, panelY, 620, panelHeight, {
      alpha: 0.86,
      stroke: true,
      warm: false,
    });

    createSectionTitle(this, width / 2, panelY - panelHeight / 2 + 38, 'Действия');

    const dungeonButtonText = hasActiveRun
      ? `Продолжить спуск: этаж ${gameState.floorRun.currentFloor}`
      : 'Войти в катакомбы';

    let y = panelY - panelHeight / 2 + 105;

    createButton(
      this,
      width / 2,
      y,
      dungeonButtonText,
      () => {
        if (hasActiveRun) {
          this.scene.start('DungeonScene');
          return;
        }

        this.scene.start('DungeonSelectScene');
      },
      540,
      58
    );

    y += 66;

    if (hasActiveRun) {
      createButton(
        this,
        width / 2,
        y,
        'Покинуть спуск',
        () => {
          this.showLeaveRunMessage();
        },
        540,
        54,
        {
          danger: true,
        }
      );

      y += 62;
    }

    createButton(
      this,
      width / 2,
      y,
      'Лавка снабжения',
      () => {
        this.scene.start('ShopScene');
      },
      540,
      54
    );

    y += 62;

    createButton(
      this,
      width / 2,
      y,
      'Тренировочная площадка',
      () => {
        this.scene.start('TrainingScene');
      },
      540,
      54
    );

    y += 62;

    const hasQuestReward = this.hasClaimableQuests();

    const questButton = createButton(
      this,
      width / 2,
      y,
      hasQuestReward ? 'Задания  •  Есть награда!' : 'Задания',
      () => {
        this.scene.start('QuestScene');
      },
      540,
      54
    );
    
    if (hasQuestReward) {
      questButton.bg.setFillStyle(0x263a1f, 0.98);
      questButton.bg.setStrokeStyle(3, UI.colors.greenHex, 0.95);
    
      questButton.label.setColor(UI.colors.green);
    
      this.tweens.add({
        targets: questButton.bg,
        alpha: 0.72,
        duration: 650,
        yoyo: true,
        repeat: -1,
      });
    }

    y += 62;

    createButton(
      this,
      width / 2,
      y,
      'Кузница',
      () => {
        this.scene.start('ForgeScene');
      },
      540,
      54
    );

    y += 62;

    const restButton = createButton(
      this,
      width / 2,
      y,
      this.getRestButtonText(),
      () => {
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
      },
      540,
      56
    );

    this.restButtonLabel = restButton.label;
    this.startCampfireTimer();
  }

  private createRunInfo() {
    const { width } = this.scale;

    const panelY = 905;

    createPanel(this, width / 2, panelY, 620, 130, {
      alpha: 0.68,
      stroke: false,
      warm: true,
    });

    this.add.text(width / 2, panelY - 40, 'Прогресс спуска', {
      fontFamily: UI.font.title,
      fontSize: '22px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    const activeRunText = gameState.floorRun.active
      ? `Активный спуск: этаж ${gameState.floorRun.currentFloor}`
      : 'Активный спуск: нет';

    const text = [
      `Рекорд этажа: ${gameState.highestClearedFloor}`,
      `Пройдено ярусов: ${gameState.highestClearedTier}`,
      `Следующий ярус: ${gameState.highestClearedTier + 1}`,
      activeRunText,
    ].join('\n');

    this.add.text(width / 2, panelY + 18, text, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);
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
    const { width } = this.scale;

    createPanel(this, width / 2, 610, 620, 280, {
      alpha: 0.98,
      stroke: true,
      warm: true,
    }).setDepth(100);

    const titleText = this.add.text(width / 2, 535, title, {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(101);

    const messageText = this.add.text(width / 2, 610, message, {
      fontFamily: UI.font.body,
      fontSize: '21px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 540,
      },
      lineSpacing: 7,
    }).setOrigin(0.5).setDepth(101);

    const button = createButton(
      this,
      width / 2,
      705,
      'Понятно',
      () => {
        this.scene.restart();
      },
      220,
      54
    );

    button.bg.setDepth(101);
    button.shadow.setDepth(100);
    button.label.setDepth(102);

    titleText.setDepth(102);
    messageText.setDepth(102);
  }

  private showConfirmMessage(title: string, message: string, onConfirm: () => void) {
    const { width } = this.scale;

    createPanel(this, width / 2, 610, 620, 320, {
      alpha: 0.98,
      stroke: true,
      warm: true,
    }).setDepth(100);

    this.add.text(width / 2, 510, title, {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(102);

    this.add.text(width / 2, 590, message, {
      fontFamily: UI.font.body,
      fontSize: '21px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 540,
      },
      lineSpacing: 7,
    }).setOrigin(0.5).setDepth(102);

    const cancel = createButton(
      this,
      width / 2 - 125,
      715,
      'Отмена',
      () => {
        this.scene.restart();
      },
      220,
      54
    );

    const confirm = createButton(
      this,
      width / 2 + 125,
      715,
      'Выйти',
      () => {
        onConfirm();
      },
      220,
      54,
      {
        danger: true,
      }
    );

    cancel.shadow.setDepth(100);
    cancel.bg.setDepth(101);
    cancel.label.setDepth(102);

    confirm.shadow.setDepth(100);
    confirm.bg.setDepth(101);
    confirm.label.setDepth(102);
  }
}