import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BedDouble, CalendarDays, Check, CircleAlert, CreditCard, MapPin, Search, ShieldCheck, Star, Users } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  createStayBooking,
  createStayQuote,
  fetchStayRates,
  getStayConfig,
  listMyStayBookings,
  searchStayPlaces,
  searchStays,
} from "@/lib/stays.functions";

export const Route = createFileRoute("/_authenticated/stays/book")({
  head: () => ({
    meta: [
      { title: "Find a hotel · Bridgeway" },
      { name: "description", content: "Search hotel availability and reserve a room with Bridgeway." },
    ],
  }),
  component: StaysBookingPage,
});

type StayPlace = {
  id: string;
  label: string;
  name: string;
  city: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  type: "city" | "airport";
};
type StayGuest = { givenName: string; familyName: string };
type JsonObject = Record<string, any>;

const today = new Date().toISOString().slice(0, 10);
const defaultCheckIn = offsetDate(2);
const defaultCheckOut = offsetDate(4);
const inputClass = "mt-1.5 w-full rounded-md bg-background px-3 py-3 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-primary";
const testHotelPlace: StayPlace = {
  id: "duffel-test-hotels",
  label: "Duffel Test Hotels",
  name: "Duffel Test Hotels",
  city: "Test inventory",
  countryCode: "",
  latitude: -24.38,
  longitude: -128.32,
  type: "city",
};

function offsetDate(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function money(amount?: string | number | null, currency?: string | null) {
  if (amount == null || !currency) return "Price unavailable";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "Price unavailable";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function prettyDate(value?: string | null) {
  if (!value) return "Date pending";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000));
}

function hotelAddress(accommodation: JsonObject) {
  const address = accommodation?.location?.address ?? {};
  return [address.line_one, address.city_name, address.region, address.country_code].filter(Boolean).join(", ") || "Address provided after confirmation";
}

function paymentMethods(rate: JsonObject): string[] {
  const methods = rate?.available_payment_methods;
  if (!Array.isArray(methods)) return [];
  return methods.flatMap((method: unknown) => Array.isArray(method) ? method : [method]).filter((method): method is string => typeof method === "string");
}

function cancellationText(timeline: JsonObject[]) {
  if (!timeline?.length) return "Cancellation terms vary. Review the rate conditions before confirming.";
  const first = timeline[0];
  if (!first.before) return "Cancellation terms are available for this rate.";
  return `Refund timeline applies before ${new Date(first.before).toLocaleString()}.`;
}

function StaysBookingPage() {
  const queryClient = useQueryClient();
  const configFn = useServerFn(getStayConfig);
  const placesFn = useServerFn(searchStayPlaces);
  const searchFn = useServerFn(searchStays);
  const ratesFn = useServerFn(fetchStayRates);
  const quoteFn = useServerFn(createStayQuote);
  const bookingFn = useServerFn(createStayBooking);
  const bookingsFn = useServerFn(listMyStayBookings);

  const [destination, setDestination] = useState<StayPlace | null>(null);
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [freeCancellationOnly, setFreeCancellationOnly] = useState(false);
  const [testHotels, setTestHotels] = useState(false);
  const [ratesByResult, setRatesByResult] = useState<Record<string, JsonObject>>({});
  const [quoteData, setQuoteData] = useState<JsonObject | null>(null);
  const [selectedRate, setSelectedRate] = useState<JsonObject | null>(null);
  const [guestNames, setGuestNames] = useState<StayGuest[]>([{ givenName: "", familyName: "" }, { givenName: "", familyName: "" }]);
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [lastBookingReference, setLastBookingReference] = useState<string | null>(null);

  const config = useQuery({ queryKey: ["stay-config"], queryFn: () => configFn() });
  const bookings = useQuery({ queryKey: ["my-stay-bookings"], queryFn: () => bookingsFn(), refetchInterval: 60000 });
  const search = useMutation({
    mutationFn: () => {
      if (!destination) throw new Error("Choose a destination from the suggestions.");
      return searchFn({ data: {
        destination: { label: destination.label, latitude: destination.latitude, longitude: destination.longitude },
        checkIn, checkOut, adults, rooms, freeCancellationOnly, testHotels,
      } });
    },
    onSuccess: () => { setRatesByResult({}); setQuoteData(null); setSelectedRate(null); setAcceptTerms(false); },
    onError: (error) => toast.error((error as Error).message),
  });
  const rates = useMutation({
    mutationFn: (searchResultId: string) => ratesFn({ data: { searchResultId } }),
    onSuccess: (value, searchResultId) => setRatesByResult((current) => ({ ...current, [searchResultId]: value as JsonObject })),
    onError: (error) => toast.error((error as Error).message),
  });
  const quote = useMutation({
    mutationFn: (rate: JsonObject) => quoteFn({ data: { rateId: rate.id } }),
    onSuccess: (value, rate) => {
      setSelectedRate(rate);
      setQuoteData(value as JsonObject);
      setAcceptTerms(false);
      const guestCount = (value as JsonObject).guests?.filter((guest: JsonObject) => guest.type === "adult").length || adults;
      setGuestNames(Array.from({ length: guestCount }, (_, index) => guestNames[index] ?? { givenName: "", familyName: "" }));
      window.setTimeout(() => document.getElementById("stay-confirmation")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const booking = useMutation({
    mutationFn: () => {
      if (!quoteData) throw new Error("Select a room and confirm the latest quote first.");
      return bookingFn({ data: {
        quoteId: quoteData.id,
        expectedTotalAmount: String(quoteData.total_amount),
        expectedTotalCurrency: quoteData.total_currency,
        acceptTerms: acceptTerms as true,
        email,
        phoneNumber,
        guests: guestNames.slice(0, quoteAdults).filter((guest) => guest.givenName.trim() && guest.familyName.trim()),
        specialRequests,
      } });
    },
    onSuccess: (value) => {
      setLastBookingReference(value.bookingReference ?? "Reservation confirmed");
      toast.success("Your hotel reservation was confirmed.");
      setQuoteData(null);
      setSelectedRate(null);
      setAcceptTerms(false);
      queryClient.invalidateQueries({ queryKey: ["my-stay-bookings"] });
      window.setTimeout(() => document.getElementById("stay-history")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const quoteRate = useMemo(() => quoteData?.accommodation?.rooms?.flatMap((room: JsonObject) => room.rates ?? []).find((rate: JsonObject) => rate.id === selectedRate?.id)
    ?? quoteData?.accommodation?.rooms?.[0]?.rates?.[0] ?? selectedRate, [quoteData, selectedRate]);
  const quoteAccommodation = quoteData?.accommodation ?? selectedRate?.accommodation ?? {};
  const quoteAdults = quoteData?.guests?.filter((guest: JsonObject) => guest.type === "adult").length || search.data?.adults || adults;
  const results = search.data?.results ?? [];

  useEffect(() => {
    if (destination) return;
    setTestHotels(false);
  }, [destination]);

  function updateGuest(index: number, key: keyof StayGuest, value: string) {
    setGuestNames((current) => current.map((guest, guestIndex) => guestIndex === index ? { ...guest, [key]: value } : guest));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!destination) { toast.error("Choose a destination from the suggestions."); return; }
    if (checkOut <= checkIn) { toast.error("Check-out must be after check-in."); return; }
    setLastBookingReference(null);
    search.reset();
    setRatesByResult({});
    setQuoteData(null);
    setSelectedRate(null);
    search.mutate();
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-3xl">
          <div className="font-mono text-[11px] tracking-[0.2em] text-primary">BRIDGEWAY STAYS</div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Find a place to stay.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Compare hotel photos, rooms and rate terms. A fresh quote confirms price and availability before you make a reservation.</p>
        </div>

        {config.data?.testMode && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-caution/40 bg-caution/5 p-4 text-sm">
          <div><div className="font-semibold">Duffel test mode</div><p className="mt-1 text-xs text-muted-foreground">Test hotels use a fixed Duffel test location and create sandbox reservations only.</p></div>
          <button type="button" onClick={() => { setDestination(testHotelPlace); setTestHotels(true); }} className="rounded-md border border-line bg-card px-4 py-2 font-semibold hover:border-primary">Use test hotel inventory</button>
        </div>}
        {!config.isPending && config.data && !config.data.connected && <div role="alert" className="mb-4 flex gap-3 rounded-lg border border-caution/40 bg-caution/5 p-4 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0 text-caution" /><div><strong>Duffel is not connected.</strong><p className="mt-1 text-muted-foreground">Add the server-only DUFFEL_ACCESS_TOKEN to the Cloudflare Worker to search hotels.</p></div></div>}
        {config.data?.connected && !config.data.bookingsEnabled && <div className="mb-4 flex gap-3 rounded-lg border border-caution/40 bg-caution/5 p-4 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0 text-caution" /><div><strong>Live reservations are paused.</strong><p className="mt-1 text-muted-foreground">Search and compare hotels; Bridgeway will enable live confirmation when its Duffel payment setup is ready.</p></div></div>}

        <form onSubmit={submitSearch} className="rounded-xl bg-card p-4 ring-1 ring-line sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <StayPlacePicker selected={destination} onSelect={(place) => { setDestination(place); setTestHotels(false); setQuoteData(null); setSelectedRate(null); }} />
            <Field label="Check-in"><input className={inputClass} type="date" name="stay-check-in" min={today} value={checkIn} onChange={(event) => setCheckIn(event.target.value)} required /></Field>
            <Field label="Check-out"><input className={inputClass} type="date" name="stay-check-out" min={checkIn || today} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} required /></Field>
            <Field label="Adults"><select className={inputClass} name="stay-adults" value={adults} onChange={(event) => { const count = Number(event.target.value); setAdults(count); setGuestNames((current) => Array.from({ length: count }, (_, index) => current[index] ?? { givenName: "", familyName: "" })); }}>
              {Array.from({ length: 9 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "adult" : "adults"}</option>)}
            </select></Field>
            <Field label="Rooms"><select className={inputClass} name="stay-rooms" value={rooms} onChange={(event) => setRooms(Number(event.target.value))}>{Array.from({ length: 8 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "room" : "rooms"}</option>)}</select></Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={freeCancellationOnly} onChange={(event) => setFreeCancellationOnly(event.target.checked)} className="size-4 accent-primary" />Free cancellation only</label>
              {destination && <span className="text-xs text-muted-foreground"><CalendarDays className="mr-1 inline size-3.5" />{nightsBetween(checkIn, checkOut)} nights · {adults} guests · {rooms} rooms</span>}
            </div>
            <button type="submit" disabled={search.isPending || !config.data?.connected} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-display text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60">
              <Search className="size-4" />{search.isPending ? "Searching…" : "Search hotels"}
            </button>
          </div>
        </form>

        {search.isError && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-card p-4 text-sm text-destructive">{(search.error as Error).message}</div>}
        {search.data && <section className="mt-8" aria-label="Hotel search results">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="label-mono">Available stays · {search.data.destination}</div><h2 className="mt-1 font-display text-xl font-bold">{results.length ? `${results.length} properties found` : "No properties found"}</h2></div><span className="font-mono text-xs text-muted-foreground">{prettyDate(search.data.checkIn)} – {prettyDate(search.data.checkOut)} · {search.data.nights} nights · {search.data.adults} adults · {search.data.rooms} {search.data.rooms === 1 ? "room" : "rooms"}</span></div>
          {!results.length && <div className="rounded-xl bg-card p-5 text-sm text-muted-foreground ring-1 ring-line">Duffel returned no available properties for these dates and guests. Try a nearby city or different dates.</div>}
          <div className="grid gap-4">
            {results.map((result: JsonObject) => {
              const accommodation = result.accommodation ?? {};
              const stayRates = ratesByResult[result.id];
              const roomOptions = (stayRates?.accommodation?.rooms ?? []).flatMap((room: JsonObject) => (room.rates ?? []).map((rate: JsonObject) => ({ ...rate, roomName: room.name, roomBeds: room.beds, roomPhotos: room.photos })));
              const loadingRates = rates.isPending && rates.variables === result.id;
              return <article key={result.id} className="overflow-hidden rounded-xl bg-card ring-1 ring-line">
                <div className="grid lg:grid-cols-[300px_1fr]">
                  <div className="relative min-h-52 bg-secondary">
                    {accommodation.photos?.[0]?.url ? <img src={accommodation.photos[0].url} alt={accommodation.name ?? "Hotel property"} loading="lazy" className="absolute inset-0 size-full object-cover" /> : <div className="absolute inset-0 grid place-items-center text-secondary-foreground/60"><BedDouble className="size-12" /></div>}
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold">{accommodation.name ?? "Available accommodation"}</h3>{accommodation.rating && <span className="rounded bg-primary/10 px-2 py-1 text-xs font-semibold">{accommodation.rating} star{accommodation.rating === 1 ? "" : "s"}</span>}</div>
                        <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" />{hotelAddress(accommodation)}</p>
                        {accommodation.review_score != null && <div className="mt-2 flex items-center gap-1 text-xs"><Star className="size-3.5 fill-accent text-accent" /><strong>{accommodation.review_score}</strong><span className="text-muted-foreground">{accommodation.review_count ? `· ${accommodation.review_count} reviews` : "guest score"}</span></div>}
                        {accommodation.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{accommodation.description}</p>}
                        {!!accommodation.amenities?.length && <div className="mt-3 flex flex-wrap gap-2">{accommodation.amenities.slice(0, 5).map((amenity: JsonObject, index: number) => <span key={`${amenity.type}-${index}`} className="rounded-md bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground ring-1 ring-line">{amenity.description ?? amenity.type}</span>)}</div>}
                      </div>
                      <div className="min-w-36 text-right"><div className="label-mono">From · {search.data.nights} nights</div><div className="mt-1 font-display text-2xl font-black text-primary">{money(result.cheapestTotal, result.cheapestCurrency)}</div><div className="mt-1 text-[11px] text-muted-foreground">Indicative search price</div></div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <div className="text-xs text-muted-foreground"><Users className="mr-1 inline size-3.5" />{result.guests?.length ?? search.data.adults} adults · {result.rooms ?? search.data.rooms} {Number(result.rooms ?? search.data.rooms) === 1 ? "room" : "rooms"}</div>
                      <button type="button" disabled={loadingRates} onClick={() => rates.mutate(result.id)} className="rounded-md bg-foreground px-4 py-2.5 font-display text-xs font-bold text-background hover:bg-primary disabled:opacity-60">{loadingRates ? "Loading rooms…" : stayRates ? "Refresh room rates" : "See available rooms"}</button>
                    </div>
                  </div>
                </div>
                {stayRates && <div className="border-t border-line bg-background p-4 sm:p-5">
                  <h4 className="mb-3 font-display text-lg font-bold">Choose a room</h4>
                  {roomOptions.length ? <div className="grid gap-3">{roomOptions.map((rate: JsonObject) => {
                    const canUseBalance = paymentMethods(rate).includes("balance");
                    const selected = selectedRate?.id === rate.id;
                    return <div key={rate.id} className={`rounded-lg bg-card p-4 ring-1 ${selected ? "ring-primary" : "ring-line"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-display font-bold">{rate.roomName ?? "Room"} · {rate.name ?? "Available rate"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{rate.board_type?.replaceAll("_", " ") ?? "Meal plan not specified"}{rate.roomBeds?.length ? ` · ${rate.roomBeds.map((bed: JsonObject) => `${bed.count} ${bed.type}`).join(", ")}` : ""}</div>
                          {!!rate.benefits?.length && <div className="mt-2 space-y-1 text-xs text-muted-foreground">{rate.benefits.slice(0, 3).map((benefit: JsonObject, index: number) => <div key={index}>✓ {benefit.title ?? benefit.description}</div>)}</div>}
                          {rate.payment_type && <div className="mt-2 text-xs font-semibold text-primary">{paymentLabel(rate.payment_type)}</div>}
                          {!!rate.cancellation_timeline?.length && <div className="mt-2 text-xs text-muted-foreground">{cancellationText(rate.cancellation_timeline)}</div>}
                          {!canUseBalance && <div className="mt-2 flex items-center gap-1.5 text-xs text-caution"><CircleAlert className="size-3.5" />Not available with Bridgeway’s current payment method</div>}
                        </div>
                        <div className="text-right"><div className="font-display text-xl font-black">{money(rate.total_amount, rate.total_currency)}</div><div className="mt-1 text-[11px] text-muted-foreground">total · {search.data.nights} nights</div>{Number(rate.due_at_accommodation_amount) > 0 && <div className="mt-1 text-[11px] text-muted-foreground">+ {money(rate.due_at_accommodation_amount, rate.due_at_accommodation_currency)} at property</div>}
                          <button type="button" disabled={!canUseBalance || quote.isPending} onClick={() => quote.mutate(rate)} className="mt-3 rounded-md bg-primary px-4 py-2 font-display text-xs font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50">{quote.isPending && quote.variables?.id === rate.id ? "Checking price…" : "Review rate"}</button>
                        </div>
                      </div>
                    </div>;
                  })}</div> : <p className="rounded-lg bg-card p-4 text-sm text-muted-foreground">No room rates were returned for this property. Try another result or refresh the search.</p>}
                </div>}
              </article>;
            })}
          </div>
        </section>}

        {quote.isError && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-card p-4 text-sm text-destructive">{(quote.error as Error).message}</div>}
        {quoteData && selectedRate && <section id="stay-confirmation" className="mt-8 scroll-mt-24 rounded-xl bg-card p-4 ring-1 ring-line sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
            <div><div className="label-mono">Final quote · {quoteData.expires_at ? `valid until ${new Date(quoteData.expires_at).toLocaleString()}` : "price confirmed"}</div><h2 className="mt-1 font-display text-xl font-bold">Review and confirm your stay</h2><p className="mt-1 text-sm text-muted-foreground">{quoteAccommodation.name ?? "Accommodation"} · {quoteRate?.name ?? selectedRate.name}</p></div>
            <div className="text-right"><div className="label-mono">Total · {quoteData.rooms ?? rooms} {Number(quoteData.rooms ?? rooms) === 1 ? "room" : "rooms"}</div><div className="font-display text-2xl font-black text-primary">{money(quoteData.total_amount, quoteData.total_currency)}</div><div className="mt-1 text-[11px] text-muted-foreground">{prettyDate(quoteData.check_in_date)} – {prettyDate(quoteData.check_out_date)}</div></div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <PriceLine label="Deposit before check-in" amount={quoteData.deposit_amount} currency={quoteData.deposit_currency ?? quoteData.total_currency} fallback="No deposit amount returned" />
            <PriceLine label="Due at accommodation" amount={quoteData.due_at_accommodation_amount} currency={quoteData.due_at_accommodation_currency ?? quoteData.total_currency} fallback="No property charge returned" />
            <div className="rounded-lg bg-background p-4 ring-1 ring-line"><div className="label-mono">Payment timing / meals</div><div className="mt-2 text-sm font-semibold">{paymentLabel(quoteRate?.payment_type)} · {quoteRate?.board_type?.replaceAll("_", " ") ?? "Meal plan not specified"}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{quoteRate?.payment_type === "pay_now" ? "The supplier collects payment when Bridgeway confirms the reservation." : quoteRate?.payment_type === "deposit" ? "The rate requires a deposit before check-in; the supplier collects any remaining amount at the hotel." : quoteRate?.payment_type === "pay_at_accommodation" ? "The supplier collects the room payment at the hotel." : "Follow the payment timing and terms returned with this rate."} A payment card may also be required at check-in.</p></div>
          </div>
          {!!quoteRate?.cancellation_timeline?.length && <div className="mt-4 rounded-lg bg-background p-4 ring-1 ring-line"><div className="label-mono">Cancellation timeline</div>{quoteRate.cancellation_timeline.map((item: JsonObject, index: number) => <p key={index} className="mt-2 text-xs leading-5 text-muted-foreground">{item.before ? `Before ${new Date(item.before).toLocaleString()}: ` : ""}{item.refund_amount != null ? `Refund ${money(item.refund_amount, item.currency ?? quoteData.total_currency)}` : "Cancellation terms apply"}</p>)}</div>}
          {!!quoteRate?.conditions?.length && <div className="mt-4 rounded-lg bg-background p-4 ring-1 ring-line"><div className="label-mono">Rate conditions</div>{quoteRate.conditions.map((condition: JsonObject, index: number) => <p key={index} className="mt-2 text-xs leading-5 text-muted-foreground"><strong>{condition.title}: </strong>{condition.description}</p>)}</div>}
          <div className="mt-4 flex gap-3 rounded-lg border border-caution/40 bg-caution/5 p-4 text-xs leading-5"><CreditCard className="mt-0.5 size-4 shrink-0 text-caution" /><p>Confirming places the reservation using Bridgeway’s Duffel account. For rates that collect payment at booking, Duffel may charge Bridgeway’s Duffel balance. This form does not collect payment from you. Review the amount due now, any deposit and any amount due at the hotel before continuing.</p></div>
          <div className="mt-6 border-t border-line pt-5">
            <div className="mb-3 flex items-center gap-2"><Users className="size-4 text-primary" /><h3 className="font-display text-lg font-bold">Guest details</h3></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {guestNames.slice(0, quoteAdults).map((guest, index) => <div key={index} className="grid gap-3 rounded-lg bg-background p-3 ring-1 ring-line sm:grid-cols-2 sm:col-span-2"><div className="sm:col-span-2 label-mono">{index === 0 ? "Lead guest" : `Guest ${index + 1}`}</div><Field label="First / given name"><input className={inputClass} name={`stay-guest-${index + 1}-given-name`} autoComplete="given-name" value={guest.givenName} onChange={(event) => updateGuest(index, "givenName", event.target.value)} required={index === 0} /></Field><Field label="Last / family name"><input className={inputClass} name={`stay-guest-${index + 1}-family-name`} autoComplete="family-name" value={guest.familyName} onChange={(event) => updateGuest(index, "familyName", event.target.value)} required={index === 0} /></Field></div>)}
              <Field label="Lead guest email"><input className={inputClass} type="email" name="stay-email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
              <Field label="Phone · include country code"><input className={inputClass} type="tel" name="stay-phone" autoComplete="tel" placeholder="+2348012345678" pattern="[+][1-9][0-9]{6,14}" title="Enter an international phone number, such as +2348012345678." value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required /></Field>
              <div className="sm:col-span-2"><Field label="Special requests · optional"><textarea className={inputClass} name="stay-special-requests" maxLength={500} rows={3} value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} placeholder="For example, a late arrival request. Do not include sensitive health information." /></Field></div>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg bg-background p-4 ring-1 ring-line"><input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span className="text-xs leading-5">I have reviewed the final price, rate conditions and cancellation timeline. I authorize Bridgeway to place this reservation with the hotel supplier.</span></label>
            {!config.data?.bookingsEnabled && <p className="mt-3 text-xs text-caution">Live hotel confirmations are currently disabled for this Duffel account.</p>}
            {booking.isError && <div role="alert" className="mt-3 text-sm text-destructive">{(booking.error as Error).message}</div>}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-1 inline size-3.5" />No card details are collected by this form. The supplier’s payment timing and hotel check-in rules still apply.</p><button type="button" disabled={!acceptTerms || !config.data?.bookingsEnabled || booking.isPending} onClick={() => booking.mutate()} className="rounded-md bg-primary px-5 py-3 font-display text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50">{booking.isPending ? "Confirming reservation…" : `Confirm stay · ${money(quoteData.total_amount, quoteData.total_currency)}`}</button></div>
          </div>
        </section>}

        <section id="stay-history" className="mt-12 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="label-mono">Your account</div><h2 className="mt-1 font-display text-2xl font-bold">Hotel reservations</h2></div><span className="text-xs text-muted-foreground">Recent reservations and booking references</span></div>
          {lastBookingReference && <div role="status" className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm"><Check className="mr-2 inline size-4 text-primary" />Reservation confirmed · <strong>{lastBookingReference}</strong></div>}
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
            {bookings.isPending && <div className="p-5 text-sm text-muted-foreground">Loading your hotel reservations…</div>}
            {bookings.error && <div role="alert" className="p-5 text-sm text-destructive">{(bookings.error as Error).message}</div>}
            {!bookings.isPending && !bookings.error && !bookings.data?.length && <div className="p-5 text-sm text-muted-foreground">You do not have hotel reservations yet.</div>}
            {bookings.data?.map((item: JsonObject) => <MyStayBooking key={item.id} booking={item} />)}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function StayPlacePicker({ selected, onSelect }: { selected: StayPlace | null; onSelect: (place: StayPlace | null) => void }) {
  const placesFn = useServerFn(searchStayPlaces);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const places = useQuery({
    queryKey: ["stay-place-suggestions", query],
    enabled: open && !selected && query.trim().length >= 2,
    queryFn: () => placesFn({ data: { query: query.trim() } }),
    staleTime: 60000,
  });
  const results = (places.data ?? []) as StayPlace[];
  const suggestionId = "stay-place-suggestions";

  useEffect(() => {
    if (selected) { setValue(selected.label); setOpen(false); return; }
    const timer = window.setTimeout(() => setQuery(value), 250);
    return () => window.clearTimeout(timer);
  }, [selected, value]);
  useEffect(() => setHighlighted(0), [query, results.length]);

  function choose(place: StayPlace) {
    onSelect(place);
    setValue(place.label);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length) { event.preventDefault(); setHighlighted((current) => (current + 1) % results.length); }
    else if (event.key === "ArrowUp" && results.length) { event.preventDefault(); setHighlighted((current) => (current - 1 + results.length) % results.length); }
    else if (event.key === "Enter" && open && results.length) { event.preventDefault(); choose(results[highlighted] ?? results[0]); }
    else if (event.key === "Escape") setOpen(false);
  }

  return <div className="relative lg:col-span-2">
    <label htmlFor="stay-destination" className="text-xs font-semibold text-muted-foreground">Destination</label>
    <div className="mt-1.5 flex items-center gap-2 rounded-md bg-background px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-primary"><MapPin className="size-4 shrink-0 text-primary" /><input id="stay-destination" name="stay-destination" role="combobox" aria-autocomplete="list" aria-expanded={open && !selected} aria-controls={suggestionId} autoComplete="off" value={value} onFocus={() => setOpen(true)} onChange={(event) => { setValue(event.target.value); onSelect(null); setOpen(true); }} onKeyDown={handleKeyDown} placeholder="Search a city or airport" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" /></div>
    {open && !selected && value.trim().length >= 2 && <div id={suggestionId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-card p-1 shadow-xl">
      {places.isPending ? <div className="p-3 text-xs text-muted-foreground">Searching destinations…</div> : places.error ? <div className="p-3 text-xs text-destructive">Destination suggestions are unavailable.</div> : !results.length ? <div className="p-3 text-xs text-muted-foreground">No destinations found. Try another city or airport.</div> : results.map((place, index) => <button key={place.id} type="button" role="option" aria-selected={index === highlighted} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(place)} className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left ${index === highlighted ? "bg-primary/10" : "hover:bg-background"}`}><span><span className="block text-sm font-semibold">{place.city}{place.countryCode ? ` · ${place.countryCode}` : ""}</span><span className="block text-xs text-muted-foreground">{place.type === "airport" ? `${place.name} airport` : "City"}</span></span><MapPin className="size-4 shrink-0 text-primary" /></button>)}
    </div>}
  </div>;
}

function MyStayBooking({ booking }: { booking: JsonObject }) {
  const [expanded, setExpanded] = useState(false);
  const accommodation = booking.accommodation ?? {};
  const guest = booking.guest_details ?? {};
  const statusLabel = booking.status === "confirmed" ? "Confirmed" : booking.status === "booking_pending" ? "Confirmation pending" : booking.status === "needs_review" ? "Being checked" : booking.status === "failed" ? "Not confirmed" : "Cancelled";
  const statusClass = booking.status === "confirmed" ? "bg-primary/10 text-primary" : booking.status === "needs_review" || booking.status === "booking_pending" ? "bg-caution/15 text-caution" : "bg-muted text-muted-foreground";
  return <article>
    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
      <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary"><BedDouble className="size-5" /></div>
      <div className="min-w-[200px] flex-1"><div className="font-display font-bold">{accommodation.name ?? "Hotel reservation"}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{booking.booking_reference ?? (booking.status === "needs_review" ? "Support is checking this booking" : "Reference pending")}</div></div>
      <span className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase ${statusClass}`}>{statusLabel}</span>
      <div className="text-right"><div className="text-xs text-muted-foreground">{prettyDate(booking.check_in_date)} – {prettyDate(booking.check_out_date)}</div><div className="mt-1 font-mono text-sm font-semibold">{money(booking.total_amount, booking.total_currency)}</div></div>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)} className="rounded-md bg-foreground px-3 py-2 font-display text-xs font-bold text-background hover:bg-primary">{expanded ? "Hide" : "Details"}</button>
    </div>
    {expanded && <div className="grid gap-4 border-t border-line bg-background p-5 sm:grid-cols-2">
      <div className="rounded-lg bg-card p-4 ring-1 ring-line"><div className="label-mono">Stay details</div><div className="mt-2 font-display font-bold">{accommodation.name ?? "Accommodation"}</div><div className="mt-1 text-xs text-muted-foreground">{hotelAddress(accommodation)}</div><div className="mt-3 text-sm">{prettyDate(booking.check_in_date)} to {prettyDate(booking.check_out_date)} · {booking.rooms} {booking.rooms === 1 ? "room" : "rooms"}</div><div className="mt-2 font-mono text-xs text-muted-foreground">Duffel booking ID: {booking.duffel_booking_id ?? "Pending"}</div></div>
      <div className="rounded-lg bg-card p-4 ring-1 ring-line"><div className="label-mono">Lead guest</div><div className="mt-2 font-display font-bold">{guest.guests?.[0]?.givenName ?? ""} {guest.guests?.[0]?.familyName ?? ""}</div><div className="mt-1 break-all text-xs text-muted-foreground">{guest.email}</div><div className="mt-1 text-xs text-muted-foreground">{guest.phoneNumber}</div>{booking.deposit_amount != null && <div className="mt-3 text-xs">Deposit: {money(booking.deposit_amount, booking.deposit_currency ?? booking.total_currency)}</div>}{booking.due_at_accommodation_amount != null && <div className="mt-1 text-xs">Due at hotel: {money(booking.due_at_accommodation_amount, booking.due_at_accommodation_currency ?? booking.total_currency)}</div>}{booking.booking_data?.checkInInformation && <div className="mt-3 text-xs text-muted-foreground">Check-in after {booking.booking_data.checkInInformation.check_in_after_time ?? "hotel opening"}; check-out before {booking.booking_data.checkInInformation.check_out_before_time ?? "hotel policy"}.</div>}{booking.booking_data?.keyCollection?.instructions && <div className="mt-3 rounded-md bg-background p-3 text-xs leading-5">{booking.booking_data.keyCollection.instructions}</div>}</div>
    </div>}
  </article>;
}

function paymentLabel(value?: string | null) {
  if (value === "pay_now") return "Pay at booking";
  if (value === "pay_at_accommodation") return "Pay at accommodation";
  if (value === "deposit") return "Deposit rate";
  return value ? value.replaceAll("_", " ") : "Payment timing not specified";
}

function PriceLine({ label, amount, currency, fallback }: { label: string; amount?: string | null; currency?: string | null; fallback: string }) {
  return <div className="rounded-lg bg-background p-4 ring-1 ring-line"><div className="label-mono">{label}</div><div className="mt-2 font-display text-lg font-bold">{amount != null ? money(amount, currency) : fallback}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-xs font-semibold text-muted-foreground">{label}{children}</label>;
}
