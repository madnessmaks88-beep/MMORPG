import Phaser from 'phaser';

type BottomNavOptions = {
  active?: 'shop' | 'camp' | 'inventory';
};

export function createBottomNav(
  scene: Phaser.Scene,
  options: BottomNavOptions = {}
) {
  const { width, height } = scene.scale;

  const panelHeight = 130;
  const panelY = height - panelHeight / 2;

  scene.add.rectangle(width / 2, panelY, width, panelHeight, 0x120d0d);
  scene.add.rectangle(width / 2, height - panelHeight, width, 3, 0x8b5a2b);

  createNavButton(scene, 120, panelY, 'Магазин', options.active === 'shop', () => {
    scene.scene.start('ShopScene');
  });

  createNavButton(scene, width / 2, panelY, 'Главный\nэкран', options.active === 'camp', () => {
    scene.scene.start('CampScene');
  });

  createNavButton(scene, width - 120, panelY, 'Инвентарь', options.active === 'inventory', () => {
    scene.scene.start('InventoryScene');
  });
}

function createNavButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  isActive: boolean,
  onClick: () => void
) {
  const bgColor = isActive ? 0x3a2020 : 0x241515;
  const strokeColor = isActive ? 0xd8b56d : 0x8b5a2b;

  const container = scene.add.container(x, y);

  const bg = scene.add.rectangle(0, 0, 200, 82, bgColor);
  bg.setStrokeStyle(2, strokeColor);
  bg.setInteractive({ useHandCursor: true });

  const label = scene.add.text(0, 0, text, {
    fontFamily: 'Arial',
    fontSize: '21px',
    color: isActive ? '#f0d58a' : '#e6d2aa',
    align: 'center',
    lineSpacing: 2,
  }).setOrigin(0.5);

  container.add([bg, label]);

  bg.on('pointerover', () => {
    bg.setFillStyle(0x3a2020);
  });

  bg.on('pointerout', () => {
    bg.setFillStyle(bgColor);
  });

  bg.on('pointerdown', () => {
    onClick();
  });

  return container;
}