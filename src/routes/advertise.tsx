import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCircle2, Megaphone, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { submitAdvertRequest } from "@/lib/advertising.functions";

export const Route = createFileRoute("/advertise")({
  head: () => ({
    meta: [
      { title: "Advertise with Bridgeway · Brand partnerships" },
      { name: "description", content: "Request a sponsored homepage placement to reach Bridgeway travellers, shippers and business customers." },
      { property: "og:title", content: "Advertise with Bridgeway" },
      { property: "og:description", content: "Introduce your brand to people planning flights, stays, car hire and international deliveries." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bridgewaytrack.live/advertise" },
    ],
    links: [{ rel: "canonical", href: "https://bridgewaytrack.live/advertise" }],
  }),
  component: AdvertisePage,
});

function AdvertisePage() {
  const send = useServerFn(submitAdvertRequest);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setError("");
    try {
      const result = await send({
        data: {
          brandName: String(values.get("brandName") ?? ""),
          contactName: String(values.get("contactName") ?? ""),
          email: String(values.get("email") ?? ""),
          brandUrl: String(values.get("brandUrl") ?? ""),
          headline: String(values.get("headline") ?? ""),
          description: String(values.get("description") ?? ""),
          landingUrl: String(values.get("landingUrl") ?? ""),
          creativeUrl: String(values.get("creativeUrl") ?? ""),
          campaignStart: String(values.get("campaignStart") ?? ""),
          campaignEnd: String(values.get("campaignEnd") ?? ""),
          budget: String(values.get("budget") ?? ""),
          website: String(values.get("website") ?? ""),
        },
      });
      setReference(result.id);
      form.reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your request could not be sent. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="bg-secondary text-secondary-foreground">
          <div className="mx-auto grid max-w-[1320px] gap-10 px-6 py-14 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Bridgeway brand partnerships</p>
              <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">Put your brand in motion.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-secondary-foreground/75">Introduce your offer to people planning a journey, arranging a delivery or moving their business across borders.</p>
              <a href="#request" className="mt-7 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-accent-foreground hover:brightness-110">Request a placement <ArrowRight className="size-4" /></a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Feature icon={Megaphone} title="Homepage partner spotlight" detail="A sponsored brand card with your headline, image and link." />
              <Feature icon={ShieldCheck} title="Reviewed before it goes live" detail="Our team checks every campaign and creative before publication." />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1320px] gap-10 px-6 py-12 lg:grid-cols-[0.75fr_1.25fr] lg:py-16">
          <div>
            <p className="label-mono text-primary">HOW IT WORKS</p>
            <h2 className="mt-2 font-display text-3xl font-bold">A clear path from brief to spotlight.</h2>
            <ol className="mt-7 space-y-5">
              <li className="flex gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">01</span><div><h3 className="font-semibold">Share your campaign</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Tell us what you offer, who it is for and when you want to run it.</p></div></li>
              <li className="flex gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">02</span><div><h3 className="font-semibold">We review the details</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Bridgeway will contact you about fit, creative, availability and pricing.</p></div></li>
              <li className="flex gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">03</span><div><h3 className="font-semibold">Approved campaigns appear</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Once approved, your advert appears in the homepage partner spotlight during the dates agreed with our team.</p></div></li>
            </ol>
            <div className="mt-8 rounded-xl border border-line bg-card p-5 text-sm leading-6 text-muted-foreground">
              The request form does not collect payment or publish an advert immediately. We confirm pricing and campaign details with you before anything goes live.
            </div>
          </div>

          <div id="request" className="scroll-mt-28 rounded-2xl bg-card p-5 ring-1 ring-line sm:p-8">
            {reference ? (
              <div className="py-10 text-center" role="status">
                <CheckCircle2 className="mx-auto size-12 text-success" />
                <h2 className="mt-4 font-display text-2xl font-bold">Campaign request received</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Our team will review your details and follow up at the email address you provided. Your advert will only appear after approval.</p>
                <p className="mt-4 font-mono text-xs text-muted-foreground">Reference: {reference.slice(0, 8).toUpperCase()}</p>
                <Button variant="outline" className="mt-6" onClick={() => setReference("")}>Send another request</Button>
              </div>
            ) : (
              <>
                <p className="label-mono text-primary">HOMEPAGE PARTNER SPOTLIGHT</p>
                <h2 className="mt-2 font-display text-2xl font-bold">Tell us about your campaign</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Share a proposed advert and campaign dates. We’ll contact you to confirm availability and terms.</p>
                <form className="mt-7 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
                  <Field label="Brand or company name"><input className={fieldClass} name="brandName" autoComplete="organization" required minLength={2} maxLength={120} /></Field>
                  <Field label="Contact person"><input className={fieldClass} name="contactName" autoComplete="name" required minLength={2} maxLength={120} /></Field>
                  <Field label="Work email"><input className={fieldClass} name="email" type="email" autoComplete="email" required maxLength={255} /></Field>
                  <Field label="Brand website · optional"><input className={fieldClass} name="brandUrl" type="url" placeholder="https://example.com" /></Field>
                  <Field label="Advert headline"><input className={fieldClass} name="headline" required minLength={4} maxLength={100} placeholder="A short line for your offer" /></Field>
                  <Field label="Link customers should visit"><input className={fieldClass} name="landingUrl" type="url" placeholder="https://example.com/offer" required /></Field>
                  <label className="text-sm font-semibold sm:col-span-2">Advert description<textarea name="description" required minLength={10} maxLength={300} rows={3} placeholder="Describe the product, service or offer you want customers to see." className={fieldClass} /></label>
                  <Field label="Image URL · optional"><input className={fieldClass} name="creativeUrl" type="url" placeholder="https://example.com/advert-image.jpg" /></Field>
                  <Field label="Indicative campaign budget and currency"><input className={fieldClass} name="budget" required minLength={2} maxLength={100} placeholder="e.g. $1,500 USD or still exploring" /></Field>
                  <Field label="Requested start date"><input className={fieldClass} name="campaignStart" type="date" min={today} required /></Field>
                  <Field label="Requested end date"><input className={fieldClass} name="campaignEnd" type="date" min={today} required /></Field>
                  <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
                  {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
                  <Button type="submit" disabled={pending} className="gap-2 sm:col-span-2 sm:w-fit">{pending ? "Sending request…" : "Send campaign request"}<ArrowRight className="size-4" /></Button>
                  <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">Submitting this form is a campaign enquiry, not a booking or payment. See <Link to="/contact" className="underline">contact</Link> if you need help.</p>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Feature({ icon: Icon, title, detail }: { icon: typeof Megaphone; title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-secondary-foreground/15 bg-secondary-foreground/5 p-4">
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent/15 text-accent"><Icon className="size-5" /></div>
      <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm leading-5 text-secondary-foreground/70">{detail}</p></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-semibold">{label}{children}</label>;
}

const fieldClass = "mt-2 block w-full rounded-md border border-line bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary";
