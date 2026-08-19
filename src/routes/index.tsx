import { createFileRoute, Link } from "@tanstack/react-router";
import { Bus, MapPin, Radio, Volume2, ShieldCheck, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartStop — Intelligent GPS Bus Stop Announcements" },
      {
        name: "description",
        content:
          "Track city buses live from the driver's phone GPS, detect the next stop automatically and deliver voice announcements to passengers.",
      },
      { property: "og:title", content: "SmartStop — Intelligent GPS Bus Stop Announcements" },
      {
        property: "og:description",
        content:
          "Live GPS bus tracking, context-aware stop detection, ETA and voice announcements for passengers.",
      },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: Radio, title: "Driver phone as GPS", body: "The driver's browser streams coordinates to the backend every few seconds — no hardware installation." },
  { icon: MapPin, title: "Context-aware stops", body: "Route-order logic detects approach, arrival and deviation using Haversine distances." },
  { icon: Volume2, title: "Voice announcements", body: "\"Next stop: Remera.\" spoken once per stop with the Web Speech API." },
  { icon: Navigation, title: "Live passenger map", body: "OpenStreetMap + Leaflet with a bus marker that moves in real time." },
  { icon: Bus, title: "Fleet management", body: "Admins manage buses, routes, ordered stops, drivers and announcements." },
  { icon: ShieldCheck, title: "Role-based access", body: "Admin, driver and passenger roles enforced by database policies." },
];

function Index() {
  const { user, role } = useAuth();
  const dashboard = role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/passenger";

  return (
    <div className="min-h-screen">
      <header
        className="border-b border-border px-6 py-20"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-5xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <Bus className="size-3.5" /> Public transport intelligence
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-tight md:text-6xl">
            Intelligent GPS bus stop announcement &amp; passenger information system
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            A driver's smartphone streams live GPS to the backend. Passengers see the bus move on the
            map, learn the current and next stop, distance and ETA — and hear the stop announced out loud.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Button asChild size="lg">
                <Link to={dashboard}>Open my dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link to="/auth">Create an account</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth" search={{ mode: "login" }}>Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="font-display text-2xl font-bold">How the system works</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Driver smartphone → GPS location → driver app → backend → database → realtime broadcast →
          passenger app → live bus location.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="border-border bg-card">
              <CardContent className="pt-6">
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-3 font-display text-base font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
