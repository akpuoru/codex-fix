import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseUrl, supabasePublishableKey } from "@/lib/supabase-env";

function createPublicSupportClient() {
  const key = supabasePublishableKey();
  const url = supabaseUrl();
  if (!key || !url) throw new Error("Support is temporarily unavailable. Please try again.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

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
    const client = createPublicSupportClient();
    const { data: id, error } = await client.rpc("submit_support_request", {
      _name: data.name, _email: data.email, _topic: data.topic,
      _tracking: data.tracking, _message: data.message, _channel: data.channel,
    });
    if (error) throw new Error(error.message.includes("Too many messages") ? "Too many messages. Please try again later." : "Your message could not be sent. Please try again.");
    return { id };
  });

const conversationSchema = z.object({ reference: z.string().trim().regex(/^\d{16}$/, "Enter the 16-digit support reference.") });
const attachmentSchema = z.array(z.string().max(128)).max(3).default([]);
const replySchema = z.object({
  reference: z.string().trim().regex(/^\d{16}$/, "Enter the 16-digit support reference."),
  message: z.string().trim().min(1).max(3000),
  attachments: attachmentSchema,
});
const adminReplySchema = z.object({
  id: z.string().uuid(),
  message: z.string().trim().min(1).max(3000),
  attachments: attachmentSchema,
  action: z.enum(["site", "email"]).default("site"),
});
const supportMessageIdSchema = z.object({ id: z.string().uuid() });

export const getSupportConversation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => conversationSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await createPublicSupportClient().rpc("get_support_conversation", { _reference: data.reference });
    if (error) throw new Error("Unable to load this support conversation. Check the reference and try again.");
    if (!rows?.length) throw new Error("We couldn't find a conversation with that reference.");
    return rows;
  });

export const replySupportConversation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => replySchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await createPublicSupportClient().rpc("reply_support_conversation", {
      _reference: data.reference,
      _message: data.message,
      _attachments: data.attachments,
    });
    if (error) throw new Error(error.message.includes("Too many replies") ? "Too many replies. Please try again later." : "Your reply could not be sent. Check the reference and try again.");
    return { ok: true };
  });

export const listSupport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !admin) throw new Error("Admin access required.");
    const { data, error } = await context.supabase.from("support_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Unable to load messages.");
    if (!data?.length) return [];
    const { data: messages, error: messagesError } = await context.supabase
      .from("support_messages")
      .select("id, request_id, sender_type, message, created_at, attachments")
      .in("request_id", data.map((row) => row.id))
      .order("created_at", { ascending: true });
    if (messagesError) throw new Error("Unable to load support replies.");
    return data.map((row) => ({ ...row, messages: (messages ?? []).filter((message) => message.request_id === row.id) }));
  });

export const adminReplySupportConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminReplySchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.action === "email") {
      const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
      if (roleError || !admin) throw new Error("Admin access required.");

      const { data: request, error: requestError } = await context.supabase
        .from("support_requests")
        .select("name, email, public_reference")
        .eq("id", data.id)
        .maybeSingle();
      if (requestError || !request) {
        console.error("[Support email] Could not load the support request recipient.", requestError?.message);
        throw new Error("Unable to load this customer's email address.");
      }

      try {
        const { sendSupportReplyEmail } = await import("@/lib/support-email.server");
        const emailResult = await sendSupportReplyEmail({
          to: request.email,
          name: request.name,
          reference: request.public_reference,
          message: data.message,
        });
        return { action: "email" as const, emailSent: emailResult.sent, emailIssue: emailResult.issue };
      } catch (emailError) {
        console.error("[Support email] Email-only reply failed.", emailError);
        return { action: "email" as const, emailSent: false, emailIssue: "provider_error" as const };
      }
    }

    const { error } = await context.supabase.rpc("admin_reply_support_conversation", {
      _request: data.id,
      _message: data.message,
      _attachments: data.attachments,
    });
    if (error) throw new Error(error.message.includes("Admin access required") ? "Admin access required." : "Unable to send this reply.");

    return { action: "site" as const, ok: true };
  });

export const adminDeleteSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => supportMessageIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: attachments, error } = await context.supabase.rpc("admin_delete_support_message", { _message: data.id });
    if (error) throw new Error(error.message.includes("Admin access required") ? "Admin access required." : "Unable to delete this support message.");
    return { attachments: attachments ?? [] };
  });

export const adminDeleteSupportConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => supportMessageIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: attachments, error } = await context.supabase.rpc("admin_delete_support_conversation", { _request: data.id });
    if (error) throw new Error(error.message.includes("Admin access required") ? "Admin access required." : "Unable to delete this support conversation.");
    return { attachments: attachments ?? [] };
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
