export type QuestProgress = {
  enemiesKilled: number;
  chestsOpened: number;
  dungeonsCompleted: number;
  goldEarned: number;
  claimedQuestIds: string[];
};

export type FloorRoomType =
  | 'monster'
  | 'elite'
  | 'chest'
  | 'trap'
  | 'boss'
  | 'tier_boss';

export type FloorModifier =
  | 'normal'
  | 'elite'
  | 'traps'
  | 'treasure'
  | 'cursed'
  | 'tier_boss';

export type FloorRoom = {
  id: string;
  type: FloorRoomType;
  title: string;
  description: string;
  enemyId?: string;
  completed: boolean;
};

export type FloorRun = {
  active: boolean;
  currentFloor: number;
  currentRoomIndex: number;
  rooms: FloorRoom[];
  rewardClaimed: boolean;
  modifier: FloorModifier;

  runType: 'tier' | 'tier_gate';
  targetTier: number;

  monstersDefeated: number;
  chestsOpened: number;
  trapsTriggered: number;
  goldEarned: number;
  expEarned: number;

  materialsEarned: Partial<Record<string, number>>;
};

export function createEmptyFloorRun(): FloorRun {
  return {
    active: false,
    currentFloor: 1,
    currentRoomIndex: 0,
    rooms: [],
    rewardClaimed: false,
    modifier: 'normal',

    runType: 'tier',
    targetTier: 1,

    monstersDefeated: 0,
    chestsOpened: 0,
    trapsTriggered: 0,
    goldEarned: 0,
    expEarned: 0,
      
    materialsEarned: {},
  };
}

export const gameState = {
  currentDungeonId: 'tower_depths',
  currentRoomIndex: 0,
  dungeonCompleted: false,
  unlockedDungeonIds: ['tower_depths'],

  lastCampRestAt: 0,

  highestClearedFloor: 0,
  highestClearedTier: 0,

  floorRun: createEmptyFloorRun(),

  questProgress: {
    enemiesKilled: 0,
    chestsOpened: 0,
    dungeonsCompleted: 0,
    goldEarned: 0,
    claimedQuestIds: [],
  } as QuestProgress,
};

export function getCurrentTierByFloor(floor: number) {
  return Math.ceil(floor / 25);
}

export function getTierStartFloor(tier: number) {
  return (tier - 1) * 25 + 1;
}

export function getTierEndFloor(tier: number) {
  return tier * 25;
}

export function isTierBossFloor(floor: number) {
  return floor % 25 === 0;
}

export function goToNextRoom() {
  gameState.floorRun.currentRoomIndex += 1;
  gameState.currentRoomIndex = gameState.floorRun.currentRoomIndex;
}

export function resetFloorRun() {
  gameState.floorRun = createEmptyFloorRun();
  gameState.currentRoomIndex = 0;
}

export function resetDungeonProgress(_dungeonId = 'tower_depths') {
  resetFloorRun();
}

export function unlockDungeon(_dungeonId: string) {
  // Старые подземелья больше не используются.
}

export function isDungeonUnlocked(_dungeonId: string): boolean {
  return true;
}