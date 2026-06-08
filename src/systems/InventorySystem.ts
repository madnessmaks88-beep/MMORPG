import Phaser from 'phaser';

import type { InventoryItem, PlayerData } from '../data/player';
import type { ItemData } from '../data/items';
import { getItemById } from '../data/items';

export type PlayerStats = {
  maxHp: number;
  attack: number;
  defense: number;
  critChance: number;

  agility: number;
  luck: number;

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
    attack: player.attack,
    defense: player.defense,
    critChance: player.critChance,

    agility: player.agility,
    luck: player.luck,

    dodgeChance: Math.min(0.35, player.agility * 0.015),
    trapDodgeChance: Math.min(0.45, player.agility * 0.02),
    lootChanceBonus: Math.min(0.35, player.luck * 0.015),
  };

  // дальше твой код с экипировкой

  return stats;
}

export function getRarityText(item: ItemData): string {
  if (item.rarity === 'common') return 'Обычный';
  if (item.rarity === 'rare') return 'Редкий';
  if (item.rarity === 'epic') return 'Эпический';
  return 'Проклятый';
}

export function getSlotText(item: ItemData): string {
  if (item.slot === 'weapon') return 'Оружие';
  if (item.slot === 'armor') return 'Броня';
  return 'Амулет';
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
  if (item.rarity === 'epic') return '#b46cff';
  return '#ff4d4d';
}

export function getRarityStrokeColor(item: ItemData): number {
  if (item.rarity === 'common') return 0x8f826d;
  if (item.rarity === 'rare') return 0x70a6ff;
  if (item.rarity === 'epic') return 0xb46cff;
  return 0xff4d4d;
}

export function getRarityNameWithColor(item: ItemData): string {
  return getRarityText(item);
}

export function getSlotIcon(item: ItemData): string {
  if (item.slot === 'weapon') return '⚔';
  if (item.slot === 'armor') return '🛡';
  return '◆';
}

export function rollItemDrop(player: PlayerData, baseChance: number): boolean {
  const stats = getPlayerStats(player);

  const finalChance = Math.min(0.95, baseChance + stats.lootChanceBonus);

  return Math.random() < finalChance;
}