import { player, type PlayerData } from '../data/player';

import {
  gameState,
  createEmptyFloorRun,
  getCurrentTierByFloor,
  type FloorRun,
  type QuestProgress,
} from '../data/gameState';

import {
  isVKBridgeReady,
  vkStorageGet,
  vkStorageSet,
} from './VKBridgeSystem';

const SAVE_KEY = 'below_ashes_save_v3';

type SaveData = {
  version: number;
  player: PlayerData;
  gameState: {
    currentDungeonId: string;
    currentRoomIndex: number;
    dungeonCompleted: boolean;
    unlockedDungeonIds: string[];

    lastCampRestAt: number;

    highestClearedFloor: number;
    highestClearedTier: number;

    floorRun: FloorRun;

    questProgress: QuestProgress;
  };
};

function createSaveData(): SaveData {
  return {
    version: 3,
    player: structuredClone(player),
    gameState: {
      currentDungeonId: gameState.currentDungeonId,
      currentRoomIndex: gameState.currentRoomIndex,
      dungeonCompleted: gameState.dungeonCompleted,
      unlockedDungeonIds: [...gameState.unlockedDungeonIds],

      lastCampRestAt: gameState.lastCampRestAt,

      highestClearedFloor: gameState.highestClearedFloor,
      highestClearedTier: gameState.highestClearedTier,

      floorRun: structuredClone(gameState.floorRun),

      questProgress: structuredClone(gameState.questProgress),
    },
  };
}

function applySaveData(saveData: Partial<SaveData>) {
  if (saveData.player) {
    Object.assign(player, saveData.player);
  }

  if (saveData.gameState) {
    Object.assign(gameState, saveData.gameState);
  }

  fixMissingPlayerFields();
  fixMissingGameStateFields();
}

function fixMissingPlayerFields() {
  if (player.name === undefined) player.name = 'Безымянный';

  if (player.level === undefined) player.level = 1;
  if (player.exp === undefined) player.exp = 0;
  if (player.expToNextLevel === undefined) player.expToNextLevel = 70;
  if (player.gold === undefined) player.gold = 0;

  if (player.maxHp === undefined) player.maxHp = 100;
  if (player.hp === undefined) player.hp = player.maxHp;

  if (player.maxEnergy === undefined) player.maxEnergy = 3;
  if (player.energy === undefined) player.energy = player.maxEnergy;

  if (player.potions === undefined) player.potions = 2;

  if (player.attack === undefined) player.attack = 12;
  if (player.defense === undefined) player.defense = 3;
  if (player.critChance === undefined) player.critChance = 0.1;

  if (player.agility === undefined) player.agility = 5;
  if (player.luck === undefined) player.luck = 5;
  if (player.strength === undefined) player.strength = player.attack ?? 11;
  if (player.intelligence === undefined) player.intelligence = 11;

  if (!player.relicIds) player.relicIds = [];

  if (!player.inventory) player.inventory = [];
  if (!player.equipment) player.equipment = {};
}

function fixMissingGameStateFields() {
  if (!gameState.currentDungeonId) gameState.currentDungeonId = 'tower_depths';
  if (gameState.currentRoomIndex === undefined) gameState.currentRoomIndex = 0;
  if (gameState.dungeonCompleted === undefined) gameState.dungeonCompleted = false;
  if (!gameState.unlockedDungeonIds) gameState.unlockedDungeonIds = ['tower_depths'];

  if (gameState.lastCampRestAt === undefined) gameState.lastCampRestAt = 0;

  if (gameState.highestClearedFloor === undefined) gameState.highestClearedFloor = 0;
  if (gameState.highestClearedTier === undefined) gameState.highestClearedTier = 0;

  if (!gameState.floorRun) {
    gameState.floorRun = createEmptyFloorRun();
  }

  if (gameState.floorRun.active === undefined) gameState.floorRun.active = false;
  if (gameState.floorRun.currentFloor === undefined) gameState.floorRun.currentFloor = 1;
  if (gameState.floorRun.currentRoomIndex === undefined) gameState.floorRun.currentRoomIndex = 0;
  if (!gameState.floorRun.rooms) gameState.floorRun.rooms = [];
  if (gameState.floorRun.rewardClaimed === undefined) gameState.floorRun.rewardClaimed = false;
  if (!gameState.floorRun.modifier) gameState.floorRun.modifier = 'normal';

  if (!gameState.floorRun.runType) gameState.floorRun.runType = 'tier';
  if (gameState.floorRun.targetTier === undefined) {
    gameState.floorRun.targetTier = getCurrentTierByFloor(gameState.floorRun.currentFloor || 1);
  }

  if (gameState.floorRun.monstersDefeated === undefined) gameState.floorRun.monstersDefeated = 0;
  if (gameState.floorRun.chestsOpened === undefined) gameState.floorRun.chestsOpened = 0;
  if (gameState.floorRun.trapsTriggered === undefined) gameState.floorRun.trapsTriggered = 0;
  if (gameState.floorRun.goldEarned === undefined) gameState.floorRun.goldEarned = 0;
  if (gameState.floorRun.expEarned === undefined) gameState.floorRun.expEarned = 0;

  if (!gameState.questProgress) {
    gameState.questProgress = {
      enemiesKilled: 0,
      chestsOpened: 0,
      dungeonsCompleted: 0,
      goldEarned: 0,
      claimedQuestIds: [],
    };
  }

  if (gameState.questProgress.enemiesKilled === undefined) gameState.questProgress.enemiesKilled = 0;
  if (gameState.questProgress.chestsOpened === undefined) gameState.questProgress.chestsOpened = 0;
  if (gameState.questProgress.dungeonsCompleted === undefined) gameState.questProgress.dungeonsCompleted = 0;
  if (gameState.questProgress.goldEarned === undefined) gameState.questProgress.goldEarned = 0;
  if (!gameState.questProgress.claimedQuestIds) gameState.questProgress.claimedQuestIds = [];
}

export async function saveGameAsync() {
  const saveData = createSaveData();
  const json = JSON.stringify(saveData);

  localStorage.setItem(SAVE_KEY, json);

  if (isVKBridgeReady()) {
    await vkStorageSet(SAVE_KEY, json);
  }
}

export async function loadGameAsync() {
  let rawSave = localStorage.getItem(SAVE_KEY);

  if (!rawSave && isVKBridgeReady()) {
    rawSave = await vkStorageGet(SAVE_KEY);

    if (rawSave) {
      localStorage.setItem(SAVE_KEY, rawSave);
    }
  }

  if (!rawSave) {
    fixMissingPlayerFields();
    fixMissingGameStateFields();
    return;
  }

  try {
    const saveData = JSON.parse(rawSave) as Partial<SaveData>;
    applySaveData(saveData);
  } catch {
    console.warn('Save loading failed. Save file is corrupted.');

    fixMissingPlayerFields();
    fixMissingGameStateFields();
  }
}

export function saveGame() {
  void saveGameAsync();
}

export function loadGame() {
  void loadGameAsync();
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);

  if (isVKBridgeReady()) {
    void vkStorageSet(SAVE_KEY, '');
  }
}

export function resetSave() {
  clearSave();
}