export type MaterialTier = 'small' | 'medium' | 'forge_core' | 'crystal';

export type MaterialId =
  | 'darkened_bone'
  | 'dim_gem'
  | 'old_leather'
  | 'dark_flame_heart'
  | 'black_gem'
  | 'cursed_seal'
  | 'black_sarcophagus_shard';

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
];

export function getMaterialById(id: MaterialId) {
  return materials.find(material => material.id === id);
}

export function getMaterialName(id: MaterialId) {
  return getMaterialById(id)?.name ?? id;
}