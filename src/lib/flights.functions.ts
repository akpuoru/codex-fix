import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonObject = Record<string, any>;

const placeSearchSchema = z.object({
  query: z.string().trim().min(2).max(100),
});

function getDuffelToken(): string {
  // Read inside a request handler. Cloudflare injects runtime secrets per request.
  const token = typeof process !== "undefined" ? process.env.DUFFEL_ACCESS_TOKEN : undefined;
  if (!token) {
    throw new Error("Flight reservations are not connected yet. Please contact Bridgeway support.");
  }
  return token;
}

async function duffelRequest(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`https://api.duffel.com${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Duffel-Version": "v2",
      Authorization: `Bearer ${getDuffelToken()}`,
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage = payload?.errors?.[0]?.message;
    console.error("Duffel request failed", response.status, providerMessage ?? "unknown provider error");
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Flight reservations are temporarily unavailable. Please contact Bridgeway support."
        : providerMessage || "The airline could not confirm this request. Please search again.",
    );
  }
  return payload?.data;
}

export const searchFlightPlaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => placeSearchSchema.parse(input))
  .handler(async ({ data }) => {
    const places = await duffelRequest(`/places/suggestions?query=${encodeURIComponent(data.query)}`);
    return (places ?? [])
      .filter((place: JsonObject) => typeof place.iata_code === "string" && place.iata_code.length === 3)
      .slice(0, 12)
      .map((place: JsonObject) => ({
        id: place.id ?? `${place.type}-${place.iata_code}`,
        code: place.iata_code as string,
        name: place.name as string,
        city: (place.city_name ?? place.city?.name ?? place.name) as string,
        countryCode: (place.iata_country_code ?? "") as string,
        type: (place.type === "city" ? "city" : "airport") as "city" | "airport",
      }));
  });

const searchSchema = z.object({
  origin: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Enter a three-letter airport code."),
  destination: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Enter a three-letter airport code."),
  departureDate: z.string().date(),
  returnDate: z.string().date().optional().or(z.literal("")),
  adults: z.number().int().min(1).max(9),
  cabin: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
});

export const searchFlightOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.origin === data.destination) throw new Error("Choose two different airports.");
    if (data.returnDate && data.returnDate < data.departureDate) {
      throw new Error("The return date must be on or after the departure date.");
    }

    const slices = [
      { origin: data.origin, destination: data.destination, departure_date: data.departureDate },
      ...(data.returnDate
        ? [{ origin: data.destination, destination: data.origin, departure_date: data.returnDate }]
        : []),
    ];
    const result = await duffelRequest("/air/offer_requests?return_offers=true", {
      method: "POST",
      body: JSON.stringify({
        data: {
          slices,
          passengers: Array.from({ length: data.adults }, () => ({ type: "adult" })),
          cabin_class: data.cabin,
        },
      }),
    });

    const offers = (result?.offers ?? []).filter(
      (offer: JsonObject) => offer.payment_requirements?.requires_instant_payment === false,
    );
    return {
      requestId: result?.id as string,
      offers: offers.slice(0, 30),
      searched: { origin: data.origin, destination: data.destination, departureDate: data.departureDate, returnDate: data.returnDate || null },
      adults: data.adults,
    };
  });

export const getFlightSeatMaps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ offerId: z.string().min(8).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const result = await duffelRequest(`/air/seat_maps?offer_id=${encodeURIComponent(data.offerId)}`);
    return result ?? [];
  });

const passengerSchema = z.object({
  title: z.enum(["mr", "mrs", "ms", "miss", "dr"]),
  givenName: z.string().trim().min(1).max(100),
  familyName: z.string().trim().min(1).max(100),
  gender: z.enum(["m", "f"]),
  bornOn: z.string().date(),
  email: z.string().trim().email().max(255),
  phoneNumber: z.string().trim().min(6).max(40),
});

const holdSchema = z.object({
  offerId: z.string().min(8).max(100),
  passengers: z.array(passengerSchema).min(1).max(9),
  seats: z.array(z.object({ serviceId: z.string().min(8).max(100), passengerIndex: z.number().int().min(0).max(8) })).max(90).default([]),
});

function seatServices(seatMaps: JsonObject[], passengerIds: string[]) {
  const available: { id: string; passengerId?: string; segmentId?: string; designator: string }[] = [];
  for (const map of seatMaps) {
    for (const cabin of map.cabins ?? []) {
      for (const row of cabin.rows ?? []) {
        for (const section of row.sections ?? []) {
          for (const element of section.elements ?? []) {
            if (element.type !== "seat" || !element.designator) continue;
            for (const service of element.available_services ?? []) {
              if (!service.id) continue;
              const passengerId = service.passenger_id ?? service.passenger?.id;
              if (passengerId && !passengerIds.includes(passengerId)) continue;
              available.push({ id: service.id, passengerId, segmentId: map.segment_id, designator: element.designator });
            }
          }
        }
      }
    }
  }
  return available;
}

function itinerarySnapshot(order: JsonObject) {
  return (order.slices ?? []).map((slice: JsonObject) => ({
    segments: (slice.segments ?? []).map((segment: JsonObject) => ({
      id: segment.id,
      airline: segment.marketing_carrier?.name ?? segment.operating_carrier?.name ?? "Airline",
      operatingAirline: segment.operating_carrier?.name ?? null,
      flightNumber: segment.marketing_carrier_flight_number ?? segment.operating_carrier_flight_number ?? "",
      origin: {
        code: segment.origin?.iata_code ?? "",
        city: segment.origin?.city_name ?? segment.origin?.name ?? "",
        airport: segment.origin?.name ?? "",
        terminal: segment.origin_terminal ?? null,
      },
      destination: {
        code: segment.destination?.iata_code ?? "",
        city: segment.destination?.city_name ?? segment.destination?.name ?? "",
        airport: segment.destination?.name ?? "",
        terminal: segment.destination_terminal ?? null,
      },
      departingAt: segment.departing_at,
      arrivingAt: segment.arriving_at,
      duration: segment.duration ?? null,
      aircraft: segment.aircraft?.name ?? null,
    })),
  }));
}

function currentFlightStatus(status: string, paymentRequiredBy: string | null): string {
  if (status !== "held") return status;
  if (!paymentRequiredBy) return "needs_review";
  return new Date(paymentRequiredBy).getTime() <= Date.now() ? "expired" : "held";
}

export const createFlightHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => holdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const offer = await duffelRequest(`/air/offers/${encodeURIComponent(data.offerId)}`);
    if (offer?.payment_requirements?.requires_instant_payment !== false) {
      throw new Error("This fare requires payment now. Choose a flight marked Pay later.");
    }
    const offerPassengers = offer?.passengers ?? [];
    if (offerPassengers.length !== data.passengers.length) {
      throw new Error("The passenger count changed. Search for flights again.");
    }

    const seatMaps = data.seats.length
      ? await duffelRequest(`/air/seat_maps?offer_id=${encodeURIComponent(data.offerId)}`)
      : [];
    const allowedSeats = seatServices(seatMaps ?? [], offerPassengers.map((p: JsonObject) => p.id));
    const selectedSeats = data.seats.map((seat) => {
      const available = allowedSeats.find((item) => item.id === seat.serviceId);
      if (!available || (available.passengerId && available.passengerId !== offerPassengers[seat.passengerIndex]?.id)) {
        throw new Error("One of the selected seats is no longer available. Refresh the seat map and try again.");
      }
      return { ...available, passengerIndex: seat.passengerIndex };
    });
    const seatKeySet = new Set(selectedSeats.map((seat) => `${seat.segmentId}:${seat.designator}`));
    if (seatKeySet.size !== selectedSeats.length) throw new Error("A seat can only be assigned to one passenger per flight.");

    // Ensure the database migration and server-side Supabase secret are ready before creating a live hold.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: readinessError } = await (supabaseAdmin as any).from("flight_bookings").select("id").limit(0);
    if (readinessError) {
      console.error("Flight bookings table is not ready", readinessError.message);
      throw new Error("Flight reservations are not set up yet. Please contact Bridgeway support.");
    }

    const passengerPayload = data.passengers.map((passenger, index) => ({
      id: offerPassengers[index].id,
      title: passenger.title,
      given_name: passenger.givenName,
      family_name: passenger.familyName,
      gender: passenger.gender,
      born_on: passenger.bornOn,
      email: passenger.email,
      phone_number: passenger.phoneNumber,
    }));
    const services = selectedSeats.map((seat) => ({ id: seat.id, quantity: 1 }));
    const order = await duffelRequest("/air/orders", {
      method: "POST",
      body: JSON.stringify({
        data: {
          selected_offers: [data.offerId],
          type: "hold",
          passengers: passengerPayload,
          ...(services.length ? { services } : {}),
        },
      }),
    });

    const passengers = data.passengers.map((passenger, passengerIndex) => ({
      givenName: passenger.givenName,
      familyName: passenger.familyName,
      seats: selectedSeats
        .filter((seat) => seat.passengerIndex === passengerIndex)
        .map((seat) => ({ segmentId: seat.segmentId, designator: seat.designator })),
    }));
    const paymentRequiredBy = order.payment_status?.payment_required_by ?? offer.payment_requirements?.payment_required_by ?? null;
    const bookingReferences = order.booking_references ?? [];
    const bookingReference = order.booking_reference ?? bookingReferences[0]?.booking_reference ?? null;
    const row = {
      user_id: context.userId,
      duffel_order_id: order.id,
      booking_reference: bookingReference,
      booking_references: bookingReferences,
      status: bookingReference && paymentRequiredBy ? "held" : "needs_review",
      itinerary: itinerarySnapshot(order),
      passengers,
      total_amount: order.total_amount ?? offer.total_amount,
      total_currency: order.total_currency ?? offer.total_currency,
      payment_required_by: paymentRequiredBy,
      price_guarantee_expires_at: order.payment_status?.price_guarantee_expires_at ?? offer.payment_requirements?.price_guarantee_expires_at ?? null,
    };
    const { data: saved, error: saveError } = await (supabaseAdmin as any)
      .from("flight_bookings")
      .insert(row)
      .select("id")
      .single();
    if (saveError || !saved?.id) {
      console.error("Could not save held flight reservation", saveError?.message ?? "no row returned");
      throw new Error(
        order.booking_reference
          ? `The airline created reservation ${order.booking_reference}, but Bridgeway could not save it. Contact support immediately and provide this reference.`
          : "The airline created a reservation, but Bridgeway could not save it. Contact support immediately.",
      );
    }
    return { id: saved.id as string, bookingReference: bookingReference as string | null };
  });

export const listMyFlightBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const { data, error } = await supabase
      .from("flight_bookings")
      .select("id, booking_reference, status, itinerary, total_amount, total_currency, payment_required_by, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Unable to load your flight reservations.");
    return (data ?? []).map((row: any) => ({
      ...row,
      status: currentFlightStatus(row.status, row.payment_required_by),
    }));
  });

export const getMyFlightBooking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: row, error } = await supabase
      .from("flight_bookings")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !row) return null;
    const booking = row as any;
    return {
      ...booking,
      status: currentFlightStatus(booking.status, booking.payment_required_by),
    };
  });
