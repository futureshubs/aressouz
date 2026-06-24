export type RoadAlertType = 'gai' | 'hidden_gai' | 'accident' | 'radar';

export type RoadAlert = {
  id: string;
  type: RoadAlertType;
  lat: number;
  lng: number;
  note?: string;
  createdAt: string;
  expiresAt: string;
  reports: number;
  distanceKm?: number;
};

export const ROAD_ALERT_META: Record<
  RoadAlertType,
  { label: string; emoji: string; color: string; description: string }
> = {
  gai: {
    label: 'GAI',
    emoji: '👮',
    color: '#2563eb',
    description: 'Yo‘l patruli / GAI',
  },
  hidden_gai: {
    label: 'Yashirin GAI',
    emoji: '🕵️',
    color: '#7c3aed',
    description: 'Yashirin patrul',
  },
  accident: {
    label: 'Avariya',
    emoji: '🚧',
    color: '#dc2626',
    description: 'Avariya yoki to‘siq',
  },
  radar: {
    label: 'Radar',
    emoji: '📡',
    color: '#ea580c',
    description: 'Tezlik radar',
  },
};

export const ROAD_ALERT_TYPES = Object.keys(ROAD_ALERT_META) as RoadAlertType[];
