export type MaterialTier = 'small' | 'medium' | 'forge_core' | 'crystal';

export type MaterialId =
  | 'darkened_bone'
  | 'dim_gem'
  | 'old_leather'
  | 'dark_flame_heart'
  | 'black_gem'
  | 'cursed_seal'
  | 'black_sarcophagus_shard'
  | 'silt_bone'
  | 'rusted_armor_scale'
  | 'drowned_leather'
  | 'bottled_black_water'
  | 'rusted_chain_link'
  | 'mold_gem'
  | 'black_slime_heart'
  | 'flooded_sarcophagus_shard'
  | 'abyssal_bottom_seal'
  | 'drowned_guardian_eye';

export type MaterialData = {
  id: MaterialId;
  name: string;
  description: string;
  tier: MaterialTier;
};

export const materials: MaterialData[] = [
  {
    id: 'darkened_bone',
    name: 'Потемневшая кость',
    description: 'Кость, пропитанная пылью старого склепа. Используется для усиления оружия до +3.',
    tier: 'small',
  },
  {
    id: 'dim_gem',
    name: 'Тусклый самоцвет',
    description: 'Мутный камень с остатками погребальной магии. Используется для усиления оружия до +3.',
    tier: 'small',
  },
  {
    id: 'old_leather',
    name: 'Старая кожа',
    description: 'Иссохшая кожа с ремней и погребальных доспехов. Используется для усиления оружия до +3.',
    tier: 'small',
  },
  {
    id: 'dark_flame_heart',
    name: 'Сердце темного пламени',
    description: 'Горячий сгусток тьмы. Используется для усиления оружия до +5.',
    tier: 'medium',
  },
  {
    id: 'black_gem',
    name: 'Черный самоцвет',
    description: 'Камень, отражающий только темноту. Используется для усиления оружия до +5.',
    tier: 'medium',
  },
  {
    id: 'cursed_seal',
    name: 'Проклятая печать',
    description: 'Осколок древнего запрета. Используется для усиления редкого оружия до +5.',
    tier: 'medium',
  },
  {
    id: 'black_sarcophagus_shard',
    name: 'Осколок черного саркофага',
    description: 'Главный материал Морвеина. Прокачивает наковальню.',
    tier: 'forge_core',
  },
  // =========================
  // Материалы второго яруса — Затопленные усыпальницы
  // =========================
  {
    id: 'silt_bone',
    name: 'Иловая кость',
    description: 'Кость утопленника, пропитанная илом и чёрной водой. Используется для усиления оружия второго яруса.',
    tier: 'small',
  },
  {
    id: 'rusted_armor_scale',
    name: 'Ржавая чешуя доспеха',
    description: 'Кусок проржавевшей брони утопленного стража. Нужен для прочных и тяжёлых улучшений.',
    tier: 'small',
  },
  {
    id: 'drowned_leather',
    name: 'Мокрая кожа утопленника',
    description: 'Размокшая кожа с ремней и доспехов мёртвых. Подходит для рукоятей, катан и кинжалов.',
    tier: 'small',
  },
  {
    id: 'bottled_black_water',
    name: 'Чёрная вода в склянке',
    description: 'Склянка густой воды из затопленных усыпальниц. Усиливает проклятые и быстрые клинки.',
    tier: 'medium',
  },
  {
    id: 'rusted_chain_link',
    name: 'Ржавое звено цепи',
    description: 'Тяжёлое звено от цепей затопленного яруса. Нужен для топоров, молотов и оружия контроля.',
    tier: 'medium',
  },
  {
    id: 'mold_gem',
    name: 'Плесневый самоцвет',
    description: 'Самоцвет с холодным зелёным налётом. Хранит остатки магии чёрной воды.',
    tier: 'medium',
  },
  {
    id: 'black_slime_heart',
    name: 'Сердце чёрного слизня',
    description: 'Пульсирующий сгусток чёрной жижи. Нужен для эпических улучшений оружия.',
    tier: 'medium',
  },
  {
    id: 'flooded_sarcophagus_shard',
    name: 'Осколок затопленного саркофага',
    description: 'Тяжёлый каменный осколок из саркофага, простоявшего под водой десятки лет.',
    tier: 'medium',
  },
  {
    id: 'abyssal_bottom_seal',
    name: 'Печать донной бездны',
    description: 'Редкая печать нижних усыпальниц. Требуется для высоких уровней улучшения оружия.',
    tier: 'forge_core',
  },
  {
    id: 'drowned_guardian_eye',
    name: 'Глаз утопленного хранителя',
    description: 'Боссовый материал, вырванный из стража чёрного шлюза. Используется для предельного усиления оружия.',
    tier: 'forge_core',
  },

];

export function getMaterialById(id: MaterialId) {
  return materials.find(material => material.id === id);
}

export function getMaterialName(id: MaterialId) {
  return getMaterialById(id)?.name ?? id;
}