import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are CareSense AI, an expert healthcare triage assistant. Respond ONLY with a valid JSON object — no markdown, no explanation, no code fences.

Your response must follow this exact schema:
{
  "severity": "low" | "medium" | "high",
  "urgency": "emergency" | "today" | "this_week" | "routine",
  "specialist_needed": string,
  "should_see_doctor": boolean,
  "home_care_steps": string[],
  "warning_signs": string[],
  "what_to_tell_doctor": string[],
  "pre_visit_summary": string,
  "insurance_note": string
}

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

specialist_needed: the single most appropriate care type:
"Primary Care" | "Urgent Care" | "ER" | "Dermatologist" | "Cardiologist" | "Neurologist" | "Orthopedist" | "Gastroenterologist" | "ENT" | "Pulmonologist" | "Psychiatrist" | "Ophthalmologist" | "OB-GYN" | "Urologist" | "Rheumatologist" | "Endocrinologist"

should_see_doctor: true if urgency is emergency, today, or this_week

home_care_steps: 3-5 clear, actionable steps the patient can do right now at home. Be specific (e.g. "Take 400mg ibuprofen with food every 6-8 hours" not "take pain relievers").

warning_signs: 2-4 specific, observable signs that mean the patient must seek immediate emergency care regardless of current severity.

what_to_tell_doctor: exactly 3-4 bullet points of specific information the doctor will need to diagnose faster. Focus on: symptom timeline, associated symptoms, what makes it better/worse, relevant history. Each point should start with a verb phrase like "Mention that..." or "Tell them when..." or "Describe how...".

pre_visit_summary: a structured block the patient can show medical staff. Use the exact format for the urgency level:
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

insurance_note: a single clear paragraph covering ALL of the following for their specific plan:
1. Referral requirement: HMO plans require a PCP referral before seeing a specialist — be explicit. PPO/EPO can self-refer. POS depends on in-network vs out-of-network. HDHP requires meeting deductible first.
2. Copay estimate: PPO specialist visits typically $30–70 copay; PCP $20–45. HMO specialist with referral typically $20–50. HDHP you pay full cost until deductible met (often $1,500–4,000/year). EPO similar to PPO in-network only. These are general ranges only.
3. Always end with: "Call the member services number on the back of your insurance card for exact costs and to confirm coverage before your visit."

CRITICAL RULES:
- Always recommend ER (urgency: "emergency") for: chest pain, difficulty breathing, stroke symptoms (FAST), severe allergic reaction, active severe bleeding, loss of consciousness, severe abdominal pain
- Never dismiss symptoms that could be cardiac, neurological, or respiratory in origin
- Never give specific medication doses for prescription drugs
- Be specific and actionable, not generic`;

const responseCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const AI_ERROR = {
  error: true,
  error_type: "ai_unavailable",
  message: "Our AI guidance is temporarily unavailable. Please try again in a few moments.",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { insurance_provider, insurance_plan, symptom, location } = body;

    if (!symptom || !insurance_provider || !insurance_plan) {
      return NextResponse.json(
        { error: "symptom, insurance_provider, and insurance_plan are required" },
        { status: 400 }
      );
    }

    const cacheKey = `${insurance_provider}\x00${insurance_plan}\x00${String(symptom).trim().toLowerCase()}`;
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.json(cached.data);
    }

    const userMessage = `Patient details:
- Symptom / complaint: ${symptom}
- Insurance Provider: ${insurance_provider}
- Insurance Plan Type: ${insurance_plan}
- Location: ${location ? `lat ${location.lat}, lng ${location.lng}` : "not provided"}

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

      if (!text) return NextResponse.json(AI_ERROR);

      const data = JSON.parse(text);
      responseCache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL });
      return NextResponse.json(data);
    } catch (groqErr) {
      console.error("Groq API error:", groqErr);
      return NextResponse.json(AI_ERROR);
    }
  } catch (err) {
    console.error("Agent route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
