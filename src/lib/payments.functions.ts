import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };

// Zero-decimal currencies store amounts in the major unit already.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string | undefined; userId?: string | undefined },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    const match = found.data[0];
    if (match) return match.id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      if (options.userId && customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createShipmentCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        shipmentId: z.string().uuid(),
        returnUrl: z.string().url(),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { supabase, userId } = context;

      // Load the caller's own shipment (RLS) — amount and currency always
      // come from the booking, never from the client.
      const { data: shipment, error } = await supabase
        .from("shipments")
        .select("id, tracking_number, price_cents, currency, paid_at, kind, level")
        .eq("id", data.shipmentId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!shipment) return { error: "Shipment not found" };
      if (shipment.paid_at) return { error: "This shipment is already paid" };
      if (!shipment.price_cents || shipment.price_cents < 50) {
        return { error: "This shipment has no payable amount" };
      }

      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email ?? undefined;

      const stripe = createStripeClient(data.environment as StripeEnv);
      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const currency = (shipment.currency ?? "EUR").toLowerCase();
      const unitAmount = ZERO_DECIMAL_CURRENCIES.has(currency)
        ? Math.round(shipment.price_cents / 100)
        : shipment.price_cents;
      const description = `Bridgeway Freighting — ${shipment.tracking_number} (${shipment.kind} · ${shipment.level})`;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: description },
              unit_amount: unitAmount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: { description },
        metadata: { userId, shipmentId: shipment.id },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
