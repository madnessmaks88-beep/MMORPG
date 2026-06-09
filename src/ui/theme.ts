import Phaser from 'phaser';

export const UI = {
  colors: {
    bg: 0x070605,
    bgSoft: 0x120d0a,

    panel: 0x0d0d0d,
    panelSoft: 0x17100c,
    panelWarm: 0x1b120d,

    gold: 0xf0d58a,
    goldDark: 0x8b5a2b,

    greenHex: 0x75d184,
    redHex: 0xff6b6b,
    blueHex: 0x70a6ff,

    goldText: '#f0d58a',
    text: '#d8c7a3',
    textMuted: '#8f806d',
    textDark: '#5f5548',

    green: '#75d184',
    red: '#ff6b6b',
    blue: '#70a6ff',
  },

  font: {
    title: 'Arial',
    body: 'Arial',
  },
};

export function createSceneBackground(scene: Phaser.Scene) {
  const { width, height } = scene.scale;

  scene.add.rectangle(width / 2, height / 2, width, height, UI.colors.bg);
  scene.add.rectangle(width / 2, height / 2, width, height, UI.colors.bgSoft, 0.94);

  scene.add.circle(width / 2, 170, 155, 0x2a1209, 0.25);
  scene.add.circle(width / 2, 170, 95, 0x7a2b14, 0.16);
  scene.add.circle(width / 2, 170, 52, 0xf0a348, 0.1);

  for (let i = 0; i < 42; i++) {
    const x = Phaser.Math.Between(24, width - 24);
    const y = Phaser.Math.Between(30, height - 130);
    const size = Phaser.Math.Between(1, 3);

    scene.add.circle(x, y, size, 0xd8b56d, 0.04);
  }

  scene.add.rectangle(width / 2, height - 92, width, 185, 0x090706, 0.28);
}

export function createTitle(
  scene: Phaser.Scene,
  title: string,
  subtitle?: string
) {
  const { width } = scene.scale;

  scene.add.text(width / 2, 52, title, {
    fontFamily: UI.font.title,
    fontSize: '40px',
    color: UI.colors.text,
    stroke: '#000000',
    strokeThickness: 5,
  }).setOrigin(0.5);

  if (subtitle) {
    scene.add.text(width / 2, 92, subtitle, {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.textMuted,
    }).setOrigin(0.5);
  }
}

export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: {
    alpha?: number;
    stroke?: boolean;
    warm?: boolean;
  }
) {
  const alpha = options?.alpha ?? 0.9;
  const stroke = options?.stroke ?? true;
  const color = options?.warm ? UI.colors.panelWarm : UI.colors.panel;

  scene.add.rectangle(x, y + 5, width, height, 0x000000, 0.22);

  const panel = scene.add.rectangle(x, y, width, height, color, alpha);

  if (stroke) {
    panel.setStrokeStyle(2, UI.colors.goldDark, 0.5);
  }

  return panel;
}

export function createSectionTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string
) {
  return scene.add.text(x, y, text, {
    fontFamily: UI.font.title,
    fontSize: '26px',
    color: UI.colors.text,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5);
}

export function createSmallText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options?: {
    fontSize?: string;
    color?: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
  }
) {
  return scene.add.text(x, y, text, {
    fontFamily: UI.font.body,
    fontSize: options?.fontSize ?? '18px',
    color: options?.color ?? UI.colors.text,
    align: options?.align ?? 'center',
    wordWrap: options?.width
      ? {
          width: options.width,
        }
      : undefined,
    lineSpacing: 5,
  }).setOrigin(0.5);
}