import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeTripState,
  DEFAULT_THRESHOLDS,
  type Sample,
  type Stop,
  type TrackingThresholds,
  type TripState,
} from "@/lib/tracking";

/**
 * Subscribes to live locations for one bus (realtime + initial fetch) and
 * derives the context-aware trip state from the route's ordered stops.
 */
export function useBusTracking(
  busId: string | null,
  stops: Stop[],
  thresholds: TrackingThresholds = DEFAULT_THRESHOLDS,
) {
  const [history, setHistory] = useState<Sample[]>([]);
  const [tick, setTick] = useState(0);
  const busRef = useRef(busId);
  busRef.current = busId;

  useEffect(() => {
    setHistory([]);
    if (!busId) return;

    let cancelled = false;
    void supabase
      .from("bus_locations")
      .select("latitude,longitude,speed_kmh,recorded_at")
      .eq("bus_id", busId)
      .order("recorded_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (!cancelled && data) setHistory([...data].reverse() as Sample[]);
      });

    const channel = supabase
      .channel(`bus-locations-${busId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bus_locations", filter: `bus_id=eq.${busId}` },
        (payload) => {
          const row = payload.new as Sample;
          setHistory((prev) => [...prev.slice(-59), row]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [busId]);

  // Re-evaluate every 5s so staleness / stationary detection stays live.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const state: TripState = useMemo(
    () => computeTripState(stops, history, Date.now(), thresholds),
    [stops, history, tick, thresholds],
  );

  return { history, state };
}