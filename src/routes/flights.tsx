import { createFileRoute } from "@tanstack/react-router";
import { Armchair, ArrowRight, ClipboardCheck, Plane, ShieldCheck } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ServiceHero } from "@/components/service-hero";

export const Route = createFileRoute("/flights")({
  head: () => ({
    meta: [
      { title: "Flight reservations · Bridgeway" },
      {
        name: "description",
        content:
          "Explore eligible airline reservation holds, choose available seats and save your flight itinerary with Bridgeway.",
      },
      { property: "og:title", content: "Bridgeway Flights · Flight reservations made clear" },
      {
        property: "og:description",
        content: "Search eligible airline holds, review seat options and keep your itinerary together.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bridgewaytrack.live/flights" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bridgewaytrack.live/flights" }],
  }),
  component: FlightsLandingPage,
});

const steps = [
  {
    icon: Plane,
    title: "Find a flight",
    description: "Search by city or airport and compare fares that support an unpaid airline hold.",
  },
  {
    icon: Armchair,
    title: "Choose a seat",
    description: "View and select seats when the airline provides a seat map for that itinerary.",
  },
  {
    icon: ClipboardCheck,
    title: "Keep your itinerary",
    description: "Review the airline reference and payment deadline, then save or print your itinerary.",
  },
];

function FlightsLandingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <ServiceHero imageAlt="International cargo aircraft being loaded at an airport">
          <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase text-accent">
            <span className="h-px w-8 bg-accent" />Bridgeway flights
          </div>
          <h1 className="notranslate max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            YOUR JOURNEY,
            <br />
            CLEARLY CONNECTED.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-secondary-foreground/85">
            Explore flight options, request an airline reservation hold and keep your itinerary in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/flights/book"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-accent-foreground transition-[filter] hover:brightness-110"
            >
              Search flights <ArrowRight className="size-4" />
            </a>
            <a
              href="/#delivery"
              className="inline-flex items-center gap-2 rounded-md border border-secondary-foreground/40 bg-secondary/30 px-5 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/60"
            >
              Explore delivery
            </a>
          </div>
        </ServiceHero>

        <section className="border-b border-line bg-card">
          <div className="mx-auto grid max-w-[1440px] gap-px bg-line sm:grid-cols-3">
            <div className="bg-card p-6 sm:p-8">
              <div className="label-mono">Airline options</div>
              <h2 className="mt-2 font-display text-xl font-bold">Search eligible fares</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Browse flights that allow an airline reservation to be held for later payment.</p>
            </div>
            <div className="bg-card p-6 sm:p-8">
              <div className="label-mono">Seat selection</div>
              <h2 className="mt-2 font-display text-xl font-bold">Choose where available</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">See the seat layout and any seat price the airline returns for your selected flight.</p>
            </div>
            <div className="bg-card p-6 sm:p-8">
              <div className="label-mono">Your trip</div>
              <h2 className="mt-2 font-display text-xl font-bold">Save your itinerary</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep your reservation reference, flight details and payment deadline together.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-6 py-14 sm:py-16">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">How Bridgeway flights work</div>
            <h2 className="mt-2 font-display text-3xl font-bold">A clearer path from search to reservation</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <article key={title} className="rounded-xl bg-card p-6 ring-1 ring-line">
                <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-5" /></div>
                <div className="mt-5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Step 0{index + 1}</div>
                <h3 className="mt-1 font-display text-xl font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-secondary text-secondary-foreground">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:py-12">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-accent"><ShieldCheck className="size-4" />Know what your reservation means</div>
              <p className="mt-3 text-sm leading-6 text-secondary-foreground/80">
                An airline hold is a reservation, not a paid ticket or boarding pass. The airline sets the payment deadline and may release the booking if payment is not completed in time. Seat options and hold availability vary by flight.
              </p>
            </div>
            <a href="/flights/book" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-accent-foreground hover:brightness-110">
              Start flight search <ArrowRight className="size-4" />
            </a>
          </div>
        </section>

        <section className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-5 px-6 py-10">
          <div><div className="label-mono">Completing your trip?</div><h2 className="mt-1 font-display text-2xl font-bold">Add a hotel, car or delivery</h2></div>
          <div className="flex flex-wrap gap-3"><a href="/stays" className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-5 py-3 text-sm font-semibold hover:border-primary">Hotels <ArrowRight className="size-4" /></a><a href="/cars" className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-5 py-3 text-sm font-semibold hover:border-primary">Car hire <ArrowRight className="size-4" /></a><a href="/#delivery" className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-5 py-3 text-sm font-semibold hover:border-primary">Courier, luggage and freight <ArrowRight className="size-4" /></a></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
