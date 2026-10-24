import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonObject = Record<string, any>;

class DuffelHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DuffelHttpError";
  }
}

function getDuffelToken(): string {
  const token = typeof process !== "undefined" ? process.env.DUFFEL_ACCESS_TOKEN : undefined;
  if (!token) {
    throw new Error("Car hire is not connected yet. Please contact Bridgeway support.");
  }
  return token;
}

async function duffelCarRequest(path: string, init?: RequestInit): Promise<any> {
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
    console.error("Duffel car request could not be completed", error);
    throw new Error("Car hire could not reach the rental service. Please try again shortly.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage = payload?.errors?.[0]?.message;
    console.error("Duffel car request failed", response.status, providerMessage ?? "unknown provider error");
    if (response.status === 401 || response.status === 403) {
      throw new DuffelHttpError("Duffel did not authorize car hire. Check that Cars access is enabled for this account and its production token is valid.", response.status);
    }
    throw new DuffelHttpError(providerMessage || "The rental company could not complete this request. Please search again.", response.status);
  }
  return payload?.data;
}

const placeSearchSchema = z.object({ query: z.string().trim().min(2).max(100) });

export const searchCarPlaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => placeSearchSchema.parse(input))
  .handler(async ({ data }) => {
    const places = await duffelCarRequest(`/places/suggestions?query=${encodeURIComponent(data.query)}`);
    const airports = (places ?? []).flatMap((place: JsonObject) =>
      place.type === "airport" ? [place] : place.airports ?? [],
    );
    const seen = new Set<string>();
    return airports
      .filter((place: JsonObject) =>
        typeof place.iata_code === "string" &&
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude),
      )
      .filter((place: JsonObject) => {
        if (seen.has(place.iata_code)) return false;
        seen.add(place.iata_code);
        return true;
      })
      .slice(0, 12)
      .map((place: JsonObject) => ({
        id: place.id ?? `airport-${place.iata_code}`,
        code: place.iata_code as string,
        name: place.name as string,
        city: (place.city_name ?? place.city?.name ?? place.name) as string,
        countryCode: (place.iata_country_code ?? "") as string,
        latitude: place.latitude as number,
        longitude: place.longitude as number,
      }));
  });

const locationSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const carSearchSchema = z.object({
  pickup: locationSchema,
  dropoff: locationSchema,
  pickupDate: z.string().date(),
  pickupTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  dropoffDate: z.string().date(),
  dropoffTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  driverAge: z.number().int().min(18).max(99),
  residenceCountryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
});

function ageOnDate(dateOfBirth: string, date: string) {
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const at = new Date(`${date}T00:00:00.000Z`);
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  if (
    at.getUTCMonth() < birth.getUTCMonth() ||
    (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate())
  ) age -= 1;
  return age;
}

export const searchCarRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => carSearchSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.pickupDate < new Date().toISOString().slice(0, 10)) throw new Error("Choose a future pickup date.");
    if (data.dropoffDate < data.pickupDate || (data.dropoffDate === data.pickupDate && data.dropoffTime <= data.pickupTime)) {
      throw new Error("Drop-off must be after pick-up.");
    }

    const result = await duffelCarRequest("/cars/search", {
      method: "POST",
      body: JSON.stringify({
        data: {
          pickup_date: data.pickupDate,
          pickup_time: data.pickupTime,
          pickup_location: {
            radius: 5,
            geographic_coordinates: { latitude: data.pickup.latitude, longitude: data.pickup.longitude },
          },
          dropoff_date: data.dropoffDate,
          dropoff_time: data.dropoffTime,
          dropoff_location: {
            radius: 5,
            geographic_coordinates: { latitude: data.dropoff.latitude, longitude: data.dropoff.longitude },
          },
          driver: { age: data.driverAge, residence_country_code: data.residenceCountryCode },
        },
      }),
    });

    const allRates = result?.rates ?? [];
    const rates = allRates.filter((rate: JsonObject) => rate.payment_type === "postpaid");
    return {
      searchId: result?.id as string | undefined,
      paymentTypeCounts: {
        total: allRates.length,
        postpaid: allRates.filter((rate: JsonObject) => rate.payment_type === "postpaid").length,
        guarantee: allRates.filter((rate: JsonObject) => rate.payment_type === "guarantee").length,
        prepaid: allRates.filter((rate: JsonObject) => rate.payment_type === "prepaid").length,
      },
      search: {
        pickup: data.pickup,
        dropoff: data.dropoff,
        pickupDate: data.pickupDate,
        pickupTime: data.pickupTime,
        dropoffDate: data.dropoffDate,
        dropoffTime: data.dropoffTime,
        driverAge: data.driverAge,
        residenceCountryCode: data.residenceCountryCode,
      },
      rates: rates.slice(0, 40),
    };
  });

const quoteSchema = z.object({ rateId: z.string().min(8).max(100) });

export const createCarQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => quoteSchema.parse(input))
  .handler(async ({ data }) => {
    const quote = await duffelCarRequest("/cars/quotes", {
      method: "POST",
      body: JSON.stringify({ data: { rate_id: data.rateId } }),
    });
    if (quote?.payment_type !== "postpaid") {
      throw new Error("This rental requires payment or a card guarantee at booking. Choose a pay-at-counter option.");
    }
    return quote;
  });

function disclosureKey(disclosure: JsonObject) {
  return JSON.stringify([disclosure.title ?? "", disclosure.text ?? ""]);
}

const carBookingSchema = z.object({
  rateId: z.string().min(8).max(100),
  expectedDriverAge: z.number().int().min(18).max(99),
  quotedAmount: z.string().regex(/^\d+(?:\.\d{1,4})?$/),
  quotedCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  acceptedPolicyKeys: z.array(z.string().max(10000)).max(20).default([]),
  acceptedConditionKeys: z.array(z.string().max(10000)).max(50).default([]),
  acceptRentalTerms: z.literal(true),
  driver: z.object({
    givenName: z.string().trim().min(1).max(100),
    familyName: z.string().trim().min(1).max(100),
    dateOfBirth: z.string().date(),
    email: z.string().trim().email().max(255),
    phoneNumber: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Use an international phone number, such as +2348012345678."),
  }),
  inboundFlightNumber: z.string().trim().max(30).optional().or(z.literal("")),
});

export const createCarBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => carBookingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const quote = await duffelCarRequest("/cars/quotes", {
      method: "POST",
      body: JSON.stringify({ data: { rate_id: data.rateId } }),
    });
    if (quote?.payment_type !== "postpaid") {
      throw new Error("This rental is no longer available as pay-at-counter. Choose another car.");
    }
    if (
      quote.total_currency !== data.quotedCurrency ||
      Number(quote.total_amount) !== Number(data.quotedAmount)
    ) {
      throw new Error("The rental price changed. Review the updated quote before confirming.");
    }

    const policies = quote.privacy_policies ?? [];
    const conditions = quote.conditions ?? [];
    const acceptedPolicies = new Set(data.acceptedPolicyKeys);
    const acceptedConditions = new Set(data.acceptedConditionKeys);
    if (policies.some((item: JsonObject) => !acceptedPolicies.has(disclosureKey(item)))) {
      throw new Error("Review and accept each current supplier data policy before booking.");
    }
    if (conditions.some((item: JsonObject) => !acceptedConditions.has(disclosureKey(item)))) {
      throw new Error("The rental terms changed. Review and accept the current terms before booking.");
    }

    const age = ageOnDate(data.driver.dateOfBirth, quote.pickup_date);
    if (age < 18 || age > 99) throw new Error("The main driver must be 18–99 years old on the pickup date.");
    if (age !== data.expectedDriverAge) {
      throw new Error("The driver’s date of birth does not match the age used for this search. Search again with the correct age.");
    }

    // Check database readiness before placing a live reservation with the supplier.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: readinessError } = await (supabaseAdmin as any).from("car_bookings").select("id").limit(0);
    if (readinessError) {
      console.error("Car bookings table is not ready", readinessError.message);
      throw new Error("Car reservations are not set up yet. Please contact Bridgeway support.");
    }

    let booking: JsonObject;
    try {
      booking = await duffelCarRequest("/cars/bookings", {
        method: "POST",
        body: JSON.stringify({
          data: {
            quote_id: quote.id,
            driver: {
              given_name: data.driver.givenName,
              family_name: data.driver.familyName,
              date_of_birth: data.driver.dateOfBirth,
              email: data.driver.email,
              phone_number: data.driver.phoneNumber,
            },
            ...(data.inboundFlightNumber ? { inbound_flight_number: data.inboundFlightNumber } : {}),
          },
        }),
      });
    } catch (error) {
      if (error instanceof DuffelHttpError && error.status < 500 && ![408, 425, 429].includes(error.status)) {
        throw error;
      }
      console.error("Car booking creation outcome could not be confirmed", error);
      throw new Error("The rental supplier did not confirm the result. Do not submit again yet; contact Bridgeway support so we can check the booking.");
    }

    if (!booking?.id) {
      console.error("Duffel car booking response did not include an ID", booking?.reference ?? "no reference");
      throw new Error("The supplier response needs verification. Do not retry; contact Bridgeway support.");
    }

    const bookingStatus = booking.status === "confirmed" || booking.status === "cancelled"
      ? booking.status
      : "needs_review";

    const bookingData = {
      id: booking.id,
      reference: booking.reference ?? null,
      status: bookingStatus,
      paymentType: booking.payment_type ?? quote.payment_type,
      confirmedAt: booking.confirmed_at ?? null,
      pickupDate: booking.pickup_date ?? quote.pickup_date,
      pickupTime: booking.pickup_time ?? quote.pickup_time,
      pickupLocation: booking.pickup_location ?? quote.pickup_location,
      dropoffDate: booking.dropoff_date ?? quote.dropoff_date,
      dropoffTime: booking.dropoff_time ?? quote.dropoff_time,
      dropoffLocation: booking.dropoff_location ?? quote.dropoff_location,
      car: booking.car ?? quote.car,
      supplier: booking.supplier ?? quote.supplier,
      driver: {
        givenName: booking.driver?.given_name ?? data.driver.givenName,
        familyName: booking.driver?.family_name ?? data.driver.familyName,
        email: booking.driver?.email ?? data.driver.email,
        phoneNumber: booking.driver?.phone_number ?? data.driver.phoneNumber,
      },
      conditions: booking.conditions ?? quote.conditions ?? [],
      charges: booking.charges ?? quote.charges ?? [],
      privacyPolicies: booking.privacy_policies ?? quote.privacy_policies ?? [],
      mileage: booking.mileage ?? quote.mileage ?? null,
      totalAmount: booking.total_amount ?? quote.total_amount,
      totalCurrency: booking.total_currency ?? quote.total_currency,
      inboundFlightNumber: data.inboundFlightNumber || null,
    };
    const { data: saved, error: saveError } = await (supabaseAdmin as any)
      .from("car_bookings")
      .insert({
        user_id: context.userId,
        duffel_booking_id: booking.id,
        booking_reference: booking.reference ?? null,
        status: bookingStatus,
        payment_type: "postpaid",
        pickup_date: bookingData.pickupDate,
        pickup_time: bookingData.pickupTime,
        dropoff_date: bookingData.dropoffDate,
        dropoff_time: bookingData.dropoffTime,
        pickup_location: bookingData.pickupLocation,
        dropoff_location: bookingData.dropoffLocation,
        car: bookingData.car,
        supplier: bookingData.supplier,
        driver: bookingData.driver,
        conditions: bookingData.conditions,
        charges: bookingData.charges,
        privacy_policies: bookingData.privacyPolicies,
        mileage: bookingData.mileage,
        total_amount: bookingData.totalAmount,
        total_currency: bookingData.totalCurrency,
        confirmed_at: bookingData.confirmedAt,
        booking_data: bookingData,
      })
      .select("id")
      .single();

    if (saveError || !saved?.id) {
      console.error("Car reservation was created but not saved locally", saveError?.message ?? "no row returned");
      throw new Error(
        booking.reference
          ? `The rental is confirmed as ${booking.reference}, but Bridgeway could not save it. Contact support and provide this reference.`
          : "The rental supplier confirmed a booking, but Bridgeway could not save it. Contact support immediately.",
      );
    }

    return { id: saved.id as string, bookingReference: booking.reference as string | null, status: bookingStatus };
  });

export const listMyCarBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("car_bookings")
      .select("id, booking_reference, status, payment_type, pickup_date, pickup_time, dropoff_date, dropoff_time, pickup_location, dropoff_location, car, supplier, driver, conditions, charges, privacy_policies, mileage, total_amount, total_currency, confirmed_at, booking_data, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Unable to load your car reservations.");
    return data ?? [];
  });
