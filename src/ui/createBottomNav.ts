import Phaser from 'phaser';

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

  const navHeight = 118;
  const navY = height - navHeight / 2;

  scene.add.rectangle(width / 2, navY, width, navHeight, 0x070707, 0.98)
    .setDepth(900)
    .setStrokeStyle(2, 0x3a2518);

  scene.add.rectangle(width / 2, height - navHeight, width, 2, 0x8b5a2b, 0.75)
    .setDepth(901);

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

    const buttonWidth = 150;
    const buttonHeight = 84;

    const bgColor = isActive ? 0x2a1d12 : 0x111111;
    const bgAlpha = isActive ? 1 : 0.92;

    const strokeColor = isActive ? 0xf0d58a : 0x4a3324;
    const iconColor = isDisabled
      ? '#555555'
      : isActive
        ? '#f0d58a'
        : '#d8c7a3';

    const labelColor = isDisabled
      ? '#555555'
      : isActive
        ? '#f0d58a'
        : '#a99a83';

    const button = scene.add.rectangle(x, navY, buttonWidth, buttonHeight, bgColor, bgAlpha)
      .setDepth(902)
      .setStrokeStyle(2, strokeColor)
      .setInteractive({ useHandCursor: !isDisabled });

    scene.add.text(x, navY - 16, item.icon, {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: iconColor,
    }).setOrigin(0.5).setDepth(903);

    scene.add.text(x, navY + 18, item.label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: labelColor,
    }).setOrigin(0.5).setDepth(903);

    if (isActive) {
      scene.add.circle(x, navY - 42, 4, 0xf0d58a, 1)
        .setDepth(904);
    }

    button.on('pointerdown', () => {
      if (isDisabled) {
        const toast = scene.add.text(width / 2, height - 150, disabledMessage, {
          fontFamily: 'Arial',
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