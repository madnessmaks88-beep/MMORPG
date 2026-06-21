import Phaser from 'phaser';

import { player } from '../data/player';

import { saveGameAsync } from '../systems/SaveSystem';

import { createButton } from '../ui/createButton';
import {
  UI,
  createPanel,
  createSceneBackground,
  createSectionTitle,
  createTitle,
} from '../ui/theme';

export class TrainingScene extends Phaser.Scene {
  constructor() {
    super('TrainingScene');
  }

  create() {
    createSceneBackground(this);
    createTitle(this, 'Тренировочная площадка', 'Прокачка героя за золото');

    this.createGoldPanel();
    this.createTrainingList();
    this.createBackButton();
  }

  private createGoldPanel() {
    const { width } = this.scale;

    createPanel(this, width / 2, 170, 620, 110, {
      alpha: 0.72,
      stroke: false,
      warm: true,
    });

    this.add.text(width / 2, 145, 'Золото героя', {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    this.add.text(width / 2, 190, `${player.gold}`, {
      fontFamily: UI.font.body,
      fontSize: '28px',
      color: UI.colors.text,
    }).setOrigin(0.5);
  }

  private createTrainingList() {
    const { width } = this.scale;

    const panelY = 600;

    createPanel(this, width / 2, panelY, 620, 610, {
      alpha: 0.86,
      stroke: true,
      warm: false,
    });

    createSectionTitle(this, width / 2, panelY - 260, 'Тренировки');

    this.createTrainingCard({
      y: panelY - 160,
      icon: '✚',
      title: 'Закалка тела',
      description: 'Навсегда увеличивает максимальное HP на 10.',
      price: this.getHpUpgradePrice(),
      currentValue: `HP: ${player.maxHp}`,
      onBuy: () => {
        this.buyHpUpgrade();
      },
    });

    this.createTrainingCard({
      y: panelY,
      icon: '⚔',
      title: 'Силовая тренировка',
      description: 'Навсегда увеличивает силу на 1. Сила также влияет на базовую атаку.',
      price: this.getStrengthUpgradePrice(),
      currentValue: `Сила: ${player.strength}`,
      onBuy: () => {
        this.buyStrengthUpgrade();
      },
    });

    this.createTrainingCard({
      y: panelY + 160,
      icon: '◇',
      title: 'Тренировка ловкости',
      description: 'Навсегда увеличивает ловкость на 1. Ловкость повышает шанс уклонения.',
      price: this.getAgilityUpgradePrice(),
      currentValue: `Ловкость: ${player.agility}`,
      onBuy: () => {
        this.buyAgilityUpgrade();
      },
    });
  }

  private createTrainingCard(config: {
    y: number;
    icon: string;
    title: string;
    description: string;
    price: number;
    currentValue: string;
    onBuy: () => void;
  }) {
    const { width } = this.scale;

    const canBuy = player.gold >= config.price;

    this.add.rectangle(width / 2, config.y + 5, 560, 130, 0x000000, 0.24);

    this.add.rectangle(width / 2, config.y, 560, 130, 0x14100d, 0.88)
      .setStrokeStyle(2, UI.colors.goldDark, 0.5);

    this.add.circle(width / 2 - 245, config.y - 30, 28, 0x2a1d13, 1)
      .setStrokeStyle(2, UI.colors.goldDark, 0.7);

    this.add.text(width / 2 - 245, config.y - 30, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '23px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    this.add.text(width / 2 - 205, config.y - 45, config.title, {
      fontFamily: UI.font.title,
      fontSize: '20px',
      color: UI.colors.goldText,
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 205, config.y - 10, config.description, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.text,
      wordWrap: {
        width: 330,
      },
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 205, config.y + 36, `${config.currentValue}  •  Цена: ${config.price}`, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: canBuy ? UI.colors.textMuted : UI.colors.red,
    }).setOrigin(0, 0.5);

    createButton(
      this,
      width / 2 + 205,
      config.y + 25,
      'Тренировать',
      config.onBuy,
      140,
      44,
      {
        small: true,
        disabled: !canBuy,
      }
    );
  }

  private getHpUpgradePrice() {
    return 100 + Math.floor((player.maxHp - 100) / 10) * 40;
  }

  private getStrengthUpgradePrice() {
    return 140 + Math.max(0, player.strength - 11) * 55;
  }

  private getAgilityUpgradePrice() {
    return 120 + Math.max(0, player.agility - 5) * 50;
  }

  private buyHpUpgrade() {
    const price = this.getHpUpgradePrice();

    if (player.gold < price) {
      this.showMessage('Недостаточно золота.');
      return;
    }

    player.gold -= price;
    player.maxHp += 10;
    player.hp += 10;

    void saveGameAsync();

    this.showMessage('Максимальное HP увеличено на 10.');
  }

  private buyStrengthUpgrade() {
    const price = this.getStrengthUpgradePrice();

    if (player.gold < price) {
      this.showMessage('Недостаточно золота.');
      return;
    }

    player.gold -= price;
    player.strength += 1;
    player.attack += 1;

    void saveGameAsync();

    this.showMessage('Сила увеличена на 1.');
  }

  private buyAgilityUpgrade() {
    const price = this.getAgilityUpgradePrice();

    if (player.gold < price) {
      this.showMessage('Недостаточно золота.');
      return;
    }

    player.gold -= price;
    player.agility += 1;

    void saveGameAsync();

    this.showMessage('Ловкость увеличена на 1.');
  }

  private showMessage(message: string) {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setDepth(100)
      .setInteractive();

    const panelShadow = this.add.rectangle(width / 2, height / 2 + 6, 600, 270, 0x000000, 0.35)
      .setDepth(101);

    const panel = this.add.rectangle(width / 2, height / 2, 600, 270, 0x17100c, 0.98)
      .setStrokeStyle(3, UI.colors.goldDark, 0.9)
      .setDepth(102)
      .setInteractive();

    const title = this.add.text(width / 2, height / 2 - 82, 'Тренировка', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(103);

    const text = this.add.text(width / 2, height / 2 - 10, message, {
      fontFamily: UI.font.body,
      fontSize: '21px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 520,
      },
    }).setOrigin(0.5).setDepth(103);

    const ok = createButton(
      this,
      width / 2,
      height / 2 + 85,
      'Понятно',
      () => {
        overlay.destroy();
        panelShadow.destroy();
        panel.destroy();
        title.destroy();
        text.destroy();

        ok.shadow.destroy();
        ok.bg.destroy();
        ok.label.destroy();

        this.scene.restart();
      },
      260,
      54
    );

    ok.shadow.setDepth(102);
    ok.bg.setDepth(103);
    ok.label.setDepth(104);
  }

  private createBackButton() {
    const { width } = this.scale;

    createButton(
      this,
      width / 2,
      1115,
      'Вернуться в дом',
      () => {
        this.scene.start('HomeScene');
      },
      520,
      56
    );
  }
}