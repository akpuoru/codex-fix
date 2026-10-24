import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, BadgeCheck, CarFront, Check, CircleAlert, Clock3, Luggage, MapPin, Search, ShieldCheck, Users } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useSession } from "@/hooks/use-session";
import { createCarBooking, createCarQuote, listMyCarBookings, searchCarPlaces, searchCarRates } from "@/lib/cars.functions";

export const Route = createFileRoute("/_authenticated/cars/book")({
  head: () => ({
    meta: [
      { title: "Search car hire · Bridgeway" },
      { name: "description", content: "Compare rental cars and reserve eligible pay-at-counter rates with Bridgeway." },
    ],
  }),
  component: CarHirePage,
});

type CarAirport = {
  id: string;
  code: string;
  name: string;
  city: string;
  countryCode: string;
  latitude: number;
  longitude: number;
};

type CarDriver = {
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  email: string;
  phoneNumber: string;
};

const inputClass = "mt-1.5 w-full rounded-md bg-background px-3 py-3 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-primary";
const textInputClass = "w-full rounded-md bg-background px-3 py-3 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-primary";

function CarHirePage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const searchFn = useServerFn(searchCarRates);
  const quoteFn = useServerFn(createCarQuote);
  const bookFn = useServerFn(createCarBooking);
  const listFn = useServerFn(listMyCarBookings);
  const bookings = useQuery({ queryKey: ["my-car-bookings"], queryFn: () => listFn(), refetchInterval: 60000 });

  const [pickup, setPickup] = useState<CarAirport | null>(null);
  const [dropoff, setDropoff] = useState<CarAirport | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("10:00");
  const [dropoffDate, setDropoffDate] = useState("");
  const [dropoffTime, setDropoffTime] = useState("10:00");
  const [driverAge, setDriverAge] = useState("");
  const [residenceCountryCode, setResidenceCountryCode] = useState("");
  const [driver, setDriver] = useState<CarDriver>({ givenName: "", familyName: "", dateOfBirth: "", email: user?.email ?? "", phoneNumber: "" });
  const [inboundFlightNumber, setInboundFlightNumber] = useState("");
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [acceptedPolicies, setAcceptedPolicies] = useState<string[]>([]);
  const [acceptedConditions, setAcceptedConditions] = useState(false);
  const [acceptRentalTerms, setAcceptRentalTerms] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState<{ reference: string | null; status: string } | null>(null);

  useEffect(() => {
    if (user?.email && !driver.email) setDriver((current) => ({ ...current, email: user.email ?? "" }));
  }, [driver.email, user?.email]);

  const quote = useMutation({
    mutationFn: (rateId: string) => quoteFn({ data: { rateId } }),
    onSuccess: (_result, rateId) => {
      setSelectedRateId(rateId);
      setAcceptedPolicies([]);
      setAcceptedConditions(false);
      setAcceptRentalTerms(false);
      setBookingConfirmation(null);
    },
    onError: (error) => toast.error((error as Error).message || "The final rental quote could not be loaded."),
  });

  const search = useMutation({
    mutationFn: () => {
      if (!pickup || !dropoff) throw new Error("Choose both pickup and drop-off airports from the suggestions.");
      return searchFn({ data: {
        pickup: { code: pickup.code, latitude: pickup.latitude, longitude: pickup.longitude },
        dropoff: { code: dropoff.code, latitude: dropoff.latitude, longitude: dropoff.longitude },
        pickupDate,
        pickupTime,
        dropoffDate,
        dropoffTime,
        driverAge: Number(driverAge),
        residenceCountryCode,
      } });
    },
    onSuccess: (result) => {
      setSelectedRateId(null);
      quote.reset();
      setAcceptedPolicies([]);
      setAcceptedConditions(false);
      setAcceptRentalTerms(false);
      setBookingConfirmation(null);
      if (!result.rates.length && result.paymentTypeCounts.total === 0) {
        toast.message("No rental rates were returned. Try another airport, date or pickup time.");
      } else if (!result.rates.length) {
        toast.message("Rental options were returned, but none can be reserved without a card guarantee or online prepayment.");
      }
    },
    onError: (error) => toast.error((error as Error).message || "Car search failed."),
  });

  const booking = useMutation({
    mutationFn: () => {
      const currentQuote = quote.data as any;
      if (!selectedRateId || !currentQuote?.id) throw new Error("Select a car and load its final quote first.");
      if (!acceptRentalTerms) throw new Error("Confirm that you accept the postpaid rental terms before booking.");
      if (!driver.givenName.trim() || !driver.familyName.trim() || !driver.email.trim() || !driver.phoneNumber.trim() || !driver.dateOfBirth) {
        throw new Error("Complete the main driver’s name, date of birth, email and phone number.");
      }
      const policies = currentQuote.privacy_policies ?? [];
      const conditions = currentQuote.conditions ?? [];
      return bookFn({ data: {
        rateId: selectedRateId,
        expectedDriverAge: search.data?.search.driverAge ?? Number(driverAge),
        quotedAmount: String(currentQuote.total_amount),
        quotedCurrency: String(currentQuote.total_currency),
        acceptedPolicyKeys: policies.filter((item: any) => acceptedPolicies.includes(disclosureKey(item))).map(disclosureKey),
        acceptedConditionKeys: acceptedConditions ? conditions.map(disclosureKey) : [],
        acceptRentalTerms: true,
        driver,
        inboundFlightNumber,
      } });
    },
    onSuccess: (result) => {
      setBookingConfirmation({ reference: result.bookingReference, status: result.status });
      if (result.status === "confirmed") {
        toast.success(result.bookingReference ? `Car reservation confirmed · ${result.bookingReference}` : "Car reservation confirmed.");
      } else {
        toast.message("The supplier response needs review. Check the reservation details or contact Bridgeway support before making another booking.");
      }
      queryClient.invalidateQueries({ queryKey: ["my-car-bookings"] });
    },
    onError: (error) => toast.error((error as Error).message || "The supplier could not confirm this car reservation."),
  });

  const rates: any[] = search.data?.rates ?? [];
  const selectedRate = rates.find((rate) => rate.id === selectedRateId);
  const quoteData: any = quote.data;
  const today = new Date().toISOString().slice(0, 10);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pickup || !dropoff) {
      toast.error("Choose both airports from the suggestions before searching.");
      return;
    }
    search.mutate();
  }

  function updateDriver(key: keyof CarDriver, value: string) {
    setDriver((current) => ({ ...current, [key]: value }));
  }

  function togglePolicy(key: string) {
    setAcceptedPolicies((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-3xl">
          <div className="font-mono text-[11px] tracking-[0.2em] text-primary">BRIDGEWAY CAR HIRE</div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Find a car for the road ahead.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Compare eligible rentals and reserve postpaid rates. Payment is collected by the rental supplier at pickup, under that supplier’s terms.
          </p>
        </div>

        <form onSubmit={submitSearch} className="rounded-xl bg-card p-4 ring-1 ring-line sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <CarAirportPicker id="car-pickup" label="Pick-up airport" selected={pickup} onSelect={setPickup} />
            <CarAirportPicker id="car-dropoff" label="Drop-off airport" selected={dropoff} onSelect={setDropoff} />
            <Field label="Pick-up date"><input className={inputClass} type="date" name="pickup-date" min={today} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} required /></Field>
            <Field label="Pick-up time"><input className={inputClass} type="time" name="pickup-time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} required /></Field>
            <Field label="Drop-off date"><input className={inputClass} type="date" name="dropoff-date" min={pickupDate || today} value={dropoffDate} onChange={(e) => setDropoffDate(e.target.value)} required /></Field>
            <Field label="Drop-off time"><input className={inputClass} type="time" name="dropoff-time" value={dropoffTime} onChange={(e) => setDropoffTime(e.target.value)} required /></Field>
            <Field label="Main driver age at pick-up"><input className={inputClass} type="number" name="driver-age" min={18} max={99} step={1} inputMode="numeric" placeholder="e.g. 30" value={driverAge} onChange={(e) => setDriverAge(e.target.value)} required /></Field>
            <Field label="Driver residence · 2-letter country code"><input className={inputClass} name="driver-country" autoComplete="country" placeholder="e.g. NG" maxLength={2} pattern="[A-Za-z]{2}" value={residenceCountryCode} onChange={(e) => setResidenceCountryCode(e.target.value.toUpperCase())} required /></Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="flex max-w-2xl items-start gap-2 text-xs leading-5 text-muted-foreground"><CircleAlert className="mt-0.5 size-4 shrink-0 text-caution" />We show postpaid cars that need no card to reserve. Suppliers may also offer pay-at-counter cars that require a card guarantee.</p>
            <button type="submit" disabled={search.isPending} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 font-display text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60">
              <Search className="size-4" />{search.isPending ? "Searching…" : "Search cars"}
            </button>
          </div>
        </form>

        {search.isError && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-card p-4 text-sm text-destructive">{(search.error as Error).message}</div>}

        {search.data && (
          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div><div className="label-mono">Pay at pickup</div><h2 className="mt-1 font-display text-xl font-bold">{rates.length ? `${rates.length} no-card cars available` : "No no-card cars found"}</h2></div>
              <div className="font-mono text-xs text-muted-foreground">{search.data.search.pickup.code} <ArrowLeftRight className="mx-1 inline size-3" /> {search.data.search.dropoff.code}</div>
            </div>
            {!rates.length && <p className="mb-4 max-w-3xl text-sm leading-6 text-muted-foreground">
              {search.data.paymentTypeCounts.total === 0
                ? "Duffel returned no available cars for these dates and locations. Try a different airport, date or pickup time."
                : `Duffel returned ${search.data.paymentTypeCounts.total} car rate(s), but none can be reserved without a card or online payment. ${search.data.paymentTypeCounts.guarantee} require a card guarantee (payment is collected at pickup); ${search.data.paymentTypeCounts.prepaid} require prepayment.`}
            </p>}
            {rates.length > 0 && <div className="grid gap-3">{rates.map((rate) => (
              <CarRateCard key={rate.id} rate={rate} active={selectedRateId === rate.id} loading={quote.isPending && quote.variables === rate.id} onSelect={() => quote.mutate(rate.id)} />
            ))}</div>}
          </section>
        )}

        {quote.isError && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-card p-4 text-sm text-destructive">{(quote.error as Error).message}</div>}

        {quoteData && selectedRate && (
          <section className="mt-8 rounded-xl bg-card p-4 ring-1 ring-line sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div><div className="label-mono">Final supplier quote · pay at pickup</div><h2 className="mt-1 font-display text-xl font-bold">Confirm your rental</h2><p className="mt-1 text-sm text-muted-foreground">{quoteData.supplier?.name ?? selectedRate.supplier?.name} · {quoteData.car?.name ?? selectedRate.car?.name}</p></div>
              <div className="text-right"><div className="label-mono">Rental total</div><div className="font-display text-2xl font-black text-primary">{money(quoteData.total_amount, quoteData.total_currency)}</div></div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-background p-4 ring-1 ring-line">
                <div className="label-mono">Pick-up</div>
                <div className="mt-2 font-display text-sm font-bold">{locationName(quoteData.pickup_location)}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{formatDateTime(quoteData.pickup_date, quoteData.pickup_time)}</div>
                {quoteData.pickup_location?.phone_number && <a className="mt-2 inline-block text-xs text-primary hover:underline" href={`tel:${quoteData.pickup_location.phone_number}`}>{quoteData.pickup_location.phone_number}</a>}
                {quoteData.pickup_location?.additional_information?.map((item: any, index: number) => <p key={index} className="mt-2 text-xs leading-5 text-muted-foreground"><strong>{item.title}: </strong>{item.text}</p>)}
              </div>
              <div className="rounded-lg bg-background p-4 ring-1 ring-line">
                <div className="label-mono">Drop-off</div>
                <div className="mt-2 font-display text-sm font-bold">{locationName(quoteData.dropoff_location)}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{formatDateTime(quoteData.dropoff_date, quoteData.dropoff_time)}</div>
                {quoteData.dropoff_location?.phone_number && <a className="mt-2 inline-block text-xs text-primary hover:underline" href={`tel:${quoteData.dropoff_location.phone_number}`}>{quoteData.dropoff_location.phone_number}</a>}
                {quoteData.dropoff_location?.additional_information?.map((item: any, index: number) => <p key={index} className="mt-2 text-xs leading-5 text-muted-foreground"><strong>{item.title}: </strong>{item.text}</p>)}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-lg bg-background p-4 ring-1 ring-line">
                <div className="label-mono">Vehicle</div>
                <div className="mt-2 font-display text-lg font-bold">{quoteData.car?.name ?? selectedRate.car?.name ?? "Rental car"}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {quoteData.car?.max_passengers && <Feature icon={<Users className="size-3.5" />}>{quoteData.car.max_passengers} passengers</Feature>}
                  {quoteData.car?.baggage && <Feature icon={<Luggage className="size-3.5" />}>{quoteData.car.baggage.small ?? 0} small · {quoteData.car.baggage.large ?? 0} large bags</Feature>}
                  {quoteData.car?.transmission && <Feature>{humanize(quoteData.car.transmission)}</Feature>}
                  {quoteData.car?.fuel && <Feature>{humanize(quoteData.car.fuel)}</Feature>}
                  {quoteData.mileage?.type && <Feature>{humanize(quoteData.mileage.type)} mileage</Feature>}
                  {quoteData.car?.air_conditioning && <Feature>Air conditioning</Feature>}
                </div>
                {!!quoteData.charges?.length && <div className="mt-4 border-t border-line pt-3"><div className="label-mono">Included / additional charges</div>{quoteData.charges.map((charge: any, index: number) => <div key={index} className="mt-2 flex justify-between gap-3 text-xs"><span>{charge.description}</span><span className="font-mono">{charge.amount ? money(charge.amount, charge.currency) : "Included"}</span></div>)}</div>}
              </div>
              <div className="rounded-lg bg-background p-4 ring-1 ring-line">
                <div className="label-mono">Rental conditions</div>
                {quoteData.conditions?.length ? <ul className="mt-2 space-y-2">{quoteData.conditions.map((condition: any, index: number) => <li key={index} className="flex gap-2 text-xs leading-5"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" /><span><strong>{condition.title}: </strong>{condition.text}</span></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No additional conditions were returned with this quote.</p>}
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-caution/40 bg-background p-4 text-sm leading-6">
              <div className="flex items-center gap-2 font-semibold"><Clock3 className="size-4 text-caution" />No online rental payment</div>
              <p className="mt-1 text-xs text-muted-foreground">This is a postpaid rental. The supplier collects payment at pickup. Any deposit, licence or eligible card requirements are set by the supplier and shown in its terms.</p>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-3 flex items-center gap-2"><CarFront className="size-4 text-primary" /><h3 className="font-display text-lg font-bold">Main driver</h3></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="First / given name"><input className={textInputClass} name="driver-given-name" autoComplete="given-name" value={driver.givenName} onChange={(e) => updateDriver("givenName", e.target.value)} required /></Field>
                <Field label="Last / family name"><input className={textInputClass} name="driver-family-name" autoComplete="family-name" value={driver.familyName} onChange={(e) => updateDriver("familyName", e.target.value)} required /></Field>
                <Field label="Email"><input className={textInputClass} type="email" name="driver-email" autoComplete="email" value={driver.email} onChange={(e) => updateDriver("email", e.target.value)} required /></Field>
                <Field label="Phone · include country code"><input className={textInputClass} type="tel" name="driver-phone" autoComplete="tel" placeholder="+2348012345678" pattern="[+][1-9][0-9]{6,14}" title="Enter an international phone number, such as +2348012345678." value={driver.phoneNumber} onChange={(e) => updateDriver("phoneNumber", e.target.value)} required /></Field>
                <Field label="Date of birth"><input className={textInputClass} type="date" name="driver-date-of-birth" max={quoteData.pickup_date || today} value={driver.dateOfBirth} onChange={(e) => updateDriver("dateOfBirth", e.target.value)} required /></Field>
                <Field label="Inbound flight number · optional"><input className={textInputClass} name="inbound-flight-number" placeholder="e.g. BA 75" maxLength={30} value={inboundFlightNumber} onChange={(e) => setInboundFlightNumber(e.target.value)} /></Field>
                <div className="flex items-end text-xs text-muted-foreground">Search age {search.data.search.driverAge} · residence {residenceCountryCode}</div>
              </div>
            </div>

            {!!quoteData.privacy_policies?.length && (
              <div className="mt-6 border-t border-line pt-5">
                <div className="label-mono">Supplier data policies · review each disclosure</div>
                <div className="mt-3 space-y-3">
                  {quoteData.privacy_policies.map((policy: any, index: number) => {
                    const key = disclosureKey(policy);
                    return (
                      <label key={`${key}-${index}`} className="flex cursor-pointer items-start gap-3 rounded-lg bg-background p-3 ring-1 ring-line">
                        <input type="checkbox" checked={acceptedPolicies.includes(key)} onChange={() => togglePolicy(key)} className="mt-1 accent-primary" />
                        <span className="text-xs leading-5"><strong>{policy.title}</strong><br />{policy.text}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 space-y-3 border-t border-line pt-5">
              {!!quoteData.conditions?.length && (
                <label className="flex cursor-pointer items-start gap-3 text-xs leading-5">
                  <input type="checkbox" checked={acceptedConditions} onChange={(e) => setAcceptedConditions(e.target.checked)} className="mt-1 accent-primary" />
                  <span>I have reviewed the rental conditions listed above, including the supplier’s cancellation, fuel, mileage and deposit terms where provided.</span>
                </label>
              )}
              <label className="flex cursor-pointer items-start gap-3 text-xs leading-5">
                <input type="checkbox" checked={acceptRentalTerms} onChange={(e) => setAcceptRentalTerms(e.target.checked)} className="mt-1 accent-primary" />
                <span>I confirm the driver details are accurate and ask Bridgeway to place this postpaid rental booking. I understand payment is due to the supplier at pickup.</span>
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-xs leading-5 text-muted-foreground">The quote is checked again before reservation. If its price or terms change, you’ll be asked to review the new quote. Do not retry if the supplier result is uncertain; contact support so we can check it.</p>
              <button type="button" onClick={() => booking.mutate()} disabled={booking.isPending || !!bookingConfirmation || !acceptRentalTerms || (!!quoteData.conditions?.length && !acceptedConditions) || (quoteData.privacy_policies ?? []).some((policy: any) => !acceptedPolicies.includes(disclosureKey(policy)))} className="shrink-0 rounded-md bg-primary px-6 py-3 font-display text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60">
                {booking.isPending ? "Confirming with supplier…" : bookingConfirmation ? "Reservation confirmed" : "Confirm car reservation →"}
              </button>
            </div>
          </section>
        )}

        {bookingConfirmation && (
            <div role="status" className="mt-6 flex items-start gap-3 rounded-xl border border-primary/30 bg-card p-5">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div><div className="font-display font-bold">{bookingConfirmation.status === "confirmed" ? "Car reservation confirmed" : bookingConfirmation.status === "cancelled" ? "Supplier returned a cancelled reservation" : "Reservation needs confirmation"}</div><div className="mt-1 text-sm text-muted-foreground">{bookingConfirmation.reference ? `Supplier reference ${bookingConfirmation.reference}. ` : ""}The reservation is listed in your account below. {bookingConfirmation.status !== "confirmed" ? "Contact Bridgeway support before submitting another booking." : ""}</div></div>
          </div>
        )}

        <section className="mt-12">
          <div className="mb-4 flex items-end justify-between gap-4"><div><div className="label-mono">Account</div><h2 className="mt-1 font-display text-xl font-bold">My car reservations</h2></div><a href="/dashboard" className="font-mono text-xs text-primary hover:underline">SHIPMENT DASHBOARD →</a></div>
          <div className="divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
            {bookings.isPending && <div className="p-5 text-sm text-muted-foreground">Loading car reservations…</div>}
            {bookings.error && <div className="p-5 text-sm text-destructive">{(bookings.error as Error).message}</div>}
            {!bookings.isPending && !bookings.error && !bookings.data?.length && <div className="p-5 text-sm text-muted-foreground">No car reservations yet.</div>}
            {bookings.data?.map((item: any) => <MyCarBooking key={item.id} booking={item} />)}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function CarAirportPicker({ id, label, selected, onSelect }: { id: string; label: string; selected: CarAirport | null; onSelect: (place: CarAirport | null) => void }) {
  const placesFn = useServerFn(searchCarPlaces);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const suggestionId = `${id}-suggestions`;
  const places = useQuery({
    queryKey: ["car-airport-suggestions", query],
    enabled: open && !selected && query.trim().length >= 2,
    queryFn: () => placesFn({ data: { query: query.trim() } }),
    staleTime: 60000,
  });
  const results = (places.data ?? []) as CarAirport[];

  useEffect(() => {
    if (selected) {
      setValue(`${selected.city} · ${selected.code} · ${selected.name}`);
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(() => setQuery(value), 250);
    return () => window.clearTimeout(timer);
  }, [selected, value]);

  useEffect(() => setHighlighted(0), [query, results.length]);

  function choose(place: CarAirport) {
    onSelect(place);
    setValue(`${place.city} · ${place.code} · ${place.name}`);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setHighlighted((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setHighlighted((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && open && results.length) {
      event.preventDefault();
      choose(results[highlighted] ?? results[0]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="mt-1.5 flex items-center gap-2 rounded-md bg-background px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-primary">
        <MapPin className="size-4 shrink-0 text-primary" />
        <input
          id={id}
          name={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && !selected}
          aria-controls={suggestionId}
          autoComplete="off"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setValue(event.target.value);
            onSelect(null);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search city or airport"
          className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
        />
      </div>
      {open && !selected && value.trim().length >= 2 && (
        <div id={suggestionId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-card p-1 shadow-xl">
          {places.isPending ? <div className="p-3 text-xs text-muted-foreground">Searching airports…</div>
            : places.error ? <div className="p-3 text-xs text-destructive">Airport suggestions are unavailable.</div>
              : results.length === 0 ? <div className="p-3 text-xs text-muted-foreground">No airports found. Try another city or airport name.</div>
                : results.map((place, index) => <button
                  key={place.id}
                  type="button"
                  role="option"
                  aria-selected={index === highlighted}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(place)}
                  className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left ${index === highlighted ? "bg-primary/10" : "hover:bg-background"}`}
                ><MapPin className="mt-0.5 size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{place.city} · {place.code}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{place.name}{place.countryCode ? ` · ${place.countryCode}` : ""}</span></span></button>)}
        </div>
      )}
    </div>
  );
}

function CarRateCard({ rate, active, loading, onSelect }: { rate: any; active: boolean; loading: boolean; onSelect: () => void }) {
  const vehicle = rate.car ?? {};
  const image = vehicle.images?.[0]?.url;
  return (
    <article className={`rounded-xl bg-card p-4 ring-1 transition-colors sm:p-5 ${active ? "ring-2 ring-primary" : "ring-line hover:ring-primary"}`}>
      <div className="flex flex-col gap-4 md:flex-row">
        {image ? <img src={image} alt={vehicle.name ?? "Rental vehicle"} loading="lazy" className="h-44 w-full rounded-lg bg-background object-cover md:w-56" />
          : <div className="grid h-44 w-full place-items-center rounded-lg bg-background text-primary md:w-56"><CarFront className="size-12" /></div>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="font-display text-lg font-bold">{vehicle.name ?? humanize(vehicle.category ?? "Rental car")}</div><div className="mt-1 text-sm text-muted-foreground">{rate.supplier?.name ?? "Rental supplier"}</div></div>
            <div className="text-right"><div className="font-display text-xl font-black text-primary">{money(rate.total_amount, rate.total_currency)}</div><div className="font-mono text-[10px] uppercase text-muted-foreground">Pay at pickup · postpaid</div></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {vehicle.max_passengers && <Feature icon={<Users className="size-3.5" />}>{vehicle.max_passengers} passengers</Feature>}
            {vehicle.baggage && <Feature icon={<Luggage className="size-3.5" />}>{vehicle.baggage.small ?? 0} small · {vehicle.baggage.large ?? 0} large bags</Feature>}
            {vehicle.transmission && <Feature>{humanize(vehicle.transmission)}</Feature>}
            {vehicle.fuel && <Feature>{humanize(vehicle.fuel)}</Feature>}
            {rate.mileage?.type && <Feature>{humanize(rate.mileage.type)} mileage</Feature>}
            {vehicle.air_conditioning && <Feature>Air conditioning</Feature>}
          </div>
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div><div className="label-mono">Pick-up location</div><div className="mt-1 font-semibold">{locationName(rate.pickup_location)}</div><div className="mt-1 text-muted-foreground">{openingHours(rate.pickup_location)}</div></div>
            <div><div className="label-mono">Drop-off location</div><div className="mt-1 font-semibold">{locationName(rate.dropoff_location)}</div><div className="mt-1 text-muted-foreground">{openingHours(rate.dropoff_location)}</div></div>
          </div>
          {!!rate.conditions?.length && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{rate.conditions.map((item: any) => `${item.title}: ${item.text}`).join(" · ")}</p>}
          <button type="button" disabled={loading} onClick={onSelect} className={`mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${active ? "bg-primary text-primary-foreground" : "bg-foreground text-background hover:bg-primary"}`}>
            {loading ? "Checking price…" : active ? "Selected" : "Choose this car"}<ArrowLeftRight className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function MyCarBooking({ booking }: { booking: any }) {
  const [open, setOpen] = useState(false);
  const data = booking.booking_data ?? {};
  const car = data.car ?? booking.car ?? {};
  const pickup = data.pickupLocation ?? booking.pickup_location ?? {};
  const dropoff = data.dropoffLocation ?? booking.dropoff_location ?? {};
  const status = booking.status === "cancelled" ? "Cancelled" : booking.status === "needs_review" ? "Needs review" : "Confirmed";
  return (
    <article>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <CarFront className="size-5 shrink-0 text-primary" />
        <div className="min-w-[180px] flex-1"><div className="font-display text-sm font-bold">{car.name ?? "Rental car"} · {pickup.address?.city_name ?? pickup.city_name ?? pickup.name ?? "Pick-up pending"}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{booking.booking_reference ?? "Supplier reference pending"} · {formatDateTime(booking.pickup_date, booking.pickup_time)}</div></div>
        <span className={`rounded px-2 py-1 font-mono text-[10px] uppercase ${booking.status === "confirmed" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{status} · pay at pickup</span>
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="rounded-md px-3 py-2 font-mono text-xs ring-1 ring-line">{open ? "Hide" : "Details"}</button>
      </div>
      {open && <div className="grid gap-4 border-t border-line bg-background px-5 py-4 text-sm sm:grid-cols-2">
        <div><div className="label-mono">Vehicle & supplier</div><p className="mt-2">{car.name ?? "Rental car"} · {data.supplier?.name ?? booking.supplier?.name ?? "Supplier"}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{money(booking.total_amount, booking.total_currency)} · {booking.payment_type}</p></div>
        <div><div className="label-mono">Pick-up and drop-off</div><p className="mt-2">{locationName(pickup)} · {formatDateTime(booking.pickup_date, booking.pickup_time)}</p><p className="mt-1">{locationName(dropoff)} · {formatDateTime(booking.dropoff_date, booking.dropoff_time)}</p></div>
        <div><div className="label-mono">Driver</div><p className="mt-2">{data.driver?.givenName ?? booking.driver?.givenName} {data.driver?.familyName ?? booking.driver?.familyName}</p><p className="mt-1 text-xs text-muted-foreground">{data.driver?.email ?? booking.driver?.email}</p></div>
        <div><div className="label-mono">Supplier instructions</div>{(data.pickupLocation?.additional_information ?? pickup.additional_information ?? []).length ? (data.pickupLocation?.additional_information ?? pickup.additional_information).map((item: any, index: number) => <p key={index} className="mt-2 text-xs leading-5">{item.title}: {item.text}</p>) : <p className="mt-2 text-xs text-muted-foreground">Review your supplier confirmation for pickup instructions.</p>}</div>
      </div>}
    </article>
  );
}

function disclosureKey(disclosure: any) {
  return JSON.stringify([disclosure.title ?? "", disclosure.text ?? ""]);
}

function locationName(location: any) {
  if (!location) return "Location details pending";
  const address = location.address;
  return [location.name, address?.city_name, address?.region, address?.country_code].filter(Boolean).join(" · ") || location.city_name || "Rental location";
}

function openingHours(location: any) {
  const hours = location?.opening_hours?.[0];
  return hours?.from && hours?.to ? `Open ${hours.from}–${hours.to}` : "Hours supplied by rental company";
}

function formatDateTime(date?: string | null, time?: string | null) {
  if (!date) return "Date pending";
  const parsed = new Date(`${date}T${time || "00:00"}:00`);
  return Number.isNaN(parsed.getTime()) ? `${date}${time ? ` · ${time}` : ""}` : parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function money(amount: string | number, currency: string) {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${Number.isFinite(value) ? value.toFixed(2) : amount}`;
  }
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-xs font-semibold text-muted-foreground">{label}{children}</label>;
}

function Feature({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1.5 ring-1 ring-line">{icon}{children}</span>;
}
