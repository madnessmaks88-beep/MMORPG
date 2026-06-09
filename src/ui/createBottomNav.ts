import Phaser from 'phaser';

export type BottomNavOptions = {
  activeScene?: string;
  disabledScenes?: string[];
  disabledMessage?: string;
};

type NavItem = {
  label: string;
  scene: string;
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

  scene.add.rectangle(width / 2, navY, width, navHeight, 0x090909, 0.96)
    .setStrokeStyle(2, 0x3a2518);

  scene.add.rectangle(width / 2, height - navHeight, width, 2, 0x8b5a2b, 0.7);

  const items: NavItem[] = [
    {
      label: 'Магазин',
      scene: 'ShopScene',
    },
    {
      label: 'Город',
      scene: 'CampScene',
    },
    {
      label: 'Герой',
      scene: 'ProfileScene',
    },
    {
      label: 'Инвентарь',
      scene: 'InventoryScene',
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

    const bgColor = isActive ? 0x2a1d12 : 0x151515;
    const strokeColor = isActive ? 0xf0d58a : 0x4a3324;
    const textColor = isDisabled
      ? '#555555'
      : isActive
        ? '#f0d58a'
        : '#d8c7a3';

    const button = scene.add.rectangle(x, navY, 150, 76, bgColor, 0.96)
      .setStrokeStyle(2, strokeColor)
      .setInteractive({ useHandCursor: !isDisabled });

    scene.add.text(x, navY, item.label, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: textColor,
    }).setOrigin(0.5);

    button.on('pointerdown', () => {
      if (isDisabled) {
        scene.add.text(width / 2, height - 150, disabledMessage, {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#ffb3b3',
          backgroundColor: '#000000',
          padding: {
            x: 12,
            y: 8,
          },
        }).setOrigin(0.5).setDepth(1000);

        return;
      }

      if (isActive) {
        return;
      }

      scene.scene.start(item.scene);
    });
  });
}