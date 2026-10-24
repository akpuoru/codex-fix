import { Link, useNavigate } from "@tanstack/react-router";
import { LanguagePicker } from "@/components/auto-translate";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, PackageCheck, X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/book", label: "BOOK" },
  { to: "/track", label: "TRACK" },
  { to: "/network", label: "NETWORK" },
  { to: "/services", label: "SERVICES" },
  { to: "/contact", label: "CONTACT" },
  { to: "/admin", label: "ADMIN" },
] as const;

export function SiteHeader() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-sm bg-primary text-primary-foreground">
            <PackageCheck className="size-6" strokeWidth={2.2} />
          </div>
          <div className="leading-none">
            <div className="notranslate font-display text-[15px] font-bold">BRIDGEWAY</div>
            <div className="notranslate mt-1 text-[10px] font-bold tracking-[0.14em] text-accent">FLIGHTS & FREIGHT</div>
          </div>
        </Link>

        <nav className="ml-4 hidden items-center gap-5 text-xs font-semibold text-muted-foreground lg:flex">
          <a href="/flights" className="transition-colors hover:text-foreground">FLIGHTS</a>
          <a href="/cars" className="transition-colors hover:text-foreground">CAR HIRE</a>
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight xl:block">
            <div className="text-[10px] font-semibold text-muted-foreground">GLOBAL OPERATIONS</div>
            <div className="text-xs font-semibold text-success">● NETWORK ONLINE</div>
          </div>
          <LanguagePicker />
          {loading ? null : user ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-md bg-foreground px-5 py-2.5 font-display text-sm font-bold tracking-wide text-background transition-colors hover:bg-primary"
              >
                Dashboard
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="hidden text-[11px] font-semibold text-muted-foreground md:inline-flex"
              >
                SIGN OUT
              </Button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-md bg-foreground px-5 py-2.5 font-display text-sm font-bold tracking-wide text-background transition-colors hover:bg-primary"
            >
              Sign in
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>
      {menuOpen && (
        <nav className="grid border-t border-line bg-card px-4 py-3 lg:hidden">
          <a href="/flights" onClick={() => setMenuOpen(false)} className="border-b border-line py-3 text-sm font-semibold">FLIGHTS</a>
          <a href="/cars" onClick={() => setMenuOpen(false)} className="border-b border-line py-3 text-sm font-semibold">CAR HIRE</a>
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className="border-b border-line py-3 text-sm font-semibold last:border-0">
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="h-1 bg-accent" />
    </header>
  );
}
