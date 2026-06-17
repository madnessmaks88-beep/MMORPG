import { getCachedVKUser } from './VKBridgeSystem';

export type ServerSaveLoadResult = {
  hasSave: boolean;
  saveData?: unknown;
  cloudFailed: boolean;
  status?: number;
  reason?: string;
};

function getVKUserId() {
  return getCachedVKUser()?.id;
}

function normalizeLaunchParams(rawSearch: string) {
  const value = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
  const params = new URLSearchParams(value);

  if (!params.get('sign') || !params.get('vk_user_id')) {
    return '';
  }

  const signedParams = new URLSearchParams();
  const pairs: Array<[string, string]> = [];

  params.forEach((paramValue, key) => {
    if (key === 'sign' || key.startsWith('vk_')) {
      pairs.push([key, paramValue]);
    }
  });

  pairs.forEach(([key, paramValue]) => {
    signedParams.append(key, paramValue);
  });

  return signedParams.toString();
}

function getVKLaunchParams() {
  if (typeof window === 'undefined') {
    return '';
  }

  const fromSearch = normalizeLaunchParams(window.location.search);

  if (fromSearch) {
    return fromSearch;
  }

  // На случай, если когда-нибудь роутер перенесёт параметры в hash.
  const hash = window.location.hash || '';
  const hashQueryIndex = hash.indexOf('?');

  if (hashQueryIndex >= 0) {
    const fromHash = normalizeLaunchParams(hash.slice(hashQueryIndex));

    if (fromHash) {
      return fromHash;
    }
  }

  return '';
}

function createVKAuthHeaders(): Record<string, string> | null {
  const launchParams = getVKLaunchParams();

  if (!launchParams) {
    return null;
  }

  return {
    'x-vk-launch-params': launchParams,
  };
}

export async function loadServerSaveAsync(vkUserId = getVKUserId()): Promise<ServerSaveLoadResult> {
  if (!vkUserId) {
    return {
      hasSave: false,
      cloudFailed: true,
      reason: 'VK user id is missing.',
    };
  }

  const authHeaders = createVKAuthHeaders();

  if (!authHeaders) {
    return {
      hasSave: false,
      cloudFailed: true,
      reason: 'Signed VK launch params are missing.',
    };
  }

  try {
    const response = await fetch(`/api/save?vkUserId=${encodeURIComponent(String(vkUserId))}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...authHeaders,
      },
    });

    const data = await response.json().catch(() => null) as {
      ok?: boolean;
      hasSave?: boolean;
      saveData?: unknown;
      reason?: string;
      error?: string;
    } | null;

    if (!response.ok || !data?.ok) {
      return {
        hasSave: false,
        cloudFailed: true,
        status: response.status,
        reason: data?.reason ?? data?.error ?? 'Server save loading failed.',
      };
    }

    return {
      hasSave: Boolean(data.hasSave),
      saveData: data.saveData,
      cloudFailed: false,
      status: response.status,
    };
  } catch (error) {
    console.warn('Server save loading failed:', error);

    return {
      hasSave: false,
      cloudFailed: true,
      reason: 'Network error while loading server save.',
    };
  }
}

export async function saveServerSaveJsonAsync(
  json: string,
  vkUserId = getVKUserId()
) {
  if (!vkUserId) {
    return false;
  }

  const authHeaders = createVKAuthHeaders();

  if (!authHeaders) {
    console.warn('Server save skipped: signed VK launch params are missing.');
    return false;
  }

  try {
    const saveData = JSON.parse(json) as Record<string, unknown>;

    const response = await fetch('/api/save', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        vkUserId,
        saveData,
        vkLaunchParams: getVKLaunchParams(),
      }),
    });

    const data = await response.json().catch(() => null) as {
      ok?: boolean;
      accepted?: boolean;
      reason?: string;
      error?: string;
    } | null;

    if (!response.ok || !data?.ok || data.accepted === false) {
      console.warn(
        'Server save rejected:',
        data?.reason ?? data?.error ?? response.status
      );

      return false;
    }

    return true;
  } catch (error) {
    console.warn('Server save failed:', error);
    return false;
  }
}
