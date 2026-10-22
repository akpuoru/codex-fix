import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createShipment } from "@/lib/shipments.functions";
import {
  formatEur,
  quoteShipment,
  SERVICE_KINDS,
  SERVICE_LEVELS,
  type ServiceKind,
  type ServiceLevel,
} from "@/lib/rates";

const searchSchema = z.object({
  origin: z.string().optional(),
  dest: z.string().optional(),
  weight: z.string().optional(),
  kind: z.enum(["courier", "luggage", "freight"]).optional(),
  level: z.enum(["express", "standard", "economy"]).optional(),
});

export const Route = createFileRoute("/_authenticated/book")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Book a shipment · Bridgeway Freighting" },
      {
        name: "description",
        content:
          "Book an international courier, luggage or freight shipment: route, parcel details, service level and price in four steps.",
      },
      { property: "og:title", content: "Book a shipment · Bridgeway Freighting" },
      { property: "og:description", content: "Four steps from route to confirmed booking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookPage,
});

const STEPS = ["Route", "Parcel", "Service", "Price"] as const;

function splitPlace(value: string | undefined, fallbackCity: string, fallbackCountry: string) {
  if (!value) return { code: "", city: fallbackCity, country: fallbackCountry };
  // "FRA — Frankfurt, DE" | "Frankfurt, DE" | "Frankfurt"
  const [codePart, rest] = value.includes("—") ? value.split("—") : ["", value];
  const [city, country] = (rest ?? "").split(",");
  return {
    code: (codePart ?? "").trim(),
    city: (city ?? fallbackCity).trim(),
    country: (country ?? fallbackCountry).trim(),
  };
}

function BookPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const book = useServerFn(createShipment);

  const o = splitPlace(search.origin, "Frankfurt", "DE");
  const d = splitPlace(search.dest, "Tokyo", "JP");

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    originCity: o.city,
    originCountry: o.country,
    originCode: o.code,
    destCity: d.city,
    destCountry: d.country,
    destCode: d.code,
    senderName: "",
    senderPhone: "",
    senderEmail: "",
    senderAddress: "",
    recipientEmail: "",
    recipientName: "",
    recipientPhone: "",
    recipientAddress: "",
    weightKg: search.weight ?? "12",
    lengthCm: "60",
    widthCm: "40",
    heightCm: "30",
    pieces: "1",
    declaredValue: "",
    contents: "",
    kind: (search.kind ?? "courier") as ServiceKind,
    level: (search.level ?? "express") as ServiceLevel,
    pickupDate: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const quote = useMemo(
    () =>
      quoteShipment({
        kind: form.kind,
        level: form.level,
        weightKg: Number(form.weightKg) || 1,
        lengthCm: Number(form.lengthCm) || undefined,
        widthCm: Number(form.widthCm) || undefined,
        heightCm: Number(form.heightCm) || undefined,
        pieces: Number(form.pieces) || 1,
        international:
          form.originCountry.trim().toLowerCase() !== form.destCountry.trim().toLowerCase(),
      }),
    [form],
  );

  const mutation = useMutation({
    mutationFn: () =>
      book({
        data: {
          kind: form.kind,
          level: form.level,
          originCity: form.originCity,
          originCountry: form.originCountry,
          originCode: form.originCode || undefined,
          destCity: form.destCity,
          destCountry: form.destCountry,
          destCode: form.destCode || undefined,
          senderName: form.senderName,
          senderPhone: form.senderPhone || undefined,
          senderEmail: form.senderEmail || undefined,
          senderAddress: form.senderAddress || undefined,
          recipientEmail: form.recipientEmail || undefined,
          recipientName: form.recipientName,
          recipientPhone: form.recipientPhone || undefined,
          recipientAddress: form.recipientAddress,
          weightKg: Number(form.weightKg),
          lengthCm: Number(form.lengthCm) || undefined,
          widthCm: Number(form.widthCm) || undefined,
          heightCm: Number(form.heightCm) || undefined,
          pieces: Number(form.pieces) || 1,
          declaredValue: form.declaredValue ? Number(form.declaredValue) : undefined,
          contents: form.contents || undefined,
          pickupAt: new Date(`${form.pickupDate}T08:00:00Z`).toISOString(),
        },
      }),
    onSuccess: async (shipment) => {
      toast.success(`Waybill ${shipment.tracking_number} issued`);
      await queryClient.invalidateQueries({ queryKey: ["my-shipments"] });
      navigate({ to: "/shipments/$id", params: { id: shipment.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stepValid = [
    form.originCity.length > 1 && form.originCountry.length > 1 && form.destCity.length > 1 && form.destCountry.length > 1,
    Number(form.weightKg) > 0 &&
      form.senderName.length > 1 &&
      form.recipientName.length > 1 &&
      form.recipientAddress.length > 4,
    true,
    true,
  ][step];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-10">
        <div className="font-mono text-[11px] tracking-[0.2em] text-primary">NEW SHIPMENT</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight">Build the waybill</h1>

        <div className="mt-6 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-md font-mono text-xs font-bold ${
                  index <= step
                    ? "bg-primary text-primary-foreground"
                    : "border border-line text-muted-foreground"
                }`}
              >
                {index + 1}
              </span>
              <span
                className={`font-mono text-[11px] tracking-[0.12em] uppercase ${
                  index <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {index < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="rounded-xl bg-card p-6 ring-1 ring-line">
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="ORIGIN CITY">
                  <input
                    className={inputCls}
                    value={form.originCity}
                    onChange={(e) => set("originCity", e.target.value)}
                  />
                </Field>
                <Field label="ORIGIN COUNTRY">
                  <input
                    className={inputCls}
                    value={form.originCountry}
                    onChange={(e) => set("originCountry", e.target.value)}
                  />
                </Field>
                <Field label="ORIGIN HUB CODE">
                  <input
                    className={inputCls}
                    value={form.originCode}
                    onChange={(e) => set("originCode", e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="DESTINATION CITY">
                  <input
                    className={inputCls}
                    value={form.destCity}
                    onChange={(e) => set("destCity", e.target.value)}
                  />
                </Field>
                <Field label="DESTINATION COUNTRY">
                  <input
                    className={inputCls}
                    value={form.destCountry}
                    onChange={(e) => set("destCountry", e.target.value)}
                  />
                </Field>
                <Field label="DESTINATION HUB CODE">
                  <input
                    className={inputCls}
                    value={form.destCode}
                    onChange={(e) => set("destCode", e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="PICKUP DATE" className="sm:col-span-1">
                  <input
                    type="date"
                    className={inputCls}
                    value={form.pickupDate}
                    onChange={(e) => set("pickupDate", e.target.value)}
                  />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="WEIGHT (KG)">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={form.weightKg}
                    onChange={(e) => set("weightKg", e.target.value)}
                  />
                </Field>
                <Field label="PIECES">
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    value={form.pieces}
                    onChange={(e) => set("pieces", e.target.value)}
                  />
                </Field>
                <Field label="DECLARED VALUE">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={form.declaredValue}
                    onChange={(e) => set("declaredValue", e.target.value)}
                  />
                </Field>
                <Field label="LENGTH (CM)">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={form.lengthCm}
                    onChange={(e) => set("lengthCm", e.target.value)}
                  />
                </Field>
                <Field label="WIDTH (CM)">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={form.widthCm}
                    onChange={(e) => set("widthCm", e.target.value)}
                  />
                </Field>
                <Field label="HEIGHT (CM)">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={form.heightCm}
                    onChange={(e) => set("heightCm", e.target.value)}
                  />
                </Field>
                <Field label="CONTENTS" className="sm:col-span-3">
                  <input
                    className={inputCls}
                    value={form.contents}
                    onChange={(e) => set("contents", e.target.value)}
                    placeholder="Machine parts, personal effects…"
                  />
                </Field>
                <Field label="SENDER NAME">
                  <input
                    className={inputCls}
                    value={form.senderName}
                    onChange={(e) => set("senderName", e.target.value)}
                  />
                </Field>
                <Field label="SENDER PHONE">
                  <input
                    className={inputCls}
                    value={form.senderPhone}
                    onChange={(e) => set("senderPhone", e.target.value)}
                  />
                </Field>
                <Field label="SENDER EMAIL">
                  <input
                    className={inputCls}
                    value={form.senderEmail}
                    onChange={(e) => set("senderEmail", e.target.value)}
                  />
                </Field>
                <Field label="SENDER ADDRESS" className="sm:col-span-2">
                  <input
                    className={inputCls}
                    value={form.senderAddress}
                    onChange={(e) => set("senderAddress", e.target.value)}
                  />
                </Field>
                <Field label="RECIPIENT NAME">
                  <input
                    className={inputCls}
                    value={form.recipientName}
                    onChange={(e) => set("recipientName", e.target.value)}
                  />
                </Field>
                <Field label="RECIPIENT PHONE">
                  <input
                    className={inputCls}
                    value={form.recipientPhone}
                    onChange={(e) => set("recipientPhone", e.target.value)}
                  />
                </Field>
                <Field label="RECIPIENT EMAIL">
                  <input
                    className={inputCls}
                    value={form.recipientEmail}
                    onChange={(e) => set("recipientEmail", e.target.value)}
                  />
                </Field>
                <Field label="DELIVERY ADDRESS" className="sm:col-span-2">
                  <input
                    className={inputCls}
                    value={form.recipientAddress}
                    onChange={(e) => set("recipientAddress", e.target.value)}
                  />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <div className="label-mono mb-2">Service kind</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {SERVICE_KINDS.map((kind) => (
                      <button
                        key={kind.value}
                        onClick={() => set("kind", kind.value)}
                        className={`rounded-lg p-4 text-left ring-1 transition-colors ${
                          form.kind === kind.value
                            ? "bg-foreground text-background ring-foreground"
                            : "bg-background ring-line hover:ring-primary"
                        }`}
                      >
                        <div className="font-display text-sm font-black">{kind.label}</div>
                        <div className="mt-1 font-mono text-[10px] opacity-70">{kind.blurb}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label-mono mb-2">Transit speed</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {SERVICE_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        onClick={() => set("level", level.value)}
                        className={`rounded-lg p-4 text-left ring-1 transition-colors ${
                          form.level === level.value
                            ? "bg-primary text-primary-foreground ring-primary"
                            : "bg-background ring-line hover:ring-primary"
                        }`}
                      >
                        <div className="font-display text-sm font-black">{level.label}</div>
                        <div className="mt-1 font-mono text-[10px] opacity-80">{level.days}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="label-mono">Final rate</div>
                <dl className="space-y-2 font-mono text-sm">
                  <Line label="Chargeable weight" value={`${quote.chargeableKg} kg`} />
                  <Line label="Transport" value={formatEur(quote.netEur)} />
                  <Line label="Fuel surcharge" value={formatEur(quote.fuelEur)} />
                </dl>
                <div className="flex items-end justify-between border-t border-line pt-4">
                  <span className="label-mono">Total incl. fuel, excl. duty</span>
                  <span className="font-display text-3xl font-black tracking-tight text-primary">
                    {formatEur(quote.totalEur)}
                  </span>
                </div>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="w-full rounded-lg bg-primary py-3 font-display text-sm font-black text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
                >
                  {mutation.isPending ? "Issuing waybill…" : "Confirm booking →"}
                </button>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3 border-t border-line pt-4">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="rounded-md bg-background px-4 py-2 font-mono text-[11px] tracking-[0.1em] uppercase ring-1 ring-line disabled:opacity-40"
              >
                Back
              </button>
              {step < STEPS.length - 1 && (
                <button
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  disabled={!stepValid}
                  className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] tracking-[0.1em] text-background uppercase disabled:opacity-40"
                >
                  Continue →
                </button>
              )}
              {!stepValid && (
                <span className="font-mono text-[10px] text-caution">
                  Fill the required fields to continue
                </span>
              )}
            </div>
          </div>

          <div className="h-fit rounded-xl bg-card p-5 ring-1 ring-line">
            <div className="flex items-center justify-between border-b border-dashed border-line pb-3">
              <span className="label-mono">Waybill stub</span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-primary">DRAFT</span>
            </div>
            <dl className="mt-4 space-y-3 font-mono text-xs">
              <Line
                label="Lane"
                value={`${form.originCode || form.originCity} → ${form.destCode || form.destCity}`}
              />
              <Line label="Service" value={`${form.kind} · ${form.level}`} />
              <Line label="Weight" value={`${form.weightKg || 0} kg · ${form.pieces} pcs`} />
              <Line label="Pickup" value={form.pickupDate} />
            </dl>
            <div className="mt-4 rounded-lg bg-background p-3 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <span className="label-mono">Quote</span>
                <span className="font-display text-2xl font-black text-success">
                  {formatEur(quote.totalEur)}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                incl. fuel · excl. duty
              </p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md bg-background px-3 py-2.5 font-mono text-sm ring-1 ring-line focus:ring-2 focus:ring-primary focus:outline-none";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right capitalize">{value}</dd>
    </div>
  );
}
