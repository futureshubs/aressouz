import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { RoadAlert, RoadAlertType } from '../data/roadAlerts';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

const DEVICE_ID_KEY = 'aressouz_road_device_id';

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' };
}

export function getRoadDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = `rd-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `rd-anon-${Math.random().toString(36).slice(2, 11)}`;
  }
}

export async function fetchRoadAlerts(
  lat: number,
  lng: number,
  radiusKm = 60,
): Promise<RoadAlert[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(radiusKm),
  });
  const res = await fetch(`${API_BASE}/road-alerts?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('fetch failed');
  const data = (await res.json()) as { alerts?: RoadAlert[] };
  return Array.isArray(data.alerts) ? data.alerts : [];
}

export async function createRoadAlert(input: {
  type: RoadAlertType;
  lat: number;
  lng: number;
  note?: string;
}): Promise<RoadAlert> {
  const res = await fetch(`${API_BASE}/road-alerts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      ...input,
      deviceId: getRoadDeviceId(),
    }),
  });
  const data = (await res.json()) as { alert?: RoadAlert; error?: string };
  if (!res.ok) throw new Error(data.error || 'create failed');
  if (!data.alert) throw new Error('create failed');
  return data.alert;
}

export async function confirmRoadAlert(id: string): Promise<RoadAlert> {
  const res = await fetch(`${API_BASE}/road-alerts/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = (await res.json()) as { alert?: RoadAlert; error?: string };
  if (!res.ok) throw new Error(data.error || 'confirm failed');
  if (!data.alert) throw new Error('confirm failed');
  return data.alert;
}
