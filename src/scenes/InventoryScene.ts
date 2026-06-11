import Phaser from 'phaser';

import { player, type EquipmentSlot, type InventoryItem } from '../data/player';
import { createButton } from '../ui/createButton';
import { createBottomNav } from '../ui/createBottomNav';
import { saveGameAsync } from '../systems/SaveSystem';

import {
  equipItem,
  getBaseItemFromInventoryItem,
  getItemSellPrice,
  getPlayerStats,
  getRarityColorHex,
  getRarityStrokeColor,
  getRarityText,
  getSlotIcon,
  getSlotText,
  isItemEquipped,
  sellItem,
  unequipItem,
	createItemStatsText,
	getWeaponTypeText,
	getWeaponTypeDescription,
} from '../systems/InventorySystem';

import {
  UI,
  createPanel,
  createSceneBackground,
  createSmallText,
} from '../ui/theme';

type InventoryCategory = 'all' | 'weapon' | 'armor' | 'potions';

export class InventoryScene extends Phaser.Scene {
	
	private isItemInfoOpen = false;

	private returnScene = 'CampScene';

	private itemInfoContainer?: Phaser.GameObjects.Container;

	private inventoryContainer!: Phaser.GameObjects.Container;

	private inventoryScrollY = 0;
	private inventoryTargetScrollY = 0;
	private inventoryMaxScrollY = 0;

	private inventoryListTop = 0;
	private inventoryListHeight = 0;
	private inventoryListBottom = 0;

	private inventoryLastRenderedScrollY = -1;

	private initialInventoryScrollY = 0;

	private isDraggingInventory = false;
	private dragStartY = 0;
	private dragStartScrollY = 0;

	private didDragInventory = false;

	private selectedCategory: InventoryCategory = 'all';

  constructor() {
    super('InventoryScene');

		
  }

	init(data?: {
	  inventoryScrollY?: number;
	  selectedCategory?: InventoryCategory;
	  returnScene?: string;
	}) {
	  this.initialInventoryScrollY = data?.inventoryScrollY ?? 0;
	  this.selectedCategory = data?.selectedCategory ?? 'all';
	  this.returnScene = data?.returnScene ?? 'CampScene';

	  // ВАЖНО: при каждом входе/рестарте инвентаря сбрасываем модальные окна
	  this.isItemInfoOpen = false;
	  this.isDraggingInventory = false;
		this.didDragInventory = false;
	  this.itemInfoContainer = undefined;
	}

  create(data?: {
	  returnScene?: string;
	}) {
	  if (!data?.returnScene && this.returnScene !== 'DungeonScene') {
	    this.returnScene = 'CampScene';
	  }

	  createSceneBackground(this);
	  this.createInventoryBackdrop();

	  this.createInventoryHeader();
	  this.createQuickStatsPanel();
	  this.createEquipmentPanel();
	  this.createInventoryList();
	  this.createCategoryTabs();

	  if (this.returnScene === 'DungeonScene') {
	    this.createReturnButton();
	  } else {
	    createBottomNav(this, {
	      activeScene: 'InventoryScene',
	    });
	  }
	}

	private restartInventory() {
	  this.isItemInfoOpen = false;
	  this.isDraggingInventory = false;

	  if (this.itemInfoContainer) {
	    this.itemInfoContainer.destroy(true);
	    this.itemInfoContainer = undefined;
	  }

	  this.scene.restart({
	    inventoryScrollY: this.inventoryTargetScrollY,
	    selectedCategory: this.selectedCategory,
	    returnScene: this.returnScene,
	  });
	}

	private createInventoryBackdrop() {
	  const { width, height } = this.scale;

	  // мягкое свечение сверху
	  this.add.circle(width / 2, 145, 220, 0x8b5a2b, 0.06).setDepth(0);
	  this.add.circle(width / 2, 145, 120, 0xf0d58a, 0.035).setDepth(0);

	  // затемнение нижней области
	  this.add.rectangle(width / 2, height - 250, width, 420, 0x040302, 0.22).setDepth(0);

	  // декоративные пылинки
	  for (let i = 0; i < 16; i += 1) {
	    const x = 35 + i * 45;
	    const y = 90 + (i % 6) * 80;

	    this.add.circle(x, y, 2 + (i % 3), 0xf0d58a, 0.08).setDepth(1);
	  }
	}

	private createInventoryHeader() {
	 const { width } = this.scale;

	 this.add.text(width / 2, 52, 'Сумка героя', {
	   fontFamily: UI.font.title,
	   fontSize: '36px',
	   color: UI.colors.goldText,
	   stroke: '#000000',
	   strokeThickness: 6,
	 }).setOrigin(0.5).setDepth(10);
	}

	private createQuickStatsPanel() {
	  const { width } = this.scale;

	  const stats = getPlayerStats(player);

	  const panelY = 140;

	  this.createRoundedPanel({
	    x: width / 2,
	    y: panelY,
	    width: 620,
	    height: 105,
	    radius: 30,
	    color: 0x0d0a08,
	    alpha: 0.92,
	    strokeColor: UI.colors.goldDark,
	    strokeAlpha: 0.5,
	    depth: 2,
	  });

	  this.createStatusChip(width / 2 - 228, panelY, 'HP', `${player.hp}/${stats.maxHp}`, '♥', UI.colors.redHex);
	  this.createStatusChip(width / 2 - 76, panelY, 'АТК', `${stats.attack}`, '⚔', UI.colors.gold);
	  this.createStatusChip(width / 2 + 76, panelY, 'ЗАЩ', `${stats.defense}`, '🛡', UI.colors.goldDark);
	  this.createStatusChip(width / 2 + 228, panelY, 'Золото', `${player.gold}`, '◆', UI.colors.gold);
	}

	private createInventorySmallActionButton(config: {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const radius = 14;
  const danger = config.danger ?? false;
  const disabled = config.disabled ?? false;

  const bgColor = disabled
    ? 0x151515
    : danger
      ? 0x2a1010
      : 0x102016;

  const hoverColor = danger ? 0x3a1515 : 0x183322;

  const strokeColor = disabled
    ? 0x333333
    : danger
      ? 0xff6b6b
      : 0x75d184;

  const textColor = disabled
    ? '#555555'
    : danger
      ? '#ffb3b3'
      : UI.colors.green;

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.28);
  shadow.fillRoundedRect(
    config.x - config.width / 2,
    config.y - config.height / 2 + 3,
    config.width,
    config.height,
    radius
  );

  const bg = this.add.graphics();
  bg.fillStyle(bgColor, disabled ? 0.68 : 0.96);
  bg.fillRoundedRect(
    config.x - config.width / 2,
    config.y - config.height / 2,
    config.width,
    config.height,
    radius
  );

  bg.lineStyle(2, strokeColor, disabled ? 0.35 : 0.85);
  bg.strokeRoundedRect(
    config.x - config.width / 2,
    config.y - config.height / 2,
    config.width,
    config.height,
    radius
  );

  const label = this.add.text(config.x, config.y, config.text, {
    fontFamily: UI.font.body,
    fontSize: '12px',
    color: textColor,
  }).setOrigin(0.5);

  if (disabled) {
    return {
      shadow,
      bg,
      label,
    };
  }

  bg.setInteractive(
    new Phaser.Geom.Rectangle(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height
    ),
    Phaser.Geom.Rectangle.Contains
  );

  bg.on('pointerover', () => {
    bg.clear();

    bg.fillStyle(hoverColor, 1);
    bg.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    bg.lineStyle(2, strokeColor, 1);
    bg.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    label.setColor(danger ? '#ffd0d0' : '#a8f0b4');
  });

  bg.on('pointerout', () => {
    bg.clear();

    bg.fillStyle(bgColor, 0.96);
    bg.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    bg.lineStyle(2, strokeColor, 0.85);
    bg.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    label.setColor(textColor);
  });

  bg.on('pointerdown', () => {
    bg.setScale(0.985);
    label.setScale(0.985);
  });

  bg.on('pointerup', () => {
    bg.setScale(1);
    label.setScale(1);

    config.onClick();
  });

  return {
    shadow,
    bg,
    label,
  };
}

	private createStatusChip(
	  x: number,
	  y: number,
	  label: string,
	  value: string,
	  icon: string,
	  accentColor: number
	) {
	  this.createRoundedPanel({
	    x,
	    y,
	    width: 136,
	    height: 66,
	    radius: 20,
	    color: 0x17100c,
	    alpha: 0.95,
	    strokeColor: accentColor,
	    strokeAlpha: 0.28,
	    strokeWidth: 1,
	    depth: 4,
	  });

	  this.add.circle(x - 42, y, 18, accentColor, 0.16)
	    .setStrokeStyle(1, accentColor, 0.5)
	    .setDepth(6);

	  this.add.text(x - 42, y, icon, {
	    fontFamily: UI.font.body,
	    fontSize: '15px',
	    color: UI.colors.text,
	    stroke: '#000000',
	    strokeThickness: 2,
	  }).setOrigin(0.5).setDepth(7);

	  this.add.text(x - 16, y - 12, label, {
	    fontFamily: UI.font.body,
	    fontSize: '11px',
	    color: UI.colors.textMuted,
	  }).setOrigin(0, 0.5).setDepth(7);

	  this.add.text(x - 16, y + 10, value, {
	    fontFamily: UI.font.title,
	    fontSize: '16px',
	    color: UI.colors.text,
	    stroke: '#000000',
	    strokeThickness: 2,
	  }).setOrigin(0, 0.5).setDepth(7);
	}

	private getFilteredInventoryItems() {
	  if (this.selectedCategory === 'all') {
	    return player.inventory;
	  }

	  if (this.selectedCategory === 'potions') {
	    return [];
	  }

	  return player.inventory.filter(inventoryItem => {
	    const item = getBaseItemFromInventoryItem(inventoryItem);

	    if (!item) {
	      return false;
	    }

	    return item.slot === this.selectedCategory;
	  });
	}

  private createEquipmentPanel() {
	  const { width } = this.scale;

	  const panelY = 315;

	  this.createRoundedPanel({
	    x: width / 2,
	    y: panelY,
	    width: 620,
	    height: 220,
	    radius: 32,
	    color: 0x100c09,
	    alpha: 0.92,
	    strokeColor: UI.colors.goldDark,
	    strokeAlpha: 0.5,
	    depth: 2,
	  });

	  this.add.text(width / 2, panelY - 85, 'Экипировка', {
	    fontFamily: UI.font.title,
	    fontSize: '29px',
	    color: UI.colors.goldText,
	    stroke: '#000000',
	    strokeThickness: 5,
	  }).setOrigin(0.5).setDepth(10);

	  this.createEquipmentSlotCard('weapon', width / 2 - 205, panelY + 22);
	  this.createEquipmentSlotCard('armor', width / 2, panelY + 22);
	  this.createEquipmentSlotCard('trinket', width / 2 + 205, panelY + 22);
	}

	private createEquipmentSlotCard(slot: EquipmentSlot, x: number, y: number) {
	  const instanceId = player.equipment[slot];

	  const inventoryItem = instanceId
	    ? player.inventory.find(item => item.instanceId === instanceId)
	    : undefined;

	  const item = inventoryItem
	    ? getBaseItemFromInventoryItem(inventoryItem)
	    : undefined;

	  const slotName = getSlotText(slot);

	  const rarityColor = item ? getRarityColorHex(item) : UI.colors.goldDark;
	  const rarityStrokeColor = item ? getRarityStrokeColor(item) : UI.colors.goldDark;

	  this.createRoundedPanel({
	    x,
	    y,
	    width: 185,
	    height: 125,
	    radius: 24,
	    color: item ? 0x1a130f : 0x0d0d0d,
	    alpha: item ? 0.98 : 0.82,
	    strokeColor: item ? rarityStrokeColor : UI.colors.goldDark,
	    strokeAlpha: item ? 0.75 : 0.28,
	    strokeWidth: 2,
	    depth: 4,
	  });

	  this.add.circle(x, y - 34, 25, item ? rarityColor : 0x17100c, item ? 0.9 : 0.7)
	    .setStrokeStyle(2, item ? rarityStrokeColor : UI.colors.goldDark, 0.65)
	    .setDepth(6);

	  this.add.text(x, y - 34, getSlotIcon(slot), {
	    fontFamily: UI.font.body,
	    fontSize: '20px',
	    color: item ? '#ffffff' : UI.colors.textMuted,
	  }).setOrigin(0.5).setDepth(7);

	  this.add.text(x, y + 3, slotName, {
	    fontFamily: UI.font.body,
	    fontSize: '13px',
	    color: UI.colors.textMuted,
	    align: 'center',
	  }).setOrigin(0.5).setDepth(7);

	  const itemText = item && inventoryItem
	    ? `${item.name}${inventoryItem.upgradeLevel > 0 ? ` +${inventoryItem.upgradeLevel}` : ''}`
	    : 'Пусто';

	  this.add.text(x, y + 33, itemText, {
	    fontFamily: UI.font.title,
	    fontSize: item ? '14px' : '16px',
	    color: item ? UI.colors.goldText : UI.colors.textMuted,
	    align: 'center',
	    wordWrap: {
	      width: 150,
	    },
	    stroke: '#000000',
	    strokeThickness: item ? 2 : 0,
	  }).setOrigin(0.5).setDepth(7);

	  if (!item || !inventoryItem) {
	    return;
	  }

	  const zone = this.add.zone(x, y, 185, 125)
	    .setDepth(30)
	    .setInteractive({
	      useHandCursor: true,
	    });

	  zone.on('pointerover', () => {
	    zone.setScale(1.02);
	  });

	  zone.on('pointerout', () => {
	    zone.setScale(1);
	  });

	  zone.on('pointerup', () => {
	    if (this.isItemInfoOpen) {
	      return;
	    }

	    this.showUnequipConfirm(slot, inventoryItem);
	  });
	}

	private closeItemInfo() {
	  if (this.itemInfoContainer) {
	    this.itemInfoContainer.destroy(true);
	    this.itemInfoContainer = undefined;
	  }

	  this.isItemInfoOpen = false;
	}

	private createReturnButton() {
	  const { width } = this.scale;

	  const text =
	    this.returnScene === 'DungeonScene'
	      ? 'Вернуться к комнате'
	      : 'Вернуться в город';

	  createButton(
	    this,
	    width / 2 - 28,
	    1110,
	    text,
	    () => {
	      this.scene.start(this.returnScene);
	    },
	    500,
	    54
	  );
	}

	private showUnequipConfirm(slot: EquipmentSlot, inventoryItem: InventoryItem) {
	  if (this.isItemInfoOpen) {
	    return;
	  }

	  this.isItemInfoOpen = true;

	  const { width, height } = this.scale;

	  const item = getBaseItemFromInventoryItem(inventoryItem);

	  if (!item) {
	    this.isItemInfoOpen = false;
	    return;
	  }

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

	  createPanel(this, width / 2, height / 2, 610, 370, {
	    alpha: 0.98,
	    stroke: true,
	    warm: true,
	  }).setDepth(1001);

	  this.add.text(width / 2, height / 2 - 135, 'Снять предмет?', {
	    fontFamily: UI.font.title,
	    fontSize: '30px',
	    color: UI.colors.goldText,
	    stroke: '#000000',
	    strokeThickness: 4,
	  }).setOrigin(0.5).setDepth(1002);

	  const itemName = `${item.name}${inventoryItem.upgradeLevel > 0 ? ` +${inventoryItem.upgradeLevel}` : ''}`;

	  this.add.text(width / 2, height / 2 - 82, itemName, {
	    fontFamily: UI.font.title,
	    fontSize: '24px',
	    color: UI.colors.goldText,
	    stroke: '#000000',
	    strokeThickness: 3,
	    align: 'center',
	    wordWrap: {
	      width: 520,
	    },
	  }).setOrigin(0.5).setDepth(1002);

	  this.add.text(
	    width / 2,
	    height / 2 - 8,
	    [
	      `Слот: ${getSlotText(slot)}`,
	      `Редкость: ${getRarityText(item)}`,
	      `Характеристики: ${createItemStatsText(inventoryItem)}`,
	      '',
	      'Предмет останется в сумке.',
	    ].join('\n'),
	    {
	      fontFamily: UI.font.body,
	      fontSize: '18px',
	      color: UI.colors.text,
	      align: 'center',
	      lineSpacing: 5,
	      wordWrap: {
	        width: 520,
	      },
	    }
	  ).setOrigin(0.5).setDepth(1002);

	  const yes = createButton(
	    this,
	    width / 2,
	    height / 2 + 100,
	    'Снять',
	    () => {
	      unequipItem(player, slot);

	      void saveGameAsync();

	      overlay.destroy();

	      this.restartInventory();
	    },
	    360,
	    54
	  );

	  yes.shadow.setDepth(1001);
	  yes.bg.setDepth(1002);
	  yes.label.setDepth(1003);

	  const no = createButton(
	    this,
	    width / 2,
	    height / 2 + 165,
	    'Отмена',
	    () => {
	      overlay.destroy();

	      this.restartInventory();
	    },
	    360,
	    54
	  );

	  no.shadow.setDepth(1001);
	  no.bg.setDepth(1002);
	  no.label.setDepth(1003);
	}

  private createInventoryList() {
	  const { width } = this.scale;

	  const itemSpacing = 82;

		const panelY = 765;
		const panelHeight = 610;
			
		const titleY = panelY - 250;
			
		this.inventoryListTop = panelY - 185;
		this.inventoryListHeight = 380;
		this.inventoryListBottom = this.inventoryListTop + this.inventoryListHeight;

		const massSellY = panelY + 255;

	  this.createRoundedPanel({
		  x: width / 2 - 28,
		  y: panelY,
		  width: 560,
		  height: panelHeight,
		  radius: 28,
		  color: 0x120d0a,
		  alpha: 0.94,
		  strokeColor: UI.colors.goldDark,
		  strokeAlpha: 0.6,
		  depth: 2,
		});

	  const filteredItems = this.getFilteredInventoryItems();

		const title =
		  this.selectedCategory === 'potions'
		    ? `Зелья здоровья`
		    : this.selectedCategory === 'all'
		      ? `Все предметы`
		      : this.selectedCategory === 'weapon'
		        ? `Оружие`
		        : this.selectedCategory === 'armor'
		          ? `Броня`
		          : `Предметы`;

		const counter =
		  this.selectedCategory === 'potions'
		    ? `${player.potions} шт.`
		    : `${filteredItems.length} шт.`;

		this.add.text(width / 2 - 275, titleY, title, {
		  fontFamily: UI.font.title,
		  fontSize: '28px',
		  color: UI.colors.goldText,
		  stroke: '#000000',
		  strokeThickness: 5,
		}).setOrigin(0, 0.5).setDepth(10);

		this.add.text(width / 2 + 205, titleY, counter, {
		  fontFamily: UI.font.body,
		  fontSize: '16px',
		  color: UI.colors.textMuted,
		}).setOrigin(1, 0.5).setDepth(10);

	  if (player.inventory.length === 0) {
	    createSmallText(
	      this,
	      width / 2,
	      panelY,
	      'В сумке пока нет предметов.\nИх можно найти в катакомбах или купить в лавке.',
	      {
	        fontSize: '20px',
	        color: UI.colors.textMuted,
	        width: 540,
	      }
	    );

	    return;
	  }

	  this.inventoryScrollY = this.initialInventoryScrollY;
	  this.inventoryTargetScrollY = this.initialInventoryScrollY;
	  this.inventoryLastRenderedScrollY = -1;

	  this.inventoryContainer = this.add.container(0, 0);
		this.inventoryContainer.setDepth(20);

	  const topPadding = 42;
	  const contentHeight = topPadding + filteredItems.length * itemSpacing;

	  this.inventoryMaxScrollY = Math.max(
	    0,
	    contentHeight - this.inventoryListHeight
	  );

	  this.inventoryScrollY = Phaser.Math.Clamp(
	    this.inventoryScrollY,
	    0,
	    this.inventoryMaxScrollY
	  );

	  this.inventoryTargetScrollY = Phaser.Math.Clamp(
	    this.inventoryTargetScrollY,
	    0,
	    this.inventoryMaxScrollY
	  );

	  this.renderInventoryItems();

		this.createInventoryTouchScrollHandlers();

	  this.input.off('wheel');

	  this.input.on(
	    'wheel',
	    (
	      _pointer: Phaser.Input.Pointer,
	      _gameObjects: Phaser.GameObjects.GameObject[],
	      _deltaX: number,
	      deltaY: number
	    ) => {
	      if (this.inventoryMaxScrollY <= 0) {
	        return;
	      }

	      this.inventoryTargetScrollY = Phaser.Math.Clamp(
	        this.inventoryTargetScrollY + deltaY * 0.45,
	        0,
	        this.inventoryMaxScrollY
	      );
	    }
	  );

		if (this.selectedCategory === 'potions') {
		  this.createPotionCategoryContent(panelY);
		  return;
		}

		this.createRoundedMassSellButton({
		  x: width / 2 - 28,
		  y: massSellY,
		  width: 470,
		  height: 44,
		  text: 'Продать обычные ненадетые',
		  onClick: () => {
		    this.showMassSellConfirm();
		  },
		});
	}

	private createRoundedMassSellButton(config: {
	  x: number;
	  y: number;
	  width: number;
	  height: number;
	  text: string;
	  onClick: () => void;
	}) {
	  const radius = 16;

	  const shadow = this.add.graphics();
	  shadow.fillStyle(0x000000, 0.28);
	  shadow.fillRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2 + 4,
	    config.width,
	    config.height,
	    radius
	  );
	  shadow.setDepth(27);

	  const bg = this.add.graphics();
	  bg.fillStyle(0x2a1010, 0.96);
	  bg.fillRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2,
	    config.width,
	    config.height,
	    radius
	  );

	  bg.lineStyle(2, 0xff6b6b, 0.9);
	  bg.strokeRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2,
	    config.width,
	    config.height,
	    radius
	  );

	  bg.setDepth(28);

	  bg.setInteractive(
	    new Phaser.Geom.Rectangle(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height
	    ),
	    Phaser.Geom.Rectangle.Contains
	  );

	  const label = this.add.text(config.x, config.y, config.text, {
	    fontFamily: UI.font.body,
	    fontSize: '16px',
	    color: '#ffb3b3',
	  }).setOrigin(0.5).setDepth(29);

	  bg.on('pointerover', () => {
	    bg.clear();

	    bg.fillStyle(0x3a1515, 1);
	    bg.fillRoundedRect(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height,
	      radius
	    );

	    bg.lineStyle(2, 0xff8a8a, 1);
	    bg.strokeRoundedRect(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height,
	      radius
	    );

	    label.setColor('#ffd0d0');
	  });

	  bg.on('pointerout', () => {
	    bg.clear();

	    bg.fillStyle(0x2a1010, 0.96);
	    bg.fillRoundedRect(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height,
	      radius
	    );

	    bg.lineStyle(2, 0xff6b6b, 0.9);
	    bg.strokeRoundedRect(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height,
	      radius
	    );

	    label.setColor('#ffb3b3');
	  });

	  bg.on('pointerdown', () => {
	    config.onClick();
	  });

	  return {
	    shadow,
	    bg,
	    label,
	  };
	}

	private createCategoryTabs() {
	  const { width } = this.scale;

	  const tabs: {
	    id: InventoryCategory;
	    label: string;
	    icon: string;
	  }[] = [
	    {
	      id: 'all',
	      label: 'All',
	      icon: '▦',
	    },
	    {
	      id: 'weapon',
	      label: 'Оружие',
	      icon: '⚔',
	    },
	    {
	      id: 'armor',
	      label: 'Броня',
	      icon: '🛡',
	    },
	    {
	      id: 'potions',
	      label: 'Зелья',
	      icon: '✚',
	    },
	  ];

	  const tabX = width - 46;
	  const startY = 480;
	  const tabHeight = 72;
	  const tabWidth = 84;
	  const gap = 10;

	  tabs.forEach((tab, index) => {
	    const y = startY + index * (tabHeight + gap);
	    const isActive = this.selectedCategory === tab.id;

	    const tabBg = this.createRoundedButtonBg({
	      x: tabX,
	      y,
	      width: tabWidth,
	      height: tabHeight,
	      radius: 18,
	      color: isActive ? 0x2b1d13 : 0x12100d,
	      alpha: isActive ? 0.98 : 0.78,
	      strokeColor: isActive ? UI.colors.gold : UI.colors.goldDark,
	      strokeAlpha: isActive ? 0.9 : 0.35,
	      strokeWidth: isActive ? 2 : 1,
	      depth: 50,
	    });

	    const bg = tabBg.bg;

	    const icon = this.add.text(tabX, y - 14, tab.icon, {
	      fontFamily: UI.font.body,
	      fontSize: '20px',
	      color: isActive ? UI.colors.goldText : UI.colors.textMuted,
	    }).setOrigin(0.5).setDepth(53);

	    const label = this.add.text(tabX, y + 17, tab.label, {
	      fontFamily: UI.font.body,
	      fontSize: '12px',
	      color: isActive ? UI.colors.goldText : UI.colors.textMuted,
	    }).setOrigin(0.5).setDepth(53);

	    bg.on('pointerover', () => {
	      if (isActive) {
	        return;
	      }

	      icon.setColor(UI.colors.goldText);
	      label.setColor(UI.colors.goldText);
	    });

	    bg.on('pointerout', () => {
	      if (isActive) {
	        return;
	      }

	      icon.setColor(UI.colors.textMuted);
	      label.setColor(UI.colors.textMuted);
	    });

	    bg.on('pointerdown', () => {
	      if (this.selectedCategory === tab.id) {
	        return;
	      }

	      this.selectedCategory = tab.id;
	      this.inventoryScrollY = 0;
	      this.inventoryTargetScrollY = 0;

	      this.scene.restart({
				  selectedCategory: this.selectedCategory,
				  inventoryScrollY: 0,
				  returnScene: this.returnScene,
				});
	    });
	  });
	}

	private createPotionCategoryContent(panelY: number) {
	 const { width } = this.scale;

	 const stats = getPlayerStats(player);

	 const contentX = width / 2 - 28;
	 const cardY = panelY - 60;

	 const canUsePotion = player.potions > 0 && player.hp < stats.maxHp;

	 this.createRoundedPanel({
	   x: contentX,
	   y: cardY,
	   width: 500,
	   height: 155,
	   radius: 24,
	   color: 0x14100d,
	   alpha: 0.96,
	   strokeColor: UI.colors.goldDark,
	   strokeAlpha: 0.65,
	   strokeWidth: 2,
	   depth: 20,
	 });

	 this.add.circle(contentX - 210, cardY - 32, 34, 0x2a1d13, 1)
	   .setStrokeStyle(2, UI.colors.goldDark, 0.75)
	   .setDepth(24);

	 this.add.text(contentX - 210, cardY - 32, '✚', {
	   fontFamily: UI.font.body,
	   fontSize: '28px',
	   color: UI.colors.goldText,
	 }).setOrigin(0.5).setDepth(25);

	 this.add.text(contentX - 160, cardY - 50, 'Зелье здоровья', {
	   fontFamily: UI.font.title,
	   fontSize: '22px',
	   color: UI.colors.goldText,
	   stroke: '#000000',
	   strokeThickness: 3,
	 }).setOrigin(0, 0.5).setDepth(25);

	 this.add.text(contentX - 160, cardY - 15, `Количество: ${player.potions}`, {
	   fontFamily: UI.font.body,
	   fontSize: '17px',
	   color: UI.colors.text,
	 }).setOrigin(0, 0.5).setDepth(25);

	 this.add.text(contentX - 160, cardY + 16, 'Восстанавливает 35% максимального HP.', {
	   fontFamily: UI.font.body,
	   fontSize: '14px',
	   color: UI.colors.textMuted,
	   wordWrap: {
	     width: 310,
	   },
	 }).setOrigin(0, 0.5).setDepth(25);

	 this.add.text(contentX - 160, cardY + 42, `HP: ${player.hp}/${stats.maxHp}`, {
	   fontFamily: UI.font.body,
	   fontSize: '14px',
	   color: canUsePotion ? UI.colors.green : UI.colors.textMuted,
	 }).setOrigin(0, 0.5).setDepth(25);

	 this.createRoundedPotionButton({
	   x: contentX,
	   y: cardY + 95,
	   width: 430,
	   height: 48,
	   text: canUsePotion ? 'Выпить зелье' : 'Нельзя использовать',
	   disabled: !canUsePotion,
	   onClick: () => {
	     this.usePotionOutsideBattle();
	   },
	 });
	}

	private createRoundedPotionButton(config: {
	  x: number;
	  y: number;
	  width: number;
	  height: number;
	  text: string;
	  onClick: () => void;
	  disabled?: boolean;
	}) {
	  const radius = 18;
	  const disabled = config.disabled ?? false;
	
	  const bgColor = disabled ? 0x151515 : 0x102016;
	  const hoverColor = disabled ? 0x151515 : 0x183322;
	  const strokeColor = disabled ? 0x333333 : 0x75d184;
	  const textColor = disabled ? '#555555' : UI.colors.green;
	
	  const shadow = this.add.graphics();
	  shadow.fillStyle(0x000000, 0.3);
	  shadow.fillRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2 + 4,
	    config.width,
	    config.height,
	    radius
	  );
	  shadow.setDepth(26);
	
	  const bg = this.add.graphics();
	  bg.fillStyle(bgColor, disabled ? 0.72 : 0.96);
	  bg.fillRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2,
	    config.width,
	    config.height,
	    radius
	  );
	
	  bg.lineStyle(2, strokeColor, disabled ? 0.45 : 0.9);
	  bg.strokeRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2,
	    config.width,
	    config.height,
	    radius
	  );
	
	  bg.setDepth(27);
	
	  const label = this.add.text(config.x, config.y, config.text, {
	    fontFamily: UI.font.body,
	    fontSize: '17px',
	    color: textColor,
	  }).setOrigin(0.5).setDepth(28);
	
	  if (disabled) {
	    return {
	      shadow,
	      bg,
	      label,
	    };
	  }
	
	  bg.setInteractive(
	    new Phaser.Geom.Rectangle(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height
	    ),
	    Phaser.Geom.Rectangle.Contains
	  );
	
	  bg.on('pointerover', () => {
	    bg.clear();
		
	    bg.fillStyle(hoverColor, 1);
	    bg.fillRoundedRect(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height,
	      radius
	    );
		
	    bg.lineStyle(2, 0xa8f0b4, 1);
	    bg.strokeRoundedRect(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height,
	      radius
	    );
		
	    label.setColor('#a8f0b4');
	  });
	
	  bg.on('pointerout', () => {
	    bg.clear();
		
	    bg.fillStyle(bgColor, 0.96);
	    bg.fillRoundedRect(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height,
	      radius
	    );
		
	    bg.lineStyle(2, strokeColor, 0.9);
	    bg.strokeRoundedRect(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height,
	      radius
	    );
		
	    label.setColor(textColor);
	  });
	
	  bg.on('pointerdown', () => {
	    bg.setScale(0.985);
	    label.setScale(0.985);
	  });
	
	  bg.on('pointerup', () => {
	    bg.setScale(1);
	    label.setScale(1);
	    config.onClick();
	  });
	
	  return {
	    shadow,
	    bg,
	    label,
	  };
	}

	private usePotionOutsideBattle() {
	  const stats = getPlayerStats(player);

	  if (player.potions <= 0) {
	    this.showMessage('Зелий больше нет.');
	    return;
	  }

	  if (player.hp >= stats.maxHp) {
	    this.showMessage('HP уже полное. Зелье не потрачено.');
	    return;
	  }

	  const healAmount = Math.floor(stats.maxHp * 0.35);

	  player.potions = Math.max(0, player.potions - 1);
	  player.hp = Math.min(stats.maxHp, player.hp + healAmount);

	  void saveGameAsync();

	  this.showMessage(`Ты выпил зелье и восстановил ${healAmount} HP.`);
	}

	private createInventoryTouchScrollHandlers() {
	  this.input.off('pointerdown');
	  this.input.off('pointermove');
	  this.input.off('pointerup');
	  this.input.off('pointerupoutside');

	  this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
	    if (this.inventoryMaxScrollY <= 0) {
	      return;
	    }

	    if (this.isItemInfoOpen) {
	      return;
	    }

	    if (!this.isPointerInsideInventoryList(pointer)) {
	      return;
	    }

	    this.isDraggingInventory = true;
	    this.didDragInventory = false;
	    this.dragStartY = pointer.y;
	    this.dragStartScrollY = this.inventoryTargetScrollY;
	  });

	  this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
	    if (!this.isDraggingInventory) {
	      return;
	    }

	    if (this.isItemInfoOpen) {
	      return;
	    }

	    const dragDistance = pointer.y - this.dragStartY;

	    if (Math.abs(dragDistance) < 8) {
	      return;
	    }

	    this.didDragInventory = true;

	    this.inventoryTargetScrollY = Phaser.Math.Clamp(
	      this.dragStartScrollY - dragDistance,
	      0,
	      this.inventoryMaxScrollY
	    );

	    this.inventoryScrollY = this.inventoryTargetScrollY;
	    this.renderInventoryItems();
	  });

	  this.input.on('pointerup', () => {
	    this.isDraggingInventory = false;
	  });

	  this.input.on('pointerupoutside', () => {
	    this.isDraggingInventory = false;
	    this.didDragInventory = false;
	  });
	}

	private isPointerInsideInventoryList(pointer: Phaser.Input.Pointer) {
	  const { width } = this.scale;

	  const left = width / 2 - 300;
	  const right = width / 2 + 300;
	  const top = this.inventoryListTop;
	  const bottom = this.inventoryListBottom;

	  return (
	    pointer.x >= left &&
	    pointer.x <= right &&
	    pointer.y >= top &&
	    pointer.y <= bottom
	  );
	}

	private renderInventoryItems() {
	  if (!this.inventoryContainer) {
	    return;
	  }

	  this.inventoryContainer.removeAll(true);

	  const filteredItems = this.getFilteredInventoryItems();

	  const itemSpacing = 82;
		const cardHalfHeight = 38;
	  const topPadding = 58;
	  const fadeZone = 70;

	  filteredItems.forEach((inventoryItem: InventoryItem, index: number) => {
	    const y =
	      this.inventoryListTop +
	      topPadding +
	      index * itemSpacing -
	      this.inventoryScrollY;

	    if (y + cardHalfHeight < this.inventoryListTop - fadeZone) {
	      return;
	    }

	    if (y - cardHalfHeight > this.inventoryListBottom + fadeZone) {
	      return;
	    }

	    let alpha = 1;

	    if (y - cardHalfHeight < this.inventoryListTop) {
	      const distance = y + cardHalfHeight - this.inventoryListTop;
	      alpha = Phaser.Math.Clamp(distance / fadeZone, 0, 1);
	    }

	    if (y + cardHalfHeight > this.inventoryListBottom) {
	      const distance = this.inventoryListBottom - (y - cardHalfHeight);
	      alpha = Math.min(alpha, Phaser.Math.Clamp(distance / fadeZone, 0, 1));
	    }

	    this.createInventoryItemCard(inventoryItem, y, alpha);
	  });

	  this.inventoryLastRenderedScrollY = this.inventoryScrollY;
	}


	update() {
	  if (!this.inventoryContainer) {
	    return;
	  }

	  if (this.isItemInfoOpen) {
	    return;
	  }

		if (this.isDraggingInventory) {
		  return;
		}

	  const oldScrollY = this.inventoryScrollY;

	  if (Math.abs(this.inventoryScrollY - this.inventoryTargetScrollY) < 0.5) {
	    this.inventoryScrollY = this.inventoryTargetScrollY;
	  } else {
	    this.inventoryScrollY = Phaser.Math.Linear(
	      this.inventoryScrollY,
	      this.inventoryTargetScrollY,
	      0.18
	    );
	  }

	  const scrollChanged = Math.abs(oldScrollY - this.inventoryScrollY) > 0.25;
	  const renderChanged =
	    Math.abs(this.inventoryLastRenderedScrollY - this.inventoryScrollY) > 0.75;

	  if (scrollChanged && renderChanged) {
	    this.renderInventoryItems();
	  }
	}

	private createInventoryItemCard(
  inventoryItem: InventoryItem,
  y: number,
  alpha = 1
) {
  const { width } = this.scale;

  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item) {
    return;
  }

  const upgrade =
    inventoryItem.upgradeLevel > 0
      ? ` +${inventoryItem.upgradeLevel}`
      : '';

  const isEquipped = isItemEquipped(player, inventoryItem.instanceId);

  const rarityColor = getRarityColorHex(item);
  const rarityStrokeColor = getRarityStrokeColor(item);

  const cardX = width / 2 - 38;
  const cardWidth = 500;
  const cardHeight = 72;

  const cardBg = this.createRoundedButtonBg({
    x: cardX,
    y,
    width: cardWidth,
    height: cardHeight,
    radius: 20,
    color: isEquipped ? 0x2a1d13 : 0x17100c,
    alpha: isEquipped ? 0.98 : 0.95,
    strokeColor: isEquipped ? UI.colors.gold : rarityStrokeColor,
    strokeAlpha: isEquipped ? 0.95 : 0.68,
    strokeWidth: isEquipped ? 2 : 1,
    depth: 10,
  });

  const shadow = cardBg.shadow;
  const bg = cardBg.bg;

  let actionButtonPressed = false;

	bg.setInteractive({
	  useHandCursor: true,
	});
	
	bg.on('pointerup', () => {
	  if (this.isItemInfoOpen) {
	    return;
	  }

	  if (this.didDragInventory) {
	    this.didDragInventory = false;
	    return;
	  }

	  if (actionButtonPressed) {
	    actionButtonPressed = false;
	    return;
	  }

	  this.showItemInfo(inventoryItem);
	});

  const iconX = cardX - 220;
  const textX = cardX - 185;
  const equipX = cardX + 82;
  const sellX = cardX + 195;

  const iconGlow = this.add.circle(iconX, y, 27, rarityColor, 0.18);
  const iconBg = this.add.circle(iconX, y, 22, rarityColor, 0.92)
    .setStrokeStyle(2, rarityStrokeColor, 0.85);

  const icon = this.add.text(iconX, y, getSlotIcon(item.slot), {
    fontFamily: UI.font.body,
    fontSize: '18px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);

  const title = this.add.text(textX, y - 20, `${item.name}${upgrade}`, {
    fontFamily: UI.font.title,
    fontSize: '17px',
    color: isEquipped ? UI.colors.goldText : UI.colors.text,
    stroke: '#000000',
    strokeThickness: 2,
    wordWrap: {
      width: 260,
    },
  }).setOrigin(0, 0.5);

  const subtitle = this.add.text(
    textX,
    y + 3,
    `${item.slot === 'weapon' ? getWeaponTypeText(item.weaponType) : getSlotText(item.slot)} • ${getRarityText(item)}`,
    {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: '#b8aa91',
    }
  ).setOrigin(0, 0.5);

  const statsLine = this.add.text(textX, y + 24, createItemStatsText(inventoryItem), {
    fontFamily: UI.font.body,
    fontSize: '11px',
    color: UI.colors.textMuted,
    wordWrap: {
      width: 245,
    },
  }).setOrigin(0, 0.5);

  const equipButton = this.createInventorySmallActionButton({
	  x: equipX,
	  y: y,
	  width: 100,
	  height: 40,
	  text: isEquipped ? 'Надето' : 'Надеть',
	  disabled: isEquipped,
	  onClick: () => {
	    actionButtonPressed = true;

	    if (this.isItemInfoOpen) {
	      return;
	    }

	    if (isEquipped) {
	      return;
	    }

	    equipItem(player, inventoryItem.instanceId);

	    void saveGameAsync();

	    this.scene.restart({
	      inventoryScrollY: this.inventoryTargetScrollY,
	      selectedCategory: this.selectedCategory,
	      returnScene: this.returnScene,
	    });
	  },
	});

  const sellButton = this.createInventorySmallActionButton({
	  x: sellX,
	  y: y,
	  width: 100,
	  height: 40,
	  text: 'Продать',
	  danger: true,
	  disabled: isEquipped,
	  onClick: () => {
	    actionButtonPressed = true;

	    if (this.isItemInfoOpen) {
	      return;
	    }

	    this.showSellConfirm(inventoryItem);
	  },
	});

  const cardObjects: Phaser.GameObjects.GameObject[] = [
	  shadow,
	  bg,
	  iconGlow,
	  iconBg,
	  icon,
	  title,
	  subtitle,
	  statsLine,

	  equipButton.shadow,
	  equipButton.bg,
	  equipButton.label,

	  sellButton.shadow,
	  sellButton.bg,
	  sellButton.label,
	];

  cardObjects.forEach(object => {
    const alphaObject = object as Phaser.GameObjects.GameObject & {
      setAlpha?: (alpha: number) => void;
    };

    alphaObject.setAlpha?.(alpha);
  });

  if (alpha < 0.65) {
		bg.disableInteractive();
	  equipButton.bg.disableInteractive();
	  sellButton.bg.disableInteractive();
	}

  this.inventoryContainer.add(cardObjects);
}

	private createRoundedPanel(config: {
	  x: number;
	  y: number;
	  width: number;
	  height: number;
	  radius?: number;
	  color?: number;
	  alpha?: number;
	  strokeColor?: number;
	  strokeAlpha?: number;
	  strokeWidth?: number;
	  depth?: number;
	}) {
	  const radius = config.radius ?? 22;
	  const color = config.color ?? 0x14100d;
	  const alpha = config.alpha ?? 0.9;
	  const strokeColor = config.strokeColor ?? UI.colors.goldDark;
	  const strokeAlpha = config.strokeAlpha ?? 0.45;
	  const strokeWidth = config.strokeWidth ?? 2;
	  const depth = config.depth ?? 1;

	  const shadow = this.add.graphics();
	  shadow.fillStyle(0x000000, 0.28);
	  shadow.fillRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2 + 6,
	    config.width,
	    config.height,
	    radius
	  );
	  shadow.setDepth(depth);

	  const panel = this.add.graphics();
	  panel.fillStyle(color, alpha);
	  panel.fillRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2,
	    config.width,
	    config.height,
	    radius
	  );

	  panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
	  panel.strokeRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2,
	    config.width,
	    config.height,
	    radius
	  );

	  panel.setDepth(depth + 1);

	  return {
	    shadow,
	    panel,
	  };
	}


	private createRoundedButtonBg(config: {
	  x: number;
	  y: number;
	  width: number;
	  height: number;
	  radius?: number;
	  color?: number;
	  alpha?: number;
	  strokeColor?: number;
	  strokeAlpha?: number;
	  strokeWidth?: number;
	  depth?: number;
	}) {
	  const radius = config.radius ?? 18;
	  const color = config.color ?? 0x14100d;
	  const alpha = config.alpha ?? 0.9;
	  const strokeColor = config.strokeColor ?? UI.colors.goldDark;
	  const strokeAlpha = config.strokeAlpha ?? 0.45;
	  const strokeWidth = config.strokeWidth ?? 2;
	  const depth = config.depth ?? 10;

	  const shadow = this.add.graphics();
	  shadow.fillStyle(0x000000, 0.24);
	  shadow.fillRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2 + 4,
	    config.width,
	    config.height,
	    radius
	  );
	  shadow.setDepth(depth);

	  const bg = this.add.graphics();
	  bg.fillStyle(color, alpha);
	  bg.fillRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2,
	    config.width,
	    config.height,
	    radius
	  );

	  bg.lineStyle(strokeWidth, strokeColor, strokeAlpha);
	  bg.strokeRoundedRect(
	    config.x - config.width / 2,
	    config.y - config.height / 2,
	    config.width,
	    config.height,
	    radius
	  );

	  bg.setDepth(depth + 1);

	  bg.setInteractive(
	    new Phaser.Geom.Rectangle(
	      config.x - config.width / 2,
	      config.y - config.height / 2,
	      config.width,
	      config.height
	    ),
	    Phaser.Geom.Rectangle.Contains
	  );

	  return {
	    shadow,
	    bg,
	  };
	}

	private showItemInfo(inventoryItem: InventoryItem) {
  if (this.isItemInfoOpen) {
    return;
  }

  this.isItemInfoOpen = true;

  const { width, height } = this.scale;

  const item = getBaseItemFromInventoryItem(inventoryItem);

  if (!item) {
    this.isItemInfoOpen = false;
    return;
  }

  const equipped = isItemEquipped(player, inventoryItem.instanceId);
  const sellPrice = getItemSellPrice(item, inventoryItem.upgradeLevel);

  const rarityColor = getRarityColorHex(item);
  const rarityStrokeColor = getRarityStrokeColor(item);

  const upgrade =
    inventoryItem.upgradeLevel > 0
      ? ` +${inventoryItem.upgradeLevel}`
      : '';

  const itemTypeText =
    item.slot === 'weapon'
      ? getWeaponTypeText(item.weaponType)
      : getSlotText(item.slot);

  const weaponDescription =
    item.slot === 'weapon'
      ? getWeaponTypeDescription(item.weaponType)
      : '';

  const statsLines = [
    `Характеристики: ${createItemStatsText(inventoryItem) || 'нет'}`,
    weaponDescription,
    `Цена продажи: ${sellPrice} золота`,
    equipped ? 'Статус: надето' : 'Статус: в сумке',
  ].filter(Boolean);

  const container = this.add.container(0, 0).setDepth(1000);
  this.itemInfoContainer = container;

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

  const panelShadow = this.add.rectangle(
    width / 2,
    height / 2 + 6,
    620,
    560,
    0x000000,
    0.35
  );

  const panel = this.add.rectangle(
    width / 2,
    height / 2,
    620,
    560,
    0x17100c,
    0.98
  )
    .setStrokeStyle(3, UI.colors.goldDark, 0.9)
    .setInteractive();

  const iconBg = this.add.circle(
    width / 2,
    height / 2 - 205,
    34,
    rarityColor,
    0.95
  ).setStrokeStyle(3, rarityStrokeColor, 0.9);

  const icon = this.add.text(width / 2, height / 2 - 205, getSlotIcon(item.slot), {
    fontFamily: UI.font.body,
    fontSize: '28px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);

  const title = this.add.text(
    width / 2,
    height / 2 - 150,
    `${item.name}${upgrade}`,
    {
      fontFamily: UI.font.title,
      fontSize: '28px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: 540,
      },
    }
  ).setOrigin(0.5);

  const typeText = this.add.text(
    width / 2,
    height / 2 - 108,
    `${itemTypeText} • ${getRarityText(item)}`,
    {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.textMuted,
      align: 'center',
    }
  ).setOrigin(0.5);

  const description = this.add.text(
    width / 2,
    height / 2 - 48,
    item.description,
    {
      fontFamily: UI.font.body,
      fontSize: '18px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 5,
      wordWrap: {
        width: 530,
      },
    }
  ).setOrigin(0.5);

  const statsText = this.add.text(
    width / 2,
    height / 2 + 55,
    statsLines.join('\n'),
    {
      fontFamily: UI.font.body,
      fontSize: '17px',
      color: UI.colors.goldText,
      align: 'center',
      lineSpacing: 7,
      wordWrap: {
        width: 530,
      },
    }
  ).setOrigin(0.5);

  const equipButton = createButton(
    this,
    width / 2,
    height / 2 + 165,
    equipped ? 'Уже надето' : 'Надеть',
    () => {
      if (equipped) {
        return;
      }

      equipItem(player, inventoryItem.instanceId);
      void saveGameAsync();

      this.closeItemInfo();

      this.scene.restart({
        inventoryScrollY: this.inventoryTargetScrollY,
        selectedCategory: this.selectedCategory,
        returnScene: this.returnScene,
      });
    },
    360,
    50,
    {
      small: true,
      disabled: equipped,
    }
  );

  const sellButton = createButton(
    this,
    width / 2,
    height / 2 + 225,
    `Продать за ${sellPrice}`,
    () => {
      this.closeItemInfo();
      this.showSellConfirm(inventoryItem);
    },
    360,
    50,
    {
      small: true,
      danger: true,
      disabled: equipped,
    }
  );

  const closeButton = createButton(
    this,
    width / 2,
    height / 2 + 285,
    'Закрыть',
    () => {
      this.closeItemInfo();
    },
    360,
    50,
    {
      small: true,
    }
  );

  container.add([
    overlay,
    panelShadow,
    panel,
    iconBg,
    icon,
    title,
    typeText,
    description,
    statsText,

    equipButton.shadow,
    equipButton.bg,
    equipButton.label,

    sellButton.shadow,
    sellButton.bg,
    sellButton.label,

    closeButton.shadow,
    closeButton.bg,
    closeButton.label,
  ]);
}

	private showSellConfirm(inventoryItem: InventoryItem) {
	  if (this.isItemInfoOpen) {
	    return;
	  }

	  this.isItemInfoOpen = true;

	  const { width, height } = this.scale;

	  const item = getBaseItemFromInventoryItem(inventoryItem);

	  if (!item) {
	    this.isItemInfoOpen = false;
	    return;
	  }

	  if (isItemEquipped(player, inventoryItem.instanceId)) {
	    this.isItemInfoOpen = false;
	    this.showMessage('Сначала сними предмет, потом его можно будет продать.');
	    return;
	  }

	  const sellPrice = getItemSellPrice(item);

	  const upgrade =
	    inventoryItem.upgradeLevel > 0
	      ? ` +${inventoryItem.upgradeLevel}`
	      : '';

	  const rarityColor = getRarityColorHex(item);
	  const rarityStrokeColor = getRarityStrokeColor(item);

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

	  const panel = createPanel(this, width / 2, height / 2, 610, 430, {
	    alpha: 0.98,
	    stroke: true,
	    warm: true,
	  }).setDepth(1001);

	  this.add.text(width / 2, height / 2 - 160, 'Продать предмет?', {
	    fontFamily: UI.font.title,
	    fontSize: '30px',
	    color: UI.colors.goldText,
	    stroke: '#000000',
	    strokeThickness: 4,
	  }).setOrigin(0.5).setDepth(1002);

	  this.add.circle(width / 2, height / 2 - 105, 30, rarityColor, 0.95)
	    .setStrokeStyle(3, rarityStrokeColor, 0.9)
	    .setDepth(1002);

	  this.add.text(width / 2, height / 2 - 105, getSlotIcon(item.slot), {
	    fontFamily: UI.font.body,
	    fontSize: '24px',
	    color: '#ffffff',
	    stroke: '#000000',
	    strokeThickness: 2,
	  }).setOrigin(0.5).setDepth(1003);

	  this.add.text(width / 2, height / 2 - 55, `${item.name}${upgrade}`, {
	    fontFamily: UI.font.title,
	    fontSize: '24px',
	    color: UI.colors.goldText,
	    stroke: '#000000',
	    strokeThickness: 3,
	    align: 'center',
	    wordWrap: {
	      width: 520,
	    },
	  }).setOrigin(0.5).setDepth(1002);

	  this.add.text(
	    width / 2,
	    height / 2 + 18,
	    [
	      `${getSlotText(item.slot)} • ${getRarityText(item)}`,
	      `Характеристики: ${createItemStatsText(inventoryItem)}`,
	      '',
	      `Ты получишь: ${sellPrice} золота`,
	    ].join('\n'),
	    {
	      fontFamily: UI.font.body,
	      fontSize: '18px',
	      color: UI.colors.text,
	      align: 'center',
	      lineSpacing: 6,
	      wordWrap: {
	        width: 530,
	      },
	    }
	  ).setOrigin(0.5).setDepth(1002);

	  const yes = createButton(
	    this,
	    width / 2,
	    height / 2 + 125,
	    `Продать за ${sellPrice}`,
	    () => {
	      const result = sellItem(player, inventoryItem.instanceId);

	      if (!result.success) {
	        this.isItemInfoOpen = false;
	        this.showMessage(result.message ?? 'Не удалось продать предмет.');
	        return;
	      }

	      void saveGameAsync();

	      overlay.destroy();
	      panel.destroy();

	      this.restartInventory();
	    },
	    360,
	    54,
	    {
	      danger: true,
	    }
	  );

	  yes.shadow.setDepth(1001);
	  yes.bg.setDepth(1002);
	  yes.label.setDepth(1003);

	  const no = createButton(
	    this,
	    width / 2,
	    height / 2 + 190,
	    'Отмена',
	    () => {
	      overlay.destroy();

	      this.restartInventory();
	    },
	    360,
	    54
	  );

	  no.shadow.setDepth(1001);
	  no.bg.setDepth(1002);
	  no.label.setDepth(1003);
	}

	private showMassSellConfirm() {
	  if (this.isItemInfoOpen) {
	    return;
	  }

	  this.isItemInfoOpen = true;

	  const { width, height } = this.scale;

	  const itemsToSell = player.inventory.filter(inventoryItem => {
	    const item = getBaseItemFromInventoryItem(inventoryItem);

	    if (!item) {
	      return false;
	    }

	    if (isItemEquipped(player, inventoryItem.instanceId)) {
	      return false;
	    }

	    return item.rarity === 'common';
	  });

	  const totalGold = itemsToSell.reduce((sum, inventoryItem) => {
	    const item = getBaseItemFromInventoryItem(inventoryItem);

	    if (!item) {
	      return sum;
	    }

	    return sum + getItemSellPrice(item);
	  }, 0);

	  const itemNames = itemsToSell
	    .slice(0, 5)
	    .map(inventoryItem => {
	      const item = getBaseItemFromInventoryItem(inventoryItem);

	      if (!item) {
	        return '';
	      }

	      const upgrade =
	        inventoryItem.upgradeLevel > 0
	          ? ` +${inventoryItem.upgradeLevel}`
	          : '';

	      return `• ${item.name}${upgrade}`;
	    })
	    .filter(line => line.length > 0);

	  const moreText =
	    itemsToSell.length > 5
	      ? `\nи ещё ${itemsToSell.length - 5} предметов...`
	      : '';

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

	  createPanel(this, width / 2, height / 2, 610, 430, {
	    alpha: 0.98,
	    stroke: true,
	    warm: true,
	  }).setDepth(1001);

	  this.add.text(width / 2, height / 2 - 160, 'Массовая продажа', {
	    fontFamily: UI.font.title,
	    fontSize: '30px',
	    color: UI.colors.goldText,
	    stroke: '#000000',
	    strokeThickness: 4,
	  }).setOrigin(0.5).setDepth(1002);

	  const message =
	    itemsToSell.length > 0
	      ? [
	          'Будут проданы только ненадетые предметы обычной редкости.',
	          '',
	          `Обычных предметов: ${itemsToSell.length}`,
	          `Ты получишь: ${totalGold} золота`,
	          '',
	          itemNames.join('\n') + moreText,
	        ].join('\n')
	      : 'Нет ненадетых предметов обычной редкости для продажи.';

	  this.add.text(width / 2, height / 2 - 45, message, {
	    fontFamily: UI.font.body,
	    fontSize: '18px',
	    color: UI.colors.text,
	    align: 'center',
	    lineSpacing: 5,
	    wordWrap: {
	      width: 530,
	    },
	  }).setOrigin(0.5).setDepth(1002);

	  const yes = createButton(
	    this,
	    width / 2,
	    height / 2 + 120,
	    itemsToSell.length > 0 ? 'Продать всё' : 'Нечего продавать',
	    () => {
	      if (itemsToSell.length === 0) {
	        return;
	      }

	      this.massSellCommonItems();
	    },
	    360,
	    54,
	    {
	      danger: true,
	      disabled: itemsToSell.length === 0,
	    }
	  );

	  yes.shadow.setDepth(1001);
	  yes.bg.setDepth(1002);
	  yes.label.setDepth(1003);

	  const no = createButton(
	    this,
	    width / 2,
	    height / 2 + 185,
	    'Отмена',
	    () => {
	      overlay.destroy();

	      this.restartInventory();
	    },
	    360,
	    54
	  );

	  no.shadow.setDepth(1001);
	  no.bg.setDepth(1002);
	  no.label.setDepth(1003);
	}

	private massSellCommonItems() {
	  const itemsToSell = player.inventory.filter(inventoryItem => {
	    const item = getBaseItemFromInventoryItem(inventoryItem);

	    if (!item) {
	      return false;
	    }

	    if (isItemEquipped(player, inventoryItem.instanceId)) {
	      return false;
	    }

	    return item.rarity === 'common';
	  });

	  let totalGold = 0;

	  for (const inventoryItem of itemsToSell) {
	    const item = getBaseItemFromInventoryItem(inventoryItem);

	    if (!item) {
	      continue;
	    }

	    totalGold += getItemSellPrice(item);

	    player.inventory = player.inventory.filter(itemInInventory => {
	      return itemInInventory.instanceId !== inventoryItem.instanceId;
	    });
	  }

	  player.gold += totalGold;

	  void saveGameAsync();

	  this.restartInventory();
	}

	private showMessage(message: string) {
	  const { width, height } = this.scale;

	  this.isItemInfoOpen = true;

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

	  const panel = createPanel(this, width / 2, height / 2, 610, 300, {
	    alpha: 0.98,
	    stroke: true,
	    warm: true,
	  }).setDepth(101);

	  const titleText = this.add.text(width / 2, height / 2 - 95, 'Сумка', {
	    fontFamily: UI.font.title,
	    fontSize: '30px',
	    color: UI.colors.goldText,
	    stroke: '#000000',
	    strokeThickness: 4,
	  }).setOrigin(0.5).setDepth(102);

	  const messageText = this.add.text(width / 2, height / 2 - 15, message, {
	    fontFamily: UI.font.body,
	    fontSize: '20px',
	    color: UI.colors.text,
	    align: 'center',
	    lineSpacing: 6,
	    wordWrap: {
	      width: 520,
	    },
	  }).setOrigin(0.5).setDepth(102);

	  const ok = createButton(
		  this,
		  width / 2,
		  height / 2 + 95,
		  'Понятно',
		  () => {
		    overlay.destroy();
		    panel.destroy();
		    titleText.destroy();
		    messageText.destroy();
			
		    ok.shadow.destroy();
		    ok.bg.destroy();
		    ok.label.destroy();
			
		    this.isItemInfoOpen = false;
		  },
		  260,
		  54
		);

		ok.shadow.setDepth(1001);
		ok.bg.setDepth(1002);
		ok.label.setDepth(1003);
	}
}