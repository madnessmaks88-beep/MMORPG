import Phaser from 'phaser';

import { player } from '../data/player';
import { getRandomLootItem } from '../data/items';

import { createButton } from '../ui/createButton';

import {
  addItemToInventory,
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

    createButton(
      this,
      this.scale.width / 2,
      1180,
      'Вернуться в город',
      () => {
        this.scene.start('CampScene');
      },
      520,
      56
    );
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
          maxQuantity: Math.max(1, Math.floor(player.gold / 80)),
          onConfirm: quantity => {
            this.buyRandomItems(quantity);
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

  private buyRandomItems(quantity = 1) {
    const price = 80;
    const totalPrice = price * quantity;

    if (player.gold < totalPrice) {
      this.showMessage('Недостаточно золота.');
      return;
    }

    player.gold -= totalPrice;

    const receivedItems: string[] = [];

    for (let i = 0; i < quantity; i += 1) {
      const item = getRandomLootItem();

      addItemToInventory(player, item.id);

      receivedItems.push(`${getRarityText(item).toLowerCase()}: ${item.name}`);
    }

    void saveGameAsync();

    const shownItems = receivedItems.slice(0, 5).join('\n');
    const moreText =
      receivedItems.length > 5
        ? `\nи ещё ${receivedItems.length - 5} предметов...`
        : '';

    this.showMessage(
      [
        `Куплено предметов: ${quantity}.`,
        '',
        shownItems + moreText,
      ].join('\n')
    );
  }

  private showMessage(message: string, _color?: string) {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.72
    )
      .setDepth(1000)
      .setInteractive();

    const panel = createPanel(this, width / 2, 610, 600, 260, {
      alpha: 0.98,
      stroke: true,
      warm: true,
    }).setDepth(1001);

    const titleText = this.add.text(width / 2, 540, 'Лавка', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1002);

    const messageText = this.add.text(width / 2, 615, message, {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: UI.colors.text,
      align: 'center',
      wordWrap: {
        width: 520,
      },
      lineSpacing: 5,
    }).setOrigin(0.5).setDepth(1002);

    const ok = createButton(
      this,
      width / 2,
      715,
      'Понятно',
      () => {
        overlay.destroy();
        panel.destroy();
        titleText.destroy();
        messageText.destroy();

        ok.shadow.destroy();
        ok.bg.destroy();
        ok.label.destroy();

        this.scene.restart();
      },
      220,
      54
    );

    ok.shadow.setDepth(1001);
    ok.bg.setDepth(1002);
    ok.label.setDepth(1003);
  }

  private showBuyQuantityConfirm(config: {
    title: string;
    price: number;
    minQuantity?: number;
    maxQuantity: number;
    onConfirm: (quantity: number) => void;
  }) {
    const { width, height } = this.scale;
  
    const minQuantity = config.minQuantity ?? 1;
    const maxAffordable = Math.floor(player.gold / config.price);
    const maxQuantity = Math.max(0, Math.min(config.maxQuantity, maxAffordable));
  
    let quantity = maxQuantity > 0 ? minQuantity : 0;
  
    const modal = this.add.container(0, 0);
    modal.setDepth(1000);
  
    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.72
    ).setInteractive();
  
    const panel = this.add.rectangle(
      width / 2,
      height / 2,
      610,
      460,
      0x17100c,
      0.98
    ).setStrokeStyle(3, UI.colors.goldDark, 0.9);
  
    const titleText = this.add.text(width / 2, height / 2 - 175, 'Покупка', {
      fontFamily: UI.font.title,
      fontSize: '31px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
  
    const itemText = this.add.text(width / 2, height / 2 - 120, config.title, {
      fontFamily: UI.font.title,
      fontSize: '24px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: 520,
      },
    }).setOrigin(0.5);
  
    const quantityText = this.add.text(width / 2, height / 2 - 50, '', {
      fontFamily: UI.font.title,
      fontSize: '30px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
  
    const priceText = this.add.text(width / 2, height / 2 - 10, '', {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.textMuted,
      align: 'center',
    }).setOrigin(0.5);
  
    modal.add([
      overlay,
      panel,
      titleText,
      itemText,
      quantityText,
      priceText,
    ]);
  
    const refreshText = () => {
      const totalPrice = config.price * quantity;
    
      quantityText.setText(`x${quantity}`);
    
      priceText.setText([
        `Цена за 1: ${config.price} золота`,
        `Итого: ${totalPrice} золота`,
        `Твоё золото: ${player.gold}`,
      ].join('\n'));
    };
  
    const close = () => {
      modal.destroy(true);
    };
  
    const changeQuantity = (amount: number) => {
      if (maxQuantity <= 0) {
        return;
      }
    
      quantity = Phaser.Math.Clamp(
        quantity + amount,
        minQuantity,
        maxQuantity
      );
    
      refreshText();
    };
  
    const setQuantity = (value: number) => {
      if (maxQuantity <= 0) {
        return;
      }
    
      quantity = Phaser.Math.Clamp(
        value,
        minQuantity,
        maxQuantity
      );
    
      refreshText();
    };
  
    const addModalButton = (
      x: number,
      y: number,
      text: string,
      onClick: () => void,
      buttonWidth: number,
      buttonHeight: number,
      options?: {
        small?: boolean;
        disabled?: boolean;
        danger?: boolean;
      }
    ) => {
      const button = createButton(
        this,
        x,
        y,
        text,
        onClick,
        buttonWidth,
        buttonHeight,
        options
      );
    
      modal.add([
        button.shadow,
        button.bg,
        button.label,
      ]);
    
      return button;
    };
  
    addModalButton(
      width / 2 - 210,
      height / 2 + 70,
      '-1',
      () => changeQuantity(-1),
      115,
      48,
      {
        small: true,
        disabled: maxQuantity <= 0,
      }
    );
  
    addModalButton(
      width / 2 - 70,
      height / 2 + 70,
      '+1',
      () => changeQuantity(1),
      115,
      48,
      {
        small: true,
        disabled: maxQuantity <= 0,
      }
    );
  
    addModalButton(
      width / 2 + 70,
      height / 2 + 70,
      '+5',
      () => changeQuantity(5),
      115,
      48,
      {
        small: true,
        disabled: maxQuantity <= 0,
      }
    );
  
    addModalButton(
      width / 2 + 210,
      height / 2 + 70,
      'Макс',
      () => setQuantity(maxQuantity),
      115,
      48,
      {
        small: true,
        disabled: maxQuantity <= 0,
      }
    );
  
    addModalButton(
      width / 2,
      height / 2 + 145,
      maxQuantity > 0 ? 'Купить' : 'Недостаточно золота',
      () => {
        if (maxQuantity <= 0) {
          return;
        }
      
        const selectedQuantity = quantity;
      
        close();
      
        config.onConfirm(selectedQuantity);
      },
      360,
      54,
      {
        disabled: maxQuantity <= 0,
      }
    );
  
    addModalButton(
      width / 2,
      height / 2 + 210,
      'Отмена',
      () => {
        close();
      },
      360,
      54
    );
  
    refreshText();
  }

  
}