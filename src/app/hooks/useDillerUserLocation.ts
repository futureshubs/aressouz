import { useEffect, useState } from 'react';

export type DillerUserLocation = {
  lat: number;
  lng: number;
};

export function useDillerUserLocation(enabled = true) {
  const [location, setLocation] = useState<DillerUserLocation | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  return { location, loading };
}
