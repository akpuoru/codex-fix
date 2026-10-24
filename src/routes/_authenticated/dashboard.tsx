import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProgressBar, StatusDot, StatusPill } from "@/components/shipment-bits";
import { listMyShipments } from "@/lib/shipments.functions";
import { useSession } from "@/hooks/use-session";
import { formatCents } from "@/lib/rates";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your shipments · Bridgeway Freighting" },
      {
        name: "description",
        content: "Your Bridgeway Freighting shipment overview: active waybills, statuses, ETAs and spend.",
      },
      { property: "og:title", content: "Your shipments · Bridgeway Freighting" },
      { property: "og:description", content: "Track every waybill you have booked." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useSession();
  const fetchShipments = useServerFn(listMyShipments);
  const { data, isPending, error } = useQuery({
    queryKey: ["my-shipments", user?.id],
    enabled: !!user,
    queryFn: () => fetchShipments(),
  });

  const shipments = data ?? [];
  const inTransit = shipments.filter(
    (s) => s.status !== "delivered" && s.status !== "booked",
  ).length;
  const spend = shipments.reduce((sum, s) => sum + s.price_cents, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] text-primary">
              CONSIGNOR CONSOLE
            </div>
            <h1 className="mt-1 font-display text-3xl font-bold">Your shipments</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/stays/book" className="rounded-lg bg-card px-5 py-3 font-display text-sm font-bold ring-1 ring-line transition-colors hover:border-primary hover:text-primary">Book a hotel →</Link>
            <Link
              to="/book"
              className="rounded-lg bg-primary px-6 py-3 font-display text-sm font-black text-primary-foreground transition-[filter] hover:brightness-110"
            >
              New shipment →
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Total shipments" value={String(shipments.length)} />
          <Stat label="Moving now" value={String(inTransit)} />
          <Stat label="Booked spend" value={formatCents(spend)} />
        </div>

        <div className="mt-8 divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
          {isPending && (
            <div className="px-5 py-8 font-mono text-sm text-muted-foreground">
              Reading the board…
            </div>
          )}
          {error && (
            <div className="px-5 py-8 font-mono text-sm text-destructive" role="alert">
              {(error as Error).message}
            </div>
          )}
          {!isPending && !error && shipments.length === 0 && (
            <div className="px-5 py-12 text-center">
              <div className="label-mono">No activity</div>
              <p className="mt-2 font-display text-xl font-black tracking-tight">
                No shipments booked yet
              </p>
              <Link
                to="/book"
                className="mt-5 inline-flex rounded-md bg-foreground px-5 py-2.5 font-display text-sm font-bold text-background hover:bg-primary"
              >
                Build your first waybill
              </Link>
            </div>
          )}
          {shipments.map((shipment) => (
            <Link
              key={shipment.id}
              to="/shipments/$id"
              params={{ id: shipment.id }}
              className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-background"
            >
              <StatusDot status={shipment.status} />
              <div className="w-44 font-mono text-sm">{shipment.tracking_number}</div>
              <div className="w-40 font-display text-sm font-bold">
                {shipment.origin_code ?? shipment.origin_city} →{" "}
                {shipment.dest_code ?? shipment.dest_city}
              </div>
              <div className="hidden w-40 md:block">
                <ProgressBar status={shipment.status} progress={shipment.progress} />
              </div>
              <div className="ml-auto">
                <StatusPill status={shipment.status} />
              </div>
              <div className="w-24 text-right font-mono text-xs">
                {formatCents(shipment.price_cents, shipment.currency)}
              </div>
              <div className="w-28 text-right font-mono text-xs text-muted-foreground">
                {shipment.eta
                  ? new Date(shipment.eta).toLocaleString(undefined, {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </div>
            </Link>
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
