import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { LiveMap } from "@/components/LiveMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Stop } from "@/lib/tracking";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Control centre — SmartStop administration" },
      { name: "description", content: "Manage buses, routes, ordered bus stops, drivers, trips and announcements for the GPS bus network." },
      { property: "og:title", content: "Control centre — SmartStop administration" },
      { property: "og:description", content: "Fleet, route and live-trip administration for the GPS bus announcement system." },
    ],
  }),
  component: AdminPage,
});

type Bus = { id: string; bus_number: string; plate_number: string; capacity: number; status: string; route_id: string | null };
type RouteRow = { id: string; name: string; origin: string; destination: string };
type Trip = { id: string; bus_id: string; route_id: string; driver_id: string; status: string; started_at: string; ended_at: string | null; mode: string };
type Profile = { id: string; full_name: string; email: string | null };
type Announcement = { id: string; title: string; message: string; severity: string; active: boolean };

function AdminPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [stops, setStops] = useState<(Stop & { route_id: string })[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleRows, setRoleRows] = useState<{ user_id: string; role: string }[]>([]);
  const [assignments, setAssignments] = useState<{ id: string; driver_id: string; bus_id: string }[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [latest, setLatest] = useState<Record<string, { latitude: number; longitude: number; recorded_at: string }>>({});
  const [mapRouteId, setMapRouteId] = useState<string>("");
  const [mapBusId, setMapBusId] = useState<string>("");

  useEffect(() => {
    if (!loading && (!user || role !== "admin")) void navigate({ to: user ? "/" : "/auth" });
  }, [user, role, loading]);

  const reload = async () => {
    const [b, r, s, t, p, ur, da, an, loc] = await Promise.all([
      supabase.from("buses").select("*").order("bus_number"),
      supabase.from("routes").select("*").order("name"),
      supabase.from("bus_stops").select("*").order("stop_order"),
      supabase.from("trips").select("*").order("started_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("id,full_name,email"),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("driver_assignments").select("*"),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("bus_locations").select("bus_id,latitude,longitude,recorded_at").order("recorded_at", { ascending: false }).limit(200),
    ]);
    setBuses((b.data ?? []) as Bus[]);
    setRoutes((r.data ?? []) as RouteRow[]);
    setStops((s.data ?? []) as (Stop & { route_id: string })[]);
    setTrips((t.data ?? []) as Trip[]);
    setProfiles((p.data ?? []) as Profile[]);
    setRoleRows(ur.data ?? []);
    setAssignments(da.data ?? []);
    setAnnouncements((an.data ?? []) as Announcement[]);
    const map: Record<string, { latitude: number; longitude: number; recorded_at: string }> = {};
    for (const row of loc.data ?? []) if (!map[row.bus_id]) map[row.bus_id] = row;
    setLatest(map);
  };

  useEffect(() => {
    if (role === "admin") void reload();
  }, [role]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-locations")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bus_locations" }, (payload) => {
        const row = payload.new as { bus_id: string; latitude: number; longitude: number; recorded_at: string };
        setLatest((prev) => ({ ...prev, [row.bus_id]: row }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => void reload())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, []);

  const drivers = profiles.filter((p) => roleRows.some((r) => r.user_id === p.id && r.role === "driver"));
  const passengers = profiles.filter((p) => roleRows.some((r) => r.user_id === p.id && r.role === "passenger"));
  const activeTrips = trips.filter((t) => t.status === "active");
  const tracked = Object.keys(latest).filter(
    (id) => Date.now() - new Date(latest[id]!.recorded_at).getTime() < 120000,
  );

  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p;
    if (error) toast.error(error.message);
    else {
      toast.success(ok);
      await reload();
    }
  };

  const mapStops = stops.filter((s) => s.route_id === (mapRouteId || routes[0]?.id));
  const mapBus = latest[mapBusId] ?? null;

  return (
    <AppShell title="Control centre" subtitle="Fleet, routes, stops, drivers and live operations.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total buses" value={buses.length} />
        <StatCard label="Active buses" value={buses.filter((b) => b.status === "active").length} />
        <StatCard label="Total routes" value={routes.length} />
        <StatCard label="Total bus stops" value={stops.length} />
        <StatCard label="Active trips" value={activeTrips.length} />
        <StatCard label="Buses being tracked" value={tracked.length} />
        <StatCard label="Registered drivers" value={drivers.length} />
        <StatCard label="Registered passengers" value={passengers.length} />
      </div>

      <Tabs defaultValue="fleet" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="fleet">Buses</TabsTrigger>
          <TabsTrigger value="routes">Routes &amp; stops</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="ops">Live operations</TabsTrigger>
          <TabsTrigger value="news">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="fleet" className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Add a bus</CardTitle></CardHeader>
            <CardContent>
              <form
                className="grid gap-3 sm:grid-cols-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const routeId = String(f.get("route_id") || "");
                  void run(
                    supabase.from("buses").insert({
                      bus_number: String(f.get("bus_number")),
                      plate_number: String(f.get("plate_number")),
                      capacity: Number(f.get("capacity")) || 30,
                      route_id: routeId || null,
                    }),
                    "Bus added",
                  );
                  e.currentTarget.reset();
                }}
              >
                <div><Label>Bus number</Label><Input name="bus_number" required /></div>
                <div><Label>Plate</Label><Input name="plate_number" required /></div>
                <div><Label>Capacity</Label><Input name="capacity" type="number" defaultValue={30} /></div>
                <div>
                  <Label>Route</Label>
                  <select name="route_id" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Unassigned</option>
                    {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <Button type="submit" className="self-end"><Plus className="size-4" /> Add</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Bus</TableHead><TableHead>Plate</TableHead><TableHead>Capacity</TableHead><TableHead>Route</TableHead><TableHead>Status</TableHead><TableHead /></TableRow>
                </TableHeader>
                <TableBody>
                  {buses.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">#{b.bus_number}</TableCell>
                      <TableCell>{b.plate_number}</TableCell>
                      <TableCell>{b.capacity}</TableCell>
                      <TableCell>
                        <Select
                          value={b.route_id ?? "none"}
                          onValueChange={(v) => void run(supabase.from("buses").update({ route_id: v === "none" ? null : v }).eq("id", b.id), "Route assigned")}
                        >
                          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.status === "active" ? "default" : "secondary"}>{b.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => void run(supabase.from("buses").delete().eq("id", b.id), "Bus deleted")}>
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routes" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Add a route</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(
                      supabase.from("routes").insert({
                        name: String(f.get("name")),
                        origin: String(f.get("origin")),
                        destination: String(f.get("destination")),
                      }),
                      "Route added",
                    );
                    e.currentTarget.reset();
                  }}
                >
                  <div><Label>Name</Label><Input name="name" required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Origin</Label><Input name="origin" required /></div>
                    <div><Label>Destination</Label><Input name="destination" required /></div>
                  </div>
                  <Button type="submit"><Plus className="size-4" /> Add route</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Add a bus stop</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(
                      supabase.from("bus_stops").insert({
                        route_id: String(f.get("route_id")),
                        name: String(f.get("name")),
                        latitude: Number(f.get("latitude")),
                        longitude: Number(f.get("longitude")),
                        stop_order: Number(f.get("stop_order")),
                      }),
                      "Stop added",
                    );
                    e.currentTarget.reset();
                  }}
                >
                  <div>
                    <Label>Route</Label>
                    <select name="route_id" required className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                      {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Stop name</Label><Input name="name" required /></div>
                    <div><Label>Order</Label><Input name="stop_order" type="number" min={1} required /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Latitude</Label><Input name="latitude" type="number" step="0.000001" required /></div>
                    <div><Label>Longitude</Label><Input name="longitude" type="number" step="0.000001" required /></div>
                  </div>
                  <Button type="submit"><Plus className="size-4" /> Add stop</Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {routes.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base">{r.name}</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => void run(supabase.from("routes").delete().eq("id", r.id), "Route deleted")}>
                  <Trash2 className="size-4" /> Delete route
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Order</TableHead><TableHead>Stop</TableHead><TableHead>Latitude</TableHead><TableHead>Longitude</TableHead><TableHead /></TableRow>
                  </TableHeader>
                  <TableBody>
                    {stops.filter((s) => s.route_id === r.id).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.stop_order}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.latitude}</TableCell>
                        <TableCell>{s.longitude}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => void run(supabase.from("bus_stops").delete().eq("id", s.id), "Stop deleted")}>
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="drivers">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Driver accounts &amp; bus assignments</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Driver</TableHead><TableHead>Email</TableHead><TableHead>Assigned buses</TableHead><TableHead>Assign</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((d) => {
                    const mine = assignments.filter((a) => a.driver_id === d.id);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.full_name || "—"}</TableCell>
                        <TableCell>{d.email}</TableCell>
                        <TableCell className="space-x-1">
                          {mine.map((a) => {
                            const bus = buses.find((b) => b.id === a.bus_id);
                            return (
                              <Badge key={a.id} variant="secondary" className="cursor-pointer"
                                onClick={() => void run(supabase.from("driver_assignments").delete().eq("id", a.id), "Assignment removed")}>
                                #{bus?.bus_number ?? "?"} ✕
                              </Badge>
                            );
                          })}
                          {mine.length === 0 && <span className="text-xs text-muted-foreground">All buses</span>}
                        </TableCell>
                        <TableCell>
                          <Select onValueChange={(v) => void run(supabase.from("driver_assignments").insert({ driver_id: d.id, bus_id: v }), "Bus assigned")}>
                            <SelectTrigger className="w-44"><SelectValue placeholder="Assign bus" /></SelectTrigger>
                            <SelectContent>
                              {buses.map((b) => <SelectItem key={b.id} value={b.id}>#{b.bus_number}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {drivers.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">No driver accounts yet — register one from the sign-up page.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ops" className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Buses currently tracked</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <Select value={mapRouteId || routes[0]?.id || ""} onValueChange={setMapRouteId}>
                  <SelectTrigger className="w-64"><SelectValue placeholder="Route" /></SelectTrigger>
                  <SelectContent>{routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={mapBusId} onValueChange={setMapBusId}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Bus to follow" /></SelectTrigger>
                  <SelectContent>{buses.map((b) => <SelectItem key={b.id} value={b.id}>#{b.bus_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <LiveMap stops={mapStops} bus={mapBus} height="340px" />
              <Table>
                <TableHeader><TableRow><TableHead>Bus</TableHead><TableHead>Latitude</TableHead><TableHead>Longitude</TableHead><TableHead>Last update</TableHead></TableRow></TableHeader>
                <TableBody>
                  {Object.entries(latest).map(([id, loc]) => {
                    const bus = buses.find((b) => b.id === id);
                    return (
                      <TableRow key={id}>
                        <TableCell>#{bus?.bus_number ?? "?"}</TableCell>
                        <TableCell>{loc.latitude.toFixed(5)}</TableCell>
                        <TableCell>{loc.longitude.toFixed(5)}</TableCell>
                        <TableCell>{new Date(loc.recorded_at).toLocaleTimeString()}</TableCell>
                      </TableRow>
                    );
                  })}
                  {Object.keys(latest).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">No GPS data received yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Trips (active &amp; history)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Bus</TableHead><TableHead>Route</TableHead><TableHead>Driver</TableHead><TableHead>Mode</TableHead><TableHead>Started</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {trips.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>#{buses.find((b) => b.id === t.bus_id)?.bus_number ?? "?"}</TableCell>
                      <TableCell>{routes.find((r) => r.id === t.route_id)?.name ?? "—"}</TableCell>
                      <TableCell>{profiles.find((p) => p.id === t.driver_id)?.full_name ?? "—"}</TableCell>
                      <TableCell>{t.mode}</TableCell>
                      <TableCell>{new Date(t.started_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {trips.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-sm text-muted-foreground">No trips recorded yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="news" className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Publish an announcement</CardTitle></CardHeader>
            <CardContent>
              <form
                className="grid gap-3 sm:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(
                    supabase.from("announcements").insert({
                      title: String(f.get("title")),
                      message: String(f.get("message")),
                      severity: String(f.get("severity") || "info"),
                    }),
                    "Announcement published",
                  );
                  e.currentTarget.reset();
                }}
              >
                <div><Label>Title</Label><Input name="title" required /></div>
                <div><Label>Message</Label><Input name="message" required /></div>
                <div className="flex items-end gap-2">
                  <select name="severity" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                  <Button type="submit">Publish</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 pt-6">
              {announcements.map((a) => (
                <div key={a.id} className="flex items-start justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="font-medium">{a.title} <Badge variant="secondary">{a.severity}</Badge></p>
                    <p className="text-sm text-muted-foreground">{a.message}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => void run(supabase.from("announcements").delete().eq("id", a.id), "Announcement deleted")}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {announcements.length === 0 && <p className="text-sm text-muted-foreground">No announcements.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}