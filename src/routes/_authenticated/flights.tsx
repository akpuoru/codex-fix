import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Armchair, ArrowLeftRight, CircleAlert, Clock3, Plane, Search, Ticket } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createFlightHold, getFlightSeatMaps, listMyFlightBookings, searchFlightOffers } from "@/lib/flights.functions";

export const Route = createFileRoute("/_authenticated/flights")({
  head: () => ({
    meta: [
      { title: "Flight reservations · Bridgeway" },
      { name: "description", content: "Search flights and create verifiable airline reservations on eligible unpaid holds." },
    ],
  }),
  component: FlightsPage,
});

type Passenger = {
  title: "mr" | "mrs" | "ms" | "miss" | "dr";
  givenName: string;
  familyName: string;
  gender: "m" | "f";
  bornOn: string;
  email: string;
  phoneNumber: string;
};

type SeatChoice = {
  serviceId: string;
  designator: string;
  segmentId: string;
  passengerId?: string;
  amount?: string;
  currency?: string;
};

const emptyPassenger = (): Passenger => ({
  title: "mr", givenName: "", familyName: "", gender: "m", bornOn: "", email: "", phoneNumber: "",
});

function FlightsPage() {
  const searchFn = useServerFn(searchFlightOffers);
  const seatMapsFn = useServerFn(getFlightSeatMaps);
  const createHoldFn = useServerFn(createFlightHold);
  const listBookingsFn = useServerFn(listMyFlightBookings);
  const bookings = useQuery({ queryKey: ["my-flight-bookings"], queryFn: () => listBookingsFn() });

  const [journey, setJourney] = useState<"one-way" | "return">("return");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState("economy");
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [seatMaps, setSeatMaps] = useState<any[]>([]);
  const [seatSelections, setSeatSelections] = useState<Record<string, string>>({});
  const [passengers, setPassengers] = useState<Passenger[]>([emptyPassenger()]);

  const search = useMutation({
    mutationFn: () => searchFn({ data: {
      origin, destination, departureDate, returnDate: journey === "return" ? returnDate : "", adults, cabin: cabin as "economy" | "premium_economy" | "business" | "first",
    } }),
    onSuccess: (result) => {
      setSelectedOffer(null);
      setSeatMaps([]);
      setSeatSelections({});
      setPassengers(Array.from({ length: adults }, emptyPassenger));
      if (!result.offers.length) toast.message("No unpaid hold fares were found. Try different dates or airports.");
    },
    onError: (error) => toast.error((error as Error).message || "Flight search failed."),
  });

  const seatQuery = useMutation({
    mutationFn: (offerId: string) => seatMapsFn({ data: { offerId } }),
    onSuccess: (result) => setSeatMaps(Array.isArray(result) ? result : []),
    onError: (error) => {
      setSeatMaps([]);
      toast.error((error as Error).message || "Seat maps could not be loaded.");
    },
  });

  const createHold = useMutation({
    mutationFn: () => {
      if (!selectedOffer) throw new Error("Choose a flight first.");
      const seats = Object.entries(seatSelections).map(([key, serviceId]) => ({
        serviceId,
        passengerIndex: Number(key.split(":").at(-1)),
      }));
      return createHoldFn({ data: { offerId: selectedOffer.id, passengers, seats } });
    },
    onSuccess: (booking) => {
      if (booking.bookingReference) toast.success("Your airline reservation was created.");
      else toast.message("The airline response needs verification before we can show a PNR.");
      window.location.assign(`/flight-bookings/${booking.id}`);
    },
    onError: (error) => toast.error((error as Error).message || "The airline could not create this reservation."),
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    search.mutate();
  }

  function chooseOffer(offer: any) {
    setSelectedOffer(offer);
    setSeatMaps([]);
    setSeatSelections({});
    seatQuery.mutate(offer.id);
  }

  function updatePassenger(index: number, key: keyof Passenger, value: string) {
    setPassengers((current) => current.map((passenger, i) => i === index ? { ...passenger, [key]: value } as Passenger : passenger));
  }

  const offers: any[] = search.data?.offers ?? [];
  const segments = selectedOffer ? allSegments(selectedOffer) : [];
  const holdDeadline = selectedOffer?.payment_requirements?.payment_required_by;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-3xl">
          <div className="font-mono text-[11px] tracking-[0.2em] text-primary">BRIDGEWAY FLIGHTS</div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Reserve a flight. Pay later.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Search airline offers that support an unpaid hold. The airline issues a real booking reference; payment is due by the deadline shown on your reservation.
          </p>
        </div>

        <form onSubmit={submitSearch} className="rounded-xl bg-card p-4 ring-1 ring-line sm:p-6">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {(["return", "one-way"] as const).map((type) => (
              <button type="button" key={type} onClick={() => setJourney(type)} className={`rounded-md px-4 py-2 font-mono text-xs uppercase ring-1 ring-line ${journey === type ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                {type === "return" ? "Round trip" : "One way"}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><Ticket className="size-4" /> Adult passengers only</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="From · airport code">
              <input className={inputClass} name="origin" autoComplete="off" maxLength={3} value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} placeholder="LOS" required />
            </Field>
            <Field label="To · airport code">
              <input className={inputClass} name="destination" autoComplete="off" maxLength={3} value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase())} placeholder="LHR" required />
            </Field>
            <Field label="Departure">
              <input className={inputClass} type="date" name="departure" min={new Date().toISOString().slice(0, 10)} value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} required />
            </Field>
            {journey === "return" && <Field label="Return">
              <input className={inputClass} type="date" name="return" min={departureDate || new Date().toISOString().slice(0, 10)} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required />
            </Field>}
            <Field label="Adults · 1–9">
              <input className={inputClass} type="number" name="adults" min={1} max={9} value={adults} onChange={(e) => setAdults(Math.max(1, Math.min(9, Number(e.target.value) || 1)))} required />
            </Field>
            <Field label="Cabin">
              <select className={inputClass} name="cabin" value={cabin} onChange={(e) => setCabin(e.target.value)}>
                <option value="economy">Economy</option><option value="premium_economy">Premium economy</option><option value="business">Business</option><option value="first">First</option>
              </select>
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="flex max-w-2xl items-start gap-2 text-xs leading-5 text-muted-foreground"><CircleAlert className="mt-0.5 size-4 shrink-0 text-caution" />Only fares that the airline can hold without immediate payment are shown. Seats and payment deadlines depend on the airline.</p>
            <button type="submit" disabled={search.isPending} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-display text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60">
              <Search className="size-4" />{search.isPending ? "Searching…" : "Search flights"}
            </button>
          </div>
        </form>

        {search.isError && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-card p-4 text-sm text-destructive">{(search.error as Error).message}</div>}

        {search.data && (
          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><div className="label-mono">Unpaid hold fares</div><h2 className="mt-1 font-display text-xl font-bold">{offers.length ? `${offers.length} flights available` : "No hold fares available"}</h2></div>
              <div className="font-mono text-xs text-muted-foreground">{search.data.searched.origin} <ArrowLeftRight className="mx-1 inline size-3" /> {search.data.searched.destination}</div>
            </div>
            {offers.length > 0 && <div className="grid gap-3">
              {offers.map((offer) => <OfferCard key={offer.id} offer={offer} active={selectedOffer?.id === offer.id} onSelect={() => chooseOffer(offer)} />)}
            </div>}
          </section>
        )}

        {selectedOffer && (
          <section className="mt-8 rounded-xl bg-card p-4 ring-1 ring-line sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div><div className="label-mono">Selected flight · unpaid hold</div><h2 className="mt-1 font-display text-xl font-bold">Traveler details and seats</h2></div>
              <div className="text-right"><div className="label-mono">Flight fare</div><div className="font-display text-2xl font-black text-primary">{money(selectedOffer.total_amount, selectedOffer.total_currency)}</div></div>
            </div>

            <div className="mt-4 rounded-lg border border-caution/40 bg-background p-3 text-sm leading-6">
              <div className="flex items-center gap-2 font-semibold"><Clock3 className="size-4 text-caution" />No payment is collected now</div>
              <p className="mt-1 text-muted-foreground">The reservation will be held until {formatDateTime(holdDeadline)}. If it is not paid by then, the airline releases the seats and the booking reference will no longer be active.</p>
            </div>

            <div className="mt-6 space-y-5">
              {passengers.map((passenger, index) => (
                <fieldset key={index} className="rounded-lg bg-background p-4 ring-1 ring-line">
                  <legend className="px-2 font-display text-sm font-bold">Passenger {index + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Title"><select className={inputClass} value={passenger.title} onChange={(e) => updatePassenger(index, "title", e.target.value)}><option value="mr">Mr</option><option value="mrs">Mrs</option><option value="ms">Ms</option><option value="miss">Miss</option><option value="dr">Dr</option></select></Field>
                    <Field label="First / given name"><input className={inputClass} name={`given-name-${index}`} autoComplete="given-name" value={passenger.givenName} onChange={(e) => updatePassenger(index, "givenName", e.target.value)} required /></Field>
                    <Field label="Last / family name"><input className={inputClass} name={`family-name-${index}`} autoComplete="family-name" value={passenger.familyName} onChange={(e) => updatePassenger(index, "familyName", e.target.value)} required /></Field>
                    <Field label="Gender"><select className={inputClass} value={passenger.gender} onChange={(e) => updatePassenger(index, "gender", e.target.value)}><option value="m">Male</option><option value="f">Female</option></select></Field>
                    <Field label="Date of birth"><input className={inputClass} type="date" name={`birth-${index}`} autoComplete="bday" value={passenger.bornOn} onChange={(e) => updatePassenger(index, "bornOn", e.target.value)} required /></Field>
                    <Field label="Email"><input className={inputClass} type="email" name={`email-${index}`} autoComplete="email" value={passenger.email} onChange={(e) => updatePassenger(index, "email", e.target.value)} required /></Field>
                    <Field label="Phone"><input className={inputClass} type="tel" name={`phone-${index}`} autoComplete="tel" value={passenger.phoneNumber} onChange={(e) => updatePassenger(index, "phoneNumber", e.target.value)} required /></Field>
                  </div>
                </fieldset>
              ))}
            </div>

            <div className="mt-7">
              <div className="flex items-center gap-2"><Armchair className="size-4 text-primary" /><h3 className="font-display text-lg font-bold">Choose seats</h3></div>
              {seatQuery.isPending ? <p className="mt-3 text-sm text-muted-foreground">Loading the airline seat maps…</p> : null}
              {!seatQuery.isPending && segments.length > 0 && seatMaps.length === 0 && <p className="mt-3 rounded-lg bg-background p-3 text-sm text-muted-foreground ring-1 ring-line">This flight does not provide advance seat selection through the reservation service. The airline may assign a seat at check-in.</p>}
              {segments.map((segment: any) => {
                const map = seatMaps.find((item) => item.segment_id === segment.id);
                return <div key={segment.id} className="mt-4 rounded-lg bg-background p-4 ring-1 ring-line">
                  <div className="mb-3 font-display text-sm font-bold">{segment.origin?.iata_code} → {segment.destination?.iata_code} <span className="ml-2 font-mono text-[10px] font-normal text-muted-foreground">{segment.marketing_carrier?.name ?? segment.operating_carrier?.name} {segment.marketing_carrier_flight_number ?? ""}</span></div>
                  {!map ? <p className="text-xs text-muted-foreground">Seat selection is not available for this flight segment.</p> : passengers.map((passenger, passengerIndex) => {
                    const offerPassengerId = selectedOffer.passengers?.[passengerIndex]?.id;
                    const choices = seatOptionsFor(seatMaps, offerPassengerId).filter((choice) => choice.segmentId === segment.id);
                    const key = `${segment.id}:${passengerIndex}`;
                    return <Field key={key} label={`Passenger ${passengerIndex + 1} · seat`}>
                      <select className={inputClass} value={seatSelections[key] ?? ""} onChange={(e) => setSeatSelections((old) => ({ ...old, [key]: e.target.value }))}>
                        <option value="">No seat selected</option>
                        {choices.map((choice) => <option key={choice.serviceId} value={choice.serviceId}>{choice.designator} · {choice.amount === "0.00" || choice.amount === "0" ? "Free" : money(choice.amount, choice.currency)}</option>)}
                      </select>
                      {!choices.length && <span className="mt-1 block text-xs text-muted-foreground">No selectable seats returned for this passenger.</span>}
                    </Field>;
                  })}
                </div>;
              })}
              {selectedOffer.slices?.some((slice: any) => (slice.segments ?? []).some((segment: any) => !seatMaps.some((map) => map.segment_id === segment.id))) && seatMaps.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Seat selection is available only on some segments. Any unselected seats remain subject to airline check-in rules.</p>}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-xs leading-5 text-muted-foreground">By continuing, you ask Bridgeway to place an unpaid hold with the airline. Your itinerary will show the airline's booking reference and the payment deadline. Paid seat selections are included in the amount due later.</p>
              <button type="button" onClick={() => createHold.mutate()} disabled={createHold.isPending || seatQuery.isPending} className="rounded-md bg-primary px-6 py-3 font-display text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60">
                {createHold.isPending ? "Requesting airline hold…" : "Create verifiable reservation →"}
              </button>
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="mb-4 flex items-end justify-between gap-4"><div><div className="label-mono">Account</div><h2 className="mt-1 font-display text-xl font-bold">My flight reservations</h2></div><a href="/dashboard" className="font-mono text-xs text-primary hover:underline">SHIPMENT DASHBOARD →</a></div>
          <div className="divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
            {bookings.isPending && <div className="p-5 text-sm text-muted-foreground">Loading reservations…</div>}
            {bookings.error && <div className="p-5 text-sm text-destructive">{(bookings.error as Error).message}</div>}
            {!bookings.isPending && !bookings.error && !bookings.data?.length && <div className="p-5 text-sm text-muted-foreground">No flight reservations yet.</div>}
            {bookings.data?.map((booking: any) => {
              const first = booking.itinerary?.[0]?.segments?.[0];
              const last = booking.itinerary?.at(-1)?.segments?.at(-1);
              return <a key={booking.id} href={`/flight-bookings/${booking.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-background">
                <Ticket className="size-4 text-primary" />
                <span className="font-display text-sm font-bold">{first?.origin?.code ?? "Flight"} → {last?.destination?.code ?? ""}</span>
                <span className="font-mono text-xs text-muted-foreground">{booking.booking_reference ?? "Reference pending"}</span>
                <span className={`ml-auto rounded px-2 py-1 font-mono text-[10px] uppercase ${booking.status === "expired" ? "bg-destructive/10 text-destructive" : "bg-caution/15 text-caution"}`}>{booking.status === "expired" ? "Expired" : booking.status === "held" ? "Held · unpaid" : booking.status === "needs_review" ? "Needs review" : booking.status}</span>
              </a>;
            })}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function OfferCard({ offer, active, onSelect }: { offer: any; active: boolean; onSelect: () => void }) {
  const segments = allSegments(offer);
  return <button type="button" onClick={onSelect} className={`w-full rounded-xl bg-card p-4 text-left ring-1 transition-colors sm:p-5 ${active ? "ring-2 ring-primary" : "ring-line hover:ring-primary"}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="font-display text-lg font-bold">{offer.owner?.name ?? segments[0]?.marketing_carrier?.name ?? "Airline"}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-success">Pay later hold available</div></div>
      <div className="text-right"><div className="font-display text-2xl font-black text-primary">{money(offer.total_amount, offer.total_currency)}</div><div className="font-mono text-[10px] text-muted-foreground">fare total · payment due later</div></div>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {offer.slices?.map((slice: any, sliceIndex: number) => {
        const first = slice.segments?.[0]; const last = slice.segments?.at(-1);
        return <div key={sliceIndex} className="flex items-center gap-3 rounded-lg bg-background p-3">
          <Plane className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1"><div className="font-display text-sm font-bold">{first?.origin?.iata_code} <span className="text-muted-foreground">→</span> {last?.destination?.iata_code}</div><div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{slice.segments?.map((s: any) => `${s.marketing_carrier?.name ?? s.operating_carrier?.name ?? "Airline"} ${s.marketing_carrier_flight_number ?? ""}`).join(" · ")} · {slice.segments?.length ? `${slice.segments.length - 1} stop${slice.segments.length === 2 ? "" : "s"}` : ""}</div></div>
          <div className="text-right font-mono text-xs">{formatClock(first?.departing_at)}<div className="mt-1 text-[10px] text-muted-foreground">{formatClock(last?.arriving_at)}</div></div>
        </div>;
      })}
    </div>
    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Payment deadline: {formatDateTime(offer.payment_requirements?.payment_required_by)} <span className="ml-auto font-mono uppercase">{offer.cabin_class?.replaceAll("_", " ") ?? "Selected cabin"}</span></div>
  </button>;
}

function allSegments(offer: any): any[] {
  return (offer?.slices ?? []).flatMap((slice: any) => slice.segments ?? []);
}

function seatOptionsFor(seatMaps: any[], passengerId?: string): SeatChoice[] {
  const options: SeatChoice[] = [];
  for (const map of seatMaps ?? []) {
    for (const cabin of map.cabins ?? []) for (const row of cabin.rows ?? []) for (const section of row.sections ?? []) for (const element of section.elements ?? []) {
      if (element.type !== "seat" || !element.designator) continue;
      for (const service of element.available_services ?? []) {
        const servicePassenger = service.passenger_id ?? service.passenger?.id;
        if (servicePassenger && passengerId && servicePassenger !== passengerId) continue;
        options.push({ serviceId: service.id, designator: element.designator, segmentId: map.segment_id, passengerId: servicePassenger, amount: service.total_amount, currency: service.total_currency });
      }
    }
  }
  return options;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-muted-foreground">{label}{children}</label>;
}

const inputClass = "mt-1 w-full rounded-md bg-background px-3 py-2.5 font-mono text-sm text-foreground ring-1 ring-line focus:ring-2 focus:ring-primary focus:outline-none";

function money(amount?: string | number | null, currency?: string | null) {
  if (amount == null || !currency) return "Price unavailable";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount)); }
  catch { return `${amount} ${currency}`; }
}

function formatClock(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "the airline's deadline";
}
