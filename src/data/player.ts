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

  inventory: InventoryItem[];
  equipment: PlayerEquipment;
};

export const player: PlayerData = {
  name: 'Безымянный',
  level: 1,
  exp: 0,
  expToNextLevel: 50,
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

  inventory: [],
  equipment: {},
};