import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { Bus, LayoutDashboard, Map, Route as RouteIcon, LogOut, Radio } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: ReactNode };

const NAV: Record<string, NavItem[]> = {
  admin: [
    { to: "/admin", label: "Control centre", icon: <LayoutDashboard className="size-4" /> },
  ],
  driver: [{ to: "/driver", label: "Driver console", icon: <Radio className="size-4" /> }],
  passenger: [{ to: "/passenger", label: "Live buses", icon: <Map className="size-4" /> }],
};

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { role, fullName, user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/", label: "Home", icon: <Bus className="size-4" /> },
    ...(role ? NAV[role] ?? [] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <aside className="border-b border-sidebar-border bg-sidebar px-4 py-4 md:w-64 md:border-b-0 md:border-r md:py-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <RouteIcon className="size-5" />
          </span>
          <div>
            <p className="font-display text-sm font-bold leading-tight text-sidebar-foreground">
              SmartStop
            </p>
            <p className="text-xs text-muted-foreground">GPS bus intelligence</p>
          </div>
        </div>

        <nav className="mt-6 flex gap-2 md:flex-col">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                pathname === item.to
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {user && (
          <div className="mt-6 hidden rounded-md border border-sidebar-border p-3 text-xs md:block">
            <p className="font-medium text-sidebar-foreground">{fullName || user.email}</p>
            <p className="uppercase tracking-wide text-muted-foreground">{role ?? "no role"}</p>
            <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={() => void signOut()}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        )}
      </aside>

      <main className="flex-1 px-4 py-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold md:text-3xl">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {user && (
            <Button variant="outline" size="sm" className="md:hidden" onClick={() => void signOut()}>
              <LogOut className="size-4" /> Sign out
            </Button>
          )}
        </header>
        {children}
      </main>
    </div>
  );
}