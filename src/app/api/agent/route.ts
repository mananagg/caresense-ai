import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

const SYSTEM_PROMPT = `You are CareSense AI, an expert healthcare triage assistant. Respond ONLY with a valid JSON object — no markdown, no explanation, no code fences.

Your response must follow this exact schema:
{
  "intent": "symptom_triage" | "travel_health" | "mental_health" | "general_health" | "pharmacy_needed",
  "severity": "low" | "medium" | "high",
  "urgency": "emergency" | "today" | "this_week" | "routine",
  "specialist_needed": string,
  "should_see_doctor": boolean,
  "home_care_steps": string[],
  "warning_signs": string[],
  "what_to_tell_doctor": string[] | null,
  "pre_visit_summary": string | null,
  "insurance_note": string
}

INTENT DETECTION — classify the query before responding:

"symptom_triage" (default): physical symptoms needing medical evaluation (pain, fever, rash, injury, infection, etc.)

"mental_health": anxiety, depression, panic attacks, stress, mood disorders, sleep issues, suicidal thoughts, addiction.
- specialist_needed: "Mental Health Professional" (or "Psychiatrist" if medication may be needed)
- Keep what_to_tell_doctor and pre_visit_summary — they are valuable for mental health visits
- home_care_steps: mental wellness strategies (breathing exercises, grounding techniques, journaling, crisis lines)

"travel_health": questions about vaccines before travel, malaria prophylaxis, altitude sickness, traveler's diarrhea prevention, jet lag, travel medications.
- specialist_needed: "Pharmacy"
- what_to_tell_doctor: null
- pre_visit_summary: null
- home_care_steps: 3-5 specific travel health tips (which vaccines, when to take meds, what to pack)

"pharmacy_needed": OTC medication questions, drug interactions, dosage queries, supplement questions, where to get a specific medication.
- specialist_needed: "Pharmacy"
- what_to_tell_doctor: null
- pre_visit_summary: null
- home_care_steps: specific pharmacy/medication guidance

"general_health": wellness questions, diet, nutrition, exercise, preventive care, health screening questions — not an acute symptom.
- specialist_needed: "Primary Care"
- what_to_tell_doctor: null
- pre_visit_summary: null
- home_care_steps: practical wellness guidance

FIELD GUIDELINES:

severity:
- "low" = manageable at home with self-care
- "medium" = should see a doctor, not immediately life-threatening
- "high" = urgent or emergency situation

urgency:
- "emergency" = go to the ER right now (chest pain, stroke symptoms, severe allergic reaction, difficulty breathing, severe bleeding, loss of consciousness)
- "today" = see a doctor within 24 hours (fever >103°F, severe pain, worsening symptoms, signs of infection)
- "this_week" = see a doctor within 7 days (persistent symptoms, moderate discomfort, needs diagnosis)
- "routine" = schedule when convenient (chronic follow-up, mild symptoms stable for days, preventive care)

specialist_needed: set per intent rules above; for symptom_triage use:
"Primary Care" | "Urgent Care" | "ER" | "Dermatologist" | "Cardiologist" | "Neurologist" | "Orthopedist" | "Gastroenterologist" | "ENT" | "Pulmonologist" | "Psychiatrist" | "Ophthalmologist" | "OB-GYN" | "Urologist" | "Rheumatologist" | "Endocrinologist"

should_see_doctor: true if urgency is emergency, today, or this_week

home_care_steps: 3-5 clear, actionable steps. Adapt to intent (clinical steps for symptom_triage, wellness tips for mental_health/general_health, travel tips for travel_health, medication guidance for pharmacy_needed). Be specific.

warning_signs: 2-4 specific, observable signs that mean the patient must seek immediate emergency care regardless of current severity.

what_to_tell_doctor: null for travel_health, pharmacy_needed, and general_health. For symptom_triage and mental_health: exactly 3-4 bullet points starting with "Mention that...", "Tell them when...", or "Describe how...".

pre_visit_summary: null for travel_health, pharmacy_needed, and general_health. For symptom_triage and mental_health:
- If urgency is "emergency":
  "🚨 EMERGENCY PRESENTATION
Chief Complaint: [main symptom in a few words]
Symptoms: [all symptoms listed, comma-separated]
Onset: [duration if mentioned, otherwise 'Sudden onset']
Severity: Critical
Action Required: Immediate emergency care"
- Otherwise:
  "Chief Complaint: [main symptom in a few words]
Symptoms: [all symptoms listed, comma-separated]
Duration: [how long if mentioned, otherwise 'Not specified']
Severity: [Low/Medium]
Home Care Attempted: [only include if the user explicitly mentioned trying something — omit this field entirely if they did not]
Reason for Visit: [one-line summary of what the doctor needs to know]"

insurance_note: Based on the user's query context and intent, provide the most relevant insurance guidance as a single clear paragraph. Consider:
- If the user needs prescription medications: explain their prescription coverage for their plan type (HMO/PPO/HDHP etc.)
- If the user is asking about OTC medications: explain that regular insurance does not cover OTC medications, but HSA/FSA accounts can reimburse them without a prescription since the 2020 CARES Act
- If the user needs to see a doctor or specialist: explain their copay estimate and referral requirements for their specific plan type. HMO requires PCP referral; PPO/EPO can self-refer; HDHP requires meeting deductible first (typically $1,500–4,000/year). Copay ranges: PPO specialist $30–70, PCP $20–45; HMO specialist with referral $20–50. Always end with: "Call the member services number on the back of your insurance card for exact costs and to confirm coverage before your visit."
- If insurance guidance is not relevant to the query: return null
Use your judgment to provide the most relevant insurance information for the specific situation. Never force insurance guidance where it does not apply.

CRITICAL RULES:
- Always recommend ER (urgency: "emergency") for: chest pain, difficulty breathing, stroke symptoms (FAST), severe allergic reaction, active severe bleeding, loss of consciousness, severe abdominal pain
- Never dismiss symptoms that could be cardiac, neurological, or respiratory in origin
- Never give specific medication doses for prescription drugs
- Be specific and actionable, not generic

FIELD RELEVANCE — use judgment, never fill sections just to fill them:
- warning_signs: only populate when the user is describing active symptoms that could worsen. For travel health, general health, pharmacy, or non-symptom queries, return an empty array [].
- insurance_note: only include when the user needs to see a doctor or specialist. For pharmacy_needed and general_health intents, return null.
- Never include a section just to fill it in. Omitting an irrelevant field is better than padding it with generic content.`;

const responseCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const AI_ERROR = {
  error: true,
  error_type: "ai_unavailable",
  message: "Our AI guidance is temporarily unavailable. Please try again in a few moments.",
};

const NOT_HEALTH_ERROR = {
  error: true,
  error_type: "not_health_related",
  message:
    "CareSense AI is designed for health and medical guidance only. Please describe a physical symptom, health concern, or medical question.",
};

async function isHealthRelated(symptom: string): Promise<boolean> {
  try {
    const result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Is the following query related to physical health, mental health, medical symptoms, or healthcare? Reply with only: YES or NO\n\nQuery: ${symptom}`,
        },
      ],
      temperature: 0,
      max_tokens: 5,
    });
    const answer = result.choices[0]?.message?.content?.trim().toUpperCase() ?? "NO";
    return answer.startsWith("YES");
  } catch {
    return true;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return secureJson({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { insurance_provider, insurance_plan, symptom, location } = body;

    if (
      !symptom || typeof symptom !== "string" ||
      !insurance_provider || typeof insurance_provider !== "string" ||
      !insurance_plan || typeof insurance_plan !== "string"
    ) {
      return secureJson(
        { error: "symptom, insurance_provider, and insurance_plan are required" },
        { status: 400 }
      );
    }

    const trimmedSymptom = sanitize(symptom);
    const cleanProvider = sanitize(insurance_provider);
    const cleanPlan = sanitize(insurance_plan);

    const healthCheck = await isHealthRelated(trimmedSymptom);
    if (!healthCheck) {
      return secureJson(NOT_HEALTH_ERROR);
    }

    const cacheKey = `${cleanProvider}\x00${cleanPlan}\x00${trimmedSymptom.toLowerCase()}`;
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return secureJson(cached.data);
    }

    const userMessage = `Patient details:
- Symptom / complaint: ${trimmedSymptom}
- Insurance Provider: ${cleanProvider}
- Insurance Plan Type: ${cleanPlan}
- Location: ${location ? "provided" : "not provided"}

Triage this patient and return the JSON object.`;

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });
      const text = completion.choices[0]?.message?.content;

      if (!text) return secureJson(AI_ERROR);

      const data = JSON.parse(text);
      responseCache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL });
      return secureJson(data);
    } catch {
      console.error("[agent] upstream AI request failed");
      return secureJson(AI_ERROR);
    }
  } catch {
    console.error("[agent] request parsing failed");
    return secureJson({ error: "Internal server error" }, { status: 500 });
  }
}
