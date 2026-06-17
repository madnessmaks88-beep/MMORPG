import Phaser from 'phaser';

import { player } from '../data/player';
import { getRandomLootItem } from '../data/items';
import { gameState } from '../data/gameState';

import { addExperience, createLevelUpText } from './LevelSystem';
import {
  addItemToInventory,
  getRarityText,
  getRewardExpAmount,
  getRewardGoldAmount,
  rollItemDrop,
} from './InventorySystem';

import { trackGoldEarned, trackItemObtainedByRarity } from './QuestSystem';

function addRunItemsEarned(amount: number) {
  if (amount <= 0 || !gameState.floorRun.active) {
    return;
  }

  const run = gameState.floorRun as typeof gameState.floorRun & {
    itemsEarned?: number;
  };

  run.itemsEarned = (run.itemsEarned ?? 0) + amount;
}

export type FloorRewardResult = {
  gold: number;
  exp: number;
  itemText: string;
  potionText: string;
  levelText: string;
  fullText: string;
};

export function giveFloorReward(floor: number): FloorRewardResult {
  const isTierBossFloor = floor % 25 === 0;
  const isMilestoneFloor = floor % 5 === 0;

  let goldMin = 8 + floor * 2;
  let goldMax = 16 + floor * 3;
  let exp = 6 + Math.floor(floor * 1.5);
  let itemChance = 0.18;

  const modifier = gameState.floorRun.modifier;
  
  if (modifier === 'treasure') {
    goldMin += 20;
    goldMax += 35;
    itemChance += 0.2;
  }
  
  if (modifier === 'elite') {
    exp += 18;
    itemChance += 0.1;
  }
  
  if (modifier === 'traps') {
    goldMin += 10;
    goldMax += 18;
  }
  
  if (modifier === 'cursed') {
    goldMin += 35;
    goldMax += 55;
    exp += 25;
    itemChance += 0.18;
  }

  if (isMilestoneFloor) {
    goldMin += 18;
    goldMax += 30;
    exp += 14;
    itemChance += 0.12;
  }

  if (isTierBossFloor) {
    goldMin += 120;
    goldMax += 180;
    exp += 100;
    itemChance = 1;
  }

  const gold = getRewardGoldAmount(player, Phaser.Math.Between(goldMin, goldMax));

  player.gold += gold;
  trackGoldEarned(gold);

	gameState.floorRun.goldEarned += gold;

  const finalExp = getRewardExpAmount(player, exp);
  const expResult = addExperience(player, finalExp);

	gameState.floorRun.expEarned += finalExp;

  let itemText = '';

  if (rollItemDrop(player, itemChance)) {
    const item = getRandomLootItem({ floor });

    addItemToInventory(player, item.id);
    trackItemObtainedByRarity(item.rarity);
    addRunItemsEarned(1);

    itemText = `\nПредмет: ${item.name} (${getRarityText(item)})`;
  }

  let potionText = '';

  if (isTierBossFloor) {
    player.potions += 2;
    potionText = '\nЗелья: +2';
  }

  let levelText = '';

  if (expResult.leveledUp) {
    levelText = `\n\n${createLevelUpText(expResult)}`;
  }

  const fullText =
    `Награда за зачистку этажа ${floor}:\n` +
    `Золото: +${gold}\n` +
    `Опыт: +${finalExp}` +
    `${itemText}` +
    `${potionText}` +
    `${levelText}`;

  return {
    gold,
    exp: finalExp,
    itemText,
    potionText,
    levelText,
    fullText,
  };
}