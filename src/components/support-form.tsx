import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitSupport } from "@/lib/support.functions";

export function SupportForm({ channel = "contact" }: { channel?: "contact" | "chat" }) {
  const send = useServerFn(submitSupport);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  if (reference) return <div className="py-10 text-center" role="status">
    <CheckCircle2 className="mx-auto size-10 text-success" />
    <h3 className="mt-4 font-display text-xl font-bold">Message received</h3>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Your request is in our support inbox. A team member can contact you using the email you provided.</p>
    <p className="mt-4 text-xs text-muted-foreground">Reference: {reference.slice(0, 8).toUpperCase()}</p>
    <Button variant="outline" className="mt-6" onClick={() => setReference("")}>Send another message</Button>
  </div>;
  return <form className="grid gap-4" onSubmit={async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const topic = String(values.get("topic"));
    if (topic !== "shipment" && topic !== "booking" && topic !== "freight" && topic !== "other") return;
    setPending(true); setError("");
    try {
      const result = await send({ data: { name: String(values.get("name")), email: String(values.get("email")), topic, tracking: String(values.get("tracking") ?? ""), message: String(values.get("message")), channel, website: String(values.get("website") ?? "") } });
      if (result.id) setReference(result.id);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to send your message."); }
    finally { setPending(false); }
  }}>
    <div className={channel === "contact" ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
      <label className="text-sm font-semibold">Full name<input name="name" autoComplete="name" required minLength={2} maxLength={100} className={field} /></label>
      <label className="text-sm font-semibold">Email address<input name="email" autoComplete="email" type="email" required maxLength={255} className={field} /></label>
    </div>
    <label className="text-sm font-semibold">How can we help?<select name="topic" className={field}><option value="shipment">Shipment & tracking</option><option value="booking">Booking & pickup</option><option value="freight">Business & freight enquiry</option><option value="other">General enquiry</option></select></label>
    <label className="text-sm font-semibold">Tracking number <span className="font-normal text-muted-foreground">(optional)</span><input name="tracking" maxLength={40} className={field} /></label>
    <label className="text-sm font-semibold">Your message<textarea name="message" required minLength={10} maxLength={3000} rows={channel === "chat" ? 3 : 5} className={`${field} resize-y`} /></label>
    <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={pending} className="w-full gap-2 sm:w-auto sm:justify-self-start"><Send className="size-4" />{pending ? "Sending…" : "Send message"}</Button>
    <p className="text-xs leading-5 text-muted-foreground">Your details will only be used to respond to this enquiry.</p>
  </form>;
}
const field = "mt-2 block w-full rounded-md border border-line bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary";