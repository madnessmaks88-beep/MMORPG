export type RaceId =
  | 'human'
  | 'tainted_halfblood'
  | 'stoneborn'
  | 'night_elf'
  | 'goblin'
  | 'demon';

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
    description: 'Сбалансированный выживальщик. Не лучший ни в чём, но способен адаптироваться к любой ситуации.',

    hp: 11,
    defense: 11,
    agility: 11,
    strength: 11,
    luck: 5,
    intelligence: 11,

    passiveName: 'Воля к борьбе',
    passiveDescription: 'Когда HP ниже 25%, получает +2 к атаке, защите, ловкости и интеллекту до конца боя.',

    activeName: 'Отчаянный удар',
    activeDescription: '3 энергии. Перезарядка 2 хода. Чем меньше HP, тем выше урон.',
  },

  {
    id: 'tainted_halfblood',
    name: 'Полукровка Скверны',
    description: 'Опасный боец, сила которого раскрывается на грани смерти.',

    hp: 9,
    defense: 8,
    agility: 12,
    strength: 14,
    luck: 6,
    intelligence: 10,

    passiveName: 'Кровь Скверны',
    passiveDescription: 'Когда HP ниже 35%, получает +3 к атаке и +8% к шансу крита.',

    activeName: 'Проклятый рывок',
    activeDescription: '2 энергии. Перезарядка 3 хода. Наносит высокий урон, но тратит 5% максимального HP.',
  },

  {
    id: 'stoneborn',
    name: 'Камнерожденный',
    description: 'Медленный, тяжёлый и живучий воин подземных крепостей.',

    hp: 14,
    defense: 15,
    agility: 6,
    strength: 12,
    luck: 4,
    intelligence: 8,

    passiveName: 'Каменная кожа',
    passiveDescription: 'Каждый полученный удар уменьшается на 2 урона. Шанс уклонения ниже на 30%.',

    activeName: 'Глухая стойка',
    activeDescription: '2 энергии. Перезарядка 3 хода. Следующий удар врага наносит на 60% меньше урона.',
  },

  {
    id: 'night_elf',
    name: 'Ночной эльф-изгнанник',
    description: 'Ловкий изгнанник, который выживает за счёт скорости и точных ударов.',

    hp: 10,
    defense: 7,
    agility: 16,
    strength: 10,
    luck: 8,
    intelligence: 12,

    passiveName: 'Танец теней',
    passiveDescription: 'После успешного уклонения следующая атака наносит на 25% больше урона.',

    activeName: 'Шаг в тень',
    activeDescription: '3 энергии. Перезарядка 4 хода. Гарантированно уклоняется от следующей атаки врага.',
  },

  {
    id: 'goblin',
    name: 'Гоблин',
    description: 'Жадный и хитрый выживальщик. Слаб в честном бою, но быстро богатеет и играет грязно.',

    hp: 9,
    defense: 7,
    agility: 15,
    strength: 9,
    luck: 14,
    intelligence: 9,

    passiveName: 'Жадные руки',
    passiveDescription: 'Получает на 20% больше золота после победы. Шанс добычи выше благодаря высокой удаче.',

    activeName: 'Подлый удар',
    activeDescription: '2 энергии. Перезарядка 3 хода. Наносит 90% урона и с шансом 50% ослабляет следующий удар врага на 25%.',
  },

  {
    id: 'demon',
    name: 'Демон',
    description: 'Агрессивное существо нижних разломов. Платит собственной кровью за огромный урон.',

    hp: 11,
    defense: 8,
    agility: 10,
    strength: 16,
    luck: 5,
    intelligence: 10,

    passiveName: 'Адская ярость',
    passiveDescription: 'Каждый раз, когда демон получает урон, он получает +1 к атаке до конца боя. Максимум +4.',

    activeName: 'Кровавое пламя',
    activeDescription: '2 энергии. Перезарядка 3 хода. Тратит 8% максимального HP и наносит 170% урона. Если HP ниже 40%, наносит 210%. При убийстве восстанавливает половину потраченного HP.',
  },
];

export function getRaceById(id: RaceId) {
  return races.find(race => race.id === id);
}