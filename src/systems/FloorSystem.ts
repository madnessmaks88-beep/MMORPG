import Phaser from 'phaser';

import {
  gameState,
  getCurrentTierByFloor,
  getTierEndFloor,
  isTierBossFloor,
  getTierStartFloor,
  type FloorModifier,
  type FloorRoom,
} from '../data/gameState';

export type FloorRequirement = {
  level: number;
  attack: number;
  defense: number;
  hp: number;
};

const normalEnemies = [
  'rotting_skeleton',
  'mad_cultist',
  'plague_rat',
  'miner_ghoul',
];

const eliteEnemies = [
  'bone_warden',
  'mold_butcher',
  'nameless_knight',
  'grave_mage',
];

const floorBossesTier1 = [
  'bone_warden',
  'mold_butcher',
  'crypt_executioner',
  'nameless_knight',
  'grave_mage',
];

const floorBossesTier2 = [
  'ash_knight',
  'grave_abomination',
  'forgotten_jailer',
  'nameless_knight',
  'grave_mage',
];

const tierBossByTier: Record<number, string> = {
  1: 'king_under_crypt',
  2: 'ash_prince',
  3: 'heart_of_catacombs',
};

export function getFloorRequirement(floor: number): FloorRequirement {
  const tier = getCurrentTierByFloor(floor);

  return {
    level: Math.max(1, Math.floor(floor / 3) + tier),
    attack: 10 + floor * 2,
    defense: 5 + Math.floor(floor * 1.25),
    hp: 90 + floor * 18,
  };
}

export function getFloorTitle(floor: number) {
  const tier = getCurrentTierByFloor(floor);

  return `Ярус ${tier} — Этаж ${floor}`;
}

export function getFloorDescription(floor: number) {
  const requirement = getFloorRequirement(floor);
  const tier = getCurrentTierByFloor(floor);
  const tierEnd = getTierEndFloor(tier);

  if (floor === tierEnd) {
    return [
      `Финальный этаж ${tier}-го яруса.`,
      `Рекомендуемый уровень: ${requirement.level}`,
      `Рекомендуемая атака: ${requirement.attack}`,
      `Рекомендуемая защита: ${requirement.defense}`,
      `Рекомендуемое HP: ${requirement.hp}`,
      '',
      `На ${floor}-м этаже тебя ждёт главный босс яруса.`,
    ].join('\n');
  }

  return [
    `Обычный этаж ${tier}-го яруса.`,
    `Рекомендуемый уровень: ${requirement.level}`,
    `Рекомендуемая атака: ${requirement.attack}`,
    `Рекомендуемая защита: ${requirement.defense}`,
    `Рекомендуемое HP: ${requirement.hp}`,
  ].join('\n');
}

export function startFloorRun(floor: number) {
  const modifier = getFloorModifier(floor);
  const tier = getCurrentTierByFloor(floor);

  gameState.floorRun.active = true;
  gameState.floorRun.currentFloor = floor;
  gameState.floorRun.currentRoomIndex = 0;
  gameState.floorRun.modifier = modifier;
  gameState.floorRun.rooms = generateFloorRooms(floor, modifier);
  gameState.floorRun.rewardClaimed = false;

  gameState.floorRun.runType = 'tier';
  gameState.floorRun.targetTier = tier;

  gameState.floorRun.monstersDefeated = 0;
  gameState.floorRun.chestsOpened = 0;
  gameState.floorRun.trapsTriggered = 0;
  gameState.floorRun.goldEarned = 0;
  gameState.floorRun.expEarned = 0;

  gameState.currentRoomIndex = 0;
}

export function generateFloorRooms(floor: number, modifier = getFloorModifier(floor)): FloorRoom[] {
  const roomCount = Phaser.Math.Between(5, 6);
  const rooms: FloorRoom[] = [];

  const isTierBoss = isTierBossFloor(floor);

  let monsterRoomsCount = roomCount - 2;

  if (modifier === 'elite') {
    monsterRoomsCount = roomCount - 3;
  }

  if (modifier === 'treasure') {
    monsterRoomsCount = roomCount - 3;
  }

  for (let i = 0; i < monsterRoomsCount; i++) {
    rooms.push({
      id: `floor_${floor}_monster_${i}`,
      type: 'monster',
      title: `Комната ${i + 1}`,
      description: 'В темноте слышны шаги. Здесь точно кто-то есть.',
      enemyId: pickNormalEnemy(floor),
      completed: false,
    });
  }

  if (modifier === 'elite') {
    rooms.push({
      id: `floor_${floor}_elite_1`,
      type: 'elite',
      title: 'Опасная комната',
      description: 'Здесь ждёт элитный противник.',
      enemyId: pickEliteEnemy(floor),
      completed: false,
    });

    rooms.push({
      id: `floor_${floor}_elite_2`,
      type: 'elite',
      title: 'Зал сильного врага',
      description: 'Противник здесь заметно сильнее обычных монстров.',
      enemyId: pickEliteEnemy(floor),
      completed: false,
    });
  } else if (modifier === 'traps') {
    rooms.push({
      id: `floor_${floor}_trap_1`,
      type: 'trap',
      title: 'Подозрительный проход',
      description: 'Плиты пола выглядят слишком ровными.',
      completed: false,
    });

    rooms.push({
      id: `floor_${floor}_trap_2`,
      type: 'trap',
      title: 'Старый механизм',
      description: 'Ты слышишь скрежет где-то в стенах.',
      completed: false,
    });
  } else if (modifier === 'treasure') {
    rooms.push({
      id: `floor_${floor}_chest_1`,
      type: 'chest',
      title: 'Забытая кладовая',
      description: 'Среди костей и пепла виднеется старый сундук.',
      completed: false,
    });

    rooms.push({
      id: `floor_${floor}_chest_2`,
      type: 'chest',
      title: 'Спрятанный тайник',
      description: 'Кажется, здесь кто-то давно оставил припасы.',
      completed: false,
    });
  } else if (modifier === 'cursed') {
    rooms.push({
      id: `floor_${floor}_elite_cursed`,
      type: 'elite',
      title: 'Проклятый страж',
      description: 'Сильный враг охраняет проход дальше.',
      enemyId: pickEliteEnemy(floor),
      completed: false,
    });

    rooms.push({
      id: `floor_${floor}_trap_cursed`,
      type: 'trap',
      title: 'Проклятая ловушка',
      description: 'Сам воздух на этом этаже пытается убить тебя.',
      completed: false,
    });
  } else {
    const specialRoom = Phaser.Math.Between(1, 100);

    if (specialRoom <= 45) {
      rooms.push({
        id: `floor_${floor}_elite`,
        type: 'elite',
        title: 'Опасная комната',
        description: 'Здесь скрывается более сильный противник.',
        enemyId: pickEliteEnemy(floor),
        completed: false,
      });
    } else if (specialRoom <= 75) {
      rooms.push({
        id: `floor_${floor}_chest`,
        type: 'chest',
        title: 'Забытая кладовая',
        description: 'Среди костей и пепла виднеется старый сундук.',
        completed: false,
      });
    } else {
      rooms.push({
        id: `floor_${floor}_trap`,
        type: 'trap',
        title: 'Подозрительный проход',
        description: 'Плиты пола выглядят слишком ровными.',
        completed: false,
      });
    }
  }

  if (isTierBoss) {
    const tier = getCurrentTierByFloor(floor);
    
    rooms.push({
      id: `floor_${floor}_tier_boss`,
      type: 'tier_boss',
      title: `Финальный зал ${tier}-го яруса`,
      description: 'Воздух тяжелеет. Здесь ждёт главный босс яруса.',
      enemyId: pickTierBoss(floor),
      completed: false,
    });
  } else {
    rooms.push({
      id: `floor_${floor}_boss`,
      type: 'boss',
      title: 'Зал хранителя этажа',
      description: 'Хранитель этажа ждёт тебя.',
      enemyId: pickFloorBoss(floor),
      completed: false,
    });
  }

  return rooms;
}

export function getCurrentRoom(): FloorRoom | undefined {
  return gameState.floorRun.rooms[gameState.floorRun.currentRoomIndex];
}

export function markCurrentRoomCompleted() {
  const room = getCurrentRoom();

  if (!room) {
    return;
  }

  room.completed = true;
}

export function isCurrentFloorCompleted() {
  return gameState.floorRun.currentRoomIndex >= gameState.floorRun.rooms.length;
}

export function completeCurrentFloor() {
  const floor = gameState.floorRun.currentFloor;

  if (floor > gameState.highestClearedFloor) {
    gameState.highestClearedFloor = floor;
  }

  if (isTierBossFloor(floor)) {
    const tier = getCurrentTierByFloor(floor);

    if (tier > gameState.highestClearedTier) {
      gameState.highestClearedTier = tier;
    }
  }
}

export function canStartFloor(floor: number) {
  if (floor <= 1) {
    return true;
  }

  return gameState.highestClearedFloor >= floor - 1;
}

export function getNextFloorAfterCurrent() {
  return gameState.floorRun.currentFloor + 1;
}

function pickNormalEnemy(floor: number) {
  const index = Math.min(
    normalEnemies.length - 1,
    Math.floor(floor / 8)
  );

  return normalEnemies[Phaser.Math.Between(0, index)];
}

function pickEliteEnemy(floor: number) {
  const index = Math.min(
    eliteEnemies.length - 1,
    Math.floor(floor / 10)
  );

  return eliteEnemies[Phaser.Math.Between(0, index)];
}

function pickFloorBoss(floor: number) {
  const tier = getCurrentTierByFloor(floor);

  const bosses = tier >= 2 ? floorBossesTier2 : floorBossesTier1;

  const floorInsideTier = ((floor - 1) % 25) + 1;

  const index = Math.min(
    bosses.length - 1,
    Math.floor(floorInsideTier / 5)
  );

  return bosses[index];
}

function pickTierBoss(floor: number) {
  const tier = getCurrentTierByFloor(floor);

  return tierBossByTier[tier] ?? 'heart_of_catacombs';
}

export function getFloorPreview(floor: number) {
  const modifier = getFloorModifier(floor);
  const isTierBoss = isTierBossFloor(floor);

  let monsters = '3–4';
  let special = 'сундук, ловушка или элита';
  let danger = 'Средняя опасность';

  if (modifier === 'elite') {
    monsters = '2–3';
    special = 'две элитные комнаты';
    danger = 'Высокая опасность';
  }

  if (modifier === 'traps') {
    monsters = '3–4';
    special = 'две ловушки';
    danger = 'Опасно для низкой ловкости';
  }

  if (modifier === 'treasure') {
    monsters = '2–3';
    special = 'две комнаты с добычей';
    danger = 'Ниже среднего';
  }

  if (modifier === 'cursed') {
    monsters = '3–4';
    special = 'элита и проклятая ловушка';
    danger = 'Очень опасно';
  }

  if (isTierBoss) {
    monsters = '3–4';
    special = 'финальный зал';
    danger = 'Крайне опасно';
  }

  return {
    modifier,
    modifierName: getFloorModifierName(modifier),
    modifierDescription: getFloorModifierDescription(modifier),
    rooms: '5–6',
    monsters,
    special,
    boss: isTierBoss ? 'финальный босс яруса' : 'босс этажа',
    danger,
  };
}

export function getFloorModifier(floor: number): FloorModifier {
  if (isTierBossFloor(floor)) {
    return 'tier_boss';
  }

  if (floor % 10 === 0) {
    return 'cursed';
  }

  if (floor % 7 === 0) {
    return 'treasure';
  }

  if (floor % 5 === 0) {
    return 'elite';
  }

  if (floor % 4 === 0) {
    return 'traps';
  }

  return 'normal';
}

export function getFloorModifierName(modifier: FloorModifier) {
  if (modifier === 'elite') return 'Этаж элиты';
  if (modifier === 'traps') return 'Этаж ловушек';
  if (modifier === 'treasure') return 'Сокровищница';
  if (modifier === 'cursed') return 'Проклятый этаж';
  if (modifier === 'tier_boss') return 'Финал яруса';

  return 'Обычный этаж';
}

export function getFloorModifierDescription(modifier: FloorModifier) {
  if (modifier === 'elite') {
    return 'На этаже больше сильных противников.';
  }

  if (modifier === 'traps') {
    return 'На этаже повышен шанс ловушек.';
  }

  if (modifier === 'treasure') {
    return 'На этаже выше шанс сундуков и добычи.';
  }

  if (modifier === 'cursed') {
    return 'Враги опаснее, но награды лучше.';
  }

  if (modifier === 'tier_boss') {
    return 'Финальный этаж яруса. Здесь ждёт главный босс.';
  }

  return 'Стандартная зачистка этажа.';
}
export function canStartTier(tier: number) {
  if (tier <= 1) {
    return true;
  }

  return gameState.highestClearedTier >= tier - 1;
}

export function getHighestUnlockedTier() {
  return gameState.highestClearedTier + 1;
}

export function startTierRun(tier: number) {
  const startFloor = getTierStartFloor(tier);

  startFloorRun(startFloor);

  gameState.floorRun.runType = 'tier';
  gameState.floorRun.targetTier = tier;
}

export function startTierGateBoss(targetTier: number) {
  const previousTier = targetTier - 1;
  const bossFloor = getTierEndFloor(previousTier);

  gameState.floorRun.active = true;
  gameState.floorRun.currentFloor = bossFloor;
  gameState.floorRun.currentRoomIndex = 0;
  gameState.floorRun.modifier = 'tier_boss';

  gameState.floorRun.runType = 'tier_gate';
  gameState.floorRun.targetTier = targetTier;

  gameState.floorRun.rooms = [
    {
      id: `tier_${previousTier}_gate_boss`,
      type: 'tier_boss',
      title: `Испытание ${previousTier}-го яруса`,
      description:
        'Чтобы попасть в следующий ярус напрямую, нужно снова победить финального босса прошлого яруса.',
      enemyId: pickTierBoss(bossFloor),
      completed: false,
    },
  ];

  gameState.floorRun.rewardClaimed = true;

  gameState.floorRun.monstersDefeated = 0;
  gameState.floorRun.chestsOpened = 0;
  gameState.floorRun.trapsTriggered = 0;
  gameState.floorRun.goldEarned = 0;
  gameState.floorRun.expEarned = 0;

  gameState.currentRoomIndex = 0;
}