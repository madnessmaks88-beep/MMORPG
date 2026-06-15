import { gameState } from '../data/gameState';
import { quests, DAILY_QUEST_RESET_MS, WEEKLY_QUEST_RESET_MS } from '../data/quests';
import type { QuestData, QuestGroup, QuestType } from '../data/quests';
import { player } from '../data/player';
import { items, type ItemData, type ItemRarity } from '../data/items';
import type { MaterialId } from '../data/materials';

import { addExperience, createLevelUpText } from './LevelSystem';
import { addMaterialsPack, createMaterialsText } from './MaterialSystem';
import { addItemToInventory, getRarityText } from './InventorySystem';

export type QuestStatus =
  | 'claimable'
  | 'active'
  | 'cooldown'
  | 'claimed';

type QuestProgressRuntime = typeof gameState.questProgress & {
  roomsCompleted?: number;
  trapsTriggered?: number;
  floorsCleared?: number;
  elitesKilled?: number;
  bossesKilled?: number;
  campfiresUsed?: number;
  materialsCollected?: number;
  weaponUpgrades?: number;
  rareItemsObtained?: number;
  morveinKilled?: number;
  highestReachedFloor?: number;
  relicsCollected?: number;

  claimedAtByQuestId?: Record<string, number>;
  progressBaselineByQuestId?: Record<string, number>;
};

type QuestRewardPlayer = typeof player & {
  shopRefreshCoupons?: number;
  characterTreePoints?: number;
};

export type ClaimQuestRewardResult = {
  success: boolean;
  title: string;
  message: string;
};

function getRuntimeProgress() {
  const progress = gameState.questProgress as QuestProgressRuntime;

  progress.enemiesKilled ??= 0;
  progress.chestsOpened ??= 0;
  progress.dungeonsCompleted ??= 0;
  progress.goldEarned ??= 0;
  progress.claimedQuestIds ??= [];

  progress.roomsCompleted ??= 0;
  progress.trapsTriggered ??= 0;
  progress.floorsCleared ??= 0;
  progress.elitesKilled ??= 0;
  progress.bossesKilled ??= 0;
  progress.campfiresUsed ??= 0;
  progress.materialsCollected ??= 0;
  progress.weaponUpgrades ??= 0;
  progress.rareItemsObtained ??= 0;
  progress.morveinKilled ??= 0;
  progress.highestReachedFloor ??= gameState.highestClearedFloor ?? 0;
  progress.relicsCollected ??= player.relicIds?.length ?? 0;

  progress.claimedAtByQuestId ??= {};
  progress.progressBaselineByQuestId ??= {};

  return progress;
}

function getQuestById(questId: string) {
  return quests.find(quest => quest.id === questId);
}

function getQuestCooldownMs(group: QuestGroup) {
  if (group === 'daily') return DAILY_QUEST_RESET_MS;
  if (group === 'weekly') return WEEKLY_QUEST_RESET_MS;
  return Number.POSITIVE_INFINITY;
}

function getQuestClaimedAt(questId: string) {
  const progress = getRuntimeProgress();

  return progress.claimedAtByQuestId?.[questId] ?? 0;
}

function getQuestBaseline(questId: string) {
  const progress = getRuntimeProgress();

  return progress.progressBaselineByQuestId?.[questId] ?? 0;
}

function removeClaimedMarker(questId: string) {
  const progress = getRuntimeProgress();

  progress.claimedQuestIds = progress.claimedQuestIds.filter(id => id !== questId);

  if (progress.claimedAtByQuestId) {
    delete progress.claimedAtByQuestId[questId];
  }
}

function refreshTimedQuestState() {
  const progress = getRuntimeProgress();
  const now = Date.now();

  Object.entries(progress.claimedAtByQuestId ?? {}).forEach(([questId, claimedAt]) => {
    const quest = getQuestById(questId);

    if (!quest) {
      removeClaimedMarker(questId);
      return;
    }

    if (quest.group === 'special') {
      return;
    }

    const cooldownMs = getQuestCooldownMs(quest.group);

    if (now - claimedAt >= cooldownMs) {
      removeClaimedMarker(questId);
    }
  });
}

function getRawQuestProgressValue(quest: QuestData): number {
  const progress = getRuntimeProgress();

  if (quest.type === 'kill_enemies') return progress.enemiesKilled;
  if (quest.type === 'kill_elites') return progress.elitesKilled ?? 0;
  if (quest.type === 'kill_bosses') return progress.bossesKilled ?? 0;
  if (quest.type === 'open_chests') return progress.chestsOpened;
  if (quest.type === 'complete_rooms') return progress.roomsCompleted ?? 0;
  if (quest.type === 'clear_floors') return progress.floorsCleared ?? 0;
  if (quest.type === 'trigger_traps') return progress.trapsTriggered ?? 0;
  if (quest.type === 'use_campfires') return progress.campfiresUsed ?? 0;
  if (quest.type === 'complete_dungeons') return progress.dungeonsCompleted;
  if (quest.type === 'earn_gold') return progress.goldEarned;
  if (quest.type === 'collect_materials') return progress.materialsCollected ?? 0;
  if (quest.type === 'upgrade_weapon') return progress.weaponUpgrades ?? 0;
  if (quest.type === 'obtain_rare_items') return progress.rareItemsObtained ?? 0;
  if (quest.type === 'defeat_morvein') return progress.morveinKilled ?? 0;

  if (quest.type === 'reach_floor') {
    return Math.max(progress.highestReachedFloor ?? 0, gameState.highestClearedFloor ?? 0);
  }

  if (quest.type === 'collect_relics') {
    return Math.max(progress.relicsCollected ?? 0, player.relicIds?.length ?? 0);
  }

  return 0;
}

function getPeriodQuestProgressValue(quest: QuestData) {
  if (quest.group === 'special') {
    return getRawQuestProgressValue(quest);
  }

  const raw = getRawQuestProgressValue(quest);
  const baseline = getQuestBaseline(quest.id);

  return Math.max(0, raw - baseline);
}

export function trackEnemyKilled(options?: {
  elite?: boolean;
  boss?: boolean;
  morvein?: boolean;
}) {
  const progress = getRuntimeProgress();

  progress.enemiesKilled += 1;
  progress.roomsCompleted = (progress.roomsCompleted ?? 0) + 1;

  if (options?.elite) {
    progress.elitesKilled = (progress.elitesKilled ?? 0) + 1;
  }

  if (options?.boss) {
    progress.bossesKilled = (progress.bossesKilled ?? 0) + 1;
  }

  if (options?.morvein) {
    progress.morveinKilled = (progress.morveinKilled ?? 0) + 1;
  }
}

export function trackEliteKilled() {
  trackEnemyKilled({ elite: true });
}

export function trackBossKilled(options?: { morvein?: boolean }) {
  trackEnemyKilled({ boss: true, morvein: options?.morvein });
}

export function trackChestOpened() {
  const progress = getRuntimeProgress();

  progress.chestsOpened += 1;
  progress.roomsCompleted = (progress.roomsCompleted ?? 0) + 1;
}

export function trackTrapTriggered() {
  const progress = getRuntimeProgress();

  progress.trapsTriggered = (progress.trapsTriggered ?? 0) + 1;
  progress.roomsCompleted = (progress.roomsCompleted ?? 0) + 1;
}

export function trackRoomCompleted() {
  const progress = getRuntimeProgress();

  progress.roomsCompleted = (progress.roomsCompleted ?? 0) + 1;
}

export function trackFloorCleared(floor?: number) {
  const progress = getRuntimeProgress();

  progress.floorsCleared = (progress.floorsCleared ?? 0) + 1;

  if (typeof floor === 'number') {
    progress.highestReachedFloor = Math.max(progress.highestReachedFloor ?? 0, floor);
  }
}

export function trackCampfireUsed() {
  const progress = getRuntimeProgress();

  progress.campfiresUsed = (progress.campfiresUsed ?? 0) + 1;
}

export function trackDungeonCompleted() {
  const progress = getRuntimeProgress();

  progress.dungeonsCompleted += 1;
}

export function trackGoldEarned(amount: number) {
  const progress = getRuntimeProgress();

  progress.goldEarned += Math.max(0, Math.floor(amount));
}

export function trackMaterialsCollected(amount: number) {
  const progress = getRuntimeProgress();

  progress.materialsCollected = (progress.materialsCollected ?? 0) + Math.max(0, Math.floor(amount));
}

export function trackWeaponUpgraded() {
  const progress = getRuntimeProgress();

  progress.weaponUpgrades = (progress.weaponUpgrades ?? 0) + 1;
}

export function trackRareItemObtained(amount = 1) {
  const progress = getRuntimeProgress();

  progress.rareItemsObtained = (progress.rareItemsObtained ?? 0) + Math.max(0, Math.floor(amount));
}

export function trackRelicCollected() {
  const progress = getRuntimeProgress();

  progress.relicsCollected = Math.max(
    (progress.relicsCollected ?? 0) + 1,
    player.relicIds?.length ?? 0
  );
}

export function trackHighestReachedFloor(floor: number) {
  const progress = getRuntimeProgress();

  progress.highestReachedFloor = Math.max(progress.highestReachedFloor ?? 0, floor);
}

export function getQuestProgressValue(quest: QuestData): number {
  refreshTimedQuestState();

  return Math.min(quest.target, Math.max(0, getPeriodQuestProgressValue(quest)));
}

export function getQuestDisplayProgressValue(quest: QuestData): number {
  const status = getQuestStatus(quest);

  if (status === 'cooldown' || status === 'claimed') {
    return quest.target;
  }

  return getQuestProgressValue(quest);
}

export function isQuestCompleted(quest: QuestData): boolean {
  return getQuestProgressValue(quest) >= quest.target;
}

export function isQuestClaimed(questId: string): boolean {
  refreshTimedQuestState();

  const progress = getRuntimeProgress();
  const quest = getQuestById(questId);

  if (!quest) {
    return progress.claimedQuestIds.includes(questId);
  }

  if (quest.group === 'special') {
    return progress.claimedQuestIds.includes(questId);
  }

  return Boolean(progress.claimedAtByQuestId?.[questId]);
}

export function getQuestStatus(quest: QuestData): QuestStatus {
  refreshTimedQuestState();

  if (isQuestClaimed(quest.id)) {
    return quest.group === 'special' ? 'claimed' : 'cooldown';
  }

  if (isQuestCompleted(quest)) {
    return 'claimable';
  }

  return 'active';
}

export function getQuestStatusRank(quest: QuestData) {
  const status = getQuestStatus(quest);

  if (status === 'claimable') return 0;
  if (status === 'active') return 1;
  if (status === 'cooldown') return 2;
  return 3;
}

export function getQuestCooldownText(quest: QuestData) {
  const claimedAt = getQuestClaimedAt(quest.id);

  if (!claimedAt || quest.group === 'special') {
    return '';
  }

  const cooldownMs = getQuestCooldownMs(quest.group);
  const timeLeft = claimedAt + cooldownMs - Date.now();

  if (timeLeft <= 0) {
    return 'Скоро обновится';
  }

  return formatDuration(timeLeft);
}

export function getQuestRewardText(quest: QuestData) {
  const parts: string[] = [];

  if (quest.rewardGold > 0) {
    parts.push(`${quest.rewardGold} золота`);
  }

  if ((quest.rewardExp ?? 0) > 0) {
    parts.push(`${quest.rewardExp} опыта`);
  }

  if ((quest.rewardPotions ?? 0) > 0) {
    parts.push(`${quest.rewardPotions} зелья`);
  }

  quest.rewardMaterials?.forEach(material => {
    parts.push(`${material.amount} ${getMaterialLabel(material.id)}`);
  });

  if ((quest.rewardShopCoupons ?? 0) > 0) {
    parts.push(`${quest.rewardShopCoupons} куп. лавки`);
  }

  if ((quest.rewardTreePoints ?? 0) > 0) {
    parts.push(`${quest.rewardTreePoints} очк. древа`);
  }

  if (quest.rewardGuaranteedRarity) {
    parts.push(`предмет: ${getRarityLabel(quest.rewardGuaranteedRarity)}`);
  }

  if (quest.rewardItemChance) {
    parts.push(`шанс ${Math.round(quest.rewardItemChance.chance * 100)}%: ${getRarityLabel(quest.rewardItemChance.rarity)}`);
  }

  return parts.length > 0 ? parts.join(' • ') : 'Без награды';
}

export function claimQuestReward(questId: string): ClaimQuestRewardResult {
  refreshTimedQuestState();

  const quest = quests.find(item => item.id === questId);

  if (!quest) {
    return {
      success: false,
      title: 'Задание не найдено',
      message: 'Это поручение не найдено в списке заданий.',
    };
  }

  if (isQuestClaimed(quest.id)) {
    return {
      success: false,
      title: 'Награда уже получена',
      message: quest.group === 'special'
        ? 'Особое задание уже закрыто навсегда.'
        : `Задание временно неактивно. Обновление через ${getQuestCooldownText(quest)}.`,
    };
  }

  if (!isQuestCompleted(quest)) {
    return {
      success: false,
      title: 'Задание не выполнено',
      message: `Прогресс: ${getQuestProgressValue(quest)}/${quest.target}.`,
    };
  }

  const rewardLines: string[] = [];

  if (quest.rewardGold > 0) {
    player.gold += quest.rewardGold;
    rewardLines.push(`Золото: +${quest.rewardGold}`);
  }

  if ((quest.rewardPotions ?? 0) > 0) {
    player.potions += quest.rewardPotions ?? 0;
    rewardLines.push(`Зелья: +${quest.rewardPotions}`);
  }

  if (quest.rewardMaterials && quest.rewardMaterials.length > 0) {
    addMaterialsPack(quest.rewardMaterials);
    trackMaterialsCollected(quest.rewardMaterials.reduce((sum, material) => sum + material.amount, 0));
    rewardLines.push(createMaterialsText(quest.rewardMaterials));
  }

  if ((quest.rewardShopCoupons ?? 0) > 0) {
    const rewardPlayer = player as QuestRewardPlayer;

    rewardPlayer.shopRefreshCoupons = (rewardPlayer.shopRefreshCoupons ?? 0) + (quest.rewardShopCoupons ?? 0);
    rewardLines.push(`Купоны лавки: +${quest.rewardShopCoupons}`);
  }

  if ((quest.rewardTreePoints ?? 0) > 0) {
    const rewardPlayer = player as QuestRewardPlayer;

    rewardPlayer.characterTreePoints = (rewardPlayer.characterTreePoints ?? 0) + (quest.rewardTreePoints ?? 0);
    rewardLines.push(`Очки древа: +${quest.rewardTreePoints}`);
  }

  if ((quest.rewardExp ?? 0) > 0) {
    const levelResult = addExperience(player, quest.rewardExp ?? 0);
    const levelText = createLevelUpText(levelResult);
    rewardLines.push(`Опыт: +${quest.rewardExp}${levelText}`);
  }

  const guaranteedItem = quest.rewardGuaranteedRarity
    ? giveRandomItemByRarity(quest.rewardGuaranteedRarity)
    : undefined;

  if (guaranteedItem) {
    rewardLines.push(`Предмет: ${guaranteedItem.name} (${getRarityText(guaranteedItem)})`);
  }

  if (quest.rewardItemChance && Math.random() < quest.rewardItemChance.chance) {
    const chanceItem = giveRandomItemByRarity(quest.rewardItemChance.rarity);

    if (chanceItem) {
      rewardLines.push(`Доп. предмет: ${chanceItem.name} (${getRarityText(chanceItem)})`);
    }
  }

  markQuestClaimed(quest);

  return {
    success: true,
    title: 'Награда получена',
    message: rewardLines.length > 0
      ? rewardLines.join('\n')
      : 'Награда успешно получена.',
  };
}

function markQuestClaimed(quest: QuestData) {
  const progress = getRuntimeProgress();

  if (!progress.claimedQuestIds.includes(quest.id)) {
    progress.claimedQuestIds.push(quest.id);
  }

  progress.claimedAtByQuestId ??= {};
  progress.progressBaselineByQuestId ??= {};

  progress.claimedAtByQuestId[quest.id] = Date.now();
  progress.progressBaselineByQuestId[quest.id] = getRawQuestProgressValue(quest);
}

function giveRandomItemByRarity(rarity: ItemRarity): ItemData | undefined {
  const possibleItems = items.filter(item => item.rarity === rarity);

  if (possibleItems.length === 0) {
    return undefined;
  }

  const item = possibleItems[Math.floor(Math.random() * possibleItems.length)];

  addItemToInventory(player, item.id);

  if (item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary' || item.rarity === 'mythic') {
    trackRareItemObtained(1);
  }

  return item;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days} д. ${hours} ч.`;
  }

  if (hours > 0) {
    return `${hours} ч. ${minutes} мин.`;
  }

  return `${Math.max(1, minutes)} мин.`;
}

function getMaterialLabel(id: MaterialId) {
  if (id === 'darkened_bone') return 'потемневшие кости';
  if (id === 'dim_gem') return 'тусклые самоцветы';
  if (id === 'old_leather') return 'старая кожа';
  if (id === 'dark_flame_heart') return 'сердца тёмного пламени';
  if (id === 'black_gem') return 'чёрные самоцветы';
  if (id === 'cursed_seal') return 'проклятые печати';
  if (id === 'black_sarcophagus_shard') return 'осколки чёрного саркофага';

  return id;
}

function getRarityLabel(rarity: ItemRarity) {
  if (rarity === 'common') return 'обычный предмет';
  if (rarity === 'rare') return 'редкий предмет';
  if (rarity === 'epic') return 'эпический предмет';
  if (rarity === 'legendary') return 'легендарный предмет';
  if (rarity === 'mythic') return 'мифический предмет';

  return 'предмет';
}

export function getQuests(group?: QuestGroup) {
  refreshTimedQuestState();

  const list = group ? quests.filter(quest => quest.group === group) : [...quests];

  return list.sort((a, b) => {
    const statusDiff = getQuestStatusRank(a) - getQuestStatusRank(b);

    if (statusDiff !== 0) {
      return statusDiff;
    }

    const progressA = getQuestProgressValue(a) / Math.max(1, a.target);
    const progressB = getQuestProgressValue(b) / Math.max(1, b.target);

    if (progressA !== progressB) {
      return progressB - progressA;
    }

    return a.title.localeCompare(b.title);
  });
}

export function getQuestTypeLabel(type: QuestType) {
  if (type === 'kill_enemies') return 'Враги';
  if (type === 'kill_elites') return 'Элита';
  if (type === 'kill_bosses') return 'Боссы';
  if (type === 'open_chests') return 'Сундуки';
  if (type === 'complete_rooms') return 'Комнаты';
  if (type === 'clear_floors') return 'Этажи';
  if (type === 'trigger_traps') return 'Ловушки';
  if (type === 'use_campfires') return 'Костры';
  if (type === 'complete_dungeons') return 'Подземелья';
  if (type === 'earn_gold') return 'Золото';
  if (type === 'collect_materials') return 'Материалы';
  if (type === 'upgrade_weapon') return 'Кузница';
  if (type === 'obtain_rare_items') return 'Трофеи';
  if (type === 'defeat_morvein') return 'Морвеин';
  if (type === 'reach_floor') return 'Глубина';
  if (type === 'collect_relics') return 'Реликвии';

  return 'Прогресс';
}
