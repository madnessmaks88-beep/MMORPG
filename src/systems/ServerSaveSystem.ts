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

export async function loadServerSaveAsync(vkUserId = getVKUserId()): Promise<ServerSaveLoadResult> {
  if (!vkUserId) {
    return {
      hasSave: false,
      cloudFailed: true,
      reason: 'VK user id is missing.',
    };
  }

  try {
    const response = await fetch(`/api/save?vkUserId=${encodeURIComponent(String(vkUserId))}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
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

  try {
    const saveData = JSON.parse(json) as Record<string, unknown>;

    const response = await fetch('/api/save', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        vkUserId,
        saveData,
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
