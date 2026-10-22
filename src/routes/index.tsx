import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, Globe2, PackageCheck, Plane, Search, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-session";
import { useMemo, useState } from "react";

import cargoOperations from "@/assets/bridgeway-cargo-operations.jpg";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { ProgressBar, StatusPill } from "@/components/shipment-bits";
import { listMyShipments } from "@/lib/shipments.functions";
import {
  formatEur,
  quoteShipment,
  SERVICE_KINDS,
  SERVICE_LEVELS,
  type ServiceKind,
  type ServiceLevel,
} from "@/lib/rates";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bridgeway Freighting · International courier and freight delivery" },
      {
        name: "description",
        content:
          "Get instant shipping rates, schedule pickups and track courier parcels, luggage and freight across 140 international corridors.",
      },
      { property: "og:title", content: "Bridgeway Freighting · Global delivery made clear" },
      {
        property: "og:description",
        content: "Book and track international courier, luggage and freight deliveries.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bridgewaytrack.live/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bridgewaytrack.live/" }],
  }),
  component: Home,
  errorComponent: ({ error }) => <div className="p-10 text-sm" role="alert">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-10 text-sm">Page not found.</div>,
});

function Home() {
  const { user, loading } = useSession();
  const list = useServerFn(listMyShipments);
  const activity = useQuery({ queryKey: ["my-shipments", user?.id], queryFn: () => list(), enabled: !!user });
  const navigate = useNavigate();
  const [tracking, setTracking] = useState("");
  const [kind, setKind] = useState<ServiceKind>("courier");
  const [level, setLevel] = useState<ServiceLevel>("express");
  const [origin, setOrigin] = useState("FRA — Frankfurt, DE");
  const [dest, setDest] = useState("HND — Tokyo, JP");
  const [weight, setWeight] = useState("24");
  const quote = useMemo(
    () => quoteShipment({ kind, level, weightKg: Number(weight) || 1, pieces: 1 }),
    [kind, level, weight],
  );

  function submitTracking(event: React.FormEvent) {
    event.preventDefault();
    if (tracking.trim().length < 3) return;
    navigate({ to: "/track/$tracking", params: { tracking: tracking.trim() } });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden bg-secondary text-secondary-foreground">
          <img src={cargoOperations} alt="Freight team loading cargo onto an international aircraft" width={1600} height={900} className="absolute inset-0 -z-20 size-full object-cover object-center" />
          <div className="hero-scrim absolute inset-0 -z-10" />
          <div className="mx-auto flex min-h-[510px] max-w-[1440px] flex-col justify-center px-6 py-12 sm:min-h-[560px] lg:px-12">
            <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase text-accent"><span className="h-px w-8 bg-accent" />International courier & freight</div>
            <h1 className="notranslate max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">BRIDGEWAY<br />FREIGHTING</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-secondary-foreground/85">Across borders. Closer to you.<br />Door-to-door courier, luggage and freight delivery.</p>
            <form onSubmit={submitTracking} className="mt-8 flex w-full max-w-xl gap-2 rounded-md bg-card p-2 text-foreground shadow-lg">
              <div className="flex min-w-0 flex-1 items-center gap-2 px-2"><Search className="size-5 shrink-0 text-primary" /><input value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Enter your tracking number" aria-label="Tracking number" required minLength={3} maxLength={40} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /></div>
              <Button type="submit" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">Track <ArrowRight className="size-4" /></Button>
            </form>
            <div className="mt-5 flex flex-wrap gap-6 text-sm font-semibold"><Link to="/book" className="inline-flex items-center gap-2 hover:text-accent">Book a shipment <ArrowRight className="size-4" /></Link><Link to="/contact" className="text-secondary-foreground/80 hover:text-accent">Speak to our team</Link></div>
          </div>
        </section>

        <section className="border-b border-line bg-card">
          <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-y divide-line md:grid-cols-4 md:divide-y-0">
            <Proof icon={Globe2} value="140" label="International corridors" />
            <Proof icon={PackageCheck} value="24/7" label="Shipment visibility" />
            <Proof icon={ShieldCheck} value="99.4%" label="Hub uptime" />
            <Proof icon={CalendarCheck} value="9" label="Global sorting hubs" />
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-6 py-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Get a shipping estimate</div>
              <h2 className="mt-2 font-display text-3xl font-bold">Plan your next delivery</h2>
              <div className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
                <Field label="Origin"><input value={origin} onChange={(event) => setOrigin(event.target.value)} className={inputCls} /></Field>
                <Field label="Destination"><input value={dest} onChange={(event) => setDest(event.target.value)} className={inputCls} /></Field>
                <Field label="Weight (kg)"><input value={weight} inputMode="decimal" onChange={(event) => setWeight(event.target.value)} className={inputCls} /></Field>
                <Field label="Service">
                  <select value={`${kind}:${level}`} onChange={(event) => {
                    const [nextKind, nextLevel] = event.target.value.split(":");
                    setKind(nextKind as ServiceKind);
                    setLevel(nextLevel as ServiceLevel);
                  }} className={inputCls}>
                    {SERVICE_KINDS.flatMap((serviceKind) => SERVICE_LEVELS.map((serviceLevel) => (
                      <option key={`${serviceKind.value}:${serviceLevel.value}`} value={`${serviceKind.value}:${serviceLevel.value}`}>
                        {serviceKind.label} · {serviceLevel.label} · {serviceLevel.days}
                      </option>
                    )))}
                  </select>
                </Field>
                <div className="flex items-end justify-between gap-4 border-t border-line pt-5 sm:col-span-2">
                  <div><div className="text-xs text-muted-foreground">Estimated rate · {quote.chargeableKg} kg chargeable</div><div className="mt-1 font-display text-3xl font-bold">{formatEur(quote.totalEur)}</div></div>
                  <Link to="/book" search={{ origin, dest, weight, kind, level }} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Book shipment <ArrowRight className="size-4" /></Link>
                </div>
              </div>
            </div>

            <section aria-label="Your recent shipments">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><div className="text-xs font-bold uppercase text-primary">Your shipping overview</div><h2 className="mt-2 font-display text-3xl font-bold">Recent activity</h2></div>
                {user && <Link to="/dashboard" className="text-sm font-semibold text-primary hover:underline">View all →</Link>}
              </div>
              <div className="mt-6 space-y-3">
                {loading || (user && activity.isPending) ? <p className="py-8 text-sm text-muted-foreground">Loading your shipments…</p> : !user ? <div className="border-y border-line py-10"><PackageCheck className="mb-5 size-8 text-primary" /><h3 className="font-display text-xl font-bold">Your deliveries, in one place</h3><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Sign in to view your bookings, delivery progress and shipment history.</p><Button asChild className="mt-6"><Link to="/auth">Sign in to your account <ArrowRight className="size-4" /></Link></Button></div> : activity.error ? <div className="py-8"><p role="alert" className="text-sm text-destructive">Unable to load your shipments.</p><Button variant="outline" className="mt-3" onClick={() => activity.refetch()}>Try again</Button></div> : !activity.data?.length ? <div className="border-y border-line py-10"><PackageCheck className="mb-5 size-8 text-primary" /><h3 className="font-display text-xl font-bold">No shipments booked yet</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Your recent deliveries will appear here once you book.</p><Button asChild className="mt-6"><Link to="/book">Book your first shipment <ArrowRight className="size-4" /></Link></Button></div> : activity.data.slice(0,3).map((shipment) => (
                  <Link key={shipment.id} to="/shipments/$id" params={{ id: shipment.id }} className="block rounded-md border border-line bg-card p-5 transition-colors hover:border-primary">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-semibold text-muted-foreground">{shipment.tracking_number}</div><div className="mt-1 font-display text-lg font-bold">{shipment.origin_code || shipment.origin_city} → {shipment.dest_code || shipment.dest_city}</div></div><StatusPill status={shipment.status} /></div>
                    <div className="mt-4"><ProgressBar status={shipment.status} progress={shipment.progress} /></div>
                    <div className="mt-3 text-xs text-muted-foreground">{shipment.eta ? `Estimated delivery ${new Date(shipment.eta).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Delivery being scheduled"}</div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="bg-card py-14">
          <div className="mx-auto max-w-[1440px] px-6">
            <div className="max-w-2xl"><div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Freight services</div><h2 className="mt-2 font-display text-3xl font-bold">One reliable partner for every shipment</h2><p className="mt-3 text-muted-foreground">From a single urgent parcel to consolidated commercial freight, choose the service built around your timeline.</p></div>
            <div className="mt-8 grid gap-px overflow-hidden rounded-md bg-line ring-1 ring-line md:grid-cols-3">
              {SERVICE_KINDS.map((service, index) => (
                <div key={service.value} className="bg-background p-6">
                  <div className="grid size-11 place-items-center rounded-md bg-primary/10 text-primary">{index === 0 ? <PackageCheck className="size-5" /> : index === 1 ? <ShieldCheck className="size-5" /> : <Plane className="size-5" />}</div>
                  <h3 className="mt-5 font-display text-xl font-bold">{service.label}</h3>
                  <p className="mt-2 min-h-10 text-sm text-muted-foreground">{service.blurb}</p>
                  <div className="mt-5 text-sm font-semibold text-primary">From {formatEur(quoteShipment({ kind: service.value, level: "standard", weightKg: 1 }).totalEur)}</div>
                </div>
              ))}
            </div>
            <Link to="/services" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Compare all services <ArrowRight className="size-4" /></Link>
          </div>
        </section>
        <section className="border-y border-line bg-background"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-6 px-6 py-10"><div><p className="text-xs font-semibold uppercase text-primary">Personal service. Global reach.</p><h2 className="mt-3 font-display text-2xl font-bold">Let’s talk about your next delivery.</h2></div><Button asChild variant="outline" className="gap-2"><Link to="/contact">Contact our team <ArrowRight className="size-4" /></Link></Button></div></section>
      </main>
      <SiteFooter />
    </div>
  );
}

const inputCls = "mt-1.5 w-full rounded-md bg-background px-3 py-3 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-muted-foreground">{label}{children}</label>;
}

function Proof({ icon: Icon, value, label }: { icon: typeof Globe2; value: string; label: string }) {
  return <div className="flex items-center gap-3 px-5 py-5 sm:px-7"><Icon className="size-5 shrink-0 text-primary" /><div><div className="font-display text-xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div></div>;
}