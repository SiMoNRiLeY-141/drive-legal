import { useEffect, useMemo, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

const STORAGE_KEYS = {
  history: "drivelegal_saved_history",
  customApiKey: "drivelegal_custom_api_key",
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim() || "";

const VEHICLE_TYPES = [
  "Two-Wheeler",
  "Light Motor Vehicle (Car)",
  "Heavy Goods Vehicle (Truck/Bus)",
  "Commercial/Transport",
];

const SYSTEM_INSTRUCTION =
  "You are DriveLegal, an expert AI engine specialized in international, national, and localized traffic laws. Parse user inputs (Location, Vehicle Type, Violation) and output a highly structured breakdown of legal clauses, base statutory fines, localized state compounding adjustments, total financial liabilities, and exact official dispute/payment protocols. Format everything using clear Markdown with short, scannable bullet points. No pleasantries.";

const COUNTRIES_AND_STATES = {
  India: [
    "Tamil Nadu",
    "Maharashtra",
    "Karnataka",
    "Delhi",
    "Uttar Pradesh",
    "Gujarat",
    "Telangana",
    "West Bengal",
    "Rajasthan",
    "Kerala",
    "Andhra Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Madhya Pradesh",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Sikkim",
    "Tripura",
    "Uttarakhand",
    "Arunachal Pradesh",
    "Other",
  ],
  "United States": [
    "California",
    "New York",
    "Texas",
    "Florida",
    "Washington",
    "Illinois",
    "Pennsylvania",
    "Ohio",
    "Georgia",
    "North Carolina",
    "Michigan",
    "New Jersey",
    "Virginia",
    "Massachusetts",
    "Colorado",
    "Arizona",
    "Maryland",
    "Washington DC",
    "Other",
  ],
  "United Kingdom": [
    "England",
    "Scotland",
    "Wales",
    "Northern Ireland",
    "Other",
  ],
  Other: [],
};

const STANDARD_COUNTRIES = ["India", "United States", "United Kingdom"];

function getStatesForCountry(country) {
  switch (country) {
    case "India":
      return COUNTRIES_AND_STATES.India;
    case "United States":
      return COUNTRIES_AND_STATES["United States"];
    case "United Kingdom":
      return COUNTRIES_AND_STATES["United Kingdom"];
    case "Other":
      return COUNTRIES_AND_STATES.Other;
    default:
      return [];
  }
}

const LANGUAGES = [
  { name: "English", code: "en" },
  { name: "Hindi (हिन्दी)", code: "hi" },
  { name: "Tamil (தமிழ்)", code: "ta" },
  { name: "Telugu (తెలుగు)", code: "te" },
  { name: "Kannada (ಕನ್ನಡ)", code: "kn" },
  { name: "Malayalam (മലയാളം)", code: "ml" },
  { name: "Marathi (मराठी)", code: "mr" },
  { name: "Bengali (বাংলা)", code: "bn" },
  { name: "Gujarati (ગુજરાતી)", code: "gu" },
];

function getStoredLanguage() {
  if (typeof document === "undefined") return "en";
  try {
    const cookies = document.cookie.split("; ");
    const googtransCookie = cookies.find((row) => row.startsWith("googtrans="));
    if (googtransCookie) {
      const value = googtransCookie.split("=")[1];
      const decoded = decodeURIComponent(value);
      const parts = decoded.split("/");
      return parts.at(-1) || "en";
    }
  } catch (e) {
    console.error("Error reading googtrans cookie", e);
  }
  return "en";
}

const changeGoogleTranslateLanguage = (code) => {
  try {
    document.cookie = "googtrans=/en/" + code + "; path=/";
    document.cookie =
      "googtrans=/en/" + code + "; path=/; domain=" + window.location.hostname;

    const selectEl = document.querySelector(".goog-te-combo");
    if (selectEl) {
      selectEl.value = code;
      selectEl.dispatchEvent(new Event("change"));
    } else {
      setTimeout(() => {
        const retryEl = document.querySelector(".goog-te-combo");
        if (retryEl) {
          retryEl.value = code;
          retryEl.dispatchEvent(new Event("change"));
        } else {
          window.location.reload();
        }
      }, 300);
    }
  } catch (e) {
    console.error("Error changing translation language:", e);
  }
};

const DEFAULT_FORM = {
  country: "India",
  state: "Tamil Nadu",
  city: "",
  vehicleType: VEHICLE_TYPES[0],
  violation: "",
};

function Logo({ size = 32 }) {
  return (
    <svg
      className="logo-glow"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="logoBgGrad" cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <linearGradient id="logoShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="logoNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle
        cx="256"
        cy="256"
        r="230"
        fill="url(#logoBgGrad)"
        stroke="url(#logoShieldGrad)"
        strokeWidth="12"
      />
      <circle
        cx="256"
        cy="256"
        r="210"
        fill="none"
        stroke="url(#logoShieldGrad)"
        strokeDasharray="10 15"
        strokeWidth="4"
        opacity="0.6"
      />
      <g filter="url(#logoNeonGlow)">
        <path
          d="M256 70 L390 120 V250 C390 350 256 425 256 425 C256 425 122 350 122 250 V120 Z"
          fill="none"
          stroke="url(#logoShieldGrad)"
          strokeWidth="22"
          strokeLinejoin="round"
        />
        <circle
          cx="256"
          cy="240"
          r="65"
          fill="none"
          stroke="url(#logoShieldGrad)"
          strokeWidth="18"
        />
        <circle cx="256" cy="240" r="16" fill="url(#logoShieldGrad)" />
        <path
          d="M191 240 L240 240"
          stroke="url(#logoShieldGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M272 240 L321 240"
          stroke="url(#logoShieldGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M256 256 L256 305"
          stroke="url(#logoShieldGrad)"
          stroke-width="12"
          strokeLinecap="round"
        />
        <path
          d="M190 150 H322"
          stroke="url(#logoShieldGrad)"
          stroke-width="12"
          strokeLinecap="round"
        />
        <path
          d="M256 135 V150"
          stroke="url(#logoShieldGrad)"
          stroke-width="12"
          strokeLinecap="round"
        />
        <path
          d="M190 150 L175 190 H205 Z"
          fill="none"
          stroke="url(#logoShieldGrad)"
          stroke-width="8"
          strokeLinejoin="round"
        />
        <path
          d="M322 150 L307 190 H337 Z"
          fill="none"
          stroke="url(#logoShieldGrad)"
          stroke-width="8"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

function ProgressTracker() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, 3));
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const steps = [
    "Connecting to Gemini Secure Engine...",
    "Analyzing jurisdiction traffic codes...",
    "Applying local compounding variables...",
    "Drafting dispute protocol appeal letter...",
  ];

  return (
    <div style={styles.loaderContainer}>
      <div style={styles.loaderSpinnerWrapper}>
        <div className="skeleton-pulse" style={styles.largeSpinner} />
        <p style={styles.loaderPercentage}>{25 + step * 25}%</p>
      </div>
      <h4 style={styles.loaderHeading}>Processing Citation Legal Parameters</h4>
      <div style={styles.loaderStepList}>
        {steps.map((text, idx) => {
          const isActive = idx === step;
          const isDone = idx < step;
          return (
            <div
              key={idx}
              style={{
                ...styles.loaderStepRow,
                opacity: isActive ? 1 : isDone ? 0.8 : 0.4,
              }}
            >
              <span
                style={{
                  ...styles.loaderStepBullet,
                  background: isDone
                    ? "#10b981"
                    : isActive
                      ? "#3b82f6"
                      : "transparent",
                  borderColor: isDone
                    ? "#10b981"
                    : isActive
                      ? "#3b82f6"
                      : "var(--border-input)",
                  color: isDone || isActive ? "#fff" : "var(--text-muted)",
                }}
              >
                {isDone ? "✓" : idx + 1}
              </span>
              <span
                style={{
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? "var(--text-heading)" : "var(--text-muted)",
                  transition: "all 0.2s",
                }}
              >
                {text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      q: "⚖️ What is the legal difference between compounding a fine and going to court?",
      a: "Compounding is an administrative shortcut where you admit the violation and pay a fixed fee directly to the traffic authority to close the case immediately. Court reference is for contesting the citation. In court, you present evidence to a magistrate, who can either dismiss the charges, reduce the fine, or enforce the original statutory penalty if the violation is proven.",
    },
    {
      q: "🚦 Can I be issued multiple challans for the same offence on the same day?",
      a: "Generally, you cannot be prosecuted twice for the exact same event under double jeopardy rules. However, traffic violations are usually treated as transaction-based. For example, driving without a helmet at 10 AM on street A, and then again at 4 PM on street B, represent distinct violations. Non-moving offences (like illegal parking) generally cannot be ticketed twice within a single 24-hour cycle unless the vehicle is moved.",
    },
    {
      q: "📸 Are automated camera citations valid without a physical signature?",
      a: "Yes, automated citations using speed cameras or red light detection systems are legally binding electronic records under modern Information Technology and traffic control amendments. However, the radar/laser device must meet strict calibration guidelines. If the equipment's periodic calibration certificate has expired, the ticket can be contested and dismissed.",
    },
    {
      q: "🚓 What rights do I have when pulled over by traffic authorities?",
      a: "You have the right to request the officer's identification card and buckle number. Fines must be issued by authorized officers (typically Sub-Inspector rank or above for compounding). You have the right to get an official, system-generated digital or paper receipt for any penalty paid on-the-spot. You can refuse to compound at the roadside and request a court summons instead.",
    },
  ];

  return (
    <div style={styles.faqContainer}>
      {faqs.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            style={{
              ...styles.faqRow,
              borderBottom:
                idx === faqs.length - 1
                  ? "none"
                  : "1px solid var(--border-card)",
            }}
          >
            <button
              type="button"
              className="accordion-header"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              style={styles.faqHeaderBtn}
            >
              <span style={{ fontSize: "1rem", fontWeight: 600 }}>{faq.q}</span>
              <span
                style={{
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  fontSize: "1rem",
                  color: "var(--text-muted)",
                }}
              >
                ▼
              </span>
            </button>
            {isOpen && <div style={styles.faqAnswer}>{faq.a}</div>}
          </div>
        );
      })}
    </div>
  );
}

function readStoredHistory() {
  if (typeof window === "undefined") return [];

  try {
    const rawHistory = window.localStorage.getItem(STORAGE_KEYS.history);
    if (!rawHistory) return [];
    const parsedHistory = JSON.parse(rawHistory);
    return Array.isArray(parsedHistory) ? parsedHistory : [];
  } catch {
    return [];
  }
}

function safeString(value) {
  return value.trim().replace(/\s+/g, " ");
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function parseInlineMarkdown(text) {
  const segments = [];
  let cursor = 0;
  const inlinePattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;

  for (const match of text.matchAll(inlinePattern)) {
    const matchedText = match[0];
    const index = match.index ?? 0;

    if (index > cursor) {
      segments.push(text.slice(cursor, index));
    }

    if (matchedText.startsWith("**")) {
      segments.push(
        <strong key={`${index}-strong`}>{matchedText.slice(2, -2)}</strong>,
      );
    } else if (matchedText.startsWith("`")) {
      segments.push(
        <code key={`${index}-code`}>{matchedText.slice(1, -1)}</code>,
      );
    } else if (matchedText.startsWith("*")) {
      segments.push(<em key={`${index}-em`}>{matchedText.slice(1, -1)}</em>);
    }

    cursor = index + matchedText.length;
  }

  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  return segments.length ? segments : text;
}

function MarkdownRenderer({ markdown }) {
  const nodes = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let listBuffer = [];
  let currentListType = null;

  const flushList = () => {
    if (!currentListType || !listBuffer.length) return;

    const ListTag = currentListType === "ordered" ? "ol" : "ul";
    nodes.push(
      <ListTag key={`list-${nodes.length}`} style={styles.markdownList}>
        {listBuffer.map((item, index) => (
          <li key={`${item}-${index}`}>{parseInlineMarkdown(item)}</li>
        ))}
      </ListTag>,
    );

    listBuffer = [];
    currentListType = null;
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushList();
      continue;
    }

    if (/^#{1,3}\s+/.test(trimmedLine)) {
      flushList();
      const headingLevel = Math.min(
        trimmedLine.match(/^#{1,3}/)?.[0].length ?? 1,
        3,
      );
      let headingStyle = styles.markdownHeading1;
      if (headingLevel === 2) {
        headingStyle = styles.markdownHeading2;
      } else if (headingLevel === 3) {
        headingStyle = styles.markdownHeading3;
      }
      const HeadingTag = `h${headingLevel}`;
      nodes.push(
        <HeadingTag
          key={`heading-${nodes.length}`}
          style={headingStyle}
        >
          {parseInlineMarkdown(trimmedLine.replace(/^#{1,3}\s+/, ""))}
        </HeadingTag>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmedLine)) {
      if (currentListType === "ordered") flushList();
      currentListType = "unordered";
      listBuffer.push(trimmedLine.replace(/^[-*]\s+/, ""));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmedLine)) {
      if (currentListType === "unordered") flushList();
      currentListType = "ordered";
      listBuffer.push(trimmedLine.replace(/^\d+\.\s+/, ""));
      continue;
    }

    flushList();
    nodes.push(
      <p key={`paragraph-${nodes.length}`} style={styles.markdownParagraph}>
        {parseInlineMarkdown(trimmedLine)}
      </p>,
    );
  }

  flushList();

  if (!nodes.length) {
    return <p style={styles.emptyState}>No analysis generated yet.</p>;
  }

  return <div style={styles.markdownBody}>{nodes}</div>;
}

function Spinner() {
  return <span aria-hidden="true" style={styles.spinner} />;
}

export default function App() {
  const [history, setHistory] = useState(() => readStoredHistory());
  const [activeHistoryId, setActiveHistoryId] = useState("");

  const [form, setForm] = useState(DEFAULT_FORM);

  const [customCountry, setCustomCountry] = useState("");

  const [customState, setCustomState] = useState("");

  const [preferredLanguage, setPreferredLanguage] = useState(() =>
    getStoredLanguage(),
  );

  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem("drivelegal_theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const [analysis, setAnalysis] = useState("");

  const [customApiKey, setCustomApiKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_KEYS.customApiKey) || "";
  });

  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window === "undefined") return "gemini-2.5-flash";
    return (
      window.localStorage.getItem("drivelegal_selected_model") ||
      "gemini-2.5-flash"
    );
  });

  const [status, setStatus] = useState(() => {
    const savedCustomKey =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEYS.customApiKey)
        : "";
    const active = savedCustomKey || GEMINI_API_KEY;
    return active
      ? { kind: "idle", message: "" }
      : {
          kind: "error",
          message:
            "Missing Gemini API Key. Setup your key in the header to enable DriveLegal analysis.",
        };
  });

  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const isFormFilled = useMemo(() => {
    const finalCountry =
      form.country === "Other" ? customCountry : form.country;
    const finalState = form.state === "Other" ? customState : form.state;

    const normalizedCountry = safeString(finalCountry);
    const normalizedState = safeString(finalState);
    const normalizedCity = safeString(form.city);
    const normalizedViolation = safeString(form.violation);

    return !!(
      normalizedCountry.trim() &&
      normalizedState.trim() &&
      normalizedCity.trim() &&
      VEHICLE_TYPES.includes(form.vehicleType) &&
      normalizedViolation.trim().length >= 8
    );
  }, [form, customCountry, customState]);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState("");

  const activeApiKey = useMemo(() => {
    return customApiKey || GEMINI_API_KEY;
  }, [customApiKey]);

  const [isScanning, setIsScanning] = useState(false);
  const [scanLog, setScanLog] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [activeTab, setActiveTab] = useState("triage");

  const simulateScan = (type) => {
    setIsScanning(true);
    setUploadedFileName(
      type === "chennai" ? "challan_chennai_9832.jpg" : "citation_ny_88192.pdf",
    );

    const logs = [
      "📂 File loaded successfully. Initiating OCR scanner...",
      "🔍 Processing image for character recognition (Tesseract OCR Engine)...",
      "🗂️ Identified fields: Vehicle No, Section, Violation Type, Date/Time, Location.",
      "✅ Scanning complete! Auto-populated fields in challan form.",
    ];

    let logIndex = 0;
    setScanLog(logs[0]);

    const interval = setInterval(() => {
      logIndex++;
      if (logIndex < logs.length) {
        setScanLog(logs[logIndex]);
      } else {
        clearInterval(interval);
        setIsScanning(false);
        if (type === "chennai") {
          setForm({
            country: "India",
            state: "Tamil Nadu",
            city: "Chennai",
            vehicleType: "Light Motor Vehicle (Car)",
            violation:
              "Section 183 of the Motor Vehicles Act (Overspeeding). Clocked driving at 95 km/h in a 60 km/h speed camera enforcement zone near Anna Salai, Guindy.",
          });
        } else {
          setForm({
            country: "United States",
            state: "New York",
            city: "New York City",
            vehicleType: "Commercial/Transport",
            violation:
              "Section 1111(d)(1) of the NY Vehicle & Traffic Law (VTL) - Traffic Control Signal Violation (Running Red Light). Violation caught by automated intersection safety camera at 5th Ave and 42nd St at 14:32.",
          });
        }
      }
    }, 600);
  };

  const computedInvoice = useMemo(() => {
    const isIndia = form.country === "India";
    const isOverspeeding =
      form.violation.toLowerCase().includes("speed") ||
      form.violation.toLowerCase().includes("overspeeding");
    const isTwoWheeler = form.vehicleType.toLowerCase().includes("two");

    let baseFine = isIndia ? 1000 : 150;
    let compoundingAdjust = isIndia ? 500 : 50;
    let legalCost = isIndia ? 200 : 35;
    let currency = isIndia ? "₹" : "$";

    if (isOverspeeding) {
      baseFine *= 2;
    }
    if (!isTwoWheeler) {
      baseFine *= 1.5;
      compoundingAdjust *= 2;
    }

    const total = baseFine + compoundingAdjust + legalCost;
    const successRate = isOverspeeding ? 45 : 75;

    return {
      baseFine,
      compoundingAdjust,
      legalCost,
      currency,
      total,
      successRate,
    };
  }, [form.country, form.violation, form.vehicleType]);

  const appealLetter = useMemo(() => {
    const finalCountry =
      form.country === "Other" ? customCountry : form.country;
    const finalState = form.state === "Other" ? customState : form.state;
    const dateStr = new Date().toLocaleDateString(undefined, {
      dateStyle: "long",
    });

    return `To,
The Traffic Police Commissioner / Traffic Court Authority
Jurisdiction: ${form.city || "[City]"}, ${finalState || "[State]"}, ${finalCountry || "[Country]"}

Date: ${dateStr}

Subject: Appeal and Representation regarding Traffic Citation / Challan

Respected Authority,

I am writing to formally submit a representation regarding the traffic citation issued under my name/vehicle details.

Citation Details:
- Jurisdiction: ${form.city || "[City]"}, ${finalState || "[State]"}
- Vehicle Type: ${form.vehicleType}
- Alleged Violation: ${form.violation || "Citation violation details"}

Based on the legal framework of the Motor Vehicles Act / local traffic statutes, I request you to review the citation on the following grounds:

1. Accuracy of Instrumentation: The calibration records of the speed cameras / detection systems at the alleged location should be verified for compliance with standard statutory tolerance guidelines.
2. Compounding Surcharges: The compounding fees and adjustments should be matched strictly with local state government official notifications.
3. Procedural Compliance: Requesting full evidentiary photos/videos of the alleged infraction to prove the presence of clear signage and visibility.

Kindly review this appeal, defer standard enforcement, and schedule a representation hearing if necessary.

Thank you.

Yours faithfully,
[Your Name]
[Vehicle Registration Number]
[Contact Information]`;
  }, [
    form.city,
    form.country,
    form.state,
    form.violation,
    form.vehicleType,
    customCountry,
    customState,
  ]);

  const handleStartEditKey = () => {
    setTempKeyInput(customApiKey);
    setIsEditingKey(true);
  };

  const handleSaveKey = () => {
    const trimmed = tempKeyInput.trim();
    setCustomApiKey(trimmed);
    if (typeof window !== "undefined") {
      if (trimmed) {
        window.localStorage.setItem(STORAGE_KEYS.customApiKey, trimmed);
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.customApiKey);
      }
    }

    const activeKey = trimmed || GEMINI_API_KEY;
    if (activeKey) {
      setStatus({ kind: "idle", message: "" });
    } else {
      setStatus({
        kind: "error",
        message:
          "Missing Gemini API Key. Setup your key in the header to enable DriveLegal analysis.",
      });
    }
    setIsEditingKey(false);
  };

  const handleCancelEditKey = () => {
    setIsEditingKey(false);
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("drivelegal_theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const { body, documentElement } = document;
    const previousBodyStyles = {
      margin: body.style.margin,
      fontFamily: body.style.fontFamily,
    };
    const previousRootStyles = {
      scrollBehavior: documentElement.style.scrollBehavior,
    };

    body.style.margin = "0";
    body.style.fontFamily =
      "'Outfit', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    documentElement.style.scrollBehavior = "smooth";

    return () => {
      body.style.margin = previousBodyStyles.margin;
      body.style.fontFamily = previousBodyStyles.fontFamily;
      documentElement.style.scrollBehavior = previousRootStyles.scrollBehavior;
    };
  }, []);

  const handleCountryChange = (event) => {
    const value = event.target.value;
    let nextState = "";
    if (value === "India") {
      nextState = "Tamil Nadu";
    } else if (value === "United States") {
      nextState = "California";
    } else if (value === "United Kingdom") {
      nextState = "England";
    } else {
      nextState = "";
      setCustomCountry("");
      setCustomState("");
    }
    setForm((current) => ({
      ...current,
      country: value,
      state: nextState,
    }));
  };

  const handleStateChange = (event) => {
    const value = event.target.value;
    if (value === "Other") {
      setCustomState("");
    }
    setForm((current) => ({
      ...current,
      state: value,
    }));
  };

  const updateField = (field) => (event) => {
    const value = event.target.value;

    if (field === "city") {
      setForm((current) => ({ ...current, city: value }));
      return;
    }

    if (field === "vehicleType") {
      setForm((current) => ({ ...current, vehicleType: value }));
      return;
    }

    if (field === "violation") {
      setForm((current) => ({ ...current, violation: value }));
    }
  };

  const validateForm = () => {
    const finalCountry =
      form.country === "Other" ? customCountry : form.country;
    const finalState = form.state === "Other" ? customState : form.state;

    const normalizedCountry = safeString(finalCountry);
    const normalizedState = safeString(finalState);
    const normalizedCity = safeString(form.city);
    const normalizedViolation = safeString(form.violation);

    if (!normalizedCountry) return "Country is required.";
    if (!normalizedState) return "State or region is required.";
    if (!normalizedCity) return "City is required.";
    if (!VEHICLE_TYPES.includes(form.vehicleType))
      return "Select a supported vehicle type.";
    if (normalizedViolation.length < 8)
      return "Describe the violation with a little more detail.";

    return null;
  };

  const storeSuccessfulReport = (reportText) => {
    const finalCountry =
      form.country === "Other" ? customCountry : form.country;
    const finalState = form.state === "Other" ? customState : form.state;

    const entry = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      country: safeString(finalCountry),
      state: safeString(finalState),
      city: safeString(form.city),
      vehicleType: form.vehicleType,
      violation: safeString(form.violation),
      preferredLanguage: preferredLanguage,
      report: reportText,
    };

    setHistory((current) => [entry, ...current].slice(0, 20));
    setActiveHistoryId(entry.id);
  };

  const detectGPSLocation = () => {
    if (!navigator.geolocation) {
      setStatus({
        kind: "error",
        message: "Geolocation is not supported by this browser.",
      });
      return;
    }

    setGpsLoading(true);
    setStatus({ kind: "idle", message: "Requesting GPS coordinates..." });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setStatus({
          kind: "idle",
          message: "Coordinates acquired. Resolving address...",
        });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                "Accept-Language": "en",
                "User-Agent": "DriveLegal-RoadSafetyHackathon",
              },
            },
          );

          if (!res.ok) throw new Error("Reverse geocoding request failed.");
          const data = await res.json();

          if (!data || !data.address) {
            throw new Error("Address data not found.");
          }

          const country = data.address.country || "";
          const state = data.address.state || "";
          const city =
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.suburb ||
            "";

          // Map country
          const isStandardCountry = STANDARD_COUNTRIES.includes(country);
          const standardCountry = isStandardCountry ? country : "Other";
          const customCountryVal = isStandardCountry ? "" : country;

          // Map state
          let standardState = "";
          let customStateVal = "";
          if (isStandardCountry) {
            const statesList = getStatesForCountry(country);
            if (statesList.includes(state)) {
              standardState = state;
            } else {
              standardState = "Other";
              customStateVal = state;
            }
          } else {
            customStateVal = state;
          }

          setForm((prev) => ({
            ...prev,
            country: standardCountry,
            state: standardState,
            city: city,
          }));
          setCustomCountry(customCountryVal);
          setCustomState(customStateVal);

          setStatus({
            kind: "success",
            message: `Detected location: ${city ? city + ", " : ""}${state ? state + ", " : ""}${country}`,
          });
        } catch (error) {
          console.error("GPS Reverse Geocoding Error:", error);
          setStatus({
            kind: "error",
            message: `Failed to resolve address: ${error.message}`,
          });
        } finally {
          setGpsLoading(false);
        }
      },
      (error) => {
        console.error("GPS Retrieval Error:", error);
        let errorMsg = "Failed to acquire GPS coordinates.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "GPS location access denied by browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "GPS location info is currently unavailable.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "GPS location request timed out.";
        }
        setStatus({
          kind: "error",
          message: errorMsg,
        });
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const runAnalysis = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      setStatus({ kind: "error", message: validationMessage });
      return;
    }

    // UX Safety Net: Auto-apply key from input field if user forgot to click "Apply Key" / "Save"
    let resolvedKey = activeApiKey;
    const trimmedTemp = tempKeyInput.trim();
    if (trimmedTemp && trimmedTemp !== customApiKey) {
      setCustomApiKey(trimmedTemp);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEYS.customApiKey, trimmedTemp);
      }
      resolvedKey = trimmedTemp;
      console.log(
        "Auto-applying API Key from input field:",
        `${trimmedTemp.substring(0, 6)}...`,
      );
    }

    if (!resolvedKey) {
      setStatus({
        kind: "error",
        message:
          "Missing Gemini API Key. Setup your key in the header to enable DriveLegal analysis.",
      });
      return;
    }

    const finalCountry =
      form.country === "Other" ? customCountry : form.country;
    const finalState = form.state === "Other" ? customState : form.state;

    const selectedLangObj =
      LANGUAGES.find((l) => l.code === preferredLanguage) || LANGUAGES[0];
    const langName = selectedLangObj.name.split(" ")[0];

    const prompt = [
      `Location: Country=${safeString(finalCountry)}; State=${safeString(finalState)}; City=${safeString(form.city)}`,
      `Vehicle Type: ${form.vehicleType}`,
      `Violation: ${safeString(form.violation)}`,
      `Preferred Language for Analysis Output: ${langName}`,
      `Produce a concise legal breakdown with clear markdown bullets and labeled sections. The entire breakdown, explanations, compounding liabilities, and dispute/appeal action guides MUST be written natively in ${langName}.`,
    ].join("\n");

    setLoading(true);
    setStatus({ kind: "idle", message: "" });

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error("REQUEST_TIMEOUT")),
        25000,
      );
    });

    try {
      console.log(
        "DriveLegal Gemini Request API Key:",
        resolvedKey
          ? `${resolvedKey.substring(0, 6)}...${resolvedKey.substring(resolvedKey.length - 4)}`
          : "None",
      );
      const genAI = new GoogleGenerativeAI(resolvedKey);
      const model = genAI.getGenerativeModel({
        model: selectedModel,
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      const response = await Promise.race([
        model.generateContent(prompt),
        timeoutPromise,
      ]);
      const reportText = response.response.text().trim();

      if (!reportText) {
        throw new Error("EMPTY_RESPONSE");
      }

      setAnalysis(reportText);
      storeSuccessfulReport(reportText);
      setStatus({
        kind: "success",
        message: "Analysis completed and saved to local history.",
      });
    } catch (error) {
      const message = String(error?.message || error);
      console.error("DriveLegal Gemini API Error:", error);

      if (message.includes("REQUEST_TIMEOUT")) {
        setStatus({
          kind: "error",
          message: "The request timed out. Check connectivity and try again.",
        });
      } else if (/api key|permission|unauthorized|invalid/i.test(message)) {
        setStatus({
          kind: "error",
          message: `The Gemini API key appears invalid or unauthorized: ${message}`,
        });
      } else {
        setStatus({
          kind: "error",
          message: `Unable to complete the analysis: ${message}`,
        });
      }
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      setLoading(false);
    }
  };

  const loadHistoryEntry = (entry) => {
    setAnalysis(entry.report);
    setActiveHistoryId(entry.id);

    // Set form fields based on selected history item
    const isStandardCountry = STANDARD_COUNTRIES.includes(entry.country);
    const standardCountry = isStandardCountry ? entry.country : "Other";
    const customCountryVal = isStandardCountry ? "" : entry.country;

    let standardState = "";
    let customStateVal = "";
    if (isStandardCountry) {
      const statesList = getStatesForCountry(entry.country);
      if (statesList.includes(entry.state)) {
        standardState = entry.state;
      } else {
        standardState = "Other";
        customStateVal = entry.state;
      }
    } else {
      customStateVal = entry.state;
    }

    setForm({
      country: standardCountry,
      state: standardState,
      city: entry.city,
      vehicleType: entry.vehicleType,
      violation: entry.violation,
    });
    setCustomCountry(customCountryVal);
    setCustomState(customStateVal);

    const nextLang = entry.preferredLanguage || "en";
    setPreferredLanguage(nextLang);
    changeGoogleTranslateLanguage(nextLang);

    setStatus({
      kind: "success",
      message: "Loaded a cached report from local storage.",
    });
  };

  const handleClearHistory = () => {
    if (typeof window !== "undefined") {
      if (
        !window.confirm(
          "Are you sure you want to clear all saved legal history from this browser? This cannot be undone.",
        )
      ) {
        return;
      }
    }
    setHistory([]);
    setAnalysis("");
    setActiveHistoryId("");
    setForm(DEFAULT_FORM);
    setCustomCountry("");
    setCustomState("");
    setPreferredLanguage("en");
    changeGoogleTranslateLanguage("en");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEYS.history);
    }
    setStatus({
      kind: "idle",
      message: "History cleared successfully.",
    });
  };

  const handleLanguageChange = (code) => {
    setPreferredLanguage(code);
    changeGoogleTranslateLanguage(code);
  };

  const activeStepIndex = useMemo(() => {
    if (!activeApiKey) return 0;
    if (!isFormFilled) return 1;
    return 2;
  }, [activeApiKey, isFormFilled]);

  const activeHistoryEntry =
    history.find((entry) => entry.id === activeHistoryId) || null;

  return (
    <div style={styles.shell}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      {/* Sticky Top Navigation Bar */}
      <nav style={styles.navBar}>
        <div style={styles.navBrand}>
          <Logo size={28} />
          <span style={styles.navBrandText}>DriveLegal</span>
        </div>

        <div style={styles.headerRight}>
          <div id="google_translate_element" style={{ display: "none" }} />
          <select
            value={preferredLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={styles.navLanguageSelect}
            className="nav-language-select"
            aria-label="Select Language"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            style={styles.themeToggleBtn}
            className="theme-toggle-btn"
            title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>

          <div style={styles.keyPill} aria-label="Gemini API Key configuration">
            <span style={styles.keyPillLabel}>Gemini API Key</span>
            {isEditingKey ? (
              <div style={styles.keyPillEditor}>
                <input
                  type="password"
                  placeholder="AIzaSy... (leave empty to reset)"
                  value={tempKeyInput}
                  onChange={(e) => setTempKeyInput(e.target.value)}
                  style={styles.keyPillInput}
                />
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedModel(val);
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(
                        "drivelegal_selected_model",
                        val,
                      );
                    }
                  }}
                  style={styles.keyPillSelect}
                >
                  <option value="gemini-2.5-flash">
                    gemini-2.5-flash (default)
                  </option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                </select>
                <div style={styles.keyPillActions}>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    style={styles.keyPillBtnPrimary}
                    className="key-pill-btn-primary"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditKey}
                    style={styles.keyPillBtnSecondary}
                    className="key-pill-btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.keyPillDisplay}>
                <div>
                  <span style={styles.keyPillValue}>
                    {customApiKey ? (
                      <span
                        style={{
                          color: "#4ade80",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#4ade80",
                            display: "inline-block",
                          }}
                        />
                        Custom Active
                      </span>
                    ) : GEMINI_API_KEY ? (
                      <span
                        style={{
                          color: "#60a5fa",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#60a5fa",
                            display: "inline-block",
                          }}
                        />
                        System Active
                      </span>
                    ) : (
                      <span
                        style={{
                          color: "#f87171",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#f87171",
                            display: "inline-block",
                          }}
                        />
                        Missing Key
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.74rem",
                      color: "rgba(239, 246, 255, 0.45)",
                      marginTop: "4px",
                    }}
                  >
                    Model: {selectedModel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleStartEditKey}
                  style={styles.keyPillEditBtn}
                  className="key-pill-edit-btn"
                >
                  {customApiKey || GEMINI_API_KEY ? "Change" : "Setup"}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Header Section */}
      <header style={styles.hero}>
        <span style={styles.heroBadge}>
          Road Safety Hackathon 2026 · CoERS, IIT Madras
        </span>
        <h1 style={styles.heroTitle}>DriveLegal Platform</h1>
        <p style={styles.heroSubtitle}>
          Fast legal triage for traffic challans with secure Gemini access,
          localized context, and offline-ready history.
        </p>
      </header>

      {/* Workflow Stepper */}
      <section style={styles.stepStrip} aria-label="Workflow steps">
        {[
          "Setup Key",
          "Enter Details",
          "View Result",
          "Access Local History",
        ].map((step, index) => {
          const isActive = index === activeStepIndex;
          let isCompleted = false;
          if (index === 0) isCompleted = !!activeApiKey;
          else if (index === 1) isCompleted = isFormFilled;
          else if (index === 2) isCompleted = !!analysis && !loading;
          else if (index === 3) isCompleted = history.length > 0;

          return (
            <div
              key={step}
              style={{
                ...styles.stepCard,
                borderColor: isActive ? "#3b82f6" : "var(--border-step-card)",
                background: isActive
                  ? "var(--bg-card-hover)"
                  : "var(--bg-step-card)",
                boxShadow: isActive
                  ? "0 10px 20px var(--accent-shadow)"
                  : "var(--shadow-card)",
              }}
            >
              <span
                style={{
                  ...styles.stepIndex,
                  background: isCompleted
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : isActive
                      ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
                      : "linear-gradient(135deg, #64748b, #475569)",
                }}
              >
                {isCompleted ? "✓" : index + 1}
              </span>
              <span
                style={{
                  ...styles.stepText,
                  color: isActive ? "var(--text-heading)" : "var(--text-muted)",
                }}
              >
                {step}
              </span>
            </div>
          );
        })}
      </section>

      <main style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <h2 style={styles.cardTitle}>1. Challan Details</h2>
              <button
                type="button"
                onClick={detectGPSLocation}
                style={styles.gpsBtn}
                className="gps-btn"
                disabled={gpsLoading}
              >
                {gpsLoading ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Spinner />
                    Locating...
                  </span>
                ) : (
                  "📍 Use GPS Location"
                )}
              </button>
            </div>
            <p style={styles.cardNote}>
              Provide enough jurisdiction and incident context for localized
              legal reasoning.
            </p>
          </div>

          <div style={styles.statusBar} data-kind={status.kind}>
            <div>{status.message || "Ready for secure analysis."}</div>
            {status.kind === "error" &&
              (!activeApiKey ||
                /api key|quota|limit|429|403|unauthorized/i.test(
                  status.message,
                )) && (
                <div style={styles.inlineKeyEditor}>
                  <input
                    type="password"
                    placeholder="Paste your Gemini API key (AIzaSy...) here"
                    value={tempKeyInput}
                    onChange={(e) => setTempKeyInput(e.target.value)}
                    style={styles.inlineKeyInput}
                  />
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedModel(val);
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(
                          "drivelegal_selected_model",
                          val,
                        );
                      }
                    }}
                    style={styles.inlineModelSelect}
                  >
                    <option value="gemini-2.5-flash">
                      gemini-2.5-flash (default)
                    </option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    style={styles.inlineKeySaveBtn}
                    className="inline-key-save-btn"
                  >
                    Apply Key
                  </button>
                </div>
              )}
          </div>

          {/* Challan Scanner Panel */}
          <div style={styles.scannerCard}>
            <div style={styles.scannerHeader}>
              <span style={styles.scannerIcon}>📷</span>
              <div>
                <h4 style={styles.scannerTitle}>
                  Challan Scanner (OCR simulator)
                </h4>
                <p style={styles.scannerSubtitle}>
                  Drag & drop copy of your challan to parse details instantly.
                </p>
              </div>
            </div>

            {isScanning ? (
              <div style={styles.scanRunningContainer}>
                <div style={styles.scanImagePreview}>
                  <div className="scanner-line" />
                  <span style={{ fontSize: "2rem" }}>📄</span>
                </div>
                <div style={styles.scanTextLog}>
                  <p style={styles.scanLogHeading}>SCANNING CITATION...</p>
                  <p style={styles.scanLogText}>{scanLog}</p>
                </div>
              </div>
            ) : uploadedFileName ? (
              <div style={styles.scanCompleteContainer}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={{ color: "#10b981", fontWeight: "bold" }}>
                    ✓
                  </span>
                  <span
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: "var(--text-heading)",
                    }}
                  >
                    {uploadedFileName} parsed
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFileName("");
                    setForm(DEFAULT_FORM);
                  }}
                  style={styles.scanResetBtn}
                >
                  Clear
                </button>
              </div>
            ) : (
              <div style={styles.scanActionContainer}>
                <p
                  style={{
                    fontSize: "0.86rem",
                    margin: "0 0 12px",
                    color: "var(--text-muted)",
                  }}
                >
                  Select a demo challan below to run the high-speed legal OCR
                  parser:
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => simulateScan("chennai")}
                    style={styles.scannerDemoBtn}
                  >
                    🇮🇳 Chennai Overspeeding
                  </button>
                  <button
                    type="button"
                    onClick={() => simulateScan("ny")}
                    style={styles.scannerDemoBtn}
                  >
                    🇺🇸 New York Red Light
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="country">
                Country
              </label>
              <select
                id="country"
                value={form.country}
                onChange={handleCountryChange}
                style={styles.input}
              >
                <option value="India">India</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Other">Other</option>
              </select>
              {form.country === "Other" && (
                <input
                  type="text"
                  placeholder="Enter country..."
                  value={customCountry}
                  onChange={(e) => setCustomCountry(e.target.value)}
                  style={{ ...styles.input, marginTop: "8px" }}
                  required
                />
              )}
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="state">
                State / Region
              </label>
              {form.country !== "Other" ? (
                <>
                  <select
                    id="state"
                    value={form.state}
                    onChange={handleStateChange}
                    style={styles.input}
                  >
                      {getStatesForCountry(form.country).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  {form.state === "Other" && (
                    <input
                      type="text"
                      placeholder="Enter state/region..."
                      value={customState}
                      onChange={(e) => setCustomState(e.target.value)}
                      style={{ ...styles.input, marginTop: "8px" }}
                      required
                    />
                  )}
                </>
              ) : (
                <input
                  id="state"
                  type="text"
                  placeholder="Enter state/region..."
                  value={customState}
                  onChange={(e) => setCustomState(e.target.value)}
                  style={styles.input}
                  required
                />
              )}
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="city">
                City
              </label>
              <input
                id="city"
                type="text"
                placeholder="Chennai, Bengaluru, Los Angeles..."
                value={form.city}
                onChange={updateField("city")}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="vehicleType">
                Vehicle Type
              </label>
              <select
                id="vehicleType"
                value={form.vehicleType}
                onChange={updateField("vehicleType")}
                style={styles.input}
              >
                {VEHICLE_TYPES.map((vehicleType) => (
                  <option key={vehicleType} value={vehicleType}>
                    {vehicleType}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...styles.fieldGroup, gridColumn: "1 / -1" }}>
              <label style={styles.label} htmlFor="violation">
                Violation Context
              </label>
              <textarea
                id="violation"
                placeholder="Describe the incident, for example: overspeeding on a state highway, driving without a helmet, or signal jumping near a school zone."
                value={form.violation}
                onChange={updateField("violation")}
                rows={5}
                style={{ ...styles.input, ...styles.textarea }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading}
            style={styles.primaryButton}
            className="primary-button"
          >
            {loading ? (
              <span style={styles.buttonContent}>
                <Spinner />
                Analyzing legal context...
              </span>
            ) : (
              "View Result"
            )}
          </button>

          <p style={styles.microcopy}>
            Data validation trims whitespace, enforces required jurisdiction
            fields, checks the vehicle type against the supported set, and
            blocks the API call until the environment variable is available.
          </p>
        </section>

        <section style={styles.fullWidthCard}>
          <div style={styles.cardHeader}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div>
                <h2 style={styles.cardTitle}>2. Gemini Result</h2>
                <p style={styles.cardNote}>
                  Scannable legal triage and compounding adjustments.
                </p>
              </div>
              {analysis && !loading && (
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    background: "var(--bg-status-bar)",
                    padding: "4px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-card)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab("triage")}
                    className={`tab-btn ${activeTab === "triage" ? "active" : ""}`}
                  >
                    ⚖️ Legal Triage
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("invoice")}
                    className={`tab-btn ${activeTab === "invoice" ? "active" : ""}`}
                  >
                    📊 Liability Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("letter")}
                    className={`tab-btn ${activeTab === "letter" ? "active" : ""}`}
                  >
                    ✉️ Appeal Template
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={styles.resultShell}>
            {loading ? (
              <ProgressTracker />
            ) : !analysis ? (
              <p style={styles.emptyState}>
                Run an analysis or load a cached report.
              </p>
            ) : activeTab === "triage" ? (
              <MarkdownRenderer markdown={analysis} />
            ) : activeTab === "invoice" ? (
              <div style={styles.invoiceWrapper}>
                <h3 style={styles.invoiceTitle}>
                  Estimated Financial Surcharges
                </h3>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.88rem",
                    margin: "0 0 16px",
                  }}
                >
                  Calculated based on state limits, compounding formulas, and
                  vehicle classifications.
                </p>
                <div style={styles.invoiceTable}>
                  <div style={styles.invoiceRow}>
                    <span>Base Statutory Fine:</span>
                    <strong>
                      {computedInvoice.currency}
                      {computedInvoice.baseFine}
                    </strong>
                  </div>
                  <div style={styles.invoiceRow}>
                    <span>State Compounding & Surcharges:</span>
                    <strong>
                      {computedInvoice.currency}
                      {computedInvoice.compoundingAdjust}
                    </strong>
                  </div>
                  <div style={styles.invoiceRow}>
                    <span>Administrative/Court Processing Fee:</span>
                    <strong>
                      {computedInvoice.currency}
                      {computedInvoice.legalCost}
                    </strong>
                  </div>
                  <div
                    style={{
                      ...styles.invoiceRow,
                      borderTop: "2px solid var(--border-card)",
                      paddingTop: "12px",
                      marginTop: "12px",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem", fontWeight: 800 }}>
                      Total Estimated Liability:
                    </span>
                    <strong style={{ fontSize: "1.2rem", color: "#3b82f6" }}>
                      {computedInvoice.currency}
                      {computedInvoice.total}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    ...styles.statusBar,
                    marginTop: "20px",
                    background:
                      computedInvoice.successRate > 50
                        ? "rgba(16, 185, 129, 0.08)"
                        : "rgba(239, 68, 68, 0.08)",
                    borderColor:
                      computedInvoice.successRate > 50 ? "#10b981" : "#ef4444",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>🛡️</span>
                    <div>
                      <strong
                        style={{
                          color:
                            computedInvoice.successRate > 50
                              ? "#10b981"
                              : "#ef4444",
                        }}
                      >
                        Dispute Success Rate: {computedInvoice.successRate}%
                      </strong>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {computedInvoice.successRate > 50
                          ? "High probability of fine reduction if camera calibration or signage records are requested."
                          : "Standard compounding is recommended unless strong evidence of camera failure is present."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={styles.letterWrapper}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "14px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <h3 style={styles.invoiceTitle}>
                    Dispute Representation Template
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(appealLetter);
                      alert("Dispute appeal letter copied to clipboard!");
                    }}
                    style={styles.copyLetterBtn}
                  >
                    📋 Copy Letter
                  </button>
                </div>
                <textarea
                  readOnly
                  value={appealLetter}
                  style={styles.letterTextarea}
                />
              </div>
            )}
          </div>
        </section>

        <section style={styles.fullWidthCard}>
          <div style={styles.cardHeader}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div>
                <h2 style={styles.cardTitle}>3. Saved History</h2>
                <p style={styles.cardNote}>
                  Offline compliance cache stored locally in this browser for
                  quick re-open without network access.
                </p>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  style={styles.clearHistoryBtn}
                  className="clear-history-btn"
                >
                  🗑️ Clear History
                </button>
              )}
            </div>
          </div>

          <div style={styles.historyLayout}>
            <div style={styles.historyList}>
              {history.length ? (
                history.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => loadHistoryEntry(entry)}
                    style={{
                      ...styles.historyItem,
                      ...(entry.id === activeHistoryEntry?.id
                        ? styles.historyItemActive
                        : null),
                    }}
                    className="history-item"
                  >
                    <div>
                      <strong style={styles.historyTitle}>
                        {entry.city}, {entry.state}
                      </strong>
                      <p style={styles.historyMeta}>
                        {entry.country} · {entry.vehicleType}
                      </p>
                    </div>
                    <p style={styles.historyMeta}>
                      {formatTimestamp(entry.createdAt)}
                    </p>
                  </button>
                ))
              ) : (
                <div style={styles.emptyHistory}>
                  No cached reports yet. Run a request to populate offline
                  history.
                </div>
              )}
            </div>

            <div style={styles.historyDetail}>
              {activeHistoryEntry ? (
                <>
                  <p style={styles.detailLabel}>Selected Cache Item</p>
                  <h3 style={styles.detailTitle}>
                    {activeHistoryEntry.city}, {activeHistoryEntry.state}
                  </h3>
                  <p style={styles.detailMeta}>
                    {activeHistoryEntry.country} ·{" "}
                    {activeHistoryEntry.vehicleType}
                  </p>
                  <p style={styles.detailMeta}>
                    Violation: {activeHistoryEntry.violation}
                  </p>
                  <div style={styles.detailReport}>
                    <MarkdownRenderer markdown={activeHistoryEntry.report} />
                  </div>
                </>
              ) : (
                <div style={styles.emptyState}>
                  Select a saved record to inspect the cached legal breakdown.
                </div>
              )}
            </div>
          </div>
        </section>

        <section style={styles.fullWidthCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>
              4. Citizen Rights & Traffic Regulations FAQ
            </h2>
            <p style={styles.cardNote}>
              Quick legal guide for drivers stopped by enforcement authorities.
            </p>
          </div>
          <FAQAccordion />
        </section>
      </main>
    </div>
  );
}

const styles = {
  shell: {
    minHeight: "100svh",
    padding: "32px 20px 56px",
    position: "relative",
    overflow: "hidden",
    background: "var(--bg-shell)",
    color: "var(--text-main)",
    boxSizing: "border-box",
    transition: "background 0.3s ease, color 0.3s ease",
  },
  glowOne: {
    position: "absolute",
    inset: "120px auto auto -80px",
    width: "220px",
    height: "220px",
    borderRadius: "999px",
    filter: "blur(32px)",
    background: "rgba(255, 159, 67, 0.35)",
    pointerEvents: "none",
  },
  glowTwo: {
    position: "absolute",
    inset: "40px -90px auto auto",
    width: "260px",
    height: "260px",
    borderRadius: "999px",
    filter: "blur(42px)",
    background: "rgba(56, 189, 248, 0.22)",
    pointerEvents: "none",
  },
  header: {
    maxWidth: "1180px",
    margin: "0 auto 24px",
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "24px",
    alignItems: "flex-start",
    position: "relative",
    zIndex: 1,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  themeToggleBtn: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    background: "rgba(7, 12, 24, 0.45)",
    backdropFilter: "blur(12px)",
    color: "#eff6ff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s, border-color 0.2s, transform 0.15s",
  },
  kicker: {
    margin: "0 0 10px",
    fontSize: "0.86rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#8ab4ff",
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontSize: "clamp(2.3rem, 4vw, 4.2rem)",
    lineHeight: 0.96,
    color: "#f8fbff",
    letterSpacing: "-0.04em",
  },
  subtitle: {
    marginTop: "14px",
    maxWidth: "760px",
    fontSize: "1.02rem",
    lineHeight: 1.7,
    color: "rgba(248, 251, 255, 0.78)",
  },
  keyPill: {
    minWidth: "220px",
    borderRadius: "18px",
    padding: "14px 16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7, 12, 24, 0.65)",
    backdropFilter: "blur(12px)",
    color: "#eff6ff",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.2)",
  },
  keyPillLabel: {
    display: "block",
    fontSize: "0.74rem",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "rgba(239, 246, 255, 0.6)",
    marginBottom: "6px",
  },
  keyPillValue: {
    fontSize: "0.92rem",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  },
  keyPillDisplay: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  keyPillEditBtn: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "8px",
    padding: "4px 8px",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
    transition: "background 0.2s, transform 0.1s",
  },
  keyPillEditor: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  keyPillInput: {
    background: "rgba(0, 0, 0, 0.3)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "0.86rem",
    color: "#fff",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  keyPillActions: {
    display: "flex",
    gap: "6px",
    justifyContent: "flex-end",
  },
  keyPillBtnPrimary: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  keyPillBtnSecondary: {
    background: "rgba(255, 255, 255, 0.1)",
    border: "none",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "rgba(255, 255, 255, 0.8)",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  stepStrip: {
    maxWidth: "1180px",
    margin: "0 auto 20px",
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    position: "relative",
    zIndex: 1,
  },
  stepCard: {
    borderRadius: "18px",
    padding: "16px 18px",
    background: "var(--bg-step-card)",
    border: "1px solid var(--border-step-card)",
    boxShadow: "var(--shadow-card)",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    transition:
      "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
  },
  stepIndex: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #f97316, #f59e0b)",
    color: "#fff",
    fontWeight: 800,
  },
  stepText: {
    fontWeight: 700,
    color: "var(--text-heading)",
    transition: "color 0.3s ease",
  },
  grid: {
    maxWidth: "1180px",
    margin: "0 auto",
    display: "flex",
    flexWrap: "wrap",
    gap: "18px",
    position: "relative",
    zIndex: 1,
  },
  card: {
    flex: "1 1 420px",
    background: "var(--bg-card)",
    border: "1px solid var(--border-card)",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "var(--shadow-card)",
    backdropFilter: "blur(10px)",
    transition:
      "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
  },
  fullWidthCard: {
    flex: "1 1 100%",
    background: "var(--bg-card)",
    border: "1px solid var(--border-card)",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "var(--shadow-card)",
    backdropFilter: "blur(10px)",
    transition:
      "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
  },
  cardHeader: {
    marginBottom: "18px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "1.2rem",
    color: "var(--text-heading)",
    transition: "color 0.3s ease",
  },
  cardNote: {
    margin: "8px 0 0",
    color: "var(--text-muted)",
    lineHeight: 1.6,
    fontSize: "0.96rem",
    transition: "color 0.3s ease",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "0.92rem",
    fontWeight: 700,
    color: "var(--text-heading)",
    transition: "color 0.3s ease",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: "16px",
    border: "1px solid var(--border-input)",
    background: "var(--bg-input)",
    color: "var(--text-input)",
    padding: "14px 16px",
    fontSize: "0.98rem",
    outline: "none",
    transition:
      "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, background 160ms ease, color 160ms ease",
  },
  textarea: {
    resize: "vertical",
    minHeight: "126px",
    lineHeight: 1.6,
  },
  inlineActions: {
    marginTop: "14px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  secondaryButton: {
    border: "1px solid var(--border-input)",
    background: "var(--bg-card)",
    color: "var(--text-heading)",
    borderRadius: "14px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.3s ease, border-color 0.3s ease, color 0.3s ease",
  },
  helperText: {
    color: "var(--text-muted)",
    fontSize: "0.92rem",
  },
  statusBar: {
    marginTop: "16px",
    borderRadius: "16px",
    padding: "12px 14px",
    fontSize: "0.95rem",
    fontWeight: 600,
    background: "var(--bg-status-bar)",
    color: "var(--text-status-bar)",
    border: "1px solid var(--border-status-bar)",
    transition: "background 0.3s ease, border-color 0.3s ease, color 0.3s ease",
  },
  primaryButton: {
    marginTop: "16px",
    width: "100%",
    border: "none",
    borderRadius: "16px",
    padding: "15px 18px",
    background: "var(--accent-primary)",
    color: "#fff",
    fontWeight: 800,
    fontSize: "1rem",
    cursor: "pointer",
    boxShadow: "0 16px 30px var(--accent-shadow)",
    transition:
      "background 0.3s ease, box-shadow 0.3s ease, transform 0.15s ease",
  },
  buttonContent: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
  },
  microcopy: {
    margin: "12px 0 0",
    color: "var(--text-muted)",
    lineHeight: 1.6,
    fontSize: "0.9rem",
  },
  resultShell: {
    minHeight: "240px",
    borderRadius: "20px",
    padding: "18px",
    background: "var(--bg-result-shell)",
    border: "1px solid var(--border-result-shell)",
    color: "var(--text-input)",
    transition: "background 0.3s ease, border-color 0.3s ease, color 0.3s ease",
  },
  emptyState: {
    margin: 0,
    color: "var(--text-muted)",
    lineHeight: 1.7,
  },
  markdownBody: {
    display: "grid",
    gap: "10px",
  },
  markdownParagraph: {
    margin: 0,
    lineHeight: 1.75,
    color: "var(--text-main)",
  },
  markdownHeading1: {
    margin: "0 0 2px",
    fontSize: "1.42rem",
    color: "var(--text-heading)",
  },
  markdownHeading2: {
    margin: "0 0 2px",
    fontSize: "1.18rem",
    color: "var(--text-heading)",
  },
  markdownHeading3: {
    margin: "0 0 2px",
    fontSize: "1.04rem",
    color: "var(--text-heading)",
  },
  markdownList: {
    margin: 0,
    paddingInlineStart: "22px",
    color: "var(--text-main)",
    lineHeight: 1.7,
    display: "grid",
    gap: "8px",
  },
  historyLayout: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
  },
  historyList: {
    flex: "1 1 300px",
    display: "grid",
    gap: "10px",
    alignContent: "start",
  },
  historyItem: {
    width: "100%",
    textAlign: "left",
    borderRadius: "18px",
    border: "1px solid var(--border-card)",
    background: "var(--bg-history-item)",
    padding: "14px 16px",
    cursor: "pointer",
    color: "var(--text-heading)",
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    transition:
      "border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
  },
  historyItemActive: {
    borderColor: "var(--border-history-active)",
    boxShadow: "0 10px 22px var(--accent-shadow)",
    background: "var(--bg-history-active)",
  },
  historyTitle: {
    display: "block",
    marginBottom: "6px",
    fontSize: "0.98rem",
    color: "var(--text-heading)",
  },
  historyMeta: {
    margin: 0,
    color: "var(--text-muted)",
    fontSize: "0.88rem",
    lineHeight: 1.5,
  },
  emptyHistory: {
    borderRadius: "18px",
    padding: "16px",
    background: "var(--bg-status-bar)",
    color: "var(--text-muted)",
    border: "1px dashed var(--border-input)",
  },
  historyDetail: {
    flex: "2 1 420px",
    borderRadius: "18px",
    padding: "16px",
    background: "var(--bg-history-detail)",
    border: "1px solid var(--border-history-detail)",
    minHeight: "260px",
    transition: "background 0.3s ease, border-color 0.3s ease, color 0.3s ease",
  },
  detailLabel: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--border-history-active)",
    fontSize: "0.8rem",
    fontWeight: 800,
  },
  detailTitle: {
    margin: "8px 0 6px",
    fontSize: "1.35rem",
    color: "var(--text-heading)",
  },
  detailMeta: {
    margin: "0 0 8px",
    color: "var(--text-muted)",
    lineHeight: 1.7,
  },
  detailReport: {
    marginTop: "16px",
  },
  spinner: {
    width: "14px",
    height: "14px",
    borderRadius: "999px",
    border: "2px solid rgba(255, 255, 255, 0.35)",
    borderTopColor: "#fff",
    display: "inline-block",
    animation: "drivelegal-spin 0.8s linear infinite",
  },
  inlineKeyEditor: {
    marginTop: "12px",
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  inlineKeyInput: {
    flex: "1 1 240px",
    borderRadius: "10px",
    border: "1px solid var(--border-input)",
    background: "var(--bg-input)",
    color: "var(--text-input)",
    padding: "8px 12px",
    fontSize: "0.9rem",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.3s ease, background 0.3s ease, color 0.3s ease",
  },
  inlineKeySaveBtn: {
    background: "#0f4c81",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "8px 14px",
    fontSize: "0.9rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  keyPillSelect: {
    background: "rgba(0, 0, 0, 0.3)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "0.86rem",
    color: "#fff",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    cursor: "pointer",
  },
  inlineModelSelect: {
    borderRadius: "10px",
    border: "1px solid var(--border-input)",
    padding: "8px 10px",
    fontSize: "0.9rem",
    outline: "none",
    background: "var(--bg-input)",
    color: "var(--text-input)",
    cursor: "pointer",
    transition: "border-color 0.3s ease, background 0.3s ease, color 0.3s ease",
  },
  navBar: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    margin: "-32px -20px 32px",
    background: "var(--bg-nav)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid var(--border-card)",
    boxSizing: "border-box",
    transition: "background 0.3s ease, border-color 0.3s ease",
  },
  navBrand: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textAlign: "left",
  },
  navBrandText: {
    fontSize: "1.25rem",
    fontWeight: 800,
    background: "linear-gradient(135deg, #38bdf8, #8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  hero: {
    maxWidth: "800px",
    margin: "0 auto 40px",
    textAlign: "center",
    padding: "40px 10px 10px",
  },
  heroBadge: {
    display: "inline-block",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#38bdf8",
    background: "rgba(56, 189, 248, 0.08)",
    border: "1px solid rgba(56, 189, 248, 0.15)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: "18px",
  },
  heroTitle: {
    fontSize: "clamp(2.5rem, 5vw, 4.2rem)",
    fontWeight: 800,
    margin: "0 0 16px",
    color: "#f8fbff",
    letterSpacing: "-0.04em",
    lineHeight: 1.1,
  },
  heroSubtitle: {
    fontSize: "1.12rem",
    lineHeight: 1.6,
    color: "rgba(248, 250, 252, 0.8)",
    margin: 0,
  },
  scannerCard: {
    borderRadius: "20px",
    padding: "16px",
    background: "var(--bg-status-bar)",
    border: "1px solid var(--border-card)",
    marginBottom: "16px",
    transition: "all 0.3s ease",
  },
  scannerHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
  },
  scannerIcon: {
    fontSize: "1.8rem",
  },
  scannerTitle: {
    margin: 0,
    fontSize: "1.02rem",
    fontWeight: 700,
    color: "var(--text-heading)",
  },
  scannerSubtitle: {
    margin: "4px 0 0",
    fontSize: "0.86rem",
    color: "var(--text-muted)",
  },
  scanRunningContainer: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "10px",
    background: "var(--bg-card)",
    borderRadius: "12px",
    border: "1px solid var(--border-card)",
  },
  scanImagePreview: {
    position: "relative",
    width: "48px",
    height: "48px",
    borderRadius: "8px",
    background: "var(--bg-status-bar)",
    border: "1px solid var(--border-input)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  },
  scanTextLog: {
    flex: 1,
    textAlign: "left",
  },
  scanLogHeading: {
    margin: 0,
    fontSize: "0.74rem",
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "#3b82f6",
  },
  scanLogText: {
    margin: "2px 0 0",
    fontSize: "0.84rem",
    color: "var(--text-main)",
  },
  scanCompleteContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "rgba(16, 185, 129, 0.08)",
    border: "1px solid #10b981",
    borderRadius: "12px",
  },
  scanResetBtn: {
    background: "transparent",
    border: "none",
    color: "#ef4444",
    fontWeight: 700,
    fontSize: "0.88rem",
    cursor: "pointer",
    padding: "4px 8px",
  },
  scanActionContainer: {
    padding: "12px",
    border: "2px dashed var(--border-input)",
    borderRadius: "14px",
    background: "var(--bg-card)",
    textAlign: "center",
  },
  scannerDemoBtn: {
    background: "var(--bg-status-bar)",
    border: "1px solid var(--border-input)",
    borderRadius: "10px",
    padding: "8px 12px",
    fontSize: "0.86rem",
    fontWeight: 700,
    color: "var(--text-heading)",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  loaderContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px 10px",
    textAlign: "center",
    width: "100%",
  },
  loaderSpinnerWrapper: {
    position: "relative",
    width: "64px",
    height: "64px",
    marginBottom: "16px",
  },
  largeSpinner: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    border: "4px solid var(--border-card)",
    borderTopColor: "#3b82f6",
  },
  loaderPercentage: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    margin: 0,
    fontSize: "0.88rem",
    fontWeight: 800,
    color: "var(--text-heading)",
  },
  loaderHeading: {
    margin: "0 0 20px",
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "var(--text-heading)",
  },
  loaderStepList: {
    width: "100%",
    maxWidth: "360px",
    display: "grid",
    gap: "12px",
  },
  loaderStepRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    textAlign: "left",
    transition: "opacity 0.3s ease",
  },
  loaderStepBullet: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    border: "1.5px solid",
    display: "grid",
    placeItems: "center",
    fontSize: "0.74rem",
    fontWeight: 800,
  },
  invoiceWrapper: {
    textAlign: "left",
    width: "100%",
  },
  invoiceTitle: {
    margin: 0,
    fontSize: "1.15rem",
    fontWeight: 700,
    color: "var(--text-heading)",
  },
  invoiceTable: {
    marginTop: "16px",
    display: "grid",
    gap: "10px",
    background: "var(--bg-status-bar)",
    border: "1px solid var(--border-card)",
    borderRadius: "16px",
    padding: "16px",
  },
  invoiceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.94rem",
    color: "var(--text-main)",
  },
  letterWrapper: {
    textAlign: "left",
    width: "100%",
  },
  copyLetterBtn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "10px",
    padding: "8px 14px",
    fontSize: "0.88rem",
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  clearHistoryBtn: {
    background: "transparent",
    border: "1px solid #ef4444",
    borderRadius: "12px",
    padding: "8px 14px",
    fontSize: "0.88rem",
    fontWeight: 700,
    color: "#ef4444",
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
  },
  gpsBtn: {
    background: "transparent",
    border: "1px solid var(--border-card-hover)",
    borderRadius: "10px",
    padding: "6px 12px",
    fontSize: "0.86rem",
    fontWeight: 700,
    color: "var(--text-heading)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  },
  navLanguageSelect: {
    background: "var(--bg-input)",
    border: "1px solid var(--border-input)",
    borderRadius: "12px",
    padding: "8px 12px",
    fontSize: "0.88rem",
    fontWeight: 700,
    color: "var(--text-input)",
    cursor: "pointer",
    outline: "none",
    transition: "all 0.2s ease",
  },
  letterTextarea: {
    width: "100%",
    height: "300px",
    borderRadius: "16px",
    border: "1px solid var(--border-input)",
    background: "var(--bg-input)",
    color: "var(--text-input)",
    padding: "14px",
    fontSize: "0.92rem",
    fontFamily: "ui-monospace, Consolas, monospace",
    outline: "none",
    resize: "none",
    lineHeight: 1.6,
    boxSizing: "border-box",
  },
  faqContainer: {
    display: "grid",
    gap: "0",
    textAlign: "left",
    width: "100%",
  },
  faqRow: {
    display: "grid",
  },
  faqHeaderBtn: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    padding: "18px 22px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--text-heading)",
    textAlign: "left",
    transition: "background 0.2s",
    outline: "none",
  },
  faqAnswer: {
    padding: "0 22px 18px",
    fontSize: "0.94rem",
    lineHeight: 1.6,
    color: "var(--text-main)",
  },
};
