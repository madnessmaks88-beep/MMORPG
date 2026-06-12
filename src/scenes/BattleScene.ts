import Phaser from 'phaser';


import { player } from '../data/player';
import type { EnemyData, EnemyDebuffId } from '../data/enemies';
import { getEnemyById } from '../data/enemies';
import { saveGameAsync } from '../systems/SaveSystem';
import { trackEnemyKilled, trackGoldEarned } from '../systems/QuestSystem';
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
  getEquippedWeapon,
  getPlayerStats,
} from '../systems/InventorySystem';
import { getCurrentRoom, markCurrentRoomCompleted } from '../systems/FloorSystem';
import { rollEnemyLoot } from '../systems/LootSystem';
import { getCryptDepthTheme } from '../systems/CryptThemeSystem';
import { createScaledEnemy } from '../systems/EnemyScalingSystem';
import { getRaceById } from '../data/races';



import {
  UI,
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

type ActivePlayerDebuff = {
  id: EnemyDebuffId;
  name: string;
  duration: number;
  power: number;
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

  private readonly powerAttackEnergyCost = 2;

  private enemyBleedTurns = 0;
  private enemyBleedDamage = 0;

  private shieldSwordGuardActive = false;

  private statusText?: Phaser.GameObjects.Text;

  private raceSkillCooldown = 0;

  private taintedHpCost = 0;
  
  private stoneGuardActive = false;
  
  private nightElfShadowStepActive = false;
  private nightElfShadowDanceActive = false;
  
  private goblinDirtyTrickActive = false;
  
  private demonRageStacks = 0;
  private demonHpSpentByHellfire = 0;

  private playerDebuffs: ActivePlayerDebuff[] = [];
  private nextIncomingDamageBonus = 0;

  private playerDebuffText?: Phaser.GameObjects.Text;

  private enemyEffectObjects: Phaser.GameObjects.GameObject[] = [];
  private playerEffectObjects: Phaser.GameObjects.GameObject[] = [];

  private tooltipObjects: Phaser.GameObjects.GameObject[] = [];

  private enemyHoverZone?: Phaser.GameObjects.Rectangle;

  private playerHoverZone?: Phaser.GameObjects.Rectangle;

  

  constructor() {
    super('BattleScene');
  }

  init(data?: { enemyId?: string; returnToDungeon?: boolean }) {
  this.returnToDungeon = data?.returnToDungeon ?? false;
  this.isBattleEnded = false;
  this.isBusy = false;

  this.humanPassiveActivated = false;
  this.raceSkillCooldown = 0;

  this.taintedHpCost = 0;

  this.stoneGuardActive = false;

  this.nightElfShadowStepActive = false;
  this.nightElfShadowDanceActive = false;

  this.goblinDirtyTrickActive = false;

  this.demonRageStacks = 0;
  this.demonHpSpentByHellfire = 0;

  this.enemyBleedTurns = 0;
  this.enemyBleedDamage = 0;
  this.shieldSwordGuardActive = false;

  this.playerDebuffs = [];
  this.nextIncomingDamageBonus = 0;

  const room = getCurrentRoom();

  const enemyId =
    data?.enemyId ??
    room?.enemyId ??
    'bone_gnawer';

  console.log('ROOM:', room);
  console.log('ENEMY ID:', enemyId);

  let enemyTemplate = getEnemyById(enemyId);

  console.log('ENEMY:', enemyTemplate);

  if (!enemyTemplate) {
    console.warn('Enemy not found:', enemyId);
    enemyTemplate = getEnemyById('bone_gnawer');
  }

  if (!enemyTemplate) {
    throw new Error('Fallback enemy bone_gnawer not found');
  }

  const floor = gameState.floorRun.currentFloor || 1;

  this.enemy = createScaledEnemy(enemyTemplate, floor, room?.type);
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

  private getCurrentWeaponType() {
  const equippedWeapon = getEquippedWeapon(player);

  return equippedWeapon?.item.weaponType ?? 'sword';
}

private getEnemyWeaknessDamageMultiplier() {
  const weaponType = this.getCurrentWeaponType();

  let multiplier = 1;

  if (this.enemy.weaknesses?.includes(weaponType)) {
    multiplier += 0.2;
  }

  if (this.enemy.resistances?.includes(weaponType)) {
    multiplier -= 0.15;
  }

  return Phaser.Math.Clamp(multiplier, 0.65, 1.35);
}

  private getEnemyWeaknessText() {
    const weaponType = this.getCurrentWeaponType();

    if (this.enemy.weaknesses?.includes(weaponType)) {
      return '\nСлабость врага: урон увеличен.';
    }

    if (this.enemy.resistances?.includes(weaponType)) {
      return '\nСопротивление врага: урон снижен.';
    }

    return '';
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

  private getDebuffIcon(id: EnemyDebuffId) {
  if (id === 'bleeding') return '🩸';
  if (id === 'poison') return '☠';
  if (id === 'curse') return '☾';
  if (id === 'armor_break') return '⬇';
  if (id === 'rot') return '✚';
  if (id === 'death_mark') return '◆';
  if (id === 'energy_block') return '✦';
  if (id === 'weakness') return '⚔';
  if (id === 'agility_down') return '➤';
  if (id === 'crit_down') return '◇';
  if (id === 'heal_block') return '✚';
  if (id === 'skill_cost_up') return '▲';

  return '•';
}

private getDebuffShortDescription(id: EnemyDebuffId, power: number) {
  if (id === 'bleeding') return `Получает ${power} урона перед действием.`;
  if (id === 'poison') return `Получает ${power} урона перед действием.`;
  if (id === 'curse') return `Атака и защита снижены на ${power}.`;
  if (id === 'armor_break') return `Защита снижена на ${power}.`;
  if (id === 'rot') return `Зелья лечат на ${power}% меньше.`;
  if (id === 'death_mark') return `Следующий удар врага сильнее на ${power}%.`;
  if (id === 'energy_block') return 'После удара врага энергия не восстановится.';
  if (id === 'weakness') return `Исходящий урон снижен на ${power}%.`;
  if (id === 'agility_down') return `Ловкость снижена на ${power}.`;
  if (id === 'crit_down') return `Шанс крита снижен на ${power}%.`;
  if (id === 'heal_block') return 'Нельзя использовать зелье.';
  if (id === 'skill_cost_up') return `Навыки стоят на ${power} энергии больше.`;

  return 'Неизвестный эффект.';
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

    const raceSkill = this.createBattleActionButton({
      x: width / 2 + 140,
      y: 1055,
      width: 265,
      height: 72,
      icon: this.getRaceSkillIcon(),
      title: this.getRaceSkillTitle(),
      subtitle: this.getRaceSkillSubtitle(),
      accentColor: UI.colors.gold,
      disabled: this.isRaceSkillDisabled(),
      onClick: () => this.handleRaceSkill(),
    });

    this.actionButtons.push(...raceSkill);

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
  const hoverColor = 0x20150f;
  const alpha = disabled ? 0.55 : 0.96;
  const strokeAlpha = disabled ? 0.25 : 0.72;

  const textColor = disabled ? '#555555' : UI.colors.text;
  const titleHoverColor = UI.colors.goldText;

  const objects: Phaser.GameObjects.GameObject[] = [];

  const radius = 22;

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.32);
  shadow.fillRoundedRect(
    config.x - config.width / 2,
    config.y - config.height / 2 + 5,
    config.width,
    config.height,
    radius
  );
  shadow.setDepth(21);

  const bg = this.add.graphics();
  bg.fillStyle(bgColor, alpha);
  bg.fillRoundedRect(
    config.x - config.width / 2,
    config.y - config.height / 2,
    config.width,
    config.height,
    radius
  );
  bg.lineStyle(2, config.accentColor, strokeAlpha);
  bg.strokeRoundedRect(
    config.x - config.width / 2,
    config.y - config.height / 2,
    config.width,
    config.height,
    radius
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
    color: textColor,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0, 0.5).setDepth(24);

  const subtitle = this.add.text(config.x - config.width / 2 + 78, config.y + 16, config.subtitle, {
    fontFamily: UI.font.body,
    fontSize: '13px',
    color: disabled ? '#444444' : UI.colors.textMuted,
  }).setOrigin(0, 0.5).setDepth(24);

  objects.push(shadow, bg, iconBg, icon, title, subtitle);

  const redrawButton = (
    fillColor: number,
    fillAlpha: number,
    borderAlpha: number,
    titleColor: string,
    offsetY = 0
  ) => {
    bg.clear();

    bg.fillStyle(fillColor, fillAlpha);
    bg.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    bg.lineStyle(2, config.accentColor, borderAlpha);
    bg.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    iconBg.setY(config.y + offsetY);
    icon.setY(config.y + offsetY);
    title.setY(config.y - 11 + offsetY);
    subtitle.setY(config.y + 16 + offsetY);

    title.setColor(titleColor);
  };

  if (!disabled) {
    let isPressed = false;
    let isLocked = false;

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
      if (isPressed || isLocked) {
        return;
      }

      redrawButton(hoverColor, 1, 0.95, titleHoverColor);
    });

    bg.on('pointerout', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      redrawButton(bgColor, alpha, strokeAlpha, textColor);
    });

    bg.on('pointerdown', () => {
      if (isLocked) {
        return;
      }

      isPressed = true;

      redrawButton(hoverColor, 0.92, 0.95, titleHoverColor, 1);
    });

    bg.on('pointerup', () => {
      if (!isPressed || isLocked) {
        return;
      }

      isPressed = false;
      isLocked = true;

      redrawButton(hoverColor, 1, 0.95, titleHoverColor);

      this.time.delayedCall(40, () => {
        config.onClick();
      });
    });

    bg.on('pointerupoutside', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      redrawButton(bgColor, alpha, strokeAlpha, textColor);
    });

    bg.on('pointercancel', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      redrawButton(bgColor, alpha, strokeAlpha, textColor);
    });
  }

  return objects;
}

private getRaceSkillIcon() {
  if (player.raceId === 'human') return '!';
  if (player.raceId === 'tainted_halfblood') return '☾';
  if (player.raceId === 'stoneborn') return '▣';
  if (player.raceId === 'night_elf') return '◐';
  if (player.raceId === 'goblin') return '!';
  if (player.raceId === 'demon') return '◆';

  return '!';
}

private getRaceSkillTitle() {
  if (player.raceId === 'human') return 'Отчаянный';
  if (player.raceId === 'tainted_halfblood') return 'Рывок';
  if (player.raceId === 'stoneborn') return 'Стойка';
  if (player.raceId === 'night_elf') return 'Тень';
  if (player.raceId === 'goblin') return 'Подлый';
  if (player.raceId === 'demon') return 'Пламя';

  return 'Навык';
}

private getRaceSkillEnergyCost() {
  if (player.raceId === 'human') return 3;
  if (player.raceId === 'tainted_halfblood') return 2;
  if (player.raceId === 'stoneborn') return 2;
  if (player.raceId === 'night_elf') return 3;
  if (player.raceId === 'goblin') return 2;
  if (player.raceId === 'demon') return 2;

  return 2;
}

private getRaceSkillCooldownTurns() {
  if (player.raceId === 'human') return 2;
  if (player.raceId === 'tainted_halfblood') return 3;
  if (player.raceId === 'stoneborn') return 3;
  if (player.raceId === 'night_elf') return 4;
  if (player.raceId === 'goblin') return 3;
  if (player.raceId === 'demon') return 3;

  return 3;
}

private getRaceSkillSubtitle() {
  if (this.raceSkillCooldown > 0) {
    return `КД ${this.raceSkillCooldown}`;
  }

  return `${this.getRaceSkillEnergyCost() + this.getSkillCostPenalty()} эн. / КД ${this.getRaceSkillCooldownTurns()}`;
}

private isRaceSkillDisabled() {
  return (
    this.isBusy ||
    this.isBattleEnded ||
    player.energy < this.getRaceSkillEnergyCost() + this.getSkillCostPenalty() ||
    this.raceSkillCooldown > 0
  );
}

private handleRaceSkill() {
  if (this.isBattleEnded || this.isBusy) {
    return;
  }

  if (this.applyDebuffDamageAndCheckDeath()) {
    return;
  }

  if (this.isRaceSkillDisabled()) {
    return;
  }

  if (player.raceId === 'human') {
    this.handleHumanSkill();
    return;
  }

  if (player.raceId === 'tainted_halfblood') {
    this.handleTaintedSkill();
    return;
  }

  if (player.raceId === 'stoneborn') {
    this.handleStonebornSkill();
    return;
  }

  if (player.raceId === 'night_elf') {
    this.handleNightElfSkill();
    return;
  }

  if (player.raceId === 'goblin') {
    this.handleGoblinSkill();
    return;
  }

  if (player.raceId === 'demon') {
    this.handleDemonSkill();
  }
}

private handleHumanSkill() {
  this.isBusy = true;

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.raceSkillCooldown = this.getRaceSkillCooldownTurns();

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

  const weaknessText = this.getEnemyWeaknessText();

  this.animatePlayerAttack();
  this.damageEnemy(finalDamage);

  const hpLostPercent = Math.round(hpLostRatio * 100);

  const playerActionText =
    `Отчаянный удар!\n` +
    `Потеряно HP: ${hpLostPercent}%.\n` +
    `Ты наносишь ${finalDamage} урона.${weaknessText}`;

  this.afterPlayerAttack(playerActionText);
}

private handleTaintedSkill() {
  this.isBusy = true;

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.raceSkillCooldown = this.getRaceSkillCooldownTurns();

  const stats = this.getBattleStats();

  const hpCost = Math.max(1, Math.floor(stats.maxHp * 0.05));
  player.hp = Math.max(1, player.hp - hpCost);
  this.taintedHpCost += hpCost;

  const lowHp = player.hp / stats.maxHp <= 0.35;

  const damage = this.calculateDamage({
    baseDamage: stats.attack,
    multiplier: lowHp ? 1.7 : 1.4,
    varianceMin: 0,
    varianceMax: 5,
  });

  const weaknessText = this.getEnemyWeaknessText();

  this.animatePlayerAttack();
  this.damageEnemy(damage);

  const playerActionText =
    lowHp
      ? `Проклятый рывок!\nСкверна усиливает удар.\nТы теряешь ${hpCost} HP и наносишь ${damage} урона.${weaknessText}`
      : `Проклятый рывок!\nТы теряешь ${hpCost} HP и наносишь ${damage} урона.${weaknessText}`;

  this.afterPlayerAttack(playerActionText);
}

private handleStonebornSkill() {
  this.isBusy = true;

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.raceSkillCooldown = this.getRaceSkillCooldownTurns();
  this.stoneGuardActive = true;

  const playerActionText =
    `Глухая стойка.\n` +
    `Следующий удар врага нанесёт на 60% меньше урона.`;

  this.logText.setText(playerActionText);
  this.updateTexts();
  this.createActionButtons();

  this.time.delayedCall(450, () => {
    this.enemyTurn(playerActionText, false);
  });
}

private handleNightElfSkill() {
  this.isBusy = true;

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.raceSkillCooldown = this.getRaceSkillCooldownTurns();
  this.nightElfShadowStepActive = true;

  const playerActionText =
    `Шаг в тень.\n` +
    `Следующая атака врага будет гарантированно уклонена.`;

  this.logText.setText(playerActionText);
  this.updateTexts();
  this.createActionButtons();

  this.time.delayedCall(450, () => {
    this.enemyTurn(playerActionText, false);
  });
}

private handleGoblinSkill() {
  this.isBusy = true;

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.raceSkillCooldown = this.getRaceSkillCooldownTurns();

  const stats = this.getBattleStats();

  const damage = this.calculateDamage({
    baseDamage: stats.attack,
    multiplier: 0.9,
    varianceMin: 0,
    varianceMax: 4,
  });

  const dirtyTrick = Math.random() < 0.5;

  if (dirtyTrick) {
    this.goblinDirtyTrickActive = true;
  }

  const weaknessText = this.getEnemyWeaknessText();

  this.animatePlayerAttack();
  this.damageEnemy(damage);

  const playerActionText =
    dirtyTrick
      ? `Подлый удар!\nТы наносишь ${damage} урона.${weaknessText}\nГрязный приём ослабит следующий удар врага на 25%.`
      : `Подлый удар!\nТы наносишь ${damage} урона.${weaknessText}`;

  this.afterPlayerAttack(playerActionText);
}

private handleDemonSkill() {
  this.isBusy = true;

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.raceSkillCooldown = this.getRaceSkillCooldownTurns();

  const stats = this.getBattleStats();

  const hpCost = Math.max(1, Math.floor(stats.maxHp * 0.08));
  player.hp = Math.max(1, player.hp - hpCost);
  this.demonHpSpentByHellfire += hpCost;

  const lowHp = player.hp / stats.maxHp <= 0.4;

  const damage = this.calculateDamage({
    baseDamage: stats.attack,
    multiplier: lowHp ? 2.1 : 1.7,
    varianceMin: 0,
    varianceMax: 5,
  });

  const weaknessText = this.getEnemyWeaknessText();

  this.animatePlayerAttack();
  this.damageEnemy(damage);

  const playerActionText =
    lowHp
      ? `Кровавое пламя!\nДемон теряет ${hpCost} HP и наносит ${damage} урона.${weaknessText}\nНизкое HP усилило пламя.`
      : `Кровавое пламя!\nДемон теряет ${hpCost} HP и наносит ${damage} урона.${weaknessText}`;

  this.afterPlayerAttack(playerActionText);
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

    if (this.applyDebuffDamageAndCheckDeath()) {
      return;
    }

    const cost = this.powerAttackEnergyCost + this.getSkillCostPenalty();

    if (player.energy < cost) {
      this.logText.setText('Недостаточно энергии для сильного удара.');
      return;
    }

    this.isBusy = true;

    player.energy -= cost;

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

    if (this.applyDebuffDamageAndCheckDeath()) {
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

  private getBattleStats(): BattleStats {
    const stats = getPlayerStats(player);
    const bonus = this.getRaceBattleBonus(stats.maxHp);

    const armorBreak = this.getPlayerDebuff('armor_break');
    const curse = this.getPlayerDebuff('curse');
    const agilityDown = this.getPlayerDebuff('agility_down');
    const critDown = this.getPlayerDebuff('crit_down');

    const debuffDefensePenalty = armorBreak?.power ?? 0;
    const cursePower = curse?.power ?? 0;
    const agilityPenalty = agilityDown?.power ?? 0;
    const critPenalty = (critDown?.power ?? 0) / 100;

    const battleAgility = Math.max(0, stats.agility + bonus.agility - agilityPenalty);
    const battleStrength = player.strength + bonus.attack;
    const battleIntelligence = player.intelligence + bonus.intelligence;

    const baseDodgeChance = Math.min(0.22, battleAgility * 0.01);

    const dodgeChance =
      player.raceId === 'stoneborn'
        ? baseDodgeChance * 0.7
        : baseDodgeChance;

    return {
      ...stats,

      attack: Math.max(1, stats.attack + bonus.attack - cursePower),
      defense: Math.max(0, stats.defense + bonus.defense - debuffDefensePenalty - cursePower),
      critChance: Math.max(0, Math.min(0.5, stats.critChance + bonus.critChance - critPenalty)),

      maxEnergy: stats.maxEnergy,

      strength: battleStrength,
      agility: battleAgility,
      intelligence: battleIntelligence,

      dodgeChance,
      trapDodgeChance: stats.trapDodgeChance,
      lootChanceBonus:
        player.raceId === 'goblin'
          ? stats.lootChanceBonus + 0.05
          : stats.lootChanceBonus,
    };
  }

  private getRaceBattleBonus(maxHp: number) {
    const bonus = {
      attack: 0,
      defense: 0,
      agility: 0,
      intelligence: 0,
      critChance: 0,
    };

    if (player.raceId === 'human' && this.humanPassiveActivated) {
      bonus.attack += 2;
      bonus.defense += 2;
      bonus.agility += 2;
      bonus.intelligence += 2;
    }

    if (player.raceId === 'tainted_halfblood') {
      const lowHp = player.hp / maxHp <= 0.35;

      if (lowHp) {
        bonus.attack += 3;
        bonus.critChance += 0.08;
      }
    }

    if (player.raceId === 'demon') {
      bonus.attack += this.demonRageStacks;
    }

    return bonus;
  }

  private calculateDamage(config: {
    baseDamage: number;
    multiplier: number;
    varianceMin: number;
    varianceMax: number;
  }) {
    let multiplier = config.multiplier;

    if (this.nightElfShadowDanceActive) {
      multiplier *= 1.25;
      this.nightElfShadowDanceActive = false;
    }

    multiplier *= this.getEnemyWeaknessDamageMultiplier();

    if (this.hasPlayerDebuff('weakness')) {
      const weakness = this.getPlayerDebuff('weakness');
      multiplier *= 1 - ((weakness?.power ?? 20) / 100);
    }

    const rawDamage =
      config.baseDamage * multiplier +
      Phaser.Math.Between(config.varianceMin, config.varianceMax);

    const reducedDamage = rawDamage - this.enemy.defense * 0.45;

    return Math.max(1, Math.floor(reducedDamage));
  }

  private getPlayerDebuff(id: EnemyDebuffId) {
  return this.playerDebuffs.find(debuff => debuff.id === id);
}

private hasPlayerDebuff(id: EnemyDebuffId) {
  return Boolean(this.getPlayerDebuff(id));
}

private addPlayerDebuff(debuff: ActivePlayerDebuff) {
  const existing = this.getPlayerDebuff(debuff.id);

  if (existing) {
    existing.duration = Math.max(existing.duration, debuff.duration);
    existing.power = Math.max(existing.power, debuff.power);
    existing.name = debuff.name;
    return;
  }

  this.playerDebuffs.push(debuff);
}

private tryApplyEnemyDebuffOnHit() {
  const debuff = this.enemy.debuffOnHit;

  if (!debuff) {
    return '';
  }

  if (Math.random() > debuff.chance) {
    return '';
  }

  this.addPlayerDebuff({
    id: debuff.id,
    name: debuff.name,
    duration: debuff.duration,
    power: debuff.power,
  });

  if (debuff.id === 'death_mark') {
    this.nextIncomingDamageBonus = debuff.power;
  }

  return `\nНаложен эффект: ${debuff.name}.`;
}

private tickPlayerDebuffs() {
  this.playerDebuffs = this.playerDebuffs
    .map(debuff => ({
      ...debuff,
      duration: debuff.duration - 1,
    }))
    .filter(debuff => debuff.duration > 0);
}

private applyDebuffDamageBeforePlayerAction() {
  let totalDamage = 0;
  const lines: string[] = [];

  this.playerDebuffs.forEach(debuff => {
    if (debuff.id === 'bleeding' || debuff.id === 'poison') {
      totalDamage += debuff.power;
      lines.push(`${debuff.name}: -${debuff.power} HP`);
    }
  });

  if (totalDamage <= 0) {
    return '';
  }

  player.hp = Math.max(0, player.hp - totalDamage);

  this.showFloatingText(
    this.playerCard.x,
    this.playerCard.y - 55,
    `-${totalDamage}`,
    '#9f7aea'
  );

  this.animateHit(this.playerCard);
  this.updateTexts();

  return lines.join('\n');
}

private applyDebuffDamageAndCheckDeath() {
  const debuffText = this.applyDebuffDamageBeforePlayerAction();

  if (!debuffText) {
    return false;
  }

  if (player.hp <= 0) {
    this.isBattleEnded = true;
    this.isBusy = true;

    this.logText.setText(
      `${debuffText}\n\nТы пал от наложенных эффектов.`
    );

    this.updateTexts();

    this.time.delayedCall(1800, () => {
      const freshStats = getPlayerStats(player);

      player.hp = freshStats.maxHp;
      player.energy = freshStats.maxEnergy;

      resetFloorRun();

      void saveGameAsync();

      this.scene.start('CampScene');
    });

    return true;
  }

  this.logText.setText(debuffText);

  return false;
}

private getSkillCostPenalty() {
  const skillCostUp = this.getPlayerDebuff('skill_cost_up');

  return skillCostUp?.power ?? 0;
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
        this.tickRaceSkillCooldown();
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

    const floor = gameState.floorRun.currentFloor || 1;
    const theme = getCryptDepthTheme(floor);

    // основной фон
    this.add.rectangle(width / 2, height / 2, width, height, theme.background, 1);

    this.add.circle(width / 2, 155, 260, theme.glow, 0.28);
    this.add.circle(width / 2, 190, 180, theme.fog, 0.13);
    this.add.circle(width / 2, 220, 90, theme.accent, 0.07);

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
    this.add.circle(width / 2, 245, 165, theme.glow, 0.12);
    this.add.circle(width / 2, 245, 95, theme.accent, 0.055);

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

      this.add.circle(x, y, size, theme.accent, 0.12);
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

      this.enemyHoverZone = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      this.enemyHoverZone.on('pointerover', () => {
        this.showEnemyTooltip();
      });

      this.enemyHoverZone.on('pointerout', () => {
        this.hideTooltip();
      });

      container.add(this.enemyHoverZone);
    } else {
      this.playerHpText = hpText;
      this.playerHpBar = hpBar;
      this.energyBar = energyBar;
      this.energyText = extraText;

      this.playerDebuffText = this.add.text(-190, 38, '', {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: '#c084fc',
        wordWrap: {
          width: 430,
        },
        lineSpacing: 3,
      }).setOrigin(0, 0.5);

      container.add(this.playerDebuffText);

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

      this.playerHoverZone = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      this.playerHoverZone.on('pointerover', () => {
        this.showPlayerTooltip();
      });

      this.playerHoverZone.on('pointerout', () => {
        this.hideTooltip();
      });

      container.add([this.potionText, statsText, this.playerHoverZone]);
    }

    return container;
  }

  private hideTooltip() {
    this.tooltipObjects.forEach(object => object.destroy());
    this.tooltipObjects = [];
  }

  private showEnemyTooltip() {
  const weaknessText =
    this.enemy.weaknesses && this.enemy.weaknesses.length > 0
      ? this.enemy.weaknesses.map(tag => this.getEnemyTagText(tag)).join(', ')
      : 'нет';

  const resistanceText =
    this.enemy.resistances && this.enemy.resistances.length > 0
      ? this.enemy.resistances.map(tag => this.getEnemyTagText(tag)).join(', ')
      : 'нет';

  const debuff = this.enemy.debuffOnHit;

  const debuffText = debuff
    ? `${debuff.name}\n${this.getDebuffShortDescription(debuff.id, debuff.power)}\nШанс: ${Math.round(debuff.chance * 100)}% • ${debuff.duration} х.`
    : 'нет';

  const description =
    `АТК ${this.enemy.attack}  •  ЗАЩ ${this.enemy.defense}\n\n` +
    `Слабости: ${weaknessText}\n` +
    `Сопротивления: ${resistanceText}\n\n` +
    `Эффект при ударе:\n${debuffText}`;

  this.showLargeTooltip(
    this.enemyCard.x,
    this.enemyCard.y + 80,
    this.enemy.name,
    description
  );
}

private showPlayerTooltip() {
  const stats = this.getBattleStats();
  const race = player.raceId ? getRaceById(player.raceId) : undefined;

  const raceName = race?.name ?? 'Раса не выбрана';
  const raceDescription = race?.description ?? 'У героя пока нет выбранной расы.';

  const passiveText = race
    ? `${race.passiveName}\n${race.passiveDescription}`
    : 'Нет пассивного навыка.';

  const activeText = race
    ? `${race.activeName}\n${race.activeDescription}`
    : 'Нет активного навыка.';

  const description =
    `Раса: ${raceName}\n` +
    `${raceDescription}\n\n` +
    `Пассивка:\n${passiveText}\n\n` +
    `Активный навык:\n${activeText}\n\n` +
    `Характеристики:\n` +
    `HP: ${player.hp}/${stats.maxHp}  •  Энергия: ${player.energy}/${stats.maxEnergy}\n` +
    `АТК: ${stats.attack}  •  ЗАЩ: ${stats.defense}\n` +
    `Крит: ${Math.round(stats.critChance * 100)}%  •  Уклонение: ${Math.round(stats.dodgeChance * 100)}%`;

  this.showPlayerLargeTooltip(
    this.playerCard.x,
    this.playerCard.y - 185,
    player.name,
    description
  );
}

private showPlayerLargeTooltip(x: number, y: number, title: string, description: string) {
  this.hideTooltip();

  const width = 470;
  const height = 380;

  const tooltipX = Phaser.Math.Clamp(x, 245, this.scale.width - 245);
  const tooltipY = Phaser.Math.Clamp(y, 230, this.scale.height - 230);

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.52);
  shadow.fillRoundedRect(
    tooltipX - width / 2,
    tooltipY - height / 2 + 6,
    width,
    height,
    24
  );
  shadow.setDepth(300);

  const bg = this.add.graphics();
  bg.fillStyle(0x10141c, 0.98);
  bg.fillRoundedRect(
    tooltipX - width / 2,
    tooltipY - height / 2,
    width,
    height,
    24
  );
  bg.lineStyle(2, UI.colors.goldDark, 0.9);
  bg.strokeRoundedRect(
    tooltipX - width / 2,
    tooltipY - height / 2,
    width,
    height,
    24
  );
  bg.setDepth(301);

  const titleText = this.add.text(tooltipX, tooltipY - 158, title, {
    fontFamily: UI.font.title,
    fontSize: '23px',
    color: UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(302);

  const descriptionText = this.add.text(
    tooltipX - width / 2 + 24,
    tooltipY - 120,
    description,
    {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.text,
      wordWrap: {
        width: width - 48,
      },
      lineSpacing: 5,
    }
  ).setOrigin(0, 0).setDepth(302);

  this.tooltipObjects.push(shadow, bg, titleText, descriptionText);
}

private showLargeTooltip(x: number, y: number, title: string, description: string) {
  this.hideTooltip();

  const width = 390;
  const height = 250;

  const tooltipX = Phaser.Math.Clamp(x, 210, this.scale.width - 210);
  const tooltipY = Phaser.Math.Clamp(y, 145, 420);

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.52);
  shadow.fillRoundedRect(
    tooltipX - width / 2,
    tooltipY - height / 2 + 6,
    width,
    height,
    22
  );
  shadow.setDepth(300);

  const bg = this.add.graphics();
  bg.fillStyle(0x100b08, 0.98);
  bg.fillRoundedRect(
    tooltipX - width / 2,
    tooltipY - height / 2,
    width,
    height,
    22
  );
  bg.lineStyle(2, UI.colors.goldDark, 0.92);
  bg.strokeRoundedRect(
    tooltipX - width / 2,
    tooltipY - height / 2,
    width,
    height,
    22
  );
  bg.setDepth(301);

  const titleText = this.add.text(tooltipX, tooltipY - 96, title, {
    fontFamily: UI.font.title,
    fontSize: '21px',
    color: UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(302);

  const descriptionText = this.add.text(
    tooltipX - width / 2 + 22,
    tooltipY - 62,
    description,
    {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.text,
      wordWrap: {
        width: width - 44,
      },
      lineSpacing: 4,
    }
  ).setOrigin(0, 0).setDepth(302);

  this.tooltipObjects.push(shadow, bg, titleText, descriptionText);
}

private showTooltip(x: number, y: number, title: string, description: string) {
  this.hideTooltip();

  const width = 360;
  const height = 118;

  const tooltipX = Phaser.Math.Clamp(x, 190, this.scale.width - 190);
  const tooltipY = Phaser.Math.Clamp(y, 90, this.scale.height - 90);

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.45);
  shadow.fillRoundedRect(
    tooltipX - width / 2,
    tooltipY - height / 2 + 5,
    width,
    height,
    18
  );
  shadow.setDepth(300);

  const bg = this.add.graphics();
  bg.fillStyle(0x120d0a, 0.98);
  bg.fillRoundedRect(
    tooltipX - width / 2,
    tooltipY - height / 2,
    width,
    height,
    18
  );
  bg.lineStyle(2, UI.colors.goldDark, 0.85);
  bg.strokeRoundedRect(
    tooltipX - width / 2,
    tooltipY - height / 2,
    width,
    height,
    18
  );
  bg.setDepth(301);

  const titleText = this.add.text(tooltipX, tooltipY - 32, title, {
    fontFamily: UI.font.title,
    fontSize: '18px',
    color: UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(302);

  const descriptionText = this.add.text(tooltipX, tooltipY + 16, description, {
    fontFamily: UI.font.body,
    fontSize: '14px',
    color: UI.colors.text,
    align: 'center',
    wordWrap: {
      width: width - 34,
    },
    lineSpacing: 4,
  }).setOrigin(0.5).setDepth(302);

  this.tooltipObjects.push(shadow, bg, titleText, descriptionText);
}

private createEffectChip(config: {
  x: number;
  y: number;
  text: string;
  icon: string;
  color: number;
  tooltipTitle: string;
  tooltipDescription: string;
  targetArray: Phaser.GameObjects.GameObject[];
}) {
  const chipWidth = 178;
  const chipHeight = 34;
  const radius = 13;

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.3);
  shadow.fillRoundedRect(
    config.x - chipWidth / 2,
    config.y - chipHeight / 2 + 3,
    chipWidth,
    chipHeight,
    radius
  );
  shadow.setDepth(45);

  const bg = this.add.graphics();
  bg.fillStyle(0x120d0a, 0.96);
  bg.fillRoundedRect(
    config.x - chipWidth / 2,
    config.y - chipHeight / 2,
    chipWidth,
    chipHeight,
    radius
  );
  bg.lineStyle(1, config.color, 0.75);
  bg.strokeRoundedRect(
    config.x - chipWidth / 2,
    config.y - chipHeight / 2,
    chipWidth,
    chipHeight,
    radius
  );
  bg.setDepth(46);

  const iconText = this.add.text(config.x - chipWidth / 2 + 20, config.y, config.icon, {
    fontFamily: UI.font.body,
    fontSize: '14px',
    color: UI.colors.text,
  }).setOrigin(0.5).setDepth(47);

  const labelText = this.add.text(config.x - chipWidth / 2 + 39, config.y, config.text, {
    fontFamily: UI.font.body,
    fontSize: '12px',
    color: UI.colors.text,
  }).setOrigin(0, 0.5).setDepth(47);

  const hitbox = this.add.rectangle(config.x, config.y, chipWidth, chipHeight, 0x000000, 0)
   .setDepth(90)
   .setInteractive({ useHandCursor: true });

  hitbox.on('pointerover', () => {
    bg.clear();
    bg.fillStyle(0x20150f, 1);
    bg.fillRoundedRect(
      config.x - chipWidth / 2,
      config.y - chipHeight / 2,
      chipWidth,
      chipHeight,
      radius
    );
    bg.lineStyle(2, config.color, 1);
    bg.strokeRoundedRect(
      config.x - chipWidth / 2,
      config.y - chipHeight / 2,
      chipWidth,
      chipHeight,
      radius
    );

    this.showTooltip(
      config.x,
      config.y - 82,
      config.tooltipTitle,
      config.tooltipDescription
    );
  });

  hitbox.on('pointerout', () => {
    bg.clear();
    bg.fillStyle(0x120d0a, 0.96);
    bg.fillRoundedRect(
      config.x - chipWidth / 2,
      config.y - chipHeight / 2,
      chipWidth,
      chipHeight,
      radius
    );
    bg.lineStyle(1, config.color, 0.75);
    bg.strokeRoundedRect(
      config.x - chipWidth / 2,
      config.y - chipHeight / 2,
      chipWidth,
      chipHeight,
      radius
    );

    this.hideTooltip();
  });

  config.targetArray.push(shadow, bg, iconText, labelText, hitbox);
}

private getDebuffColor(id: EnemyDebuffId) {
  if (id === 'bleeding') return 0xff6b6b;
  if (id === 'poison') return 0x75d184;
  if (id === 'curse') return 0xc084fc;
  if (id === 'armor_break') return 0xf0d58a;
  if (id === 'rot') return 0x8fbf6a;
  if (id === 'death_mark') return 0xff4d4d;
  if (id === 'energy_block') return 0x70a6ff;
  if (id === 'weakness') return 0xd6a85a;
  if (id === 'agility_down') return 0x70a6ff;
  if (id === 'crit_down') return 0xc084fc;
  if (id === 'heal_block') return 0xff9f6b;
  if (id === 'skill_cost_up') return 0xf0d58a;

  return UI.colors.gold;
}

private renderPlayerEffectChips() {
  this.playerEffectObjects.forEach(object => object.destroy());
  this.playerEffectObjects = [];

  if (this.playerDebuffs.length === 0) {
    return;
  }

  const startX = this.playerCard.x - 170;
  const startY = this.playerCard.y + 38;

  this.playerDebuffs.slice(0, 4).forEach((debuff, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;

    const x = startX + col * 190;
    const y = startY + row * 40;

    this.createEffectChip({
      x,
      y,
      text: `${debuff.name}: ${debuff.duration} х.`,
      icon: this.getDebuffIcon(debuff.id),
      color: this.getDebuffColor(debuff.id),
      tooltipTitle: debuff.name,
      tooltipDescription:
        `${this.getDebuffShortDescription(debuff.id, debuff.power)}\n` +
        `Осталось ходов: ${debuff.duration}.`,
      targetArray: this.playerEffectObjects,
    });
  });
}

private renderEnemyEffectChips() {
  this.enemyEffectObjects.forEach(object => object.destroy());
  this.enemyEffectObjects = [];

  const effects: {
    id: EnemyDebuffId;
    name: string;
    duration: number;
    power: number;
  }[] = [];

  if (this.enemyBleedTurns > 0) {
    effects.push({
      id: 'bleeding',
      name: 'Кровотечение',
      duration: this.enemyBleedTurns,
      power: this.enemyBleedDamage,
    });
  }

  if (effects.length === 0) {
    return;
  }

  const startX = this.enemyCard.x - 170;
  const startY = this.enemyCard.y + 78;

  effects.slice(0, 4).forEach((effect, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;

    const x = startX + col * 190;
    const y = startY + row * 40;

    this.createEffectChip({
      x,
      y,
      text: `${effect.name}: ${effect.duration} х.`,
      icon: this.getDebuffIcon(effect.id),
      color: this.getDebuffColor(effect.id),
      tooltipTitle: effect.name,
      tooltipDescription:
        `${this.getDebuffShortDescription(effect.id, effect.power)}\n` +
        `Осталось ходов: ${effect.duration}.`,
      targetArray: this.enemyEffectObjects,
    });
  });
}

  private createPlayerDebuffText() {
    if (this.playerDebuffs.length === 0) {
      return '';
    }

    return this.playerDebuffs
      .map(debuff => `${this.getDebuffIcon(debuff.id)} ${debuff.name}: ${debuff.duration} х.`)
      .join('\n');
  }

  private getEnemyTagText(tag: string) {
  if (tag === 'dagger') return 'кинжал';
  if (tag === 'axe') return 'топор';
  if (tag === 'katana') return 'катана';
  if (tag === 'hammer') return 'молот';
  if (tag === 'shield_sword') return 'щит-меч';
  if (tag === 'sword') return 'меч';
  if (tag === 'bleed') return 'кровотечение';
  if (tag === 'stun') return 'оглушение';
  if (tag === 'crit') return 'крит';
  if (tag === 'poison') return 'яд';
  if (tag === 'curse') return 'проклятие';

  return tag;
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

    if (this.raceSkillCooldown > 0) {
      statuses.push(`Расовый навык: КД ${this.raceSkillCooldown}`);
    }

    if (this.stoneGuardActive) {
      statuses.push('Глухая стойка');
    }

    if (this.nightElfShadowStepActive) {
      statuses.push('Шаг в тень');
    }

    if (this.nightElfShadowDanceActive) {
      statuses.push('Танец теней');
    }

    if (this.goblinDirtyTrickActive) {
      statuses.push('Грязный приём');
    }

    if (this.demonRageStacks > 0) {
      statuses.push(`Адская ярость: +${this.demonRageStacks}`);
    }

    if (this.playerDebuffs.length > 0) {
      statuses.push(`Эффекты: ${this.playerDebuffs.length}`);
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

    if (this.applyDebuffDamageAndCheckDeath()) {
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

    const weaknessText = this.getEnemyWeaknessText();

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Критическая атака мечом! Ты наносишь ${finalDamage} урона.${weaknessText}`
      : `Ты наносишь удар мечом: ${finalDamage} урона.${weaknessText}`;

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

    const weaknessText = this.getEnemyWeaknessText();

    const playerActionText =
      `Кинжалы проводят серию из 3 быстрых ударов.\n` +
      `Общий урон: ${totalDamage}.${critText}${weaknessText}`;

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

   const weaknessText = this.getEnemyWeaknessText();

   this.animatePlayerAttack();
   this.damageEnemy(finalDamage);

   let playerActionText = isCrit
     ? `Критический рубящий удар топором! Ты наносишь ${finalDamage} урона.${weaknessText}`
     : `Топор наносит тяжёлый рубящий удар: ${finalDamage} урона.${weaknessText}`;

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

    const weaknessText = this.getEnemyWeaknessText();

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Катана наносит точный критический разрез: ${finalDamage} урона.${weaknessText}\nВраг начинает кровоточить.`
      : `Катана рассекает врага: ${finalDamage} урона.${weaknessText}\nВраг начинает кровоточить.`;

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

    const weaknessText = this.getEnemyWeaknessText();

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);
    this.shakeBattle(0.008, 220);

    let playerActionText = isCrit
      ? `Критический удар молотом сотрясает арену: ${finalDamage} урона.${weaknessText}`
      : `Молот обрушивается на врага: ${finalDamage} урона.${weaknessText}`;

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

    const weaknessText = this.getEnemyWeaknessText();

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Щит-меч проводит безопасную критическую атаку: ${finalDamage} урона.${weaknessText}\nСледующий удар врага будет ослаблен.`
      : `Ты атакуешь из-за щита: ${finalDamage} урона.${weaknessText}\nСледующий удар врага будет ослаблен.`;

    this.afterPlayerAttack(playerActionText);
  }

  private handleVictory(playerActionText: string) {
    this.hideTooltip();
    if (this.isBattleEnded) {
      return;
    }

    this.isBattleEnded = true;
    this.isBusy = true;

    const baseGold = this.enemy.goldReward;

    const gold =
      player.raceId === 'goblin'
        ? Math.floor(baseGold * 1.2)
        : baseGold;

    player.gold += gold;

    trackEnemyKilled();
    trackGoldEarned(gold);

    gameState.floorRun.monstersDefeated += 1;
    gameState.floorRun.goldEarned += gold;
    gameState.floorRun.expEarned += this.enemy.expReward;

    const expResult = addExperience(player, this.enemy.expReward);

    const loot = rollEnemyLoot(this.enemy);

    const lootText = loot.text.length > 0
      ? `\n\nДобыча:\n${loot.text}`
      : '';

    let levelText = '';

    if (expResult.leveledUp) {
      levelText = `\n\n${createLevelUpText(expResult)}`;
    }

    let demonHealText = '';

    if (player.raceId === 'demon' && this.demonHpSpentByHellfire > 0) {
      const stats = this.getBattleStats();
      const heal = Math.floor(this.demonHpSpentByHellfire * 0.5);

      if (heal > 0) {
        player.hp = Math.min(stats.maxHp, player.hp + heal);

        demonHealText =
          `\nДемон поглощает остатки кровавого пламени и восстанавливает ${heal} HP.`;
      }

      this.demonHpSpentByHellfire = 0;
    }

    void saveGameAsync();

    this.logText.setText(
      `${playerActionText}\n\n` +
      `${this.enemy.name} повержен.\n` +
      `Получено золота: ${gold}\n` +
      `Получено опыта: ${this.enemy.expReward}` +
      `${demonHealText}` +
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

    if (this.applyDebuffDamageAndCheckDeath()) {
      return;
    }

    if (player.potions <= 0) {
      this.logText.setText('Зелий больше нет.');
      this.updateTexts();
      return;
    }

    if (this.hasPlayerDebuff('heal_block')) {
      this.logText.setText('Печать не даёт использовать зелье сейчас.');
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

    const rot = this.getPlayerDebuff('rot');

    const healMultiplier =
      rot
        ? 1 - rot.power / 100
        : 1;

    const healAmount = Math.max(1, Math.floor(stats.maxHp * 0.35 * healMultiplier));
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

      const guaranteedDodge = this.nightElfShadowStepActive;

      if (guaranteedDodge || Math.random() < stats.dodgeChance) {
        this.nightElfShadowStepActive = false;
      
        if (player.raceId === 'night_elf') {
          this.nightElfShadowDanceActive = true;
        }
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
        this.tickRaceSkillCooldown();
        this.tickPlayerDebuffs();
        this.isBusy = false;
        this.createActionButtons();

        return;
      }

      let damage = Math.max(
        1,
        this.enemy.attack + Phaser.Math.Between(-2, 3) - stats.defense
      );

      if (this.hasPlayerDebuff('armor_break')) {
        const armorBreak = this.getPlayerDebuff('armor_break');
        damage += armorBreak?.power ?? 2;
      }

      if (this.hasPlayerDebuff('curse')) {
        const curse = this.getPlayerDebuff('curse');
        damage += curse?.power ?? 1;
      }

      if (this.nextIncomingDamageBonus > 0) {
        damage = Math.floor(damage * (1 + this.nextIncomingDamageBonus / 100));
        this.nextIncomingDamageBonus = 0;
      }

      if (player.raceId === 'stoneborn') {
        damage = Math.max(1, damage - 2);
      }

      if (this.stoneGuardActive) {
        damage = Math.max(1, Math.floor(damage * 0.4));
        this.stoneGuardActive = false;
      }

      if (this.goblinDirtyTrickActive) {
        damage = Math.max(1, Math.floor(damage * 0.75));
        this.goblinDirtyTrickActive = false;
      }

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

      const debuffText = this.tryApplyEnemyDebuffOnHit();

      let demonRageText = '';

      if (player.raceId === 'demon' && damage > 0) {
        const previousStacks = this.demonRageStacks;
      
        this.demonRageStacks = Math.min(4, this.demonRageStacks + 1);
      
        if (this.demonRageStacks > previousStacks) {
          demonRageText = `\nАдская ярость: атака +${this.demonRageStacks}.`;
        }
      }

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
            ? `${playerActionText}\n\nТы заблокировал часть удара.\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${debuffText}\n\nТы пал в катакомбах...`
            : `${playerActionText}\n\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${debuffText}\n\nТы пал в катакомбах...`
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
          ? `${playerActionText}\n\nТы заблокировал часть удара.\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${demonRageText}${debuffText}\nЭнергия восстановлена на 1.${passiveText}`
          : `${playerActionText}\n\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${demonRageText}${debuffText}\nЭнергия восстановлена на 1.${passiveText}`
      );

      this.updateTexts();
      this.tickRaceSkillCooldown();
      this.tickPlayerDebuffs();
      this.isBusy = false;
      this.createActionButtons();
    });
  }

  private tickRaceSkillCooldown() {
    if (this.raceSkillCooldown > 0) {
      this.raceSkillCooldown -= 1;
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

    if (this.playerDebuffText) {
      this.playerDebuffText.setText(this.createPlayerDebuffText());
    }

    this.renderPlayerEffectChips();
    this.renderEnemyEffectChips();
    this.updateStatusText();
  }
}