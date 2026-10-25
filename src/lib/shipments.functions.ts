import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { parseUA } from "@/lib/accounts.functions";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { mergePricing, quoteShipment, STATUS_PROGRESS } from "@/lib/rates";
import { supabaseUrl, supabasePublishableKey } from "@/lib/supabase-env";

function publicClient() {
  const key = supabasePublishableKey()!;
  return createClient<Database>(supabaseUrl()!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const trackingSchema = z.object({ tracking: z.string().trim().min(3).max(40) });

export const trackShipment = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => trackingSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase.rpc("track_shipment", {
      _tracking: data.tracking,
    });
    if (error) throw new Error(error.message);
    const shipment = rows?.[0] ?? null;
    if (!shipment) return { shipment: null, events: [], notice: null as string | null };

    const { data: events, error: eventsError } = await supabase.rpc("track_shipment_events", {
      _tracking: data.tracking,
    });
    if (eventsError) throw new Error(eventsError.message);
    const { data: notice } = await supabase.rpc("track_shipment_notice", { _tracking: data.tracking });
    await logLookup(data.tracking).catch((error: unknown) => {
      console.warn(
        "[tracking] Unable to record shipment lookup:",
        error instanceof Error ? error.message : "Unknown logging error",
      );
    });
    return { shipment, events: events ?? [], notice: (notice as string | null) ?? null };
  });

async function logLookup(tracking: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: s, error: shipmentError } = await supabaseAdmin
    .from("shipments")
    .select("id")
    .ilike("tracking_number", tracking.trim())
    .maybeSingle();
  if (shipmentError) throw new Error(`Unable to resolve tracked waybill: ${shipmentError.message}`);
  if (!s) return;
  const ua = (getRequestHeader("user-agent") ?? "").slice(0, 400);
  const ip = (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0] ?? "").trim() || null;
  let city = getRequestHeader("cf-ipcity") ?? null;
  let region = getRequestHeader("cf-region") ?? null;
  let country = getRequestHeader("cf-ipcountry") ?? null;
  if (ip && !city) {
    try {
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country`, { signal: AbortSignal.timeout(2500) });
      const j = (await r.json()) as { success?: boolean; city?: string; region?: string; country?: string };
      if (j.success) { city = j.city ?? null; region = j.region ?? null; country = j.country ?? country; }
    } catch { /* optional */ }
  }
  const { error: insertError } = await supabaseAdmin.from("tracking_lookups").insert({
    shipment_id: s.id,
    ip,
    user_agent: ua,
    ...parseUA(ua),
    city,
    region,
    country,
  });
  if (insertError) throw new Error(`Unable to save tracking lookup: ${insertError.message}`);
}

export const listMyShipments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("shipments")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getMyShipment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: shipment, error } = await context.supabase
      .from("shipments")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!shipment) return { shipment: null, events: [] };

    const { data: events, error: eventsError } = await context.supabase
      .from("shipment_events")
      .select("*")
      .eq("shipment_id", data.id)
      .order("occurred_at", { ascending: true });
    if (eventsError) throw new Error(eventsError.message);
    return { shipment, events: events ?? [] };
  });

const bookingSchema = z.object({
  kind: z.enum(["courier", "luggage", "freight"]),
  level: z.enum(["express", "standard", "economy"]),
  originCity: z.string().trim().min(2).max(80),
  originCountry: z.string().trim().min(2).max(60),
  originCode: z.string().trim().max(8).optional(),
  destCity: z.string().trim().min(2).max(80),
  destCountry: z.string().trim().min(2).max(60),
  destCode: z.string().trim().max(8).optional(),
  senderName: z.string().trim().min(2).max(120),
  senderPhone: z.string().trim().max(40).optional(),
  senderEmail: z.string().trim().email().max(255).optional(),
  senderAddress: z.string().trim().max(400).optional(),
  recipientEmail: z.string().trim().email().max(255).optional(),
  recipientName: z.string().trim().min(2).max(120),
  recipientPhone: z.string().trim().max(40).optional(),
  recipientAddress: z.string().trim().min(5).max(400),
  weightKg: z.number().min(0.1).max(5000),
  lengthCm: z.number().min(1).max(600).optional(),
  widthCm: z.number().min(1).max(600).optional(),
  heightCm: z.number().min(1).max(600).optional(),
  pieces: z.number().int().min(1).max(200),
  declaredValue: z.number().min(0).max(1000000).optional(),
  contents: z.string().trim().max(300).optional(),
  pickupAt: z.string().datetime().optional(),
});

export const createShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bookingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: settingsRows } = await context.supabase.rpc("get_pricing_settings");
    const settings = Array.isArray(settingsRows) ? settingsRows[0] : settingsRows;
    const pricing = mergePricing(settings?.currency, settings?.rates);
    const quote = quoteShipment({
      kind: data.kind,
      level: data.level,
      weightKg: data.weightKg,
      lengthCm: data.lengthCm,
      widthCm: data.widthCm,
      heightCm: data.heightCm,
      pieces: data.pieces,
      international: data.originCountry.trim().toLowerCase() !== data.destCountry.trim().toLowerCase(),
    }, pricing);

    const transitHours = data.level === "express" ? 38 : data.level === "standard" ? 96 : 190;
    const pickupAt = data.pickupAt ? new Date(data.pickupAt) : new Date(Date.now() + 864e5);
    const eta = new Date(pickupAt.getTime() + transitHours * 3600_000);

    const { data: shipment, error } = await context.supabase
      .from("shipments")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        level: data.level,
        status: "booked",
        origin_city: data.originCity,
        origin_country: data.originCountry,
        origin_code: data.originCode ?? null,
        dest_city: data.destCity,
        dest_country: data.destCountry,
        dest_code: data.destCode ?? null,
        sender_name: data.senderName,
        sender_phone: data.senderPhone ?? null,
        sender_email: data.senderEmail ?? null,
        sender_address: data.senderAddress ?? null,
        recipient_email: data.recipientEmail ?? null,
        recipient_name: data.recipientName,
        recipient_phone: data.recipientPhone ?? null,
        recipient_address: data.recipientAddress,
        weight_kg: data.weightKg,
        length_cm: data.lengthCm ?? null,
        width_cm: data.widthCm ?? null,
        height_cm: data.heightCm ?? null,
        pieces: data.pieces,
        declared_value: data.declaredValue ?? null,
        contents: data.contents ?? null,
        price_cents: Math.round(quote.totalEur * 100),
        currency: pricing.currency,
        pickup_at: pickupAt.toISOString(),
        eta: eta.toISOString(),
        progress: STATUS_PROGRESS["booked"] ?? 8,
        tracking_number: "",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("shipment_events").insert({
      shipment_id: shipment.id,
      status: "booked",
      location: `${data.originCity}, ${data.originCountry}`,
      note: "Booking confirmed · waybill issued",
    });

    return shipment;
  });

export const cancelShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shipments")
      .delete()
      .eq("id", data.id)
      .eq("status", "booked");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getReceipt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // RLS limits this to the shipment owner or an admin.
    const { data: shipment, error } = await context.supabase
      .from("shipments").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!shipment) return { receipt: null, reason: "not_found" as const };
    if (!shipment.confirmed_at) return { receipt: null, reason: "not_confirmed" as const };

    const { data: events } = await context.supabase
      .from("shipment_events").select("status, occurred_at")
      .eq("shipment_id", data.id).order("occurred_at", { ascending: true });
    const deliveredAt =
      [...(events ?? [])].reverse().find((e) => e.status === "delivered")?.occurred_at ?? shipment.eta;

    let senderEmail: string | null = shipment.sender_email;
    if (!senderEmail && shipment.user_id) {
      const { data: profile } = await context.supabase
        .from("profiles").select("email").eq("id", shipment.user_id).maybeSingle();
      senderEmail = profile?.email ?? null;
    }
    return {
      receipt: { ...shipment, sentAt: shipment.pickup_at ?? shipment.created_at, deliveredAt, senderEmail },
      reason: null,
    };
  });
