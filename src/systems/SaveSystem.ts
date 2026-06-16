import { player, type PlayerData } from '../data/player';

import {
  gameState,
  createEmptyFloorRun,
  getCurrentTierByFloor,
  type FloorRun,
  type QuestProgress,
} from '../data/gameState';

import { races, type RaceId } from '../data/races';

import {
  getCachedVKUser,
  isVKBridgeReady,
  subscribeVKBridgeEvents,
  vkStorageGet,
  vkStorageSet,
  wasLastVKStorageGetFailed,
  wasLastVKStorageSetFailed,
} from './VKBridgeSystem';

type SavePlayerData = PlayerData & {
  characterTreePoints?: number;
  characterTree?: Partial<Record<string, number>>;
  shopRefreshCoupons?: number;
};

function getSavePlayer() {
  return player as SavePlayerData;
}

function normalizePlayerSave() {
  const savePlayer = getSavePlayer();

  player.materials ??= {};
  player.anvilLevel ??= 1;
  player.crystalsUnlocked ??= false;
  savePlayer.characterTreePoints ??= 0;
  savePlayer.characterTree ??= {};
  savePlayer.shopRefreshCoupons ??= 0;
  player.upgradePoints ??= 0;
  player.totalUpgradePointsEarned ??= 0;
}

const SAVE_KEY = 'below_ashes_save_v3';
const LOCAL_BACKUP_KEY = `${SAVE_KEY}_local_backup`;
const LAST_GOOD_SAVE_KEY = `${SAVE_KEY}_last_good`;

const STARTING_PLAYER_STATE: SavePlayerData = {
  name: 'Безымянный',
  raceId: undefined,

  level: 1,
  exp: 0,
  expToNextLevel: 70,
  gold: 500,

  hp: 100,
  maxHp: 100,

  energy: 3,
  maxEnergy: 3,

  potions: 6,

  attack: 12,
  defense: 3,
  critChance: 0.1,

  agility: 5,
  luck: 5,

  strength: 11,
  intelligence: 11,

  upgradePoints: 0,
  totalUpgradePointsEarned: 0,

  characterTreePoints: 0,
  characterTree: {},
  shopRefreshCoupons: 0,

  relicIds: [],

  inventory: [],
  equipment: {},

  materials: {},

  anvilLevel: 1,

  crystalsUnlocked: false,
};

const LOCAL_RESET_KEYS = [
  SAVE_KEY,
  LOCAL_BACKUP_KEY,
  LAST_GOOD_SAVE_KEY,

  'below_ashes_save_v2',
  'below_ashes_save_v1',
  'catacombs_save_v3',
  'catacombs_save_v2',
  'catacombs_save_v1',

  'catacombs_shop_assortment_v3',
  'catacombs_shop_assortment_v2',
  'catacombs_shop_assortment_v1',

  'below_ashes_campfire_battle_checkpoint_v1',
  'campfire_battle_checkpoint_v1',
  'campfire_checkpoint_v1',
  'campfire_last_rest_at',

  'quest_state_v1',
  'quests_state_v1',
  'stats_tree_v1',
  'character_tree_v1',

  'start_gold_500_v1',
];

export type SaveSource = 'vk' | 'local' | 'none';

export type LoadGameOptions = {
  preferVK?: boolean;
  blockLocalFallback?: boolean;
};

export type LoadGameResult = {
  source: SaveSource;
  hasSave: boolean;
  cloudFailed: boolean;
};

export type ResumeSceneName = 'DungeonScene' | 'BattleScene';

export type BattleResumeState = {
  enemyId: string;
  enemyHp: number;
  enemyMaxHp: number;
  returnToDungeon: boolean;
  floor: number;
  roomIndex: number;
  roomId?: string;
  savedAt: number;
};

export type ResumeState = {
  scene: ResumeSceneName | null;
  updatedAt: number;
  floor?: number;
  roomIndex?: number;
  battle?: BattleResumeState;
};

type SaveData = {
  version: number;
  savedAt: number;
  vkUserId?: number;
  player: PlayerData;
  gameState: {
    currentDungeonId: string;
    currentRoomIndex: number;
    dungeonCompleted: boolean;
    unlockedDungeonIds: string[];

    lastCampRestAt: number;

    highestClearedFloor: number;
    highestClearedTier: number;

    floorRun: FloorRun;

    questProgress: QuestProgress & Record<string, unknown>;
  };

  resumeState?: ResumeState;
};

let lastLoadSource: SaveSource = 'none';
let lastLoadHadCloudFailure = false;
let vkSaveLoadedThisSession = false;
let vkSaveConfirmedEmptyThisSession = false;
let cloudSaveWriteBlocked = false;

let pendingCloudSaveJson: string | null = null;
let cloudSavePromise: Promise<boolean> | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;
let autoSaveGuardsInstalled = false;
let unsubscribeVKBridgeEvents: (() => void) | undefined;

let resumeState: ResumeState = {
  scene: null,
  updatedAt: 0,
};

function createSaveData(): SaveData {
  const vkUser = getCachedVKUser();

  return {
    version: 3,
    savedAt: Date.now(),
    vkUserId: vkUser?.id,
    player: clone(player),
    gameState: {
      currentDungeonId: gameState.currentDungeonId,
      currentRoomIndex: gameState.currentRoomIndex,
      dungeonCompleted: gameState.dungeonCompleted,
      unlockedDungeonIds: [...gameState.unlockedDungeonIds],

      lastCampRestAt: gameState.lastCampRestAt,

      highestClearedFloor: gameState.highestClearedFloor,
      highestClearedTier: gameState.highestClearedTier,

      floorRun: clone(gameState.floorRun),

      questProgress: clone(gameState.questProgress),
    },
    resumeState: normalizeResumeState(resumeState),
  };
}

function applySaveData(saveData: Partial<SaveData>) {
  if (saveData.player) {
    Object.assign(player, saveData.player);
    normalizePlayerSave();
  }

  if (saveData.gameState) {
    Object.assign(gameState, saveData.gameState);
  }

  resumeState = normalizeResumeState(saveData.resumeState);

  fixMissingPlayerFields();
  fixMissingGameStateFields();
}

function fixMissingPlayerFields() {
  if (player.name === undefined) player.name = 'Безымянный';

  if (player.level === undefined) player.level = 1;
  if (player.exp === undefined) player.exp = 0;
  if (player.expToNextLevel === undefined) player.expToNextLevel = 70;
  if (player.gold === undefined) player.gold = 500;

  if (player.maxHp === undefined) player.maxHp = 100;
  if (player.hp === undefined) player.hp = player.maxHp;

  if (player.maxEnergy === undefined) player.maxEnergy = 3;
  if (player.energy === undefined) player.energy = player.maxEnergy;

  if (player.potions === undefined) player.potions = 6;

  if (player.attack === undefined) player.attack = 12;
  if (player.defense === undefined) player.defense = 3;
  if (player.critChance === undefined) player.critChance = 0.1;

  if (player.agility === undefined) player.agility = 5;
  if (player.luck === undefined) player.luck = 5;
  if (player.strength === undefined) player.strength = 11;
  if (player.intelligence === undefined) player.intelligence = 11;

  if (player.raceId !== undefined && !isValidRaceId(player.raceId)) {
    player.raceId = undefined;
  }

  if (!player.relicIds) player.relicIds = [];

  if (!player.inventory) player.inventory = [];
  if (!player.equipment) player.equipment = {};

  const savePlayer = getSavePlayer();

  player.upgradePoints ??= 0;
  player.totalUpgradePointsEarned ??= 0;
  savePlayer.characterTreePoints ??= 0;
  savePlayer.characterTree ??= {};
  savePlayer.shopRefreshCoupons ??= 0;

  player.hp = clamp(player.hp, 1, player.maxHp);
  player.energy = clamp(player.energy, 0, player.maxEnergy);

  player.materials ??= {};
  player.anvilLevel ??= 1;
  player.crystalsUnlocked ??= false;
}

function fixMissingGameStateFields() {
  if (!gameState.currentDungeonId) gameState.currentDungeonId = 'tower_depths';
  if (gameState.currentRoomIndex === undefined) gameState.currentRoomIndex = 0;
  if (gameState.dungeonCompleted === undefined) gameState.dungeonCompleted = false;
  if (!gameState.unlockedDungeonIds) gameState.unlockedDungeonIds = ['tower_depths'];

  if (gameState.lastCampRestAt === undefined) gameState.lastCampRestAt = 0;

  if (gameState.highestClearedFloor === undefined) gameState.highestClearedFloor = 0;
  if (gameState.highestClearedTier === undefined) gameState.highestClearedTier = 0;

  if (!gameState.floorRun) {
    gameState.floorRun = createEmptyFloorRun();
  }

  if (gameState.floorRun.active === undefined) gameState.floorRun.active = false;
  if (gameState.floorRun.currentFloor === undefined) gameState.floorRun.currentFloor = 1;
  if (gameState.floorRun.currentRoomIndex === undefined) gameState.floorRun.currentRoomIndex = 0;
  if (!gameState.floorRun.rooms) gameState.floorRun.rooms = [];
  if (gameState.floorRun.rewardClaimed === undefined) gameState.floorRun.rewardClaimed = false;
  if (!gameState.floorRun.modifier) gameState.floorRun.modifier = 'normal';

  if (!gameState.floorRun.runType) gameState.floorRun.runType = 'tier';
  if (gameState.floorRun.targetTier === undefined) {
    gameState.floorRun.targetTier = getCurrentTierByFloor(gameState.floorRun.currentFloor || 1);
  }

  if (gameState.floorRun.monstersDefeated === undefined) gameState.floorRun.monstersDefeated = 0;
  if (gameState.floorRun.chestsOpened === undefined) gameState.floorRun.chestsOpened = 0;
  if (gameState.floorRun.trapsTriggered === undefined) gameState.floorRun.trapsTriggered = 0;
  if (gameState.floorRun.goldEarned === undefined) gameState.floorRun.goldEarned = 0;
  if (gameState.floorRun.expEarned === undefined) gameState.floorRun.expEarned = 0;

  gameState.floorRun.materialsEarned ??= {};

  if (!gameState.questProgress) {
    gameState.questProgress = {
      enemiesKilled: 0,
      chestsOpened: 0,
      dungeonsCompleted: 0,
      goldEarned: 0,
      claimedQuestIds: [],
    };
  }

  if (gameState.questProgress.enemiesKilled === undefined) gameState.questProgress.enemiesKilled = 0;
  if (gameState.questProgress.chestsOpened === undefined) gameState.questProgress.chestsOpened = 0;
  if (gameState.questProgress.dungeonsCompleted === undefined) gameState.questProgress.dungeonsCompleted = 0;
  if (gameState.questProgress.goldEarned === undefined) gameState.questProgress.goldEarned = 0;
  if (!gameState.questProgress.claimedQuestIds) gameState.questProgress.claimedQuestIds = [];
}

function isValidRaceId(raceId: unknown): raceId is RaceId {
  return typeof raceId === 'string' && races.some(race => race.id === raceId);
}



function normalizeResumeState(value?: Partial<ResumeState>): ResumeState {
  if (!value || typeof value !== 'object') {
    return {
      scene: null,
      updatedAt: 0,
    };
  }

  const scene = value.scene === 'DungeonScene' || value.scene === 'BattleScene'
    ? value.scene
    : null;

  const battle = value.battle && typeof value.battle === 'object'
    ? {
      enemyId: String(value.battle.enemyId ?? ''),
      enemyHp: Number(value.battle.enemyHp ?? 1),
      enemyMaxHp: Number(value.battle.enemyMaxHp ?? 1),
      returnToDungeon: Boolean(value.battle.returnToDungeon),
      floor: Number(value.battle.floor ?? 1),
      roomIndex: Number(value.battle.roomIndex ?? 0),
      roomId: value.battle.roomId ? String(value.battle.roomId) : undefined,
      savedAt: Number(value.battle.savedAt ?? Date.now()),
    }
    : undefined;

  return {
    scene,
    updatedAt: Number(value.updatedAt ?? 0),
    floor: typeof value.floor === 'number' ? value.floor : undefined,
    roomIndex: typeof value.roomIndex === 'number' ? value.roomIndex : undefined,
    battle: scene === 'BattleScene' && battle?.enemyId ? battle : undefined,
  };
}

function writeLocalBackups(json: string) {
  try {
    localStorage.setItem(LOCAL_BACKUP_KEY, json);
    localStorage.setItem(LAST_GOOD_SAVE_KEY, json);
  } catch (error) {
    console.warn('Local backup save failed.', error);
  }
}

async function saveQueuedCloudJson() {
  let lastResult = false;

  while (pendingCloudSaveJson) {
    const json = pendingCloudSaveJson;
    pendingCloudSaveJson = null;

    lastResult = await saveJsonToCloud(json);
  }

  cloudSavePromise = null;
  return lastResult;
}

async function saveJsonToCloud(json: string) {
  if (!isVKBridgeReady()) {
    return false;
  }

  let saveData: SaveData | null = null;

  try {
    saveData = JSON.parse(json) as SaveData;
  } catch {
    return false;
  }

  if (cloudSaveWriteBlocked && isDangerousFreshDefaultSave(saveData)) {
    console.warn('Cloud save skipped: refusing to upload a fresh default save after VK storage read failure.');
    return false;
  }

  const saved = await vkStorageSet(SAVE_KEY, json);

  if (saved) {
    try {
      localStorage.setItem(SAVE_KEY, json);
    } catch (error) {
      console.warn('Local cloud mirror save failed.', error);
    }

    cloudSaveWriteBlocked = false;
    return true;
  }

  if (wasLastVKStorageSetFailed()) {
    console.warn('Cloud save failed. Local backup was kept and will be retried later.');
  }

  return false;
}

export async function saveGameAsync() {
  fixMissingPlayerFields();
  fixMissingGameStateFields();

  const saveData = createSaveData();
  const json = JSON.stringify(saveData);

  // Важно: локальный резерв пишется синхронно сразу.
  // Если игрок резко уйдёт в чат VK, последний прогресс останется в безопасном кэше
  // и при следующем запуске будет отправлен обратно в VK Storage.
  writeLocalBackups(json);

  pendingCloudSaveJson = json;

  if (!cloudSavePromise) {
    cloudSavePromise = saveQueuedCloudJson();
  }

  return cloudSavePromise;
}

export async function loadGameAsync(options: LoadGameOptions = {}): Promise<LoadGameResult> {
  const preferVK = options.preferVK ?? isVKBridgeReady();
  const blockLocalFallback = options.blockLocalFallback ?? false;

  lastLoadHadCloudFailure = false;

  const localRawSaveAtStart = getBestLocalSave();

  if (preferVK && isVKBridgeReady()) {
    const rawVKSave = await vkStorageGet(SAVE_KEY);

    if (rawVKSave) {
      const saveChoice = chooseAccountSafeNewestSave(rawVKSave, localRawSaveAtStart);
      const loaded = tryApplyRawSave(saveChoice.raw);

      if (loaded) {
        try {
          localStorage.setItem(SAVE_KEY, saveChoice.raw);
          localStorage.setItem(LOCAL_BACKUP_KEY, saveChoice.raw);
          localStorage.setItem(LAST_GOOD_SAVE_KEY, saveChoice.raw);
        } catch (error) {
          console.warn('Local save mirror update failed.', error);
        }

        lastLoadSource = 'vk';
        vkSaveLoadedThisSession = true;
        vkSaveConfirmedEmptyThisSession = false;
        cloudSaveWriteBlocked = false;

        if (saveChoice.usedLocalBackup) {
          // VK Storage отстал, а локальный резерв свежее. Не запускаем локальный режим,
          // а сразу восстанавливаем свежий прогресс и отправляем его в аккаунт VK.
          void saveGameAsync();
        }

        return {
          source: 'vk',
          hasSave: true,
          cloudFailed: false,
        };
      }

      lastLoadHadCloudFailure = true;
      cloudSaveWriteBlocked = true;

      if (blockLocalFallback) {
        throw new Error('VK save exists but could not be parsed. Local fallback is blocked to protect cloud progress.');
      }
    }

    if (wasLastVKStorageGetFailed()) {
      lastLoadHadCloudFailure = true;
      cloudSaveWriteBlocked = true;

      if (blockLocalFallback) {
        throw new Error('VK storage is temporarily unavailable. Local fallback is blocked to protect player progress.');
      }
    } else {
      vkSaveConfirmedEmptyThisSession = true;
      cloudSaveWriteBlocked = false;
    }
  }

  const localRawSave = localRawSaveAtStart;

  if (localRawSave) {
    const loaded = tryApplyRawSave(localRawSave);

    if (loaded) {
      lastLoadSource = 'local';

      if (isVKBridgeReady() && vkSaveConfirmedEmptyThisSession && !isDangerousFreshDefaultSave(createSaveData())) {
        void saveGameAsync();
      }

      return {
        source: 'local',
        hasSave: true,
        cloudFailed: lastLoadHadCloudFailure,
      };
    }
  }

  fixMissingPlayerFields();
  fixMissingGameStateFields();

  lastLoadSource = 'none';

  return {
    source: 'none',
    hasSave: false,
    cloudFailed: lastLoadHadCloudFailure,
  };
}


function chooseAccountSafeNewestSave(rawVKSave: string, localRawSave: string | null) {
  const vkInfo = getRawSaveInfo(rawVKSave);
  const localInfo = localRawSave ? getRawSaveInfo(localRawSave) : null;

  if (
    localRawSave &&
    vkInfo &&
    localInfo &&
    localInfo.savedAt > vkInfo.savedAt + 1000 &&
    isLocalBackupSafeForCurrentAccount(localInfo.data, vkInfo.data)
  ) {
    return {
      raw: localRawSave,
      usedLocalBackup: true,
    };
  }

  return {
    raw: rawVKSave,
    usedLocalBackup: false,
  };
}

function getRawSaveInfo(rawSave: string) {
  try {
    const data = JSON.parse(rawSave) as Partial<SaveData>;

    return {
      data,
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0,
    };
  } catch {
    return null;
  }
}

function isLocalBackupSafeForCurrentAccount(localSave: Partial<SaveData>, cloudSave?: Partial<SaveData>) {
  if (isDangerousFreshDefaultPartialSave(localSave)) {
    return false;
  }

  const vkUser = getCachedVKUser();
  const localVkUserId = localSave.vkUserId;
  const cloudVkUserId = cloudSave?.vkUserId;

  if (vkUser?.id && localVkUserId && localVkUserId !== vkUser.id) {
    return false;
  }

  if (cloudVkUserId && localVkUserId && localVkUserId !== cloudVkUserId) {
    return false;
  }

  return true;
}

function isDangerousFreshDefaultPartialSave(saveData: Partial<SaveData>) {
  const savedPlayer = saveData.player;
  const savedGameState = saveData.gameState;

  if (!savedPlayer || !savedGameState) {
    return true;
  }

  return (
    !savedPlayer.raceId &&
    (savedPlayer.level ?? 1) <= 1 &&
    (savedPlayer.exp ?? 0) <= 0 &&
    (savedGameState.highestClearedFloor ?? 0) <= 0 &&
    (savedGameState.highestClearedTier ?? 0) <= 0 &&
    (savedPlayer.inventory?.length ?? 0) === 0 &&
    Object.keys(savedPlayer.materials ?? {}).length === 0
  );
}

function getBestLocalSave() {
  const regular = localStorage.getItem(SAVE_KEY);
  const backup = localStorage.getItem(LOCAL_BACKUP_KEY);
  const lastGood = localStorage.getItem(LAST_GOOD_SAVE_KEY);

  return pickNewestSave([regular, backup, lastGood]);
}

function pickNewestSave(rawSaves: Array<string | null>) {
  const parsed = rawSaves
    .filter((item): item is string => Boolean(item))
    .map(raw => {
      try {
        const data = JSON.parse(raw) as Partial<SaveData>;
        return {
          raw,
          savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0,
        };
      } catch {
        return {
          raw,
          savedAt: 0,
        };
      }
    })
    .sort((a, b) => b.savedAt - a.savedAt);

  return parsed[0]?.raw ?? null;
}

function tryApplyRawSave(rawSave: string) {
  try {
    const saveData = JSON.parse(rawSave) as Partial<SaveData>;
    applySaveData(saveData);
    return true;
  } catch (error) {
    console.warn('Save loading failed. Save file is corrupted.', error);
    return false;
  }
}

function isDangerousFreshDefaultSave(saveData: SaveData) {
  return (
    !saveData.player.raceId &&
    saveData.player.level <= 1 &&
    saveData.player.exp <= 0 &&
    saveData.gameState.highestClearedFloor <= 0 &&
    saveData.gameState.highestClearedTier <= 0 &&
    saveData.player.inventory.length === 0 &&
    Object.keys(saveData.player.materials ?? {}).length === 0
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function getLastLoadSource() {
  return lastLoadSource;
}

export function didLastLoadHaveCloudFailure() {
  return lastLoadHadCloudFailure;
}

export function wasVKSaveLoadedThisSession() {
  return vkSaveLoadedThisSession;
}

export function wasVKSaveConfirmedEmptyThisSession() {
  return vkSaveConfirmedEmptyThisSession;
}


export function requestAutoSave(_reason = 'auto') {
  if (autoSaveTimer !== undefined) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = undefined;
    void saveGameAsync();
  }, 650);
}

export function flushSaveNow(_reason = 'flush') {
  if (autoSaveTimer !== undefined) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = undefined;
  }

  return saveGameAsync();
}

export function installAutoSaveGuards() {
  if (autoSaveGuardsInstalled || typeof window === 'undefined') {
    return;
  }

  autoSaveGuardsInstalled = true;

  const flush = (reason: string) => {
    void flushSaveNow(reason);
  };

  const request = (reason: string) => {
    requestAutoSave(reason);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush('visibilitychange:hidden');
      return;
    }

    request('visibilitychange:visible');
  });

  window.addEventListener('pagehide', () => {
    flush('pagehide');
  });

  window.addEventListener('beforeunload', () => {
    flush('beforeunload');
  });

  window.addEventListener('blur', () => {
    flush('window:blur');
  });

  window.addEventListener('focus', () => {
    request('window:focus');
  });

  unsubscribeVKBridgeEvents = subscribeVKBridgeEvents(event => {
    const type = getVKBridgeEventType(event);

    if (
      type === 'VKWebAppViewHide' ||
      type === 'VKWebAppViewClose' ||
      type === 'VKWebAppViewPause' ||
      type === 'VKWebAppWindowBlur'
    ) {
      flush(type);
      return;
    }

    if (
      type === 'VKWebAppViewRestore' ||
      type === 'VKWebAppViewResume' ||
      type === 'VKWebAppWindowFocus'
    ) {
      request(type);
    }
  });
}

export function removeAutoSaveGuards() {
  if (unsubscribeVKBridgeEvents) {
    unsubscribeVKBridgeEvents();
    unsubscribeVKBridgeEvents = undefined;
  }

  autoSaveGuardsInstalled = false;
}

function getVKBridgeEventType(event: unknown) {
  if (!event || typeof event !== 'object') {
    return '';
  }

  const bridgeEvent = event as {
    type?: string;
    detail?: {
      type?: string;
    };
  };

  return bridgeEvent.detail?.type ?? bridgeEvent.type ?? '';
}


export function markDungeonResumePoint(reason = 'dungeon') {
  if (!gameState.floorRun.active || gameState.floorRun.rooms.length === 0) {
    return;
  }

  resumeState = {
    scene: 'DungeonScene',
    updatedAt: Date.now(),
    floor: gameState.floorRun.currentFloor,
    roomIndex: gameState.floorRun.currentRoomIndex,
  };

  requestAutoSave(`resume:${reason}`);
}

export function markBattleResumePoint(state: Omit<BattleResumeState, 'savedAt'> & { savedAt?: number }) {
  if (!gameState.floorRun.active || gameState.floorRun.rooms.length === 0) {
    return;
  }

  if (!state.enemyId || state.enemyHp <= 0 || player.hp <= 0) {
    return;
  }

  resumeState = {
    scene: 'BattleScene',
    updatedAt: Date.now(),
    floor: gameState.floorRun.currentFloor,
    roomIndex: gameState.floorRun.currentRoomIndex,
    battle: {
      ...state,
      enemyHp: Math.max(1, Math.floor(state.enemyHp)),
      enemyMaxHp: Math.max(1, Math.floor(state.enemyMaxHp)),
      floor: gameState.floorRun.currentFloor,
      roomIndex: gameState.floorRun.currentRoomIndex,
      savedAt: state.savedAt ?? Date.now(),
    },
  };

  requestAutoSave('resume:battle');
}

export function clearResumePoint(reason = 'clear') {
  resumeState = {
    scene: null,
    updatedAt: Date.now(),
  };

  requestAutoSave(`resume:${reason}`);
}

export function getResumeTarget(): ResumeState | null {
  const normalized = normalizeResumeState(resumeState);

  if (!player.raceId) {
    return null;
  }

  if (!gameState.floorRun.active || gameState.floorRun.rooms.length === 0) {
    return null;
  }

  const currentFloor = gameState.floorRun.currentFloor;
  const currentRoomIndex = gameState.floorRun.currentRoomIndex;

  if (normalized.scene === 'BattleScene' && normalized.battle) {
    const battle = normalized.battle;
    const samePlace = battle.floor === currentFloor && battle.roomIndex === currentRoomIndex;

    if (samePlace && battle.enemyHp > 0 && player.hp > 0) {
      return normalized;
    }
  }

  return {
    scene: 'DungeonScene',
    updatedAt: normalized.updatedAt || Date.now(),
    floor: currentFloor,
    roomIndex: currentRoomIndex,
  };
}

export function getRawResumeState() {
  return normalizeResumeState(resumeState);
}

export function saveGame() {
  void saveGameAsync();
}

export function loadGame() {
  void loadGameAsync();
}

function clearLocalResetKeys() {
  LOCAL_RESET_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove local save key: ${key}`, error);
    }
  });
}

function resetPlayerToNewGame() {
  const savePlayer = getSavePlayer();

  Object.assign(player, clone(STARTING_PLAYER_STATE));

  savePlayer.characterTreePoints = 0;
  savePlayer.characterTree = {};
  savePlayer.shopRefreshCoupons = 0;

  fixMissingPlayerFields();
}

function resetGameStateToNewGame() {
  gameState.currentDungeonId = 'tower_depths';
  gameState.currentRoomIndex = 0;
  gameState.dungeonCompleted = false;
  gameState.unlockedDungeonIds = ['tower_depths'];

  gameState.lastCampRestAt = 0;

  gameState.highestClearedFloor = 0;
  gameState.highestClearedTier = 0;

  gameState.floorRun = createEmptyFloorRun();

  gameState.questProgress = {
    enemiesKilled: 0,
    chestsOpened: 0,
    dungeonsCompleted: 0,
    goldEarned: 0,
    claimedQuestIds: [],
  };

  fixMissingGameStateFields();
}

async function waitForQueuedSaveToFinish() {
  if (autoSaveTimer !== undefined) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = undefined;
  }

  pendingCloudSaveJson = null;

  if (!cloudSavePromise) {
    return;
  }

  try {
    await cloudSavePromise;
  } catch (error) {
    console.warn('Previous save queue failed before new game reset.', error);
  } finally {
    cloudSavePromise = null;
    pendingCloudSaveJson = null;
  }
}

export async function clearSaveAsync() {
  await waitForQueuedSaveToFinish();

  clearLocalResetKeys();

  if (isVKBridgeReady()) {
    await vkStorageSet(SAVE_KEY, '');
  }
}

export function clearSave() {
  clearLocalResetKeys();

  if (isVKBridgeReady()) {
    void vkStorageSet(SAVE_KEY, '');
  }
}

export async function startNewGameAsync() {
  await clearSaveAsync();

  cloudSaveWriteBlocked = false;
  lastLoadSource = 'none';
  lastLoadHadCloudFailure = false;
  vkSaveLoadedThisSession = false;
  vkSaveConfirmedEmptyThisSession = true;

  resumeState = {
    scene: null,
    updatedAt: Date.now(),
  };

  resetPlayerToNewGame();
  resetGameStateToNewGame();

  await saveGameAsync();
}

export function resetSave() {
  clearSave();
}
