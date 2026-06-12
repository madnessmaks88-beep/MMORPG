import type { EnemyData } from '../data/enemies';
import type { FloorRoom } from '../data/gameState';

function getFloorInsideTier(floor: number) {
  return ((floor - 1) % 25) + 1;
}

function getBaseFloorMultiplier(floor: number) {
  const floorInsideTier = getFloorInsideTier(floor);

  return 1 + (floorInsideTier - 1) * 0.075;
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

  const maxHp = Math.round(enemy.maxHp * floorMultiplier * roomMultiplier.hp);
  const attack = Math.round(enemy.attack * floorMultiplier * roomMultiplier.attack);
  const defense = Math.round(enemy.defense * floorMultiplier * roomMultiplier.defense);

  return {
    ...enemy,
    maxHp,
    hp: maxHp,
    attack,
    defense,
    expReward: Math.round(enemy.expReward * floorMultiplier * roomMultiplier.exp),
    goldReward: Math.round(enemy.goldReward * floorMultiplier * roomMultiplier.gold),
  };
}