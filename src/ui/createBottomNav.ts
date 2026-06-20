import Phaser from 'phaser';

import { UI } from './theme';

type BottomNavOptions = {
  activeScene: string;
  disabledScenes?: string[];
  disabledMessage?: string;
};

type BottomNavItem = {
  label: string;
  scene: string;
  icon: string;
};

const BOTTOM_NAV_TRANSITION_COOLDOWN_MS = 520;
const BOTTOM_NAV_DISABLED_TOAST_COOLDOWN_MS = 650;

let bottomNavLockedUntil = 0;
let bottomNavToastLockedUntil = 0;

function isBottomNavLocked(): boolean {
  return Date.now() < bottomNavLockedUntil;
}

function lockBottomNav(): void {
  bottomNavLockedUntil = Date.now() + BOTTOM_NAV_TRANSITION_COOLDOWN_MS;

  window.setTimeout(() => {
    if (Date.now() >= bottomNavLockedUntil) {
      bottomNavLockedUntil = 0;
    }
  }, BOTTOM_NAV_TRANSITION_COOLDOWN_MS + 40);
}

function canShowBottomNavToast(): boolean {
  const now = Date.now();

  if (now < bottomNavToastLockedUntil) {
    return false;
  }

  bottomNavToastLockedUntil = now + BOTTOM_NAV_DISABLED_TOAST_COOLDOWN_MS;
  return true;
}

function showBottomNavToast(scene: Phaser.Scene, message: string): void {
  if (!canShowBottomNavToast()) {
    return;
  }

  const { width, height } = scene.scale;

  const toast = scene.add.text(width / 2, height - 145, message, {
    fontFamily: UI.font.body,
    fontSize: height < 760 ? '15px' : '18px',
    color: '#ffb3b3',
    backgroundColor: '#000000',
    padding: {
      x: 12,
      y: 8,
    },
    wordWrap: {
      width: Math.min(width - 48, 420),
      useAdvancedWrap: true,
    },
    maxLines: 2,
    align: 'center',
  }).setOrigin(0.5).setDepth(1200);

  scene.time.delayedCall(1400, () => {
    toast.destroy();
  });
}

function startBottomNavScene(scene: Phaser.Scene, targetScene: string): void {
  if (targetScene === 'InventoryScene') {
    scene.scene.start('InventoryScene', {
      returnScene: 'CampScene',
      selectedCategory: 'all',
      inventoryScrollY: 0,
    });

    return;
  }

  scene.scene.start(targetScene);
}

export function createBottomNav(scene: Phaser.Scene, options: BottomNavOptions) {
  const { width, height } = scene.scale;

  const activeScene = options.activeScene;
  const disabledScenes = options.disabledScenes ?? [];
  const disabledMessage = options.disabledMessage ?? 'Сейчас нельзя перейти на этот экран.';

  const items: BottomNavItem[] = [
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

  let isNavigating = false;

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
    const isBlocked = isActive || isDisabled;

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
        useHandCursor: !isBlocked,
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

    const resetButtonVisual = () => {
      button.setFillStyle(bgColor, bgAlpha);
      icon.setColor(iconColor);
      label.setColor(labelColor);
    };

    button.on('pointerover', () => {
      if (isBlocked || isNavigating || isBottomNavLocked()) {
        return;
      }

      button.setFillStyle(0x21150f, 0.95);
      icon.setColor('#f0d58a');
      label.setColor('#f0d58a');
    });

    button.on('pointerout', () => {
      resetButtonVisual();
    });

    button.on('pointerdown', () => {
      if (isDisabled) {
        showBottomNavToast(scene, disabledMessage);
        return;
      }

      if (isActive || isNavigating || isBottomNavLocked()) {
        return;
      }

      button.setFillStyle(0x332216, 0.98);
      icon.setColor('#ffe2a3');
      label.setColor('#ffe2a3');
    });

    button.on('pointerupoutside', () => {
      resetButtonVisual();
    });

    button.on('pointerup', () => {
      if (isDisabled) {
        showBottomNavToast(scene, disabledMessage);
        return;
      }

      if (isActive || isNavigating || isBottomNavLocked()) {
        resetButtonVisual();
        return;
      }

      isNavigating = true;
      lockBottomNav();

      button.disableInteractive();
      button.setFillStyle(0x332216, 0.9);
      icon.setColor('#ffe2a3');
      label.setColor('#ffe2a3');

      startBottomNavScene(scene, item.scene);
    });
  });
}
