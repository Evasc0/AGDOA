// src/hooks/useDriverLocation.ts
import { useEffect, useState } from "react";
import { isInsideParadahan } from "../utils/geofence";

export function useDriverLocation() {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [insideParadahan, setInsideParadahan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported.");
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coord: [number, number] = [longitude, latitude];
        setCoords(coord);
        setInsideParadahan(isInsideParadahan(coord));
        setError(null);
      },
      (err) => {
        setError("Location access denied.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000,
      }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  return { coords, insideParadahan, error };
}
