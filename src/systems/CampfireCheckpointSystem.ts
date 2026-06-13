import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getPlayerStats } from './InventorySystem';

export type CheckpointFlintType = 'none' | 'dim' | 'black' | 'ruby';

export type CampfireBattleCheckpoint = {
  tier: number;
  floor: number;
  selectedFlint: CheckpointFlintType;
  activatedAt: number;
  expiresAt: number;
  playerHp: number;
  playerEnergy: number;
  playerPotions: number;
  floorRunSnapshot: unknown;
};

type GameStateWithCheckpoint = typeof gameState & {
  dungeonCampfireCheckpoint?: CampfireBattleCheckpoint;
  floorRun: unknown;
};

function cloneData<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getFlintCheckpointDurationMs(type: CheckpointFlintType) {
  if (type === 'dim') return 5 * 60 * 1000;
  if (type === 'black') return 10 * 60 * 1000;
  if (type === 'ruby') return 60 * 60 * 1000;

  return 0;
}

export function formatCheckpointTimeLeft(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function clearCampfireBattleCheckpoint() {
  const stateOwner = gameState as GameStateWithCheckpoint;
  stateOwner.dungeonCampfireCheckpoint = undefined;
}

export function getActiveCampfireBattleCheckpoint(now = Date.now()) {
  const stateOwner = gameState as GameStateWithCheckpoint;
  const checkpoint = stateOwner.dungeonCampfireCheckpoint;

  if (!checkpoint) {
    return undefined;
  }

  if (checkpoint.expiresAt <= now) {
    clearCampfireBattleCheckpoint();
    return undefined;
  }

  return checkpoint;
}

export function createCampfireBattleCheckpoint(config: {
  tier: number;
  floor: number;
  selectedFlint: CheckpointFlintType;
}) {
  const stateOwner = gameState as GameStateWithCheckpoint;
  const durationMs = getFlintCheckpointDurationMs(config.selectedFlint);
  const now = Date.now();
  const stats = getPlayerStats(player);

  const checkpoint: CampfireBattleCheckpoint = {
    tier: config.tier,
    floor: config.floor,
    selectedFlint: config.selectedFlint,
    activatedAt: now,
    expiresAt: now + durationMs,
    playerHp: stats.maxHp,
    playerEnergy: stats.maxEnergy,
    playerPotions: Math.max(6, player.potions ?? 0),
    floorRunSnapshot: cloneData(stateOwner.floorRun),
  };

  stateOwner.dungeonCampfireCheckpoint = checkpoint;

  return checkpoint;
}

export function restoreCampfireBattleCheckpoint() {
  const stateOwner = gameState as GameStateWithCheckpoint;
  const checkpoint = getActiveCampfireBattleCheckpoint();

  if (!checkpoint) {
    return {
      success: false,
      message: 'Костёр уже погас. Вернуться к нему нельзя.',
    };
  }

  const stats = getPlayerStats(player);

  stateOwner.floorRun = cloneData<typeof gameState.floorRun>(checkpoint.floorRunSnapshot);

  player.hp = Math.min(stats.maxHp, Math.max(1, checkpoint.playerHp));
  player.energy = Math.min(stats.maxEnergy, Math.max(0, checkpoint.playerEnergy));
  player.potions = Math.max(6, player.potions ?? 0, checkpoint.playerPotions);

  return {
    success: true,
    message: `Ты вернулся к зажжённому костру. Осталось времени: ${formatCheckpointTimeLeft(checkpoint.expiresAt - Date.now())}.`,
  };
}
