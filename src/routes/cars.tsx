import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CarFront, Check, Clock3, PackageCheck, ShieldCheck } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ServiceHero } from "@/components/service-hero";

export const Route = createFileRoute("/cars")({
  head: () => ({
    meta: [
      { title: "Car hire · Bridgeway" },
      { name: "description", content: "Compare rental cars for your trip and reserve pay-at-counter options with Bridgeway." },
      { property: "og:title", content: "Bridgeway Car Hire" },
      { property: "og:description", content: "Find a rental car to match your journey and reserve a postpaid rate." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bridgewaytrack.live/cars" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bridgewaytrack.live/cars" }],
  }),
  component: CarsLandingPage,
});

const steps = [
  { title: "Choose your pickup", description: "Select an airport, dates, times and the main driver’s details." },
  { title: "Compare available cars", description: "Review supplier, vehicle, baggage, mileage and rental conditions." },
  { title: "Reserve pay-at-counter", description: "Confirm a postpaid booking. The rental supplier collects payment at pickup." },
];

function CarsLandingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <ServiceHero imageAlt="A rental car ready for an international traveller at an airport">
          <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase text-accent">
            <CarFront className="size-4" />Bridgeway car hire
          </div>
          <h1 className="notranslate max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            YOUR NEXT STOP,
            <br />
            ON YOUR TERMS.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-secondary-foreground/85">
            Find a rental car for your trip, compare the supplier’s terms and reserve eligible pay-at-counter options.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/cars/book" className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-accent-foreground transition-[filter] hover:brightness-110">
              Find a car <ArrowRight className="size-4" />
            </a>
            <a href="/flights" className="inline-flex items-center gap-2 rounded-md border border-secondary-foreground/40 bg-secondary/30 px-5 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/60">
              Explore flights
            </a>
          </div>
        </ServiceHero>

        <section className="border-b border-line bg-card">
          <div className="mx-auto grid max-w-[1440px] gap-px bg-line sm:grid-cols-3">
            <div className="bg-card p-6 sm:p-8">
              <div className="label-mono">Compare</div>
              <h2 className="mt-2 font-display text-xl font-bold">Vehicle and supplier details</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">See capacity, baggage, fuel, transmission and pickup location before you choose.</p>
            </div>
            <div className="bg-card p-6 sm:p-8">
              <div className="label-mono">Pay at pickup</div>
              <h2 className="mt-2 font-display text-xl font-bold">Reserve a postpaid rate</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Bridgeway only shows rates marked postpaid. The supplier collects the rental payment at the counter.</p>
            </div>
            <div className="bg-card p-6 sm:p-8">
              <div className="label-mono">Your trip</div>
              <h2 className="mt-2 font-display text-xl font-bold">Keep the confirmation handy</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Find the booking reference, driver, supplier and pickup instructions in your account.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-6 py-14 sm:py-16">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">How Bridgeway car hire works</div>
            <h2 className="mt-2 font-display text-3xl font-bold">A clear route from search to pickup</h2>
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
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-accent"><ShieldCheck className="size-4" />Check before you collect
              </div>
              <p className="mt-3 text-sm leading-6 text-secondary-foreground/80">
                Pay-at-counter rates do not collect the rental charge when you reserve. Suppliers can have separate licence, deposit and payment-card rules at pickup; review the displayed terms before confirming.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/cars/book" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-accent-foreground hover:brightness-110">Search cars <ArrowRight className="size-4" /></a>
              <a href="/contact" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-secondary-foreground/40 px-5 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/60"><Clock3 className="size-4" />Ask Bridgeway</a>
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-5 px-6 py-10">
          <div><div className="label-mono">Bringing luggage?</div><h2 className="mt-1 font-display text-2xl font-bold">Send your bags ahead with Bridgeway delivery</h2></div>
          <a href="/book" className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-5 py-3 text-sm font-semibold hover:border-primary"><PackageCheck className="size-4" />Explore delivery <ArrowRight className="size-4" /></a>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
