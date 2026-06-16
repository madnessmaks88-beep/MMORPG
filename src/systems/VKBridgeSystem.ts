import bridge from '@vkontakte/vk-bridge';

export type VKUser = {
  id: number;
  first_name: string;
  last_name: string;
  photo_100?: string;
};

type StorageGetResponse = {
  keys: Array<{
    key: string;
    value: string;
  }>;
};

const VK_TIMEOUT_MS = 8000;
const VK_RETRY_COUNT = 3;
const VK_RETRY_DELAY_MS = 450;

let isVKReady = false;
let initStarted = false;
let initPromise: Promise<boolean> | null = null;
let currentUser: VKUser | null = null;

let lastVKBridgeError: string | null = null;
let lastStorageGetFailed = false;
let lastStorageSetFailed = false;

export async function initVKBridge() {
  if (isVKReady) {
    return true;
  }

  if (initStarted && initPromise) {
    return initPromise;
  }

  initStarted = true;

  initPromise = (async () => {
    try {
      await withRetries(
        () => withTimeout(bridge.send('VKWebAppInit'), VK_TIMEOUT_MS, 'VKWebAppInit'),
        VK_RETRY_COUNT
      );

      isVKReady = true;
      lastVKBridgeError = null;
      return true;
    } catch (error) {
      isVKReady = false;
      lastVKBridgeError = getErrorMessage(error);
      console.warn('VK Bridge init failed.', error);
      return false;
    } finally {
      initStarted = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

export function isVKBridgeReady() {
  return isVKReady;
}

export function isVKEnvironment() {
  if (typeof window === 'undefined') {
    return false;
  }

  const href = window.location.href.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const referrer = document.referrer.toLowerCase();

  return (
    search.includes('vk_') ||
    hash.includes('vk_') ||
    href.includes('vk.com') ||
    href.includes('vk-apps.com') ||
    referrer.includes('vk.com') ||
    referrer.includes('vk-apps.com')
  );
}

export function getLastVKBridgeError() {
  return lastVKBridgeError;
}

export function wasLastVKStorageGetFailed() {
  return lastStorageGetFailed;
}

export function wasLastVKStorageSetFailed() {
  return lastStorageSetFailed;
}

export async function getVKUser(): Promise<VKUser | null> {
  if (!isVKReady) {
    return null;
  }

  if (currentUser) {
    return currentUser;
  }

  try {
    const user = await withRetries(
      () => withTimeout(bridge.send('VKWebAppGetUserInfo'), VK_TIMEOUT_MS, 'VKWebAppGetUserInfo'),
      VK_RETRY_COUNT
    );

    currentUser = user as VKUser;
    lastVKBridgeError = null;
    return currentUser;
  } catch (error) {
    lastVKBridgeError = getErrorMessage(error);
    console.warn('VK user info failed.', error);
    return null;
  }
}

export async function vkStorageGet(key: string): Promise<string | null> {
  lastStorageGetFailed = false;

  if (!isVKReady) {
    return null;
  }

  try {
    const response = await withRetries(
      () => withTimeout(
        bridge.send('VKWebAppStorageGet', {
          keys: [key],
        }),
        VK_TIMEOUT_MS,
        'VKWebAppStorageGet'
      ),
      VK_RETRY_COUNT
    ) as StorageGetResponse;

    const item = response.keys.find(entry => entry.key === key);

    lastVKBridgeError = null;
    return item?.value || null;
  } catch (error) {
    lastStorageGetFailed = true;
    lastVKBridgeError = getErrorMessage(error);
    console.warn('VK storage get failed.', error);
    return null;
  }
}

export async function vkStorageSet(key: string, value: string): Promise<boolean> {
  lastStorageSetFailed = false;

  if (!isVKReady) {
    return false;
  }

  try {
    await withRetries(
      () => withTimeout(
        bridge.send('VKWebAppStorageSet', {
          key,
          value,
        }),
        VK_TIMEOUT_MS,
        'VKWebAppStorageSet'
      ),
      VK_RETRY_COUNT
    );

    lastVKBridgeError = null;
    return true;
  } catch (error) {
    lastStorageSetFailed = true;
    lastVKBridgeError = getErrorMessage(error);
    console.warn('VK storage set failed.', error);
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timeout after ${timeoutMs} ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  });
}

async function withRetries<T>(action: () => Promise<T>, retries: number): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await delay(VK_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}

function delay(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function getCachedVKUser(): VKUser | null {
  return currentUser;
}


type VKBridgeEventSubscriber = (event: unknown) => void;

type VKBridgeWithEvents = typeof bridge & {
  subscribe?: (handler: VKBridgeEventSubscriber) => void;
  unsubscribe?: (handler: VKBridgeEventSubscriber) => void;
};

export function subscribeVKBridgeEvents(handler: VKBridgeEventSubscriber) {
  const vkBridge = bridge as VKBridgeWithEvents;

  vkBridge.subscribe?.(handler);

  return () => {
    vkBridge.unsubscribe?.(handler);
  };
}
