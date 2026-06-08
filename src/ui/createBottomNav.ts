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

export function createBottomNav(scene: Phaser.Scene, options: BottomNavOptions = {}) {
  const { width, height } = scene.scale;

  const activeScene = options.activeScene;
  const disabledScenes = options.disabledScenes ?? [];
  const disabledMessage =
    options.disabledMessage ?? 'Нельзя выйти отсюда прямо сейчас.';

  const navHeight = 130;
  const navY = height - navHeight / 2;

  scene.add.rectangle(width / 2, navY, width, navHeight, 0x080808, 0.96)
    .setStrokeStyle(2, 0x2a2117)
    .setDepth(900);

  scene.add.rectangle(width / 2, height - navHeight, width, 2, 0x8b5a2b, 0.65)
    .setDepth(901);

  const items: NavItem[] = [
    {
      label: 'Магазин',
      scene: 'ShopScene',
    },
    {
      label: 'Главный\nэкран',
      scene: 'CampScene',
    },
    {
      label: 'Инвентарь',
      scene: 'InventoryScene',
    },
  ];

  const positions = [
    width * 0.18,
    width * 0.5,
    width * 0.82,
  ];

  items.forEach((item, index) => {
    const x = positions[index];
    const isActive = activeScene === item.scene;
    const isDisabled = disabledScenes.includes(item.scene);

    const buttonBg = scene.add.rectangle(
      x,
      navY,
      185,
      82,
      isActive ? 0x2a1d13 : isDisabled ? 0x111111 : 0x171313,
      1
    )
      .setStrokeStyle(2, isActive ? 0xf0d58a : isDisabled ? 0x444444 : 0x8b5a2b)
      .setInteractive({ useHandCursor: !isActive && !isDisabled })
      .setDepth(902);

    const label = scene.add.text(x, navY, item.label, {
      fontFamily: 'Arial',
      fontSize: item.scene === 'CampScene' ? '18px' : '20px',
      color: isActive ? '#f0d58a' : isDisabled ? '#666666' : '#d8c7a3',
      align: 'center',
      lineSpacing: -4,
    })
      .setOrigin(0.5)
      .setDepth(903);

    if (isDisabled) {
      buttonBg.on('pointerdown', () => {
        showSmallNavMessage(scene, disabledMessage);
      });

      return;
    }

    if (!isActive) {
      buttonBg.on('pointerover', () => {
        buttonBg.setFillStyle(0x241515);
        label.setColor('#f0d58a');
      });

      buttonBg.on('pointerout', () => {
        buttonBg.setFillStyle(0x171313);
        label.setColor('#d8c7a3');
      });

      buttonBg.on('pointerdown', () => {
        scene.scene.start(item.scene);
      });
    }
  });
}

function showSmallNavMessage(scene: Phaser.Scene, message: string) {
  const { width, height } = scene.scale;

  const panel = scene.add.rectangle(width / 2, height - 190, 560, 70, 0x171313, 0.96)
    .setStrokeStyle(2, 0x8b5a2b)
    .setDepth(1000);

  const text = scene.add.text(width / 2, height - 190, message, {
    fontFamily: 'Arial',
    fontSize: '20px',
    color: '#f0d58a',
    align: 'center',
  })
    .setOrigin(0.5)
    .setDepth(1001);

  scene.tweens.add({
    targets: [panel, text],
    alpha: 0,
    delay: 1300,
    duration: 300,
    onComplete: () => {
      panel.destroy();
      text.destroy();
    },
  });
}