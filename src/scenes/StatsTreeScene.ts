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

type TreeLayout = {
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
  veryCompact: boolean;
};

type TreeButton = {
  shadow: Phaser.GameObjects.Graphics;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
};

type VisibleStage = {
  stage: StageData;
  displayIndex: number;
};

type SelectedNode = {
  branchId: BranchId;
  stageLevel: number;
};

type VirtualBranchCard = {
  branch: BranchData;
  top: number;
  height: number;
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
        5: { title: 'Точный замах', description: 'Базовая атака наносит +5% урона.' },
        10: { title: 'Пробивающий удар', description: 'Атаки игнорируют 10% защиты врага.' },
        15: { title: 'Добивание', description: 'Если у врага меньше 30% HP, герой наносит ему +12% урона.' },
        20: { title: 'Казнь', description: 'Первый удар по врагу в бою наносит +25% урона.' },
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
        5: { title: 'Толстая броня', description: 'Получаемый урон снижен на 3%.' },
        10: { title: 'Стойкость', description: 'После действия “Защита” следующий удар врага дополнительно ослабляется на 10%.' },
        15: { title: 'Каменная стойка', description: 'Первый полученный удар в бою всегда наносит на 40% меньше урона.' },
        20: { title: 'Глухой блок', description: 'Есть 12% шанс уменьшить входящий урон вдвое.' },
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
  private scrollHintObjects: Phaser.GameObjects.GameObject[] = [];
  private branchCardObjects: Phaser.GameObjects.GameObject[] = [];
  private renderedBranchCards = new Map<BranchId, Phaser.GameObjects.GameObject[]>();
  private virtualBranchCards: VirtualBranchCard[] = [];
  private currentLayout?: TreeLayout;
  private pointsChipText?: Phaser.GameObjects.Text;
  private readonly virtualRenderBuffer = 260;

  private currentScrollY = 0;
  private targetScrollY = 0;
  private maxScrollY = 0;

  private isDragging = false;
  private didDrag = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  private selectedNode?: SelectedNode;

  constructor() {
    super('StatsTreeScene');
  }

  init(data?: {
    selectedNode?: SelectedNode;
    scrollY?: number;
  }) {
    if (data?.selectedNode) {
      this.selectedNode = data.selectedNode;
    }

    if (typeof data?.scrollY === 'number') {
      this.currentScrollY = data.scrollY;
      this.targetScrollY = data.scrollY;
    }
  }

  create() {
    this.ensureTreeState();
    this.ensureSelectedNode();

    const layout = this.getLayout();
    this.currentLayout = layout;

    createSceneBackground(this);
    this.createBackdrop(layout);
    this.createHeader(layout);
    this.createScrollableContent(layout);
    this.createBottomButton(layout);
    this.playEntryAnimation(layout);
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
    this.updateVirtualizedBranchCards();
  }

  private getLayout(): TreeLayout {
    const { width, height } = this.scale;

    const veryCompact = height <= 700;
    const compact = height < 860;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 30);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.024), 18, 34);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.026), 22, 36);
    const bottomBarHeight = veryCompact ? 92 : compact ? 98 : 108;
    const headerHeight = veryCompact ? 104 : compact ? 118 : 132;
    const contentWidth = Math.min(width - safeX * 2, 660);
    const contentTop = safeTop + headerHeight + (veryCompact ? 8 : 12);
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
      viewportHeight: Math.max(280, contentBottom - contentTop),
      compact,
      veryCompact,
    };
  }

  private createBackdrop(layout: TreeLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, TREE_STYLE.black, 0.96).setDepth(0);
    this.add.rectangle(centerX, height * 0.62, width, height * 0.84, TREE_STYLE.void, 0.62).setDepth(0);

    this.add.circle(centerX, layout.safeTop + 180, Math.min(width * 0.48, 220), TREE_STYLE.violet, 0.09).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 190, Math.min(width * 0.33, 150), TREE_STYLE.gold, 0.05).setDepth(0);
    this.add.text(centerX, layout.safeTop + 182, '✦', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '82px' : '98px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.03).setDepth(1);

    const slab = this.add.graphics();
    slab.fillStyle(TREE_STYLE.stone, 0.38);
    slab.fillRoundedRect(
      layout.safeX - 10,
      layout.contentTop - 34,
      layout.contentWidth + 20,
      layout.viewportHeight + 52,
      34
    );
    slab.lineStyle(2, TREE_STYLE.bronzeDark, 0.18);
    slab.strokeRoundedRect(
      layout.safeX - 10,
      layout.contentTop - 34,
      layout.contentWidth + 20,
      layout.viewportHeight + 52,
      34
    );
    slab.setDepth(1);

    for (let index = 0; index < 16; index += 1) {
      const x = centerX + (index % 2 === 0 ? -1 : 1) * Phaser.Math.Between(60, Math.round(width * 0.38));
      const y = layout.contentTop - 20 + index * Math.round((layout.viewportHeight + 20) / 16);
      const len = Phaser.Math.Between(22, 58);
      this.add.line(0, 0, x - len / 2, y, x + len / 2, y + Phaser.Math.Between(-12, 12), TREE_STYLE.bronze, 0.06)
        .setLineWidth(2)
        .setDepth(1);
    }

    for (let i = 0; i < 48; i += 1) {
      const x = Phaser.Math.Between(layout.safeX, width - layout.safeX);
      const y = Phaser.Math.Between(layout.safeTop, height - layout.safeBottom - 60);
      const dot = this.add.circle(x, y, 1 + (i % 3), i % 4 === 0 ? TREE_STYLE.gold : TREE_STYLE.ash, i % 4 === 0 ? 0.035 : 0.02)
        .setDepth(1);

      this.tweens.add({
        targets: dot,
        alpha: { from: dot.alpha, to: dot.alpha * 1.8 },
        duration: 1400 + i * 24,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createHeader(layout: TreeLayout) {
    const panelY = layout.safeTop + layout.headerHeight / 2;
    const panelHeight = layout.headerHeight;
    const panelParts = this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 32,
      color: TREE_STYLE.graphite,
      alpha: 0.95,
      strokeColor: TREE_STYLE.bronze,
      strokeAlpha: 0.62,
      strokeWidth: 2,
      glowColor: TREE_STYLE.violet,
      depth: 100,
    });

    const title = this.add.text(layout.centerX, panelY - (layout.compact ? 34 : 40), 'Руническое древо', {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '24px' : layout.compact ? '28px' : '32px',
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

    const pointsChip = this.createPointChip(layout.centerX, panelY + 2, layout.contentWidth - 52);

    const hint = this.add.text(
      layout.centerX,
      panelY + (layout.compact ? 36 : 44),
      'Выбери узел, чтобы увидеть описание и открыть следующую печать.',
      {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '11px' : '12px',
        color: '#9b9488',
        align: 'center',
        lineSpacing: 3,
        wordWrap: {
          width: layout.contentWidth - 68,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }
    ).setOrigin(0.5).setDepth(106);

    [panelParts.shadow, panelParts.panel, panelParts.glow, title, pointsChip.shadow, pointsChip.panel, pointsChip.glow, pointsChip.text, hint].forEach(object => {
      object.setAlpha(0);
      this.tweens.add({
        targets: object,
        alpha: 1,
        duration: 260,
        ease: 'Sine.easeOut',
      });
    });
  }

  private createPointChip(x: number, y: number, maxWidth: number) {
    const points = this.getTreePoints();
    const width = Math.min(maxWidth, 340);
    const canSpend = points > 0;

    const panel = this.createRoundedPanel({
      x,
      y,
      width,
      height: 40,
      radius: 18,
      color: canSpend ? 0x0f1510 : 0x11100e,
      alpha: 0.96,
      strokeColor: canSpend ? TREE_STYLE.green : TREE_STYLE.bronze,
      strokeAlpha: canSpend ? 0.72 : 0.42,
      strokeWidth: 1,
      glowColor: canSpend ? TREE_STYLE.green : TREE_STYLE.gold,
      depth: 103,
    });

    const text = this.add.text(x, y, `Свободные очки: ${points}`, {
      fontFamily: UI.font.title,
      fontSize: '17px',
      color: canSpend ? '#9fd0a6' : '#b8aa91',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: { width: width - 30 },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(107);

    this.pointsChipText = text;

    return {
      ...panel,
      text,
    };
  }

  private createScrollableContent(layout: TreeLayout) {
    this.currentLayout = layout;
    this.contentContainer?.destroy(true);
    this.contentMaskGraphics?.destroy();
    this.scrollHintObjects.forEach(object => object.destroy());
    this.scrollHintObjects = [];
    this.destroyRenderedBranchCards();
    this.branchCardObjects = [];
    this.virtualBranchCards = [];

    this.contentContainer = this.add.container(0, 0).setDepth(5);

    this.contentMaskGraphics = this.add.graphics();
    this.contentMaskGraphics.setVisible(false);
    this.contentMaskGraphics.fillStyle(0xffffff, 1);
    this.contentMaskGraphics.fillRect(
      layout.safeX,
      layout.contentTop,
      layout.contentWidth,
      layout.viewportHeight
    );

    const mask = this.contentMaskGraphics.createGeometryMask();
    this.contentContainer.setMask(mask);

    let cursorY = layout.contentTop + 10;

    cursorY = this.createIntroPanel(layout, cursorY);

    BRANCHES.forEach(branch => {
      const cardHeight = this.getBranchCardHeight(layout, branch);

      this.virtualBranchCards.push({
        branch,
        top: cursorY,
        height: cardHeight,
      });

      cursorY += cardHeight + (layout.compact ? 14 : 16);
    });

    cursorY = this.createAdvicePanel(layout, cursorY + 2);

    const contentHeight = cursorY - layout.contentTop + 24;
    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScrollY);
    this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY, 0, this.maxScrollY);
    this.contentContainer.y = -this.currentScrollY;

    this.createScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }

    this.updateVirtualizedBranchCards(true);
  }

  private updateVirtualizedBranchCards(force = false) {
    const layout = this.currentLayout;

    if (!layout || !this.contentContainer) {
      return;
    }

    const viewportTop = layout.contentTop + this.currentScrollY - this.virtualRenderBuffer;
    const viewportBottom = layout.contentTop + this.currentScrollY + layout.viewportHeight + this.virtualRenderBuffer;

    this.virtualBranchCards.forEach(entry => {
      const branchId = entry.branch.id;
      const rendered = this.renderedBranchCards.has(branchId);
      const visible = entry.top + entry.height >= viewportTop && entry.top <= viewportBottom;

      if (visible && (!rendered || force)) {
        if (rendered) {
          this.destroyRenderedBranchCard(branchId);
        }

        const objects = this.createBranchCard(layout, entry.branch, entry.top + entry.height / 2, entry.height);
        this.renderedBranchCards.set(branchId, objects);
        this.branchCardObjects.push(...objects);

        objects.filter(object => this.hasSetAlpha(object)).forEach(object => {
          object.setAlpha(0);
          this.tweens.add({
            targets: object,
            alpha: 1,
            duration: 140,
            ease: 'Sine.easeOut',
          });
        });
      }

      if (!visible && rendered) {
        this.destroyRenderedBranchCard(branchId);
      }
    });
  }

  private destroyRenderedBranchCards() {
    Array.from(this.renderedBranchCards.keys()).forEach(branchId => {
      this.destroyRenderedBranchCard(branchId);
    });

    this.renderedBranchCards.clear();
  }

  private destroyRenderedBranchCard(branchId: BranchId) {
    const objects = this.renderedBranchCards.get(branchId);

    if (!objects) {
      return;
    }

    this.tweens.killTweensOf(objects);
    objects.forEach(object => {
      if (object.scene) {
        object.destroy();
      }
    });

    this.renderedBranchCards.delete(branchId);
    this.branchCardObjects = this.branchCardObjects.filter(object => !objects.includes(object));
  }

  private refreshBranchCards(branchIds: BranchId[]) {
    const uniqueBranchIds = Array.from(new Set(branchIds));

    uniqueBranchIds.forEach(branchId => {
      if (this.renderedBranchCards.has(branchId)) {
        this.destroyRenderedBranchCard(branchId);
      }
    });

    this.updateVirtualizedBranchCards();
  }

  private refreshVisibleTreeAfterUpgrade(branchId: BranchId) {
    this.updatePointsChipText();
    this.ensureSelectedNode();
    this.refreshBranchCards([branchId]);
  }

  private updatePointsChipText() {
    if (!this.pointsChipText) {
      return;
    }

    const points = this.getTreePoints();
    const canSpend = points > 0;

    this.pointsChipText.setText(`Свободные очки: ${points}`);
    this.pointsChipText.setColor(canSpend ? '#9fd0a6' : '#b8aa91');
  }

  private getBranchCardHeight(layout: TreeLayout, branch: BranchData) {
    if (branch.locked) {
      return layout.veryCompact ? 244 : 258;
    }

    return branch.maxLevel > 10
      ? layout.veryCompact ? 348 : layout.compact ? 362 : 378
      : layout.veryCompact ? 332 : layout.compact ? 344 : 360;
  }

  private createIntroPanel(layout: TreeLayout, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = layout.veryCompact ? 106 : 118;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 28,
      color: TREE_STYLE.warmStone,
      alpha: 0.9,
      strokeColor: TREE_STYLE.bronze,
      strokeAlpha: 0.44,
      strokeWidth: 2,
      glowColor: TREE_STYLE.gold,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 28, 'Древо силы героя', {
        fontFamily: UI.font.title,
        fontSize: layout.veryCompact ? '20px' : '22px',
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
      this.add.text(layout.centerX, topY + 72, 'Каждая ветка — цепь рунических печатей. Обычные узлы дают стабильный прирост, особые печати меняют стиль боя.', {
        fontFamily: UI.font.body,
        fontSize: layout.veryCompact ? '11px' : '12px',
        color: '#b8aa91',
        align: 'center',
        lineSpacing: 4,
        wordWrap: {
          width: layout.contentWidth - 64,
          useAdvancedWrap: true,
        },
        maxLines: 3,
      }).setOrigin(0.5).setDepth(8)
    );

    return topY + panelHeight + 6;
  }

  private createBranchCard(layout: TreeLayout, branch: BranchData, y: number, height: number) {
    const container = this.requireContentContainer();
    const objects: Phaser.GameObjects.GameObject[] = [];

    const level = this.getBranchLevel(branch.id);
    const selectedStage = this.getSelectedStage(branch);
    const isLocked = branch.locked ?? false;
    const isMaxed = branch.maxLevel > 0 && level >= branch.maxLevel;

    const width = layout.contentWidth;
    const left = layout.centerX - width / 2;
    const top = y - height / 2;
    const headerHeight = 84;

    const panelParts = this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y,
      width,
      height,
      radius: 30,
      color: isLocked ? TREE_STYLE.graphite : TREE_STYLE.soot,
      alpha: 0.96,
      strokeColor: isLocked ? TREE_STYLE.bronzeDark : branch.accentColor,
      strokeAlpha: isLocked ? 0.32 : 0.6,
      strokeWidth: isLocked ? 1 : 2,
      glowColor: branch.accentColor,
      depth: 2,
    });
    objects.push(panelParts.shadow, panelParts.panel, panelParts.glow);

    const accent = this.add.rectangle(left + 8, y, 6, height - 32, branch.accentColor, isLocked ? 0.16 : 0.72).setDepth(7);
    this.addTo(container, accent);
    objects.push(accent);

    const iconBack = this.add.circle(left + 44, top + 42, 26, branch.accentColor, isLocked ? 0.08 : 0.15)
      .setStrokeStyle(2, branch.accentColor, isLocked ? 0.24 : 0.82)
      .setDepth(8);
    this.addTo(container, iconBack);
    objects.push(iconBack);

    const icon = this.add.text(left + 44, top + 42, branch.icon, {
      fontFamily: UI.font.title,
      fontSize: '22px',
      color: isLocked ? '#7d756d' : '#f1eadc',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(9);
    this.addTo(container, icon);
    objects.push(icon);

    const title = this.add.text(left + 84, top + 30, branch.title, {
      fontFamily: UI.font.title,
      fontSize: layout.veryCompact ? '18px' : '20px',
      color: isLocked ? '#8f806d' : '#d8c088',
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: {
        width: width - 186,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(9);
    this.addTo(container, title);
    objects.push(title);

    const subtitle = this.add.text(left + 84, top + 58, branch.subtitle, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: isLocked ? '#6f665b' : this.getAccentTextColor(branch.accentColor),
      wordWrap: {
        width: width - 186,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(9);
    this.addTo(container, subtitle);
    objects.push(subtitle);

    const levelPill = this.createLevelPill(container, layout.centerX + width / 2 - 64, top + 44, branch, level, isLocked, isMaxed);
    objects.push(...levelPill);

    if (isLocked) {
      objects.push(...this.createLockedBranchContent(container, layout, branch, top + headerHeight + 6, width - 46));
      return objects;
    }

    const visibleStages = this.getVisibleStages(branch);
    const treeY = top + headerHeight + 24;
    const treeHeight = layout.veryCompact ? 92 : 100;
    objects.push(...this.createBranchTreeMap({
      parent: container,
      branch,
      currentLevel: level,
      selectedStageLevel: selectedStage?.level,
      visibleStages,
      x: left + 18,
      y: treeY,
      width: width - 36,
      height: treeHeight,
      compact: layout.compact,
    }));

    const detailTop = treeY + treeHeight + 12;
    const detailHeight = layout.veryCompact ? 120 : 128;
    const buttonHeight = 52;
    const buttonY = top + height - 42;
    objects.push(...this.createSelectedNodePanel({
      parent: container,
      branch,
      selectedStage,
      currentLevel: level,
      x: layout.centerX,
      y: detailTop + detailHeight / 2,
      width: width - 36,
      height: detailHeight,
    }));

    const status = this.getSelectedNodeStatus(branch, selectedStage, level);
    const button = this.createTreeButton({
      parent: container,
      x: layout.centerX,
      y: buttonY,
      width: Math.min(width - 42, 420),
      height: buttonHeight,
      text: status.buttonText,
      accentColor: branch.accentColor,
      variant: status.variant,
      disabled: status.disabled,
      onClick: () => {
        if (selectedStage && status.canUpgrade) {
          this.showUpgradeConfirm(branch, selectedStage);
        }
      },
      depth: 10,
    });
    objects.push(button.shadow, button.bg, button.label, button.zone);

    return objects;
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
    const text = isLocked ? 'скоро' : isMaxed ? 'полностью' : `${level}/${branch.maxLevel}`;
    const width = isMaxed ? 104 : 86;
    const color = isLocked ? 0x12100d : isMaxed ? 0x0f1510 : 0x17100c;
    const stroke = isLocked ? TREE_STYLE.bronzeDark : isMaxed ? TREE_STYLE.green : branch.accentColor;

    const panel = this.createRoundedPanel({
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

    const label = this.add.text(x, y, text, {
      fontFamily: UI.font.title,
      fontSize: isMaxed ? '12px' : '14px',
      color: isLocked ? '#6f665b' : isMaxed ? '#9fd0a6' : '#d8d0bf',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: { width: width - 12 },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(10);
    this.addTo(container, label);

    return [panel.shadow, panel.panel, panel.glow, label];
  }

  private createLockedBranchContent(
    container: Phaser.GameObjects.Container,
    layout: TreeLayout,
    branch: BranchData,
    y: number,
    width: number
  ) {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const panel = this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: y + 64,
      width,
      height: 140,
      radius: 24,
      color: TREE_STYLE.graphite,
      alpha: 0.88,
      strokeColor: TREE_STYLE.bronzeDark,
      strokeAlpha: 0.42,
      strokeWidth: 1,
      glowColor: branch.accentColor,
      depth: 7,
    });
    objects.push(panel.shadow, panel.panel, panel.glow);

    const title = this.add.text(layout.centerX, y + 28, 'Ветка запечатана', {
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
    }).setOrigin(0.5).setDepth(10);
    this.addTo(container, title);
    objects.push(title);

    const desc = this.add.text(layout.centerX, y + 82, branch.normalText, {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: '#8f806d',
      align: 'center',
      lineSpacing: 4,
      wordWrap: {
        width: width - 48,
        useAdvancedWrap: true,
      },
      maxLines: 4,
    }).setOrigin(0.5).setDepth(10);
    this.addTo(container, desc);
    objects.push(desc);

    return objects;
  }

  private createBranchTreeMap(config: {
    parent: Phaser.GameObjects.Container;
    branch: BranchData;
    currentLevel: number;
    selectedStageLevel?: number;
    visibleStages: VisibleStage[];
    x: number;
    y: number;
    width: number;
    height: number;
    compact: boolean;
  }) {
    const { parent, branch, currentLevel, selectedStageLevel, visibleStages, x, y, width, height, compact } = config;
    const objects: Phaser.GameObjects.GameObject[] = [];

    const bg = this.createRoundedPanel({
      parent,
      x: x + width / 2,
      y: y + height / 2,
      width,
      height,
      radius: 22,
      color: TREE_STYLE.graphite,
      alpha: 0.72,
      strokeColor: TREE_STYLE.bronzeDark,
      strokeAlpha: 0.28,
      strokeWidth: 1,
      glowColor: branch.accentColor,
      depth: 7,
    });
    objects.push(bg.shadow, bg.panel, bg.glow);

    const smallLabel = this.add.text(x + 16, y + 15, this.getBranchTreeLabel(branch, currentLevel), {
      fontFamily: UI.font.body,
      fontSize: compact ? '11px' : '12px',
      color: '#8f806d',
      wordWrap: {
        width: width - 32,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);
    this.addTo(parent, smallLabel);
    objects.push(smallLabel);

    const pathY = y + height - 34;
    const points = visibleStages.map((visibleStage, index) => {
      const step = visibleStages.length <= 1 ? 0 : (width - 52) / (visibleStages.length - 1);
      return {
        stage: visibleStage.stage,
        x: x + 26 + step * index,
        y: pathY,
      };
    });

    const lines = this.add.graphics().setDepth(9);
    visibleStages.forEach((_visibleStage, index) => {
      if (index === 0) {
        return;
      }

      const previous = points[index - 1];
      const current = points[index];
      const prevUnlocked = currentLevel >= previous.stage.level;
      const currUnlocked = currentLevel >= current.stage.level;
      const currAvailable = currentLevel + 1 === current.stage.level;

      const color = currUnlocked || prevUnlocked
        ? branch.accentColor
        : currAvailable
          ? TREE_STYLE.bronze
          : TREE_STYLE.bronzeDark;

      const alpha = currUnlocked
        ? 0.78
        : currAvailable
          ? 0.45
          : 0.24;

      lines.lineStyle(currUnlocked ? 5 : 3, color, alpha);
      lines.beginPath();
      lines.moveTo(previous.x, previous.y);
      lines.lineTo(current.x, current.y);
      lines.strokePath();
    });
    parent.add(lines);
    objects.push(lines);

    points.forEach(point => {
      objects.push(...this.createTreeNode(parent, branch, point.x, point.y, point.stage, currentLevel, selectedStageLevel));
    });

    return objects;
  }

  private createTreeNode(
    container: Phaser.GameObjects.Container,
    branch: BranchData,
    x: number,
    y: number,
    stage: StageData,
    currentLevel: number,
    selectedStageLevel?: number
  ) {
    const objects: Phaser.GameObjects.GameObject[] = [];

    const unlocked = currentLevel >= stage.level;
    const available = currentLevel + 1 === stage.level;
    const locked = currentLevel + 1 < stage.level;
    const selected = selectedStageLevel === stage.level;
    const special = stage.special ?? false;

    const radius = special ? 20 : 17;
    const fill = unlocked
      ? branch.accentColor
      : available
        ? TREE_STYLE.warmStone
        : TREE_STYLE.stoneSoft;
    const stroke = selected
      ? TREE_STYLE.goldSoft
      : special || available
        ? TREE_STYLE.gold
        : branch.accentColor;

    if (available) {
      const pulse = this.add.circle(x, y, radius + 9, branch.accentColor, 0.12).setDepth(10);
      this.addTo(container, pulse);
      this.tweens.add({
        targets: pulse,
        alpha: { from: 0.06, to: 0.2 },
        scaleX: { from: 1, to: 1.16 },
        scaleY: { from: 1, to: 1.16 },
        duration: 980,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      objects.push(pulse);
    }

    if (unlocked) {
      const glow = this.add.circle(x, y, radius + 10, branch.accentColor, 0.08).setDepth(10);
      this.addTo(container, glow);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.05, to: 0.14 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      objects.push(glow);
    }

    const ring = this.add.circle(x, y, radius + (selected ? 8 : 6), stroke, selected ? 0.14 : 0.05)
      .setStrokeStyle(selected ? 2 : 1, stroke, selected ? 0.8 : 0.25)
      .setDepth(11);
    this.addTo(container, ring);
    objects.push(ring);

    const node = this.add.circle(x, y, radius, fill, unlocked ? 0.96 : available ? 0.92 : 0.72)
      .setStrokeStyle(selected ? 3 : available ? 3 : 2, stroke, unlocked || available || selected ? 0.9 : 0.42)
      .setDepth(12);
    this.addTo(container, node);
    objects.push(node);

    const iconText = unlocked ? '✓' : special ? '★' : `${stage.level}`;
    const icon = this.add.text(x, y, iconText, {
      fontFamily: UI.font.title,
      fontSize: special ? '13px' : '11px',
      color: unlocked ? '#ffffff' : available ? '#d8c088' : '#8f806d',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: { width: radius * 2 },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(13);
    this.addTo(container, icon);
    objects.push(icon);

    const costText = this.add.text(x, y + radius + 11, `${stage.cost}`, {
      fontFamily: UI.font.body,
      fontSize: '10px',
      color: unlocked ? '#9fd0a6' : available ? '#d8c088' : '#6f665b',
      align: 'center',
      wordWrap: { width: 38 },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(13);
    this.addTo(container, costText);
    objects.push(costText);

    const zone = this.add.zone(x, y, 56, 64).setDepth(16).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (this.didDrag) {
        return;
      }

      const previousBranchId = this.selectedNode?.branchId;

      this.selectedNode = {
        branchId: branch.id,
        stageLevel: stage.level,
      };

      this.tweens.add({
        targets: [node, ring],
        scaleX: { from: 1, to: 1.08 },
        scaleY: { from: 1, to: 1.08 },
        duration: 90,
        yoyo: true,
        ease: 'Sine.easeOut',
      });

      if (previousBranchId && previousBranchId !== branch.id) {
        this.refreshBranchCards([previousBranchId, branch.id]);
      } else {
        this.refreshBranchCards([branch.id]);
      }
    });
    container.add(zone);
    objects.push(zone);

    if (locked) {
      const lock = this.add.text(x, y - radius - 10, '⛨', {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: '#5f564d',
      }).setOrigin(0.5).setDepth(13).setAlpha(0.8);
      this.addTo(container, lock);
      objects.push(lock);
    }

    return objects;
  }

  private createSelectedNodePanel(config: {
    parent: Phaser.GameObjects.Container;
    branch: BranchData;
    selectedStage?: StageData;
    currentLevel: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    const { parent, branch, selectedStage, currentLevel, x, y, width, height } = config;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const status = this.getSelectedNodeStatus(branch, selectedStage, currentLevel);

    const panel = this.createRoundedPanel({
      parent,
      x,
      y,
      width,
      height,
      radius: 22,
      color: TREE_STYLE.graphite,
      alpha: 0.9,
      strokeColor: status.strokeColor,
      strokeAlpha: 0.55,
      strokeWidth: 1,
      glowColor: branch.accentColor,
      depth: 7,
    });
    objects.push(panel.shadow, panel.panel, panel.glow);

    const left = x - width / 2;
    const title = this.add.text(left + 18, y - height / 2 + 16, selectedStage ? selectedStage.title : 'Выбери узел', {
      fontFamily: UI.font.title,
      fontSize: '14px',
      color: status.titleColor,
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: {
        width: width - 128,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0, 0).setDepth(10);
    this.addTo(parent, title);
    objects.push(title);

    const badge = this.add.text(x + width / 2 - 18, y - height / 2 + 18, status.shortText, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: status.badgeColor,
      backgroundColor: '#000000',
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
    }).setOrigin(1, 0).setDepth(10);
    this.addTo(parent, badge);
    objects.push(badge);

    const meta = this.add.text(left + 18, y - height / 2 + 42, selectedStage ? `Ветка: ${branch.title} • уровень ${selectedStage.level}` : `Ветка: ${branch.title}`, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: '#8f806d',
      wordWrap: {
        width: width - 36,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0).setDepth(10);
    this.addTo(parent, meta);
    objects.push(meta);

    const description = this.add.text(left + 18, y - height / 2 + 64, selectedStage?.description ?? branch.normalText, {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#b8aa91',
      lineSpacing: 4,
      wordWrap: {
        width: width - 36,
        useAdvancedWrap: true,
      },
      maxLines: 3,
    }).setOrigin(0, 0).setDepth(10);
    this.addTo(parent, description);
    objects.push(description);

    const foot = this.add.text(left + 18, y + height / 2 - 22, status.footText, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: status.badgeColor,
      wordWrap: {
        width: width - 36,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0, 0.5).setDepth(10);
    this.addTo(parent, foot);
    objects.push(foot);

    return objects;
  }

  private createAdvicePanel(layout: TreeLayout, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = 112;
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

    this.addTo(container, this.add.text(layout.centerX, topY + 24, 'Совет по развитию', {
      fontFamily: UI.font.title,
      fontSize: '20px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 58,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(8));

    this.addTo(container, this.add.text(
      layout.centerX,
      topY + 70,
      'Начни с 1–2 ключевых веток под роль героя. Длинные ветки дают базу, короткие ветки — дорогие сильные эффекты.',
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
    ).setOrigin(0.5).setDepth(8));

    return topY + panelHeight;
  }

  private createScrollInput(layout: TreeLayout) {
    this.input.removeAllListeners('pointerdown');
    this.input.removeAllListeners('pointermove');
    this.input.removeAllListeners('pointerup');
    this.input.removeAllListeners('pointerupoutside');
    this.input.removeAllListeners('wheel');

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

      this.targetScrollY = Phaser.Math.Clamp(this.dragStartScrollY - deltaY, 0, this.maxScrollY);
      this.currentScrollY = this.targetScrollY;

      if (this.contentContainer) {
        this.contentContainer.y = -this.currentScrollY;
      }

      this.updateVirtualizedBranchCards();
    });

    const resetDrag = () => {
      this.isDragging = false;
      this.time.delayedCall(0, () => {
        this.didDrag = false;
      });
    };

    this.input.on('pointerup', resetDrag);
    this.input.on('pointerupoutside', resetDrag);

    this.input.on('wheel', (
      pointer: Phaser.Input.Pointer,
      _objects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number
    ) => {
      if (!this.isPointerInsideContent(pointer, layout) || this.maxScrollY <= 0) {
        return;
      }

      this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY + deltaY * 0.55, 0, this.maxScrollY);
      this.updateVirtualizedBranchCards();
    });
  }

  private isPointerInsideContent(pointer: Phaser.Input.Pointer, layout: TreeLayout) {
    return (
      pointer.x >= layout.safeX &&
      pointer.x <= layout.safeX + layout.contentWidth &&
      pointer.y >= layout.contentTop &&
      pointer.y <= layout.contentBottom
    );
  }

  private createScrollHint(layout: TreeLayout) {
    const trackX = layout.safeX + layout.contentWidth - 6;
    const trackY = layout.contentTop + layout.viewportHeight / 2;
    const viewportHeight = layout.viewportHeight;
    const visibleRatio = viewportHeight / Math.max(viewportHeight + this.maxScrollY, viewportHeight + 1);
    const thumbHeight = Phaser.Math.Clamp(viewportHeight * visibleRatio, 42, viewportHeight);
    const travel = Math.max(0, viewportHeight - thumbHeight);
    const progress = this.maxScrollY <= 0 ? 0 : this.currentScrollY / this.maxScrollY;
    const thumbY = layout.contentTop + thumbHeight / 2 + travel * progress;

    const track = this.add.rectangle(trackX, trackY, 4, viewportHeight - 18, TREE_STYLE.bronzeDark, 0.42).setDepth(220);
    const thumb = this.add.rectangle(trackX, thumbY, 4, thumbHeight, TREE_STYLE.gold, 0.72).setDepth(221);
    const hintBg = this.add.rectangle(layout.centerX, layout.contentBottom - 14, 210, 28, 0x000000, 0.38).setDepth(220);
    const hintText = this.add.text(layout.centerX, layout.contentBottom - 14, 'Прокручивай ветки', {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: '#8f806d',
      align: 'center',
      wordWrap: { width: 190 },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(221);

    this.scrollHintObjects.push(track, thumb, hintBg, hintText);

    this.tweens.add({
      targets: [hintBg, hintText],
      alpha: 0.2,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private createBottomButton(layout: TreeLayout) {
    const y = layout.height - layout.safeBottom - 32;

    this.add.rectangle(
      layout.centerX,
      layout.height - layout.safeBottom - layout.bottomBarHeight / 2 + 18,
      layout.width,
      layout.bottomBarHeight + layout.safeBottom,
      0x020202,
      0.74
    ).setDepth(236);

    this.add.rectangle(layout.centerX, y - 42, layout.contentWidth, 1, TREE_STYLE.bronze, 0.24).setDepth(237);

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

  private playEntryAnimation(layout: TreeLayout) {
    const shade = this.add.rectangle(layout.centerX, layout.height / 2, layout.width, layout.height, 0x000000, 0.28).setDepth(500);
    this.tweens.add({
      targets: shade,
      alpha: 0,
      duration: 320,
      ease: 'Sine.easeOut',
      onComplete: () => {
        shade.destroy();
      },
    });
  }

  private showUpgradeConfirm(branch: BranchData, stage?: StageData) {
    if (this.didDrag) {
      return;
    }

    const level = this.getBranchLevel(branch.id);
    const targetStage = stage ?? branch.stages[level];

    if (!targetStage || branch.locked || level >= branch.maxLevel) {
      return;
    }

    if (targetStage.level !== level + 1) {
      this.showMessage('Печать недоступна', 'Сначала нужно открыть предыдущие узлы этой ветки.');
      return;
    }

    const enough = this.getTreePoints() >= targetStage.cost;
    if (!enough) {
      this.showMessage('Недостаточно очков', `Для узла “${targetStage.title}” нужно ${targetStage.cost} очк. Свободно: ${this.getTreePoints()}.`);
      return;
    }

    const description = [
      `Ветка: ${branch.title}`,
      `Узел: ${targetStage.title}`,
      `Цена: ${targetStage.cost} очк.`,
      '',
      targetStage.description,
    ].join('\n');

    this.showModal({
      title: 'Изучить печать?',
      description,
      confirmText: `Изучить за ${targetStage.cost}`,
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

    this.selectedNode = {
      branchId,
      stageLevel: currentLevel + 1,
    };

    void saveGameAsync();

    this.modalObjects.forEach(object => object.destroy());
    this.modalObjects = [];

    this.refreshVisibleTreeAfterUpgrade(branchId);
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
    const modalWidth = Math.min(width - 46, 620);
    const modalHeight = Math.min(height - 120, 430);
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

    const titleText = this.add.text(centerX, centerY - modalHeight / 2 + 42, config.title, {
      fontFamily: UI.font.title,
      fontSize: '24px',
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

    const divider = this.add.rectangle(centerX, centerY - modalHeight / 2 + 82, modalWidth - 92, 2, TREE_STYLE.gold, 0.24).setDepth(1005);

    const descriptionText = this.add.text(centerX, centerY - modalHeight / 2 + 106, config.description, {
      fontFamily: UI.font.body,
      fontSize: '15px',
      color: '#d8c7a3',
      align: 'center',
      lineSpacing: 6,
      wordWrap: {
        width: modalWidth - 86,
        useAdvancedWrap: true,
      },
      maxLines: 10,
    }).setOrigin(0.5, 0).setDepth(1005);

    const closeModal = () => {
      this.modalObjects.forEach(object => object.destroy());
      this.modalObjects = [];
    };

    const confirmButton = this.createTreeButton({
      x: centerX,
      y: centerY + modalHeight / 2 - 94,
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
      y: centerY + modalHeight / 2 - 34,
      width: Math.min(modalWidth - 94, 390),
      height: 52,
      text: 'Отмена',
      accentColor: TREE_STYLE.bronze,
      variant: 'dark',
      onClick: closeModal,
      depth: 1005,
    });

    [overlay, panelParts.shadow, panelParts.panel, panelParts.glow, titleText, divider, descriptionText,
      confirmButton.shadow, confirmButton.bg, confirmButton.label, confirmButton.zone,
      cancelButton.shadow, cancelButton.bg, cancelButton.label, cancelButton.zone].forEach(object => {
      if (this.hasSetAlpha(object)) {
        object.setAlpha(0);
      }

      this.modalObjects.push(object);
    });

    this.tweens.add({
      targets: [overlay, panelParts.shadow, panelParts.panel, panelParts.glow, titleText, divider, descriptionText,
        confirmButton.shadow, confirmButton.bg, confirmButton.label, cancelButton.shadow, cancelButton.bg, cancelButton.label],
      alpha: 1,
      duration: 180,
      ease: 'Sine.easeOut',
    });
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

  private ensureSelectedNode() {
    if (this.selectedNode) {
      return;
    }

    const firstAvailableBranch = BRANCHES.find(branch => !branch.locked && branch.maxLevel > 0) ?? BRANCHES[0];
    const currentLevel = this.getBranchLevel(firstAvailableBranch.id);
    const stage = firstAvailableBranch.stages[Math.min(currentLevel, Math.max(0, firstAvailableBranch.stages.length - 1))];

    this.selectedNode = {
      branchId: firstAvailableBranch.id,
      stageLevel: stage?.level ?? 1,
    };
  }

  private getVisibleStages(branch: BranchData): VisibleStage[] {
    if (branch.maxLevel > 10) {
      return branch.stages.filter(stage => stage.special).map((stage, displayIndex) => ({ stage, displayIndex }));
    }

    return branch.stages.map((stage, displayIndex) => ({ stage, displayIndex }));
  }

  private getSelectedStage(branch: BranchData) {
    if (this.selectedNode?.branchId === branch.id) {
      return branch.stages.find(stage => stage.level === this.selectedNode?.stageLevel) ?? branch.stages[this.getBranchLevel(branch.id)] ?? branch.stages[0];
    }

    return branch.stages[this.getBranchLevel(branch.id)] ?? branch.stages[0];
  }

  private getSelectedNodeStatus(branch: BranchData, selectedStage: StageData | undefined, currentLevel: number) {
    if (branch.locked) {
      return {
        disabled: true,
        canUpgrade: false,
        buttonText: 'Ветка запечатана',
        variant: 'dark' as const,
        titleColor: '#8f806d',
        badgeColor: '#8f806d',
        shortText: 'скоро',
        footText: 'Эта ветка ещё не открыта.',
        strokeColor: TREE_STYLE.bronzeDark,
      };
    }

    if (!selectedStage) {
      return {
        disabled: true,
        canUpgrade: false,
        buttonText: 'Выбери узел',
        variant: 'dark' as const,
        titleColor: '#b8aa91',
        badgeColor: '#8f806d',
        shortText: '—',
        footText: 'Выбери узел для просмотра деталей.',
        strokeColor: TREE_STYLE.bronzeDark,
      };
    }

    const points = this.getTreePoints();
    const unlocked = currentLevel >= selectedStage.level;
    const available = currentLevel + 1 === selectedStage.level;
    const locked = currentLevel + 1 < selectedStage.level;
    const enoughPoints = points >= selectedStage.cost;
    const isMaxed = currentLevel >= branch.maxLevel && unlocked;

    if (unlocked) {
      return {
        disabled: true,
        canUpgrade: false,
        buttonText: isMaxed ? 'Ветка изучена полностью' : 'Узел уже изучен',
        variant: 'green' as const,
        titleColor: '#9fd0a6',
        badgeColor: '#9fd0a6',
        shortText: 'изучен',
        footText: `Цена: ${selectedStage.cost} очк. • Уже открыто.`,
        strokeColor: TREE_STYLE.green,
      };
    }

    if (locked) {
      return {
        disabled: true,
        canUpgrade: false,
        buttonText: 'Нужно открыть предыдущий узел',
        variant: 'dark' as const,
        titleColor: '#d8c088',
        badgeColor: '#8f806d',
        shortText: 'заблокирован',
        footText: `Требуется сначала открыть узел ${selectedStage.level - 1}.`,
        strokeColor: TREE_STYLE.bronzeDark,
      };
    }

    if (!enoughPoints) {
      return {
        disabled: true,
        canUpgrade: false,
        buttonText: `Нужно ${selectedStage.cost} очк.`,
        variant: 'dark' as const,
        titleColor: '#d8c088',
        badgeColor: '#ff9a9a',
        shortText: 'не хватает очков',
        footText: `Нужно ${selectedStage.cost} очк. • Свободно: ${points}.`,
        strokeColor: TREE_STYLE.blood,
      };
    }

    return {
      disabled: false,
      canUpgrade: available,
      buttonText: `Изучить узел за ${selectedStage.cost}`,
      variant: 'gold' as const,
      titleColor: '#d8c088',
      badgeColor: '#d8c088',
      shortText: 'доступно',
      footText: `Цена: ${selectedStage.cost} очк. • Свободно: ${points}.`,
      strokeColor: branch.accentColor,
    };
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
      return `Открыто ${level}/${branch.maxLevel} • особая печать: ${nextSpecial.level} ур.`;
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
        : variant === 'dark'
          ? 0x181614
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
    shadow.fillRoundedRect(config.x - config.width / 2, config.y - config.height / 2 + 5, config.width, config.height, radius);
    shadow.setDepth(depth);

    const bg = this.add.graphics();
    const draw = (color: number, alpha: number, strokeAlpha: number) => {
      bg.clear();
      bg.fillStyle(color, alpha);
      bg.fillRoundedRect(config.x - config.width / 2, config.y - config.height / 2, config.width, config.height, radius);
      bg.lineStyle(2, strokeColor, strokeAlpha);
      bg.strokeRoundedRect(config.x - config.width / 2, config.y - config.height / 2, config.width, config.height, radius);
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
        bg.setScale(1);
        shadow.setScale(1);
      });

      zone.on('pointerdown', () => {
        isPressed = true;
        draw(hoverColor, 0.92, 0.95);
        label.setY(config.y + 1);
        label.setColor('#ffffff');
        bg.setScale(0.985);
        shadow.setScale(0.985);
      });

      zone.on('pointerup', () => {
        if (!isPressed) {
          return;
        }

        isPressed = false;
        label.setY(config.y);
        bg.setScale(1);
        shadow.setScale(1);

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
        bg.setScale(1);
        shadow.setScale(1);
      });

      zone.on('pointercancel', () => {
        isPressed = false;
        draw(fillColor, 0.96, 0.82);
        label.setY(config.y);
        label.setColor(textColor);
        bg.setScale(1);
        shadow.setScale(1);
      });
    }

    return { shadow, bg, label, zone };
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
    shadow.fillRoundedRect(config.x - safeWidth / 2, config.y - safeHeight / 2 + 7, safeWidth, safeHeight, radius);
    shadow.setDepth(depth);

    const panel = this.add.graphics();
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(config.x - safeWidth / 2, config.y - safeHeight / 2, safeWidth, safeHeight, radius);
    panel.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    panel.strokeRoundedRect(config.x - safeWidth / 2, config.y - safeHeight / 2, safeWidth, safeHeight, radius);
    panel.setDepth(depth + 1);

    const glow = this.add.circle(config.x, config.y - safeHeight / 2 + 30, safeWidth * 0.26, glowColor, 0.035).setDepth(depth + 2);

    if (config.parent) {
      config.parent.add([shadow, panel, glow]);
    }

    return { shadow, panel, glow };
  }


  private hasSetAlpha(object: Phaser.GameObjects.GameObject): object is Phaser.GameObjects.GameObject & {
    setAlpha: (value?: number, topLeft?: number, topRight?: number, bottomLeft?: number, bottomRight?: number) => unknown;
  } {
    return typeof (object as { setAlpha?: unknown }).setAlpha === 'function';
  }

  private requireContentContainer() {
    if (!this.contentContainer) {
      throw new Error('Stats tree content container was not created.');
    }

    return this.contentContainer;
  }

  private addTo<T extends Phaser.GameObjects.GameObject>(container: Phaser.GameObjects.Container, object: T) {
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
