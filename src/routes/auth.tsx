import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SmartStop Bus Tracking" },
      { name: "description", content: "Sign in or register as an administrator, driver or passenger to use live GPS bus tracking." },
      { property: "og:title", content: "Sign in — SmartStop Bus Tracking" },
      { property: "og:description", content: "Access the SmartStop admin, driver and passenger dashboards." },
    ],
  }),
  component: AuthPage,
});

const ROLES: { value: AppRole; label: string; hint: string }[] = [
  { value: "passenger", label: "Passenger", hint: "Track buses and get stop alerts" },
  { value: "driver", label: "Driver", hint: "Share bus GPS while driving" },
  { value: "admin", label: "Administrator", hint: "Manage fleet, routes and stops" },
];

function AuthPage() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [signupRole, setSignupRole] = useState<AppRole>("passenger");

  useEffect(() => {
    if (loading || !user) return;
    // Never strand a signed-in user on the auth screen: default to passenger
    // when the role row has not resolved.
    void navigate({ to: role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/passenger" });
  }, [user, role, loading]);

  const signIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Signed in");
  };

  const signUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: String(form.get("full_name")), role: signupRole },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Account created — you can sign in now.");
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10" style={{ background: "var(--gradient-hero)" }}>
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader>
          <CardTitle className="font-display text-2xl">SmartStop access</CardTitle>
          <CardDescription>Administrators, drivers and passengers use the same sign-in.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form className="space-y-4" onSubmit={signIn}>
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>Sign in</Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form className="space-y-4" onSubmit={signUp}>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" name="full_name" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input id="reg-password" name="password" type="password" minLength={6} required autoComplete="new-password" />
                </div>
                <div className="space-y-1.5">
                  <Label>Account type</Label>
                  <div className="grid gap-2">
                    {ROLES.map((r) => (
                      <button
                        type="button"
                        key={r.value}
                        onClick={() => setSignupRole(r.value)}
                        className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          signupRole === r.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <span className="font-medium">{r.label}</span>
                        <span className="block text-xs text-muted-foreground">{r.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>Create account</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}