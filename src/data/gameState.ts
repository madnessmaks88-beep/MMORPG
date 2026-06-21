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
  | 'event'
  | 'boss'
  | 'tier_boss'
  | 'campfire';

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
  eventId?: string;

  branchLayer?: number;
  branchColumn?: number;
  nextRoomIds?: string[];
  previousRoomIds?: string[];
  question?: boolean;
  discovered?: boolean;

  completed: boolean;
};

export type FloorRun = {
  active: boolean;
  currentFloor: number;
  currentRoomIndex: number;
  rooms: FloorRoom[];
  currentRoomId?: string;
  awaitingRoomChoice: boolean;
  availableRoomIds: string[];
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

  // Защита от повторного списания рассудка при повторном открытии результата этажа.
  sanityChargedForFloor?: number;
};



export function createEmptyFloorRun(): FloorRun {
  return {
    active: false,
    currentFloor: 1,
    currentRoomIndex: 0,
    rooms: [],
    currentRoomId: undefined,
    awaitingRoomChoice: false,
    availableRoomIds: [],
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
    sanityChargedForFloor: undefined,
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

  cityCampfire: createEmptyCityCampfireState(),

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
  const rooms = gameState.floorRun.rooms;
  const currentRoom =
    rooms.find(room => room.id === gameState.floorRun.currentRoomId) ??
    rooms[gameState.floorRun.currentRoomIndex];

  if (currentRoom?.nextRoomIds?.length) {
    const availableRoomIds = currentRoom.nextRoomIds.filter(roomId => {
      const room = rooms.find(candidate => candidate.id === roomId);

      return Boolean(room && !room.completed);
    });

    if (availableRoomIds.length > 1) {
      gameState.floorRun.availableRoomIds = availableRoomIds;
      gameState.floorRun.awaitingRoomChoice = true;
      return;
    }

    if (availableRoomIds.length === 1) {
      const nextRoomId = availableRoomIds[0];
      const nextIndex = rooms.findIndex(room => room.id === nextRoomId);

      gameState.floorRun.currentRoomId = nextRoomId;
      gameState.floorRun.currentRoomIndex = nextIndex >= 0
        ? nextIndex
        : gameState.floorRun.currentRoomIndex + 1;
      gameState.floorRun.availableRoomIds = [];
      gameState.floorRun.awaitingRoomChoice = false;
      gameState.currentRoomIndex = gameState.floorRun.currentRoomIndex;
      return;
    }
  }

  gameState.floorRun.currentRoomIndex += 1;
  gameState.floorRun.currentRoomId = rooms[gameState.floorRun.currentRoomIndex]?.id;
  gameState.floorRun.availableRoomIds = [];
  gameState.floorRun.awaitingRoomChoice = false;
  gameState.currentRoomIndex = gameState.floorRun.currentRoomIndex;
}

export type CityFlintType = 'common' | 'rare' | 'donate';

export type CityCampfireState = {
  active: boolean;
  flintType: CityFlintType | null;
  startedAt: number;
  expiresAt: number | null;
};

export function createEmptyCityCampfireState(): CityCampfireState {
  return {
    active: false,
    flintType: null,
    startedAt: 0,
    expiresAt: null,
  };
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