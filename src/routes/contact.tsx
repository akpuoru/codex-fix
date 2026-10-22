import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PackageSearch, Truck, Building2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SupportForm } from "@/components/support-form";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Contact & customer support · Bridgeway Freighting" },
    { name: "description", content: "Contact Bridgeway Freighting about shipment tracking, pickups, luggage delivery and international business freight." },
    { property: "og:title", content: "Customer care · Bridgeway Freighting" },
    { property: "og:description", content: "Get help with your shipment or discuss your international shipping needs." },
    { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bridgewaytrack.live/contact" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://bridgewaytrack.live/contact" }] }),
  component: Contact,
});

function Contact() {
  return <div className="min-h-screen"><SiteHeader />
    <main>
      <section className="border-b border-line bg-secondary text-secondary-foreground"><div className="mx-auto max-w-[1320px] px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase text-accent">Customer care</p>
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-5xl">Contact Bridgeway</h1>
        <p className="mt-5 max-w-xl leading-7 text-secondary-foreground/75">A shipment question. A complex route. Your next business delivery. Let’s get it moving.</p>
      </div></section>
      <section className="mx-auto grid max-w-[1320px] gap-12 px-6 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
        <div><h2 className="font-display text-2xl font-bold">Here for your delivery</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">Send your enquiry directly to our support team. Include your waybill number if your message relates to an existing shipment.</p>
          <div className="mt-8 divide-y divide-line">
            <Link to="/track" className="flex items-center gap-4 py-5"><PackageSearch className="size-6 text-primary" /><div className="flex-1"><div className="font-semibold">Track a delivery</div><p className="mt-1 text-sm text-muted-foreground">Latest shipment status and scan history</p></div><ArrowRight className="size-4" /></Link>
            <Link to="/book" className="flex items-center gap-4 py-5"><Truck className="size-6 text-primary" /><div className="flex-1"><div className="font-semibold">Arrange your next shipment</div><p className="mt-1 text-sm text-muted-foreground">Courier, luggage and freight bookings</p></div><ArrowRight className="size-4" /></Link>
            <div className="flex items-start gap-4 py-5"><Building2 className="mt-1 size-6 shrink-0 text-primary" /><div><div className="font-semibold">Business shipping</div><p className="mt-1 text-sm leading-6 text-muted-foreground">Select “Business & freight enquiry” for commercial shipments and regular shipping needs.</p></div></div>
          </div>
        </div>
        <div><div className="mb-7 border-b border-line pb-5"><h2 className="font-display text-2xl font-bold">Send an enquiry</h2><p className="mt-2 text-sm text-muted-foreground">We’ll use your email address to follow up.</p></div><SupportForm /></div>
      </section>
    </main><SiteFooter />
  </div>;
}