import Phaser from 'phaser';
import type { EquipmentSlot } from './player';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'cursed';

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
};

export const items: ItemData[] = [
  {
    id: 'rusty_sword',
    name: 'Ржавый меч',
    description: 'Старый клинок, который всё ещё способен вскрывать плоть.',
    slot: 'weapon',
    rarity: 'common',
    bonusAttack: 4,
  },
  {
    id: 'bone_axe',
    name: 'Костяной топор',
    description: 'Тяжёлый топор, собранный из костей неизвестного зверя.',
    slot: 'weapon',
    rarity: 'rare',
    bonusAttack: 7,
    bonusCritChance: 0.03,
  },
  {
    id: 'cultist_blade',
    name: 'Клинок культиста',
    description: 'Лезвие покрыто тёмными рунами и засохшей кровью.',
    slot: 'weapon',
    rarity: 'epic',
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
    id: 'beggar_king_blade',
    name: 'Клинок нищего короля',
    description: 'Проклятый клинок. Сила в нём есть, но цена неизвестна.',
    slot: 'weapon',
    rarity: 'cursed',
    bonusAttack: 14,
    bonusDefense: -1,
    bonusCritChance: 0.08,
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
    possibleItems = items.filter(item => item.rarity === 'cursed');
  }

  const index = Phaser.Math.Between(0, possibleItems.length - 1);
  return possibleItems[index];
}