import { NextRequest, NextResponse } from "next/server";

const GEOCODING_KEY = process.env.GOOGLE_GEOCODING_API_KEY;

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

// ── Handlers ─────────────────────────────────────────────────────────────────

async function forwardGeocode(
  address: string
): Promise<{ lat: number; lng: number; countryCode: string }> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", GEOCODING_KEY!);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error("address_not_found");
  }
  const { lat, lng } = data.results[0].geometry.location;
  const countryComp = data.results[0].address_components?.find(
    (c: { types: string[]; short_name: string }) => c.types.includes("country")
  );
  return { lat, lng, countryCode: countryComp?.short_name ?? "" };
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", GEOCODING_KEY!);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) return "";
  const countryComp = data.results[0].address_components?.find(
    (c: { types: string[]; short_name: string }) => c.types.includes("country")
  );
  return countryComp?.short_name ?? "";
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return secureJson({ error: "Too many requests" }, { status: 429 });
  }

  if (!GEOCODING_KEY) {
    console.error("[geocode] GOOGLE_GEOCODING_API_KEY not configured");
    return secureJson({ error: "Geocoding unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return secureJson({ error: "Invalid request body" }, { status: 400 });
  }

  const { address, lat, lng } = body;

  // ── Forward geocode: address → lat/lng ────────────────────────────────────
  if (typeof address === "string" && address.trim()) {
    try {
      const result = await forwardGeocode(sanitize(address));
      return secureJson(result);
    } catch (err) {
      const isNotFound = err instanceof Error && err.message === "address_not_found";
      return secureJson(
        { error: isNotFound ? "Address not found. Try a city name, zip code, or full address." : "Geocoding failed" },
        { status: isNotFound ? 404 : 502 }
      );
    }
  }

  // ── Reverse geocode: lat/lng → countryCode ────────────────────────────────
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!isNaN(latNum) && !isNaN(lngNum)) {
    try {
      const countryCode = await reverseGeocode(latNum, lngNum);
      return secureJson({ countryCode });
    } catch {
      return secureJson({ countryCode: "" });
    }
  }

  return secureJson({ error: "Provide address or lat/lng" }, { status: 400 });
}
