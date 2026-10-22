import { LiveMap } from "@/components/live-map";
import { createFileRoute } from "@tanstack/react-router";

import { EventRail, ProgressBar, StatusPill } from "@/components/shipment-bits";
import { TrackForm } from "@/components/track-form";
import { trackShipment } from "@/lib/shipments.functions";
import { STATUS_LABEL } from "@/lib/rates";

export const Route = createFileRoute("/track/$tracking")({
  loader: ({ params }) => trackShipment({ data: { tracking: params.tracking } }),
  head: ({ params }) => ({
    meta: [
      { title: `Waybill ${params.tracking} · Bridgeway Freighting tracking` },
      {
        name: "description",
        content: `Live status, scan history and estimated delivery for Bridgeway Freighting waybill ${params.tracking}.`,
      },
      { property: "og:title", content: `Waybill ${params.tracking}` },
      { property: "og:description", content: "Live status and scan history from Bridgeway Freighting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackDetail,
  errorComponent: ({ error }) => (
    <div className="rounded-xl bg-card p-6 font-mono text-sm ring-1 ring-line" role="alert">
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="rounded-xl bg-card p-6 font-mono text-sm ring-1 ring-line">
      Waybill not found.
    </div>
  ),
});

function TrackDetail() {
  const { tracking } = Route.useParams();
  const { shipment, events, notice } = Route.useLoaderData();

  if (!shipment) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <div className="font-mono text-[11px] tracking-[0.2em] text-caution">NO MATCH</div>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight">
          No shipment found for {tracking}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Check the waybill number and try again. Check the number on your receipt.
        </p>
        <div className="mt-6 rounded-xl bg-card p-4 ring-1 ring-line">
          <TrackForm initial={tracking} />
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-primary">LIVE TRACKING</div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
            AWB {shipment.tracking_number}
          </h1>
        </div>
        <StatusPill status={shipment.status} />
      </div>

      {notice && (
        <div role="alert" className="mb-6 rounded-xl bg-accent/10 p-5 ring-1 ring-accent/50">
          <div className="font-mono text-[11px] tracking-[0.2em] text-accent">CUSTOMS NOTICE · ACTION REQUIRED</div>
          <p className="mt-2 whitespace-pre-line text-sm">{notice}</p>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl bg-card p-6 ring-1 ring-line">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div className="font-display text-2xl font-black tracking-tight">
              {shipment.origin_code ?? shipment.origin_city} → {shipment.dest_code ?? shipment.dest_city}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {shipment.origin_city}, {shipment.origin_country} · {shipment.dest_city},{" "}
              {shipment.dest_country}
            </div>
          </div>
          <div className="mt-4">
            <LiveMap
              origin={`${shipment.origin_city}, ${shipment.origin_country}`}
              dest={`${shipment.dest_city}, ${shipment.dest_country}`}
              current={events.length ? events[events.length - 1]!.location : null}
              progress={shipment.progress}
              delivered={shipment.status === "delivered"}
            />
          </div>
          <div className="mt-4">
            <ProgressBar status={shipment.status} progress={shipment.progress} />
          </div>
          <div className="mt-6">
            <EventRail events={events} />
          </div>
        </div>

        <div className="rounded-xl bg-card p-6 ring-1 ring-line">
          <div className="label-mono">Consignment</div>
          <dl className="mt-3 space-y-2 font-mono text-xs">
            <Row label="Status" value={STATUS_LABEL[shipment.status] ?? shipment.status} />
            <Row label="Service" value={`${shipment.kind} · ${shipment.level}`} />
            <Row label="Weight" value={`${shipment.weight_kg} kg`} />
            <Row label="Pieces" value={String(shipment.pieces)} />
            <Row
              label="ETA"
              value={shipment.eta ? new Date(shipment.eta).toLocaleString() : "Scheduling"}
            />
            <Row label="Booked" value={new Date(shipment.created_at).toLocaleDateString()} />
          </dl>
          <div className="mt-6 border-t border-line pt-4">
            <div className="label-mono mb-2">Track another</div>
            <TrackForm />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right capitalize">{value}</dd>
    </div>
  );
}
