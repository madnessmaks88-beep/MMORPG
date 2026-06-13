import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getPlayerStats } from './InventorySystem';

export type CheckpointFlintType =
  | 'none'
  | 'dim'
  | 'black'
  | 'ruby'
  | 'ordinary'
  | 'regular'
  | 'red_ruby';

type FloorRunSnapshot = typeof gameState.floorRun;

export type CampfireBattleCheckpoint = {
  id: string;
  tier: number;
  floor: number;
  selectedFlint: CheckpointFlintType;
  createdAt: number;
  expiresAt: number;
  floorRunSnapshot: FloorRunSnapshot;
  playerSnapshot: {
    hp: number;
    energy: number;
    potions: number;
  };
};

type CreateCampfireBattleCheckpointConfig = {
  tier: number;
  floor: number;
  selectedFlint: CheckpointFlintType;
};

type RestoreCampfireBattleCheckpointResult = {
  success: boolean;
  message: string;
  checkpoint?: CampfireBattleCheckpoint;
};

const CAMPFIRE_BATTLE_CHECKPOINT_KEY = 'below_ashes_campfire_battle_checkpoint_v1';
const MAX_POTION_COUNT = 6;

function cloneData<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeFlintType(flintType: CheckpointFlintType): CheckpointFlintType {
  if (flintType === 'ordinary' || flintType === 'regular') {
    return 'dim';
  }

  if (flintType === 'red_ruby') {
    return 'ruby';
  }

  return flintType;
}

function getCheckpointDurationMs(flintType: CheckpointFlintType) {
  const normalized = normalizeFlintType(flintType);

  if (normalized === 'black') {
    return 10 * 60 * 1000;
  }

  if (normalized === 'ruby') {
    return 60 * 60 * 1000;
  }

  // Тусклое / обычное огниво.
  // Даже если случайно пришло 'none', даём 5 минут, чтобы чекпоинт
  // не сгорал мгновенно из-за несовпадения названий типов.
  return 5 * 60 * 1000;
}

function readCheckpointFromStorage(): CampfireBattleCheckpoint | null {
  const raw = localStorage.getItem(CAMPFIRE_BATTLE_CHECKPOINT_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CampfireBattleCheckpoint;
  } catch {
    localStorage.removeItem(CAMPFIRE_BATTLE_CHECKPOINT_KEY);
    return null;
  }
}

function writeCheckpointToStorage(checkpoint: CampfireBattleCheckpoint) {
  localStorage.setItem(
    CAMPFIRE_BATTLE_CHECKPOINT_KEY,
    JSON.stringify(checkpoint)
  );
}

export function clearCampfireBattleCheckpoint() {
  localStorage.removeItem(CAMPFIRE_BATTLE_CHECKPOINT_KEY);
}

export function formatCheckpointTimeLeft(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function getCampfireBattleCheckpoint() {
  return readCheckpointFromStorage();
}

export function getActiveCampfireBattleCheckpoint() {
  const checkpoint = readCheckpointFromStorage();

  if (!checkpoint) {
    return null;
  }

  if (checkpoint.expiresAt <= Date.now()) {
    clearCampfireBattleCheckpoint();
    return null;
  }

  return checkpoint;
}

export function createCampfireBattleCheckpoint(
  config: CreateCampfireBattleCheckpointConfig
) {
  const now = Date.now();
  const selectedFlint = normalizeFlintType(config.selectedFlint);
  const durationMs = getCheckpointDurationMs(selectedFlint);

  const checkpoint: CampfireBattleCheckpoint = {
    id: `campfire_${config.tier}_${config.floor}_${now}`,
    tier: config.tier,
    floor: config.floor,
    selectedFlint,
    createdAt: now,
    expiresAt: now + durationMs,
    floorRunSnapshot: cloneData<FloorRunSnapshot>(gameState.floorRun),
    playerSnapshot: {
      hp: player.hp,
      energy: player.energy,
      potions: Math.max(player.potions, MAX_POTION_COUNT),
    },
  };

  writeCheckpointToStorage(checkpoint);

  return checkpoint;
}

export function restoreCampfireBattleCheckpoint(): RestoreCampfireBattleCheckpointResult {
  const checkpoint = getActiveCampfireBattleCheckpoint();

  if (!checkpoint) {
    return {
      success: false,
      message: 'Активного костра больше нет или его время уже истекло.',
    };
  }

  gameState.floorRun = cloneData<FloorRunSnapshot>(checkpoint.floorRunSnapshot);

  const stats = getPlayerStats(player);

  player.hp = stats.maxHp;
  player.energy = stats.maxEnergy;
  player.potions = Math.max(
    checkpoint.playerSnapshot?.potions ?? 0,
    MAX_POTION_COUNT
  );

  return {
    success: true,
    message: `Ты вернулся к костру на этаже ${checkpoint.floor}.`,
    checkpoint,
  };
}
