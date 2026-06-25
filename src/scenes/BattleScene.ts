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

type BattleLogType =
  | 'normal'
  | 'playerDamage'
  | 'enemyDamage'
  | 'heal'
  | 'energy'
  | 'crit'
  | 'reward'
  | 'danger'
  | 'system';

type BattleLogEntry = {
  text: string;
  type: BattleLogType;
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
  playerX: number;
  enemyX: number;
  fighterY: number;
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
  veryCompact: boolean;
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

  private battleLogLines: BattleLogEntry[] = [];
  private battleLogMask?: any;
  private battleLogMaskGraphics?: Phaser.GameObjects.Graphics;
  private battleLogScrollZone?: Phaser.GameObjects.Zone;
  private battleLogScrollTrack?: Phaser.GameObjects.Rectangle;
  private battleLogScrollThumb?: Phaser.GameObjects.Rectangle;
  private battleLogTopFade?: Phaser.GameObjects.Graphics;
  private battleLogBottomFade?: Phaser.GameObjects.Graphics;
  private battleLogNewMessageText?: Phaser.GameObjects.Text;
  private battleLogLineObjects: Phaser.GameObjects.Text[] = [];
  private battleLogObjects: Phaser.GameObjects.GameObject[] = [];
  private battleLogScrollTween?: { stop: () => void };
  private battleLogWheelHandler?: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number
  ) => void;
  private battleLogViewportTop = 0;
  private battleLogViewportHeight = 0;
  private battleLogViewportLeft = 0;
  private battleLogViewportWidth = 0;
  private battleLogContentHeight = 0;
  private battleLogScrollY = 0;
  private battleLogTargetScrollY = 0;
  private battleLogMaxScroll = 0;
  private battleLogDragging = false;
  private battleLogDragStartY = 0;
  private battleLogDragStartScrollY = 0;
  private readonly maxBattleLogEntries = 100;

  private actionButtons: Phaser.GameObjects.GameObject[] = [];

  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private energyBar!: Phaser.GameObjects.Rectangle;

  private playerHpPreviewBar?: Phaser.GameObjects.Rectangle;
  private enemyHpPreviewBar?: Phaser.GameObjects.Rectangle;

  private returnToDungeon = false;
  private isBattleEnded = false;
  private isBusy = false;
  private combatAnimationLocked = false;
  private lastBattleUiSaveAt = 0;
  private readonly battleUiSaveMinIntervalMs = 1400;

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

  



  private readonly BATTLE_ASSETS = {
    actionPanel: {
      key: 'battle_panel_actions',
      url: new URL('../assets/images/battle/battle_panel_actions.png', import.meta.url).href,
    },
    enemySprites: {
      bone_gnawer: {
        key: 'enemy_bone_gnawer',
        url: new URL('../assets/images/battle/enemies/tier1/bone_gnawer.png', import.meta.url).href,
      },
      crypt_crawler: {
        key: 'enemy_crypt_crawler',
        url: new URL('../assets/images/battle/enemies/tier1/crypt_crawler.png', import.meta.url).href,
      },
      grave_worm: {
        key: 'enemy_grave_worm',
        url: new URL('../assets/images/battle/enemies/tier1/grave_worm.png', import.meta.url).href,
      },
      corpse_eater: {
        key: 'enemy_corpse_eater',
        url: new URL('../assets/images/battle/enemies/tier1/corpse_eater.png', import.meta.url).href,
      },
      rotten_servant: {
        key: 'enemy_rotten_servant',
        url: new URL('../assets/images/battle/enemies/tier1/rotten_servant.png', import.meta.url).href,
      },
      bone_guard: {
        key: 'enemy_bone_guard',
        url: new URL('../assets/images/battle/enemies/tier1/bone_guard.png', import.meta.url).href,
      },
      mold_dead: {
        key: 'enemy_mold_dead',
        url: new URL('../assets/images/battle/enemies/tier1/mold_dead.png', import.meta.url).href,
      },
      sarcophagus_rat: {
        key: 'enemy_sarcophagus_rat',
        url: new URL('../assets/images/battle/enemies/tier1/sarcophagus_rat.png', import.meta.url).href,
      },
      carrion_spider: {
        key: 'enemy_carrion_spider',
        url: new URL('../assets/images/battle/enemies/tier1/carrion_spider.png', import.meta.url).href,
      },
      crypt_minion: {
        key: 'enemy_crypt_minion',
        url: new URL('../assets/images/battle/enemies/tier1/crypt_minion.png', import.meta.url).href,
      },
      deadskin: {
        key: 'enemy_deadskin',
        url: new URL('../assets/images/battle/enemies/tier1/deadskin.png', import.meta.url).href,
      },
      funeral_beetle: {
        key: 'enemy_funeral_beetle',
        url: new URL('../assets/images/battle/enemies/tier1/funeral_beetle.png', import.meta.url).href,
      },
      bone_breaker: {
        key: 'enemy_bone_breaker',
        url: new URL('../assets/images/battle/enemies/tier1/bone_breaker.png', import.meta.url).href,
      },
      coffin_scraper: {
        key: 'enemy_coffin_scraper',
        url: new URL('../assets/images/battle/enemies/tier1/coffin_scraper.png', import.meta.url).href,
      },
      infected_acolyte: {
        key: 'enemy_infected_acolyte',
        url: new URL('../assets/images/battle/enemies/tier1/infected_acolyte.png', import.meta.url).href,
      },
      sarcophagus_keeper: {
        key: 'enemy_sarcophagus_keeper',
        url: new URL('../assets/images/battle/enemies/tier1/sarcophagus_keeper.png', import.meta.url).href,
      },
      bone_executioner: {
        key: 'enemy_bone_executioner',
        url: new URL('../assets/images/battle/enemies/tier1/bone_executioner.png', import.meta.url).href,
      },
      crypt_butcher: {
        key: 'enemy_crypt_butcher',
        url: new URL('../assets/images/battle/enemies/tier1/crypt_butcher.png', import.meta.url).href,
      },
      buried_knight: {
        key: 'enemy_buried_knight',
        url: new URL('../assets/images/battle/enemies/tier1/buried_knight.png', import.meta.url).href,
      },
      bone_armored_guard: {
        key: 'enemy_bone_armored_guard',
        url: new URL('../assets/images/battle/enemies/tier1/bone_armored_guard.png', import.meta.url).href,
      },
      dead_standard_bearer: {
        key: 'enemy_dead_standard_bearer',
        url: new URL('../assets/images/battle/enemies/tier1/dead_standard_bearer.png', import.meta.url).href,
      },
      rotten_chaplain: {
        key: 'enemy_rotten_chaplain',
        url: new URL('../assets/images/battle/enemies/tier1/rotten_chaplain.png', import.meta.url).href,
      },
      leper_guard: {
        key: 'enemy_leper_guard',
        url: new URL('../assets/images/battle/enemies/tier1/leper_guard.png', import.meta.url).href,
      },
      crypt_torturer: {
        key: 'enemy_crypt_torturer',
        url: new URL('../assets/images/battle/enemies/tier1/crypt_torturer.png', import.meta.url).href,
      },
      bloody_gravedigger: {
        key: 'enemy_bloody_gravedigger',
        url: new URL('../assets/images/battle/enemies/tier1/bloody_gravedigger.png', import.meta.url).href,
      },
      bone_abbot: {
        key: 'enemy_bone_abbot',
        url: new URL('../assets/images/battle/enemies/tier1/bone_abbot.png', import.meta.url).href,
      },
      sarcophagus_lord: {
        key: 'enemy_sarcophagus_lord',
        url: new URL('../assets/images/battle/enemies/tier1/sarcophagus_lord.png', import.meta.url).href,
      },
      lower_crypt_executioner: {
        key: 'enemy_lower_crypt_executioner',
        url: new URL('../assets/images/battle/enemies/tier1/lower_crypt_executioner.png', import.meta.url).href,
      },
      funeral_champion: {
        key: 'enemy_funeral_champion',
        url: new URL('../assets/images/battle/enemies/tier1/funeral_champion.png', import.meta.url).href,
      },
      bone_collector: {
        key: 'enemy_bone_collector',
        url: new URL('../assets/images/battle/enemies/tier1/bone_collector.png', import.meta.url).href,
      },
      dead_knight_varn: {
        key: 'enemy_dead_knight_varn',
        url: new URL('../assets/images/battle/enemies/tier1/dead_knight_varn.png', import.meta.url).href,
      },
      rotten_bishop: {
        key: 'enemy_rotten_bishop',
        url: new URL('../assets/images/battle/enemies/tier1/rotten_bishop.png', import.meta.url).href,
      },
      black_tomb_guardian: {
        key: 'enemy_black_tomb_guardian',
        url: new URL('../assets/images/battle/enemies/tier1/black_tomb_guardian.png', import.meta.url).href,
      },
      morvein_sealed_crypt_lord: {
        key: 'enemy_morvein_sealed_crypt_lord',
        url: new URL('../assets/images/battle/enemies/tier1/morvein_sealed_crypt_lord.png', import.meta.url).href,
      },
    },
    buttons: {
      attack: {
        key: 'battle_btn_attack',
        url: new URL('../assets/images/battle/attack.png', import.meta.url).href,
      },
      power: {
        key: 'battle_btn_power',
        url: new URL('../assets/images/battle/power.png', import.meta.url).href,
      },
      defence: {
        key: 'battle_btn_defence',
        url: new URL('../assets/images/battle/defence.png', import.meta.url).href,
      },
      heal: {
        key: 'battle_btn_heal',
        url: new URL('../assets/images/battle/heal.png', import.meta.url).href,
      },
      human: {
        key: 'battle_btn_skill_human',
        url: new URL('../assets/images/battle/peopleatt.png', import.meta.url).href,
      },
      tainted: {
        key: 'battle_btn_skill_tainted',
        url: new URL('../assets/images/battle/pol.png', import.meta.url).href,
      },
      goblin: {
        key: 'battle_btn_skill_goblin',
        url: new URL('../assets/images/battle/goblinatt.png', import.meta.url).href,
      },
      stone: {
        key: 'battle_btn_skill_stone',
        url: new URL('../assets/images/battle/stoneatt.png', import.meta.url).href,
      },
      elf: {
        key: 'battle_btn_skill_elf',
        url: new URL('../assets/images/battle/elfatt.png', import.meta.url).href,
      },
      demon: {
        key: 'battle_btn_skill_demon',
        url: new URL('../assets/images/battle/Demonarr.png', import.meta.url).href,
      },
    },
    raceSprites: {
      human: {
        key: 'race_sprite_human',
        url: new URL('../assets/images/battle/races/human.png', import.meta.url).href,
      },
      tainted: {
        key: 'race_sprite_tainted',
        url: new URL('../assets/images/battle/races/tainted_halfblood.png', import.meta.url).href,
      },
      goblin: {
        key: 'race_sprite_goblin',
        url: new URL('../assets/images/battle/races/goblin.png', import.meta.url).href,
      },
      stone: {
        key: 'race_sprite_stoneborn',
        url: new URL('../assets/images/battle/races/stoneborn.png', import.meta.url).href,
      },
      elf: {
        key: 'race_sprite_night_elf',
        url: new URL('../assets/images/battle/races/night_elf.png', import.meta.url).href,
      },
      demon: {
        key: 'race_sprite_demon',
        url: new URL('../assets/images/battle/races/demon.png', import.meta.url).href,
      },
    },
  } as const;

  constructor() {
    super('BattleScene');
  }


  private configurePixelSpriteRendering() {
    this.cameras.main.roundPixels = true;

    const canvas = this.game.canvas;

    if (canvas) {
      canvas.style.imageRendering = 'pixelated';
      canvas.style.setProperty('image-rendering', 'pixelated');
    }
  }

  preload() {
    const assetsToLoad = [
      this.BATTLE_ASSETS.actionPanel,
      ...Object.values(this.BATTLE_ASSETS.enemySprites),
      ...Object.values(this.BATTLE_ASSETS.buttons),
      ...Object.values(this.BATTLE_ASSETS.raceSprites),
    ];

    assetsToLoad.forEach(asset => {
      if (!this.textures.exists(asset.key)) {
        this.load.image(asset.key, asset.url);
      }
    });

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.configurePixelSpriteRendering();
    this.applyNearestFilterToBattleTextures();
    });
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
  this.combatAnimationLocked = false;
  this.lastBattleUiSaveAt = 0;
  this.battleLogLines = [];
  this.battleLogLineObjects = [];
  this.battleLogDragging = false;
  this.battleLogScrollY = 0;
  this.battleLogTargetScrollY = 0;
  this.battleLogMaxScroll = 0;
  this.battleLogContentHeight = 0;
  this.battleLogScrollTween?.stop();
  this.battleLogScrollTween = undefined;
  this.battleLogMask = undefined;
  this.battleLogScrollZone = undefined;
  this.battleLogWheelHandler = undefined;

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

    this.applyNearestFilterToBattleTextures();

    this.createBattleBackground(isBoss);

    this.createBattleHeader(
      `Этаж ${floor}  •  Ур. ${player.level}`,
      room ? room.title : `${player.name} против ${this.enemy.name}`,
      isBoss
    );

    this.enemyCard = this.createFighterCard(
      layout.enemyX,
      layout.fighterY,
      this.enemy.name,
      isBoss ? '♛' : '☠',
      isBoss ? 0x3a120c : 0x241515,
      true,
      isBoss
    );

    this.playerCard = this.createFighterCard(
      layout.playerX,
      layout.fighterY,
      player.name,
      '🗡',
      0x151b24,
      false,
      false
    );

    this.animateBattleEntries();

    this.createBattleLogPanel();
    this.clearBattleLog();

    this.appendBattleLog(
      `Начало боя: ${player.name} против ${this.enemy.name}.`,
      isBoss ? 'danger' : 'system'
    );
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

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 34);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.022), 16, 30);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.03), 24, 42);
    const contentWidth = Math.min(width - safeX * 2, 660);
    const compact = height < 1120;
    const veryCompact = height < 940;

    const actionPanelWidth = contentWidth;
    const naturalPanelHeight = actionPanelWidth * (941 / 1672);
    const maxPanelHeight = veryCompact ? 266 : compact ? 306 : 342;
    const actionPanelHeight = Math.min(maxPanelHeight, naturalPanelHeight);
    const actionPanelY = height - safeBottom - actionPanelHeight / 2;
    const actionTop = actionPanelY - actionPanelHeight / 2;

    const attackButtonY = actionTop + actionPanelHeight * 0.27;
    const firstRowY = actionTop + actionPanelHeight * 0.515;
    const secondRowY = actionTop + actionPanelHeight * 0.745;

    const logHeight = veryCompact ? 100 : compact ? 126 : 154;
    const logY = actionTop - logHeight / 2 - (veryCompact ? 8 : 12);

    const headerBottom = safeTop + (this.isBossBattle
      ? veryCompact ? 86 : compact ? 102 : 118
      : veryCompact ? 72 : compact ? 86 : 98);

    const combatTop = headerBottom + (veryCompact ? 8 : 12);
    const combatBottom = logY - logHeight / 2 - (veryCompact ? 10 : 16);
    const combatHeight = Math.max(250, combatBottom - combatTop);

    // Горизонтальная RPG-композиция: герой слева, враг справа.
    const fighterY = combatTop + combatHeight * (veryCompact ? 0.56 : compact ? 0.55 : 0.54);
    const horizontalSpread = Phaser.Math.Clamp(contentWidth * 0.285, veryCompact ? 126 : 152, 194);
    const playerX = width / 2 - horizontalSpread;
    const enemyX = width / 2 + horizontalSpread;

    // Старые поля оставлены для совместимости с фоном/эффектами.
    const enemyY = fighterY;
    const playerY = fighterY;

    // НАСТРОЙКА ШИРИНЫ КНОПОК:
    // mainButtonWidth — ширина верхней кнопки атаки.
    // sideButtonWidth — ширина маленьких кнопок во 2 и 3 ряду.
    const mainButtonWidth = Math.min(actionPanelWidth * 0.83, 570);
    const sideButtonWidth = Math.min((mainButtonWidth - (veryCompact ? 10 : 14)) / 2, 278);

    return {
      width,
      height,
      centerX: width / 2,
      safeX,
      safeTop,
      safeBottom,
      contentWidth,
      playerX,
      enemyX,
      fighterY,
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
      veryCompact,
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
    const panelWidth = Math.min(layout.contentWidth, 650);
    const panelHeight = isBoss
      ? layout.veryCompact ? 78 : layout.compact ? 92 : 108
      : layout.veryCompact ? 64 : layout.compact ? 76 : 88;
    const panelY = layout.safeTop + panelHeight / 2 + 2;
    const left = layout.centerX - panelWidth / 2;
    const top = panelY - panelHeight / 2;
    const accent = isBoss ? 0xb84a2f : UI.colors.goldDark;
    const glow = isBoss ? 0x9a1f18 : 0xb9985b;

    this.add.rectangle(layout.centerX, panelY + 8, panelWidth, panelHeight, 0x000000, 0.28)
      .setDepth(7);

    const plate = this.add.graphics().setDepth(8);
    plate.fillStyle(isBoss ? 0x180807 : 0x09090d, 0.97);
    plate.fillRoundedRect(left, top, panelWidth, panelHeight, 24);
    plate.fillStyle(isBoss ? 0x3a100d : 0x17100c, 0.45);
    plate.fillRoundedRect(left + 8, top + 8, panelWidth - 16, panelHeight - 16, 18);
    plate.lineStyle(isBoss ? 3 : 2, accent, isBoss ? 0.92 : 0.64);
    plate.strokeRoundedRect(left, top, panelWidth, panelHeight, 24);
    plate.lineStyle(1, 0xe8c982, isBoss ? 0.26 : 0.18);
    plate.strokeRoundedRect(left + 7, top + 7, panelWidth - 14, panelHeight - 14, 18);

    this.add.circle(layout.centerX, panelY - panelHeight * 0.22, panelWidth * 0.28, glow, isBoss ? 0.09 : 0.045)
      .setDepth(9);

    const sealSize = layout.veryCompact ? 34 : 42;
    const sealX = left + (layout.veryCompact ? 32 : 40);
    this.add.circle(sealX, panelY, sealSize / 2, isBoss ? 0x3a0c09 : 0x1d1710, 0.96)
      .setStrokeStyle(2, accent, isBoss ? 0.9 : 0.55)
      .setDepth(10);
    this.add.text(sealX, panelY, isBoss ? '♛' : '◆', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '18px' : '22px',
      color: isBoss ? '#ffb08a' : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11);

    if (isBoss) {
      this.add.text(layout.centerX, top + (layout.veryCompact ? 14 : 17), 'СМЕРТЕЛЬНАЯ ВСТРЕЧА', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '11px' : '13px',
        color: '#ff8b6f',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        letterSpacing: 1,
      }).setOrigin(0.5).setDepth(12);
    }

    this.add.text(layout.centerX + (layout.veryCompact ? 8 : 12), panelY - (isBoss ? 2 : 9), title, {
      fontFamily: UI.font.title,
      fontSize: isBoss
        ? layout.veryCompact ? '18px' : layout.compact ? '22px' : '25px'
        : layout.veryCompact ? '18px' : layout.compact ? '21px' : '24px',
      color: isBoss ? '#ffd0aa' : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: panelWidth - (layout.veryCompact ? 112 : 134),
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12);

    this.add.text(layout.centerX + (layout.veryCompact ? 8 : 12), panelY + (isBoss ? panelHeight * 0.27 : panelHeight * 0.24), subtitle, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '11px' : layout.compact ? '13px' : '15px',
      color: isBoss ? '#d6a98e' : '#9f9788',
      align: 'center',
      wordWrap: {
        width: panelWidth - (layout.veryCompact ? 112 : 134),
        useAdvancedWrap: true,
      },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0.5).setDepth(12);

    const pulseTarget = this.add.rectangle(layout.centerX, top + panelHeight - 3, panelWidth - 62, 2, glow, isBoss ? 0.34 : 0.18)
      .setDepth(12);

    this.tweens.add({
      targets: pulseTarget,
      alpha: isBoss ? 0.62 : 0.32,
      duration: isBoss ? 760 : 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
    this.destroyBattleLogObjects();

    const layout = this.getBattleLayout();
    const panelWidth = layout.contentWidth;
    const panelHeight = layout.logHeight;
    const panelX = layout.centerX;
    const panelY = layout.logY;
    const panelLeft = panelX - panelWidth / 2;
    const panelTop = panelY - panelHeight / 2;

    const radius = layout.veryCompact ? 18 : 24;
    const headerHeight = layout.veryCompact ? 34 : 38;
    const horizontalPadding = layout.veryCompact ? 18 : 22;
    const bottomPadding = layout.veryCompact ? 14 : 16;
    const scrollbarWidth = 4;
    const scrollbarGap = 10;

    this.battleLogViewportLeft = panelLeft + horizontalPadding;
    this.battleLogViewportTop = panelTop + headerHeight + (layout.veryCompact ? 12 : 14);
    this.battleLogViewportWidth = panelWidth - horizontalPadding * 2 - scrollbarGap - scrollbarWidth;
    this.battleLogViewportHeight = Math.max(
      40,
      panelTop + panelHeight - bottomPadding - this.battleLogViewportTop
    );

    this.battleLogScrollY = 0;
    this.battleLogTargetScrollY = 0;
    this.battleLogMaxScroll = 0;
    this.battleLogContentHeight = 0;
    this.battleLogDragging = false;

    const panel = this.createRoundedPanel({
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius,
      color: 0x06080b,
      alpha: 0.96,
      strokeColor: 0x5f4630,
      strokeAlpha: 0.54,
      strokeWidth: 2,
      depth: 8,
    });

    panel.panel.setAlpha(0);
    panel.shadow.setAlpha(0);

    const titleText = this.add.text(
      panelLeft + horizontalPadding,
      panelTop + (layout.veryCompact ? 18 : 20),
      'Летопись боя',
      {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '12px' : '14px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'left',
      }
    ).setOrigin(0, 0.5).setDepth(12).setAlpha(0);

    this.statusText = this.add.text(
      panelLeft + panelWidth - horizontalPadding,
      titleText.y,
      'Нет эффектов',
      {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '9px' : '10px',
        color: '#8aa9c5',
        align: 'right',
        wordWrap: {
          width: Math.max(100, panelWidth - 200),
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }
    ).setOrigin(1, 0.5).setDepth(12).setAlpha(0);

    const headerLine = this.add.rectangle(
      panelX,
      panelTop + headerHeight,
      panelWidth - horizontalPadding * 2,
      1,
      UI.colors.goldDark,
      0.22
    ).setDepth(11).setAlpha(0);

    const viewportBg = this.add.rectangle(
      this.battleLogViewportLeft + this.battleLogViewportWidth / 2,
      this.battleLogViewportTop + this.battleLogViewportHeight / 2,
      this.battleLogViewportWidth,
      this.battleLogViewportHeight,
      0x030507,
      0.32
    ).setDepth(9).setAlpha(0);

    const leftMark = this.add.rectangle(
      panelLeft + 11,
      this.battleLogViewportTop + this.battleLogViewportHeight / 2,
      2,
      this.battleLogViewportHeight,
      UI.colors.goldDark,
      0.24
    ).setDepth(11).setAlpha(0);

    this.battleLogTopFade = this.createBattleLogEdgeFade(
      this.battleLogViewportLeft,
      this.battleLogViewportTop,
      this.battleLogViewportWidth,
      layout.veryCompact ? 12 : 15,
      true
    ).setDepth(15).setAlpha(0);

    this.battleLogBottomFade = this.createBattleLogEdgeFade(
      this.battleLogViewportLeft,
      this.battleLogViewportTop + this.battleLogViewportHeight - (layout.veryCompact ? 12 : 15),
      this.battleLogViewportWidth,
      layout.veryCompact ? 12 : 15,
      false
    ).setDepth(15).setAlpha(0);

    this.battleLogMaskGraphics = this.add.graphics();
    this.battleLogMaskGraphics.setDepth(200);
    this.battleLogMaskGraphics.setAlpha(0.0001);
    this.battleLogMaskGraphics.fillStyle(0xffffff, 1);
    this.battleLogMaskGraphics.fillRect(
      this.battleLogViewportLeft,
      this.battleLogViewportTop,
      this.battleLogViewportWidth,
      this.battleLogViewportHeight
    );
    this.battleLogMask = this.battleLogMaskGraphics.createGeometryMask();

    this.logText = this.add.text(0, 0, '', {
      fontFamily: UI.font.body,
      fontSize: '1px',
      color: '#000000',
    }).setOrigin(0, 0).setVisible(false).setAlpha(0).setDepth(-1000);

    const scrollbarX = this.battleLogViewportLeft + this.battleLogViewportWidth + scrollbarGap + scrollbarWidth / 2;

    this.battleLogScrollTrack = this.add.rectangle(
      scrollbarX,
      this.battleLogViewportTop + this.battleLogViewportHeight / 2,
      scrollbarWidth,
      this.battleLogViewportHeight,
      0x000000,
      0.36
    ).setDepth(14).setAlpha(0);

    this.battleLogScrollThumb = this.add.rectangle(
      scrollbarX,
      this.battleLogViewportTop + 10,
      scrollbarWidth,
      24,
      UI.colors.goldDark,
      0.82
    ).setDepth(15).setAlpha(0);

    this.battleLogNewMessageText = this.add.text(
      this.battleLogViewportLeft + this.battleLogViewportWidth - 2,
      this.battleLogViewportTop + this.battleLogViewportHeight - 4,
      'новое ↓',
      {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '8px' : '9px',
        color: UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 2,
      }
    ).setOrigin(1, 1).setDepth(16).setVisible(false).setAlpha(0);

    this.battleLogScrollZone = this.add.zone(
      this.battleLogViewportLeft,
      this.battleLogViewportTop,
      this.battleLogViewportWidth + scrollbarGap + scrollbarWidth,
      this.battleLogViewportHeight
    ).setOrigin(0, 0).setInteractive({ useHandCursor: false }).setDepth(31);

    this.battleLogScrollZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.battleLogDragging = true;
      this.battleLogDragStartY = pointer.y;
      this.battleLogDragStartScrollY = this.battleLogScrollY;
      this.battleLogScrollTween?.stop();
      this.battleLogScrollTween = undefined;
    });

    this.battleLogScrollZone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.battleLogDragging) {
        return;
      }

      const deltaY = this.battleLogDragStartY - pointer.y;
      this.scrollBattleLogTo(this.battleLogDragStartScrollY + deltaY, true);
    });

    this.battleLogScrollZone.on('pointerup', () => this.stopBattleLogDrag());
    this.battleLogScrollZone.on('pointerupoutside', () => this.stopBattleLogDrag());
    this.battleLogScrollZone.on('pointerout', () => this.stopBattleLogDrag());
    this.battleLogScrollZone.on('pointercancel', () => this.stopBattleLogDrag());

    if (this.battleLogWheelHandler) {
      this.input.off('wheel', this.battleLogWheelHandler);
    }

    this.battleLogWheelHandler = (
      pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number
    ) => {
      if (!this.isPointerInsideBattleLog(pointer)) {
        return;
      }

      this.scrollBattleLogBy(deltaY * 0.5);
    };

    this.input.on('wheel', this.battleLogWheelHandler);
    this.input.on('pointerup', this.stopBattleLogDrag, this);
    this.input.on('pointerupoutside', this.stopBattleLogDrag, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerup', this.stopBattleLogDrag, this);
      this.input.off('pointerupoutside', this.stopBattleLogDrag, this);

      if (this.battleLogWheelHandler) {
        this.input.off('wheel', this.battleLogWheelHandler);
        this.battleLogWheelHandler = undefined;
      }

      this.battleLogScrollTween?.stop();
      this.battleLogScrollTween = undefined;
    });

    this.battleLogObjects.push(
      panel.panel,
      panel.shadow,
      titleText,
      headerLine,
      this.statusText,
      viewportBg,
      leftMark,
      this.battleLogTopFade,
      this.battleLogBottomFade,
      this.battleLogScrollTrack,
      this.battleLogScrollThumb,
      this.battleLogNewMessageText,
      this.battleLogScrollZone,
      this.logText
    );

    this.tweens.add({
      targets: [
        panel.panel,
        panel.shadow,
        titleText,
        headerLine,
        this.statusText,
        viewportBg,
        leftMark,
        this.battleLogScrollTrack,
        this.battleLogScrollThumb,
      ],
      alpha: 1,
      duration: 240,
      delay: 150,
      ease: 'Sine.easeOut',
    });

    this.updateBattleLogView(false);
  }

  private stopBattleLogDrag() {
    this.battleLogDragging = false;
  }

  private createBattleLogEdgeFade(
    x: number,
    y: number,
    width: number,
    height: number,
    topFade: boolean
  ) {
    const graphics = this.add.graphics();
    const steps = 8;
    const stepHeight = height / steps;

    for (let i = 0; i < steps; i += 1) {
      const ratio = topFade
        ? 1 - i / steps
        : (i + 1) / steps;
      const alpha = 0.04 + ratio * 0.38;

      graphics.fillStyle(0x06080b, alpha);
      graphics.fillRect(
        x,
        y + i * stepHeight,
        width,
        Math.ceil(stepHeight) + 1
      );
    }

    return graphics;
  }

  private appendBattleLog(message: string, type: BattleLogType = 'normal') {
    const normalized = String(message ?? '')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!normalized) {
      return;
    }

    const resolvedType = type === 'normal'
      ? this.inferBattleLogType(normalized)
      : type;
    const wasAtBottom = this.isBattleLogAtBottom();

    this.battleLogLines.push({
      text: normalized,
      type: resolvedType,
    });

    while (this.battleLogLines.length > this.maxBattleLogEntries) {
      this.battleLogLines.shift();
      const oldObject = this.battleLogLineObjects.shift();
      oldObject?.destroy();
    }

    const newLine = this.createBattleLogLine(normalized, resolvedType);

    this.updateBattleLogView(false);

    if (newLine) {
      newLine.setAlpha(0);

      this.tweens.add({
        targets: newLine,
        alpha: 1,
        duration: 170,
        ease: 'Sine.easeOut',
        onComplete: () => this.applyBattleLogScroll(),
      });
    }

    if (wasAtBottom || this.battleLogLines.length <= 2) {
      this.scrollBattleLogToBottom(true);
      this.hideBattleLogNewMessageIndicator();
    } else {
      this.showBattleLogNewMessageIndicator();
    }

    if (resolvedType === 'crit' || resolvedType === 'danger' || resolvedType === 'reward') {
      this.pulseBattleLogPanel(resolvedType);
    }
  }

  private clearBattleLog() {
    this.battleLogLines = [];

    this.battleLogLineObjects.forEach(object => object.destroy());
    this.battleLogLineObjects = [];

    this.battleLogScrollTween?.stop();
    this.battleLogScrollTween = undefined;
    this.battleLogScrollY = 0;
    this.battleLogTargetScrollY = 0;
    this.battleLogMaxScroll = 0;
    this.battleLogContentHeight = 0;

    this.hideBattleLogNewMessageIndicator();
    this.updateBattleLogView(false);
  }

  private createBattleLogLine(text: string, type: BattleLogType = 'normal') {
    const layout = this.getBattleLayout();
    const color = this.getBattleLogColor(type);
    const icon = this.getBattleLogIcon(type);
    const lineText = `${icon} ${text}`;

    const line = this.add.text(
      this.battleLogViewportLeft,
      this.battleLogViewportTop,
      lineText,
      {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '11px' : layout.compact ? '12px' : '13px',
        color,
        align: 'left',
        wordWrap: {
          width: Math.max(80, this.battleLogViewportWidth - 6),
          useAdvancedWrap: true,
        },
        lineSpacing: layout.veryCompact ? 2 : 4,
      }
    ).setOrigin(0, 0).setDepth(13).setAlpha(0);

    if (this.battleLogMask) {
      line.setMask(this.battleLogMask);
    }

    this.battleLogLineObjects.push(line);

    return line;
  }

  private updateBattleLogView(_animatedLastLine = false) {
    if (this.battleLogLineObjects.length === 0) {
      this.battleLogContentHeight = 0;
      this.battleLogMaxScroll = 0;
      this.battleLogScrollY = 0;
      this.applyBattleLogScroll();
      return;
    }

    let cursorY = 0;
    const gap = this.getBattleLayout().veryCompact ? 6 : 8;

    this.battleLogLineObjects.forEach(line => {
      if (this.battleLogMask && line.mask !== this.battleLogMask) {
        line.setMask(this.battleLogMask);
      }

      line.setPosition(
        this.battleLogViewportLeft,
        this.battleLogViewportTop + cursorY - this.battleLogScrollY
      );

      cursorY += Math.ceil(line.height) + gap;
    });

    this.battleLogContentHeight = Math.max(0, cursorY);
    this.battleLogMaxScroll = Math.max(
      0,
      this.battleLogContentHeight - this.battleLogViewportHeight
    );

    this.battleLogTargetScrollY = Phaser.Math.Clamp(
      this.battleLogTargetScrollY,
      0,
      this.battleLogMaxScroll
    );
    this.battleLogScrollY = Phaser.Math.Clamp(
      this.battleLogScrollY,
      0,
      this.battleLogMaxScroll
    );

    this.applyBattleLogScroll();
  }

  private scrollBattleLog(delta: number) {
    this.scrollBattleLogTo(this.battleLogScrollY + delta);
  }

  private scrollBattleLogBy(deltaY: number) {
    this.scrollBattleLog(deltaY);
  }

  private isBattleLogAtBottom() {
    return this.battleLogMaxScroll <= 1 || this.battleLogMaxScroll - this.battleLogScrollY <= 10;
  }

  private scrollBattleLogToBottom(animated = true) {
    this.scrollBattleLogTo(this.battleLogMaxScroll, !animated);
  }

  private scrollBattleLogTo(scrollY: number, immediate = false) {
    const targetScrollY = Phaser.Math.Clamp(scrollY, 0, this.battleLogMaxScroll);
    this.battleLogTargetScrollY = targetScrollY;

    this.battleLogScrollTween?.stop();
    this.battleLogScrollTween = undefined;

    if (immediate || Math.abs(targetScrollY - this.battleLogScrollY) < 0.5) {
      this.battleLogScrollY = targetScrollY;
      this.applyBattleLogScroll();
      return;
    }

    const tweenState = {
      value: this.battleLogScrollY,
    };

    this.battleLogScrollTween = this.tweens.add({
      targets: tweenState,
      value: targetScrollY,
      duration: 180,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.battleLogScrollY = tweenState.value;
        this.applyBattleLogScroll();
      },
      onComplete: () => {
        this.battleLogScrollY = targetScrollY;
        this.battleLogScrollTween = undefined;
        this.applyBattleLogScroll();
      },
    });

    if (targetScrollY >= this.battleLogMaxScroll - 6) {
      this.hideBattleLogNewMessageIndicator();
    }
  }

  private applyBattleLogScroll() {
    let cursorY = 0;
    const gap = this.getBattleLayout().veryCompact ? 6 : 8;
    const viewportTop = this.battleLogViewportTop;
    const viewportBottom = this.battleLogViewportTop + this.battleLogViewportHeight;
    const fadeDistance = this.getBattleLayout().veryCompact ? 18 : 24;

    this.battleLogLineObjects.forEach(line => {
      const lineHeight = Math.ceil(line.height);
      const lineY = viewportTop + cursorY - this.battleLogScrollY;
      const lineBottom = lineY + lineHeight;

      if (this.battleLogMask && line.mask !== this.battleLogMask) {
        line.setMask(this.battleLogMask);
      }

      line.setPosition(this.battleLogViewportLeft, lineY);

      const isCompletelyOutsideViewport = lineBottom <= viewportTop || lineY >= viewportBottom;

      if (isCompletelyOutsideViewport) {
        line.setVisible(false);
      } else {
        const visibleTop = Phaser.Math.Clamp((lineBottom - viewportTop) / fadeDistance, 0, 1);
        const visibleBottom = Phaser.Math.Clamp((viewportBottom - lineY) / fadeDistance, 0, 1);
        const edgeAlpha = Phaser.Math.Clamp(Math.min(visibleTop, visibleBottom), 0.22, 1);

        line.setVisible(true);
        line.setAlpha(edgeAlpha);
      }

      cursorY += lineHeight + gap;
    });

    if (this.isBattleLogAtBottom()) {
      this.hideBattleLogNewMessageIndicator();
    }

    this.updateBattleLogScrollThumb();
    this.updateBattleLogEdgeFades();
  }

  private updateBattleLogEdgeFades() {
    if (!this.battleLogTopFade || !this.battleLogBottomFade) {
      return;
    }

    if (this.battleLogMaxScroll <= 1) {
      this.battleLogTopFade.setAlpha(0);
      this.battleLogBottomFade.setAlpha(0);
      return;
    }

    const topAlpha = Phaser.Math.Clamp(this.battleLogScrollY / 24, 0, 1) * 0.9;
    const bottomAlpha = Phaser.Math.Clamp((this.battleLogMaxScroll - this.battleLogScrollY) / 24, 0, 1) * 0.9;

    this.battleLogTopFade.setAlpha(topAlpha);
    this.battleLogBottomFade.setAlpha(bottomAlpha);
  }

  private updateBattleLogScrollThumb() {
    if (!this.battleLogScrollTrack || !this.battleLogScrollThumb) {
      return;
    }

    const hasScroll = this.battleLogMaxScroll > 1;
    this.battleLogScrollTrack.setVisible(hasScroll);
    this.battleLogScrollThumb.setVisible(hasScroll);

    if (!hasScroll || this.battleLogViewportHeight <= 0) {
      return;
    }

    const trackHeight = this.battleLogViewportHeight;
    const contentHeight = Math.max(this.battleLogViewportHeight, this.battleLogContentHeight);
    const thumbHeight = Phaser.Math.Clamp(
      trackHeight * (this.battleLogViewportHeight / contentHeight),
      18,
      trackHeight
    );
    const scrollRatio = this.battleLogMaxScroll > 0
      ? this.battleLogScrollY / this.battleLogMaxScroll
      : 0;
    const trackTop = this.battleLogViewportTop;

    this.battleLogScrollThumb.displayHeight = thumbHeight;
    this.battleLogScrollThumb.y = trackTop + thumbHeight / 2 + (trackHeight - thumbHeight) * scrollRatio;
    this.battleLogScrollTrack.setAlpha(0.56);
    this.battleLogScrollThumb.setAlpha(0.88);
  }

  private isPointerInsideBattleLog(pointer: Phaser.Input.Pointer) {
    return (
      pointer.x >= this.battleLogViewportLeft &&
      pointer.x <= this.battleLogViewportLeft + this.battleLogViewportWidth &&
      pointer.y >= this.battleLogViewportTop &&
      pointer.y <= this.battleLogViewportTop + this.battleLogViewportHeight
    );
  }

  private showBattleLogNewMessageIndicator() {
    if (!this.battleLogNewMessageText) {
      return;
    }

    this.battleLogNewMessageText.setVisible(true);
    this.tweens.killTweensOf(this.battleLogNewMessageText);
    this.tweens.add({
      targets: this.battleLogNewMessageText,
      alpha: 1,
      y: this.battleLogViewportTop + this.battleLogViewportHeight - 4,
      duration: 140,
      ease: 'Sine.easeOut',
    });
  }

  private hideBattleLogNewMessageIndicator() {
    if (!this.battleLogNewMessageText) {
      return;
    }

    this.tweens.killTweensOf(this.battleLogNewMessageText);
    this.tweens.add({
      targets: this.battleLogNewMessageText,
      alpha: 0,
      duration: 110,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.battleLogNewMessageText?.setVisible(false);
      },
    });
  }

  private pulseBattleLogPanel(type: BattleLogType) {
    const color = type === 'reward'
      ? UI.colors.gold
      : type === 'danger'
        ? UI.colors.redHex
        : 0xf0d58a;

    const glow = this.add.rectangle(
      this.battleLogViewportLeft + this.battleLogViewportWidth / 2,
      this.battleLogViewportTop + this.battleLogViewportHeight / 2,
      this.battleLogViewportWidth,
      this.battleLogViewportHeight,
      color,
      0.08
    ).setDepth(14).setAlpha(0);

    if (this.battleLogMask) {
      glow.setMask(this.battleLogMask);
    }

    this.tweens.add({
      targets: glow,
      alpha: 0.18,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => glow.destroy(),
    });
  }

  private destroyBattleLogObjects() {
    if (this.battleLogWheelHandler) {
      this.input.off('wheel', this.battleLogWheelHandler);
      this.battleLogWheelHandler = undefined;
    }

    this.input.off('pointerup', this.stopBattleLogDrag, this);
    this.input.off('pointerupoutside', this.stopBattleLogDrag, this);

    this.battleLogScrollTween?.stop();
    this.battleLogScrollTween = undefined;

    this.battleLogLineObjects.forEach(object => object.destroy());
    this.battleLogLineObjects = [];

    this.battleLogMask?.destroy?.();
    this.battleLogMask = undefined;

    this.battleLogMaskGraphics?.destroy();
    this.battleLogMaskGraphics = undefined;

    this.battleLogObjects.forEach(object => object.destroy());
    this.battleLogObjects = [];

    this.battleLogScrollZone = undefined;
    this.battleLogScrollTrack = undefined;
    this.battleLogScrollThumb = undefined;
    this.battleLogTopFade = undefined;
    this.battleLogBottomFade = undefined;
    this.battleLogNewMessageText = undefined;

    this.battleLogDragging = false;
    this.battleLogScrollY = 0;
    this.battleLogTargetScrollY = 0;
    this.battleLogMaxScroll = 0;
    this.battleLogContentHeight = 0;
  }

  private inferBattleLogType(text: string): BattleLogType {
    const lower = text.toLowerCase();

    if (
      lower.includes('крит') ||
      lower.includes('критический')
    ) {
      return 'crit';
    }

    if (
      lower.includes('награ') ||
      lower.includes('золото') ||
      lower.includes('опыт') ||
      lower.includes('предмет') ||
      lower.includes('материал') ||
      lower.includes('добыча')
    ) {
      return 'reward';
    }

    if (
      lower.includes('зелье') ||
      lower.includes('леч') ||
      lower.includes('восстановлено hp') ||
      lower.includes('исцел') ||
      lower.includes('+') && lower.includes('hp')
    ) {
      return 'heal';
    }

    if (
      lower.includes('энерг') ||
      lower.includes('эн.')
    ) {
      return 'energy';
    }

    if (
      lower.includes('погиб') ||
      lower.includes('смерт') ||
      lower.includes('поражение') ||
      lower.includes('умер') ||
      lower.includes('опас')
    ) {
      return 'danger';
    }

    if (
      lower.includes('враг наносит') ||
      lower.includes('получаешь') ||
      lower.includes('теряешь') ||
      lower.includes('удар врага')
    ) {
      return 'enemyDamage';
    }

    if (
      lower.includes('ты наносишь') ||
      lower.includes('наносишь') ||
      lower.includes('враг получает') ||
      lower.includes('урона врагу')
    ) {
      return 'playerDamage';
    }

    if (
      lower.includes('начало боя') ||
      lower.includes('бой начался') ||
      lower.includes('выбери действие') ||
      lower.includes('ход')
    ) {
      return 'system';
    }

    return 'normal';
  }

  private getBattleLogColor(type: BattleLogType) {
    if (type === 'playerDamage') return '#d8a45f';
    if (type === 'enemyDamage') return '#ff8d7f';
    if (type === 'heal') return '#75d184';
    if (type === 'energy') return '#8fbfff';
    if (type === 'crit') return '#ffd36e';
    if (type === 'reward') return UI.colors.goldText;
    if (type === 'danger') return '#ff7a6f';
    if (type === 'system') return '#9f9788';

    return UI.colors.text;
  }

  private getBattleLogIcon(type: BattleLogType) {
    if (type === 'playerDamage') return '⚔';
    if (type === 'enemyDamage') return '◆';
    if (type === 'heal') return '✚';
    if (type === 'energy') return '✦';
    if (type === 'crit') return '✹';
    if (type === 'reward') return '◇';
    if (type === 'danger') return '☠';
    if (type === 'system') return '•';

    return '•';
  }

  private createActionButtons() {
    this.actionButtons.forEach(object => {
      this.tweens.killTweensOf(object);

      if ('removeAllListeners' in object && typeof (object as any).removeAllListeners === 'function') {
        (object as any).removeAllListeners();
      }

      object.destroy();
    });
    this.actionButtons = [];

    if (this.isBattleEnded) {
      return;
    }

    this.applyNearestFilterToBattleTextures();

    const layout = this.getBattleLayout();
    const canUseRaceSkill = !this.isRaceSkillDisabled();
    const canUsePower =
      !this.isBusy &&
      !this.isBattleEnded &&
      player.energy >= this.powerAttackEnergyCost + this.getSkillCostPenalty();
    const canUsePotion = !this.isPotionDisabled() && player.hp < this.getBattleStats().maxHp;

    const panelWidth = layout.contentWidth;
    const panelHeight = layout.actionPanelHeight;

    const panel = this.add.image(
      layout.centerX,
      layout.actionPanelY,
      this.BATTLE_ASSETS.actionPanel.key
    )
      .setOrigin(0.5)
      .setDisplaySize(panelWidth, panelHeight)
      .setDepth(18)
      .setAlpha(0.985);

    this.actionButtons.push(panel);

    const top = layout.actionPanelY - panelHeight / 2;
    const panelRight = layout.centerX + panelWidth / 2;

    const energyBadge = this.add.container(
      panelRight - (layout.veryCompact ? 58 : 66),
      top + panelHeight * 0.055
    ).setDepth(29);

    const energyBadgeBg = this.add.rectangle(
      0,
      0,
      layout.veryCompact ? 82 : 96,
      layout.veryCompact ? 24 : 28,
      0x07121f,
      0.88
    ).setStrokeStyle(1, 0x70a6ff, 0.52);

    const energyHint = this.add.text(0, 0, `✦ ${player.energy}`, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '10px' : '12px',
      color: '#b9d8ff',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      maxLines: 1,
    }).setOrigin(0.5);

    energyBadge.add([energyBadgeBg, energyHint]);
    this.actionButtons.push(energyBadge);

    // НАСТРОЙКА РАЗМЕРОВ КНОПОК:
    // gap — расстояние между двумя маленькими кнопками.
    // sideWidth — ширина маленьких кнопок.
    // layout.mainButtonWidth — ширина верхней большой кнопки.
    // primaryHeight — высота верхней большой кнопки.
    // gridButtonHeight — высота маленьких кнопок 2x2.
    const gap = layout.veryCompact ? 10 : 14;
    const sideWidth = layout.sideButtonWidth;
    const leftX = layout.centerX - sideWidth / 2 - gap / 2;
    const rightX = layout.centerX + sideWidth / 2 + gap / 2;

    const primaryHeight = Phaser.Math.Clamp(
      panelHeight * 0.22,
      62,
      layout.veryCompact ? 74 : 86
    );
    const gridButtonHeight = Phaser.Math.Clamp(
      panelHeight * 0.22,
      62,
      layout.veryCompact ? 74 : 86
    );

    this.actionButtons.push(
      ...this.createSpriteBattleButton({
        x: layout.centerX,
        y: layout.attackButtonY,
        width: layout.mainButtonWidth,
        height: primaryHeight,
        textureKey: this.BATTLE_ASSETS.buttons.attack.key,
        title: 'Атака оружием',
        subtitle: 'основное действие',
        variant: 'primary',
        disabled: this.isBusy || this.isBattleEnded,
        onClick: () => this.handleAttack(),
      })
    );

    this.actionButtons.push(
      ...this.createSpriteBattleButton({
        x: leftX,
        y: layout.firstRowY,
        width: sideWidth,
        height: gridButtonHeight,
        textureKey: this.BATTLE_ASSETS.buttons.power.key,
        title: 'Сильный удар',
        subtitle: `${this.powerAttackEnergyCost + this.getSkillCostPenalty()} эн.`,
        variant: 'heavy',
        disabled: !canUsePower,
        onClick: () => this.handlePowerAttack(),
      })
    );

    this.actionButtons.push(
      ...this.createSpriteBattleButton({
        x: rightX,
        y: layout.firstRowY,
        width: sideWidth,
        height: gridButtonHeight,
        textureKey: this.BATTLE_ASSETS.buttons.defence.key,
        title: 'Защита',
        subtitle: '+1 энергия',
        variant: 'defense',
        disabled: this.isBusy || this.isBattleEnded,
        onClick: () => this.handleDefend(),
      })
    );

    this.actionButtons.push(
      ...this.createSpriteBattleButton({
        x: leftX,
        y: layout.secondRowY,
        width: sideWidth,
        height: gridButtonHeight,
        textureKey: this.getRaceSkillButtonSpriteKey(),
        title: 'Навык расы',
        subtitle: this.getRaceSkillSubtitle(),
        variant: 'magic',
        disabled: !canUseRaceSkill,
        onClick: () => this.handleRaceSkill(),
      })
    );

    this.actionButtons.push(
      ...this.createSpriteBattleButton({
        x: rightX,
        y: layout.secondRowY,
        width: sideWidth,
        height: gridButtonHeight,
        textureKey: this.BATTLE_ASSETS.buttons.heal.key,
        title: 'Зелье',
        subtitle: this.getPotionButtonSubtitle(),
        variant: 'heal',
        disabled: !canUsePotion,
        onClick: () => this.handlePotion(),
      })
    );

    if (!this.isBusy) {
      this.tweens.add({
        targets: this.actionButtons,
        alpha: {
          from: 0,
          to: 1,
        },
        duration: 150,
        ease: 'Sine.easeOut',
      });
    }
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


  private createSpriteBattleButton(config: {
  x: number;
  y: number;
  width: number;
  height: number;
  textureKey: string;
  title: string;
  subtitle: string;
  disabled?: boolean;
  variant?: 'primary' | 'heavy' | 'defense' | 'magic' | 'heal';
  onClick: () => void;
}) {
  const disabled = config.disabled ?? false;
  const isPrimary = config.variant === 'primary';
  const container = this.add.container(config.x, config.y).setDepth(24);

  const shadow = this.add.rectangle(
    0,
    4,
    config.width * 0.94,
    config.height * 0.72,
    0x000000,
    disabled ? 0.18 : 0.36
  );

  const buttonImage = this.add.image(0, 0, config.textureKey)
    .setOrigin(0.5)
    .setDisplaySize(config.width, config.height)
    .setAlpha(disabled ? 0.56 : 1);

  if (disabled) {
    buttonImage.setTint(0x6f6f6f);
  }

  const textX = -config.width / 2 + (isPrimary
    ? config.width * 0.185
    : config.width * 0.245);
  const rightPadding = isPrimary ? 28 : 16;
  const textWidth = Math.max(70, config.width / 2 - textX - rightPadding);
  const titleSize = this.getButtonTitleFontSize(config.width, isPrimary);
  const subtitleSize = this.getButtonSubtitleFontSize(config.width, isPrimary);

  const titleY = isPrimary ? -config.height * 0.14 : -config.height * 0.16;
  const subtitleY = isPrimary ? config.height * 0.19 : config.height * 0.20;

  const titleText = this.add.text(textX, titleY, config.title, {
    fontFamily: UI.font.title,
    fontSize: titleSize,
    color: disabled ? '#6d6860' : UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 3,
    align: 'left',
    wordWrap: {
      width: textWidth,
      useAdvancedWrap: true,
    },
    maxLines: 1,
  }).setOrigin(0, 0.5);

  const subtitleText = this.add.text(textX, subtitleY, config.subtitle, {
    fontFamily: UI.font.body,
    fontSize: subtitleSize,
    color: disabled ? '#4b4740' : '#b8aa91',
    stroke: '#000000',
    strokeThickness: 2,
    align: 'left',
    wordWrap: {
      width: textWidth,
      useAdvancedWrap: true,
    },
    maxLines: 1,
  }).setOrigin(0, 0.5);

  const zone = this.add.zone(0, 0, config.width, config.height)
    .setInteractive({ useHandCursor: !disabled });

  container.add([
    shadow,
    buttonImage,
    titleText,
    subtitleText,
    zone,
  ]);

  if (!disabled) {
    let isPressed = false;
    let isLocked = false;
    const baseY = config.y;

    const reset = () => {
      if (isLocked) {
        return;
      }

      isPressed = false;
      container.setY(baseY);
      container.setScale(1);
      buttonImage.setAlpha(1);
      titleText.setColor(UI.colors.goldText);
    };

    zone.on('pointerover', () => {
      if (isLocked) {
        return;
      }

      container.setScale(1.015);
      buttonImage.setAlpha(0.96);
    });

    zone.on('pointerout', reset);
    zone.on('pointerupoutside', reset);
    zone.on('pointercancel', reset);

    zone.on('pointerdown', () => {
      if (isLocked) {
        return;
      }

      isPressed = true;
      container.setY(baseY + 2);
      container.setScale(0.995);
      buttonImage.setAlpha(0.86);
      titleText.setColor('#fff0b8');
    });

    zone.on('pointerup', () => {
      if (!isPressed || isLocked || this.isBusy || this.isBattleEnded) {
        return;
      }

      isPressed = false;
      isLocked = true;

      this.tweens.killTweensOf(container);
      this.tweens.add({
        targets: container,
        y: baseY,
        scaleX: 1,
        scaleY: 1,
        duration: 55,
        ease: 'Linear',
        onComplete: () => {
          buttonImage.setAlpha(1);
          titleText.setColor(UI.colors.goldText);

          if (!this.isBusy && !this.isBattleEnded) {
            config.onClick();
          }
        },
      });

      this.time.delayedCall(220, () => {
        isLocked = false;
      });
    });
  }

  return [container];
}

  private getButtonTitleFontSize(width: number, isPrimary: boolean) {
    if (isPrimary) {
      return width < 430 ? '15px' : width < 520 ? '17px' : '19px';
    }

    return width < 230 ? '10px' : width < 270 ? '11px' : '13px';
  }

  private getButtonSubtitleFontSize(width: number, isPrimary: boolean) {
    if (isPrimary) {
      return width < 430 ? '10px' : width < 520 ? '11px' : '12px';
    }

    return width < 230 ? '8px' : width < 270 ? '9px' : '10px';
  }

  private getRaceSkillButtonSpriteKey() {
    if (player.raceId === 'tainted_halfblood') return this.BATTLE_ASSETS.buttons.tainted.key;
    if (player.raceId === 'goblin') return this.BATTLE_ASSETS.buttons.goblin.key;
    if (player.raceId === 'stoneborn') return this.BATTLE_ASSETS.buttons.stone.key;
    if (player.raceId === 'night_elf') return this.BATTLE_ASSETS.buttons.elf.key;
    if (player.raceId === 'demon') return this.BATTLE_ASSETS.buttons.demon.key;

    return this.BATTLE_ASSETS.buttons.human.key;
  }

  private getEnemySpriteKey() {
    const enemySprites = this.BATTLE_ASSETS.enemySprites;
    const enemyId = this.enemy?.id as keyof typeof enemySprites | undefined;

    if (enemyId && enemySprites[enemyId]) {
      return enemySprites[enemyId].key;
    }

    return enemySprites.bone_gnawer.key;
  }

  private getPlayerRaceSpriteKey() {
    const raceSprites = this.BATTLE_ASSETS.raceSprites;

    if (player.raceId === 'tainted_halfblood') return raceSprites.tainted.key;
    if (player.raceId === 'goblin') return raceSprites.goblin.key;
    if (player.raceId === 'stoneborn') return raceSprites.stone.key;
    if (player.raceId === 'night_elf') return raceSprites.elf.key;
    if (player.raceId === 'demon') return raceSprites.demon.key;

    return raceSprites.human.key;
  }

  private getEnemySpriteSizeMultiplier() {
    const enemyId = this.enemy?.id;

    if (enemyId === 'morvein_sealed_crypt_lord') {
      return 1.22;
    }

    const miniBossIds = new Set<string>([
      'bone_abbot',
      'sarcophagus_lord',
      'lower_crypt_executioner',
      'funeral_champion',
      'bone_collector',
      'dead_knight_varn',
      'rotten_bishop',
      'black_tomb_guardian',
    ]);

    if (enemyId && miniBossIds.has(enemyId)) {
      return 1.12;
    }

    const eliteIds = new Set<string>([
      'sarcophagus_keeper',
      'bone_executioner',
      'crypt_butcher',
      'buried_knight',
      'bone_armored_guard',
      'dead_standard_bearer',
      'rotten_chaplain',
      'leper_guard',
      'crypt_torturer',
      'bloody_gravedigger',
    ]);

    if (enemyId && eliteIds.has(enemyId)) {
      return 1.06;
    }

    return 1;
  }

  private fitImageToBox(
    image: Phaser.GameObjects.Image,
    maxWidth: number,
    maxHeight: number,
    fillMultiplier = 1
  ) {
    const frameWidth = image.frame?.realWidth || image.width || 1;
    const frameHeight = image.frame?.realHeight || image.height || 1;
    const scale = Math.min(maxWidth / frameWidth, maxHeight / frameHeight) * fillMultiplier;

    image.setScale(scale);

    return image;
  }

  private createEnemySprite(
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    isBoss = false
  ) {
    const container = this.add.container(x, y);
    const sizeMultiplier = this.getEnemySpriteSizeMultiplier();
    const glowAlpha = isBoss || this.enemy?.id === 'morvein_sealed_crypt_lord'
      ? 0.16
      : 0.08;

    const platform = this.add.ellipse(
      0,
      maxHeight * 0.35,
      maxWidth * 0.78 * sizeMultiplier,
      Math.max(12, maxHeight * 0.16),
      0x000000,
      0.46
    );

    const platformGlow = this.add.ellipse(
      0,
      maxHeight * 0.32,
      maxWidth * 0.58 * sizeMultiplier,
      Math.max(8, maxHeight * 0.10),
      isBoss || this.enemy?.id === 'morvein_sealed_crypt_lord' ? 0xff6b35 : 0xff6b6b,
      glowAlpha
    );

    const sprite = this.add.image(0, -maxHeight * 0.06, this.getEnemySpriteKey())
      .setOrigin(0.5, 0.58)
      // Враг стоит справа, поэтому разворачиваем его влево, к герою.
      .setFlipX(true);

    this.fitImageToBox(
      sprite,
      maxWidth * 1.26 * sizeMultiplier,
      maxHeight * 1.38 * sizeMultiplier,
      1
    );

    container.add([platform, platformGlow, sprite]);

    return container;
  }

  private createPlayerRaceSprite(
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number
  ) {
    const container = this.add.container(x, y);

    const platform = this.add.ellipse(
      0,
      maxHeight * 0.34,
      maxWidth * 0.78,
      Math.max(12, maxHeight * 0.16),
      0x000000,
      0.42
    );

    const platformGlow = this.add.ellipse(
      0,
      maxHeight * 0.32,
      maxWidth * 0.58,
      Math.max(8, maxHeight * 0.10),
      UI.colors.gold,
      0.08
    );

    const sprite = this.add.image(0, -maxHeight * 0.08, this.getPlayerRaceSpriteKey())
      .setOrigin(0.5, 0.55)
      // Герой стоит слева и смотрит вправо, к врагу.
      .setFlipX(false);

    this.fitImageToBox(sprite, maxWidth * 1.24, maxHeight * 1.38, 1);

    container.add([platform, platformGlow, sprite]);

    return container;
  }

  private applyNearestFilterToBattleTextures() {
    const keys = [
      this.BATTLE_ASSETS.actionPanel.key,
      ...Object.values(this.BATTLE_ASSETS.enemySprites).map(asset => asset.key),
      ...Object.values(this.BATTLE_ASSETS.buttons).map(asset => asset.key),
      ...Object.values(this.BATTLE_ASSETS.raceSprites).map(asset => asset.key),
    ];

    keys.forEach(key => {
      const texture = this.textures.get(key);

      if (!texture) {
        return;
      }

      try {
        (texture as any).setFilter?.(Phaser.Textures.FilterMode.NEAREST);
      } catch {
        // Phaser версии отличаются по API фильтрации. Если setFilter недоступен,
        // игра продолжит работать, а pixelArt обычно уже включён в config.
      }
    });
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
  this.playSkillCastAnimation('player');

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

  this.appendBattleLog(playerActionText);
  this.updateTexts();

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

  this.animatePlayerAttack('skill');
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
  this.playSkillCastAnimation('player');

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.setRaceSkillCooldown();
  this.stoneQuartzSpikesTurns = 2;

  const playerActionText =
    `Кварцевые шипы.\n` +
    `На 2 хода: +10% к защите и отражение 30% полученного урона.`;

  this.appendBattleLog(playerActionText);
  this.updateTexts();

  this.time.delayedCall(450, () => {
    this.enemyTurn(playerActionText, false);
  });
}

private handleNightElfSkill() {
  this.isBusy = true;
  this.playSkillCastAnimation('player');

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.setRaceSkillCooldown();
  this.nightElfShadowStepTurns = 3;

  const playerActionText =
    `Шаг в тень.\n` +
    `На 3 хода шанс уклониться от атаки врага становится не ниже 50%.`;

  this.appendBattleLog(playerActionText);
  this.updateTexts();

  this.time.delayedCall(450, () => {
    this.enemyTurn(playerActionText, false);
  });
}

private handleGoblinSkill() {
  this.isBusy = true;
  this.playSkillCastAnimation('enemy');

  player.energy -= this.getRaceSkillEnergyCost() + this.getSkillCostPenalty();
  this.setRaceSkillCooldown();
  this.goblinGreedyMarkTurns = 3;

  const playerActionText =
    `Воровская метка.\n` +
    `Враг помечен на 3 хода. Он получает на 20% больше урона от гоблина.\n` +
    `Если враг умрёт под меткой: +25% золота и 10% шанс дополнительного материала.`;

  this.appendBattleLog(playerActionText);
  this.updateTexts();

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

  this.animatePlayerAttack('skill');
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
      this.appendBattleLog('Недостаточно энергии для сильного удара.');
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

    this.animatePlayerAttack('power');
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
    this.playDefendAnimation();

    const restoredNow = restoreEnergy(player, 1);
    const playerActionText = `Ты занял защитную стойку.\n${this.createEnergyRestoreText(restoredNow)}`;

    this.appendBattleLog(playerActionText);
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

    bar.setVisible(true);
    bar.setFillStyle(color, 0.78);
    bar.x = -maxWidth / 2 + Math.max(0, currentWidth - damageWidth);
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

    this.appendBattleLog(text);
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

  this.appendBattleLog(debuffText);

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

    if (!this.combatAnimationLocked) {
      this.animateHit(this.enemyCard);
    }
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

      this.appendBattleLog(
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
    const { width, height } = layout;
    const floor = gameState.floorRun.currentFloor || 1;
    const theme = getCryptDepthTheme(floor);
    const arenaWidth = Math.min(width - layout.safeX * 2, 690);

    this.add.rectangle(width / 2, height / 2, width, height, 0x020203, 1).setDepth(0);
    this.add.rectangle(width / 2, height * 0.4, width, height * 0.9, theme.background, 0.58).setDepth(0);
    this.add.rectangle(width / 2, height / 2, width, height, isBoss ? 0x260707 : 0x070a12, isBoss ? 0.14 : 0.1).setDepth(0);

    this.add.circle(width / 2, layout.enemyY - 24, width * 0.64, isBoss ? 0x5c120d : theme.glow, isBoss ? 0.095 : 0.055).setDepth(1);
    this.add.circle(width / 2, layout.playerY + 26, width * 0.44, 0x070e18, 0.12).setDepth(1);

    const hallTop = layout.safeTop + (layout.veryCompact ? 82 : 102);
    const hallBottom = layout.logY - layout.logHeight / 2 - 8;
    const hallHeight = Math.max(260, hallBottom - hallTop);
    const hallY = hallTop + hallHeight / 2;

    const backWall = this.add.graphics().setDepth(1);
    backWall.fillStyle(isBoss ? 0x120606 : 0x08090d, 0.9);
    backWall.fillRoundedRect(width / 2 - arenaWidth / 2, hallTop, arenaWidth, hallHeight, 32);
    backWall.lineStyle(2, isBoss ? 0x5c1d12 : 0x30261d, isBoss ? 0.56 : 0.4);
    backWall.strokeRoundedRect(width / 2 - arenaWidth / 2, hallTop, arenaWidth, hallHeight, 32);

    const arch = this.add.graphics().setDepth(2);
    arch.lineStyle(layout.veryCompact ? 10 : 14, isBoss ? 0x25100c : 0x12151c, 0.92);
    arch.strokeCircle(width / 2, layout.enemyY + (layout.veryCompact ? 34 : 52), arenaWidth * 0.34);
    arch.fillStyle(0x000000, 0.24);
    arch.fillRect(width / 2 - arenaWidth * 0.38, layout.enemyY + (layout.veryCompact ? 32 : 50), arenaWidth * 0.76, hallBottom - layout.enemyY);

    const brickWidth = Math.min(92, arenaWidth / 6.4);
    const brickHeight = layout.veryCompact ? 20 : 26;
    const brickRows = layout.veryCompact ? 5 : 7;
    for (let row = 0; row < brickRows; row += 1) {
      const count = row % 2 === 0 ? 6 : 7;
      const y = hallTop + 18 + row * (brickHeight + 9);
      for (let i = 0; i < count; i += 1) {
        const x = width / 2 - ((count - 1) * brickWidth) / 2 + i * brickWidth + (row % 2 === 0 ? 0 : -brickWidth * 0.25);
        this.add.rectangle(x, y, brickWidth - 7, brickHeight, isBoss ? 0x1a0b08 : 0x101218, 0.26)
          .setStrokeStyle(1, isBoss ? 0x4a160f : 0x29303a, 0.2)
          .setDepth(2);
      }
    }

    const leftColumnX = width / 2 - arenaWidth / 2 + (layout.veryCompact ? 26 : 34);
    const rightColumnX = width / 2 + arenaWidth / 2 - (layout.veryCompact ? 26 : 34);
    [leftColumnX, rightColumnX].forEach((x, index) => {
      this.add.rectangle(x, hallY, layout.veryCompact ? 32 : 42, hallHeight - 16, 0x0c0a08, 0.82)
        .setStrokeStyle(2, isBoss ? 0x4a160f : 0x2c2118, 0.48)
        .setDepth(3);
      this.add.rectangle(x, hallTop + 18, layout.veryCompact ? 46 : 58, 20, 0x15100c, 0.86)
        .setStrokeStyle(1, 0x5f4630, 0.38)
        .setDepth(4);
      this.add.rectangle(x, hallBottom - 18, layout.veryCompact ? 52 : 64, 24, 0x15100c, 0.86)
        .setStrokeStyle(1, 0x5f4630, 0.38)
        .setDepth(4);

      const flame = this.add.circle(x, layout.enemyY - (layout.veryCompact ? 28 : 44), layout.veryCompact ? 9 : 12, index === 0 ? 0xb9985b : theme.accent, 0.24)
        .setDepth(5);
      this.tweens.add({
        targets: flame,
        alpha: 0.45,
        scaleX: 1.18,
        scaleY: 1.18,
        duration: 900 + index * 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    const floorTopY = layout.fighterY + (layout.veryCompact ? 54 : 70);
    const floorBottomY = Math.min(height - 206, layout.logY - layout.logHeight / 2 - 10);
    const floorHeight = Math.max(76, floorBottomY - floorTopY);

    const floorPlate = this.add.graphics().setDepth(4);
    floorPlate.fillStyle(0x070605, 0.88);
    floorPlate.fillRoundedRect(width / 2 - arenaWidth / 2 + 18, floorTopY, arenaWidth - 36, floorHeight, 18);
    floorPlate.lineStyle(2, isBoss ? 0x5c1d12 : 0x372416, 0.5);
    floorPlate.strokeRoundedRect(width / 2 - arenaWidth / 2 + 18, floorTopY, arenaWidth - 36, floorHeight, 18);

    for (let i = 0; i < 9; i += 1) {
      const xTop = width / 2 - arenaWidth / 2 + 46 + i * ((arenaWidth - 92) / 8);
      const xBottom = width / 2 - arenaWidth / 2 + 20 + i * ((arenaWidth - 40) / 8);
      this.add.line(0, 0, xTop, floorTopY + 4, xBottom, floorBottomY - 4, isBoss ? 0x4a160f : 0x302419, isBoss ? 0.32 : 0.24)
        .setOrigin(0, 0)
        .setDepth(5);
    }

    const enemyShadow = this.add.ellipse(layout.enemyX, layout.fighterY + (layout.veryCompact ? 62 : 78), arenaWidth * 0.24, layout.veryCompact ? 56 : 72, 0x000000, 0.42)
      .setDepth(4);
    const playerShadow = this.add.ellipse(layout.playerX, layout.fighterY + (layout.veryCompact ? 62 : 78), arenaWidth * 0.24, layout.veryCompact ? 56 : 72, 0x000000, 0.38)
      .setDepth(4);

    this.tweens.add({
      targets: [enemyShadow, playerShadow],
      scaleX: 1.04,
      alpha: 0.5,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    for (let i = 0; i < 34; i += 1) {
      const x = layout.safeX + 12 + (i * 47) % Math.max(1, width - layout.safeX * 2 - 24);
      const y = layout.safeTop + 56 + (i * 73) % Math.max(1, height - layout.safeTop - layout.safeBottom - 170);
      const size = 1 + (i % 3);
      const alpha = 0.025 + (i % 5) * 0.006;
      const dust = this.add.circle(x, y, size, i % 4 === 0 ? theme.accent : 0xd8b56d, alpha).setDepth(6);

      this.tweens.add({
        targets: dust,
        y: y - Phaser.Math.Between(8, 24),
        alpha: alpha * 1.8,
        duration: Phaser.Math.Between(1800, 3600),
        yoyo: true,
        repeat: -1,
        delay: i * 55,
        ease: 'Sine.easeInOut',
      });
    }

    if (isBoss) {
      this.add.rectangle(width / 2, height / 2, width, height, 0x3a0505, 0.12).setDepth(6);
      const dangerLine = this.add.rectangle(width / 2, layout.enemyY + (layout.veryCompact ? 66 : 88), arenaWidth - 72, 3, 0xff6b35, 0.28)
        .setDepth(7);
      this.tweens.add({
        targets: dangerLine,
        alpha: 0.55,
        duration: 620,
        yoyo: true,
        repeat: -1,
      });
    }

    this.add.rectangle(12, height / 2, 24, height, 0x000000, 0.42).setDepth(8);
    this.add.rectangle(width - 12, height / 2, 24, height, 0x000000, 0.42).setDepth(8);
    this.add.rectangle(width / 2, height - 42, width, 84, 0x000000, 0.26).setDepth(8);
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
  _icon: string,
  color: number,
  isEnemy: boolean,
  isBoss = false
) {
  return this.createFighterSpriteCard({
    x,
    y,
    name,
    color,
    isEnemy,
    isBoss,
  });
}

private createFighterSpriteCard(config: {
  x: number;
  y: number;
  name: string;
  color: number;
  isEnemy: boolean;
  isBoss: boolean;
}) {
  const layout = this.getBattleLayout();

  const cardWidth = Math.min(
    (layout.contentWidth - (layout.veryCompact ? 18 : 26)) / 2,
    config.isBoss ? 344 : 318
  );

  const cardHeight = layout.veryCompact ? 258 : layout.compact ? 296 : 330;
  const container = this.add.container(config.x, config.y).setDepth(config.isEnemy ? 19 : 20);

  container.setData('baseX', config.x);
  container.setData('baseY', config.y);
  container.setData('side', config.isEnemy ? 'enemy' : 'player');

  const strokeColor = config.isEnemy
    ? config.isBoss
      ? 0xb84a2f
      : 0x8d2f2f
    : 0x6b5134;
  const accentColor = config.isEnemy ? (config.isBoss ? 0xff8a5f : 0xff6b6b) : UI.colors.gold;
  const titleColor = config.isEnemy ? (config.isBoss ? '#ffd0aa' : '#ffb0a8') : UI.colors.goldText;

  // Размеры PNG-бойцов. Здесь можно менять крупность героя и врага.
  const spriteMaxWidth = cardWidth * (config.isEnemy ? 1.08 : 1.00);
  const spriteMaxHeight = cardHeight * (config.isEnemy ? 0.90 : 0.86);
  const spriteY = -cardHeight * 0.24;

  const aura = this.add.circle(
    0,
    spriteY - cardHeight * 0.05,
    Math.max(spriteMaxWidth, spriteMaxHeight) * 0.32,
    accentColor,
    config.isBoss ? 0.105 : 0.058
  );

  const fighterSprite = config.isEnemy
    ? this.createEnemySprite(0, spriteY, spriteMaxWidth, spriteMaxHeight, config.isBoss)
    : this.createPlayerRaceSprite(0, spriteY, spriteMaxWidth, spriteMaxHeight);

  const infoWidth = cardWidth;
  const infoHeight = layout.veryCompact ? 88 : layout.compact ? 98 : 106;
  const infoX = 0;
  const infoY = cardHeight * 0.35;
  const infoLeft = infoX - infoWidth / 2;
  const infoTop = infoY - infoHeight / 2;

  const infoShadow = this.add.graphics();
  infoShadow.fillStyle(0x000000, 0.42);
  infoShadow.fillRoundedRect(infoLeft, infoTop + 5, infoWidth, infoHeight, layout.veryCompact ? 15 : 18);

  const infoPanel = this.add.graphics();
  infoPanel.fillStyle(config.isEnemy ? 0x10090a : 0x0b1018, 0.86);
  infoPanel.fillRoundedRect(infoLeft, infoTop, infoWidth, infoHeight, layout.veryCompact ? 15 : 18);
  infoPanel.fillStyle(config.color, config.isEnemy ? 0.16 : 0.14);
  infoPanel.fillRoundedRect(infoLeft + 6, infoTop + 6, infoWidth - 12, infoHeight - 12, layout.veryCompact ? 10 : 14);
  infoPanel.lineStyle(config.isBoss ? 2 : 1.5, strokeColor, config.isBoss ? 0.78 : 0.58);
  infoPanel.strokeRoundedRect(infoLeft, infoTop, infoWidth, infoHeight, layout.veryCompact ? 15 : 18);
  infoPanel.lineStyle(1, 0xf0d58a, config.isBoss ? 0.18 : 0.10);
  infoPanel.strokeRoundedRect(infoLeft + 6, infoTop + 6, infoWidth - 12, infoHeight - 12, layout.veryCompact ? 10 : 14);

  const titleX = infoLeft + (layout.veryCompact ? 10 : 12);
  const titleY = infoTop + (layout.veryCompact ? 15 : 18);
  const badgeWidth = layout.veryCompact ? 54 : 64;
  const badgeHeight = layout.veryCompact ? 18 : 22;
  const badgeX = infoLeft + infoWidth - badgeWidth / 2 - 8;

  const nameText = this.add.text(titleX, titleY, config.name, {
    fontFamily: UI.font.title,
    fontSize: config.isBoss
      ? layout.veryCompact ? '11px' : layout.compact ? '13px' : '15px'
      : layout.veryCompact ? '10px' : layout.compact ? '12px' : '14px',
    color: titleColor,
    stroke: '#000000',
    strokeThickness: 3,
    wordWrap: {
      width: Math.max(92, infoWidth - badgeWidth - 28),
      useAdvancedWrap: true,
    },
    maxLines: config.isEnemy ? 2 : 1,
    lineSpacing: -3,
  }).setOrigin(0, 0.5);

  const badge = this.add.rectangle(
    badgeX,
    titleY,
    badgeWidth,
    badgeHeight,
    config.isEnemy ? 0x1a0907 : 0x101722,
    0.92
  ).setStrokeStyle(1, config.isEnemy ? accentColor : 0x70a6ff, config.isEnemy ? 0.44 : 0.4);

  const badgeText = this.add.text(
    badgeX,
    titleY,
    config.isEnemy ? (config.isBoss ? 'БОСС' : 'ВРАГ') : `Зелья: ${player.potions}`,
    {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '7px' : '9px',
      color: config.isEnemy ? '#ffb08a' : '#b9d8ff',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: badgeWidth - 6,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }
  ).setOrigin(0.5);

  const hpText = this.add.text(titleX, infoTop + infoHeight * 0.42, '', {
    fontFamily: UI.font.body,
    fontSize: layout.veryCompact ? '9px' : layout.compact ? '10px' : '12px',
    color: config.isEnemy ? '#ffd0c2' : UI.colors.text,
    wordWrap: {
      width: infoWidth - 24,
      useAdvancedWrap: true,
    },
    maxLines: 1,
  }).setOrigin(0, 0.5);

  const extraText = this.add.text(titleX, infoTop + infoHeight * 0.59, '', {
    fontFamily: UI.font.body,
    fontSize: layout.veryCompact ? '8px' : layout.compact ? '9px' : '10px',
    color: '#b8aa91',
    wordWrap: {
      width: infoWidth - 24,
      useAdvancedWrap: true,
    },
    maxLines: 1,
  }).setOrigin(0, 0.5);

  const barWidth = Math.max(112, infoWidth - (layout.veryCompact ? 22 : 28));
  const barCenterX = titleX + barWidth / 2;
  const barY = infoTop + infoHeight * 0.76;
  const energyBarY = barY + (layout.veryCompact ? 11 : 13);
  const hpBarHeight = layout.veryCompact ? 7 : 8;
  const energyBarHeight = layout.veryCompact ? 5 : 6;

  const barBack = this.add.rectangle(barCenterX, barY, barWidth, hpBarHeight, 0x020202, 0.96)
    .setStrokeStyle(1, 0x000000, 0.85);

  const hpBar = this.add.rectangle(
    titleX,
    barY,
    barWidth,
    hpBarHeight,
    config.isEnemy ? 0xff6b6b : 0x75d184,
    0.98
  ).setOrigin(0, 0.5);

  const hpPreviewBar = this.add.rectangle(
    titleX,
    barY,
    1,
    hpBarHeight,
    0xf0d58a,
    0.72
  ).setOrigin(0, 0.5).setVisible(false);

  const hpBarFrame = this.add.rectangle(barCenterX, barY, barWidth, hpBarHeight)
    .setStrokeStyle(1, 0x000000, 0.9);

  const energyBack = this.add.rectangle(barCenterX, energyBarY, barWidth, energyBarHeight, 0x020202, config.isEnemy ? 0 : 0.96);
  const energyBar = this.add.rectangle(titleX, energyBarY, barWidth, energyBarHeight, 0x70a6ff, config.isEnemy ? 0 : 0.96)
    .setOrigin(0, 0.5);

  const hoverZone = this.add.zone(0, cardHeight * 0.03, cardWidth, cardHeight * 0.94)
    .setInteractive({ useHandCursor: true });

  hoverZone.on('pointerup', () => {
    if (config.isEnemy) {
      this.showEnemyTooltip();
    } else {
      this.showPlayerTooltip();
    }
  });

  container.add([
    aura,
    fighterSprite,
    infoShadow,
    infoPanel,
    nameText,
    badge,
    badgeText,
    hpText,
    extraText,
    barBack,
    hpBar,
    hpPreviewBar,
    hpBarFrame,
    energyBack,
    energyBar,
  ]);

  if (config.isBoss) {
    const bossBanner = this.add.rectangle(0, infoTop - (layout.veryCompact ? 11 : 14), Math.min(infoWidth, 190), layout.veryCompact ? 20 : 24, 0x3a0907, 0.98)
      .setStrokeStyle(2, 0xff6b35, 0.82);

    const bossLabel = this.add.text(0, bossBanner.y, 'БОСС', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '8px' : '10px',
      color: '#ffb36b',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      maxLines: 1,
    }).setOrigin(0.5);

    container.add([bossBanner, bossLabel]);

    this.tweens.add({
      targets: [bossBanner, bossLabel],
      alpha: 0.68,
      duration: 760,
      yoyo: true,
      repeat: -1,
    });
  }

  if (config.isEnemy) {
    this.enemyHpText = hpText;
    this.enemyHpBar = hpBar;
    this.enemyHpPreviewBar = hpPreviewBar;
    this.enemyHpBarMaxWidth = barWidth;

    extraText.setText(`АТК ${this.enemy.attack} • ЗАЩ ${this.enemy.defense}`);

    container.add(hoverZone);
  } else {
    this.playerHpText = hpText;
    this.playerHpBar = hpBar;
    this.playerHpPreviewBar = hpPreviewBar;
    this.playerHpBarMaxWidth = barWidth;
    this.energyBar = energyBar;
    this.energyBarMaxWidth = barWidth;
    this.energyText = extraText;
    this.potionText = badgeText;

    const stats = this.getBattleStats();
    const statLine = this.add.text(titleX, infoTop + infoHeight + (layout.veryCompact ? 7 : 9), `АТК ${stats.attack} • ЗАЩ ${stats.defense} • КРИТ ${Math.round(stats.critChance * 100)}%`, {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '7px' : layout.compact ? '8px' : '9px',
      color: '#b8aa91',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: infoWidth - 16,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5);

    this.playerDebuffText = this.add.text(titleX, infoTop + infoHeight + (layout.veryCompact ? 20 : 24), '', {
      fontFamily: UI.font.body,
      fontSize: layout.veryCompact ? '7px' : '9px',
      color: '#c084fc',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: infoWidth - 16,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setVisible(false);

    container.add([statLine, this.playerDebuffText, hoverZone]);
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
  const cardHeight = layout.veryCompact ? 128 : layout.compact ? 150 : 174;
  const visibleCount = Math.min(effects.length, 3);
  const chipWidth = Math.min(142, (layout.contentWidth - 96) / visibleCount);
  const totalWidth = visibleCount * chipWidth + Math.max(0, visibleCount - 1) * 6;
  const startX = -totalWidth / 2 + chipWidth / 2;
  const y = cardHeight / 2 + (layout.veryCompact ? 14 : 18);

  effects.slice(0, 3).forEach((effect, index) => {
    const x = startX + index * (chipWidth + 6);

    this.createEffectChip({
      parent: this.playerCard,
      x,
      y,
      width: chipWidth,
      height: 34,
      text: `${effect.name} • ${effect.duration} х.`,
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
  const cardHeight = this.isBossBattle
    ? layout.veryCompact ? 132 : layout.compact ? 154 : 178
    : layout.veryCompact ? 118 : layout.compact ? 138 : 160;
  const visibleCount = Math.min(effects.length, 3);
  const chipWidth = Math.min(150, (layout.contentWidth - 96) / visibleCount);
  const totalWidth = visibleCount * chipWidth + Math.max(0, visibleCount - 1) * 6;
  const startX = this.enemyCard.x - totalWidth / 2 + chipWidth / 2;
  const y = this.enemyCard.y + cardHeight / 2 + (layout.veryCompact ? 14 : 18);

  effects.slice(0, 3).forEach((effect, index) => {
    const x = startX + index * (chipWidth + 6);

    this.createEffectChip({
      x,
      y,
      width: chipWidth,
      height: 34,
      text: `${effect.name} • ${effect.duration} х.`,
      icon: this.getDebuffIcon(effect.id),
      color: this.getDebuffColor(effect.id),
      tooltipTitle: effect.name,
      tooltipDescription:
        `${this.getDebuffShortDescription(effect.id, effect.power)}\n` +
        `Осталось ходов: ${effect.duration}.`,
      targetArray: this.enemyEffectObjects,
    });
  });

  if (effects.length > 3) {
    const hiddenCount = effects.length - 3;
    const x = startX + visibleCount * (chipWidth + 6);

    this.createEffectChip({
      x,
      y,
      width: 48,
      height: 34,
      text: `+${hiddenCount}`,
      icon: '•',
      color: UI.colors.gold,
      tooltipTitle: 'Другие эффекты',
      tooltipDescription: effects
        .slice(3)
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

  private getCardBasePosition(target: Phaser.GameObjects.Container) {
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

    return {
      x: baseX,
      y: baseY,
    };
  }

  private async playPlayerAttackAnimation(kind: 'normal' | 'power' | 'skill' = 'normal') {
    if (!this.playerCard || !this.enemyCard || this.isBattleEnded || this.combatAnimationLocked) {
      return;
    }

    this.combatAnimationLocked = true;

    const playerBase = this.getCardBasePosition(this.playerCard);
    const enemyBase = this.getCardBasePosition(this.enemyCard);

    this.tweens.killTweensOf(this.playerCard);
    this.tweens.killTweensOf(this.enemyCard);

    this.playerCard.setPosition(playerBase.x, playerBase.y);
    this.enemyCard.setPosition(enemyBase.x, enemyBase.y);

    const dashDistance = kind === 'power' ? 40 : kind === 'skill' ? 34 : 30;
    const tilt = kind === 'power' ? 2.5 : 1.6;

    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: this.playerCard,
        x: playerBase.x + dashDistance,
        y: playerBase.y - 4,
        angle: tilt,
        duration: kind === 'power' ? 120 : 95,
        ease: 'Quad.easeOut',
        onComplete: () => resolve(),
      });
    });

    if (this.isBattleEnded) {
      this.combatAnimationLocked = false;
      return;
    }

    this.createImpactFlash(this.enemyCard.x - 12, this.enemyCard.y - 34, kind === 'skill' ? 0xc084fc : kind === 'power' ? 0xff9a3d : 0xf0d58a);
    this.tweens.add({
      targets: this.enemyCard,
      x: enemyBase.x + (kind === 'power' ? 18 : 12),
      duration: 70,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.enemyCard?.setPosition(enemyBase.x, enemyBase.y);
      },
    });

    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: this.playerCard,
        x: playerBase.x,
        y: playerBase.y,
        angle: 0,
        duration: 115,
        ease: 'Quad.easeInOut',
        onComplete: () => {
          this.playerCard?.setPosition(playerBase.x, playerBase.y);
          this.playerCard?.setAngle(0);
          this.combatAnimationLocked = false;
          resolve();
        },
      });
    });
  }

  private async playEnemyAttackAnimation() {
    if (!this.enemyCard || !this.playerCard || this.isBattleEnded || this.combatAnimationLocked) {
      return;
    }

    this.combatAnimationLocked = true;

    const enemyBase = this.getCardBasePosition(this.enemyCard);
    const playerBase = this.getCardBasePosition(this.playerCard);

    this.tweens.killTweensOf(this.enemyCard);
    this.tweens.killTweensOf(this.playerCard);

    this.enemyCard.setPosition(enemyBase.x, enemyBase.y);
    this.playerCard.setPosition(playerBase.x, playerBase.y);

    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: this.enemyCard,
        x: enemyBase.x - 34,
        y: enemyBase.y - 2,
        angle: -1.6,
        duration: 105,
        ease: 'Quad.easeOut',
        onComplete: () => resolve(),
      });
    });

    if (this.isBattleEnded) {
      this.combatAnimationLocked = false;
      return;
    }

    this.createImpactFlash(this.playerCard.x + 8, this.playerCard.y - 32, 0xff6b6b);
    this.tweens.add({
      targets: this.playerCard,
      x: playerBase.x - 12,
      duration: 70,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.playerCard?.setPosition(playerBase.x, playerBase.y);
      },
    });

    await new Promise<void>(resolve => {
      this.tweens.add({
        targets: this.enemyCard,
        x: enemyBase.x,
        y: enemyBase.y,
        angle: 0,
        duration: 115,
        ease: 'Quad.easeInOut',
        onComplete: () => {
          this.enemyCard?.setPosition(enemyBase.x, enemyBase.y);
          this.enemyCard?.setAngle(0);
          this.combatAnimationLocked = false;
          resolve();
        },
      });
    });
  }

  private playDefendAnimation() {
    if (!this.playerCard || this.isBattleEnded) {
      return;
    }

    const base = this.getCardBasePosition(this.playerCard);
    this.tweens.killTweensOf(this.playerCard);
    this.playerCard.setPosition(base.x, base.y);

    this.createImpactFlash(base.x, base.y - 38, 0x70a6ff, 0.18);

    this.tweens.add({
      targets: this.playerCard,
      x: base.x - 8,
      scaleX: 1.025,
      scaleY: 1.025,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.playerCard?.setPosition(base.x, base.y);
        this.playerCard?.setScale(1);
      },
    });
  }

  private playPotionAnimation() {
    if (!this.playerCard || this.isBattleEnded) {
      return;
    }

    const base = this.getCardBasePosition(this.playerCard);
    this.createImpactFlash(base.x, base.y - 42, 0x75d184, 0.16, true);
  }

  private playSkillCastAnimation(target: 'player' | 'enemy' = 'enemy') {
    const card = target === 'player' ? this.playerCard : this.enemyCard;

    if (!card || this.isBattleEnded) {
      return;
    }

    const base = this.getCardBasePosition(card);
    this.createImpactFlash(base.x, base.y - 40, 0xc084fc, 0.16);
  }

  private animatePlayerAttack(kind: 'normal' | 'power' | 'skill' = 'normal') {
    void this.playPlayerAttackAnimation(kind)
      .catch(error => {
        console.warn('Player attack animation failed:', error);
        this.combatAnimationLocked = false;
      });
  }

  private animateEnemyAttack() {
    void this.playEnemyAttackAnimation()
      .catch(error => {
        console.warn('Enemy attack animation failed:', error);
        this.combatAnimationLocked = false;
      });
  }

  private animateHit(target: Phaser.GameObjects.Container) {
    const base = this.getCardBasePosition(target);
    const isPlayerTarget = target === this.playerCard;
    const pushX = isPlayerTarget ? -12 : 12;

    this.tweens.killTweensOf(target);
    target.setPosition(base.x, base.y);

    this.tweens.add({
      targets: target,
      x: base.x + pushX,
      duration: 55,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        target.setPosition(base.x, base.y);
        target.setAngle(0);
        target.setScale(1);
      },
    });
  }

  private createImpactFlash(
    x: number,
    y: number,
    color: number,
    alpha = 0.14,
    isHeal = false
  ) {
    const ring = this.add.circle(x, y, isHeal ? 18 : 22, color, alpha)
      .setDepth(255)
      .setScale(0.35);

    this.tweens.add({
      targets: ring,
      scale: 1.35,
      alpha: 0,
      duration: 180,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });

    const sparks = isHeal ? 5 : 6;

    for (let i = 0; i < sparks; i += 1) {
      const angle = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
      const distance = Phaser.Math.Between(16, isHeal ? 34 : 42);
      const particle = this.add.rectangle(
        x,
        y,
        Phaser.Math.Between(3, 5),
        Phaser.Math.Between(3, 5),
        color,
        isHeal ? 0.45 : 0.56
      ).setDepth(256);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.35,
        duration: Phaser.Math.Between(180, 300),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
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

    this.animatePlayerAttack('normal');
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

    this.animatePlayerAttack('power');
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

    this.animatePlayerAttack('power');
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

      this.animatePlayerAttack('normal');
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

   this.animatePlayerAttack('normal');
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

    this.animatePlayerAttack('power');
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

    this.animatePlayerAttack('power');
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

    this.animatePlayerAttack('power');
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

    this.appendBattleLog(
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

    this.appendBattleLog(deathText);
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
      this.appendBattleLog('Зелий больше нет.');
      this.updateTexts();
      return;
    }

    if (this.potionCooldown > 0) {
      this.appendBattleLog(`Зелье будет доступно через ${this.potionCooldown} ход.`);
      this.updateTexts();
      return;
    }

    if (this.hasPlayerDebuff('heal_block')) {
      this.appendBattleLog('Печать не даёт использовать зелье сейчас.');
      this.updateTexts();
      return;
    }

    const stats = this.getBattleStats();
    const maxHp = Math.max(1, Math.floor(stats.maxHp));
    const hpBefore = Phaser.Math.Clamp(Math.floor(player.hp), 0, maxHp);

    player.hp = hpBefore;

    if (hpBefore >= maxHp) {
      this.appendBattleLog('HP уже полное. Зелье не потрачено.');
      this.updateTexts();
      return;
    }

    const rot = this.getPlayerDebuff('rot');
    const healMultiplier = rot ? Math.max(0, 1 - rot.power / 100) : 1;
    const plannedHealAmount = Math.max(1, Math.floor(maxHp * 0.35 * healMultiplier));
    const hpAfter = Math.min(maxHp, hpBefore + plannedHealAmount);
    const actualHealAmount = Math.max(0, hpAfter - hpBefore);

    if (actualHealAmount <= 0) {
      this.appendBattleLog('Зелье не сработало: HP не изменилось. Зелье не потрачено.');
      this.updateTexts();
      return;
    }

    this.isBusy = true;
    this.playPotionAnimation();

    player.potions = Math.max(0, player.potions - 1);
    this.potionCooldown = 2;
    player.hp = hpAfter;

    const rotText = rot
      ? `
Могильная зараза ослабила лечение на ${rot.power}%.`
      : '';

    this.appendBattleLog(
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

        this.appendBattleLog(
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

      if (!this.combatAnimationLocked) {
        this.animateHit(this.playerCard);
      }
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

      this.appendBattleLog(
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

  private requestThrottledBattleAutoSave(reason: string) {
    if (this.isBattleEnded || !this.enemy || player.hp <= 0 || this.enemy.hp <= 0) {
      return;
    }

    const now = this.time.now;

    if (now - this.lastBattleUiSaveAt < this.battleUiSaveMinIntervalMs) {
      return;
    }

    this.lastBattleUiSaveAt = now;
    this.rememberBattleResumePoint(reason);
    requestAutoSave(reason);
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

   this.updateHpPreviewBars(stats);

    if (this.playerDebuffText) {
      this.playerDebuffText.setText('');
      this.playerDebuffText.setVisible(false);
    }
    this.renderPlayerEffectChips();
    this.renderEnemyEffectChips();
    this.updateStatusText();

    this.requestThrottledBattleAutoSave('battle-update');
  }
}
