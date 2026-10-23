import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STATUS_PROGRESS } from "@/lib/rates";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(`Unable to verify admin access: ${error.message}`);
  if (!data) throw new Error("Forbidden: admin only");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(`Unable to verify admin access: ${error.message}`);
    return { isAdmin: !!data };
  });

export const adminListShipments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("shipments")
      .select("*, shipment_events(id, status, location, note, occurred_at)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => {
      const events = [...(s.shipment_events ?? [])].sort((a, b) =>
        a.occurred_at.localeCompare(b.occurred_at),
      );
      const { shipment_events: _e, ...rest } = s;
      return { ...rest, current_location: events.at(-1)?.location ?? null, events };
    });
  });

const statuses = [
  "booked",
  "picked_up",
  "in_transit",
  "customs",
  "out_for_delivery",
  "delivered",
  "exception",
] as const;

export const adminUpdateShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(statuses),
        location: z.string().trim().min(2).max(160),
        note: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("shipments")
      .update({ status: data.status, progress: STATUS_PROGRESS[data.status] ?? 50 })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { error: evErr } = await context.supabase.from("shipment_events").insert({
      shipment_id: data.id,
      status: data.status,
      location: data.location,
      note: data.note || null,
    });
    if (evErr) throw new Error(evErr.message);
    return { ok: true };
  });

export const adminUpdateShipmentEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      eventId: z.string().uuid(),
      status: z.enum(statuses),
      location: z.string().trim().max(160),
      note: z.string().trim().max(300),
      occurredAt: z.string().datetime(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: event, error: eventError } = await context.supabase
      .from("shipment_events")
      .select("id, shipment_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eventError) throw new Error(eventError.message);
    if (!event) throw new Error("Tracking update not found.");

    const { error } = await context.supabase
      .from("shipment_events")
      .update({
        status: data.status,
        location: data.location || null,
        note: data.note || null,
        occurred_at: data.occurredAt,
      })
      .eq("id", event.id);
    if (error) throw new Error(error.message);

    // Keep the shipment summary aligned with whichever scan is now latest.
    const { data: latest, error: latestError } = await context.supabase
      .from("shipment_events")
      .select("status")
      .eq("shipment_id", event.shipment_id)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw new Error(latestError.message);
    if (latest) {
      const { error: shipmentError } = await context.supabase
        .from("shipments")
        .update({ status: latest.status, progress: STATUS_PROGRESS[latest.status] ?? 50 })
        .eq("id", event.shipment_id);
      if (shipmentError) throw new Error(shipmentError.message);
    }
    return { ok: true };
  });

export const adminListPeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [{ data: profiles, error }, { data: roles }] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }),
      context.supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);
    if (error) throw new Error(error.message);
    const admins = new Set((roles ?? []).map((r: { user_id: string }) => r.user_id));
    return (profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null; created_at: string }) => ({
      ...p,
      is_admin: admins.has(p.id),
      is_self: p.id === context.userId,
    }));
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.rpc("admin_set_role", {
      _user_id: data.userId,
      _make_admin: data.makeAdmin,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminConfirmShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: updated, error } = await context.supabase
      .from("shipments")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("confirmed_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) {
      throw new Error("Shipment was not confirmed. It may already be confirmed, missing, or blocked by database permissions.");
    }
    return { ok: true };
  });

export const adminMarkPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), method: z.enum(["bank", "btc", "usdt"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("shipments")
      .update({ paid_at: new Date().toISOString(), payment_method: data.method })
      .eq("id", data.id)
      .is("paid_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetCustoms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), instructions: z.string().trim().max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("shipments")
      .update({ customs_instructions: data.instructions || null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminTrackingLookups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase.from("tracking_lookups").select("*")
      .eq("shipment_id", data.id).order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
