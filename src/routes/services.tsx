import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { formatEur, quoteShipment, SERVICE_KINDS, SERVICE_LEVELS } from "@/lib/rates";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services and rates · Bridgeway Freighting" },
      {
        name: "description",
        content:
          "Courier parcels, checked luggage and consolidated freight with express, standard and economy transit options.",
      },
      { property: "og:title", content: "Services and rates · Bridgeway Freighting" },
      {
        property: "og:description",
        content: "Three service kinds, three transit speeds, one waybill.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bridgewaytrack.live/services" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://bridgewaytrack.live/services" }],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-10">
        <div className="font-mono text-[11px] tracking-[0.2em] text-primary">SERVICE CATALOGUE</div>
        <h1 className="mt-2 max-w-[20ch] font-display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95] font-black">
          What we move, and how fast.
        </h1>

        <div className="mt-10 divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
          <div className="grid grid-cols-[1.4fr_repeat(3,1fr)] gap-4 bg-background px-5 py-3">
            <span className="label-mono">Service</span>
            {SERVICE_LEVELS.map((level) => (
              <span key={level.value} className="label-mono text-right">
                {level.label} · {level.days}
              </span>
            ))}
          </div>
          {SERVICE_KINDS.map((kind) => (
            <div
              key={kind.value}
              className="grid grid-cols-[1.4fr_repeat(3,1fr)] items-center gap-4 px-5 py-5"
            >
              <div>
                <div className="font-display text-lg font-black tracking-tight">{kind.label}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{kind.blurb}</div>
              </div>
              {SERVICE_LEVELS.map((level) => (
                <div key={level.value} className="text-right font-mono text-sm">
                  {formatEur(
                    quoteShipment({ kind: kind.value, level: level.value, weightKg: 5 }).totalEur,
                  )}
                  <div className="label-mono">5 kg intl</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Panel title="Customs handled">
            Commercial invoice and HS data are collected at booking, so parcels clear without chasing
            paperwork at the border.
          </Panel>
          <Panel title="Chargeable weight">
            We bill the greater of actual weight and volumetric weight (L×W×H ÷ 5000), quoted before
            you confirm.
          </Panel>
          <Panel title="Scan-level proof">
            Every handoff writes a timestamped event to the waybill, from pickup to signature.
          </Panel>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/book"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm font-black text-primary-foreground transition-[filter] hover:brightness-110"
          >
            Book a shipment →
          </Link>
          <Link
            to="/track"
            className="rounded-lg bg-card px-6 py-3 font-display text-sm font-bold ring-1 ring-line"
          >
            Track a waybill
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card p-6 ring-1 ring-line">
      <h2 className="font-display text-lg font-black tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
