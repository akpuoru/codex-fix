import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mergePricing } from "@/lib/rates";
import { supabaseUrl, supabasePublishableKey } from "@/lib/supabase-env";

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const key = supabasePublishableKey()!;
  const sb = createClient(supabaseUrl()!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await sb.rpc("get_pricing_settings").maybeSingle();
  const row = data as { currency: string; rates: unknown } | null;
  return mergePricing(row?.currency, row?.rates);
});

const num = z.number().min(0).max(1_000_000);
const kind = z.object({ base: num, perKg: num });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        currency: z.string().regex(/^[A-Z]{3}$/),
        kinds: z.object({ courier: kind, luggage: kind, freight: kind }),
        levels: z.object({ express: num, standard: num, economy: num }),
        fuel: z.number().min(0).max(1),
        international: num,
        extraPiece: num,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");
    const { currency, ...rates } = data;
    const { error } = await context.supabase
      .from("site_settings")
      .update({ currency, rates, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type TransferDetails = {
  bankName?: string; accountName?: string; accountNumber?: string; swift?: string; bankNote?: string;
  btcAddress?: string; usdtAddress?: string; usdtNetwork?: string;
};

export const getTransferDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("get_transfer_details" as never);
    return ((data as TransferDetails | null) ?? {}) as TransferDetails;
  });

const opt = z.string().trim().max(300).optional();
export const adminSaveTransferDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ bankName: opt, accountName: opt, accountNumber: opt, swift: opt, bankNote: opt, btcAddress: opt, usdtAddress: opt, usdtNetwork: opt }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");
    const { error } = await context.supabase.from("site_settings").update({ transfer_details: data } as never).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), method: z.enum(["bank", "btc", "usdt"]), reference: z.string().trim().min(3).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("submit_transfer" as never, { _shipment: data.id, _method: data.method, _reference: data.reference } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
