import { NextRequest, NextResponse } from "next/server";
import { fetchKaiserProviders, type KaiserProvider } from "../kaiser/route";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// ── Security ─────────────────────────────────────────────────────────────────

const SEC_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

function secureJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...((init as Record<string, string> | undefined) ?? {}), ...SEC_HEADERS },
  });
}

function sanitize(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

interface OpenPeriodPoint {
  day: number;
  hour?: number;
  minute?: number;
  time?: string; // legacy "HHMM" fallback
}

interface OpenPeriod {
  open: OpenPeriodPoint;
  close?: OpenPeriodPoint;
}

interface RegularOpeningHours {
  openNow?: boolean;
  periods?: OpenPeriod[];
}

interface NewPlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: RegularOpeningHours;
  photos?: Array<{ name: string }>;
  primaryTypeDisplayName?: { text: string };
  location?: { latitude: number; longitude: number };
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.regularOpeningHours",
  "places.photos",
  "places.primaryTypeDisplayName",
  "places.location",
].join(",");

const GRACEFUL_ERROR = {
  providers: [],
  urgency_banner: null,
  error: "provider_search_unavailable",
  message: "Unable to find nearby providers at this time",
};

type Urgency = "emergency" | "today" | "this_week" | "routine";

function urgencyBanner(urgency: Urgency): { message: string; type: "emergency" | "urgent" } | null {
  if (urgency === "emergency") {
    return {
      message: "🚨 This may be a medical emergency. Go to the nearest ER immediately or call 911.",
      type: "emergency",
    };
  }
  if (urgency === "today") {
    return {
      message: "⚠️ You should be seen today. Head to urgent care or call your doctor now.",
      type: "urgent",
    };
  }
  return null;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const miles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return `${miles.toFixed(1)} mi`;
}

function matchesInsurance(providerName: string, insuranceProvider: string): boolean {
  if (!insuranceProvider) return false;
  const stopWords = new Set(["and", "the", "with", "blue", "cross"]);
  const keywords = insuranceProvider
    .toLowerCase()
    .split(/[\s/,&()+]+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
  const name = providerName.toLowerCase();
  return keywords.some((kw) => name.includes(kw));
}

// ── Hours helpers ────────────────────────────────────────────────────────────

function formatHoursTime(point: OpenPeriodPoint): string {
  let hour: number;
  let minute: number;
  if (point.hour !== undefined) {
    hour = point.hour;
    minute = point.minute ?? 0;
  } else if (point.time) {
    hour = parseInt(point.time.slice(0, 2), 10);
    minute = parseInt(point.time.slice(2, 4), 10);
  } else {
    return "";
  }
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  const displayMinute = minute > 0 ? `:${minute.toString().padStart(2, "0")}` : "";
  return `${displayHour}${displayMinute} ${period}`;
}

function getTodayHours(hours: RegularOpeningHours | undefined): string | null {
  if (!hours?.periods?.length) return null;
  const today = new Date().getDay(); // 0=Sunday … 6=Saturday
  // A single period covering the whole week (24/7) has open.day === 0 and no close
  if (hours.periods.length === 1 && !hours.periods[0].close) return "Open 24 hours";
  const period = hours.periods.find((p) => p.open.day === today);
  if (!period) return "Closed today";
  if (!period.close) return "Open 24 hours";
  return `Today: ${formatHoursTime(period.open)} – ${formatHoursTime(period.close)}`;
}

function getNextOpenTime(hours: RegularOpeningHours | undefined, currentDay: number): string | null {
  if (!hours?.periods?.length) return null;
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (let i = 1; i <= 7; i++) {
    const nextDay = (currentDay + i) % 7;
    const period = hours.periods.find((p) => p.open.day === nextDay);
    if (period) {
      const label = i === 1 ? "Tomorrow" : DAY_NAMES[nextDay];
      return `${label} at ${formatHoursTime(period.open)}`;
    }
  }
  return null;
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

function minMaxNorm(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function minutesUntilClosingNow(hours: RegularOpeningHours | undefined): number | null {
  if (!hours?.periods?.length) return null;
  const now = new Date();
  const today = now.getDay();
  const period = hours.periods.find((p) => p.open.day === today);
  if (!period?.close) return null;
  let hour: number;
  let minute: number;
  if (period.close.hour !== undefined) {
    hour = period.close.hour;
    minute = period.close.minute ?? 0;
  } else if (period.close.time) {
    hour = parseInt(period.close.time.slice(0, 2), 10);
    minute = parseInt(period.close.time.slice(2, 4), 10);
  } else {
    return null;
  }
  const close = new Date();
  close.setHours(hour, minute, 0, 0);
  const diff = Math.floor((close.getTime() - now.getTime()) / 60_000);
  return diff >= 0 && diff <= 60 ? diff : null;
}

function availabilityScore(openNow: boolean | null, minsUntilClose: number | null): number {
  if (openNow === null) return 0.5;   // unknown hours → neutral
  if (openNow === false) return 0.0;  // closed
  if (minsUntilClose === null) return 1.0; // open and not closing soon
  return 0.5 + (minsUntilClose / 60) * 0.4; // grades 0.5–0.9 based on time left
}

// ── Places API ───────────────────────────────────────────────────────────────

async function callPlacesAPI(
  payload: Record<string, unknown>
): Promise<{ places?: NewPlaceResult[] } | null> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY!,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("[providers] Places API returned non-OK status:", res.status);
      return null;
    }

    return await res.json();
  } catch {
    console.error("[providers] Places API fetch failed");
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return secureJson({ error: "Too many requests" }, { status: 429 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return secureJson(
      { ...GRACEFUL_ERROR, error: "invalid_request", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { specialist_needed, urgency = "routine", location, insurance_provider, city, state } = body;

  // ── Input validation & sanitization ──────────────────────────────────────
  if (!specialist_needed || typeof specialist_needed !== "string" || !specialist_needed.trim()) {
    return secureJson(
      { ...GRACEFUL_ERROR, error: "invalid_request", message: "specialist_needed is required" },
      { status: 400 }
    );
  }

  const cleanSpecialist = sanitize(specialist_needed);
  const cleanInsurance =
    typeof insurance_provider === "string" ? sanitize(insurance_provider) : "";

  const lat = Number((location as Record<string, unknown>)?.lat);
  const lng = Number((location as Record<string, unknown>)?.lng);

  if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
    return secureJson(
      {
        ...GRACEFUL_ERROR,
        error: "invalid_request",
        message: "Valid lat/lng coordinates are required (lat: -90 to 90, lng: -180 to 180)",
      },
      { status: 400 }
    );
  }

  const urg: Urgency = (["emergency", "today", "this_week", "routine"] as const).includes(
    urgency as Urgency
  )
    ? (urgency as Urgency)
    : "routine";

  const maxResults = urg === "emergency" ? 3 : 5;

  // ── Kaiser direct lookup ─────────────────────────────────────────────────
  const isKaiser = cleanInsurance.toLowerCase().includes("kaiser");
  if (isKaiser && typeof city === "string" && city.trim() && typeof state === "string" && state.trim()) {
    const { providers: kaiserProviders, error: kaiserError } = await fetchKaiserProviders(
      sanitize(city),
      sanitize(state)
    );

    if (!kaiserError && kaiserProviders.length > 0) {
      return secureJson({
        providers: kaiserProviders.map((p: KaiserProvider, i: number) => ({
          name: p.name,
          address: p.address,
          phone: p.phone,
          credentials: p.credentials,
          source: "kaiser",
          rating: null,
          user_ratings_total: null,
          distance: null,
          website: "",
          maps_link: `https://healthy.kaiserpermanente.org/find-a-doctor`,
          place_id: null,
          open_now: null,
          photo_url: null,
          primary_type: cleanSpecialist,
          insurance_match: true,
          today_hours: null,
          next_open: null,
          top_match: i === 0,
        })),
        urgency_banner: urgencyBanner(urg),
        insurance_note:
          "These results come directly from Kaiser Permanente's provider directory. Verify availability by calling the number on your Kaiser member card.",
      });
    }

    // Fall through to Google Places if Kaiser returned empty or errored
    console.warn("[providers] Kaiser lookup failed or empty, falling back to Google Places");
  }

  if (!GOOGLE_API_KEY || GOOGLE_API_KEY === "paste_later") {
    console.error("[providers] Places API key not configured");
    return secureJson(GRACEFUL_ERROR);
  }

  // ── Build search payload ─────────────────────────────────────────────────
  const insurancePrefix = cleanInsurance ? `${cleanInsurance} ` : "";

  const searchPayload = {
    textQuery: `${insurancePrefix}${cleanSpecialist} near ${lat},${lng}`,
    maxResultCount: maxResults,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 10000,
      },
    },
  };

  // ── Call Places API ──────────────────────────────────────────────────────
  const searchData = await callPlacesAPI(searchPayload);

  if (!searchData) {
    console.error("[providers] provider search failed");
    return secureJson(GRACEFUL_ERROR);
  }

  // ── Map results ──────────────────────────────────────────────────────────
  const results: NewPlaceResult[] = searchData.places ?? [];
  const today = new Date().getDay();

  const providers = results.map((place) => {
    const photoUrl = null; // Places photo URLs embed the server API key — don't forward to client

    const name = place.displayName?.text ?? "Unknown";
    const distance = place.location
      ? haversineDistance(lat, lng, place.location.latitude, place.location.longitude)
      : null;
    const open_now = place.regularOpeningHours?.openNow ?? null;
    const rating = place.rating ?? null;
    const user_ratings_total = place.userRatingCount ?? null;
    const today_hours = getTodayHours(place.regularOpeningHours);
    const next_open =
      open_now === false ? getNextOpenTime(place.regularOpeningHours, today) : null;

    return {
      name,
      address: place.formattedAddress ?? "",
      rating,
      user_ratings_total,
      distance,
      phone: place.nationalPhoneNumber ?? "",
      website: place.websiteUri ?? "",
      maps_link: place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`,
      place_id: place.id,
      open_now,
      photo_url: photoUrl,
      primary_type: place.primaryTypeDisplayName?.text ?? null,
      insurance_match: matchesInsurance(name, cleanInsurance),
      today_hours,
      next_open,
      top_match: false, // assigned after sort
      _minsUntilClose: minutesUntilClosingNow(place.regularOpeningHours),
    };
  });

  // ── Bayesian-average multi-factor scoring ────────────────────────────────
  const C = 50; // confidence threshold: ~50 reviews anchors a Bayesian estimate

  const ratedProviders = providers.filter((p) => p.rating !== null);
  const globalMeanRating =
    ratedProviders.length > 0
      ? ratedProviders.reduce((sum, p) => sum + (p.rating ?? 0), 0) / ratedProviders.length
      : 3.5;

  const enriched = providers.map((p) => {
    const count = p.user_ratings_total ?? 0;
    const r = p.rating ?? globalMeanRating;
    const bayesianRating = (C * globalMeanRating + r * count) / (C + count);
    const distMiles = p.distance !== null ? parseFloat(p.distance) : null;
    const proximityRaw = distMiles !== null ? 1 / (distMiles + 0.1) : null;
    const trustRaw = Math.log10(count + 1);
    return { ...p, bayesianRating, proximityRaw, trustRaw };
  });

  // Collect ranges for min-max normalization
  const bayesValues = enriched.map((p) => p.bayesianRating);
  const bayesMin = Math.min(...bayesValues);
  const bayesMax = Math.max(...bayesValues);

  const proximityValues = enriched
    .map((p) => p.proximityRaw)
    .filter((v): v is number => v !== null);
  const proximityMin = proximityValues.length > 0 ? Math.min(...proximityValues) : 0;
  const proximityMax = proximityValues.length > 0 ? Math.max(...proximityValues) : 1;
  const sortedProx = [...proximityValues].sort((a, b) => a - b);
  const proximityMedian = sortedProx.length > 0 ? sortedProx[Math.floor(sortedProx.length / 2)] : 0.5;

  const trustValues = enriched.map((p) => p.trustRaw);
  const trustMin = Math.min(...trustValues);
  const trustMax = Math.max(...trustValues);

  // Compute final score with weighted combination
  const scored = enriched.map((p) => {
    const ratingNorm   = minMaxNorm(p.bayesianRating, bayesMin, bayesMax);
    const proximityNorm = minMaxNorm(p.proximityRaw ?? proximityMedian, proximityMin, proximityMax);
    const trustNorm    = minMaxNorm(p.trustRaw, trustMin, trustMax);
    const avail        = availabilityScore(p.open_now, p._minsUntilClose);
    // Quality (0.35) + availability (0.35) + proximity (0.20) + trust (0.10)
    const finalScore = 0.35 * ratingNorm + 0.35 * avail + 0.20 * proximityNorm + 0.10 * trustNorm;
    return { ...p, _finalScore: finalScore };
  });

  scored.sort((a, b) => b._finalScore - a._finalScore);

  // ── Mark top match and strip internal fields ─────────────────────────────
  const finalProviders = scored.slice(0, maxResults).map((p, i) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _minsUntilClose, _finalScore, bayesianRating, proximityRaw, trustRaw, ...rest } = p;
    return { ...rest, top_match: i === 0 };
  });

  return secureJson({
    providers: finalProviders,
    urgency_banner: urgencyBanner(urg),
    insurance_note: cleanInsurance
      ? `Verify that providers accept ${cleanInsurance} before booking.`
      : null,
  });
}
