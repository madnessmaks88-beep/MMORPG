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

  contentTop: number;
  contentBottom: number;
  contentWidth: number;
  viewportHeight: number;

  compact: boolean;
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
    icon: '🛡',
    accentColor: 0x9ca3af,
    maxLevel: 20,
    normalText: '+1 к защите за каждый обычный этап.',
    stages: createMilestoneStages({
      maxLevel: 20,
      normalCost: 1,
      specialCost: 2,
      normalTitle: 'Укрепление брони',
      normalDescription: '+1 к защите.',
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

  private getLayout(): TreeLayout {
    const { width, height } = this.scale;

    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.025), 20, 34);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.035), 28, 46);
    const contentWidth = Math.min(width - safeX * 2, 620);

    const contentTop = safeTop + 132;
    const contentBottom = height - safeBottom - 82;

    return {
      width,
      height,
      centerX: width / 2,
      safeX,
      safeTop,
      safeBottom,
      contentTop,
      contentBottom,
      contentWidth,
      viewportHeight: Math.max(320, contentBottom - contentTop),
      compact: height < 1120,
    };
  }

  private createBackdrop(layout: TreeLayout) {
    const { width, height, centerX } = layout;

    this.add.circle(centerX, layout.safeTop + 160, width * 0.46, 0x3c2417, 0.12).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 174, width * 0.28, 0xf0a040, 0.055).setDepth(0);
    this.add.rectangle(centerX, height - 210, width, 380, 0x030202, 0.42).setDepth(0);

    for (let i = 0; i < 24; i += 1) {
      const x = layout.safeX + 20 + i * ((width - layout.safeX * 2 - 40) / 23);
      const y = layout.safeTop + 96 + (i % 7) * 72;
      this.add.circle(x, y, 2, 0xf0d58a, 0.05).setDepth(1);
    }

    this.add.text(centerX, layout.safeTop + 168, '✦', {
      fontFamily: UI.font.body,
      fontSize: '92px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.035).setDepth(1);
  }

  private createHeader(layout: TreeLayout) {
    const panelHeight = 108;
    const panelY = layout.safeTop + panelHeight / 2 + 4;

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: 0x100b08,
      alpha: 0.96,
      strokeColor: UI.colors.goldDark,
      strokeAlpha: 0.62,
      depth: 8,
    });

    this.add.text(layout.centerX, panelY - 30, 'Дерево характеристик', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '28px' : '32px',
      color: UI.colors.goldText,
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 44,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12);

    this.add.text(layout.centerX, panelY + 4, `Очки прокачки: ${this.getTreePoints()}`, {
      fontFamily: UI.font.title,
      fontSize: '19px',
      color: UI.colors.green,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 58,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(12);

    this.add.text(layout.centerX, panelY + 34, 'Каждый уровень героя даёт 3 очка. Особые узлы отмечены звёздами.', {
      fontFamily: UI.font.body,
      fontSize: '13px',
      color: UI.colors.textMuted,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 58,
        useAdvancedWrap: true,
      },
      maxLines: 2,
    }).setOrigin(0.5).setDepth(12);
  }

  private createScrollableContent(layout: TreeLayout) {
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

    const mask = maskGraphics.createGeometryMask();
    this.contentContainer.setMask(mask);

    let cursorY = layout.contentTop + 14;

    BRANCHES.forEach(branch => {
      const cardHeight = branch.maxLevel > 10 ? (layout.compact ? 238 : 252) : 230;
      this.createBranchCard(layout, branch, cursorY + cardHeight / 2, cardHeight);
      cursorY += cardHeight + 16;
    });

    const contentHeight = cursorY - layout.contentTop + 18;

    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScrollY);
    this.targetScrollY = this.currentScrollY;

    this.createScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }
  }


  private createBranchCard(layout: TreeLayout, branch: BranchData, y: number, height: number) {
    const container = this.requireContentContainer();
    const level = this.getBranchLevel(branch.id);
    const nextStage = branch.stages[level];
    const isMaxed = branch.maxLevel > 0 && level >= branch.maxLevel;
    const isLocked = branch.locked ?? false;
    const cost = nextStage?.cost ?? 0;
    const canUpgrade = !isLocked && !isMaxed && this.getTreePoints() >= cost;

    const width = layout.contentWidth;
    const left = layout.centerX - width / 2;
    const top = y - height / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y,
      width,
      height,
      radius: 30,
      color: isLocked ? 0x0d0d0d : 0x100c09,
      alpha: 0.96,
      strokeColor: isLocked ? 0x4a3a27 : branch.accentColor,
      strokeAlpha: isLocked ? 0.35 : 0.65,
      strokeWidth: 2,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.circle(left + 48, top + 48, 30, branch.accentColor, isLocked ? 0.08 : 0.18)
        .setStrokeStyle(2, branch.accentColor, isLocked ? 0.25 : 0.7)
        .setDepth(6)
    );

    this.addTo(
      container,
      this.add.text(left + 48, top + 48, branch.icon, {
        fontFamily: UI.font.body,
        fontSize: '24px',
        color: isLocked ? UI.colors.textMuted : UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 92, top + 30, branch.title, {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '21px' : '24px',
        color: isLocked ? UI.colors.textMuted : UI.colors.goldText,
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: width - 230,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 92, top + 60, branch.subtitle, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: isLocked ? UI.colors.textMuted : this.getAccentTextColor(branch.accentColor),
        wordWrap: {
          width: width - 230,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + width - 28, top + 44, isLocked ? 'скоро' : `${level}/${branch.maxLevel}`, {
        fontFamily: UI.font.title,
        fontSize: '18px',
        color: isMaxed ? UI.colors.green : UI.colors.text,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'right',
        wordWrap: {
          width: 100,
        },
        maxLines: 1,
      }).setOrigin(1, 0.5).setDepth(7)
    );

    this.createProgressNodes(container, branch, left + 30, top + 96, width - 60, level);

    const nextTitle = isLocked
      ? 'Ветка интеллекта пока в разработке'
      : isMaxed
        ? 'Ветка полностью прокачана'
        : `${nextStage.title} • ${nextStage.cost} очк.`;

    const nextDescription = isLocked
      ? branch.normalText
      : isMaxed
        ? 'Все этапы этой ветки уже открыты.'
        : nextStage.description;

    this.addTo(
      container,
      this.add.text(left + 30, top + 132, nextTitle, {
        fontFamily: UI.font.title,
        fontSize: '16px',
        color: isMaxed ? UI.colors.green : UI.colors.text,
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: {
          width: width - 60,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 30, top + 166, nextDescription, {
        fontFamily: UI.font.body,
        fontSize: '13px',
        color: UI.colors.textMuted,
        lineSpacing: 3,
        wordWrap: {
          width: width - 60,
          useAdvancedWrap: true,
        },
        maxLines: 3,
      }).setOrigin(0, 0.5).setDepth(7)
    );

    const buttonWidth = Math.min(width - 60, 420);
    const buttonY = top + height - 36;

    this.createTreeButton({
      parent: container,
      x: layout.centerX,
      y: buttonY,
      width: buttonWidth,
      height: 50,
      text: isLocked
        ? 'В разработке'
        : isMaxed
          ? 'Изучено полностью'
          : canUpgrade
            ? `Прокачать за ${cost}`
            : `Нужно ${cost} очк.`,
      disabled: isLocked || isMaxed || !canUpgrade,
      accentColor: isLocked ? 0x4a3a27 : branch.accentColor,
      onClick: () => {
        this.upgradeBranch(branch.id);
      },
      depth: 8,
    });
  }

  private createProgressNodes(
    container: Phaser.GameObjects.Container,
    branch: BranchData,
    x: number,
    y: number,
    width: number,
    level: number
  ) {
    if (branch.maxLevel <= 0) {
      this.addTo(
        container,
        this.add.text(x, y, 'Ветка будет добавлена позже', {
          fontFamily: UI.font.body,
          fontSize: '13px',
          color: UI.colors.textMuted,
          wordWrap: {
            width,
          },
          maxLines: 1,
        }).setOrigin(0, 0.5).setDepth(7)
      );

      return;
    }

    const nodeCount = branch.maxLevel;
    const nodeSize = nodeCount > 10 ? 10 : 16;
    const gap = nodeCount > 10
      ? Math.min(15, (width - nodeCount * nodeSize) / Math.max(1, nodeCount - 1))
      : Math.min(26, (width - nodeCount * nodeSize) / Math.max(1, nodeCount - 1));
    const totalWidth = nodeCount * nodeSize + (nodeCount - 1) * gap;
    const startX = x + Math.max(0, (width - totalWidth) / 2) + nodeSize / 2;

    for (let index = 0; index < nodeCount; index += 1) {
      const stage = branch.stages[index];
      const nodeX = startX + index * (nodeSize + gap);
      const unlocked = index < level;
      const isSpecial = stage?.special ?? false;

      this.addTo(
        container,
        this.add.circle(
          nodeX,
          y,
          isSpecial ? nodeSize / 2 + 3 : nodeSize / 2,
          unlocked ? branch.accentColor : 0x17100c,
          unlocked ? 0.95 : 0.98
        )
          .setStrokeStyle(2, isSpecial ? UI.colors.gold : branch.accentColor, unlocked ? 0.9 : 0.45)
          .setDepth(7)
      );

      if (isSpecial) {
        this.addTo(
          container,
          this.add.text(nodeX, y, '★', {
            fontFamily: UI.font.body,
            fontSize: nodeCount > 10 ? '9px' : '12px',
            color: unlocked ? '#ffffff' : UI.colors.goldText,
            stroke: '#000000',
            strokeThickness: 1,
          }).setOrigin(0.5).setDepth(8)
        );
      }
    }
  }

  private createScrollInput(layout: TreeLayout) {
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

  private isPointerInsideContent(pointer: Phaser.Input.Pointer, layout: TreeLayout) {
    return (
      pointer.x >= layout.safeX &&
      pointer.x <= layout.width - layout.safeX &&
      pointer.y >= layout.contentTop &&
      pointer.y <= layout.contentBottom
    );
  }

  private createScrollHint(layout: TreeLayout) {
    const hintY = layout.contentBottom - 18;

    const bg = this.add.rectangle(layout.centerX, hintY, 250, 28, 0x000000, 0.34)
      .setDepth(230);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай дерево', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: UI.colors.textMuted,
    }).setOrigin(0.5).setDepth(231);

    this.tweens.add({
      targets: [bg, text],
      alpha: 0.25,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private createBottomButton(layout: TreeLayout) {
    this.createTreeButton({
      x: layout.centerX,
      y: layout.height - layout.safeBottom - 30,
      width: Math.min(layout.contentWidth, 540),
      height: 56,
      text: 'Вернуться в лагерь',
      accentColor: UI.colors.gold,
      onClick: () => {
        this.scene.start('CampScene');
      },
      depth: 240,
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

    this.scene.restart();
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
  }) {
    const disabled = config.disabled ?? false;
    const depth = config.depth ?? 8;
    const radius = Math.min(20, config.height / 2);
    const fillColor = disabled ? 0x11100e : 0x21150f;
    const textColor = disabled ? UI.colors.textMuted : UI.colors.goldText;

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
      bg.lineStyle(2, config.accentColor, strokeAlpha);
      bg.strokeRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        radius
      );
    };

    draw(fillColor, disabled ? 0.55 : 0.96, disabled ? 0.35 : 0.86);
    bg.setDepth(depth + 1);

    const label = this.add.text(config.x, config.y, config.text, {
      fontFamily: UI.font.title,
      fontSize: '16px',
      color: textColor,
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: config.width - 24,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(depth + 2);

    const zone = this.add.zone(config.x, config.y, config.width, config.height).setDepth(depth + 3);

    if (config.parent) {
      config.parent.add([shadow, bg, label, zone]);
    }

    if (!disabled) {
      zone.setInteractive({ useHandCursor: true });

      zone.on('pointerover', () => {
        draw(0x2c1d14, 1, 1);
        label.setColor('#ffffff');
      });

      zone.on('pointerout', () => {
        draw(fillColor, 0.96, 0.86);
        label.setColor(textColor);
      });

      zone.on('pointerdown', () => {
        draw(0x342015, 0.96, 1);
        label.setY(config.y + 1);
      });

      zone.on('pointerup', () => {
        label.setY(config.y);

        if (this.didDrag) {
          return;
        }

        config.onClick();
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
    depth?: number;
  }) {
    const radius = config.radius ?? 24;
    const color = config.color ?? 0x14100d;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? UI.colors.goldDark;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const depth = config.depth ?? 1;

    const safeWidth = Math.min(config.width, this.scale.width - 24);
    const safeHeight = Math.min(config.height, this.scale.height - 24);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(
      config.x - safeWidth / 2,
      config.y - safeHeight / 2 + 6,
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

    if (config.parent) {
      config.parent.add([shadow, panel]);
    }

    return {
      shadow,
      panel,
    };
  }

  private requireContentContainer() {
    if (!this.contentContainer) {
      throw new Error('Stats tree content container was not created.');
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

    return UI.colors.goldText;
  }
}
