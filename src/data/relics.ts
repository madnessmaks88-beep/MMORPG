export type RelicId =
  | 'crypt_heart'
  | 'ashen_seal'
  | 'catacomb_core';

export type RelicData = {
  id: RelicId;
  tier: number;
  name: string;
  description: string;

  bonusHp?: number;
  bonusAttack?: number;
  bonusDefense?: number;
  bonusAgility?: number;
  bonusLuck?: number;
  bonusStrength?: number;
  bonusIntelligence?: number;
  bonusEnergy?: number;
};

export const relics: RelicData[] = [
  {
    id: 'crypt_heart',
    tier: 1,
    name: 'Сердце склепа',
    description: 'Тёплый осколок мёртвого яруса. Делает героя крепче.',
    bonusHp: 10,
    bonusDefense: 1,
  },
  {
    id: 'ashen_seal',
    tier: 2,
    name: 'Пепельная печать',
    description: 'Знак тех, кто пережил пепельные глубины.',
    bonusStrength: 1,
    bonusAgility: 1,
    bonusLuck: 1,
  },
  {
    id: 'catacomb_core',
    tier: 3,
    name: 'Сердце Катакомб',
    description: 'Живое ядро тьмы. Дарует силу, но напоминает о цене спуска.',
    bonusEnergy: 1,
    bonusIntelligence: 2,
    bonusAttack: 2,
  },
];

export function getRelicById(id: RelicId): RelicData | undefined {
  return relics.find(relic => relic.id === id);
}

export function getRelicByTier(tier: number): RelicData | undefined {
  return relics.find(relic => relic.tier === tier);
}