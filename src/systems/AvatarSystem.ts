import { player } from '../data/player';

export type SecretAvatarId = 'idris_broken_knight';

export type SecretAvatarData = {
  id: SecretAvatarId;
  name: string;
  title: string;
  description: string;
  icon: string;
  accentColor: number;
};

export const SECRET_AVATARS: SecretAvatarData[] = [
  {
    id: 'idris_broken_knight',
    name: 'Идрис',
    title: 'Рыцарь последнего огонька',
    description:
      'Секретная аватарка за сюжетную цепочку Идриса: рыцарь, который спустился в катакомбы ради больной дочери.',
    icon: '♞',
    accentColor: 0xb89a5e,
  },
];

type AvatarPlayer = typeof player & {
  avatarId?: string;
  unlockedAvatarIds?: string[];
};

function getAvatarPlayer(): AvatarPlayer {
  const avatarPlayer = player as AvatarPlayer;

  if (!Array.isArray(avatarPlayer.unlockedAvatarIds)) {
    avatarPlayer.unlockedAvatarIds = [];
  }

  return avatarPlayer;
}

export function getSecretAvatarById(id: string): SecretAvatarData | undefined {
  return SECRET_AVATARS.find(avatar => avatar.id === id);
}

export function getUnlockedSecretAvatars() {
  const avatarPlayer = getAvatarPlayer();

  return avatarPlayer.unlockedAvatarIds
    .map(id => getSecretAvatarById(id))
    .filter((avatar): avatar is SecretAvatarData => Boolean(avatar));
}

export function hasSecretAvatar(id: SecretAvatarId) {
  const avatarPlayer = getAvatarPlayer();

  return avatarPlayer.unlockedAvatarIds.includes(id);
}

export function unlockSecretAvatar(id: SecretAvatarId) {
  const avatarPlayer = getAvatarPlayer();

  if (!avatarPlayer.unlockedAvatarIds.includes(id)) {
    avatarPlayer.unlockedAvatarIds.push(id);
  }

  if (!avatarPlayer.avatarId) {
    avatarPlayer.avatarId = id;
  }

  return getSecretAvatarById(id);
}

export function getSelectedSecretAvatar() {
  const avatarPlayer = getAvatarPlayer();

  if (!avatarPlayer.avatarId) {
    return undefined;
  }

  return getSecretAvatarById(avatarPlayer.avatarId);
}
