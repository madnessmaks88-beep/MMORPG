import Phaser from 'phaser';

import { player } from '../data/player';
import type { InventoryItem } from '../data/player';
import { gameState } from '../data/gameState';
import { vkStorageGet, vkStorageSet } from './VKBridgeSystem';

const SAVE_KEY = 'below_ashes_save_v1';

type SaveData = {
  player: typeof player;
  gameState: typeof gameState;
};

export function saveGame() {
  const data: SaveData = {
    player,
    gameState,
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadGame() {
  const rawSave = localStorage.getItem(SAVE_KEY);

  if (!rawSave) {
    return false;
  }

  try {
    const data = JSON.parse(rawSave) as SaveData;

    Object.assign(player, data.player);
    Object.assign(gameState, data.gameState);

    if (!player.inventory) {
      player.inventory = [];
    }

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
        instanceId: item.instanceId,
        itemId: item.itemId,
        upgradeLevel: item.upgradeLevel ?? 0,
      };
    });

    if (!player.equipment) {
      player.equipment = {};
    }

    player.equipment = {};
    
    if (!player.inventory) {
      player.inventory = [];
    }
    
    if (!player.equipment) {
      player.equipment = {};
    }

    if (!gameState.unlockedDungeonIds) {
      gameState.unlockedDungeonIds = ['old_catacombs'];
    }

    if (!gameState.currentDungeonId) {
      gameState.currentDungeonId = 'old_catacombs';
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

    if (!gameState.questProgress.claimedQuestIds) {
      gameState.questProgress.claimedQuestIds = [];
    }

    return true;
  } catch {
    localStorage.removeItem(SAVE_KEY);
    return false;
  }
}

export function resetSave() {
  localStorage.removeItem(SAVE_KEY);
  window.location.reload();
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