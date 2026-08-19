import { haversine, distanceToRoute, type Coords } from "./geo";

export const TRACKING_CONFIG = {
  /** Distance (m) at which "Next stop: X" is announced. */
  approachRadiusM: 300,
  /** Distance (m) at which the bus counts as arrived at a stop. */
  arrivalRadiusM: 80,
  /** Distance (m) off the planned polyline that counts as a deviation. */
  deviationRadiusM: 250,
  /** Movement (m) below which the bus counts as stationary. */
  stationaryRadiusM: 25,
  /** Time (s) of no movement before "Bus currently stopped". */
  stationarySeconds: 60,
  /** Time (s) without a backend update before location is stale. */
  staleSeconds: 30,
  /** Default driver GPS ping interval (s). */
  defaultIntervalSeconds: 6,
};

export type Stop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
};

export type Sample = Coords & { recorded_at: string; speed_kmh?: number | null };

export type TripState = {
  position: Coords | null;
  currentStop: Stop | null;
  nextStop: Stop | null;
  distanceToNextM: number | null;
  etaSeconds: number | null;
  speedKmh: number | null;
  phase: "idle" | "en_route" | "approaching" | "arrived";
  deviated: boolean;
  stationary: boolean;
  stale: boolean;
  statusLabel: string;
};

function recentSpeedKmh(history: Sample[]): number | null {
  if (history.length < 2) return null;
  const latest = history[history.length - 1]!;
  const latestT = new Date(latest.recorded_at).getTime();
  for (let i = history.length - 2; i >= 0; i--) {
    const s = history[i]!;
    const dt = (latestT - new Date(s.recorded_at).getTime()) / 1000;
    if (dt >= 5) {
      const d = haversine(s, latest);
      return (d / dt) * 3.6;
    }
  }
  return null;
}

export function computeTripState(
  stops: Stop[],
  history: Sample[],
  now: number = Date.now(),
): TripState {
  const ordered = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  const latest = history[history.length - 1] ?? null;
  const base: TripState = {
    position: latest ? { latitude: latest.latitude, longitude: latest.longitude } : null,
    currentStop: null,
    nextStop: ordered[0] ?? null,
    distanceToNextM: null,
    etaSeconds: null,
    speedKmh: null,
    phase: "idle",
    deviated: false,
    stationary: false,
    stale: false,
    statusLabel: "Waiting for GPS data",
  };
  if (!latest || ordered.length === 0) return base;

  const pos: Coords = { latitude: latest.latitude, longitude: latest.longitude };
  const stale = (now - new Date(latest.recorded_at).getTime()) / 1000 > TRACKING_CONFIG.staleSeconds;

  // Locate the bus along the ordered polyline of stops.
  let segment = 0;
  let bestSegmentDistance = Infinity;
  for (let i = 0; i < ordered.length - 1; i++) {
    const d = distanceToRoute(pos, [ordered[i]!, ordered[i + 1]!]) ?? Infinity;
    if (d < bestSegmentDistance) {
      bestSegmentDistance = d;
      segment = i;
    }
  }

  let currentIndex = ordered.length > 1 ? segment : 0;
  let nextIndex = Math.min(currentIndex + 1, ordered.length - 1);
  if (ordered.length === 1) nextIndex = 0;

  // Snap to a stop when the bus is basically on top of it.
  const distToCurrent = haversine(pos, ordered[currentIndex]!);
  let distToNext = haversine(pos, ordered[nextIndex]!);
  if (distToNext <= TRACKING_CONFIG.arrivalRadiusM && nextIndex < ordered.length - 1) {
    currentIndex = nextIndex;
    nextIndex = Math.min(nextIndex + 1, ordered.length - 1);
    distToNext = haversine(pos, ordered[nextIndex]!);
  }

  const arrivedAtNext =
    haversine(pos, ordered[nextIndex]!) <= TRACKING_CONFIG.arrivalRadiusM ||
    (currentIndex !== nextIndex && distToCurrent <= TRACKING_CONFIG.arrivalRadiusM);

  const speedKmh = latest.speed_kmh ?? recentSpeedKmh(history);
  const etaSeconds =
    speedKmh && speedKmh > 1 && Number.isFinite(distToNext)
      ? distToNext / (speedKmh / 3.6)
      : null;

  const deviation = distanceToRoute(pos, ordered) ?? 0;
  const deviated = deviation > TRACKING_CONFIG.deviationRadiusM;

  // Stationary detection over the configured window.
  let stationary = false;
  const windowStart = new Date(latest.recorded_at).getTime() - TRACKING_CONFIG.stationarySeconds * 1000;
  const windowSamples = history.filter((s) => new Date(s.recorded_at).getTime() >= windowStart);
  if (
    windowSamples.length >= 2 &&
    new Date(windowSamples[0]!.recorded_at).getTime() <= windowStart + 5000
  ) {
    stationary = windowSamples.every((s) => haversine(s, pos) <= TRACKING_CONFIG.stationaryRadiusM);
  }

  let phase: TripState["phase"] = "en_route";
  if (arrivedAtNext) phase = "arrived";
  else if (distToNext <= TRACKING_CONFIG.approachRadiusM) phase = "approaching";

  const currentStop = currentIndex === nextIndex ? ordered[currentIndex]! : ordered[currentIndex]!;
  const nextStop = nextIndex === currentIndex ? null : ordered[nextIndex]!;

  let statusLabel = "In transit";
  if (stale) statusLabel = "Bus location temporarily unavailable";
  else if (deviated) statusLabel = "Warning: bus may have deviated from the planned route";
  else if (phase === "arrived") statusLabel = `Arrived at ${arrivedAtNext && nextStop ? ordered[nextIndex]!.name : currentStop.name}`;
  else if (stationary) statusLabel = "Bus currently stopped";
  else if (phase === "approaching") statusLabel = "Approaching next stop";

  return {
    position: pos,
    currentStop: phase === "arrived" ? ordered[nextIndex] ?? currentStop : currentStop,
    nextStop: phase === "arrived" ? ordered[nextIndex + 1] ?? null : nextStop,
    distanceToNextM: phase === "arrived" ? haversine(pos, ordered[nextIndex + 1] ?? ordered[nextIndex]!) : distToNext,
    etaSeconds,
    speedKmh,
    phase,
    deviated,
    stationary,
    stale,
    statusLabel,
  };
}