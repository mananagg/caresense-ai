import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

interface NewPlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: { openNow?: boolean };
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

async function callPlacesAPI(
  payload: Record<string, unknown>
): Promise<{ places?: NewPlaceResult[] } | null> {
  console.log("[providers] request body:", JSON.stringify(payload, null, 2));

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

    const rawBody = await res.text();
    console.log("[providers] response status:", res.status);
    console.log("[providers] response body:", rawBody);

    if (!res.ok) {
      console.error("[providers] Places API error:", {
        status: res.status,
        statusText: res.statusText,
        responseBody: rawBody,
        requestPayload: payload,
      });
      return null;
    }

    return JSON.parse(rawBody);
  } catch (err) {
    console.error("[providers] fetch threw:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ...GRACEFUL_ERROR, error: "invalid_request", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { specialist_needed, urgency = "routine", location, insurance_provider } = body;

  // ── Input validation ─────────────────────────────────────────────────────
  if (!specialist_needed || typeof specialist_needed !== "string" || !specialist_needed.trim()) {
    return NextResponse.json(
      { ...GRACEFUL_ERROR, error: "invalid_request", message: "specialist_needed is required" },
      { status: 400 }
    );
  }

  const lat = Number((location as Record<string, unknown>)?.lat);
  const lng = Number((location as Record<string, unknown>)?.lng);

  if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
    return NextResponse.json(
      {
        ...GRACEFUL_ERROR,
        error: "invalid_request",
        message: "Valid lat/lng coordinates are required (lat: −90–90, lng: −180–180)",
      },
      { status: 400 }
    );
  }

  if (!GOOGLE_API_KEY || GOOGLE_API_KEY === "paste_later") {
    console.error("[providers] Google Places API key not configured");
    return NextResponse.json(GRACEFUL_ERROR);
  }

  const urg: Urgency = (["emergency", "today", "this_week", "routine"] as const).includes(
    urgency as Urgency
  )
    ? (urgency as Urgency)
    : "routine";

  const maxResults = urg === "emergency" ? 3 : 5;

  // ── Build search payload ─────────────────────────────────────────────────
  const insurancePrefix = insurance_provider && typeof insurance_provider === "string" && insurance_provider.trim()
    ? `${insurance_provider.trim()} `
    : "";

  const searchPayload = {
    textQuery: `${insurancePrefix}${specialist_needed.trim()} near ${lat},${lng}`,
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
    console.error("[providers] Places API call failed");
    return NextResponse.json(GRACEFUL_ERROR);
  }

  // ── Map results ──────────────────────────────────────────────────────────
  const results: NewPlaceResult[] = searchData.places ?? [];

  const providers = results.map((place) => {
    const photoUrl = place.photos?.[0]?.name
      ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=200&maxWidthPx=200&key=${GOOGLE_API_KEY}`
      : null;

    const name = place.displayName?.text ?? "Unknown";

    return {
      name,
      address: place.formattedAddress ?? "",
      rating: place.rating ?? null,
      user_ratings_total: place.userRatingCount ?? null,
      distance:
        place.location
          ? haversineDistance(lat, lng, place.location.latitude, place.location.longitude)
          : null,
      phone: place.nationalPhoneNumber ?? "",
      website: place.websiteUri ?? "",
      maps_link: place.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${place.id}`,
      place_id: place.id,
      open_now: place.regularOpeningHours?.openNow ?? null,
      photo_url: photoUrl,
      primary_type: place.primaryTypeDisplayName?.text ?? null,
      insurance_match: matchesInsurance(name, String(insurance_provider ?? "")),
    };
  });

  // ── Sort ─────────────────────────────────────────────────────────────────
  // All urgencies: sort by distance ascending when available, appending
  // providers without distance at the end. Providers are never dropped for
  // lacking distance data.
  providers.sort((a, b) => {
    const aDist = a.distance !== null ? parseFloat(a.distance) : null;
    const bDist = b.distance !== null ? parseFloat(b.distance) : null;
    if (aDist !== null && bDist !== null) return aDist - bDist;
    if (aDist !== null) return -1;
    if (bDist !== null) return 1;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  return NextResponse.json({
    providers: providers.slice(0, maxResults),
    urgency_banner: urgencyBanner(urg),
    insurance_note: insurance_provider
      ? `Verify that providers accept ${insurance_provider} before booking.`
      : null,
  });
}
