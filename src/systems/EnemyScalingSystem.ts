import type { EnemyData } from '../data/enemies';
import type { FloorRoom } from '../data/gameState';

function getFloorInsideTier(floor: number) {
  return ((floor - 1) % 25) + 1;
}

function getBaseFloorMultiplier(floor: number) {
  const floorInsideTier = getFloorInsideTier(floor);

  return 1 + (floorInsideTier - 1) * 0.075;
}

function getTenFloorHpExpMultiplier(floor: number) {
  // С 10 этажа и после каждого этажа, кратного 10:
  // 1-9: x1
  // 10-19: x1.5
  // 20-29: x2.25
  // 30-39: x3.375
  // и так далее.
  const milestoneCount = Math.max(0, Math.floor(floor / 10));

  return 1.5 ** milestoneCount;
}

function getRoomTypeMultiplier(roomType?: FloorRoom['type']) {
  if (roomType === 'elite') {
    return {
      hp: 1.28,
      attack: 1.18,
      defense: 1.16,
      exp: 1.35,
      gold: 1.3,
    };
  }

  if (roomType === 'boss') {
    return {
      hp: 1.55,
      attack: 1.32,
      defense: 1.25,
      exp: 1.8,
      gold: 1.75,
    };
  }

  if (roomType === 'tier_boss') {
    return {
      hp: 1.85,
      attack: 1.45,
      defense: 1.35,
      exp: 2.4,
      gold: 2.3,
    };
  }

  return {
    hp: 1,
    attack: 1,
    defense: 1,
    exp: 1,
    gold: 1,
  };
}

export function createScaledEnemy(
  enemy: EnemyData,
  floor: number,
  roomType?: FloorRoom['type']
): EnemyData {
  const floorMultiplier = getBaseFloorMultiplier(floor);
  const roomMultiplier = getRoomTypeMultiplier(roomType);
  const tenFloorHpExpMultiplier = getTenFloorHpExpMultiplier(floor);

  const maxHp = Math.round(
    enemy.maxHp *
      floorMultiplier *
      roomMultiplier.hp *
      tenFloorHpExpMultiplier
  );
  const attack = Math.round(enemy.attack * floorMultiplier * roomMultiplier.attack);
  const defense = Math.round(enemy.defense * floorMultiplier * roomMultiplier.defense);

  return {
    ...enemy,
    maxHp,
    hp: maxHp,
    attack,
    defense,
    expReward: Math.round(
      enemy.expReward *
        floorMultiplier *
        roomMultiplier.exp *
        tenFloorHpExpMultiplier
    ),
    goldReward: Math.round(enemy.goldReward * floorMultiplier * roomMultiplier.gold),
  };
}