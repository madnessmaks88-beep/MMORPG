import Phaser from 'phaser';

import { player } from '../data/player';
import { gameState } from '../data/gameState';
import { getRaceById } from '../data/races';
import { getRelicById } from '../data/relics';

import { getPlayerStats } from '../systems/InventorySystem';
import { getCachedVKUser } from '../systems/VKBridgeSystem';

import { createBottomNav } from '../ui/createBottomNav';

import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type ProfileLayout = {
  width: number;
  height: number;
  centerX: number;

  safeX: number;
  safeTop: number;
  safeBottom: number;

  headerHeight: number;
  contentTop: number;
  contentBottom: number;
  contentWidth: number;
  viewportHeight: number;

  compact: boolean;
  twoColumns: boolean;
};

type StonePanelConfig = {
  parent?: Phaser.GameObjects.Container;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  fill?: number;
  alpha?: number;
  stroke?: number;
  strokeAlpha?: number;
  strokeWidth?: number;
  depth?: number;
};

type TalentPlayer = typeof player & {
  characterTreePoints?: number;
  upgradePoints?: number;
};

const PROFILE = {
  black: 0x050607,
  void: 0x08090c,
  stone: 0x11141a,
  stoneSoft: 0x171a22,
  ash: 0x242832,
  bronze: 0x6f5638,
  bronzeDark: 0x3b2d20,
  gold: 0xb9985b,
  goldSoft: 0xd6c08a,
  red: 0x8f2f2f,
  redSoft: 0xc05a4b,
  blue: 0x4f81a8,
  blueSoft: 0x8aa9c5,
  violet: 0x6b4a8c,
  greenMuted: 0x6f8f76,
};

export class ProfileScene extends Phaser.Scene {
  private contentContainer?: Phaser.GameObjects.Container;
  private scrollZone?: Phaser.GameObjects.Rectangle;

  private currentScrollY = 0;
  private targetScrollY = 0;
  private maxScrollY = 0;

  private isDragging = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  constructor() {
    super('ProfileScene');
  }

  create() {
    createSceneBackground(this);

    const layout = this.getLayout();

    this.createCatacombBackdrop(layout);
    this.createFixedHeader(layout);
    this.createScrollableContent(layout);

    createBottomNav(this, {
      activeScene: 'ProfileScene',
    });
  }

  update() {
    if (!this.contentContainer || this.isDragging) {
      return;
    }

    if (Math.abs(this.currentScrollY - this.targetScrollY) < 0.4) {
      this.currentScrollY = this.targetScrollY;
    } else {
      this.currentScrollY = Phaser.Math.Linear(this.currentScrollY, this.targetScrollY, 0.18);
    }

    this.contentContainer.y = -this.currentScrollY;
  }

  private getLayout(): ProfileLayout {
    const { width, height } = this.scale;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.024), 18, 34);
    const safeBottom = 116;
    const headerHeight = Phaser.Math.Clamp(Math.round(height * 0.095), 86, 112);

    const contentTop = safeTop + headerHeight + 8;
    const contentBottom = height - safeBottom;
    const contentWidth = Math.min(width - safeX * 2, 620);

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      headerHeight,
      contentTop,
      contentBottom,
      contentWidth,
      viewportHeight: Math.max(330, contentBottom - contentTop),

      compact: height < 1120,
      twoColumns: contentWidth >= 540,
    };
  }

  private createCatacombBackdrop(layout: ProfileLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, PROFILE.void, 0.78).setDepth(0);

    this.add.circle(centerX, layout.safeTop + 156, width * 0.5, PROFILE.violet, 0.06).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 176, width * 0.31, PROFILE.blue, 0.045).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 196, width * 0.17, PROFILE.gold, 0.035).setDepth(0);

    this.add.rectangle(centerX, height - 210, width, 420, 0x020202, 0.52).setDepth(0);

    for (let i = 0; i < 22; i += 1) {
      const x = layout.safeX + 12 + i * ((width - layout.safeX * 2 - 24) / 21);
      const y = layout.safeTop + 96 + (i % 8) * 74;
      const alpha = 0.025 + (i % 3) * 0.012;

      this.add.circle(x, y, 1.5 + (i % 2), PROFILE.goldSoft, alpha).setDepth(1);
    }

    for (let i = 0; i < 7; i += 1) {
      const x = centerX + (i - 3) * (width * 0.14);
      const y = height - 130 + (i % 2) * 12;
      this.add.rectangle(x, y, width * 0.12, 18, PROFILE.ash, 0.18)
        .setRotation((i - 3) * 0.015)
        .setDepth(1);
    }

    this.add.text(centerX, layout.safeTop + 178, '☥', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '86px' : '104px',
      color: '#ffffff',
    })
      .setOrigin(0.5)
      .setAlpha(0.025)
      .setDepth(1);
  }

  private createFixedHeader(layout: ProfileLayout) {
    const headerY = layout.safeTop + layout.headerHeight / 2;

    this.createStonePanel({
      x: layout.centerX,
      y: headerY,
      width: layout.contentWidth,
      height: layout.headerHeight,
      radius: 28,
      fill: PROFILE.stone,
      alpha: 0.94,
      stroke: PROFILE.bronze,
      strokeAlpha: 0.72,
      depth: 240,
    });

    this.add.text(layout.centerX, headerY - 20, 'Профиль героя', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '29px' : '33px',
      color: '#d9c28b',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(244);

    this.add.text(layout.centerX, headerY + 22, 'Печать выжившего в катакомбах', {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: '#8f8a80',
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 54,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(244);
  }

  private createScrollableContent(layout: ProfileLayout) {
    this.contentContainer = this.add.container(0, 0).setDepth(5);

    const maskGraphics = this.add.graphics();
    maskGraphics.setVisible(false);
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.fillRect(
      layout.safeX,
      layout.contentTop,
      layout.width - layout.safeX * 2,
      layout.viewportHeight
    );

    this.contentContainer.setMask(maskGraphics.createGeometryMask());

    let cursorY = layout.contentTop + 10;

    cursorY = this.createHeroIdentityPanel(layout, cursorY);
    cursorY = this.createVitalityPanel(layout, cursorY + 14);
    cursorY = this.createStatsPanel(layout, cursorY + 14);
    cursorY = this.createRaceAbilitiesPanel(layout, cursorY + 14);
    cursorY = this.createProgressPanel(layout, cursorY + 14);
    cursorY = this.createRelicsPanel(layout, cursorY + 14);

    const contentHeight = cursorY - layout.contentTop + 28;

    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScrollY);
    this.targetScrollY = this.currentScrollY;

    this.createScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }
  }

  private createHeroIdentityPanel(layout: ProfileLayout, topY: number) {
    const container = this.requireContentContainer();
    const race = player.raceId ? getRaceById(player.raceId) : undefined;
    const raceColor = race ? this.getRaceColor(race.id) : PROFILE.bronze;
    const raceRole = race ? this.getRaceRole(race.id) : 'Путь ещё не выбран';
    const heroName = this.getHeroDisplayName();

    const height = layout.compact ? 196 : 212;
    const y = topY + height / 2;
    const left = layout.centerX - layout.contentWidth / 2;
    const innerLeft = left + 26;
    const innerRight = left + layout.contentWidth - 26;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y,
      width: layout.contentWidth,
      height,
      radius: 34,
      fill: PROFILE.stone,
      alpha: 0.97,
      stroke: raceColor,
      strokeAlpha: 0.68,
      strokeWidth: 2,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.circle(innerLeft + 58, topY + 82, 68, raceColor, 0.055).setDepth(4)
    );

    this.createVkAvatar(container, innerLeft + 58, topY + 82, layout.compact ? 82 : 92, 6, raceColor);

    const textX = innerLeft + 126;
    const titleWidth = Math.max(150, innerRight - textX - 76);

    this.addTo(
      container,
      this.add.text(textX, topY + 42, heroName, {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '24px' : '29px',
        color: '#d9c28b',
        stroke: '#000000',
        strokeThickness: 5,
        wordWrap: {
          width: titleWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(innerRight, topY + 43, `Ур. ${player.level}`, {
        fontFamily: UI.font.title,
        fontSize: '18px',
        color: '#a9b78f',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'right',
        wordWrap: { width: 74 },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(textX, topY + 76, race ? race.name : 'Раса не выбрана', {
        fontFamily: UI.font.title,
        fontSize: '18px',
        color: race ? '#d0d0ca' : '#7e7b74',
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: titleWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(textX, topY + 104, raceRole, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: race ? this.getRaceColorText(race.id) : '#8f8a80',
        wordWrap: {
          width: titleWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.createExpBar(container, layout.centerX, topY + height - 48, layout.contentWidth - 58);

    return topY + height;
  }

  private createVitalityPanel(layout: ProfileLayout, topY: number) {
    const container = this.requireContentContainer();
    const stats = getPlayerStats(player);
    const treePlayer = player as TalentPlayer;

    const resourceColumns = layout.contentWidth >= 520 ? 4 : 2;
    const height = layout.compact
      ? resourceColumns === 4 ? 176 : 218
      : resourceColumns === 4 ? 190 : 230;
    const y = topY + height / 2;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y,
      width: layout.contentWidth,
      height,
      radius: 28,
      fill: PROFILE.void,
      alpha: 0.94,
      stroke: PROFILE.bronzeDark,
      strokeAlpha: 0.72,
      depth: 2,
    });

    this.createSectionTitle(container, layout.centerX, topY + 30, 'Состояние', 'кровь, энергия и припасы', layout.contentWidth - 56);

    const barWidth = Math.min(layout.contentWidth - 56, 540);
    this.createLongBar(container, layout.centerX, topY + 80, barWidth, 'HP', `${player.hp}/${stats.maxHp}`, stats.maxHp > 0 ? player.hp / stats.maxHp : 1, PROFILE.redSoft);
    this.createLongBar(container, layout.centerX, topY + 122, barWidth, 'Энергия', `${player.energy}/${stats.maxEnergy}`, stats.maxEnergy > 0 ? player.energy / stats.maxEnergy : 1, PROFILE.blueSoft);

    const resources = [
      { icon: '◆', value: `${player.gold}`, label: 'золото', color: PROFILE.gold },
      { icon: '✚', value: `${player.potions}`, label: 'зелья', color: PROFILE.redSoft },
      { icon: '★', value: `${player.relicIds.length}`, label: 'реликвии', color: PROFILE.violet },
      { icon: '✦', value: `${treePlayer.characterTreePoints ?? treePlayer.upgradePoints ?? 0}`, label: 'очки', color: PROFILE.blue },
    ];

    const chipGap = 8;
    const resourceWidth = Math.min((layout.contentWidth - 56 - chipGap * (resourceColumns - 1)) / resourceColumns, 135);
    const totalResourceWidth = resourceWidth * resourceColumns + chipGap * (resourceColumns - 1);
    const firstResourceX = layout.centerX - totalResourceWidth / 2 + resourceWidth / 2;
    const firstResourceY = resourceColumns === 4 ? topY + height - 28 : topY + height - 70;

    resources.forEach((resource, index) => {
      const column = index % resourceColumns;
      const row = Math.floor(index / resourceColumns);
      const chipX = firstResourceX + column * (resourceWidth + chipGap);
      const chipY = firstResourceY + row * 46;

      this.createResourceChip(container, chipX, chipY, resourceWidth, resource.icon, resource.value, resource.label, resource.color);
    });

    return topY + height;
  }

  private createStatsPanel(layout: ProfileLayout, topY: number) {
    const container = this.requireContentContainer();
    const stats = getPlayerStats(player);

    const rows = [
      { label: 'Атака', value: `${stats.attack}`, icon: '⚔', color: PROFILE.gold },
      { label: 'Защита', value: `${stats.defense}`, icon: '▣', color: PROFILE.blue },
      { label: 'Крит', value: `${Math.round(stats.critChance * 100)}%`, icon: '◆', color: PROFILE.redSoft },
      { label: 'Уклонение', value: `${Math.round(stats.dodgeChance * 100)}%`, icon: '◇', color: PROFILE.blueSoft },
      { label: 'Сила', value: `${stats.strength}`, icon: '▲', color: PROFILE.gold },
      { label: 'Ловкость', value: `${stats.agility}`, icon: '➤', color: PROFILE.greenMuted },
      { label: 'Удача', value: `${stats.luck}`, icon: '★', color: PROFILE.goldSoft },
      { label: 'Интеллект', value: `${stats.intelligence}`, icon: '✧', color: PROFILE.violet },
    ];

    const tileGap = 10;
    const tileWidth = Math.min((layout.contentWidth - 58 - tileGap) / 2, 270);
    const tileHeight = layout.compact ? 54 : 58;
    const rowsCount = Math.ceil(rows.length / 2);
    const height = 76 + rowsCount * tileHeight + (rowsCount - 1) * 10 + 24;
    const y = topY + height / 2;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y,
      width: layout.contentWidth,
      height,
      radius: 30,
      fill: PROFILE.stone,
      alpha: 0.95,
      stroke: PROFILE.bronzeDark,
      strokeAlpha: 0.75,
      depth: 2,
    });

    this.createSectionTitle(container, layout.centerX, topY + 34, 'Характеристики', 'основа силы героя', layout.contentWidth - 56);

    const leftX = layout.centerX - tileWidth / 2 - tileGap / 2;
    const rightX = layout.centerX + tileWidth / 2 + tileGap / 2;
    const startY = topY + 88;

    rows.forEach((row, index) => {
      const x = index % 2 === 0 ? leftX : rightX;
      const rowIndex = Math.floor(index / 2);
      this.createStatTile(container, x, startY + rowIndex * (tileHeight + 10), tileWidth, tileHeight, row.label, row.value, row.icon, row.color);
    });

    return topY + height;
  }

  private createRaceAbilitiesPanel(layout: ProfileLayout, topY: number) {
    const container = this.requireContentContainer();
    const race = player.raceId ? getRaceById(player.raceId) : undefined;
    const panelHeight = race ? (layout.twoColumns ? 292 : 430) : 184;
    const y = topY + panelHeight / 2;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      fill: PROFILE.void,
      alpha: 0.94,
      stroke: race ? this.getRaceColor(race.id) : PROFILE.bronzeDark,
      strokeAlpha: race ? 0.55 : 0.42,
      depth: 2,
    });

    this.createSectionTitle(container, layout.centerX, topY + 34, 'Расовые навыки', race ? 'врождённая печать героя' : 'не открыто', layout.contentWidth - 56);

    if (!race) {
      this.addTo(
        container,
        this.add.text(layout.centerX, topY + 112, 'Выбери расу в новой игре, чтобы открыть пассивный и активный навык.', {
          fontFamily: UI.font.body,
          fontSize: '16px',
          color: '#8f8a80',
          align: 'center',
          wordWrap: {
            width: layout.contentWidth - 72,
            useAdvancedWrap: true,
          },
          maxLines: 3,
          lineSpacing: 5,
        }).setOrigin(0.5).setDepth(8)
      );

      return topY + panelHeight;
    }

    if (layout.twoColumns) {
      const cardWidth = (layout.contentWidth - 74) / 2;
      const cardHeight = 176;
      const cardY = topY + 166;

      this.createAbilityCard(container, layout.centerX - cardWidth / 2 - 10, cardY, cardWidth, cardHeight, 'Пассивный навык', race.passiveName, race.passiveDescription, '◇', this.getRaceColor(race.id));
      this.createAbilityCard(container, layout.centerX + cardWidth / 2 + 10, cardY, cardWidth, cardHeight, 'Активный навык', race.activeName, race.activeDescription, '✦', this.getRaceColor(race.id));
    } else {
      const cardWidth = layout.contentWidth - 56;

      this.createAbilityCard(container, layout.centerX, topY + 142, cardWidth, 152, 'Пассивный навык', race.passiveName, race.passiveDescription, '◇', this.getRaceColor(race.id));
      this.createAbilityCard(container, layout.centerX, topY + 302, cardWidth, 152, 'Активный навык', race.activeName, race.activeDescription, '✦', this.getRaceColor(race.id));
    }

    return topY + panelHeight;
  }

  private createProgressPanel(layout: ProfileLayout, topY: number) {
    const container = this.requireContentContainer();
    const height = 194;
    const y = topY + height / 2;

    const highestFloor = gameState.highestClearedFloor ?? 0;
    const highestTier = gameState.highestClearedTier ?? 0;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y,
      width: layout.contentWidth,
      height,
      radius: 28,
      fill: PROFILE.stone,
      alpha: 0.94,
      stroke: PROFILE.bronzeDark,
      strokeAlpha: 0.68,
      depth: 2,
    });

    this.createSectionTitle(container, layout.centerX, topY + 34, 'Прогресс спуска', 'следы в глубинах', layout.contentWidth - 56);

    const miniWidth = Math.min((layout.contentWidth - 70) / 3, 168);
    const miniY = topY + 100;
    const gap = 10;

    this.createProgressMiniCard(container, layout.centerX - miniWidth - gap, miniY, miniWidth, 'Рекорд', `${highestFloor}`, '⌂');
    this.createProgressMiniCard(container, layout.centerX, miniY, miniWidth, 'Ярус', `${highestTier}`, '▲');
    this.createProgressMiniCard(container, layout.centerX + miniWidth + gap, miniY, miniWidth, 'След.', `${highestTier + 1}`, '▼');

    const activeRunText = gameState.floorRun.active
      ? `Активный спуск: этаж ${gameState.floorRun.currentFloor}`
      : 'Активный спуск: нет';

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 162, activeRunText, {
        fontFamily: UI.font.body,
        fontSize: '14px',
        color: gameState.floorRun.active ? '#a9b78f' : '#8f8a80',
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 60,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );

    return topY + height;
  }

  private createRelicsPanel(layout: ProfileLayout, topY: number) {
    const container = this.requireContentContainer();

    const relics = player.relicIds
      .map(id => getRelicById(id))
      .filter((relic): relic is NonNullable<ReturnType<typeof getRelicById>> => Boolean(relic));

    const visibleRelics = relics.slice(0, 4);
    const empty = relics.length === 0;
    const height = empty
      ? 226
      : 86 + visibleRelics.length * 70 + (relics.length > 4 ? 42 : 22);
    const y = topY + height / 2;

    this.createStonePanel({
      parent: container,
      x: layout.centerX,
      y,
      width: layout.contentWidth,
      height,
      radius: 30,
      fill: PROFILE.void,
      alpha: 0.94,
      stroke: PROFILE.bronzeDark,
      strokeAlpha: 0.72,
      depth: 2,
    });

    this.createSectionTitle(container, layout.centerX, topY + 34, 'Реликвии', 'память о побеждённых ярусах', layout.contentWidth - 56);

    if (empty) {
      this.addTo(
        container,
        this.add.circle(layout.centerX, topY + 103, 38, PROFILE.stoneSoft, 1)
          .setStrokeStyle(2, PROFILE.bronze, 0.55)
          .setDepth(6)
      );

      this.addTo(
        container,
        this.add.text(layout.centerX, topY + 102, '✦', {
          fontFamily: UI.font.body,
          fontSize: '30px',
          color: '#77736b',
          stroke: '#000000',
          strokeThickness: 2,
        }).setOrigin(0.5).setDepth(7)
      );

      this.addTo(
        container,
        this.add.text(layout.centerX, topY + 170, 'Реликвий пока нет. Победи финального босса яруса, чтобы получить первую.', {
          fontFamily: UI.font.body,
          fontSize: '16px',
          color: '#8f8a80',
          align: 'center',
          wordWrap: {
            width: layout.contentWidth - 76,
            useAdvancedWrap: true,
          },
          maxLines: 3,
          lineSpacing: 5,
        }).setOrigin(0.5).setDepth(8)
      );

      return topY + height;
    }

    visibleRelics.forEach((relic, index) => {
      this.createRelicCard(container, layout.centerX, topY + 86 + index * 70, layout.contentWidth - 60, relic.name, relic.description);
    });

    if (relics.length > 4) {
      this.addTo(
        container,
        this.add.text(layout.centerX, topY + height - 24, `И ещё реликвий: ${relics.length - 4}`, {
          fontFamily: UI.font.body,
          fontSize: '14px',
          color: '#8f8a80',
          align: 'center',
          wordWrap: {
            width: layout.contentWidth - 70,
            useAdvancedWrap: true,
          },
          maxLines: 1,
        }).setOrigin(0.5).setDepth(8)
      );
    }

    return topY + height;
  }

  private createScrollInput(layout: ProfileLayout) {
    this.scrollZone?.destroy();

    this.scrollZone = this.add.rectangle(
      layout.centerX,
      layout.contentTop + layout.viewportHeight / 2,
      layout.width,
      layout.viewportHeight,
      0x000000,
      0.001
    )
      .setDepth(220)
      .setInteractive({ useHandCursor: false });

    this.scrollZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.targetScrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) {
        return;
      }

      const deltaY = pointer.y - this.dragStartY;
      this.targetScrollY = Phaser.Math.Clamp(this.dragStartScrollY - deltaY, 0, this.maxScrollY);
      this.currentScrollY = this.targetScrollY;

      if (this.contentContainer) {
        this.contentContainer.y = -this.currentScrollY;
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('wheel', (
      pointer: Phaser.Input.Pointer,
      _objects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number
    ) => {
      if (pointer.y < layout.contentTop || pointer.y > layout.contentBottom) {
        return;
      }

      this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY + deltaY * 0.55, 0, this.maxScrollY);
    });
  }

  private createScrollHint(layout: ProfileLayout) {
    const hintY = layout.contentBottom - 18;

    const bg = this.add.rectangle(layout.centerX, hintY, 232, 28, 0x000000, 0.42).setDepth(230);
    const text = this.add.text(layout.centerX, hintY, 'Прокручивай профиль', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8f8a80',
    }).setOrigin(0.5).setDepth(231);

    this.tweens.add({
      targets: [bg, text],
      alpha: 0.25,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private createVkAvatar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    size: number,
    depth = 20,
    borderColor = PROFILE.bronze
  ) {
    type VKUserWithPhoto = {
      id?: number | string;
      first_name?: string;
      last_name?: string;
      photo_50?: string;
      photo_100?: string;
      photo_200?: string;
      photo_400_orig?: string;
      photo_max_orig?: string;
    };

    const vkUser = getCachedVKUser() as VKUserWithPhoto | null;

    this.createAvatarFallback(container, x, y, size, depth, borderColor);

    const photoUrl =
      vkUser?.photo_200 ||
      vkUser?.photo_100 ||
      vkUser?.photo_400_orig ||
      vkUser?.photo_max_orig ||
      vkUser?.photo_50;

    if (!photoUrl) {
      return;
    }

    const avatarKey = `vk_avatar_${vkUser?.id ?? 'local'}`;

    if (this.textures.exists(avatarKey)) {
      this.drawRoundAvatar(container, avatarKey, x, y, size, depth + 4, borderColor);
      return;
    }

    this.load.setCORS('anonymous');
    this.load.image(avatarKey, photoUrl);

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.textures.exists(avatarKey)) {
        return;
      }

      this.drawRoundAvatar(container, avatarKey, x, y, size, depth + 4, borderColor);
    });

    this.load.start();
  }

  private drawRoundAvatar(
    container: Phaser.GameObjects.Container,
    textureKey: string,
    x: number,
    y: number,
    size: number,
    depth: number,
    borderColor: number
  ) {
    const roundTextureKey = `${textureKey}_round_${size}`;

    if (!this.textures.exists(roundTextureKey)) {
      this.createRoundAvatarTexture(textureKey, roundTextureKey, size);
    }

    const avatar = this.add.image(x, y, roundTextureKey)
      .setDisplaySize(size, size)
      .setDepth(depth + 3);

    const border = this.add.circle(x, y, size / 2 + 5, 0x000000, 0)
      .setStrokeStyle(3, borderColor, 0.92)
      .setDepth(depth + 4);

    const inner = this.add.circle(x, y, size / 2 + 1, 0x000000, 0)
      .setStrokeStyle(1, PROFILE.black, 0.9)
      .setDepth(depth + 5);

    const shade = this.add.circle(x, y + size * 0.18, size * 0.28, 0x000000, 0.1)
      .setDepth(depth + 6);

    container.add([avatar, border, inner, shade]);
  }

  private createRoundAvatarTexture(sourceTextureKey: string, targetTextureKey: string, size: number) {
    const sourceImage = this.textures.get(sourceTextureKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvasTexture = this.textures.createCanvas(targetTextureKey, size, size);

    if (!canvasTexture) {
      return;
    }

    const canvas = canvasTexture.getSourceImage() as HTMLCanvasElement;
    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const sourceWidth =
      sourceImage instanceof HTMLImageElement
        ? sourceImage.naturalWidth || sourceImage.width
        : sourceImage.width;
    const sourceHeight =
      sourceImage instanceof HTMLImageElement
        ? sourceImage.naturalHeight || sourceImage.height
        : sourceImage.height;

    const cropSize = Math.min(sourceWidth, sourceHeight);
    const cropX = Math.floor((sourceWidth - cropSize) / 2);
    const cropY = Math.floor((sourceHeight - cropSize) / 2);

    context.clearRect(0, 0, size, size);
    context.save();
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    context.drawImage(sourceImage, cropX, cropY, cropSize, cropSize, 0, 0, size, size);
    context.restore();

    canvasTexture.refresh();
  }

  private createAvatarFallback(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    size: number,
    depth: number,
    borderColor = PROFILE.bronze
  ) {
    const vkUser = getCachedVKUser() as { first_name?: string; last_name?: string } | null;
    const firstLetter = vkUser?.first_name?.[0] || player.name?.[0] || '?';

    this.addTo(container, this.add.circle(x, y + 6, size / 2 + 8, 0x000000, 0.42).setDepth(depth));
    this.addTo(container, this.add.circle(x, y, size / 2 + 5, borderColor, 0.9).setDepth(depth + 1));
    this.addTo(container, this.add.circle(x, y, size / 2 + 1, PROFILE.stoneSoft, 1).setDepth(depth + 2));
    this.addTo(
      container,
      this.add.text(x, y, firstLetter.toUpperCase(), {
        fontFamily: UI.font.title,
        fontSize: `${Math.floor(size * 0.4)}px`,
        color: '#d9c28b',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(depth + 3)
    );
  }

  private createExpBar(container: Phaser.GameObjects.Container, x: number, y: number, width: number) {
    const progress = Phaser.Math.Clamp(player.exp / Math.max(1, player.expToNextLevel), 0, 1);

    this.addTo(
      container,
      this.add.text(x - width / 2, y - 16, 'Опыт', {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: '#8f8a80',
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(x + width / 2, y - 16, `${player.exp}/${player.expToNextLevel}`, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: '#8f8a80',
        align: 'right',
        wordWrap: { width: width / 2 },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(8)
    );

    this.addTo(container, this.add.rectangle(x, y + 7, width, 12, 0x030303, 0.92).setDepth(6));
    this.addTo(
      container,
      this.add.rectangle(x - width / 2 + Math.max(2, width * progress) / 2, y + 7, Math.max(2, width * progress), 12, PROFILE.gold, 0.92).setDepth(7)
    );
    this.addTo(container, this.add.rectangle(x, y + 7, width, 12).setStrokeStyle(1, PROFILE.bronze, 0.55).setDepth(8));
  }

  private createLongBar(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    progress: number,
    color: number
  ) {
    const clamped = Phaser.Math.Clamp(progress, 0, 1);
    const labelWidth = 108;
    const barWidth = width - labelWidth - 12;
    const left = x - width / 2;

    this.addTo(container, this.add.text(left, y - 1, label, {
      fontFamily: UI.font.title,
      fontSize: '15px',
      color: '#d0d0ca',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: labelWidth },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8));

    const barX = left + labelWidth + barWidth / 2;
    this.addTo(container, this.add.rectangle(barX, y, barWidth, 13, 0x030303, 0.92).setDepth(6));
    this.addTo(container, this.add.rectangle(barX - barWidth / 2 + Math.max(2, barWidth * clamped) / 2, y, Math.max(2, barWidth * clamped), 13, color, 0.92).setDepth(7));
    this.addTo(container, this.add.rectangle(barX, y, barWidth, 13).setStrokeStyle(1, PROFILE.bronze, 0.55).setDepth(8));

    this.addTo(container, this.add.text(barX + barWidth / 2 - 4, y - 18, value, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8f8a80',
      align: 'right',
      wordWrap: { width: barWidth - 10 },
      maxLines: 1,
    }).setOrigin(1, 0.5).setDepth(8));
  }

  private createSectionTitle(container: Phaser.GameObjects.Container, x: number, y: number, title: string, subtitle: string, width: number) {
    this.addTo(
      container,
      this.add.text(x, y - 7, title, {
        fontFamily: UI.font.title,
        fontSize: '24px',
        color: '#d9c28b',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(x, y + 22, subtitle, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: '#77736b',
        align: 'center',
        wordWrap: {
          width,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );
  }

  private createResourceChip(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    icon: string,
    value: string,
    label: string,
    color: number
  ) {
    this.createStonePanel({
      parent: container,
      x,
      y,
      width,
      height: 42,
      radius: 16,
      fill: PROFILE.stoneSoft,
      alpha: 0.92,
      stroke: color,
      strokeAlpha: 0.28,
      strokeWidth: 1,
      depth: 5,
    });

    const left = x - width / 2;
    this.addTo(container, this.add.text(left + 22, y - 1, icon, {
      fontFamily: UI.font.body,
      fontSize: '14px',
      color: '#d9c28b',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 40, y - 8, value, {
      fontFamily: UI.font.title,
      fontSize: '14px',
      color: '#d0d0ca',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: width - 46 },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 40, y + 10, label, {
      fontFamily: UI.font.body,
      fontSize: '9px',
      color: '#77736b',
      wordWrap: { width: width - 46 },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8));
  }

  private createStatTile(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    icon: string,
    color: number
  ) {
    this.createStonePanel({
      parent: container,
      x,
      y,
      width,
      height,
      radius: 17,
      fill: PROFILE.stoneSoft,
      alpha: 0.95,
      stroke: color,
      strokeAlpha: 0.32,
      strokeWidth: 1,
      depth: 5,
    });

    const left = x - width / 2;
    this.addTo(container, this.add.circle(left + 28, y, 17, color, 0.16).setStrokeStyle(1, color, 0.5).setDepth(7));
    this.addTo(container, this.add.text(left + 28, y, icon, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: '#d0d0ca',
    }).setOrigin(0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 54, y - 10, label, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#8f8a80',
      wordWrap: { width: width - 66, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 54, y + 11, value, {
      fontFamily: UI.font.title,
      fontSize: '16px',
      color: '#d0d0ca',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: width - 66, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8));
  }

  private createAbilityCard(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    title: string,
    description: string,
    icon: string,
    color: number
  ) {
    this.createStonePanel({
      parent: container,
      x,
      y,
      width,
      height,
      radius: 22,
      fill: PROFILE.stoneSoft,
      alpha: 0.96,
      stroke: color,
      strokeAlpha: 0.38,
      strokeWidth: 1,
      depth: 5,
    });

    const left = x - width / 2;
    const top = y - height / 2;

    this.addTo(container, this.add.circle(left + 32, top + 34, 19, color, 0.16).setStrokeStyle(1, color, 0.58).setDepth(7));
    this.addTo(container, this.add.text(left + 32, top + 34, icon, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: '#d9c28b',
    }).setOrigin(0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 60, top + 20, label, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: '#77736b',
      wordWrap: { width: width - 84, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 60, top + 46, title, {
      fontFamily: UI.font.title,
      fontSize: '15px',
      color: '#d9c28b',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: { width: width - 84, useAdvancedWrap: true },
      maxLines: 2,
      lineSpacing: -2,
    }).setOrigin(0, 0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 22, top + 82, description, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#b8b2a8',
      lineSpacing: 4,
      wordWrap: { width: width - 44, useAdvancedWrap: true },
      maxLines: 5,
    }).setOrigin(0, 0).setDepth(8));
  }

  private createProgressMiniCard(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    icon: string
  ) {
    this.createStonePanel({
      parent: container,
      x,
      y,
      width,
      height: 60,
      radius: 18,
      fill: PROFILE.stoneSoft,
      alpha: 0.94,
      stroke: PROFILE.bronze,
      strokeAlpha: 0.34,
      strokeWidth: 1,
      depth: 5,
    });

    const left = x - width / 2;

    this.addTo(container, this.add.text(left + 25, y, icon, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: '#d9c28b',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 46, y - 11, label, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: '#77736b',
      wordWrap: { width: width - 52, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 46, y + 12, value, {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: '#d9c28b',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: width - 52, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8));
  }

  private createRelicCard(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    name: string,
    description: string
  ) {
    this.createStonePanel({
      parent: container,
      x,
      y,
      width,
      height: 60,
      radius: 18,
      fill: PROFILE.stoneSoft,
      alpha: 0.96,
      stroke: PROFILE.violet,
      strokeAlpha: 0.34,
      strokeWidth: 1,
      depth: 5,
    });

    const left = x - width / 2;

    this.addTo(container, this.add.circle(left + 28, y, 18, PROFILE.violet, 0.18).setStrokeStyle(1, PROFILE.violet, 0.5).setDepth(7));
    this.addTo(container, this.add.text(left + 28, y, '★', {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: '#d9c28b',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 56, y - 12, name, {
      fontFamily: UI.font.title,
      fontSize: '14px',
      color: '#d9c28b',
      stroke: '#000000',
      strokeThickness: 2,
      wordWrap: { width: width - 82, useAdvancedWrap: true },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(8));

    this.addTo(container, this.add.text(left + 56, y + 13, description, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: '#8f8a80',
      wordWrap: { width: width - 82, useAdvancedWrap: true },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0, 0.5).setDepth(8));
  }

  private createStonePanel(config: StonePanelConfig) {
    const radius = config.radius ?? 24;
    const fill = config.fill ?? PROFILE.stone;
    const alpha = config.alpha ?? 0.94;
    const stroke = config.stroke ?? PROFILE.bronzeDark;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const depth = config.depth ?? 1;

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(config.x - safeWidth / 2, config.y - safeHeight / 2 + 7, safeWidth, safeHeight, radius);
    shadow.setDepth(depth);

    const panel = this.add.graphics();
    panel.fillStyle(fill, alpha);
    panel.fillRoundedRect(config.x - safeWidth / 2, config.y - safeHeight / 2, safeWidth, safeHeight, radius);
    panel.lineStyle(strokeWidth, stroke, strokeAlpha);
    panel.strokeRoundedRect(config.x - safeWidth / 2, config.y - safeHeight / 2, safeWidth, safeHeight, radius);
    panel.setDepth(depth + 1);

    const topLine = this.add.graphics();
    topLine.lineStyle(1, PROFILE.goldSoft, 0.08);
    topLine.beginPath();
    topLine.moveTo(config.x - safeWidth / 2 + radius, config.y - safeHeight / 2 + 8);
    topLine.lineTo(config.x + safeWidth / 2 - radius, config.y - safeHeight / 2 + 8);
    topLine.strokePath();
    topLine.setDepth(depth + 2);

    if (config.parent) {
      config.parent.add([shadow, panel, topLine]);
    }

    return { shadow, panel, topLine };
  }

  private requireContentContainer() {
    if (!this.contentContainer) {
      throw new Error('Profile content container was not created.');
    }

    return this.contentContainer;
  }

  private addTo<T extends Phaser.GameObjects.GameObject>(container: Phaser.GameObjects.Container, object: T) {
    container.add(object);
    return object;
  }

  private getHeroDisplayName() {
    const vkUser = getCachedVKUser();
    const vkFirstName = vkUser?.first_name?.trim() ?? '';
    const vkLastName = vkUser?.last_name?.trim() ?? '';

    if (vkFirstName.length > 0) {
      return vkLastName.length > 0 ? `${vkFirstName} ${vkLastName}` : vkFirstName;
    }

    const savedName = player.name?.trim() ?? '';

    if (savedName.length > 0 && savedName !== 'Безымянный') {
      return savedName;
    }

    return 'локальный режим';
  }

  private getRaceRole(id: string) {
    if (id === 'human') return 'Универсал / адаптация';
    if (id === 'tainted_halfblood') return 'Риск / крит / скверна';
    if (id === 'stoneborn') return 'Танк / каменная стойкость';
    if (id === 'night_elf') return 'Уклонение / темп';
    if (id === 'goblin') return 'Лут / золото / хитрость';
    if (id === 'demon') return 'Урон / жертва HP';

    return 'Боец катакомб';
  }

  private getRaceColor(id: string) {
    if (id === 'human') return PROFILE.gold;
    if (id === 'tainted_halfblood') return PROFILE.violet;
    if (id === 'stoneborn') return 0x9a9a95;
    if (id === 'night_elf') return PROFILE.blue;
    if (id === 'goblin') return PROFILE.greenMuted;
    if (id === 'demon') return PROFILE.redSoft;

    return PROFILE.bronze;
  }

  private getRaceColorText(id: string) {
    if (id === 'human') return '#d9c28b';
    if (id === 'tainted_halfblood') return '#9d82bd';
    if (id === 'stoneborn') return '#b6b6b0';
    if (id === 'night_elf') return '#8aa9c5';
    if (id === 'goblin') return '#91a884';
    if (id === 'demon') return '#c05a4b';

    return '#8f8a80';
  }
}
