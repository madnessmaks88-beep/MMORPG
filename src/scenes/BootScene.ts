import Phaser from 'phaser';

import { loadGameAsync } from '../systems/SaveSystem';
import { getVKUser, initVKBridge } from '../systems/VKBridgeSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  async create() {
    try {
      await initVKBridge();
      await getVKUser();
      await loadGameAsync();
    } catch (error) {
      console.warn('Boot loading failed. Starting game anyway.', error);
    }

    this.scene.start('MainMenuScene');
  }
}