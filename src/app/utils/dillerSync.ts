import type { DillerData } from './dillerData';
import {
  hasDillerDataContent,
  loadDillerData,
  normalizeDillerData,
  saveDillerData,
} from './dillerData';
import {
  dillerApiFetchData,
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

/** Mahalliy + serverni birlashtirish */
export async function runDillerSync(opts?: {
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
    return {
      status: 'offline',
      data: local,
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
    const push = await dillerApiPushData(token, local);
    if (push.ok) {
      markDillerSynced(push.updatedAt);
      return {
        status: 'synced',
        data: local,
        upgradedToken: upgraded,
        message: silent
          ? undefined
          : upgraded
            ? 'Internet qaytdi — bulutga ulandi'
            : 'Bulutga saqlandi',
      };
    }
    return {
      status: 'offline',
      data: local,
      message: push.error,
    };
  }

  if (serverHas && serverData) {
    saveDillerData(serverData);
    markDillerSynced(remote.updatedAt || new Date().toISOString());
    return {
      status: 'synced',
      data: serverData,
      upgradedToken: upgraded,
      message: silent ? undefined : 'Serverdan yangilandi',
    };
  }

  const empty = normalizeDillerData(null);
  saveDillerData(empty);
  markDillerSynced(new Date().toISOString());
  return { status: 'synced', data: empty, upgradedToken: upgraded };
}

export async function pushDillerLocalNow(): Promise<DillerSyncOutcome> {
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

  const push = await dillerApiPushData(token, local);
  if (push.ok) {
    markDillerSynced(push.updatedAt);
    return { status: 'synced', data: local, upgradedToken: upgraded };
  }
  return { status: 'offline', data: local, message: push.error };
}
