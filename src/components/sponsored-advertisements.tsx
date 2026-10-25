import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { listActiveAdvertisements } from "@/lib/advertising.functions";

export function SponsoredAdvertisements() {
  const list = useServerFn(listActiveAdvertisements);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [canSlide, setCanSlide] = useState(false);
  const query = useQuery({
    queryKey: ["active-advertisements"],
    queryFn: () => list(),
    staleTime: 60_000,
  });
  const advertisements = query.data ?? [];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => setCanSlide(track.scrollWidth > track.clientWidth + 2);
    const observer = new ResizeObserver(update);
    observer.observe(track);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [advertisements.length]);

  const slide = useCallback((direction: -1 | 1, behavior: ScrollBehavior = "smooth") => {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>("[data-ad-card]");
    if (!track || !card) return;
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 16;
    const step = card.getBoundingClientRect().width + gap;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const current = track.scrollLeft;
    const next = Math.max(0, Math.min(maxScroll, current + step * direction));
    const target = direction > 0 && current >= maxScroll - 2
      ? 0
      : direction < 0 && current <= 2
        ? maxScroll
        : next;
    track.scrollTo({ left: target, behavior });
  }, []);

  useEffect(() => {
    if (!canSlide || advertisements.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!pausedRef.current && document.visibilityState === "visible") slide(1);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [advertisements.length, canSlide, slide]);

  return (
    <section aria-label="Bridgeway brand partners" className="border-y border-line bg-background">
      <div className="mx-auto max-w-[1440px] px-6 py-10 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-mono text-primary">PARTNER SPOTLIGHT</p>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Brands for the journey</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canSlide && advertisements.length > 1 && (
              <div className="flex gap-2" aria-label="Advertisement controls" onPointerEnter={() => { pausedRef.current = true; }} onPointerLeave={() => { pausedRef.current = false; }} onFocusCapture={() => { pausedRef.current = true; }} onBlurCapture={() => { pausedRef.current = false; }}>
                <button type="button" aria-label="Previous advertisements" onClick={() => slide(-1)} className="grid size-10 place-items-center rounded-full border border-line bg-card text-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" aria-label="Next advertisements" onClick={() => slide(1)} className="grid size-10 place-items-center rounded-full border border-line bg-card text-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
                  <ChevronRight className="size-5" />
                </button>
              </div>
            )}
            <Link to="/advertise" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              Advertise with Bridgeway <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>

        {query.isError ? (
          <p className="mt-5 text-sm text-muted-foreground">Partner offers are temporarily unavailable.</p>
        ) : advertisements.length ? (
          <div
            ref={trackRef}
            role="region"
            aria-roledescription="carousel"
            aria-label="Sponsored brand advertisements"
            aria-live="off"
            onPointerEnter={() => { pausedRef.current = true; }}
            onPointerLeave={() => { pausedRef.current = false; }}
            onFocusCapture={() => { pausedRef.current = true; }}
            onBlurCapture={() => { pausedRef.current = false; }}
            className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
            style={{ scrollbarWidth: "thin" }}
          >
            {advertisements.map((advertisement) => (
              <a
                key={advertisement.id}
                data-ad-card
                role="group"
                aria-roledescription="slide"
                aria-label={`${advertisement.headline}, sponsored by ${advertisement.brand_name}`}
                href={advertisement.landing_url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="group basis-[85%] shrink-0 snap-start overflow-hidden rounded-xl bg-card ring-1 ring-line transition-shadow hover:shadow-lg sm:basis-[calc(50%_-_0.5rem)] xl:basis-[calc(25%_-_0.75rem)]"
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
