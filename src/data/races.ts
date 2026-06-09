export type RaceId = 'human';

export type RaceData = {
  id: RaceId;
  name: string;
  description: string;

  hp: number;
  defense: number;
  agility: number;
  strength: number;
  luck: number;
  intelligence: number;

  passiveName: string;
  passiveDescription: string;

  activeName: string;
  activeDescription: string;
};

export const races: RaceData[] = [
  {
    id: 'human',
    name: 'Человек',
    description: 'Упорный странник, способный выживать там, где другие ломаются.',

    hp: 11,
    defense: 11,
    agility: 11,
    strength: 11,
    luck: 5,
    intelligence: 11,

    passiveName: 'Воля к борьбе',
    passiveDescription:
      'Когда HP ниже 25%, все характеристики, кроме HP и удачи, увеличиваются на 2 до конца боя.',

    activeName: 'Отчаянный удар',
    activeDescription:
      'Базовый урон навыка: 8%. За каждые 2% потерянного HP добавляется +1% к урону навыка. Кулдаун: 2 хода. Стоимость: 3 энергии.',
  },
];

export function getRaceById(id: RaceId): RaceData {
  return races.find(race => race.id === id) ?? races[0];
}