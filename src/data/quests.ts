import type { MaterialId } from './materials';
import type { ItemRarity } from './items';

export type QuestGroup = 'daily' | 'weekly' | 'special';

export type QuestType =
  | 'kill_enemies'
  | 'kill_elites'
  | 'kill_bosses'
  | 'open_chests'
  | 'complete_rooms'
  | 'clear_floors'
  | 'trigger_traps'
  | 'use_campfires'
  | 'complete_dungeons'
  | 'earn_gold'
  | 'collect_materials'
  | 'upgrade_weapon'
  | 'obtain_rare_items'
  | 'defeat_morvein'
  | 'reach_floor'
  | 'collect_relics';

export type QuestRewardMaterial = {
  id: MaterialId;
  amount: number;
};

export type QuestData = {
  id: string;
  group: QuestGroup;

  title: string;
  description: string;
  type: QuestType;
  target: number;

  rewardGold: number;
  rewardExp?: number;
  rewardPotions?: number;
  rewardMaterials?: QuestRewardMaterial[];
  rewardShopCoupons?: number;
  rewardTreePoints?: number;

  rewardGuaranteedRarity?: ItemRarity;
  rewardItemChance?: {
    rarity: ItemRarity;
    chance: number;
  };

  note?: string;
};

export const DAILY_QUEST_RESET_MS = 24 * 60 * 60 * 1000;
export const WEEKLY_QUEST_RESET_MS = 7 * 24 * 60 * 60 * 1000;

export const quests: QuestData[] = [
  {
    id: 'daily_first_descent',
    group: 'daily',
    title: 'Первый спуск',
    description: 'Заверши 3 комнаты в катакомбах.',
    type: 'complete_rooms',
    target: 3,
    rewardGold: 190,
    rewardMaterials: [
      { id: 'darkened_bone', amount: 2 },
    ],
  },
  {
    id: 'daily_bones_underfoot',
    group: 'daily',
    title: 'Кости под ногами',
    description: 'Победи 5 врагов.',
    type: 'kill_enemies',
    target: 5,
    rewardGold: 225,
    rewardMaterials: [
      { id: 'darkened_bone', amount: 3 },
    ],
  },
  {
    id: 'daily_dusty_chests',
    group: 'daily',
    title: 'Пыльные сундуки',
    description: 'Открой 2 сундука.',
    type: 'open_chests',
    target: 2,
    rewardGold: 260,
    rewardMaterials: [
      { id: 'old_leather', amount: 2 },
    ],
    rewardShopCoupons: 1,
  },
  {
    id: 'daily_careful_step',
    group: 'daily',
    title: 'Осторожный шаг',
    description: 'Пройди или обезвредь 1 ловушку.',
    type: 'trigger_traps',
    target: 1,
    rewardGold: 165,
    rewardMaterials: [
      { id: 'dim_gem', amount: 1 },
    ],
  },
  {
    id: 'daily_crypt_blood',
    group: 'daily',
    title: 'Кровь склепа',
    description: 'Победи 1 элитного врага.',
    type: 'kill_elites',
    target: 1,
    rewardGold: 340,
    rewardMaterials: [
      { id: 'darkened_bone', amount: 2 },
      { id: 'dim_gem', amount: 1 },
    ],
    rewardShopCoupons: 1,
  },
  {
    id: 'daily_small_collector',
    group: 'daily',
    title: 'Малый сборщик',
    description: 'Получи 5 материалов любого типа.',
    type: 'collect_materials',
    target: 5,
    rewardGold: 225,
    rewardMaterials: [
      { id: 'old_leather', amount: 2 },
    ],
  },
  {
    id: 'daily_no_rest',
    group: 'daily',
    title: 'Без отдыха',
    description: 'Очисти 1 этаж.',
    type: 'clear_floors',
    target: 1,
    rewardGold: 375,
    rewardMaterials: [
      { id: 'darkened_bone', amount: 3 },
      { id: 'dim_gem', amount: 1 },
    ],
    rewardShopCoupons: 1,
  },
  {
    id: 'daily_coin_ring',
    group: 'daily',
    title: 'Звон монет',
    description: 'Заработай 1000 золота в спусках.',
    type: 'earn_gold',
    target: 1000,
    rewardGold: 300,
    rewardMaterials: [
      { id: 'old_leather', amount: 2 },
    ],
  },
  {
    id: 'daily_blade_check',
    group: 'daily',
    title: 'Проверка клинка',
    description: 'Победи 3 врагов любым оружием.',
    type: 'kill_enemies',
    target: 3,
    rewardGold: 225,
    rewardMaterials: [
      { id: 'darkened_bone', amount: 2 },
    ],
  },
  {
    id: 'daily_campfire_spark',
    group: 'daily',
    title: 'Искра костра',
    description: 'Найди или используй костёр.',
    type: 'use_campfires',
    target: 1,
    rewardGold: 260,
    rewardMaterials: [
      { id: 'dim_gem', amount: 1 },
    ],
  },

  {
    id: 'weekly_catacombs_week',
    group: 'weekly',
    title: 'Неделя в катакомбах',
    description: 'Очисти 10 этажей за неделю.',
    type: 'clear_floors',
    target: 10,
    rewardGold: 1250,
    rewardMaterials: [
      { id: 'darkened_bone', amount: 5 },
      { id: 'dim_gem', amount: 3 },
    ],
  },
  {
    id: 'weekly_elite_hunter',
    group: 'weekly',
    title: 'Охотник на элиту',
    description: 'Победи 8 элитных врагов.',
    type: 'kill_elites',
    target: 8,
    rewardGold: 1500,
    rewardMaterials: [
      { id: 'black_gem', amount: 2 },
    ],
    rewardShopCoupons: 2,
  },
  {
    id: 'weekly_grave_looter',
    group: 'weekly',
    title: 'Гробокопатель',
    description: 'Открой 15 сундуков.',
    type: 'open_chests',
    target: 15,
    rewardGold: 1400,
    rewardMaterials: [
      { id: 'old_leather', amount: 4 },
      { id: 'dim_gem', amount: 2 },
    ],
  },
  {
    id: 'weekly_ashen_route',
    group: 'weekly',
    title: 'Пепельный маршрут',
    description: 'Пройди 30 комнат.',
    type: 'complete_rooms',
    target: 30,
    rewardGold: 1600,
    rewardMaterials: [
      { id: 'darkened_bone', amount: 3 },
      { id: 'black_gem', amount: 2 },
    ],
  },
  {
    id: 'weekly_flint_flame',
    group: 'weekly',
    title: 'Пламя огнива',
    description: 'Используй костёр 3 раза.',
    type: 'use_campfires',
    target: 3,
    rewardGold: 1750,
    rewardMaterials: [
      { id: 'dim_gem', amount: 2 },
      { id: 'black_gem', amount: 1 },
    ],
  },
  {
    id: 'weekly_seal_collector',
    group: 'weekly',
    title: 'Сборщик печатей',
    description: 'Получи 20 материалов любого типа.',
    type: 'collect_materials',
    target: 20,
    rewardGold: 1500,
    rewardMaterials: [
      { id: 'cursed_seal', amount: 1 },
    ],
  },
  {
    id: 'weekly_abyss_trial',
    group: 'weekly',
    title: 'Испытание бездны',
    description: 'Победи 3 боссов этажей.',
    type: 'kill_bosses',
    target: 3,
    rewardGold: 2000,
    rewardMaterials: [
      { id: 'black_gem', amount: 2 },
      { id: 'cursed_seal', amount: 1 },
    ],
    rewardShopCoupons: 2,
  },
  {
    id: 'weekly_trophy_trader',
    group: 'weekly',
    title: 'Торговец трофеями',
    description: 'Получи 5 предметов редкости редкая или выше.',
    type: 'obtain_rare_items',
    target: 5,
    rewardGold: 1750,
    rewardMaterials: [
      { id: 'dark_flame_heart', amount: 1 },
    ],
    rewardShopCoupons: 2,
  },
  {
    id: 'weekly_preparation_master',
    group: 'weekly',
    title: 'Мастер подготовки',
    description: 'Улучши оружие 3 раза.',
    type: 'upgrade_weapon',
    target: 3,
    rewardGold: 1500,
    rewardMaterials: [
      { id: 'black_gem', amount: 2 },
    ],
  },
  {
    id: 'weekly_black_flint',
    group: 'weekly',
    title: 'Чёрное огниво',
    description: 'Собери материалы для редкого огнива.',
    type: 'collect_materials',
    target: 12,
    rewardGold: 2250,
    rewardMaterials: [
      { id: 'black_gem', amount: 2 },
      { id: 'cursed_seal', amount: 1 },
    ],
    rewardShopCoupons: 2,
  },

  {
    id: 'special_first_tier_seal',
    group: 'special',
    title: 'Печать первого яруса',
    description: 'Победи босса 25 этажа.',
    type: 'reach_floor',
    target: 25,
    rewardGold: 8000,
    rewardTreePoints: 2,
    rewardItemChance: {
      rarity: 'legendary',
      chance: 0.2,
    },
    note: 'Особое задание не обновляется после получения награды.',
  },
  {
    id: 'special_no_death',
    group: 'special',
    title: 'Без права на смерть',
    description: 'Очисти 5 этажей подряд без смерти.',
    type: 'clear_floors',
    target: 5,
    rewardGold: 6000,
    rewardTreePoints: 1,
    rewardMaterials: [
      { id: 'cursed_seal', amount: 2 },
    ],
    note: 'Для точного учёта серии без смерти можно подключить отдельный трекер забега.',
  },
  {
    id: 'special_crypt_executioner',
    group: 'special',
    title: 'Палач склепа',
    description: 'Победи 50 врагов.',
    type: 'kill_enemies',
    target: 50,
    rewardGold: 7000,
    rewardMaterials: [
      { id: 'dark_flame_heart', amount: 2 },
    ],
  },
  {
    id: 'special_morvein_hunter',
    group: 'special',
    title: 'Охотник за Морвеином',
    description: 'Победи Морвеина.',
    type: 'defeat_morvein',
    target: 1,
    rewardGold: 12000,
    rewardTreePoints: 3,
    rewardGuaranteedRarity: 'epic',
    rewardItemChance: {
      rarity: 'legendary',
      chance: 0.35,
    },
  },
  {
    id: 'special_blood_route',
    group: 'special',
    title: 'Кровавый маршрут',
    description: 'Победи 10 элитных врагов без выхода в город.',
    type: 'kill_elites',
    target: 10,
    rewardGold: 9000,
    rewardMaterials: [
      { id: 'cursed_seal', amount: 2 },
      { id: 'black_sarcophagus_shard', amount: 1 },
    ],
    note: 'Для строгой проверки “без выхода в город” можно подключить отдельный трекер забега.',
  },
  {
    id: 'special_deep_flame',
    group: 'special',
    title: 'Пламя глубин',
    description: 'Активируй 5 костров в разных забегах.',
    type: 'use_campfires',
    target: 5,
    rewardGold: 7500,
    rewardMaterials: [
      { id: 'black_gem', amount: 2 },
      { id: 'dark_flame_heart', amount: 1 },
    ],
  },
  {
    id: 'special_catacomb_greed',
    group: 'special',
    title: 'Жадность катакомб',
    description: 'Заработай 25000 золота в спусках.',
    type: 'earn_gold',
    target: 25000,
    rewardGold: 10000,
    rewardItemChance: {
      rarity: 'legendary',
      chance: 0.15,
    },
  },
  {
    id: 'special_forge_path',
    group: 'special',
    title: 'Путь кузнеца',
    description: 'Улучши оружие 5 раз.',
    type: 'upgrade_weapon',
    target: 5,
    rewardGold: 8500,
    rewardTreePoints: 1,
    rewardMaterials: [
      { id: 'dark_flame_heart', amount: 2 },
    ],
  },
  {
    id: 'special_relic_collector',
    group: 'special',
    title: 'Собиратель реликвий',
    description: 'Получи 3 реликвии.',
    type: 'collect_relics',
    target: 3,
    rewardGold: 15000,
    rewardTreePoints: 3,
    rewardItemChance: {
      rarity: 'mythic',
      chance: 0.08,
    },
    rewardMaterials: [
      { id: 'black_sarcophagus_shard', amount: 1 },
    ],
  },
  {
    id: 'special_darkness_accepted',
    group: 'special',
    title: 'Тьма приняла тебя',
    description: 'Дойди до 50 этажа.',
    type: 'reach_floor',
    target: 50,
    rewardGold: 20000,
    rewardTreePoints: 4,
    rewardGuaranteedRarity: 'legendary',
  },
];

export function getQuestGroupTitle(group: QuestGroup) {
  if (group === 'daily') return 'Ежедневные';
  if (group === 'weekly') return 'Еженедельные';
  return 'Особые';
}

export function getQuestGroupDescription(group: QuestGroup) {
  if (group === 'daily') {
    return 'Простые поручения лагеря. После получения награды становятся неактивными на 24 часа.';
  }

  if (group === 'weekly') {
    return 'Средние испытания недели. После получения награды становятся неактивными на 7 дней.';
  }

  return 'Сложные достижения катакомб. После получения награды не обновляются.';
}
