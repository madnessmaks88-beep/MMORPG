import Phaser from 'phaser';

import type { EquipmentSlot, InventoryItem, PlayerData } from '../data/player';
import type { ItemData } from '../data/items';
import { getItemById } from '../data/items';

import { getRelicById } from '../data/relics';

export type PlayerStats = {
  maxHp: number;
  attack: number;
  defense: number;
  critChance: number;

  agility: number;
  luck: number;

  strength: number;
  intelligence: number;
  maxEnergy: number;

  dodgeChance: number;
  trapDodgeChance: number;
  lootChanceBonus: number;
};

export function createInventoryItem(itemId: string): InventoryItem {
  return {
    instanceId: `${itemId}_${Date.now()}_${Phaser.Math.Between(1000, 9999)}`,
    itemId,
    upgradeLevel: 0,
  };
}

export function addItemToInventory(player: PlayerData, itemId: string): InventoryItem {
  const inventoryItem = createInventoryItem(itemId);
  player.inventory.push(inventoryItem);
  return inventoryItem;
}

export function getInventoryItemByInstanceId(
  player: PlayerData,
  instanceId: string
): InventoryItem | undefined {
  return player.inventory.find(item => item.instanceId === instanceId);
}

export function getBaseItemFromInventoryItem(
  inventoryItem: InventoryItem
): ItemData | undefined {
  return getItemById(inventoryItem.itemId);
}

export function equipItem(player: PlayerData, instanceId: string): boolean {
  const inventoryItem = getInventoryItemByInstanceId(player, instanceId);

  if (!inventoryItem) {
    return false;
  }

  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item) {
    return false;
  }

  player.equipment[item.slot] = inventoryItem.instanceId;

  const stats = getPlayerStats(player);

  if (player.hp > stats.maxHp) {
    player.hp = stats.maxHp;
  }

  return true;
}

export function unequipItem(player: PlayerData, slot: ItemData['slot']) {
  delete player.equipment[slot];

  const stats = getPlayerStats(player);

  if (player.hp > stats.maxHp) {
    player.hp = stats.maxHp;
  }
}

export function getWeaponTypeText(weaponType?: string): string {
  if (weaponType === 'dagger') return 'Кинжал';
  if (weaponType === 'axe') return 'Топор';
  if (weaponType === 'katana') return 'Катана';
  if (weaponType === 'hammer') return 'Молот';
  if (weaponType === 'shield_sword') return 'Щит-меч';
  if (weaponType === 'sword') return 'Меч';

  return 'Оружие';
}

export function getWeaponTypeDescription(weaponType?: string): string {
  if (weaponType === 'dagger') {
    return 'Обычная атака наносит 3 быстрых удара. Каждый удар имеет 8% шанс восстановить 50% нанесённого этим ударом урона.';
  }

  if (weaponType === 'axe') {
    return 'Обычная атака наносит усиленный рубящий удар.';
  }

  if (weaponType === 'katana') {
    return 'Обычная атака имеет повышенный шанс критического удара.';
  }

  if (weaponType === 'hammer') {
    return 'Обычная атака наносит тяжёлый удар и сотрясает арену.';
  }

  if (weaponType === 'shield_sword') {
    return 'Обычная атака слабее, но считается осторожной.';
  }

  if (weaponType === 'sword') {
    return 'Обычная атака наносит стабильный урон. Если максимальное HP врага выше максимального HP героя в 1,5 / 2 / 3 раза, урон мечом увеличивается на 10% / 15% / 20%.';
  }

  return '';
}

export function isItemEquipped(player: PlayerData, instanceId: string): boolean {
  return (
    player.equipment.weapon === instanceId ||
    player.equipment.armor === instanceId ||
    player.equipment.trinket === instanceId
  );
}

export function getItemUpgradeLevel(inventoryItem: InventoryItem): number {
  return inventoryItem.upgradeLevel;
}

export function getUpgradeCost(inventoryItem: InventoryItem): number {
  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item) {
    return 999999;
  }

  const level = getItemUpgradeLevel(inventoryItem);

  let baseCost = 20;

  if (item.rarity === 'rare') {
    baseCost = 35;
  }

  if (item.rarity === 'epic') {
    baseCost = 55;
  }

  if (item.rarity === 'legendary') {
    baseCost = 90;
  }

  if (item.rarity === 'mythic') {
    baseCost = 140;
  }

  return baseCost + level * baseCost;
}


export function upgradeItem(
  player: PlayerData,
  instanceId: string
): {
  success: boolean;
  message: string;
} {
  const inventoryItem = getInventoryItemByInstanceId(player, instanceId);

  if (!inventoryItem) {
    return {
      success: false,
      message: 'Предмет не найден.',
    };
  }

  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item) {
    return {
      success: false,
      message: 'Базовый предмет не найден.',
    };
  }

  const currentLevel = inventoryItem.upgradeLevel;

  if (currentLevel >= 5) {
    return {
      success: false,
      message: 'Предмет уже улучшен до максимума.',
    };
  }

  const cost = getUpgradeCost(inventoryItem);

  if (player.gold < cost) {
    return {
      success: false,
      message: 'Недостаточно золота.',
    };
  }

  player.gold -= cost;
  inventoryItem.upgradeLevel += 1;

  return {
    success: true,
    message: `${item.name} улучшен до +${inventoryItem.upgradeLevel}.`,
  };
}

export function getEquippedInventoryItems(player: PlayerData): InventoryItem[] {
  const result: InventoryItem[] = [];

  if (player.equipment.weapon) {
    const item = getInventoryItemByInstanceId(player, player.equipment.weapon);
    if (item) result.push(item);
  }

  if (player.equipment.armor) {
    const item = getInventoryItemByInstanceId(player, player.equipment.armor);
    if (item) result.push(item);
  }

  if (player.equipment.trinket) {
    const item = getInventoryItemByInstanceId(player, player.equipment.trinket);
    if (item) result.push(item);
  }

  return result;
}

export function getEquippedWeapon(player: PlayerData): {
  inventoryItem: InventoryItem;
  item: ItemData;
} | undefined {
  const weaponInstanceId = player.equipment.weapon;

  if (!weaponInstanceId) {
    return undefined;
  }

  const inventoryItem = getInventoryItemByInstanceId(player, weaponInstanceId);

  if (!inventoryItem) {
    return undefined;
  }

  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item) {
    return undefined;
  }

  if (item.slot !== 'weapon') {
    return undefined;
  }

  return {
    inventoryItem,
    item,
  };
}

export function getItemBonusWithUpgrade(
  inventoryItem: InventoryItem
): {
  bonusHp: number;
  bonusAttack: number;
  bonusDefense: number;
  bonusCritChance: number;
  bonusEnergy: number;
  bonusAgility: number;
  bonusLuck: number;
  bonusStrength: number;
  bonusIntelligence: number;
} {
  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item) {
    return {
      bonusHp: 0,
      bonusAttack: 0,
      bonusDefense: 0,
      bonusCritChance: 0,
      bonusEnergy: 0,
      bonusAgility: 0,
      bonusLuck: 0,
      bonusStrength: 0,
      bonusIntelligence: 0,
    };
  }

  const level = inventoryItem.upgradeLevel;

  const bonusHp = (item.bonusHp ?? 0) + level * 4;
  const bonusAttack = (item.bonusAttack ?? 0) + level * 2;
  const bonusDefense = (item.bonusDefense ?? 0) + level * 1;
  const bonusCritChance = (item.bonusCritChance ?? 0) + level * 0.005;

  return {
    bonusHp,
    bonusAttack,
    bonusDefense,
    bonusCritChance,
    bonusEnergy: item.bonusEnergy ?? 0,
    bonusAgility: item.bonusAgility ?? 0,
    bonusLuck: item.bonusLuck ?? 0,
    bonusStrength: item.bonusStrength ?? 0,
    bonusIntelligence: item.bonusIntelligence ?? 0,
  };
}


type CharacterTreeBranchId =
  | 'hp'
  | 'energy'
  | 'attack'
  | 'defense'
  | 'crit'
  | 'agility'
  | 'luck'
  | 'intelligence';

type PlayerWithCharacterTree = PlayerData & {
  characterTree?: Partial<Record<CharacterTreeBranchId, number>>;
};

type CharacterTreeDerivedBonuses = {
  trapDodgeChance: number;
  lootChanceBonus: number;
};

function getCharacterTreeLevel(player: PlayerData, branchId: CharacterTreeBranchId) {
  const treePlayer = player as PlayerWithCharacterTree;

  return Math.max(0, treePlayer.characterTree?.[branchId] ?? 0);
}

function isMilestoneLevel(level: number) {
  return level === 5 || level === 10 || level === 15 || level === 20;
}

function countNormalLevels(level: number, maxLevel: number) {
  let result = 0;
  const safeLevel = Math.min(Math.max(0, level), maxLevel);

  for (let index = 1; index <= safeLevel; index += 1) {
    if (!isMilestoneLevel(index)) {
      result += 1;
    }
  }

  return result;
}

function applyCharacterTreeStatBonuses(player: PlayerData, stats: PlayerStats) {
  const hpLevel = getCharacterTreeLevel(player, 'hp');
  const attackLevel = getCharacterTreeLevel(player, 'attack');
  const defenseLevel = getCharacterTreeLevel(player, 'defense');
  const energyLevel = getCharacterTreeLevel(player, 'energy');
  const critLevel = getCharacterTreeLevel(player, 'crit');
  const agilityLevel = getCharacterTreeLevel(player, 'agility');
  const luckLevel = getCharacterTreeLevel(player, 'luck');

  // Живучесть: обычные уровни дают +10 HP, 5-й особый узел даёт +30 HP.
  stats.maxHp += countNormalLevels(hpLevel, 20) * 10;

  if (hpLevel >= 5) {
    stats.maxHp += 30;
  }

  // Выносливость: 1, 3 и 5 уровни дают +1 к максимальной энергии.
  if (energyLevel >= 1) stats.maxEnergy += 1;
  if (energyLevel >= 3) stats.maxEnergy += 1;
  if (energyLevel >= 5) stats.maxEnergy += 1;

  // Урон: обычные уровни дают +3 атаки. Особые уровни дают боевые эффекты отдельно.
  stats.attack += countNormalLevels(attackLevel, 20) * 3;

  // Броня: обычные уровни дают +1 защиты. Особые уровни дают боевые эффекты отдельно.
  stats.defense += countNormalLevels(defenseLevel, 20);

  // Крит: 1, 3 и 5 уровни дают +1% к шансу критического удара.
  if (critLevel >= 1) stats.critChance += 0.01;
  if (critLevel >= 3) stats.critChance += 0.01;
  if (critLevel >= 5) stats.critChance += 0.01;

  // Реакция: 1, 3 и 5 уровни дают +1 ловкости.
  if (agilityLevel >= 1) stats.agility += 1;
  if (agilityLevel >= 3) stats.agility += 1;
  if (agilityLevel >= 5) stats.agility += 1;

  // Фортуна: 1, 3 и 5 уровни дают +1 удачи.
  if (luckLevel >= 1) stats.luck += 1;
  if (luckLevel >= 3) stats.luck += 1;
  if (luckLevel >= 5) stats.luck += 1;
}

function getCharacterTreeDerivedBonuses(player: PlayerData): CharacterTreeDerivedBonuses {
  const agilityLevel = getCharacterTreeLevel(player, 'agility');
  const luckLevel = getCharacterTreeLevel(player, 'luck');

  return {
    // Чутьё ловушек: +10% к уклонению от ловушек.
    trapDodgeChance: agilityLevel >= 2 ? 0.10 : 0,

    // Редкая добыча: +5% к шансу ценной добычи.
    lootChanceBonus: luckLevel >= 6 ? 0.05 : 0,
  };
}

export function getPlayerStats(player: PlayerData): PlayerStats {
  const stats: PlayerStats = {
    maxHp: player.maxHp,
    maxEnergy: player.maxEnergy,

    attack: player.attack,
    defense: player.defense,
    critChance: player.critChance,

    agility: player.agility,
    luck: player.luck,
    strength: player.strength,
    intelligence: player.intelligence,

    dodgeChance: 0,
    trapDodgeChance: 0,
    lootChanceBonus: 0,
  };

  applyCharacterTreeStatBonuses(player, stats);

  const equippedItems = getEquippedInventoryItems(player);

  for (const inventoryItem of equippedItems) {
    const bonus = getItemBonusWithUpgrade(inventoryItem);

    stats.maxHp += bonus.bonusHp;
    stats.maxEnergy += bonus.bonusEnergy;

    stats.attack += bonus.bonusAttack;
    stats.defense += bonus.bonusDefense;
    stats.critChance += bonus.bonusCritChance;

    stats.agility += bonus.bonusAgility;
    stats.luck += bonus.bonusLuck;
    stats.strength += bonus.bonusStrength;
    stats.intelligence += bonus.bonusIntelligence;
  }

  for (const relicId of player.relicIds) {
    const relic = getRelicById(relicId);

    if (!relic) {
      continue;
    }

    stats.maxHp += relic.bonusHp ?? 0;
    stats.maxEnergy += relic.bonusEnergy ?? 0;

    stats.attack += relic.bonusAttack ?? 0;
    stats.defense += relic.bonusDefense ?? 0;

    stats.agility += relic.bonusAgility ?? 0;
    stats.luck += relic.bonusLuck ?? 0;
    stats.strength += relic.bonusStrength ?? 0;
    stats.intelligence += relic.bonusIntelligence ?? 0;
  }

  const treeDerivedBonuses = getCharacterTreeDerivedBonuses(player);

  stats.critChance = Math.min(0.75, stats.critChance);

  stats.dodgeChance = Math.min(0.22, stats.agility * 0.01);
  stats.trapDodgeChance = Math.min(
    0.45,
    stats.agility * 0.012 + treeDerivedBonuses.trapDodgeChance
  );
  stats.lootChanceBonus = Math.min(
    0.30,
    stats.luck * 0.01 + treeDerivedBonuses.lootChanceBonus
  );

  return stats;
}

export function getRarityText(item: ItemData): string {
  if (item.rarity === 'common') return 'Обычный';
  if (item.rarity === 'rare') return 'Редкий';
  if (item.rarity === 'epic') return 'Эпический';
  if (item.rarity === 'legendary') return 'Легендарный';
  if (item.rarity === 'mythic') return 'Мифический';

  return 'Предмет';
}

export function getSlotText(slot: EquipmentSlot): string {
  if (slot === 'weapon') return 'Оружие';
  if (slot === 'armor') return 'Броня';
  return 'Талисман';
}

export function createItemStatsText(inventoryItem: InventoryItem): string {
  const parts: string[] = [];
  const bonuses = getItemBonusWithUpgrade(inventoryItem);

  if (bonuses.bonusHp) {
    parts.push(`HP ${bonuses.bonusHp > 0 ? '+' : ''}${bonuses.bonusHp}`);
  }

  if (bonuses.bonusEnergy) {
    parts.push(`Энергия ${bonuses.bonusEnergy > 0 ? '+' : ''}${bonuses.bonusEnergy}`);
  }

  if (bonuses.bonusAttack) {
    parts.push(`Атака ${bonuses.bonusAttack > 0 ? '+' : ''}${bonuses.bonusAttack}`);
  }

  if (bonuses.bonusDefense) {
    parts.push(`Защита ${bonuses.bonusDefense > 0 ? '+' : ''}${bonuses.bonusDefense}`);
  }

  if (bonuses.bonusCritChance) {
    parts.push(`Крит ${bonuses.bonusCritChance > 0 ? '+' : ''}${Math.round(bonuses.bonusCritChance * 100)}%`);
  }

  if (bonuses.bonusAgility) {
    parts.push(`Ловкость ${bonuses.bonusAgility > 0 ? '+' : ''}${bonuses.bonusAgility}`);
  }

  if (bonuses.bonusLuck) {
    parts.push(`Удача ${bonuses.bonusLuck > 0 ? '+' : ''}${bonuses.bonusLuck}`);
  }

  if (bonuses.bonusStrength) {
    parts.push(`Сила ${bonuses.bonusStrength > 0 ? '+' : ''}${bonuses.bonusStrength}`);
  }

  if (bonuses.bonusIntelligence) {
    parts.push(`Интеллект ${bonuses.bonusIntelligence > 0 ? '+' : ''}${bonuses.bonusIntelligence}`);
  }

  return parts.join(', ');
}




export function getItemSellPrice(item: ItemData, upgradeLevel = 0): number {
  let basePrice = 8;

  if (item.rarity === 'rare') {
    basePrice = 20;
  }

  if (item.rarity === 'epic') {
    basePrice = 45;
  }

  if (item.rarity === 'legendary') {
    basePrice = 95;
  }

  if (item.rarity === 'mythic') {
    basePrice = 160;
  }

  return basePrice + upgradeLevel * Math.floor(basePrice * 0.7);
}

export function sellItem(
  player: PlayerData,
  instanceId: string
): {
  success: boolean;
  message: string;
} {
  const inventoryItem = getInventoryItemByInstanceId(player, instanceId);

  if (!inventoryItem) {
    return {
      success: false,
      message: 'Предмет не найден.',
    };
  }

  if (isItemEquipped(player, instanceId)) {
    return {
      success: false,
      message: 'Нельзя продать надетый предмет.',
    };
  }

  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item) {
    return {
      success: false,
      message: 'Базовый предмет не найден.',
    };
  }

  const price = getItemSellPrice(item, inventoryItem.upgradeLevel);

  player.inventory = player.inventory.filter(item => item.instanceId !== instanceId);
  player.gold += price;

  return {
    success: true,
    message: `${item.name} +${inventoryItem.upgradeLevel} продан за ${price} золота.`,
  };
}
export function getRarityColor(item: ItemData): string {
  if (item.rarity === 'common') return '#b8aa91';
  if (item.rarity === 'rare') return '#70a6ff';
  if (item.rarity === 'epic') return '#c084fc';
  

  return '#b8aa91';
}

export function getRarityColorHex(item: ItemData): number {
  if (item.rarity === 'common') return 0xb8aa91;
  if (item.rarity === 'rare') return 0x70a6ff;
  if (item.rarity === 'epic') return 0xc084fc;
  if (item.rarity === 'legendary') return 0xf0a040;
  if (item.rarity === 'mythic') return 0xb45cff;

  return 0xb8aa91;
}

export function getRarityStrokeColor(item: ItemData): number {
  if (item.rarity === 'common') return 0x6f6658;
  if (item.rarity === 'rare') return 0x3f6fa8;
  if (item.rarity === 'epic') return 0x7c3fb0;
  if (item.rarity === 'legendary') return 0xb77920;
  if (item.rarity === 'mythic') return 0x7e3fba;

  return 0x6f6658;
}

export function getRarityNameWithColor(item: ItemData): string {
  return getRarityText(item);
}

export function getSlotIcon(slot: EquipmentSlot): string {
  if (slot === 'weapon') return '⚔';
  if (slot === 'armor') return '🛡';
  return '◆';
}

export function rollItemDrop(player: PlayerData, baseChance: number): boolean {
  const stats = getPlayerStats(player);

  const finalChance = Math.min(0.95, baseChance + stats.lootChanceBonus);

  return Math.random() < finalChance;
}
