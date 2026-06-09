export type QuestProgress = {
  enemiesKilled: number;
  chestsOpened: number;
  dungeonsCompleted: number;
  goldEarned: number;
  claimedQuestIds: string[];
};

export const gameState = {
  currentDungeonId: 'old_catacombs',
  currentRoomIndex: 0,
  dungeonCompleted: false,
  unlockedDungeonIds: ['old_catacombs'],

  lastCampRestAt: 0,

  questProgress: {
    enemiesKilled: 0,
    chestsOpened: 0,
    dungeonsCompleted: 0,
    goldEarned: 0,
    claimedQuestIds: [],
  } as QuestProgress,
};

export function resetDungeonProgress(dungeonId = 'old_catacombs') {
  gameState.currentDungeonId = dungeonId;
  gameState.currentRoomIndex = 0;
  gameState.dungeonCompleted = false;
}

export function goToNextRoom() {
  gameState.currentRoomIndex += 1;
}

export function unlockDungeon(dungeonId: string) {
  if (!gameState.unlockedDungeonIds.includes(dungeonId)) {
    gameState.unlockedDungeonIds.push(dungeonId);
  }
}

export function isDungeonUnlocked(dungeonId: string): boolean {
  return gameState.unlockedDungeonIds.includes(dungeonId);
}