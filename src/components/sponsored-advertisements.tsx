import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { listActiveAdvertisements } from "@/lib/advertising.functions";

export function SponsoredAdvertisements() {
  const list = useServerFn(listActiveAdvertisements);
  const query = useQuery({
    queryKey: ["active-advertisements"],
    queryFn: () => list(),
    staleTime: 60_000,
  });
  const advertisements = query.data ?? [];

  return (
    <section aria-label="Bridgeway brand partners" className="border-y border-line bg-background">
      <div className="mx-auto max-w-[1440px] px-6 py-10 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-mono text-primary">PARTNER SPOTLIGHT</p>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Brands for the journey</h2>
          </div>
          <Link to="/advertise" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            Advertise with Bridgeway <ArrowUpRight className="size-4" />
          </Link>
        </div>

        {query.isError ? (
          <p className="mt-5 text-sm text-muted-foreground">Partner offers are temporarily unavailable.</p>
        ) : advertisements.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {advertisements.map((advertisement) => (
              <a
                key={advertisement.id}
                href={advertisement.landing_url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="group overflow-hidden rounded-xl bg-card ring-1 ring-line transition-shadow hover:shadow-lg"
              >
                {advertisement.creative_url ? (
                  <img
                    src={advertisement.creative_url}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-[16/9] place-items-center bg-primary/5 text-primary"><Megaphone className="size-8" /></div>
                )}
                <div className="p-5">
                  <div className="label-mono">SPONSORED · {advertisement.brand_name}</div>
                  <h3 className="mt-2 font-display text-lg font-bold group-hover:text-primary">{advertisement.headline}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{advertisement.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Learn more <ArrowUpRight className="size-4" /></span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-start gap-4 rounded-xl bg-card p-6 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Reach travellers, shippers and business customers while they plan their next move. Submit a campaign request for the Bridgeway homepage partner spotlight.</p>
            <Link to="/advertise" className="shrink-0 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Explore advertising</Link>
          </div>
        )}
      </div>
    </section>
  );
}
