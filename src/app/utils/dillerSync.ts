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
} from './dillerSyncMeta';

export type DillerSyncStatus = 'synced' | 'offline' | 'saving' | 'loading';

export type DillerSyncOutcome = {
  status: DillerSyncStatus;
  data: DillerData;
  message?: string;
  upgradedToken?: boolean;
};

let syncChain: Promise<unknown> = Promise.resolve();

/** Push/pull bir vaqtda ikki marta ishlamasligi uchun navbat */
export function withDillerSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = syncChain.then(fn, fn);
  syncChain = run.catch(() => undefined);
  return run;
}

/** Bulut tokenini olish: mavjud yoki creds bilan avtomatik login */
export async function ensureCloudToken(): Promise<{
  token: string | null;
  upgraded: boolean;
  unauthorized?: boolean;
}> {
  const session = readDillerSession();
  if (session?.token && !isOfflineDillerToken(session.token)) {
    return { token: session.token, upgraded: false };
  }

  const creds = readDillerCloudCreds();
  if (!creds) {
    return { token: null, upgraded: false };
  }

  const loginResult = await dillerApiLogin(creds.login, creds.password);
  if (!loginResult.ok) {
    return { token: null, upgraded: false };
  }

  const next: DillerSession = {
    token: loginResult.token,
    login: loginResult.login,
    displayName: loginResult.displayName,
    loggedInAt: new Date().toISOString(),
  };
  saveDillerSession(next);
  return { token: loginResult.token, upgraded: true };
}

async function pullRemoteShopOrders(token: string, data: DillerData): Promise<DillerData> {
  if (isOfflineDillerToken(token)) return data;
  const res = await dillerApiFetchShopOrders(token);
  if (!res.ok) return data;
  const fresh = loadDillerData();
  const merged = mergeDillerData(fresh, mergeShopOrders(fresh, res.orders));
  saveDillerData(merged);
  return merged;
}

async function syncInner(opts?: {
  silent?: boolean;
  preferLocal?: boolean;
}): Promise<DillerSyncOutcome> {
  const local = loadDillerData();
  const meta = readDillerSyncMeta();
  const silent = opts?.silent ?? false;

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
      message: silent ? undefined : 'Bulut sessiyasi yo‘q — oflayn ishlaydi',
    };
  }

  const remote = await dillerApiFetchData(token);
  if (!remote.ok) {
    if (remote.unauthorized) {
      return { status: 'offline', data: local };
    }
    const withOrders = await pullRemoteShopOrders(token, local);
    return {
      status: 'offline',
      data: withOrders,
      message: silent ? undefined : remote.error,
    };
  }

  const serverData = remote.data ? normalizeDillerData(remote.data) : null;
  const serverHas = serverData && hasDillerDataContent(serverData);
  const localHas = hasDillerDataContent(local);
  const serverTs = parseTime(remote.updatedAt);
  const localTs = parseTime(meta.localModifiedAt);
  const shouldPush =
    meta.pendingPush ||
    opts?.preferLocal ||
    (localHas && !serverHas) ||
    (localHas && serverHas && localTs >= serverTs);

  if (shouldPush && (localHas || meta.pendingPush)) {
    const toPush = loadDillerData();
    const push = await dillerApiPushData(token, toPush);
    if (push.ok) {
      markDillerSynced(push.updatedAt);
      const withOrders = await pullRemoteShopOrders(token, toPush);
      return {
        status: 'synced',
        data: mergeDillerData(loadDillerData(), withOrders),
        upgradedToken: upgraded,
        message: silent
          ? undefined
          : upgraded
            ? 'Internet qaytdi — bulutga ulandi'
            : 'Bulutga saqlandi',
      };
    }
    const withOrders = await pullRemoteShopOrders(token, loadDillerData());
    return {
      status: 'offline',
      data: mergeDillerData(loadDillerData(), withOrders),
      message: push.error,
    };
  }

  if (serverHas && serverData) {
    const localToken = local.profile.orderToken?.trim();
    const mergedBase = mergeDillerData(local, serverData);
    const mergedProfile =
      localToken && !serverData.profile.orderToken?.trim()
        ? {
            ...mergedBase,
            profile: { ...mergedBase.profile, orderToken: localToken },
          }
        : mergedBase;
    const withOrders = await pullRemoteShopOrders(token, mergedProfile);
    saveDillerData(withOrders);
    markDillerSynced(remote.updatedAt || new Date().toISOString());
    if (withOrders !== serverData && token) {
      void dillerApiPushData(token, withOrders);
    }
    return {
      status: 'synced',
      data: withOrders,
      upgradedToken: upgraded,
      message: silent ? undefined : 'Serverdan yangilandi',
    };
  }

  if (localHas) {
    const withOrders = await pullRemoteShopOrders(token, local);
    return { status: 'synced', data: withOrders, upgradedToken: upgraded };
  }

  const withOrders = await pullRemoteShopOrders(token, normalizeDillerData(null));
  saveDillerData(withOrders);
  markDillerSynced(new Date().toISOString());
  return { status: 'synced', data: withOrders, upgradedToken: upgraded };
}

/** Mahalliy + serverni birlashtirish */
export async function runDillerSync(opts?: {
  silent?: boolean;
  preferLocal?: boolean;
}): Promise<DillerSyncOutcome> {
  return withDillerSyncLock(() => syncInner(opts));
}

async function pushInner(): Promise<DillerSyncOutcome> {
  const local = loadDillerData();
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
  const push = await dillerApiPushData(token, toPush);
  if (push.ok) {
    markDillerSynced(push.updatedAt);
    const withOrders = await pullRemoteShopOrders(token, toPush);
    return {
      status: 'synced',
      data: mergeDillerData(loadDillerData(), withOrders),
      upgradedToken: upgraded,
    };
  }
  const withOrders = await pullRemoteShopOrders(token, loadDillerData());
  return {
    status: 'offline',
    data: mergeDillerData(loadDillerData(), withOrders),
    message: push.error,
  };
}

export async function pushDillerLocalNow(): Promise<DillerSyncOutcome> {
  return withDillerSyncLock(() => pushInner());
}

/** Chiqish yoki majburiy saqlash — navbatdagi o‘zgarishlarni darhol yuboradi */
export async function flushDillerToCloud(): Promise<DillerSyncOutcome> {
  saveDillerData(loadDillerData());
  touchLocalModified();
  return pushDillerLocalNow();
}
