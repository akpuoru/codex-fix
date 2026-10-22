import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseUrl, supabasePublishableKey } from "@/lib/supabase-env";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  topic: z.enum(["shipment", "booking", "freight", "other"]),
  tracking: z.string().trim().max(40),
  message: z.string().trim().min(10).max(3000),
  channel: z.enum(["contact", "chat"]),
  website: z.string().max(100).default(""),
});

export const submitSupport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) throw new Error("Unable to send this message.");
    const key = supabasePublishableKey();
    const url = supabaseUrl();
    if (!key || !url) throw new Error("Support is temporarily unavailable. Please try again.");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data: id, error } = await client.rpc("submit_support_request", {
      _name: data.name, _email: data.email, _topic: data.topic,
      _tracking: data.tracking, _message: data.message, _channel: data.channel,
    });
    if (error) throw new Error(error.message.includes("Too many messages") ? "Too many messages. Please try again later." : "Your message could not be sent. Please try again.");
    return { id };
  });

export const listSupport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !admin) throw new Error("Admin access required.");
    const { data, error } = await context.supabase.from("support_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Unable to load messages.");
    return data;
  });

export const resolveSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["new", "resolved"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !admin) throw new Error("Admin access required.");
    const { error } = await context.supabase.from("support_requests").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("Unable to update this message.");
    return { ok: true };
  });