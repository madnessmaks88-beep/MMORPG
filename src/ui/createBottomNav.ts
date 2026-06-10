import Phaser from 'phaser';

import { UI } from './theme';

type BottomNavOptions = {
  activeScene: string;
  disabledScenes?: string[];
  disabledMessage?: string;
};

export function createBottomNav(scene: Phaser.Scene, options: BottomNavOptions) {
  const { width, height } = scene.scale;

  const activeScene = options.activeScene;
  const disabledScenes = options.disabledScenes ?? [];
  const disabledMessage = options.disabledMessage ?? 'Сейчас нельзя перейти на этот экран.';

  const items = [
    {
      label: 'Герой',
      scene: 'ProfileScene',
      icon: '◆',
    },
    {
      label: 'Город',
      scene: 'CampScene',
      icon: '⌂',
    },
    {
      label: 'Сумка',
      scene: 'InventoryScene',
      icon: '▣',
    },
  ];

  const navHeight = 96;
  const navY = height - 62;

  scene.add.rectangle(width / 2, height - navHeight / 2, width, navHeight, 0x090706, 0.96)
    .setDepth(900);


  const gap = 18;
  const sidePadding = 26;
  const buttonWidth = Math.floor((width - sidePadding * 2 - gap * (items.length - 1)) / items.length);
  const buttonHeight = 74;

  const totalWidth = buttonWidth * items.length + gap * (items.length - 1);
  const startX = width / 2 - totalWidth / 2 + buttonWidth / 2;

  items.forEach((item, index) => {
    const x = startX + index * (buttonWidth + gap);

    const isActive = activeScene === item.scene;
    const isDisabled = disabledScenes.includes(item.scene);

    const bgColor = isActive ? 0x2b1d13 : 0x12100d;
    const bgAlpha = isActive ? 0.98 : 0.72;

    const iconColor = isDisabled
      ? '#4d4d4d'
      : isActive
        ? '#f0d58a'
        : '#cbb895';

    const labelColor = isDisabled
      ? '#4d4d4d'
      : isActive
        ? '#f0d58a'
        : '#9f9078';

    scene.add.rectangle(x, navY + 4, buttonWidth, buttonHeight, 0x000000, 0.22)
      .setDepth(903);

    const button = scene.add.rectangle(x, navY, buttonWidth, buttonHeight, bgColor, bgAlpha)
      .setDepth(904)
      .setInteractive({
        useHandCursor: !isDisabled,
      });

    if (isActive) {
      button.setStrokeStyle(2, UI.colors.gold, 0.9);

      scene.add.circle(x, navY - 40, 4, UI.colors.gold, 0.95)
        .setDepth(906);
    } else {
      button.setStrokeStyle(1, UI.colors.goldDark, 0.25);
    }

    const icon = scene.add.text(x, navY - 16, item.icon, {
      fontFamily: UI.font.body,
      fontSize: '22px',
      color: iconColor,
    }).setOrigin(0.5).setDepth(907);

    const label = scene.add.text(x, navY + 18, item.label, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: labelColor,
    }).setOrigin(0.5).setDepth(907);

    button.on('pointerover', () => {
      if (isDisabled) {
        return;
      }

      button.setFillStyle(0x21150f, 0.95);
      icon.setColor('#f0d58a');
      label.setColor('#f0d58a');
    });

    button.on('pointerout', () => {
      if (isDisabled) {
        return;
      }

      button.setFillStyle(bgColor, bgAlpha);
      icon.setColor(iconColor);
      label.setColor(labelColor);
    });

    button.on('pointerdown', () => {
      if (isDisabled) {
        const toast = scene.add.text(width / 2, height - 145, disabledMessage, {
          fontFamily: UI.font.body,
          fontSize: '18px',
          color: '#ffb3b3',
          backgroundColor: '#000000',
          padding: {
            x: 12,
            y: 8,
          },
        }).setOrigin(0.5).setDepth(1200);

        scene.time.delayedCall(1400, () => {
          toast.destroy();
        });

        return;
      }

      scene.scene.start(item.scene);
    });
  });
}