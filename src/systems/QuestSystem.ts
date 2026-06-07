import { gameState } from '../data/gameState';
import { quests } from '../data/quests';
import type { QuestData } from '../data/quests';
import { player } from '../data/player';
import { addExperience, createLevelUpText } from './LevelSystem';

export function trackEnemyKilled() {
  gameState.questProgress.enemiesKilled += 1;
}

export function trackChestOpened() {
  gameState.questProgress.chestsOpened += 1;
}

export function trackDungeonCompleted() {
  gameState.questProgress.dungeonsCompleted += 1;
}

export function trackGoldEarned(amount: number) {
  gameState.questProgress.goldEarned += amount;
}

export function getQuestProgressValue(quest: QuestData): number {
  if (quest.type === 'kill_enemies') {
    return gameState.questProgress.enemiesKilled;
  }

  if (quest.type === 'open_chests') {
    return gameState.questProgress.chestsOpened;
  }

  if (quest.type === 'complete_dungeons') {
    return gameState.questProgress.dungeonsCompleted;
  }

  if (quest.type === 'earn_gold') {
    return gameState.questProgress.goldEarned;
  }

  return 0;
}

export function isQuestCompleted(quest: QuestData): boolean {
  return getQuestProgressValue(quest) >= quest.target;
}

export function isQuestClaimed(questId: string): boolean {
  return gameState.questProgress.claimedQuestIds.includes(questId);
}

export function claimQuestReward(questId: string): string {
  const quest = quests.find(item => item.id === questId);

  if (!quest) {
    return 'Задание не найдено.';
  }

  if (isQuestClaimed(quest.id)) {
    return 'Награда уже получена.';
  }

  if (!isQuestCompleted(quest)) {
    return 'Задание ещё не выполнено.';
  }

  player.gold += quest.rewardGold;
  player.potions += quest.rewardPotions ?? 0;

  const levelResult = addExperience(player, quest.rewardExp);
  const levelText = createLevelUpText(levelResult);

  gameState.questProgress.claimedQuestIds.push(quest.id);

  return `Награда получена!

Золото: +${quest.rewardGold}
Опыт: +${quest.rewardExp}
Зелья: +${quest.rewardPotions ?? 0}${levelText}`;
}