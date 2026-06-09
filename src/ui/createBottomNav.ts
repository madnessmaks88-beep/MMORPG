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

  const navHeight = 112;
  const navY = height - navHeight / 2;

  scene.add.rectangle(width / 2, navY + 6, width - 28, navHeight - 18, 0x0b0908, 0.88)
    .setDepth(900);

  scene.add.rectangle(width / 2, navY + 6, width - 44, navHeight - 32, 0x17100c, 0.72)
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

    const buttonWidth = 142;
    const buttonHeight = 78;

    const bgColor = isActive ? 0x2b1d13 : 0x15110e;
    const bgAlpha = isActive ? 0.98 : 0.76;

    const strokeColor = isActive ? 0xf0d58a : 0x000000;
    const strokeAlpha = isActive ? 0.9 : 0;

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

    const shadow = scene.add.rectangle(x, navY + 4, buttonWidth, buttonHeight, 0x000000, 0.25)
      .setDepth(902);

    const button = scene.add.rectangle(x, navY, buttonWidth, buttonHeight, bgColor, bgAlpha)
      .setDepth(903)
      .setInteractive({ useHandCursor: !isDisabled });

    if (isActive) {
      button.setStrokeStyle(2, strokeColor, strokeAlpha);
    }

    scene.add.text(x, navY - 17, item.icon, {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: iconColor,
    }).setOrigin(0.5).setDepth(904);

    scene.add.text(x, navY + 18, item.label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: labelColor,
    }).setOrigin(0.5).setDepth(904);

    if (isActive) {
      scene.add.circle(x, navY - 41, 4, 0xf0d58a, 0.95)
        .setDepth(905);
    }

    button.on('pointerdown', () => {
      if (isDisabled) {
        const toast = scene.add.text(width / 2, height - 145, disabledMessage, {
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

    shadow.setInteractive(false);
  });
}