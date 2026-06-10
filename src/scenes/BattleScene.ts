import Phaser from 'phaser';

import { player } from '../data/player';
import { enemies } from '../data/enemies';
import type { EnemyData } from '../data/enemies';
import { saveGameAsync } from '../systems/SaveSystem';
import { trackEnemyKilled, trackGoldEarned } from '../systems/QuestSystem';
import { getRandomLootItem } from '../data/items';
import {
  restoreEnergy,
} from '../systems/BattleSystem';
import {
  gameState,
  goToNextRoom,
  resetFloorRun,
} from '../data/gameState';
import { addExperience, createLevelUpText } from '../systems/LevelSystem';
import {
  addItemToInventory,
  getPlayerStats,
  getRarityText,
  rollItemDrop,
} from '../systems/InventorySystem';
import { getCurrentRoom, markCurrentRoomCompleted } from '../systems/FloorSystem';

import { createButton } from '../ui/createButton';

import {
  UI,
  createPanel,
  createTitle,
} from '../ui/theme';




type BattleStats = {
  maxHp: number;
  maxEnergy: number;

  attack: number;
  defense: number;
  critChance: number;

  agility: number;
  luck: number;
  strength: number;
  intelligence: number;

  dodgeChance: number;
  trapDodgeChance: number;
  lootChanceBonus: number;
};

export class BattleScene extends Phaser.Scene {
  private enemy!: EnemyData;

  private playerCard!: Phaser.GameObjects.Container;
  private enemyCard!: Phaser.GameObjects.Container;

  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private energyText!: Phaser.GameObjects.Text;
  private potionText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  private actionButtons: Phaser.GameObjects.GameObject[] = [];

  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private energyBar!: Phaser.GameObjects.Rectangle;

  private returnToDungeon = false;
  private isBattleEnded = false;
  private isBusy = false;

  private humanPassiveActivated = false;
  private desperateStrikeCooldown = 0;

  private readonly powerAttackEnergyCost = 2;
  private readonly desperateStrikeEnergyCost = 3;
  private readonly desperateStrikeCooldownTurns = 2;

  constructor() {
    super('BattleScene');
  }

  init(data: { enemyId: string; returnToDungeon?: boolean }) {
    const foundEnemy = enemies.find(enemy => enemy.id === data.enemyId);

    if (!foundEnemy) {
      this.scene.start('DungeonScene');
      return;
    }

    this.enemy = this.createScaledEnemy(foundEnemy);

    this.returnToDungeon = data.returnToDungeon ?? false;
    this.isBattleEnded = false;
    this.isBusy = false;

    this.humanPassiveActivated = false;
    this.desperateStrikeCooldown = 0;

    player.energy = player.maxEnergy;
  }

  create() {
  const { width } = this.scale;

  const floor = gameState.floorRun.currentFloor || 1;
  const room = getCurrentRoom();

  this.createBattleBackground();

  createTitle(
    this,
    `Бой — этаж ${floor}`,
    room ? room.title : `${player.name} против ${this.enemy.name}`
  );

  createPanel(this, width / 2, 185, 620, 150, {
    alpha: 0.72,
    stroke: false,
    warm: true,
  });

  this.createBattleBackground();

  this.enemyCard = this.createFighterCard(
    width / 2,
    245,
    this.enemy.name,
    '☠',
    0x241515
  );

  this.playerCard = this.createFighterCard(
    width / 2,
    520,
    player.name,
    '🗡',
    0x151b24
  );

  createPanel(this, width / 2, 770, 620, 135, {
    alpha: 0.68,
    stroke: false,
    warm: true,
  });

  this.logText = this.add.text(width / 2, 770, 'Выбери действие.', {
    fontFamily: UI.font.body,
    fontSize: '22px',
    color: UI.colors.text,
    align: 'center',
    wordWrap: {
      width: 580,
    },
    lineSpacing: 6,
  }).setOrigin(0.5);

  this.createActionButtons();

  this.updateTexts();
}

  private createActionButtons() {
    const { width } = this.scale;
    
    this.actionButtons.forEach(object => {
      object.destroy();
    });
  
    this.actionButtons = [];
  
    const panel = createPanel(this, width / 2, 1060, 620, 300, {
      alpha: 0.86,
      stroke: true,
      warm: false,
    });
  
    this.actionButtons.push(panel);
  
    const attackButton = createButton(
      this,
      width / 2,
      920,
      'Атака  •  0 энергии',
      () => this.handleAttack(),
      540,
      54
    );
  
    this.actionButtons.push(
      attackButton.shadow,
      attackButton.bg,
      attackButton.label
    );
  
    const powerButton = createButton(
      this,
      width / 2,
      982,
      'Сильный удар  •  2 энергии',
      () => this.handlePowerAttack(),
      540,
      54,
      {
        disabled: player.energy < 2,
      }
    );
  
    this.actionButtons.push(
      powerButton.shadow,
      powerButton.bg,
      powerButton.label
    );
  
    const desperateText =
      this.desperateStrikeCooldown > 0
        ? `Отчаянный удар  •  КД ${this.desperateStrikeCooldown}`
        : 'Отчаянный удар  •  3 энергии';
  
    const desperateButton = createButton(
      this,
      width / 2,
      1044,
      desperateText,
      () => this.handleDesperateStrike(),
      540,
      54,
      {
        disabled:
          player.raceId !== 'human' ||
          player.energy < 3 ||
          this.desperateStrikeCooldown > 0,
      }
    );
  
    this.actionButtons.push(
      desperateButton.shadow,
      desperateButton.bg,
      desperateButton.label
    );
  
    const defendButton = createButton(
      this,
      width / 2,
      1106,
      'Защита  •  +1 энергия',
      () => this.handleDefend(),
      540,
      54
    );
  
    this.actionButtons.push(
      defendButton.shadow,
      defendButton.bg,
      defendButton.label
    );
  
    const potionButton = createButton(
      this,
      width / 2,
      1168,
      `Зелье здоровья  •  ${player.potions}`,
      () => this.handlePotion(),
      540,
      54,
      {
        disabled: player.potions <= 0,
      }
    );
  
    this.actionButtons.push(
      potionButton.shadow,
      potionButton.bg,
      potionButton.label
    );
  }

  

  private handlePowerAttack() {
    if (this.isBattleEnded || this.isBusy) {
      return;
    }

    if (player.energy < this.powerAttackEnergyCost) {
      this.logText.setText('Недостаточно энергии для сильного удара.');
      return;
    }

    this.isBusy = true;

    player.energy -= this.powerAttackEnergyCost;

    const stats = this.getBattleStats();

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: 1.65,
      varianceMin: -1,
      varianceMax: 5,
    });

    const isCrit = Math.random() < stats.critChance;
    const finalDamage = isCrit ? Math.floor(damage * 1.5) : damage;

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Критический сильный удар! Ты наносишь ${finalDamage} урона.`
      : `Ты наносишь сильный удар на ${finalDamage} урона.`;

    this.afterPlayerAttack(playerActionText);
  }

  private handleDefend() {
    if (this.isBattleEnded || this.isBusy) {
      return;
    }

    this.isBusy = true;

    restoreEnergy(player, 1);

    const playerActionText = 'Ты занял защитную стойку.\nЭнергия восстановлена на 1.';

    this.logText.setText(playerActionText);
    this.updateTexts();

    this.time.delayedCall(450, () => {
      this.enemyTurn(playerActionText, true);
    });
  }

  

  private createScaledEnemy(enemy: EnemyData): EnemyData {
    const floor = gameState.floorRun.currentFloor || 1;
    const room = getCurrentRoom();
    const modifier = gameState.floorRun.modifier;

    let multiplier = 1 + (floor - 1) * 0.08;

    if (room?.type === 'elite') {
      multiplier *= 1.25;
    }

    if (room?.type === 'boss') {
      multiplier *= 1.55;
    }

    if (room?.type === 'tier_boss') {
      multiplier *= 2.2;
    }

    if (modifier === 'elite' && room?.type === 'elite') {
      multiplier *= 1.15;
    }

    if (modifier === 'cursed') {
      multiplier *= 1.25;
    }

    if (modifier === 'tier_boss') {
      multiplier *= 1.2;
    }

    const scaledMaxHp = Math.floor(enemy.maxHp * multiplier);
    const scaledAttack = Math.floor(enemy.attack * multiplier);
    const scaledDefense = Math.floor(enemy.defense * multiplier);

    let rewardMultiplier = 1 + floor * 0.07;

    if (modifier === 'elite') {
      rewardMultiplier += 0.15;
    }

    if (modifier === 'cursed') {
      rewardMultiplier += 0.25;
    }

    if (room?.type === 'boss') {
      rewardMultiplier += 0.2;
    }

    if (room?.type === 'tier_boss') {
      rewardMultiplier += 0.45;
    }

    const scaledExp = Math.floor(enemy.expReward * rewardMultiplier);
    const scaledGold = Math.floor(enemy.goldReward * rewardMultiplier);

    return {
      ...enemy,
      maxHp: scaledMaxHp,
      hp: scaledMaxHp,
      attack: scaledAttack,
      defense: scaledDefense,
      expReward: scaledExp,
      goldReward: scaledGold,
    };
  }

  private getBattleStats(): BattleStats {
   const stats = getPlayerStats(player);

   const bonus = this.getHumanBattleBonus();

   const battleAgility = stats.agility + bonus.agility;
   const battleStrength = player.strength + bonus.attack;
   const battleIntelligence = player.intelligence + bonus.intelligence;

   return {
     ...stats,

     attack: stats.attack + bonus.attack,
     defense: stats.defense + bonus.defense,

     maxEnergy: stats.maxEnergy,

     strength: battleStrength,
     agility: battleAgility,
     intelligence: battleIntelligence,

     dodgeChance: Math.min(0.22, battleAgility * 0.01),
     trapDodgeChance: stats.trapDodgeChance,
     lootChanceBonus: stats.lootChanceBonus,
   };
  }

  private handleDesperateStrike() {
    if (this.isBattleEnded || this.isBusy) {
      return;
    }

    if (player.raceId !== 'human') {
      this.logText.setText('Этот навык доступен только человеку.');
      return;
    }

    if (this.desperateStrikeCooldown > 0) {
      this.logText.setText(`Отчаянный удар перезаряжается: ${this.desperateStrikeCooldown} хода.`);
      return;
    }

    if (player.energy < this.desperateStrikeEnergyCost) {
      this.logText.setText('Недостаточно энергии для отчаянного удара.');
      return;
    }

    this.isBusy = true;

    player.energy -= this.desperateStrikeEnergyCost;

    const stats = this.getBattleStats();

    const hpLostRatio = 1 - player.hp / stats.maxHp;

    const multiplier = 1.35 + hpLostRatio * 1.25;

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier,
      varianceMin: 0,
      varianceMax: 6,
    });

    const finalDamage = Math.floor(damage);

    this.desperateStrikeCooldown = this.desperateStrikeCooldownTurns;

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const hpLostPercent = Math.round(hpLostRatio * 100);

    const playerActionText =
      `Отчаянный удар!\n` +
      `Потеряно HP: ${hpLostPercent}%.\n` +
      `Ты наносишь ${finalDamage} урона.`;

    this.afterPlayerAttack(playerActionText);
  }

  private calculateDamage(config: {
    baseDamage: number;
    multiplier: number;
    varianceMin: number;
    varianceMax: number;
  }) {
    const rawDamage =
      config.baseDamage * config.multiplier +
      Phaser.Math.Between(config.varianceMin, config.varianceMax);

    const reducedDamage = rawDamage - this.enemy.defense * 0.45;

    return Math.max(1, Math.floor(reducedDamage));
  }

  private damageEnemy(damage: number) {
    this.enemy.hp = Math.max(0, this.enemy.hp - damage);

    this.showFloatingText(
      this.enemyCard.x,
      this.enemyCard.y - 55,
      `-${damage}`,
      '#ff6b6b'
    );

    this.animateHit(this.enemyCard);
  }

  private afterPlayerAttack(playerActionText: string) {
    this.updateTexts();
    this.createActionButtons();

    if (this.enemy.hp <= 0) {
      this.handleVictory(playerActionText);
      return;
    }

    this.enemyTurn(playerActionText);
  }

  private createBattleBackground() {
    const { width, height } = this.scale;

    // основной фон
    this.add.rectangle(width / 2, height / 2, width, height, 0x050403, 1);

    // дальняя красная дымка
    this.add.circle(width / 2, 155, 260, 0x301008, 0.34);
    this.add.circle(width / 2, 190, 180, 0x5c1a0d, 0.2);
    this.add.circle(width / 2, 220, 90, 0xb9481a, 0.08);

    // задняя стена арены
    this.add.rectangle(width / 2, 355, 650, 520, 0x0b0807, 0.92)
      .setStrokeStyle(2, 0x332013, 0.7);

    // верхняя тёмная арка
    this.add.ellipse(width / 2, 250, 500, 300, 0x120b08, 0.78)
      .setStrokeStyle(2, 0x2e1a10, 0.45);

    this.add.ellipse(width / 2, 275, 330, 210, 0x080605, 0.88)
      .setStrokeStyle(2, 0x28170f, 0.35);

    // камни на задней стене
    const brickRows = [
      { y: 165, count: 5, offset: 0 },
      { y: 215, count: 6, offset: -45 },
      { y: 265, count: 5, offset: 0 },
      { y: 315, count: 6, offset: -45 },
      { y: 365, count: 5, offset: 0 },
    ];

    brickRows.forEach(row => {
      for (let i = 0; i < row.count; i++) {
        const brickWidth = 92;
        const brickHeight = 34;

        const x =
          width / 2 -
          ((row.count - 1) * brickWidth) / 2 +
          i * brickWidth +
          row.offset;

        this.add.rectangle(x, row.y, brickWidth - 6, brickHeight, 0x120d0a, 0.42)
          .setStrokeStyle(1, 0x2a1b12, 0.26);
      }
    });

    // боковые колонны
    this.add.rectangle(96, 405, 58, 500, 0x0e0a08, 0.9)
      .setStrokeStyle(2, 0x2a1a10, 0.55);

    this.add.rectangle(width - 96, 405, 58, 500, 0x0e0a08, 0.9)
      .setStrokeStyle(2, 0x2a1a10, 0.55);

    this.add.rectangle(96, 155, 76, 36, 0x17100c, 0.92)
      .setStrokeStyle(2, 0x3c2515, 0.55);

    this.add.rectangle(width - 96, 155, 76, 36, 0x17100c, 0.92)
      .setStrokeStyle(2, 0x3c2515, 0.55);

    // красное свечение за врагом
    this.add.circle(width / 2, 245, 165, 0x781d12, 0.12);
    this.add.circle(width / 2, 245, 95, 0xff5a2a, 0.055);

    // пол арены
    this.add.rectangle(width / 2, 625, 650, 230, 0x0d0907, 0.96)
      .setStrokeStyle(2, 0x372114, 0.7);

    // перспектива пола
    const floorTopY = 520;
    const floorBottomY = 735;

    for (let i = 0; i < 9; i++) {
      const xTop = 150 + i * 52;
      const xBottom = 70 + i * 72;

      const line = this.add.line(
        0,
        0,
        xTop,
        floorTopY,
        xBottom,
        floorBottomY,
        0x2a1a10,
        0.38
      );

      line.setOrigin(0, 0);
    }

    for (let i = 0; i < 5; i++) {
      const y = floorTopY + i * 43;

      this.add.line(
        0,
        0,
        95,
        y,
        width - 95,
        y,
        0x2a1a10,
        0.32
      ).setOrigin(0, 0);
    }

    // передняя тень пола
    this.add.rectangle(width / 2, 735, 650, 80, 0x050403, 0.48);

    // мягкий туман
    for (let i = 0; i < 9; i++) {
      const x = Phaser.Math.Between(90, width - 90);
      const y = Phaser.Math.Between(430, 720);
      const radius = Phaser.Math.Between(42, 95);

      this.add.circle(x, y, radius, 0x8a6a48, 0.025);
    }

    // пепел / искры
    for (let i = 0; i < 55; i++) {
      const x = Phaser.Math.Between(28, width - 28);
      const y = Phaser.Math.Between(70, height - 210);
      const size = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.035, 0.09);

      this.add.circle(x, y, size, 0xd8b56d, alpha);
    }

    // несколько красных искр ближе к центру
    for (let i = 0; i < 16; i++) {
      const x = Phaser.Math.Between(width / 2 - 190, width / 2 + 190);
      const y = Phaser.Math.Between(150, 520);
      const size = Phaser.Math.Between(1, 2);

      this.add.circle(x, y, size, 0xff6b35, 0.12);
    }

    // затемнение под интерфейсом кнопок
    this.add.rectangle(width / 2, height - 160, width, 330, 0x040302, 0.58);

    // лёгкая виньетка по бокам
    this.add.rectangle(28, height / 2, 56, height, 0x000000, 0.32);
    this.add.rectangle(width - 28, height / 2, 56, height, 0x000000, 0.32);
  }


  private checkHumanPassive() {
    if (player.raceId !== 'human') {
      return '';
    }

    if (this.humanPassiveActivated) {
      return '';
    }

    const stats = getPlayerStats(player);
    const hpPercent = player.hp / stats.maxHp;

    if (hpPercent > 0.25) {
      return '';
    }

    this.humanPassiveActivated = true;

    return '\n\nПассивный навык сработал: Воля к борьбе.\nДо конца боя характеристики увеличены.';
  }

  private getHumanBattleBonus() {
    if (player.raceId !== 'human') {
      return {
        attack: 0,
        defense: 0,
        agility: 0,
        intelligence: 0,
      };
    }
  
    if (!this.humanPassiveActivated) {
      return {
        attack: 0,
        defense: 0,
        agility: 0,
        intelligence: 0,
      };
    }
  
    return {
      attack: 2,
      defense: 2,
      agility: 2,
      intelligence: 2,
    };
  }


  private createFighterCard(
    x: number,
    y: number,
    name: string,
    icon: string,
    color: number
  ) {
    const isEnemy = icon === '☠';

    const container = this.add.container(x, y);

    const strokeColor = isEnemy ? 0x6b2a2a : UI.colors.goldDark;
    const iconColor = isEnemy ? UI.colors.red : UI.colors.goldText;
    const titleColor = isEnemy ? UI.colors.red : UI.colors.goldText;

    const shadow = this.add.rectangle(0, 6, 620, 190, 0x000000, 0.24);

    const bg = this.add.rectangle(0, 0, 620, 190, color, 0.88)
      .setStrokeStyle(2, strokeColor, 0.6);

    const iconBg = this.add.circle(-245, -35, 38, isEnemy ? 0x2a1010 : 0x2a1d13, 1)
      .setStrokeStyle(2, strokeColor, 0.65);

    const iconText = this.add.text(-245, -35, icon, {
      fontFamily: UI.font.body,
      fontSize: '31px',
      color: iconColor,
    }).setOrigin(0.5);

    const nameText = this.add.text(-190, -58, name, {
      fontFamily: UI.font.title,
      fontSize: '25px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5);

    const hpText = this.add.text(-190, -18, '', {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.text,
    }).setOrigin(0, 0.5);

    const extraText = this.add.text(-190, 24, '', {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: UI.colors.textMuted,
    }).setOrigin(0, 0.5);

    const barBack = this.add.rectangle(0, 72, 520, 10, 0x080808, 0.9);
    const hpBar = this.add.rectangle(-260, 72, 520, 10, isEnemy ? 0xff6b6b : 0x75d184, 0.95)
      .setOrigin(0, 0.5);

    const energyBack = this.add.rectangle(0, 92, 520, 8, 0x080808, isEnemy ? 0 : 0.9);

    const energyBar = this.add.rectangle(-260, 92, 520, 8, 0x70a6ff, isEnemy ? 0 : 0.95)
      .setOrigin(0, 0.5);

    container.add([
      shadow,
      bg,
      iconBg,
      iconText,
      nameText,
      hpText,
      extraText,
      barBack,
      hpBar,
      energyBack,
      energyBar,
    ]);

    if (isEnemy) {
      this.enemyHpText = hpText;
      this.enemyHpBar = hpBar;

      extraText.setText(`Атака: ${this.enemy.attack}  •  Защита: ${this.enemy.defense}`);
    } else {
      this.playerHpText = hpText;
      this.playerHpBar = hpBar;
      this.energyBar = energyBar;

      this.energyText = extraText;

      const stats = this.getBattleStats();

      this.potionText = this.add.text(245, 10, `Зелья: ${player.potions}`, {
        fontFamily: UI.font.body,
        fontSize: '16px',
        color: UI.colors.textMuted,
        align: 'right',
      }).setOrigin(1, 0.5);

      const statsText = this.add.text(245, -34, [
        `Атака: ${stats.attack}`,
        `Защита: ${stats.defense}`,
        `Крит: ${Math.round(stats.critChance * 100)}%`,
      ].join('\n'), {
        fontFamily: UI.font.body,
        fontSize: '16px',
        color: UI.colors.textMuted,
        align: 'right',
        lineSpacing: 4,
      }).setOrigin(1, 0.5);

      container.add([this.potionText, statsText]);
    }

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
    if (this.isBattleEnded || this.isBusy) {
      return;
    }

    this.isBusy = true;

    const stats = this.getBattleStats();

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: 1,
      varianceMin: -2,
      varianceMax: 3,
    });

    const isCrit = Math.random() < stats.critChance;
    const finalDamage = isCrit ? Math.floor(damage * 1.6) : damage;

    this.animatePlayerAttack();

    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Критическая атака! Ты наносишь ${finalDamage} урона.`
      : `Ты атакуешь и наносишь ${finalDamage} урона.`;

    this.afterPlayerAttack(playerActionText);
  }

  private handleVictory(playerActionText: string) {
    if (this.isBattleEnded) {
      return;
    }

    this.isBattleEnded = true;
    this.isBusy = true;

    const gold = this.enemy.goldReward;

    player.gold += gold;

    trackEnemyKilled();
    trackGoldEarned(gold);

    gameState.floorRun.monstersDefeated += 1;
    gameState.floorRun.goldEarned += gold;
    gameState.floorRun.expEarned += this.enemy.expReward;

    const expResult = addExperience(player, this.enemy.expReward);

    let lootText = '';

    if (rollItemDrop(player, 0.15)) {
      const item = getRandomLootItem();

      addItemToInventory(player, item.id);

      lootText = `\nПредмет: ${item.name} (${getRarityText(item)})`;
    }

    let levelText = '';

    if (expResult.leveledUp) {
      levelText = `\n\n${createLevelUpText(expResult)}`;
    }

    void saveGameAsync();

    this.logText.setText(
      `${playerActionText}\n\n` +
      `${this.enemy.name} повержен.\n` +
      `Получено золота: ${gold}\n` +
      `Получено опыта: ${this.enemy.expReward}` +
      `${lootText}` +
      `${levelText}`
    );

    this.updateTexts();

    this.time.delayedCall(2200, () => {
      if (this.returnToDungeon) {
        markCurrentRoomCompleted();
        goToNextRoom();

        void saveGameAsync();

        this.scene.start('DungeonScene');
        return;
      }

      this.scene.start('CampScene');
    });
  }

  private handlePotion() {
    if (this.isBattleEnded || this.isBusy) {
      return;
    }

    if (player.potions <= 0) {
      this.logText.setText('Зелий больше нет.');
      this.updateTexts();
      return;
    }

    const stats = this.getBattleStats();

    if (player.hp >= stats.maxHp) {
      this.logText.setText('HP уже полное. Зелье не потрачено.');
      this.updateTexts();
      return;
    }

    this.isBusy = true;

    player.potions = Math.max(0, player.potions - 1);

    const healAmount = Math.floor(stats.maxHp * 0.35);
    player.hp = Math.min(stats.maxHp, player.hp + healAmount);

    const playerActionText = `Ты выпил зелье и восстановил ${healAmount} HP.`;

    this.logText.setText(playerActionText);

    this.updateTexts();
    this.createActionButtons();

    void saveGameAsync();

    this.time.delayedCall(450, () => {
      this.enemyTurn(playerActionText);
    });
  }

  private enemyTurn(playerActionText: string, isDefending = false) {
    this.updateTexts();

    this.time.delayedCall(500, () => {
      this.animateEnemyAttack();

      const stats = this.getBattleStats();

      if (Math.random() < stats.dodgeChance) {
        this.showFloatingText(
          this.playerCard.x,
          this.playerCard.y - 55,
          'УКЛОНЕНИЕ',
          '#70a6ff'
        );

        restoreEnergy(player, 1);

        const passiveText = this.checkHumanPassive();

        this.logText.setText(
          `${playerActionText}\n\nТы уклонился от атаки врага.\nЭнергия восстановлена на 1.${passiveText}`
        );

        this.updateTexts();
        this.tickDesperateStrikeCooldown();
        this.isBusy = false;
        this.createActionButtons();

        return;
      }

      let damage = Math.max(
        1,
        this.enemy.attack + Phaser.Math.Between(-2, 3) - stats.defense
      );

      if (isDefending) {
        damage = Math.max(1, Math.floor(damage * 0.45));
      }

      player.hp = Math.max(0, player.hp - damage);

      this.showFloatingText(
        this.playerCard.x,
        this.playerCard.y - 55,
        `-${damage}`,
        isDefending ? '#70a6ff' : '#ff6b6b'
      );

      this.animateHit(this.playerCard);
      this.shakeBattle();

      restoreEnergy(player, 1);

      const passiveText = this.checkHumanPassive();

      if (player.hp <= 0) {
        this.isBattleEnded = true;

        this.logText.setText(
          isDefending
            ? `${playerActionText}\n\nТы заблокировал часть удара.\n${this.enemy.name} наносит ${damage} урона.\n\nТы пал в катакомбах...`
            : `${playerActionText}\n\n${this.enemy.name} наносит ${damage} урона.\n\nТы пал в катакомбах...`
        );

        this.updateTexts();

        this.time.delayedCall(2000, () => {
          const freshStats = getPlayerStats(player);

          player.hp = freshStats.maxHp;
          player.energy = freshStats.maxEnergy;

          resetFloorRun();

          void saveGameAsync();

          this.scene.start('CampScene');
        });

        return;
      }

      this.logText.setText(
        isDefending
          ? `${playerActionText}\n\nТы заблокировал часть удара.\n${this.enemy.name} наносит ${damage} урона.\nЭнергия восстановлена на 1.${passiveText}`
          : `${playerActionText}\n\n${this.enemy.name} наносит ${damage} урона.\nЭнергия восстановлена на 1.${passiveText}`
      );

      this.updateTexts();
      this.tickDesperateStrikeCooldown();
      this.isBusy = false;
      this.createActionButtons();
    });
  }

  private tickDesperateStrikeCooldown() {
    if (this.desperateStrikeCooldown > 0) {
      this.desperateStrikeCooldown -= 1;
    }
  }

  private updateTexts() {
    const stats = this.getBattleStats();
    
    player.hp = Phaser.Math.Clamp(player.hp, 0, stats.maxHp);
    player.energy = Phaser.Math.Clamp(player.energy, 0, stats.maxEnergy);
    player.potions = Math.max(0, player.potions);
    
    this.playerHpText.setText(`HP: ${player.hp}/${stats.maxHp}`);
    this.enemyHpText.setText(`HP: ${this.enemy.hp}/${this.enemy.maxHp}`);
    
    this.energyText.setText(`Энергия: ${player.energy}/${stats.maxEnergy}`);
    
    if (this.potionText) {
      this.potionText.setText(`Зелья: ${player.potions}`);
    }
  
    const playerHpRatio = Phaser.Math.Clamp(player.hp / stats.maxHp, 0, 1);
    const enemyHpRatio = Phaser.Math.Clamp(this.enemy.hp / this.enemy.maxHp, 0, 1);
    const energyRatio = Phaser.Math.Clamp(player.energy / stats.maxEnergy, 0, 1);
  
    this.playerHpBar.displayWidth = 520 * playerHpRatio;
    this.enemyHpBar.displayWidth = 520 * enemyHpRatio;
    this.energyBar.displayWidth = 520 * energyRatio;
  }
}