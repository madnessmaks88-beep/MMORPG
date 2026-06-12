export type EnemyWeakness =
  | 'dagger'
  | 'axe'
  | 'katana'
  | 'hammer'
  | 'shield_sword'
  | 'sword'
  | 'bleed'
  | 'stun'
  | 'crit';

export type EnemyResistance =
  | 'dagger'
  | 'axe'
  | 'katana'
  | 'hammer'
  | 'shield_sword'
  | 'sword'
  | 'bleed'
  | 'stun'
  | 'crit'
  | 'poison'
  | 'curse';

export type EnemyDebuffId =
  | 'bleeding'
  | 'poison'
  | 'curse'
  | 'armor_break'
  | 'rot'
  | 'death_mark'
  | 'energy_block'
  | 'weakness'
  | 'agility_down'
  | 'crit_down'
  | 'heal_block'
  | 'skill_cost_up';

export type EnemyDebuffOnHit = {
  id: EnemyDebuffId;
  name: string;
  chance: number;
  duration: number;
  power: number;
};

export type EnemyData = {
  id: string;
  name: string;

  hp: number;
  maxHp: number;

  attack: number;
  defense: number;

  expReward: number;
  goldReward: number;

  weaknesses?: EnemyWeakness[];
  resistances?: EnemyResistance[];
  debuffOnHit?: EnemyDebuffOnHit;
};

export const enemies: EnemyData[] = [
  // =========================
  // Обычные монстры — Склеп забвения
  // =========================

  {
    id: 'bone_gnawer',
    name: 'Костеглод',
    hp: 34,
    maxHp: 34,
    attack: 6,
    defense: 1,
    expReward: 12,
    goldReward: 6,
    weaknesses: ['hammer', 'stun'],
    resistances: ['bleed'],
    debuffOnHit: {
      id: 'bleeding',
      name: 'Разгрызенная плоть',
      chance: 0.15,
      duration: 2,
      power: 2,
    },
  },
  {
    id: 'crypt_crawler',
    name: 'Склепный ползун',
    hp: 38,
    maxHp: 38,
    attack: 7,
    defense: 1,
    expReward: 13,
    goldReward: 7,
    weaknesses: ['dagger', 'katana'],
    resistances: ['hammer'],
    debuffOnHit: {
      id: 'agility_down',
      name: 'Липкая слизь',
      chance: 0.18,
      duration: 2,
      power: 2,
    },
  },
  {
    id: 'grave_worm',
    name: 'Могильный червь',
    hp: 42,
    maxHp: 42,
    attack: 7,
    defense: 2,
    expReward: 14,
    goldReward: 7,
    weaknesses: ['katana', 'axe'],
    resistances: ['bleed'],
    debuffOnHit: {
      id: 'rot',
      name: 'Могильная зараза',
      chance: 0.16,
      duration: 2,
      power: 30,
    },
  },
  {
    id: 'corpse_eater',
    name: 'Трупоед',
    hp: 45,
    maxHp: 45,
    attack: 8,
    defense: 2,
    expReward: 15,
    goldReward: 8,
    weaknesses: ['katana', 'axe', 'bleed'],
    resistances: ['poison'],
    debuffOnHit: {
      id: 'poison',
      name: 'Трупный яд',
      chance: 0.18,
      duration: 3,
      power: 2,
    },
  },
  {
    id: 'rotten_servant',
    name: 'Гнилой служка',
    hp: 40,
    maxHp: 40,
    attack: 7,
    defense: 2,
    expReward: 14,
    goldReward: 8,
    weaknesses: ['sword', 'katana'],
    resistances: ['bleed'],
    debuffOnHit: {
      id: 'weakness',
      name: 'Гнилой удар',
      chance: 0.14,
      duration: 2,
      power: 20,
    },
  },
  {
    id: 'bone_guard',
    name: 'Костяной страж',
    hp: 52,
    maxHp: 52,
    attack: 8,
    defense: 3,
    expReward: 18,
    goldReward: 10,
    weaknesses: ['hammer', 'stun'],
    resistances: ['bleed', 'katana'],
    debuffOnHit: {
      id: 'armor_break',
      name: 'Трещина брони',
      chance: 0.16,
      duration: 2,
      power: 3,
    },
  },
  {
    id: 'mold_dead',
    name: 'Плесневый мертвец',
    hp: 48,
    maxHp: 48,
    attack: 8,
    defense: 2,
    expReward: 16,
    goldReward: 9,
    weaknesses: ['katana', 'axe'],
    resistances: ['poison'],
    debuffOnHit: {
      id: 'crit_down',
      name: 'Споры плесени',
      chance: 0.18,
      duration: 2,
      power: 10,
    },
  },
  {
    id: 'sarcophagus_rat',
    name: 'Саркофажный крысак',
    hp: 32,
    maxHp: 32,
    attack: 9,
    defense: 1,
    expReward: 13,
    goldReward: 7,
    weaknesses: ['dagger', 'crit'],
    resistances: ['hammer'],
    debuffOnHit: {
      id: 'bleeding',
      name: 'Рваная рана',
      chance: 0.2,
      duration: 3,
      power: 1,
    },
  },
  {
    id: 'carrion_spider',
    name: 'Падальный паук',
    hp: 36,
    maxHp: 36,
    attack: 9,
    defense: 1,
    expReward: 14,
    goldReward: 8,
    weaknesses: ['dagger', 'katana'],
    resistances: ['hammer'],
    debuffOnHit: {
      id: 'poison',
      name: 'Падальный яд',
      chance: 0.22,
      duration: 2,
      power: 2,
    },
  },
  {
    id: 'crypt_minion',
    name: 'Склепный прихвостень',
    hp: 44,
    maxHp: 44,
    attack: 8,
    defense: 2,
    expReward: 16,
    goldReward: 9,
    weaknesses: ['sword', 'dagger'],
    resistances: [],
    debuffOnHit: {
      id: 'weakness',
      name: 'Подлый выпад',
      chance: 0.15,
      duration: 1,
      power: 20,
    },
  },
  {
    id: 'deadskin',
    name: 'Мертвокожий',
    hp: 50,
    maxHp: 50,
    attack: 9,
    defense: 2,
    expReward: 18,
    goldReward: 10,
    weaknesses: ['katana', 'bleed'],
    resistances: ['poison'],
    debuffOnHit: {
      id: 'energy_block',
      name: 'Мертвая хватка',
      chance: 0.17,
      duration: 1,
      power: 1,
    },
  },
  {
    id: 'funeral_beetle',
    name: 'Погребальный жук',
    hp: 46,
    maxHp: 46,
    attack: 8,
    defense: 3,
    expReward: 17,
    goldReward: 9,
    weaknesses: ['hammer', 'axe'],
    resistances: ['dagger'],
    debuffOnHit: {
      id: 'armor_break',
      name: 'Панцирная пыль',
      chance: 0.15,
      duration: 2,
      power: 2,
    },
  },
  {
    id: 'bone_breaker',
    name: 'Костолом',
    hp: 56,
    maxHp: 56,
    attack: 10,
    defense: 2,
    expReward: 20,
    goldReward: 11,
    weaknesses: ['hammer', 'stun'],
    resistances: ['bleed'],
    debuffOnHit: {
      id: 'armor_break',
      name: 'Сломанные ребра',
      chance: 0.18,
      duration: 2,
      power: 3,
    },
  },
  {
    id: 'coffin_scraper',
    name: 'Гробовой скребун',
    hp: 52,
    maxHp: 52,
    attack: 10,
    defense: 3,
    expReward: 20,
    goldReward: 11,
    weaknesses: ['axe', 'sword'],
    resistances: ['crit'],
    debuffOnHit: {
      id: 'curse',
      name: 'Скрежет гроба',
      chance: 0.16,
      duration: 2,
      power: 1,
    },
  },
  {
    id: 'infected_acolyte',
    name: 'Зараженный послушник',
    hp: 48,
    maxHp: 48,
    attack: 11,
    defense: 2,
    expReward: 21,
    goldReward: 12,
    weaknesses: ['sword', 'crit'],
    resistances: ['poison'],
    debuffOnHit: {
      id: 'curse',
      name: 'Зараженная молитва',
      chance: 0.17,
      duration: 3,
      power: 1,
    },
  },

  // =========================
  // Элитные враги
  // =========================

  {
    id: 'sarcophagus_keeper',
    name: 'Хранитель саркофага',
    hp: 82,
    maxHp: 82,
    attack: 12,
    defense: 4,
    expReward: 36,
    goldReward: 20,
    weaknesses: ['hammer', 'axe'],
    resistances: ['bleed', 'stun'],
    debuffOnHit: {
      id: 'heal_block',
      name: 'Печать саркофага',
      chance: 0.2,
      duration: 1,
      power: 1,
    },
  },
  {
    id: 'bone_executioner',
    name: 'Палач из костей',
    hp: 90,
    maxHp: 90,
    attack: 14,
    defense: 4,
    expReward: 40,
    goldReward: 23,
    weaknesses: ['hammer', 'axe'],
    resistances: ['bleed'],
    debuffOnHit: {
      id: 'armor_break',
      name: 'Костяной раскол',
      chance: 0.22,
      duration: 2,
      power: 4,
    },
  },
  {
    id: 'crypt_butcher',
    name: 'Мясник крипты',
    hp: 96,
    maxHp: 96,
    attack: 15,
    defense: 4,
    expReward: 43,
    goldReward: 25,
    weaknesses: ['katana', 'axe', 'bleed'],
    resistances: ['stun'],
    debuffOnHit: {
      id: 'bleeding',
      name: 'Рваное мясо',
      chance: 0.24,
      duration: 2,
      power: 4,
    },
  },
  {
    id: 'buried_knight',
    name: 'Погребенный рыцарь',
    hp: 105,
    maxHp: 105,
    attack: 14,
    defense: 6,
    expReward: 47,
    goldReward: 28,
    weaknesses: ['hammer', 'axe'],
    resistances: ['dagger', 'katana'],
    debuffOnHit: {
      id: 'skill_cost_up',
      name: 'Тяжелый надлом',
      chance: 0.2,
      duration: 2,
      power: 1,
    },
  },
  {
    id: 'bone_armored_guard',
    name: 'Костяной латник',
    hp: 112,
    maxHp: 112,
    attack: 13,
    defense: 7,
    expReward: 50,
    goldReward: 30,
    weaknesses: ['hammer', 'axe'],
    resistances: ['dagger', 'bleed', 'katana'],
    debuffOnHit: {
      id: 'weakness',
      name: 'Давление брони',
      chance: 0.18,
      duration: 2,
      power: 15,
    },
  },
  {
    id: 'dead_standard_bearer',
    name: 'Мертвый знаменосец',
    hp: 100,
    maxHp: 100,
    attack: 16,
    defense: 5,
    expReward: 50,
    goldReward: 30,
    weaknesses: ['sword', 'crit'],
    resistances: ['curse'],
    debuffOnHit: {
      id: 'crit_down',
      name: 'Знамя страха',
      chance: 0.2,
      duration: 2,
      power: 15,
    },
  },
  {
    id: 'rotten_chaplain',
    name: 'Гниющий капеллан',
    hp: 92,
    maxHp: 92,
    attack: 17,
    defense: 4,
    expReward: 52,
    goldReward: 32,
    weaknesses: ['sword', 'katana'],
    resistances: ['poison'],
    debuffOnHit: {
      id: 'rot',
      name: 'Гнилая проповедь',
      chance: 0.22,
      duration: 2,
      power: 40,
    },
  },
  {
    id: 'leper_guard',
    name: 'Прокаженный страж',
    hp: 110,
    maxHp: 110,
    attack: 15,
    defense: 6,
    expReward: 54,
    goldReward: 34,
    weaknesses: ['hammer', 'axe'],
    resistances: ['poison', 'bleed'],
    debuffOnHit: {
      id: 'rot',
      name: 'Проказа',
      chance: 0.2,
      duration: 3,
      power: 25,
    },
  },
  {
    id: 'crypt_torturer',
    name: 'Склепный истязатель',
    hp: 104,
    maxHp: 104,
    attack: 18,
    defense: 5,
    expReward: 58,
    goldReward: 36,
    weaknesses: ['dagger', 'crit'],
    resistances: ['stun'],
    debuffOnHit: {
      id: 'death_mark',
      name: 'Боль истязателя',
      chance: 0.22,
      duration: 1,
      power: 20,
    },
  },
  {
    id: 'bloody_gravedigger',
    name: 'Кровавый могильщик',
    hp: 116,
    maxHp: 116,
    attack: 18,
    defense: 6,
    expReward: 62,
    goldReward: 40,
    weaknesses: ['katana', 'axe'],
    resistances: ['bleed'],
    debuffOnHit: {
      id: 'death_mark',
      name: 'Кровавая метка',
      chance: 0.2,
      duration: 1,
      power: 25,
    },
  },

  // =========================
  // Мини-боссы этажей 1–24
  // =========================

  {
    id: 'bone_abbot',
    name: 'Костяной настоятель',
    hp: 145,
    maxHp: 145,
    attack: 18,
    defense: 7,
    expReward: 90,
    goldReward: 60,
    weaknesses: ['hammer', 'sword'],
    resistances: ['bleed', 'stun'],
    debuffOnHit: {
      id: 'curse',
      name: 'Костяное благословение',
      chance: 0.25,
      duration: 2,
      power: 2,
    },
  },
  {
    id: 'sarcophagus_lord',
    name: 'Владыка саркофага',
    hp: 160,
    maxHp: 160,
    attack: 20,
    defense: 8,
    expReward: 105,
    goldReward: 70,
    weaknesses: ['hammer', 'axe'],
    resistances: ['bleed', 'stun'],
    debuffOnHit: {
      id: 'energy_block',
      name: 'Запертая душа',
      chance: 0.22,
      duration: 1,
      power: 1,
    },
  },
  {
    id: 'lower_crypt_executioner',
    name: 'Палач нижнего склепа',
    hp: 170,
    maxHp: 170,
    attack: 22,
    defense: 8,
    expReward: 115,
    goldReward: 78,
    weaknesses: ['hammer', 'axe'],
    resistances: ['bleed'],
    debuffOnHit: {
      id: 'death_mark',
      name: 'Приговор палача',
      chance: 0.24,
      duration: 1,
      power: 30,
    },
  },
  {
    id: 'funeral_champion',
    name: 'Погребальный чемпион',
    hp: 180,
    maxHp: 180,
    attack: 22,
    defense: 10,
    expReward: 125,
    goldReward: 85,
    weaknesses: ['hammer', 'crit'],
    resistances: ['dagger', 'stun'],
    debuffOnHit: {
      id: 'skill_cost_up',
      name: 'Давление чемпиона',
      chance: 0.22,
      duration: 1,
      power: 1,
    },
  },
  {
    id: 'bone_collector',
    name: 'Собиратель костей',
    hp: 165,
    maxHp: 165,
    attack: 24,
    defense: 7,
    expReward: 120,
    goldReward: 82,
    weaknesses: ['hammer', 'stun'],
    resistances: ['bleed'],
    debuffOnHit: {
      id: 'armor_break',
      name: 'Украденная кость',
      chance: 0.2,
      duration: 3,
      power: 3,
    },
  },
  {
    id: 'dead_knight_varn',
    name: 'Мертвый рыцарь рода Варн',
    hp: 190,
    maxHp: 190,
    attack: 23,
    defense: 11,
    expReward: 135,
    goldReward: 92,
    weaknesses: ['hammer', 'axe'],
    resistances: ['dagger', 'katana'],
    debuffOnHit: {
      id: 'armor_break',
      name: 'Рыцарский надлом',
      chance: 0.22,
      duration: 2,
      power: 3,
    },
  },
  {
    id: 'rotten_bishop',
    name: 'Гниющий епископ',
    hp: 170,
    maxHp: 170,
    attack: 26,
    defense: 8,
    expReward: 140,
    goldReward: 96,
    weaknesses: ['sword', 'crit'],
    resistances: ['poison', 'bleed'],
    debuffOnHit: {
      id: 'curse',
      name: 'Черная литургия',
      chance: 0.25,
      duration: 3,
      power: 2,
    },
  },
  {
    id: 'black_tomb_guardian',
    name: 'Страж Черной Усыпальницы',
    hp: 205,
    maxHp: 205,
    attack: 25,
    defense: 12,
    expReward: 155,
    goldReward: 110,
    weaknesses: ['hammer', 'axe'],
    resistances: ['dagger', 'katana', 'bleed', 'stun'],
    debuffOnHit: {
      id: 'curse',
      name: 'Черная печать',
      chance: 0.24,
      duration: 2,
      power: 2,
    },
  },

  // =========================
  // Главный босс первого яруса
  // =========================

  {
    id: 'morvein_sealed_crypt_lord',
    name: 'Морвеин, Владыка Запечатанного Склепа',
    hp: 260,
    maxHp: 260,
    attack: 28,
    defense: 14,
    expReward: 320,
    goldReward: 240,
    weaknesses: ['sword', 'hammer'],
    resistances: ['bleed', 'stun', 'poison', 'dagger'],
    debuffOnHit: {
      id: 'curse',
      name: 'Плач Костей',
      chance: 0.28,
      duration: 2,
      power: 3,
    },
  },
];

export function getEnemyById(id: string): EnemyData | undefined {
  return enemies.find(enemy => enemy.id === id);
}