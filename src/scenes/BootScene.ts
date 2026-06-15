import Phaser from 'phaser';

import { player } from '../data/player';
import { loadGameAsync } from '../systems/SaveSystem';
import { getVKUser, initVKBridge } from '../systems/VKBridgeSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  async create() {
    await initVKBridge();
    await getVKUser();

    await loadGameAsync();

    if (!player.raceId) {
      this.scene.start('RaceSelectScene');
      return;
    }

    this.scene.start('CampScene');
  }
}