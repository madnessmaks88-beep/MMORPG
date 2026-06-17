import Phaser from 'phaser';

import { player } from '../data/player';
import type { EnemyData } from '../data/enemies';
import type { MaterialId } from '../data/materials';
import { getMaterialName } from '../data/materials';
import { getCurrentRoom } from './FloorSystem';
import { addItemToInventory, getPlayerStats, getRewardMaterialAmount } from './InventorySystem';
import { addMaterialsPack } from './MaterialSystem';
import { getItemById, items, type ItemRarity } from '../data/items';
import { trackFloorMaterials } from './FloorMaterialLogSystem';
import { trackItemObtainedByRarity, trackMaterialsCollected } from './QuestSystem';
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

const tier2SmallMaterials: MaterialId[] = [
  'silt_bone',
  'rusted_armor_scale',
  'drowned_leather',
];

const tier2MediumMaterials: MaterialId[] = [
  'bottled_black_water',
  'rusted_chain_link',
  'mold_gem',
  'black_slime_heart',
  'flooded_sarcophagus_shard',
];

const tier2RareMaterials: MaterialId[] = [
  'abyssal_bottom_seal',
];


type TreePlayer = typeof player & {
  characterTree?: Partial<Record<string, number>>;
};

function getTreeLevel(branchId: string) {
  return Math.max(0, (player as TreePlayer).characterTree?.[branchId] ?? 0);
}

function hasTreeLevel(branchId: string, level: number) {
  return getTreeLevel(branchId) >= level;
}

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

function addRunItemsEarned(amount: number) {
  if (amount <= 0 || !gameState.floorRun.active) {
    return;
  }

  const run = gameState.floorRun as typeof gameState.floorRun & {
    itemsEarned?: number;
  };

  run.itemsEarned = (run.itemsEarned ?? 0) + amount;
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

function isArkwell(enemy: EnemyData) {
  return (
    enemy.id === 'arkwell_drowned_keeper' ||
    enemy.name.includes('Арквелл')
  );
}

function isTier2Floor() {
  return getCurrentFloor() >= 26;
}


function getLuckLootBonus() {
  return getPlayerStats(player).lootChanceBonus;
}

function getLuckRarityRoll() {
  // Удача должна повышать качество предмета, но не должна превращать каждый дроп в легендарный.
  // Поэтому для редкости используем только часть общего бонуса удачи.
  const rarityBonus = Math.min(0.08, getLuckLootBonus() * 0.5);

  return Math.max(0, Math.random() - rarityBonus);
}

function getItemDropChance(enemy: EnemyData) {
  const floor = getCurrentFloor();
  const boss = isBossLootRoom();

  if (isArkwell(enemy)) {
    return 0.35; // финальный босс второго яруса
  }

  if (isMorvein(enemy)) {
    return 0.2; // 20% шанс предмета с Морвеина
  }

  if (boss) {
    return floor >= 26 ? 0.22 : 0.18;
  }

  if (floor >= 46) {
    return 0.18;
  }

  if (floor >= 36) {
    return 0.16;
  }

  if (floor >= 26) {
    return 0.14;
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
  const roll = getLuckRarityRoll();

  if (isArkwell(enemy)) {
    if (roll < 0.08) return 'mythic';
    if (roll < 0.28) return 'legendary';
    return 'epic';
  }

  if (isMorvein(enemy)) {
    if (roll < 0.005) return 'mythic';      // 0.5% от выпавшего предмета
    if (roll < 0.05) return 'legendary';    // 4.5%
    return 'epic';                          // 95%
  }

  if (floor >= 46) {
    if (boss && roll < 0.18) return 'legendary';
    if (!boss && roll < 0.05) return 'legendary';

    if (boss && roll < 0.62) return 'epic';
    if (!boss && roll < 0.30) return 'epic';

    if (boss && roll < 0.90) return 'rare';
    if (!boss && roll < 0.62) return 'rare';

    return 'common';
  }

  if (floor >= 36) {
    if (boss && roll < 0.10) return 'legendary';
    if (!boss && roll < 0.03) return 'legendary';

    if (boss && roll < 0.50) return 'epic';
    if (!boss && roll < 0.22) return 'epic';

    if (boss && roll < 0.85) return 'rare';
    if (!boss && roll < 0.58) return 'rare';

    return 'common';
  }

  if (floor >= 26) {
    if (boss && roll < 0.06) return 'legendary';
    if (boss && roll < 0.38) return 'epic';
    if (!boss && roll < 0.16) return 'epic';

    if (boss && roll < 0.80) return 'rare';
    if (!boss && roll < 0.48) return 'rare';

    return 'common';
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
  const floor = getCurrentFloor();

  if (rarity === 'mythic') {
    if (isArkwell(enemy)) {
      return items.filter(item => item.id === 'arkwell_black_sluice_heart');
    }

    if (isMorvein(enemy)) {
      return items.filter(item => item.id === 'morvein_last_oath');
    }

    return [];
  }

  return items.filter(item => {
    if (item.rarity !== rarity) {
      return false;
    }

    if (item.bossOnly) {
      return false;
    }

    if (item.id === 'morvein_last_oath' || item.id === 'arkwell_black_sluice_heart') {
      return false;
    }

    const minFloor = item.minFloor ?? 1;
    const maxFloor = item.maxFloor ?? Number.MAX_SAFE_INTEGER;

    return floor >= minFloor && floor <= maxFloor;
  });
}

function rollMaterials(enemy: EnemyData): LootResult['materials'] {
  const room = getCurrentRoom();
  const type = room?.type ?? 'monster';

  const materials: LootResult['materials'] = [];

  const tier2 = isTier2Floor();
  const smallPool = tier2 ? tier2SmallMaterials : smallMaterials;
  const mediumPool = tier2 ? tier2MediumMaterials : mediumMaterials;

  if (type === 'monster') {
    if (rollChance(0.7)) addRandomMaterial(materials, smallPool, 1, 1);
    if (rollChance(0.2)) addRandomMaterial(materials, smallPool, 1, 2);
    if (rollChance(tier2 ? 0.08 : 0.05)) addRandomMaterial(materials, mediumPool, 1, 1);
  }

  if (type === 'elite') {
    if (rollChance(0.45)) addRandomMaterial(materials, smallPool, 1, 2);
    if (rollChance(0.35)) addRandomMaterial(materials, mediumPool, 1, 1);
    if (rollChance(0.08)) addRandomMaterial(materials, mediumPool, 1, 2);

    if (tier2 && rollChance(0.06)) {
      addRandomMaterial(materials, tier2RareMaterials, 1, 1);
    }
  }

  if (type === 'boss') {
    addRandomMaterial(materials, smallPool, 2, 4);
    if (rollChance(0.55)) addRandomMaterial(materials, mediumPool, 1, 2);

    if (tier2 && rollChance(0.22)) {
      addRandomMaterial(materials, tier2RareMaterials, 1, 1);
    }
  }

  // Удача помогает находить дополнительные материалы.
  // Фортуна-4 даёт базовые 8%, а общий показатель удачи добавляет ещё часть шанса.
  const extraMaterialChance = Math.min(
    0.22,
    (hasTreeLevel('luck', 4) ? 0.08 : 0) + getLuckLootBonus() * 0.35
  );

  if (extraMaterialChance > 0 && rollChance(extraMaterialChance)) {
    addRandomMaterial(materials, tier2 ? mediumPool : smallPool, 1, 1);
  }

  if (type === 'tier_boss' || isMorvein(enemy) || isArkwell(enemy)) {
    if (isArkwell(enemy)) {
      materials.push({
        id: 'drowned_guardian_eye',
        amount: 1,
      });

      materials.push({
        id: 'abyssal_bottom_seal',
        amount: Phaser.Math.Between(1, 2),
      });

      addRandomMaterial(materials, tier2MediumMaterials, 3, 5);
    } else {
      materials.push({
        id: 'black_sarcophagus_shard',
        amount: 1,
      });

      addRandomMaterial(materials, mediumMaterials, 3, 5);
    }
  }

  if (materials.length === 0) {
    addRandomMaterial(materials, smallPool, 1, 1);
  }

  return materials;
}

function rollWeapon(enemy: EnemyData) {
  const itemIds: string[] = [];

  const luckBonus = getLuckLootBonus();
  const finalItemDropChance = Math.min(
    0.95,
    getItemDropChance(enemy) + luckBonus
  );

  // Удача работает здесь как шанс получить предмет вообще.
  if (!rollChance(finalItemDropChance)) {
    return itemIds;
  }

  // А внутри rollItemRarity() удача дополнительно повышает качество предмета.
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
  const materials = rollMaterials(enemy).map(material => ({
    ...material,
    amount: getRewardMaterialAmount(player, material.id, material.amount),
  }));
  const itemIds = rollWeapon(enemy);

  addMaterialsPack(materials);
  trackFloorMaterials(materials);
  trackMaterialsCollected(materials.reduce((sum, material) => sum + material.amount, 0));

  itemIds.forEach(itemId => {
    addItemToInventory(player, itemId);

    const item = getItemById(itemId);
    trackItemObtainedByRarity(item?.rarity);
  });

  addRunItemsEarned(itemIds.length);

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