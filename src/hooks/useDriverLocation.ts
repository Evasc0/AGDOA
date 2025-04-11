// src/hooks/useDriverLocation.ts
import { useEffect, useState } from "react";
import { isInsideParadahan } from "../utils/geofence";

export function useDriverLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
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
        setCoords({ latitude, longitude });
        setInsideParadahan(isInsideParadahan([longitude, latitude])); // still pass tuple to geofence util
        setError(null);
      },
      () => {
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
