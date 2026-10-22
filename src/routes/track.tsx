import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TrackForm } from "@/components/track-form";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track a shipment · Bridgeway Freighting" },
      {
        name: "description",
        content:
          "Enter a Bridgeway Freighting waybill number to see live scan events, customs status and estimated delivery.",
      },
      { property: "og:title", content: "Track a shipment · Bridgeway Freighting" },
      {
        property: "og:description",
        content: "Live scan events and estimated delivery for any Bridgeway Freighting waybill.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bridgewaytrack.live/track" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://bridgewaytrack.live/track" }],
  }),
  component: TrackLayout,
});

function TrackLayout() {
  const matches = useMatches();
  const isChild = matches.some((m) => m.routeId === "/track/$tracking");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-10">
        {isChild ? (
          <Outlet />
        ) : (
          <div className="mx-auto max-w-2xl py-10">
            <div className="font-mono text-[11px] tracking-[0.2em] text-primary">
              TRACKING DESK
            </div>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight">
              Where is my shipment?
            </h1>
            <p className="mt-3 text-muted-foreground">
              Waybill numbers look like <span className="font-mono">MRD-26-4471-9920</span>.
            </p>
            <div className="mt-6 rounded-xl bg-card p-4 ring-1 ring-line">
              <TrackForm />
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
