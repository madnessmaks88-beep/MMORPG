const B = (rarity: string, file: string) =>
  new URL(`../assets/images/inventory/${rarity}/${file}`, import.meta.url).href;

export type ItemSpriteAsset = { key: string; url: string };

export const ITEM_SPRITE_ASSETS: ItemSpriteAsset[] = [
  // Common — tier 1
  { key: 'item_rusty_sword',               url: B('common', 'rusty_sword.png') },
  { key: 'item_dusty_fang',                url: B('common', 'Dusty_Fang.png') },
  { key: 'item_cracked_grave_axe',         url: B('common', 'grave_axe.png') },
  { key: 'item_crypt_rusty_katana',        url: B('common', 'rusty_katana.png') },
  { key: 'item_heavy_stone_hammer',        url: B('common', 'Heavy_stone_hammer.png') },
  { key: 'item_rusty_funeral_sword',       url: B('common', 'funeral_sword.png') },
  { key: 'item_crypt_knife',               url: B('common', 'Crypt_knife.png') },
  { key: 'item_cracked_crypt_breastplate', url: B('common', 'crypt_breastplate.png') },
  { key: 'item_grave_digger_leather_coat', url: B('common', 'gravedigger_jacket.png') },
  { key: 'item_rusted_guard_plates',       url: B('common', 'Guardian_Plates.png') },
  { key: 'item_cracked_wax_amulet',        url: B('common', 'candle_wax_amulet.png') },
  { key: 'item_grave_digger_copper_sign',  url: B('common', 'Copper_Gravedigger_Badge.png') },
  { key: 'item_cold_crypt_bead',           url: B('common', 'crypt_bead.png') },

  // Common — tier 2
  { key: 'item_t2_rusty_drowned_blade',    url: B('common', 'Rusty_Drowned_Blade.png') },
  { key: 'item_t2_rotten_axe',            url: B('common', 'Rotten_axe.png') },
  { key: 'item_t2_mossy_katana',          url: B('common', 'Mossy_katana.png') },
  { key: 'item_t2_cracked_hammer',        url: B('common', 'Cracked_Hammer.png') },
  { key: 'item_t2_drowned_thief_knife',   url: B('common', 'Drowned_Thief_Knife.png') },
  { key: 'item_t2_dead_scavenger_spear',  url: B('common', 'Dead_Scavenger_Spear.png') },
  { key: 'item_t2_wet_crypt_guard_armor', url: B('common', 'Crypt_Guardian_Armor.png') },
  { key: 'item_t2_wet_bone_amulet',       url: B('common', 'Wet_Bone_Amulet.png') },

  // Rare — tier 1
  { key: 'item_bone_axe',                  url: B('rare', 'Bone_axe.png') },
  { key: 'item_moon_spike',                url: B('rare', 'Moon_Thorn.png') },
  { key: 'item_grave_hammer',              url: B('rare', 'Grave_hammer.png') },
  { key: 'item_crypt_servant_katana',      url: B('rare', 'Funeral_Attendant_Katana.png') },
  { key: 'item_black_niche_blade',         url: B('rare', 'Blade_Black_Niche.png') },
  { key: 'item_bone_chopper_axe',          url: B('rare', 'Bone_Cutter_Axe.png') },
  { key: 'item_grave_digger_pruner',       url: B('rare', 'Grave_Digger_pruner.png') },
  { key: 'item_crypt_guard_sword',         url: B('rare', 'Crypt_Guardian_Sword.png') },
  { key: 'item_broken_seal_blade',         url: B('rare', 'Blade_Broken_Seal.png') },
  { key: 'item_coffin_thief_dagger',       url: B('rare', 'Coffin_Thief_Dagger.png') },
  { key: 'item_carrion_beetle_sting',      url: B('rare', 'Carrion_Beetle_Sting.png') },
  { key: 'item_grave_keeper_hammer',       url: B('rare', 'Grave_Warden_Hammer.png') },
  { key: 'item_tombstone_crusher',         url: B('rare', 'Tombstone_Crusher.png') },
  { key: 'item_bone_watchman_carapace',    url: B('rare', 'Bone_Sentry_Carapace.png') },
  { key: 'item_night_sneaker_coat',        url: B('rare', 'Night_Scout_Jacket.png') },
  { key: 'item_ashen_crypt_keeper_chainmail', url: B('rare', 'Cryptmaster_Ash_Chainmail.png') },
  { key: 'item_bone_servant_charm',        url: B('rare', 'Servant_Bone_Amulet.png') },
  { key: 'item_burial_whisper_talisman',   url: B('rare', 'Talisman_Funeral_Whisper.png') },
  { key: 'item_dark_niche_mark',           url: B('rare', 'Sign_Dark_Niche.png') },

  // Rare — tier 2
  { key: 'item_t2_black_water_sword',      url: B('rare', 'Sword_Black_Waters.png') },
  { key: 'item_t2_dark_waters_executioner', url: B('rare', 'Dark_Waters_Executioner.png') },
  { key: 'item_t2_river_ghost_katana',     url: B('rare', 'Ghost_River.png') },
  { key: 'item_t2_darkened_bonecrusher',   url: B('rare', 'Darkened_Bonebreaker.png') },
  { key: 'item_t2_envious_sting',          url: B('rare', 'Sting_Envious.png') },
  { key: 'item_t2_skull_piercer_spear',    url: B('rare', 'Skull_Piercer.png') },
  { key: 'item_t2_rusty_drowned_chainmail', url: B('rare', 'Rusty_Drowned_Chainmail.png') },
  { key: 'item_t2_rusted_chain_charm',     url: B('rare', 'Rusty_Chain_Amulet.png') },

  // Epic — tier 1
  { key: 'item_cultist_blade',             url: B('epic', 'Cultist_Blade.png') },
  { key: 'item_scarlet_katana',            url: B('epic', 'Scarlet_katana.png') },
  { key: 'item_silent_tomb_katana',        url: B('epic', 'Katana_Silent_Tomb.png') },
  { key: 'item_lower_crypt_axe',           url: B('epic', 'Lower_Crypt_Axe.png') },
  { key: 'item_black_tomb_sword',          url: B('epic', 'Black_Tomb_Sword.png') },
  { key: 'item_quiet_burial_dagger',       url: B('epic', 'Dagger_Silent_Burial.png') },
  { key: 'item_black_slab_hammer',         url: B('epic', 'Black_Plate_Hammer.png') },
  { key: 'item_black_tomb_armor',          url: B('epic', 'Black_Sepulchre_Armor.png') },
  { key: 'item_silent_niche_cloak',        url: B('epic', 'Cloak_Silent_Niche.png') },
  { key: 'item_black_seal_amulet',         url: B('epic', 'Black_Seal_Amulet.png') },
  { key: 'item_silent_tomb_eye',           url: B('epic', 'Eye_Silent_Tomb.png') },

  // Epic — tier 2
  { key: 'item_t2_drowned_knight_blade',   url: B('epic', 'Blade_Drowned_Knight.png') },
  { key: 'item_t2_defiler_of_fallen',      url: B('epic', 'Defiler_Fallen.png') },
  { key: 'item_t2_vengeful_spirit_katana', url: B('epic', 'Katana_Vengeful_Spirit.png') },
  { key: 'item_t2_storm_breeze_hammer',    url: B('epic', 'Storm_Breeze.png') },
  { key: 'item_t2_abyss_acolyte_dagger',   url: B('epic', 'Abyssal_Disciple_Dagger.png') },
  { key: 'item_t2_black_waters_harpoon',   url: B('epic', 'Black_Water_Harpoon.png') },
  { key: 'item_t2_silt_overseer_carapace', url: B('epic', 'Silt_Warden_Carapace.png') },
  { key: 'item_t2_black_water_drop',       url: B('epic', 'Drop_Black_Water.png') },

  // Legendary — tier 1
  { key: 'item_sarcophagus_cutter',        url: B('legendary', 'Sarcophagus_Slicer (1).png') },
  { key: 'item_sealed_executioner_axe',    url: B('legendary', 'Executioner_Sealed (1).png') },
  { key: 'item_ashen_sarcophagus_blade',   url: B('legendary', 'Ashen_Blade _Sarcophagus (1).png') },
  { key: 'item_sarcophagus_whisper',       url: B('legendary', 'Whisper_Sarcophagus (1).png') },
  { key: 'item_buried_king_seal',          url: B('legendary', 'Seal_Buried_King (2).png') },
  { key: 'item_sarcophagus_executioner_armor', url: B('legendary', 'Executioner_Sarcophagus_Armor (1).png') },
  { key: 'item_lower_crypt_bone_plate',    url: B('legendary', 'Lower_Crypt_Bone_Armor (1).png') },
  { key: 'item_lower_crypt_heart',         url: B('legendary', 'Heart_Lower_Crypt (1).png') },
  { key: 'item_sealed_ones_mark',          url: B('legendary', 'Seal_Sealed (1).png') },
  { key: 'item_idris_last_amulet',         url: B('legendary', 'Amulet_Last_Light (1).png') },
  { key: 'item_idris_oath_armor',          url: B('legendary', 'Idris_Armor (1).png') },

  // Legendary — tier 2
  { key: 'item_t2_sarcophagus_water_cutter', url: B('legendary', 'Sarcophagus_Water_Splitter (1).png') },
  { key: 'item_t2_sluice_chain_splitter',  url: B('legendary', 'Sluice_Chain_Breaker (1).png') },
  { key: 'item_t2_black_ripple_cutter',    url: B('legendary', 'Black_Ripple_Splitter (1).png') },
  { key: 'item_t2_deaf_bell_strike',       url: B('legendary', 'Ringing_Dull_Bell (1).png') },
  { key: 'item_t2_bottom_beast_fangs',     url: B('legendary', 'Twin_Fangs_Bottom_Beast (1).png') },
  { key: 'item_t2_bottom_rift_piercer',    url: B('legendary', 'Bottom_Rift_Piercer (1).png') },
  { key: 'item_t2_black_sluice_trident',   url: B('legendary', 'Trident_Black_Gate (1).png') },
  { key: 'item_t2_drowned_knight_armor',   url: B('legendary', 'Drowned_Knight_Armor (1).png') },
  { key: 'item_t2_flooded_sarcophagus_seal', url: B('legendary', 'Seal_Sunken_Sarcophagus (1).png') },

  // Mythic
  { key: 'item_morvein_last_oath',         url: B('mythic', 'Morvein_Last_Oath.png') },
];

export const ITEM_SPRITE_MAP: Record<string, string> = Object.fromEntries(
  ITEM_SPRITE_ASSETS.map(a => [a.key.replace('item_', ''), a.key])
);

export function getItemSpriteKey(itemId: string): string | undefined {
  return ITEM_SPRITE_MAP[itemId];
}

export const TAB_SPRITE_ASSETS: ItemSpriteAsset[] = [
  { key: 'tab_all_on',       url: new URL('../assets/images/inventory/tabs/allon.png', import.meta.url).href },
  { key: 'tab_all_off',      url: new URL('../assets/images/inventory/tabs/alloff.png', import.meta.url).href },
  { key: 'tab_weapon_on',    url: new URL('../assets/images/inventory/tabs/gunon.png', import.meta.url).href },
  { key: 'tab_weapon_off',   url: new URL('../assets/images/inventory/tabs/gunoff.png', import.meta.url).href },
  { key: 'tab_armor_on',     url: new URL('../assets/images/inventory/tabs/shieldon.png', import.meta.url).href },
  { key: 'tab_armor_off',    url: new URL('../assets/images/inventory/tabs/shieldoff.png', import.meta.url).href },
  { key: 'tab_trinket_on',   url: new URL('../assets/images/inventory/tabs/amuleton.png', import.meta.url).href },
  { key: 'tab_trinket_off',  url: new URL('../assets/images/inventory/tabs/amuletoff.png', import.meta.url).href },
  { key: 'tab_ring_on',      url: new URL('../assets/images/inventory/tabs/ringon.png', import.meta.url).href },
  { key: 'tab_ring_off',     url: new URL('../assets/images/inventory/tabs/ringoff.png', import.meta.url).href },
  { key: 'tab_potions_on',   url: new URL('../assets/images/inventory/tabs/poisonon.png', import.meta.url).href },
  { key: 'tab_potions_off',  url: new URL('../assets/images/inventory/tabs/poionoff.png', import.meta.url).href },
  { key: 'tab_materials_on', url: new URL('../assets/images/inventory/tabs/materialon.png', import.meta.url).href },
  { key: 'tab_materials_off', url: new URL('../assets/images/inventory/tabs/materialoff.png', import.meta.url).href },
];

// Спрайт рюкзака для нижней навигации.
// Файл: src/assets/images/inventory/backpack.png
export const NAV_BACKPACK_ASSET: ItemSpriteAsset = {
  key: 'nav_backpack',
  url: new URL('../assets/images/inventory/backpack.png', import.meta.url).href,
};
