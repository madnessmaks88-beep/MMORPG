import { gameState } from '../data/gameState';
import { unlockSecretAvatar } from './AvatarSystem';

export type IdrisQuestStage =
  | 'none'
  | 'ignored'
  | 'refused'
  | 'accepted'
  | 'lake_found'
  | 'flask_taken'
  | 'lake_consumed'
  | 'idris_restored'
  | 'amulet_taken'
  | 'daughter_healed'
  | 'idris_abandoned'
  | 'corpse_found';

export type StoryDungeonEventId =
  | 'idris_first_meeting'
  | 'life_lake'
  | 'cursed_lake'
  | 'idris_wounded'
  | 'idris_corpse';

export type IdrisQuestState = {
  stage: IdrisQuestStage;
  firstMetFloor?: number;
  acceptedFloor?: number;
  lakeFloor?: number;
  woundedFloor?: number;
  corpseFloor?: number;
  hasLifeFlask?: boolean;
  hasIdrisAmulet?: boolean;
  daughterHealed?: boolean;
  avatarUnlocked?: boolean;
};

export type StoryEncounterState = {
  idris: IdrisQuestState;
};

function getMutableGameState() {
  return gameState as typeof gameState & {
    storyEncounters?: StoryEncounterState;
  };
}

export function getStoryEncounterState(): StoryEncounterState {
  const mutableGameState = getMutableGameState();

  if (!mutableGameState.storyEncounters) {
    mutableGameState.storyEncounters = {
      idris: {
        stage: 'none',
      },
    };
  }

  if (!mutableGameState.storyEncounters.idris) {
    mutableGameState.storyEncounters.idris = {
      stage: 'none',
    };
  }

  return mutableGameState.storyEncounters;
}

export function getIdrisQuestState() {
  return getStoryEncounterState().idris;
}


export function getStoryEncounterEventIdForFloor(floor: number): StoryDungeonEventId | undefined {
  const idris = getIdrisQuestState();

  // Отдельное редкое окружение: проклятое озеро. Оно не двигает квест Идриса,
  // но создаёт ощущение, что в катакомбах есть разные "озёра", не только живое.
  if (
    floor >= 7 &&
    !['accepted', 'flask_taken', 'lake_found'].includes(idris.stage) &&
    Math.random() < 0.06
  ) {
    return 'cursed_lake';
  }

  if (idris.stage === 'none' && floor >= 4) {
    if (floor >= 6 || Math.random() < 0.42) {
      return 'idris_first_meeting';
    }
  }

  if (idris.stage === 'accepted' && idris.acceptedFloor !== undefined) {
    const distance = floor - idris.acceptedFloor;

    if (distance >= 1 && (distance >= 3 || Math.random() < 0.62)) {
      return 'life_lake';
    }
  }

  if (
    (idris.stage === 'flask_taken' || idris.stage === 'lake_consumed') &&
    idris.lakeFloor !== undefined
  ) {
    const distance = floor - idris.lakeFloor;

    if (distance >= 1 && (distance >= 3 || Math.random() < 0.55)) {
      return 'idris_wounded';
    }
  }

  if (idris.stage === 'idris_restored' && idris.woundedFloor !== undefined) {
    const distance = floor - idris.woundedFloor;

    if (distance >= 2 && (distance >= 4 || Math.random() < 0.42)) {
      return 'idris_corpse';
    }
  }

  return undefined;
}

export function acceptIdrisQuest(floor: number) {
  const idris = getIdrisQuestState();

  idris.stage = 'accepted';
  idris.firstMetFloor = idris.firstMetFloor ?? floor;
  idris.acceptedFloor = floor;
}

export function ignoreIdrisQuest(floor: number) {
  const idris = getIdrisQuestState();

  idris.stage = 'ignored';
  idris.firstMetFloor = idris.firstMetFloor ?? floor;
}

export function refuseIdrisQuest(floor: number) {
  const idris = getIdrisQuestState();

  idris.stage = 'refused';
  idris.firstMetFloor = idris.firstMetFloor ?? floor;
}

export function takeLifeFlaskForIdris(floor: number) {
  const idris = getIdrisQuestState();

  idris.stage = 'flask_taken';
  idris.lakeFloor = floor;
  idris.hasLifeFlask = true;
}

export function consumeLifeLake(floor: number) {
  const idris = getIdrisQuestState();

  idris.stage = 'lake_consumed';
  idris.lakeFloor = floor;
  idris.hasLifeFlask = false;
}

export function hasIdrisLifeFlask() {
  return Boolean(getIdrisQuestState().hasLifeFlask);
}

export function restoreIdrisWithFlask(floor: number) {
  const idris = getIdrisQuestState();

  idris.stage = 'idris_restored';
  idris.woundedFloor = floor;
  idris.hasLifeFlask = false;
}

export function takeIdrisAmuletForDaughter(floor: number) {
  const idris = getIdrisQuestState();

  idris.stage = 'amulet_taken';
  idris.woundedFloor = floor;
  idris.hasLifeFlask = false;
  idris.hasIdrisAmulet = true;
}

export function abandonIdris(floor: number) {
  const idris = getIdrisQuestState();

  idris.stage = 'idris_abandoned';
  idris.woundedFloor = floor;
  idris.hasLifeFlask = false;
}

export function markIdrisCorpseFound(floor: number) {
  const idris = getIdrisQuestState();

  idris.stage = 'corpse_found';
  idris.corpseFloor = floor;
  idris.hasLifeFlask = false;
}

export function canCompleteIdrisDaughterQuest() {
  const idris = getIdrisQuestState();

  return idris.stage === 'amulet_taken' && Boolean(idris.hasIdrisAmulet) && !idris.daughterHealed;
}

export function completeIdrisDaughterQuest() {
  const idris = getIdrisQuestState();

  if (!canCompleteIdrisDaughterQuest()) {
    return {
      completed: false,
      avatarUnlocked: false,
    };
  }

  idris.stage = 'daughter_healed';
  idris.daughterHealed = true;
  idris.hasIdrisAmulet = false;

  const avatar = unlockSecretAvatar('idris_broken_knight');
  idris.avatarUnlocked = true;

  return {
    completed: true,
    avatarUnlocked: Boolean(avatar),
  };
}

export function getIdrisDaughterQuestPreviewText() {
  return [
    'В городе есть дом за пепельным рынком.',
    'Там ждут мать Идриса и его больная дочь.',
    'Амулет ещё тёплый, будто рыцарь всё ещё держит его в ладони.',
  ].join('\n');
}
