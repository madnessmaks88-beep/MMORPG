import Phaser from 'phaser';

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  onClick: () => void,
  width = 460,
  height = 72
) {
  const button = scene.add.container(x, y);

  const bg = scene.add.rectangle(0, 0, width, height, 0x241515);
  bg.setStrokeStyle(2, 0x8b5a2b);

  const label = scene.add.text(0, 0, text, {
    fontFamily: 'Arial',
    fontSize: '26px',
    color: '#e6d2aa',
  });

  label.setOrigin(0.5);

  button.add([bg, label]);

  bg.setInteractive({ useHandCursor: true });

  bg.on('pointerover', () => {
    bg.setFillStyle(0x3a2020);
  });

  bg.on('pointerout', () => {
    bg.setFillStyle(0x241515);
  });

  bg.on('pointerdown', () => {
    onClick();
  });

  return button;
}