import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  DEFAULT_BASE_FARE,
  FARE_SETTINGS_COLLECTION,
  FARE_SETTINGS_DOCUMENT,
  getDefaultRouteFares,
  normalizeBaseFare,
  normalizeRouteFares,
} from "../utils/fareRates";

interface UseFareRatesResult {
  fareRates: Record<string, number>;
  baseFare: number;
  loading: boolean;
}

export const useFareRates = (): UseFareRatesResult => {
  const [fareRates, setFareRates] = useState<Record<string, number>>(getDefaultRouteFares());
  const [baseFare, setBaseFare] = useState<number>(DEFAULT_BASE_FARE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const settingsRef = doc(db, FARE_SETTINGS_COLLECTION, FARE_SETTINGS_DOCUMENT);

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const settingsData = snapshot.data();
          setFareRates(normalizeRouteFares(settingsData.routeFares));
          setBaseFare(normalizeBaseFare(settingsData.baseFare));
        } else {
          // Fallback to static fares when no fare settings are stored yet.
          setFareRates(getDefaultRouteFares());
          setBaseFare(DEFAULT_BASE_FARE);
        }
        setLoading(false);
      },
      () => {
        // Keep app usable even if the realtime listener temporarily fails.
        setFareRates(getDefaultRouteFares());
        setBaseFare(DEFAULT_BASE_FARE);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    fareRates,
    baseFare,
    loading,
  };
};
