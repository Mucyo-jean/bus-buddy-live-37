export type Coords = { latitude: number; longitude: number };

const R = 6371000; // metres
const toRad = (d: number) => (d * Math.PI) / 180;

/** Haversine distance in metres. */
export function haversine(a: Coords, b: Coords): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return "—";
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "ETA unavailable";
  if (seconds < 60) return "Less than a minute";
  return `${Math.round(seconds / 60)} minute${Math.round(seconds / 60) === 1 ? "" : "s"}`;
}

/** Shortest distance (metres) from point p to segment a-b, using a local flat projection. */
export function distanceToSegment(p: Coords, a: Coords, b: Coords): number {
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(toRad(p.latitude));
  const px = p.longitude * mPerDegLon;
  const py = p.latitude * mPerDegLat;
  const ax = a.longitude * mPerDegLon;
  const ay = a.latitude * mPerDegLat;
  const bx = b.longitude * mPerDegLon;
  const by = b.latitude * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distance (metres) from the bus to the closest point of the planned polyline. */
export function distanceToRoute(p: Coords, path: Coords[]): number | null {
  if (path.length < 2) return null;
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    best = Math.min(best, distanceToSegment(p, path[i]!, path[i + 1]!));
  }
  return best;
}

/** Interpolate a coordinate a fraction t along a -> b. */
export function interpolate(a: Coords, b: Coords, t: number): Coords {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}