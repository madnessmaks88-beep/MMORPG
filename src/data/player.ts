import type { RaceId } from './races';
import type { RelicId } from './relics';
import type { MaterialId } from './materials';

export type EquipmentSlot = 'weapon' | 'armor' | 'trinket' | 'ring';

export type PlayerEquipment = {
  weapon?: string;
  armor?: string;
  trinket?: string;
  ring?: string;
};

export type InventoryItem = {
  instanceId: string;
  itemId: string;
  upgradeLevel: number;
};

export type CharacterTreeBranchId =
  | 'hp'
  | 'energy'
  | 'attack'
  | 'defense'
  | 'crit'
  | 'agility'
  | 'luck'
  | 'intelligence';

export type PlayerData = {
  name: string;

  raceId?: RaceId;

  level: number;
  exp: number;
  expToNextLevel: number;
  gold: number;

  hp: number;
  maxHp: number;

  energy: number;
  maxEnergy: number;

  sanity: number;
  maxSanity: number;
  sanityUpdatedAt: number;

  potions: number;

  attack: number;
  defense: number;
  critChance: number;

  agility: number;
  luck: number;

  strength: number;
  intelligence: number;

  // Старые очки прокачки. Оставлены для совместимости с уже существующими сценами.
  upgradePoints: number;
  totalUpgradePointsEarned: number;

  // Очки именно для дерева характеристик StatsTreeScene.
  characterTreePoints: number;
  characterTree: Partial<Record<CharacterTreeBranchId, number>>;

  relicIds: RelicId[];

  inventory: InventoryItem[];
  equipment: PlayerEquipment;

  materials: Partial<Record<MaterialId, number>>;

  anvilLevel: number;

  crystalsUnlocked: boolean;

  avatarId?: string;
  unlockedAvatarIds: string[];
};

export const player: PlayerData = {
  name: 'Безымянный',

  raceId: undefined,

  level: 1,
  exp: 0,
  expToNextLevel: 70,
  gold: 500,

  hp: 100,
  maxHp: 100,

  energy: 3,
  maxEnergy: 3,

  sanity: 500,
  maxSanity: 500,
  sanityUpdatedAt: Date.now(),

  potions: 6,

  attack: 12,
  defense: 3,
  critChance: 0.1,

  agility: 5,
  luck: 5,

  strength: 11,
  intelligence: 11,

  upgradePoints: 0,
  totalUpgradePointsEarned: 0,

  characterTreePoints: 0,
  characterTree: {},

  relicIds: [],

  inventory: [],
  equipment: {},

  materials: {},

  anvilLevel: 1,

  crystalsUnlocked: false,

  avatarId: undefined,
  unlockedAvatarIds: [],
};
