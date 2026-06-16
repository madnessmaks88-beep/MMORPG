import Phaser from 'phaser';

import { player } from '../data/player';
import { saveGameAsync } from '../systems/SaveSystem';

import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type BranchId =
  | 'hp'
  | 'energy'
  | 'attack'
  | 'defense'
  | 'crit'
  | 'agility'
  | 'luck'
  | 'intelligence';

type TreePlayer = typeof player & {
  characterTreePoints?: number;
  characterTree?: Partial<Record<BranchId, number>>;
};

type StageData = {
  level: number;
  cost: number;
  title: string;
  description: string;
  special?: boolean;
};

type BranchData = {
  id: BranchId;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: number;
  maxLevel: number;
  locked?: boolean;
  normalText: string;
  stages: StageData[];
};

type FreeTreeLayout = {
  width: number;
  height: number;
  centerX: number;

  safeX: number;
  safeTop: number;
  safeBottom: number;

  headerHeight: number;
  bottomBarHeight: number;

  contentTop: number;
  contentBottom: number;
  contentWidth: number;
  viewportHeight: number;

  compact: boolean;
};

type TreeButton = {
  shadow: Phaser.GameObjects.Graphics;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
};

type NodePoint = {
  stage: StageData;
  x: number;
  y: number;
};

const TREE_STYLE = {
  black: 0x030304,
  void: 0x060607,
  graphite: 0x0b0c10,
  stone: 0x101116,
  stoneSoft: 0x171821,
  warmStone: 0x17100c,
  soot: 0x0a0706,
  bronze: 0x5e4630,
  bronzeDark: 0x3d2c1d,
  gold: 0xb89a5e,
  goldSoft: 0xd8c088,
  ash: 0x8d877b,
  blood: 0x8d2f2f,
  cold: 0x5f7f9d,
  violet: 0x62518a,
  green: 0x75a982,
};

const BRANCHES: BranchData[] = [
  {
    id: 'hp',
    title: 'Живучесть',
    subtitle: 'HP и выживание',
    icon: '♥',
    accentColor: 0xff6b6b,
    maxLevel: 20,
    normalText: '+10 к максимальному HP за каждый обычный этап.',
    stages: createMilestoneStages({
      maxLevel: 20,
      normalCost: 1,
      specialCost: 2,
      normalTitle: 'Запас здоровья',
      normalDescription: '+10 к максимальному HP.',
      milestones: {
        5: {
          title: 'Крепкое тело',
          description: '+30 дополнительного HP.',
        },
        10: {
          title: 'Последний вдох',
          description: 'Если HP падает ниже 20%, один раз за бой восстанавливается 8% максимального HP.',
        },
        15: {
          title: 'Упрямство',
          description: 'Получаемый периодический урон снижен на 25%.',
        },
        20: {
          title: 'Несломленный',
          description: 'Один раз за бой герой не умирает от смертельного удара, а остаётся с 1 HP.',
        },
      },
    }),
  },
  {
    id: 'energy',
    title: 'Выносливость',
    subtitle: 'Энергия и темп боя',
    icon: '✦',
    accentColor: 0x70a6ff,
    maxLevel: 6,
    normalText: 'Короткая дорогая ветка: каждый этап стоит 3 очка и даёт сильный бонус к энергии или темпу боя.',
    stages: [
      { level: 1, cost: 3, title: 'Запас энергии I', description: '+1 максимальная энергия.' },
      { level: 2, cost: 3, title: 'Второе дыхание', description: 'При убийстве врага восстанавливается 1 энергия.', special: true },
      { level: 3, cost: 3, title: 'Запас энергии II', description: '+1 максимальная энергия.' },
      { level: 4, cost: 3, title: 'Боевой старт', description: 'В начале боя герой получает +1 энергию.', special: true },
      { level: 5, cost: 3, title: 'Запас энергии III', description: '+1 максимальная энергия.' },
      { level: 6, cost: 3, title: 'Полный ритм', description: 'Если энергия полная, следующий навык наносит на 10% больше урона.', special: true },
    ],
  },
  {
    id: 'attack',
    title: 'Урон',
    subtitle: 'Атака и добивание',
    icon: '⚔',
    accentColor: 0xf0d58a,
    maxLevel: 20,
    normalText: '+3 к атаке за каждый обычный этап.',
    stages: createMilestoneStages({
      maxLevel: 20,
      normalCost: 1,
      specialCost: 2,
      normalTitle: 'Сила удара',
      normalDescription: '+3 к атаке.',
      milestones: {
        5: {
          title: 'Точный замах',
          description: 'Базовая атака наносит +5% урона.',
        },
        10: {
          title: 'Пробивающий удар',
          description: 'Атаки игнорируют 10% защиты врага.',
        },
        15: {
          title: 'Добивание',
          description: 'Если у врага меньше 30% HP, герой наносит ему +12% урона.',
        },
        20: {
          title: 'Казнь',
          description: 'Первый удар по врагу в бою наносит +25% урона.',
        },
      },
    }),
  },
  {
    id: 'defense',
    title: 'Броня',
    subtitle: 'Снижение урона',
    icon: '▣',
    accentColor: 0x9ca3af,
    maxLevel: 20,
    normalText: '+3 к защите за каждый обычный этап.',
    stages: createMilestoneStages({
      maxLevel: 20,
      normalCost: 1,
      specialCost: 2,
      normalTitle: 'Укрепление брони',
      normalDescription: '+3 к защите.',
      milestones: {
        5: {
          title: 'Толстая броня',
          description: 'Получаемый урон снижен на 3%.',
        },
        10: {
          title: 'Стойкость',
          description: 'После действия “Защита” следующий удар врага дополнительно ослабляется на 10%.',
        },
        15: {
          title: 'Каменная стойка',
          description: 'Первый полученный удар в бою всегда наносит на 40% меньше урона.',
        },
        20: {
          title: 'Глухой блок',
          description: 'Есть 12% шанс уменьшить входящий урон вдвое.',
        },
      },
    }),
  },
  {
    id: 'crit',
    title: 'Смертельная точность',
    subtitle: 'Крит и кровотечение',
    icon: '◆',
    accentColor: 0xc084fc,
    maxLevel: 6,
    normalText: 'Короткая дорогая ветка: каждый этап стоит 3 очка и усиливает критический стиль боя.',
    stages: [
      { level: 1, cost: 3, title: 'Точная рука I', description: '+1% к шансу критического удара.' },
      { level: 2, cost: 3, title: 'Острый глаз', description: 'Критический удар наносит не x1.5, а x1.6 урона.', special: true },
      { level: 3, cost: 3, title: 'Точная рука II', description: '+1% к шансу критического удара.' },
      { level: 4, cost: 3, title: 'Рваная рана', description: 'Критический удар с шансом 25% накладывает кровотечение на 2 хода.', special: true },
      { level: 5, cost: 3, title: 'Точная рука III', description: '+1% к шансу критического удара.' },
      { level: 6, cost: 3, title: 'Серия ударов', description: 'После крита следующий удар получает +17% урона.', special: true },
    ],
  },
  {
    id: 'agility',
    title: 'Реакция',
    subtitle: 'Ловкость и уклонение',
    icon: '➤',
    accentColor: 0x75d184,
    maxLevel: 6,
    normalText: 'Короткая дорогая ветка: каждый этап стоит 3 очка и усиливает уклонение, ловушки и темп боя.',
    stages: [
      { level: 1, cost: 3, title: 'Реакция I', description: '+1% к ловкости/уклонению.' },
      { level: 2, cost: 3, title: 'Чутьё ловушек', description: 'Шанс уклониться от ловушки увеличен на 10%.', special: true },
      { level: 3, cost: 3, title: 'Реакция II', description: '+1% к ловкости/уклонению.' },
      { level: 4, cost: 3, title: 'Лёгкий шаг', description: 'После успешного уклонения герой восстанавливает 1 энергию.', special: true },
      { level: 5, cost: 3, title: 'Реакция III', description: '+1% к ловкости/уклонению.' },
      { level: 6, cost: 3, title: 'Танец клинков', description: 'После двух успешных уклонений следующая атака гарантированно критует.', special: true },
    ],
  },
  {
    id: 'luck',
    title: 'Фортуна',
    subtitle: 'Золото, материалы и редкость',
    icon: '★',
    accentColor: 0xf0a040,
    maxLevel: 6,
    normalText: 'Короткая дорогая ветка: каждый этап стоит 3 очка и усиливает экономику, материалы и шанс редкой добычи.',
    stages: [
      { level: 1, cost: 3, title: 'Везение I', description: '+1 к удаче.' },
      { level: 2, cost: 3, title: 'Счастливая находка', description: '+10% к золоту из сундуков.', special: true },
      { level: 3, cost: 3, title: 'Везение II', description: '+1 к удаче.' },
      { level: 4, cost: 3, title: 'Охотник за трофеями', description: '+8% шанс получить дополнительный материал с врага.', special: true },
      { level: 5, cost: 3, title: 'Везение III', description: '+1 к удаче.' },
      { level: 6, cost: 3, title: 'Редкая добыча', description: 'Шанс выпадения высоко редких предметов увеличен на 5%.', special: true },
    ],
  },
  {
    id: 'intelligence',
    title: 'Знание',
    subtitle: 'В разработке',
    icon: '✧',
    accentColor: 0x70a6ff,
    maxLevel: 0,
    locked: true,
    normalText: 'Ветка интеллекта пока в процессе. Здесь будут усиления расовых навыков, энергии и слабостей врагов.',
    stages: [],
  },
];

function createMilestoneStages(config: {
  maxLevel: number;
  normalCost: number;
  specialCost: number;
  normalTitle: string;
  normalDescription: string;
  milestones: Record<number, {
    title: string;
    description: string;
  }>;
}) {
  const stages: StageData[] = [];

  for (let level = 1; level <= config.maxLevel; level += 1) {
    const milestone = config.milestones[level];

    stages.push({
      level,
      cost: milestone ? config.specialCost : config.normalCost,
      title: milestone?.title ?? config.normalTitle,
      description: milestone?.description ?? config.normalDescription,
      special: Boolean(milestone),
    });
  }

  return stages;
}

export class StatsTreeScene extends Phaser.Scene {
  private contentContainer?: Phaser.GameObjects.Container;
  private contentMaskGraphics?: Phaser.GameObjects.Graphics;
  private modalObjects: Phaser.GameObjects.GameObject[] = [];

  private currentScrollY = 0;
  private targetScrollY = 0;
  private maxScrollY = 0;

  private isDragging = false;
  private didDrag = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  constructor() {
    super('StatsTreeScene');
  }

  create() {
    this.ensureTreeState();

    const layout = this.getLayout();

    createSceneBackground(this);
    this.createBackdrop(layout);
    this.createHeader(layout);
    this.createScrollableContent(layout);
    this.createBottomButton(layout);
  }

  update() {
    if (!this.contentContainer || this.isDragging) {
      return;
    }

    if (Math.abs(this.currentScrollY - this.targetScrollY) < 0.5) {
      this.currentScrollY = this.targetScrollY;
    } else {
      this.currentScrollY = Phaser.Math.Linear(this.currentScrollY, this.targetScrollY, 0.18);
    }

    this.contentContainer.y = -this.currentScrollY;
  }

  private getLayout(): FreeTreeLayout {
    const { width, height } = this.scale;

    const compact = height < 1120;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.024), 18, 34);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.026), 24, 38);
    const bottomBarHeight = compact ? 104 : 112;
    const headerHeight = compact ? 132 : 146;
    const contentWidth = Math.min(width - safeX * 2, 640);

    const contentTop = safeTop + headerHeight + 12;
    const contentBottom = height - safeBottom - bottomBarHeight;

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      headerHeight,
      bottomBarHeight,

      contentTop,
      contentBottom,
      contentWidth,
      viewportHeight: Math.max(320, contentBottom - contentTop),

      compact,
    };
  }

  private createBackdrop(layout: FreeTreeLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, TREE_STYLE.black, 0.96).setDepth(0);
    this.add.rectangle(centerX, height - 190, width, 380, 0x020202, 0.58).setDepth(0);

    this.add.circle(centerX, layout.safeTop + 150, width * 0.52, TREE_STYLE.violet, 0.11).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 162, width * 0.34, TREE_STYLE.bronze, 0.07).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 176, width * 0.16, TREE_STYLE.gold, 0.035).setDepth(0);

    const trunkX = centerX;
    const trunkTop = layout.contentTop - 24;
    const trunkBottom = layout.contentBottom + 16;

    this.add.line(0, 0, trunkX, trunkTop, trunkX, trunkBottom, TREE_STYLE.bronze, 0.16)
      .setLineWidth(3)
      .setDepth(1);

    for (let index = 0; index < 18; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const y = trunkTop + 38 + index * 44;
      const length = Phaser.Math.Clamp(width * 0.16 + (index % 4) * 15, 82, 160);

      this.add.line(
        0,
        0,
        trunkX,
        y,
        trunkX + side * length,
        y + 16 + (index % 3) * 7,
        TREE_STYLE.bronze,
        0.07
      )
        .setLineWidth(2)
        .setDepth(1);
    }

    for (let i = 0; i < 42; i += 1) {
      const x = Phaser.Math.Between(layout.safeX + 10, width - layout.safeX - 10);
      const y = Phaser.Math.Between(layout.safeTop + 74, height - layout.safeBottom - 96);
      const color = i % 5 === 0 ? TREE_STYLE.gold : i % 3 === 0 ? TREE_STYLE.violet : TREE_STYLE.ash;
      const alpha = i % 5 === 0 ? 0.034 : 0.02;

      this.add.circle(x, y, 1 + (i % 3), color, alpha).setDepth(1);
    }

    this.add.text(centerX, layout.safeTop + 152, '✦', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '82px' : '98px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.024).setDepth(1);
  }

  private createHeader(layout: FreeTreeLayout) {
    const panelY = layout.safeTop + layout.headerHeight / 2;

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: layout.headerHeight,
      radius: 32,
      color: TREE_STYLE.graphite,
      alpha: 0.95,
      strokeColor: TREE_STYLE.bronze,
      strokeAlpha: 0.62,
      strokeWidth: 2,
      glowColor: TREE_STYLE.violet,
      depth: 100,
    });

    this.add.text(layout.centerX, panelY - (layout.compact ? 48 : 54), 'Свободное развитие', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '29px' : '34px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 52,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(106);

    this.createPointChip(layout.centerX, panelY - 8, layout.contentWidth - 52);

    this.add.text(
      layout.centerX,
      panelY + (layout.compact ? 36 : 42),
      'Выбирай узлы в ветках. Особые печати открываются на ключевых этапах и стоят дороже.',
      {
        fontFamily: UI.font.body,
        fontSize: layout.compact ? '12px' : '13px',
        color: '#9b9488',
        align: 'center',
        lineSpacing: 3,
        wordWrap: {
          width: layout.contentWidth - 72,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }
    ).setOrigin(0.5).setDepth(106);
  }

  private createPointChip(x: number, y: number, maxWidth: number) {
    const points = this.getTreePoints();
    const width = Math.min(maxWidth, 360);
    const canSpend = points > 0;

    this.createRoundedPanel({
      x,
      y,
      width,
      height: 40,
      radius: 19,
      color: canSpend ? 0x0f1510 : 0x11100e,
      alpha: 0.96,
      strokeColor: canSpend ? TREE_STYLE.green : TREE_STYLE.bronze,
      strokeAlpha: canSpend ? 0.72 : 0.42,
      strokeWidth: 1,
      glowColor: canSpend ? TREE_STYLE.green : TREE_STYLE.gold,
      depth: 103,
    });

    this.add.text(x, y, `Свободные очки: ${points}`, {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: canSpend ? '#9fd0a6' : '#b8aa91',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: width - 30,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(107);
  }

  private createScrollableContent(layout: FreeTreeLayout) {
    this.contentContainer?.destroy(true);
    this.contentMaskGraphics?.destroy();

    this.contentContainer = this.add.container(0, 0).setDepth(5);

    this.contentMaskGraphics = this.add.graphics();
    this.contentMaskGraphics.setVisible(false);
    this.contentMaskGraphics.fillStyle(0xffffff, 1);
    this.contentMaskGraphics.fillRect(
      layout.safeX,
      layout.contentTop,
      layout.width - layout.safeX * 2,
      layout.viewportHeight
    );

    const mask = this.contentMaskGraphics.createGeometryMask();
    this.contentContainer.setMask(mask);

    let cursorY = layout.contentTop + 16;

    cursorY = this.createIntroPanel(layout, cursorY);

    BRANCHES.forEach(branch => {
      const cardHeight = this.getBranchCardHeight(layout, branch);
      this.createBranchCard(layout, branch, cursorY + cardHeight / 2, cardHeight);
      cursorY += cardHeight + (layout.compact ? 14 : 16);
    });

    cursorY = this.createAdvicePanel(layout, cursorY + 2);

    const contentHeight = cursorY - layout.contentTop + 26;

    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScrollY);
    this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY, 0, this.maxScrollY);

    this.contentContainer.y = -this.currentScrollY;

    this.createScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }
  }

  private getBranchCardHeight(layout: FreeTreeLayout, branch: BranchData) {
    if (branch.locked) {
      return layout.compact ? 214 : 226;
    }

    // Карточки стали выше, чтобы блок описания следующего узла
    // не перекрывался большой кнопкой “Изучить узел”.
    if (branch.maxLevel > 10) {
      return layout.compact ? 470 : 500;
    }

    return layout.compact ? 430 : 460;
  }

  private createIntroPanel(layout: FreeTreeLayout, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = layout.compact ? 112 : 124;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: TREE_STYLE.warmStone,
      alpha: 0.92,
      strokeColor: TREE_STYLE.bronze,
      strokeAlpha: 0.44,
      strokeWidth: 2,
      glowColor: TREE_STYLE.gold,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 32, 'Ветки силы', {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '22px' : '24px',
        color: '#d8c088',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 64,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(
        layout.centerX,
        topY + 78,
        'Каждая ветка — это цепь печатей. Обычные узлы дают стабильные характеристики, крупные печати меняют стиль боя.',
        {
          fontFamily: UI.font.body,
          fontSize: layout.compact ? '12px' : '13px',
          color: '#b8aa91',
          align: 'center',
          lineSpacing: 4,
          wordWrap: {
            width: layout.contentWidth - 64,
            useAdvancedWrap: true,
          },
          maxLines: 3,
        }
      ).setOrigin(0.5).setDepth(8)
    );

    return topY + panelHeight;
  }

  private createBranchCard(layout: FreeTreeLayout, branch: BranchData, y: number, height: number) {
    const container = this.requireContentContainer();

    const level = this.getBranchLevel(branch.id);
    const nextStage = branch.stages[level];
    const isLocked = branch.locked ?? false;
    const isMaxed = branch.maxLevel > 0 && level >= branch.maxLevel;
    const cost = nextStage?.cost ?? 0;
    const canUpgrade = !isLocked && !isMaxed && this.getTreePoints() >= cost;

    const width = layout.contentWidth;
    const left = layout.centerX - width / 2;
    const right = layout.centerX + width / 2;
    const top = y - height / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y,
      width,
      height,
      radius: 32,
      color: isLocked ? TREE_STYLE.graphite : TREE_STYLE.soot,
      alpha: 0.96,
      strokeColor: isLocked ? 0x4a3a27 : branch.accentColor,
      strokeAlpha: isLocked ? 0.34 : 0.66,
      strokeWidth: isLocked ? 1 : 2,
      glowColor: branch.accentColor,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.rectangle(left + 8, y, 5, height - 36, branch.accentColor, isLocked ? 0.2 : 0.72)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.circle(left + 52, top + 54, 32, branch.accentColor, isLocked ? 0.08 : 0.16)
        .setStrokeStyle(2, branch.accentColor, isLocked ? 0.26 : 0.72)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 52, top + 54, branch.icon, {
        fontFamily: UI.font.body,
        fontSize: '24px',
        color: isLocked ? '#77716a' : '#f1eadc',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(8)
    );

    const titleWidth = width - 208;

    this.addTo(
      container,
      this.add.text(left + 96, top + 34, branch.title, {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '20px' : '23px',
        color: isLocked ? '#8f806d' : '#d8c088',
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: titleWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(left + 96, top + 64, branch.subtitle, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: isLocked ? '#6f665b' : this.getAccentTextColor(branch.accentColor),
        wordWrap: {
          width: titleWidth,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.createLevelPill(container, right - 70, top + 52, branch, level, isLocked, isMaxed);

    if (isLocked) {
      this.createLockedBranchContent(container, layout, branch, top + 110, width - 54);
      return;
    }

    const treeTop = top + 100;
    const treeHeight = branch.maxLevel > 10
      ? layout.compact ? 158 : 176
      : layout.compact ? 130 : 146;

    this.createBranchTreeMap({
      parent: container,
      branch,
      level,
      x: left + 26,
      y: treeTop,
      width: width - 52,
      height: treeHeight,
      compact: layout.compact,
    });

    const infoY = treeTop + treeHeight + (layout.compact ? 58 : 64);

    this.createNextStageBox({
      parent: container,
      x: layout.centerX,
      y: infoY,
      width: width - 56,
      height: layout.compact ? 86 : 94,
      branch,
      nextStage,
      isMaxed,
      canUpgrade,
    });

    const buttonY = top + height - (layout.compact ? 42 : 44);
    const buttonWidth = Math.min(width - 56, 460);

    this.createTreeButton({
      parent: container,
      x: layout.centerX,
      y: buttonY,
      width: buttonWidth,
      height: 52,
      text: isMaxed
        ? 'Ветка изучена полностью'
        : canUpgrade
          ? `Изучить узел за ${cost}`
          : `Нужно ${cost} очк.`,
      disabled: isMaxed || !canUpgrade,
      accentColor: branch.accentColor,
      variant: isMaxed ? 'green' : canUpgrade ? 'gold' : 'dark',
      onClick: () => {
        this.showUpgradeConfirm(branch);
      },
      depth: 9,
    });
  }

  private createLevelPill(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    branch: BranchData,
    level: number,
    isLocked: boolean,
    isMaxed: boolean
  ) {
    const text = isLocked
      ? 'скоро'
      : isMaxed
        ? 'полностью'
        : `${level}/${branch.maxLevel}`;

    const width = isMaxed ? 104 : 86;
    const color = isLocked ? 0x12100d : isMaxed ? 0x0f1510 : 0x17100c;
    const stroke = isLocked ? 0x4a3a27 : isMaxed ? TREE_STYLE.green : branch.accentColor;

    this.createRoundedPanel({
      parent: container,
      x,
      y,
      width,
      height: 34,
      radius: 16,
      color,
      alpha: 0.96,
      strokeColor: stroke,
      strokeAlpha: isLocked ? 0.28 : 0.66,
      strokeWidth: 1,
      glowColor: stroke,
      depth: 7,
    });

    this.addTo(
      container,
      this.add.text(x, y, text, {
        fontFamily: UI.font.title,
        fontSize: isMaxed ? '12px' : '14px',
        color: isLocked ? '#6f665b' : isMaxed ? '#9fd0a6' : '#d8d0bf',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
        wordWrap: {
          width: width - 12,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(10)
    );
  }

  private createLockedBranchContent(
    container: Phaser.GameObjects.Container,
    layout: FreeTreeLayout,
    branch: BranchData,
    y: number,
    width: number
  ) {
    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: y + 46,
      width,
      height: 112,
      radius: 24,
      color: TREE_STYLE.graphite,
      alpha: 0.88,
      strokeColor: TREE_STYLE.bronzeDark,
      strokeAlpha: 0.42,
      strokeWidth: 1,
      glowColor: branch.accentColor,
      depth: 7,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, y + 22, 'Ветка запечатана', {
        fontFamily: UI.font.title,
        fontSize: '18px',
        color: '#8f806d',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: {
          width: width - 36,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(10)
    );

    this.addTo(
      container,
      this.add.text(layout.centerX, y + 68, branch.normalText, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: '#8f806d',
        align: 'center',
        lineSpacing: 4,
        wordWrap: {
          width: width - 48,
          useAdvancedWrap: true,
        },
        maxLines: 3,
      }).setOrigin(0.5).setDepth(10)
    );
  }

  private createBranchTreeMap(config: {
    parent: Phaser.GameObjects.Container;
    branch: BranchData;
    level: number;
    x: number;
    y: number;
    width: number;
    height: number;
    compact: boolean;
  }) {
    const { parent, branch, level, x, y, width, height, compact } = config;

    this.createRoundedPanel({
      parent,
      x: x + width / 2,
      y: y + height / 2,
      width,
      height,
      radius: 24,
      color: TREE_STYLE.graphite,
      alpha: 0.72,
      strokeColor: TREE_STYLE.bronzeDark,
      strokeAlpha: 0.28,
      strokeWidth: 1,
      glowColor: branch.accentColor,
      depth: 7,
    });

    this.addTo(
      parent,
      this.add.text(x + 18, y + 20, this.getBranchTreeLabel(branch, level), {
        fontFamily: UI.font.body,
        fontSize: compact ? '11px' : '12px',
        color: '#8f806d',
        wordWrap: {
          width: width - 36,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    const mapTop = y + 42;
    const mapHeight = height - 56;
    const points = this.getNodePoints(branch, x + 24, mapTop, width - 48, mapHeight);

    const lines = this.add.graphics();
    lines.setDepth(9);

    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const unlocked = level >= current.stage.level;

      lines.lineStyle(
        unlocked ? 4 : 2,
        unlocked ? branch.accentColor : TREE_STYLE.bronzeDark,
        unlocked ? 0.7 : 0.42
      );

      lines.beginPath();
      lines.moveTo(previous.x, previous.y);

      const midX = (previous.x + current.x) / 2;
      lines.lineTo(midX, previous.y);
      lines.lineTo(midX, current.y);
      lines.lineTo(current.x, current.y);
      lines.strokePath();
    }

    parent.add(lines);

    points.forEach(point => {
      this.createTreeNode(parent, branch, point, level);
    });
  }

  private getNodePoints(branch: BranchData, x: number, y: number, width: number, height: number): NodePoint[] {
    const stages = branch.maxLevel > 10
      ? branch.stages.filter(stage => stage.special)
      : branch.stages;

    if (stages.length === 0) {
      return [];
    }

    const count = stages.length;
    const stepX = count <= 1 ? 0 : width / (count - 1);
    const centerY = y + height / 2;

    return stages.map((stage, index) => {
      const wave = index % 3 === 0
        ? -height * 0.24
        : index % 3 === 1
          ? height * 0.18
          : -height * 0.03;

      return {
        stage,
        x: x + stepX * index,
        y: centerY + wave,
      };
    });
  }

  private createTreeNode(
    container: Phaser.GameObjects.Container,
    branch: BranchData,
    point: NodePoint,
    currentLevel: number
  ) {
    const unlocked = currentLevel >= point.stage.level;
    const next = currentLevel + 1 === point.stage.level;
    const completedPrevious = currentLevel >= point.stage.level - 1;
    const available = next && completedPrevious;
    const special = point.stage.special ?? false;

    const radius = special ? 21 : 17;
    const fill = unlocked
      ? branch.accentColor
      : next
        ? TREE_STYLE.warmStone
        : TREE_STYLE.stoneSoft;

    const stroke = special || next ? TREE_STYLE.gold : branch.accentColor;
    const alpha = unlocked ? 0.95 : next ? 0.92 : 0.72;

    this.addTo(
      container,
      this.add.circle(point.x, point.y, radius, fill, alpha)
        .setStrokeStyle(next ? 3 : 2, stroke, unlocked || next ? 0.9 : 0.42)
        .setDepth(11)
    );

    this.addTo(
      container,
      this.add.circle(point.x, point.y, radius + 7, stroke, next ? 0.08 : unlocked ? 0.045 : 0.018)
        .setDepth(10)
    );

    const iconText = unlocked
      ? '✓'
      : special
        ? '★'
        : `${point.stage.level}`;

    this.addTo(
      container,
      this.add.text(point.x, point.y, iconText, {
        fontFamily: UI.font.title,
        fontSize: special ? '13px' : '11px',
        color: unlocked ? '#ffffff' : next ? '#d8c088' : '#8f806d',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
        wordWrap: {
          width: radius * 2,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(12)
    );

    if (available) {
      const zone = this.add.zone(point.x, point.y, 54, 54)
        .setDepth(14)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerup', () => {
        if (this.didDrag) {
          return;
        }

        this.showUpgradeConfirm(branch);
      });

      container.add(zone);
    }

    this.addTo(
      container,
      this.add.text(point.x, point.y + radius + 12, `${point.stage.cost} очк.`, {
        fontFamily: UI.font.body,
        fontSize: '10px',
        color: unlocked ? '#9fd0a6' : next ? '#d8c088' : '#6f665b',
        align: 'center',
        wordWrap: {
          width: 58,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(12)
    );
  }

  private createNextStageBox(config: {
    parent: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    branch: BranchData;
    nextStage?: StageData;
    isMaxed: boolean;
    canUpgrade: boolean;
  }) {
    const {
      parent,
      x,
      y,
      width,
      height,
      branch,
      nextStage,
      isMaxed,
      canUpgrade,
    } = config;

    const title = isMaxed
      ? 'Ветка полностью изучена'
      : nextStage
        ? `${nextStage.special ? 'Особая печать' : 'Следующий узел'}: ${nextStage.title}`
        : 'Узел недоступен';

    const description = isMaxed
      ? 'Все доступные этапы этой ветки уже открыты.'
      : nextStage?.description ?? branch.normalText;

    const costText = isMaxed
      ? 'MAX'
      : nextStage
        ? `${nextStage.cost} очк.`
        : '—';

    this.createRoundedPanel({
      parent,
      x,
      y,
      width,
      height,
      radius: 22,
      color: isMaxed ? 0x0f1510 : 0x12100d,
      alpha: 0.92,
      strokeColor: isMaxed ? TREE_STYLE.green : canUpgrade ? branch.accentColor : TREE_STYLE.bronzeDark,
      strokeAlpha: isMaxed ? 0.58 : canUpgrade ? 0.58 : 0.38,
      strokeWidth: 1,
      glowColor: branch.accentColor,
      depth: 7,
    });

    const left = x - width / 2;
    const right = x + width / 2;

    this.addTo(
      parent,
      this.add.text(left + 18, y - height / 2 + 18, title, {
        fontFamily: UI.font.title,
        fontSize: '14px',
        color: isMaxed ? '#9fd0a6' : '#d8c088',
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: width - 112,
          useAdvancedWrap: true,
        },
        maxLines: 2,
        lineSpacing: 1,
      }).setOrigin(0, 0).setDepth(10)
    );

    this.addTo(
      parent,
      this.add.text(right - 18, y - height / 2 + 22, costText, {
        fontFamily: UI.font.title,
        fontSize: '13px',
        color: isMaxed ? '#9fd0a6' : canUpgrade ? '#d8c088' : '#8f806d',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'right',
        wordWrap: {
          width: 76,
        },
        maxLines: 1,
      }).setOrigin(1, 0).setDepth(10)
    );

    this.addTo(
      parent,
      this.add.text(left + 18, y - height / 2 + 52, description, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: '#b8aa91',
        lineSpacing: 4,
        wordWrap: {
          width: width - 36,
          useAdvancedWrap: true,
        },
        maxLines: 3,
      }).setOrigin(0, 0).setDepth(10)
    );
  }

  private createAdvicePanel(layout: FreeTreeLayout, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = 120;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: TREE_STYLE.graphite,
      alpha: 0.92,
      strokeColor: TREE_STYLE.bronze,
      strokeAlpha: 0.38,
      strokeWidth: 1,
      glowColor: TREE_STYLE.violet,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 30, 'Совет по развитию', {
        fontFamily: UI.font.title,
        fontSize: '21px',
        color: '#d8c088',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 58,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(
        layout.centerX,
        topY + 78,
        'Сначала открой 1–2 ветки под роль героя. Длинные ветки дают стабильный рост, короткие — дорогие сильные эффекты.',
        {
          fontFamily: UI.font.body,
          fontSize: '13px',
          color: '#9b9488',
          align: 'center',
          lineSpacing: 4,
          wordWrap: {
            width: layout.contentWidth - 64,
            useAdvancedWrap: true,
          },
          maxLines: 3,
        }
      ).setOrigin(0.5).setDepth(8)
    );

    return topY + panelHeight;
  }

  private createScrollInput(layout: FreeTreeLayout) {
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.input.off('pointerupoutside');
    this.input.off('wheel');

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isPointerInsideContent(pointer, layout) || this.maxScrollY <= 0) {
        return;
      }

      this.isDragging = true;
      this.didDrag = false;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.targetScrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) {
        return;
      }

      const deltaY = pointer.y - this.dragStartY;

      if (Math.abs(deltaY) > 8) {
        this.didDrag = true;
      }

      this.targetScrollY = Phaser.Math.Clamp(
        this.dragStartScrollY - deltaY,
        0,
        this.maxScrollY
      );

      this.currentScrollY = this.targetScrollY;

      if (this.contentContainer) {
        this.contentContainer.y = -this.currentScrollY;
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
      this.time.delayedCall(0, () => {
        this.didDrag = false;
      });
    });

    this.input.on('pointerupoutside', () => {
      this.isDragging = false;
      this.time.delayedCall(0, () => {
        this.didDrag = false;
      });
    });

    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _objects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        if (!this.isPointerInsideContent(pointer, layout) || this.maxScrollY <= 0) {
          return;
        }

        this.targetScrollY = Phaser.Math.Clamp(
          this.targetScrollY + deltaY * 0.55,
          0,
          this.maxScrollY
        );
      }
    );
  }

  private isPointerInsideContent(pointer: Phaser.Input.Pointer, layout: FreeTreeLayout) {
    return (
      pointer.x >= layout.safeX &&
      pointer.x <= layout.width - layout.safeX &&
      pointer.y >= layout.contentTop &&
      pointer.y <= layout.contentBottom
    );
  }

  private createScrollHint(layout: FreeTreeLayout) {
    const hintY = layout.contentBottom - 18;

    const bg = this.add.rectangle(layout.centerX, hintY, 250, 28, 0x000000, 0.4)
      .setDepth(230);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай ветки', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8f806d',
      align: 'center',
      wordWrap: {
        width: 230,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(231);

    this.tweens.add({
      targets: [bg, text],
      alpha: 0.22,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private createBottomButton(layout: FreeTreeLayout) {
    const y = layout.height - layout.safeBottom - 32;

    this.add.rectangle(
      layout.centerX,
      layout.height - layout.safeBottom - layout.bottomBarHeight / 2 + 18,
      layout.width,
      layout.bottomBarHeight + layout.safeBottom,
      0x020202,
      0.74
    ).setDepth(236);

    this.add.rectangle(
      layout.centerX,
      y - 42,
      layout.contentWidth,
      1,
      TREE_STYLE.bronze,
      0.24
    ).setDepth(237);

    this.createTreeButton({
      x: layout.centerX,
      y,
      width: Math.min(layout.contentWidth, 540),
      height: 56,
      text: 'Вернуться в лагерь',
      accentColor: TREE_STYLE.gold,
      variant: 'gold',
      onClick: () => {
        this.scene.start('CampScene');
      },
      depth: 240,
    });
  }

  private showUpgradeConfirm(branch: BranchData) {
    if (this.didDrag) {
      return;
    }

    const level = this.getBranchLevel(branch.id);
    const nextStage = branch.stages[level];

    if (!nextStage || branch.locked || level >= branch.maxLevel) {
      return;
    }

    const enough = this.getTreePoints() >= nextStage.cost;

    if (!enough) {
      this.showMessage(
        'Недостаточно очков',
        `Для узла “${nextStage.title}” нужно ${nextStage.cost} очк. Свободно: ${this.getTreePoints()}.`
      );
      return;
    }

    const description = [
      `Ветка: ${branch.title}`,
      `Узел: ${nextStage.title}`,
      `Цена: ${nextStage.cost} очк.`,
      '',
      nextStage.description,
    ].join('\n');

    this.showModal({
      title: 'Изучить печать?',
      description,
      confirmText: `Изучить за ${nextStage.cost}`,
      confirmVariant: 'green',
      onConfirm: () => {
        this.upgradeBranch(branch.id);
      },
    });
  }

  private upgradeBranch(branchId: BranchId) {
    if (this.didDrag) {
      return;
    }

    const branch = BRANCHES.find(item => item.id === branchId);

    if (!branch || branch.locked) {
      return;
    }

    const state = this.ensureTreeState();
    const currentLevel = state.characterTree?.[branchId] ?? 0;
    const nextStage = branch.stages[currentLevel];

    if (!nextStage || currentLevel >= branch.maxLevel) {
      return;
    }

    if ((state.characterTreePoints ?? 0) < nextStage.cost) {
      return;
    }

    state.characterTreePoints = Math.max(0, (state.characterTreePoints ?? 0) - nextStage.cost);
    state.characterTree = {
      ...state.characterTree,
      [branchId]: currentLevel + 1,
    };

    void saveGameAsync();

    this.modalObjects.forEach(object => {
      object.destroy();
    });
    this.modalObjects = [];

    this.scene.restart();
  }

  private showMessage(title: string, message: string) {
    this.showModal({
      title,
      description: message,
      confirmText: 'Понятно',
      confirmVariant: 'gold',
      onConfirm: () => undefined,
    });
  }

  private showModal(config: {
    title: string;
    description: string;
    confirmText: string;
    confirmVariant: 'gold' | 'green' | 'red' | 'dark';
    onConfirm: () => void;
  }) {
    const { width, height } = this.scale;
    const modalWidth = Math.min(width - 52, 620);
    const modalHeight = Math.min(height - 170, 430);
    const centerX = width / 2;
    const centerY = height / 2;

    this.modalObjects.forEach(object => object.destroy());
    this.modalObjects = [];

    const overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.76)
      .setDepth(1000)
      .setInteractive();

    const panelParts = this.createRoundedPanel({
      x: centerX,
      y: centerY,
      width: modalWidth,
      height: modalHeight,
      radius: 32,
      color: TREE_STYLE.warmStone,
      alpha: 0.98,
      strokeColor: TREE_STYLE.bronze,
      strokeAlpha: 0.88,
      strokeWidth: 3,
      glowColor: TREE_STYLE.gold,
      depth: 1001,
    });

    const titleText = this.add.text(centerX, centerY - modalHeight / 2 + 48, config.title, {
      fontFamily: UI.font.title,
      fontSize: '26px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: modalWidth - 70,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(1005);

    const divider = this.add.rectangle(
      centerX,
      centerY - modalHeight / 2 + 88,
      modalWidth - 92,
      2,
      TREE_STYLE.gold,
      0.24
    ).setDepth(1005);

    const descriptionText = this.add.text(centerX, centerY - modalHeight / 2 + 116, config.description, {
      fontFamily: UI.font.body,
      fontSize: '16px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 6,
      wordWrap: {
        width: modalWidth - 86,
        useAdvancedWrap: true,
      },
      maxLines: 9,
    }).setOrigin(0.5, 0).setDepth(1005);

    const closeModal = () => {
      this.modalObjects.forEach(object => object.destroy());
      this.modalObjects = [];
    };

    const confirmButton = this.createTreeButton({
      x: centerX,
      y: centerY + modalHeight / 2 - 98,
      width: Math.min(modalWidth - 94, 390),
      height: 54,
      text: config.confirmText,
      accentColor: config.confirmVariant === 'green' ? TREE_STYLE.green : TREE_STYLE.gold,
      variant: config.confirmVariant,
      onClick: () => {
        closeModal();
        config.onConfirm();
      },
      depth: 1005,
    });

    const cancelButton = this.createTreeButton({
      x: centerX,
      y: centerY + modalHeight / 2 - 36,
      width: Math.min(modalWidth - 94, 390),
      height: 52,
      text: 'Отмена',
      accentColor: TREE_STYLE.bronze,
      variant: 'dark',
      onClick: () => {
        closeModal();
      },
      depth: 1005,
    });

    this.modalObjects.push(
      overlay,
      panelParts.shadow,
      panelParts.panel,
      panelParts.glow,
      titleText,
      divider,
      descriptionText,
      confirmButton.shadow,
      confirmButton.bg,
      confirmButton.label,
      confirmButton.zone,
      cancelButton.shadow,
      cancelButton.bg,
      cancelButton.label,
      cancelButton.zone
    );
  }

  private getBranchLevel(branchId: BranchId) {
    const state = this.ensureTreeState();

    return state.characterTree?.[branchId] ?? 0;
  }

  private getTreePoints() {
    const state = this.ensureTreeState();

    return state.characterTreePoints ?? 0;
  }

  private ensureTreeState() {
    const state = player as TreePlayer;

    if (typeof state.characterTreePoints !== 'number') {
      state.characterTreePoints = 0;
    }

    if (!state.characterTree) {
      state.characterTree = {};
    }

    return state;
  }

  private getBranchTreeLabel(branch: BranchData, level: number) {
    if (branch.maxLevel <= 0) {
      return 'Ветка закрыта';
    }

    if (level >= branch.maxLevel) {
      return 'Все печати ветки открыты';
    }

    const nextSpecial = branch.stages
      .filter(stage => stage.special && stage.level > level)
      .sort((a, b) => a.level - b.level)[0];

    if (nextSpecial) {
      return `Открыто ${level}/${branch.maxLevel} • ближайшая особая печать: ${nextSpecial.level} ур.`;
    }

    return `Открыто ${level}/${branch.maxLevel}`;
  }

  private createTreeButton(config: {
    parent?: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    accentColor: number;
    onClick: () => void;
    disabled?: boolean;
    depth?: number;
    variant?: 'gold' | 'green' | 'red' | 'dark';
  }): TreeButton {
    const disabled = config.disabled ?? false;
    const depth = config.depth ?? 8;
    const variant = config.variant ?? 'gold';
    const radius = Math.min(20, config.height / 2);

    const strokeColor = disabled
      ? 0x3c342c
      : variant === 'green'
        ? TREE_STYLE.green
        : variant === 'red'
          ? TREE_STYLE.blood
          : variant === 'dark'
            ? TREE_STYLE.bronze
            : config.accentColor;

    const fillColor = disabled
      ? 0x11100e
      : variant === 'green'
        ? 0x102016
        : variant === 'red'
          ? 0x241010
          : variant === 'dark'
            ? TREE_STYLE.graphite
            : 0x21150f;

    const hoverColor = variant === 'green'
      ? 0x183322
      : variant === 'red'
        ? 0x321515
        : 0x2c1d14;

    const textColor = disabled
      ? '#6f665b'
      : variant === 'green'
        ? '#9fd0a6'
        : variant === 'red'
          ? '#ff9a9a'
          : '#d8c088';

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 5,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(depth);

    const bg = this.add.graphics();

    const draw = (color: number, alpha: number, strokeAlpha: number) => {
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
    };

    draw(fillColor, disabled ? 0.55 : 0.96, disabled ? 0.35 : 0.82);
    bg.setDepth(depth + 1);

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.title,
      fontSize: '15px',
      color: textColor,
      stroke: '#000000',
      strokeThickness: disabled ? 1 : 3,
      align: 'center',
      wordWrap: {
        width: config.width - 26,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(depth + 2);

    const zone = this.add.zone(config.x, config.y, config.width, config.height).setDepth(depth + 3);

    if (config.parent) {
      config.parent.add([shadow, bg, label, zone]);
    }

    if (!disabled) {
      let isPressed = false;

      zone.setInteractive({ useHandCursor: true });

      zone.on('pointerover', () => {
        if (isPressed) {
          return;
        }

        draw(hoverColor, 1, 1);
        label.setColor('#ffffff');
      });

      zone.on('pointerout', () => {
        isPressed = false;
        draw(fillColor, 0.96, 0.82);
        label.setY(config.y);
        label.setColor(textColor);
      });

      zone.on('pointerdown', () => {
        isPressed = true;
        draw(hoverColor, 0.92, 0.95);
        label.setY(config.y + 1);
        label.setColor('#ffffff');
      });

      zone.on('pointerup', () => {
        if (!isPressed) {
          return;
        }

        isPressed = false;
        label.setY(config.y);

        if (this.didDrag) {
          draw(fillColor, 0.96, 0.82);
          label.setColor(textColor);
          return;
        }

        draw(hoverColor, 1, 1);
        label.setColor('#ffffff');

        this.time.delayedCall(40, () => {
          config.onClick();
        });
      });

      zone.on('pointerupoutside', () => {
        isPressed = false;
        draw(fillColor, 0.96, 0.82);
        label.setY(config.y);
        label.setColor(textColor);
      });

      zone.on('pointercancel', () => {
        isPressed = false;
        draw(fillColor, 0.96, 0.82);
        label.setY(config.y);
        label.setColor(textColor);
      });
    }

    return {
      shadow,
      bg,
      label,
      zone,
    };
  }

  private createRoundedPanel(config: {
    parent?: Phaser.GameObjects.Container;
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
    const radius = config.radius ?? 24;
    const color = config.color ?? TREE_STYLE.warmStone;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? TREE_STYLE.bronze;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const glowColor = config.glowColor ?? TREE_STYLE.gold;
    const depth = config.depth ?? 1;

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2 + 7,
      safeWidth,
      safeHeight,
      radius
    );
    shadow.setDepth(depth);

    const panel = this.add.graphics();
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2,
      safeWidth,
      safeHeight,
      radius
    );
    panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    panel.strokeRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2,
      safeWidth,
      safeHeight,
      radius
    );
    panel.setDepth(depth + 1);

    const glow = this.add.circle(
      config.x,
      config.y - safeHeight / 2 + 30,
      safeWidth * 0.26,
      glowColor,
      0.035
    ).setDepth(depth + 2);

    if (config.parent) {
      config.parent.add([shadow, panel, glow]);
    }

    return {
      shadow,
      panel,
      glow,
    };
  }

  private requireContentContainer() {
    if (!this.contentContainer) {
      throw new Error('Stats free content container was not created.');
    }

    return this.contentContainer;
  }

  private addTo<T extends Phaser.GameObjects.GameObject>(
    container: Phaser.GameObjects.Container,
    object: T
  ) {
    container.add(object);
    return object;
  }

  private getAccentTextColor(color: number) {
    if (color === 0xff6b6b) return '#ff9a9a';
    if (color === 0x70a6ff) return '#9ec3ff';
    if (color === 0x75d184) return '#9fe4aa';
    if (color === 0xc084fc) return '#d4a8ff';
    if (color === 0xf0a040) return '#f0c17d';
    if (color === 0x9ca3af) return '#c7cbd1';

    return '#d8c088';
  }
}
