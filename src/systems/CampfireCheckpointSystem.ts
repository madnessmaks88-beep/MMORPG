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
  | 'red_ruby'
  | 'donor'
  | 'premium';

type FloorRunSnapshot = typeof gameState.floorRun;

export type CampfireStateSnapshot = {
  tier: number;
  selectedFlint: CheckpointFlintType | null;
  remainingCampfireUses: number;
  campfireFloors: number[];
  usedCampfireFloors: number[];
  selectionDone: boolean;
};

export type CampfireBattleCheckpoint = {
  id: string;
  tier: number;
  floor: number;
  selectedFlint: CheckpointFlintType;
  createdAt: number;
  expiresAt: number;
  floorRunSnapshot: FloorRunSnapshot;
  campfireStateSnapshot?: CampfireStateSnapshot;
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
  campfireStateSnapshot?: CampfireStateSnapshot;
};

type RestoreCampfireBattleCheckpointResult = {
  success: boolean;
  message: string;
  checkpoint?: CampfireBattleCheckpoint;
};

const CAMPFIRE_BATTLE_CHECKPOINT_KEY = 'below_ashes_campfire_battle_checkpoint_v1';
const CAMPFIRE_BATTLE_CHECKPOINTS_KEY = 'below_ashes_campfire_battle_checkpoints_v2';
const MAX_POTION_COUNT = 6;

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const FOREVER_CHECKPOINT_EXPIRES_AT = Number.MAX_SAFE_INTEGER;
const FOREVER_TIME_LEFT_THRESHOLD_MS = 100 * 365 * ONE_DAY_MS;

function cloneData<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeFlintType(flintType: CheckpointFlintType): CheckpointFlintType {
  if (flintType === 'ordinary' || flintType === 'regular') {
    return 'dim';
  }

  if (flintType === 'red_ruby' || flintType === 'donor' || flintType === 'premium') {
    return 'ruby';
  }

  return flintType;
}

function getCheckpointDurationMs(flintType: CheckpointFlintType) {
  const normalized = normalizeFlintType(flintType);

  if (normalized === 'black') {
    return ONE_DAY_MS;
  }

  if (normalized === 'ruby') {
    return Number.POSITIVE_INFINITY;
  }

  return ONE_HOUR_MS;
}

function readLegacyCheckpointFromStorage(): CampfireBattleCheckpoint | null {
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

function readCheckpointsFromStorage(): CampfireBattleCheckpoint[] {
  const raw = localStorage.getItem(CAMPFIRE_BATTLE_CHECKPOINTS_KEY);

  if (!raw) {
    const legacy = readLegacyCheckpointFromStorage();
    return legacy ? [legacy] : [];
  }

  try {
    const parsed = JSON.parse(raw) as CampfireBattleCheckpoint[] | CampfireBattleCheckpoint;

    if (Array.isArray(parsed)) {
      return parsed;
    }

    return parsed ? [parsed] : [];
  } catch {
    localStorage.removeItem(CAMPFIRE_BATTLE_CHECKPOINTS_KEY);
    const legacy = readLegacyCheckpointFromStorage();
    return legacy ? [legacy] : [];
  }
}

function writeCheckpointsToStorage(checkpoints: CampfireBattleCheckpoint[]) {
  const active = checkpoints
    .filter(checkpoint => checkpoint.expiresAt > Date.now())
    .sort((a, b) => a.createdAt - b.createdAt);

  localStorage.setItem(CAMPFIRE_BATTLE_CHECKPOINTS_KEY, JSON.stringify(active));

  const latest = active[active.length - 1];

  if (latest) {
    localStorage.setItem(CAMPFIRE_BATTLE_CHECKPOINT_KEY, JSON.stringify(latest));
  } else {
    localStorage.removeItem(CAMPFIRE_BATTLE_CHECKPOINT_KEY);
  }
}

function getActiveCheckpoints() {
  const active = readCheckpointsFromStorage()
    .filter(checkpoint => checkpoint.expiresAt > Date.now())
    .sort((a, b) => a.createdAt - b.createdAt);

  writeCheckpointsToStorage(active);

  return active;
}

export function clearCampfireBattleCheckpoint() {
  localStorage.removeItem(CAMPFIRE_BATTLE_CHECKPOINT_KEY);
  localStorage.removeItem(CAMPFIRE_BATTLE_CHECKPOINTS_KEY);
}

export function formatCheckpointTimeLeft(ms: number) {
  if (!Number.isFinite(ms) || ms >= FOREVER_TIME_LEFT_THRESHOLD_MS) {
    return 'навсегда';
  }

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
  return getActiveCampfireBattleCheckpoint();
}

export function getActiveCampfireBattleCheckpoints() {
  return getActiveCheckpoints();
}

export function getActiveCampfireBattleCheckpoint() {
  const active = getActiveCheckpoints();

  return active[active.length - 1] ?? null;
}

export function getActiveCampfireBattleCheckpointById(checkpointId: string) {
  return getActiveCheckpoints().find(checkpoint => checkpoint.id === checkpointId) ?? null;
}

export function getActiveCampfireBattleCheckpointByFloor(floor: number) {
  return getActiveCheckpoints().find(checkpoint => checkpoint.floor === floor) ?? null;
}

export function createCampfireBattleCheckpoint(
  config: CreateCampfireBattleCheckpointConfig
) {
  const now = Date.now();
  const selectedFlint = normalizeFlintType(config.selectedFlint);
  const durationMs = getCheckpointDurationMs(selectedFlint);
  const expiresAt = Number.isFinite(durationMs)
    ? now + durationMs
    : FOREVER_CHECKPOINT_EXPIRES_AT;

  const checkpoint: CampfireBattleCheckpoint = {
    id: `campfire_${config.tier}_${config.floor}_${now}`,
    tier: config.tier,
    floor: config.floor,
    selectedFlint,
    createdAt: now,
    expiresAt,
    floorRunSnapshot: cloneData<FloorRunSnapshot>(gameState.floorRun),
    campfireStateSnapshot: config.campfireStateSnapshot
      ? cloneData<CampfireStateSnapshot>(config.campfireStateSnapshot)
      : undefined,
    playerSnapshot: {
      hp: Math.max(player.hp, getPlayerStats(player).maxHp),
      energy: Math.max(player.energy, getPlayerStats(player).maxEnergy),
      potions: Math.max(player.potions, MAX_POTION_COUNT),
    },
  };

  const previous = getActiveCheckpoints()
    .filter(item => !(item.tier === checkpoint.tier && item.floor === checkpoint.floor));

  previous.push(checkpoint);
  writeCheckpointsToStorage(previous);

  return checkpoint;
}

export function restoreCampfireBattleCheckpoint(checkpointId?: string): RestoreCampfireBattleCheckpointResult {
  const active = getActiveCheckpoints();
  const checkpoint = checkpointId
    ? active.find(item => item.id === checkpointId)
    : active[active.length - 1];

  if (!checkpoint) {
    return {
      success: false,
      message: 'Активного костра больше нет или его время уже истекло.',
    };
  }

  gameState.floorRun = cloneData<FloorRunSnapshot>(checkpoint.floorRunSnapshot);

  if (checkpoint.campfireStateSnapshot) {
    const stateOwner = gameState as typeof gameState & {
      dungeonCampfireState?: CampfireStateSnapshot;
    };

    stateOwner.dungeonCampfireState = cloneData<CampfireStateSnapshot>(checkpoint.campfireStateSnapshot);
    stateOwner.dungeonCampfireState.selectionDone = true;
  }

  const stats = getPlayerStats(player);

  player.hp = stats.maxHp;
  player.energy = stats.maxEnergy;
  player.potions = MAX_POTION_COUNT;

  return {
    success: true,
    message: `Ты вернулся к костру на этаже ${checkpoint.floor}. HP, энергия и зелья восстановлены полностью.`,
    checkpoint,
  };
}
