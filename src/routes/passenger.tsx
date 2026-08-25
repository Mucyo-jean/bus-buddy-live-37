import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Volume2, VolumeX, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { LiveMap } from "@/components/LiveMap";
import { useBusTracking } from "@/hooks/useBusTracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistance, formatEta, haversine } from "@/lib/geo";
import { TRACKING_CONFIG, type Stop } from "@/lib/tracking";
import {
  announceOnce,
  isVoiceSupported,
  primeVoice,
  resetAnnouncements,
  setVoiceEnabled,
  speak,
} from "@/lib/speech";

export const Route = createFileRoute("/passenger")({
  head: () => ({
    meta: [
      { title: "Live bus tracking — SmartStop passengers" },
      { name: "description", content: "Follow your bus on a live map, see the next stop, distance and ETA, and get voice announcements." },
      { property: "og:title", content: "Live bus tracking — SmartStop passengers" },
      { property: "og:description", content: "Next stop, distance, ETA and destination alerts for city bus passengers." },
    ],
  }),
  component: PassengerPage,
});

type Bus = { id: string; bus_number: string; plate_number: string; status: string; route_id: string | null };
type RouteRow = { id: string; name: string; origin: string; destination: string };

function PassengerPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [query, setQuery] = useState("");
  const [busId, setBusId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [voice, setVoice] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [log, setLog] = useState<{ at: string; text: string }[]>([]);
  const [activeTripBusIds, setActiveTripBusIds] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [user, loading]);

  useEffect(() => setVoiceEnabled(voice), [voice]);

  const logAnnouncement = (text: string) =>
    setLog((prev) => [{ at: new Date().toLocaleTimeString(), text }, ...prev].slice(0, 8));

  const enableAudio = () => {
    if (primeVoice()) {
      setAudioReady(true);
      setVoice(true);
      setVoiceEnabled(true);
      speak("Voice announcements enabled.");
      logAnnouncement("Voice announcements enabled.");
    } else {
      toast.error("Voice announcements are not supported in this browser.");
    }
  };

  useEffect(() => {
    void (async () => {
      const [{ data: busRows }, { data: routeRows }, { data: trips }] = await Promise.all([
        supabase.from("buses").select("id,bus_number,plate_number,status,route_id").order("bus_number"),
        supabase.from("routes").select("id,name,origin,destination"),
        supabase.from("trips").select("bus_id").eq("status", "active"),
      ]);
      setBuses((busRows ?? []) as Bus[]);
      setRoutes((routeRows ?? []) as RouteRow[]);
      setActiveTripBusIds((trips ?? []).map((t) => t.bus_id));
    })();
  }, []);

  const selectedBus = buses.find((b) => b.id === busId) ?? null;
  const selectedRoute = routes.find((r) => r.id === selectedBus?.route_id) ?? null;

  useEffect(() => {
    resetAnnouncements();
    if (!selectedBus?.route_id) return setStops([]);
    void supabase
      .from("bus_stops")
      .select("id,name,latitude,longitude,stop_order")
      .eq("route_id", selectedBus.route_id)
      .order("stop_order")
      .then(({ data }) => setStops((data ?? []) as Stop[]));
  }, [selectedBus?.route_id, busId]);

  const { state } = useBusTracking(busId, stops);

  // Restore any saved destination for this bus.
  useEffect(() => {
    if (!user || !busId) return;
    void supabase
      .from("passenger_destinations")
      .select("stop_id")
      .eq("passenger_id", user.id)
      .eq("bus_id", busId)
      .maybeSingle()
      .then(({ data }) => setDestinationId(data?.stop_id ?? null));
  }, [user, busId]);

  const destination = stops.find((s) => s.id === destinationId) ?? null;
  const distanceToDestination =
    destination && state.position ? haversine(state.position, destination) : null;

  // Context-aware announcements.
  useEffect(() => {
    if (!busId || state.stale) return;
    if (state.phase === "approaching" && state.nextStop) {
      const text = `Next stop: ${state.nextStop.name}.`;
      if (announceOnce(`approach-${busId}-${state.nextStop.id}`, text)) {
        toast(text);
        logAnnouncement(text);
      }
    }
    if (state.phase === "arrived" && state.currentStop) {
      const text = `You have arrived at ${state.currentStop.name}.`;
      if (announceOnce(`arrive-${busId}-${state.currentStop.id}`, text)) {
        toast.success(text);
        logAnnouncement(text);
      }
    }
  }, [state.phase, state.nextStop?.id, state.currentStop?.id, busId, state.stale]);

  useEffect(() => {
    if (!destination || distanceToDestination === null) return;
    if (distanceToDestination <= TRACKING_CONFIG.approachRadiusM * 2) {
      const text = `Your destination, ${destination.name}, is approaching.`;
      if (announceOnce(`destination-${busId}-${destination.id}`, text)) {
        toast.warning(text);
        logAnnouncement(text);
      }
    }
  }, [distanceToDestination, destination?.id, busId]);

  const saveDestination = async (stop: Stop) => {
    if (!user || !busId) return;
    setDestinationId(stop.id);
    const { error } = await supabase
      .from("passenger_destinations")
      .upsert({ passenger_id: user.id, bus_id: busId, stop_id: stop.id }, { onConflict: "passenger_id,bus_id" });
    if (error) toast.error(error.message);
    else toast.success(`Destination set: ${stop.name}`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return buses.filter((b) => {
      const route = routes.find((r) => r.id === b.route_id);
      return (
        !q ||
        b.bus_number.toLowerCase().includes(q) ||
        b.plate_number.toLowerCase().includes(q) ||
        (route?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [buses, routes, query]);

  return (
    <AppShell title="Live buses" subtitle="Pick your bus, set your stop, and let the system tell you when to get off.">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Available buses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search bus or route"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              {filtered.map((b) => {
                const route = routes.find((r) => r.id === b.route_id);
                const live = activeTripBusIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => setBusId(b.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      busId === b.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-semibold">Bus #{b.bus_number}</span>
                      {live && <Badge className="bg-success text-success-foreground">Live</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {route ? `${route.origin} → ${route.destination}` : "Unassigned route"}
                    </p>
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground">No buses match your search.</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {!selectedBus ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Select a bus to see its live position, stops and announcements.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base">Bus #{selectedBus.bus_number}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {selectedRoute ? `${selectedRoute.origin} → ${selectedRoute.destination}` : "No route assigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const text = state.nextStop
                          ? `Next stop: ${state.nextStop.name}.`
                          : "Voice announcements are working.";
                        if (!audioReady) primeVoice();
                        setAudioReady(true);
                        speak(text);
                        logAnnouncement(`Test — ${text}`);
                      }}
                    >
                      Test announcement
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setVoice((v) => !v)}>
                      {voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                      {voice ? "Voice on" : "Voice off"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isVoiceSupported() && !audioReady && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm">
                      <span>Enable sound so stop announcements can play automatically.</span>
                      <Button size="sm" onClick={enableAudio}>Enable voice</Button>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Info label="Current stop" value={state.currentStop?.name ?? "—"} />
                    <Info label="Next stop" value={state.nextStop?.name ?? "End of route"} />
                    <Info
                      label="Distance"
                      value={state.distanceToNextM !== null ? formatDistance(state.distanceToNextM) : "—"}
                    />
                    <Info label="Estimated arrival" value={formatEta(state.etaSeconds)} />
                  </div>
                  <div
                    className={`rounded-md border px-3 py-2 text-sm ${
                      state.stale || state.deviated
                        ? "border-destructive/60 bg-destructive/10 text-destructive"
                        : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    Status: {state.statusLabel}
                  </div>
                  <LiveMap
                    stops={stops}
                    bus={state.position}
                    nextStopId={state.nextStop?.id ?? null}
                    destinationStopId={destinationId}
                    height="360px"
                  />
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Announcements</p>
                    {log.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Announcements will appear here as the bus approaches and arrives at stops.
                      </p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-sm">
                        {log.map((l, i) => (
                          <li key={`${l.at}-${i}`} className="flex gap-2">
                            <span className="text-xs text-muted-foreground">{l.at}</span>
                            <span>{l.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Stops on this route</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stops.map((s) => {
                    const isDest = s.id === destinationId;
                    const isNext = s.id === state.nextStop?.id;
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                          isDest ? "border-primary bg-primary/10" : "border-border"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <span>{s.stop_order}. {s.name}</span>
                            {isNext && <Badge variant="secondary">Next</Badge>}
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {state.position ? formatDistance(haversine(state.position, s)) : "Awaiting GPS"}
                          </p>
                        </div>
                        <Button size="sm" variant={isDest ? "default" : "outline"} onClick={() => void saveDestination(s)}>
                          <BellRing className="size-4" />
                          {isDest ? "My stop" : "Set as my stop"}
                        </Button>
                      </div>
                    );
                  })}
                  {destination && distanceToDestination !== null && (
                    <p className="pt-1 text-sm text-muted-foreground">
                      {formatDistance(distanceToDestination)} to your destination ({destination.name}).
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-base font-semibold">{value}</p>
    </div>
  );
}