import { fareMatrix } from "./fareMatrix";

export const FARE_SETTINGS_COLLECTION = "settings";
export const FARE_SETTINGS_DOCUMENT = "fareRates";

const defaultRouteFares = { ...fareMatrix };

export const DEFAULT_BASE_FARE = Math.min(...Object.values(defaultRouteFares));

const toNonNegativeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
};

export const getDefaultRouteFares = (): Record<string, number> => ({
  ...defaultRouteFares,
});

export const normalizeRouteFares = (input: unknown): Record<string, number> => {
  const candidate =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};

  const normalized: Record<string, number> = {};

  // Keep every existing route key for backward compatibility.
  Object.keys(defaultRouteFares).forEach((routeName) => {
    const parsedFare = toNonNegativeNumber(candidate[routeName]);
    normalized[routeName] = parsedFare ?? defaultRouteFares[routeName];
  });

  // Include new admin-defined routes if they are valid numbers.
  Object.entries(candidate).forEach(([routeName, routeFare]) => {
    if (routeName in normalized) {
      return;
    }

    const parsedFare = toNonNegativeNumber(routeFare);
    if (parsedFare !== null) {
      normalized[routeName] = parsedFare;
    }
  });

  return normalized;
};

export const normalizeBaseFare = (value: unknown): number => {
  const parsed = toNonNegativeNumber(value);
  return parsed ?? DEFAULT_BASE_FARE;
};
