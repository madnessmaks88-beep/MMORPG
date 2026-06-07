import bridge from '@vkontakte/vk-bridge';

export type VKUser = {
  id: number;
  first_name: string;
  last_name: string;
  photo_100?: string;
};

let isVKReady = false;
let currentUser: VKUser | null = null;

export async function initVKBridge() {
  try {
    await withTimeout(bridge.send('VKWebAppInit'), 1000);

    isVKReady = true;
    return true;
  } catch (error) {
    console.warn('VK Bridge init failed. Running in local mode.', error);

    isVKReady = false;
    return false;
  }
}

export function isVKBridgeReady() {
  return isVKReady;
}

export async function getVKUser(): Promise<VKUser | null> {
  if (!isVKReady) {
    return null;
  }

  if (currentUser) {
    return currentUser;
  }

  try {
    const user = await withTimeout(bridge.send('VKWebAppGetUserInfo'), 1000);

    currentUser = user as VKUser;
    return currentUser;
  } catch (error) {
    console.warn('VK user info failed.', error);
    return null;
  }
}

export async function vkStorageGet(key: string): Promise<string | null> {
  if (!isVKReady) {
    return null;
  }

  try {
    const response = await bridge.send('VKWebAppStorageGet', {
      keys: [key],
    });

    const item = response.keys.find(entry => entry.key === key);

    return item?.value || null;
  } catch (error) {
    console.warn('VK storage get failed.', error);
    return null;
  }
}

export async function vkStorageSet(key: string, value: string): Promise<boolean> {
  if (!isVKReady) {
    return false;
  }

  try {
    await bridge.send('VKWebAppStorageSet', {
      key,
      value,
    });

    return true;
  } catch (error) {
    console.warn('VK storage set failed.', error);
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error('VK Bridge timeout'));
      }, timeoutMs);
    }),
  ]);
}