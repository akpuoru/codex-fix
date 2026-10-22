import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createShipmentCheckout } from "@/lib/payments.functions";

export function ShipmentPay({ shipmentId }: { shipmentId: string }) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createShipmentCheckout({
      data: {
        shipmentId,
        returnUrl: `${window.location.origin}/shipments/${shipmentId}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Payment session could not be created");
    return result.clientSecret;
  };

  return (
    <div id="checkout" className="rounded-xl bg-card p-4 ring-1 ring-line">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
