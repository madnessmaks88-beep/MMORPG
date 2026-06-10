import Phaser from 'phaser';

import { player } from '../data/player';
import { getRandomLootItem } from '../data/items';

import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';

import {
  addItemToInventory,
  getRarityColor,
  getRarityText,
} from '../systems/InventorySystem';

import { saveGameAsync } from '../systems/SaveSystem';

import {
  UI,
  createPanel,
  createSceneBackground,
  createSectionTitle,
  createSmallText,
  createTitle,
} from '../ui/theme';


export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  create() {
    createSceneBackground(this);
    createTitle(this, 'Лавка снабжения', 'Покупка зелий и полезных вещей перед спуском');

    this.createGoldPanel();
    this.createShopItems();

    createBottomNav(this, {
      activeScene: 'ShopScene',
    });
  }

  private createGoldPanel() {
    const { width } = this.scale;

    const panelY = 180;

    createPanel(this, width / 2, panelY, 620, 135, {
      alpha: 0.72,
      stroke: false,
      warm: true,
    });

    this.add.text(width / 2, panelY - 38, 'Твои ресурсы', {
      fontFamily: UI.font.title,
      fontSize: '23px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    createSmallText(
      this,
      width / 2,
      panelY + 18,
      `Золото: ${player.gold}\nЗелья здоровья: ${player.potions}`,
      {
        fontSize: '19px',
        color: UI.colors.text,
        width: 540,
      }
    );
  }

  private createShopItems() {
    const { width } = this.scale;

    const panelY = 575;

    createPanel(this, width / 2, panelY, 620, 560, {
      alpha: 0.86,
      stroke: true,
      warm: false,
    });

    createSectionTitle(this, width / 2, panelY - 235, 'Товары');

    this.createShopItemCard({
      y: panelY - 150,
      icon: '✚',
      title: 'Зелье здоровья',
      description: 'Полезно в бою. Лучше всегда иметь запас.',
      price: 25,
      buttonText: 'Купить',
      onBuy: () => {
        this.showBuyQuantityConfirm({
          title: 'Зелье здоровья',
          price: 25,
          maxQuantity: Math.max(1, Math.floor(player.gold / 25)),
          onConfirm: quantity => {
            this.buyPotion(quantity);
          },
        });
      },
    });

    this.createShopItemCard({
      y: panelY - 25,
      icon: '✦',
      title: 'Случайный предмет',
      description: 'Можно получить оружие, броню или талисман.',
      price: 80,
      buttonText: 'Купить',
      onBuy: () => {
        this.showBuyQuantityConfirm({
          title: 'Случайный предмет',
          price: 80,
          maxQuantity: 1,
          onConfirm: () => {
            this.buyRandomItem();
          },
        });
      },
    });

    this.createShopItemCard({
      y: panelY + 100,
      icon: '♥',
      title: 'Улучшение здоровья',
      description: 'Навсегда увеличивает максимальное HP героя.',
      price: 120,
      buttonText: 'Улучшить',
      onBuy: () => {
        this.showBuyQuantityConfirm({
          title: 'Улучшение здоровья',
          price: 120,
          maxQuantity: 1,
          onConfirm: () => {
            this.buyHpUpgrade();
          },
        });
      },
    });

    createSmallText(
      this,
      width / 2,
      panelY + 220,
      'Новые товары и улучшения позже можно добавить в кузницу или редкую лавку.',
      {
        fontSize: '15px',
        color: UI.colors.textMuted,
        width: 540,
      }
    );
  }

  private createShopItemCard(config: {
    y: number;
    icon: string;
    title: string;
    description: string;
    price: number;
    buttonText: string;
    onBuy: () => void;
  }) {
    const { width } = this.scale;

    const canBuy = player.gold >= config.price;

    this.add.rectangle(width / 2, config.y + 4, 560, 104, 0x000000, 0.22);

    this.add.rectangle(width / 2, config.y, 560, 104, 0x14100d, 0.86)
      .setStrokeStyle(2, UI.colors.goldDark, 0.45);

    this.add.circle(width / 2 - 245, config.y, 28, 0x2a1d13, 1)
      .setStrokeStyle(2, UI.colors.goldDark, 0.6);

    this.add.text(width / 2 - 245, config.y, config.icon, {
      fontFamily: UI.font.body,
      fontSize: '24px',
      color: UI.colors.goldText,
    }).setOrigin(0.5);

    this.add.text(width / 2 - 205, config.y - 30, config.title, {
      fontFamily: UI.font.title,
      fontSize: '19px',
      color: UI.colors.goldText,
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 205, config.y - 2, config.description, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: UI.colors.text,
      wordWrap: {
        width: 310,
      },
    }).setOrigin(0, 0.5);

    this.add.text(width / 2 - 205, config.y + 31, `Цена: ${config.price} золота`, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: canBuy ? UI.colors.textMuted : UI.colors.red,
    }).setOrigin(0, 0.5);

    createButton(
      this,
      width / 2 + 205,
      config.y + 6,
      config.buttonText,
      config.onBuy,
      150,
      46,
      {
        small: true,
        disabled: !canBuy,
      }
    );
  }

  private buyPotion(quantity = 1) {
   const price = 25;
   const totalPrice = price * quantity;

   if (player.gold < totalPrice) {
     this.showMessage('Недостаточно золота.');
     return;
   }

   player.gold -= totalPrice;
   player.potions += quantity;

   void saveGameAsync();

   this.showMessage(`Куплено зелий: ${quantity}.`);
  }

  private buyRandomItem() {
    const price = 80;

    if (player.gold < price) {
      this.showMessage('Недостаточно золота.');
      return;
    }

    const item = getRandomLootItem();

    player.gold -= price;
    addItemToInventory(player, item.id);

    void saveGameAsync();

    this.showMessage(
      `Получен ${getRarityText(item).toLowerCase()} предмет:\n${item.name} +0`,
      getRarityColor(item)
    );
  }

  private buyHpUpgrade() {
    const price = 120;

    if (player.gold < price) {
      this.showMessage('Недостаточно золота.');
      return;
    }

    player.gold -= price;
    player.maxHp += 10;
    player.hp += 10;

    void saveGameAsync();

    this.showMessage('Максимальное HP увеличено на 10.');
  }

  private showMessage(message: string, _color?: string) {
    const { width } = this.scale;
    
    createPanel(this, width / 2, 610, 600, 240, {
      alpha: 0.98,
      stroke: true,
      warm: true,
    }).setDepth(100);
  
    this.add.text(width / 2, 550, 'Лавка', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(102);
  
    this.add.text(width / 2, 615, message, {
      fontFamily: UI.font.body,
      fontSize: '21px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 520,
      },
    }).setOrigin(0.5).setDepth(102);
  
    const ok = createButton(
      this,
      width / 2,
      700,
      'Понятно',
      () => {
        this.scene.restart();
      },
      220,
      54
    );
  
    ok.shadow.setDepth(100);
    ok.bg.setDepth(101);
    ok.label.setDepth(102);
  }
  private showBuyQuantityConfirm(config: {
    title: string;
    price: number;
    minQuantity?: number;
    maxQuantity: number;
    onConfirm: (quantity: number) => void;
  }) {
    const { width, height } = this.scale;

    let quantity = config.minQuantity ?? 1;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setDepth(100);

    const panel = createPanel(this, width / 2, height / 2, 610, 400, {
      alpha: 0.98,
      stroke: true,
      warm: true,
    }).setDepth(101);

    const titleText = this.add.text(width / 2, height / 2 - 135, 'Подтверждение покупки', {
      fontFamily: UI.font.title,
      fontSize: '29px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(102);

    const itemText = this.add.text(width / 2, height / 2 - 75, config.title, {
      fontFamily: UI.font.body,
      fontSize: '22px',
      color: UI.colors.text,
    }).setOrigin(0.5).setDepth(102);

    const quantityText = this.add.text(width / 2, height / 2 - 15, '', {
      fontFamily: UI.font.body,
      fontSize: '24px',
      color: UI.colors.goldText,
    }).setOrigin(0.5).setDepth(102);

    const priceText = this.add.text(width / 2, height / 2 + 25, '', {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: UI.colors.textMuted,
    }).setOrigin(0.5).setDepth(102);

    const refreshText = () => {
      const totalPrice = config.price * quantity;

      quantityText.setText(`Количество: ${quantity}`);
      priceText.setText(`Итого: ${totalPrice} золота`);
    };

    const close = () => {
      overlay.destroy();
      panel.destroy();
      titleText.destroy();
      itemText.destroy();
      quantityText.destroy();
      priceText.destroy();

      minus.shadow.destroy();
      minus.bg.destroy();
      minus.label.destroy();

      plus.shadow.destroy();
      plus.bg.destroy();
      plus.label.destroy();

      buy.shadow.destroy();
      buy.bg.destroy();
      buy.label.destroy();

      cancel.shadow.destroy();
      cancel.bg.destroy();
      cancel.label.destroy();
    };

    const minus = createButton(
      this,
      width / 2 - 145,
      height / 2 + 85,
      '-',
      () => {
        quantity = Math.max(config.minQuantity ?? 1, quantity - 1);
        refreshText();
      },
      90,
      50
    );

    const plus = createButton(
      this,
      width / 2 + 145,
      height / 2 + 85,
      '+',
      () => {
        quantity = Math.min(config.maxQuantity, quantity + 1);
        refreshText();
      },
      90,
      50
    );

    const buy = createButton(
      this,
      width / 2,
      height / 2 + 150,
      'Купить',
      () => {
        config.onConfirm(quantity);
        close();
      },
      260,
      54
    );

    const cancel = createButton(
      this,
      width / 2,
      height / 2 + 215,
      'Отмена',
      () => {
        close();
      },
      260,
      54
    );

    for (const button of [minus, plus, buy, cancel]) {
      button.shadow.setDepth(101);
      button.bg.setDepth(102);
      button.label.setDepth(103);
    }

    refreshText();
  }

  
}