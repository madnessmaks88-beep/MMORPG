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
  getRewardExpAmount,
  getRewardGoldAmount,
  getRewardMaterialAmount,
  restorePlayerVitalsToMaximum,
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

  arenaTop: number;
  arenaBottom: number;
  arenaWidth: number;

  enemyX: number;
  enemyY: number;
  playerX: number;
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
  veryCompact: boolean;
  spriteScale: number;
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

  private playerHpPreviewBar?: Phaser.GameObjects.Rectangle;
  private enemyHpPreviewBar?: Phaser.GameObjects.Rectangle;

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
  private taintedCorruptionTurns = 0;
  private taintedCorruptionDamageBonus = 0;
  private taintedCorruptionJustApplied = false;

  private humanBattleFocusTurns = 0;
  private humanBattleFocusDamageBonus = 0;
  private humanBattleFocusDefenseBonus = 0;

  private stoneQuartzSpikesTurns = 0;

  private nightElfShadowStepTurns = 0;
  private nightElfShadowDanceActive = false;

  private goblinGreedyMarkTurns = 0;

  private demonRageStacks = 0;
  private demonHpSpentByHellfire = 0;
  private demonHellfireBurnTurns = 0;
  private demonHellfireBurnDamage = 0;

  private raceAttackEffectText = '';

  private playerDebuffs: ActivePlayerDebuff[] = [];
  private playerStunTurns = 0;
  private nextIncomingDamageBonus = 0;

  private tridentDepthMarkTurns = 0;
  private tridentDepthMarkBonus = 0;

  private playerDebuffText?: Phaser.GameObjects.Text;

  private enemyEffectObjects: Phaser.GameObjects.GameObject[] = [];
  private playerEffectObjects: Phaser.GameObjects.GameObject[] = [];

  private tooltipObjects: Phaser.GameObjects.GameObject[] = [];



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
  this.taintedCorruptionTurns = 0;
  this.taintedCorruptionDamageBonus = 0;
  this.taintedCorruptionJustApplied = false;

  this.humanBattleFocusTurns = 0;
  this.humanBattleFocusDamageBonus = 0;
  this.humanBattleFocusDefenseBonus = 0;

  this.stoneQuartzSpikesTurns = 0;

  this.nightElfShadowStepTurns = 0;
  this.nightElfShadowDanceActive = false;

  this.goblinGreedyMarkTurns = 0;

  this.demonRageStacks = 0;
  this.demonHpSpentByHellfire = 0;
  this.demonHellfireBurnTurns = 0;
  this.demonHellfireBurnDamage = 0;

  this.raceAttackEffectText = '';

  this.enemyBleedTurns = 0;
  this.enemyBleedDamage = 0;
  this.shieldSwordGuardActive = false;

  this.playerDebuffs = [];
  this.playerStunTurns = 0;
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

    this.cameras.main.fadeIn(260, 0, 0, 0);

    this.createBattleBackground(isBoss);

    this.createBattleHeader(
      `Этаж ${floor}  •  Ур. ${player.level}`,
      room ? room.title : `${player.name} против ${this.enemy.name}`,
      isBoss
    );

    this.enemyCard = this.createFighterCard(
      layout.enemyX,
      layout.enemyY,
      this.enemy.name,
      isBoss ? '♛' : '☠',
      isBoss ? 0x3a120c : 0x241515,
      true,
      isBoss
    );

    this.playerCard = this.createFighterCard(
      layout.playerX,
      layout.playerY,
      player.name,
      '🗡',
      0x151b24,
      false,
      false
    );

    this.animateBattleEntries();

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

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 16, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.018), 12, 28);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.022), 16, 34);
    const contentWidth = Math.min(width - safeX * 2, 660);
    const arenaWidth = Math.min(width - safeX * 2, 690);

    const compact = height < 1120;
    const veryCompact = height < 820;
    const spriteScale = veryCompact ? 0.70 : compact ? 0.86 : 1;

    const actionPanelHeight = veryCompact ? 188 : compact ? 238 : 270;
    const actionPanelY = height - safeBottom - actionPanelHeight / 2;
    const actionTop = actionPanelY - actionPanelHeight / 2;

    const attackButtonY = actionTop + (veryCompact ? 38 : compact ? 50 : 58);
    const firstRowY = attackButtonY + (veryCompact ? 54 : compact ? 68 : 76);
    const secondRowY = firstRowY + (veryCompact ? 46 : compact ? 58 : 64);

    const logHeight = veryCompact ? 82 : compact ? 116 : 136;
    const logY = actionTop - logHeight / 2 - (veryCompact ? 6 : 12);

    const headerHeight = this.isBossBattle
      ? veryCompact ? 70 : compact ? 92 : 106
      : veryCompact ? 60 : compact ? 80 : 92;

    const arenaTop = safeTop + headerHeight + (veryCompact ? 8 : 12);
    const arenaBottom = logY - logHeight / 2 - (veryCompact ? 8 : 12);
    const arenaHeight = Math.max(260, arenaBottom - arenaTop);

    const horizontalOffset = Phaser.Math.Clamp(Math.round(contentWidth * 0.22), 62, 104);
    const enemyX = width / 2 + horizontalOffset;
    const playerX = width / 2 - horizontalOffset;

    const enemyY = arenaTop + arenaHeight * (veryCompact ? 0.36 : 0.34);
    const playerY = arenaTop + arenaHeight * (veryCompact ? 0.70 : 0.72);

    const mainButtonWidth = Math.min(contentWidth - 28, 590);
    const sideButtonWidth = Math.min((mainButtonWidth - (veryCompact ? 8 : 10)) / 2, 288);

    return {
      width,
      height,
      centerX: width / 2,
      safeX,
      safeTop,
      safeBottom,
      contentWidth,

      arenaTop,
      arenaBottom,
      arenaWidth,

      enemyX,
      enemyY,
      playerX,
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
      veryCompact,
      spriteScale,
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

  private animateBattleEntries() {
    const entries = [this.enemyCard, this.playerCard];

    entries.forEach((entry, index) => {
      const direction = index === 0 ? -1 : 1;

      entry.setAlpha(0);
      entry.setScale(0.92);
      entry.y += 26 * direction;

      this.tweens.add({
        targets: entry,
        alpha: 1,
        scale: 1,
        y: entry.y - 26 * direction,
        duration: 430,
        delay: 120 + index * 110,
        ease: 'Cubic.easeOut',
      });
    });
  }

  private createBattleHeader(title: string, subtitle: string, isBoss: boolean) {
    const layout = this.getBattleLayout();
    const panelWidth = Math.min(layout.contentWidth, 640);
    const panelHeight = isBoss
      ? layout.veryCompact ? 68 : layout.compact ? 88 : 102
      : layout.veryCompact ? 60 : layout.compact ? 76 : 88;
    const panelY = layout.safeTop + panelHeight / 2;
    const left = layout.centerX - panelWidth / 2;
    const top = panelY - panelHeight / 2;
    const accent = isBoss ? 0xb84a2f : UI.colors.goldDark;

    const shadow = this.add.graphics().setDepth(20).setAlpha(0);
    shadow.fillStyle(0x000000, 0.46);
    shadow.fillRoundedRect(left, top + 7, panelWidth, panelHeight, 24);

    const bg = this.add.graphics().setDepth(21).setAlpha(0);
    bg.fillStyle(isBoss ? 0x170706 : 0x080a0e, 0.98);
    bg.fillRoundedRect(left, top, panelWidth, panelHeight, 24);
    bg.fillStyle(isBoss ? 0x2c0d09 : 0x15100c, 0.38);
    bg.fillRoundedRect(left + 8, top + 8, panelWidth - 16, panelHeight - 16, 18);
    bg.lineStyle(isBoss ? 3 : 2, accent, isBoss ? 0.92 : 0.68);
    bg.strokeRoundedRect(left, top, panelWidth, panelHeight, 24);
    bg.lineStyle(1, 0xf0d58a, isBoss ? 0.22 : 0.16);
    bg.strokeRoundedRect(left + 7, top + 7, panelWidth - 14, panelHeight - 14, 18);

    const bossMark = this.add.text(left + (layout.veryCompact ? 32 : 42), panelY, isBoss ? '♛' : '◆', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '18px' : '23px',
      color: isBoss ? '#ff9a66' : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(23).setAlpha(0);

    const encounterText = this.add.text(layout.centerX, top + (layout.veryCompact ? 13 : 16), isBoss ? 'СМЕРТЕЛЬНАЯ ВСТРЕЧА' : 'БОЕВАЯ ВСТРЕЧА', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '10px' : '12px',
      color: isBoss ? '#ff8b6f' : '#b9985b',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(23).setAlpha(0);

    const titleText = this.add.text(layout.centerX, panelY - (isBoss ? 0 : 3), title, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '18px' : layout.compact ? '22px' : '25px',
      color: isBoss ? '#ffd0aa' : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: panelWidth - (layout.veryCompact ? 94 : 120),
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(23).setAlpha(0);

    const subtitleText = this.add.text(layout.centerX, top + panelHeight - (layout.veryCompact ? 15 : 18), subtitle, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '11px' : '13px',
      color: isBoss ? '#d6a98e' : '#9f9788',
      align: 'center',
      wordWrap: {
        width: panelWidth - (layout.veryCompact ? 70 : 92),
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(23).setAlpha(0);

    const dangerLine = this.add.rectangle(layout.centerX, top + panelHeight - 3, panelWidth - 52, 2, accent, isBoss ? 0.45 : 0.22)
      .setDepth(24)
      .setAlpha(0);

    this.tweens.add({
      targets: [shadow, bg, bossMark, encounterText, titleText, subtitleText, dangerLine],
      alpha: 1,
      y: '+=4',
      duration: 270,
      ease: 'Sine.easeOut',
    });

    if (isBoss) {
      this.tweens.add({
        targets: dangerLine,
        alpha: 0.74,
        duration: 720,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private getDebuffIcon(id: string) {
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
  if (id === 'goblin_mark') return '◎';
  if (id === 'tainted_corruption') return '☾';
  if (id === 'hellfire_burn') return '🔥';
  if (id === 'black_water_grip') return '≋';
  if (id === 'player_stun') return '✦';

  return '•';
}

private getDebuffShortDescription(id: string, power: number) {
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
  if (id === 'skill_cost_up') {
    return power >= 50
      ? 'Активный навык заблокирован.'
      : `Навыки стоят на ${power} энергии больше.`;
  }

  if (id === 'goblin_mark') {
    return `Враг получает на ${power}% больше урона от гоблина. Если враг умрёт под меткой: +25% золота и шанс доп. материала.`;
  }

  if (id === 'tainted_corruption') {
    return `Враг получает на ${power}% больше урона от следующих атак героя.`;
  }

  if (id === 'hellfire_burn') {
    return `Перед атакой враг получает ${power} урона кровавым пламенем.`;
  }

  if (id === 'black_water_grip') {
    return `Следующая атака героя нанесёт на ${power}% больше урона.`;
  }

  if (id === 'player_stun') {
    return 'Герой пропустит следующее действие.';
  }

  return 'Неизвестный эффект.';
}

  private createBattleLogPanel() {
    const layout = this.getBattleLayout();
    const panelWidth = layout.contentWidth;
    const panelHeight = layout.logHeight;
    const top = layout.logY - panelHeight / 2;
    const left = layout.centerX - panelWidth / 2;

    const panel = this.createRoundedPanel({
      x: layout.centerX,
      y: layout.logY,
      width: panelWidth,
      height: panelHeight,
      radius: layout.veryCompact ? 16 : 22,
      color: 0x05070a,
      alpha: 0.94,
      strokeColor: 0x5f4630,
      strokeAlpha: 0.6,
      strokeWidth: 2,
      depth: 38,
    });

    panel.shadow.setAlpha(0);
    panel.panel.setAlpha(0);

    const titleText = this.add.text(layout.centerX, top + (layout.veryCompact ? 14 : 18), 'ЖУРНАЛ БОЯ', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '12px' : '15px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(41).setAlpha(0);

    const dividerLeft = this.add.rectangle(layout.centerX - panelWidth * 0.23, titleText.y, panelWidth * 0.26, 1, UI.colors.goldDark, 0.36).setDepth(41).setAlpha(0);
    const dividerRight = this.add.rectangle(layout.centerX + panelWidth * 0.23, titleText.y, panelWidth * 0.26, 1, UI.colors.goldDark, 0.36).setDepth(41).setAlpha(0);

    this.statusText = this.add.text(
      left + panelWidth - 18,
      top + (layout.veryCompact ? 14 : 18),
      'Нет эффектов',
      {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '9px' : '11px',
        color: '#8aa9c5',
        align: 'right',
        wordWrap: {
          width: panelWidth * 0.33,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }
    ).setOrigin(1, 0.5).setDepth(42).setAlpha(0.88);

    this.logText = this.add.text(
      left + (layout.veryCompact ? 18 : 22),
      top + (layout.veryCompact ? 32 : 40),
      'Выбери действие.',
      {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '12px' : layout.compact ? '14px' : '16px',
        color: UI.colors.text,
        align: 'left',
        wordWrap: {
          width: panelWidth - (layout.veryCompact ? 36 : 44),
          useAdvancedWrap: true,
        },
        maxLines: layout.veryCompact ? 4 : 5,
        lineSpacing: layout.veryCompact ? 2 : 4,
      }
    ).setOrigin(0, 0).setDepth(42).setAlpha(0);

    this.tweens.add({
      targets: [panel.shadow, panel.panel, titleText, dividerLeft, dividerRight, this.logText],
      alpha: 1,
      y: '-=4',
      duration: 240,
      delay: 160,
      ease: 'Sine.easeOut',
    });
  }

  private createActionButtons() {
    this.actionButtons.forEach(object => object.destroy());
    this.actionButtons = [];

    if (this.isBattleEnded) {
      return;
    }

    const layout = this.getBattleLayout();
    const canUseRaceSkill = !this.isRaceSkillDisabled();
    const canUsePower =
      !this.isBusy &&
      !this.isBattleEnded &&
      player.energy >= this.powerAttackEnergyCost + this.getSkillCostPenalty();
    const canUsePotion = !this.isPotionDisabled() && player.hp < this.getBattleStats().maxHp;

    const panelObjects = this.createRoundedPanel({
      x: layout.centerX,
      y: layout.actionPanelY,
      width: layout.contentWidth,
      height: layout.actionPanelHeight,
      radius: layout.veryCompact ? 24 : 34,
      color: 0x050608,
      alpha: 0.98,
      strokeColor: 0x6b5134,
      strokeAlpha: 0.76,
      strokeWidth: 2,
      depth: 18,
    });

    const topY = layout.actionPanelY - layout.actionPanelHeight / 2;
    const panelLeft = layout.centerX - layout.contentWidth / 2;
    const panelRight = layout.centerX + layout.contentWidth / 2;
    const titleY = topY + (layout.veryCompact ? 23 : 29);

    const altar = this.add.graphics().setDepth(20);
    altar.fillStyle(0x0d0a08, 0.96);
    altar.fillRoundedRect(panelLeft + 12, topY + 12, layout.contentWidth - 24, layout.actionPanelHeight - 24, layout.veryCompact ? 18 : 26);
    altar.fillStyle(0x111722, 0.34);
    altar.fillRoundedRect(panelLeft + 20, topY + 48, layout.contentWidth - 40, layout.actionPanelHeight - 64, layout.veryCompact ? 14 : 20);
    altar.lineStyle(1, 0xb9985b, 0.22);
    altar.strokeRoundedRect(panelLeft + 18, topY + 18, layout.contentWidth - 36, layout.actionPanelHeight - 36, layout.veryCompact ? 15 : 22);

    const topLine = this.add.rectangle(layout.centerX, titleY + (layout.veryCompact ? 22 : 25), layout.contentWidth - 70, 1, UI.colors.goldDark, 0.32)
      .setDepth(22);

    const actionTitle = this.add.text(layout.centerX, titleY, 'командный алтарь', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '13px' : '16px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      letterSpacing: 1,
      wordWrap: {
        width: layout.contentWidth - 180,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(23);

    const energyPill = this.add.rectangle(panelRight - (layout.veryCompact ? 58 : 66), titleY, layout.veryCompact ? 82 : 92, layout.veryCompact ? 28 : 32, 0x07121f, 0.96)
      .setStrokeStyle(1, 0x70a6ff, 0.58)
      .setDepth(22);

    const energyHint = this.add.text(energyPill.x, titleY, `✦ ${player.energy}`, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '11px' : '13px',
      color: '#b9d8ff',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: energyPill.width - 12,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(23);

    const leftSigil = this.add.text(panelLeft + (layout.veryCompact ? 34 : 42), titleY, '☾', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '18px' : '22px',
      color: '#6b4a8c',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(23).setAlpha(0.5);

    const rightSigil = this.add.text(panelRight - (layout.veryCompact ? 116 : 132), titleY, '☾', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '18px' : '22px',
      color: '#6b4a8c',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(23).setAlpha(0.5);

    this.actionButtons.push(
      panelObjects.shadow,
      panelObjects.panel,
      altar,
      topLine,
      actionTitle,
      energyPill,
      energyHint,
      leftSigil,
      rightSigil
    );

    const primaryHeight = layout.veryCompact ? 56 : layout.compact ? 64 : 72;
    const gridButtonHeight = layout.veryCompact ? 44 : layout.compact ? 52 : 60;
    const gap = layout.veryCompact ? 8 : 10;
    const sideWidth = Math.min((layout.mainButtonWidth - gap) / 2, layout.sideButtonWidth);

    this.actionButtons.push(
      ...this.createBattleActionButton({
        x: layout.centerX,
        y: layout.attackButtonY,
        width: layout.mainButtonWidth,
        height: primaryHeight,
        icon: '⚔',
        title: 'Атака оружием',
        subtitle: 'основное действие',
        accentColor: UI.colors.gold,
        variant: 'primary',
        onClick: () => this.handleAttack(),
      })
    );

    this.actionButtons.push(
      ...this.createBattleActionButton({
        x: layout.centerX - sideWidth / 2 - gap / 2,
        y: layout.firstRowY,
        width: sideWidth,
        height: gridButtonHeight,
        icon: '✦',
        title: 'Сильный удар',
        subtitle: `${this.powerAttackEnergyCost + this.getSkillCostPenalty()} эн.`,
        accentColor: 0xd08a3b,
        variant: 'heavy',
        disabled: !canUsePower,
        onClick: () => this.handlePowerAttack(),
      })
    );

    this.actionButtons.push(
      ...this.createBattleActionButton({
        x: layout.centerX + sideWidth / 2 + gap / 2,
        y: layout.firstRowY,
        width: sideWidth,
        height: gridButtonHeight,
        icon: '▣',
        title: 'Защита',
        subtitle: '+1 энергия',
        accentColor: 0x70a6ff,
        variant: 'defense',
        onClick: () => this.handleDefend(),
      })
    );

    this.actionButtons.push(
      ...this.createBattleActionButton({
        x: layout.centerX - sideWidth / 2 - gap / 2,
        y: layout.secondRowY,
        width: sideWidth,
        height: gridButtonHeight,
        icon: '◆',
        title: 'Навык расы',
        subtitle: this.getRaceSkillSubtitle(),
        accentColor: 0xc084fc,
        variant: 'magic',
        disabled: !canUseRaceSkill,
        onClick: () => this.handleRaceSkill(),
      })
    );

    this.actionButtons.push(
      ...this.createBattleActionButton({
        x: layout.centerX + sideWidth / 2 + gap / 2,
        y: layout.secondRowY,
        width: sideWidth,
        height: gridButtonHeight,
        icon: '✚',
        title: 'Зелье',
        subtitle: this.getPotionButtonSubtitle(),
        accentColor: 0x75d184,
        variant: 'heal',
        disabled: !canUsePotion,
        onClick: () => this.handlePotion(),
      })
    );

    this.tweens.add({
      targets: this.actionButtons,
      alpha: {
        from: 0,
        to: 1,
      },
      duration: 190,
      ease: 'Sine.easeOut',
    });
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
  variant?: 'primary' | 'heavy' | 'defense' | 'magic' | 'heal';
  onClick: () => void;
}) {
  const disabled = config.disabled ?? false;
  const variant = config.variant ?? 'primary';
  const isPrimary = variant === 'primary';
  const compactButton = config.height <= 52;
  const radius = isPrimary ? Math.min(24, config.height / 2) : Math.min(16, config.height / 2);
  const left = config.x - config.width / 2;
  const top = config.y - config.height / 2;

  const baseColor =
    variant === 'defense'
      ? 0x071220
      : variant === 'magic'
        ? 0x13091f
        : variant === 'heal'
          ? 0x07160d
          : variant === 'heavy'
            ? 0x1a0d06
            : 0x17110b;

  const hoverColor =
    variant === 'defense'
      ? 0x0c2036
      : variant === 'magic'
        ? 0x24133a
        : variant === 'heal'
          ? 0x0d2a18
          : variant === 'heavy'
            ? 0x2c160a
            : 0x2b1d10;

  const pressedColor =
    variant === 'defense'
      ? 0x102b45
      : variant === 'magic'
        ? 0x32194f
        : variant === 'heal'
          ? 0x123820
          : variant === 'heavy'
            ? 0x3b1d0c
            : 0x3b2814;

  const textColor = disabled ? '#5d5850' : isPrimary ? UI.colors.goldText : UI.colors.text;
  const subtitleColor = disabled ? '#403d38' : '#9f9788';

  const objects: Phaser.GameObjects.GameObject[] = [];

  const shadow = this.add.graphics().setDepth(21);
  const glow = this.add.graphics().setDepth(22);
  const bg = this.add.graphics().setDepth(23);
  const trim = this.add.graphics().setDepth(24);

  const drawButton = (
    fillColor: number,
    fillAlpha: number,
    borderAlpha: number,
    offsetY = 0
  ) => {
    shadow.clear();
    shadow.fillStyle(0x000000, disabled ? 0.18 : 0.4);
    shadow.fillRoundedRect(left, top + 6 + offsetY, config.width, config.height, radius);

    glow.clear();
    glow.fillStyle(config.accentColor, disabled ? 0.01 : isPrimary ? 0.14 : 0.045);
    glow.fillRoundedRect(left - 2, top + 2 + offsetY, config.width + 4, config.height + 4, radius + 2);

    bg.clear();
    bg.fillStyle(disabled ? 0x09090a : fillColor, disabled ? 0.72 : fillAlpha);
    bg.fillRoundedRect(left, top + offsetY, config.width, config.height, radius);
    bg.fillStyle(0x000000, disabled ? 0.26 : 0.18);
    bg.fillRoundedRect(left + 6, top + 6 + offsetY, config.width - 12, config.height - 12, Math.max(8, radius - 6));
    bg.fillStyle(config.accentColor, disabled ? 0.025 : isPrimary ? 0.14 : 0.09);
    bg.fillRoundedRect(left + 8, top + 8 + offsetY, isPrimary ? 54 : 38, config.height - 16, Math.max(8, radius - 8));

    trim.clear();
    trim.lineStyle(isPrimary ? 2 : 1.5, config.accentColor, disabled ? 0.18 : borderAlpha);
    trim.strokeRoundedRect(left, top + offsetY, config.width, config.height, radius);
    trim.lineStyle(1, 0xf0d58a, disabled ? 0.04 : isPrimary ? 0.34 : 0.18);
    trim.strokeRoundedRect(left + 4, top + 4 + offsetY, config.width - 8, config.height - 8, Math.max(8, radius - 4));

    const corner = isPrimary ? 16 : 12;
    const inset = isPrimary ? 11 : 9;
    trim.lineStyle(2, config.accentColor, disabled ? 0.08 : isPrimary ? 0.54 : 0.34);
    trim.lineBetween(left + inset, top + inset + offsetY, left + inset + corner, top + inset + offsetY);
    trim.lineBetween(left + inset, top + inset + offsetY, left + inset, top + inset + corner + offsetY);
    trim.lineBetween(left + config.width - inset, top + inset + offsetY, left + config.width - inset - corner, top + inset + offsetY);
    trim.lineBetween(left + config.width - inset, top + inset + offsetY, left + config.width - inset, top + inset + corner + offsetY);
    trim.lineBetween(left + inset, top + config.height - inset + offsetY, left + inset + corner, top + config.height - inset + offsetY);
    trim.lineBetween(left + inset, top + config.height - inset + offsetY, left + inset, top + config.height - inset - corner + offsetY);
    trim.lineBetween(left + config.width - inset, top + config.height - inset + offsetY, left + config.width - inset - corner, top + config.height - inset + offsetY);
    trim.lineBetween(left + config.width - inset, top + config.height - inset + offsetY, left + config.width - inset, top + config.height - inset - corner + offsetY);
  };

  drawButton(baseColor, 0.98, isPrimary ? 0.94 : 0.68);

  const iconX = left + (isPrimary ? 35 : 26);
  const iconRadius = isPrimary ? (compactButton ? 18 : 22) : compactButton ? 13 : 16;

  const iconBg = this.add.circle(iconX, config.y, iconRadius, config.accentColor, disabled ? 0.07 : isPrimary ? 0.18 : 0.13)
    .setStrokeStyle(1, config.accentColor, disabled ? 0.22 : 0.55)
    .setDepth(25);

  const icon = this.add.text(iconX, config.y, config.icon, {
    fontFamily: UI.font.body,
    fontSize: isPrimary ? (compactButton ? '17px' : '20px') : compactButton ? '12px' : '14px',
    color: disabled ? '#58544d' : UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 3,
    align: 'center',
  }).setOrigin(0.5).setDepth(26);

  const textX = left + (isPrimary ? 70 : 50);
  const textWidth = config.width - (isPrimary ? 94 : 60);

  const title = this.add.text(textX, config.y - (isPrimary ? compactButton ? 8 : 11 : compactButton ? 7 : 9), config.title, {
    fontFamily: UI.font.title,
    fontSize: isPrimary
      ? compactButton ? '17px' : '20px'
      : config.width < 210
        ? compactButton ? '10px' : '12px'
        : compactButton ? '12px' : '14px',
    color: textColor,
    stroke: '#000000',
    strokeThickness: isPrimary ? 4 : 3,
    wordWrap: {
      width: textWidth,
      useAdvancedWrap: true,
    },
    maxLines: 1,
  }).setOrigin(0, 0.5).setDepth(26);

  const subtitle = this.add.text(textX, config.y + (isPrimary ? compactButton ? 11 : 14 : compactButton ? 9 : 11), config.subtitle, {
    fontFamily: UI.font.body,
    fontSize: isPrimary
      ? compactButton ? '10px' : '12px'
      : config.width < 210
        ? '9px'
        : compactButton ? '10px' : '11px',
    color: subtitleColor,
    wordWrap: {
      width: textWidth,
      useAdvancedWrap: true,
    },
    maxLines: 1,
  }).setOrigin(0, 0.5).setDepth(26);

  const zone = this.add.zone(config.x, config.y, config.width, config.height).setDepth(30);
  objects.push(shadow, glow, bg, trim, iconBg, icon, title, subtitle, zone);

  const alphaTargets = [shadow, glow, bg, trim, iconBg, icon, title, subtitle];
  alphaTargets.forEach(object => {
    object.setAlpha(0);
    object.y += 4;
  });

  this.tweens.add({
    targets: alphaTargets,
    alpha: disabled ? 0.68 : 1,
    y: '-=4',
    duration: 170,
    ease: 'Sine.easeOut',
  });

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

      drawButton(hoverColor, 1, isPrimary ? 1 : 0.86);
      title.setColor(UI.colors.goldText);
      glow.setAlpha(1);
    });

    zone.on('pointerout', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      drawButton(baseColor, 0.98, isPrimary ? 0.94 : 0.68);
      title.setColor(textColor);
    });

    zone.on('pointerdown', () => {
      if (isLocked) {
        return;
      }

      isPressed = true;
      drawButton(pressedColor, 0.96, 1, 2);

      this.tweens.add({
        targets: [iconBg, icon, title, subtitle],
        scaleX: 0.97,
        scaleY: 0.97,
        duration: 70,
        ease: 'Sine.easeOut',
      });
    });

    zone.on('pointerup', () => {
      if (!isPressed || isLocked) {
        return;
      }

      isPressed = false;
      isLocked = true;
      drawButton(hoverColor, 1, 1);

      this.tweens.add({
        targets: [iconBg, icon, title, subtitle],
        scaleX: 1,
        scaleY: 1,
        duration: 90,
        ease: 'Back.easeOut',
      });

      this.time.delayedCall(45, () => {
        config.onClick();
      });
    });

    zone.on('pointerupoutside', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      drawButton(baseColor, 0.98, isPrimary ? 0.94 : 0.68);
      title.setColor(textColor);
    });

    zone.on('pointercancel', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      drawButton(baseColor, 0.98, isPrimary ? 0.94 : 0.68);
      title.setColor(textColor);
    });
  }


  if (isPrimary && !disabled) {
    this.tweens.add({
      targets: glow,
      alpha: 0.68,
      duration: 1050,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  return objects;
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

    if (this.consumePlayerStunBeforeAction()) {
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

  this.taintedCorruptionTurns = Math.max(this.taintedCorruptionTurns, 2);
  this.taintedCorruptionDamageBonus = Math.max(this.taintedCorruptionDamageBonus, 0.12);
  this.taintedCorruptionJustApplied = true;

  const corruptionText =
    '\nСкверна полукровки: враг получает на 12% больше урона от следующих атак.';

  const playerActionText =
    lowHp
      ? `Проклятый рывок!\nСкверна усиливает удар.\nТы теряешь ${hpCost} HP и наносишь ${damage} урона.${weaknessText}${corruptionText}`
      : `Проклятый рывок!\nТы теряешь ${hpCost} HP и наносишь ${damage} урона.${weaknessText}${corruptionText}`;

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

  this.demonHellfireBurnTurns = Math.max(this.demonHellfireBurnTurns, 2);
  this.demonHellfireBurnDamage = Math.max(
    this.demonHellfireBurnDamage,
    Math.max(2, Math.floor(stats.attack * 0.3))
  );

  const burnText =
    `\nКровавое пламя: враг будет получать ${this.demonHellfireBurnDamage} урона перед своей атакой 2 хода.`;

  const playerActionText =
    lowHp
      ? `Кровавое пламя!\nДемон теряет ${hpCost} HP и наносит ${damage} урона.${weaknessText}\nНизкое HP усилило пламя.${burnText}`
      : `Кровавое пламя!\nДемон теряет ${hpCost} HP и наносит ${damage} урона.${weaknessText}${burnText}`;

  this.afterPlayerAttack(playerActionText);
}
  private handlePowerAttack() {
    if (this.isBattleEnded || this.isBusy) {
      return;
    }

    if (this.applyDebuffDamageAndCheckDeath()) {
      return;
    }

    if (this.consumePlayerStunBeforeAction()) {
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

    if (this.consumePlayerStunBeforeAction()) {
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

  private tickEnemyRaceEffectsAfterPlayerAttack() {
    const lines: string[] = [];

    if (this.taintedCorruptionTurns > 0) {
      if (this.taintedCorruptionJustApplied) {
        this.taintedCorruptionJustApplied = false;
      } else {
        this.taintedCorruptionTurns = Math.max(0, this.taintedCorruptionTurns - 1);

        if (this.taintedCorruptionTurns > 0) {
          lines.push(`Скверна полукровки: осталось ${this.taintedCorruptionTurns} х.`);
        } else {
          this.taintedCorruptionDamageBonus = 0;
          lines.push('Скверна полукровки рассеялась.');
        }
      }
    }

    return lines.length > 0
      ? `\n${lines.join('\n')}`
      : '';
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

    if (this.taintedCorruptionTurns > 0) {
      multiplier *= 1 + this.taintedCorruptionDamageBonus;
    }

    if (this.tridentDepthMarkTurns > 0) {
      multiplier *= 1 + this.tridentDepthMarkBonus;
      this.tridentDepthMarkTurns = 0;
      this.tridentDepthMarkBonus = 0;
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


  private getPlayerIncomingEffectDamage() {
    let totalDamage = 0;

    this.playerDebuffs.forEach(debuff => {
      if (debuff.id === 'bleeding' || debuff.id === 'poison') {
        const damage = this.hasTreeLevel('hp', 15)
          ? Math.max(1, Math.floor(debuff.power * 0.75))
          : debuff.power;

        totalDamage += damage;
      }
    });

    return Math.max(0, totalDamage);
  }

  private getPlayerIncomingEffectColor() {
    if (this.playerDebuffs.some(debuff => debuff.id === 'poison')) {
      return 0x75d184;
    }

    if (this.playerDebuffs.some(debuff => debuff.id === 'bleeding')) {
      return 0xff6b6b;
    }

    return 0xc084fc;
  }

  private getEnemyIncomingEffectDamage() {
    const bleedDamage = this.enemyBleedTurns > 0 ? Math.max(0, this.enemyBleedDamage) : 0;
    const burnDamage = this.demonHellfireBurnTurns > 0 ? Math.max(0, this.demonHellfireBurnDamage) : 0;

    return bleedDamage + burnDamage;
  }

  private getEnemyIncomingEffectColor() {
    if (this.demonHellfireBurnTurns > 0 && this.demonHellfireBurnDamage > 0) {
      return 0xff6b35;
    }

    if (this.enemyBleedTurns > 0 && this.enemyBleedDamage > 0) {
      return 0xff6b6b;
    }

    return 0xc084fc;
  }

  private updateHpPreviewBar(config: {
    bar?: Phaser.GameObjects.Rectangle;
    maxWidth: number;
    currentHp: number;
    maxHp: number;
    damage: number;
    color: number;
  }) {
    const { bar, maxWidth, currentHp, maxHp, damage, color } = config;

    if (!bar || maxHp <= 0 || damage <= 0 || currentHp <= 0) {
      bar?.setVisible(false);
      return;
    }

    const hpRatio = Phaser.Math.Clamp(currentHp / maxHp, 0, 1);
    const damageRatio = Phaser.Math.Clamp(damage / maxHp, 0, hpRatio);
    const currentWidth = maxWidth * hpRatio;
    const damageWidth = Math.max(3, maxWidth * damageRatio);
    const startX = typeof bar.getData('barStartX') === 'number'
      ? bar.getData('barStartX') as number
      : -maxWidth / 2;

    bar.setVisible(true);
    bar.setFillStyle(color, 0.78);
    bar.x = startX + Math.max(0, currentWidth - damageWidth);
    bar.displayWidth = damageWidth;
  }

  private updateHpPreviewBars(stats = this.getBattleStats()) {
    this.updateHpPreviewBar({
      bar: this.playerHpPreviewBar,
      maxWidth: this.playerHpBarMaxWidth,
      currentHp: player.hp,
      maxHp: stats.maxHp,
      damage: this.getPlayerIncomingEffectDamage(),
      color: this.getPlayerIncomingEffectColor(),
    });

    this.updateHpPreviewBar({
      bar: this.enemyHpPreviewBar,
      maxWidth: this.enemyHpBarMaxWidth,
      currentHp: this.enemy.hp,
      maxHp: this.enemy.maxHp,
      damage: this.getEnemyIncomingEffectDamage(),
      color: this.getEnemyIncomingEffectColor(),
    });
  }

  private getEnemyStunChance() {
    const room = getCurrentRoom();
    const isBoss = room?.type === 'boss' || room?.type === 'tier_boss';
    const isElite = room?.type === 'elite';

    let chance = isBoss ? 0.08 : isElite ? 0.12 : 0.07;

    if (this.enemy.debuffOnHit) {
      chance += 0.03;
    }

    return Phaser.Math.Clamp(chance, 0, 0.16);
  }

  private tryApplyEnemyStunOnHit(damage: number) {
    if (damage <= 0 || player.hp <= 0 || this.playerStunTurns > 0) {
      return '';
    }

    const chance = this.getEnemyStunChance();

    if (Math.random() >= chance) {
      return '';
    }

    this.playerStunTurns = 1;

    this.showFloatingText(
      this.playerCard.x,
      this.playerCard.y - 94,
      'ОГЛУШЕНИЕ',
      '#f0d58a'
    );

    this.shakeBattle(0.004, 130);
    this.renderPlayerEffectChips();

    return `\nОглушение: следующий ход героя будет пропущен.`;
  }

  private consumePlayerStunBeforeAction() {
    if (this.playerStunTurns <= 0) {
      return false;
    }

    this.playerStunTurns = 0;
    this.isBusy = true;

    const text = 'Ты оглушён и не успеваешь действовать. Враг получает возможность ударить снова.';

    this.logText.setText(text);
    this.showFloatingText(
      this.playerCard.x,
      this.playerCard.y - 92,
      'ПРОПУСК ХОДА',
      '#f0d58a'
    );
    this.updateTexts();
    this.createActionButtons();

    this.time.delayedCall(480, () => {
      this.enemyTurn(text, false);
    });

    return true;
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

    const enemyRaceEffectText = this.tickEnemyRaceEffectsAfterPlayerAttack();

    if (enemyRaceEffectText) {
      playerActionText += enemyRaceEffectText;
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

  private applyHellfireBeforeEnemyTurn(playerActionText: string): string | undefined {
    if (this.demonHellfireBurnTurns <= 0 || this.demonHellfireBurnDamage <= 0) {
      return playerActionText;
    }

    const burnDamage = this.demonHellfireBurnDamage;

    this.demonHellfireBurnTurns -= 1;

    this.damageEnemy(burnDamage);
    this.updateTexts();

    const burnText =
      `${playerActionText}\n\n` +
      `Кровавое пламя наносит ${burnDamage} урона.` +
      `${this.demonHellfireBurnTurns > 0 ? `\nКровавое пламя осталось: ${this.demonHellfireBurnTurns} х.` : ''}`;

    if (this.demonHellfireBurnTurns <= 0) {
      this.demonHellfireBurnDamage = 0;
    }

    if (this.enemy.hp <= 0) {
      this.handleVictory(burnText);
      return undefined;
    }

    return burnText;
  }

  private createBattleBackground(isBoss = false) {
    const layout = this.getBattleLayout();
    const { width, height, centerX } = layout;
    const floor = gameState.floorRun.currentFloor || 1;
    const theme = getCryptDepthTheme(floor);

    this.add.rectangle(centerX, height / 2, width, height, 0x030405, 1).setDepth(0);
    this.add.rectangle(centerX, height / 2, width, height, theme.background, 0.38).setDepth(0);
    this.add.rectangle(centerX, height / 2, width, height, isBoss ? 0x260706 : 0x06101b, isBoss ? 0.14 : 0.08).setDepth(0);

    const arenaLeft = centerX - layout.arenaWidth / 2;
    const arenaTop = layout.arenaTop;
    const arenaHeight = Math.max(260, layout.arenaBottom - layout.arenaTop);

    const wall = this.add.graphics().setDepth(1);
    wall.fillStyle(0x07090d, 0.98);
    wall.fillRoundedRect(arenaLeft, arenaTop, layout.arenaWidth, arenaHeight, 30);
    wall.fillStyle(isBoss ? 0x250908 : 0x071323, 0.22);
    wall.fillRoundedRect(arenaLeft + 8, arenaTop + 8, layout.arenaWidth - 16, arenaHeight - 16, 24);
    wall.lineStyle(2, isBoss ? 0x70301e : 0x314052, 0.58);
    wall.strokeRoundedRect(arenaLeft, arenaTop, layout.arenaWidth, arenaHeight, 30);

    const backArch = this.add.graphics().setDepth(2);
    const archCenterY = arenaTop + arenaHeight * 0.34;
    backArch.lineStyle(layout.veryCompact ? 12 : 16, 0x11151b, 0.94);
    backArch.strokeCircle(centerX, archCenterY, layout.arenaWidth * 0.36);
    backArch.fillStyle(0x000000, 0.20);
    backArch.fillRect(arenaLeft + 30, archCenterY, layout.arenaWidth - 60, arenaHeight * 0.42);

    const brickRows = layout.veryCompact ? 5 : 7;
    const brickHeight = layout.veryCompact ? 17 : 22;
    const brickWidth = Math.min(84, layout.arenaWidth / 6.6);

    for (let row = 0; row < brickRows; row += 1) {
      const count = row % 2 === 0 ? 6 : 7;
      const y = arenaTop + 18 + row * (brickHeight + 8);

      for (let i = 0; i < count; i += 1) {
        const x = centerX - ((count - 1) * brickWidth) / 2 + i * brickWidth + (row % 2 === 0 ? 0 : -brickWidth * 0.25);
        this.add.rectangle(x, y, brickWidth - 7, brickHeight, 0x141820, 0.22)
          .setStrokeStyle(1, isBoss ? 0x5c2017 : 0x253142, 0.2)
          .setDepth(2);
      }
    }

    const floorTop = arenaTop + arenaHeight * 0.50;
    const floorGraphics = this.add.graphics().setDepth(3);
    floorGraphics.fillStyle(0x080706, 0.84);
    floorGraphics.fillRoundedRect(arenaLeft + 12, floorTop, layout.arenaWidth - 24, arenaHeight - (floorTop - arenaTop) - 12, 22);
    floorGraphics.lineStyle(1, 0x5e4630, 0.35);
    floorGraphics.strokeRoundedRect(arenaLeft + 12, floorTop, layout.arenaWidth - 24, arenaHeight - (floorTop - arenaTop) - 12, 22);

    for (let i = 0; i < 8; i += 1) {
      const xTop = arenaLeft + 30 + i * ((layout.arenaWidth - 60) / 7);
      const xBottom = arenaLeft + 6 + i * ((layout.arenaWidth - 12) / 7);
      this.add.line(0, 0, xTop, floorTop + 6, xBottom, layout.arenaBottom - 18, 0x2d251e, 0.38)
        .setOrigin(0, 0)
        .setDepth(4);
    }

    const centerRune = this.add.graphics().setDepth(4);
    centerRune.lineStyle(2, isBoss ? 0x6a1d16 : 0x2f4f7a, isBoss ? 0.20 : 0.16);
    centerRune.strokeCircle(centerX, floorTop + (layout.arenaBottom - floorTop) * 0.35, layout.arenaWidth * 0.22);
    centerRune.lineStyle(1, 0xb9985b, 0.10);
    centerRune.strokeCircle(centerX, floorTop + (layout.arenaBottom - floorTop) * 0.35, layout.arenaWidth * 0.30);

    const enemyGlow = this.add.circle(layout.enemyX, layout.enemyY + 24, layout.veryCompact ? 100 : 132, isBoss ? 0x8d1e17 : 0x5c120d, isBoss ? 0.18 : 0.11).setDepth(4);
    const playerGlow = this.add.circle(layout.playerX, layout.playerY + 22, layout.veryCompact ? 94 : 124, 0x18416a, 0.14).setDepth(4);

    this.tweens.add({
      targets: [enemyGlow, playerGlow],
      alpha: '+=0.06',
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const enemyShadow = this.add.ellipse(layout.enemyX, layout.enemyY + (layout.veryCompact ? 54 : 66), layout.veryCompact ? 112 : 150, layout.veryCompact ? 34 : 44, 0x000000, 0.44).setDepth(5);
    const playerShadow = this.add.ellipse(layout.playerX, layout.playerY + (layout.veryCompact ? 54 : 66), layout.veryCompact ? 112 : 150, layout.veryCompact ? 34 : 44, 0x000000, 0.42).setDepth(5);

    this.tweens.add({
      targets: [enemyShadow, playerShadow],
      scaleX: 1.06,
      alpha: 0.52,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const leftTorchX = arenaLeft + 38;
    const rightTorchX = arenaLeft + layout.arenaWidth - 38;
    [leftTorchX, rightTorchX].forEach((torchX, index) => {
      const torchY = arenaTop + arenaHeight * 0.30;
      this.add.rectangle(torchX, torchY + 22, 12, 42, 0x18100c, 0.8)
        .setStrokeStyle(1, 0x5e4630, 0.45)
        .setDepth(5);
      const flame = this.add.circle(torchX, torchY, layout.veryCompact ? 10 : 13, index === 0 ? 0x3f8fca : 0xff6b35, 0.32)
        .setDepth(6);
      this.tweens.add({
        targets: flame,
        alpha: 0.56,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 760 + index * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    for (let i = 0; i < 30; i += 1) {
      const x = arenaLeft + 20 + (i * 59) % Math.max(1, layout.arenaWidth - 40);
      const y = arenaTop + 16 + (i * 71) % Math.max(1, arenaHeight - 30);
      const dust = this.add.circle(x, y, 1 + (i % 3), i % 4 === 0 ? theme.accent : 0xd8b56d, 0.025 + (i % 5) * 0.005)
        .setDepth(7);
      this.tweens.add({
        targets: dust,
        y: y - Phaser.Math.Between(8, 20),
        alpha: '+=0.02',
        duration: Phaser.Math.Between(1800, 3400),
        yoyo: true,
        repeat: -1,
        delay: i * 45,
        ease: 'Sine.easeInOut',
      });
    }

    if (isBoss) {
      this.add.rectangle(centerX, height / 2, width, height, 0x3a0505, 0.08).setDepth(7);
      const dangerLine = this.add.rectangle(centerX, layout.arenaTop + 6, layout.arenaWidth - 44, 2, 0xff6b35, 0.38).setDepth(8);
      this.tweens.add({
        targets: dangerLine,
        alpha: 0.7,
        duration: 680,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.add.rectangle(10, height / 2, 20, height, 0x000000, 0.34).setDepth(9);
    this.add.rectangle(width - 10, height / 2, 20, height, 0x000000, 0.34).setDepth(9);
    this.add.rectangle(centerX, height - 36, width, 72, 0x000000, 0.22).setDepth(9);
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
    const container = this.add.container(x, y).setDepth(isEnemy ? 32 : 33);
    container.setData('baseX', x);
    container.setData('baseY', y);

    const scale = layout.spriteScale * (isEnemy && isBoss ? 1.1 : 1);
    const panelWidth = Phaser.Math.Clamp(Math.round(layout.contentWidth * (layout.veryCompact ? 0.54 : 0.56)), 190, 310);
    const panelHeight = isEnemy
      ? layout.veryCompact ? 84 : layout.compact ? 108 : 122
      : layout.veryCompact ? 100 : layout.compact ? 126 : 142;
    const gap = layout.veryCompact ? 18 : 26;
    const panelX = isEnemy ? -(panelWidth / 2 + gap) : panelWidth / 2 + gap;
    const panelY = isEnemy ? -(layout.veryCompact ? 12 : 20) : layout.veryCompact ? 4 : 8;
    const panelLeft = panelX - panelWidth / 2;
    const panelTop = panelY - panelHeight / 2;

    const accentColor = isEnemy ? (isBoss ? 0xff6b35 : 0xff6b6b) : 0x70a6ff;
    const titleColor = isEnemy ? '#ffd0c2' : '#9fd0ff';
    const panelColor = isEnemy ? (isBoss ? 0x160706 : 0x10090a) : 0x07111e;
    const strokeColor = isEnemy ? (isBoss ? 0xb84a2f : 0x8d2f2f) : 0x426f9f;

    if (isEnemy) {
      this.createEnemyBattleSprite(container, scale, isBoss);
    } else {
      this.createPlayerBattleSprite(container, scale);
    }

    const panelShadow = this.add.graphics();
    panelShadow.fillStyle(0x000000, 0.42);
    panelShadow.fillRoundedRect(panelLeft, panelTop + 5, panelWidth, panelHeight, 18);

    const panelBg = this.add.graphics();
    panelBg.fillStyle(panelColor, 0.96);
    panelBg.fillRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, 18);
    panelBg.fillStyle(color, isEnemy ? 0.24 : 0.20);
    panelBg.fillRoundedRect(panelLeft + 7, panelTop + 7, panelWidth - 14, panelHeight - 14, 13);
    panelBg.lineStyle(isBoss ? 2 : 1.5, strokeColor, isBoss ? 0.9 : 0.62);
    panelBg.strokeRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, 18);
    panelBg.lineStyle(1, 0xf0d58a, isEnemy ? 0.14 : 0.12);
    panelBg.strokeRoundedRect(panelLeft + 6, panelTop + 6, panelWidth - 12, panelHeight - 12, 13);

    const badgeX = panelLeft + 18;
    const badgeY = panelTop + 20;
    const badge = this.add.circle(badgeX, badgeY, layout.veryCompact ? 13 : 15, isEnemy ? 0x260a08 : 0x0a1a2c, 0.96)
      .setStrokeStyle(1, accentColor, 0.55);
    const badgeText = this.add.text(badgeX, badgeY, isEnemy ? (isBoss ? '♛' : '☠') : icon, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '11px' : '13px',
      color: isEnemy ? '#ffb08a' : '#b9d8ff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    const titleX = panelLeft + (layout.veryCompact ? 36 : 42);
    const nameText = this.add.text(titleX, panelTop + 20, name, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '14px' : layout.compact ? '16px' : '18px',
      color: titleColor,
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: panelWidth - (layout.veryCompact ? 50 : 58),
        useAdvancedWrap: true,
      },
      maxLines: isEnemy ? 2 : 1,
      lineSpacing: -4,
    }).setOrigin(0, 0.5);

    const hpText = this.add.text(panelLeft + 14, panelTop + (isEnemy ? panelHeight * 0.46 : panelHeight * 0.36), '', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '12px' : '14px',
      color: isEnemy ? '#ffd0c2' : UI.colors.text,
      wordWrap: {
        width: panelWidth - 28,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    const barWidth = panelWidth - 28;
    const hpBarX = panelLeft + 14;
    const hpBarY = panelTop + (isEnemy ? panelHeight * 0.63 : panelHeight * 0.50);
    const hpBarHeight = layout.veryCompact ? 9 : 11;

    const hpBack = this.add.rectangle(hpBarX + barWidth / 2, hpBarY, barWidth, hpBarHeight, 0x020202, 0.95)
      .setStrokeStyle(1, 0x000000, 0.85);
    const hpBar = this.add.rectangle(hpBarX, hpBarY, barWidth, hpBarHeight, isEnemy ? 0xff5f5f : 0x75d184, 0.98)
      .setOrigin(0, 0.5);
    const hpPreviewBar = this.add.rectangle(hpBarX, hpBarY, 1, hpBarHeight, 0xf0d58a, 0.72)
      .setOrigin(0, 0.5)
      .setVisible(false);
    hpPreviewBar.setData('barStartX', hpBarX);
    const hpFrame = this.add.rectangle(hpBarX + barWidth / 2, hpBarY, barWidth, hpBarHeight)
      .setStrokeStyle(1, 0x000000, 0.9);

    const statY = panelTop + (isEnemy ? panelHeight - (layout.veryCompact ? 18 : 22) : panelHeight - (layout.veryCompact ? 38 : 44));
    const extraText = this.add.text(panelLeft + 14, statY, '', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '12px',
      color: '#b8aa91',
      wordWrap: {
        width: panelWidth - 28,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    container.add([
      panelShadow,
      panelBg,
      badge,
      badgeText,
      nameText,
      hpText,
      hpBack,
      hpBar,
      hpPreviewBar,
      hpFrame,
      extraText,
    ]);

    if (isEnemy) {
      this.enemyHpText = hpText;
      this.enemyHpBar = hpBar;
      this.enemyHpPreviewBar = hpPreviewBar;
      this.enemyHpBarMaxWidth = barWidth;
      extraText.setText(`⚔ АТК ${this.enemy.attack}   ◈ ЗАЩ ${this.enemy.defense}`);

      const enemyHoverZone = this.add.zone(panelX, panelY, panelWidth, panelHeight)
        .setInteractive({ useHandCursor: true });
      enemyHoverZone.on('pointerup', () => this.showEnemyTooltip());
      container.add(enemyHoverZone);

      container.setData('effectX', panelX);
      container.setData('effectY', panelY + panelHeight / 2 + (layout.veryCompact ? 18 : 22));
      container.setData('effectWidth', panelWidth);

      if (isBoss) {
        const bossGlow = this.add.circle(0, 6, layout.veryCompact ? 68 : 82, 0xff3a25, 0.08);
        container.addAt(bossGlow, 0);
        this.tweens.add({
          targets: bossGlow,
          alpha: 0.18,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: 760,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    } else {
      this.playerHpText = hpText;
      this.playerHpBar = hpBar;
      this.playerHpPreviewBar = hpPreviewBar;
      this.playerHpBarMaxWidth = barWidth;
      this.energyText = extraText;

      const energyY = panelTop + panelHeight * 0.64;
      const energyBack = this.add.rectangle(hpBarX + barWidth / 2, energyY, barWidth, layout.veryCompact ? 7 : 8, 0x020202, 0.95)
        .setStrokeStyle(1, 0x000000, 0.75);
      const energyBar = this.add.rectangle(hpBarX, energyY, barWidth, layout.veryCompact ? 7 : 8, 0x70a6ff, 0.98)
        .setOrigin(0, 0.5);
      this.energyBar = energyBar;
      this.energyBarMaxWidth = barWidth;

      const stats = this.getBattleStats();
      const statLine = this.add.text(panelLeft + 14, panelTop + panelHeight - (layout.veryCompact ? 18 : 21), `⚔ ${stats.attack}   ◈ ${stats.defense}   ✦ ${Math.round(stats.critChance * 100)}%`, {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '10px' : '12px',
        color: '#c8bfae',
        wordWrap: {
          width: panelWidth - 28,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5);

      this.potionText = this.add.text(panelLeft + panelWidth - 14, panelTop + 20, `Зелья: ${player.potions}`, {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '10px' : '12px',
        color: '#9bd89f',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: {
          width: panelWidth - 76,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5);

      this.playerDebuffText = this.add.text(panelLeft + 14, panelTop + panelHeight + 12, '', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '9px' : '11px',
        color: '#c084fc',
        wordWrap: {
          width: panelWidth - 28,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setVisible(false);

      const playerHoverZone = this.add.zone(panelX, panelY, panelWidth, panelHeight)
        .setInteractive({ useHandCursor: true });
      playerHoverZone.on('pointerup', () => this.showPlayerTooltip());
      container.add([energyBack, energyBar, statLine, this.potionText, this.playerDebuffText, playerHoverZone]);

      container.setData('effectX', panelX);
      container.setData('effectY', panelY + panelHeight / 2 + (layout.veryCompact ? 16 : 20));
      container.setData('effectWidth', panelWidth);
    }

    return container;
  }

  private createEnemyBattleSprite(parent: Phaser.GameObjects.Container, scale: number, isBoss: boolean) {
    const sprite = this.add.graphics();
    const s = scale;

    sprite.fillStyle(0x000000, 0.38);
    sprite.fillEllipse(0, 54 * s, 96 * s, 30 * s);

    sprite.lineStyle(5 * s, isBoss ? 0x3a0b08 : 0x1c1110, 1);
    sprite.lineBetween(24 * s, -12 * s, 66 * s, -64 * s);
    sprite.lineStyle(2 * s, 0xb9b2a7, 0.85);
    sprite.strokeTriangle(52 * s, -76 * s, 82 * s, -62 * s, 58 * s, -44 * s);
    sprite.fillStyle(0x4d1612, 0.9);
    sprite.fillTriangle(52 * s, -76 * s, 82 * s, -62 * s, 58 * s, -44 * s);

    sprite.fillStyle(0x100d0d, 1);
    sprite.fillTriangle(-34 * s, -30 * s, 32 * s, -30 * s, 48 * s, 50 * s);
    sprite.fillStyle(0x26100d, 0.95);
    sprite.fillTriangle(-28 * s, -26 * s, 22 * s, -26 * s, 10 * s, 42 * s);
    sprite.lineStyle(2 * s, 0x6a1e16, 0.9);
    sprite.lineBetween(-34 * s, -30 * s, 48 * s, 50 * s);
    sprite.lineBetween(32 * s, -30 * s, -18 * s, 50 * s);

    sprite.fillStyle(0x2b2d32, 1);
    sprite.fillRoundedRect(-24 * s, -22 * s, 48 * s, 58 * s, 8 * s);
    sprite.lineStyle(2 * s, 0x7b6750, 0.7);
    sprite.strokeRoundedRect(-24 * s, -22 * s, 48 * s, 58 * s, 8 * s);

    sprite.fillStyle(0x080808, 1);
    sprite.fillTriangle(-26 * s, -54 * s, 26 * s, -54 * s, 34 * s, -10 * s);
    sprite.lineStyle(2 * s, 0x6a1e16, 0.85);
    sprite.strokeTriangle(-26 * s, -54 * s, 26 * s, -54 * s, 34 * s, -10 * s);

    sprite.fillStyle(0xd2c6ad, 1);
    sprite.fillCircle(0, -32 * s, 13 * s);
    sprite.fillStyle(0x070707, 1);
    sprite.fillCircle(-5 * s, -34 * s, 3 * s);
    sprite.fillCircle(5 * s, -34 * s, 3 * s);
    sprite.fillRect(-5 * s, -27 * s, 10 * s, 2 * s);

    sprite.lineStyle(7 * s, 0x17191d, 1);
    sprite.lineBetween(-18 * s, 38 * s, -24 * s, 58 * s);
    sprite.lineBetween(18 * s, 38 * s, 24 * s, 58 * s);
    sprite.lineStyle(2 * s, 0x7b6750, 0.75);
    sprite.lineBetween(-18 * s, 38 * s, -24 * s, 58 * s);
    sprite.lineBetween(18 * s, 38 * s, 24 * s, 58 * s);

    sprite.fillStyle(isBoss ? 0xff3a25 : 0xff6b6b, isBoss ? 0.16 : 0.10);
    sprite.fillCircle(0, 4 * s, 70 * s);

    parent.add(sprite);
  }

  private createPlayerBattleSprite(parent: Phaser.GameObjects.Container, scale: number) {
    const sprite = this.add.graphics();
    const s = scale;

    sprite.fillStyle(0x000000, 0.36);
    sprite.fillEllipse(0, 56 * s, 102 * s, 30 * s);

    sprite.lineStyle(5 * s, 0x8ca4b7, 0.95);
    sprite.lineBetween(-44 * s, 16 * s, -74 * s, 62 * s);
    sprite.lineStyle(2 * s, 0xd8e6ff, 0.75);
    sprite.lineBetween(-44 * s, 16 * s, -74 * s, 62 * s);

    sprite.fillStyle(0x2b3138, 1);
    sprite.fillRoundedRect(-26 * s, -24 * s, 52 * s, 62 * s, 9 * s);
    sprite.lineStyle(2 * s, 0x86a7c9, 0.72);
    sprite.strokeRoundedRect(-26 * s, -24 * s, 52 * s, 62 * s, 9 * s);

    sprite.fillStyle(0x44515c, 1);
    sprite.fillCircle(0, -44 * s, 18 * s);
    sprite.fillStyle(0x0a1018, 1);
    sprite.fillRect(-13 * s, -46 * s, 26 * s, 5 * s);
    sprite.lineStyle(2 * s, 0x93b9d8, 0.65);
    sprite.strokeCircle(0, -44 * s, 18 * s);

    sprite.fillStyle(0x172f4c, 0.95);
    sprite.fillTriangle(-16 * s, 38 * s, 16 * s, 38 * s, 0, 70 * s);
    sprite.lineStyle(3 * s, 0x232a32, 1);
    sprite.lineBetween(-18 * s, 36 * s, -26 * s, 60 * s);
    sprite.lineBetween(18 * s, 36 * s, 26 * s, 60 * s);

    sprite.fillStyle(0x1d2732, 1);
    sprite.fillRoundedRect(28 * s, -8 * s, 34 * s, 54 * s, 9 * s);
    sprite.lineStyle(2 * s, 0x70a6ff, 0.75);
    sprite.strokeRoundedRect(28 * s, -8 * s, 34 * s, 54 * s, 9 * s);
    sprite.lineStyle(2 * s, 0x70a6ff, 0.82);
    sprite.lineBetween(45 * s, 2 * s, 45 * s, 34 * s);
    sprite.lineBetween(34 * s, 16 * s, 56 * s, 16 * s);

    sprite.fillStyle(0x70a6ff, 0.15);
    sprite.fillCircle(0, 2 * s, 64 * s);
    sprite.fillStyle(0x70a6ff, 0.95);
    sprite.fillTriangle(-6 * s, -2 * s, 0, -12 * s, 6 * s, -2 * s);
    sprite.fillTriangle(-6 * s, -2 * s, 0, 8 * s, 6 * s, -2 * s);

    parent.add(sprite);
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

  const activeEnemyEffects = this.getActiveEnemyEffectsForUi();

  const activeEffectsText = activeEnemyEffects.length > 0
    ? activeEnemyEffects
        .map(effect => {
          return `${this.getDebuffIcon(effect.id)} ${effect.name} — ${effect.duration} х.\n${this.getDebuffShortDescription(effect.id, effect.power)}`;
        })
        .join('\n\n')
    : 'На враге нет активных эффектов.';

  const dangerText = this.isBossBattle
    ? 'УРОВЕНЬ УГРОЗЫ: БОСС. Ошибка может стоить забега.'
    : 'УРОВЕНЬ УГРОЗЫ: обычный противник.';

  const description =
    `${dangerText}\n\n` +
    `Боевые параметры:\n` +
    `АТК ${this.enemy.attack}  •  ЗАЩ ${this.enemy.defense}  •  HP ${this.enemy.hp}/${this.enemy.maxHp}\n\n` +
    `Слабости:\n${weaknessText}\n\n` +
    `Сопротивления:\n${resistanceText}\n\n` +
    `Активные эффекты на враге:\n${activeEffectsText}\n\n` +
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


private getDebuffColor(id: string) {
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
  if (id === 'goblin_mark') return 0xf0a040;
  if (id === 'tainted_corruption') return 0xc084fc;
  if (id === 'hellfire_burn') return 0xff6b35;
  if (id === 'black_water_grip') return 0x70a6ff;
  if (id === 'player_stun') return 0xf0d58a;

  return UI.colors.gold;
}

private renderPlayerEffectChips() {
  this.playerEffectObjects.forEach(object => object.destroy());
  this.playerEffectObjects = [];

  const effects: {
    id: string;
    name: string;
    duration: number;
    power: number;
  }[] = this.playerDebuffs.map(debuff => ({
    ...debuff,
  }));

  if (this.playerStunTurns > 0) {
    effects.unshift({
      id: 'player_stun',
      name: 'Оглушение',
      duration: this.playerStunTurns,
      power: 0,
    });
  }

  if (effects.length === 0) {
    return;
  }

  const layout = this.getBattleLayout();
  const baseX = typeof this.playerCard.getData('effectX') === 'number'
    ? this.playerCard.getData('effectX') as number
    : 0;
  const y = typeof this.playerCard.getData('effectY') === 'number'
    ? this.playerCard.getData('effectY') as number
    : 86;
  const availableWidth = typeof this.playerCard.getData('effectWidth') === 'number'
    ? this.playerCard.getData('effectWidth') as number
    : layout.contentWidth * 0.5;
  const visibleCount = Math.min(effects.length, 2);
  const chipWidth = Math.min(118, (availableWidth - 8) / visibleCount);
  const totalWidth = visibleCount * chipWidth + Math.max(0, visibleCount - 1) * 8;
  const startX = baseX - totalWidth / 2 + chipWidth / 2;

  effects.slice(0, 2).forEach((effect, index) => {
    const x = startX + index * (chipWidth + 8);

    this.createEffectChip({
      parent: this.playerCard,
      x,
      y,
      width: chipWidth,
      height: 30,
      text: `${effect.name} ${effect.duration}`,
      icon: this.getDebuffIcon(effect.id),
      color: this.getDebuffColor(effect.id),
      tooltipTitle: effect.name,
      tooltipDescription:
        `${this.getDebuffShortDescription(effect.id, effect.power)}\n` +
        `Осталось ходов: ${effect.duration}.`,
      targetArray: this.playerEffectObjects,
    });
  });
}


private getActiveEnemyEffectsForUi() {
  const effects: {
    id: string;
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

  if (this.goblinGreedyMarkTurns > 0) {
    effects.push({
      id: 'goblin_mark',
      name: 'Воровская метка',
      duration: this.goblinGreedyMarkTurns,
      power: 20,
    });
  }

  if (this.taintedCorruptionTurns > 0) {
    effects.push({
      id: 'tainted_corruption',
      name: 'Скверна',
      duration: this.taintedCorruptionTurns,
      power: Math.round(this.taintedCorruptionDamageBonus * 100),
    });
  }

  if (this.demonHellfireBurnTurns > 0) {
    effects.push({
      id: 'hellfire_burn',
      name: 'Кровавое пламя',
      duration: this.demonHellfireBurnTurns,
      power: this.demonHellfireBurnDamage,
    });
  }

  if (this.tridentDepthMarkTurns > 0) {
    effects.push({
      id: 'black_water_grip',
      name: 'Хватка воды',
      duration: this.tridentDepthMarkTurns,
      power: Math.round(this.tridentDepthMarkBonus * 100),
    });
  }

  return effects;
}

private renderEnemyEffectChips() {
  this.enemyEffectObjects.forEach(object => object.destroy());
  this.enemyEffectObjects = [];

  const effects = this.getActiveEnemyEffectsForUi();

  if (effects.length === 0) {
    return;
  }

  const layout = this.getBattleLayout();
  const baseX = typeof this.enemyCard.getData('effectX') === 'number'
    ? this.enemyCard.getData('effectX') as number
    : 0;
  const y = typeof this.enemyCard.getData('effectY') === 'number'
    ? this.enemyCard.getData('effectY') as number
    : 76;
  const availableWidth = typeof this.enemyCard.getData('effectWidth') === 'number'
    ? this.enemyCard.getData('effectWidth') as number
    : layout.contentWidth * 0.5;
  const visibleCount = Math.min(effects.length, 2);
  const chipWidth = Math.min(124, (availableWidth - 8) / visibleCount);
  const totalWidth = visibleCount * chipWidth + Math.max(0, visibleCount - 1) * 8;
  const startX = baseX - totalWidth / 2 + chipWidth / 2;

  effects.slice(0, 2).forEach((effect, index) => {
    const x = startX + index * (chipWidth + 8);

    this.createEffectChip({
      parent: this.enemyCard,
      x,
      y,
      width: chipWidth,
      height: 30,
      text: `${effect.name} ${effect.duration}`,
      icon: this.getDebuffIcon(effect.id),
      color: this.getDebuffColor(effect.id),
      tooltipTitle: effect.name,
      tooltipDescription:
        `${this.getDebuffShortDescription(effect.id, effect.power)}\n` +
        `Осталось ходов: ${effect.duration}.`,
      targetArray: this.enemyEffectObjects,
    });
  });

  if (effects.length > 2) {
    this.createEffectChip({
      parent: this.enemyCard,
      x: startX + visibleCount * (chipWidth + 8),
      y,
      width: 42,
      height: 30,
      text: `+${effects.length - 2}`,
      icon: '•',
      color: UI.colors.gold,
      tooltipTitle: 'Другие эффекты',
      tooltipDescription: effects
        .slice(2)
        .map(effect => `${effect.name}: ${effect.duration} х.`)
        .join('\n'),
      targetArray: this.enemyEffectObjects,
    });
  }
}


  private getEnemyTagText(tag: string) {
  if (tag === 'dagger') return 'кинжал';
  if (tag === 'axe') return 'топор';
  if (tag === 'katana') return 'катана';
  if (tag === 'hammer') return 'молот';
  if (tag === 'shield_sword') return 'щит-меч';
  if (tag === 'spear') return 'копьё';
  if (tag === 'trident') return 'трезубец';
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

    if (this.taintedCorruptionTurns > 0) {
      statuses.push(`Скверна: ${this.taintedCorruptionTurns} х.`);
    }

    if (this.demonHellfireBurnTurns > 0) {
      statuses.push(`Кровавое пламя: ${this.demonHellfireBurnTurns} х.`);
    }

    if (this.demonRageStacks > 0) {
      statuses.push(`Адская ярость: +${this.demonRageStacks}%`);
    }

    if (this.tridentDepthMarkTurns > 0) {
      statuses.push('Хватка чёрной воды');
    }

    if (this.playerDebuffs.length > 0) {
      statuses.push(`Эффекты: ${this.playerDebuffs.length}`);
    }

    const visibleStatuses = statuses.slice(0, 2);
    const hiddenStatuses = statuses.length - visibleStatuses.length;

    this.statusText.setText(
      statuses.length > 0
        ? `${visibleStatuses.join('  •  ')}${hiddenStatuses > 0 ? `  •  +${hiddenStatuses}` : ''}`
        : 'Нет эффектов'
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
    const isDamage = text.trim().startsWith('-');
    const isHeal = text.trim().startsWith('+');
    const isControl = text.toUpperCase().includes('ОГЛУШ') || text.toUpperCase().includes('УКЛОН');

    const offsetX = Phaser.Math.Between(-16, 16);
    const startY = y + Phaser.Math.Between(-4, 8);
    const fontSize = isDamage ? 38 : isHeal ? 34 : 25;

    const floatingText = this.add.text(x + offsetX, startY, text, {
      fontFamily: UI.font.title,
      fontSize: `${fontSize}px`,
      color,
      stroke: '#000000',
      strokeThickness: isDamage ? 6 : 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(260).setScale(0.58).setAlpha(0);

    if (isDamage || isHeal || isControl) {
      this.createImpactBurst(x + offsetX, startY + 12, Phaser.Display.Color.HexStringToColor(color).color, isHeal);
    }

    this.tweens.add({
      targets: floatingText,
      alpha: 1,
      scale: 1.12,
      y: startY - 22,
      duration: 120,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: floatingText,
          y: startY - 86,
          x: x + offsetX + Phaser.Math.Between(-14, 14),
          alpha: 0,
          scale: 0.92,
          duration: 760,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            floatingText.destroy();
          },
        });
      },
    });
  }

  private createImpactBurst(
    x: number,
    y: number,
    color: number,
    isHeal = false
  ) {
    const burstCount = isHeal ? 5 : 7;

    for (let i = 0; i < burstCount; i += 1) {
      const angle = Phaser.Math.DegToRad(Phaser.Math.Between(205, 335));
      const distance = Phaser.Math.Between(18, isHeal ? 32 : 46);
      const particle = this.add.circle(
        x,
        y,
        Phaser.Math.Between(2, isHeal ? 3 : 4),
        color,
        isHeal ? 0.45 : 0.62
      ).setDepth(248);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.35,
        duration: Phaser.Math.Between(260, 420),
        ease: 'Cubic.easeOut',
        onComplete: () => {
          particle.destroy();
        },
      });
    }

    const flash = this.add.circle(x, y, isHeal ? 18 : 22, color, isHeal ? 0.08 : 0.12)
      .setDepth(247)
      .setScale(0.35);

    this.tweens.add({
      targets: flash,
      scale: 1.25,
      alpha: 0,
      duration: 240,
      ease: 'Sine.easeOut',
      onComplete: () => {
        flash.destroy();
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
      x: baseX + 30,
      y: baseY - 14,
      duration: 95,
      ease: 'Power2',
      yoyo: true,
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
      x: baseX - 30,
      y: baseY + 14,
      duration: 95,
      ease: 'Power2',
      yoyo: true,
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

    if (this.consumePlayerStunBeforeAction()) {
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

    if (weaponType === 'spear') {
      this.handleSpearAttack();
      return;
    }

    if (weaponType === 'trident') {
      this.handleTridentAttack();
      return;
    }

    this.handleSwordAttack();
  }


  private handleSpearAttack() {
    const stats = this.getBattleStats();
    const pierceChance = this.enemyBleedTurns > 0 ? 0.30 : 0.20;
    const pierced = Math.random() < pierceChance;

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: 1.05,
      varianceMin: -2,
      varianceMax: 3,
      isBasicAttack: true,
    });

    const pierceBonus = pierced
      ? Math.max(1, Math.floor(this.enemy.defense * 0.25))
      : 0;

    const isCrit = this.rollPlayerCrit(stats.critChance);
    const critDamage = isCrit
      ? Math.floor((damage + pierceBonus) * this.getPlayerCritMultiplier(1.55))
      : damage + pierceBonus;

    const treeCritText = this.applyCriticalTreeEffects(isCrit, critDamage);
    const weaknessText = this.getEnemyWeaknessText();
    const pierceText = pierced
      ? '\nГлубинный выпад пробил часть защиты врага.'
      : '';

    this.animatePlayerAttack();
    this.damageEnemy(critDamage);

    const playerActionText = isCrit
      ? `Критический выпад копьём! Ты наносишь ${critDamage} урона.${pierceText}${weaknessText}${treeCritText}`
      : `Ты наносишь глубинный выпад копьём: ${critDamage} урона.${pierceText}${weaknessText}`;

    this.afterPlayerAttack(playerActionText);
  }

  private handleTridentAttack() {
    const stats = this.getBattleStats();
    const markChance = this.isBossBattle ? 0.10 : 0.18;

    const damage = this.calculateDamage({
      baseDamage: stats.attack,
      multiplier: 1.08,
      varianceMin: -2,
      varianceMax: 4,
      isBasicAttack: true,
    });

    const isCrit = this.rollPlayerCrit(stats.critChance);
    const finalDamage = isCrit ? Math.floor(damage * this.getPlayerCritMultiplier(1.55)) : damage;
    const treeCritText = this.applyCriticalTreeEffects(isCrit, finalDamage);
    const weaknessText = this.getEnemyWeaknessText();

    const marked = Math.random() < markChance;

    if (marked) {
      this.tridentDepthMarkTurns = 1;
      this.tridentDepthMarkBonus = 0.10;
    }

    const markText = marked
      ? '\nХватка чёрной воды: следующая атака героя нанесёт на 10% больше урона.'
      : '';

    this.animatePlayerAttack();
    this.damageEnemy(finalDamage);

    const playerActionText = isCrit
      ? `Критический удар трезубцем! Ты наносишь ${finalDamage} урона.${markText}${weaknessText}${treeCritText}`
      : `Ты пронзаешь врага трезубцем: ${finalDamage} урона.${markText}${weaknessText}`;

    this.afterPlayerAttack(playerActionText);
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
  let lifestealProcCount = 0;
  const lifestealHealAmounts: number[] = [];
  const daggerTreeCritTexts: string[] = [];
  let finished = false;

  const finishDaggerAttack = () => {
    if (finished) {
      return;
    }

    finished = true;

    const critText =
      critCount > 0
        ? `
Критических ударов: ${critCount}.`
        : '';

    const lifestealText =
      lifestealProcCount > 0
        ? `
Кинжальная жажда сработала ${lifestealProcCount} ${this.getRussianTimesText(lifestealProcCount)}: восстановлено ${totalHeal} HP${lifestealHealAmounts.length > 1 ? ` (${lifestealHealAmounts.join(' + ')})` : ''}.`
        : '';

    const treeCritText = daggerTreeCritTexts.length > 0
      ? `
${daggerTreeCritTexts.join('\n')}`
      : '';

    const weaknessText = this.getEnemyWeaknessText();

    const playerActionText =
      `Кинжалы проводят серию из 3 быстрых ударов.
` +
      `Общий урон: ${totalDamage}.${critText}${lifestealText}${weaknessText}${treeCritText}`;

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

      const healedHp = this.tryApplyDaggerLifesteal(hit.damage);

      if (healedHp > 0) {
        totalHeal += healedHp;
        lifestealProcCount += 1;
        lifestealHealAmounts.push(healedHp);
      }

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

  private getRussianTimesText(count: number) {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) {
      return 'раз';
    }

    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return 'раза';
    }

    return 'раз';
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

    const finalMaterials = materials.map(material => ({
      ...material,
      amount: getRewardMaterialAmount(player, material.id, material.amount),
    }));

    addMaterialsPack(finalMaterials);
    trackFloorMaterials(finalMaterials);

    return finalMaterials
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
    const gold = getRewardGoldAmount(player, Math.floor(baseGold * goldMultiplier));

    player.gold += gold;

    const currentRoom = getCurrentRoom();
    const roomType = currentRoom?.type;
    const isEliteKill = roomType === 'elite';
    const isBossKill = roomType === 'boss' || roomType === 'tier_boss' || this.isBossBattle;
    const isMorveinKill =
      this.enemy.id === 'morvein_sealed_crypt_lord' ||
      this.enemy.name.toLowerCase().includes('морвеин');

    trackEnemyKilled({
      elite: isEliteKill,
      boss: isBossKill,
      morvein: isMorveinKill,
    });
    trackGoldEarned(gold);

    gameState.floorRun.monstersDefeated += 1;
    const expReward = getRewardExpAmount(player, this.enemy.expReward);

    gameState.floorRun.goldEarned += gold;
    gameState.floorRun.expEarned += expReward;

    const expResult = addExperience(player, expReward);

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
      `Получено опыта: ${expReward}` +
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
        restorePlayerVitalsToMaximum(player, 6);

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

    if (this.applyDebuffDamageAndCheckDeath()) {
      return;
    }

    if (this.consumePlayerStunBeforeAction()) {
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

      const hellfireResultText = this.applyHellfireBeforeEnemyTurn(playerActionText);

      if (!hellfireResultText) {
        return;
      }

      playerActionText = hellfireResultText;
    
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
      const enemyStunText = this.tryApplyEnemyStunOnHit(damage);

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
${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${defenseTreeResult.text}${survivalText}${stoneThornsText}${demonRageText}${debuffText}${enemyStunText}`
          : `${playerActionText}

${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${defenseTreeResult.text}${survivalText}${stoneThornsText}${demonRageText}${debuffText}${enemyStunText}`;

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

      const energyBlocked = this.hasPlayerDebuff('energy_block');
      const restoredAfterEnemyTurn = energyBlocked ? 0 : restoreEnergy(player, 1);
      const energyRestoreText = energyBlocked
        ? 'Холодная вода мешает восстановить энергию.'
        : this.createEnergyRestoreText(restoredAfterEnemyTurn);

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
          ? `${playerActionText}\n\nТы заблокировал часть удара.\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${defenseTreeResult.text}${survivalText}${stoneThornsText}${demonRageText}${debuffText}${enemyStunText}\n${energyRestoreText}${passiveText}`
          : `${playerActionText}\n\n${this.enemy.name} наносит ${damage} урона.${shieldSwordText}${defenseTreeResult.text}${survivalText}${stoneThornsText}${demonRageText}${debuffText}${enemyStunText}\n${energyRestoreText}${passiveText}`
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

  private setBarWidthSmooth(bar: Phaser.GameObjects.Rectangle | undefined, targetWidth: number) {
    if (!bar) {
      return;
    }

    const width = Math.max(0, targetWidth);

    this.tweens.killTweensOf(bar);
    this.tweens.add({
      targets: bar,
      displayWidth: width,
      duration: 160,
      ease: 'Sine.easeOut',
    });
  }

  private updateTexts() {
   const stats = this.getBattleStats();

   player.hp = Phaser.Math.Clamp(player.hp, 0, stats.maxHp);
   player.energy = Phaser.Math.Clamp(player.energy, 0, stats.maxEnergy);
   player.potions = Math.max(0, player.potions);

   if (this.playerHpText) {
     this.playerHpText.setText(`HP: ${player.hp}/${stats.maxHp}`);
     const playerHpRatio = stats.maxHp > 0 ? Phaser.Math.Clamp(player.hp / stats.maxHp, 0, 1) : 0;
     this.playerHpText.setColor(playerHpRatio <= 0.25 ? '#ff8a7a' : UI.colors.text);
   }

   if (this.enemyHpText) {
     this.enemyHpText.setText(`HP: ${this.enemy.hp}/${this.enemy.maxHp}`);
   }

   if (this.energyText) {
     this.energyText.setText(`✦ Энергия: ${player.energy}/${stats.maxEnergy}`);
   }

   if (this.potionText) {
     this.potionText.setText(`Зелья: ${player.potions}`);
   }

   if (this.playerHpBar) {
     const playerHpRatio = stats.maxHp > 0 ? Phaser.Math.Clamp(player.hp / stats.maxHp, 0, 1) : 0;
     this.playerHpBar.setFillStyle(playerHpRatio <= 0.25 ? 0xff6b6b : 0x75d184, 0.98);
     this.setBarWidthSmooth(this.playerHpBar, this.playerHpBarMaxWidth * playerHpRatio);
   }

   if (this.enemyHpBar) {
     const enemyHpRatio = this.enemy.maxHp > 0 ? Phaser.Math.Clamp(this.enemy.hp / this.enemy.maxHp, 0, 1) : 0;
     this.enemyHpBar.setFillStyle(enemyHpRatio <= 0.25 ? 0xff3b35 : 0xff5f5f, 0.98);
     this.setBarWidthSmooth(this.enemyHpBar, this.enemyHpBarMaxWidth * enemyHpRatio);
   }

   if (this.energyBar) {
     const energyRatio = stats.maxEnergy > 0 ? Phaser.Math.Clamp(player.energy / stats.maxEnergy, 0, 1) : 0;
     this.setBarWidthSmooth(this.energyBar, this.energyBarMaxWidth * energyRatio);
   }

   this.updateHpPreviewBars(stats);

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
