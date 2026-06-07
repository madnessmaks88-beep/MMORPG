export type EnemyData = {
  id: string;
  name: string;

  hp: number;
  maxHp: number;

  attack: number;
  defense: number;

  expReward: number;
  goldReward: number;
};

export const enemies: EnemyData[] = [
  {
    id: 'rotting_skeleton',
    name: 'Гнилой скелет',
    hp: 45,
    maxHp: 45,
    attack: 8,
    defense: 1,
    expReward: 20,
    goldReward: 8,
  },
  {
    id: 'mad_cultist',
    name: 'Безумный культист',
    hp: 60,
    maxHp: 60,
    attack: 10,
    defense: 2,
    expReward: 32,
    goldReward: 13,
  },
  {
    id: 'bone_warden',
    name: 'Костяной смотритель',
    hp: 120,
    maxHp: 120,
    attack: 16,
    defense: 5,
    expReward: 100,
    goldReward: 45,
  },

  {
    id: 'plague_rat',
    name: 'Чумная крыса',
    hp: 75,
    maxHp: 75,
    attack: 14,
    defense: 2,
    expReward: 40,
    goldReward: 16,
  },
  {
    id: 'miner_ghoul',
    name: 'Шахтёр-упырь',
    hp: 95,
    maxHp: 95,
    attack: 17,
    defense: 4,
    expReward: 55,
    goldReward: 22,
  },
  {
    id: 'mold_butcher',
    name: 'Плесневый мясник',
    hp: 180,
    maxHp: 180,
    attack: 24,
    defense: 7,
    expReward: 150,
    goldReward: 75,
  },

  {
    id: 'nameless_knight',
    name: 'Безымянный рыцарь',
    hp: 140,
    maxHp: 140,
    attack: 25,
    defense: 8,
    expReward: 90,
    goldReward: 38,
  },
  {
    id: 'grave_mage',
    name: 'Могильный маг',
    hp: 120,
    maxHp: 120,
    attack: 30,
    defense: 5,
    expReward: 105,
    goldReward: 44,
  },
  {
    id: 'king_under_crypt',
    name: 'Король под склепом',
    hp: 280,
    maxHp: 280,
    attack: 36,
    defense: 12,
    expReward: 260,
    goldReward: 140,
  },
];