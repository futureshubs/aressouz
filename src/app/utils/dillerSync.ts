import type { DillerData } from './dillerData';
import {
  hasDillerDataContent,
  loadDillerData,
  mergeDillerData,
  mergeShopOrders,
  normalizeDillerData,
  saveDillerData,
} from './dillerData';
import {
  dillerApiFetchData,
  dillerApiFetchShopOrders,
  dillerApiLogin,
  dillerApiPing,
  dillerApiPushData,
  dillerApiValidateSession,
  isOfflineDillerToken,
} from './dillerApi';
import type { DillerSession } from './dillerSession';
import { readDillerSession, saveDillerSession } from './dillerSession';
import {
  markDillerSynced,
  parseTime,
  readDillerCloudCreds,
  readDillerSyncMeta,
  touchLocalModified,
  writeDillerSyncMeta,
} from './dillerSyncMeta';

export type DillerSyncStatus = 'synced' | 'offline' | 'saving' | 'loading';

export type DillerSyncOutcome = {
  status: DillerSyncStatus;
  data: DillerData;
  message?: string;
  upgradedToken?: boolean;
};

let syncChain: Promise<unknown> = Promise.resolve();

export function withDillerSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = syncChain.then(fn, fn);
  syncChain = run.catch(() => undefined);
  return run;
}

async function loginWithStoredCreds(): Promise<string | null> {
  const creds = readDillerCloudCreds();
  if (!creds) return null;
  const loginResult = await dillerApiLogin(creds.login, creds.password);
  if (!loginResult.ok) return null;
  const next: DillerSession = {
    token: loginResult.token,
    login: loginResult.login,
    displayName: loginResult.displayName,
    loggedInAt: new Date().toISOString(),
  };
  saveDillerSession(next);
  return loginResult.token;
}

/** Bulut tokenini olish — sessiya tugasa creds bilan qayta login */
export async function ensureCloudToken(): Promise<{
  token: string | null;
  upgraded: boolean;
  unauthorized?: boolean;
}> {
  const session = readDillerSession();
  if (session?.token && !isOfflineDillerToken(session.token)) {
    const valid = await dillerApiValidateSession(session.token);
    if (valid) {
      return { token: session.token, upgraded: false };
    }
  }

  const token = await loginWithStoredCreds();
  if (token) {
    return { token, upgraded: true };
  }

  return { token: null, upgraded: false, unauthorized: true };
}

async function pullRemoteShopOrders(token: string, data: DillerData): Promise<DillerData> {
  if (isOfflineDillerToken(token)) return data;
  const res = await dillerApiFetchShopOrders(token);
  if (!res.ok) return data;
  const merged = mergeDillerData(data, mergeShopOrders(data, res.orders));
  return merged;
}

async function pushIfAllowed(
  token: string,
  data: DillerData,
): Promise<{ ok: boolean; updatedAt?: string; error?: string }> {
  if (!hasDillerDataContent(data)) {
    return { ok: false, error: 'Bo‘sh ma’lumot bulutga yuborilmaydi' };
  }
  const push = await dillerApiPushData(token, data);
  if (!push.ok) {
    return { ok: false, error: push.error };
  }
  return { ok: true, updatedAt: push.updatedAt };
}

async function syncInner(opts?: {
  silent?: boolean;
  preferLocal?: boolean;
  forcePull?: boolean;
}): Promise<DillerSyncOutcome> {
  const local = loadDillerData();
  const meta = readDillerSyncMeta();
  const silent = opts?.silent ?? false;
  const preferLocal = opts?.preferLocal ?? false;
  const forcePull = opts?.forcePull ?? false;

  const online = await dillerApiPing();
  if (!online) {
    return {
      status: 'offline',
      data: local,
      message: silent ? undefined : 'Oflayn — ma’lumot telefonda saqlanmoqda',
    };
  }

  const { token, upgraded, unauthorized } = await ensureCloudToken();
  if (unauthorized || !token) {
    return {
      status: 'offline',
      data: local,
      message: silent ? undefined : 'Bulut sessiyasi yo‘q — qayta kiring (/diller)',
    };
  }

  const remote = await dillerApiFetchData(token);
  if (!remote.ok) {
    if (remote.unauthorized) {
      const retryToken = await loginWithStoredCreds();
      if (retryToken) {
        return syncInner({ ...opts, silent: true });
      }
    }
    const withOrders = await pullRemoteShopOrders(token, local);
    return {
      status: 'offline',
      data: withOrders,
      message: silent ? undefined : remote.error,
    };
  }

  const serverData = remote.data ? normalizeDillerData(remote.data) : null;
  const serverHas = Boolean(serverData && hasDillerDataContent(serverData));
  const localHas = hasDillerDataContent(local);
  const serverTs = parseTime(remote.updatedAt);
  const localTs = parseTime(meta.localModifiedAt);

  const finishPull = async (
    base: DillerData,
    message?: string,
  ): Promise<DillerSyncOutcome> => {
    const withOrders = await pullRemoteShopOrders(token, base);
    saveDillerData(withOrders);
    writeDillerSyncMeta({
      localModifiedAt: remote.updatedAt || meta.localModifiedAt,
      lastSyncedAt: remote.updatedAt || new Date().toISOString(),
      pendingPush: false,
    });
    return {
      status: 'synced',
      data: withOrders,
      upgradedToken: upgraded,
      message: silent ? undefined : message,
    };
  };

  // Serverda bor, mahalliy bo‘sh — faqat yuklash (hech qachon bo‘sh push qilmaslik)
  if (serverHas && (!localHas || forcePull)) {
    return finishPull(serverData!, 'Bulutdan yuklandi');
  }

  // Ikkalasida ham bor — birlashtirish, keyin kerak bo‘lsa push
  if (serverHas && localHas && serverData) {
    const merged = mergeDillerData(local, serverData);
    const withOrders = await pullRemoteShopOrders(token, merged);
    const shouldPush =
      hasDillerDataContent(withOrders) &&
      (meta.pendingPush || preferLocal || localTs > serverTs + 500);

    if (shouldPush) {
      const push = await pushIfAllowed(token, withOrders);
      if (push.ok) {
        markDillerSynced(push.updatedAt!);
        saveDillerData(withOrders);
        return {
          status: 'synced',
          data: withOrders,
          upgradedToken: upgraded,
          message: silent ? undefined : 'Bulut bilan sinxronlandi',
        };
      }
      saveDillerData(withOrders);
      return {
        status: 'offline',
        data: withOrders,
        message: push.error,
      };
    }

    return finishPull(withOrders, 'Bulut bilan birlashtirildi');
  }

  // Mahalliyda bor, serverda yo‘q — yuklash
  if (localHas && !serverHas) {
    const withOrders = await pullRemoteShopOrders(token, local);
    const push = await pushIfAllowed(token, withOrders);
    if (push.ok) {
      markDillerSynced(push.updatedAt!);
      saveDillerData(withOrders);
      return {
        status: 'synced',
        data: withOrders,
        upgradedToken: upgraded,
        message: silent ? undefined : 'Bulutga saqlandi',
      };
    }
    return {
      status: 'offline',
      data: withOrders,
      message: push.error,
    };
  }

  // Ikkalasi ham bo‘sh
  const withOrders = await pullRemoteShopOrders(token, local);
  saveDillerData(withOrders);
  writeDillerSyncMeta({
    ...meta,
    pendingPush: false,
    lastSyncedAt: remote.updatedAt || meta.lastSyncedAt,
  });
  return {
    status: 'synced',
    data: withOrders,
    upgradedToken: upgraded,
    message: silent ? undefined : serverHas ? undefined : 'Ma’lumot hali kiritilmagan',
  };
}

export async function runDillerSync(opts?: {
  silent?: boolean;
  preferLocal?: boolean;
  forcePull?: boolean;
}): Promise<DillerSyncOutcome> {
  return withDillerSyncLock(() => syncInner(opts));
}

async function pushInner(): Promise<DillerSyncOutcome> {
  const local = loadDillerData();
  if (!hasDillerDataContent(local)) {
    return { status: 'synced', data: local };
  }
  touchLocalModified();

  const online = await dillerApiPing();
  if (!online) {
    return { status: 'offline', data: local };
  }

  const { token, upgraded } = await ensureCloudToken();
  if (!token) {
    return { status: 'offline', data: local };
  }

  const toPush = loadDillerData();
  const push = await pushIfAllowed(token, toPush);
  if (push.ok) {
    markDillerSynced(push.updatedAt!);
    const withOrders = await pullRemoteShopOrders(token, toPush);
    saveDillerData(withOrders);
    return {
      status: 'synced',
      data: withOrders,
      upgradedToken: upgraded,
    };
  }
  const withOrders = await pullRemoteShopOrders(token, loadDillerData());
  return {
    status: 'offline',
    data: withOrders,
    message: push.error,
  };
}

export async function pushDillerLocalNow(): Promise<DillerSyncOutcome> {
  return withDillerSyncLock(() => pushInner());
}

export async function flushDillerToCloud(): Promise<DillerSyncOutcome> {
  if (!hasDillerDataContent(loadDillerData())) {
    return { status: 'synced', data: loadDillerData() };
  }
  saveDillerData(loadDillerData());
  touchLocalModified();
  return pushDillerLocalNow();
}
