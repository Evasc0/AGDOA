import { point, polygon } from "@turf/helpers";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

// Actual boundary of Atok Terminal (Camp30)
const paradahanBoundary = polygon([[ 
  [120.8042, 16.6955], // point 1 (bottom-left)
  [120.8042, 16.6965], // point 2 (top-left)
  [120.8052, 16.6965], // point 3 (top-right)
  [120.8052, 16.6955], // point 4 (bottom-right)
  [120.8042, 16.6955], // closing the polygon
]]);

// Pass in [longitude, latitude]
export function isInsideParadahan(coord: [number, number]): boolean {
  return booleanPointInPolygon(point(coord), paradahanBoundary);
}
export {};
