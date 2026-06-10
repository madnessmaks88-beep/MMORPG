import Phaser from 'phaser';

import { createButton } from './createButton';

export function createBackToMainButton(scene: Phaser.Scene, y = 1180) {
  const { width } = scene.scale;

  return createButton(
    scene,
    width / 2,
    y,
    'Главный экран',
    () => {
      scene.scene.start('MainMenuScene');
    },
    520,
    54
  );
}