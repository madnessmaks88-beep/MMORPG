export type DungeonEventId =
  | 'black_water_altar'
  | 'sarcophagus_prisoner'
  | 'grave_trader'
  | 'sacrificial_chains'
  | 'morvein_mirror'
  | 'bone_lottery';

export type DungeonEventChoiceId =
  | 'altar_drink'
  | 'altar_weapon'
  | 'altar_break'
  | 'prisoner_open'
  | 'prisoner_demand'
  | 'prisoner_leave'
  | 'trader_buy'
  | 'trader_potion'
  | 'trader_leave'
  | 'chains_break'
  | 'chains_search'
  | 'chains_take'
  | 'mirror_look'
  | 'mirror_break'
  | 'mirror_touch'
  | 'lottery_throw'
  | 'lottery_load'
  | 'lottery_leave';

export type DungeonEventChoice = {
  id: DungeonEventChoiceId;
  title: string;
  subtitle: string;
  icon: string;
  danger?: boolean;
};

export type DungeonEventData = {
  id: DungeonEventId;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  accent: number;
  choices: DungeonEventChoice[];
};

export const DUNGEON_EVENTS: DungeonEventData[] = [
  {
    id: 'black_water_altar',
    title: 'Алтарь Чёрной Воды',
    shortTitle: 'Чёрный алтарь',
    description:
      'Из треснувшей чаши медленно течёт густая чёрная вода. Воздух вокруг холоднее, чем в остальных залах.',
    icon: '♒',
    accent: 0x5f7f9d,
    choices: [
      {
        id: 'altar_drink',
        title: 'Испить воду',
        subtitle: 'Потерять часть HP, но восстановить энергию.',
        icon: '♒',
        danger: true,
      },
      {
        id: 'altar_weapon',
        title: 'Омыть оружие',
        subtitle: 'Потратить кровь, чтобы получить силу для следующего шага.',
        icon: '†',
        danger: true,
      },
      {
        id: 'altar_break',
        title: 'Разбить алтарь',
        subtitle: 'Рискнуть ради редкого материала.',
        icon: '✦',
        danger: true,
      },
    ],
  },
  {
    id: 'sarcophagus_prisoner',
    title: 'Пленник в саркофаге',
    shortTitle: 'Голос из саркофага',
    description:
      'Изнутри каменного саркофага слышен слабый стук. Кто-то шепчет твоё имя, хотя ты его не называл.',
    icon: '▤',
    accent: 0xb89a5e,
    choices: [
      {
        id: 'prisoner_open',
        title: 'Открыть крышку',
        subtitle: 'Можно найти награду, но внутри может быть засада.',
        icon: '▤',
        danger: true,
      },
      {
        id: 'prisoner_demand',
        title: 'Потребовать плату',
        subtitle: 'Получить золото, но принять проклятый откат.',
        icon: '¤',
        danger: true,
      },
      {
        id: 'prisoner_leave',
        title: 'Пройти мимо',
        subtitle: 'Не рисковать и продолжить путь.',
        icon: '➤',
      },
    ],
  },
  {
    id: 'grave_trader',
    title: 'Могильный торговец',
    shortTitle: 'Могильный торговец',
    description:
      'Старик в погребальной маске сидит между костями и ржавыми лампами. Его товар пахнет землёй и пеплом.',
    icon: '◈',
    accent: 0xd8c088,
    choices: [
      {
        id: 'trader_buy',
        title: 'Купить тёмный свёрток',
        subtitle: '350 золота за редкий материал.',
        icon: '✦',
      },
      {
        id: 'trader_potion',
        title: 'Обменять зелье',
        subtitle: 'Отдать 1 зелье за золото и мелкий материал.',
        icon: '♢',
      },
      {
        id: 'trader_leave',
        title: 'Не связываться',
        subtitle: 'Уйти без сделки.',
        icon: '➤',
      },
    ],
  },
  {
    id: 'sacrificial_chains',
    title: 'Комната жертвенных цепей',
    shortTitle: 'Жертвенные цепи',
    description:
      'С потолка свисают тяжёлые цепи. На крюках остались старые кости и куски погребальных доспехов.',
    icon: '⛓',
    accent: 0x8d877b,
    choices: [
      {
        id: 'chains_break',
        title: 'Разорвать цепи',
        subtitle: 'Проверка силы. Успех даст опыт и материал.',
        icon: '⛓',
        danger: true,
      },
      {
        id: 'chains_search',
        title: 'Осмотреть тела',
        subtitle: 'Можно найти добычу, но легко задеть ловушку.',
        icon: '☠',
        danger: true,
      },
      {
        id: 'chains_take',
        title: 'Снять ржавую цепь',
        subtitle: 'Получить материал ценой крови.',
        icon: '✦',
        danger: true,
      },
    ],
  },
  {
    id: 'morvein_mirror',
    title: 'Зеркало Морвеина',
    shortTitle: 'Проклятое зеркало',
    description:
      'В старом зеркале отражается не твоё лицо, а тёмный зал, где ты уже лежишь среди мёртвых.',
    icon: '◐',
    accent: 0x62518a,
    choices: [
      {
        id: 'mirror_look',
        title: 'Посмотреть глубже',
        subtitle: 'Потерять HP и получить опыт.',
        icon: '◐',
        danger: true,
      },
      {
        id: 'mirror_break',
        title: 'Разбить зеркало',
        subtitle: 'Случайный исход: энергия, золото или боль.',
        icon: '✧',
        danger: true,
      },
      {
        id: 'mirror_touch',
        title: 'Коснуться отражения',
        subtitle: 'Большой опыт за большую цену HP.',
        icon: '☾',
        danger: true,
      },
    ],
  },
  {
    id: 'bone_lottery',
    title: 'Костяная лотерея',
    shortTitle: 'Костяные кубики',
    description:
      'На каменной плите лежат шесть костяных кубиков. Их грани шевелятся, будто ждут твоей руки.',
    icon: '⚂',
    accent: 0xb89a5e,
    choices: [
      {
        id: 'lottery_throw',
        title: 'Бросить кости',
        subtitle: 'Случайный результат. Удача улучшает бросок.',
        icon: '⚂',
        danger: true,
      },
      {
        id: 'lottery_load',
        title: 'Подкупить судьбу',
        subtitle: 'Потратить 100 золота и бросить с преимуществом.',
        icon: '¤',
      },
      {
        id: 'lottery_leave',
        title: 'Не играть',
        subtitle: 'Слишком тихо для честной игры.',
        icon: '➤',
      },
    ],
  },
];

const dungeonEventById = DUNGEON_EVENTS.reduce((acc, event) => {
  acc[event.id] = event;
  return acc;
}, {} as Record<DungeonEventId, DungeonEventData>);

export function getDungeonEventById(id?: string): DungeonEventData | undefined {
  return dungeonEventById[id as DungeonEventId];
}

export function getDungeonEventChoiceById(
  eventId: DungeonEventId,
  choiceId: DungeonEventChoiceId
) {
  return dungeonEventById[eventId]?.choices.find(choice => choice.id === choiceId);
}

export function getRandomDungeonEventId(floor: number): DungeonEventId {
  const earlyEvents: DungeonEventId[] = [
    'sarcophagus_prisoner',
    'sacrificial_chains',
    'bone_lottery',
    'morvein_mirror',
  ];

  const allEvents = DUNGEON_EVENTS.map(event => event.id);

  const pool = floor <= 3
    ? earlyEvents
    : allEvents;

  return pool[Math.floor(Math.random() * pool.length)];
}
