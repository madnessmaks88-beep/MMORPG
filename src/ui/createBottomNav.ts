import Phaser from 'phaser';
import { UI } from './theme';

export type BottomNavOptions = {
  activeScene?: string;
  disabledScenes?: string[];
  disabledMessage?: string;
};

type NavItem = {
  label: string;
  scene: string;
  icon: string;
};

export function createBottomNav(
  scene: Phaser.Scene,
  options: BottomNavOptions = {}
) {
  const { width, height } = scene.scale;

  const activeScene = options.activeScene;
  const disabledScenes = options.disabledScenes ?? [];
  const disabledMessage =
    options.disabledMessage ?? 'Сейчас нельзя перейти в этот раздел.';

  const navHeight = 112;
  const navY = height - navHeight / 2;

  scene.add.rectangle(width / 2, navY + 8, width - 28, navHeight - 16, 0x000000, 0.24)
    .setDepth(900);

  scene.add.rectangle(width / 2, navY + 2, width - 34, navHeight - 24, 0x0d0a08, 0.78)
    .setDepth(901);

  scene.add.rectangle(width / 2, navY + 2, width - 54, navHeight - 42, 0x17100c, 0.52)
    .setDepth(902);

  const items: NavItem[] = [
    {
      label: 'Магазин',
      scene: 'ShopScene',
      icon: '✦',
    },
    {
      label: 'Город',
      scene: 'CampScene',
      icon: '⌂',
    },
    {
      label: 'Герой',
      scene: 'ProfileScene',
      icon: '◆',
    },
    {
      label: 'Сумка',
      scene: 'InventoryScene',
      icon: '▣',
    },
  ];

  const positions = [
    width * 0.14,
    width * 0.38,
    width * 0.62,
    width * 0.86,
  ];

  items.forEach((item, index) => {
    const x = positions[index];

    const isActive = activeScene === item.scene;
    const isDisabled = disabledScenes.includes(item.scene);

    const buttonWidth = 140;
    const buttonHeight = 76;

    const bgColor = isActive ? 0x2b1d13 : 0x12100d;
    const bgAlpha = isActive ? 0.98 : 0.68;

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

    scene.add.rectangle(x, navY + 4, buttonWidth, buttonHeight, 0x000000, 0.2)
      .setDepth(903);

    const button = scene.add.rectangle(x, navY, buttonWidth, buttonHeight, bgColor, bgAlpha)
      .setDepth(904);

    if (isActive) {
      button.setStrokeStyle(2, UI.colors.gold, 0.9);

      scene.add.circle(x, navY - 41, 4, UI.colors.gold, 0.95)
        .setDepth(906);
    }

    scene.add.text(x, navY - 17, item.icon, {
      fontFamily: UI.font.body,
      fontSize: '23px',
      color: iconColor,
    }).setOrigin(0.5).setDepth(905);

    scene.add.text(x, navY + 18, item.label, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: labelColor,
    }).setOrigin(0.5).setDepth(905);

    if (!isDisabled) {
      button.setInteractive({ useHandCursor: true });
    }

    button.on('pointerover', () => {
      if (isDisabled || isActive) return;

      button.setFillStyle(0x21150f, 0.9);
    });

    button.on('pointerout', () => {
      if (isDisabled || isActive) return;

      button.setFillStyle(bgColor, bgAlpha);
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

      if (isActive) {
        return;
      }

      scene.scene.start(item.scene);
    });
  });
}