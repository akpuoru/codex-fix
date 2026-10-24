import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseUrl, supabasePublishableKey } from "@/lib/supabase-env";

const httpsUrl = z.string().trim().url().max(1000).refine((value) => value.startsWith("https://"), "Use a secure HTTPS link.");
const optionalHttpsUrl = z.union([z.literal(""), httpsUrl]).default("");

const advertSchema = z.object({
  brandName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  brandUrl: optionalHttpsUrl,
  headline: z.string().trim().min(4).max(100),
  description: z.string().trim().min(10).max(300),
  landingUrl: httpsUrl,
  creativeUrl: optionalHttpsUrl,
  campaignStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  campaignEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budget: z.string().trim().min(2).max(100),
  website: z.string().max(200).default(""),
}).refine((data) => data.campaignEnd >= data.campaignStart, {
  message: "Campaign end date must be on or after its start date.",
  path: ["campaignEnd"],
});

export type AdvertRequestStatus = "new" | "reviewing" | "approved" | "declined";

export type PublishedAdvertisement = {
  id: string;
  brand_name: string;
  headline: string;
  description: string;
  landing_url: string;
  creative_url: string | null;
};

export type AdvertRequest = {
  id: string;
  brand_name: string;
  contact_name: string;
  email: string;
  brand_url: string | null;
  headline: string;
  description: string;
  landing_url: string;
  creative_url: string | null;
  campaign_start: string;
  campaign_end: string;
  budget: string;
  status: AdvertRequestStatus;
  created_at: string;
};

function createPublicClient() {
  const key = supabasePublishableKey();
  const url = supabaseUrl();
  if (!key || !url) throw new Error("Advertising is temporarily unavailable. Please try again later.");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const submitAdvertRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => advertSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) throw new Error("Unable to send this request.");
    const client = createPublicClient();
    const { data: id, error } = await client.rpc("submit_advert_request", {
      _brand_name: data.brandName,
      _contact_name: data.contactName,
      _email: data.email,
      _brand_url: data.brandUrl,
      _headline: data.headline,
      _description: data.description,
      _landing_url: data.landingUrl,
      _creative_url: data.creativeUrl,
      _campaign_start: data.campaignStart,
      _campaign_end: data.campaignEnd,
      _budget: data.budget,
    });
    if (error) {
      throw new Error(
        error.message.includes("Too many advertising requests")
          ? "Too many requests from this email. Please try again later."
          : "Your advertising request could not be sent. Please try again.",
      );
    }
    return { id };
  });

export const listActiveAdvertisements = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await createPublicClient().rpc("get_active_advertisements");
  if (error) throw new Error("Unable to load partner advertisements.");
  return (data ?? []) as PublishedAdvertisement[];
});

export const listAdvertRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !admin) throw new Error("Admin access required.");
    const { data, error } = await context.supabase
      .from("advert_requests")
      .select("id, brand_name, contact_name, email, brand_url, headline, description, landing_url, creative_url, campaign_start, campaign_end, budget, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Unable to load advertising requests.");
    return (data ?? []) as AdvertRequest[];
  });

export const updateAdvertRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["new", "reviewing", "approved", "declined"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !admin) throw new Error("Admin access required.");
    const { error } = await context.supabase
      .from("advert_requests")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error("Unable to update this advertising request.");
    return { ok: true };
  });
