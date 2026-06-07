export type DungeonRoomType = 'enemy' | 'chest' | 'trap' | 'boss';

export type DungeonRoom = {
  id: number;
  type: DungeonRoomType;
  title: string;
  description: string;
  enemyId?: string;
  goldReward?: number;
  expReward?: number;
  trapDamage?: number;
};

export type DungeonData = {
  id: string;
  name: string;
  description: string;
  recommendedLevel: number;
  nextDungeonId?: string;
  rooms: DungeonRoom[];
};

export const dungeons: DungeonData[] = [
  {
    id: 'old_catacombs',
    name: 'Старые катакомбы',
    description: 'Первый ярус подземелий. Здесь ещё можно услышать собственное дыхание.',
    recommendedLevel: 1,
    nextDungeonId: 'rotten_mines',
    rooms: [
      {
        id: 1,
        type: 'enemy',
        title: 'Сырые ступени',
        description: 'Ты слышишь скрежет костей впереди.',
        enemyId: 'rotting_skeleton',
      },
      {
        id: 2,
        type: 'chest',
        title: 'Заброшенная ниша',
        description: 'В стене спрятан старый деревянный сундук.',
        goldReward: 15,
        expReward: 5,
      },
      {
        id: 3,
        type: 'trap',
        title: 'Плиты с рунами',
        description: 'Одна из плит под ногой проваливается вниз.',
        trapDamage: 18,
      },
      {
        id: 4,
        type: 'enemy',
        title: 'Зал сломанных свечей',
        description: 'Из темноты выходит человек в грязной рясе.',
        enemyId: 'mad_cultist',
      },
      {
        id: 5,
        type: 'boss',
        title: 'Костяные врата',
        description: 'Перед тобой поднимается хранитель первого яруса катакомб.',
        enemyId: 'bone_warden',
      },
    ],
  },

  {
    id: 'rotten_mines',
    name: 'Гнилые шахты',
    description: 'Старые шахты под катакомбами. Воздух здесь густой, как болезнь.',
    recommendedLevel: 3,
    nextDungeonId: 'hall_of_nameless',
    rooms: [
      {
        id: 1,
        type: 'enemy',
        title: 'Проваленный тоннель',
        description: 'Из щели в камне выползает огромная чумная крыса.',
        enemyId: 'plague_rat',
      },
      {
        id: 2,
        type: 'trap',
        title: 'Сгнившие балки',
        description: 'Потолок осыпается, и острые камни падают вниз.',
        trapDamage: 28,
      },
      {
        id: 3,
        type: 'chest',
        title: 'Сундук шахтёра',
        description: 'В грязи лежит ящик с ржавым замком.',
        goldReward: 35,
        expReward: 18,
      },
      {
        id: 4,
        type: 'enemy',
        title: 'Затопленная выработка',
        description: 'Из чёрной воды поднимается бывший шахтёр.',
        enemyId: 'miner_ghoul',
      },
      {
        id: 5,
        type: 'boss',
        title: 'Мясная яма',
        description: 'Среди гниющих тел стоит огромная фигура с тесаком.',
        enemyId: 'mold_butcher',
      },
    ],
  },

  {
    id: 'hall_of_nameless',
    name: 'Зал безымянных',
    description: 'Здесь нет имён. Только шлемы, кости и старые клятвы.',
    recommendedLevel: 5,
    rooms: [
      {
        id: 1,
        type: 'enemy',
        title: 'Галерея шлемов',
        description: 'Рыцарь без лица медленно поднимает клинок.',
        enemyId: 'nameless_knight',
      },
      {
        id: 2,
        type: 'chest',
        title: 'Саркофаг без надписи',
        description: 'Крышка саркофага сдвинута, внутри что-то блестит.',
        goldReward: 60,
        expReward: 35,
      },
      {
        id: 3,
        type: 'enemy',
        title: 'Мёртвый алтарь',
        description: 'Могильный маг шепчет слова, от которых гаснут свечи.',
        enemyId: 'grave_mage',
      },
      {
        id: 4,
        type: 'trap',
        title: 'Клятва на крови',
        description: 'Древняя печать обжигает твою кожу.',
        trapDamage: 42,
      },
      {
        id: 5,
        type: 'boss',
        title: 'Трон под склепом',
        description: 'Король мёртвых поднимается с каменного трона.',
        enemyId: 'king_under_crypt',
      },
    ],
  },
];

export function getDungeonById(id: string): DungeonData {
  const dungeon = dungeons.find(dungeon => dungeon.id === id);

  if (!dungeon) {
    return dungeons[0];
  }

  return dungeon;
}