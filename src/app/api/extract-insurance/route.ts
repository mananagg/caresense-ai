import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function extractJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("No JSON in model response");
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return secureJson({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return secureJson({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return secureJson(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 413 }
      );
    }

    if (file.type === "application/pdf") {
      return secureJson(
        {
          error:
            "PDF files cannot be processed. Please take a photo or screenshot of your insurance card and upload that instead.",
        },
        { status: 415 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return secureJson(
        { error: "Unsupported file type. Please upload a JPG or PNG image." },
        { status: 415 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.2-11b-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
            {
              type: "text",
              text: `Step 1 — Validate: Is this clearly a health insurance card from a US health insurance provider? It may be a physical card, a photo of one, or a digital version. It is NOT a valid insurance card if it shows a person, a different document type, a screenshot of something else, inappropriate content, or anything unrelated to US health insurance.

If NOT a health insurance card, return exactly: {"is_insurance_card": false}

Step 2 — Extract (only if it IS a health insurance card):
1. Insurance provider/company name (e.g. "Kaiser Permanente", "Aetna", "UnitedHealthcare", "Cigna", "Humana", "Anthem", "Blue Cross Blue Shield", "Medicaid", "Medicare")
2. Plan type — must be exactly one of: HMO, PPO, EPO, HDHP, POS (or null if not visible)

Return ONLY a JSON object with no explanation, no markdown:
{"is_insurance_card": true, "insurance_provider": "name or null", "plan_type": "HMO|PPO|EPO|HDHP|POS or null"}`,
            },
          ],
        },
      ] as Parameters<typeof groq.chat.completions.create>[0]["messages"],
      max_tokens: 150,
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content ?? "";

    let extracted: Record<string, unknown>;
    try {
      extracted = extractJson(content);
    } catch {
      return secureJson(
        { error: "Could not read insurance details from this image. Try a clearer photo." },
        { status: 422 }
      );
    }

    if (extracted.is_insurance_card === false) {
      return secureJson(
        { error: "Please upload a valid insurance card." },
        { status: 422 }
      );
    }

    return secureJson({
      insurance_provider: (extracted.insurance_provider as string | null) ?? null,
      plan_type: (extracted.plan_type as string | null) ?? null,
    });
  } catch {
    console.error("[extract-insurance] document processing failed");
    return secureJson({ error: "Failed to process document" }, { status: 500 });
  }
}
