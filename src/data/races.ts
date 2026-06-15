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
    defense: 10,
    agility: 11,
    strength: 11,
    luck: 6,
    intelligence: 11,

    passiveName: 'Воля к борьбе',
    passiveDescription: 'Когда HP ниже 30%, получает +2% к атаке, +2% к защите и +2% к ловкости до конца боя. Срабатывает один раз за бой.',

    activeName: 'Боевой настрой',
    activeDescription: 'Тратит 3 энергии. На 3 хода даёт +15% к урону и +10% к защите. Если HP ниже 50% — +20% к урону и +15% к защите. Если HP ниже 25% — +25% к урону и +20% к защите. Перезарядка: 4 хода.',
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
    passiveDescription: 'Когда HP ниже 35%, получает +3% к атаке и +8% к шансу критического удара.',

    activeName: 'Проклятый рывок',
    activeDescription: 'Тратит 2 энергии. Наносит 145% урона, но тратит 5% максимального HP. Если HP ниже 35%, наносит 170% урона. Перезарядка: 3 хода.',
  },

  {
    id: 'stoneborn',
    name: 'Камнерожденный',
    description: 'Медленный, тяжёлый и живучий воин подземных крепостей.',

    hp: 14,
    defense: 14,
    agility: 6,
    strength: 12,
    luck: 4,
    intelligence: 8,

    passiveName: 'Каменная кожа',
    passiveDescription: 'Каждый входящий удар получает -2% урона. Шанс уклонения ниже на 30%.',

    activeName: 'Кварцевые шипы',
    activeDescription: 'Тратит 2 энергии. На следующие 2 хода даёт +10% к защите и возвращает врагу 30% полученного урона шипами. Перезарядка: 3 хода.',
  },

  {
    id: 'night_elf',
    name: 'Ночной эльф-изгнанник',
    description: 'Ловкий изгнанник, который выживает за счёт скорости, теней и точных ответных ударов.',

    hp: 10,
    defense: 7,
    agility: 15,
    strength: 10,
    luck: 8,
    intelligence: 12,

    passiveName: 'Танец теней',
    passiveDescription: 'После успешного уклонения следующая атака наносит +25% урона и гарантированно накладывает кровотечение на врага.',

    activeName: 'Шаг в тень',
    activeDescription: 'Тратит 3 энергии. На 3 хода даёт 50% шанс уклониться от атаки врага. Перезарядка: 4 хода.',
  },

  {
    id: 'goblin',
    name: 'Гоблин',
    description: 'Жадный и хитрый выживальщик. Слаб в честном бою, но быстро богатеет и играет через выгоду.',

    hp: 9,
    defense: 7,
    agility: 14,
    strength: 9,
    luck: 13,
    intelligence: 9,

    passiveName: 'Жадные руки',
    passiveDescription: 'Получает +20% золота после победы и +5% к шансу дополнительного материала.',

    activeName: 'Воровская метка',
    activeDescription: 'Тратит 3 энергии. Помечает врага на 3 хода. Помеченный враг получает на 20% больше урона от гоблина. Если враг умирает под меткой, гоблин получает +25% золота за бой и 10% шанс получить дополнительный материал. Перезарядка: 4 хода.',
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
    passiveDescription: 'Каждый раз, когда демон получает урон, он получает +1% к атаке до конца боя. Максимум: +5%.',

    activeName: 'Кровавое пламя',
    activeDescription: 'Тратит 2 энергии и 8% максимального HP. Наносит 160% урона. Если HP ниже 35%, наносит 200% урона. При убийстве восстанавливает половину потраченного HP. Перезарядка: 3 хода.',
  },
];

export function getRaceById(id: RaceId) {
  return races.find(race => race.id === id);
}
