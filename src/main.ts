import Phaser from 'phaser';

import { CampScene } from './scenes/CampScene';
import { DungeonScene } from './scenes/DungeonScene';
import { BattleScene } from './scenes/BattleScene';
import { InventoryScene } from '../src/scenes/InventoryScene';
import { DungeonSelectScene } from './scenes/DungeonSelectScene';
import { ShopScene } from './scenes/ShopScene';
import { QuestScene } from './scenes/QuestScene';
import { ForgeScene } from './scenes/ForgeScene';
import { RaceSelectScene } from './scenes/RaceSelectScene';
import { ProfileScene } from './scenes/ProfileScene';
import { TrainingScene } from './scenes/TrainingScene';
import { BootScene } from './scenes/BootScene';
import { StatsTreeScene } from './scenes/StatsTreeScene.ts';
import { MarketScene } from './scenes/MarketScene.ts';
import { TavernScene } from './scenes/TavernScene.ts';
import { HomeScene } from './scenes/HomeScene.ts';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 720,
  height: 1280,
  backgroundColor: '#090909',
  parent: 'app',
  pixelArt: true,
  roundPixels: true,

  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
  scene: [
    CampScene,
    RaceSelectScene,
    BootScene,
    StatsTreeScene,
    DungeonSelectScene,
    DungeonScene,
    BattleScene,
    InventoryScene,
    ShopScene,
    QuestScene,
    ForgeScene,
    ProfileScene,
    TrainingScene,
    MarketScene,
    TavernScene,
    HomeScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);