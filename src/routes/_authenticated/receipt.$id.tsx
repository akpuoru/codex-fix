import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";

import { getReceipt } from "@/lib/shipments.functions";
import { formatCents } from "@/lib/rates";

export const Route = createFileRoute("/_authenticated/receipt/$id")({
  head: () => ({
    meta: [
      { title: "Delivery receipt · Bridgeway Freighting" },
      { name: "description", content: "Official Bridgeway Freighting delivery receipt with sender, receiver and delivery details." },
      { property: "og:title", content: "Delivery receipt · Bridgeway Freighting" },
      { property: "og:description", content: "Official delivery receipt issued after confirmed delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceiptPage,
});

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const SERVICE: Record<string, string> = {
  courier: "Express document / parcel courier",
  luggage: "Luggage delivery",
  freight: "Cargo freight",
};

function ReceiptPage() {
  const { id } = Route.useParams();
  const fetchReceipt = useServerFn(getReceipt);
  const { data, isPending, error } = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => fetchReceipt({ data: { id } }),
  });
  const r = data?.receipt;

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8 print:bg-background print:p-0">
      <div className="mx-auto mb-4 flex max-w-5xl items-center justify-between print:hidden">
        <Link to="/dashboard" className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground hover:text-foreground">
          ← BACK
        </Link>
        {r && (
          <button onClick={() => window.print()} className="rounded-md bg-primary px-4 py-2 font-mono text-xs text-primary-foreground">
            PRINT / SAVE PDF
          </button>
        )}
      </div>

      {isPending && <p className="text-center font-mono text-sm text-muted-foreground">Loading receipt…</p>}
      {error && <p className="text-center font-mono text-sm text-destructive">{(error as Error).message}</p>}
      {data && !r && (
        <div className="mx-auto max-w-xl rounded-xl bg-card p-6 text-center ring-1 ring-line">
          <h1 className="font-display text-xl font-bold">Receipt not available yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.reason === "not_confirmed"
              ? "Your receipt will be available as soon as our team confirms your order."
              : "We couldn't find this shipment on your account."}
          </p>
        </div>
      )}

      {r && (
        <article className="mx-auto max-w-5xl bg-card p-6 text-foreground shadow-lg ring-1 ring-line print:shadow-none print:ring-0 sm:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-primary pb-4">
            <div className="flex items-center gap-4">
              <div className="notranslate grid size-16 place-items-center bg-primary font-display text-xs font-black leading-tight text-primary-foreground">
                BRIDGE<br />WAY
              </div>
              <div>
                <div className="notranslate font-display text-2xl font-black tracking-tight text-primary sm:text-3xl">BRIDGEWAY FREIGHTING</div>
                <div className="font-display text-sm text-primary">Courier And Logistics.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="label-mono">Waybill</div>
              <div className="font-mono text-lg font-bold">{r.tracking_number}</div>
              <div className="mt-1 inline-block rotate-[-6deg] rounded border-2 border-primary px-2 font-display text-sm font-black text-primary">
                {r.status === "delivered" ? "DELIVERED" : "ORIGINAL"}
              </div>
            </div>
          </header>

          <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1.2fr_0.9fr]">
            <div className="space-y-5">
              <Section title="Sender's details">
                <Field k="Name" v={r.sender_name} />
                <Field k="Email" v={r.senderEmail ?? "—"} />
                <Field k="Mobile" v={r.sender_phone ?? "—"} />
                <Field k="Address" v={r.sender_address ? `${r.sender_address}, ${r.origin_city}, ${r.origin_country}` : `${r.origin_city}, ${r.origin_country}`} />
              </Section>
              <Section title="Receiver's details">
                <Field k="Name" v={r.recipient_name} />
                <Field k="Email" v={r.recipient_email ?? "—"} />
                <Field k="Mobile" v={r.recipient_phone ?? "—"} />
                <Field k="Address" v={r.recipient_address} />
              </Section>
            </div>

            <Section title="Goods and services">
              <div className="grid grid-cols-2 gap-2 border-b border-line pb-3">
                <Field k="Deposit date" v={fmt(r.sentAt)} />
                <Field k={r.status === "delivered" ? "Delivery date" : "Est. delivery date"} v={fmt(r.deliveredAt)} />
              </div>
              <Field k="Service" v={`${SERVICE[r.kind] ?? r.kind} · ${r.level}`} />
              <Field k="Description of cargo" v={r.contents ?? "—"} />
              <Field k="Declared value" v={r.declared_value != null ? formatCents(Math.round(Number(r.declared_value) * 100), r.currency) : "—"} />
              <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
                <Field k="Sending from" v={`${r.origin_city}${r.origin_code ? ` (${r.origin_code})` : ""}`} />
                <Field k="Destination" v={`${r.dest_city}${r.dest_code ? ` (${r.dest_code})` : ""}`} />
              </div>
            </Section>

            <Section title="Dimensions">
              <div className="grid grid-cols-2 gap-2">
                <Field k="No. of pieces" v={`${r.pieces} Pcs.`} />
                <Field k="Weight" v={`${r.weight_kg} kg`} />
              </div>
              <Field
                k="Dimensions L × W × H (cm)"
                v={r.length_cm && r.width_cm && r.height_cm ? `${r.length_cm} × ${r.width_cm} × ${r.height_cm}` : "—"}
              />
              <Field k="Transport charges" v={formatCents(r.price_cents, r.currency)} />
              <Field k="Booked on" v={fmt(r.created_at)} />
              <div className="mt-2 h-8 bg-[repeating-linear-gradient(90deg,var(--foreground)_0_2px,transparent_2px_4px,var(--foreground)_4px_5px,transparent_5px_8px)]" />
              <div className="text-center font-mono text-[10px]">{r.tracking_number}</div>
            </Section>
          </div>

          <footer className="mt-6 border-t border-line pt-3 text-center">
            <p className="text-xs italic text-muted-foreground">
              (NOTE: This document must be printed and presented by the recipient on delivery point)
            </p>
            <p className="mt-1 font-display text-sm font-bold text-primary">www.bridgewaytrack.live</p>
          </footer>
        </article>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ring-1 ring-line">
      <h2 className="bg-destructive px-3 py-1.5 text-center font-display text-sm font-bold uppercase tracking-wide text-destructive-foreground">
        {title}
      </h2>
      <div className="space-y-2 p-3">{children}</div>
    </section>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">{k}</div>
      <div className="border-b border-line pb-1 text-sm">{v}</div>
    </div>
  );
}
