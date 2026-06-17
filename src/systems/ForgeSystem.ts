import { player, type InventoryItem } from '../data/player';
import type { MaterialId } from '../data/materials';
import { getMaterialName } from '../data/materials';
import {
  getBaseItemFromInventoryItem,
  isItemEquipped,
} from './InventorySystem';
import {
  hasMaterials,
  spendMaterials,
} from './MaterialSystem';

export type ForgeUpgradeCost = {
  gold: number;
  materials: Partial<Record<MaterialId, number>>;
};

export function getMaxWeaponUpgradeLevelByRarity(rarity: string) {
  if (rarity === 'common') return 3;
  if (rarity === 'rare') return 5;
  if (rarity === 'epic') return 7;
  if (rarity === 'legendary') return 10;
  if (rarity === 'mythic') return 10;

  return 3;
}

export function getMaxWeaponUpgradeLevelForItem(inventoryItem: InventoryItem) {
  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item || item.slot !== 'weapon') {
    return 0;
  }

  return getMaxWeaponUpgradeLevelByRarity(item.rarity);
}

export function getMaxWeaponUpgradeLevel() {
  return 10;
}

export function getAnvilUpgradeCost() {
  return {
    materialId: 'black_sarcophagus_shard' as MaterialId,
    amount: 1,
    gold: 250,
  };
}

export function canUpgradeAnvil() {
  const cost = getAnvilUpgradeCost();

  return (
    player.anvilLevel < 2 &&
    player.gold >= cost.gold &&
    (player.materials[cost.materialId] ?? 0) >= cost.amount
  );
}

export function upgradeAnvil() {
  if (!canUpgradeAnvil()) {
    return {
      success: false,
      message: 'Недостаточно ресурсов для прокачки наковальни.',
    };
  }

  const cost = getAnvilUpgradeCost();

  player.gold -= cost.gold;
  player.materials[cost.materialId] = (player.materials[cost.materialId] ?? 0) - cost.amount;

  player.anvilLevel = 2;
  player.crystalsUnlocked = true;

  return {
    success: true,
    message: 'Наковальня улучшена. Открыты кристаллы.',
  };
}

export function getWeaponUpgradeCost(inventoryItem: InventoryItem): ForgeUpgradeCost | undefined {
  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item || item.slot !== 'weapon') {
    return undefined;
  }

  const nextLevel = inventoryItem.upgradeLevel + 1;

  if (nextLevel > getMaxWeaponUpgradeLevelForItem(inventoryItem)) {
      return undefined;
    }

  if (nextLevel === 1) {
    return {
      gold: 20,
      materials: {
        darkened_bone: 2,
      },
    };
  }

  if (nextLevel === 2) {
    return {
      gold: 40,
      materials: {
        darkened_bone: 2,
        old_leather: 2,
      },
    };
  }

  if (nextLevel === 3) {
    return {
      gold: 70,
      materials: {
        darkened_bone: 3,
        dim_gem: 1,
        old_leather: 2,
      },
    };
  }

  if (nextLevel === 4) {
    return {
      gold: 120,
      materials: {
        dark_flame_heart: 2,
        black_gem: 1,
      },
    };
  }

  if (nextLevel === 5) {
    return {
      gold: 180,
      materials: {
        dark_flame_heart: 2,
        black_gem: 2,
        cursed_seal: 1,
      },
    };
  }

  // Улучшения +6...+10 требуют материалы второго яруса.
  if (nextLevel === 6) {
    return {
      gold: 260,
      materials: {
        silt_bone: 4,
        drowned_leather: 2,
      },
    };
  }

  if (nextLevel === 7) {
    return {
      gold: 340,
      materials: {
        rusted_armor_scale: 3,
        bottled_black_water: 2,
      },
    };
  }

  if (nextLevel === 8) {
    return {
      gold: 460,
      materials: {
        rusted_chain_link: 3,
        mold_gem: 2,
      },
    };
  }

  if (nextLevel === 9) {
    return {
      gold: 620,
      materials: {
        flooded_sarcophagus_shard: 2,
        black_slime_heart: 2,
        abyssal_bottom_seal: 1,
      },
    };
  }

  if (nextLevel === 10) {
    return {
      gold: 850,
      materials: {
        abyssal_bottom_seal: 2,
        drowned_guardian_eye: 1,
      },
    };
  }

  return undefined;
}

export function canUpgradeWeapon(inventoryItem: InventoryItem) {
  const cost = getWeaponUpgradeCost(inventoryItem);

  if (!cost) {
    return false;
  }

  return player.gold >= cost.gold && hasMaterials(cost.materials);
}

export function upgradeWeaponWithMaterials(inventoryItem: InventoryItem) {
  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item) {
    return {
      success: false,
      message: 'Предмет не найден.',
    };
  }

  if (item.slot !== 'weapon') {
    return {
      success: false,
      message: 'Сейчас кузнец улучшает только оружие.',
    };
  }

  const cost = getWeaponUpgradeCost(inventoryItem);

  if (!cost) {
     const maxLevel = getMaxWeaponUpgradeLevelForItem(inventoryItem);
    
     return {
       success: false,
       message: `Достигнут предел улучшения для этой редкости: +${maxLevel}.`,
     };
    }
    
  if (player.gold < cost.gold) {
    return {
      success: false,
      message: 'Недостаточно золота.',
    };
  }

  if (!hasMaterials(cost.materials)) {
    return {
      success: false,
      message: 'Недостаточно материалов.',
    };
  }

  player.gold -= cost.gold;
  spendMaterials(cost.materials);

  inventoryItem.upgradeLevel += 1;

  return {
    success: true,
    message: `${item.name} улучшен до +${inventoryItem.upgradeLevel}.`,
  };
}

export function createUpgradeCostText(cost?: ForgeUpgradeCost) {
  if (!cost) {
    return 'Предел улучшения достигнут.';
  }

  const materialLines = Object.entries(cost.materials)
    .map(([id, amount]) => {
      const materialId = id as MaterialId;
      const have = player.materials[materialId] ?? 0;
      const enough = have >= (amount ?? 0);

      return `${getMaterialName(materialId)}: ${have}/${amount}${enough ? '' : '  !'}`;
    });

  return [
    `Золото: ${player.gold}/${cost.gold}${player.gold >= cost.gold ? '' : '  !'}`,
    ...materialLines,
  ].join('\n');
}

export function getSortedForgeWeapons() {
  return [...player.inventory]
    .filter(inventoryItem => {
      const item = getBaseItemFromInventoryItem(inventoryItem);

      return item?.slot === 'weapon';
    })
    .sort((a, b) => {
      const aEquipped = isItemEquipped(player, a.instanceId);
      const bEquipped = isItemEquipped(player, b.instanceId);

      if (aEquipped && !bEquipped) return -1;
      if (!aEquipped && bEquipped) return 1;

      return b.upgradeLevel - a.upgradeLevel;
    });
}