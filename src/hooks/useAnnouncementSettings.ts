import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THRESHOLDS, THRESHOLD_LIMITS, type TrackingThresholds } from "@/lib/tracking";

const STORAGE_KEY = "smartstop.announcement-thresholds";

function clamp(key: keyof TrackingThresholds, value: number) {
  const { min, max } = THRESHOLD_LIMITS[key];
  if (!Number.isFinite(value)) return DEFAULT_THRESHOLDS[key];
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sanitize(raw: unknown): TrackingThresholds {
  if (!raw || typeof raw !== "object") return DEFAULT_THRESHOLDS;
  const input = raw as Partial<Record<keyof TrackingThresholds, unknown>>;
  const next = { ...DEFAULT_THRESHOLDS };
  (Object.keys(DEFAULT_THRESHOLDS) as (keyof TrackingThresholds)[]).forEach((key) => {
    if (typeof input[key] === "number") next[key] = clamp(key, input[key] as number);
  });
  // Arrival must stay inside the approach radius or the phases overlap.
  if (next.arrivalRadiusM >= next.approachRadiusM) {
    next.arrivalRadiusM = Math.max(THRESHOLD_LIMITS.arrivalRadiusM.min, next.approachRadiusM - 10);
  }
  return next;
}

/**
 * Announcement trigger thresholds, persisted per browser so a passenger's
 * preferred "warn me earlier" settings survive reloads.
 */
export function useAnnouncementSettings() {
  const [thresholds, setThresholds] = useState<TrackingThresholds>(DEFAULT_THRESHOLDS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setThresholds(sanitize(JSON.parse(stored)));
    } catch {
      // Ignore unreadable/corrupt storage and keep defaults.
    }
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<TrackingThresholds>) => {
    setThresholds((prev) => {
      const next = sanitize({ ...prev, ...patch });
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage may be unavailable (private mode); settings stay in memory.
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up.
    }
    setThresholds(DEFAULT_THRESHOLDS);
  }, []);

  return { thresholds, update, reset, hydrated };
}
