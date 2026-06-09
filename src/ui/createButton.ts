import Phaser from 'phaser';
import { UI } from './theme';

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  onClick: () => void,
  width = 500,
  height = 64,
  options?: {
    disabled?: boolean;
    small?: boolean;
    danger?: boolean;
  }
) {
  const disabled = options?.disabled ?? false;
  const danger = options?.danger ?? false;

  const baseColor = disabled
    ? 0x151515
    : danger
      ? 0x2a1010
      : 0x21150f;

  const strokeColor = disabled
    ? 0x333333
    : danger
      ? 0xff6b6b
      : UI.colors.goldDark;

  const textColor = disabled
    ? '#555555'
    : danger
      ? '#ffb3b3'
      : UI.colors.text;

  const shadow = scene.add.rectangle(x, y + 5, width, height, 0x000000, 0.28);

  const bg = scene.add.rectangle(x, y, width, height, baseColor, 0.96)
    .setStrokeStyle(2, strokeColor, disabled ? 0.45 : 0.8);

  const label = scene.add.text(x, y, text, {
    fontFamily: UI.font.body,
    fontSize: options?.small ? '17px' : '20px',
    color: textColor,
  }).setOrigin(0.5);

  if (!disabled) {
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      bg.setFillStyle(danger ? 0x3a1515 : 0x2c1d14, 1);
      label.setColor(danger ? '#ffd0d0' : '#f0d58a');
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(baseColor, 0.96);
      label.setColor(textColor);
    });

    bg.on('pointerdown', () => {
      bg.setScale(0.985);
      label.setScale(0.985);
    });

    bg.on('pointerup', () => {
      bg.setScale(1);
      label.setScale(1);
      onClick();
    });
  }

  return {
    shadow,
    bg,
    label,
  };
}