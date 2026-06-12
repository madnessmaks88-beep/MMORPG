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

  bonusHp?: number;
  bonusAttack?: number;
  bonusDefense?: number;
  bonusCritChance?: number;

  weaponType?: WeaponType;
};

export type WeaponType =
  | 'dagger'
  | 'axe'
  | 'katana'
  | 'hammer'
  | 'shield_sword'
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
    id: 'worn_armor',
    name: 'Потрёпанная броня',
    description: 'Простая броня с трещинами и следами старых ударов.',
    slot: 'armor',
    rarity: 'common',
    bonusHp: 15,
    bonusDefense: 2,
  },
  {
    id: 'grave_guard_armor',
    name: 'Доспех могильного стража',
    description: 'Тяжёлый доспех, пахнущий сырой землёй.',
    slot: 'armor',
    rarity: 'rare',
    bonusHp: 30,
    bonusDefense: 4,
  },
  {
    id: 'ring_of_forgotten',
    name: 'Кольцо забытых',
    description: 'Тусклое кольцо, от которого веет холодом.',
    slot: 'trinket',
    rarity: 'rare',
    bonusCritChance: 0.05,
  },
  {
    id: 'black_amulet',
    name: 'Чёрный амулет',
    description: 'Амулет будто шепчет, когда рядом умирают.',
    slot: 'trinket',
    rarity: 'epic',
    bonusHp: 20,
    bonusAttack: 3,
    bonusCritChance: 0.04,
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
    // Катаны
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

  // Топоры
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

  // Мечи
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
  // Щит-мечи
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

  // Кинжалы
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

  // Молоты
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
];

export function getItemById(id: string): ItemData | undefined {
  return items.find(item => item.id === id);
}



export function getRandomLootItem(): ItemData {
  const roll = Math.random();

  let possibleItems = items.filter(item => item.rarity === 'common');

  if (roll > 0.55) {
    possibleItems = items.filter(item => item.rarity === 'rare');
  }

  if (roll > 0.85) {
    possibleItems = items.filter(item => item.rarity === 'epic');
  }

  if (roll > 0.96) {
    possibleItems = items.filter(item => item.rarity === 'legendary');
  }

  const index = Phaser.Math.Between(0, possibleItems.length - 1);
  return possibleItems[index];
}