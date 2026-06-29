import type { RaceId } from './races';

export type RaceSpriteAsset = { key: string; url: string };

const raceAvatarFiles: Record<RaceId, string> = {
  human:             'Human.png',
  goblin:            'Goblin.png',
  demon:             'Demon.png',
  night_elf:         'NightElf.png',
  stoneborn:         'StoneBorn.png',
  tainted_halfblood: 'Tainted.png',
};

export const RACE_AVATAR_ASSETS: RaceSpriteAsset[] = (Object.keys(raceAvatarFiles) as RaceId[]).map(id => ({
  key: `race_${id}`,
  url: new URL(`../assets/images/camp/racesav/${raceAvatarFiles[id]}`, import.meta.url).href,
}));

export function getRaceAvatarKey(raceId: RaceId): string {
  return `race_${raceId}`;
}

export function preloadRaceAvatars(scene: Phaser.Scene): void {
  RACE_AVATAR_ASSETS.forEach(asset => {
    if (!scene.textures.exists(asset.key)) {
      scene.load.image(asset.key, asset.url);
    }
  });
}
