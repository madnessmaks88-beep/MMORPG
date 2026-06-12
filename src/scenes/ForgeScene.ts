import Phaser from 'phaser';

import { player, type InventoryItem } from '../data/player';

import {
  createItemStatsText,
  getBaseItemFromInventoryItem,
  getRarityColorHex,
  getRarityStrokeColor,
  getRarityText,
  getSlotIcon,
  getWeaponTypeText,
  isItemEquipped,
} from '../systems/InventorySystem';

import {
  canUpgradeAnvil,
  canUpgradeWeapon,
  createUpgradeCostText,
  getAnvilUpgradeCost,
  getMaxWeaponUpgradeLevelForItem,
  getSortedForgeWeapons,
  getWeaponUpgradeCost,
  upgradeAnvil,
  upgradeWeaponWithMaterials,
} from '../systems/ForgeSystem';

import { getMaterialName, type MaterialId } from '../data/materials';
import { saveGameAsync } from '../systems/SaveSystem';

import { createButton } from '../ui/createButton';

import {
  UI,
  createSceneBackground,
  createTitle,
} from '../ui/theme';

export class ForgeScene extends Phaser.Scene {
  private modalObjects: Phaser.GameObjects.GameObject[] = [];
  private isActionLocked = false;

  constructor() {
    super('ForgeScene');
  }

  create() {
    createSceneBackground(this);
    this.createForgeBackdrop();

    createTitle(
      this,
      'Кузница',
      'Закаляй оружие материалами склепа'
    );

    this.createResourcePanel();
    this.createAnvilPanel();
    this.createWeaponList();

    createButton(
      this,
      this.scale.width / 2,
      1138,
      'Вернуться в город',
      () => {
        this.scene.start('CampScene');
      },
      520,
      56
    );
  }

  private createForgeBackdrop() {
    const { width, height } = this.scale;

    this.add.circle(width / 2, 165, 310, 0x8a3f1c, 0.075).setDepth(0);
    this.add.circle(width / 2, 165, 165, 0xf0a040, 0.055).setDepth(0);
    this.add.circle(width / 2, 165, 75, 0xf0d58a, 0.035).setDepth(0);

    this.add.rectangle(width / 2, height - 245, width, 410, 0x030202, 0.38).setDepth(0);

    for (let i = 0; i < 42; i += 1) {
      const x = Phaser.Math.Between(35, width - 35);
      const y = Phaser.Math.Between(95, height - 155);
      const size = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.035, 0.11);

      this.add.circle(x, y, size, 0xf0d58a, alpha).setDepth(1);
    }

    for (let i = 0; i < 8; i += 1) {
      const x = 70 + i * 86;
      const y = height - 125 + (i % 2) * 18;

      this.add.rectangle(x, y, 60, 10, 0x100b08, 0.72).setDepth(1);
      this.add.circle(x, y - 17, 25, 0x8a3f1c, 0.055).setDepth(1);
    }
  }

  private createResourcePanel() {
    const { width } = this.scale;

    this.createRoundedPanel({
      x: width / 2,
      y: 235,
      width: 640,
      height: 155,
      radius: 32,
      color: 0x100b08,
      alpha: 0.94,
      strokeColor: UI.colors.gold,
      strokeAlpha: 0.55,
      glowColor: 0xf0a040,
      depth: 2,
    });

    this.add.text(width / 2, 175, 'Ресурсы кузницы', {
      fontFamily: UI.font.title,
      fontSize: '26px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(8);

    this.createGoldChip(width / 2 - 215, 235);

    const materialIds: MaterialId[] = [
      'darkened_bone',
      'dim_gem',
      'old_leather',
      'dark_flame_heart',
      'black_gem',
      'cursed_seal',
      'black_sarcophagus_shard',
    ];

    materialIds.forEach((id, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);

      const x = width / 2 - 115 + col * 250;
      const y = 208 + row * 28;

      this.createMaterialLine(x, y, id);
    });
  }

  private createAnvilPanel() {
    const { width } = this.scale;

    const panelY = 396;
    const anvilCost = getAnvilUpgradeCost();
    const canUpgrade = canUpgradeAnvil();
    const isUpgraded = player.anvilLevel >= 2;

    this.createRoundedPanel({
      x: width / 2,
      y: panelY,
      width: 640,
      height: 160,
      radius: 32,
      color: 0x100b08,
      alpha: 0.94,
      strokeColor: isUpgraded ? 0x75d184 : UI.colors.goldDark,
      strokeAlpha: isUpgraded ? 0.72 : 0.5,
      glowColor: isUpgraded ? 0x75d184 : 0xf0a040,
      depth: 2,
    });

    this.add.circle(width / 2 - 265, panelY, 44, 0x21150f, 0.98)
      .setStrokeStyle(2, isUpgraded ? 0x75d184 : UI.colors.gold, 0.86)
      .setDepth(7);

    this.add.text(width / 2 - 265, panelY, '⚒', {
      fontFamily: UI.font.body,
      fontSize: '30px',
      color: isUpgraded ? UI.colors.green : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8);

    this.add.text(width / 2 - 205, panelY - 50, `Наковальня ${player.anvilLevel} уровня`, {
      fontFamily: UI.font.title,
      fontSize: '24px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(8);

    this.add.text(width / 2 - 205, panelY - 17, 'Предел улучшения зависит от редкости оружия', {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: UI.colors.text,
    }).setOrigin(0, 0.5).setDepth(8);

    const statusText = isUpgraded
      ? 'Наковальня усилена. Кузнец готов работать с предельными улучшениями.'
      : `Усиление требует: ${getMaterialName(anvilCost.materialId)} x${anvilCost.amount} и ${anvilCost.gold} золота.`;

    this.add.text(width / 2 - 205, panelY + 18, statusText, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.textMuted,
      lineSpacing: 3,
      wordWrap: {
        width: 365,
      },
    }).setOrigin(0, 0.5).setDepth(8);

    this.createAnvilProgress(width / 2 - 205, panelY + 60);

    this.createForgeActionButton({
      x: width / 2 + 220,
      y: panelY + 4,
      width: 155,
      height: 50,
      text: isUpgraded ? 'Усилено' : 'Усилить',
      disabled: isUpgraded || !canUpgrade,
      variant: isUpgraded ? 'green' : 'gold',
      onClick: () => {
        this.handleAnvilUpgrade();
      },
      depth: 8,
    });
  }

  private createWeaponList() {
  const { width } = this.scale;

  const panelY = 785;

  this.createRoundedPanel({
    x: width / 2,
    y: panelY,
    width: 640,
    height: 610,
    radius: 34,
    color: 0x0d0907,
    alpha: 0.95,
    strokeColor: UI.colors.goldDark,
    strokeAlpha: 0.5,
    glowColor: 0x8a3f1c,
    depth: 2,
  });

  this.add.text(width / 2, panelY - 270, 'Оружие для закалки', {
    fontFamily: UI.font.title,
    fontSize: '30px',
    color: UI.colors.goldText,
    stroke: '#000000',
    strokeThickness: 5,
  }).setOrigin(0.5).setDepth(8);

  this.createRarityLegend(panelY - 232);

  const forgeWeapons = getSortedForgeWeapons();

  if (forgeWeapons.length === 0) {
    this.add.circle(width / 2, panelY - 25, 64, 0x21150f, 0.92)
      .setStrokeStyle(2, UI.colors.goldDark, 0.7)
      .setDepth(7);

    this.add.text(width / 2, panelY - 25, '⚔', {
      fontFamily: UI.font.body,
      fontSize: '45px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(8);

    this.add.text(
      width / 2,
      panelY + 80,
      'В сумке нет оружия.\nОружие можно выбить с монстров, элиты, мини-боссов и Морвеина.',
      {
        fontFamily: UI.font.body,
        fontSize: '20px',
        color: UI.colors.textMuted,
        align: 'center',
        wordWrap: {
          width: 540,
        },
        lineSpacing: 6,
      }
    ).setOrigin(0.5).setDepth(8);

    return;
  }

  const visibleItems = forgeWeapons.slice(0, 5);

  visibleItems.forEach((inventoryItem: InventoryItem, index: number) => {
    this.createWeaponCard(inventoryItem, panelY - 156 + index * 100);
  });
}

  private createWeaponCard(inventoryItem: InventoryItem, y: number) {
    const { width } = this.scale;

    const item = getBaseItemFromInventoryItem(inventoryItem);

    if (!item) {
      return;
    }

    const equipped = isItemEquipped(player, inventoryItem.instanceId);
    const upgradeLevel = inventoryItem.upgradeLevel;
    const maxUpgrade = getMaxWeaponUpgradeLevelForItem(inventoryItem);

    const cost = getWeaponUpgradeCost(inventoryItem);
    const canUpgrade = canUpgradeWeapon(inventoryItem);

    const rarityColor = getRarityColorHex(item);
    const rarityStrokeColor = getRarityStrokeColor(item);

    const cardX = width / 2;
    const cardWidth = 594;
    const cardHeight = 94;
    const radius = 22;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(
      cardX - cardWidth / 2,
      y - cardHeight / 2 + 7,
      cardWidth,
      cardHeight,
      radius
    );
    shadow.setDepth(5);

    const card = this.add.graphics();
    card.fillStyle(equipped ? 0x21150f : 0x14100d, 0.96);
    card.fillRoundedRect(
      cardX - cardWidth / 2,
      y - cardHeight / 2,
      cardWidth,
      cardHeight,
      radius
    );

    card.lineStyle(2, equipped ? UI.colors.gold : rarityStrokeColor, equipped ? 0.92 : 0.68);
    card.strokeRoundedRect(
      cardX - cardWidth / 2,
      y - cardHeight / 2,
      cardWidth,
      cardHeight,
      radius
    );
    card.setDepth(6);

    const rarityBar = this.add.graphics();
    rarityBar.fillStyle(rarityColor, 0.95);
    rarityBar.fillRoundedRect(
      cardX - cardWidth / 2 + 5,
      y - cardHeight / 2 + 9,
      8,
      cardHeight - 18,
      6
    );
    rarityBar.setDepth(7);

    this.add.circle(cardX - 252, y - 16, 27, rarityColor, 0.95)
      .setStrokeStyle(2, rarityStrokeColor, 0.9)
      .setDepth(7);

    this.add.text(cardX - 252, y - 16, getSlotIcon(item.slot), {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(8);

    const equippedText = equipped ? '  •  надето' : '';
    const weaponTypeText = getWeaponTypeText(item.weaponType);

    this.add.text(cardX - 215, y - 35, `${item.name} +${upgradeLevel}${equippedText}`, {
      fontFamily: UI.font.title,
      fontSize: '16px',
      color: equipped ? UI.colors.goldText : UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: {
        width: 315,
      },
    }).setOrigin(0, 0.5).setDepth(8);

    this.add.text(cardX - 215, y - 16, `${getRarityText(item)}  •  ${weaponTypeText}  •  предел +${maxUpgrade}`, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: this.getRarityTextColor(item),
    }).setOrigin(0, 0.5).setDepth(8);

    this.createUpgradeProgressBar(cardX - 215, y + 8, 270, upgradeLevel, maxUpgrade, rarityColor);

    this.add.text(cardX - 215, y + 33, createItemStatsText(inventoryItem) || 'Без бонусов', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
      wordWrap: {
        width: 305,
      },
    }).setOrigin(0, 0.5).setDepth(8);

    const costText =
      upgradeLevel >= maxUpgrade
        ? `Достигнут предел редкости: +${maxUpgrade}`
        : createUpgradeCostText(cost);

    this.add.text(cardX + 112, y - 13, costText, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: upgradeLevel >= maxUpgrade
        ? UI.colors.green
        : canUpgrade
          ? UI.colors.textMuted
          : UI.colors.red,
      lineSpacing: 2,
      wordWrap: {
        width: 165,
      },
    }).setOrigin(0, 0.5).setDepth(8);

    this.createForgeActionButton({
      x: cardX + 226,
      y: y + 26,
      width: 122,
      height: 38,
      text: upgradeLevel >= maxUpgrade ? 'Макс.' : 'Улучшить',
      disabled: upgradeLevel >= maxUpgrade || !canUpgrade,
      variant: upgradeLevel >= maxUpgrade ? 'green' : 'gold',
      onClick: () => {
        this.handleWeaponUpgrade(inventoryItem);
      },
      depth: 9,
    });
  }

  private createForgeActionButton(config: {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'gold' | 'green' | 'red';
  depth?: number;
}) {
  const disabled = config.disabled ?? false;
  const variant = config.variant ?? 'gold';
  const depth = config.depth ?? 8;
  const radius = 16;

  const strokeColor =
    disabled
      ? 0x4a3a27
      : variant === 'green'
        ? 0x75d184
        : variant === 'red'
          ? 0xff6b6b
          : UI.colors.gold;

  const fillColor =
    disabled
      ? 0x120d0a
      : variant === 'green'
        ? 0x102016
        : variant === 'red'
          ? 0x241010
          : 0x21150f;

  const hoverColor =
    variant === 'green'
      ? 0x183322
      : variant === 'red'
        ? 0x321515
        : 0x2c1d14;

  const textColor =
    disabled
      ? UI.colors.textMuted
      : variant === 'green'
        ? UI.colors.green
        : variant === 'red'
          ? UI.colors.red
          : UI.colors.goldText;

  const hoverTextColor = disabled ? UI.colors.textMuted : '#ffffff';

  const shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.28);
  shadow.fillRoundedRect(
    config.x - config.width / 2,
    config.y - config.height / 2 + 4,
    config.width,
    config.height,
    radius
  );
  shadow.setDepth(depth);

  const bg = this.add.graphics();
  bg.fillStyle(fillColor, disabled ? 0.55 : 0.96);
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
  bg.setDepth(depth + 1);

  const label = this.add.text(config.x, config.y, config.text, {
    fontFamily: UI.font.body,
    fontSize: '15px',
    color: textColor,
    stroke: '#000000',
    strokeThickness: disabled ? 1 : 2,
  }).setOrigin(0.5).setDepth(depth + 2);

  const redrawButton = (
    color: number,
    alpha: number,
    strokeAlpha: number,
    labelColor: string,
    labelOffsetY = 0
  ) => {
    bg.clear();

    bg.fillStyle(color, alpha);
    bg.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    bg.lineStyle(2, strokeColor, strokeAlpha);
    bg.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      radius
    );

    label.setY(config.y + labelOffsetY);
    label.setColor(labelColor);
  };

  if (!disabled) {
    let isPressed = false;
    let isLocked = false;

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
      if (isPressed || isLocked) {
        return;
      }

      redrawButton(hoverColor, 1, 1, hoverTextColor);
    });

    bg.on('pointerout', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      redrawButton(fillColor, 0.96, 0.85, textColor);
    });

    bg.on('pointerdown', () => {
      if (isLocked) {
        return;
      }

      isPressed = true;

      redrawButton(hoverColor, 0.92, 0.95, hoverTextColor, 1);
    });

    bg.on('pointerup', () => {
      if (!isPressed || isLocked) {
        return;
      }

      isPressed = false;
      isLocked = true;

      redrawButton(hoverColor, 1, 1, hoverTextColor);

      this.time.delayedCall(40, () => {
        config.onClick();
      });
    });

    bg.on('pointerupoutside', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      redrawButton(fillColor, 0.96, 0.85, textColor);
    });

    bg.on('pointercancel', () => {
      isPressed = false;

      if (isLocked) {
        return;
      }

      redrawButton(fillColor, 0.96, 0.85, textColor);
    });
  }

  return {
    shadow,
    bg,
    label,
  };
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
    glowColor?: number;
    depth?: number;
  }) {
    const radius = config.radius ?? 28;
    const color = config.color ?? 0x100b08;
    const alpha = config.alpha ?? 0.94;
    const strokeColor = config.strokeColor ?? UI.colors.goldDark;
    const strokeAlpha = config.strokeAlpha ?? 0.48;
    const strokeWidth = config.strokeWidth ?? 2;
    const glowColor = config.glowColor ?? 0xf0a040;
    const depth = config.depth ?? 2;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 9,
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

    this.add.circle(
      config.x,
      config.y - config.height / 2 + 28,
      config.width * 0.26,
      glowColor,
      0.045
    ).setDepth(depth + 2);

    return {
      shadow,
      panel,
    };
  }

  private createGoldChip(x: number, y: number) {
    this.createSmallRoundedBox(x, y, 172, 52, UI.colors.gold, 0.65);

    this.add.text(x - 66, y, '◆', {
      fontFamily: UI.font.body,
      fontSize: '19px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(8);

    this.add.text(x - 42, y - 10, 'Золото', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
    }).setOrigin(0, 0.5).setDepth(8);

    this.add.text(x - 42, y + 11, `${player.gold}`, {
      fontFamily: UI.font.title,
      fontSize: '18px',
      color: UI.colors.text,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(8);
  }

  private createMaterialLine(x: number, y: number, id: MaterialId) {
    const amount = player.materials[id] ?? 0;

    this.add.text(x, y, `${this.getMaterialIcon(id)} ${getMaterialName(id)}: ${amount}`, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: amount > 0 ? UI.colors.text : UI.colors.textMuted,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(8);
  }

  private createSmallRoundedBox(
    x: number,
    y: number,
    width: number,
    height: number,
    strokeColor: number,
    strokeAlpha: number
  ) {
    const radius = 16;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillRoundedRect(x - width / 2, y - height / 2 + 4, width, height, radius);
    shadow.setDepth(6);

    const box = this.add.graphics();
    box.fillStyle(0x17100c, 0.96);
    box.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    box.lineStyle(2, strokeColor, strokeAlpha);
    box.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    box.setDepth(7);
  }

  private getMaterialIcon(id: MaterialId) {
    if (id === 'darkened_bone') return '◇';
    if (id === 'dim_gem') return '✦';
    if (id === 'old_leather') return '▱';
    if (id === 'dark_flame_heart') return '◆';
    if (id === 'black_gem') return '✧';
    if (id === 'cursed_seal') return '✣';
    if (id === 'black_sarcophagus_shard') return '♜';

    return '•';
  }

  private createAnvilProgress(x: number, y: number) {
    const progressWidth = 310;
    const progress = player.anvilLevel >= 2 ? 1 : 0.45;

    this.add.rectangle(x + progressWidth / 2, y, progressWidth, 8, 0x000000, 0.42)
      .setDepth(7);

    this.add.rectangle(
      x + (progressWidth * progress) / 2,
      y,
      progressWidth * progress,
      8,
      player.anvilLevel >= 2 ? 0x75d184 : UI.colors.gold,
      0.9
    ).setDepth(8);

    this.add.text(x + progressWidth + 12, y, player.anvilLevel >= 2 ? 'II' : 'I', {
      fontFamily: UI.font.title,
      fontSize: '14px',
      color: player.anvilLevel >= 2 ? UI.colors.green : UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(8);
  }

  private createRarityLegend(y: number) {
    const { width } = this.scale;

    const entries = [
      { label: 'Обычн. +3', color: 0xb8aa91 },
      { label: 'Редк. +5', color: 0x70a6ff },
      { label: 'Эпич. +7', color: 0xc084fc },
      { label: 'Легенд. +10', color: 0xf0d58a },
      { label: 'Миф. +10', color: 0xff6b6b },
    ];

    const startX = width / 2 - 258;

    entries.forEach((entry, index) => {
      const x = startX + index * 128;

      this.add.circle(x, y, 6, entry.color, 0.95).setDepth(8);

      this.add.text(x + 12, y, entry.label, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: UI.colors.textMuted,
      }).setOrigin(0, 0.5).setDepth(8);
    });
  }

  private createUpgradeProgressBar(
    x: number,
    y: number,
    width: number,
    level: number,
    maxLevel: number,
    color: number
  ) {
    const progress = maxLevel <= 0 ? 0 : Phaser.Math.Clamp(level / maxLevel, 0, 1);

    const radius = 5;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.48);
    bg.fillRoundedRect(x, y - 4, width, 8, radius);
    bg.setDepth(8);

    const track = this.add.graphics();
    track.fillStyle(0x2b211a, 0.9);
    track.fillRoundedRect(x, y - 4, width, 8, radius);
    track.setDepth(9);

    if (progress > 0) {
      const fill = this.add.graphics();
      fill.fillStyle(color, 0.95);
      fill.fillRoundedRect(x, y - 4, width * progress, 8, radius);
      fill.setDepth(10);
    }

    this.add.text(x + width + 10, y, `+${level}/${maxLevel}`, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: UI.colors.textMuted,
    }).setOrigin(0, 0.5).setDepth(10);
  }

  private getRarityTextColor(item: NonNullable<ReturnType<typeof getBaseItemFromInventoryItem>>) {
    if (item.rarity === 'common') return '#b8aa91';
    if (item.rarity === 'rare') return '#70a6ff';
    if (item.rarity === 'epic') return '#c084fc';
    if (item.rarity === 'legendary') return '#f0d58a';
    if (item.rarity === 'mythic') return '#ff6b6b';

    return UI.colors.textMuted;
  }

  private handleWeaponUpgrade(inventoryItem: InventoryItem) {
    if (this.isActionLocked) {
      return;
    }

    this.isActionLocked = true;

    const result = upgradeWeaponWithMaterials(inventoryItem);

    if (!result.success) {
      this.showMessage(result.message ?? 'Не удалось улучшить оружие.');
      return;
    }

    void saveGameAsync();

    this.showMessage(result.message ?? 'Оружие улучшено.');
  }

  private handleAnvilUpgrade() {
    if (this.isActionLocked) {
      return;
    }

    this.isActionLocked = true;

    const result = upgradeAnvil();

    if (!result.success) {
      this.showMessage(result.message ?? 'Не удалось улучшить наковальню.');
      return;
    }

    void saveGameAsync();

    this.showMessage(result.message ?? 'Наковальня улучшена.');
  }

  private showMessage(message: string) {
    const { width, height } = this.scale;

    this.modalObjects.forEach(object => {
      object.destroy();
    });

    this.modalObjects = [];

    this.isActionLocked = false;

    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.74
    )
      .setDepth(100)
      .setInteractive();

    const glow = this.add.circle(width / 2, height / 2 - 95, 95, 0xf0a040, 0.07)
      .setDepth(101);

    const panelObjects = this.createRoundedPanel({
      x: width / 2,
      y: height / 2,
      width: 620,
      height: 290,
      radius: 32,
      color: 0x17100c,
      alpha: 0.98,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.9,
      strokeWidth: 3,
      glowColor: 0xf0a040,
      depth: 101,
    });

    const titleText = this.add.text(width / 2, height / 2 - 98, 'Кузница', {
      fontFamily: UI.font.title,
      fontSize: '32px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(104);

    const messageText = this.add.text(width / 2, height / 2 - 15, message, {
      fontFamily: UI.font.body,
      fontSize: '20px',
      color: UI.colors.text,
      align: 'center',
      lineSpacing: 6,
      wordWrap: {
        width: 525,
      },
    }).setOrigin(0.5).setDepth(104);

    const ok = createButton(
      this,
      width / 2,
      height / 2 + 98,
      'Понятно',
      () => {
        this.modalObjects.forEach(object => {
          object.destroy();
        });

        this.modalObjects = [];

        this.scene.restart();
      },
      250,
      54
    );

    ok.shadow.setDepth(104);
    ok.bg.setDepth(105);
    ok.label.setDepth(106);

    this.modalObjects.push(
      overlay,
      glow,
      panelObjects.shadow,
      panelObjects.panel,
      titleText,
      messageText,
      ok.shadow,
      ok.bg,
      ok.label
    );
  }
}