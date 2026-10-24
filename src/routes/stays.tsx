import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BedDouble, Check, ShieldCheck } from "lucide-react";

import { ServiceHero } from "@/components/service-hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/stays")({
  head: () => ({
    meta: [
      { title: "Hotel stays · Bridgeway" },
      { name: "description", content: "Search hotel stays, compare room rates and manage your Bridgeway reservation." },
      { property: "og:title", content: "Bridgeway Stays · Find your next stay" },
      { property: "og:description", content: "Compare hotel rooms, rate terms and prices before confirming your stay." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bridgewaytrack.live/stays" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bridgewaytrack.live/stays" }],
  }),
  component: StaysLandingPage,
});

const steps = [
  { title: "Choose your destination", description: "Search by city or airport and add your dates, guests and room count." },
  { title: "Compare rooms and terms", description: "Review photos, ratings, meal plans, cancellation terms and the final rate." },
  { title: "Confirm a reservation", description: "Enter the guest details and review the amount due at booking and at the property." },
];

function StaysLandingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <ServiceHero imageAlt="A welcoming hotel lobby prepared for guests">
          <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase text-accent">
            <BedDouble className="size-4" />Bridgeway stays
          </div>
          <h1 className="notranslate max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            ARRIVE WELL.
            <br />
            STAY COMFORTABLY.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-secondary-foreground/85">
            Compare available hotel rooms, understand the full rate and keep your reservation details together with your trip.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/stays/book" className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-accent-foreground transition-[filter] hover:brightness-110">
              Find a hotel <ArrowRight className="size-4" />
            </a>
            <a href="/flights" className="inline-flex items-center gap-2 rounded-md border border-secondary-foreground/40 bg-secondary/30 px-5 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/60">
              Explore flights
            </a>
          </div>
        </ServiceHero>

        <section className="border-b border-line bg-card">
          <div className="mx-auto grid max-w-[1440px] gap-px bg-line sm:grid-cols-3">
            <div className="bg-card p-6 sm:p-8">
              <div className="label-mono">See the property</div>
              <h2 className="mt-2 font-display text-xl font-bold">Photos, location and reviews</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Explore property photos, guest scores, amenities and the address before choosing a room.</p>
            </div>
            <div className="bg-card p-6 sm:p-8">
              <div className="label-mono">Compare room rates</div>
              <h2 className="mt-2 font-display text-xl font-bold">Meals and cancellation terms</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Check the room type, included benefits, cancellation timeline and final price.</p>
            </div>
            <div className="bg-card p-6 sm:p-8">
              <div className="label-mono">Your reservation</div>
              <h2 className="mt-2 font-display text-xl font-bold">Keep stay details close</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">View your hotel reference, dates, guest names and check-in guidance in your account.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-6 py-14 sm:py-16">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">How Bridgeway stays works</div>
            <h2 className="mt-2 font-display text-3xl font-bold">A clearer route from search to check-in</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-xl bg-card p-6 ring-1 ring-line">
                <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary"><Check className="size-5" /></div>
                <div className="mt-5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Step 0{index + 1}</div>
                <h3 className="mt-1 font-display text-xl font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-secondary text-secondary-foreground">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:py-12">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-accent"><ShieldCheck className="size-4" />Review before you confirm</div>
              <p className="mt-3 text-sm leading-6 text-secondary-foreground/80">
                Hotel rates can include a deposit or fees due at the property. We show the latest quote, cancellation terms and payment timing before you place a reservation.
              </p>
            </div>
            <a href="/stays/book" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-accent-foreground hover:brightness-110">Search stays <ArrowRight className="size-4" /></a>
          </div>
        </section>

        <section className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-5 px-6 py-10">
          <div><div className="label-mono">Complete your trip</div><h2 className="mt-1 font-display text-2xl font-bold">Add flights, car hire or delivery</h2></div>
          <div className="flex flex-wrap gap-3">
            <a href="/flights" className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-5 py-3 text-sm font-semibold hover:border-primary">Flights <ArrowRight className="size-4" /></a>
            <a href="/cars" className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-5 py-3 text-sm font-semibold hover:border-primary">Car hire <ArrowRight className="size-4" /></a>
            <a href="/#delivery" className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-5 py-3 text-sm font-semibold hover:border-primary">Delivery <ArrowRight className="size-4" /></a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
