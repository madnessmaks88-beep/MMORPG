import { player } from '../data/player';
import type { MaterialId } from '../data/materials';
import { getMaterialName } from '../data/materials';

export function getMaterialCount(id: MaterialId) {
  return player.materials[id] ?? 0;
}

export function addMaterial(id: MaterialId, amount = 1) {
  player.materials[id] = getMaterialCount(id) + amount;
}

export function removeMaterial(id: MaterialId, amount = 1) {
  const current = getMaterialCount(id);

  if (current < amount) {
    return false;
  }

  player.materials[id] = current - amount;

  return true;
}

export function hasMaterials(cost: Partial<Record<MaterialId, number>>) {
  return Object.entries(cost).every(([id, amount]) => {
    return getMaterialCount(id as MaterialId) >= (amount ?? 0);
  });
}

export function spendMaterials(cost: Partial<Record<MaterialId, number>>) {
  if (!hasMaterials(cost)) {
    return false;
  }

  Object.entries(cost).forEach(([id, amount]) => {
    removeMaterial(id as MaterialId, amount ?? 0);
  });

  return true;
}

export function addMaterialsPack(
  materials: {
    id: MaterialId;
    amount: number;
  }[]
) {
  materials.forEach(material => {
    addMaterial(material.id, material.amount);
  });
}

export function createMaterialsText(
  materials: {
    id: MaterialId;
    amount: number;
  }[]
) {
  if (materials.length === 0) {
    return '';
  }

  return materials
    .map(material => `+${material.amount} ${getMaterialName(material.id)}`)
    .join('\n');
}