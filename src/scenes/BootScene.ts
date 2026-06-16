import Phaser from 'phaser';

import { player } from '../data/player';
import { getResumeTarget, installAutoSaveGuards, loadGameAsync, restoreEmergencyResumeAfterLoad } from '../systems/SaveSystem';
import {
  getLastVKBridgeError,
  getVKUser,
  initVKBridge,
  isVKEnvironment,
} from '../systems/VKBridgeSystem';

const REQUIRE_VK_ACCOUNT = true;

export class BootScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;
  private detailText?: Phaser.GameObjects.Text;
  private retryButtonObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('BootScene');
  }

  create() {
    this.createLoadingView();
    void this.startup();
  }

  private async startup() {
    this.clearRetryButton();
    this.setStatus('Подключение к VK...', 'Проверяем аккаунт и облачное сохранение.');

    const strictVKAccountMode = REQUIRE_VK_ACCOUNT || isVKEnvironment();
    const vkReady = await initVKBridge();

    if (!vkReady && strictVKAccountMode) {
      this.showConnectionError(
        'Не удалось подключиться к аккаунту VK.',
        'Чтобы на телефоне и ПК был один прогресс, игра запускается только через VK-аккаунт. Открой игру внутри VK Mini Apps, а не прямой Vercel/preview-ссылкой, и нажми “Повторить”.'
      );
      return;
    }

    const vkUser = await getVKUser();

    if (!vkUser && strictVKAccountMode) {
      this.showConnectionError(
        'Не удалось получить профиль VK.',
        'VK ID не получен, поэтому локальный профиль браузера заблокирован. Это защищает от разных аккаунтов на ПК и телефоне.'
      );
      return;
    }

    try {
      this.setStatus('Загрузка сохранения...', 'Получаем прогресс из VK Storage.');

      await loadGameAsync({
        preferVK: true,
        blockLocalFallback: strictVKAccountMode,
      });

      restoreEmergencyResumeAfterLoad();
      installAutoSaveGuards();
    } catch (error) {
      this.showConnectionError(
        'Сохранение VK временно недоступно.',
        'Прогресс не сброшен. Игра не запускает отдельный локальный аккаунт и не создаёт нового героя поверх облачного сохранения. Нажми “Повторить”.',
        error
      );
      return;
    }

    this.setStatus('Вход выполнен', 'Переходим в игру.');

    this.time.delayedCall(180, () => {
      if (!player.raceId) {
        this.scene.start('RaceSelectScene');
        return;
      }

      const resumeTarget = getResumeTarget();

      if (resumeTarget?.scene === 'BattleScene' && resumeTarget.battle) {
        this.scene.start('BattleScene', {
          enemyId: resumeTarget.battle.enemyId,
          returnToDungeon: resumeTarget.battle.returnToDungeon,
          resumeBattle: true,
          battleSnapshot: resumeTarget.battle,
        });
        return;
      }

      if (resumeTarget?.scene === 'DungeonScene') {
        this.scene.start('DungeonScene');
        return;
      }

      this.scene.start('MainMenuScene');
    });
  }

  private createLoadingView() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    this.add.rectangle(centerX, centerY, width, height, 0x030304, 1);
    this.add.circle(centerX, centerY - 96, Math.min(width * 0.22, 130), 0x62518a, 0.09);
    this.add.circle(centerX, centerY - 96, Math.min(width * 0.13, 80), 0xb89a5e, 0.045);

    this.add.text(centerX, centerY - 132, 'Катакомбы Забвения', {
      fontFamily: 'serif',
      fontSize: '30px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: width - 56,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5);

    this.statusText = this.add.text(centerX, centerY - 26, 'Загрузка...', {
      fontFamily: 'serif',
      fontSize: '22px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: width - 64,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5);

    this.detailText = this.add.text(centerX, centerY + 26, '', {
      fontFamily: 'serif',
      fontSize: '15px',
      color: '#9b9488',
      align: 'center',
      lineSpacing: 5,
      wordWrap: {
        width: width - 72,
        useAdvancedWrap: true,
      },
      maxLines: 5,
    }).setOrigin(0.5, 0);
  }

  private setStatus(title: string, details: string) {
    this.statusText?.setText(title);
    this.detailText?.setText(details);
  }

  private showConnectionError(title: string, details: string, error?: unknown) {
    const errorText = getLastVKBridgeError();
    const extra = errorText ? `\n\nТехнически: ${errorText}` : error ? `\n\nТехнически: ${String(error)}` : '';

    this.setStatus(title, `${details}${extra}`);
    this.createRetryButton();
  }

  private createRetryButton() {
    this.clearRetryButton();

    const { width, height } = this.scale;
    const centerX = width / 2;
    const y = Math.min(height - 110, height / 2 + 185);
    const buttonWidth = Math.min(width - 70, 430);
    const buttonHeight = 56;
    const radius = 22;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.35);
    shadow.fillRoundedRect(centerX - buttonWidth / 2, y - buttonHeight / 2 + 5, buttonWidth, buttonHeight, radius);

    const bg = this.add.graphics();
    const draw = (color: number, alpha: number, strokeAlpha: number) => {
      bg.clear();
      bg.fillStyle(color, alpha);
      bg.fillRoundedRect(centerX - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, radius);
      bg.lineStyle(2, 0xb89a5e, strokeAlpha);
      bg.strokeRoundedRect(centerX - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, radius);
    };

    draw(0x21150f, 0.96, 0.82);

    const label = this.add.text(centerX, y, 'Повторить подключение', {
      fontFamily: 'serif',
      fontSize: '17px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: buttonWidth - 28,
      },
      maxLines: 1,
    }).setOrigin(0.5);

    const zone = this.add.zone(centerX, y, buttonWidth, buttonHeight).setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      draw(0x2c1d14, 1, 1);
      label.setColor('#ffffff');
    });

    zone.on('pointerout', () => {
      draw(0x21150f, 0.96, 0.82);
      label.setColor('#d8c088');
    });

    zone.on('pointerup', () => {
      void this.startup();
    });

    this.retryButtonObjects.push(shadow, bg, label, zone);
  }

  private clearRetryButton() {
    this.retryButtonObjects.forEach(object => object.destroy());
    this.retryButtonObjects = [];
  }
}
