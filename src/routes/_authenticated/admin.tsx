import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { SupportInbox } from "@/components/support-inbox";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StatusDot, StatusPill } from "@/components/shipment-bits";
import { adminListPeople, adminListShipments, adminListFlightBookings, adminListCarBookings, adminListStayBookings, adminSetRole, adminUpdateShipment, adminUpdateShipmentEvent, adminConfirmShipment, adminMarkPaid, checkIsAdmin, adminSetCustoms, adminTrackingLookups } from "@/lib/admin.functions";
import { CURRENCIES, formatCents, getPricing, STATUS_LABEL, type PricingConfig } from "@/lib/rates";
import { adminSaveSettings, adminSaveTransferDetails, getTransferDetails, type TransferDetails } from "@/lib/settings.functions";
import { adminForceLogout, adminListAccounts, adminSetAccountStatus } from "@/lib/accounts.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin operations · Bridgeway Freighting" },
      { name: "description", content: "Manage Bridgeway Freighting shipments, flight reservations, and operations." },
      { property: "og:title", content: "Admin operations · Bridgeway Freighting" },
      { property: "og:description", content: "Operations console for Bridgeway Freighting staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const STATUSES = [
  "booked",
  "picked_up",
  "in_transit",
  "customs",
  "out_for_delivery",
  "delivered",
  "exception",
] as const;
type Status = (typeof STATUSES)[number];
type ShipmentEvent = {
  id: string;
  status: Status;
  location: string | null;
  note: string | null;
  occurred_at: string;
};

function AdminPage() {
  const { user } = useSession();
  const check = useServerFn(checkIsAdmin);
  const list = useServerFn(adminListShipments);
  const role = useQuery({ queryKey: ["is-admin", user?.id], queryFn: () => check(), enabled: !!user });
  const isAdmin = role.data?.isAdmin;
  const { data, isPending, error } = useQuery({
    queryKey: ["admin-shipments", user?.id],
    queryFn: () => list(),
    enabled: !!isAdmin,
  });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [tab, setTab] = useState<"shipments" | "flights" | "stays" | "cars" | "people" | "settings" | "support">("shipments");

  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (s) =>
          (filter === "all" || s.status === filter) &&
          (q === "" ||
            [s.tracking_number, s.sender_name, s.recipient_name, s.dest_city, s.origin_city]
              .join(" ")
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [data, q, filter],
  );

  if (role.isPending)
    return <Shell><p className="font-mono text-sm text-muted-foreground">Checking clearance…</p></Shell>;
  if (role.isError)
    return (
      <Shell>
        <div className="rounded-xl bg-card p-10 text-center ring-1 ring-line">
          <div className="label-mono">Admin access check failed</div>
          <p className="mt-2 font-mono text-sm text-destructive">{role.error.message}</p>
        </div>
      </Shell>
    );
  if (!isAdmin)
    return (
      <Shell>
        <div className="rounded-xl bg-card p-10 text-center ring-1 ring-line">
          <div className="label-mono">Restricted area</div>
          <p className="mt-2 font-display text-2xl font-black">Admin clearance required</p>
          <Link to="/dashboard" className="mt-4 inline-block font-mono text-xs text-primary">
            ← Back to your dashboard
          </Link>
        </div>
      </Shell>
    );

  const all = data ?? [];
  const revenue = all.reduce((s, x) => s + x.price_cents, 0);

  return (
    <Shell>
      <div className="font-mono text-[11px] tracking-[0.2em] text-primary">CONTROL TOWER</div>
      <h1 className="mt-1 font-display text-3xl font-black tracking-tight">
        {tab === "shipments" ? "All shipments" : tab === "flights" ? "Flight reservations" : tab === "stays" ? "Hotel reservations" : tab === "cars" ? "Car reservations" : tab === "people" ? "People" : tab === "support" ? "Support inbox" : "Currency & rates"}
      </h1>
      <div className="mt-4 flex w-fit flex-wrap rounded-md bg-card p-1 ring-1 ring-line">
        {(["shipments", "flights", "stays", "cars", "people", "settings", "support"] as const).map((t) => (
          <Button
            variant="ghost"
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-4 py-1.5 font-mono text-xs uppercase tracking-wider ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t === "stays" ? "hotels" : t}
          </Button>
        ))}
      </div>
      {tab === "people" ? <People /> : tab === "flights" ? <FlightReservations /> : tab === "stays" ? <HotelBookings /> : tab === "cars" ? <CarHireBookings /> : tab === "settings" ? <><Settings /><TransferSettings /></> : tab === "support" ? <SupportInbox /> : <>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={String(all.length)} />
        <Stat label="Moving" value={String(all.filter((s) => !["booked", "delivered"].includes(s.status)).length)} />
        <Stat label="Exceptions" value={String(all.filter((s) => s.status === "exception").length)} />
        <Stat label="Revenue" value={formatCents(revenue)} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search waybill, name, city…"
          className="min-w-[240px] flex-1 rounded-md bg-card px-4 py-2.5 font-mono text-sm ring-1 ring-line outline-none focus:ring-primary"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Status | "all")}
          className="rounded-md bg-card px-3 py-2.5 font-mono text-sm ring-1 ring-line"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
        {isPending && <div className="px-5 py-8 font-mono text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="px-5 py-8 font-mono text-sm text-destructive">{(error as Error).message}</div>}
        {!isPending && rows.length === 0 && (
          <div className="px-5 py-8 font-mono text-sm text-muted-foreground">No shipments match.</div>
        )}
        {rows.map((s) => (
          <div key={s.id}>
            <div className="flex flex-wrap items-center gap-4 px-5 py-4">
              <StatusDot status={s.status} />
              <div className="w-44 font-mono text-sm">{s.tracking_number}</div>
              <div className="w-36 font-display text-sm font-bold">
                {s.origin_code ?? s.origin_city} → {s.dest_code ?? s.dest_city}
              </div>
              <div className="min-w-[160px] flex-1">
                <div className="label-mono">Current location</div>
                <div className="font-mono text-xs">{s.current_location ?? "—"}</div>
              </div>
              <StatusPill status={s.status} />
              <span
                className={`rounded-md px-2 py-1 font-mono text-[10px] ring-1 ring-line ${s.paid_at ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {s.paid_at ? `PAID${s.payment_method ? " · " + s.payment_method.toUpperCase() : ""}` : "UNPAID"}
              </span>
              {!s.paid_at && s.transfer_submitted_at && (
                <span className="max-w-[220px] truncate rounded-md bg-accent/10 px-2 py-1 font-mono text-[10px] ring-1 ring-accent/40" title={s.transfer_reference ?? ""}>
                  {s.transfer_method?.toUpperCase()} REF: {s.transfer_reference}
                </span>
              )}
              {!s.paid_at && <MarkPaidButton id={s.id} suggested={(s.transfer_method as "bank" | "btc" | "usdt" | null) ?? "bank"} />}
              {!s.confirmed_at && <ConfirmButton id={s.id} />}
              {s.confirmed_at && (
                <Link to="/receipt/$id" params={{ id: s.id }} className="rounded-md px-3 py-2 font-mono text-[11px] text-primary ring-1 ring-line">
                  RECEIPT
                </Link>
              )}
              <button
                onClick={() => setEditing(editing === s.id ? null : s.id)}
                className="rounded-md bg-foreground px-4 py-2 font-display text-xs font-bold text-background hover:bg-primary"
              >
                {editing === s.id ? "Close" : "Update"}
              </button>
            </div>
            {editing === s.id && (
              <UpdateForm
                id={s.id}
                status={s.status as Status}
                location={s.current_location ?? ""}
                events={s.events as ShipmentEvent[]}
                onDone={() => setEditing(null)}
              />
            )}
            {editing === s.id && <CustomsForm id={s.id} initial={s.customs_instructions ?? ""} />}
            {editing === s.id && <Lookups id={s.id} />}
          </div>
        ))}
      </div>
      </>}
    </Shell>
  );
}

type AdminFlightSegment = {
  airline?: string;
  flightNumber?: string;
  origin?: { code?: string; city?: string; airport?: string; terminal?: string | null };
  destination?: { code?: string; city?: string; airport?: string; terminal?: string | null };
  departingAt?: string;
  arrivingAt?: string;
  duration?: string | null;
  aircraft?: string | null;
};

type AdminFlightPassenger = {
  givenName?: string;
  familyName?: string;
  email?: string;
  phoneNumber?: string;
  seats?: { designator?: string; segmentId?: string }[];
};

type AdminFlightBooking = {
  id: string;
  user_id: string;
  duffel_order_id: string;
  booking_reference: string | null;
  booking_references: { booking_reference?: string }[] | null;
  status: "held" | "expired" | "ticketed" | "cancelled" | "needs_review";
  itinerary: { segments?: AdminFlightSegment[] }[] | null;
  passengers: AdminFlightPassenger[] | null;
  total_amount: number | string;
  total_currency: string;
  payment_required_by: string | null;
  price_guarantee_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

const FLIGHT_STATUS_LABEL: Record<AdminFlightBooking["status"], string> = {
  held: "Held · unpaid",
  expired: "Expired",
  ticketed: "Ticketed",
  cancelled: "Cancelled",
  needs_review: "Needs review",
};

function flightPrice(amount: number | string, currency: string) {
  const numericAmount = Number(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${currency} ${Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : amount}`;
  }
}

function flightRoute(slices: AdminFlightBooking["itinerary"]) {
  return (slices ?? []).map((slice) => {
    const segments = slice.segments ?? [];
    const first = segments[0];
    const last = segments.at(-1);
    if (!first || !last) return "Route pending";
    return `${first.origin?.code || first.origin?.city || "—"} → ${last.destination?.code || last.destination?.city || "—"}`;
  }).join(" · ");
}

function FlightReservations() {
  const list = useServerFn(adminListFlightBookings);
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["admin-flight-bookings"],
    queryFn: () => list(),
    refetchInterval: 60000,
  });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<AdminFlightBooking["status"] | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const bookings = (data ?? []) as AdminFlightBooking[];
  const rows = bookings.filter((booking) => {
    if (filter !== "all" && booking.status !== filter) return false;
    const passengers = booking.passengers ?? [];
    const passengerText = passengers.map((p) => `${p.givenName ?? ""} ${p.familyName ?? ""} ${p.email ?? ""}`).join(" ");
    const haystack = [
      booking.booking_reference ?? "",
      ...(booking.booking_references ?? []).map((r) => r.booking_reference ?? ""),
      booking.duffel_order_id,
      booking.user_id,
      flightRoute(booking.itinerary),
      passengerText,
    ].join(" ").toLowerCase();
    return haystack.includes(q.trim().toLowerCase());
  });
  const heldCount = bookings.filter((booking) => booking.status === "held").length;
  const reviewCount = bookings.filter((booking) => booking.status === "needs_review").length;
  const expiredCount = bookings.filter((booking) => booking.status === "expired").length;

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Reservations" value={String(bookings.length)} />
        <Stat label="Active holds" value={String(heldCount)} />
        <Stat label="Needs review" value={String(reviewCount)} />
        <Stat label="Expired holds" value={String(expiredCount)} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reference, passenger, route, or airline order…"
          className="min-w-[240px] flex-1 rounded-md bg-card px-4 py-2.5 font-mono text-sm ring-1 ring-line outline-none focus:ring-primary"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as AdminFlightBooking["status"] | "all")}
          className="rounded-md bg-card px-3 py-2.5 font-mono text-sm ring-1 ring-line"
          aria-label="Filter flight reservations by status"
        >
          <option value="all">All statuses</option>
          {Object.entries(FLIGHT_STATUS_LABEL).map(([status, label]) => (
            <option key={status} value={status}>{label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-flight-bookings"] })}
          className="rounded-md bg-card px-4 py-2.5 font-mono text-xs ring-1 ring-line hover:text-primary"
        >Refresh</button>
      </div>

      <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
        {isPending && <div className="px-5 py-8 font-mono text-sm text-muted-foreground">Loading flight reservations…</div>}
        {error && <div className="px-5 py-8 font-mono text-sm text-destructive">{(error as Error).message}</div>}
        {!isPending && !error && rows.length === 0 && (
          <div className="px-5 py-8 font-mono text-sm text-muted-foreground">
            {bookings.length ? "No flight reservations match." : "No flight reservations have been placed yet."}
          </div>
        )}
        {rows.map((booking) => {
          const passengers = booking.passengers ?? [];
          const primaryReference = booking.booking_reference
            || booking.booking_references?.map((item) => item.booking_reference).find(Boolean)
            || "Reference pending";
          const names = passengers.map((p) => `${p.givenName ?? ""} ${p.familyName ?? ""}`.trim()).filter(Boolean).join(", ");
          const expandedRow = expanded === booking.id;
          const statusClass = booking.status === "ticketed"
            ? "bg-primary/15 text-primary"
            : booking.status === "needs_review"
              ? "bg-destructive/10 text-destructive"
              : booking.status === "held"
                ? "bg-caution/15 text-caution"
                : "bg-muted text-muted-foreground";

          return (
            <article key={booking.id}>
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-[220px] flex-1">
                  <div className="label-mono">Airline reservation</div>
                  <div className="mt-1 font-mono text-sm font-bold">{primaryReference}</div>
                  <div className="mt-1 font-display text-sm font-semibold">{flightRoute(booking.itinerary)}</div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {names || `Customer ${booking.user_id}`} · Placed {new Date(booking.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase ${statusClass}`}>
                  {FLIGHT_STATUS_LABEL[booking.status] ?? booking.status}
                </span>
                <div className="min-w-28 text-right">
                  <div className="label-mono">Amount due</div>
                  <div className="mt-1 font-mono text-sm">{flightPrice(booking.total_amount, booking.total_currency)}</div>
                </div>
                <button
                  type="button"
                  aria-expanded={expandedRow}
                  onClick={() => setExpanded(expandedRow ? null : booking.id)}
                  className="rounded-md bg-foreground px-4 py-2 font-display text-xs font-bold text-background hover:bg-primary"
                >{expandedRow ? "Hide details" : "Details"}</button>
              </div>

              {expandedRow && (
                <div className="grid gap-5 border-t border-line bg-background px-5 py-5 lg:grid-cols-2">
                  <section>
                    <div className="label-mono mb-3">Itinerary</div>
                    {(booking.itinerary ?? []).map((slice, sliceIndex) => (
                      <div key={`${booking.id}-slice-${sliceIndex}`} className="mb-3 rounded-lg bg-card p-4 ring-1 ring-line">
                        <div className="label-mono mb-3">Journey {sliceIndex + 1}</div>
                        {(slice.segments ?? []).map((segment, segmentIndex) => (
                          <div key={`${booking.id}-segment-${sliceIndex}-${segmentIndex}`} className="border-t border-line py-3 first:border-0 first:pt-0 last:pb-0">
                            <div className="font-display text-sm font-bold">
                              {segment.airline ?? "Airline"} {segment.flightNumber ?? ""}
                            </div>
                            <div className="mt-1 text-sm">
                              {segment.origin?.code ?? "—"} {segment.origin?.city ? `· ${segment.origin.city}` : ""}
                              {" → "}
                              {segment.destination?.code ?? "—"} {segment.destination?.city ? `· ${segment.destination.city}` : ""}
                            </div>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {segment.departingAt ? new Date(segment.departingAt).toLocaleString() : "Departure pending"}
                              {" → "}
                              {segment.arrivingAt ? new Date(segment.arrivingAt).toLocaleString() : "Arrival pending"}
                            </div>
                            {(segment.aircraft || segment.duration) && (
                              <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                                {[segment.aircraft, segment.duration].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    <div className="rounded-lg bg-card p-4 font-mono text-[11px] ring-1 ring-line">
                      <div>Airline reference: {primaryReference}</div>
                      <div className="mt-1 break-all">Airline order ID: {booking.duffel_order_id}</div>
                      <div className="mt-1">Reservation created: {new Date(booking.created_at).toLocaleString()}</div>
                      <div className="mt-1">Payment deadline: {booking.payment_required_by ? new Date(booking.payment_required_by).toLocaleString() : "Not provided"}</div>
                    </div>
                  </section>
                  <section>
                    <div className="label-mono mb-3">Passengers</div>
                    {passengers.length ? passengers.map((passenger, index) => (
                      <div key={`${booking.id}-passenger-${index}`} className="mb-2 rounded-lg bg-card p-4 ring-1 ring-line">
                        <div className="font-display text-sm font-bold">
                          {[passenger.givenName, passenger.familyName].filter(Boolean).join(" ") || `Passenger ${index + 1}`}
                        </div>
                        {passenger.email && <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{passenger.email}</div>}
                        {passenger.phoneNumber && <div className="mt-1 font-mono text-xs text-muted-foreground">{passenger.phoneNumber}</div>}
                        {!!passenger.seats?.length && (
                          <div className="mt-2 font-mono text-xs">Seats: {passenger.seats.map((seat) => seat.designator).filter(Boolean).join(", ")}</div>
                        )}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">Passenger details are not available.</p>}
                    <div className="mt-3 rounded-lg bg-card p-4 ring-1 ring-line">
                      <div className="label-mono">Reservation status</div>
                      <div className="mt-1 font-display text-sm font-bold">{FLIGHT_STATUS_LABEL[booking.status] ?? booking.status}</div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {flightPrice(booking.total_amount, booking.total_currency)} · updated {new Date(booking.updated_at).toLocaleString()}
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

function carBookingLocation(location: any) {
  const address = location?.address;
  return [location?.name, address?.city_name, address?.region, address?.country_code].filter(Boolean).join(" · ") || location?.city_name || "Location pending";
}

function CarHireBookings() {
  const list = useServerFn(adminListCarBookings);
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["admin-car-bookings"],
    queryFn: () => list(),
    refetchInterval: 60000,
  });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "confirmed" | "cancelled" | "needs_review">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const bookings: any[] = data ?? [];
  const rows = bookings.filter((booking) => {
    if (filter !== "all" && booking.status !== filter) return false;
    const driver = booking.booking_data?.driver ?? booking.driver ?? {};
    const vehicle = booking.booking_data?.car ?? booking.car ?? {};
    const supplier = booking.booking_data?.supplier ?? booking.supplier ?? {};
    const pickup = booking.booking_data?.pickupLocation ?? booking.pickup_location ?? {};
    const dropoff = booking.booking_data?.dropoffLocation ?? booking.dropoff_location ?? {};
    return [
      booking.booking_reference,
      booking.duffel_booking_id,
      booking.user_id,
      driver.givenName,
      driver.familyName,
      driver.email,
      driver.phoneNumber,
      vehicle.name,
      supplier.name,
      carBookingLocation(pickup),
      carBookingLocation(dropoff),
    ].filter(Boolean).join(" ").toLowerCase().includes(q.trim().toLowerCase());
  });
  const upcoming = bookings.filter((booking) => booking.status === "confirmed" && new Date(`${booking.pickup_date}T${booking.pickup_time || "00:00"}:00`).getTime() >= Date.now()).length;
  const review = bookings.filter((booking) => booking.status === "needs_review").length;
  const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Reservations" value={String(bookings.length)} />
        <Stat label="Upcoming pick-ups" value={String(upcoming)} />
        <Stat label="Needs review" value={String(review)} />
        <Stat label="Cancelled" value={String(cancelled)} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference, driver, vehicle or airport…" className="min-w-[240px] flex-1 rounded-md bg-card px-4 py-2.5 font-mono text-sm ring-1 ring-line outline-none focus:ring-primary" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter car reservations by status" className="rounded-md bg-card px-3 py-2.5 font-mono text-sm ring-1 ring-line">
          <option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="needs_review">Needs review</option><option value="cancelled">Cancelled</option>
        </select>
        <button type="button" onClick={() => qc.invalidateQueries({ queryKey: ["admin-car-bookings"] })} className="rounded-md bg-card px-4 py-2.5 font-mono text-xs ring-1 ring-line hover:text-primary">Refresh</button>
      </div>
      <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
        {isPending && <div className="px-5 py-8 font-mono text-sm text-muted-foreground">Loading car reservations…</div>}
        {error && <div className="px-5 py-8 font-mono text-sm text-destructive">{(error as Error).message}</div>}
        {!isPending && !error && rows.length === 0 && <div className="px-5 py-8 font-mono text-sm text-muted-foreground">{bookings.length ? "No car reservations match." : "No car reservations have been placed yet."}</div>}
        {rows.map((booking) => {
          const details = booking.booking_data ?? {};
          const driver = details.driver ?? booking.driver ?? {};
          const vehicle = details.car ?? booking.car ?? {};
          const supplier = details.supplier ?? booking.supplier ?? {};
          const pickup = details.pickupLocation ?? booking.pickup_location ?? {};
          const dropoff = details.dropoffLocation ?? booking.dropoff_location ?? {};
          const expandedRow = expanded === booking.id;
          const statusLabel = booking.status === "confirmed" ? "Confirmed · postpaid" : booking.status === "cancelled" ? "Cancelled" : "Needs review";
          const statusClass = booking.status === "confirmed" ? "bg-primary/15 text-primary" : booking.status === "needs_review" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
          const instructions = pickup.additional_information ?? [];

          return (
            <article key={booking.id}>
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-[220px] flex-1">
                  <div className="label-mono">{booking.booking_reference || "Supplier reference pending"}</div>
                  <div className="mt-1 font-display text-sm font-bold">{vehicle.name ?? "Rental vehicle"} · {supplier.name ?? "Rental supplier"}</div>
                  <div className="mt-1 text-sm">{carBookingLocation(pickup)} → {carBookingLocation(dropoff)}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{driver.givenName ?? "Driver"} {driver.familyName ?? ""} · Pick-up {booking.pickup_date} {booking.pickup_time}</div>
                </div>
                <span className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase ${statusClass}`}>{statusLabel}</span>
                <div className="min-w-28 text-right"><div className="label-mono">Total</div><div className="mt-1 font-mono text-sm">{flightPrice(booking.total_amount, booking.total_currency)}</div></div>
                <button type="button" aria-expanded={expandedRow} onClick={() => setExpanded(expandedRow ? null : booking.id)} className="rounded-md bg-foreground px-4 py-2 font-display text-xs font-bold text-background hover:bg-primary">{expandedRow ? "Hide details" : "Details"}</button>
              </div>
              {expandedRow && <div className="grid gap-5 border-t border-line bg-background px-5 py-5 lg:grid-cols-2">
                <section>
                  <div className="label-mono mb-3">Reservation</div>
                  <div className="rounded-lg bg-card p-4 font-mono text-xs ring-1 ring-line">
                    <div>Supplier reference: {booking.booking_reference || "Pending"}</div>
                    <div className="mt-1 break-all">Duffel booking ID: {booking.duffel_booking_id}</div>
                    <div className="mt-1">Supplier: {supplier.name ?? "—"}</div>
                    <div className="mt-1">Payment: {booking.payment_type} · collected at pickup</div>
                    <div className="mt-1">Confirmed: {booking.confirmed_at ? new Date(booking.confirmed_at).toLocaleString() : "Pending"}</div>
                    <div className="mt-1">Booked: {new Date(booking.created_at).toLocaleString()}</div>
                  </div>
                  <div className="mt-3 rounded-lg bg-card p-4 ring-1 ring-line">
                    <div className="label-mono">Vehicle details</div>
                    <div className="mt-2 font-display font-bold">{vehicle.name ?? "Rental vehicle"}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{[vehicle.category, vehicle.transmission, vehicle.fuel].filter(Boolean).join(" · ")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Capacity {vehicle.max_passengers ?? "—"} · Mileage {details.mileage?.type ?? booking.mileage?.type ?? "As supplier terms"}</div>
                  </div>
                </section>
                <section>
                  <div className="label-mono mb-3">Driver & collection</div>
                  <div className="rounded-lg bg-card p-4 ring-1 ring-line">
                    <div className="font-display text-sm font-bold">{driver.givenName ?? ""} {driver.familyName ?? ""}</div>
                    {driver.email && <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{driver.email}</div>}
                    {driver.phoneNumber && <div className="mt-1 font-mono text-xs text-muted-foreground">{driver.phoneNumber}</div>}
                    <div className="mt-4 text-sm font-semibold">Pick-up · {booking.pickup_date} {booking.pickup_time}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{carBookingLocation(pickup)}</div>
                    {pickup.phone_number && <div className="mt-1 font-mono text-xs text-muted-foreground">{pickup.phone_number}</div>}
                    <div className="mt-4 text-sm font-semibold">Drop-off · {booking.dropoff_date} {booking.dropoff_time}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{carBookingLocation(dropoff)}</div>
                    {dropoff.phone_number && <div className="mt-1 font-mono text-xs text-muted-foreground">{dropoff.phone_number}</div>}
                  </div>
                  {!!instructions.length && <div className="mt-3 rounded-lg bg-card p-4 ring-1 ring-line"><div className="label-mono">Supplier pick-up instructions</div>{instructions.map((item: any, index: number) => <p key={index} className="mt-2 text-xs leading-5"><strong>{item.title}: </strong>{item.text}</p>)}</div>}
                  {!!(details.conditions ?? booking.conditions)?.length && <div className="mt-3 rounded-lg bg-card p-4 ring-1 ring-line"><div className="label-mono">Rental conditions</div>{(details.conditions ?? booking.conditions).map((item: any, index: number) => <p key={index} className="mt-2 text-xs leading-5"><strong>{item.title}: </strong>{item.text}</p>)}</div>}
                </section>
              </div>}
            </article>
          );
        })}
      </div>
    </>
  );
}

function stayBookingAddress(accommodation: any) {
  const address = accommodation?.location?.address ?? {};
  return [address.line_one, address.city_name, address.region, address.country_code].filter(Boolean).join(" · ") || "Address not returned";
}

function HotelBookings() {
  const list = useServerFn(adminListStayBookings);
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({ queryKey: ["admin-stay-bookings"], queryFn: () => list(), refetchInterval: 60000 });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "confirmed" | "booking_pending" | "needs_review" | "failed" | "cancelled">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const bookings: any[] = data ?? [];
  const rows = bookings.filter((booking) => {
    if (filter !== "all" && booking.status !== filter) return false;
    const guests = booking.guest_details?.guests ?? [];
    const accommodation = booking.accommodation ?? {};
    return [
      booking.booking_reference,
      booking.duffel_booking_id,
      booking.duffel_quote_id,
      booking.user_id,
      booking.guest_details?.email,
      booking.guest_details?.phoneNumber,
      ...guests.flatMap((guest: any) => [guest.givenName, guest.familyName]),
      accommodation.name,
      stayBookingAddress(accommodation),
    ].filter(Boolean).join(" ").toLowerCase().includes(q.trim().toLowerCase());
  });
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((item) => item.status === "confirmed" && item.check_in_date >= today).length;
  const review = bookings.filter((item) => ["booking_pending", "needs_review"].includes(item.status)).length;
  const cancelled = bookings.filter((item) => ["cancelled", "failed"].includes(item.status)).length;

  return <>
    <div className="mt-6 grid gap-4 sm:grid-cols-4">
      <Stat label="Reservations" value={String(bookings.length)} />
      <Stat label="Upcoming arrivals" value={String(upcoming)} />
      <Stat label="Needs review" value={String(review)} />
      <Stat label="Cancelled / failed" value={String(cancelled)} />
    </div>
    <div className="mt-6 flex flex-wrap gap-3">
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search reference, guest, email or hotel…" className="min-w-[240px] flex-1 rounded-md bg-card px-4 py-2.5 font-mono text-sm ring-1 ring-line outline-none focus:ring-primary" />
      <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Filter hotel reservations by status" className="rounded-md bg-card px-3 py-2.5 font-mono text-sm ring-1 ring-line">
        <option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="booking_pending">Booking pending</option><option value="needs_review">Needs review</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option>
      </select>
      <button type="button" onClick={() => qc.invalidateQueries({ queryKey: ["admin-stay-bookings"] })} className="rounded-md bg-card px-4 py-2.5 font-mono text-xs ring-1 ring-line hover:text-primary">Refresh</button>
    </div>
    <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
      {isPending && <div className="px-5 py-8 font-mono text-sm text-muted-foreground">Loading hotel reservations…</div>}
      {error && <div role="alert" className="px-5 py-8 font-mono text-sm text-destructive">{(error as Error).message}</div>}
      {!isPending && !error && rows.length === 0 && <div className="px-5 py-8 font-mono text-sm text-muted-foreground">{bookings.length ? "No hotel reservations match." : "No hotel reservations have been placed yet."}</div>}
      {rows.map((booking) => {
        const hotel = booking.accommodation ?? {};
        const guestDetails = booking.guest_details ?? {};
        const guests = guestDetails.guests ?? [];
        const bookingInfo = booking.booking_data ?? {};
        const expandedRow = expanded === booking.id;
        const statusLabel = booking.status === "confirmed" ? "Confirmed" : booking.status === "booking_pending" ? "Booking pending" : booking.status === "needs_review" ? "Needs review" : booking.status === "failed" ? "Failed" : "Cancelled";
        const statusClass = booking.status === "confirmed" ? "bg-primary/15 text-primary" : ["needs_review", "booking_pending"].includes(booking.status) ? "bg-caution/15 text-caution" : "bg-muted text-muted-foreground";
        return <article key={booking.id}>
          <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-[220px] flex-1">
              <div className="label-mono">{booking.booking_reference || (booking.status === "needs_review" ? "Supplier outcome needs review" : "Supplier reference pending")}</div>
              <div className="mt-1 font-display text-sm font-bold">{hotel.name ?? "Hotel reservation"} · {bookingInfo.roomName ?? "Room details pending"}</div>
              <div className="mt-1 text-sm">{stayBookingAddress(hotel)}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{guests.map((guest: any) => `${guest.givenName ?? ""} ${guest.familyName ?? ""}`.trim()).filter(Boolean).join(", ") || "Guest name pending"} · {booking.check_in_date} to {booking.check_out_date}</div>
            </div>
            <span className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase ${statusClass}`}>{statusLabel}</span>
            <div className="min-w-28 text-right"><div className="label-mono">Total</div><div className="mt-1 font-mono text-sm">{flightPrice(booking.total_amount, booking.total_currency)}</div></div>
            <button type="button" aria-expanded={expandedRow} onClick={() => setExpanded(expandedRow ? null : booking.id)} className="rounded-md bg-foreground px-4 py-2 font-display text-xs font-bold text-background hover:bg-primary">{expandedRow ? "Hide details" : "Details"}</button>
          </div>
          {expandedRow && <div className="grid gap-5 border-t border-line bg-background px-5 py-5 lg:grid-cols-2">
            <section>
              <div className="label-mono mb-3">Hotel reservation</div>
              <div className="rounded-lg bg-card p-4 font-mono text-xs ring-1 ring-line">
                <div>Supplier reference: {booking.booking_reference || "Pending"}</div>
                <div className="mt-1 break-all">Duffel booking ID: {booking.duffel_booking_id || "Pending"}</div>
                <div className="mt-1 break-all">Duffel quote ID: {booking.duffel_quote_id}</div>
                <div className="mt-1">Rate: {bookingInfo.rateName ?? "—"} · {bookingInfo.paymentType ?? "—"}</div>
                <div className="mt-1">Confirmed: {booking.confirmed_at ? new Date(booking.confirmed_at).toLocaleString() : "Pending"}</div>
                <div className="mt-1">Created: {new Date(booking.created_at).toLocaleString()}</div>
                {booking.deposit_amount != null && <div className="mt-1">Deposit: {flightPrice(booking.deposit_amount, booking.deposit_currency ?? booking.total_currency)}</div>}
                {booking.due_at_accommodation_amount != null && <div className="mt-1">Due at accommodation: {flightPrice(booking.due_at_accommodation_amount, booking.due_at_accommodation_currency ?? booking.total_currency)}</div>}
              </div>
              <div className="mt-3 rounded-lg bg-card p-4 ring-1 ring-line"><div className="label-mono">Property and stay</div><div className="mt-2 font-display font-bold">{hotel.name ?? "Accommodation"}</div><div className="mt-1 text-sm text-muted-foreground">{stayBookingAddress(hotel)}</div><div className="mt-3 text-sm font-semibold">{booking.check_in_date} to {booking.check_out_date} · {booking.rooms} {booking.rooms === 1 ? "room" : "rooms"}</div>{hotel.description && <p className="mt-2 text-xs leading-5 text-muted-foreground">{hotel.description}</p>}</div>
            </section>
            <section>
              <div className="label-mono mb-3">Guest and check-in details</div>
              <div className="rounded-lg bg-card p-4 ring-1 ring-line">
                {guests.map((guest: any, index: number) => <div key={index} className="mb-2 font-display text-sm font-bold">{guest.givenName} {guest.familyName}{index === 0 ? " · Lead guest" : ""}</div>)}
                {guestDetails.email && <div className="mt-2 break-all font-mono text-xs text-muted-foreground">{guestDetails.email}</div>}
                {guestDetails.phoneNumber && <div className="mt-1 font-mono text-xs text-muted-foreground">{guestDetails.phoneNumber}</div>}
                {bookingInfo.checkInInformation && <div className="mt-4 text-xs leading-5 text-muted-foreground">Check-in after {bookingInfo.checkInInformation.check_in_after_time ?? "hotel policy"}; check-out before {bookingInfo.checkInInformation.check_out_before_time ?? "hotel policy"}.</div>}
                {bookingInfo.keyCollection?.instructions && <div className="mt-3 rounded-md bg-background p-3 text-xs leading-5">{bookingInfo.keyCollection.instructions}</div>}
                {bookingInfo.specialRequests && <div className="mt-3 text-xs leading-5"><strong>Guest request:</strong> {bookingInfo.specialRequests}</div>}
              </div>
              {!!bookingInfo.conditions?.length && <div className="mt-3 rounded-lg bg-card p-4 ring-1 ring-line"><div className="label-mono">Rate conditions</div>{bookingInfo.conditions.map((item: any, index: number) => <p key={index} className="mt-2 text-xs leading-5"><strong>{item.title}: </strong>{item.description}</p>)}</div>}
            </section>
          </div>}
        </article>;
      })}
    </div>
  </>;
}

function People() {
  const list = useServerFn(adminListPeople);
  const setRole = useServerFn(adminSetRole);
  const listAcc = useServerFn(adminListAccounts);
  const setStatus = useServerFn(adminSetAccountStatus);
  const kick = useServerFn(adminForceLogout);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data, isPending, error } = useQuery({ queryKey: ["admin-people"], queryFn: () => list() });
  const acc = useQuery({ queryKey: ["admin-accounts"], queryFn: () => listAcc(), refetchInterval: 30000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-people"] }); qc.invalidateQueries({ queryKey: ["admin-accounts"] }); };
  const m = useMutation({
    mutationFn: (v: { userId: string; makeAdmin: boolean }) => setRole({ data: v }),
    onSuccess: (_r, v) => { toast.success(v.makeAdmin ? "Promoted to admin" : "Admin access removed"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const sm = useMutation({
    mutationFn: (v: { userId: string; status: "active" | "restricted" | "banned"; reason?: string }) => setStatus({ data: v }),
    onSuccess: (_r, v) => { toast.success(v.status === "banned" ? "Account banned" : v.status === "restricted" ? "Account restricted" : "Account restored"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const km = useMutation({
    mutationFn: (userId: string) => kick({ data: { userId } }),
    onSuccess: () => { toast.success("User will be signed out within 30 seconds"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const rows = (data ?? []).filter((p) =>
    `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const statusOf = (id: string) => acc.data?.statuses[id]?.status ?? "active";
  const btn = "rounded-md px-3 py-2 font-display text-xs font-bold ring-1 ring-line bg-card disabled:opacity-40";
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Accounts" value={String(data?.length ?? 0)} />
        <Stat label="Admins" value={String((data ?? []).filter((p) => p.is_admin).length)} />
        <Stat label="Restricted" value={String((data ?? []).filter((p) => statusOf(p.id) === "restricted").length)} />
        <Stat label="Banned" value={String((data ?? []).filter((p) => statusOf(p.id) === "banned").length)} />
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or email…"
        className="mt-6 w-full rounded-md bg-card px-4 py-2.5 font-mono text-sm ring-1 ring-line outline-none focus:ring-primary"
      />
      <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl bg-card ring-1 ring-line">
        {isPending && <div className="px-5 py-8 font-mono text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="px-5 py-8 font-mono text-sm text-destructive">{(error as Error).message}</div>}
        {!isPending && rows.length === 0 && (
          <div className="px-5 py-8 font-mono text-sm text-muted-foreground">No accounts match.</div>
        )}
        {rows.map((p) => {
          const st = statusOf(p.id);
          const logins = acc.data?.logins[p.id] ?? [];
          const last = logins[0];
          const lastAt = acc.data?.lastSignIn[p.id];
          return (
          <div key={p.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[200px] flex-1">
                <div className="font-display text-sm font-bold">{p.full_name || "—"}{p.is_self && " (you)"}</div>
                <div className="font-mono text-xs text-muted-foreground">{p.email}</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  Joined {new Date(p.created_at).toLocaleDateString()} · Last sign-in {lastAt ? new Date(lastAt).toLocaleString() : "never"}
                  {last && <> · {last.device} · {last.browser} on {last.os} · {[last.city, last.country].filter(Boolean).join(", ") || "Unknown location"}</>}
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase ${p.is_admin ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                {p.is_admin ? "Admin" : "Customer"}
              </span>
              {st !== "active" && (
                <span className="rounded-full bg-destructive/15 px-3 py-1 font-mono text-[11px] uppercase text-destructive">{st}</span>
              )}
              <button className={btn} onClick={() => setOpen(open === p.id ? null : p.id)}>
                {open === p.id ? "Hide logins" : `Logins (${logins.length})`}
              </button>
              {!p.is_self && (
                <>
                  <button className={btn} disabled={km.isPending} onClick={() => confirm(`Sign ${p.email} out of all devices?`) && km.mutate(p.id)}>Log out</button>
                  {st === "active" ? (
                    <>
                      <button className={btn} disabled={sm.isPending} onClick={() => {
                        const reason = prompt(`Restrict ${p.email}? They can still sign in but cannot book or chat. Reason (optional):`);
                        if (reason !== null) sm.mutate({ userId: p.id, status: "restricted", reason });
                      }}>Restrict</button>
                      <button className={`${btn} text-destructive hover:ring-destructive`} disabled={sm.isPending} onClick={() => {
                        const reason = prompt(`Ban ${p.email}? They will be signed out and blocked from signing in. Reason (optional):`);
                        if (reason !== null) sm.mutate({ userId: p.id, status: "banned", reason });
                      }}>Ban</button>
                    </>
                  ) : (
                    <button className={btn} disabled={sm.isPending} onClick={() => sm.mutate({ userId: p.id, status: "active" })}>
                      {st === "banned" ? "Unban" : "Lift restriction"}
                    </button>
                  )}
                </>
              )}
              <button
                disabled={m.isPending || (p.is_self && p.is_admin)}
                onClick={() => {
                  if (!p.is_admin || confirm(`Remove admin access from ${p.email}?`))
                    m.mutate({ userId: p.id, makeAdmin: !p.is_admin });
                }}
                className={`w-24 rounded-md px-3 py-2 font-display text-xs font-bold disabled:opacity-40 ${p.is_admin ? "bg-card ring-1 ring-line hover:ring-destructive" : "bg-foreground text-background hover:bg-primary"}`}
              >
                {p.is_admin ? "Demote" : "Promote"}
              </button>
            </div>
            {open === p.id && (
              <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-line">
                {logins.length === 0 ? (
                  <div className="px-4 py-3 font-mono text-xs text-muted-foreground">No sign-ins recorded yet.</div>
                ) : (
                  <table className="w-full font-mono text-xs">
                    <thead className="bg-muted text-left text-muted-foreground">
                      <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Device</th><th className="px-3 py-2">Browser / system</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">IP address</th></tr>
                    </thead>
                    <tbody>
                      {logins.map((l: any) => (
                        <tr key={l.id} className="border-t border-line">
                          <td className="px-3 py-2">{new Date(l.created_at).toLocaleString()}</td>
                          <td className="px-3 py-2">{l.device}</td>
                          <td className="px-3 py-2">{l.browser} · {l.os}</td>
                          <td className="px-3 py-2">{[l.city, l.region, l.country].filter(Boolean).join(", ") || "Unknown"}</td>
                          <td className="px-3 py-2">{l.ip ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </>
  );
}

function Settings() {
  const save = useServerFn(adminSaveSettings);
  const router = useRouter();
  const [cfg, setCfg] = useState<PricingConfig>(() => structuredClone(getPricing()));
  const m = useMutation({
    mutationFn: () => save({ data: cfg }),
    onSuccess: async () => {
      toast.success("Currency and rates saved — live on the site");
      await router.invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const n = (v: string) => (v === "" ? 0 : Number(v));
  const F = (p: { label: string; value: number; on: (v: number) => void; step?: string }) => (
    <label className="block">
      <span className="label-mono">{p.label}</span>
      <input
        type="number"
        step={p.step ?? "0.01"}
        min="0"
        value={p.value}
        onChange={(e) => p.on(n(e.target.value))}
        className="mt-1 w-full rounded-md bg-background px-3 py-2 font-mono text-sm ring-1 ring-line"
      />
    </label>
  );
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
      className="mt-6 space-y-6"
    >
      <div className="rounded-xl bg-card p-5 ring-1 ring-line">
        <div className="font-display text-lg font-bold">Payment currency</div>
        <p className="mt-1 text-sm text-muted-foreground">All prices on the site are shown and charged in this currency.</p>
        <select
          value={cfg.currency}
          onChange={(e) => setCfg({ ...cfg, currency: e.target.value })}
          className="mt-3 rounded-md bg-background px-3 py-2 font-mono text-sm ring-1 ring-line"
        >
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="rounded-xl bg-card p-5 ring-1 ring-line">
        <div className="font-display text-lg font-bold">Base rates ({cfg.currency})</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(["courier", "luggage", "freight"] as const).map((k) => (
            <div key={k} className="space-y-3 rounded-lg bg-background p-4 ring-1 ring-line">
              <div className="font-display text-sm font-bold capitalize">{k}</div>
              <F label="Base fee" value={cfg.kinds[k].base} on={(v) => setCfg({ ...cfg, kinds: { ...cfg.kinds, [k]: { ...cfg.kinds[k], base: v } } })} />
              <F label="Per kg" value={cfg.kinds[k].perKg} on={(v) => setCfg({ ...cfg, kinds: { ...cfg.kinds, [k]: { ...cfg.kinds[k], perKg: v } } })} />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-card p-5 ring-1 ring-line">
        <div className="font-display text-lg font-bold">Speed multipliers & surcharges</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(["express", "standard", "economy"] as const).map((l) => (
            <F key={l} label={`${l} ×`} value={cfg.levels[l]} on={(v) => setCfg({ ...cfg, levels: { ...cfg.levels, [l]: v } })} />
          ))}
          <F label="Fuel surcharge %" value={Math.round(cfg.fuel * 1000) / 10} step="0.1" on={(v) => setCfg({ ...cfg, fuel: v / 100 })} />
          <F label="International ×" value={cfg.international} on={(v) => setCfg({ ...cfg, international: v })} />
          <F label={`Extra piece fee (${cfg.currency})`} value={cfg.extraPiece} on={(v) => setCfg({ ...cfg, extraPiece: v })} />
        </div>
      </div>
      <button
        disabled={m.isPending}
        className="rounded-md bg-primary px-6 py-2.5 font-display text-sm font-black text-primary-foreground disabled:opacity-60"
      >
        {m.isPending ? "Saving…" : "Save currency & rates"}
      </button>
    </form>
  );
}

function UpdateForm(props: { id: string; status: Status; location: string; events: ShipmentEvent[]; onDone: () => void }) {
  const update = useServerFn(adminUpdateShipment);
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>(props.status);
  const [location, setLocation] = useState(props.location);
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => update({ data: { id: props.id, status, location, note } }),
    onSuccess: () => {
      toast.success("Shipment updated — tracking refreshed");
      qc.invalidateQueries({ queryKey: ["admin-shipments"] });
      props.onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-4 bg-background px-5 py-4">
      <section>
        <div className="label-mono mb-2">Add a tracking update</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (location.trim().length < 2) { toast.error("Enter a location"); return; }
            m.mutate();
          }}
          className="grid gap-3 md:grid-cols-[180px_1fr_1fr_auto]"
        >
          <select
            aria-label="New shipment status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="rounded-md bg-card px-3 py-2 font-mono text-sm ring-1 ring-line"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <input
            aria-label="New shipment location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="New location, e.g. Dubai Hub, UAE"
            className="rounded-md bg-card px-3 py-2 font-mono text-sm ring-1 ring-line"
          />
          <input
            aria-label="Tracking scan note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Scan note (optional)"
            maxLength={300}
            className="rounded-md bg-card px-3 py-2 font-mono text-sm ring-1 ring-line"
          />
          <button
            disabled={m.isPending}
            className="rounded-md bg-primary px-5 py-2 font-display text-sm font-black text-primary-foreground disabled:opacity-60"
          >
            {m.isPending ? "Saving…" : "Add scan"}
          </button>
        </form>
      </section>

      <section className="border-t border-line pt-4">
        <div className="label-mono mb-2">Existing tracking updates</div>
        {props.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tracking updates have been recorded.</p>
        ) : (
          <div className="space-y-2">
            {props.events.map((event) => <ShipmentEventEditor key={event.id} event={event} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function toLocalDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function ShipmentEventEditor({ event }: { event: ShipmentEvent }) {
  const update = useServerFn(adminUpdateShipmentEvent);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Status>(event.status);
  const [location, setLocation] = useState(event.location ?? "");
  const [note, setNote] = useState(event.note ?? "");
  const [occurredAt, setOccurredAt] = useState(toLocalDateTime(event.occurred_at));
  const mutation = useMutation({
    mutationFn: () => update({ data: {
      eventId: event.id,
      status,
      location,
      note,
      occurredAt: new Date(occurredAt).toISOString(),
    } }),
    onSuccess: () => {
      toast.success("Tracking update changed");
      qc.invalidateQueries({ queryKey: ["admin-shipments"] });
      setEditing(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-card px-3 py-2 ring-1 ring-line">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{STATUS_LABEL[event.status]}{event.location ? ` · ${event.location}` : ""}</div>
          {event.note && <div className="mt-1 break-words text-xs text-muted-foreground">{event.note}</div>}
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{new Date(event.occurred_at).toLocaleString()}</div>
        </div>
        <button
          type="button"
          aria-label={`Edit ${STATUS_LABEL[event.status]} tracking update`}
          onClick={() => {
            setStatus(event.status);
            setLocation(event.location ?? "");
            setNote(event.note ?? "");
            setOccurredAt(toLocalDateTime(event.occurred_at));
            setEditing(true);
          }}
          className="rounded-md px-3 py-1.5 font-mono text-xs text-primary ring-1 ring-line hover:bg-background"
        >Edit update</button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
      className="grid gap-3 rounded-md bg-card p-3 ring-1 ring-primary/40 md:grid-cols-2"
    >
      <label className="space-y-1 text-xs">
        <span className="label-mono">Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-full rounded-md bg-background px-3 py-2 font-mono text-sm ring-1 ring-line">
          {STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs">
        <span className="label-mono">Date and time</span>
        <input type="datetime-local" required value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className="w-full rounded-md bg-background px-3 py-2 font-mono text-sm ring-1 ring-line" />
      </label>
      <label className="space-y-1 text-xs">
        <span className="label-mono">Location</span>
        <input value={location} maxLength={160} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md bg-background px-3 py-2 font-mono text-sm ring-1 ring-line" />
      </label>
      <label className="space-y-1 text-xs">
        <span className="label-mono">Tracking note</span>
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="w-full rounded-md bg-background px-3 py-2 font-mono text-sm ring-1 ring-line" />
      </label>
      <div className="flex gap-2 md:col-span-2">
        <button type="submit" disabled={mutation.isPending} className="rounded-md bg-primary px-4 py-2 font-display text-sm font-bold text-primary-foreground disabled:opacity-60">{mutation.isPending ? "Saving…" : "Save changes"}</button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-md px-4 py-2 font-mono text-xs ring-1 ring-line">Cancel</button>
      </div>
    </form>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-6 py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-line">
      <div className="label-mono">{label}</div>
      <div className="mt-1 font-display text-3xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function ConfirmButton({ id }: { id: string }) {
  const confirm = useServerFn(adminConfirmShipment);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => confirm({ data: { id } }),
    onSuccess: () => {
      toast.success("Order confirmed · receipt issued");
      qc.invalidateQueries({ queryKey: ["admin-shipments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <button
      onClick={() => m.mutate()}
      disabled={m.isPending}
      className="rounded-md bg-primary px-3 py-2 font-mono text-[11px] text-primary-foreground"
    >
      CONFIRM ORDER
    </button>
  );
}

function MarkPaidButton({ id, suggested }: { id: string; suggested: "bank" | "btc" | "usdt" }) {
  const mark = useServerFn(adminMarkPaid);
  const qc = useQueryClient();
  const [method, setMethod] = useState(suggested);
  const m = useMutation({
    mutationFn: () => mark({ data: { id, method } }),
    onSuccess: () => { toast.success("Marked as paid"); qc.invalidateQueries({ queryKey: ["admin-shipments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <span className="flex items-center gap-1">
      <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="rounded-md bg-background px-1 py-2 font-mono text-[10px] ring-1 ring-line">
        <option value="bank">BANK</option><option value="btc">BTC</option><option value="usdt">USDT</option>
      </select>
      <button onClick={() => { if (confirm("Mark this shipment as paid?")) m.mutate(); }} disabled={m.isPending} className="rounded-md px-3 py-2 font-mono text-[11px] ring-1 ring-line hover:text-primary">
        MARK PAID
      </button>
    </span>
  );
}

function TransferSettings() {
  const fetchD = useServerFn(getTransferDetails);
  const save = useServerFn(adminSaveTransferDetails);
  const { data } = useQuery({ queryKey: ["transfer-details"], queryFn: () => fetchD() });
  const [d, setD] = useState<TransferDetails | null>(null);
  const v = d ?? data ?? {};
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => save({ data: v }),
    onSuccess: () => { toast.success("Transfer details saved"); qc.invalidateQueries({ queryKey: ["transfer-details"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const fields: [keyof TransferDetails, string][] = [
    ["bankName", "Bank name"], ["accountName", "Account name"], ["accountNumber", "Account number / IBAN"], ["swift", "SWIFT / Sort code"],
    ["bankNote", "Extra note for customers"], ["btcAddress", "Bitcoin (BTC) address"], ["usdtAddress", "USDT address"], ["usdtNetwork", "USDT network (e.g. TRC-20)"],
  ];
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="mt-6 rounded-xl bg-card p-5 ring-1 ring-line">
      <div className="font-display text-lg font-bold">Transfer & crypto payment details</div>
      <p className="mt-1 text-sm text-muted-foreground">Shown to signed-in customers who choose to pay by transfer. Leave blank to have them contact you on live chat instead.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {fields.map(([k, label]) => (
          <label key={k} className="block">
            <span className="label-mono">{label}</span>
            <input value={v[k] ?? ""} maxLength={300} onChange={(e) => setD({ ...v, [k]: e.target.value })} className="mt-1 w-full rounded-md bg-background px-3 py-2 font-mono text-sm ring-1 ring-line" />
          </label>
        ))}
      </div>
      <button disabled={m.isPending} className="mt-4 rounded-md bg-primary px-6 py-2.5 font-display text-sm font-black text-primary-foreground disabled:opacity-60">
        {m.isPending ? "Saving…" : "Save transfer details"}
      </button>
    </form>
  );
}

function CustomsForm({ id, initial }: { id: string; initial: string }) {
  const save = useServerFn(adminSetCustoms);
  const qc = useQueryClient();
  const [text, setText] = useState(initial);
  const m = useMutation({
    mutationFn: () => save({ data: { id, instructions: text } }),
    onSuccess: () => { toast.success(text.trim() ? "Instructions published on tracking page" : "Instructions removed"); qc.invalidateQueries({ queryKey: ["admin-shipments"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="bg-background px-5 pb-4">
      <div className="label-mono mb-1">Customs hold · instructions for the receiver (shown to anyone tracking)</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000}
        placeholder="e.g. Your package is held at customs. Please pay the clearance fee and send a copy of your ID via live chat."
        className="w-full rounded-md bg-card px-3 py-2 font-mono text-sm ring-1 ring-line" />
      <div className="mt-2 flex gap-2">
        <button onClick={() => m.mutate()} disabled={m.isPending} className="rounded-md bg-primary px-4 py-2 font-display text-xs font-bold text-primary-foreground disabled:opacity-60">
          {m.isPending ? "Saving…" : "Publish instructions"}
        </button>
        {initial && <button onClick={() => { setText(""); setTimeout(() => m.mutate(), 0); }} className="rounded-md px-4 py-2 font-mono text-xs ring-1 ring-line">Clear</button>}
      </div>
    </div>
  );
}

function Lookups({ id }: { id: string }) {
  const fetchFn = useServerFn(adminTrackingLookups);
  const { data, isPending } = useQuery({ queryKey: ["lookups", id], queryFn: () => fetchFn({ data: { id } }) });
  const rows = (data ?? []) as Array<{ id: string; created_at: string; device: string | null; browser: string | null; os: string | null; city: string | null; region: string | null; country: string | null; ip: string | null }>;
  return (
    <div className="bg-background px-5 pb-5">
      <div className="label-mono mb-1">Tracking lookups {rows[0] ? `· last tracked ${new Date(rows[0].created_at).toLocaleString("en-GB")}` : ""}</div>
      {isPending ? <div className="font-mono text-xs text-muted-foreground">Loading…</div> : rows.length === 0 ? (
        <div className="font-mono text-xs text-muted-foreground">Nobody has tracked this waybill yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-md ring-1 ring-line">
          <table className="w-full font-mono text-xs">
            <thead className="bg-card text-left text-muted-foreground"><tr><th className="p-2">Time</th><th className="p-2">Device</th><th className="p-2">Location</th><th className="p-2">IP</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="p-2">{new Date(r.created_at).toLocaleString("en-GB")}</td>
                <td className="p-2">{[r.device, r.browser, r.os].filter(Boolean).join(" · ") || "Unknown"}</td>
                <td className="p-2">{[r.city, r.region, r.country].filter(Boolean).join(", ") || "Unknown"}</td>
                <td className="p-2">{r.ip ?? "—"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
