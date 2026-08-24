import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Play, Square, Satellite, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { LiveMap } from "@/components/LiveMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDistance, formatEta, haversine, interpolate, type Coords } from "@/lib/geo";
import { computeTripState, TRACKING_CONFIG, type Sample, type Stop } from "@/lib/tracking";
import { announceOnce, resetAnnouncements, setVoiceEnabled } from "@/lib/speech";

export const Route = createFileRoute("/driver")({
  head: () => ({
    meta: [
      { title: "Driver console — SmartStop" },
      { name: "description", content: "Start a trip and stream your bus GPS location to passengers in real time." },
      { property: "og:title", content: "Driver console — SmartStop" },
      { property: "og:description", content: "Share live bus GPS, see the next stop and distance while driving." },
    ],
  }),
  component: DriverPage,
});

type Bus = { id: string; bus_number: string; plate_number: string; route_id: string | null };
type RouteRow = { id: string; name: string; origin: string; destination: string };

function DriverPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [busId, setBusId] = useState<string>("");
  const [routeId, setRouteId] = useState<string>("");
  const [tripId, setTripId] = useState<string | null>(null);
  const [intervalSec, setIntervalSec] = useState(TRACKING_CONFIG.defaultIntervalSeconds);
  const [simulate, setSimulate] = useState(false);
  const [voice, setVoice] = useState(true);
  const [history, setHistory] = useState<Sample[]>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const simProgress = useRef(0);
  const lastFix = useRef<Coords | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && (!user || role !== "driver")) void navigate({ to: user ? "/" : "/auth" });
  }, [user, role, loading]);

  useEffect(() => setVoiceEnabled(voice), [voice]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: assignments }, { data: allBuses }, { data: routeRows }] = await Promise.all([
        supabase.from("driver_assignments").select("bus_id").eq("driver_id", user.id),
        supabase.from("buses").select("id,bus_number,plate_number,route_id").order("bus_number"),
        supabase.from("routes").select("id,name,origin,destination").order("name"),
      ]);
      const assignedIds = new Set((assignments ?? []).map((a) => a.bus_id));
      const list = (allBuses ?? []).filter((b) => assignedIds.size === 0 || assignedIds.has(b.id));
      setBuses(list as Bus[]);
      setRoutes((routeRows ?? []) as RouteRow[]);
      if (list[0]) {
        setBusId(list[0].id);
        if (list[0].route_id) setRouteId(list[0].route_id);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!routeId) return setStops([]);
    void supabase
      .from("bus_stops")
      .select("id,name,latitude,longitude,stop_order")
      .eq("route_id", routeId)
      .order("stop_order")
      .then(({ data }) => setStops((data ?? []) as Stop[]));
  }, [routeId]);

  const state = useMemo(() => computeTripState(stops, history), [stops, history]);

  // Voice announcements on the driver console mirror the passenger logic.
  useEffect(() => {
    if (!tripId || !voice) return;
    if (state.phase === "approaching" && state.nextStop) {
      announceOnce(`approach-${tripId}-${state.nextStop.id}`, `Next stop: ${state.nextStop.name}.`);
    }
    if (state.phase === "arrived" && state.currentStop) {
      announceOnce(`arrive-${tripId}-${state.currentStop.id}`, `You have arrived at ${state.currentStop.name}.`);
    }
  }, [state.phase, state.nextStop?.id, state.currentStop?.id, tripId, voice]);

  const pushLocation = async (coords: Coords, speedKmh: number | null) => {
    if (!tripId || !busId) return;
    const sample: Sample = { ...coords, speed_kmh: speedKmh, recorded_at: new Date().toISOString() };
    setHistory((prev) => [...prev.slice(-59), sample]);
    const { error } = await supabase.from("bus_locations").insert({
      bus_id: busId,
      trip_id: tripId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed_kmh: speedKmh,
    });
    if (error) setGpsError(error.message);
  };

  // Real GPS: continuous watch, sampled at the configured interval.
  useEffect(() => {
    if (!tripId || simulate) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("This device has no Geolocation support.");
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null);
        lastFix.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    const timer = setInterval(() => {
      if (lastFix.current) void pushLocation(lastFix.current, null);
    }, intervalSec * 1000);
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      clearInterval(timer);
    };
  }, [tripId, simulate, intervalSec, busId]);

  // Simulation mode: walk the route polyline through the exact same pipeline.
  useEffect(() => {
    if (!tripId || !simulate || stops.length < 2) return;
    const timer = setInterval(() => {
      const legs = stops.length - 1;
      simProgress.current = Math.min(simProgress.current + 0.012, legs);
      const idx = Math.min(Math.floor(simProgress.current), legs - 1);
      const t = simProgress.current - idx;
      const coords = interpolate(stops[idx]!, stops[idx + 1]!, t);
      void pushLocation(coords, 28);
    }, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [tripId, simulate, intervalSec, stops, busId]);

  const startTrip = async () => {
    if (!user || !busId || !routeId) {
      toast.error("Select a bus and a route first.");
      return;
    }
    const { data, error } = await supabase
      .from("trips")
      .insert({ bus_id: busId, route_id: routeId, driver_id: user.id, mode: simulate ? "simulation" : "gps" })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    resetAnnouncements();
    setHistory([]);
    simProgress.current = 0;
    setTripId(data.id);
    toast.success(simulate ? "Simulated trip started" : "Trip started — sharing GPS");
  };

  const endTrip = async () => {
    if (!tripId) return;
    const { error } = await supabase
      .from("trips")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", tripId);
    if (error) return toast.error(error.message);
    setTripId(null);
    toast.success("Trip completed");
  };

  const currentRoute = routes.find((r) => r.id === routeId);
  const pos = state.position;

  return (
    <AppShell title="Driver console" subtitle="Your phone is the bus GPS unit.">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Trip setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Bus</Label>
              <Select value={busId} onValueChange={(v) => {
                setBusId(v);
                const b = buses.find((x) => x.id === v);
                if (b?.route_id) setRouteId(b.route_id);
              }} disabled={!!tripId}>
                <SelectTrigger><SelectValue placeholder="Select a bus" /></SelectTrigger>
                <SelectContent>
                  {buses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>Bus #{b.bus_number} · {b.plate_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Route</Label>
              <Select value={routeId} onValueChange={setRouteId} disabled={!!tripId}>
                <SelectTrigger><SelectValue placeholder="Select a route" /></SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interval">Update interval (seconds)</Label>
              <Input
                id="interval"
                type="number"
                min={2}
                max={60}
                value={intervalSec}
                onChange={(e) => setIntervalSec(Math.max(2, Number(e.target.value) || 6))}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <FlaskConical className="size-4 text-accent" /> Simulation mode
              </div>
              <Switch checked={simulate} onCheckedChange={setSimulate} disabled={!!tripId} />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm">Voice announcements</span>
              <Switch checked={voice} onCheckedChange={setVoice} />
            </div>

            {tripId ? (
              <Button variant="destructive" className="w-full" onClick={() => void endTrip()}>
                <Square className="size-4" /> End trip
              </Button>
            ) : (
              <Button className="w-full" onClick={() => void startTrip()}>
                <Play className="size-4" /> Start trip
              </Button>
            )}
            {gpsError && <p className="text-xs text-destructive">{gpsError}</p>}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Trip status" value={tripId ? "Active" : "Idle"} />
            <Stat label="Current stop" value={state.currentStop?.name ?? "—"} />
            <Stat label="Next stop" value={state.nextStop?.name ?? "End of route"} />
            <Stat
              label="Distance to next"
              value={state.distanceToNextM !== null ? formatDistance(state.distanceToNextM) : "—"}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Live position</CardTitle>
              <Badge variant={tripId ? "default" : "secondary"}>
                <Satellite className="mr-1 size-3" />
                {pos ? `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}` : "No fix yet"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <LiveMap stops={stops} bus={pos} nextStopId={state.nextStop?.id} height="380px" />
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Route: {currentRoute ? `${currentRoute.origin} → ${currentRoute.destination}` : "—"}</span>
                <span>ETA: {formatEta(state.etaSeconds)}</span>
                <span>Speed: {state.speedKmh ? `${state.speedKmh.toFixed(0)} km/h` : "—"}</span>
                <span>Status: {state.statusLabel}</span>
                {pos && stops[0] && <span>From origin: {formatDistance(haversine(stops[0], pos))}</span>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}