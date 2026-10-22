import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in · Bridgeway Freighting" },
      {
        name: "description",
        content: "Sign in to book shipments, schedule pickups and follow your Bridgeway Freighting waybills.",
      },
      { property: "og:title", content: "Sign in · Bridgeway Freighting" },
      { property: "og:description", content: "Access your Bridgeway Freighting shipping dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safePath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const target = safePath(redirect);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: target, replace: true });
    });
  }, [navigate, target]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast.success("Check your email to confirm your account.");
          return;
        }
        navigate({ to: target, replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: target, replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Google sign-in failed. Try email instead.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: target, replace: true });
    } catch {
      toast.error("Google sign-in failed. Try email instead.");
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-16">
        <div className="mx-auto max-w-md">
          <div className="font-mono text-[11px] tracking-[0.2em] text-primary">ACCESS CONTROL</div>
          <h1 className="mt-2 font-display text-4xl font-black tracking-tight">
            {mode === "signin" ? "Sign in to Bridgeway" : "Open a shipping account"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Book shipments, schedule pickups and keep every waybill on one board.
          </p>

          <div className="mt-8 rounded-xl bg-card p-6 ring-1 ring-line">
            {sent ? (
              <p className="font-mono text-sm">
                Confirmation sent to {email}. Click the link, then sign in.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label className="label-mono" htmlFor="name">
                      Full name
                    </label>
                    <input
                      id="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </div>
                )}
                <div>
                  <label className="label-mono" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="label-mono" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className={inputCls}
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-md bg-primary py-3 font-display text-sm font-black text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
                >
                  {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>
            )}

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="label-mono">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <button
              onClick={handleGoogle}
              className="w-full rounded-md bg-foreground py-3 font-display text-sm font-bold text-background transition-colors hover:bg-primary"
            >
              Continue with Google
            </button>

            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setSent(false);
              }}
              className="mt-5 w-full font-mono text-[11px] tracking-[0.15em] text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "NO ACCOUNT? REGISTER" : "ALREADY REGISTERED? SIGN IN"}
            </button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md bg-background px-3 py-2.5 font-mono text-sm ring-1 ring-line focus:ring-2 focus:ring-primary focus:outline-none";
