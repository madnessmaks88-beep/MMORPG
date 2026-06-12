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

  const hoverColor = danger ? 0x3a1515 : 0x2c1d14;

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

  const hoverTextColor = danger ? '#ffd0d0' : '#f0d58a';

  const shadow = scene.add.rectangle(x, y + 5, width, height, 0x000000, 0.28);

  const bg = scene.add.rectangle(x, y, width, height, baseColor, disabled ? 0.62 : 0.96)
    .setStrokeStyle(2, strokeColor, disabled ? 0.45 : 0.8);

  const label = scene.add.text(x, y, text, {
    fontFamily: UI.font.body,
    fontSize: options?.small ? '17px' : '20px',
    color: textColor,
  }).setOrigin(0.5);

  if (!disabled) {
    let isPressed = false;
    let isLocked = false;

    const resetButton = () => {
      isPressed = false;

      bg.setAlpha(1);
      bg.setFillStyle(baseColor, 0.96);
      bg.setStrokeStyle(2, strokeColor, 0.8);

      label.setY(y);
      label.setColor(textColor);
    };

    const setHover = () => {
      if (isPressed) {
        return;
      }

      bg.setAlpha(1);
      bg.setFillStyle(hoverColor, 1);
      bg.setStrokeStyle(2, strokeColor, 1);

      label.setY(y);
      label.setColor(hoverTextColor);
    };

    const setPressed = () => {
      isPressed = true;

      bg.setAlpha(0.92);
      bg.setFillStyle(hoverColor, 1);
      bg.setStrokeStyle(2, strokeColor, 0.95);

      label.setY(y + 1);
      label.setColor(hoverTextColor);
    };

    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      setHover();
    });

    bg.on('pointerout', () => {
      resetButton();
    });

    bg.on('pointerdown', () => {
      if (isLocked) {
        return;
      }

      setPressed();
    });

    bg.on('pointerup', () => {
      if (!isPressed || isLocked) {
        return;
      }

      isLocked = true;
      isPressed = false;

      bg.setAlpha(1);
      bg.setFillStyle(hoverColor, 1);
      bg.setStrokeStyle(2, strokeColor, 1);

      label.setY(y);
      label.setColor(hoverTextColor);

      scene.time.delayedCall(40, () => {
        onClick();
      });
    });

    bg.on('pointerupoutside', () => {
      resetButton();
    });

    bg.on('pointercancel', () => {
      resetButton();
    });
  }

  return {
    shadow,
    bg,
    label,
  };
}