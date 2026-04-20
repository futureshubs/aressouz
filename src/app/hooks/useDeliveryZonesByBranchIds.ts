import { useState, useEffect, useMemo, useRef } from 'react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

/**
 * Har bir filial uchun yetkazib berish zonalarini yuklaydi (bir marta, kesh).
 */
export function useDeliveryZonesByBranchIds(branchIds: string[]): Record<string, any[]> {
  const [map, setMap] = useState<Record<string, any[]>>({});
  const doneRef = useRef<Set<string>>(new Set());

  const key = useMemo(() => [...new Set(branchIds.filter(Boolean))].sort().join('|'), [branchIds]);

  useEffect(() => {
    const ids = key.split('|').filter(Boolean);
    if (ids.length === 0) return;

    for (const bid of ids) {
      if (doneRef.current.has(bid)) continue;
      doneRef.current.add(bid);
      void (async () => {
        try {
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones?branchId=${encodeURIComponent(bid)}`,
            {
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
                'Content-Type': 'application/json',
              },
            },
          );
          const data = res.ok ? await res.json().catch(() => ({})) : {};
          const zones = Array.isArray(data.zones) ? data.zones : [];
          setMap((prev) => ({ ...prev, [bid]: zones }));
        } catch {
          setMap((prev) => ({ ...prev, [bid]: [] }));
        }
      })();
    }
  }, [key]);

  return map;
}
