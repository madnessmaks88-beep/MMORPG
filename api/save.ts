/// <reference types="node" />

declare const process: {
  env: Record<string, string | undefined>;
};

import { createClient } from '@supabase/supabase-js';

type SaveData = {
  version?: number;
  savedAt?: number;
  vkUserId?: number;
  player?: {
    raceId?: string;
    level?: number;
    exp?: number;
    gold?: number;
    inventory?: unknown[];
    relicIds?: unknown[];
    materials?: Record<string, number>;
  };
  gameState?: {
    highestClearedFloor?: number;
    highestClearedTier?: number;
    floorRun?: {
      active?: boolean;
      currentFloor?: number;
      currentRoomIndex?: number;
    };
  };
  resumeState?: {
    scene?: string | null;
    updatedAt?: number;
  };
  campfireBattleCheckpoints?: unknown[];
};

const PLAYER_SAVES_TABLE = 'player_saves';
const SAVE_HISTORY_TABLE = 'player_save_history';
const HISTORY_LIMIT = 10;

function sendJson(res: any, status: number, data: unknown) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.json(data);
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function normalizeVkUserId(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  const numberValue = Number(raw);

  if (!Number.isSafeInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
}

function computeProgressScore(saveData?: SaveData | null) {
  if (!saveData?.player || !saveData.gameState) {
    return 0;
  }

  const level = saveData.player.level ?? 1;
  const exp = saveData.player.exp ?? 0;
  const gold = saveData.player.gold ?? 0;
  const highestFloor = saveData.gameState.highestClearedFloor ?? 0;
  const highestTier = saveData.gameState.highestClearedTier ?? 0;
  const inventoryCount = saveData.player.inventory?.length ?? 0;
  const relicCount = saveData.player.relicIds?.length ?? 0;
  const materialKinds = Object.keys(saveData.player.materials ?? {}).length;
  const activeRunBonus = saveData.gameState.floorRun?.active ? 10_000 : 0;
  const campfireCount = Array.isArray(saveData.campfireBattleCheckpoints)
    ? saveData.campfireBattleCheckpoints.length
    : 0;

  return Math.floor(
    highestTier * 1_000_000 +
    highestFloor * 20_000 +
    level * 5_000 +
    relicCount * 4_000 +
    inventoryCount * 300 +
    materialKinds * 200 +
    campfireCount * 300 +
    activeRunBonus +
    Math.min(exp, 4_999) +
    Math.min(gold, 9_999) * 0.05
  );
}

function isDangerousFreshDefaultSave(saveData?: SaveData | null) {
  const player = saveData?.player;
  const state = saveData?.gameState;

  if (!player || !state) {
    return true;
  }

  return (
    !player.raceId &&
    (player.level ?? 1) <= 1 &&
    (player.exp ?? 0) <= 0 &&
    (state.highestClearedFloor ?? 0) <= 0 &&
    (state.highestClearedTier ?? 0) <= 0 &&
    (player.inventory?.length ?? 0) === 0 &&
    Object.keys(player.materials ?? {}).length === 0
  );
}

async function getCurrentSave(vkUserId: number) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(PLAYER_SAVES_TABLE)
    .select('vk_user_id, save_data, save_version, progress_score, updated_at')
    .eq('vk_user_id', vkUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as {
    vk_user_id: number;
    save_data: SaveData;
    save_version: number;
    progress_score: number;
    updated_at: string;
  } | null;
}

async function cleanupOldHistory(vkUserId: number) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(SAVE_HISTORY_TABLE)
    .select('id')
    .eq('vk_user_id', vkUserId)
    .order('created_at', { ascending: false })
    .range(HISTORY_LIMIT, 1000);

  if (error || !data?.length) {
    return;
  }

  const ids = data.map((row: { id: number }) => row.id);

  await supabase
    .from(SAVE_HISTORY_TABLE)
    .delete()
    .in('id', ids);
}

async function saveCurrent(vkUserId: number, saveData: SaveData, force = false) {
  const supabase = getSupabaseAdmin();
  const existing = await getCurrentSave(vkUserId);

  saveData.vkUserId = vkUserId;
  saveData.savedAt = Date.now();

  const incomingScore = computeProgressScore(saveData);
  const existingScore = existing?.progress_score ?? 0;

  const incomingLooksDangerous =
    isDangerousFreshDefaultSave(saveData) ||
    existingScore > incomingScore + 50_000;

  if (existing && incomingLooksDangerous && !force) {
    return {
      accepted: false,
      status: 409,
      reason: 'Incoming save looks weaker than existing server save. Refused to overwrite progress.',
      existingProgressScore: existingScore,
      incomingProgressScore: incomingScore,
    };
  }

  const nextVersion = (existing?.save_version ?? 0) + 1;

  if (existing) {
    await supabase.from(SAVE_HISTORY_TABLE).insert({
      vk_user_id: vkUserId,
      save_data: existing.save_data,
      save_version: existing.save_version,
      progress_score: existing.progress_score,
    });
  }

  const { error } = await supabase.from(PLAYER_SAVES_TABLE).upsert(
    {
      vk_user_id: vkUserId,
      save_data: saveData,
      save_version: nextVersion,
      progress_score: incomingScore,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'vk_user_id',
    }
  );

  if (error) {
    throw error;
  }

  void cleanupOldHistory(vkUserId);

  return {
    accepted: true,
    status: 200,
    saveVersion: nextVersion,
    progressScore: incomingScore,
  };
}

function parseBody(req: any) {
  if (!req.body) {
    return null;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  return req.body;
}

export default async function handler(req: any, res: any) {
  try {
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (req.method === 'GET') {
      const vkUserId = normalizeVkUserId(req.query?.vkUserId);

      if (!vkUserId) {
        sendJson(res, 400, {
          ok: false,
          error: 'Invalid vkUserId.',
        });
        return;
      }

      const row = await getCurrentSave(vkUserId);

      if (!row) {
        sendJson(res, 200, {
          ok: true,
          hasSave: false,
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        hasSave: true,
        saveData: row.save_data,
        saveVersion: row.save_version,
        progressScore: row.progress_score,
        updatedAt: row.updated_at,
      });
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req) as {
        vkUserId?: unknown;
        saveData?: SaveData;
        force?: boolean;
      } | null;

      const vkUserId = normalizeVkUserId(body?.vkUserId);

      if (!vkUserId || !body?.saveData) {
        sendJson(res, 400, {
          ok: false,
          error: 'vkUserId and saveData are required.',
        });
        return;
      }

      const result = await saveCurrent(vkUserId, body.saveData, Boolean(body.force));

      if (!result.accepted) {
        sendJson(res, result.status, {
          ok: false,
          accepted: false,
          reason: result.reason,
          existingProgressScore: result.existingProgressScore,
          incomingProgressScore: result.incomingProgressScore,
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        accepted: true,
        saveVersion: result.saveVersion,
        progressScore: result.progressScore,
      });
      return;
    }

    sendJson(res, 405, {
      ok: false,
      error: 'Method not allowed.',
    });
  } catch (error) {
    console.error('Save API failed:', error);

    sendJson(res, 500, {
      ok: false,
      error: 'Internal save API error.',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
