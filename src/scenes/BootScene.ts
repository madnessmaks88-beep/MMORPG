import Phaser from 'phaser';

import { player } from '../data/player';
import { loadGameAsync } from '../systems/SaveSystem';
import { getVKUser, initVKBridge } from '../systems/VKBridgeSystem';
import { UI, applyGameUIFontToScene, loadGameUIFont } from '../ui/theme';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  async create() {
    const fontLoadPromise = loadGameUIFont();

    this.createLoadingText();

    void fontLoadPromise.then(() => {
      applyGameUIFontToScene(this);
    });

    try {
      await initVKBridge();
      await getVKUser();

      const isLocalDev =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      const loadResult = await loadGameAsync(
        isLocalDev
          ? { preferVK: false }
          : { preferVK: true, blockLocalFallback: true }
      );

      if (loadResult.cloudFailed && !loadResult.hasSave && !isLocalDev) {
        await fontLoadPromise;
        this.showCloudLoadError();
        return;
      }

      await fontLoadPromise;
      this.goNext();
    } catch (error) {
      console.warn('Boot loading failed:', error);
      this.showCloudLoadError();
    }
  }

  private createLoadingText() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x050607, 1);

    this.add.text(width / 2, height / 2, 'Загрузка сохранения...', {
      fontFamily: UI.font.title,
      fontSize: '22px',
      color: '#d8c088',
      align: 'center',
    }).setOrigin(0.5);
  }

  private goNext() {
    if (!player.raceId) {
      this.scene.start('RaceSelectScene');
      return;
    }

    this.scene.start('MainMenuScene');
  }

  private showCloudLoadError() {
    const { width, height } = this.scale;

    this.children.removeAll();

    this.add.rectangle(width / 2, height / 2, width, height, 0x050607, 1);

    this.add.text(width / 2, height / 2 - 86, 'Не удалось загрузить сохранение', {
      fontFamily: UI.font.title,
      fontSize: '25px',
      color: '#d8c088',
      align: 'center',
      wordWrap: {
        width: width - 56,
      },
    }).setOrigin(0.5);

    this.add.text(
      width / 2,
      height / 2 - 20,
      'VK Storage временно не ответил.\nЧтобы не сбросить прогресс, новая игра не запускается.\nПопробуй загрузить ещё раз.',
      {
        fontFamily: UI.font.body,
        fontSize: '17px',
        color: '#b8aa91',
        align: 'center',
        lineSpacing: 6,
        wordWrap: {
          width: width - 64,
        },
      }
    ).setOrigin(0.5);

    const buttonY = height / 2 + 98;
    const button = this.add.rectangle(width / 2, buttonY, Math.min(width - 76, 360), 62, 0x21150f, 1)
      .setStrokeStyle(2, 0xb89a5e, 0.75)
      .setInteractive({
        useHandCursor: true,
      });

    const label = this.add.text(width / 2, buttonY, 'Загрузить ещё раз', {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: '#f0d58a',
    }).setOrigin(0.5);

    button.on('pointerover', () => {
      button.setFillStyle(0x2d1d14, 1);
      label.setColor('#ffffff');
    });

    button.on('pointerout', () => {
      button.setFillStyle(0x21150f, 1);
      label.setColor('#f0d58a');
    });

    button.on('pointerdown', () => {
      this.scene.restart();
    });
  }
}
