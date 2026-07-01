const D = (file: string) =>
  new URL(`../assets/images/dungeon/${file}`, import.meta.url).href;

export type DungeonSpriteAsset = { key: string; url: string };

export const SVITOK_ASSET: DungeonSpriteAsset = {
  key: 'dungeon_svitok',
  url: D('svitok.png'),
};
