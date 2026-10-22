import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const HUBS = [
  { code: "FRA", city: "Frankfurt", region: "Europe", belts: 12, status: "Running" },
  { code: "LHR", city: "London", region: "Europe", belts: 9, status: "Running" },
  { code: "JFK", city: "New York", region: "Americas", belts: 11, status: "Running" },
  { code: "MEX", city: "Mexico City", region: "Americas", belts: 5, status: "Running" },
  { code: "DXB", city: "Dubai", region: "Middle East", belts: 14, status: "Peak load" },
  { code: "SIN", city: "Singapore", region: "Asia Pacific", belts: 10, status: "Running" },
  { code: "HND", city: "Tokyo", region: "Asia Pacific", belts: 8, status: "Running" },
  { code: "SYD", city: "Sydney", region: "Asia Pacific", belts: 6, status: "Running" },
  { code: "JNB", city: "Johannesburg", region: "Africa", belts: 4, status: "Running" },
];

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Network and hubs · Bridgeway Freighting" },
      {
        name: "description",
        content:
          "Bridgeway Freighting sorting hubs across Europe, the Americas, the Middle East, Asia Pacific and Africa, serving 140 international corridors.",
      },
      { property: "og:title", content: "Network and hubs · Bridgeway Freighting" },
      { property: "og:description", content: "Nine sorting hubs, 140 corridors, 24/7 sorting." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bridgewaytrack.live/network" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://bridgewaytrack.live/network" }],
  }),
  component: NetworkPage,
});

function NetworkPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-10">
        <div className="font-mono text-[11px] tracking-[0.2em] text-primary">NETWORK MAP</div>
        <h1 className="mt-2 max-w-[22ch] font-display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95] font-black">
          Nine sorting hubs. 140 corridors.
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Corridors served" value="140" />
          <Stat label="Hub sorting uptime" value="99.4%" />
          <Stat label="Average customs clearance" value="6h 20m" />
        </div>

        <div className="mt-10 divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
          <div className="grid grid-cols-[80px_1fr_1fr_80px_120px] gap-4 bg-background px-5 py-3">
            <span className="label-mono">Code</span>
            <span className="label-mono">Hub</span>
            <span className="label-mono">Region</span>
            <span className="label-mono text-right">Belts</span>
            <span className="label-mono text-right">Status</span>
          </div>
          {HUBS.map((hub) => (
            <div
              key={hub.code}
              className="grid grid-cols-[80px_1fr_1fr_80px_120px] items-center gap-4 px-5 py-4 transition-colors hover:bg-background"
            >
              <span className="font-display text-sm font-black">{hub.code}</span>
              <span className="font-mono text-sm">{hub.city}</span>
              <span className="font-mono text-xs text-muted-foreground">{hub.region}</span>
              <span className="text-right font-mono text-sm">{hub.belts}</span>
              <span
                className={`text-right font-mono text-[11px] ${
                  hub.status === "Running" ? "text-success" : "text-caution"
                }`}
              >
                ● {hub.status}
              </span>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-line">
      <div className="label-mono">{label}</div>
      <div className="mt-1 font-display text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}
