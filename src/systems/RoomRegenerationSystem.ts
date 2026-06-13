import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getPlayerStats } from './InventorySystem';

type RegenerationFloorRun = typeof gameState.floorRun & {
  roomRegenerationBlocked?: boolean;
};

type RoomRegenerationResult = {
  healed: number;
  blocked: boolean;
  text: string;
};

const ROOM_REGEN_PERCENT = 0.03;

function getRunWithRegenerationFlag() {
  return gameState.floorRun as RegenerationFloorRun;
}

export function isRoomRegenerationBlocked() {
  return Boolean(getRunWithRegenerationFlag().roomRegenerationBlocked);
}

export function blockRoomRegenerationUntilFloorEnd() {
  getRunWithRegenerationFlag().roomRegenerationBlocked = true;
}

export function clearRoomRegenerationBlock() {
  delete getRunWithRegenerationFlag().roomRegenerationBlocked;
}

export function applyRoomRegeneration(): RoomRegenerationResult {
  if (isRoomRegenerationBlocked()) {
    return {
      healed: 0,
      blocked: true,
      text: '',
    };
  }

  const stats = getPlayerStats(player);

  if (player.hp <= 0 || player.hp >= stats.maxHp) {
    return {
      healed: 0,
      blocked: false,
      text: '',
    };
  }

  const healAmount = Math.min(
    stats.maxHp - player.hp,
    Math.max(1, Math.ceil(stats.maxHp * ROOM_REGEN_PERCENT))
  );

  player.hp = Math.min(stats.maxHp, player.hp + healAmount);

  return {
    healed: healAmount,
    blocked: false,
    text: `Регенерация между комнатами: +${healAmount} HP.`,
  };
}