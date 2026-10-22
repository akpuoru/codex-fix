import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

export function parseUA(ua: string) {
  const device = /iPad|Tablet/i.test(ua) ? "Tablet" : /Mobi|Android|iPhone/i.test(ua) ? "Mobile" : "Desktop";
  const os = /Windows/i.test(ua) ? "Windows" : /iPhone|iPad|iOS/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android"
    : /Mac OS X/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Unknown";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown";
  return { device, os, browser };
}

export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
      } catch { /* location optional */ }
    }
    await context.supabase.from("login_events").insert({
      user_id: context.userId, ip, user_agent: ua, ...parseUA(ua), city, region, country,
    });
    return { at: new Date().toISOString() };
  });

export const checkMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("account_status").select("status, reason, force_logout_at").eq("user_id", context.userId).maybeSingle();
    return { status: (data?.status ?? "active") as string, reason: (data?.reason ?? null) as string | null, forceLogoutAt: (data?.force_logout_at ?? null) as string | null };
  });

export const adminListAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [{ data: statuses }, { data: logins }] = await Promise.all([
      context.supabase.from("account_status").select("user_id, status, reason"),
      context.supabase.from("login_events").select("*").order("created_at", { ascending: false }).limit(2000),
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lastSignIn: Record<string, string | null> = {};
    for (let page = 1; page < 50; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      for (const u of data.users) lastSignIn[u.id] = u.last_sign_in_at ?? null;
      if (data.users.length < 1000) break;
    }
    const byUser: Record<string, any[]> = {};
    for (const l of logins ?? []) { const arr = (byUser[l.user_id] ??= []); if (arr.length < 10) arr.push(l); }
    const st: Record<string, { status: string; reason: string | null }> = {};
    for (const s of statuses ?? []) st[s.user_id] = { status: s.status, reason: s.reason };
    return { lastSignIn, logins: byUser, statuses: st };
  });

export const adminSetAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["active", "restricted", "banned"]), reason: z.string().trim().max(300).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You can't change your own account status");
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("account_status").upsert({
      user_id: data.userId, status: data.status, reason: data.reason || null, updated_at: now,
      ...(data.status === "banned" ? { force_logout_at: now } : {}),
    });
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.status === "banned" ? "876000h" : "none",
    });
    if (banErr) throw new Error(banErr.message);
    return { ok: true };
  });

export const adminForceLogout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Use Sign out to end your own session");
    const { data: existing } = await context.supabase.from("account_status").select("status").eq("user_id", data.userId).maybeSingle();
    const { error } = await context.supabase.from("account_status").upsert({
      user_id: data.userId, status: existing?.status ?? "active", force_logout_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
