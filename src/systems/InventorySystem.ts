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
    return 'Обычная атака наносит 3 быстрых удара.';
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
    return 'Обычная атака наносит стабильный урон.';
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

  if (item.rarity === 'cursed') {
    baseCost = 75;
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
} {
  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item) {
    return {
      bonusHp: 0,
      bonusAttack: 0,
      bonusDefense: 0,
      bonusCritChance: 0,
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

  const equippedItems = getEquippedInventoryItems(player);

  for (const inventoryItem of equippedItems) {
    const bonus = getItemBonusWithUpgrade(inventoryItem);

    stats.maxHp += bonus.bonusHp;
    stats.attack += bonus.bonusAttack;
    stats.defense += bonus.bonusDefense;
    stats.critChance += bonus.bonusCritChance;
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

  stats.critChance = Math.min(0.75, stats.critChance);

  stats.dodgeChance = Math.min(0.22, stats.agility * 0.01);
  stats.trapDodgeChance = Math.min(0.30, stats.agility * 0.012);
  stats.lootChanceBonus = Math.min(0.20, stats.luck * 0.01);

  return stats;
}

export function getRarityText(item: ItemData): string {
  if (item.rarity === 'common') return 'Обычный';
  if (item.rarity === 'rare') return 'Редкий';
  if (item.rarity === 'epic') return 'Эпический';
  return 'Проклятый';
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

  if (bonuses.bonusAttack) {
    parts.push(`Атака ${bonuses.bonusAttack > 0 ? '+' : ''}${bonuses.bonusAttack}`);
  }

  if (bonuses.bonusDefense) {
    parts.push(`Защита ${bonuses.bonusDefense > 0 ? '+' : ''}${bonuses.bonusDefense}`);
  }

  if (bonuses.bonusCritChance) {
    parts.push(`Крит ${bonuses.bonusCritChance > 0 ? '+' : ''}${Math.round(bonuses.bonusCritChance * 100)}%`);
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

  if (item.rarity === 'cursed') {
    basePrice = 80;
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
  

  return 0xb8aa91;
}

export function getRarityStrokeColor(item: ItemData): number {
  if (item.rarity === 'common') return 0x6f6658;
  if (item.rarity === 'rare') return 0x3f6fa8;
  if (item.rarity === 'epic') return 0x7c3fb0;

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
