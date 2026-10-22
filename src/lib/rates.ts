export type ServiceKind = "courier" | "luggage" | "freight";
export type ServiceLevel = "express" | "standard" | "economy";

export const SERVICE_KINDS: { value: ServiceKind; label: string; blurb: string }[] = [
  { value: "courier", label: "Courier parcel", blurb: "Documents and parcels, door to door" },
  { value: "luggage", label: "Luggage", blurb: "Bags shipped ahead of the traveller" },
  { value: "freight", label: "Freight", blurb: "Pallets and consolidated cargo" },
];

export const SERVICE_LEVELS: {
  value: ServiceLevel;
  label: string;
  days: string;
  multiplier: number;
}[] = [
  { value: "express", label: "Express", days: "1-2 days", multiplier: 1.6 },
  { value: "standard", label: "Standard", days: "3-5 days", multiplier: 1 },
  { value: "economy", label: "Economy", days: "6-10 days", multiplier: 0.72 },
];

export interface PricingConfig {
  currency: string;
  kinds: Record<ServiceKind, { base: number; perKg: number }>;
  levels: Record<ServiceLevel, number>;
  fuel: number; // fraction, e.g. 0.085
  international: number; // multiplier
  extraPiece: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  currency: "EUR",
  kinds: {
    courier: { base: 24, perKg: 4.1 },
    luggage: { base: 32, perKg: 2.6 },
    freight: { base: 68, perKg: 1.45 },
  },
  levels: { express: 1.6, standard: 1, economy: 0.72 },
  fuel: 0.085,
  international: 1.18,
  extraPiece: 6,
};

export const CURRENCIES = ["EUR", "USD", "GBP", "NGN", "GHS", "KES", "ZAR", "AED", "CAD", "AUD", "JPY", "CNY", "INR"];

export function mergePricing(currency: string | null | undefined, rates: unknown): PricingConfig {
  const r = (rates && typeof rates === "object" ? rates : {}) as Partial<PricingConfig>;
  return {
    currency: currency || DEFAULT_PRICING.currency,
    kinds: {
      courier: { ...DEFAULT_PRICING.kinds.courier, ...r.kinds?.courier },
      luggage: { ...DEFAULT_PRICING.kinds.luggage, ...r.kinds?.luggage },
      freight: { ...DEFAULT_PRICING.kinds.freight, ...r.kinds?.freight },
    },
    levels: { ...DEFAULT_PRICING.levels, ...r.levels },
    fuel: r.fuel ?? DEFAULT_PRICING.fuel,
    international: r.international ?? DEFAULT_PRICING.international,
    extraPiece: r.extraPiece ?? DEFAULT_PRICING.extraPiece,
  };
}

// Active pricing; set from site settings by the root loader.
let active: PricingConfig = DEFAULT_PRICING;
export function setPricing(p: PricingConfig) {
  active = p;
}
export function getPricing() {
  return active;
}

export interface QuoteInput {
  kind: ServiceKind;
  level: ServiceLevel;
  weightKg: number;
  lengthCm?: number | undefined;
  widthCm?: number | undefined;
  heightCm?: number | undefined;
  pieces?: number | undefined;
  international?: boolean;
}

export interface Quote {
  chargeableKg: number;
  netEur: number;
  fuelEur: number;
  totalEur: number;
  transitDays: string;
}

export function volumetricKg(l?: number, w?: number, h?: number): number {
  if (!l || !w || !h) return 0;
  return (l * w * h) / 5000;
}

export function quoteShipment(input: QuoteInput, cfg: PricingConfig = active): Quote {
  const pieces = Math.max(1, input.pieces ?? 1);
  const volumetric = volumetricKg(input.lengthCm, input.widthCm, input.heightCm) * pieces;
  const actual = Math.max(0.5, input.weightKg || 0.5);
  const chargeableKg = Math.round(Math.max(actual, volumetric) * 10) / 10;

  const kind = cfg.kinds[input.kind];
  const level = SERVICE_LEVELS.find((l) => l.value === input.level) ?? SERVICE_LEVELS[1]!;

  let net = (kind.base + kind.perKg * chargeableKg) * (cfg.levels[level.value] ?? level.multiplier);
  if (input.international !== false) net *= cfg.international;
  if (pieces > 1) net += (pieces - 1) * cfg.extraPiece;

  const netEur = Math.round(net * 100) / 100;
  const fuelEur = Math.round(netEur * cfg.fuel * 100) / 100;

  return {
    chargeableKg,
    netEur,
    fuelEur,
    totalEur: Math.round((netEur + fuelEur) * 100) / 100,
    transitDays: level.days,
  };
}

export function formatEur(value: number, currency: string = active.currency): string {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatCents(cents: number, currency?: string): string {
  return formatEur(cents / 100, currency);
}

export const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  picked_up: "Picked up",
  in_transit: "In transit",
  customs: "Customs",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "Exception",
};

export const STATUS_PROGRESS: Record<string, number> = {
  booked: 8,
  picked_up: 25,
  in_transit: 55,
  customs: 70,
  out_for_delivery: 88,
  delivered: 100,
  exception: 45,
};
