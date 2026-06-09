import Phaser from 'phaser';

import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CampScene } from './scenes/CampScene';
import { DungeonScene } from './scenes/DungeonScene';
import { BattleScene } from './scenes/BattleScene';
import { InventoryScene } from '../src/scenes/InventoryScene';
import { DungeonSelectScene } from './scenes/DungeonSelectScene';
import { ShopScene } from './scenes/ShopScene';
import { QuestScene } from './scenes/QuestScene';
import { ForgeScene } from './scenes/ForgeScene';
import { RaceSelectScene } from './scenes/RaceSelectScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 720,
  height: 1280,
  backgroundColor: '#090909',
  parent: 'app',
  scene: [
    BootScene,
    RaceSelectScene,
    MainMenuScene,
    CampScene,
    DungeonSelectScene,
    DungeonScene,
    BattleScene,
    InventoryScene,
    ShopScene,
    QuestScene,
    ForgeScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);