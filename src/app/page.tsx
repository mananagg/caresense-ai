"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  Heart,
  Info,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Search,
  Shield,
  Siren,
  Star,
  Upload,
  Zap,
} from "lucide-react";

/* ─── Constants ─────────────────────────────────────────────────────────── */

const GEOCODING_KEY = process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY;

const INSURANCE_PROVIDERS = [
  "Aetna",
  "Anthem / Blue Cross Blue Shield",
  "Cigna",
  "Humana",
  "Kaiser Permanente",
  "Medicaid",
  "Medicare",
  "UnitedHealthcare",
  "Other",
];

const PLAN_TYPES = [
  { value: "HMO", label: "HMO" },
  { value: "PPO", label: "PPO" },
  { value: "EPO", label: "EPO" },
  { value: "HDHP", label: "HDHP" },
  { value: "POS", label: "POS" },
];

const SYMPTOM_CHIPS = ["Sore throat", "Fever", "Headache", "Stomach pain"];

const LOADING_MESSAGES = [
  "Analyzing your symptoms…",
  "Checking severity…",
  "Finding care options…",
  "Preparing your plan…",
];

const PRIVACY_MODAL = {
  title: "Privacy Policy",
  body: "CareSense AI does not store any personal health information. Your symptoms, insurance details, and location are used only to generate guidance and are never saved, shared, or sold. Location data is used only to find nearby providers. This app is intended for informational purposes only.",
};

const TERMS_MODAL = {
  title: "Terms of Service",
  body: "CareSense AI provides general health information only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical decisions. In an emergency, call 911 immediately. By using this service you agree that CareSense AI is not liable for any health decisions made based on its guidance.",
};

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface TriageResult {
  severity: "low" | "medium" | "high";
  urgency: "emergency" | "today" | "this_week" | "routine";
  specialist_needed: string;
  should_see_doctor: boolean;
  home_care_steps: string[];
  warning_signs: string[];
  what_to_tell_doctor: string[];
  pre_visit_summary: string;
  insurance_note: string;
}

interface Provider {
  name: string;
  address: string;
  rating: number | null;
  user_ratings_total: number | null;
  distance: string | null;
  phone: string;
  website: string;
  maps_link: string;
  place_id: string;
  open_now: boolean | null;
  photo_url: string | null;
  primary_type: string | null;
  insurance_match: boolean;
}

interface ProvidersResponse {
  providers: Provider[];
  insurance_note: string | null;
  urgency_banner: { message: string; type: "emergency" | "urgent" } | null;
  error?: string;
  message?: string;
}

/* ─── Config ─────────────────────────────────────────────────────────────── */

const SEVERITY_CONFIG = {
  low: {
    gradient: "from-emerald-50 to-green-50",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
    label: "Low Severity",
    pulseBadge: false,
  },
  medium: {
    gradient: "from-amber-50 to-yellow-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    label: "Medium Severity",
    pulseBadge: false,
  },
  high: {
    gradient: "from-red-50 to-rose-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    icon: AlertTriangle,
    iconColor: "text-red-500",
    label: "High Severity",
    pulseBadge: true,
  },
};

const URGENCY_CONFIG = {
  emergency: {
    label: "Go to ER Now",
    badge: "bg-red-600 text-white",
    dot: "bg-white/80",
    icon: Siren,
    iconColor: "text-white",
    border: "border-red-500",
    isEmergency: true,
    summaryLabel: "🚨 Share with ER Staff",
    summaryCardClass: "bg-red-50 border-2 border-red-400",
    summaryFooter: "🚨 Share this with ER staff immediately",
    summaryFooterClass: "text-red-600 font-medium",
    pulseBadge: true,
  },
  today: {
    label: "See Doctor Today",
    badge: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
    icon: AlertTriangle,
    iconColor: "text-orange-500",
    border: "border-orange-300",
    isEmergency: false,
    summaryLabel: "Pre-Visit Summary",
    summaryCardClass: "bg-white/70 border border-white/80",
    summaryFooter: "Screenshot or copy this to share with your doctor.",
    summaryFooterClass: "text-gray-400",
    pulseBadge: false,
  },
  this_week: {
    label: "See Doctor This Week",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    border: "border-amber-200",
    isEmergency: false,
    summaryLabel: "Pre-Visit Summary",
    summaryCardClass: "bg-white/70 border border-white/80",
    summaryFooter: "Screenshot or copy this to share with your doctor.",
    summaryFooterClass: "text-gray-400",
    pulseBadge: false,
  },
  routine: {
    label: "Schedule When Convenient",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
    border: "border-emerald-200",
    isEmergency: false,
    summaryLabel: "Pre-Visit Summary",
    summaryCardClass: "bg-white/70 border border-white/80",
    summaryFooter: "Screenshot or copy this to share with your doctor.",
    summaryFooterClass: "text-gray-400",
    pulseBadge: false,
  },
};

const URGENCY_DEFAULT = {
  label: "See a Doctor",
  badge: "bg-gray-100 text-gray-700",
  dot: "bg-gray-400",
  icon: AlertTriangle,
  iconColor: "text-gray-500",
  border: "border-gray-200",
  isEmergency: false,
  summaryLabel: "Pre-Visit Summary",
  summaryCardClass: "bg-white/70 border border-white/80",
  summaryFooter: "Screenshot or copy this to share with your doctor.",
  summaryFooterClass: "text-gray-400",
  pulseBadge: false,
};

/* ─── UI Helpers ─────────────────────────────────────────────────────────── */

function getSeverityConfig(severity: string) {
  return (
    SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] ?? {
      gradient: "from-gray-50 to-slate-50",
      border: "border-gray-200",
      badge: "bg-gray-100 text-gray-700",
      dot: "bg-gray-400",
      icon: Info,
      iconColor: "text-gray-400",
      label: `${severity.charAt(0).toUpperCase()}${severity.slice(1)} Severity`,
      pulseBadge: false,
    }
  );
}

function getUrgencyConfig(urgency: string) {
  return URGENCY_CONFIG[urgency as keyof typeof URGENCY_CONFIG] ?? URGENCY_DEFAULT;
}

function parseSummaryLines(text: string) {
  return text
    .split("\n")
    .map((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) return null;
      const label = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;
}

/* ─── API Calls ──────────────────────────────────────────────────────────── */

async function geocodeLocation(address: string): Promise<{ lat: number; lng: number; countryCode: string }> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", GEOCODING_KEY ?? "");
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error("Address not found. Try a city name, zip code, or full address.");
  }
  const { lat, lng } = data.results[0].geometry.location;
  const countryComp = data.results[0].address_components?.find(
    (c: { types: string[]; short_name: string }) => c.types.includes("country")
  );
  return { lat, lng, countryCode: countryComp?.short_name ?? "" };
}

async function reverseGeocodeCountry(lat: number, lng: number): Promise<string> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", GEOCODING_KEY ?? "");
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) return "";
    const countryComp = data.results[0].address_components?.find(
      (c: { types: string[]; short_name: string }) => c.types.includes("country")
    );
    return countryComp?.short_name ?? "";
  } catch {
    return "";
  }
}

interface FetchTriageParams {
  insuranceProvider: string;
  planType: string;
  symptom: string;
  location: { lat: number; lng: number } | null;
}

async function fetchTriage(params: FetchTriageParams): Promise<{ data: TriageResult | null; error: string | null }> {
  const RETRY_DELAYS = [1000, 3000, 8000];
  let lastError = "Something went wrong. Please try again.";

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
    }
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurance_provider: params.insuranceProvider,
          insurance_plan: params.planType,
          symptom: params.symptom,
          location: params.location,
        }),
      });
      const data = await res.json();
      if (res.status === 400) {
        return { data: null, error: typeof data.error === "string" ? data.error : "Invalid request." };
      }
      if (data.error_type === "ai_unavailable") {
        lastError = data.message ?? "AI is temporarily unavailable.";
        continue;
      }
      if (!res.ok || data.error) {
        lastError = typeof data.error === "string" ? data.error : "Something went wrong.";
        continue;
      }
      return { data: data as TriageResult, error: null };
    } catch {
      lastError = "Connection error. Check your internet and try again.";
    }
  }

  return { data: null, error: lastError };
}

interface FetchProvidersParams {
  specialist_needed: string;
  urgency: string;
  location: { lat: number; lng: number };
  insurance_provider: string;
}

async function fetchProviders(params: FetchProvidersParams): Promise<ProvidersResponse | null> {
  try {
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

/* ─── Loading Overlay ────────────────────────────────────────────────────── */

function LoadingOverlay() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center justify-center py-16 gap-6"
    >
      <div className="relative flex items-center justify-center">
        <div
          className="aura-ring absolute w-20 h-20 rounded-full"
          style={{ background: "rgba(30, 64, 175, 0.15)" }}
        />
        <div
          className="aura-ring absolute w-20 h-20 rounded-full"
          style={{ background: "rgba(5, 150, 105, 0.1)", animationDelay: "0.5s" }}
        />
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: "linear-gradient(135deg, #1E40AF, #059669)" }}
        >
          <Heart className="w-8 h-8 text-white heart-pulse" />
        </div>
      </div>
      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-sm font-medium text-slate-600"
          >
            {LOADING_MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
        <p className="text-xs text-slate-400 mt-1">Usually takes under 10 seconds</p>
      </div>
    </motion.div>
  );
}

/* ─── Dropdown ───────────────────────────────────────────────────────────── */

interface DropdownOption {
  value: string;
  label: string;
}

function Dropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function handleToggle() {
    setOpen((s) => !s);
  }

  function handleSelectOption(optValue: string) {
    onChange(optValue);
    setOpen(false);
  }

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1 text-sm font-semibold text-[#1E40AF] whitespace-nowrap hover:text-blue-800 transition-colors"
      >
        {label}
        <ChevronDown
          className="w-3 h-3 flex-shrink-0 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[180px] max-h-60 overflow-y-auto"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectOption(opt.value)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors gap-4"
              >
                <span className={opt.value === value ? "font-semibold text-[#1E40AF]" : "text-slate-700"}>
                  {opt.label}
                </span>
                {opt.value === value && (
                  <Check className="w-3.5 h-3.5 text-[#1E40AF] flex-shrink-0" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Provider Card ──────────────────────────────────────────────────────── */

function ProviderCard({ provider: p, rank }: { provider: Provider; rank: number }) {
  const isTopRated = p.rating !== null && p.rating >= 4.5;
  const isLowRated = p.rating !== null && p.rating < 3.5;
  const bgClass = isTopRated ? "bg-emerald-50/40" : isLowRated ? "bg-slate-50" : "bg-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.07 }}
      className={`relative ${bgClass} rounded-2xl border p-4 flex gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-default ${
        p.insurance_match ? "border-blue-200 ring-1 ring-blue-100" : "border-slate-100"
      }`}
    >
      {rank === 1 && (
        <div
          className="absolute -top-px -right-px px-2.5 py-0.5 rounded-bl-xl rounded-tr-2xl text-[10px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #1E40AF, #059669)" }}
        >
          Top Match
        </div>
      )}

      <div className="flex-shrink-0 self-start">
        {p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo_url} alt={p.name} className="w-20 h-20 rounded-xl object-cover bg-slate-100" />
        ) : (
          <div className="w-20 h-20 rounded-xl flex items-center justify-center bg-slate-100">
            <Building2 className="w-8 h-8 text-slate-300" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span
              className="text-xs font-bold text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0"
              style={{ background: "#1E40AF" }}
            >
              {rank}
            </span>
            <h3 className="font-semibold text-slate-900 text-sm">{p.name}</h3>
            {p.primary_type && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                {p.primary_type}
              </span>
            )}
            {p.insurance_match && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-blue-50 text-blue-700">
                Insurance Match
              </span>
            )}
          </div>
          {p.open_now === true ? (
            <span className="flex-shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              Open Now
            </span>
          ) : p.open_now === false ? (
            <span className="flex-shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-500">
              Closed
            </span>
          ) : (
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-400">
              <Clock className="w-3 h-3" />
              Hours N/A
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400 flex items-center gap-1 mb-2.5">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{p.address}</span>
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {p.rating !== null && (
            <span className="flex items-center gap-1 text-xs text-slate-600">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="font-medium">{p.rating.toFixed(1)}</span>
              {p.user_ratings_total !== null && (
                <span className="text-slate-400">({p.user_ratings_total.toLocaleString()})</span>
              )}
            </span>
          )}
          {p.distance && (
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {p.distance}
            </span>
          )}
          {p.phone && (
            <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-xs text-blue-700 hover:underline">
              <Phone className="w-3 h-3" />
              {p.phone}
            </a>
          )}
        </div>

        <div className="flex gap-2">
          <a
            href={p.maps_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
            style={{ background: "#1E40AF" }}
          >
            <MapPin className="w-3 h-3" />
            Directions
          </a>
          {p.website && (
            <a
              href={p.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Website
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Modal ──────────────────────────────────────────────────────────────── */

function Modal({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        key="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      >
        <motion.div
          key="modal-card"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <h2 className="text-base font-bold text-slate-900 mb-3 pr-6">{title}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Fade-up wrapper ────────────────────────────────────────────────────── */

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function CareSensePage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [planType, setPlanType] = useState("");
  const [symptom, setSymptom] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [manualAddress, setManualAddress] = useState("");
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // ── Navigation & modal handlers ────────────────────────────────────────────

  function handleScrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  function handleScrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleOpenModal(type: "privacy" | "terms") {
    setModal(type === "privacy" ? PRIVACY_MODAL : TERMS_MODAL);
  }

  function handleCloseModal() {
    setModal(null);
  }

  // ── Form field handlers ────────────────────────────────────────────────────

  function handleProviderDropdownChange(value: string) {
    setInsuranceProvider(value);
  }

  function handlePlanDropdownChange(value: string) {
    setPlanType(value);
  }

  function handleSymptomChipClick(chip: string) {
    setSymptom((prev) => {
      if (prev.toLowerCase().includes(chip.toLowerCase())) return prev;
      return prev ? `${prev}, ${chip.toLowerCase()}` : chip.toLowerCase();
    });
  }

  function handleSymptomTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setSymptom(e.target.value);
  }

  function handleCopySummary() {
    const text = triage?.pre_visit_summary ?? "";
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    });
  }

  // ── Upload handlers ────────────────────────────────────────────────────────

  function handleToggleUpload() {
    setShowUpload((s) => !s);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  function matchInsuranceProvider(detected: string): string {
    const d = detected.toLowerCase();
    const exact = INSURANCE_PROVIDERS.find((p) => p.toLowerCase() === d);
    if (exact) return exact;
    for (const p of INSURANCE_PROVIDERS) {
      const words = p.toLowerCase().split(/[\s/,&()+]+/).filter((w) => w.length > 3);
      if (words.some((w) => d.includes(w))) return p;
    }
    for (const p of INSURANCE_PROVIDERS) {
      if (d.includes(p.toLowerCase().split(" ")[0])) return p;
    }
    return "";
  }

  async function handleFileUpload(file: File) {
    setUploadStatus("loading");
    setUploadError(null);
    setDetectedLabel(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract-insurance", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to read insurance card");
      if (data.insurance_provider) {
        const matched = matchInsuranceProvider(data.insurance_provider);
        setInsuranceProvider(matched || data.insurance_provider);
      }
      if (data.plan_type && PLAN_TYPES.find((p) => p.value === data.plan_type)) {
        setPlanType(data.plan_type);
      }
      const parts = [data.insurance_provider, data.plan_type].filter(Boolean);
      setDetectedLabel(parts.length ? parts.join(" ") : "Insurance details extracted");
      setUploadStatus("success");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not read the file");
      setUploadStatus("error");
    }
  }

  // ── Location handlers ──────────────────────────────────────────────────────

  function handleLocationDetect() {
    if (!navigator.geolocation) {
      setGeoStatus("denied");
      setShowManual(true);
      return;
    }
    setGeoStatus("loading");
    setLocationBlocked(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const countryCode = await reverseGeocodeCountry(lat, lng);
        if (countryCode && countryCode !== "US") {
          setLocationBlocked(true);
          setGeoStatus("denied");
          return;
        }
        setLocation({ lat, lng });
        setGeoStatus("granted");
        setGeocodeStatus("idle");
        setGeocodeError(null);
      },
      () => {
        setGeoStatus("denied");
        setShowManual(true);
      }
    );
  }

  function handleToggleManualAddress() {
    setShowManual((s) => !s);
  }

  function handleManualAddressChange(e: React.ChangeEvent<HTMLInputElement>) {
    setManualAddress(e.target.value);
    setGeocodeStatus("idle");
    setGeocodeError(null);
    setLocationBlocked(false);
  }

  function handleManualAddressKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleLocationSearch();
  }

  async function handleLocationSearch() {
    const trimmed = manualAddress.trim();
    if (!trimmed) return;

    if (/^\d{5}$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (n < 501 || n > 99950) {
        setGeocodeError("Please enter a valid US zip code (00501–99950).");
        setGeocodeStatus("error");
        return;
      }
      setGeocodeStatus("loading");
      setGeocodeError(null);
      setLocationBlocked(false);
      try {
        const { lat, lng } = await geocodeLocation(trimmed);
        setLocation({ lat, lng });
        setGeocodeStatus("success");
        setGeoStatus("idle");
      } catch (err) {
        setGeocodeError(err instanceof Error ? err.message : "Could not find that location");
        setGeocodeStatus("error");
        setLocation(null);
      }
      return;
    }

    setGeocodeStatus("loading");
    setGeocodeError(null);
    setLocationBlocked(false);
    try {
      const { lat, lng, countryCode } = await geocodeLocation(trimmed);
      if (countryCode && countryCode !== "US") {
        setLocationBlocked(true);
        setGeocodeStatus("error");
        setLocation(null);
        return;
      }
      setLocation({ lat, lng });
      setGeocodeStatus("success");
      setGeoStatus("idle");
    } catch (err) {
      setGeocodeError(err instanceof Error ? err.message : "Could not find that location");
      setGeocodeStatus("error");
      setLocation(null);
    }
  }

  // ── Primary actions ────────────────────────────────────────────────────────

  async function handleGetGuidance() {
    if (!insuranceProvider || !planType || !symptom.trim()) return;

    setTriageError(null);
    setTriage(null);
    setProviders(null);
    setTriageLoading(true);

    const { data: triageData, error } = await fetchTriage({
      insuranceProvider,
      planType,
      symptom: symptom.trim(),
      location,
    });

    setTriageLoading(false);

    if (!triageData) {
      setTriageError(error ?? "Something went wrong. Please try again.");
      return;
    }

    setTriage(triageData);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);

    if (location) {
      setProvidersLoading(true);
      const pData = await fetchProviders({
        specialist_needed: triageData.specialist_needed,
        urgency: triageData.urgency,
        location,
        insurance_provider: insuranceProvider,
      });
      if (pData) setProviders(pData);
      setProvidersLoading(false);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const isFormValid = !!(insuranceProvider && planType && symptom.trim() && !locationBlocked);
  const sevConfig = triage ? getSeverityConfig(triage.severity?.toLowerCase()?.trim() ?? "low") : null;
  const SevIcon = sevConfig?.icon;
  const urgencyConfig = triage ? getUrgencyConfig(triage.urgency?.toLowerCase()?.trim() ?? "routine") : null;
  const UrgencyIcon = urgencyConfig?.icon;
  const isEmergency = urgencyConfig?.isEmergency ?? false;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "#F8FAFC" }}>
      {modal && <Modal title={modal.title} body={modal.body} onClose={handleCloseModal} />}

      {/* ── Emergency bar ── */}
      <AnimatePresence>
        {isEmergency && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm font-semibold text-center py-2 px-4 flex items-center justify-center gap-2"
          >
            <Siren className="w-4 h-4 animate-pulse flex-shrink-0" />
            🚨 Medical Emergency Detected — Call 911 immediately or go to the nearest ER
            <Siren className="w-4 h-4 animate-pulse flex-shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navbar ── */}
      <nav
        className={`sticky z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md ${isEmergency ? "top-9" : "top-0"}`}
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={handleScrollToTop}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1E40AF, #059669)" }}
            >
              <Heart className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-sm tracking-tight">CareSense AI</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "#1E40AF" }}>
              BETA
            </span>
          </button>
          <button
            onClick={() => handleScrollTo("how-it-works")}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium"
          >
            How it works
          </button>
        </div>
      </nav>

      <main className={`max-w-3xl mx-auto px-4 pb-24 space-y-6 ${isEmergency ? "pt-20" : "pt-10"}`}>

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-center pt-4 pb-2 relative"
        >
          <div
            className="float-slow pointer-events-none absolute -top-6 -right-12 w-48 h-48 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, #1E40AF 0%, transparent 70%)" }}
          />
          <div
            className="float-medium pointer-events-none absolute -bottom-4 -left-8 w-36 h-36 rounded-full opacity-20 blur-2xl"
            style={{ background: "radial-gradient(circle, #059669 0%, transparent 70%)" }}
          />
          <h1
            className="text-4xl md:text-5xl leading-tight text-slate-900 mb-3"
            style={{ fontFamily: "var(--font-fraunces)", fontWeight: 800 }}
          >
            Feel better,{" "}
            <em style={{ color: "#059669", fontFamily: "var(--font-fraunces)", fontWeight: 800, fontStyle: "italic" }}>
              faster
            </em>
          </h1>
          <p className="text-base text-slate-500 max-w-md mx-auto leading-relaxed mb-6">
            Describe your symptoms and get instant AI triage guidance — including home care, specialist recommendations, and providers near you.
          </p>
          <div className="flex items-center justify-center flex-wrap gap-2 mb-2">
            {[
              { icon: Shield, text: "Private & secure" },
              { icon: Zap, text: "Results in seconds" },
              { icon: MapPin, text: "Real providers nearby" },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full shadow-sm">
                <Icon className="w-3 h-3 text-blue-600" />
                {text}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── Form card ── */}
        <FadeUp delay={0.1}>
          <div
            className="relative rounded-2xl shadow-xl"
            style={{ background: "linear-gradient(135deg, #1E40AF22 0%, #05966922 100%)", padding: "2px" }}
          >
            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="h-1 w-full" style={{ background: "linear-gradient(to right, #1E40AF, #059669)" }} />

              <div className="p-6 space-y-5">
                {/* Insurance row */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Insurance
                  </p>
                  <div className="flex items-center gap-2 flex-wrap text-sm text-slate-700">
                    <span>I have</span>
                    <Dropdown
                      options={INSURANCE_PROVIDERS.map((p) => ({ value: p, label: p }))}
                      value={insuranceProvider}
                      onChange={handleProviderDropdownChange}
                      placeholder="Select provider"
                    />
                    <span>with a</span>
                    <Dropdown
                      options={PLAN_TYPES}
                      value={planType}
                      onChange={handlePlanDropdownChange}
                      placeholder="Select plan"
                    />
                    <span>plan.</span>
                  </div>
                </div>

                {/* Upload toggle */}
                <div>
                  <button
                    type="button"
                    onClick={handleToggleUpload}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {showUpload ? "Hide upload" : "Or scan your insurance card"}
                  </button>

                  <AnimatePresence>
                    {showUpload && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 overflow-hidden"
                      >
                        <label
                          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors ${
                            uploadStatus === "loading"
                              ? "border-blue-300 bg-blue-50"
                              : uploadStatus === "success"
                              ? "border-emerald-300 bg-emerald-50"
                              : uploadStatus === "error"
                              ? "border-red-300 bg-red-50"
                              : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"
                          }`}
                        >
                          {uploadStatus === "loading" ? (
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                          ) : uploadStatus === "success" ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Upload className="w-5 h-5 text-slate-400" />
                          )}
                          <span className="text-xs text-slate-500 text-center">
                            {uploadStatus === "loading"
                              ? "Reading your card…"
                              : uploadStatus === "success" && detectedLabel
                              ? `Detected: ${detectedLabel}`
                              : uploadStatus === "error"
                              ? (uploadError ?? "Upload failed. Try again.")
                              : "Click to upload insurance card (JPG, PNG, PDF)"}
                          </span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={handleFileInputChange}
                          />
                        </label>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Symptoms */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    What&apos;s going on?
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {SYMPTOM_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleSymptomChipClick(chip)}
                        className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <textarea
                      value={symptom}
                      onChange={handleSymptomTextChange}
                      placeholder="Describe your symptoms in your own words…"
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all"
                    />
                    {symptom.length > 100 && (
                      <span className="absolute bottom-2.5 right-3 text-[10px] text-slate-400">
                        {symptom.length} chars
                      </span>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Location <span className="font-normal normal-case text-slate-300">(optional — for nearby providers)</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleLocationDetect}
                      disabled={geoStatus === "loading"}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                        geoStatus === "granted"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : geoStatus === "denied"
                          ? "border-red-200 bg-red-50 text-red-500"
                          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      {geoStatus === "loading" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Navigation className="w-3.5 h-3.5" />
                      )}
                      {geoStatus === "granted"
                        ? "Location set"
                        : geoStatus === "denied"
                        ? "Access denied"
                        : geoStatus === "loading"
                        ? "Getting location…"
                        : "Use my location"}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleManualAddress}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Enter address
                    </button>
                  </div>

                  <AnimatePresence>
                    {showManual && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 overflow-hidden"
                      >
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualAddress}
                            onChange={handleManualAddressChange}
                            onKeyDown={handleManualAddressKeyDown}
                            placeholder="City, state or zip code"
                            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={handleLocationSearch}
                            disabled={geocodeStatus === "loading" || !manualAddress.trim()}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                            style={{ background: "#1E40AF" }}
                          >
                            {geocodeStatus === "loading" ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Search className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {geocodeStatus === "success" && (
                          <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Location confirmed
                          </p>
                        )}
                        {geocodeError && (
                          <p className="mt-1.5 text-xs text-red-500">{geocodeError}</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {locationBlocked && (
                    <p className="mt-2 text-xs text-slate-500">
                      🌍 CareSense AI is currently available in the US only.
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="button"
                  onClick={handleGetGuidance}
                  disabled={!isFormValid || triageLoading}
                  className="btn-gradient-pulse w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 active:scale-[0.99] shadow-md"
                  style={{ background: "linear-gradient(to right, #1E40AF, #059669)" }}
                >
                  {triageLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing…
                    </span>
                  ) : (
                    "Get Care Guidance →"
                  )}
                </button>

                {/* Error state */}
                <AnimatePresence>
                  {triageError && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-start justify-between gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3"
                    >
                      <div className="flex items-start gap-2 text-sm text-red-700">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>We hit a snag. {triageError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleGetGuidance}
                        className="text-xs font-semibold text-red-700 border border-red-200 bg-white rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors flex-shrink-0"
                      >
                        Try Again
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </FadeUp>

        {/* ── Loading overlay ── */}
        <AnimatePresence>
          {triageLoading && <LoadingOverlay />}
        </AnimatePresence>

        {/* ── Results scroll anchor ── */}
        <div ref={resultsRef} className="scroll-mt-20" />

        {/* ── Triage Result ── */}
        <AnimatePresence>
          {triage && sevConfig && SevIcon && urgencyConfig && UrgencyIcon && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`rounded-2xl border-2 bg-gradient-to-br p-6 md:p-8 ${sevConfig.gradient} ${sevConfig.border}`}
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 mb-2.5 tracking-tight">
                    Triage Assessment
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${sevConfig.badge} ${sevConfig.pulseBadge ? "severity-pulse" : ""}`}>
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${sevConfig.dot}`} />
                      {sevConfig.label}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${urgencyConfig.badge} ${urgencyConfig.pulseBadge ? "severity-pulse" : ""}`}>
                      <UrgencyIcon className="w-3 h-3" />
                      {urgencyConfig.label}
                    </span>
                  </div>
                </div>
                <SevIcon className={`w-7 h-7 mt-0.5 flex-shrink-0 ml-3 ${sevConfig.iconColor}`} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-white/70 rounded-xl p-4 backdrop-blur-sm">
                  <p className="text-xs text-slate-500 mb-1">Specialist Needed</p>
                  <p className="font-semibold text-slate-900 text-sm">{triage.specialist_needed ?? "—"}</p>
                </div>
                <div className="bg-white/70 rounded-xl p-4 backdrop-blur-sm">
                  <p className="text-xs text-slate-500 mb-1">Recommendation</p>
                  <p className="font-semibold text-slate-900 text-sm">
                    {(triage.should_see_doctor ?? false) ? "See a doctor" : "Manage at home"}
                  </p>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-2.5">Home Care Steps</h3>
                <div className="space-y-2">
                  {(triage.home_care_steps ?? []).map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-start gap-3 bg-white/60 rounded-xl p-3.5 backdrop-blur-sm"
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <p className="text-sm text-slate-700">{step}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-2.5">
                  Warning Signs — Seek Immediate Care If:
                </h3>
                <div className="space-y-2">
                  {(triage.warning_signs ?? []).map((sign, i) => (
                    <div key={i} className="flex items-start gap-3 bg-red-50/80 rounded-xl p-3.5 border border-red-100">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{sign}</p>
                    </div>
                  ))}
                </div>
              </div>

              {triage.what_to_tell_doctor?.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <ClipboardList className="w-4 h-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-700">What to Tell Your Doctor</h3>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4 backdrop-blur-sm space-y-2">
                    {(triage.what_to_tell_doctor ?? []).map((point, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <span
                          className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                          style={{ background: "#1E40AF" }}
                        >
                          {i + 1}
                        </span>
                        {point}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {triage.pre_visit_summary && (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <ClipboardList className={`w-4 h-4 ${urgencyConfig.isEmergency ? "text-red-600" : "text-slate-600"}`} />
                      <h3 className={`text-sm font-semibold ${urgencyConfig.isEmergency ? "text-red-700" : "text-slate-700"}`}>
                        {urgencyConfig.summaryLabel}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all"
                      style={
                        copiedSummary
                          ? { background: "#ECFDF5", borderColor: "#6EE7B7", color: "#047857" }
                          : { background: "white", borderColor: "#E5E7EB", color: "#374151" }
                      }
                    >
                      {copiedSummary ? (
                        <><Check className="w-3 h-3" />Copied!</>
                      ) : (
                        <><Copy className="w-3 h-3" />Copy Summary</>
                      )}
                    </button>
                  </div>
                  <div className={`rounded-xl p-4 backdrop-blur-sm ${urgencyConfig.summaryCardClass}`}>
                    <div className="space-y-2">
                      {parseSummaryLines(triage.pre_visit_summary ?? "").map(({ label, value }, i) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <span className="font-semibold text-slate-600 min-w-[130px] flex-shrink-0">{label}</span>
                          <span className="text-slate-700">{value}</span>
                        </div>
                      ))}
                    </div>
                    <p className={`text-xs mt-3 ${urgencyConfig.summaryFooterClass}`}>
                      {urgencyConfig.summaryFooter}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 bg-blue-50/80 rounded-xl p-4 border border-blue-100 backdrop-blur-sm">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-700 mb-0.5">Insurance Guidance</p>
                  <p className="text-sm text-blue-700">{triage.insurance_note ?? ""}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Providers ── */}
        {(providersLoading || (providers && !providers.error && providers.providers.length > 0)) && (
          <motion.div
            id="providers"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`rounded-2xl transition-colors ${isEmergency ? "bg-red-50/70 border border-red-200 p-4" : ""}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 flex-shrink-0 text-blue-700" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Nearby Providers</h2>
              {triage && <span className="text-sm text-slate-400">— {triage.specialist_needed}</span>}
            </div>

            {providersLoading && (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-sm">Finding providers near you…</span>
              </div>
            )}

            {!providersLoading && providers?.error && (
              <div className="bg-white rounded-2xl border border-red-100 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm mb-1">Nearest Emergency Rooms</h3>
                    <p className="text-sm text-slate-500 mb-3">We couldn&apos;t load providers automatically. For emergencies:</p>
                    <ul className="space-y-2 text-sm text-slate-700">
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 flex-shrink-0 mt-0.5">•</span>
                        <span className="font-medium text-red-600">Call 911 immediately</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-slate-400 flex-shrink-0 mt-0.5">•</span>
                        Ask someone to drive you to the nearest hospital
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-slate-400 flex-shrink-0 mt-0.5">•</span>
                        <span>
                          Search{" "}
                          <a
                            href="https://www.google.com/maps/search/emergency+room+near+me"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-dotted underline-offset-2 text-blue-700"
                          >
                            &quot;emergency room near me&quot;
                          </a>{" "}
                          on Google Maps
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {!providersLoading && providers && !providers.error && providers.providers.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 text-sm mb-2">No providers found nearby</p>
                    <div className="space-y-2 text-sm text-slate-600">
                      {isEmergency && (
                        <p className="text-red-600 font-semibold flex items-center gap-1.5">
                          <Siren className="w-4 h-4 flex-shrink-0" />
                          For emergencies: Call 911 immediately.
                        </p>
                      )}
                      <p>
                        Search{" "}
                        <a
                          href={`https://www.google.com/maps/search/${encodeURIComponent(
                            (manualAddress || "urgent care near me").trim().replace(/,$/, "") + " urgent care"
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-dotted underline-offset-2 text-blue-700"
                        >
                          {manualAddress ? `"${manualAddress} urgent care"` : "urgent care near me"}
                        </a>{" "}
                        on Google Maps.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!providersLoading && providers && !providers.error && providers.providers.length > 0 && (
              <>
                {providers.urgency_banner && (
                  <div
                    className={`mb-3 flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                      providers.urgency_banner.type === "emergency"
                        ? "bg-red-600 text-white"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {providers.urgency_banner.type === "emergency" ? (
                      <Siren className="w-4 h-4 flex-shrink-0 mt-0.5 animate-pulse" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    )}
                    {providers.urgency_banner.message}
                  </div>
                )}
                {providers.insurance_note && (
                  <div className="mb-3 flex gap-2 items-start text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                    <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {providers.insurance_note}
                  </div>
                )}
                <div className="space-y-3">
                  {providers.providers.map((p, i) => (
                    <ProviderCard key={p.place_id} provider={p} rank={i + 1} />
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── How it works ── */}
        <FadeUp delay={0.2}>
          <div id="how-it-works" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
                How CareSense AI Works
              </h2>
              <p className="text-sm text-slate-400">From symptoms to care in 3 simple steps</p>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8 relative">
              <div className="absolute top-6 left-1/6 right-1/6 h-px bg-gradient-to-r from-blue-200 via-emerald-200 to-blue-200 hidden md:block" />
              {[
                { icon: Search, step: "1", color: "#1E40AF", bg: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", title: "Describe Your Symptoms", desc: "Tell us how you're feeling. No medical jargon needed." },
                { icon: Zap, step: "2", color: "#059669", bg: "linear-gradient(135deg, #ECFDF5, #D1FAE5)", title: "Get Instant Guidance", desc: "AI triages your symptoms and tells you what to do next." },
                { icon: MapPin, step: "3", color: "#7C3AED", bg: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", title: "Find Care Near You", desc: "See the right providers nearby for your situation." },
              ].map(({ icon: Icon, step, color, bg, title, desc }) => (
                <div key={step} className="flex flex-col items-center text-center relative z-10">
                  <div className="relative mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: bg }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <span
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow"
                      style={{ background: `linear-gradient(135deg, ${color}, #059669)` }}
                    >
                      {step}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mb-1.5">{title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={handleScrollToTop}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl transition-all hover:opacity-90 hover:shadow-md active:scale-[0.98] shadow-sm"
                style={{ background: "linear-gradient(to right, #1E40AF, #059669)" }}
              >
                Get Started →
              </button>
            </div>
          </div>
        </FadeUp>

        {/* ── Trust section ── */}
        <FadeUp delay={0.3}>
          <div id="features" className="grid grid-cols-3 gap-3">
            {[
              { icon: Shield, color: "#1E40AF", bg: "#EFF6FF", title: "Private & Secure", desc: "We never store your health information", stat: "HIPAA-aware design" },
              { icon: Zap, color: "#059669", bg: "#ECFDF5", title: "Instant Guidance", desc: "AI-powered triage in under 30 seconds", stat: "< 10s average" },
              { icon: MapPin, color: "#7C3AED", bg: "#F5F3FF", title: "Real Providers", desc: "Live data from verified healthcare facilities", stat: "Powered by Google" },
            ].map(({ icon: Icon, color, bg, title, desc, stat }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <p className="text-xs font-semibold text-slate-800 mb-1">{title}</p>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">{desc}</p>
                <p className="text-[10px] font-medium" style={{ color }}>{stat}</p>
              </div>
            ))}
          </div>
        </FadeUp>

        {/* ── Footer ── */}
        <footer className="pt-8 pb-4 border-t border-slate-100">
          <div className="grid grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #1E40AF, #059669)" }}
                >
                  <Heart className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-slate-700">CareSense AI</span>
                <span className="text-[9px] font-bold px-1 py-0.5 rounded text-white" style={{ background: "#1E40AF" }}>
                  BETA
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                AI-powered healthcare triage. Not a substitute for professional medical advice.
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Product</p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <button onClick={() => handleScrollTo("how-it-works")} className="hover:text-slate-700 transition-colors">
                    How it works
                  </button>
                </li>
                <li>
                  <button onClick={() => handleScrollTo("features")} className="hover:text-slate-700 transition-colors">
                    Features
                  </button>
                </li>
                <li>
                  <button onClick={() => handleScrollTo("providers")} className="hover:text-slate-700 transition-colors">
                    Providers
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Legal</p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <button onClick={() => handleOpenModal("privacy")} className="hover:text-slate-700 transition-colors">
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button onClick={() => handleOpenModal("terms")} className="hover:text-slate-700 transition-colors">
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button onClick={() => handleOpenModal("terms")} className="hover:text-slate-700 transition-colors">
                    Disclaimer
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-300">
              Made with care · CareSense AI is not a substitute for professional medical advice. In an emergency, call 911.
            </p>
            <p className="text-xs text-slate-300">© 2026</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
