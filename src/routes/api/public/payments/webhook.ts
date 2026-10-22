import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import type { Database } from "@/integrations/supabase/types";
import { supabaseUrl, supabaseServiceRoleKey } from "@/lib/supabase-env";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      supabaseUrl()!,
      supabaseServiceRoleKey()!,
    );
  }
  return _supabase;
}

async function markShipmentPaid(session: any) {
  const shipmentId = session.metadata?.shipmentId;
  if (!shipmentId) return;
  const now = new Date().toISOString();
  const { data: shipment } = await getSupabase()
    .from("shipments")
    .update({
      paid_at: now,
      stripe_session_id: session.id,
    })
    .eq("id", shipmentId)
    .is("paid_at", null)
    .select("id, origin_city, origin_country")
    .maybeSingle();

  // Payment only marks the shipment paid; an admin still confirms the order.
  if (shipment) {
    await getSupabase().from("shipment_events").insert({
      shipment_id: shipmentId,
      status: "booked",
      location: `${shipment.origin_city}, ${shipment.origin_country}`,
      note: "Payment received · awaiting confirmation",
    });
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Delayed-notification methods fire this on submission, not settlement.
      if (session.payment_status !== "unpaid") {
        await markShipmentPaid(session);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await markShipmentPaid(event.data.object);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid or missing env query parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
