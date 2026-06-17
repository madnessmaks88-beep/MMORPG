import Phaser from 'phaser';
import type { EquipmentSlot } from './player';

export type ItemRarity =
  | 'common'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export type ItemData = {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;

  // Ограничение выпадения/появления предмета по этажам.
  // Второй ярус начинается с 26 этажа.
  minFloor?: number;
  maxFloor?: number;

  // bossOnly/sourceEnemyId нужны для уникальных мифических предметов боссов.
  bossOnly?: boolean;
  sourceEnemyId?: string;

  bonusHp?: number;
  bonusAttack?: number;
  bonusDefense?: number;
  bonusCritChance?: number;
  bonusEnergy?: number;
  bonusAgility?: number;
  bonusLuck?: number;
  bonusStrength?: number;
  bonusIntelligence?: number;

  weaponType?: WeaponType;
};

export type WeaponType =
  | 'dagger'
  | 'axe'
  | 'katana'
  | 'hammer'
  | 'shield_sword'
  | 'spear'
  | 'trident'
  | 'sword';

export const items: ItemData[] = [
  {
    id: 'rusty_sword',
    name: 'Ржавый меч',
    description: 'Старый клинок, который всё ещё способен вскрывать плоть.',
    slot: 'weapon',
    rarity: 'common',
    weaponType: 'sword',
    bonusAttack: 4,
  },
  {
    id: 'bone_axe',
    name: 'Костяной топор',
    description: 'Тяжёлый топор, собранный из костей неизвестного зверя.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'axe',
    bonusAttack: 7,
    bonusCritChance: 0.03,
  },
  {
    id: 'cultist_blade',
    name: 'Клинок культиста',
    description: 'Лезвие покрыто тёмными рунами и засохшей кровью.',
    slot: 'weapon',
    rarity: 'epic',
    weaponType: 'katana',
    bonusAttack: 10,
    bonusCritChance: 0.06,
  },
  {
    id: 'dusty_fang',
    name: 'Пыльный клык',
    description: 'Старый кинжал. Наносит серию быстрых ударов.',
    slot: 'weapon',
    rarity: 'common',
    weaponType: 'dagger',
    bonusAttack: 3,
    bonusCritChance: 0.01,
  },
  {
    id: 'moon_spike',
    name: 'Лунный шип',
    description: 'Тонкий кинжал с холодным блеском.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'dagger',
    bonusAttack: 6,
    bonusCritChance: 0.03,
  },
  {
    id: 'grave_hammer',
    name: 'Могильный молот',
    description: 'Тяжёлый молот, способный сбить врага с ног.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'hammer',
    bonusAttack: 8,
    bonusDefense: 1,
  },
  {
    id: 'guard_sword',
    name: 'Меч стража',
    description: 'Меч с широким щитком. Позволяет атаковать осторожнее.',
    slot: 'weapon',
    rarity: 'common',
    weaponType: 'shield_sword',
    bonusAttack: 3,
    bonusDefense: 3,
  },
  {
    id: 'scarlet_katana',
    name: 'Алая катана',
    description: 'Острое лезвие, оставляющее глубокие кровоточащие раны.',
    slot: 'weapon',
    rarity: 'epic',
    weaponType: 'katana',
    bonusAttack: 11,
    bonusCritChance: 0.05,
  },
  {
    id: 'crypt_rusty_katana',
    name: 'Ржавая катана склепа',
    description: 'Погребальное лезвие с зазубренной кромкой.',
    slot: 'weapon',
    rarity: 'common',
    weaponType: 'katana',
    bonusAttack: 3,
    bonusCritChance: 0.01,
  },
  {
    id: 'crypt_servant_katana',
    name: 'Катана погребального служки',
    description: 'Тонкое оружие служителя усыпальницы.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'katana',
    bonusAttack: 6,
    bonusCritChance: 0.02,
  },
  {
    id: 'black_niche_blade',
    name: 'Лезвие Черной Ниши',
    description: 'Катана, найденная в запечатанной нише.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'katana',
    bonusAttack: 9,
    bonusCritChance: 0.03,
  },
  {
    id: 'silent_tomb_katana',
    name: 'Катана Безмолвной Усыпальницы',
    description: 'Клинок, который словно режет саму тишину.',
    slot: 'weapon',
    rarity: 'epic',
    weaponType: 'katana',
    bonusAttack: 13,
    bonusCritChance: 0.05,
  },
  {
    id: 'sarcophagus_cutter',
    name: 'Саркофагный Рассекатель',
    description: 'Легендарная катана, вскрывающая камень и кость.',
    slot: 'weapon',
    rarity: 'legendary',
    weaponType: 'katana',
    bonusAttack: 18,
    bonusCritChance: 0.07,
  },
  {
    id: 'cracked_grave_axe',
    name: 'Треснувший могильный топор',
    description: 'Грубый топор с треснувшим лезвием.',
    slot: 'weapon',
    rarity: 'common',
    weaponType: 'axe',
    bonusAttack: 4,
  },
  {
    id: 'bone_chopper_axe',
    name: 'Топор костяного рубщика',
    description: 'Тяжелый топор для раскалывания костей.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'axe',
    bonusAttack: 7,
  },
  {
    id: 'grave_digger_pruner',
    name: 'Секатор Гробокопателя',
    description: 'Странный топор с крюком, будто созданный для вскрытия могил.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'axe',
    bonusAttack: 10,
  },
  {
    id: 'lower_crypt_axe',
    name: 'Топор Нижнего Склепа',
    description: 'Оружие, пропитанное запахом глубин.',
    slot: 'weapon',
    rarity: 'epic',
    weaponType: 'axe',
    bonusAttack: 15,
  },
  {
    id: 'sealed_executioner_axe',
    name: 'Палач Запечатанных',
    description: 'Топор, которым казнили тех, кого нельзя было похоронить.',
    slot: 'weapon',
    rarity: 'legendary',
    weaponType: 'axe',
    bonusAttack: 21,
  },
  {
    id: 'rusty_funeral_sword',
    name: 'Ржавый погребальный меч',
    description: 'Простой меч из старого захоронения.',
    slot: 'weapon',
    rarity: 'common',
    weaponType: 'sword',
    bonusAttack: 3,
    bonusDefense: 1,
  },
  {
    id: 'crypt_guard_sword',
    name: 'Меч склепного стража',
    description: 'Меч, которым когда-то охраняли запечатанные двери.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'sword',
    bonusAttack: 6,
    bonusDefense: 1,
  },
  {
    id: 'broken_seal_blade',
    name: 'Клинок Сломанной Печати',
    description: 'Клинок с остатками нарушенного заклятия.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'sword',
    bonusAttack: 9,
    bonusDefense: 2,
  },
  {
    id: 'black_tomb_sword',
    name: 'Меч Черной Усыпальницы',
    description: 'Эпический меч из глубокой погребальной камеры.',
    slot: 'weapon',
    rarity: 'epic',
    weaponType: 'sword',
    bonusAttack: 13,
    bonusDefense: 3,
  },
  {
    id: 'ashen_sarcophagus_blade',
    name: 'Пепельный Клинок Саркофага',
    description: 'Легендарный меч, покрытый серой пылью мертвых королей.',
    slot: 'weapon',
    rarity: 'legendary',
    weaponType: 'sword',
    bonusAttack: 18,
    bonusDefense: 4,
  },
  {
    id: 'morvein_last_oath',
    name: 'Последняя Клятва Морвеина',
    description: 'Мифический меч Морвеина. Его клятва не умерла вместе с владельцем.',
    slot: 'weapon',
    rarity: 'mythic',
    weaponType: 'sword',
    bonusAttack: 26,
    bonusDefense: 6,
    bonusCritChance: 0.08,
  },
  {
    id: 'forgotten_guard_shield_sword',
    name: 'Щит-меч забытых стражей',
    description: 'Старый щит-клинок из оружейной склепа.',
    slot: 'weapon',
    rarity: 'common',
    weaponType: 'shield_sword',
    bonusAttack: 2,
    bonusDefense: 3,
  },
  {
    id: 'funeral_shield_blade',
    name: 'Погребальный щит-клинок',
    description: 'Оружие стражей, сопровождавших погребальные процессии.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'shield_sword',
    bonusAttack: 5,
    bonusDefense: 5,
  },
  {
    id: 'bone_chapel_wall',
    name: 'Стена Костяной Часовни',
    description: 'Тяжелый щит-меч, украшенный костяными пластинами.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'shield_sword',
    bonusAttack: 7,
    bonusDefense: 7,
  },
  {
    id: 'sealed_niche_shield_blade',
    name: 'Клинок-щит Запечатанной Ниши',
    description: 'Эпический щит-меч, найденный за сломанной печатью.',
    slot: 'weapon',
    rarity: 'epic',
    weaponType: 'shield_sword',
    bonusAttack: 10,
    bonusDefense: 10,
  },
  {
    id: 'black_crypt_bulwark',
    name: 'Оплот Черного Склепа',
    description: 'Легендарный щит-меч, способный выдержать удар смерти.',
    slot: 'weapon',
    rarity: 'legendary',
    weaponType: 'shield_sword',
    bonusAttack: 14,
    bonusDefense: 14,
  },
  {
    id: 'crypt_knife',
    name: 'Склепный нож',
    description: 'Простой короткий клинок, найденный среди костей.',
    slot: 'weapon',
    rarity: 'common',
    weaponType: 'dagger',
    bonusAttack: 2,
    bonusCritChance: 0.02,
  },
  {
    id: 'coffin_thief_dagger',
    name: 'Кинжал гробового вора',
    description: 'Легкий кинжал для быстрых ударов.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'dagger',
    bonusAttack: 5,
    bonusCritChance: 0.04,
  },
  {
    id: 'carrion_beetle_sting',
    name: 'Жало Падального Жука',
    description: 'Тонкий клинок, похожий на жало склепного насекомого.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'dagger',
    bonusAttack: 7,
    bonusCritChance: 0.05,
  },
  {
    id: 'quiet_burial_dagger',
    name: 'Кинжал Тихого Захоронения',
    description: 'Эпический кинжал, которым убивали без звука.',
    slot: 'weapon',
    rarity: 'epic',
    weaponType: 'dagger',
    bonusAttack: 10,
    bonusCritChance: 0.07,
  },
  {
    id: 'sarcophagus_whisper',
    name: 'Шепот Саркофага',
    description: 'Легендарный кинжал, шепчущий имена мертвых.',
    slot: 'weapon',
    rarity: 'legendary',
    weaponType: 'dagger',
    bonusAttack: 14,
    bonusCritChance: 0.1,
  },
  {
    id: 'heavy_stone_hammer',
    name: 'Тяжелый каменный молот',
    description: 'Грубый молот из камня и старой рукояти.',
    slot: 'weapon',
    rarity: 'common',
    weaponType: 'hammer',
    bonusAttack: 4,
    bonusDefense: 1,
  },
  {
    id: 'grave_keeper_hammer',
    name: 'Молот могильного смотрителя',
    description: 'Молот, которым забивали печати на гробницах.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'hammer',
    bonusAttack: 8,
    bonusDefense: 2,
  },
  {
    id: 'tombstone_crusher',
    name: 'Дробитель Надгробий',
    description: 'Молот, способный раскалывать каменные плиты.',
    slot: 'weapon',
    rarity: 'rare',
    weaponType: 'hammer',
    bonusAttack: 11,
    bonusDefense: 2,
  },
  {
    id: 'black_slab_hammer',
    name: 'Молот Черной Плиты',
    description: 'Эпический молот из черного погребального камня.',
    slot: 'weapon',
    rarity: 'epic',
    weaponType: 'hammer',
    bonusAttack: 16,
    bonusDefense: 3,
  },
  {
    id: 'buried_king_seal',
    name: 'Печать Погребенного Короля',
    description: 'Легендарный молот, которым запечатывали царские саркофаги.',
    slot: 'weapon',
    rarity: 'legendary',
    weaponType: 'hammer',
    bonusAttack: 22,
    bonusDefense: 4,
  },

  // Броня катакомб: 10 предметов без мифической редкости
  {
    id: 'cracked_crypt_breastplate',
    name: 'Треснувший нагрудник склепа',
    description: 'Грубая броня из старых пластин, пахнущая сыростью и пеплом.',
    slot: 'armor',
    rarity: 'common',
    bonusHp: 10,
    bonusDefense: 1,
  },
  {
    id: 'grave_digger_leather_coat',
    name: 'Пыльная куртка гробокопателя',
    description: 'Плотная кожа, пропитанная землёй старых могил.',
    slot: 'armor',
    rarity: 'common',
    bonusHp: 8,
    bonusAgility: 1,
  },
  {
    id: 'rusted_guard_plates',
    name: 'Ржавые пластины стража',
    description: 'Осколки доспеха погребального караульного.',
    slot: 'armor',
    rarity: 'common',
    bonusDefense: 1,
    bonusStrength: 1,
  },
  {
    id: 'bone_watchman_carapace',
    name: 'Панцирь костяного караульного',
    description: 'Костяные пластины скреплены потемневшими ремнями.',
    slot: 'armor',
    rarity: 'rare',
    bonusHp: 22,
    bonusDefense: 2,
  },
  {
    id: 'night_sneaker_coat',
    name: 'Куртка ночного лазутчика',
    description: 'Лёгкая броня для тех, кто выживает движением, а не щитом.',
    slot: 'armor',
    rarity: 'rare',
    bonusHp: 12,
    bonusAgility: 2,
    bonusCritChance: 0.01,
  },
  {
    id: 'ashen_crypt_keeper_chainmail',
    name: 'Пепельная кольчуга склепника',
    description: 'Кольца металла покрыты серой пылью и следами старых молитв.',
    slot: 'armor',
    rarity: 'rare',
    bonusHp: 16,
    bonusDefense: 1,
    bonusIntelligence: 1,
  },
  {
    id: 'black_tomb_armor',
    name: 'Доспех Чёрной Усыпальницы',
    description: 'Тяжёлый доспех из погребального металла, холодный даже у костра.',
    slot: 'armor',
    rarity: 'epic',
    bonusHp: 35,
    bonusDefense: 4,
  },
  {
    id: 'silent_niche_cloak',
    name: 'Плащ Безмолвной Ниши',
    description: 'Пепельная ткань глушит шаги и скрывает дыхание.',
    slot: 'armor',
    rarity: 'epic',
    bonusHp: 22,
    bonusAgility: 3,
    bonusCritChance: 0.02,
  },
  {
    id: 'sarcophagus_executioner_armor',
    name: 'Саркофагная броня Палача',
    description: 'Легендарные пластины, которыми закрывали тех, кто не боялся смерти.',
    slot: 'armor',
    rarity: 'legendary',
    bonusHp: 55,
    bonusDefense: 6,
    bonusStrength: 2,
  },
  {
    id: 'lower_crypt_bone_plate',
    name: 'Костяной доспех Нижнего Склепа',
    description: 'Броня из костей глубоких захоронений. Внутри слышен далёкий хруст.',
    slot: 'armor',
    rarity: 'legendary',
    bonusHp: 45,
    bonusDefense: 5,
    bonusCritChance: 0.03,
  },

  // Амулеты и талисманы: 10 предметов без мифической редкости
  {
    id: 'cracked_wax_amulet',
    name: 'Треснувший амулет свечного воска',
    description: 'Малый оберег из воска, снятого с погребальной свечи.',
    slot: 'trinket',
    rarity: 'common',
    bonusHp: 5,
    bonusLuck: 1,
  },
  {
    id: 'grave_digger_copper_sign',
    name: 'Медный знак гробокопателя',
    description: 'Потёртый знак тех, кто копал слишком глубоко.',
    slot: 'trinket',
    rarity: 'common',
    bonusStrength: 1,
    bonusLuck: 1,
  },
  {
    id: 'cold_crypt_bead',
    name: 'Холодная бусина склепа',
    description: 'Каменная бусина, всегда покрытая подземным инеем.',
    slot: 'trinket',
    rarity: 'common',
    bonusDefense: 1,
    bonusIntelligence: 1,
  },
  {
    id: 'bone_servant_charm',
    name: 'Костяной оберег служки',
    description: 'Оберег младших хранителей усыпальницы, сделанный из пальцевых костей.',
    slot: 'trinket',
    rarity: 'rare',
    bonusHp: 10,
    bonusLuck: 2,
  },
  {
    id: 'burial_whisper_talisman',
    name: 'Талисман погребального шёпота',
    description: 'Слабый шёпот внутри камня будто подсказывает, куда ударить.',
    slot: 'trinket',
    rarity: 'rare',
    bonusIntelligence: 2,
    bonusCritChance: 0.01,
  },
  {
    id: 'dark_niche_mark',
    name: 'Знак Тёмной Ниши',
    description: 'Малый знак, найденный за плитой, которую не должны были вскрывать.',
    slot: 'trinket',
    rarity: 'rare',
    bonusAgility: 2,
    bonusCritChance: 0.01,
  },
  {
    id: 'black_seal_amulet',
    name: 'Амулет Чёрной Печати',
    description: 'Осколок запретной печати, усиливающий волю и удар.',
    slot: 'trinket',
    rarity: 'epic',
    bonusStrength: 2,
    bonusIntelligence: 2,
    bonusCritChance: 0.02,
  },
  {
    id: 'silent_tomb_eye',
    name: 'Глаз Безмолвной Усыпальницы',
    description: 'Тёмный глаз из стекла саркофага. Он будто видит скрытые тайники.',
    slot: 'trinket',
    rarity: 'epic',
    bonusLuck: 3,
    bonusCritChance: 0.02,
  },
  {
    id: 'lower_crypt_heart',
    name: 'Сердце Нижнего Склепа',
    description: 'Легендарный талисман, в котором стучит не жизнь, а память камня.',
    slot: 'trinket',
    rarity: 'legendary',
    bonusHp: 25,
    bonusDefense: 3,
    bonusIntelligence: 2,
  },
  {
    id: 'sealed_ones_mark',
    name: 'Печать Запечатанных',
    description: 'Знак тех, кого забыли под плитами. Даёт силу, но давит на сердце.',
    slot: 'trinket',
    rarity: 'legendary',
    bonusStrength: 3,
    bonusCritChance: 0.03,
    bonusEnergy: 1,
  },
  // =========================
  // Второй ярус — Затопленные усыпальницы
  // Оружие второго яруса. Мифических обычных дропов нет.
  // =========================

  {
    id: 't2_rusty_drowned_blade',
    name: 'Ржавый клинок утопленника',
    description: 'Обычный меч второго яруса. Клинок покрыт мокрой ржавчиной и солью чёрной воды.',
    slot: 'weapon',
    rarity: 'common',
    minFloor: 26,
    weaponType: 'sword',
    bonusAttack: 15,
    bonusDefense: 2,
  },
  {
    id: 't2_rotten_axe',
    name: 'Сгнивший топор',
    description: 'Обычный топор второго яруса. Рукоять разбухла от сырости, но лезвие всё ещё тяжёлое.',
    slot: 'weapon',
    rarity: 'common',
    minFloor: 26,
    weaponType: 'axe',
    bonusAttack: 18,
  },
  {
    id: 't2_mossy_katana',
    name: 'Замшелая катана',
    description: 'Обычная катана второго яруса. Узкое лезвие покрыто плесенью и зелёным налётом.',
    slot: 'weapon',
    rarity: 'common',
    minFloor: 26,
    weaponType: 'katana',
    bonusAttack: 16,
    bonusCritChance: 0.04,
  },
  {
    id: 't2_cracked_hammer',
    name: 'Треснувший молот',
    description: 'Обычный молот второго яруса. Каменная голова треснула, но удар всё ещё ломает кости.',
    slot: 'weapon',
    rarity: 'common',
    minFloor: 26,
    weaponType: 'hammer',
    bonusAttack: 18,
    bonusDefense: 3,
  },
  {
    id: 't2_drowned_thief_knife',
    name: 'Нож утонувшего вора',
    description: 'Обычный кинжал второго яруса. Его нашли в руке мертвеца, утонувшего у саркофага.',
    slot: 'weapon',
    rarity: 'common',
    minFloor: 26,
    weaponType: 'dagger',
    bonusAttack: 13,
    bonusCritChance: 0.06,
  },
  {
    id: 't2_dead_scavenger_spear',
    name: 'Копьё мёртвого падальщика',
    description: 'Обычное копьё второго яруса. Длинное древко позволяет держать утопленников на расстоянии.',
    slot: 'weapon',
    rarity: 'common',
    minFloor: 26,
    weaponType: 'spear',
    bonusAttack: 16,
    bonusCritChance: 0.02,
  },

  {
    id: 't2_black_water_sword',
    name: 'Меч Чёрной Воды',
    description: 'Редкий меч второго яруса. В трещинах клинка стоит холодная чёрная вода.',
    slot: 'weapon',
    rarity: 'rare',
    minFloor: 26,
    weaponType: 'sword',
    bonusAttack: 20,
    bonusDefense: 3,
  },
  {
    id: 't2_dark_waters_executioner',
    name: 'Палач Тёмных Вод',
    description: 'Редкий топор второго яруса. Его лезвие будто тяжелее рядом с водой.',
    slot: 'weapon',
    rarity: 'rare',
    minFloor: 26,
    weaponType: 'axe',
    bonusAttack: 24,
  },
  {
    id: 't2_river_ghost_katana',
    name: 'Призрак Реки',
    description: 'Редкая катана второго яруса. Её удар похож на тихую рябь перед смертью.',
    slot: 'weapon',
    rarity: 'rare',
    minFloor: 26,
    weaponType: 'katana',
    bonusAttack: 21,
    bonusCritChance: 0.06,
  },
  {
    id: 't2_darkened_bonecrusher',
    name: 'Потемневший Костолом',
    description: 'Редкий молот второго яруса. Подходит для дробления мокрых костей и ржавых доспехов.',
    slot: 'weapon',
    rarity: 'rare',
    minFloor: 26,
    weaponType: 'hammer',
    bonusAttack: 25,
    bonusDefense: 4,
  },
  {
    id: 't2_envious_sting',
    name: 'Жало Завистливых',
    description: 'Редкий кинжал второго яруса. Тонкое жало для тех, кто бьёт первым и исчезает в сырости.',
    slot: 'weapon',
    rarity: 'rare',
    minFloor: 26,
    weaponType: 'dagger',
    bonusAttack: 18,
    bonusCritChance: 0.08,
  },
  {
    id: 't2_skull_piercer_spear',
    name: 'Пронзатель Черепов',
    description: 'Редкое копьё второго яруса. Пробивает черепа утопленников даже через мокрые кости.',
    slot: 'weapon',
    rarity: 'rare',
    minFloor: 26,
    weaponType: 'spear',
    bonusAttack: 22,
    bonusCritChance: 0.03,
  },

  {
    id: 't2_drowned_knight_blade',
    name: 'Клинок Рыцаря-Утопленника',
    description: 'Эпический меч второго яруса. Принадлежал рыцарю, которого похоронили под чёрной водой.',
    slot: 'weapon',
    rarity: 'epic',
    minFloor: 26,
    weaponType: 'sword',
    bonusAttack: 27,
    bonusDefense: 4,
  },
  {
    id: 't2_defiler_of_fallen',
    name: 'Осквернитель Павших',
    description: 'Эпический топор второго яруса. Его удары оставляют на камне грязные следы чёрной воды.',
    slot: 'weapon',
    rarity: 'epic',
    minFloor: 26,
    weaponType: 'axe',
    bonusAttack: 32,
  },
  {
    id: 't2_vengeful_spirit_katana',
    name: 'Катана Мстительного Духа',
    description: 'Эпическая катана второго яруса. Её лезвие звенит так, будто кто-то шепчет из воды.',
    slot: 'weapon',
    rarity: 'epic',
    minFloor: 26,
    weaponType: 'katana',
    bonusAttack: 28,
    bonusCritChance: 0.08,
  },
  {
    id: 't2_storm_breeze_hammer',
    name: 'Штормовой Бриз',
    description: 'Эпический молот второго яруса. Несмотря на название, удар ощущается как волна камня.',
    slot: 'weapon',
    rarity: 'epic',
    minFloor: 26,
    weaponType: 'hammer',
    bonusAttack: 33,
    bonusDefense: 5,
  },
  {
    id: 't2_abyss_acolyte_dagger',
    name: 'Кинжал Послушника Бездны',
    description: 'Эпический кинжал второго яруса. Им вскрывали печати у затопленных саркофагов.',
    slot: 'weapon',
    rarity: 'epic',
    minFloor: 26,
    weaponType: 'dagger',
    bonusAttack: 24,
    bonusCritChance: 0.10,
  },
  {
    id: 't2_black_waters_harpoon',
    name: 'Гарпун Чёрных Вод',
    description: 'Эпическое копьё второго яруса. Его наконечник вытаскивает врагов из глубины.',
    slot: 'weapon',
    rarity: 'epic',
    minFloor: 26,
    weaponType: 'spear',
    bonusAttack: 29,
    bonusCritChance: 0.04,
  },

  {
    id: 't2_sarcophagus_water_cutter',
    name: 'Саркофажный Рассекатель Воды',
    description: 'Легендарный меч второго яруса. Рассекает воду так же легко, как мокрую плоть.',
    slot: 'weapon',
    rarity: 'legendary',
    minFloor: 26,
    weaponType: 'sword',
    bonusAttack: 36,
    bonusDefense: 5,
  },
  {
    id: 't2_sluice_chain_splitter',
    name: 'Разрубатель Шлюзовых Цепей',
    description: 'Легендарный топор второго яруса. Создан, чтобы рубить цепи чёрного шлюза.',
    slot: 'weapon',
    rarity: 'legendary',
    minFloor: 26,
    weaponType: 'axe',
    bonusAttack: 42,
  },
  {
    id: 't2_black_ripple_cutter',
    name: 'Рассекатель Чёрной Ряби',
    description: 'Легендарная катана второго яруса. После удара на воде остаётся чёрная линия.',
    slot: 'weapon',
    rarity: 'legendary',
    minFloor: 26,
    weaponType: 'katana',
    bonusAttack: 37,
    bonusCritChance: 0.11,
  },
  {
    id: 't2_deaf_bell_strike',
    name: 'Удар Глухого Колокола',
    description: 'Легендарный молот второго яруса. Его удар звучит как подводный погребальный колокол.',
    slot: 'weapon',
    rarity: 'legendary',
    minFloor: 26,
    weaponType: 'hammer',
    bonusAttack: 43,
    bonusDefense: 7,
  },
  {
    id: 't2_bottom_beast_fangs',
    name: 'Парные Клыки Донной Твари',
    description: 'Легендарные кинжалы второго яруса. Быстрые, как зубы твари, скрытой под водой.',
    slot: 'weapon',
    rarity: 'legendary',
    minFloor: 26,
    weaponType: 'dagger',
    bonusAttack: 32,
    bonusCritChance: 0.13,
  },
  {
    id: 't2_bottom_rift_piercer',
    name: 'Пронзатель Донного Разлома',
    description: 'Легендарное копьё второго яруса. Наконечник выкован из осколка донного разлома.',
    slot: 'weapon',
    rarity: 'legendary',
    minFloor: 26,
    weaponType: 'spear',
    bonusAttack: 38,
    bonusCritChance: 0.06,
  },
  {
    id: 't2_black_sluice_trident',
    name: 'Трезубец Чёрного Шлюза',
    description: 'Единственный легендарный трезубец второго яруса. Его зубцы держат силу чёрной воды.',
    slot: 'weapon',
    rarity: 'legendary',
    minFloor: 26,
    weaponType: 'trident',
    bonusAttack: 40,
    bonusDefense: 3,
    bonusCritChance: 0.07,
    bonusEnergy: 1,
  },

  // Броня второго яруса
  {
    id: 't2_wet_crypt_guard_armor',
    name: 'Мокрый доспех склепного стража',
    description: 'Обычная броня второго яруса. Старые пластины постоянно покрыты водой.',
    slot: 'armor',
    rarity: 'common',
    minFloor: 26,
    bonusHp: 40,
    bonusDefense: 5,
  },
  {
    id: 't2_rusty_drowned_chainmail',
    name: 'Ржавая кольчуга утопленника',
    description: 'Редкая броня второго яруса. Кольца скрипят от ржавчины, но держат удар.',
    slot: 'armor',
    rarity: 'rare',
    minFloor: 26,
    bonusHp: 60,
    bonusDefense: 7,
  },
  {
    id: 't2_silt_overseer_carapace',
    name: 'Панцирь Илового Надзирателя',
    description: 'Эпическая броня второго яруса. Ил и камень срослись в тяжёлый панцирь.',
    slot: 'armor',
    rarity: 'epic',
    minFloor: 26,
    bonusHp: 85,
    bonusDefense: 10,
  },
  {
    id: 't2_drowned_knight_armor',
    name: 'Броня Утопленного Рыцаря',
    description: 'Легендарная броня второго яруса. Её носил рыцарь, охранявший чёрный шлюз.',
    slot: 'armor',
    rarity: 'legendary',
    minFloor: 26,
    bonusHp: 120,
    bonusDefense: 14,
    bonusStrength: 2,
  },

  // Амулеты второго яруса
  {
    id: 't2_wet_bone_amulet',
    name: 'Амулет мокрой кости',
    description: 'Обычный амулет второго яруса. Внутри слышно тихое капание воды.',
    slot: 'trinket',
    rarity: 'common',
    minFloor: 26,
    bonusHp: 20,
    bonusLuck: 2,
  },
  {
    id: 't2_rusted_chain_charm',
    name: 'Оберег Ржавой Цепи',
    description: 'Редкий амулет второго яруса. Малое звено цепи, не желающее тонуть.',
    slot: 'trinket',
    rarity: 'rare',
    minFloor: 26,
    bonusDefense: 4,
    bonusLuck: 2,
  },
  {
    id: 't2_black_water_drop',
    name: 'Капля Чёрной Воды',
    description: 'Эпический амулет второго яруса. Капля внутри камня никогда не высыхает.',
    slot: 'trinket',
    rarity: 'epic',
    minFloor: 26,
    bonusEnergy: 1,
    bonusIntelligence: 3,
    bonusCritChance: 0.03,
  },
  {
    id: 't2_flooded_sarcophagus_seal',
    name: 'Печать Затопленного Саркофага',
    description: 'Легендарный амулет второго яруса. Печать древнего саркофага защищает владельца от глубины.',
    slot: 'trinket',
    rarity: 'legendary',
    minFloor: 26,
    bonusHp: 45,
    bonusDefense: 5,
    bonusEnergy: 1,
    bonusIntelligence: 3,
  },

  // Единственный мифический предмет второго яруса — только с Арквелла
  {
    id: 'arkwell_black_sluice_heart',
    name: 'Сердце Чёрного Шлюза',
    description: 'Мифический трофей Арквелла. Окаменевшее сердце древнего хранителя, внутри которого слышен глухой шум подземной воды.',
    slot: 'trinket',
    rarity: 'mythic',
    minFloor: 50,
    bossOnly: true,
    sourceEnemyId: 'arkwell_drowned_keeper',
    bonusHp: 20,
    bonusEnergy: 1,
    bonusDefense: 5,
  },

];

export function getItemById(id: string): ItemData | undefined {
  return items.find(item => item.id === id);
}

export const LOOT_RARITY_CHANCES: Array<{
  rarity: Exclude<ItemRarity, 'mythic'>;
  chance: number;
}> = [
  { rarity: 'common', chance: 0.58 },
  { rarity: 'rare', chance: 0.28 },
  { rarity: 'epic', chance: 0.11 },
  { rarity: 'legendary', chance: 0.03 },
];

export function rollLootRarity(): Exclude<ItemRarity, 'mythic'> {
  const roll = Math.random();
  let accumulatedChance = 0;

  for (const entry of LOOT_RARITY_CHANCES) {
    accumulatedChance += entry.chance;

    if (roll <= accumulatedChance) {
      return entry.rarity;
    }
  }

  return 'common';
}

export function isItemAvailableOnFloor(item: ItemData, floor = 1) {
  if (item.bossOnly) {
    return false;
  }

  const minFloor = item.minFloor ?? 1;
  const maxFloor = item.maxFloor ?? Number.MAX_SAFE_INTEGER;

  return floor >= minFloor && floor <= maxFloor;
}

export function getRandomLootItem(config?: {
  floor?: number;
  rarity?: Exclude<ItemRarity, 'mythic'>;
}): ItemData {
  const floor = config?.floor ?? 1;
  const rarity = config?.rarity ?? rollLootRarity();

  let possibleItems = items.filter(item => {
    return item.rarity === rarity && isItemAvailableOnFloor(item, floor);
  });

  if (possibleItems.length === 0) {
    possibleItems = items.filter(item => {
      return item.rarity === 'common' && isItemAvailableOnFloor(item, floor);
    });
  }

  if (possibleItems.length === 0) {
    possibleItems = items.filter(item => {
      return item.rarity === 'common' && !item.bossOnly;
    });
  }

  if (possibleItems.length === 0) {
    throw new Error('No loot items available.');
  }

  const index = Phaser.Math.Between(0, possibleItems.length - 1);
  return possibleItems[index];
}
