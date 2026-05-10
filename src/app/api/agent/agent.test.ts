import { POST } from "./route";
import { NextRequest } from "next/server";

jest.setTimeout(30000);

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockImplementation(async (userMessage: string) => {
        const msg = String(userMessage).toLowerCase();
  let data: Record<string, unknown>;

  if (msg.includes("chest pain")) {
    data = {
      severity: "high",
      urgency: "emergency",
      specialist_needed: "ER",
      should_see_doctor: true,
      home_care_steps: ["Call 911 immediately", "Do not drive yourself", "Chew aspirin if not allergic"],
      warning_signs: ["Loss of consciousness", "Severe shortness of breath", "Jaw or arm pain worsening"],
      what_to_tell_doctor: [
        "Mention pain started suddenly",
        "Describe radiation to left arm",
        "Tell them about shortness of breath",
        "Mention sweating began with the pain",
      ],
      pre_visit_summary:
        "🚨 EMERGENCY PRESENTATION\nChief Complaint: Chest pain\nSymptoms: Chest pain, left arm radiation, shortness of breath, sweating\nOnset: Sudden onset\nSeverity: Critical\nAction Required: Immediate emergency care",
      insurance_note:
        "For emergency care, your PPO plan covers ER visits with a higher copay, typically $150–350. Call the member services number on the back of your insurance card for exact costs and to confirm coverage before your visit.",
    };
  } else if (msg.includes("fever")) {
    data = {
      severity: "medium",
      urgency: "today",
      specialist_needed: "Primary Care",
      should_see_doctor: true,
      home_care_steps: [
        "Take acetaminophen 500mg every 6 hours",
        "Stay hydrated with water and electrolytes",
        "Rest and avoid strenuous activity",
        "Monitor temperature every 4 hours",
      ],
      warning_signs: ["Fever above 104°F", "Difficulty breathing", "Severe headache", "Skin rash"],
      what_to_tell_doctor: [
        "Mention fever started 3 days ago",
        "Describe the body aches and fatigue",
        "Tell them the current temperature reading",
        "Mention any medications taken so far",
      ],
      pre_visit_summary:
        "Chief Complaint: High fever\nSymptoms: Fever 102°F, body aches, fatigue\nDuration: 3 days\nSeverity: Medium\nReason for Visit: Persistent fever requiring medical evaluation",
      insurance_note:
        "HMO plans require a PCP referral before seeing a specialist. Copays are typically $20–50 with referral. Call the member services number on the back of your insurance card for exact costs and to confirm coverage before your visit.",
    };
  } else if (msg.includes("back pain")) {
    data = {
      severity: "medium",
      urgency: "this_week",
      specialist_needed: "Orthopedist",
      should_see_doctor: true,
      home_care_steps: [
        "Apply ice for 20 minutes every 2 hours",
        "Take ibuprofen 400mg with food every 6–8 hours",
        "Avoid heavy lifting and sudden movements",
        "Try gentle stretching for lower back",
      ],
      warning_signs: [
        "Numbness or tingling down legs",
        "Loss of bladder or bowel control",
        "Fever accompanying back pain",
        "Pain radiating below the knee",
      ],
      what_to_tell_doctor: [
        "Mention pain has persisted for two weeks",
        "Describe what makes it better or worse",
        "Tell them about any prior back injuries",
        "Mention your daily activity level",
      ],
      pre_visit_summary:
        "Chief Complaint: Lower back pain\nSymptoms: Persistent lower back pain\nDuration: Two weeks\nSeverity: Medium\nReason for Visit: Ongoing back pain requiring diagnosis",
      insurance_note:
        "With your HDHP plan, you pay the full cost of visits until your annual deductible is met, typically $1,500–4,000. After meeting the deductible, your coinsurance applies. Call the member services number on the back of your insurance card for exact costs and to confirm coverage before your visit.",
    };
  } else {
    data = {
      severity: "low",
      urgency: "routine",
      specialist_needed: "Primary Care",
      should_see_doctor: false,
      home_care_steps: [
        "Rest and drink at least 8 glasses of water daily",
        "Use saline nasal spray 2–3 times per day",
        "Gargle warm salt water for sore throat relief",
        "Take an OTC antihistamine if sneezing is disruptive",
      ],
      warning_signs: [
        "Fever above 103°F",
        "Difficulty breathing or chest tightness",
        "Symptoms lasting more than 10 days",
        "Severe sinus pain or headache",
      ],
      what_to_tell_doctor: [
        "Mention symptoms started 2 days ago",
        "Describe the severity of the sore throat",
        "Tell them about any known allergies",
        "Mention if anyone around you is also sick",
      ],
      pre_visit_summary:
        "Chief Complaint: Cold symptoms\nSymptoms: Runny nose, mild sore throat, sneezing\nDuration: 2 days\nSeverity: Low\nReason for Visit: Mild cold symptoms, routine check if not improving",
      insurance_note:
        "PPO plans typically have PCP copays of $20–45 per visit. No referral needed for self-referred specialist visits. Call the member services number on the back of your insurance card for exact costs and to confirm coverage before your visit.",
    };
  }

        return { response: { text: () => JSON.stringify(data) } };
      }),
    }),
  })),
}));

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Scenario 1: Low-severity cold symptoms ──────────────────────────────────
describe("low severity — common cold", () => {
  let result: Record<string, unknown>;

  beforeAll(async () => {
    const req = makeRequest({
      symptom: "runny nose, mild sore throat, and sneezing for 2 days",
      insurance_provider: "Aetna",
      insurance_plan: "PPO",
    });
    const res = await POST(req);
    result = await res.json();
  });

  it("returns severity low", () => {
    expect(result.severity).toBe("low");
  });

  it("returns routine or this_week urgency", () => {
    expect(["routine", "this_week"]).toContain(result.urgency);
  });

  it("has home_care_steps array with at least 3 items", () => {
    expect(Array.isArray(result.home_care_steps)).toBe(true);
    expect((result.home_care_steps as unknown[]).length).toBeGreaterThanOrEqual(3);
  });

  it("includes pre_visit_summary", () => {
    expect(typeof result.pre_visit_summary).toBe("string");
    expect((result.pre_visit_summary as string).length).toBeGreaterThan(20);
  });
});

// ── Scenario 2: Medium severity — high fever ────────────────────────────────
describe("medium severity — high fever", () => {
  let result: Record<string, unknown>;

  beforeAll(async () => {
    const req = makeRequest({
      symptom: "fever of 102°F for 3 days, body aches, and fatigue",
      insurance_provider: "UnitedHealthcare",
      insurance_plan: "HMO",
    });
    const res = await POST(req);
    result = await res.json();
  });

  it("returns medium or high severity", () => {
    expect(["medium", "high"]).toContain(result.severity);
  });

  it("returns today or this_week urgency", () => {
    expect(["today", "this_week"]).toContain(result.urgency);
  });

  it("sets should_see_doctor to true", () => {
    expect(result.should_see_doctor).toBe(true);
  });

  it("returns what_to_tell_doctor with 3-4 items", () => {
    expect(Array.isArray(result.what_to_tell_doctor)).toBe(true);
    const len = (result.what_to_tell_doctor as unknown[]).length;
    expect(len).toBeGreaterThanOrEqual(3);
    expect(len).toBeLessThanOrEqual(4);
  });
});

// ── Scenario 3: High severity — chest pain ──────────────────────────────────
describe("high severity — chest pain", () => {
  let result: Record<string, unknown>;

  beforeAll(async () => {
    const req = makeRequest({
      symptom: "sudden chest pain radiating to my left arm, short of breath, and sweating",
      insurance_provider: "Blue Cross Blue Shield",
      insurance_plan: "PPO",
    });
    const res = await POST(req);
    result = await res.json();
  });

  it("returns high severity", () => {
    expect(result.severity).toBe("high");
  });

  it("returns emergency urgency", () => {
    expect(result.urgency).toBe("emergency");
  });

  it("recommends ER as specialist", () => {
    expect((result.specialist_needed as string).toLowerCase()).toMatch(/er|emergency/i);
  });

  it("sets should_see_doctor to true", () => {
    expect(result.should_see_doctor).toBe(true);
  });

  it("includes warning_signs array", () => {
    expect(Array.isArray(result.warning_signs)).toBe(true);
    expect((result.warning_signs as unknown[]).length).toBeGreaterThanOrEqual(2);
  });
});

// ── Scenario 4: Missing required fields → 400 ───────────────────────────────
describe("missing required fields", () => {
  it("returns 400 when symptom is missing", async () => {
    const req = makeRequest({
      insurance_provider: "Aetna",
      insurance_plan: "PPO",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when insurance_provider is missing", async () => {
    const req = makeRequest({
      symptom: "headache",
      insurance_plan: "PPO",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when insurance_plan is missing", async () => {
    const req = makeRequest({
      symptom: "headache",
      insurance_provider: "Aetna",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── Scenario 5: HDHP plan insurance note ────────────────────────────────────
describe("HDHP insurance note", () => {
  let result: Record<string, unknown>;

  beforeAll(async () => {
    const req = makeRequest({
      symptom: "persistent lower back pain for two weeks",
      insurance_provider: "Cigna",
      insurance_plan: "HDHP",
    });
    const res = await POST(req);
    result = await res.json();
  });

  it("includes insurance_note string", () => {
    expect(typeof result.insurance_note).toBe("string");
    expect((result.insurance_note as string).length).toBeGreaterThan(30);
  });

  it("insurance_note mentions deductible for HDHP", () => {
    expect((result.insurance_note as string).toLowerCase()).toMatch(/deductible/i);
  });

  it("insurance_note ends with member services reminder", () => {
    expect(result.insurance_note as string).toMatch(/member services|insurance card/i);
  });
});
