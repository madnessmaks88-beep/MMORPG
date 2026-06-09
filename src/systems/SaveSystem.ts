import Phaser from 'phaser';

import { player } from '../data/player';
import type { InventoryItem } from '../data/player';

import {
  createEmptyFloorRun,
  gameState,
  getCurrentTierByFloor,
} from '../data/gameState';
import { vkStorageGet, vkStorageSet } from './VKBridgeSystem';

const SAVE_KEY = 'below_ashes_save_v3';

type SaveData = {
  player: typeof player;
  gameState: typeof gameState;
};

export function saveGame() {
  const saveData: SaveData = {
    player,
    gameState,
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
}

export function loadGame() {
  localStorage.removeItem('below_ashes_save_v2');

  const rawSave = localStorage.getItem(SAVE_KEY);

  if (!rawSave) {
    fixMissingPlayerFields();
    fixMissingGameStateFields();
    return false;
  }

  try {
    const saveData = JSON.parse(rawSave) as Partial<SaveData>;

    if (saveData.player) {
      Object.assign(player, saveData.player);
    }

    if (saveData.gameState) {
      Object.assign(gameState, saveData.gameState);
    }

    fixMissingPlayerFields();
    fixInventoryAfterLoad();
    fixMissingGameStateFields();

    return true;
  } catch (error) {
    console.warn('Save loading failed.', error);

    fixMissingPlayerFields();
    fixMissingGameStateFields();

    return false;
  }
}

export async function saveGameAsync() {
  saveGame();

  const rawSave = localStorage.getItem(SAVE_KEY);

  if (!rawSave) {
    return;
  }

  await vkStorageSet(SAVE_KEY, rawSave);
}

export async function loadGameAsync() {
  try {
    const vkSave = await vkStorageGet(SAVE_KEY);

    if (vkSave) {
      localStorage.setItem(SAVE_KEY, vkSave);
    }
  } catch (error) {
    console.warn('VK save loading failed. Loading local save.', error);
  }

  return loadGame();
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function resetSave() {
  clearSave();
}

function fixMissingPlayerFields() {
  if (player.level === undefined) player.level = 1;
  if (player.exp === undefined) player.exp = 0;
  if (player.expToNextLevel === undefined) player.expToNextLevel = 50;
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

function fixInventoryAfterLoad() {
  const oldItemUpgrades = (player as any).itemUpgrades ?? {};

  player.inventory = player.inventory.map((item: string | InventoryItem) => {
    if (typeof item === 'string') {
      return {
        instanceId: `${item}_${Date.now()}_${Phaser.Math.Between(1000, 9999)}`,
        itemId: item,
        upgradeLevel: oldItemUpgrades[item] ?? 0,
      };
    }

    return {
      instanceId:
        item.instanceId ||
        `${item.itemId}_${Date.now()}_${Phaser.Math.Between(1000, 9999)}`,
      itemId: item.itemId,
      upgradeLevel: item.upgradeLevel ?? 0,
    };
  });

  delete (player as any).itemUpgrades;
}

function fixMissingGameStateFields() {
  if (!gameState.currentDungeonId) {
    gameState.currentDungeonId = 'old_catacombs';
  }

  if (gameState.currentRoomIndex === undefined) {
    gameState.currentRoomIndex = 0;
  }

  if (gameState.dungeonCompleted === undefined) {
    gameState.dungeonCompleted = false;
  }

  if (!gameState.unlockedDungeonIds) {
    gameState.unlockedDungeonIds = ['old_catacombs'];
  }

  if (gameState.lastCampRestAt === undefined) {
    gameState.lastCampRestAt = 0;
  }

  if (gameState.highestClearedFloor === undefined) {
    gameState.highestClearedFloor = 0;
  }

  if (gameState.highestClearedTier === undefined) {
    gameState.highestClearedTier = 0;
  }
  if (gameState.floorRun.rewardClaimed === undefined) {
    gameState.floorRun.rewardClaimed = false;
  }

  if (!gameState.floorRun) {
    gameState.floorRun = createEmptyFloorRun();
  }

  if (gameState.floorRun.active === undefined) {
    gameState.floorRun.active = false;
  }

  if (gameState.floorRun.currentFloor === undefined) {
    gameState.floorRun.currentFloor = 1;
  }

  if (gameState.floorRun.currentRoomIndex === undefined) {
    gameState.floorRun.currentRoomIndex = 0;
  }

  if (!gameState.floorRun.rooms) {
    gameState.floorRun.rooms = [];
  }

  if (gameState.floorRun.rewardClaimed === undefined) {
    gameState.floorRun.rewardClaimed = false;
  }

  if (!gameState.floorRun.modifier) {
    gameState.floorRun.modifier = 'normal';
  }

  if (gameState.floorRun.monstersDefeated === undefined) {
    gameState.floorRun.monstersDefeated = 0;
  }

  if (gameState.floorRun.chestsOpened === undefined) {
    gameState.floorRun.chestsOpened = 0;
  }

  if (gameState.floorRun.trapsTriggered === undefined) {
    gameState.floorRun.trapsTriggered = 0;
  }

  if (gameState.floorRun.goldEarned === undefined) {
    gameState.floorRun.goldEarned = 0;
  }

  if (gameState.floorRun.expEarned === undefined) {
    gameState.floorRun.expEarned = 0;
  }

  if (!gameState.floorRun.runType) {
    gameState.floorRun.runType = 'tier';
  }

  if (gameState.floorRun.targetTier === undefined) {
    gameState.floorRun.targetTier = getCurrentTierByFloor(
      gameState.floorRun.currentFloor || 1
    );
  }

  if (!gameState.questProgress) {
    gameState.questProgress = {
      enemiesKilled: 0,
      chestsOpened: 0,
      dungeonsCompleted: 0,
      goldEarned: 0,
      claimedQuestIds: [],
    };
  }

  if (gameState.questProgress.enemiesKilled === undefined) {
    gameState.questProgress.enemiesKilled = 0;
  }

  if (gameState.questProgress.chestsOpened === undefined) {
    gameState.questProgress.chestsOpened = 0;
  }

  if (gameState.questProgress.dungeonsCompleted === undefined) {
    gameState.questProgress.dungeonsCompleted = 0;
  }

  if (gameState.questProgress.goldEarned === undefined) {
    gameState.questProgress.goldEarned = 0;
  }

  if (!gameState.questProgress.claimedQuestIds) {
    gameState.questProgress.claimedQuestIds = [];
  }
}