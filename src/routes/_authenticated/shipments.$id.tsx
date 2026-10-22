import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EventRail, ProgressBar, StatusPill } from "@/components/shipment-bits";
import { ShipmentTransfer } from "@/components/shipment-transfer";
import { cancelShipment, getMyShipment } from "@/lib/shipments.functions";
import { formatCents, STATUS_LABEL } from "@/lib/rates";

export const Route = createFileRoute("/_authenticated/shipments/$id")({
  validateSearch: (search: Record<string, unknown>): { paid?: string } =>
    typeof search["paid"] === "string" ? { paid: search["paid"] } : {},
  head: () => ({
    meta: [
      { title: "Shipment detail · Bridgeway Freighting" },
      {
        name: "description",
        content: "Full waybill detail: route, consignment data, scan history and pricing.",
      },
      { property: "og:title", content: "Shipment detail · Bridgeway Freighting" },
      { property: "og:description", content: "Route, consignment data and scan history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShipmentDetail,
});

function ShipmentDetail() {
  const { id } = Route.useParams();
  const { paid } = Route.useSearch();
  const fetchShipment = useServerFn(getMyShipment);
  const cancel = useServerFn(cancelShipment);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCheckout, setShowCheckout] = useState(false);
  const { data, isPending, error } = useQuery({
    queryKey: ["shipment", id],
    queryFn: () => fetchShipment({ data: { id } }),
  });

  // Returning from checkout: confirm the webhook landed and refresh.
  useEffect(() => {
    if (!paid) return;
    toast.success("Payment received — confirming your booking…");
    const t = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ["shipment", id] });
      void queryClient.invalidateQueries({ queryKey: ["my-shipments"] });
    }, 1500);
    void navigate({ to: "/shipments/$id", params: { id }, search: {}, replace: true });
    return () => clearTimeout(t);
  }, [paid, id, navigate, queryClient]);


  const cancelMutation = useMutation({
    mutationFn: () => cancel({ data: { id } }),
    onSuccess: async () => {
      toast.success("Booking cancelled");
      await queryClient.invalidateQueries({ queryKey: ["my-shipments"] });
      navigate({ to: "/dashboard" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const shipment = data?.shipment;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-10">
        <Link
          to="/dashboard"
          className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground hover:text-foreground"
        >
          ← BACK TO BOARD
        </Link>

        {isPending && <p className="mt-6 font-mono text-sm text-muted-foreground">Loading…</p>}
        {error && (
          <p className="mt-6 font-mono text-sm text-destructive" role="alert">
            {(error as Error).message}
          </p>
        )}
        {!isPending && !shipment && !error && (
          <p className="mt-6 font-mono text-sm">Shipment not found.</p>
        )}

        {shipment && (
          <>
            <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] tracking-[0.2em] text-primary">WAYBILL</div>
                <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
                  {shipment.tracking_number}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill status={shipment.status} />
                {shipment.paid_at ? (
                  <span className="rounded-md bg-primary/10 px-4 py-2 font-mono text-[11px] tracking-[0.12em] text-primary ring-1 ring-primary/30">
                    PAID {formatCents(shipment.price_cents, shipment.currency)}
                  </span>
                ) : (
                  <Button
                    onClick={() => setShowCheckout((v) => !v)}
                    aria-expanded={showCheckout}
                    className="rounded-md bg-accent px-4 py-2 font-mono text-[11px] tracking-[0.12em] text-accent-foreground"
                  >
                    {showCheckout ? "HIDE PAYMENT" : `PAY ${formatCents(shipment.price_cents, shipment.currency)}`}
                  </Button>
                )}
                {shipment.confirmed_at && (
                  <Link to="/receipt/$id" params={{ id: shipment.id }} className="rounded-md bg-primary px-4 py-2 font-mono text-[11px] tracking-[0.12em] text-primary-foreground">
                    VIEW RECEIPT
                  </Link>
                )}
                {shipment.status === "booked" && !shipment.paid_at && (
                  <Button variant="outline"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    className="rounded-md bg-card px-4 py-2 font-mono text-[11px] tracking-[0.12em] ring-1 ring-line hover:text-destructive"
                  >
                    CANCEL BOOKING
                  </Button>
                )}
              </div>
            </div>

            {showCheckout && !shipment.paid_at && (
              <div className="mb-8">
                <ShipmentTransfer
                  shipmentId={shipment.id}
                  tracking={shipment.tracking_number}
                  amount={formatCents(shipment.price_cents, shipment.currency)}
                  submittedAt={shipment.transfer_submitted_at}
                  submittedMethod={shipment.transfer_method}
                  submittedRef={shipment.transfer_reference}
                />
              </div>
            )}


            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-xl bg-card p-6 ring-1 ring-line">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
                  <div className="font-display text-2xl font-black tracking-tight">
                    {shipment.origin_code ?? shipment.origin_city} →{" "}
                    {shipment.dest_code ?? shipment.dest_city}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {shipment.origin_city}, {shipment.origin_country} · {shipment.dest_city},{" "}
                    {shipment.dest_country}
                  </div>
                </div>
                <div className="mt-4">
                  <ProgressBar status={shipment.status} progress={shipment.progress} />
                </div>
                <div className="mt-6">
                  <EventRail events={data?.events ?? []} />
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-xl bg-card p-6 ring-1 ring-line">
                  <div className="label-mono">Consignment</div>
                  <dl className="mt-3 space-y-2 font-mono text-xs">
                    <Row label="Status" value={STATUS_LABEL[shipment.status] ?? shipment.status} />
                    <Row label="Service" value={`${shipment.kind} · ${shipment.level}`} />
                    <Row label="Weight" value={`${shipment.weight_kg} kg`} />
                    <Row label="Pieces" value={String(shipment.pieces)} />
                    <Row label="Contents" value={shipment.contents ?? "—"} />
                    <Row
                      label="Pickup"
                      value={
                        shipment.pickup_at ? new Date(shipment.pickup_at).toLocaleString() : "—"
                      }
                    />
                    <Row
                      label="ETA"
                      value={shipment.eta ? new Date(shipment.eta).toLocaleString() : "—"}
                    />
                    <Row label="Charged" value={formatCents(shipment.price_cents, shipment.currency)} />
                  </dl>
                </div>

                <div className="rounded-xl bg-card p-6 ring-1 ring-line">
                  <div className="label-mono">Parties</div>
                  <dl className="mt-3 space-y-2 font-mono text-xs">
                    <Row label="Sender" value={shipment.sender_name} />
                    <Row label="Sender phone" value={shipment.sender_phone ?? "—"} />
                    <Row label="Recipient" value={shipment.recipient_name} />
                    <Row label="Recipient phone" value={shipment.recipient_phone ?? "—"} />
                  </dl>
                  <p className="mt-3 font-mono text-xs text-muted-foreground">
                    {shipment.recipient_address}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right capitalize">{value}</dd>
    </div>
  );
}
