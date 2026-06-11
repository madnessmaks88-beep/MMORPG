import Phaser from 'phaser';

import { player } from '../data/player';
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
  getEquippedWeapon,
  getPlayerStats,
  getRarityText,
  rollItemDrop,
} from '../systems/InventorySystem';
import { getCurrentRoom, markCurrentRoomCompleted } from '../systems/FloorSystem';



import {
  UI,
} from '../ui/theme';

import { getEnemyById } from '../data/enemies';




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

  private enemyBleedTurns = 0;
  private enemyBleedDamage = 0;

  private shieldSwordGuardActive = false;

  private statusText?: Phaser.GameObjects.Text;

  

  constructor() {
    super('BattleScene');
  }

  init(data?: { enemyId?: string; returnToDungeon?: boolean }) {
   this.returnToDungeon = data?.returnToDungeon ?? false;
   this.isBattleEnded = false;
   this.isBusy = false;

   this.humanPassiveActivated = false;
   this.desperateStrikeCooldown = 0;

   this.enemyBleedTurns = 0;
   this.enemyBleedDamage = 0;
   this.shieldSwordGuardActive = false;

   const room = getCurrentRoom();

   const enemyId =
     data?.enemyId ??
     room?.enemyId ??
     'rotting_skeleton';

   let enemyTemplate = getEnemyById(enemyId);

   if (!enemyTemplate) {
     console.warn('Enemy not found:', enemyId);
     enemyTemplate = getEnemyById('rotting_skeleton');
   }

   if (!enemyTemplate) {
     throw new Error('Fallback enemy rotting_skeleton not found');
   }

   this.enemy = this.createScaledEnemy(enemyTemplate);
  }

  create() {
    const { width } = this.scale;

    const floor = gameState.floorRun.currentFloor || 1;
    const room = getCurrentRoom();

    this.createBattleBackground();

    const isBoss = room?.type === 'boss' || room?.type === 'tier_boss';

    this.createBattleHeader(
      `Этаж ${floor}`,
      room ? room.title : `${player.name} против ${this.enemy.name}`,
      isBoss
    );

    this.enemyCard = this.createFighterCard(
      width / 2,
      isBoss ? 255 : 245,
      this.enemy.name,
      isBoss ? '♛' : '☠',
      isBoss ? 0x3a120c : 0x241515,
      true,
      isBoss
    );

    this.playerCard = this.createFighterCard(
      width / 2,
      525,
      player.name,
      '🗡',
      0x151b24,
      false,
      false
    );

    this.createBattleLogPanel();
    this.createActionButtons();

    this.updateTexts();
    this.updateStatusText();
  }

  private createBattleHeader(title: string, subtitle: string, isBoss: boolean) {
    const { width } = this.scale;

    this.add.text(width / 2, 38, title, {
      fontFamily: UI.font.title,
      fontSize: '26px',
      color: isBoss ? '#ffb36b' : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(width / 2, 73, subtitle, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: 580,
      },
    }).setOrigin(0.5).setDepth(10);
  }

  private createBattleLogPanel() {
    const { width } = this.scale;

    this.createRoundedPanel({
      x: width / 2,
      y: 770,
      width: 620,
      height: 240,
      radius: 28,
      color: 0x0d0a08,
      alpha: 0.9,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.5,
      depth: 8,
    });

    this.add.text(width / 2, 665, 'Ход боя', {
      fontFamily: UI.font.title,
      fontSize: '21px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(11);

    this.logText = this.add.text(width / 2, 770, 'Выбери действие.', {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 720,
      },
      lineSpacing: 1,
    }).setOrigin(0.5).setDepth(11);
  }

  private createActionButtons() {
    const { width } = this.scale;

    this.actionButtons.forEach(object => {
      object.destroy();
    });

    this.actionButtons = [];

    const panelObjects = this.createRoundedPanel({
      x: width / 2,
      y: 1060,
      width: 620,
      height: 310,
      radius: 32,
      color: 0x0b0908,
      alpha: 0.94,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.55,
      depth: 20,
    });

    this.actionButtons.push(panelObjects.shadow, panelObjects.panel);

    const attack = this.createBattleActionButton({
      x: width / 2,
      y: 960,
      width: 550,
      height: 62,
      icon: '⚔',
      title: this.getWeaponAttackButtonText(),
      subtitle: '0 энергии',
      accentColor: UI.colors.gold,
      disabled: this.isBusy || this.isBattleEnded,
      onClick: () => this.handleAttack(),
    });

    this.actionButtons.push(...attack);

    const power = this.createBattleActionButton({
      x: width / 2 - 140,
      y: 1055,
      width: 265,
      height: 72,
      icon: '◆',
      title: 'Сильный удар',
      subtitle: '2 энергии',
      accentColor: UI.colors.redHex,
      disabled: this.isBusy || this.isBattleEnded || player.energy < 2,
      onClick: () => this.handlePowerAttack(),
    });

    this.actionButtons.push(...power);

    const desperateText =
      this.desperateStrikeCooldown > 0
        ? `КД ${this.desperateStrikeCooldown}`
        : '3 энергии';

    const desperate = this.createBattleActionButton({
      x: width / 2 + 140,
      y: 1055,
      width: 265,
      height: 72,
      icon: '!',
      title: 'Отчаянный',
      subtitle: desperateText,
      accentColor: UI.colors.gold,
      disabled:
      this.isBusy ||
      this.isBattleEnded ||
      player.raceId !== 'human' ||
      player.energy < 3 ||
      this.desperateStrikeCooldown > 0,
      onClick: () => this.handleDesperateStrike(),
    });

    this.actionButtons.push(...desperate);

    const defend = this.createBattleActionButton({
      x: width / 2 - 140,
      y: 1150,
      width: 265,
      height: 72,
      icon: '🛡',
      title: 'Защита',
      subtitle: '+1 энергия',
      accentColor: UI.colors.blueHex,
      disabled: this.isBusy || this.isBattleEnded,
      onClick: () => this.handleDefend(),
    });

    this.actionButtons.push(...defend);

    const potion = this.createBattleActionButton({
      x: width / 2 + 140,
      y: 1150,
      width: 265,
      height: 72,
      icon: '✚',
      title: 'Зелье',
      subtitle: `${player.potions} шт.`,
      accentColor: UI.colors.greenHex,
      disabled: this.isBusy || this.isBattleEnded || player.potions <= 0,
      onClick: () => this.handlePotion(),
    });

    this.actionButtons.push(...potion);
    }

    private createBattleActionButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    icon: string;
    title: string;
    subtitle: string;
    accentColor: number;
    disabled?: boolean;
    onClick: () => void;
  }) {
    const disabled = config.disabled ?? false;

    const bgColor = disabled ? 0x101010 : 0x17100c;
    const alpha = disabled ? 0.55 : 0.96;
    const strokeAlpha = disabled ? 0.25 : 0.72;

    const objects: Phaser.GameObjects.GameObject[] = [];

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.32);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 5,
      config.width,
      config.height,
      22
    );
    shadow.setDepth(21);

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, alpha);
    bg.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      22
    );
    bg.lineStyle(2, config.accentColor, strokeAlpha);
    bg.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      22
    );
    bg.setDepth(22);

    const iconX = config.x - config.width / 2 + 42;

    const iconBg = this.add.circle(iconX, config.y, 22, config.accentColor, disabled ? 0.08 : 0.16)
      .setStrokeStyle(1, config.accentColor, disabled ? 0.25 : 0.58)
      .setDepth(23);

    const icon = this.add.text(iconX, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: disabled ? '#555555' : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(24);

    const title = this.add.text(config.x - config.width / 2 + 78, config.y - 11, config.title, {
      fontFamily: UI.font.title,
      fontSize: config.width > 300 ? '20px' : '16px',
      color: disabled ? '#555555' : UI.colors.text,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(24);

    const subtitle = this.add.text(config.x - config.width / 2 + 78, config.y + 16, config.subtitle, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: disabled ? '#444444' : UI.colors.textMuted,
    }).setOrigin(0, 0.5).setDepth(24);

    objects.push(shadow, bg, iconBg, icon, title, subtitle);

    if (!disabled) {
      bg.setInteractive(
        new Phaser.Geom.Rectangle(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height
        ),
        Phaser.Geom.Rectangle.Contains
      );

      bg.on('pointerover', () => {
        title.setColor(UI.colors.goldText);
        bg.clear();
        bg.fillStyle(0x20150f, 1);
        bg.fillRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          22
        );
        bg.lineStyle(2, config.accentColor, 0.95);
        bg.strokeRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          22
        );
      });

      bg.on('pointerout', () => {
        title.setColor(UI.colors.text);
        bg.clear();
        bg.fillStyle(bgColor, alpha);
        bg.fillRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          22
        );
        bg.lineStyle(2, config.accentColor, strokeAlpha);
        bg.strokeRoundedRect(
          config.x - config.width / 2,
          config.y - config.height / 2,
          config.width,
          config.height,
          22
        );
      });

      bg.on('pointerdown', () => {
        bg.setScale(0.99);
        title.setScale(0.99);
        subtitle.setScale(0.99);
      });

      bg.on('pointerup', () => {
        bg.setScale(1);
        title.setScale(1);
        subtitle.setScale(1);
        config.onClick();
      });
    }

    return objects;
  }

  private getWeaponAttackButtonText() {
    const equippedWeapon = getEquippedWeapon(player);
    const weaponType = equippedWeapon?.item.weaponType ?? 'sword';

    if (weaponType === 'dagger') return 'Быстрая атака';
    if (weaponType === 'axe') return 'Рубящий удар';
    if (weaponType === 'katana') return 'Режущий удар';
    if (weaponType === 'hammer') return 'Удар молотом';
    if (weaponType === 'shield_sword') return 'Осторожная атака';

    return 'Атака';
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

  private afterPlayerAttack(
    playerActionText: string,
    options?: {
      skipEnemyTurn?: boolean;
    }
  ) {
    this.updateTexts();
    this.createActionButtons();

    if (this.enemy.hp <= 0) {
      this.handleVictory(playerActionText);
      return;
    }

    if (options?.skipEnemyTurn) {
      restoreEnergy(player, 1);

      this.logText.setText(
        `${playerActionText}\n\nВраг оглушён и пропускает ход.\nЭнергия восстановлена на 1.`
      );

      this.updateTexts();

      this.time.delayedCall(650, () => {
        this.tickDesperateStrikeCooldown();
        this.isBusy = false;
        this.createActionButtons();
      });

      return;
    }

    this.enemyTurn(playerActionText);
  }

  private applyBleedBeforeEnemyTurn(playerActionText: string): string | undefined {
    if (this.enemyBleedTurns <= 0 || this.enemyBleedDamage <= 0) {
      return playerActionText;
    }

    const bleedDamage = this.enemyBleedDamage;

    this.enemyBleedTurns -= 1;

    this.damageEnemy(bleedDamage);
    this.updateTexts();

    const bleedText =
      `${playerActionText}\n\n` +
      `Кровотечение наносит ${bleedDamage} урона.` +
      `${this.enemyBleedTurns > 0 ? `\nКровотечение осталось: ${this.enemyBleedTurns} ход.` : ''}`;

    if (this.enemy.hp <= 0) {
      this.handleVictory(bleedText);
      return undefined;
    }

    return bleedText;
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
    color: number,
    isEnemy: boolean,
    isBoss = false
  ) {
    const cardWidth = isBoss ? 660 : 610;
    const cardHeight = isBoss ? 235 : 185;

    const container = this.add.container(x, y);

    const strokeColor = isEnemy
      ? isBoss
        ? 0xff6b35
        : 0x8a2f2f
      : UI.colors.goldDark;

    const titleColor = isEnemy ? UI.colors.red : UI.colors.goldText;

    const shadow = this.add.rectangle(0, 8, cardWidth, cardHeight, 0x000000, 0.34);

    const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, color, isBoss ? 0.98 : 0.94)
      .setStrokeStyle(isBoss ? 4 : 2, strokeColor, isBoss ? 0.95 : 0.6);

    const sideAccent = this.add.rectangle(
      -cardWidth / 2 + 5,
      0,
      8,
      cardHeight - 22,
      strokeColor,
      isBoss ? 0.85 : 0.55
    );

    const iconBg = this.add.circle(-245, -38, 40, isEnemy ? 0x2a1010 : 0x2a1d13, 1)
      .setStrokeStyle(2, strokeColor, 0.75);

    const iconText = this.add.text(-245, -38, icon, {
      fontFamily: UI.font.body,
      fontSize: '31px',
      color: isEnemy ? UI.colors.red : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const nameText = this.add.text(-190, -62, name, {
      fontFamily: UI.font.title,
      fontSize: isBoss ? '27px' : '24px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0, 0.5);

    const hpText = this.add.text(-190, -24, '', {
      fontFamily: UI.font.body,
      fontSize: '17px',
      color: UI.colors.text,
    }).setOrigin(0, 0.5);

    const extraText = this.add.text(-190, 10, '', {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.textMuted,
    }).setOrigin(0, 0.5);

    const hpBarY = isBoss ? 82 : 68;
    const energyBarY = isBoss ? 103 : 88;

    const barBack = this.add.rectangle(0, hpBarY, 520, 12, 0x050505, 0.92);

    const hpBar = this.add.rectangle(
      -260,
      hpBarY,
      520,
      12,
      isEnemy ? 0xff6b6b : 0x75d184,
      0.98
    ).setOrigin(0, 0.5);

    const hpBarFrame = this.add.rectangle(0, hpBarY, 520, 12)
      .setStrokeStyle(1, 0x000000, 0.85);

    const energyBack = this.add.rectangle(
      0,
      energyBarY,
      520,
      8,
      0x050505,
      isEnemy ? 0 : 0.92
    );

    const energyBar = this.add.rectangle(
      -260,
      energyBarY,
      520,
      8,
      0x70a6ff,
      isEnemy ? 0 : 0.95
    ).setOrigin(0, 0.5);

    container.add([
      shadow,
      bg,
      sideAccent,
      iconBg,
      iconText,
      nameText,
      hpText,
      extraText,
      barBack,
      hpBar,
      hpBarFrame,
      energyBack,
      energyBar,
    ]);

    if (isBoss) {
      const bossLabel = this.add.text(0, -94, 'БОСС', {
        fontFamily: UI.font.title,
        fontSize: '22px',
        color: '#ffb36b',
        stroke: '#000000',
        strokeThickness: 5,
      }).setOrigin(0.5);

      container.add(bossLabel);

      this.tweens.add({
        targets: bossLabel,
        alpha: 0.55,
        duration: 750,
        yoyo: true,
        repeat: -1,
      });
    }

    if (isEnemy) {
      this.enemyHpText = hpText;
      this.enemyHpBar = hpBar;

      extraText.setText(`АТК ${this.enemy.attack}  •  ЗАЩ ${this.enemy.defense}`);
    } else {
      this.playerHpText = hpText;
      this.playerHpBar = hpBar;
      this.energyBar = energyBar;
      this.energyText = extraText;

      const stats = this.getBattleStats();

      this.potionText = this.add.text(245, 12, `Зелья: ${player.potions}`, {
        fontFamily: UI.font.body,
        fontSize: '15px',
        color: UI.colors.textMuted,
        align: 'right',
      }).setOrigin(1, 0.5);

      const statsText = this.add.text(245, -35, [
        `АТК ${stats.attack}`,
        `ЗАЩ ${stats.defense}`,
        `КРИТ ${Math.round(stats.critChance * 100)}%`,
      ].join('\n'), {
        fontFamily: UI.font.body,
        fontSize: '15px',
        color: UI.colors.textMuted,
        align: 'right',
        lineSpacing: 4,
      }).setOrigin(1, 0.5);

      container.add([this.potionText, statsText]);
    }

    return container;
  }

  private updateStatusText() {
    if (!this.statusText) {
      return;
    }

    const statuses: string[] = [];

    if (this.enemyBleedTurns > 0) {
      statuses.push(`Кровотечение: ${this.enemyBleedTurns} х.`);
    }

    if (this.shieldSwordGuardActive) {
      statuses.push('Защита щит-меча');
    }

    if (this.desperateStrikeCooldown > 0) {
      statuses.push(`Отчаянный удар: КД ${this.desperateStrikeCooldown}`);
    }

    this.statusText.setText(
      statuses.length > 0
        ? statuses.join('  •  ')
        : 'Нет активных эффектов'
    );
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
    const baseX =
      typeof this.playerCard.getData('baseX') === 'number'
        ? this.playerCard.getData('baseX')
        : this.playerCard.x;

    const baseY =
      typeof this.playerCard.getData('baseY') === 'number'
        ? this.playerCard.getData('baseY')
        : this.playerCard.y;

    this.playerCard.setData('baseX', baseX);
    this.playerCard.setData('baseY', baseY);

    this.tweens.killTweensOf(this.playerCard);

    this.playerCard.setPosition(baseX, baseY);

    this.tweens.add({
      targets: this.playerCard,
      y: baseY - 28,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
      onComplete: () => {
        this.playerCard.setPosition(baseX, baseY);
      },
    });
  }

  private animateEnemyAttack() {
    const baseX =
      typeof this.enemyCard.getData('baseX') === 'number'
        ? this.enemyCard.getData('baseX')
        : this.enemyCard.x;

    const baseY =
      typeof this.enemyCard.getData('baseY') === 'number'
        ? this.enemyCard.getData('baseY')
        : this.enemyCard.y;

    this.enemyCard.setData('baseX', baseX);
    this.enemyCard.setData('baseY', baseY);

    this.tweens.killTweensOf(this.enemyCard);

    this.enemyCard.setPosition(baseX, baseY);

    this.tweens.add({
      targets: this.enemyCard,
      y: baseY + 28,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
      onComplete: () => {
        this.enemyCard.setPosition(baseX, baseY);
      },
    });
  }

  private animateHit(target: Phaser.GameObjects.Container) {
    const baseX =
      typeof target.getData('baseX') === 'number'
        ? target.getData('baseX')
        : target.x;

    const baseY =
      typeof target.getData('baseY') === 'number'
        ? target.getData('baseY')
        : target.y;

    target.setData('baseX', baseX);
    target.setData('baseY', baseY);

    this.tweens.killTweensOf(target);

    target.setPosition(baseX, baseY);

    this.tweens.add({
      targets: target,
      x: baseX + 12,
      duration: 55,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        target.setPosition(baseX, baseY);
      },
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
    this.createActionButtons();

    const equippedWeapon = getEquippedWeapon(player);
    const weapon = equippedWeapon?.item;
    const weaponType = weapon?.weaponType ?? 'sword';

    if (weaponType === 'dagger') {
      this.handleDaggerAttack();
      return;
    }

    if (weaponType === 'axe') {
      this.handleAxeAttack();
      return;
    }

    if (weaponType === 'katana') {
      this.handleKatanaAttack();
      return;
    }

    if (weaponType === 'hammer') {
      this.handleHammerAttack();
      return;
    }

    if (weaponType === 'shield_sword') {
      this.handleShieldSwordAttack();
      return;
    }

    this.handleSwordAttack();
  }

  private handleSwordAttack() {
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
    ? `Критическая атака мечом! Ты наносишь ${finalDamage} урона.`
    : `Ты наносишь удар мечом: ${finalDamage} урона.`;

  this.afterPlayerAttack(playerActionText);
}

  private handleDaggerAttack() {
  const stats = this.getBattleStats();

  const hits: {
    damage: number;
    isCrit: boolean;
  }[] = [];

  for (let i = 0; i < 3; i += 1) {
    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: 0.45,
      varianceMin: -1,
      varianceMax: 2,
    });

    const isCrit = Math.random() < stats.critChance;
    const finalDamage = isCrit ? Math.floor(damage * 1.45) : damage;

    hits.push({
      damage: finalDamage,
      isCrit,
    });
  }

  let totalDamage = 0;
  let critCount = 0;
  let finished = false;

  const finishDaggerAttack = () => {
    if (finished) {
      return;
    }

    finished = true;

    const critText =
      critCount > 0
        ? `\nКритических ударов: ${critCount}.`
        : '';

    const playerActionText =
      `Кинжалы проводят серию из 3 быстрых ударов.\n` +
      `Общий урон: ${totalDamage}.${critText}`;

    this.afterPlayerAttack(playerActionText);
  };

  hits.forEach((hit, index) => {
    this.time.delayedCall(index * 170, () => {
      if (finished) {
        return;
      }

      this.animatePlayerAttack();
      this.damageEnemy(hit.damage);

      totalDamage += hit.damage;

      if (hit.isCrit) {
        critCount += 1;
      }

      this.updateTexts();

      if (this.enemy.hp <= 0) {
        finishDaggerAttack();
        return;
      }

      if (index === hits.length - 1) {
        finishDaggerAttack();
      }
    });
  });
}

  private handleAxeAttack() {
    const stats = this.getBattleStats();

    const isArmoredEnemy = this.enemy.defense >= 4;

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: isArmoredEnemy ? 1.42 : 1.18,
      varianceMin: -2,
      varianceMax: 6,
    });

    const isCrit = Math.random() < stats.critChance;
    const finalDamage = isCrit ? Math.floor(damage * 1.55) : damage;

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    let playerActionText = isCrit
      ? `Критический рубящий удар топором! Ты наносишь ${finalDamage} урона.`
      : `Топор наносит тяжёлый рубящий удар: ${finalDamage} урона.`;

    if (isArmoredEnemy) {
      playerActionText += '\nБонус топора: враг в броне, удар пробивает защиту.';
    }

    this.afterPlayerAttack(playerActionText);
  }

  private handleKatanaAttack() {
    const stats = this.getBattleStats();

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: 0.95,
      varianceMin: 0,
      varianceMax: 5,
    });

    const isCrit = Math.random() < stats.critChance + 0.03;
    const finalDamage = isCrit ? Math.floor(damage * 1.55) : damage;

    const bleedDamage = Math.max(1, Math.floor(stats.attack * 0.22));

    this.enemyBleedTurns = 2;
    this.enemyBleedDamage = Math.max(this.enemyBleedDamage, bleedDamage);

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Катана наносит точный критический разрез: ${finalDamage} урона.\nВраг начинает кровоточить.`
      : `Катана рассекает врага: ${finalDamage} урона.\nВраг начинает кровоточить.`;

    this.afterPlayerAttack(playerActionText);
  }

  private handleHammerAttack() {
    const stats = this.getBattleStats();
    const room = getCurrentRoom();

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: 1.1,
      varianceMin: -3,
      varianceMax: 7,
    });

    const isCrit = Math.random() < stats.critChance;
    const finalDamage = isCrit ? Math.floor(damage * 1.55) : damage;

    const isBoss = room?.type === 'boss' || room?.type === 'tier_boss';
    const stunChance = isBoss ? 0.15 : 0.35;
    const isStunned = Math.random() < stunChance;

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);
    this.shakeBattle(0.008, 220);

    let playerActionText = isCrit
      ? `Критический удар молотом сотрясает арену: ${finalDamage} урона.`
      : `Молот обрушивается на врага: ${finalDamage} урона.`;

    if (isStunned) {
      playerActionText += '\nВраг оглушён.';
    }

    this.afterPlayerAttack(playerActionText, {
      skipEnemyTurn: isStunned,
    });
  }

  private handleShieldSwordAttack() {
    const stats = this.getBattleStats();

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: 0.82,
      varianceMin: -1,
      varianceMax: 3,
    });

    const isCrit = Math.random() < stats.critChance;
    const finalDamage = isCrit ? Math.floor(damage * 1.45) : damage;

    this.shieldSwordGuardActive = true;

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Щит-меч проводит безопасную критическую атаку: ${finalDamage} урона.\nСледующий удар врага будет ослаблен.`
      : `Ты атакуешь из-за щита: ${finalDamage} урона.\nСледующий удар врага будет ослаблен.`;

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
      const bleedResultText = this.applyBleedBeforeEnemyTurn(playerActionText);

      if (!bleedResultText) {
        return;
      }
    
      playerActionText = bleedResultText;
    
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

      let shieldSwordText = '';

      if (this.shieldSwordGuardActive) {
        damage = Math.max(1, Math.floor(damage * 0.6));
        this.shieldSwordGuardActive = false;
        shieldSwordText = '\nЩит-меч смягчил входящий удар.';
      }

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
            ? `${playerActionText}\n\nТы заблокировал часть удара.\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}\n\nТы пал в катакомбах...`
            : `${playerActionText}\n\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}\n\nТы пал в катакомбах...`
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
          ? `${playerActionText}\n\nТы заблокировал часть удара.\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}\nЭнергия восстановлена на 1.${passiveText}`
          : `${playerActionText}\n\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}\nЭнергия восстановлена на 1.${passiveText}`
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

   if (this.playerHpText) {
     this.playerHpText.setText(`HP: ${player.hp}/${stats.maxHp}`);
   }

   if (this.enemyHpText) {
     this.enemyHpText.setText(`HP: ${this.enemy.hp}/${this.enemy.maxHp}`);
   }

   if (this.energyText) {
     this.energyText.setText(`Энергия: ${player.energy}/${stats.maxEnergy}`);
   }

   if (this.potionText) {
     this.potionText.setText(`Зелья: ${player.potions}`);
   }

   if (this.playerHpBar) {
     const playerHpRatio = Phaser.Math.Clamp(player.hp / stats.maxHp, 0, 1);
     this.playerHpBar.displayWidth = 520 * playerHpRatio;
   }

   if (this.enemyHpBar) {
     const enemyHpRatio = Phaser.Math.Clamp(this.enemy.hp / this.enemy.maxHp, 0, 1);
     this.enemyHpBar.displayWidth = 520 * enemyHpRatio;
   }

   if (this.energyBar) {
     const energyRatio = Phaser.Math.Clamp(player.energy / stats.maxEnergy, 0, 1);
     this.energyBar.displayWidth = 520 * energyRatio;
   }
  }
}