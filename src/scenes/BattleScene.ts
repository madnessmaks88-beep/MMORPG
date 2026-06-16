import Phaser from 'phaser';


import { player } from '../data/player';
import type { EnemyData, EnemyDebuffId } from '../data/enemies';
import { getEnemyById } from '../data/enemies';
import {
  clearResumePoint,
  flushSaveNow,
  markBattleResumePoint,
  markDungeonResumePoint,
  requestAutoSave,
  saveGameAsync,
  type BattleResumeState,
} from '../systems/SaveSystem';
import { trackEnemyKilled, trackGoldEarned } from '../systems/QuestSystem';
import {
  restoreEnergy,
} from '../systems/BattleSystem';
import {
  gameState,
  goToNextRoom,
  resetFloorRun,
} from '../data/gameState';
import { addExperience, createLevelUpText, type LevelUpResult } from '../systems/LevelSystem';
import {
  getEquippedWeapon,
  getPlayerStats,
} from '../systems/InventorySystem';
import { getCurrentRoom, markCurrentRoomCompleted } from '../systems/FloorSystem';
import { rollEnemyLoot } from '../systems/LootSystem';
import { addMaterialsPack } from '../systems/MaterialSystem';
import { trackFloorMaterials } from '../systems/FloorMaterialLogSystem';
import { getMaterialName, type MaterialId } from '../data/materials';
import { getCryptDepthTheme } from '../systems/CryptThemeSystem';
import { createScaledEnemy } from '../systems/EnemyScalingSystem';
import { getRaceById } from '../data/races';
import {
  formatCheckpointTimeLeft,
  getActiveCampfireBattleCheckpoint,
  restoreCampfireBattleCheckpoint,
  type CampfireBattleCheckpoint,
} from '../systems/CampfireCheckpointSystem';

import { applyRoomRegeneration } from '../systems/RoomRegenerationSystem';

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


type CharacterTreeBranchId =
  | 'hp'
  | 'energy'
  | 'attack'
  | 'defense'
  | 'crit'
  | 'agility'
  | 'luck'
  | 'intelligence';

type BattleTreePlayer = typeof player & {
  characterTree?: Partial<Record<CharacterTreeBranchId, number>>;
};

type ActivePlayerDebuff = {
  id: EnemyDebuffId;
  name: string;
  duration: number;
  power: number;
};

const GOBLIN_EXTRA_MATERIAL_POOL: MaterialId[] = [
  'darkened_bone',
  'dim_gem',
  'old_leather',
];

type BattleLayout = {
  width: number;
  height: number;
  centerX: number;
  safeX: number;
  safeTop: number;
  safeBottom: number;
  contentWidth: number;
  enemyY: number;
  playerY: number;
  logY: number;
  logHeight: number;
  actionPanelY: number;
  actionPanelHeight: number;
  attackButtonY: number;
  firstRowY: number;
  secondRowY: number;
  mainButtonWidth: number;
  sideButtonWidth: number;
  compact: boolean;
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
  private raceSkillCooldownJustApplied = false;
  private potionCooldown = 0;

  private taintedHpCost = 0;

  private humanBattleFocusTurns = 0;
  private humanBattleFocusDamageBonus = 0;
  private humanBattleFocusDefenseBonus = 0;

  private stoneQuartzSpikesTurns = 0;

  private nightElfShadowStepTurns = 0;
  private nightElfShadowDanceActive = false;

  private goblinGreedyMarkTurns = 0;

  private demonRageStacks = 0;
  private demonHpSpentByHellfire = 0;

  private raceAttackEffectText = '';

  private playerDebuffs: ActivePlayerDebuff[] = [];
  private nextIncomingDamageBonus = 0;

  private playerDebuffText?: Phaser.GameObjects.Text;

  private enemyEffectObjects: Phaser.GameObjects.GameObject[] = [];
  private playerEffectObjects: Phaser.GameObjects.GameObject[] = [];

  private tooltipObjects: Phaser.GameObjects.GameObject[] = [];

  private enemyHoverZone?: Phaser.GameObjects.GameObject;

  private playerHoverZone?: Phaser.GameObjects.GameObject;

  private playerHpBarMaxWidth = 520;
  private enemyHpBarMaxWidth = 520;
  private energyBarMaxWidth = 520;

  private isBossBattle = false;


  private treeLastBreathUsed = false;
  private treeUnbreakableUsed = false;
  private treeFirstIncomingHitReduced = false;
  private treeFirstPlayerHitBonusUsed = false;
  private treeNextHitDamageBonus = 0;
  private treeFullEnergySkillBonusPending = false;
  private treeDodgeStreak = 0;
  private treeGuaranteedCrit = false;

  


  constructor() {
    super('BattleScene');
  }

  init(data?: {
    enemyId?: string;
    returnToDungeon?: boolean;
    resumeBattle?: boolean;
    battleSnapshot?: BattleResumeState;
  }) {
  this.returnToDungeon = data?.returnToDungeon ?? false;
  this.isBattleEnded = false;
  this.isBusy = false;

  this.humanPassiveActivated = false;
  this.raceSkillCooldown = 0;
  this.potionCooldown = 0;

  this.taintedHpCost = 0;

  this.humanBattleFocusTurns = 0;
  this.humanBattleFocusDamageBonus = 0;
  this.humanBattleFocusDefenseBonus = 0;

  this.stoneQuartzSpikesTurns = 0;

  this.nightElfShadowStepTurns = 0;
  this.nightElfShadowDanceActive = false;

  this.goblinGreedyMarkTurns = 0;

  this.demonRageStacks = 0;
  this.demonHpSpentByHellfire = 0;

  this.raceAttackEffectText = '';

  this.enemyBleedTurns = 0;
  this.enemyBleedDamage = 0;
  this.shieldSwordGuardActive = false;

  this.playerDebuffs = [];
  this.nextIncomingDamageBonus = 0;


  this.treeLastBreathUsed = false;
  this.treeUnbreakableUsed = false;
  this.treeFirstIncomingHitReduced = false;
  this.treeFirstPlayerHitBonusUsed = false;
  this.treeNextHitDamageBonus = 0;
  this.treeFullEnergySkillBonusPending = false;
  this.treeDodgeStreak = 0;
  this.treeGuaranteedCrit = false;

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

  if (data?.resumeBattle && data.battleSnapshot?.enemyId === enemyId) {
    this.enemy.hp = Phaser.Math.Clamp(
      Math.floor(data.battleSnapshot.enemyHp),
      1,
      this.enemy.maxHp
    );
  }
}

  create() {
    const floor = gameState.floorRun.currentFloor || 1;
    const room = getCurrentRoom();
    const isBoss = room?.type === 'boss' || room?.type === 'tier_boss';

    this.isBossBattle = isBoss;

    const layout = this.getBattleLayout();

    this.createBattleBackground(isBoss);

    this.createBattleHeader(
      `Этаж ${floor}  •  Ур. ${player.level}`,
      room ? room.title : `${player.name} против ${this.enemy.name}`,
      isBoss
    );

    this.enemyCard = this.createFighterCard(
      layout.centerX,
      layout.enemyY,
      this.enemy.name,
      isBoss ? '♛' : '☠',
      isBoss ? 0x3a120c : 0x241515,
      true,
      isBoss
    );

    this.playerCard = this.createFighterCard(
      layout.centerX,
      layout.playerY,
      player.name,
      '🗡',
      0x151b24,
      false,
      false
    );

    this.createBattleLogPanel();
    this.createActionButtons();

    this.applyStartOfBattleTreeEffects();
    this.updateTexts();
    this.updateStatusText();
    this.rememberBattleResumePoint('battle-create');
    void flushSaveNow('battle-create');
  }

  private rememberBattleResumePoint(_reason = 'battle') {
    if (!this.enemy || this.isBattleEnded || player.hp <= 0 || this.enemy.hp <= 0) {
      return;
    }

    const room = getCurrentRoom();

    markBattleResumePoint({
      enemyId: this.enemy.id,
      enemyHp: this.enemy.hp,
      enemyMaxHp: this.enemy.maxHp,
      returnToDungeon: this.returnToDungeon,
      floor: gameState.floorRun.currentFloor || 1,
      roomIndex: gameState.floorRun.currentRoomIndex || 0,
      roomId: room?.id,
    });
  }

  private getBattleLayout(): BattleLayout {
    const { width, height } = this.scale;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.022), 18, 34);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.035), 28, 46);
    const contentWidth = Math.min(width - safeX * 2, 660);
    const compact = height < 1120;

    const actionPanelHeight = compact ? 286 : 306;
    const actionPanelY = height - safeBottom - actionPanelHeight / 2;
    const attackButtonY = actionPanelY - actionPanelHeight / 2 + 52;
    const firstRowY = attackButtonY + (compact ? 78 : 86);
    const secondRowY = firstRowY + (compact ? 78 : 88);

    const logHeight = compact ? 188 : 220;
    const logY = actionPanelY - actionPanelHeight / 2 - logHeight / 2 - 18;

    const playerY = logY - logHeight / 2 - (compact ? 116 : 128);
    const enemyY = safeTop + (this.isBossBattle ? (compact ? 218 : 236) : (compact ? 182 : 198));

    const mainButtonWidth = Math.min(contentWidth - 70, 560);
    const sideButtonWidth = Math.min((mainButtonWidth - 18) / 2, 272);

    return {
      width,
      height,
      centerX: width / 2,
      safeX,
      safeTop,
      safeBottom,
      contentWidth,
      enemyY,
      playerY,
      logY,
      logHeight,
      actionPanelY,
      actionPanelHeight,
      attackButtonY,
      firstRowY,
      secondRowY,
      mainButtonWidth,
      sideButtonWidth,
      compact,
    };
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


  private getSwordLargeEnemyDamageBonus(playerMaxHp: number) {
    const safePlayerMaxHp = Math.max(1, playerMaxHp);
    const enemyHpRatio = this.enemy.maxHp / safePlayerMaxHp;

    if (enemyHpRatio >= 3) {
      return {
        multiplier: 1.2,
        bonusPercent: 20,
      };
    }

    if (enemyHpRatio >= 2) {
      return {
        multiplier: 1.15,
        bonusPercent: 15,
      };
    }

    if (enemyHpRatio >= 1.5) {
      return {
        multiplier: 1.1,
        bonusPercent: 10,
      };
    }

    return {
      multiplier: 1,
      bonusPercent: 0,
    };
  }

  private tryApplyDaggerLifesteal(damage: number) {
    if (damage <= 0) {
      return 0;
    }

    if (Math.random() >= 0.08) {
      return 0;
    }

    if (this.hasPlayerDebuff('heal_block')) {
      return 0;
    }

    const stats = this.getBattleStats();

    if (player.hp >= stats.maxHp) {
      return 0;
    }

    const rot = this.getPlayerDebuff('rot');
    const healMultiplier = rot ? Math.max(0, 1 - rot.power / 100) : 1;
    const healAmount = Math.max(1, Math.floor(damage * 0.5 * healMultiplier));
    const previousHp = player.hp;

    player.hp = Math.min(stats.maxHp, player.hp + healAmount);

    const actualHeal = Math.max(0, player.hp - previousHp);

    if (actualHeal > 0) {
      this.showFloatingText(
        this.playerCard.x,
        this.playerCard.y - 55,
        `+${actualHeal}`,
        '#75d184'
      );
    }

    return actualHeal;
  }

  private createBattleHeader(title: string, subtitle: string, isBoss: boolean) {
    const layout = this.getBattleLayout();
    const panelWidth = Math.min(layout.contentWidth, 640);
    const panelHeight = isBoss ? 112 : 86;
    const panelY = layout.safeTop + panelHeight / 2 + 6;

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius: 26,
      color: isBoss ? 0x1a0807 : 0x0d0a08,
      alpha: 0.95,
      strokeColor: isBoss ? 0xff6b35 : UI.colors.goldDark,
      strokeAlpha: isBoss ? 0.86 : 0.45,
      strokeWidth: isBoss ? 3 : 2,
      depth: 8,
    });

    if (isBoss) {
      this.add.circle(layout.centerX, panelY, panelWidth * 0.36, 0xff2f2f, 0.055).setDepth(9);

      this.add.text(layout.centerX, panelY - 36, '⚠ БОСС ПОДЗЕМЕЛЬЯ ⚠', {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '18px' : '20px',
        color: '#ff9a6b',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: panelWidth - 42,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(11);
    }

    this.add.text(layout.centerX, isBoss ? panelY - 6 : panelY - 14, title, {
      fontFamily: UI.font.title,
      fontSize: isBoss ? (layout.compact ? '24px' : '27px') : (layout.compact ? '23px' : '26px'),
      color: isBoss ? '#ffb36b' : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: panelWidth - 44,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12);

    this.add.text(layout.centerX, isBoss ? panelY + 29 : panelY + 20, subtitle, {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '13px' : '15px',
      color: isBoss ? '#f0c0a0' : UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: panelWidth - 58,
      },
      maxLines: 2,
      lineSpacing: 3,
    }).setOrigin(0.5).setDepth(12);
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
    const layout = this.getBattleLayout();

    this.createRoundedPanel({
      x: layout.centerX,
      y: layout.logY,
      width: layout.contentWidth,
      height: layout.logHeight,
      radius: 28,
      color: 0x0d0a08,
      alpha: 0.92,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.5,
      depth: 8,
    });

    this.add.text(layout.centerX, layout.logY - layout.logHeight / 2 + 25, 'Ход боя', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '18px' : '21px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 44,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(11);

    this.logText = this.add.text(layout.centerX, layout.logY + 14, 'Выбери действие.', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '15px' : '17px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 66,
        useAdvancedWrap: true,
      },
      maxLines: layout.compact ? 7 : 8,
      lineSpacing: 3,
    }).setOrigin(0.5).setDepth(11);
  }


  private createActionButtons() {
    const layout = this.getBattleLayout();

    this.actionButtons.forEach(object => {
      object.destroy();
    });

    this.actionButtons = [];

    const panelObjects = this.createRoundedPanel({
      x: layout.centerX,
      y: layout.actionPanelY,
      width: layout.contentWidth,
      height: layout.actionPanelHeight,
      radius: 32,
      color: 0x0b0908,
      alpha: 0.96,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.58,
      depth: 20,
    });

    this.actionButtons.push(panelObjects.shadow, panelObjects.panel);

    const panelDivider = this.add.rectangle(
      layout.centerX,
      layout.actionPanelY - layout.actionPanelHeight / 2 + 16,
      layout.contentWidth - 70,
      2,
      UI.colors.gold,
      0.18
    ).setDepth(22);

    this.actionButtons.push(panelDivider);

    const attack = this.createBattleActionButton({
      x: layout.centerX,
      y: layout.attackButtonY,
      width: layout.mainButtonWidth,
      height: layout.compact ? 56 : 62,
      icon: '⚔',
      title: this.getWeaponAttackButtonText(),
      subtitle: 'Базовая атака • 0 энергии',
      accentColor: UI.colors.gold,
      disabled: this.isBusy || this.isBattleEnded,
      onClick: () => this.handleAttack(),
    });

    this.actionButtons.push(...attack);

    const leftX = layout.centerX - layout.sideButtonWidth / 2 - 9;
    const rightX = layout.centerX + layout.sideButtonWidth / 2 + 9;

    const power = this.createBattleActionButton({
      x: leftX,
      y: layout.firstRowY,
      width: layout.sideButtonWidth,
      height: layout.compact ? 64 : 70,
      icon: '◆',
      title: 'Сильный удар',
      subtitle: `${this.powerAttackEnergyCost + this.getSkillCostPenalty()} эн.`,
      accentColor: UI.colors.redHex,
      disabled: this.isBusy || this.isBattleEnded || player.energy < this.powerAttackEnergyCost + this.getSkillCostPenalty(),
      onClick: () => this.handlePowerAttack(),
    });

    this.actionButtons.push(...power);

    const raceSkill = this.createBattleActionButton({
      x: rightX,
      y: layout.firstRowY,
      width: layout.sideButtonWidth,
      height: layout.compact ? 64 : 70,
      icon: this.getRaceSkillIcon(),
      title: this.getRaceSkillTitle(),
      subtitle: this.getRaceSkillSubtitle(),
      accentColor: UI.colors.gold,
      disabled: this.isRaceSkillDisabled(),
      onClick: () => this.handleRaceSkill(),
    });

    this.actionButtons.push(...raceSkill);

    const defend = this.createBattleActionButton({
      x: leftX,
      y: layout.secondRowY,
      width: layout.sideButtonWidth,
      height: layout.compact ? 64 : 70,
      icon: '🛡',
      title: 'Защита',
      subtitle: 'Снизить урон • +1 эн.',
      accentColor: UI.colors.blueHex,
      disabled: this.isBusy || this.isBattleEnded,
      onClick: () => this.handleDefend(),
    });

    this.actionButtons.push(...defend);

    const potion = this.createBattleActionButton({
      x: rightX,
      y: layout.secondRowY,
      width: layout.sideButtonWidth,
      height: layout.compact ? 64 : 70,
      icon: '✚',
      title: 'Зелье',
      subtitle: this.getPotionButtonSubtitle(),
      accentColor: UI.colors.greenHex,
      disabled: this.isPotionDisabled(),
      onClick: () => this.handlePotion(),
    });

    this.actionButtons.push(...potion);
  }

  private getPotionButtonSubtitle() {
    if (this.potionCooldown > 0) {
      return `КД ${this.potionCooldown} х.`;
    }

    if (this.hasPlayerDebuff('heal_block')) {
      return 'Лечение заблок.';
    }

    return `${player.potions} шт. • без хода`;
  }

  private isPotionDisabled() {
    return (
      this.isBusy ||
      this.isBattleEnded ||
      player.potions <= 0 ||
      this.potionCooldown > 0 ||
      this.hasPlayerDebuff('heal_block')
    );
  }

  private tickPotionCooldown() {
    if (this.potionCooldown > 0) {
      this.potionCooldown -= 1;
    }
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

  const bgColor = disabled ? 0x0c0c0c : 0x17100c;
  const hoverColor = 0x2a1b12;
  const pressedColor = 0x342015;
  const alpha = disabled ? 0.54 : 0.98;
  const strokeAlpha = disabled ? 0.24 : 0.82;

  const textColor = disabled ? '#5b5b5b' : UI.colors.text;
  const titleHoverColor = disabled ? '#5b5b5b' : UI.colors.goldText;

  const objects: Phaser.GameObjects.GameObject[] = [];
  const radius = Math.min(24, config.height / 2);
  const left = config.x - config.width / 2;
  const top = config.y - config.height / 2;

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.34);
  shadow.fillRoundedRect(left, top + 6, config.width, config.height, radius);
  shadow.setDepth(21);

  const glow = this.add.graphics();
  glow.fillStyle(config.accentColor, disabled ? 0.025 : 0.075);
  glow.fillRoundedRect(left + 5, top + 5, config.width - 10, config.height - 10, radius);
  glow.setDepth(22);

  const bg = this.add.graphics();
  const drawBg = (fill: number, fillAlpha: number, borderAlpha: number) => {
    bg.clear();
    bg.fillStyle(fill, fillAlpha);
    bg.fillRoundedRect(left, top, config.width, config.height, radius);
    bg.lineStyle(2, config.accentColor, borderAlpha);
    bg.strokeRoundedRect(left, top, config.width, config.height, radius);
    bg.fillStyle(config.accentColor, disabled ? 0.06 : 0.14);
    bg.fillRoundedRect(left + 6, top + 6, 46, config.height - 12, Math.min(18, radius));
  };

  drawBg(bgColor, alpha, strokeAlpha);
  bg.setDepth(23);

  const iconX = left + 31;

  const iconBg = this.add.circle(iconX, config.y, 20, config.accentColor, disabled ? 0.08 : 0.18)
    .setStrokeStyle(1, config.accentColor, disabled ? 0.25 : 0.64)
    .setDepth(24);

  const icon = this.add.text(iconX, config.y, config.icon, {
    fontFamily: UI.font.body,
    fontSize: config.width > 300 ? '18px' : '16px',
    color: disabled ? '#555555' : UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(25);

  const textX = left + 62;
  const title = this.add.text(textX, config.y - 13, config.title, {
    fontFamily: UI.font.title,
    fontSize: config.width > 300 ? '19px' : '14px',
    color: textColor,
    stroke: '#000000',
    strokeThickness: 3,
    wordWrap: {
      width: config.width - 72,
      useAdvancedWrap: true,
    },
    maxLines: 2,
    lineSpacing: -3,
  }).setOrigin(0, 0.5).setDepth(25);

  const subtitle = this.add.text(textX, config.y + 16, config.subtitle, {
    fontFamily: UI.font.body,
    fontSize: config.width > 300 ? '12px' : '11px',
    color: disabled ? '#444444' : UI.colors.textMuted,
    wordWrap: {
      width: config.width - 72,
    },
    maxLines: 1,
  }).setOrigin(0, 0.5).setDepth(25);

  const zone = this.add.zone(config.x, config.y, config.width, config.height).setDepth(30);

  objects.push(shadow, glow, bg, iconBg, icon, title, subtitle, zone);

  const redrawButton = (
    fillColor: number,
    fillAlpha: number,
    borderAlpha: number,
    titleColor: string,
    offsetY = 0
  ) => {
    drawBg(fillColor, fillAlpha, borderAlpha);

    iconBg.setY(config.y + offsetY);
    icon.setY(config.y + offsetY);
    title.setY(config.y - 13 + offsetY);
    subtitle.setY(config.y + 16 + offsetY);

    title.setColor(titleColor);
  };

  if (!disabled) {
    let isPressed = false;
    let isLocked = false;

    zone.setInteractive({
      useHandCursor: true,
    });

    zone.on('pointerover', () => {
      if (isPressed || isLocked) {
        return;
      }

      redrawButton(hoverColor, 1, 0.95, titleHoverColor);
    });

    zone.on('pointerout', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      redrawButton(bgColor, alpha, strokeAlpha, textColor);
    });

    zone.on('pointerdown', () => {
      if (isLocked) {
        return;
      }

      isPressed = true;
      redrawButton(pressedColor, 0.96, 1, titleHoverColor, 1);
    });

    zone.on('pointerup', () => {
      if (!isPressed || isLocked) {
        return;
      }

      isPressed = false;
      isLocked = true;

      redrawButton(hoverColor, 1, 1, titleHoverColor);

      this.time.delayedCall(40, () => {
        config.onClick();
      });
    });

    zone.on('pointerupoutside', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      redrawButton(bgColor, alpha, strokeAlpha, textColor);
    });

    zone.on('pointercancel', () => {
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
  const race = player.raceId ? getRaceById(player.raceId) : undefined;

  if (race?.activeName) {
    return race.activeName;
  }

  return 'Навык';
}

private getRaceSkillEnergyCost() {
  if (player.raceId === 'human') return 3;
  if (player.raceId === 'tainted_halfblood') return 2;
  if (player.raceId === 'stoneborn') return 2;
  if (player.raceId === 'night_elf') return 3;
  if (player.raceId === 'goblin') return 3;
  if (player.raceId === 'demon') return 2;

  return 2;
}

private getRaceSkillCooldownTurns() {
  if (player.raceId === 'human') return 4;
  if (player.raceId === 'tainted_halfblood') return 3;
  if (player.raceId === 'stoneborn') return 3;
  if (player.raceId === 'night_elf') return 4;
  if (player.raceId === 'goblin') return 4;
  if (player.raceId === 'demon') return 3;

  return 3;
}


private setRaceSkillCooldown() {
  this.raceSkillCooldown = this.getRaceSkillCooldownTurns();
  this.raceSkillCooldownJustApplied = true;
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

  this.prepareFullEnergySkillTreeBonus();

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
  this.setRaceSkillCooldown();

  const stats = this.getBattleStats();
  const hpRatio = stats.maxHp > 0 ? player.hp / stats.maxHp : 1;

  if (hpRatio <= 0.25) {
    this.humanBattleFocusDamageBonus = 0.25;
    this.humanBattleFocusDefenseBonus = 0.20;
  } else if (hpRatio <= 0.5) {
    this.humanBattleFocusDamageBonus = 0.20;
    this.humanBattleFocusDefenseBonus = 0.15;
  } else {
    this.humanBattleFocusDamageBonus = 0.15;
    this.humanBattleFocusDefenseBonus = 0.10;
  }

  this.humanBattleFocusTurns = 3;

  const damagePercent = Math.round(this.humanBattleFocusDamageBonus * 100);
  const defensePercent = Math.round(this.humanBattleFocusDefenseBonus * 100);

  const playerActionText =
    `Боевой настрой.\n` +
    `На 3 хода: +${damagePercent}% к урону и +${defensePercent}% к защите.`;

  this.logText.setText(playerActionText);
  this.updateTexts();
  this.createActionButtons();

  this.time.delayedCall(450, () => {
    this.enemyTurn(playerActionText, false);
  });
}

private handleTaintedSkill() {
  this.isBusy = true;

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.setRaceSkillCooldown();

  const stats = this.getBattleStats();

  const hpCost = Math.max(1, Math.floor(stats.maxHp * 0.05));
  player.hp = Math.max(1, player.hp - hpCost);
  this.taintedHpCost += hpCost;

  const lowHp = player.hp / stats.maxHp <= 0.35;

  const damage = this.calculateDamage({
    baseDamage: stats.attack,
    multiplier: lowHp ? 1.7 : 1.45,
    varianceMin: 0,
    varianceMax: 5,
    isSkill: true,
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
  this.setRaceSkillCooldown();
  this.stoneQuartzSpikesTurns = 2;

  const playerActionText =
    `Кварцевые шипы.\n` +
    `На 2 хода: +10% к защите и отражение 30% полученного урона.`;

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
  this.setRaceSkillCooldown();
  this.nightElfShadowStepTurns = 3;

  const playerActionText =
    `Шаг в тень.\n` +
    `На 3 хода шанс уклониться от атаки врага становится не ниже 50%.`;

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
  this.setRaceSkillCooldown();
  this.goblinGreedyMarkTurns = 3;

  const playerActionText =
    `Воровская метка.\n` +
    `Враг помечен на 3 хода. Он получает на 20% больше урона от гоблина.\n` +
    `Если враг умрёт под меткой: +25% золота и 10% шанс дополнительного материала.`;

  this.logText.setText(playerActionText);
  this.updateTexts();
  this.createActionButtons();

  this.time.delayedCall(450, () => {
    this.enemyTurn(playerActionText, false);
  });
}

private handleDemonSkill() {
  this.isBusy = true;

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.setRaceSkillCooldown();

  const stats = this.getBattleStats();

  const hpCost = Math.max(1, Math.floor(stats.maxHp * 0.08));
  player.hp = Math.max(1, player.hp - hpCost);
  this.demonHpSpentByHellfire += hpCost;

  const lowHp = player.hp / stats.maxHp <= 0.35;

  const damage = this.calculateDamage({
    baseDamage: stats.attack,
    multiplier: lowHp ? 2.0 : 1.6,
    varianceMin: 0,
    varianceMax: 5,
    isSkill: true,
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
    this.prepareFullEnergySkillTreeBonus();

    player.energy -= cost;

    const stats = this.getBattleStats();

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: 1.65,
      varianceMin: -1,
      varianceMax: 5,
      isSkill: true,
    });

    const isCrit = this.rollPlayerCrit(stats.critChance);
    const finalDamage = isCrit ? Math.floor(damage * this.getPlayerCritMultiplier(1.5)) : damage;
    const treeCritText = this.applyCriticalTreeEffects(isCrit, finalDamage);

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Критический сильный удар! Ты наносишь ${finalDamage} урона.${treeCritText}`
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

    const restoredNow = restoreEnergy(player, 1);
    const playerActionText = `Ты занял защитную стойку.\n${this.createEnergyRestoreText(restoredNow)}`;

    this.logText.setText(playerActionText);
    this.updateTexts();

    this.time.delayedCall(450, () => {
      this.enemyTurn(playerActionText, true);
    });
  }

  private createEnergyRestoreText(amount: number) {
    return amount > 0
      ? `Энергия восстановлена на ${amount}.`
      : 'Энергия уже полная.';
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
    const humanPassiveDodgeMultiplier =
      player.raceId === 'human' && this.humanPassiveActivated
        ? 1.02
        : 1;

    const dodgeChance =
      player.raceId === 'stoneborn'
        ? baseDodgeChance * 0.7 * humanPassiveDodgeMultiplier
        : baseDodgeChance * humanPassiveDodgeMultiplier;

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

    if (player.raceId === 'tainted_halfblood') {
      const lowHp = player.hp / maxHp <= 0.35;

      if (lowHp) {
        bonus.critChance += 0.08;
      }
    }

    return bonus;
  }

  private getRaceDamageMultiplier() {
    let multiplier = 1;
    const stats = getPlayerStats(player);
    const maxHp = Math.max(1, stats.maxHp || player.maxHp || 1);

    if (player.raceId === 'human') {
      if (this.humanPassiveActivated) {
        multiplier *= 1.02;
      }

      if (this.humanBattleFocusTurns > 0) {
        multiplier *= 1 + this.humanBattleFocusDamageBonus;
      }
    }

    if (player.raceId === 'tainted_halfblood' && player.hp / maxHp <= 0.35) {
      multiplier *= 1.03;
    }

    if (player.raceId === 'goblin' && this.goblinGreedyMarkTurns > 0) {
      multiplier *= 1.2;
    }

    if (player.raceId === 'demon' && this.demonRageStacks > 0) {
      multiplier *= 1 + this.demonRageStacks * 0.01;
    }

    return multiplier;
  }

  private getRaceIncomingDamageMultiplier() {
    let multiplier = 1;

    if (player.raceId === 'human') {
      if (this.humanPassiveActivated) {
        multiplier *= 0.98;
      }

      if (this.humanBattleFocusTurns > 0) {
        multiplier *= 1 - this.humanBattleFocusDefenseBonus;
      }
    }

    if (player.raceId === 'stoneborn') {
      multiplier *= 0.98;

      if (this.stoneQuartzSpikesTurns > 0) {
        multiplier *= 0.9;
      }
    }

    return multiplier;
  }

  private consumeRaceAttackEffectText() {
    const text = this.raceAttackEffectText;
    this.raceAttackEffectText = '';

    return text;
  }

  private tickGoblinMarkAfterPlayerAttack() {
    if (player.raceId !== 'goblin' || this.goblinGreedyMarkTurns <= 0) {
      return '';
    }

    this.goblinGreedyMarkTurns = Math.max(0, this.goblinGreedyMarkTurns - 1);

    return this.goblinGreedyMarkTurns > 0
      ? `\nВоровская метка: осталось ${this.goblinGreedyMarkTurns} х.`
      : '\nВоровская метка погасла.';
  }

  private tickRaceTurnEffectsAfterEnemyAction() {
    if (this.humanBattleFocusTurns > 0) {
      this.humanBattleFocusTurns = Math.max(0, this.humanBattleFocusTurns - 1);

      if (this.humanBattleFocusTurns === 0) {
        this.humanBattleFocusDamageBonus = 0;
        this.humanBattleFocusDefenseBonus = 0;
      }
    }

    if (this.stoneQuartzSpikesTurns > 0) {
      this.stoneQuartzSpikesTurns = Math.max(0, this.stoneQuartzSpikesTurns - 1);
    }

    if (this.nightElfShadowStepTurns > 0) {
      this.nightElfShadowStepTurns = Math.max(0, this.nightElfShadowStepTurns - 1);
    }
  }


  private getTreeLevel(branchId: CharacterTreeBranchId) {
    const treePlayer = player as BattleTreePlayer;

    return treePlayer.characterTree?.[branchId] ?? 0;
  }

  private hasTreeLevel(branchId: CharacterTreeBranchId, level: number) {
    return this.getTreeLevel(branchId) >= level;
  }

  private applyStartOfBattleTreeEffects() {
    if (!this.hasTreeLevel('energy', 4)) {
      return;
    }

    const stats = getPlayerStats(player);

    if (player.energy < stats.maxEnergy) {
      player.energy = Math.min(stats.maxEnergy, player.energy + 1);
    }
  }

  private prepareFullEnergySkillTreeBonus() {
    if (!this.hasTreeLevel('energy', 6)) {
      this.treeFullEnergySkillBonusPending = false;
      return;
    }

    const stats = this.getBattleStats();
    this.treeFullEnergySkillBonusPending = player.energy >= stats.maxEnergy;
  }

  private rollPlayerCrit(chance: number) {
    if (this.treeGuaranteedCrit) {
      this.treeGuaranteedCrit = false;
      return true;
    }

    return Math.random() < chance;
  }

  private getPlayerCritMultiplier(defaultMultiplier: number) {
    return this.hasTreeLevel('crit', 2)
      ? Math.max(defaultMultiplier, 1.6)
      : defaultMultiplier;
  }

  private applyCriticalTreeEffects(isCrit: boolean, damage: number) {
    if (!isCrit) {
      return '';
    }

    const lines: string[] = [];

    if (this.hasTreeLevel('crit', 4) && Math.random() < 0.25) {
      const bleedDamage = Math.max(1, Math.floor(damage * 0.18));
      this.enemyBleedTurns = Math.max(this.enemyBleedTurns, 2);
      this.enemyBleedDamage = Math.max(this.enemyBleedDamage, bleedDamage);
      lines.push('Критическая рана вызвала кровотечение.');
    }

    if (this.hasTreeLevel('crit', 6)) {
      this.treeNextHitDamageBonus = Math.max(this.treeNextHitDamageBonus, 0.17);
      lines.push('Серия ударов: следующий удар будет сильнее.');
    }

    return lines.length > 0
      ? `\n${lines.join('\n')}`
      : '';
  }

  private resolveTreeSurvivalAfterDamage() {
    const stats = getPlayerStats(player);
    const lines: string[] = [];

    if (player.hp <= 0 && this.hasTreeLevel('hp', 20) && !this.treeUnbreakableUsed) {
      this.treeUnbreakableUsed = true;
      player.hp = 1;
      lines.push('Несломленный: смертельный удар оставил героя с 1 HP.');
    }

    if (
      player.hp > 0 &&
      this.hasTreeLevel('hp', 10) &&
      !this.treeLastBreathUsed &&
      stats.maxHp > 0 &&
      player.hp / stats.maxHp <= 0.2
    ) {
      this.treeLastBreathUsed = true;
      const heal = Math.max(1, Math.floor(stats.maxHp * 0.08));
      player.hp = Math.min(stats.maxHp, player.hp + heal);
      lines.push(`Последний вдох: восстановлено ${heal} HP.`);
    }

    return lines.length > 0
      ? `\n${lines.join('\n')}`
      : '';
  }

  private applyDefenseTreeDamageReduction(damage: number, isDefending: boolean) {
    let finalDamage = damage;
    const lines: string[] = [];

    if (this.hasTreeLevel('defense', 5)) {
      finalDamage = Math.max(1, Math.floor(finalDamage * 0.97));
    }

    if (isDefending && this.hasTreeLevel('defense', 10)) {
      finalDamage = Math.max(1, Math.floor(finalDamage * 0.9));
      lines.push('Стойкость дополнительно смягчила удар.');
    }

    if (this.hasTreeLevel('defense', 15) && !this.treeFirstIncomingHitReduced) {
      finalDamage = Math.max(1, Math.floor(finalDamage * 0.6));
      this.treeFirstIncomingHitReduced = true;
      lines.push('Каменная стойка ослабила первый удар врага.');
    }

    if (this.hasTreeLevel('defense', 20) && Math.random() < 0.12) {
      finalDamage = Math.max(1, Math.floor(finalDamage * 0.5));
      lines.push('Глухой блок уменьшил входящий урон вдвое.');
    }

    return {
      damage: finalDamage,
      text: lines.length > 0 ? `\n${lines.join('\n')}` : '',
    };
  }

  private handleTreeDodgeEffects() {
    const lines: string[] = [];

    if (this.hasTreeLevel('agility', 4)) {
      restoreEnergy(player, 1);
      lines.push('Лёгкий шаг: дополнительно восстановлена 1 энергия.');
    }

    if (this.hasTreeLevel('agility', 6)) {
      this.treeDodgeStreak += 1;

      if (this.treeDodgeStreak >= 2) {
        this.treeDodgeStreak = 0;
        this.treeGuaranteedCrit = true;
        lines.push('Танец клинков: следующая атака гарантированно критует.');
      }
    }

    return lines.length > 0
      ? `\n${lines.join('\n')}`
      : '';
  }

  private calculateDamage(config: {
    baseDamage: number;
    multiplier: number;
    varianceMin: number;
    varianceMax: number;
    isBasicAttack?: boolean;
    isSkill?: boolean;
  }) {
    let multiplier = config.multiplier;

    if (config.isBasicAttack && this.hasTreeLevel('attack', 5)) {
      multiplier *= 1.05;
    }

    if (this.hasTreeLevel('attack', 15) && this.enemy.maxHp > 0 && this.enemy.hp / this.enemy.maxHp < 0.3) {
      multiplier *= 1.12;
    }

    if (this.hasTreeLevel('attack', 20) && !this.treeFirstPlayerHitBonusUsed) {
      multiplier *= 1.25;
      this.treeFirstPlayerHitBonusUsed = true;
    }

    if (this.treeNextHitDamageBonus > 0) {
      multiplier *= 1 + this.treeNextHitDamageBonus;
      this.treeNextHitDamageBonus = 0;
    }

    if (config.isSkill && this.treeFullEnergySkillBonusPending) {
      multiplier *= 1.1;
      this.treeFullEnergySkillBonusPending = false;
    }

    if (this.nightElfShadowDanceActive) {
      multiplier *= 1.25;
      this.nightElfShadowDanceActive = false;

      const bleedDamage = Math.max(1, Math.floor(config.baseDamage * 0.22));
      this.enemyBleedTurns = Math.max(this.enemyBleedTurns, 2);
      this.enemyBleedDamage = Math.max(this.enemyBleedDamage, bleedDamage);
      this.raceAttackEffectText =
        '\nТанец теней: удар усилен на 25% и накладывает кровотечение.';
    }

    multiplier *= this.getRaceDamageMultiplier();
    multiplier *= this.getEnemyWeaknessDamageMultiplier();

    if (this.hasPlayerDebuff('weakness')) {
      const weakness = this.getPlayerDebuff('weakness');
      multiplier *= 1 - ((weakness?.power ?? 20) / 100);
    }

    const rawDamage =
      config.baseDamage * multiplier +
      Phaser.Math.Between(config.varianceMin, config.varianceMax);

    const effectiveEnemyDefense = this.enemy.defense * (this.hasTreeLevel('attack', 10) ? 0.9 : 1);
    const reducedDamage = rawDamage - effectiveEnemyDefense * 0.45;

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
      const damage = this.hasTreeLevel('hp', 15)
        ? Math.max(1, Math.floor(debuff.power * 0.75))
        : debuff.power;

      totalDamage += damage;
      lines.push(`${debuff.name}: -${damage} HP`);
    }
  });

  if (totalDamage <= 0) {
    return '';
  }

  player.hp = Math.max(0, player.hp - totalDamage);
  const survivalText = this.resolveTreeSurvivalAfterDamage();

  this.showFloatingText(
    this.playerCard.x,
    this.playerCard.y - 55,
    `-${totalDamage}`,
    '#9f7aea'
  );

  this.animateHit(this.playerCard);
  this.updateTexts();

  return `${lines.join('\n')}${survivalText}`;
}

private applyDebuffDamageAndCheckDeath() {
  const debuffText = this.applyDebuffDamageBeforePlayerAction();

  if (!debuffText) {
    return false;
  }

  if (player.hp <= 0) {
    this.handlePlayerDeath(`${debuffText}

Ты пал от наложенных эффектов.`);

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
    const raceEffectText = this.consumeRaceAttackEffectText();

    if (raceEffectText) {
      playerActionText += raceEffectText;
    }

    this.updateTexts();
    this.createActionButtons();

    if (this.enemy.hp <= 0) {
      this.handleVictory(playerActionText);
      return;
    }

    const goblinMarkText = this.tickGoblinMarkAfterPlayerAttack();

    if (goblinMarkText) {
      playerActionText += goblinMarkText;
    }

    if (options?.skipEnemyTurn) {
      restoreEnergy(player, 1);

      this.logText.setText(
        `${playerActionText}\n\nВраг оглушён и пропускает ход.\nЭнергия восстановлена на 1.`
      );

      this.updateTexts();

      this.time.delayedCall(650, () => {
        this.tickRaceSkillCooldown();
        this.tickPotionCooldown();
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

  private createBattleBackground(isBoss = false) {
    const { width, height } = this.scale;
    const layout = this.getBattleLayout();

    const floor = gameState.floorRun.currentFloor || 1;
    const theme = getCryptDepthTheme(floor);

    this.add.rectangle(width / 2, height / 2, width, height, theme.background, 1).setDepth(0);

    const arenaWidth = Math.min(width - layout.safeX * 2, 680);
    const arenaHeight = Math.max(420, layout.playerY - layout.safeTop + 130);
    const arenaY = layout.safeTop + arenaHeight / 2 + 56;

    this.add.circle(width / 2, layout.enemyY - 40, arenaWidth * 0.42, isBoss ? 0xff2f2f : theme.glow, isBoss ? 0.22 : 0.16).setDepth(0);
    this.add.circle(width / 2, layout.enemyY - 20, arenaWidth * 0.26, theme.fog, 0.11).setDepth(0);
    this.add.circle(width / 2, layout.enemyY, arenaWidth * 0.13, isBoss ? 0xff6b35 : theme.accent, isBoss ? 0.12 : 0.07).setDepth(0);

    this.add.rectangle(width / 2, arenaY, arenaWidth, arenaHeight, 0x0b0807, 0.92)
      .setStrokeStyle(2, isBoss ? 0x6b1d12 : 0x332013, isBoss ? 0.9 : 0.7)
      .setDepth(1);

    this.add.ellipse(width / 2, layout.enemyY - 18, arenaWidth * 0.72, 270, isBoss ? 0x220907 : 0x120b08, 0.78)
      .setStrokeStyle(2, isBoss ? 0x6b1d12 : 0x2e1a10, isBoss ? 0.65 : 0.45)
      .setDepth(1);

    this.add.ellipse(width / 2, layout.enemyY + 4, arenaWidth * 0.48, 190, 0x080605, 0.88)
      .setStrokeStyle(2, isBoss ? 0x4a160f : 0x28170f, 0.38)
      .setDepth(1);

    const brickRows = [
      { y: layout.enemyY - 92, count: 5, offset: 0 },
      { y: layout.enemyY - 48, count: 6, offset: -38 },
      { y: layout.enemyY - 4, count: 5, offset: 0 },
      { y: layout.enemyY + 40, count: 6, offset: -38 },
    ];

    brickRows.forEach(row => {
      const brickWidth = Math.min(88, arenaWidth / 6.5);
      const brickHeight = 30;

      for (let i = 0; i < row.count; i += 1) {
        const x = width / 2 - ((row.count - 1) * brickWidth) / 2 + i * brickWidth + row.offset;

        this.add.rectangle(x, row.y, brickWidth - 6, brickHeight, isBoss ? 0x1d0b08 : 0x120d0a, 0.42)
          .setStrokeStyle(1, isBoss ? 0x4a160f : 0x2a1b12, 0.28)
          .setDepth(2);
      }
    });

    const columnX = Math.min(86, layout.safeX + 54);
    this.add.rectangle(columnX, arenaY, 52, arenaHeight, 0x0e0a08, 0.88)
      .setStrokeStyle(2, isBoss ? 0x4a160f : 0x2a1a10, 0.55)
      .setDepth(2);

    this.add.rectangle(width - columnX, arenaY, 52, arenaHeight, 0x0e0a08, 0.88)
      .setStrokeStyle(2, isBoss ? 0x4a160f : 0x2a1a10, 0.55)
      .setDepth(2);

    const floorTopY = layout.playerY + 52;
    const floorBottomY = Math.min(height - 250, layout.logY - layout.logHeight / 2 - 8);

    this.add.rectangle(width / 2, (floorTopY + floorBottomY) / 2, arenaWidth, Math.max(90, floorBottomY - floorTopY), 0x0d0907, 0.96)
      .setStrokeStyle(2, isBoss ? 0x5c1d12 : 0x372114, 0.7)
      .setDepth(2);

    for (let i = 0; i < 9; i += 1) {
      const xTop = layout.safeX + 80 + i * ((width - layout.safeX * 2 - 160) / 8);
      const xBottom = layout.safeX + 35 + i * ((width - layout.safeX * 2 - 70) / 8);

      this.add.line(0, 0, xTop, floorTopY, xBottom, floorBottomY, isBoss ? 0x4a160f : 0x2a1a10, isBoss ? 0.45 : 0.34)
        .setOrigin(0, 0)
        .setDepth(3);
    }

    for (let i = 0; i < 5; i += 1) {
      const y = floorTopY + i * ((floorBottomY - floorTopY) / 4);

      this.add.line(0, 0, layout.safeX + 54, y, width - layout.safeX - 54, y, isBoss ? 0x4a160f : 0x2a1a10, 0.3)
        .setOrigin(0, 0)
        .setDepth(3);
    }

    for (let i = 0; i < 16; i += 1) {
      const x = layout.safeX + 28 + (i % 8) * ((width - layout.safeX * 2 - 56) / 7);
      const y = layout.safeTop + 120 + Math.floor(i / 8) * 118 + (i % 3) * 18;
      const radius = 36 + (i % 4) * 14;

      this.add.circle(x, y, radius, isBoss ? 0xff6b35 : 0x8a6a48, isBoss ? 0.028 : 0.02).setDepth(1);
    }

    for (let i = 0; i < 48; i += 1) {
      const x = layout.safeX + 14 + (i * 37) % Math.max(1, width - layout.safeX * 2 - 28);
      const y = layout.safeTop + 58 + (i * 61) % Math.max(1, height - layout.safeTop - layout.safeBottom - 260);
      const size = 1 + (i % 3);
      const alpha = 0.035 + (i % 5) * 0.011;

      this.add.circle(x, y, size, isBoss && i % 2 === 0 ? 0xff6b35 : 0xd8b56d, alpha).setDepth(4);
    }

    if (isBoss) {
      this.add.rectangle(width / 2, height / 2, width, height, 0x3a0505, 0.14).setDepth(5);
      this.add.rectangle(width / 2, layout.enemyY + 18, arenaWidth - 46, 3, 0xff6b35, 0.34).setDepth(5);
    }

    this.add.rectangle(width / 2, height - 150, width, 330, 0x040302, 0.6).setDepth(6);
    this.add.rectangle(24, height / 2, 48, height, 0x000000, 0.32).setDepth(6);
    this.add.rectangle(width - 24, height / 2, 48, height, 0x000000, 0.32).setDepth(6);
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

    if (hpPercent > 0.3) {
      return '';
    }

    this.humanPassiveActivated = true;

    return '\n\nПассивный навык сработал: Воля к борьбе.\nДо конца боя: +2% к атаке, защите и ловкости.';
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
    const layout = this.getBattleLayout();
    const cardWidth = Math.min(layout.contentWidth, isBoss ? 660 : 620);
    const cardHeight = isEnemy ? (isBoss ? 248 : 202) : 214;
    const barWidth = Math.max(260, cardWidth - 100);

    const container = this.add.container(x, y).setDepth(isEnemy ? 18 : 19);

    const strokeColor = isEnemy
      ? isBoss
        ? 0xff6b35
        : 0x8a2f2f
      : UI.colors.goldDark;

    const titleColor = isEnemy ? (isBoss ? '#ffb36b' : UI.colors.red) : UI.colors.goldText;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.36);
    shadow.fillRoundedRect(-cardWidth / 2, -cardHeight / 2 + 8, cardWidth, cardHeight, 30);

    const bg = this.add.graphics();
    bg.fillStyle(color, isBoss ? 0.98 : 0.95);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 30);
    bg.lineStyle(isBoss ? 4 : 2, strokeColor, isBoss ? 0.95 : 0.62);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 30);

    const topGlow = this.add.circle(0, -cardHeight / 2 + 40, cardWidth * 0.3, isBoss ? 0xff6b35 : strokeColor, isBoss ? 0.11 : 0.045);

    const sideAccent = this.add.rectangle(
      -cardWidth / 2 + 7,
      0,
      9,
      cardHeight - 24,
      strokeColor,
      isBoss ? 0.9 : 0.56
    );

    const iconX = -cardWidth / 2 + 70;
    const titleX = -cardWidth / 2 + 124;

    const currentRoom = getCurrentRoom();

    const isDangerTooltip =
      currentRoom?.type === 'boss' ||
      currentRoom?.type === 'tier_boss' ||
      Boolean(this.enemy.debuffOnHit);

    const iconBg = this.add.circle(iconX, -cardHeight / 2 + 58, isBoss ? 43 : 36, isEnemy ? 0x2a1010 : 0x2a1d13, 1)
      .setStrokeStyle(2, strokeColor, 0.78);

    const iconText = this.add.text(iconX, -cardHeight / 2 + 58, icon, {
      fontFamily: UI.font.body,
      fontSize: isBoss ? '34px' : '29px',
      color: isEnemy ? (isBoss ? '#ffb36b' : UI.colors.red) : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    const nameTextY = isEnemy ? -cardHeight / 2 + 22 : -cardHeight / 2 + 38;
    const nameTextMaxLines = isEnemy ? 2 : 1;
    const nameTextWidth = isEnemy ? cardWidth - 245 : cardWidth - 190;

    const nameText = this.add.text(titleX, nameTextY, name, {
      fontFamily: UI.font.title,
      fontSize: isEnemy
        ? isBoss
          ? layout.compact ? '21px' : '24px'
          : layout.compact ? '19px' : '22px'
        : layout.compact ? '21px' : '24px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: nameTextWidth,
        useAdvancedWrap: true,
      },
      maxLines: nameTextMaxLines,
      lineSpacing: -3,
    }).setOrigin(0, isEnemy ? 0 : 0.5);

    const hpText = this.add.text(titleX, isEnemy ? -cardHeight / 2 + 86 : -cardHeight / 2 + 75, '', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '15px' : '17px',
      color: isDangerTooltip ? '#ffd0c2' : UI.colors.text,
      wordWrap: {
        width: cardWidth - 190,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const extraText = this.add.text(titleX, isEnemy ? -cardHeight / 2 + 116 : -cardHeight / 2 + 106, '', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '13px' : '15px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: cardWidth - 190,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const hpBarY = isEnemy ? cardHeight / 2 - 54 : cardHeight / 2 - 66;
    const energyBarY = hpBarY + 22;

    const barBack = this.add.rectangle(0, hpBarY, barWidth, 12, 0x050505, 0.92);

    const hpBar = this.add.rectangle(
      -barWidth / 2,
      hpBarY,
      barWidth,
      12,
      isEnemy ? 0xff6b6b : 0x75d184,
      0.98
    ).setOrigin(0, 0.5);

    const hpBarFrame = this.add.rectangle(0, hpBarY, barWidth, 12)
      .setStrokeStyle(1, 0x000000, 0.85);

    const energyBack = this.add.rectangle(
      0,
      energyBarY,
      barWidth,
      8,
      0x050505,
      isEnemy ? 0 : 0.92
    );

    const energyBar = this.add.rectangle(
      -barWidth / 2,
      energyBarY,
      barWidth,
      8,
      0x70a6ff,
      isEnemy ? 0 : 0.95
    ).setOrigin(0, 0.5);

    container.add([
      shadow,
      bg,
      topGlow,
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
      const bossBanner = this.add.graphics();
      bossBanner.fillStyle(0x3a0907, 0.96);
      bossBanner.fillRoundedRect(-118, -cardHeight / 2 - 20, 236, 36, 16);
      bossBanner.lineStyle(2, 0xff6b35, 0.92);
      bossBanner.strokeRoundedRect(-118, -cardHeight / 2 - 20, 236, 36, 16);

      const bossLabel = this.add.text(0, -cardHeight / 2 - 2, 'БОСС  •  СМЕРТЕЛЬНАЯ УГРОЗА', {
        fontFamily: UI.font.title,
        fontSize: '14px',
        color: '#ffb36b',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: {
          width: 220,
        },
        maxLines: 1,
      }).setOrigin(0.5);

      const leftRune = this.add.text(-cardWidth / 2 + 36, 0, '♜', {
        fontFamily: UI.font.body,
        fontSize: '34px',
        color: '#ff6b35',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0.42);

      const rightRune = this.add.text(cardWidth / 2 - 36, 0, '♜', {
        fontFamily: UI.font.body,
        fontSize: '34px',
        color: '#ff6b35',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0.42);

      container.add([bossBanner, bossLabel, leftRune, rightRune]);

      this.tweens.add({
        targets: [bossLabel, leftRune, rightRune],
        alpha: 0.58,
        duration: 680,
        yoyo: true,
        repeat: -1,
      });
    }

    if (isEnemy) {
      this.enemyHpText = hpText;
      this.enemyHpBar = hpBar;
      this.enemyHpBarMaxWidth = barWidth;

      extraText.setText(`АТК ${this.enemy.attack}  •  ЗАЩ ${this.enemy.defense}`);

      const hintText = this.add.text(cardWidth / 2 - 24, -cardHeight / 2 + 25, 'нажми: опасность', {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: isBoss ? '#ff9a66' : '#ff6b6b',
        align: 'right',
        wordWrap: {
          width: 126,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setAlpha(0.74);

      this.enemyHoverZone = this.add.zone(0, 0, cardWidth, cardHeight)
        .setInteractive({ useHandCursor: true });

      this.enemyHoverZone.on('pointerup', () => {
        this.showEnemyTooltip();
      });

      container.add([hintText, this.enemyHoverZone]);
    } else {
      this.playerHpText = hpText;
      this.playerHpBar = hpBar;
      this.playerHpBarMaxWidth = barWidth;
      this.energyBar = energyBar;
      this.energyBarMaxWidth = barWidth;
      this.energyText = extraText;

      this.playerDebuffText = this.add.text(titleX, cardHeight / 2 - 29, '', {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: '#c084fc',
        wordWrap: {
          width: cardWidth - 178,
        },
        maxLines: 1,
        lineSpacing: 2,
      }).setOrigin(0, 0.5);

      const stats = this.getBattleStats();

      this.potionText = this.add.text(cardWidth / 2 - 24, -4, `Зелья: ${player.potions}`, {
        fontFamily: UI.font.body,
        fontSize: layout.compact ? '13px' : '15px',
        color: UI.colors.textMuted,
        align: 'right',
        wordWrap: {
          width: 120,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5);

      const statsText = this.add.text(cardWidth / 2 - 24, -48, [
        `АТК ${stats.attack}`,
        `ЗАЩ ${stats.defense}`,
        `КРИТ ${Math.round(stats.critChance * 100)}%`,
      ].join('\n'), {
        fontFamily: UI.font.body,
        fontSize: layout.compact ? '13px' : '15px',
        color: UI.colors.textMuted,
        align: 'right',
        lineSpacing: 4,
        wordWrap: {
          width: 120,
        },
        maxLines: 3,
      }).setOrigin(1, 0.5);

      const tapHint = this.add.text(cardWidth / 2 - 24, cardHeight / 2 - 28, 'нажми: сведения', {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: UI.colors.textMuted,
        align: 'right',
        wordWrap: {
          width: 120,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setAlpha(0.74);

      this.playerHoverZone = this.add.zone(0, 0, cardWidth, cardHeight)
        .setInteractive({ useHandCursor: true });

      this.playerHoverZone.on('pointerup', () => {
        this.showPlayerTooltip();
      });

      container.add([this.playerDebuffText, this.potionText, statsText, tapHint, this.playerHoverZone]);
    }

    return container;
  }


  private hideTooltip() {
    this.tooltipObjects.forEach(object => object.destroy());
    this.tooltipObjects = [];
  }

  private showInfoModal(title: string, description: string, accentColor = UI.colors.gold) {
    this.hideTooltip();

    const { width, height } = this.scale;
    const modalWidth = Math.min(width - 44, 580);
    const modalHeight = Math.min(height - 220, 330);
    const centerX = width / 2;
    const centerY = height / 2;

    const overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.68)
      .setDepth(500)
      .setInteractive();

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.56);
    shadow.fillRoundedRect(
      centerX - modalWidth / 2,
      centerY - modalHeight / 2 + 8,
      modalWidth,
      modalHeight,
      28
    );
    shadow.setDepth(501);

    const bg = this.add.graphics();
    bg.fillStyle(0x120d0a, 0.985);
    bg.fillRoundedRect(
      centerX - modalWidth / 2,
      centerY - modalHeight / 2,
      modalWidth,
      modalHeight,
      28
    );
    bg.lineStyle(3, accentColor, 0.9);
    bg.strokeRoundedRect(
      centerX - modalWidth / 2,
      centerY - modalHeight / 2,
      modalWidth,
      modalHeight,
      28
    );
    bg.setDepth(502);

    const glow = this.add.circle(centerX, centerY - modalHeight / 2 + 42, modalWidth * 0.28, accentColor, 0.075)
      .setDepth(503);

    const titleText = this.add.text(centerX, centerY - modalHeight / 2 + 46, title, {
      fontFamily: UI.font.title,
      fontSize: '24px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: modalWidth - 48,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(504);

    const descriptionText = this.add.text(centerX, centerY - 12, description, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 6,
      wordWrap: {
        width: modalWidth - 58,
        useAdvancedWrap: true,
      },
      maxLines: 7,
    }).setOrigin(0.5).setDepth(504);

    const closeText = this.add.text(centerX, centerY + modalHeight / 2 - 38, 'Нажми, чтобы закрыть', {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: modalWidth - 48,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(504);

    const close = () => {
      this.tooltipObjects.forEach(object => object.destroy());
      this.tooltipObjects = [];
    };

    overlay.on('pointerup', close);

    const closeZone = this.add.zone(
      centerX,
      centerY + modalHeight / 2 - 38,
      modalWidth - 90,
      38
    )
      .setDepth(505)
      .setInteractive({ useHandCursor: true });

    closeZone.on('pointerup', close);

    this.tooltipObjects.push(overlay, shadow, bg, glow, titleText, descriptionText, closeText, closeZone);
  }

  private showEnemyTooltip() {
  const weaknessText =
    this.enemy.weaknesses && this.enemy.weaknesses.length > 0
      ? this.enemy.weaknesses.map(tag => this.getEnemyTagText(tag)).join(', ')
      : 'нет явных слабостей';

  const resistanceText =
    this.enemy.resistances && this.enemy.resistances.length > 0
      ? this.enemy.resistances.map(tag => this.getEnemyTagText(tag)).join(', ')
      : 'нет сопротивлений';

  const debuff = this.enemy.debuffOnHit;

  const debuffText = debuff
    ? `${this.getDebuffIcon(debuff.id)} ${debuff.name}\n${this.getDebuffShortDescription(debuff.id, debuff.power)}\nШанс наложения: ${Math.round(debuff.chance * 100)}% • Длительность: ${debuff.duration} х.`
    : 'Враг не накладывает эффект при обычном ударе.';

  const dangerText = this.isBossBattle
    ? 'УРОВЕНЬ УГРОЗЫ: БОСС. Ошибка может стоить забега.'
    : 'УРОВЕНЬ УГРОЗЫ: обычный противник.';

  const description =
    `${dangerText}\n\n` +
    `Боевые параметры:\n` +
    `АТК ${this.enemy.attack}  •  ЗАЩ ${this.enemy.defense}  •  HP ${this.enemy.hp}/${this.enemy.maxHp}\n\n` +
    `Слабости:\n${weaknessText}\n\n` +
    `Сопротивления:\n${resistanceText}\n\n` +
    `Эффект при ударе:\n${debuffText}`;

  this.showLargeTooltip(
    this.enemyCard.x,
    this.enemyCard.y + 82,
    this.isBossBattle ? `⚠ ${this.enemy.name}` : this.enemy.name,
    description,
    0xff6b6b,
    true
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

  const debuffSection = this.createPlayerTooltipDebuffSection();

  const description =
    `Раса: ${raceName}\n` +
    `${raceDescription}\n\n` +
    `${debuffSection}\n` +
    `Пассивка:\n${passiveText}\n\n` +
    `Активный навык:\n${activeText}\n\n` +
    `Характеристики:\n` +
    `HP: ${player.hp}/${stats.maxHp}  •  Энергия: ${player.energy}/${stats.maxEnergy}\n` +
    `АТК: ${stats.attack}  •  ЗАЩ: ${stats.defense}\n` +
    `Крит: ${Math.round(stats.critChance * 100)}%  •  Уклонение: ${Math.round(stats.dodgeChance * 100)}%`;

  this.showPlayerLargeTooltip(
    this.playerCard.x,
    this.playerCard.y,
    player.name,
    description
  );
}

private createPlayerTooltipDebuffSection() {
  if (this.playerDebuffs.length === 0) {
    return 'Негативные эффекты:\nНет активных дебаффов.\n';
  }

  const debuffLines = this.playerDebuffs.map(debuff => {
    return `${this.getDebuffIcon(debuff.id)} ${debuff.name}: ${this.getDebuffShortDescription(debuff.id, debuff.power)} Осталось: ${debuff.duration} х.`;
  });

  return `Негативные эффекты:\n${debuffLines.join('\n')}\n`;
}


private showPlayerLargeTooltip(_x: number, _y: number, title: string, description: string) {
  this.hideTooltip();

  const safeX = Phaser.Math.Clamp(Math.round(this.scale.width * 0.045), 18, 32);
  const modalWidth = Math.min(this.scale.width - safeX * 2, 620);
  const modalHeight = Math.min(520, this.scale.height - 210);

  const modalX = this.scale.width / 2;
  const modalY = this.scale.height / 2;

  const overlay = this.add.rectangle(
    this.scale.width / 2,
    this.scale.height / 2,
    this.scale.width,
    this.scale.height,
    0x000000,
    0.64
  )
    .setDepth(299)
    .setInteractive();

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.58);
  shadow.fillRoundedRect(
    modalX - modalWidth / 2,
    modalY - modalHeight / 2 + 7,
    modalWidth,
    modalHeight,
    26
  );
  shadow.setDepth(300);

  const bg = this.add.graphics();
  bg.fillStyle(0x10141c, 0.985);
  bg.fillRoundedRect(
    modalX - modalWidth / 2,
    modalY - modalHeight / 2,
    modalWidth,
    modalHeight,
    26
  );
  bg.lineStyle(2, UI.colors.goldDark, 0.9);
  bg.strokeRoundedRect(
    modalX - modalWidth / 2,
    modalY - modalHeight / 2,
    modalWidth,
    modalHeight,
    26
  );
  bg.setDepth(301);

  const titleText = this.add.text(modalX, modalY - modalHeight / 2 + 30, title, {
    fontFamily: UI.font.title,
    fontSize: '23px',
    color: UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 4,
    align: 'center',
    wordWrap: {
      width: modalWidth - 52,
    },
    maxLines: 1,
  }).setOrigin(0.5).setDepth(302);

  const descriptionText = this.add.text(
    modalX - modalWidth / 2 + 24,
    modalY - modalHeight / 2 + 68,
    description,
    {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.text,
      wordWrap: {
        width: modalWidth - 48,
        useAdvancedWrap: true,
      },
      maxLines: 23,
      lineSpacing: 4,
    }
  ).setOrigin(0, 0).setDepth(302);

  const closeHint = this.add.text(modalX, modalY + modalHeight / 2 - 24, 'Нажми затемнение, чтобы закрыть', {
    fontFamily: UI.font.body,
    fontSize: '11px',
    color: UI.colors.textMuted,
    align: 'center',
    wordWrap: {
      width: modalWidth - 52,
    },
    maxLines: 1,
  }).setOrigin(0.5).setDepth(302);

  const close = () => {
    this.hideTooltip();
  };

  overlay.on('pointerup', close);

  const closeZone = this.add.zone(
    modalX,
    modalY + modalHeight / 2 - 24,
    modalWidth - 90,
    38
  )
    .setDepth(303)
    .setInteractive({ useHandCursor: true });

  closeZone.on('pointerup', close);

  this.tooltipObjects.push(overlay, shadow, bg, titleText, descriptionText, closeHint, closeZone);
}

private showLargeTooltip(
  _x: number,
  _y: number,
  title: string,
  description: string,
  accentColor = UI.colors.goldDark,
  danger = false
) {
  this.hideTooltip();

  const safeX = Phaser.Math.Clamp(Math.round(this.scale.width * 0.045), 18, 32);
  const modalWidth = Math.min(this.scale.width - safeX * 2, danger ? 620 : 520);
  const modalHeight = Math.min(danger ? 520 : 360, this.scale.height - 210);

  const modalX = this.scale.width / 2;
  const modalY = this.scale.height / 2;

  const overlay = this.add.rectangle(
    this.scale.width / 2,
    this.scale.height / 2,
    this.scale.width,
    this.scale.height,
    0x000000,
    danger ? 0.68 : 0.58
  )
    .setDepth(299)
    .setInteractive();

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.58);
  shadow.fillRoundedRect(
    modalX - modalWidth / 2,
    modalY - modalHeight / 2 + 7,
    modalWidth,
    modalHeight,
    26
  );
  shadow.setDepth(300);

  const bg = this.add.graphics();
  bg.fillStyle(danger ? 0x1b0706 : 0x100b08, 0.985);
  bg.fillRoundedRect(
    modalX - modalWidth / 2,
    modalY - modalHeight / 2,
    modalWidth,
    modalHeight,
    26
  );
  bg.lineStyle(danger ? 3 : 2, accentColor, danger ? 0.98 : 0.9);
  bg.strokeRoundedRect(
    modalX - modalWidth / 2,
    modalY - modalHeight / 2,
    modalWidth,
    modalHeight,
    26
  );
  bg.setDepth(301);

  const titleText = this.add.text(modalX, modalY - modalHeight / 2 + 32, title, {
    fontFamily: UI.font.title,
    fontSize: danger ? '23px' : '21px',
    color: danger ? '#ff9a66' : UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 4,
    align: 'center',
    wordWrap: {
      width: modalWidth - 52,
    },
    maxLines: 2,
  }).setOrigin(0.5).setDepth(302);

  const descriptionText = this.add.text(
    modalX - modalWidth / 2 + 24,
    modalY - modalHeight / 2 + 82,
    description,
    {
      fontFamily: UI.font.body,
      fontSize: danger ? '13px' : '14px',
      color: danger ? '#ffd0c2' : UI.colors.text,
      wordWrap: {
        width: modalWidth - 48,
        useAdvancedWrap: true,
      },
      maxLines: danger ? 24 : 13,
      lineSpacing: 4,
    }
  ).setOrigin(0, 0).setDepth(302);

  const closeHint = this.add.text(modalX, modalY + modalHeight / 2 - 24, 'Нажми затемнение, чтобы закрыть', {
    fontFamily: UI.font.body,
    fontSize: '11px',
    color: UI.colors.textMuted,
    align: 'center',
    wordWrap: {
      width: modalWidth - 52,
    },
    maxLines: 1,
  }).setOrigin(0.5).setDepth(302);

  const close = () => {
    this.hideTooltip();
  };

  overlay.on('pointerup', close);

  const closeZone = this.add.zone(
    modalX,
    modalY + modalHeight / 2 - 24,
    modalWidth - 90,
    38
  )
    .setDepth(303)
    .setInteractive({ useHandCursor: true });

  closeZone.on('pointerup', close);

  this.tooltipObjects.push(overlay, shadow, bg, titleText, descriptionText, closeHint, closeZone);
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
  width?: number;
  height?: number;
  parent?: Phaser.GameObjects.Container;
}) {
  const chipWidth = Math.min(config.width ?? 164, this.scale.width - 54);
  const chipHeight = config.height ?? 42;
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
  const redrawChip = (fillColor: number, alpha: number, lineWidth: number, lineAlpha: number) => {
    bg.clear();
    bg.fillStyle(fillColor, alpha);
    bg.fillRoundedRect(
      config.x - chipWidth / 2,
      config.y - chipHeight / 2,
      chipWidth,
      chipHeight,
      radius
    );
    bg.lineStyle(lineWidth, config.color, lineAlpha);
    bg.strokeRoundedRect(
      config.x - chipWidth / 2,
      config.y - chipHeight / 2,
      chipWidth,
      chipHeight,
      radius
    );
  };

  redrawChip(0x120d0a, 0.96, 1, 0.78);
  bg.setDepth(46);

  const iconText = this.add.text(config.x - chipWidth / 2 + 18, config.y, config.icon, {
    fontFamily: UI.font.body,
    fontSize: '13px',
    color: UI.colors.text,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(47);

  const labelText = this.add.text(config.x - chipWidth / 2 + 34, config.y, config.text, {
    fontFamily: UI.font.body,
    fontSize: '10px',
    color: UI.colors.text,
    wordWrap: {
      width: chipWidth - 42,
      useAdvancedWrap: true,
    },
    maxLines: 2,
    lineSpacing: 0,
  }).setOrigin(0, 0.5).setDepth(47);

  const hitbox = this.add.zone(config.x, config.y, chipWidth, chipHeight)
   .setDepth(90)
   .setInteractive({ useHandCursor: true });

  hitbox.on('pointerover', () => {
    redrawChip(0x20150f, 1, 2, 1);
  });

  hitbox.on('pointerout', () => {
    redrawChip(0x120d0a, 0.96, 1, 0.78);
  });

  hitbox.on('pointerup', () => {
    this.showInfoModal(
      config.tooltipTitle,
      config.tooltipDescription,
      config.color
    );
  });

  const chipObjects = [shadow, bg, iconText, labelText, hitbox];

  if (config.parent) {
    config.parent.add(chipObjects);
  }

  config.targetArray.push(...chipObjects);
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

  const chipWidth = 168;
  const totalVisible = Math.min(this.playerDebuffs.length, 3);
  const totalWidth = totalVisible * chipWidth + Math.max(0, totalVisible - 1) * 8;
  const startX = -totalWidth / 2 + chipWidth / 2;
  const y = 84;

  this.playerDebuffs.slice(0, 3).forEach((debuff, index) => {
    const x = startX + index * (chipWidth + 8);

    this.createEffectChip({
      parent: this.playerCard,
      x,
      y,
      width: chipWidth,
      height: 42,
      text: `${debuff.name}
${debuff.duration} х.`,
      icon: this.getDebuffIcon(debuff.id),
      color: this.getDebuffColor(debuff.id),
      tooltipTitle: debuff.name,
      tooltipDescription:
        `${this.getDebuffShortDescription(debuff.id, debuff.power)}
` +
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

  const layout = this.getBattleLayout();
  const chipWidth = Math.min(160, (layout.contentWidth - 120) / 3);
  const totalVisible = Math.min(effects.length, 3);
  const totalWidth = totalVisible * chipWidth + Math.max(0, totalVisible - 1) * 8;
  const startX = this.enemyCard.x - totalWidth / 2 + chipWidth / 2;
  const y = this.enemyCard.y + (this.isBossBattle ? 104 : 88);

  effects.slice(0, 3).forEach((effect, index) => {
    const x = startX + index * (chipWidth + 8);

    this.createEffectChip({
      x,
      y,
      width: chipWidth,
      height: 42,
      text: `${effect.name}
${effect.duration} х.`,
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

    if (this.humanBattleFocusTurns > 0) {
      statuses.push(`Боевой настрой: ${this.humanBattleFocusTurns} х.`);
    }

    if (this.stoneQuartzSpikesTurns > 0) {
      statuses.push(`Кварцевые шипы: ${this.stoneQuartzSpikesTurns} х.`);
    }

    if (this.nightElfShadowStepTurns > 0) {
      statuses.push(`Шаг в тень: ${this.nightElfShadowStepTurns} х.`);
    }

    if (this.nightElfShadowDanceActive) {
      statuses.push('Танец теней');
    }

    if (this.goblinGreedyMarkTurns > 0) {
      statuses.push(`Воровская метка: ${this.goblinGreedyMarkTurns} х.`);
    }

    if (this.demonRageStacks > 0) {
      statuses.push(`Адская ярость: +${this.demonRageStacks}%`);
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

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
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
    const swordBonus = this.getSwordLargeEnemyDamageBonus(stats.maxHp);

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: swordBonus.multiplier,
      varianceMin: -2,
      varianceMax: 3,
      isBasicAttack: true,
    });

    const isCrit = this.rollPlayerCrit(stats.critChance);
    const finalDamage = isCrit ? Math.floor(damage * this.getPlayerCritMultiplier(1.6)) : damage;
    const treeCritText = this.applyCriticalTreeEffects(isCrit, finalDamage);

    const weaknessText = this.getEnemyWeaknessText();
    const swordBonusText = swordBonus.bonusPercent > 0
      ? `
Преимущество меча: враг крупнее, урон +${swordBonus.bonusPercent}%.`
      : '';

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Критическая атака мечом! Ты наносишь ${finalDamage} урона.${swordBonusText}${weaknessText}${treeCritText}`
      : `Ты наносишь удар мечом: ${finalDamage} урона.${swordBonusText}${weaknessText}`;

    this.afterPlayerAttack(playerActionText);
  }

  private handleDaggerAttack() {
  const stats = this.getBattleStats();

  const hits: {
    damage: number;
    isCrit: boolean;
    treeCritText: string;
  }[] = [];

  for (let i = 0; i < 3; i += 1) {
    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: 0.45,
      varianceMin: -1,
      varianceMax: 2,
      isBasicAttack: true,
    });

    const isCrit = this.rollPlayerCrit(stats.critChance);
    const finalDamage = isCrit ? Math.floor(damage * this.getPlayerCritMultiplier(1.45)) : damage;

    hits.push({
      damage: finalDamage,
      isCrit,
      treeCritText: this.applyCriticalTreeEffects(isCrit, finalDamage),
    });
  }

  let totalDamage = 0;
  let totalHeal = 0;
  let critCount = 0;
  const daggerTreeCritTexts: string[] = [];
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
    const lifestealText = totalHeal > 0
      ? `\nКинжальная жажда: восстановлено ${totalHeal} HP.`
      : '';

    const playerActionText =
      `Кинжалы проводят серию из 3 быстрых ударов.\n` +
      `Общий урон: ${totalDamage}.${critText}${lifestealText}${weaknessText}`;

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
      totalHeal += this.tryApplyDaggerLifesteal(hit.damage);

      if (hit.isCrit) {
        critCount += 1;

        if (hit.treeCritText) {
          daggerTreeCritTexts.push(hit.treeCritText);
        }
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
     isBasicAttack: true,
   });

   const isCrit = this.rollPlayerCrit(stats.critChance);
   const finalDamage = isCrit ? Math.floor(damage * this.getPlayerCritMultiplier(1.55)) : damage;
   const treeCritText = this.applyCriticalTreeEffects(isCrit, finalDamage);

   const weaknessText = this.getEnemyWeaknessText();

   this.animatePlayerAttack();
   this.damageEnemy(finalDamage);

   let playerActionText = isCrit
     ? `Критический рубящий удар топором! Ты наносишь ${finalDamage} урона.${weaknessText}${treeCritText}`
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
      isBasicAttack: true,
    });

    const isCrit = this.rollPlayerCrit(stats.critChance + 0.03);
    const finalDamage = isCrit ? Math.floor(damage * this.getPlayerCritMultiplier(1.55)) : damage;
    const treeCritText = this.applyCriticalTreeEffects(isCrit, finalDamage);

    const bleedDamage = Math.max(1, Math.floor(stats.attack * 0.22));

    this.enemyBleedTurns = 2;
    this.enemyBleedDamage = Math.max(this.enemyBleedDamage, bleedDamage);

    const weaknessText = this.getEnemyWeaknessText();

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Катана наносит точный критический разрез: ${finalDamage} урона.${weaknessText}\nВраг начинает кровоточить.${treeCritText}`
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
      isBasicAttack: true,
    });

    const isCrit = this.rollPlayerCrit(stats.critChance);
    const finalDamage = isCrit ? Math.floor(damage * this.getPlayerCritMultiplier(1.55)) : damage;
    const treeCritText = this.applyCriticalTreeEffects(isCrit, finalDamage);

    const isBoss = room?.type === 'boss' || room?.type === 'tier_boss';
    const stunChance = isBoss ? 0.15 : 0.35;
    const isStunned = Math.random() < stunChance;

    const weaknessText = this.getEnemyWeaknessText();

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);
    this.shakeBattle(0.008, 220);

    let playerActionText = isCrit
      ? `Критический удар молотом сотрясает арену: ${finalDamage} урона.${weaknessText}${treeCritText}`
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
      isBasicAttack: true,
    });

    const isCrit = this.rollPlayerCrit(stats.critChance);
    const finalDamage = isCrit ? Math.floor(damage * this.getPlayerCritMultiplier(1.45)) : damage;
    const treeCritText = this.applyCriticalTreeEffects(isCrit, finalDamage);

    this.shieldSwordGuardActive = true;

    const weaknessText = this.getEnemyWeaknessText();

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Щит-меч проводит безопасную критическую атаку: ${finalDamage} урона.${weaknessText}\nСледующий удар врага будет ослаблен.${treeCritText}`
      : `Ты атакуешь из-за щита: ${finalDamage} урона.${weaknessText}\nСледующий удар врага будет ослаблен.`;

    this.afterPlayerAttack(playerActionText);
  }

  private rollGoblinExtraMaterials(enemyDiedUnderMark: boolean) {
    if (player.raceId !== 'goblin') {
      return '';
    }

    const materials: {
      id: MaterialId;
      amount: number;
    }[] = [];

    const addRandomGoblinMaterial = () => {
      materials.push({
        id: GOBLIN_EXTRA_MATERIAL_POOL[Phaser.Math.Between(0, GOBLIN_EXTRA_MATERIAL_POOL.length - 1)],
        amount: 1,
      });
    };

    if (Math.random() < 0.05) {
      addRandomGoblinMaterial();
    }

    if (enemyDiedUnderMark && Math.random() < 0.10) {
      addRandomGoblinMaterial();
    }

    if (materials.length === 0) {
      return '';
    }

    addMaterialsPack(materials);
    trackFloorMaterials(materials);

    return materials
      .map(material => `Гоблинская добыча: +${material.amount} ${getMaterialName(material.id)}`)
      .join('\n');
  }


  private showLevelUpBanner(result: LevelUpResult) {
    if (!result.leveledUp) {
      return;
    }

    const layout = this.getBattleLayout();
    const bannerWidth = Math.min(layout.contentWidth - 34, 560);
    const bannerHeight = layout.compact ? 150 : 168;
    const bannerY = Phaser.Math.Clamp(layout.height * 0.43, 280, layout.height - 360);

    const container = this.add.container(layout.centerX, bannerY)
      .setDepth(900)
      .setAlpha(0)
      .setScale(0.92);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.52);
    shadow.fillRoundedRect(-bannerWidth / 2, -bannerHeight / 2 + 8, bannerWidth, bannerHeight, 30);

    const panel = this.add.graphics();
    panel.fillStyle(0x11100d, 0.98);
    panel.fillRoundedRect(-bannerWidth / 2, -bannerHeight / 2, bannerWidth, bannerHeight, 30);
    panel.lineStyle(3, UI.colors.gold, 0.82);
    panel.strokeRoundedRect(-bannerWidth / 2, -bannerHeight / 2, bannerWidth, bannerHeight, 30);

    const inner = this.add.graphics();
    inner.lineStyle(1, 0x62518a, 0.36);
    inner.strokeRoundedRect(-bannerWidth / 2 + 12, -bannerHeight / 2 + 12, bannerWidth - 24, bannerHeight - 24, 24);

    const glow = this.add.circle(0, -14, bannerWidth * 0.28, 0xb89a5e, 0.08);
    const rune = this.add.text(0, -bannerHeight / 2 + 36, '✦', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '30px' : '34px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const title = this.add.text(0, -bannerHeight / 2 + 64, 'ПЕЧАТЬ УРОВНЯ ПРОБУДИЛАСЬ', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '18px' : '20px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: bannerWidth - 44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5);

    const levelText = this.add.text(0, -bannerHeight / 2 + 99, `Уровень ${result.oldLevel} → ${result.newLevel}`, {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '24px' : '28px',
      color: '#9fd0a6',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: bannerWidth - 50,
      },
      maxLines: 1,
    }).setOrigin(0.5);

    const rewardText = this.add.text(0, -bannerHeight / 2 + (layout.compact ? 128 : 140), `+${result.upgradePointsGained} очк. древа  •  HP +${result.hpRestored}`, {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '13px' : '15px',
      color: '#c9b99b',
      align: 'center',
      wordWrap: {
        width: bannerWidth - 54,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5);

    container.add([shadow, panel, inner, glow, rune, title, levelText, rewardText]);

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 260,
      ease: 'Back.Out',
    });

    this.tweens.add({
      targets: [glow, rune],
      alpha: { from: 0.35, to: 1 },
      scale: { from: 0.96, to: 1.08 },
      duration: 620,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
    });

    this.time.delayedCall(2600, () => {
      this.tweens.add({
        targets: container,
        alpha: 0,
        scale: 0.96,
        duration: 420,
        ease: 'Sine.easeIn',
        onComplete: () => {
          container.destroy(true);
        },
      });
    });
  }

  private handleVictory(playerActionText: string) {
    this.hideTooltip();
    if (this.isBattleEnded) {
      return;
    }

    this.isBattleEnded = true;
    this.isBusy = true;

    const baseGold = this.enemy.goldReward;
    const goblinMarkedKill = player.raceId === 'goblin' && this.goblinGreedyMarkTurns > 0;
    const goldMultiplier =
      player.raceId === 'goblin'
        ? 1.2 + (goblinMarkedKill ? 0.25 : 0)
        : 1;
    const gold = Math.floor(baseGold * goldMultiplier);

    player.gold += gold;

    trackEnemyKilled();
    trackGoldEarned(gold);

    gameState.floorRun.monstersDefeated += 1;
    gameState.floorRun.goldEarned += gold;
    gameState.floorRun.expEarned += this.enemy.expReward;

    const expResult = addExperience(player, this.enemy.expReward);

    const loot = rollEnemyLoot(this.enemy);
    const goblinExtraLootText = this.rollGoblinExtraMaterials(goblinMarkedKill);

    let treeVictoryText = '';

    if (this.hasTreeLevel('energy', 2)) {
      const restoredBySecondWind = restoreEnergy(player, 1);

      treeVictoryText += restoredBySecondWind > 0
        ? `\nВторое дыхание: восстановлена ${restoredBySecondWind} энергия.`
        : '\nВторое дыхание: энергия уже полная.';
    }

    const combinedLootText = [loot.text, goblinExtraLootText]
      .filter(Boolean)
      .join('\n');

    const lootText = combinedLootText.length > 0
      ? `\n\nДобыча:\n${combinedLootText}`
      : '';

    const goblinGoldText = goblinMarkedKill
      ? '\nВоровская метка: золото за бой увеличено дополнительно на 25%.'
      : '';

    let regenerationText = '';

    if (this.returnToDungeon) {
      const regeneration = applyRoomRegeneration();
    
      if (regeneration.text) {
        regenerationText = `\n${regeneration.text}`;
      }
    }

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

    if (this.returnToDungeon) {
      markCurrentRoomCompleted();
      goToNextRoom();
      markDungeonResumePoint('battle-victory');
    } else {
      clearResumePoint('battle-victory-camp');
    }

    void saveGameAsync();

    this.logText.setText(
      `${playerActionText}\n\n` +
      `${this.enemy.name} повержен.\n` +
      `Получено золота: ${gold}\n` +
      `Получено опыта: ${this.enemy.expReward}` +
      `${goblinGoldText}` +
      `${treeVictoryText}` +
      `${demonHealText}` +
      `${lootText}` +
      `${levelText}` +
      `${regenerationText}`
    );

    this.updateTexts();

    if (expResult.leveledUp) {
      this.showLevelUpBanner(expResult);
    }

    this.time.delayedCall(expResult.leveledUp ? 3800 : 2200, () => {
      if (this.returnToDungeon) {
        this.scene.start('DungeonScene');
        return;
      }

      this.scene.start('CampScene');
    });
  }


  private handlePlayerDeath(deathText: string) {
    this.isBattleEnded = true;
    this.isBusy = true;

    this.logText.setText(deathText);
    this.updateTexts();
    this.createActionButtons();

    const checkpoint = getActiveCampfireBattleCheckpoint();

    if (!checkpoint) {
      this.time.delayedCall(1800, () => {
        const freshStats = getPlayerStats(player);

        player.hp = freshStats.maxHp;
        player.energy = freshStats.maxEnergy;

        resetFloorRun();
        clearResumePoint('battle-death');

        void saveGameAsync();

        this.scene.start('CampScene');
      });

      return;
    }

    this.time.delayedCall(650, () => {
      this.showCampfireDeathChoice(checkpoint);
    });
  }

  private showCampfireDeathChoice(checkpoint: CampfireBattleCheckpoint) {
    const { width, height } = this.scale;
    const modalObjects: Phaser.GameObjects.GameObject[] = [];

    const panelWidth = Math.min(width - 42, 620);
    const panelHeight = 430;
    const centerX = width / 2;
    const centerY = height / 2;
    const left = centerX - panelWidth / 2;
    const top = centerY - panelHeight / 2;
    const timeLeftText = formatCheckpointTimeLeft(checkpoint.expiresAt - Date.now());

    const overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.76)
      .setDepth(700)
      .setInteractive();

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.52);
    shadow.fillRoundedRect(left, top + 8, panelWidth, panelHeight, 32);
    shadow.setDepth(701);

    const bg = this.add.graphics();
    bg.fillStyle(0x17100c, 0.985);
    bg.fillRoundedRect(left, top, panelWidth, panelHeight, 32);
    bg.lineStyle(3, 0xf0a040, 0.92);
    bg.strokeRoundedRect(left, top, panelWidth, panelHeight, 32);
    bg.setDepth(702);

    const glow = this.add.circle(centerX, top + 74, panelWidth * 0.25, 0xf0a040, 0.08)
      .setDepth(703);

    const title = this.add.text(centerX, top + 54, 'Костёр ещё горит', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: panelWidth - 60,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(704);

    const message = this.add.text(
      centerX,
      top + 160,
      [
        `Ты можешь вернуться к зажжённому костру на этаже ${checkpoint.floor}.`,
        `Чекпоинт действует ещё: ${timeLeftText}.`,
        '',
        'При возвращении герой восстановит HP, энергию и запас зелий, а забег продолжится с места после костра.',
      ].join('\n'),
      {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: UI.colors.text,
        align: 'center',
        lineSpacing: 5,
        wordWrap: {
          width: panelWidth - 70,
          useAdvancedWrap: true,
        },
        maxLines: 7,
      }
    ).setOrigin(0.5).setDepth(704);

    const returnButton = this.createCheckpointModalButton({
      x: centerX,
      y: top + 302,
      width: Math.min(panelWidth - 90, 460),
      height: 56,
      text: 'Вернуться к костру',
      accentColor: 0xf0a040,
      onClick: () => {
        const result = restoreCampfireBattleCheckpoint();

        if (!result.success) {
          modalObjects.forEach(object => object.destroy());
          this.handlePlayerDeath('Костёр погас. Ты очнулся в лагере.');
          return;
        }

        markDungeonResumePoint('checkpoint-restore');
        void saveGameAsync();

        this.scene.start('DungeonScene');
      },
      depth: 704,
    });

    const townButton = this.createCheckpointModalButton({
      x: centerX,
      y: top + 366,
      width: Math.min(panelWidth - 90, 460),
      height: 52,
      text: 'Очнуться в лагере',
      accentColor: UI.colors.goldDark,
      onClick: () => {
        const freshStats = getPlayerStats(player);

        player.hp = freshStats.maxHp;
        player.energy = freshStats.maxEnergy;
        player.potions = 6;

        // Костёр не удаляем: если время чекпоинта ещё не вышло,
        // игрок должен видеть его в выборе подземелья и иметь возможность вернуться позже.
        resetFloorRun();
        clearResumePoint('checkpoint-town');

        void saveGameAsync();

        this.scene.start('CampScene');
      },
      depth: 704,
    });

    modalObjects.push(
      overlay,
      shadow,
      bg,
      glow,
      title,
      message,
      ...returnButton,
      ...townButton
    );
  }

  private createCheckpointModalButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    accentColor: number;
    onClick: () => void;
    depth: number;
  }) {
    const radius = Math.min(20, config.height / 2);
    const objects: Phaser.GameObjects.GameObject[] = [];

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 5,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(config.depth);

    const bg = this.add.graphics();
    const draw = (fill: number, alpha: number, offsetY = 0) => {
      bg.clear();
      bg.fillStyle(fill, alpha);
      bg.fillRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );
      bg.lineStyle(2, config.accentColor, 0.9);
      bg.strokeRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );
      label.setY(config.y + offsetY);
    };

    bg.setDepth(config.depth + 1);

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: config.width - 22,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(config.depth + 2);

    draw(0x21150f, 0.98);

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(config.depth + 3)
      .setInteractive({ useHandCursor: true });

    let pressed = false;

    zone.on('pointerover', () => {
      if (!pressed) draw(0x2c1d14, 1);
    });

    zone.on('pointerout', () => {
      pressed = false;
      draw(0x21150f, 0.98);
    });

    zone.on('pointerdown', () => {
      pressed = true;
      draw(0x2c1d14, 0.92, 1);
    });

    zone.on('pointerup', () => {
      if (!pressed) return;
      pressed = false;
      draw(0x2c1d14, 1);
      this.time.delayedCall(40, config.onClick);
    });

    objects.push(shadow, bg, label, zone);
    return objects;
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

    if (this.potionCooldown > 0) {
      this.logText.setText(`Зелье будет доступно через ${this.potionCooldown} ход.`);
      this.updateTexts();
      return;
    }

    if (this.hasPlayerDebuff('heal_block')) {
      this.logText.setText('Печать не даёт использовать зелье сейчас.');
      this.updateTexts();
      return;
    }

    const stats = this.getBattleStats();
    const maxHp = Math.max(1, Math.floor(stats.maxHp));
    const hpBefore = Phaser.Math.Clamp(Math.floor(player.hp), 0, maxHp);

    player.hp = hpBefore;

    if (hpBefore >= maxHp) {
      this.logText.setText('HP уже полное. Зелье не потрачено.');
      this.updateTexts();
      return;
    }

    const rot = this.getPlayerDebuff('rot');
    const healMultiplier = rot ? Math.max(0, 1 - rot.power / 100) : 1;
    const plannedHealAmount = Math.max(1, Math.floor(maxHp * 0.35 * healMultiplier));
    const hpAfter = Math.min(maxHp, hpBefore + plannedHealAmount);
    const actualHealAmount = Math.max(0, hpAfter - hpBefore);

    if (actualHealAmount <= 0) {
      this.logText.setText('Зелье не сработало: HP не изменилось. Зелье не потрачено.');
      this.updateTexts();
      return;
    }

    this.isBusy = true;

    player.potions = Math.max(0, player.potions - 1);
    this.potionCooldown = 2;
    player.hp = hpAfter;

    const rotText = rot
      ? `
Могильная зараза ослабила лечение на ${rot.power}%.`
      : '';

    this.logText.setText(
      `Ты выпил зелье и восстановил ${actualHealAmount} HP.${rotText}

Зелье не тратит ход. Враг не атакует.`
    );

    this.showFloatingText(
      this.playerCard.x,
      this.playerCard.y - 55,
      `+${actualHealAmount}`,
      '#75d184'
    );

    this.updateTexts();
    this.createActionButtons();

    void saveGameAsync();

    this.time.delayedCall(260, () => {
      this.isBusy = false;
      this.updateTexts();
      this.createActionButtons();
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

      const shadowStepChance = this.nightElfShadowStepTurns > 0 ? 0.5 : 0;
      const finalDodgeChance = Math.max(stats.dodgeChance, shadowStepChance);

      if (Math.random() < finalDodgeChance) {
        if (player.raceId === 'night_elf') {
          this.nightElfShadowDanceActive = true;
        }
        this.showFloatingText(
          this.playerCard.x,
          this.playerCard.y - 55,
          'УКЛОНЕНИЕ',
          '#70a6ff'
        );

        const restoredAfterDodge = restoreEnergy(player, 1);
        const treeDodgeText = this.handleTreeDodgeEffects();

        const passiveText = this.checkHumanPassive();

        this.logText.setText(
          `${playerActionText}\n\nТы уклонился от атаки врага.\n${this.createEnergyRestoreText(restoredAfterDodge)}${treeDodgeText}${passiveText}`
        );

        this.updateTexts();
        this.tickRaceTurnEffectsAfterEnemyAction();
        this.tickRaceSkillCooldown();
        this.tickPotionCooldown();
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

      damage = Math.max(1, Math.floor(damage * this.getRaceIncomingDamageMultiplier()));

      let shieldSwordText = '';

      if (this.shieldSwordGuardActive) {
        damage = Math.max(1, Math.floor(damage * 0.6));
        this.shieldSwordGuardActive = false;
        shieldSwordText = '\nЩит-меч смягчил входящий удар.';
      }

      if (isDefending) {
        damage = Math.max(1, Math.floor(damage * 0.45));
      }

      const defenseTreeResult = this.applyDefenseTreeDamageReduction(damage, isDefending);
      damage = defenseTreeResult.damage;

      this.treeDodgeStreak = 0;

      player.hp = Math.max(0, player.hp - damage);
      const survivalText = this.resolveTreeSurvivalAfterDamage();

      let stoneThornsText = '';

      if (player.raceId === 'stoneborn' && this.stoneQuartzSpikesTurns > 0 && damage > 0) {
        const thornDamage = Math.max(1, Math.floor(damage * 0.3));
        this.damageEnemy(thornDamage);
        stoneThornsText = `
Кварцевые шипы отражают ${thornDamage} урона.`;
      }

      const debuffText = this.tryApplyEnemyDebuffOnHit();

      let demonRageText = '';

      if (player.raceId === 'demon' && damage > 0) {
        const previousStacks = this.demonRageStacks;
      
        this.demonRageStacks = Math.min(5, this.demonRageStacks + 1);
      
        if (this.demonRageStacks > previousStacks) {
          demonRageText = `\nАдская ярость: атака +${this.demonRageStacks}%.`;
        }
      }

      if (this.enemy.hp <= 0 && player.hp > 0) {
        const thornVictoryText = isDefending
          ? `${playerActionText}

Ты заблокировал часть удара.
${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${defenseTreeResult.text}${survivalText}${stoneThornsText}${demonRageText}${debuffText}`
          : `${playerActionText}

${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${defenseTreeResult.text}${survivalText}${stoneThornsText}${demonRageText}${debuffText}`;

        this.tickRaceTurnEffectsAfterEnemyAction();
        this.handleVictory(thornVictoryText);

        return;
      }

      this.showFloatingText(
        this.playerCard.x,
        this.playerCard.y - 55,
        `-${damage}`,
        isDefending ? '#70a6ff' : '#ff6b6b'
      );

      this.animateHit(this.playerCard);
      this.shakeBattle();

      const restoredAfterEnemyTurn = restoreEnergy(player, 1);
      const energyRestoreText = this.createEnergyRestoreText(restoredAfterEnemyTurn);

      const passiveText = this.checkHumanPassive();

      if (player.hp <= 0) {
        const deathText = isDefending
          ? `${playerActionText}

Ты заблокировал часть удара.
${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${defenseTreeResult.text}${survivalText}${stoneThornsText}${debuffText}

Ты пал в катакомбах...`
          : `${playerActionText}

${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${defenseTreeResult.text}${survivalText}${stoneThornsText}${debuffText}

Ты пал в катакомбах...`;

        this.handlePlayerDeath(deathText);

        return;
      }

      this.logText.setText(
        isDefending
          ? `${playerActionText}\n\nТы заблокировал часть удара.\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${defenseTreeResult.text}${survivalText}${stoneThornsText}${demonRageText}${debuffText}\n${energyRestoreText}${passiveText}`
          : `${playerActionText}\n\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${defenseTreeResult.text}${survivalText}${stoneThornsText}${demonRageText}${debuffText}\n${energyRestoreText}${passiveText}`
      );

      this.updateTexts();
      this.tickRaceTurnEffectsAfterEnemyAction();
      this.tickRaceSkillCooldown();
      this.tickPotionCooldown();
      this.tickPlayerDebuffs();
      this.isBusy = false;
      this.createActionButtons();
    });
  }

  private tickRaceSkillCooldown() {
    if (this.raceSkillCooldownJustApplied) {
      this.raceSkillCooldownJustApplied = false;
      return;
    }

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
     this.playerHpBar.displayWidth = this.playerHpBarMaxWidth * playerHpRatio;
   }

   if (this.enemyHpBar) {
     const enemyHpRatio = Phaser.Math.Clamp(this.enemy.hp / this.enemy.maxHp, 0, 1);
     this.enemyHpBar.displayWidth = this.enemyHpBarMaxWidth * enemyHpRatio;
   }

   if (this.energyBar) {
     const energyRatio = Phaser.Math.Clamp(player.energy / stats.maxEnergy, 0, 1);
     this.energyBar.displayWidth = this.energyBarMaxWidth * energyRatio;
   }

    if (this.playerDebuffText) {
      this.playerDebuffText.setText('');
      this.playerDebuffText.setVisible(false);
    }
    this.renderPlayerEffectChips();
    this.renderEnemyEffectChips();
    this.updateStatusText();

    if (!this.isBattleEnded && player.hp > 0 && this.enemy.hp > 0) {
      this.rememberBattleResumePoint('battle-update');
      requestAutoSave('battle-update');
    }
  }
}
