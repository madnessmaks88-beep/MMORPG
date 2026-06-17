export type DungeonEventId =
  | 'black_water_altar'
  | 'sarcophagus_prisoner'
  | 'grave_trader'
  | 'sacrificial_chains'
  | 'morvein_mirror'
  | 'bone_lottery'
  | 'idris_first_meeting'
  | 'life_lake'
  | 'cursed_lake'
  | 'idris_wounded'
  | 'idris_corpse';

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
  | 'lottery_leave'
  | 'idris_accept'
  | 'idris_refuse_fight'
  | 'idris_ignore'
  | 'life_lake_fill_flask'
  | 'life_lake_drink'
  | 'life_lake_leave'
  | 'cursed_lake_touch'
  | 'cursed_lake_purify'
  | 'cursed_lake_leave'
  | 'idris_wounded_restore'
  | 'idris_wounded_take_amulet'
  | 'idris_wounded_leave'
  | 'idris_corpse_take_oath'
  | 'idris_corpse_pray'
  | 'idris_corpse_leave';

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
  {
    id: 'idris_first_meeting',
    title: 'Идрис у последнего огонька',
    shortTitle: 'Одинокий рыцарь',
    description:
      'Вдалеке дрожит слабый огонёк. У стены сидит облочённый рыцарь в потемневших доспехах. Он поднимает ладонь, не хватаясь за меч, и просит выслушать его.',
    icon: '♞',
    accent: 0xb89a5e,
    choices: [
      {
        id: 'idris_accept',
        title: 'Выслушать Идриса',
        subtitle: 'Принять просьбу найти Озеро Жизни и наполнить флакон.',
        icon: '✦',
      },
      {
        id: 'idris_refuse_fight',
        title: 'Отказать и обнажить оружие',
        subtitle: 'Идрис решит, что ты хочешь забрать его последнюю надежду.',
        icon: '⚔',
        danger: true,
      },
      {
        id: 'idris_ignore',
        title: 'Уйти молча',
        subtitle: 'Не принимать чужую боль на себя.',
        icon: '➤',
      },
    ],
  },
  {
    id: 'life_lake',
    title: 'Озеро Жизни',
    shortTitle: 'Озеро Жизни',
    description:
      'Под каменными арками светится тихая вода. Она не отражает потолок — только лица тех, кто ещё может быть спасён.',
    icon: '♒',
    accent: 0x7fa8c9,
    choices: [
      {
        id: 'life_lake_fill_flask',
        title: 'Наполнить флакон Идриса',
        subtitle: 'Сохранить воду для больной дочери рыцаря. Герой тоже восстановит HP.',
        icon: '♒',
      },
      {
        id: 'life_lake_drink',
        title: 'Испить самому',
        subtitle: 'Полностью восстановить HP, но просьба Идриса будет сорвана.',
        icon: '♥',
        danger: true,
      },
      {
        id: 'life_lake_leave',
        title: 'Не трогать воду',
        subtitle: 'Оставить озеро нетронутым и идти дальше.',
        icon: '➤',
      },
    ],
  },
  {
    id: 'cursed_lake',
    title: 'Проклятое озеро',
    shortTitle: 'Проклятая вода',
    description:
      'В низине стоит чёрная вода. Она похожа на Озеро Жизни, но от неё пахнет железом, сырой землёй и чужим страхом.',
    icon: '♒',
    accent: 0x6b4a8c,
    choices: [
      {
        id: 'cursed_lake_touch',
        title: 'Коснуться воды',
        subtitle: 'Получить опыт и материал, но потерять HP.',
        icon: '☾',
        danger: true,
      },
      {
        id: 'cursed_lake_purify',
        title: 'Бросить монету в глубину',
        subtitle: 'Потратить золото и попытаться вытащить самоцвет.',
        icon: '¤',
      },
      {
        id: 'cursed_lake_leave',
        title: 'Обойти стороной',
        subtitle: 'Не доверять воде, которая не отражает свет.',
        icon: '➤',
      },
    ],
  },
  {
    id: 'idris_wounded',
    title: 'Раненый Идрис',
    shortTitle: 'Идрис при смерти',
    description:
      'После боя в боковом зале лежит Идрис. Доспехи пробиты, огонёк рядом почти погас. Он узнаёт тебя и с трудом вытягивает руку.',
    icon: '♞',
    accent: 0x8f2f2f,
    choices: [
      {
        id: 'idris_wounded_restore',
        title: 'Использовать флакон жизни',
        subtitle: 'Попытаться спасти Идриса. Позже его путь может закончиться глубже.',
        icon: '♒',
      },
      {
        id: 'idris_wounded_take_amulet',
        title: 'Взять амулет для дочери',
        subtitle: 'Оставить рыцаря и выполнить его последнюю просьбу в городе.',
        icon: '◇',
        danger: true,
      },
      {
        id: 'idris_wounded_leave',
        title: 'Оставить его',
        subtitle: 'Не вмешиваться. Иногда милосердие тяжелее меча.',
        icon: '➤',
        danger: true,
      },
    ],
  },
  {
    id: 'idris_corpse',
    title: 'Последний след Идриса',
    shortTitle: 'Труп рыцаря',
    description:
      'В глубине катакомб ты находишь знакомый шлем. Идрис дошёл дальше, чем должен был. Его меч вбит в камень, а рядом лежит обломок детской ленты.',
    icon: '♞',
    accent: 0x5f5a50,
    choices: [
      {
        id: 'idris_corpse_take_oath',
        title: 'Принять его клятву',
        subtitle: 'Забрать оружие и броню как память о последнем пути рыцаря.',
        icon: '✦',
      },
      {
        id: 'idris_corpse_pray',
        title: 'Склонить голову',
        subtitle: 'Получить опыт и оставить снаряжение нетронутым.',
        icon: '☥',
      },
      {
        id: 'idris_corpse_leave',
        title: 'Уйти',
        subtitle: 'Не тревожить мёртвого.',
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

type WeightedDungeonEvent = {
  id: DungeonEventId;
  weight: number;
};

function weightedEventRoll(pool: WeightedDungeonEvent[]): DungeonEventId {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of pool) {
    roll -= item.weight;

    if (roll <= 0) {
      return item.id;
    }
  }

  return pool[pool.length - 1]?.id ?? 'bone_lottery';
}

export function getDungeonEventWeightsForFloor(floor: number): WeightedDungeonEvent[] {
  if (floor <= 3) {
    return [
      { id: 'sarcophagus_prisoner', weight: 34 },
      { id: 'sacrificial_chains', weight: 26 },
      { id: 'bone_lottery', weight: 26 },
      { id: 'morvein_mirror', weight: 14 },
    ];
  }

  if (floor <= 14) {
    return [
      { id: 'sarcophagus_prisoner', weight: 22 },
      { id: 'sacrificial_chains', weight: 19 },
      { id: 'bone_lottery', weight: 18 },
      { id: 'morvein_mirror', weight: 13 },
      { id: 'black_water_altar', weight: 10 },
      { id: 'grave_trader', weight: 9 },
      { id: 'cursed_lake', weight: 9 },
    ];
  }

  return [
    { id: 'sarcophagus_prisoner', weight: 17 },
    { id: 'sacrificial_chains', weight: 16 },
    { id: 'bone_lottery', weight: 15 },
    { id: 'morvein_mirror', weight: 16 },
    { id: 'black_water_altar', weight: 15 },
    { id: 'grave_trader', weight: 11 },
    { id: 'cursed_lake', weight: 10 },
  ];
}

export function getRandomDungeonEventId(floor: number): DungeonEventId {
  return weightedEventRoll(getDungeonEventWeightsForFloor(floor));
}
