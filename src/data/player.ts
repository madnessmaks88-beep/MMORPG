import type { RaceId } from './races';
import type { RelicId } from './relics';

export type EquipmentSlot = 'weapon' | 'armor' | 'trinket';

export type PlayerEquipment = {
  weapon?: string;
  armor?: string;
  trinket?: string;
};

export type InventoryItem = {
  instanceId: string;
  itemId: string;
  upgradeLevel: number;
};

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

  potions: number;

  attack: number;
  defense: number;
  critChance: number;

  agility: number;
  luck: number;

  strength: number;
  intelligence: number;

  relicIds: RelicId[];

  inventory: InventoryItem[];
  equipment: PlayerEquipment;
};

export const player: PlayerData = {
  name: 'Безымянный',

  raceId: undefined,

  level: 1,
  exp: 0,
  expToNextLevel: 70,
  gold: 0,

  hp: 100,
  maxHp: 100,

  energy: 3,
  maxEnergy: 3,

  potions: 2,

  attack: 12,
  defense: 3,
  critChance: 0.1,

  agility: 5,
  luck: 5,

  strength: 11,
  intelligence: 11,

  relicIds: [],

  inventory: [],
  equipment: {},
};