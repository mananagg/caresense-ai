import { NextRequest, NextResponse } from "next/server";

const KAISER_BASE = process.env.KAISER_API_BASE_URL;

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

// ── FHIR types ────────────────────────────────────────────────────────────────

interface FhirHumanName {
  family?: string;
  given?: string[];
  prefix?: string[];
}

interface FhirAddress {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
}

interface FhirContactPoint {
  system?: string;
  value?: string;
}

interface FhirCoding {
  display?: string;
  code?: string;
}

interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

interface FhirQualification {
  code?: FhirCodeableConcept;
}

interface FhirPractitioner {
  resourceType: string;
  id?: string;
  name?: FhirHumanName[];
  address?: FhirAddress[];
  telecom?: FhirContactPoint[];
  qualification?: FhirQualification[];
}

interface FhirEntry {
  resource?: FhirPractitioner;
}

interface FhirBundle {
  resourceType: string;
  entry?: FhirEntry[];
}

// ── Parse helpers ─────────────────────────────────────────────────────────────

function parseName(names: FhirHumanName[] | undefined): string {
  if (!names?.length) return "Unknown Provider";
  const primary = names[0];
  const prefix = primary.prefix?.join(" ") ?? "";
  const given = primary.given?.join(" ") ?? "";
  const family = primary.family ?? "";
  return [prefix, given, family].filter(Boolean).join(" ").trim() || "Unknown Provider";
}

function parseAddress(addresses: FhirAddress[] | undefined): string {
  if (!addresses?.length) return "";
  const a = addresses[0];
  const line = a.line?.join(", ") ?? "";
  const city = a.city ?? "";
  const state = a.state ?? "";
  const zip = a.postalCode ?? "";
  return [line, city, state, zip].filter(Boolean).join(", ");
}

function parsePhone(telecoms: FhirContactPoint[] | undefined): string {
  if (!telecoms?.length) return "";
  const phone = telecoms.find((t) => t.system === "phone");
  return phone?.value ?? "";
}

function parseCredentials(qualifications: FhirQualification[] | undefined): string {
  if (!qualifications?.length) return "";
  return qualifications
    .map((q) => q.code?.coding?.[0]?.display ?? q.code?.text ?? "")
    .filter(Boolean)
    .join(", ");
}

// ── Fetch from Kaiser FHIR API ────────────────────────────────────────────────

export interface KaiserProvider {
  name: string;
  address: string;
  phone: string;
  credentials: string;
  source: "kaiser";
}

export async function fetchKaiserProviders(
  city: string,
  state: string
): Promise<{ providers: KaiserProvider[]; error?: string }> {
  if (!KAISER_BASE) {
    console.error("[kaiser] KAISER_API_BASE_URL not configured");
    return { providers: [], error: "kaiser_unavailable" };
  }

  const url = new URL(`${KAISER_BASE}/Practitioner`);
  url.searchParams.set("_count", "5");
  url.searchParams.set("address-city", city);
  url.searchParams.set("address-state", state);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/fhir+json",
        "User-Agent": "CareSenseAI/1.0 (https://caresense-ai.vercel.app)",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      console.error("[kaiser] FHIR API non-OK status:", res.status);
      return { providers: [], error: "kaiser_unavailable" };
    }

    const bundle: FhirBundle = await res.json();

    if (bundle.resourceType !== "Bundle" || !bundle.entry?.length) {
      return { providers: [] };
    }

    const providers: KaiserProvider[] = bundle.entry
      .filter((e) => e.resource?.resourceType === "Practitioner")
      .map((e) => {
        const r = e.resource!;
        return {
          name: parseName(r.name),
          address: parseAddress(r.address),
          phone: parsePhone(r.telecom),
          credentials: parseCredentials(r.qualification),
          source: "kaiser" as const,
        };
      })
      .filter((p) => p.name !== "Unknown Provider");

    return { providers };
  } catch {
    console.error("[kaiser] FHIR fetch failed");
    return { providers: [], error: "kaiser_unavailable" };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return secureJson({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return secureJson({ providers: [], error: "kaiser_unavailable" }, { status: 400 });
  }

  const { specialty, city, state } = body;

  if (
    !city || typeof city !== "string" || !city.trim() ||
    !state || typeof state !== "string" || !state.trim()
  ) {
    return secureJson(
      { providers: [], error: "kaiser_unavailable" },
      { status: 400 }
    );
  }

  // specialty is accepted for context but Kaiser's Practitioner endpoint
  // does not support specialty filtering directly
  void specialty;

  const result = await fetchKaiserProviders(sanitize(city), sanitize(state));
  return secureJson(result);
}
