import { gameState } from '../data/gameState';
import type { MaterialId } from '../data/materials';
import { getMaterialName } from '../data/materials';

export function trackFloorMaterial(id: MaterialId, amount: number) {
  gameState.floorRun.materialsEarned ??= {};

  gameState.floorRun.materialsEarned[id] =
    (gameState.floorRun.materialsEarned[id] ?? 0) + amount;
}

export function trackFloorMaterials(
  materials: {
    id: MaterialId;
    amount: number;
  }[]
) {
  materials.forEach(material => {
    trackFloorMaterial(material.id, material.amount);
  });
}

export function createFloorMaterialsShortText() {
  const materialsEarned = gameState.floorRun.materialsEarned ?? {};

  const total = Object.values(materialsEarned).reduce<number>((sum, amount) => {
    return sum + (amount ?? 0);
  }, 0);

  return `Материалы: +${total}`;
}

export function createFloorMaterialsText() {
  const materialsEarned = gameState.floorRun.materialsEarned ?? {};

  const lines = Object.entries(materialsEarned)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([id, amount]) => {
      return `${getMaterialName(id as MaterialId)}: +${amount}`;
    });

  if (lines.length === 0) {
    return 'Материалы: 0';
  }

  return lines.join('\n');
}