const META_KEY = 'aresso:diller:meta:v1';
const CREDS_KEY = 'aresso:diller:cloudCreds:v1';

export type DillerSyncMeta = {
  localModifiedAt: string;
  lastSyncedAt: string | null;
  pendingPush: boolean;
};

export type DillerCloudCreds = {
  login: string;
  password: string;
};

function defaultMeta(): DillerSyncMeta {
  return {
    localModifiedAt: new Date(0).toISOString(),
    lastSyncedAt: null,
    pendingPush: false,
  };
}

export function readDillerSyncMeta(): DillerSyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const p = JSON.parse(raw) as Partial<DillerSyncMeta>;
    return {
      localModifiedAt: String(p.localModifiedAt || defaultMeta().localModifiedAt),
      lastSyncedAt: p.lastSyncedAt ? String(p.lastSyncedAt) : null,
      pendingPush: Boolean(p.pendingPush),
    };
  } catch {
    return defaultMeta();
  }
}

export function writeDillerSyncMeta(meta: DillerSyncMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function touchLocalModified(): void {
  const meta = readDillerSyncMeta();
  writeDillerSyncMeta({
    ...meta,
    localModifiedAt: new Date().toISOString(),
    pendingPush: true,
  });
}

export function markDillerSynced(serverUpdatedAt: string): void {
  const now = serverUpdatedAt || new Date().toISOString();
  writeDillerSyncMeta({
    localModifiedAt: now,
    lastSyncedAt: now,
    pendingPush: false,
  });
}

export function saveDillerCloudCreds(creds: DillerCloudCreds): void {
  try {
    sessionStorage.setItem(CREDS_KEY, JSON.stringify(creds));
  } catch {
    /* ignore */
  }
}

export function readDillerCloudCreds(): DillerCloudCreds | null {
  try {
    const raw = sessionStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as DillerCloudCreds;
    if (!p?.login || !p?.password) return null;
    return { login: String(p.login), password: String(p.password) };
  } catch {
    return null;
  }
}

export function clearDillerCloudCreds(): void {
  try {
    sessionStorage.removeItem(CREDS_KEY);
  } catch {
    /* ignore */
  }
}

export function parseTime(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}
