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
} from '../systems/InventorySystem';

import {
  UI,
  createPanel,
  createSceneBackground,
  createSectionTitle,
  createSmallText,
} from '../ui/theme';

type InventoryCategory = 'all' | 'weapon' | 'armor' | 'potions';

export class InventoryScene extends Phaser.Scene {
	
	private isItemInfoOpen = false;

	

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

	private selectedCategory: InventoryCategory = 'all';

  constructor() {
    super('InventoryScene');

		
  }

	init(data?: {
	  inventoryScrollY?: number;
	  selectedCategory?: InventoryCategory;
	}) {
	  this.initialInventoryScrollY = data?.inventoryScrollY ?? 0;
	  this.selectedCategory = data?.selectedCategory ?? 'all';
	}

  create() {
	  createSceneBackground(this);

	  this.createQuickStatsPanel();
	  this.createEquipmentPanel();
	  this.createInventoryList();
	  this.createCategoryTabs();

	  createBottomNav(this, {
	    activeScene: 'InventoryScene',
	  });
	}

	private createQuickStatsPanel() {
	  const { width } = this.scale;

	  const stats = getPlayerStats(player);

	  this.createRoundedPanel({
	    x: width / 2,
	    y: 112,
	    width: 620,
	    height: 96,
	    radius: 26,
	    color: 0x17100c,
	    alpha: 0.9,
	    strokeColor: UI.colors.goldDark,
	    strokeAlpha: 0.5,
	    depth: 2,
	  });


	  const text = [
	    `HP ${player.hp}/${stats.maxHp}`,
	    `АТК ${stats.attack}`,
	    `ЗАЩ ${stats.defense}`,
	    `Золото ${player.gold}`,
	  ].join('  •  ');

	  this.add.text(width / 2, 110, text, {
		  fontFamily: UI.font.body,
		  fontSize: '22px',
		  color: UI.colors.text,
		  align: 'center',
		}).setOrigin(0.5).setDepth(10);

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

	  const panelY = 340;

	  this.createRoundedPanel({
		  x: width / 2,
		  y: panelY,
		  width: 620,
		  height: 170,
		  radius: 26,
		  color: 0x100c09,
		  alpha: 0.88,
		  strokeColor: UI.colors.goldDark,
		  strokeAlpha: 0.45,
		  depth: 2,
		});

	  createSectionTitle(this, width / 2, panelY - 65, 'Экипировка')
  		.setDepth(10);

	  this.createEquipmentSlot('weapon', panelY - 15);
	  this.createEquipmentSlot('armor', panelY + 25);
	  this.createEquipmentSlot('trinket', panelY + 65);
	}

	private closeItemInfo() {
	  if (this.itemInfoContainer) {
	    this.itemInfoContainer.destroy(true);
	    this.itemInfoContainer = undefined;
	  }

	  this.isItemInfoOpen = false;
	}

	private createEquipmentSlot(slot: EquipmentSlot, y: number) {
	  const { width } = this.scale;

	  const instanceId = player.equipment[slot];

	  const inventoryItem = instanceId
	    ? player.inventory.find(item => item.instanceId === instanceId)
	    : undefined;

	  const item = inventoryItem
	    ? getBaseItemFromInventoryItem(inventoryItem)
	    : undefined;

	  const slotName = getSlotText(slot);

	  const text = item
	    ? `${slotName}: ${item.name} +${inventoryItem?.upgradeLevel ?? 0}  —  нажми, чтобы снять`
	    : `${slotName}: пусто`;

	  const color = item ? UI.colors.goldText : UI.colors.textMuted;

	  const line = this.add.text(width / 2, y, text, {
	    fontFamily: UI.font.body,
	    fontSize: '16px',
	    color,
	    align: 'center',
	  }).setOrigin(0.5).setDepth(10);

	  if (!item || !inventoryItem) {
	    return;
	  }

	  line.setInteractive({
	    useHandCursor: true,
	  });

	  line.on('pointerover', () => {
	    line.setColor(UI.colors.red);
	  });

	  line.on('pointerout', () => {
	    line.setColor(color);
	  });

	  line.on('pointerup', () => {
	    this.showUnequipConfirm(slot, inventoryItem);
	  });
	}

	private showUnequipConfirm(slot: EquipmentSlot, inventoryItem: InventoryItem) {
	  const { width, height } = this.scale;

	  const item = getBaseItemFromInventoryItem(inventoryItem);

	  if (!item) {
	    return;
	  }

	  this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
	    .setDepth(100);

	  createPanel(this, width / 2, height / 2, 610, 320, {
	    alpha: 0.98,
	    stroke: true,
	    warm: true,
	  }).setDepth(101);

	  this.add.text(width / 2, height / 2 - 105, 'Снять предмет?', {
	    fontFamily: UI.font.title,
	    fontSize: '30px',
	    color: UI.colors.goldText,
	    stroke: '#000000',
	    strokeThickness: 4,
	  }).setOrigin(0.5).setDepth(102);

	  this.add.text(
	    width / 2,
	    height / 2 - 25,
	    `${item.name} +${inventoryItem.upgradeLevel}\n\nПредмет останется в сумке.`,
	    {
	      fontFamily: UI.font.body,
	      fontSize: '20px',
	      color: UI.colors.text,
	      align: 'center',
	      lineSpacing: 6,
	      wordWrap: {
	        width: 520,
	      },
	    }
	  ).setOrigin(0.5).setDepth(102);

	  const yes = createButton(
	    this,
	    width / 2,
	    height / 2 + 75,
	    'Снять',
	    () => {
	      unequipItem(player, slot);

				void saveGameAsync();
							
				this.scene.restart({
				  inventoryScrollY: this.inventoryTargetScrollY,
				  selectedCategory: this.selectedCategory,
				});
	    },
	    360,
	    54
	  );

	  yes.shadow.setDepth(101);
	  yes.bg.setDepth(102);
	  yes.label.setDepth(103);

	  const no = createButton(
	    this,
	    width / 2,
	    height / 2 + 140,
	    'Отмена',
	    () => {
	      this.scene.restart();
	    },
	    360,
	    54
	  );

	  no.shadow.setDepth(101);
	  no.bg.setDepth(102);
	  no.label.setDepth(103);
	}

  private createInventoryList() {
	  const { width } = this.scale;

	  const itemSpacing = 70;

		const panelY = 760;
		const panelHeight = 650;

		const titleY = panelY - 270;

		this.inventoryListTop = panelY - 205;
		this.inventoryListHeight = 405;
		this.inventoryListBottom = this.inventoryListTop + this.inventoryListHeight;

		const massSellY = panelY + 286;

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

		createSectionTitle(
		  this,
		  width / 2 - 28,
		  titleY,
		  this.selectedCategory === 'potions'
		    ? `Зелья: ${player.potions}`
		    : `Предметы: ${filteredItems.length}`
		).setDepth(10);

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
	      });
	    });
	  });
	}

	private createPotionCategoryContent(panelY: number) {
	  const { width } = this.scale;

	  this.add.rectangle(width / 2, panelY + 15, 560, 130, 0x14100d, 0.88)
	    .setStrokeStyle(2, UI.colors.goldDark, 0.55);

	  this.add.circle(width / 2 - 235, panelY + 15, 28, 0x2a1d13, 1)
	    .setStrokeStyle(2, UI.colors.goldDark, 0.7);

	  this.add.text(width / 2 - 235, panelY + 15, '✚', {
	    fontFamily: UI.font.body,
	    fontSize: '24px',
	    color: UI.colors.goldText,
	  }).setOrigin(0.5);

	  this.add.text(width / 2 - 190, panelY - 10, 'Зелье здоровья', {
	    fontFamily: UI.font.title,
	    fontSize: '21px',
	    color: UI.colors.goldText,
	  }).setOrigin(0, 0.5);

	  this.add.text(width / 2 - 190, panelY + 25, `Количество: ${player.potions}`, {
	    fontFamily: UI.font.body,
	    fontSize: '17px',
	    color: UI.colors.text,
	  }).setOrigin(0, 0.5);

	  this.add.text(width / 2 - 190, panelY + 55, 'Восстанавливает здоровье во время боя.', {
	    fontFamily: UI.font.body,
	    fontSize: '14px',
	    color: UI.colors.textMuted,
	  }).setOrigin(0, 0.5);
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

	  const itemSpacing = 70;
	  const topPadding = 58;
	  const cardHalfHeight = 32;
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
		const cardHeight = 62;

		const cardBg = this.createRoundedButtonBg({
		  x: cardX,
		  y,
		  width: cardWidth,
		  height: cardHeight,
		  radius: 18,
		  color: isEquipped ? 0x2a1d13 : 0x1a130f,
		  alpha: isEquipped ? 0.98 : 0.96,
		  strokeColor: isEquipped ? UI.colors.gold : rarityStrokeColor,
		  strokeAlpha: isEquipped ? 0.95 : 0.75,
		  strokeWidth: 2,
		  depth: 10,
		});

		const shadow = cardBg.shadow;
		const bg = cardBg.bg;

			bg.setInteractive({
			  useHandCursor: true,
			});

			bg.on('pointerup', () => {
			  if (this.isItemInfoOpen) {
			    return;
			  }
			
			  this.showItemInfo(inventoryItem);
			});


			const iconX = cardX - 220;
			const textX = cardX - 185;
			const equipX = cardX + 115;
			const sellX = cardX + 205;

	  const iconBg = this.add.circle(iconX, y, 22, rarityColor, 0.92)
		  .setStrokeStyle(2, rarityStrokeColor, 0.7);

		const icon = this.add.text(iconX, y, getSlotIcon(item.slot), {
		  fontFamily: UI.font.body,
		  fontSize: '17px',
		  color: '#ffffff',
		}).setOrigin(0.5);

		const title = this.add.text(textX, y - 14, `${item.name}${upgrade}`, {
		  fontFamily: UI.font.body,
		  fontSize: '16px',
		  color: isEquipped ? UI.colors.goldText : UI.colors.text,
		}).setOrigin(0, 0.5);

		const subtitle = this.add.text(
		  textX,
		  y + 13,
		  `${getSlotText(item.slot)} • ${getRarityText(item)}`,
		  {
		    fontFamily: UI.font.body,
		    fontSize: '13px',
		    color: '#b8aa91',
		  }
		).setOrigin(0, 0.5);

	  const equipButton = createButton(
		  this,
		  equipX,
		  y,
		  isEquipped ? 'Надето' : 'Надеть',
		  () => {
		    if (isEquipped) return;
			
		    equipItem(player, inventoryItem.instanceId);
		    void saveGameAsync();
			
		    this.scene.restart({
		      inventoryScrollY: this.inventoryTargetScrollY,
		      selectedCategory: this.selectedCategory,
		    });
		  },
		  84,
		  34,
		  {
		    small: true,
		    disabled: isEquipped,
		  }
		);

		const sellButton = createButton(
		  this,
		  sellX,
		  y,
		  'Продать',
		  () => {
		    this.showSellConfirm(inventoryItem);
		  },
		  84,
		  34,
		  {
		    small: true,
		    danger: true,
		    disabled: isEquipped,
		  }
		);

		sellButton.shadow.setDepth(13);
		sellButton.bg.setDepth(14);
		sellButton.label.setDepth(15);
	  const cardObjects: Phaser.GameObjects.GameObject[] = [
		  shadow,
		  bg,

		  iconBg,
		  icon,
		  title,
		  subtitle,

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
	  const sellPrice = getItemSellPrice(item);

	  const rarityColor = getRarityColorHex(item);
	  const rarityStrokeColor = getRarityStrokeColor(item);

	  const container = this.add.container(0, 0).setDepth(1000);
	  this.itemInfoContainer = container;

	  const overlay = this.add.rectangle(
	    width / 2,
	    height / 2,
	    width,
	    height,
	    0x000000,
	    0.72
	  ).setInteractive();

	  const panelShadow = this.add.rectangle(
	    width / 2,
	    height / 2 + 6,
	    620,
	    520,
	    0x000000,
	    0.35
	  );

	  const panel = this.add.rectangle(
	    width / 2,
	    height / 2,
	    620,
	    520,
	    0x17100c,
	    0.98
	  )
	    .setStrokeStyle(3, UI.colors.goldDark, 0.9)
	    .setInteractive();

	  const iconBg = this.add.circle(width / 2, height / 2 - 185, 34, rarityColor, 0.95)
	    .setStrokeStyle(3, rarityStrokeColor, 0.9);

	  const icon = this.add.text(width / 2, height / 2 - 185, getSlotIcon(item.slot), {
	    fontFamily: UI.font.body,
	    fontSize: '28px',
	    color: '#ffffff',
	  }).setOrigin(0.5);

	  const title = this.add.text(
	    width / 2,
	    height / 2 - 130,
	    `${item.name} +${inventoryItem.upgradeLevel}`,
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
	    height / 2 - 88,
	    `${getSlotText(item.slot)} • ${getRarityText(item)}`,
	    {
	      fontFamily: UI.font.body,
	      fontSize: '18px',
	      color: UI.colors.textMuted,
	      align: 'center',
	    }
	  ).setOrigin(0.5);

	  const description = this.add.text(
	    width / 2,
	    height / 2 - 30,
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
	    height / 2 + 50,
	    [
	      `Характеристики: ${createItemStatsText(inventoryItem)}`,
	      `Цена продажи: ${sellPrice} золота`,
	      equipped ? 'Статус: надето' : 'Статус: в сумке',
	    ].join('\n'),
	    {
	      fontFamily: UI.font.body,
	      fontSize: '18px',
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
	    height / 2 + 145,
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
	    height / 2 + 205,
	    'Продать',
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
	    height / 2 + 265,
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
	 const { width, height } = this.scale;

	 const item = getBaseItemFromInventoryItem(inventoryItem);

	 if (!item) {
	   return;
	 }

	 if (isItemEquipped(player, inventoryItem.instanceId)) {
	   this.showMessage('Сначала сними предмет, потом его можно будет продать.');
	   return;
	 }

	 const sellPrice = getItemSellPrice(item);

	 this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
	   .setDepth(100);

	 createPanel(this, width / 2, height / 2, 610, 340, {
	   alpha: 0.98,
	   stroke: true,
	   warm: true,
	 }).setDepth(101);

	 this.add.text(width / 2, height / 2 - 110, 'Продать предмет?', {
	   fontFamily: UI.font.title,
	   fontSize: '30px',
	   color: UI.colors.goldText,
	   stroke: '#000000',
	   strokeThickness: 4,
	 }).setOrigin(0.5).setDepth(102);

	 this.add.text(
	   width / 2,
	   height / 2 - 35,
	   `${item.name} +${inventoryItem.upgradeLevel}\n\nТы получишь: ${sellPrice} золота`,
	   {
	     fontFamily: UI.font.body,
	     fontSize: '20px',
	     color: UI.colors.text,
	     align: 'center',
	     lineSpacing: 6,
	     wordWrap: {
	       width: 520,
	     },
	   }
	 ).setOrigin(0.5).setDepth(102);

	 const yes = createButton(
	   this,
	   width / 2,
	   height / 2 + 65,
	   'Продать',
	   () => {
	     const result = sellItem(player, inventoryItem.instanceId);

	     if (!result.success) {
	       this.showMessage(result.message ?? 'Не удалось продать предмет.');
	       return;
	     }

	     void saveGameAsync();

	     this.scene.restart();
	   },
	   360,
	   54,
	   {
	     danger: true,
	   }
	 );

	 yes.shadow.setDepth(101);
	 yes.bg.setDepth(102);
	 yes.label.setDepth(103);

	 const no = createButton(
	   this,
	   width / 2,
	   height / 2 + 135,
	   'Отмена',
	   () => {
	     this.scene.restart();
	   },
	   360,
	   54
	 );

	 no.shadow.setDepth(101);
	 no.bg.setDepth(102);
	 no.label.setDepth(103);
	}

	private showMassSellConfirm() {
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

	  this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
	    .setDepth(100);

	  createPanel(this, width / 2, height / 2, 610, 360, {
	    alpha: 0.98,
	    stroke: true,
	    warm: true,
	  }).setDepth(101);

	  this.add.text(width / 2, height / 2 - 120, 'Массовая продажа', {
	    fontFamily: UI.font.title,
	    fontSize: '30px',
	    color: UI.colors.goldText,
	    stroke: '#000000',
	    strokeThickness: 4,
	  }).setOrigin(0.5).setDepth(102);

	  this.add.text(
	    width / 2,
	    height / 2 - 35,
	    itemsToSell.length > 0
	      ? `Будут проданы все ненадетые обычные предметы.\n\nПредметов: ${itemsToSell.length}\nТы получишь: ${totalGold} золота`
	      : 'Нет обычных ненадетых предметов для продажи.',
	    {
	      fontFamily: UI.font.body,
	      fontSize: '20px',
	      color: UI.colors.text,
	      align: 'center',
	      lineSpacing: 6,
	      wordWrap: {
	        width: 520,
	      },
	    }
	  ).setOrigin(0.5).setDepth(102);

	  const yes = createButton(
	    this,
	    width / 2,
	    height / 2 + 75,
	    'Продать всё',
	    () => {
	      this.massSellCommonItems();
	    },
	    360,
	    54,
	    {
	      danger: true,
	      disabled: itemsToSell.length === 0,
	    }
	  );

	  yes.shadow.setDepth(101);
	  yes.bg.setDepth(102);
	  yes.label.setDepth(103);

	  const no = createButton(
	    this,
	    width / 2,
	    height / 2 + 145,
	    'Отмена',
	    () => {
	      this.scene.restart();
	    },
	    360,
	    54
	  );

	  no.shadow.setDepth(101);
	  no.bg.setDepth(102);
	  no.label.setDepth(103);
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

	  this.scene.restart();
	}

	private showMessage(message: string) {
	  const { width, height } = this.scale;

	  const overlay = this.add.rectangle(
	    width / 2,
	    height / 2,
	    width,
	    height,
	    0x000000,
	    0.72
	  ).setDepth(100);

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
	    },
	    260,
	    54
	  );

	  ok.shadow.setDepth(101);
	  ok.bg.setDepth(102);
	  ok.label.setDepth(103);
	}
}