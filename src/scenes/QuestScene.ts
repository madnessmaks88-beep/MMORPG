import Phaser from 'phaser';

import { gameState } from '../data/gameState';
import type { QuestData, QuestGroup } from '../data/quests';
import {
  getQuestGroupDescription,
  getQuestGroupTitle,
} from '../data/quests';

import {
  claimQuestReward,
  getQuestCooldownText,
  getQuestDisplayProgressValue,
  getQuestProgressValue,
  getQuestRewardText,
  getQuestGroupResetText,
  getQuestStatus,
  getQuestTypeLabel,
  getQuests,
} from '../systems/QuestSystem';
import { saveGameAsync } from '../systems/SaveSystem';


import {
  UI,
  createSceneBackground,
} from '../ui/theme';

type QuestSceneData = {
  group?: QuestGroup;
};

type QuestLayout = {
  width: number;
  height: number;
  centerX: number;

  safeX: number;
  safeTop: number;
  safeBottom: number;

  headerHeight: number;
  tabsHeight: number;
  bottomButtonHeight: number;
  bottomButtonTop: number;
  bottomButtonY: number;

  contentTop: number;
  contentBottom: number;
  contentWidth: number;
  viewportHeight: number;

  compact: boolean;
};

type QuestButton = {
  objects: Phaser.GameObjects.GameObject[];
  zone: Phaser.GameObjects.Zone;
};

type AlphaGameObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha;

const QUEST_COLORS = {
  ink: 0x040405,
  black: 0x070708,
  graphite: 0x0c0d10,
  panel: 0x111217,
  panelWarm: 0x17100c,
  card: 0x101014,
  cardWarm: 0x15100d,
  bronze: 0x6b5134,
  bronzeDark: 0x3e2d1e,
  gold: 0xb89a5e,
  goldLight: 0xd8c088,
  ash: 0x8f887b,
  muted: 0x6f665b,
  green: 0x75a982,
  red: 0x8d2f2f,
  blue: 0x5f7f9d,
  violet: 0x62518a,
};

export class QuestScene extends Phaser.Scene {
  private selectedGroup: QuestGroup = 'daily';
  private layout!: QuestLayout;

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

  private isAlphaGameObject(object: Phaser.GameObjects.GameObject): object is AlphaGameObject {
    const candidate = object as Phaser.GameObjects.GameObject & { setAlpha?: unknown };

    return typeof candidate.setAlpha === 'function';
  }

  private getAlphaGameObjects(objects: Phaser.GameObjects.GameObject[]): AlphaGameObject[] {
    return objects.filter((object): object is AlphaGameObject => this.isAlphaGameObject(object));
  }

  constructor() {
    super('QuestScene');
  }

  init(data?: QuestSceneData) {
    this.selectedGroup = data?.group ?? this.selectedGroup ?? 'daily';
  }

  create() {
    this.layout = this.getLayout();

    createSceneBackground(this);
    this.createBackdrop(this.layout);
    this.createHeader(this.layout);
    this.createTabs(this.layout);
    this.createScrollableContent(this.layout);

    // Если при входе наступил новый дневной/недельный период,
    // QuestSystem обновит состояние, а здесь мы сразу сохраним это в VK/local save.
    void saveGameAsync();

    this.createBottomReturnButton(this.layout);
  }

  update() {
    if (!this.contentContainer || this.isDragging) {
      return;
    }

    if (Math.abs(this.currentScrollY - this.targetScrollY) < 0.5) {
      this.currentScrollY = this.targetScrollY;
    } else {
      this.currentScrollY = Phaser.Math.Linear(
        this.currentScrollY,
        this.targetScrollY,
        0.18
      );
    }

    this.contentContainer.y = -this.currentScrollY;
  }

  private getLayout(): QuestLayout {
    const { width, height } = this.scale;

    const compact = height < 1120;
    const safeX = Phaser.Math.Clamp(Math.round(width * 0.045), 18, 32);
    const safeTop = Phaser.Math.Clamp(Math.round(height * 0.024), 18, 34);
    const safeBottom = Phaser.Math.Clamp(Math.round(height * 0.02), 18, 34);
    const bottomButtonHeight = compact ? 56 : 62;
    const bottomButtonTop = height - safeBottom - bottomButtonHeight;
    const bottomButtonY = bottomButtonTop + bottomButtonHeight / 2;
    const headerHeight = compact ? 134 : 148;
    const tabsHeight = compact ? 72 : 78;
    const contentWidth = Math.min(width - safeX * 2, 640);

    const contentTop = safeTop + headerHeight + tabsHeight + 12;
    const contentBottom = bottomButtonTop - 14;

    return {
      width,
      height,
      centerX: width / 2,

      safeX,
      safeTop,
      safeBottom,

      headerHeight,
      tabsHeight,
      bottomButtonHeight,
      bottomButtonTop,
      bottomButtonY,

      contentTop,
      contentBottom,
      contentWidth,
      viewportHeight: Math.max(320, contentBottom - contentTop),

      compact,
    };
  }

  private createBackdrop(layout: QuestLayout) {
    const { width, height, centerX } = layout;

    this.add.rectangle(centerX, height / 2, width, height, QUEST_COLORS.ink, 0.96).setDepth(0);
    this.add.rectangle(centerX, height - 190, width, 380, 0x020202, 0.58).setDepth(0);

    this.add.circle(centerX, layout.safeTop + 132, width * 0.52, QUEST_COLORS.violet, 0.1).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 142, width * 0.34, QUEST_COLORS.bronze, 0.07).setDepth(0);
    this.add.circle(centerX, layout.safeTop + 152, width * 0.16, QUEST_COLORS.gold, 0.035).setDepth(0);

    for (let i = 0; i < 36; i += 1) {
      const x = Phaser.Math.Between(layout.safeX + 8, width - layout.safeX - 8);
      const y = Phaser.Math.Between(layout.safeTop + 70, height - layout.safeBottom - 110);
      const color = i % 6 === 0 ? QUEST_COLORS.gold : i % 4 === 0 ? QUEST_COLORS.violet : QUEST_COLORS.ash;
      const alpha = i % 6 === 0 ? 0.035 : 0.022;

      this.add.circle(x, y, 1 + (i % 3), color, alpha).setDepth(1);
    }

    this.add.text(centerX, layout.safeTop + 138, '☾', {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '86px' : '104px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.026).setDepth(1);
  }

  private createHeader(layout: QuestLayout) {
    const panelY = layout.safeTop + layout.headerHeight / 2;

    this.createRoundedPanel({
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: layout.headerHeight,
      radius: 32,
      color: QUEST_COLORS.graphite,
      alpha: 0.95,
      strokeColor: QUEST_COLORS.bronze,
      strokeAlpha: 0.62,
      strokeWidth: 2,
      glowColor: QUEST_COLORS.violet,
      depth: 100,
    });

    this.add.text(layout.centerX, panelY - (layout.compact ? 48 : 54), 'Задания', {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '31px' : '36px',
      color: '#d8c088',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 48,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(106);

    this.add.text(layout.centerX, panelY - 12, getQuestGroupTitle(this.selectedGroup), {
      fontFamily: UI.font.title,
      fontSize: layout.compact ? '18px' : '20px',
      color: this.getGroupAccentText(this.selectedGroup),
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      wordWrap: {
        width: layout.contentWidth - 52,
        useAdvancedWrap: true,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(106);

    this.add.text(
      layout.centerX,
      panelY + (layout.compact ? 28 : 34),
      `${getQuestGroupDescription(this.selectedGroup)}\n${getQuestGroupResetText(this.selectedGroup)}`,
      {
      fontFamily: UI.font.body,
      fontSize: layout.compact ? '12px' : '13px',
      color: '#9b9488',
      align: 'center',
      lineSpacing: 4,
      wordWrap: {
        width: layout.contentWidth - 68,
        useAdvancedWrap: true,
      },
      maxLines: 3,
    }).setOrigin(0.5).setDepth(106);
  }

  private createTabs(layout: QuestLayout) {
    const y = layout.safeTop + layout.headerHeight + layout.tabsHeight / 2 + 2;
    const gap = 10;
    const tabWidth = Math.floor((layout.contentWidth - gap * 2) / 3);

    const tabs: Array<{
      group: QuestGroup;
      label: string;
      icon: string;
    }> = [
      { group: 'daily', label: 'День', icon: 'I' },
      { group: 'weekly', label: 'Неделя', icon: 'II' },
      { group: 'special', label: 'Особые', icon: 'III' },
    ];

    const startX = layout.centerX - layout.contentWidth / 2 + tabWidth / 2;

    tabs.forEach((tab, index) => {
      const x = startX + index * (tabWidth + gap);
      const active = this.selectedGroup === tab.group;
      const accent = this.getGroupAccent(tab.group);
      const count = this.getClaimableCount(tab.group);

      this.createTabButton({
        x,
        y,
        width: tabWidth,
        height: layout.compact ? 58 : 62,
        label: tab.label,
        icon: tab.icon,
        count,
        active,
        accentColor: accent,
        onClick: () => {
          this.scene.restart({
            group: tab.group,
          });
        },
      });
    });
  }

  private getClaimableCount(group: QuestGroup) {
    return getQuests(group).filter(quest => getQuestStatus(quest) === 'claimable').length;
  }

  private createScrollableContent(layout: QuestLayout) {
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

    cursorY = this.createSummaryPanel(layout, cursorY);

    const questList = getQuests(this.selectedGroup);

    if (questList.length === 0) {
      cursorY = this.createEmptyPanel(layout, cursorY + 14);
    } else {
      questList.forEach(quest => {
        const height = this.getQuestCardHeight(layout, quest);
        this.createQuestCard(layout, quest, cursorY + height / 2, height);
        cursorY += height + (layout.compact ? 13 : 15);
      });
    }

    const contentHeight = cursorY - layout.contentTop + 24;

    this.maxScrollY = Math.max(0, contentHeight - layout.viewportHeight);
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScrollY);
    this.targetScrollY = Phaser.Math.Clamp(this.targetScrollY, 0, this.maxScrollY);

    this.contentContainer.y = -this.currentScrollY;

    this.createScrollInput(layout);

    if (this.maxScrollY > 0) {
      this.createScrollHint(layout);
    }
  }

  private createSummaryPanel(layout: QuestLayout, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = layout.compact ? 118 : 128;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: QUEST_COLORS.panelWarm,
      alpha: 0.92,
      strokeColor: QUEST_COLORS.bronze,
      strokeAlpha: 0.42,
      strokeWidth: 1,
      glowColor: QUEST_COLORS.gold,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 30, 'Журнал поручений', {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '21px' : '23px',
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

    const progressText = [
      `Враги: ${gameState.questProgress.enemiesKilled}`,
      `Сундуки: ${gameState.questProgress.chestsOpened}`,
      `Золото: ${gameState.questProgress.goldEarned}`,
      `Подземелья: ${gameState.questProgress.dungeonsCompleted}`,
    ].join('  •  ');

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 68, progressText, {
        fontFamily: UI.font.body,
        fontSize: layout.compact ? '12px' : '13px',
        color: '#b8aa91',
        align: 'center',
        lineSpacing: 4,
        wordWrap: {
          width: layout.contentWidth - 64,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(layout.centerX, topY + 102, 'Готовые квесты поднимаются вверх. Полученные награды уходят вниз до обновления.', {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: '#8f806d',
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 64,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }).setOrigin(0.5).setDepth(8)
    );

    return topY + panelHeight;
  }

  private createEmptyPanel(layout: QuestLayout, topY: number) {
    const container = this.requireContentContainer();
    const panelHeight = 170;
    const panelY = topY + panelHeight / 2;

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y: panelY,
      width: layout.contentWidth,
      height: panelHeight,
      radius: 30,
      color: QUEST_COLORS.graphite,
      alpha: 0.9,
      strokeColor: QUEST_COLORS.bronze,
      strokeAlpha: 0.38,
      strokeWidth: 1,
      glowColor: QUEST_COLORS.violet,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.text(layout.centerX, panelY, 'Заданий пока нет.', {
        fontFamily: UI.font.title,
        fontSize: '22px',
        color: '#8f806d',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        wordWrap: {
          width: layout.contentWidth - 70,
        },
      }).setOrigin(0.5).setDepth(8)
    );

    return topY + panelHeight;
  }

  private getQuestCardHeight(layout: QuestLayout, quest: QuestData) {
    const status = getQuestStatus(quest);

    if (status === 'cooldown' || status === 'claimed') {
      return layout.compact ? 178 : 190;
    }

    if (quest.group === 'special') {
      return layout.compact ? 244 : 260;
    }

    return layout.compact ? 224 : 238;
  }

  private createQuestCard(layout: QuestLayout, quest: QuestData, y: number, height: number) {
    const container = this.requireContentContainer();
    const status = getQuestStatus(quest);
    const progress = getQuestProgressValue(quest);
    const displayProgress = getQuestDisplayProgressValue(quest);
    const progressRatio = Phaser.Math.Clamp(displayProgress / Math.max(1, quest.target), 0, 1);

    const width = layout.contentWidth;
    const left = layout.centerX - width / 2;
    const right = layout.centerX + width / 2;
    const top = y - height / 2;

    const accentColor = this.getCardAccent(quest, status);
    const muted = status === 'cooldown' || status === 'claimed';

    this.createRoundedPanel({
      parent: container,
      x: layout.centerX,
      y,
      width,
      height,
      radius: 30,
      color: muted ? QUEST_COLORS.graphite : QUEST_COLORS.cardWarm,
      alpha: muted ? 0.82 : 0.96,
      strokeColor: accentColor,
      strokeAlpha: status === 'claimable' ? 0.9 : muted ? 0.24 : 0.55,
      strokeWidth: status === 'claimable' ? 3 : 2,
      glowColor: accentColor,
      depth: 2,
    });

    this.addTo(
      container,
      this.add.rectangle(left + 8, y, 5, height - 36, accentColor, muted ? 0.22 : status === 'claimable' ? 0.9 : 0.62)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.circle(left + 46, top + 48, 27, accentColor, muted ? 0.08 : 0.16)
        .setStrokeStyle(2, accentColor, muted ? 0.25 : 0.72)
        .setDepth(7)
    );

    this.addTo(
      container,
      this.add.text(left + 46, top + 48, this.getQuestIcon(quest, status), {
        fontFamily: UI.font.body,
        fontSize: status === 'claimable' ? '23px' : '20px',
        color: muted ? '#6f665b' : '#f1eadc',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(left + 84, top + 28, quest.title, {
        fontFamily: UI.font.title,
        fontSize: layout.compact ? '18px' : '20px',
        color: muted ? '#8f806d' : status === 'claimable' ? '#9fd0a6' : '#d8c088',
        stroke: '#000000',
        strokeThickness: 4,
        wordWrap: {
          width: width - 190,
          useAdvancedWrap: true,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.createStatusPill(container, right - 58, top + 31, quest, status);

    this.addTo(
      container,
      this.add.text(left + 84, top + 58, getQuestTypeLabel(quest.type), {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: muted ? '#6f665b' : this.getGroupAccentText(quest.group),
        wordWrap: {
          width: width - 160,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(8)
    );

    this.addTo(
      container,
      this.add.text(left + 28, top + 94, quest.description, {
        fontFamily: UI.font.body,
        fontSize: layout.compact ? '12px' : '13px',
        color: muted ? '#7a7166' : '#c9b99b',
        lineSpacing: 4,
        wordWrap: {
          width: width - 56,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }).setOrigin(0, 0).setDepth(8)
    );

    const progressY = top + (layout.compact ? 146 : 154);
    this.createProgressBar({
      parent: container,
      x: left + 28,
      y: progressY,
      width: width - 56,
      height: 12,
      progress: progressRatio,
      accentColor,
      muted,
    });

    this.addTo(
      container,
      this.add.text(left + 28, progressY + 24, `${displayProgress}/${quest.target}`, {
        fontFamily: UI.font.body,
        fontSize: '12px',
        color: status === 'claimable' ? '#9fd0a6' : muted ? '#6f665b' : '#b8aa91',
        wordWrap: {
          width: 120,
        },
        maxLines: 1,
      }).setOrigin(0, 0.5).setDepth(10)
    );

    this.addTo(
      container,
      this.add.text(right - 28, progressY + 24, getQuestRewardText(quest), {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: muted ? '#6f665b' : '#d8c088',
        align: 'right',
        wordWrap: {
          width: width - 168,
          useAdvancedWrap: true,
        },
        maxLines: 2,
      }).setOrigin(1, 0.5).setDepth(10)
    );

    if (status === 'cooldown' || status === 'claimed') {
      const cooldownText = status === 'claimed'
        ? 'Особое задание закрыто'
        : `Обновление через ${getQuestCooldownText(quest)}`;

      this.addTo(
        container,
        this.add.text(layout.centerX, top + height - 30, cooldownText, {
          fontFamily: UI.font.body,
          fontSize: '13px',
          color: '#8f806d',
          align: 'center',
          wordWrap: {
            width: width - 60,
          },
          maxLines: 1,
        }).setOrigin(0.5).setDepth(10)
      );

      return;
    }

    const buttonY = top + height - 33;
    const buttonText = status === 'claimable'
      ? 'Забрать награду'
      : `Осталось ${Math.max(0, quest.target - progress)}`;

    this.createQuestButton({
      parent: container,
      x: layout.centerX,
      y: buttonY,
      width: Math.min(width - 56, 440),
      height: 50,
      text: buttonText,
      accentColor,
      disabled: status !== 'claimable',
      variant: status === 'claimable' ? 'green' : 'dark',
      onClick: () => {
        this.claimQuest(quest);
      },
      depth: 9,
    });
  }

  private createStatusPill(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    quest: QuestData,
    status: ReturnType<typeof getQuestStatus>
  ) {
    const text = status === 'claimable'
      ? 'готово'
      : status === 'cooldown'
        ? 'ожид.'
        : status === 'claimed'
          ? 'закрыто'
          : quest.group === 'special'
            ? 'особое'
            : 'активно';

    const color = status === 'claimable'
      ? QUEST_COLORS.green
      : status === 'claimed' || status === 'cooldown'
        ? QUEST_COLORS.muted
        : this.getGroupAccent(quest.group);

    this.createRoundedPanel({
      parent: container,
      x,
      y,
      width: 86,
      height: 30,
      radius: 15,
      color: status === 'claimable' ? 0x0f1510 : 0x11100e,
      alpha: 0.94,
      strokeColor: color,
      strokeAlpha: status === 'claimable' ? 0.7 : 0.38,
      strokeWidth: 1,
      glowColor: color,
      depth: 8,
    });

    this.addTo(
      container,
      this.add.text(x, y, text, {
        fontFamily: UI.font.body,
        fontSize: '11px',
        color: status === 'claimable' ? '#9fd0a6' : status === 'active' ? '#d8c088' : '#7a7166',
        align: 'center',
        wordWrap: {
          width: 74,
        },
        maxLines: 1,
      }).setOrigin(0.5).setDepth(11)
    );
  }

  private createProgressBar(config: {
    parent: Phaser.GameObjects.Container;
    x: number;
    y: number;
    width: number;
    height: number;
    progress: number;
    accentColor: number;
    muted: boolean;
  }) {
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.38);
    bg.fillRoundedRect(
      config.x,
      config.y - config.height / 2,
      config.width,
      config.height,
      config.height / 2
    );
    bg.setDepth(8);

    const track = this.add.graphics();
    track.fillStyle(0x1b1714, 0.96);
    track.fillRoundedRect(
      config.x,
      config.y - config.height / 2,
      config.width,
      config.height,
      config.height / 2
    );
    track.setDepth(9);

    config.parent.add([bg, track]);

    if (config.progress > 0) {
      const fill = this.add.graphics();
      fill.fillStyle(config.accentColor, config.muted ? 0.32 : 0.9);
      fill.fillRoundedRect(
        config.x,
        config.y - config.height / 2,
        config.width * config.progress,
        config.height,
        config.height / 2
      );
      fill.setDepth(10);
      config.parent.add(fill);
    }
  }

  private claimQuest(quest: QuestData) {
    if (this.didDrag) {
      return;
    }

    const result = claimQuestReward(quest.id);

    void saveGameAsync();

    this.showModal({
      title: result.title,
      description: result.message,
      confirmText: 'Понятно',
      onConfirm: () => {
        this.scene.restart({
          group: this.selectedGroup,
        });
      },
    });
  }

  private createScrollInput(layout: QuestLayout) {
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

  private isPointerInsideContent(pointer: Phaser.Input.Pointer, layout: QuestLayout) {
    return (
      pointer.x >= layout.safeX &&
      pointer.x <= layout.width - layout.safeX &&
      pointer.y >= layout.contentTop &&
      pointer.y <= layout.contentBottom
    );
  }

  private createScrollHint(layout: QuestLayout) {
    const hintY = layout.contentBottom - 18;

    const bg = this.add.rectangle(layout.centerX, hintY, 238, 28, 0x000000, 0.4)
      .setDepth(230);

    const text = this.add.text(layout.centerX, hintY, 'Прокручивай задания', {
      fontFamily: UI.font.body,
      fontSize: '12px',
      color: '#8f806d',
      align: 'center',
      wordWrap: {
        width: 220,
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


  private createBottomReturnButton(layout: QuestLayout) {
    const dockHeight = layout.bottomButtonHeight + layout.safeBottom + 20;
    const dockY = layout.bottomButtonTop + dockHeight / 2 - 4;

    this.add.rectangle(layout.centerX, dockY, layout.width, dockHeight, 0x020202, 0.86)
      .setDepth(240);

    this.add.rectangle(layout.centerX, layout.bottomButtonTop - 8, layout.contentWidth, 1, QUEST_COLORS.bronze, 0.34)
      .setDepth(241);

    const glow = this.add.rectangle(
      layout.centerX,
      layout.bottomButtonY,
      Math.min(layout.contentWidth - 34, 520),
      layout.bottomButtonHeight + 8,
      QUEST_COLORS.gold,
      0.035
    ).setDepth(242);

    const button = this.createQuestButton({
      x: layout.centerX,
      y: layout.bottomButtonY,
      width: Math.min(layout.contentWidth - 30, 520),
      height: layout.bottomButtonHeight,
      text: '← Вернуться в город',
      accentColor: QUEST_COLORS.gold,
      variant: 'gold',
      depth: 245,
      onClick: () => {
        if (this.modalObjects.length > 0) {
          return;
        }

        this.scene.start('CampScene');
      },
    });

    const animatedObjects = this.getAlphaGameObjects([glow, ...button.objects]);
    animatedObjects.forEach(object => object.setAlpha(0));

    this.tweens.add({
      targets: animatedObjects,
      alpha: 1,
      y: '+=0',
      duration: 260,
      delay: 140,
      ease: 'Cubic.easeOut',
    });
  }

  private showModal(config: {
    title: string;
    description: string;
    confirmText: string;
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
      color: QUEST_COLORS.panelWarm,
      alpha: 0.98,
      strokeColor: QUEST_COLORS.bronze,
      strokeAlpha: 0.88,
      strokeWidth: 3,
      glowColor: QUEST_COLORS.gold,
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
      QUEST_COLORS.gold,
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

    const confirmButton = this.createQuestButton({
      x: centerX,
      y: centerY + modalHeight / 2 - 48,
      width: Math.min(modalWidth - 94, 390),
      height: 54,
      text: config.confirmText,
      accentColor: QUEST_COLORS.gold,
      variant: 'gold',
      onClick: () => {
        closeModal();
        config.onConfirm();
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
      confirmButton.objects[0],
      confirmButton.objects[1],
      confirmButton.objects[2],
      confirmButton.objects[3]
    );
  }

  private createTabButton(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    icon: string;
    count: number;
    active: boolean;
    accentColor: number;
    onClick: () => void;
  }) {
    const radius = 18;
    const fill = config.active ? 0x21150f : QUEST_COLORS.graphite;
    const strokeAlpha = config.active ? 0.82 : 0.32;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2 + 5,
      config.width,
      config.height,
      radius
    );
    shadow.setDepth(120);

    const bg = this.add.graphics();
    bg.fillStyle(fill, config.active ? 0.96 : 0.78);
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
    bg.setDepth(121);

    this.add.text(config.x, config.y - 12, config.label, {
      fontFamily: UI.font.title,
      fontSize: '15px',
      color: config.active ? '#d8c088' : '#9b9488',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: {
        width: config.width - 12,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(122);

    const bottomText = config.count > 0 ? `готово: ${config.count}` : config.icon;

    this.add.text(config.x, config.y + 15, bottomText, {
      fontFamily: UI.font.body,
      fontSize: '11px',
      color: config.count > 0 ? '#9fd0a6' : '#6f665b',
      align: 'center',
      wordWrap: {
        width: config.width - 12,
      },
      maxLines: 1,
    }).setOrigin(0.5).setDepth(122);

    const zone = this.add.zone(config.x, config.y, config.width, config.height)
      .setDepth(123)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', config.onClick);
  }

  private createQuestButton(config: {
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
  }): QuestButton {
    const disabled = config.disabled ?? false;
    const depth = config.depth ?? 8;
    const variant = config.variant ?? 'gold';
    const radius = Math.min(20, config.height / 2);

    const strokeColor = disabled
      ? 0x3c342c
      : variant === 'green'
        ? QUEST_COLORS.green
        : variant === 'red'
          ? QUEST_COLORS.red
          : variant === 'dark'
            ? QUEST_COLORS.bronze
            : config.accentColor;

    const fillColor = disabled
      ? 0x11100e
      : variant === 'green'
        ? 0x102016
        : variant === 'red'
          ? 0x241010
          : variant === 'dark'
            ? QUEST_COLORS.graphite
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
      fontSize: '14px',
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
    const objects: Phaser.GameObjects.GameObject[] = [shadow, bg, label, zone];

    if (config.parent) {
      config.parent.add(objects);
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
      objects,
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
    const color = config.color ?? QUEST_COLORS.panelWarm;
    const alpha = config.alpha ?? 0.92;
    const strokeColor = config.strokeColor ?? QUEST_COLORS.bronze;
    const strokeAlpha = config.strokeAlpha ?? 0.45;
    const strokeWidth = config.strokeWidth ?? 2;
    const glowColor = config.glowColor ?? QUEST_COLORS.gold;
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
      throw new Error('Quest content container was not created.');
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

  private getQuestIcon(quest: QuestData, status: ReturnType<typeof getQuestStatus>) {
    if (status === 'claimable') return '!';
    if (status === 'cooldown') return '⌛';
    if (status === 'claimed') return '✓';

    if (quest.group === 'daily') return 'I';
    if (quest.group === 'weekly') return 'II';
    return '★';
  }

  private getCardAccent(quest: QuestData, status: ReturnType<typeof getQuestStatus>) {
    if (status === 'claimable') return QUEST_COLORS.green;
    if (status === 'cooldown' || status === 'claimed') return QUEST_COLORS.muted;

    return this.getGroupAccent(quest.group);
  }

  private getGroupAccent(group: QuestGroup) {
    if (group === 'daily') return QUEST_COLORS.gold;
    if (group === 'weekly') return QUEST_COLORS.blue;
    return QUEST_COLORS.violet;
  }

  private getGroupAccentText(group: QuestGroup) {
    if (group === 'daily') return '#d8c088';
    if (group === 'weekly') return '#9ec3ff';
    return '#d4a8ff';
  }
}
