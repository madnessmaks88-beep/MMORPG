import Phaser from 'phaser';

import { player } from '../data/player';
import type { EnemyData } from '../data/enemies';
import type { MaterialId } from '../data/materials';
import { getMaterialName } from '../data/materials';
import { getCurrentRoom } from './FloorSystem';
import { addItemToInventory } from './InventorySystem';
import { addMaterialsPack } from './MaterialSystem';
import { getItemById, items, type ItemRarity } from '../data/items';
import { trackFloorMaterials } from './FloorMaterialLogSystem';
import { gameState } from '../data/gameState';

export type LootResult = {
  materials: {
    id: MaterialId;
    amount: number;
  }[];
  itemIds: string[];
  text: string;
};

const smallMaterials: MaterialId[] = [
  'darkened_bone',
  'dim_gem',
  'old_leather',
];

const mediumMaterials: MaterialId[] = [
  'dark_flame_heart',
  'black_gem',
  'cursed_seal',
];

function randomFrom<T>(items: T[]) {
  return items[Phaser.Math.Between(0, items.length - 1)];
}

function rollChance(chance: number) {
  return Math.random() < chance;
}

function addRandomMaterial(
  materials: LootResult['materials'],
  pool: MaterialId[],
  min: number,
  max: number
) {
  materials.push({
    id: randomFrom(pool),
    amount: Phaser.Math.Between(min, max),
  });
}

function getCurrentFloor() {
  return gameState.floorRun.currentFloor || 1;
}

function isBossLootRoom() {
  const room = getCurrentRoom();

  return room?.type === 'boss' || room?.type === 'tier_boss';
}

function isMorvein(enemy: EnemyData) {
  return (
    enemy.id === 'morvein_sealed_crypt_lord' ||
    enemy.name.includes('Морвеин')
  );
}

function getItemDropChance(enemy: EnemyData) {
  const floor = getCurrentFloor();
  const boss = isBossLootRoom();

  if (isMorvein(enemy)) {
    return 0.2; // 20% шанс предмета с Морвеина
  }

  if (boss) {
    return 0.18;
  }

  if (floor >= 20) {
    return 0.13;
  }

  if (floor >= 10) {
    return 0.09;
  }

  return 0.07;
}

function rollItemRarity(enemy: EnemyData): ItemRarity {
  const floor = getCurrentFloor();
  const boss = isBossLootRoom();
  const roll = Math.random();

  if (isMorvein(enemy)) {
    if (roll < 0.005) return 'mythic';      // 0.5% от выпавшего предмета
    if (roll < 0.05) return 'legendary';    // 4.5%
    return 'epic';                          // 95%
  }

  if (floor >= 20) {
    if (boss && roll < 0.08) return 'epic';
    if (!boss && roll < 0.04) return 'epic';

    if (boss && roll < 0.40) return 'rare';
    if (!boss && roll < 0.28) return 'rare';

    return 'common';
  }

  if (floor >= 10) {
    if (boss && roll < 0.02) return 'epic';
    if (boss && roll < 0.22) return 'rare';
    if (!boss && roll < 0.12) return 'rare';

    return 'common';
  }

  return 'common';
}

function getItemsByRarity(rarity: ItemRarity, enemy: EnemyData) {
  if (rarity === 'mythic') {
    if (isMorvein(enemy)) {
      return items.filter(item => item.id === 'morvein_last_oath');
    }

    return [];
  }

  return items.filter(item => {
    if (item.rarity !== rarity) {
      return false;
    }

    // Мифик Морвеина не должен попадать в общий пул
    if (item.id === 'morvein_last_oath') {
      return false;
    }

    return true;
  });
}

function rollMaterials(enemy: EnemyData): LootResult['materials'] {
  const room = getCurrentRoom();
  const type = room?.type ?? 'monster';

  const materials: LootResult['materials'] = [];

  if (type === 'monster') {
    if (rollChance(0.7)) addRandomMaterial(materials, smallMaterials, 1, 1);
    if (rollChance(0.2)) addRandomMaterial(materials, smallMaterials, 1, 2);
    if (rollChance(0.05)) addRandomMaterial(materials, mediumMaterials, 1, 1);
  }

  if (type === 'elite') {
    if (rollChance(0.45)) addRandomMaterial(materials, smallMaterials, 1, 2);
    if (rollChance(0.35)) addRandomMaterial(materials, mediumMaterials, 1, 1);
    if (rollChance(0.08)) addRandomMaterial(materials, mediumMaterials, 1, 2);
  }

  if (type === 'boss') {
    addRandomMaterial(materials, smallMaterials, 2, 4);
    if (rollChance(0.45)) addRandomMaterial(materials, mediumMaterials, 1, 2);
  }

  if (type === 'tier_boss' || isMorvein(enemy)) {
    materials.push({
      id: 'black_sarcophagus_shard',
      amount: 1,
    });
  
    addRandomMaterial(materials, mediumMaterials, 3, 5);
  }

  if (materials.length === 0) {
    addRandomMaterial(materials, smallMaterials, 1, 1);
  }

  return materials;
}

function rollWeapon(enemy: EnemyData) {
  const itemIds: string[] = [];

  if (!rollChance(getItemDropChance(enemy))) {
    return itemIds;
  }

  const rarity = rollItemRarity(enemy);
  const possibleItems = getItemsByRarity(rarity, enemy);

  if (possibleItems.length === 0) {
    return itemIds;
  }

  const item = randomFrom(possibleItems);

  itemIds.push(item.id);

  return itemIds;
}

export function rollEnemyLoot(enemy: EnemyData): LootResult {
  const materials = rollMaterials(enemy);
  const itemIds = rollWeapon(enemy);

  addMaterialsPack(materials);
  trackFloorMaterials(materials);

  itemIds.forEach(itemId => {
    addItemToInventory(player, itemId);
  });

  const materialText = materials
    .map(material => `+${material.amount} ${getMaterialName(material.id)}`)
    .join('\n');

  const itemText = itemIds
    .map(itemId => {
      const item = getItemById(itemId);
      return item ? `Предмет: ${item.name}` : `Предмет: ${itemId}`;
    })
    .join('\n');

  const text = [materialText, itemText]
    .filter(Boolean)
    .join('\n');

  return {
    materials,
    itemIds,
    text,
  };
}