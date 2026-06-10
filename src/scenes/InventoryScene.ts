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
  createTitle,
} from '../ui/theme';

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

  constructor() {
    super('InventoryScene');

		
  }

	init(data?: { inventoryScrollY?: number }) {
	  this.initialInventoryScrollY = data?.inventoryScrollY ?? 0;
	}

  create() {
	  createSceneBackground(this);
	  createTitle(this, 'Сумка героя', 'Снаряжение, добыча и найденные вещи');

	  this.createStatsPanel();
	  this.createEquipmentPanel();
	  this.createInventoryList();

	  createBottomNav(this, {
	    activeScene: 'InventoryScene',
	  });
	}

  private createStatsPanel() {
	  const { width } = this.scale;

	  const stats = getPlayerStats(player);

	  const panelY = 185;

	  createPanel(this, width / 2, panelY, 620, 145, {
	    alpha: 0.72,
	    stroke: false,
	    warm: true,
	  });

	  this.add.text(width / 2, panelY - 42, 'Краткие характеристики', {
	    fontFamily: UI.font.title,
	    fontSize: '23px',
	    color: UI.colors.goldText,
	  }).setOrigin(0.5);

	  const text = [
	    `HP: ${player.hp}/${stats.maxHp}`,
	    `Атака: ${stats.attack}`,
	    `Защита: ${stats.defense}`,
	    `Крит: ${Math.round(stats.critChance * 100)}%`,
	    `Уклонение: ${Math.round(stats.dodgeChance * 100)}%`,
	    `Добыча: +${Math.round(stats.lootChanceBonus * 100)}%`,
	  ].join('  •  ');

	  createSmallText(this, width / 2, panelY + 22, text, {
	    fontSize: '16px',
	    color: UI.colors.text,
	    width: 560,
	  });
	}

  private createEquipmentPanel() {
	  const { width } = this.scale;

	  const panelY = 340;

	  createPanel(this, width / 2, panelY, 620, 170, {
	    alpha: 0.78,
	    stroke: true,
	    warm: false,
	  });

	  createSectionTitle(this, width / 2, panelY - 65, 'Экипировка');

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
	  }).setOrigin(0.5);

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
		this.inventoryListHeight = 455;
		this.inventoryListBottom = this.inventoryListTop + this.inventoryListHeight;

		const massSellY = panelY + 310;

	  createPanel(this, width / 2, panelY, 620, panelHeight, {
	    alpha: 0.86,
	    stroke: true,
	    warm: false,
	  });

	  createSectionTitle(
	    this,
	    width / 2,
	    titleY,
	    `Предметы: ${player.inventory.length}`
	  );

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

	  const topPadding = 42;
	  const contentHeight = topPadding + player.inventory.length * itemSpacing;

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

	  createPanel(this, width / 2, massSellY, 620, 82, {
	    alpha: 0.78,
	    stroke: true,
	    warm: true,
	  });

	  createButton(
	    this,
	    width / 2,
	    massSellY,
	    'Продать обычные ненадетые предметы',
	    () => {
	      this.showMassSellConfirm();
	    },
	    500,
	    46,
	    {
	      small: true,
	      danger: true,
	    }
	  );
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

	  const itemSpacing = 70;
	  const topPadding = 42;
	  const cardHalfHeight = 32;

	  const fadeZone = 70;

	  player.inventory.forEach((inventoryItem: InventoryItem, index: number) => {
	    const y =
	      this.inventoryListTop +
	      topPadding +
	      index * itemSpacing -
	      this.inventoryScrollY;

	    // Карточка далеко выше зоны — не рисуем
	    if (y + cardHalfHeight < this.inventoryListTop - fadeZone) {
	      return;
	    }

	    // Карточка далеко ниже зоны — не рисуем
	    if (y - cardHalfHeight > this.inventoryListBottom + fadeZone) {
	      return;
	    }

	    let alpha = 1;

	    // Плавное исчезновение сверху
	    if (y - cardHalfHeight < this.inventoryListTop) {
	      const distance = y + cardHalfHeight - this.inventoryListTop;
	      alpha = Phaser.Math.Clamp(distance / fadeZone, 0, 1);
	    }

	    // Плавное исчезновение снизу
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

	  const isEquipped = isItemEquipped(player, inventoryItem.instanceId);

	  const rarityColor = getRarityColorHex(item);
	  const rarityStrokeColor = getRarityStrokeColor(item);

	  const shadow = this.add.rectangle(width / 2, y + 4, 560, 60, 0x000000, 0.22);

		const bg = this.add.rectangle(width / 2, y, 560, 60, 0x14100d, 0.86)
	    .setStrokeStyle(2, rarityStrokeColor, 0.55);

			bg.setInteractive({
			  useHandCursor: true,
			});

			bg.on('pointerover', () => {
			  bg.setFillStyle(0x1f1712, 0.95);
			});

			bg.on('pointerout', () => {
			  bg.setFillStyle(0x14100d, 0.86);
			});

			bg.on('pointerup', () => {
			  if (this.isItemInfoOpen) {
			    return;
			  }
			
			  this.showItemInfo(inventoryItem);
			});

	  const iconBg = this.add.circle(width / 2 - 250, y, 22, rarityColor, 0.92)
	    .setStrokeStyle(2, rarityStrokeColor, 0.7);

	  const icon = this.add.text(width / 2 - 250, y, getSlotIcon(item.slot), {
	    fontFamily: UI.font.body,
	    fontSize: '17px',
	    color: '#ffffff',
	  }).setOrigin(0.5);

	  const upgrade = inventoryItem.upgradeLevel > 0 ? ` +${inventoryItem.upgradeLevel}` : '';

	  const title = this.add.text(width / 2 - 215, y - 14, `${item.name}${upgrade}`, {
	    fontFamily: UI.font.body,
	    fontSize: '16px',
	    color: isEquipped ? UI.colors.goldText : UI.colors.text,
	  }).setOrigin(0, 0.5);

	  const subtitle = this.add.text(
	    width / 2 - 215,
	    y + 13,
	    `${getSlotText(item.slot)} • ${getRarityText(item)}`,
	    {
	      fontFamily: UI.font.body,
	      fontSize: '13px',
	      color: UI.colors.textMuted,
	    }
	  ).setOrigin(0, 0.5);

	  const equipButton = createButton(
	    this,
	    width / 2 + 145,
	    y,
	    isEquipped ? 'Надето' : 'Надеть',
	    () => {
	      if (isEquipped) {
	        return;
	      }

	      equipItem(player, inventoryItem.instanceId);
				void saveGameAsync();

				this.scene.restart({
				  inventoryScrollY: this.inventoryTargetScrollY,
				});
	    },
	    88,
	    34,
	    {
	      small: true,
	      disabled: isEquipped,
	    }
	  );

	  const sellButton = createButton(
	    this,
	    width / 2 + 245,
	    y,
	    'Продать',
	    () => {
	      this.showSellConfirm(inventoryItem);
	    },
	    88,
	    34,
	    {
	      small: true,
	      danger: true,
	      disabled: isEquipped,
	    }
	  );

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
		    setAlpha: (alpha: number) => void;
		  };
		
		  alphaObject.setAlpha(alpha);
		});

		// Если карточка почти исчезла, отключаем клики,
		// чтобы нельзя было нажать на полупрозрачный предмет у края списка
		if (alpha < 0.65) {
		  bg.disableInteractive();
		  equipButton.bg.disableInteractive();
		  sellButton.bg.disableInteractive();
		}

		this.inventoryContainer.add(cardObjects);
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

				const savedScrollY = this.inventoryTargetScrollY;

				this.closeItemInfo();

				this.scene.restart({
				  inventoryScrollY: savedScrollY,
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