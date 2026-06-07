export type QuestType =
  | 'kill_enemies'
  | 'open_chests'
  | 'complete_dungeons'
  | 'earn_gold';

export type QuestData = {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  target: number;
  rewardGold: number;
  rewardExp: number;
  rewardPotions?: number;
};

export const quests: QuestData[] = [
  {
    id: 'first_blood',
    title: 'Первая кровь',
    description: 'Победи 3 врагов в катакомбах.',
    type: 'kill_enemies',
    target: 3,
    rewardGold: 25,
    rewardExp: 25,
  },
  {
    id: 'grave_looter',
    title: 'Мародёр тьмы',
    description: 'Открой 2 сундука.',
    type: 'open_chests',
    target: 2,
    rewardGold: 35,
    rewardExp: 20,
    rewardPotions: 1,
  },
  {
    id: 'first_descent',
    title: 'Первый спуск',
    description: 'Пройди 1 подземелье полностью.',
    type: 'complete_dungeons',
    target: 1,
    rewardGold: 70,
    rewardExp: 60,
    rewardPotions: 2,
  },
  {
    id: 'gold_smell',
    title: 'Запах золота',
    description: 'Заработай 150 золота.',
    type: 'earn_gold',
    target: 150,
    rewardGold: 100,
    rewardExp: 50,
  },
];