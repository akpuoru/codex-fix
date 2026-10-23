import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Plane } from "lucide-react";

import { getMyFlightBooking } from "@/lib/flights.functions";

export const Route = createFileRoute("/_authenticated/flight-bookings/$id")({
  head: () => ({
    meta: [
      { title: "Flight itinerary · Bridgeway" },
      { name: "description", content: "Your verifiable airline reservation itinerary and booking reference." },
    ],
  }),
  component: FlightItineraryPage,
});

function FlightItineraryPage() {
  const { id } = Route.useParams();
  const getBooking = useServerFn(getMyFlightBooking);
  const query = useQuery({ queryKey: ["flight-booking", id], queryFn: () => getBooking({ data: { id } }) });
  const booking = query.data;
  const segments = (booking?.itinerary ?? []).flatMap((slice: any) => slice.segments ?? []);
  const passengers = booking?.passengers ?? [];
  const firstDeparture = segments[0]?.departingAt;
  const lastArrival = segments.at(-1)?.arrivingAt;
  const destination = segments.at(-1)?.destination?.city || segments.at(-1)?.destination?.code || "your destination";
  const isExpired = booking?.status === "expired";
  const needsReview = booking?.status === "needs_review";

  return <div className="min-h-screen bg-muted/40 px-4 py-8 print:bg-white print:p-0">
    <div className="mx-auto mb-4 flex max-w-5xl items-center justify-between print:hidden">
      <a href="/flights" className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground hover:text-foreground">← BACK TO FLIGHTS</a>
      {booking && <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-mono text-xs text-primary-foreground"><Download className="size-4" /> SAVE / PRINT PDF</button>}
    </div>

    {query.isPending && <p className="text-center font-mono text-sm text-muted-foreground">Loading airline reservation…</p>}
    {query.error && <p role="alert" className="text-center font-mono text-sm text-destructive">{(query.error as Error).message}</p>}
    {!query.isPending && !query.error && !booking && <div className="mx-auto max-w-xl rounded-xl bg-card p-6 text-center ring-1 ring-line"><h1 className="font-display text-xl font-bold">Reservation not found</h1><p className="mt-2 text-sm text-muted-foreground">This flight reservation may belong to another account or may have been removed.</p></div>}

    {booking && <article className="mx-auto max-w-5xl bg-card p-5 text-foreground shadow-lg ring-1 ring-line print:shadow-none print:ring-0 sm:p-8">
      <header className="border-b-2 border-foreground pb-4">
        <div className="flex flex-wrap items-baseline gap-2 font-display text-xl font-bold uppercase sm:text-2xl">
          <span>{formatDate(firstDeparture)}</span><span className="text-primary">›</span><span>{formatDate(lastArrival)}</span>
          <span className="ml-1 text-sm font-normal uppercase text-muted-foreground">Trip to</span><span className="text-primary">{destination}</span>
        </div>
        <div className="mt-4 label-mono">Prepared for</div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-display text-base font-bold uppercase">
          {passengers.map((passenger: any, index: number) => <span key={index}>{passenger.familyName}/{passenger.givenName}</span>)}
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div><div className="label-mono">Reservation code · Bridgeway</div><div className="font-mono text-sm font-bold">{booking.id.slice(0, 8).toUpperCase()}</div></div>
          <div><div className="label-mono">Airline reservation code · PNR</div><div className="font-mono text-lg font-black tracking-widest">{booking.booking_reference ?? "Pending airline reference"}</div></div>
        </div>
        {booking.booking_references?.length > 1 && <div className="mt-3 text-xs text-muted-foreground">Other carrier references: {booking.booking_references.filter((ref: any) => ref.booking_reference !== booking.booking_reference).map((ref: any) => `${ref.carrier?.name ?? "Carrier"}: ${ref.booking_reference}`).join(" · ")}</div>}
      </header>

      <div className={`my-4 border-l-4 p-3 ${isExpired ? "border-destructive bg-destructive/10" : "border-caution bg-caution/10"}`}>
        <div className="font-display text-sm font-black uppercase">{isExpired ? "Reservation expired" : needsReview ? "Reservation needs verification" : "Airline reservation held · unpaid · not ticketed"}</div>
        <p className="mt-1 text-xs leading-5">{isExpired
          ? "The payment deadline passed. The airline may have released the reservation and seats; this PDF is a record of the expired hold, not a current flight booking."
          : needsReview
            ? "The airline did not return a booking reference or payment deadline. Do not rely on this as a verifiable reservation; contact Bridgeway support to confirm the order."
            : `Payment is due by ${formatDateTime(booking.payment_required_by)}. The airline will release the hold if it is not paid by then. This is not an e-ticket or boarding pass.`}</p>
        {!isExpired && !needsReview && booking.price_guarantee_expires_at && <p className="mt-1 text-xs">Fare price guaranteed until {formatDateTime(booking.price_guarantee_expires_at)}.</p>}
      </div>

      <div className="flex items-center gap-2 border-b border-line pb-2 font-display text-lg font-bold uppercase"><Plane className="size-5 text-primary" /> Flight itinerary</div>
      <div className="divide-y divide-line">
        {segments.map((segment: any, index: number) => <section key={`${segment.id ?? index}`} className="py-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="font-display text-base font-bold uppercase">Departure: {formatDay(segment.departingAt)}</div>
            <span className="text-xs text-muted-foreground">Please verify flight times with the airline</span>
          </div>
          <div className="grid border border-line md:grid-cols-[0.9fr_1.4fr_0.75fr]">
            <div className="bg-muted p-4">
              <div className="font-display text-base font-bold uppercase">{segment.airline}</div>
              <div className="font-display text-lg font-black">{segment.flightNumber || "Flight number pending"}</div>
              <div className="mt-4 text-sm">Duration: {duration(segment.duration)}</div>
              <div className="mt-1 text-sm">Status: {isExpired ? "Expired" : needsReview ? "Needs verification" : "Held · unpaid"}</div>
            </div>
            <div className="grid sm:grid-cols-2">
              <div className="border-b border-dashed border-line p-4 sm:border-r">
                <div className="font-mono text-sm font-bold">{segment.origin?.code}</div><div className="text-sm">{segment.origin?.city}</div><div className="text-xs text-muted-foreground">{segment.origin?.airport}</div>
                <div className="mt-4 text-xs text-muted-foreground">Departing at</div><div className="font-display text-xl font-bold">{formatTime(segment.departingAt)}</div>
                <div className="text-xs">Terminal: {segment.origin?.terminal || "Not provided"}</div>
              </div>
              <div className="p-4">
                <div className="font-mono text-sm font-bold">{segment.destination?.code}</div><div className="text-sm">{segment.destination?.city}</div><div className="text-xs text-muted-foreground">{segment.destination?.airport}</div>
                <div className="mt-4 text-xs text-muted-foreground">Arriving at</div><div className="font-display text-xl font-bold">{formatTime(segment.arrivingAt)}</div>
                <div className="text-xs">Terminal: {segment.destination?.terminal || "Not provided"}</div>
              </div>
            </div>
            <div className="border-t border-line p-4 md:border-l md:border-t-0">
              <div className="label-mono">Aircraft</div><div className="mt-1 text-sm">{segment.aircraft || "Not provided"}</div>
              <div className="mt-4 label-mono">Operating airline</div><div className="mt-1 text-sm">{segment.operatingAirline || segment.airline}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[1.2fr_0.7fr_0.8fr] bg-muted px-2 py-1 text-xs font-semibold"><span>Passenger name</span><span>Seat</span><span>Booking</span></div>
          {passengers.map((passenger: any, passengerIndex: number) => {
            const seat = (passenger.seats ?? []).find((item: any) => item.segmentId === segment.id)?.designator;
            return <div key={passengerIndex} className="grid grid-cols-[1.2fr_0.7fr_0.8fr] border-b border-line px-2 py-1.5 text-xs"><span className="uppercase">{passenger.familyName}/{passenger.givenName}</span><span>{seat || "Check-in required"}</span><span className="font-semibold uppercase">{isExpired ? "Expired" : needsReview ? "Verify" : "Held"}</span></div>;
          })}
        </section>)}
      </div>

      <footer className="mt-2 border-t border-line pt-3 text-center text-xs text-muted-foreground">
        <p>Verify this reservation with the airline using the airline reservation code above. Flight times, terminals, and seat assignments can change.</p>
        <p className="mt-2 font-display font-bold text-primary">BRIDGEWAY FLIGHTS · bridgewaytrack.live</p>
      </footer>
    </article>}
  </div>;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "DATE PENDING";
}

function formatDay(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short" }).toUpperCase() : "DATE PENDING";
}

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "no deadline returned";
}

function duration(value?: string | null) {
  if (!value) return "Not provided";
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return value;
  return `${match[1] ? `${match[1]}h ` : ""}${match[2] ? `${match[2]}m` : ""}`.trim() || "Not provided";
}
