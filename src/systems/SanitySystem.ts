import { player } from '../data/player';
import { gameState, type FloorRun } from '../data/gameState';

export const MAX_SANITY = 500;
export const STARTING_SANITY = 500;
export const SANITY_RESTORE_INTERVAL_MS = 60_000;
export const SANITY_COST_PER_FLOOR = 20;

type SanityFloorRun = FloorRun & {
  sanityChargedForFloor?: number;
};

export function normalizeSanityFields(now = Date.now()): boolean {
  let changed = false;

  if (typeof player.maxSanity !== 'number' || !Number.isFinite(player.maxSanity) || player.maxSanity <= 0) {
    player.maxSanity = MAX_SANITY;
    changed = true;
  }

  if (typeof player.sanity !== 'number' || !Number.isFinite(player.sanity)) {
    player.sanity = player.maxSanity;
    changed = true;
  }

  const clampedSanity = Math.max(0, Math.min(player.maxSanity, Math.floor(player.sanity)));

  if (player.sanity !== clampedSanity) {
    player.sanity = clampedSanity;
    changed = true;
  }

  if (typeof player.sanityUpdatedAt !== 'number' || !Number.isFinite(player.sanityUpdatedAt) || player.sanityUpdatedAt <= 0) {
    player.sanityUpdatedAt = now;
    changed = true;
  }

  return changed;
}

export function restoreSanityByTime(now = Date.now()): boolean {
  let changed = normalizeSanityFields(now);

  if (player.sanity >= player.maxSanity) {
    if (player.sanityUpdatedAt !== now) {
      player.sanityUpdatedAt = now;
      changed = true;
    }

    return changed;
  }

  const elapsedMs = Math.max(0, now - player.sanityUpdatedAt);
  const restored = Math.floor(elapsedMs / SANITY_RESTORE_INTERVAL_MS);

  if (restored <= 0) {
    return changed;
  }

  player.sanity = Math.min(player.maxSanity, player.sanity + restored);

  if (player.sanity >= player.maxSanity) {
    player.sanity = player.maxSanity;
    player.sanityUpdatedAt = now;
  } else {
    player.sanityUpdatedAt += restored * SANITY_RESTORE_INTERVAL_MS;
  }

  return true;
}

export function getSanityTimeToFullMs(now = Date.now()): number {
  restoreSanityByTime(now);

  if (player.sanity >= player.maxSanity) {
    return 0;
  }

  return Math.max(0, (player.maxSanity - player.sanity) * SANITY_RESTORE_INTERVAL_MS);
}

export function hasEnoughSanityForFloor(now = Date.now()): boolean {
  restoreSanityByTime(now);

  return player.sanity >= SANITY_COST_PER_FLOOR;
}

export function consumeSanityForCompletedFloor(floor: number, now = Date.now()): boolean {
  const floorRun = gameState.floorRun as SanityFloorRun;
  const normalizedFloor = Math.max(1, Math.floor(floor || gameState.floorRun.currentFloor || 1));

  if (floorRun.sanityChargedForFloor === normalizedFloor) {
    restoreSanityByTime(now);
    return false;
  }

  restoreSanityByTime(now);

  player.sanity = Math.max(0, player.sanity - SANITY_COST_PER_FLOOR);
  player.sanityUpdatedAt = now;
  floorRun.sanityChargedForFloor = normalizedFloor;

  return true;
}

export function resetSanityForNewGame(now = Date.now()): void {
  player.maxSanity = MAX_SANITY;
  player.sanity = STARTING_SANITY;
  player.sanityUpdatedAt = now;
}
