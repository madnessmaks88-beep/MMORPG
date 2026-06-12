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

const commonEnemyIds = [
  'bone_gnawer',
  'crypt_crawler',
  'grave_worm',
  'corpse_eater',
  'rotten_servant',
  'bone_guard',
  'mold_dead',
  'sarcophagus_rat',
  'carrion_spider',
  'crypt_minion',
  'deadskin',
  'funeral_beetle',
  'bone_breaker',
  'coffin_scraper',
  'infected_acolyte',
];

const eliteEnemyIds = [
  'sarcophagus_keeper',
  'bone_executioner',
  'crypt_butcher',
  'buried_knight',
  'bone_armored_guard',
  'dead_standard_bearer',
  'rotten_chaplain',
  'leper_guard',
  'crypt_torturer',
  'bloody_gravedigger',
];

const miniBossEnemyIds = [
  'bone_abbot',
  'sarcophagus_lord',
  'lower_crypt_executioner',
  'funeral_champion',
  'bone_collector',
  'dead_knight_varn',
  'rotten_bishop',
  'black_tomb_guardian',
];

const tierBossByTier: Record<number, string> = {
  1: 'morvein_sealed_crypt_lord',
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
  const roomCount = getRoomCountByFloor(floor);
  const rooms: FloorRoom[] = [];

  for (let index = 0; index < roomCount - 1; index += 1) {
    rooms.push(createRandomNormalRoom(floor, index, modifier));
  }

  rooms.push(createFinalRoom(floor));

  return rooms;
}

function getRoomCountByFloor(floor: number) {
  const floorInsideTier = ((floor - 1) % 25) + 1;

  if (floorInsideTier <= 5) {
    return 5;
  }

  if (floorInsideTier <= 15) {
    return 6;
  }

  return 7;
}

function getEliteChanceByFloor(floor: number) {
  const floorInsideTier = ((floor - 1) % 25) + 1;

  if (floorInsideTier <= 5) return 0.08;
  if (floorInsideTier <= 10) return 0.14;
  if (floorInsideTier <= 15) return 0.22;
  if (floorInsideTier <= 20) return 0.32;
  if (floorInsideTier <= 24) return 0.45;

  return 0.5;
}

function rollNormalRoomKind(
  modifier: FloorModifier
): 'combat' | 'chest' | 'trap' {
  const roll = Math.random();

  if (modifier === 'treasure') {
    if (roll < 0.52) return 'combat';
    if (roll < 0.86) return 'chest';
    return 'trap';
  }

  if (modifier === 'traps') {
    if (roll < 0.58) return 'combat';
    if (roll < 0.68) return 'chest';
    return 'trap';
  }

  if (modifier === 'cursed') {
    if (roll < 0.72) return 'combat';
    if (roll < 0.82) return 'chest';
    return 'trap';
  }

  if (modifier === 'elite') {
    if (roll < 0.78) return 'combat';
    if (roll < 0.9) return 'chest';
    return 'trap';
  }

  if (roll < 0.68) return 'combat';
  if (roll < 0.84) return 'chest';

  return 'trap';
}

function rollCombatRoomType(floor: number, modifier: FloorModifier): 'monster' | 'elite' {
  let eliteChance = getEliteChanceByFloor(floor);

  if (modifier === 'elite') {
    eliteChance += 0.2;
  }

  if (modifier === 'cursed') {
    eliteChance += 0.12;
  }

  return Math.random() < Math.min(eliteChance, 0.75)
    ? 'elite'
    : 'monster';
}

function createRandomNormalRoom(
  floor: number,
  index: number,
  modifier: FloorModifier
): FloorRoom {
  const kind = rollNormalRoomKind(modifier);

  if (kind === 'chest') {
    return {
      id: `floor_${floor}_chest_${index}`,
      type: 'chest',
      title: 'Старый сундук',
      description: 'Среди пыли и костей стоит тяжелый погребальный сундук.',
      completed: false,
    };
  }

  if (kind === 'trap') {
    return {
      id: `floor_${floor}_trap_${index}`,
      type: 'trap',
      title: 'Проклятая ловушка',
      description: 'Плиты пола покрыты древними знаками. Один неверный шаг может стоить крови.',
      completed: false,
    };
  }

  const type = rollCombatRoomType(floor, modifier);

  return {
    id: `floor_${floor}_${type}_${index}`,
    type,
    title: type === 'elite' ? 'Опасная комната' : 'Обычная комната',
    description: type === 'elite'
      ? 'В этой комнате скрывается усиленный враг склепа.'
      : 'Впереди слышится шорох костей и влажное дыхание мертвечины.',
    enemyId: type === 'elite'
      ? getRandomEliteEnemyId()
      : getRandomCommonEnemyId(),
    completed: false,
  };
}

function createFinalRoom(floor: number): FloorRoom {
  if (isTierBossFloor(floor)) {

    return {
      id: `floor_${floor}_tier_boss`,
      type: 'tier_boss',
      title: 'Морвеин, Владыка Запечатанного Склепа',
      description: 'Последняя печать склепа дрожит. За ней ждёт Морвеин.',
      enemyId: pickTierBoss(floor),
      completed: false,
    };
  }

  return {
    id: `floor_${floor}_boss`,
    type: 'boss',
    title: 'Мини-босс этажа',
    description: 'Последняя комната этажа охраняется сильным противником.',
    enemyId: getRandomMiniBossEnemyId(),
    completed: false,
  };
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

function pickTierBoss(floor: number) {
  const tier = getCurrentTierByFloor(floor);

  return tierBossByTier[tier] ?? 'morvein_sealed_crypt_lord';
}

function getRandomFrom<T>(items: T[]) {
  return items[Phaser.Math.Between(0, items.length - 1)];
}

function getRandomCommonEnemyId() {
  return getRandomFrom(commonEnemyIds);
}

function getRandomEliteEnemyId() {
  return getRandomFrom(eliteEnemyIds);
}

function getRandomMiniBossEnemyId() {
  return getRandomFrom(miniBossEnemyIds);
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