import Phaser from 'phaser';

import type { PlayerData } from '../data/player';
import type { EnemyData } from '../data/enemies';
import { getPlayerStats } from './InventorySystem';

export type PlayerActionResult = {
  damage: number;
  isCrit: boolean;
  enemyDead: boolean;
  healAmount?: number;
};

export type EnemyActionResult = {
  damage: number;
  playerDead: boolean;
};

export function calculateDamage(attack: number, defense: number): number {
  const randomBonus = Phaser.Math.Between(-2, 3);
  const rawDamage = attack - defense + randomBonus;

  return Math.max(1, rawDamage);
}

export function isCriticalHit(chance: number): boolean {
  return Math.random() < chance;
}

export function restoreEnergy(player: PlayerData, amount = 1) {
  const stats = getPlayerStats(player);
  const before = player.energy;

  player.energy = Math.min(stats.maxEnergy, player.energy + amount);

  return Math.max(0, player.energy - before);
}

export function playerAttack(player: PlayerData, enemy: EnemyData): PlayerActionResult {
  const stats = getPlayerStats(player);

  let damage = calculateDamage(stats.attack, enemy.defense);
  const isCrit = isCriticalHit(stats.critChance);

  if (isCrit) {
    damage *= 2;
  }

  enemy.hp = Math.max(0, enemy.hp - damage);

  return {
    damage,
    isCrit,
    enemyDead: enemy.hp <= 0,
  };
}

export function playerPowerAttack(player: PlayerData, enemy: EnemyData): PlayerActionResult {
  const stats = getPlayerStats(player);

  let damage = Math.floor(calculateDamage(stats.attack, enemy.defense) * 1.7);
  const isCrit = isCriticalHit(stats.critChance + 0.05);

  if (isCrit) {
    damage *= 2;
  }

  enemy.hp = Math.max(0, enemy.hp - damage);

  return {
    damage,
    isCrit,
    enemyDead: enemy.hp <= 0,
  };
}

export function playerBloodStrike(player: PlayerData, enemy: EnemyData): PlayerActionResult {
  const stats = getPlayerStats(player);

  let damage = Math.floor(calculateDamage(stats.attack, enemy.defense) * 1.2);
  const isCrit = isCriticalHit(stats.critChance);

  if (isCrit) {
    damage *= 2;
  }

  enemy.hp = Math.max(0, enemy.hp - damage);

  const healAmount = Math.max(3, Math.floor(damage * 0.35));
  const playerStats = getPlayerStats(player);

  player.hp = Math.min(playerStats.maxHp, player.hp + healAmount);

  return {
    damage,
    isCrit,
    enemyDead: enemy.hp <= 0,
    healAmount,
  };
}

export function enemyAttack(
  enemy: EnemyData,
  player: PlayerData,
  isDefending = false
): EnemyActionResult & { dodged: boolean } {
  const stats = getPlayerStats(player);

  if (Math.random() < stats.dodgeChance) {
    return {
      damage: 0,
      playerDead: false,
      dodged: true,
    };
  }

  let damage = calculateDamage(enemy.attack, stats.defense);

  if (isDefending) {
    damage = Math.max(1, Math.floor(damage * 0.45));
  }

  player.hp = Math.max(0, player.hp - damage);

  return {
    damage,
    playerDead: player.hp <= 0,
    dodged: false,
  };
}

export function useHealingPotion(player: PlayerData): number {
  if (player.potions <= 0) {
    return 0;
  }

  const stats = getPlayerStats(player);
  const healAmount = Math.floor(stats.maxHp * 0.45);

  player.potions -= 1;
  player.hp = Math.min(stats.maxHp, player.hp + healAmount);

  return healAmount;
}