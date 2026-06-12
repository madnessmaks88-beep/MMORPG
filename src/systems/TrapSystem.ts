import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getPlayerStats } from './InventorySystem';

export type TrapType = 'blade' | 'curse' | 'energy';

export type TrapResult = {
  avoided: boolean;
  trapType?: TrapType;
  damage: number;
  energyLost: number;
  text: string;
};

function getFloorInsideTier() {
  const floor = gameState.floorRun.currentFloor || 1;

  return ((floor - 1) % 25) + 1;
}

function getTrapDamage() {
  const floorInsideTier = getFloorInsideTier();

  let min = 10 + floorInsideTier;
  let max = 18 + floorInsideTier * 2;

  if (gameState.floorRun.modifier === 'traps') {
    min = Math.floor(min * 1.35);
    max = Math.floor(max * 1.35);
  }

  if (gameState.floorRun.modifier === 'cursed') {
    min = Math.floor(min * 1.5);
    max = Math.floor(max * 1.5);
  }

  return Phaser.Math.Between(min, max);
}

function rollTrapType(): TrapType {
  const roll = Math.random();

  if (roll < 0.55) {
    return 'blade';
  }

  if (roll < 0.85) {
    return 'curse';
  }

  return 'energy';
}

function getTrapName(type: TrapType) {
  if (type === 'blade') {
    return 'Костяные лезвия';
  }

  if (type === 'curse') {
    return 'Проклятая печать';
  }

  return 'Поглотитель энергии';
}

export function triggerTrapResult(): TrapResult {
  const stats = getPlayerStats(player);

  gameState.floorRun.trapsTriggered += 1;

  if (Math.random() < stats.trapDodgeChance) {
    return {
      avoided: true,
      damage: 0,
      energyLost: 0,
      text:
        `Ты заметил ловушку в последний момент.\n\n` +
        `Ловкость помогла избежать урона.`,
    };
  }

  const trapType = rollTrapType();
  const damage = getTrapDamage();

  let energyLost = 0;

  if (trapType === 'energy') {
    energyLost = Math.min(player.energy, 1);
  }

  player.hp = Math.max(0, player.hp - damage);
  player.energy = Math.max(0, player.energy - energyLost);

  const trapName = getTrapName(trapType);

  const energyText =
    energyLost > 0
      ? `\nЭнергия: -${energyLost}.`
      : '';

  const modifierText =
    gameState.floorRun.modifier === 'traps'
      ? `\n\nОсобенность этажа усилила ловушку.`
      : gameState.floorRun.modifier === 'cursed'
        ? `\n\nПроклятие этажа усилило ловушку.`
        : '';

  return {
    avoided: false,
    trapType,
    damage,
    energyLost,
    text:
      `${trapName} сработала.\n\n` +
      `Получено урона: ${damage}.` +
      energyText +
      modifierText,
  };
}