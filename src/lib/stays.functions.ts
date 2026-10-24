import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonObject = Record<string, any>;

class DuffelStayHttpError extends Error {
  constructor(message: string, readonly status: number, readonly requestId?: string | null) {
    super(message);
    this.name = "DuffelStayHttpError";
  }
}

function getDuffelToken() {
  const token = typeof process !== "undefined" ? process.env.DUFFEL_ACCESS_TOKEN : undefined;
  if (!token) throw new Error("Hotel reservations are not connected yet. Please contact Bridgeway support.");
  return token;
}

function stayConfig() {
  const token = typeof process !== "undefined" ? process.env.DUFFEL_ACCESS_TOKEN : undefined;
  const testMode = !!token?.startsWith("duffel_test_");
  const liveBookingsEnabled = typeof process !== "undefined" && process.env.DUFFEL_STAYS_BOOKING_ENABLED === "true";
  return { connected: !!token, testMode, bookingsEnabled: testMode || liveBookingsEnabled };
}

async function duffelStayRequest(path: string, init?: RequestInit): Promise<any> {
  let response: Response;
  try {
    response = await fetch(`https://api.duffel.com${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Duffel-Version": "v2",
        Authorization: `Bearer ${getDuffelToken()}`,
        ...init?.headers,
      },
    });
  } catch (error) {
    console.error("Duffel Stays request could not be completed", error);
    throw new Error("Hotel search could not reach the reservation service. Please try again shortly.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage = payload?.errors?.[0]?.message ?? payload?.errors?.[0]?.title;
    const requestId = response.headers.get("duffel-request-id") ?? payload?.meta?.request_id ?? null;
    console.error("Duffel Stays request failed", response.status, requestId ?? "request id unavailable", providerMessage ?? "unknown provider error");
    if (response.status === 401 || response.status === 403) {
      throw new DuffelStayHttpError("Duffel Stays is not enabled for this account or token. Request Stays access in your Duffel dashboard.", response.status, requestId);
    }
    throw new DuffelStayHttpError(providerMessage || "The hotel supplier could not complete this request. Please try again.", response.status, requestId);
  }
  return payload?.data;
}

export const getStayConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => stayConfig());

const placeSearchSchema = z.object({ query: z.string().trim().min(2).max(100) });

export const searchStayPlaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => placeSearchSchema.parse(input))
  .handler(async ({ data }) => {
    const places = await duffelStayRequest(`/places/suggestions?query=${encodeURIComponent(data.query)}`);
    const seen = new Set<string>();
    return (places ?? []).flatMap((place: JsonObject) => {
      const coordinates = [place, ...(place.airports ?? []), ...(place.city?.airports ?? [])]
        .find((item: JsonObject) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
      if (!coordinates) return [];
      const key = `${place.type}-${place.id ?? place.iata_code ?? place.name}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const city = place.type === "city" ? place.name : (place.city_name ?? place.city?.name ?? place.name);
      return [{
        id: place.id ?? key,
        label: place.type === "city" ? city : `${city} · ${place.iata_code ?? ""}`,
        name: place.name as string,
        city: city as string,
        countryCode: (place.iata_country_code ?? place.city?.iata_country_code ?? "") as string,
        latitude: coordinates.latitude as number,
        longitude: coordinates.longitude as number,
        type: (place.type === "city" ? "city" : "airport") as "city" | "airport",
      }];
    }).slice(0, 12);
  });

const staySearchSchema = z.object({
  destination: z.object({
    label: z.string().trim().min(2).max(160),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.number().int().min(1).max(9),
  rooms: z.number().int().min(1).max(8),
  freeCancellationOnly: z.boolean().default(false),
  testHotels: z.boolean().default(false),
});

export const searchStays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => staySearchSchema.parse(input))
  .handler(async ({ data }) => {
    const today = new Date().toISOString().slice(0, 10);
    if (data.checkIn < today) throw new Error("Choose a future check-in date.");
    if (data.checkOut <= data.checkIn) throw new Error("Check-out must be after check-in.");
    const nights = Math.round((Date.parse(`${data.checkOut}T00:00:00Z`) - Date.parse(`${data.checkIn}T00:00:00Z`)) / 86400000);
    if (nights > 99) throw new Error("A stay can be no longer than 99 nights.");
    const latestCheckIn = new Date();
    latestCheckIn.setUTCDate(latestCheckIn.getUTCDate() + 330);
    if (data.checkIn > latestCheckIn.toISOString().slice(0, 10)) throw new Error("Check-in can be no more than 330 days ahead.");

    const testMode = stayConfig().testMode;
    if (data.testHotels && !testMode) throw new Error("Duffel Test Hotels are only available with a test access token.");
    const location = data.testHotels
      ? { latitude: -24.38, longitude: -128.32 }
      : { latitude: data.destination.latitude, longitude: data.destination.longitude };
    const result = await duffelStayRequest("/stays/search", {
      method: "POST",
      body: JSON.stringify({
        data: {
          check_in_date: data.checkIn,
          check_out_date: data.checkOut,
          rooms: data.rooms,
          guests: Array.from({ length: data.adults }, () => ({ type: "adult" })),
          free_cancellation_only: data.freeCancellationOnly,
          location: {
            radius: data.testHotels ? 2 : 20,
            geographic_coordinates: { latitude: location.latitude, longitude: location.longitude },
          },
        },
      }),
    });

    return {
      nights,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      adults: data.adults,
      rooms: data.rooms,
      testHotels: data.testHotels,
      destination: data.testHotels ? "Duffel Test Hotels" : data.destination.label,
      results: (result?.results ?? []).slice(0, 30).map((item: JsonObject) => ({
        id: item.id,
        expiresAt: item.expires_at,
        checkIn: item.check_in_date,
        checkOut: item.check_out_date,
        rooms: item.rooms,
        guests: item.guests,
        cheapestTotal: item.cheapest_rate_total_amount,
        cheapestCurrency: item.cheapest_rate_currency,
        accommodation: item.accommodation,
      })),
    };
  });

const searchResultSchema = z.object({ searchResultId: z.string().min(8).max(100) });

export const fetchStayRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchResultSchema.parse(input))
  .handler(async ({ data }) => duffelStayRequest(
    `/stays/search_results/${encodeURIComponent(data.searchResultId)}/actions/fetch_all_rates`,
    { method: "POST" },
  ));

const rateSchema = z.object({ rateId: z.string().min(8).max(100) });

export const createStayQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rateSchema.parse(input))
  .handler(async ({ data }) => duffelStayRequest("/stays/quotes", {
    method: "POST",
    body: JSON.stringify({ data: { rate_id: data.rateId } }),
  }));

function hasBalancePayment(quote: JsonObject) {
  const methods = quote.available_payment_methods
    ?? quote.accommodation?.rooms?.flatMap((room: JsonObject) => room.rates ?? []).find((rate: JsonObject) => rate.id === quote.rate_id)?.available_payment_methods
    ?? quote.accommodation?.rooms?.[0]?.rates?.[0]?.available_payment_methods
    ?? [];
  return Array.isArray(methods) && methods.some((method: unknown) =>
    Array.isArray(method) ? method.includes("balance") : method === "balance",
  );
}

function compactAccommodation(accommodation: JsonObject) {
  return {
    id: accommodation?.id ?? null,
    name: accommodation?.name ?? "Accommodation",
    description: accommodation?.description ?? null,
    rating: accommodation?.rating ?? null,
    review_score: accommodation?.review_score ?? null,
    review_count: accommodation?.review_count ?? null,
    location: accommodation?.location ?? null,
    photos: accommodation?.photos ?? [],
    amenities: accommodation?.amenities ?? [],
    check_in_information: accommodation?.check_in_information ?? null,
    key_collection: accommodation?.key_collection ?? null,
    chain: accommodation?.chain ?? null,
  };
}

const createStayBookingSchema = z.object({
  quoteId: z.string().min(8).max(100),
  expectedTotalAmount: z.string().regex(/^\d+(?:\.\d{1,4})?$/),
  expectedTotalCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  acceptTerms: z.literal(true),
  email: z.string().trim().email().max(255),
  phoneNumber: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Use an international number, such as +2348012345678."),
  guests: z.array(z.object({
    givenName: z.string().trim().min(1).max(100),
    familyName: z.string().trim().min(1).max(100),
  })).min(1).max(9),
  specialRequests: z.string().trim().max(500).optional().or(z.literal("")),
});

export const createStayBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createStayBookingSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!stayConfig().bookingsEnabled) {
      throw new Error("Live hotel booking is paused until Bridgeway enables its Duffel Stays payment setup.");
    }

    const quote = await duffelStayRequest(`/stays/quotes/${encodeURIComponent(data.quoteId)}`);
    if (!quote?.id || quote.id !== data.quoteId) throw new Error("This hotel quote has expired. Select the room again for a fresh quote.");
    if (quote.expires_at && new Date(quote.expires_at).getTime() <= Date.now()) throw new Error("This hotel quote has expired. Select the room again for a fresh quote.");
    if (quote.total_currency !== data.expectedTotalCurrency || Number(quote.total_amount) !== Number(data.expectedTotalAmount)) {
      throw new Error("The hotel price changed. Review a fresh quote before confirming.");
    }
    if (!hasBalancePayment(quote)) {
      throw new Error("This room rate cannot be booked with Bridgeway’s current Duffel payment setup. Choose a rate that accepts Duffel Balance.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = (supabaseAdmin as any).from("stay_bookings");
    const { error: readinessError } = await table.select("id").limit(0);
    if (readinessError) {
      console.error("Stay bookings table is not ready", readinessError.message);
      throw new Error("Hotel reservations are not set up yet. Apply the hotel bookings migration and contact Bridgeway support if this persists.");
    }

    const selectedRate = quote.accommodation?.rooms?.flatMap((room: JsonObject) => room.rates ?? []).find((rate: JsonObject) => rate.id === quote.rate_id)
      ?? quote.accommodation?.rooms?.[0]?.rates?.[0]
      ?? {};
    const accommodation = compactAccommodation(quote.accommodation ?? {});
    const guestDetails = { email: data.email, phoneNumber: data.phoneNumber, guests: data.guests };
    const bookingData = {
      paymentType: selectedRate.payment_type ?? "unknown",
      paymentMethod: "balance",
      roomName: quote.accommodation?.rooms?.[0]?.name ?? "Room",
      rateName: selectedRate.name ?? "Selected rate",
      boardType: selectedRate.board_type ?? null,
      benefits: selectedRate.benefits ?? [],
      cancellationTimeline: selectedRate.cancellation_timeline ?? [],
      conditions: selectedRate.conditions ?? [],
      specialRequests: data.specialRequests || null,
    };
    const { data: attempt, error: attemptError } = await table.insert({
      user_id: context.userId,
      duffel_quote_id: quote.id,
      status: "booking_pending",
      check_in_date: quote.check_in_date,
      check_out_date: quote.check_out_date,
      rooms: quote.rooms ?? 1,
      accommodation,
      guest_details: guestDetails,
      total_amount: quote.total_amount,
      total_currency: quote.total_currency,
      deposit_amount: quote.deposit_amount ?? null,
      deposit_currency: quote.deposit_currency ?? null,
      due_at_accommodation_amount: quote.due_at_accommodation_amount ?? null,
      due_at_accommodation_currency: quote.due_at_accommodation_currency ?? null,
      booking_data: bookingData,
      quote_expires_at: quote.expires_at ?? null,
    }).select("id").single();

    if (attemptError || !attempt?.id) {
      const { data: previous } = await (supabaseAdmin as any).from("stay_bookings")
        .select("id, booking_reference, status")
        .eq("duffel_quote_id", quote.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (previous?.status === "confirmed") return { id: previous.id, bookingReference: previous.booking_reference, status: "confirmed" };
      if (previous) throw new Error("This quote already has a booking attempt. Check your reservations or contact Bridgeway support before trying again.");
      console.error("Could not lock stay quote for booking", attemptError?.message ?? "no reservation row returned");
      throw new Error("Bridgeway could not prepare this reservation. Please refresh the quote and try again.");
    }

    let booking: JsonObject;
    try {
      booking = await duffelStayRequest("/stays/bookings", {
        method: "POST",
        body: JSON.stringify({
          data: {
            quote_id: quote.id,
            email: data.email,
            phone_number: data.phoneNumber,
            guests: data.guests.map((guest) => ({ given_name: guest.givenName, family_name: guest.familyName })),
            ...(data.specialRequests ? { accommodation_special_requests: data.specialRequests } : {}),
          },
        }),
      });
    } catch (error) {
      const isDefinitiveClientError = error instanceof DuffelStayHttpError && error.status < 500 && ![408, 425, 429].includes(error.status);
      await (supabaseAdmin as any).from("stay_bookings").update({ status: isDefinitiveClientError ? "failed" : "needs_review" }).eq("id", attempt.id);
      if (isDefinitiveClientError) throw error;
      console.error("Hotel booking result could not be confirmed", error);
      const reference = error instanceof DuffelStayHttpError && error.requestId ? ` Duffel request ID: ${error.requestId}.` : "";
      throw new Error(`The hotel supplier did not confirm the result. Do not submit this booking again yet; contact Bridgeway support so we can check it.${reference}`);
    }

    if (!booking?.id) {
      await (supabaseAdmin as any).from("stay_bookings").update({ status: "needs_review" }).eq("id", attempt.id);
      throw new Error("The hotel supplier response needs verification. Do not retry; contact Bridgeway support.");
    }

    const status = booking.status === "confirmed" || booking.status === "cancelled" ? booking.status : "needs_review";
    const finalAccommodation = compactAccommodation(booking.accommodation ?? quote.accommodation ?? {});
    const { error: saveError } = await (supabaseAdmin as any).from("stay_bookings").update({
      duffel_booking_id: booking.id,
      booking_reference: booking.reference ?? null,
      status,
      confirmed_at: booking.confirmed_at ?? null,
      accommodation: finalAccommodation,
      guest_details: {
        email: booking.email ?? data.email,
        phoneNumber: booking.phone_number ?? data.phoneNumber,
        guests: (booking.guests ?? data.guests).map((guest: JsonObject) => ({
          givenName: guest.given_name ?? guest.givenName,
          familyName: guest.family_name ?? guest.familyName,
        })),
      },
      booking_data: {
        ...bookingData,
        paymentType: selectedRate.payment_type ?? "unknown",
        cancellationTimeline: selectedRate.cancellation_timeline ?? [],
        conditions: selectedRate.conditions ?? [],
        keyCollection: finalAccommodation.key_collection,
        checkInInformation: finalAccommodation.check_in_information,
      },
    }).eq("id", attempt.id);

    if (saveError) {
      console.error("Hotel booking confirmed but not saved locally", saveError.message);
      throw new Error(booking.reference
        ? `The hotel reservation is confirmed as ${booking.reference}, but Bridgeway could not save it. Contact support and provide this reference.`
        : "The hotel supplier confirmed a reservation, but Bridgeway could not save it. Contact support immediately.");
    }
    return { id: attempt.id as string, bookingReference: booking.reference as string | null, status };
  });

export const listMyStayBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("stay_bookings")
      .select("id, booking_reference, status, check_in_date, check_out_date, rooms, accommodation, guest_details, total_amount, total_currency, deposit_amount, deposit_currency, due_at_accommodation_amount, due_at_accommodation_currency, confirmed_at, booking_data, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Unable to load your hotel reservations.");
    return data ?? [];
  });
