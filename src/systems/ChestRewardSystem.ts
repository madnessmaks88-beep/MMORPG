import Phaser from 'phaser';

import { player } from '../data/player';
import type { MaterialId } from '../data/materials';
import { getMaterialName } from '../data/materials';
import { gameState, type FloorModifier } from '../data/gameState';
import { addMaterial } from './MaterialSystem';
import { trackFloorMaterials } from './FloorMaterialLogSystem';
import { getPlayerStats, getRewardGoldAmount, getRewardMaterialAmount } from './InventorySystem';

export type ChestRewardResult = {
  gold: number;
  materials: {
    id: MaterialId;
    amount: number;
  }[];
  damage: number;
  text: string;
};


type TreePlayer = typeof player & {
  characterTree?: Partial<Record<string, number>>;
};

function getTreeLevel(branchId: string) {
  return Math.max(0, (player as TreePlayer).characterTree?.[branchId] ?? 0);
}

function hasTreeLevel(branchId: string, level: number) {
  return getTreeLevel(branchId) >= level;
}


function getLuckChestGoldMultiplier() {
  const stats = getPlayerStats(player);

  // Каждый 1% бонуса добычи от удачи даёт половину процента к золоту сундуков.
  // Фортуна-2 дополнительно даёт +10%.
  const luckGoldBonus = Math.min(0.15, stats.lootChanceBonus * 0.5);
  const treeGoldBonus = hasTreeLevel('luck', 2) ? 0.10 : 0;

  return 1 + luckGoldBonus + treeGoldBonus;
}

function getFloorInsideTier(floor: number) {
  return ((floor - 1) % 25) + 1;
}

function rollSmallMaterial(floor: number): MaterialId {
  const items: MaterialId[] = floor >= 26
    ? [
        'silt_bone',
        'rusted_armor_scale',
        'drowned_leather',
      ]
    : [
        'darkened_bone',
        'dim_gem',
        'old_leather',
      ];

  return Phaser.Utils.Array.GetRandom(items);
}

function rollMediumMaterial(floor: number): MaterialId {
  const items: MaterialId[] = floor >= 26
    ? [
        'bottled_black_water',
        'rusted_chain_link',
        'mold_gem',
        'black_slime_heart',
        'flooded_sarcophagus_shard',
      ]
    : [
        'dark_flame_heart',
        'black_gem',
        'cursed_seal',
      ];

  return Phaser.Utils.Array.GetRandom(items);
}

function getGoldReward(floor: number, modifier: FloorModifier) {
  const floorInsideTier = getFloorInsideTier(floor);

  let min = 12 + floorInsideTier * 2;
  let max = 22 + floorInsideTier * 4;

  if (modifier === 'treasure') {
    min = Math.floor(min * 1.7);
    max = Math.floor(max * 1.9);
  }

  if (modifier === 'cursed') {
    min = Math.floor(min * 1.45);
    max = Math.floor(max * 1.6);
  }

  return Phaser.Math.Between(min, max);
}

function getMediumMaterialChance(floor: number, modifier: FloorModifier) {
  const floorInsideTier = getFloorInsideTier(floor);

  let chance = 0.05;

  if (floorInsideTier >= 8) chance = 0.12;
  if (floorInsideTier >= 15) chance = 0.22;
  if (floorInsideTier >= 21) chance = 0.35;

  if (modifier === 'treasure') chance += 0.18;
  if (modifier === 'cursed') chance += 0.12;

  return Math.min(chance, 0.65);
}

function getSmallMaterialAmount(floor: number, modifier: FloorModifier) {
  const floorInsideTier = getFloorInsideTier(floor);

  let amount = 1;

  if (floorInsideTier >= 6) amount = 2;
  if (floorInsideTier >= 16) amount = 3;

  if (modifier === 'treasure') amount += 1;

  return amount;
}

export function claimChestReward(): ChestRewardResult {
  const floor = gameState.floorRun.currentFloor || 1;
  const modifier = gameState.floorRun.modifier;

  const baseGold = getGoldReward(floor, modifier);

  const goldMultiplier = getLuckChestGoldMultiplier();
  const luckyChestGold = goldMultiplier > 1;
  const gold = getRewardGoldAmount(player, Math.floor(baseGold * goldMultiplier));

  const smallAmount = getSmallMaterialAmount(floor, modifier);

  const materials: {
    id: MaterialId;
    amount: number;
  }[] = [];

  materials.push({
    id: rollSmallMaterial(floor),
    amount: smallAmount,
  });

  if (Math.random() < getMediumMaterialChance(floor, modifier)) {
    materials.push({
      id: rollMediumMaterial(floor),
      amount: modifier === 'treasure' ? 2 : 1,
    });
  }

  materials.forEach(material => {
    material.amount = getRewardMaterialAmount(player, material.id, material.amount);
  });

  let damage = 0;

  if (modifier === 'cursed' && Math.random() < 0.35) {
    const stats = getPlayerStats(player);
    damage = Math.max(4, Math.floor(stats.maxHp * 0.12));
    player.hp = Math.max(1, player.hp - damage);
  }

  player.gold += gold;

  materials.forEach(material => {
    addMaterial(material.id, material.amount);
  });

  trackFloorMaterials(materials);

  gameState.floorRun.chestsOpened += 1;
  gameState.floorRun.goldEarned += gold;

  const materialText = materials
    .map(material => `+${material.amount} ${getMaterialName(material.id)}`)
    .join('\n');

  const luckText = luckyChestGold
    ? `\nУдача: золото из сундука увеличено на ${Math.round((goldMultiplier - 1) * 100)}%.`
    : '';

  const damageText =
    damage > 0
      ? `\n\nПроклятие сундука нанесло ${damage} урона.`
      : '';

  return {
    gold,
    materials,
    damage,
    text:
      `Ты открыл сундук.\n\n` +
      `+${gold} золота\n` +
      `${materialText}` +
      luckText +
      damageText,
  };
}