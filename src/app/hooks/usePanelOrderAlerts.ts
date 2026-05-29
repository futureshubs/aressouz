import { useEffect, useRef } from 'react';
import {
  detectNewIds,
  formatAlertLabels,
  panelNotificationsEnabled,
  playPanelAlertBeep,
  showPanelNotification,
  type PanelRole,
  PANEL_DASHBOARD_PATH,
} from '../utils/panelNotifications';

type Options<T> = {
  panel: PanelRole;
  title: string;
  items: T[];
  enabled?: boolean;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  /** Faqat shu elementlar «yangi» deb hisoblanadi */
  isAlertable?: (item: T) => boolean;
};

/** Buyurtma ro‘yxati yangilanganda ovoz + PWA bildirishnoma */
export function usePanelOrderAlerts<T>({
  panel,
  title,
  items,
  enabled = true,
  getId,
  getLabel,
  isAlertable = () => true,
}: Options<T>) {
  const trackedRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled || !panelNotificationsEnabled()) return;
    const alertable = items.filter(isAlertable);
    const ids = alertable.map(getId).filter(Boolean);
    const newcomers = detectNewIds(ids, trackedRef);
    if (newcomers.length === 0) return;

    playPanelAlertBeep();
    const labels = newcomers.map((id) => {
      const hit = alertable.find((x) => getId(x) === id);
      return hit ? getLabel(hit) : id;
    });

    void showPanelNotification({
      panel,
      title,
      body: formatAlertLabels(labels),
      tag: `${panel}-orders-${newcomers[0]}`,
      url: PANEL_DASHBOARD_PATH[panel],
    });
  }, [items, enabled, panel, title, getId, getLabel, isAlertable]);
}
