import Phaser from 'phaser';

import { player } from '../data/player';
import { enemies } from '../data/enemies';
import type { EnemyData } from '../data/enemies';
import { saveGameAsync } from '../systems/SaveSystem';
import { trackEnemyKilled, trackGoldEarned } from '../systems/QuestSystem';
import { getRandomLootItem } from '../data/items';
import {
  enemyAttack,
  playerAttack,
  playerBloodStrike,
  playerPowerAttack,
  restoreEnergy,
  useHealingPotion,
} from '../systems/BattleSystem';
import { goToNextRoom } from '../data/gameState';
import { addExperience, createLevelUpText } from '../systems/LevelSystem';
import {
  addItemToInventory,
  getPlayerStats,
  getRarityText,
} from '../systems/InventorySystem';

export class BattleScene extends Phaser.Scene {
  private enemy!: EnemyData;

  private playerCard!: Phaser.GameObjects.Container;
  private enemyCard!: Phaser.GameObjects.Container;

  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private energyText!: Phaser.GameObjects.Text;
  private potionText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private energyBar!: Phaser.GameObjects.Rectangle;

  private powerButtonBg!: Phaser.GameObjects.Rectangle;
  private bloodButtonBg!: Phaser.GameObjects.Rectangle;
  private potionButtonBg!: Phaser.GameObjects.Rectangle;

  private returnToDungeon = false;
  private isBattleEnded = false;
  private isBusy = false;

  constructor() {
    super('BattleScene');
  }

  init(data: { enemyId: string; returnToDungeon?: boolean }) {
    const foundEnemy = enemies.find(enemy => enemy.id === data.enemyId);

    if (!foundEnemy) {
      throw new Error(`Enemy with id ${data.enemyId} not found`);
    }

    this.enemy = {
      ...foundEnemy,
      hp: foundEnemy.maxHp,
    };

    this.returnToDungeon = data.returnToDungeon ?? false;
    this.isBattleEnded = false;
    this.isBusy = false;

    player.energy = player.maxEnergy;
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x080808);

    this.add.text(width / 2, 60, 'Бой', {
      fontFamily: 'Arial',
      fontSize: '54px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, 185, 620, 175, 0x171313);
    this.add.rectangle(width / 2, 185, 580, 135, 0x0d0d0d);

    this.createStatusBars();

    this.createBattleBackground();

    this.enemyCard = this.createFighterCard(
      width / 2,
      430,
      this.enemy.name,
      '☠',
      0x241515
    );

    this.playerCard = this.createFighterCard(
      width / 2,
      685,
      player.name,
      '🗡',
      0x151b24
    );

      this.logText = this.add.text(width / 2, 830, 'Выбери действие.', {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#b8aa91',
      align: 'center',
      wordWrap: {
        width: 620,
      },
      lineSpacing: 6,
    }).setOrigin(0.5);

    this.createActionButtons();

    this.updateTexts();
  }

  private createActionButtons() {
    this.createSkillButton(
      220,
      980,
      'Атака',
      '0 EN',
      () => {
        this.handleAttack();
      }
    );

    this.powerButtonBg = this.createSkillButton(
      500,
      980,
      'Сильный удар',
      '2 EN',
      () => {
        this.handlePowerAttack();
      },
      {
        disabled: player.energy < 2,
      }
    );

    this.bloodButtonBg = this.createSkillButton(
      220,
      1060,
      'Кровавый удар',
      '1 EN',
      () => {
        this.handleBloodStrike();
      },
      {
        disabled: player.energy < 1,
      }
    );

    this.createSkillButton(
      500,
      1060,
      'Защита',
      '0 EN',
      () => {
        this.handleDefend();
      }
    );

    this.potionButtonBg = this.createSkillButton(
      220,
      1140,
      'Зелье',
      `🧪 ${player.potions}`,
      () => {
        this.handlePotion();
      },
      {
        disabled: player.potions <= 0,
      }
    );

    this.createSkillButton(500, 1140, 'Побег', 'Нельзя', () => {
      if (this.isBusy) {
        return;
      }
    
      this.logText.setText('Ты не можешь сбежать из этого подземелья.');
    });
  }

  private createBattleBackground() {
    const { width } = this.scale;

    // Общая тёмная арена
    this.add.rectangle(width / 2, 545, 620, 470, 0x101010);
    this.add.rectangle(width / 2, 545, 580, 430, 0x161313);

    // Каменная задняя стена
    this.add.rectangle(width / 2, 430, 540, 165, 0x0d0d0d);
    this.add.rectangle(width / 2, 430, 500, 125, 0x141111);

    // Нижняя площадка героя
    this.add.rectangle(width / 2, 685, 540, 165, 0x0d1116);
    this.add.rectangle(width / 2, 685, 500, 125, 0x121822);

    // Разделительная линия между врагом и героем
    this.add.rectangle(width / 2, 555, 520, 3, 0x8b5a2b, 0.45);

    // Каменные блоки на фоне
    for (let i = 0; i < 8; i++) {
      const x = 120 + i * 70;

      this.add.rectangle(x, 360, 58, 24, 0x1b1715, 0.55);
      this.add.rectangle(x + 24, 470, 58, 24, 0x1b1715, 0.4);
    }

    // Тёмные боковые края
    this.add.rectangle(85, 545, 35, 420, 0x050505, 0.55);
    this.add.rectangle(width - 85, 545, 35, 420, 0x050505, 0.55);

    // Факелы
    this.createTorch(130, 390);
    this.createTorch(width - 130, 390);

    // Лёгкий туман/пыль
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(110, width - 110);
      const y = Phaser.Math.Between(340, 760);
      const radius = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.05, 0.13);

      this.add.circle(x, y, radius, 0xd8b56d, alpha);
    }
  }

  private createTorch(x: number, y: number) {
    this.add.rectangle(x, y + 35, 12, 55, 0x4a2a16);
    this.add.rectangle(x, y + 8, 34, 10, 0x3a2014);

    const glow = this.add.circle(x, y - 12, 58, 0xe0772f, 0.08);

    const outerFlame = this.add.triangle(
      x,
      y - 15,
      0,
      44,
      24,
      0,
      48,
      44,
      0xc24747,
      0.85
    ).setOrigin(0.5);

    const innerFlame = this.add.triangle(
      x,
      y - 8,
      0,
      30,
      16,
      0,
      32,
      30,
      0xf0d58a,
      0.95
    ).setOrigin(0.5);

    this.tweens.add({
      targets: [outerFlame, innerFlame, glow],
      scaleX: 1.08,
      scaleY: 0.94,
      alpha: {
        from: 0.85,
        to: 1,
      },
      duration: 520,
      yoyo: true,
      repeat: -1,
    });
  }

  private updateActionButtons() {
    this.setSkillButtonState(this.powerButtonBg, player.energy >= 2);
    this.setSkillButtonState(this.bloodButtonBg, player.energy >= 1);
    this.setSkillButtonState(this.potionButtonBg, player.potions > 0);
  }

  private setSkillButtonState(
    bg: Phaser.GameObjects.Rectangle,
    enabled: boolean
  ) {
    bg.setFillStyle(enabled ? 0x241515 : 0x121212);
    bg.setStrokeStyle(2, enabled ? 0x8b5a2b : 0x3b3028);
  }

  private createSkillButton(
    x: number,
    y: number,
    title: string,
    subtitle: string,
    onClick: () => void,
    options: {
      width?: number;
      height?: number;
      disabled?: boolean;
    } = {}
  ) {
    const buttonWidth = options.width ?? 290;
    const buttonHeight = options.height ?? 64;
    const disabled = options.disabled ?? false;

    const container = this.add.container(x, y);

    const bg = this.add.rectangle(
      0,
      0,
      buttonWidth,
      buttonHeight,
      disabled ? 0x121212 : 0x241515
    );

    bg.setStrokeStyle(2, disabled ? 0x3b3028 : 0x8b5a2b);

    const titleText = this.add.text(0, -11, title, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: disabled ? '#5d554c' : '#e6d2aa',
      align: 'center',
    }).setOrigin(0.5);

    const subtitleText = this.add.text(0, 15, subtitle, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: disabled ? '#4f4940' : '#8f826d',
      align: 'center',
    }).setOrigin(0.5);

    container.add([bg, titleText, subtitleText]);

    bg.setInteractive({ useHandCursor: !disabled });

    bg.on('pointerover', () => {
      if (!disabled) {
        bg.setFillStyle(0x3a2020);
      }
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(disabled ? 0x121212 : 0x241515);
    });

    bg.on('pointerdown', () => {
      if (!disabled) {
        onClick();
      }
    });

    return bg;
  }

  private createStatusBars() {
    const { width } = this.scale;

    const barX = 150;
    const barWidth = 430;

    this.add.text(85, 125, 'Герой', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#e6d2aa',
    }).setOrigin(0, 0.5);

    this.add.rectangle(barX, 150, barWidth, 22, 0x2a1111).setOrigin(0, 0.5);
    this.playerHpBar = this.add.rectangle(barX, 150, barWidth, 22, 0xc24747).setOrigin(0, 0.5);

    this.playerHpText = this.add.text(barX + barWidth / 2, 150, '', {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(85, 185, 'Враг', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#e6d2aa',
    }).setOrigin(0, 0.5);

    this.add.rectangle(barX, 210, barWidth, 22, 0x2a1111).setOrigin(0, 0.5);
    this.enemyHpBar = this.add.rectangle(barX, 210, barWidth, 22, 0xc24747).setOrigin(0, 0.5);

    this.enemyHpText = this.add.text(barX + barWidth / 2, 210, '', {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(85, 245, 'Энергия', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#e6d2aa',
    }).setOrigin(0, 0.5);

    this.add.rectangle(barX, 270, barWidth, 20, 0x101b2a).setOrigin(0, 0.5);
    this.energyBar = this.add.rectangle(barX, 270, barWidth, 20, 0x70a6ff).setOrigin(0, 0.5);

    this.energyText = this.add.text(barX + barWidth / 2, 270, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.potionText = this.add.text(width - 75, 125, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#75d184',
      align: 'right',
    }).setOrigin(1, 0.5);
  }

  private setBarValue(
    bar: Phaser.GameObjects.Rectangle,
    current: number,
    max: number,
    fullWidth = 430
  ) {
    const percent = Phaser.Math.Clamp(current / max, 0, 1);
    const targetWidth = Math.max(0, fullWidth * percent);

    this.tweens.add({
      targets: bar,
      width: targetWidth,
      duration: 220,
      ease: 'Power2',
    });
  }

  private createFighterCard(
    x: number,
    y: number,
    name: string,
    icon: string,
    color: number
  ) {
    const container = this.add.container(x, y);

    const shadow = this.add.rectangle(0, 12, 400, 150, 0x000000, 0.35);
    const bg = this.add.rectangle(0, 0, 400, 150, color);
    bg.setStrokeStyle(3, 0x8b5a2b);

    const iconText = this.add.text(0, -20, icon, {
      fontFamily: 'Arial',
      fontSize: '62px',
      color: '#d8b56d',
    }).setOrigin(0.5);

    const nameText = this.add.text(0, 50, name, {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#e6d2aa',
      align: 'center',
      wordWrap: {
        width: 380,
      },
    }).setOrigin(0.5);

    container.add([shadow, bg, iconText, nameText]);

    return container;
  }

  private showFloatingText(
    x: number,
    y: number,
    text: string,
    color = '#ffffff'
  ) {
    const floatingText = this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: '34px',
      color,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: floatingText,
      y: y - 70,
      alpha: 0,
      duration: 850,
      ease: 'Power2',
      onComplete: () => {
        floatingText.destroy();
      },
    });
  }

  private flashScreen(color = 0xc24747, alpha = 0.35) {
    const { width, height } = this.scale;

    const flash = this.add.rectangle(width / 2, height / 2, width, height, color, alpha);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 260,
      onComplete: () => {
        flash.destroy();
      },
    });
  }

  private animatePlayerAttack() {
    this.tweens.add({
      targets: this.playerCard,
      y: this.playerCard.y - 28,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
    });
  }

  private animateEnemyAttack() {
    this.tweens.add({
      targets: this.enemyCard,
      y: this.enemyCard.y + 28,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
    });
  }

  private animateHit(target: Phaser.GameObjects.Container) {
    this.tweens.add({
      targets: target,
      x: target.x + 12,
      duration: 55,
      yoyo: true,
      repeat: 3,
    });
  }

  private shakeBattle(power = 0.006, duration = 180) {
    this.cameras.main.shake(duration, power);
  }

  private handleAttack() {
    if (!this.canAct()) return;

    this.isBusy = true;

    this.animatePlayerAttack();

    const playerResult = playerAttack(player, this.enemy);

    this.showFloatingText(
      this.enemyCard.x,
      this.enemyCard.y - 55,
      `-${playerResult.damage}`,
      playerResult.isCrit ? '#f0d58a' : '#ff6b6b'
    );

    this.animateHit(this.enemyCard);

    if (this.checkEnemyDead(playerResult.damage, playerResult.isCrit)) {
      return;
    }

    this.enemyTurn(
      `Ты наносишь ${playerResult.damage} урона.${playerResult.isCrit ? '\nКритический удар!' : ''}`
    );
  }

  private handlePowerAttack() {
    if (!this.canAct()) return;

    if (player.energy < 2) {
      this.logText.setText('Недостаточно энергии для сильного удара.');
      return;
    }

    this.isBusy = true;
    player.energy -= 2;

    this.animatePlayerAttack();
    this.shakeBattle(0.004, 120);

    const playerResult = playerPowerAttack(player, this.enemy);

    this.showFloatingText(
      this.enemyCard.x,
      this.enemyCard.y - 55,
      `-${playerResult.damage}`,
      playerResult.isCrit ? '#f0d58a' : '#ff4d4d'
    );

    this.animateHit(this.enemyCard);

    if (this.checkEnemyDead(playerResult.damage, playerResult.isCrit)) {
      return;
    }

    this.enemyTurn(
      `Ты вкладываешь силы в удар.\nНанесено ${playerResult.damage} урона.${playerResult.isCrit ? '\nКритический удар!' : ''}`
    );
  }

  private handleBloodStrike() {
    if (!this.canAct()) return;
    
    if (player.energy < 1) {
      this.logText.setText('Недостаточно энергии для кровавого удара.');
      return;
    }
  
    this.isBusy = true;
    player.energy -= 1;
  
    this.animatePlayerAttack();
  
    const playerResult = playerBloodStrike(player, this.enemy);
  
    this.showFloatingText(
      this.enemyCard.x,
      this.enemyCard.y - 55,
      `-${playerResult.damage}`,
      playerResult.isCrit ? '#f0d58a' : '#ff4d4d'
    );
  
    this.showFloatingText(
      this.playerCard.x,
      this.playerCard.y - 55,
      `+${playerResult.healAmount ?? 0}`,
      '#75d184'
    );
  
    this.animateHit(this.enemyCard);
  
    if (this.checkEnemyDead(
      playerResult.damage,
      playerResult.isCrit,
      `\nТы восстановил ${playerResult.healAmount ?? 0} HP.`
    )) {
      return;
    }
  
    this.enemyTurn(
      `Ты используешь кровавый удар.\nНанесено ${playerResult.damage} урона.\nВосстановлено ${playerResult.healAmount ?? 0} HP.${playerResult.isCrit ? '\nКритический удар!' : ''}`
    );
  }

  private handleDefend() {
    if (!this.canAct()) return;
    
    this.isBusy = true;
    
    this.showFloatingText(
      this.playerCard.x,
      this.playerCard.y - 55,
      'Защита',
      '#70a6ff'
    );
  
    this.enemyTurn('Ты поднимаешь оружие и готовишься принять удар.', true);
  }

  private handlePotion() {
    if (!this.canAct()) return;

    if (player.potions <= 0) {
      this.logText.setText('Зелий больше нет.');
      return;
    }

    this.isBusy = true;

    const healAmount = useHealingPotion(player);

    this.showFloatingText(
      this.playerCard.x,
      this.playerCard.y - 55,
      `+${healAmount}`,
      '#75d184'
    );

    this.enemyTurn(`Ты выпиваешь зелье и восстанавливаешь ${healAmount} HP.`);
  }

  private enemyTurn(playerActionText: string, isDefending = false) {
    this.updateTexts();

    this.time.delayedCall(500, () => {
      this.animateEnemyAttack();

      const enemyResult = enemyAttack(this.enemy, player, isDefending);

      if (enemyResult.dodged) {
        this.showFloatingText(
          this.playerCard.x,
          this.playerCard.y - 55,
          'УКЛОНЕНИЕ',
          '#70a6ff'
        );

        restoreEnergy(player, 1);

        this.logText.setText(
          `${playerActionText}\n\nТы уклонился от атаки врага.\nЭнергия восстановлена на 1.`
        );

        this.updateTexts();
        this.isBusy = false;

        return;
      }

      this.showFloatingText(
        this.playerCard.x,
        this.playerCard.y - 55,
        `-${enemyResult.damage}`,
        isDefending ? '#70a6ff' : '#ff6b6b'
      );

      this.animateHit(this.playerCard);

      if (!isDefending) {
        this.flashScreen(0xc24747, 0.25);
      }

      restoreEnergy(player, 1);

      if (enemyResult.playerDead) {
        this.isBattleEnded = true;

        this.logText.setText(
          `${playerActionText}\n\n${this.enemy.name} наносит ${enemyResult.damage} урона.\n\nТы пал в катакомбах...`
        );

        this.updateTexts();

        this.time.delayedCall(2000, () => {
          const stats = getPlayerStats(player);
          player.hp = stats.maxHp;
          player.energy = player.maxEnergy;

          void saveGameAsync();

          this.scene.start('CampScene');
        });

        return;
      }

      this.logText.setText(
        `${playerActionText}\n\n${this.enemy.name} наносит ${enemyResult.damage} урона.\nЭнергия восстановлена на 1.`
      );

      this.updateTexts();
      this.isBusy = false;
    });
  }

  private checkEnemyDead(damage: number, isCrit: boolean, extraText = ''): boolean {
    if (this.enemy.hp > 0) {
      return false;
    }

    this.isBattleEnded = true;
    this.shakeBattle(0.006, 220);

    player.gold += this.enemy.goldReward;
    trackEnemyKilled();
    trackGoldEarned(this.enemy.goldReward);

    const levelResult = addExperience(player, this.enemy.expReward);
    const levelText = createLevelUpText(levelResult);

    let lootText = '';
    const dropChance = Math.random();

    if (dropChance <= 0.35) {
      const item = getRandomLootItem();
      addItemToInventory(player, item.id);
      lootText = `\n\nВыпал ${getRarityText(item).toLowerCase()} предмет:\n${item.name} +0`;
    }

    this.logText.setText(
      `Ты наносишь ${damage} урона.${isCrit ? '\nКритический удар!' : ''}${extraText}

Ты победил: ${this.enemy.name}

Получено опыта: ${this.enemy.expReward}
Получено золота: ${this.enemy.goldReward}${lootText}${levelText}`
    );

    this.updateTexts();

    void saveGameAsync();

    const delay = levelResult.leveledUp ? 3600 : 1900;

    this.time.delayedCall(delay, () => {
      if (this.returnToDungeon) {
        goToNextRoom();
        this.scene.start('DungeonScene');
        return;
      }

      this.scene.start('CampScene');
    });

    return true;
  }

  private canAct(): boolean {
    return !this.isBattleEnded && !this.isBusy;
  }

  private updateTexts() {
    const stats = getPlayerStats(player);
 
    this.playerHpText.setText(`HP ${player.hp}/${stats.maxHp}`);
    this.enemyHpText.setText(`HP ${this.enemy.hp}/${this.enemy.maxHp}`);
    this.energyText.setText(`EN ${player.energy}/${player.maxEnergy}`);
    this.potionText.setText(`🧪 ${player.potions}`);
 
    this.setBarValue(this.playerHpBar, player.hp, stats.maxHp);
    this.setBarValue(this.enemyHpBar, this.enemy.hp, this.enemy.maxHp);
    this.setBarValue(this.energyBar, player.energy, player.maxEnergy);

    if (this.powerButtonBg && this.bloodButtonBg && this.potionButtonBg) {
      this.updateActionButtons();
    }
  }
}