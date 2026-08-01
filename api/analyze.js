const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const requestBuckets = new Map();

const SOURCES = [
  { title: "Parivahan eChallan", url: "https://echallan.parivahan.gov.in/" },
  { title: "India Code", url: "https://www.indiacode.nic.in/" },
  { title: "Ministry of Road Transport and Highways", url: "https://morth.nic.in/" },
];

const LANGUAGE_NAMES = {
  en: "English", hi: "Hindi", ta: "Tamil", te: "Telugu", kn: "Kannada",
  ml: "Malayalam", mr: "Marathi", bn: "Bengali", gu: "Gujarati",
};

function sendJson(response, status, value) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8").json(value);
}

function sendFailure(response, status, code, error, retryable) {
  return sendJson(response, status, { code, error, retryable });
}

function providerFailure(providerStatus, providerCode) {
  if (providerStatus === 401 || providerStatus === 403 || providerCode === "API_KEY_INVALID" || providerCode === "PERMISSION_DENIED") {
    return { status: 503, code: "CONFIGURATION", error: "The analysis service needs attention. Please try again later.", retryable: false };
  }
  if (providerStatus === 429 || providerCode === "RESOURCE_EXHAUSTED") {
    return { status: 429, code: "RATE_LIMIT", error: "The analysis service is busy. Please wait a minute and try again.", retryable: true };
  }
  if (providerStatus >= 500 || providerStatus === 408 || providerStatus === 504) {
    return { status: 503, code: "TEMPORARY", error: "The analysis service is temporarily unavailable. Please try again shortly.", retryable: true };
  }
  return { status: 502, code: "PROVIDER_RESPONSE", error: "The analysis service could not prepare guidance. Please try again.", retryable: true };
}

function logFailure({ requestId, category, providerStatus, elapsedMs }) {
  console.error(JSON.stringify({ event: "analysis_failure", requestId, category, providerStatus, elapsedMs }));
}

function isRateLimited(request) {
  const forwarded = request.headers["x-forwarded-for"];
  const key = (Array.isArray(forwarded) ? forwarded[0] : forwarded || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const bucket = (requestBuckets.get(key) || []).filter((time) => now - time < WINDOW_MS);
  bucket.push(now);
  requestBuckets.set(key, bucket);
  return bucket.length > MAX_REQUESTS_PER_WINDOW;
}

function validBody(body) {
  if (!body || typeof body !== "object") return false;
  const required = ["state", "city", "vehicleType", "violation", "language"];
  return required.every((field) => typeof body[field] === "string" && body[field].trim())
    && body.city.trim().length <= 100
    && body.state.trim().length <= 100
    && body.violation.trim().length >= 12
    && body.violation.trim().length <= 1500
    && Boolean(LANGUAGE_NAMES[body.language]);
}

function asStringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length <= 400).slice(0, 5) : [];
}

function parseGeneratedResponse(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) throw new Error("Missing structured response");
  const normalized = rawText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(normalized);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }
  if (isRateLimited(request)) return sendFailure(response, 429, "RATE_LIMIT", "Too many requests. Please wait a minute and try again.", true);
  if (!validBody(request.body)) return sendFailure(response, 400, "INVALID_REQUEST", "Enter valid India citation details before requesting an analysis.", false);
  if (!process.env.GEMINI_API_KEY) return sendFailure(response, 503, "CONFIGURATION", "The analysis service needs attention. Please try again later.", false);

  const { state, city, vehicleType, violation, language } = request.body;
  const requestId = request.headers["x-vercel-id"] || crypto.randomUUID();
  const startedAt = Date.now();
  const languageName = LANGUAGE_NAMES[language];
  const prompt = `You provide cautious, general information about Indian traffic citations. This is not legal advice. Write in ${languageName}. Do not estimate fines, state deadlines, assess guilt, advise whether to pay or contest, invent statutes, claim a legal outcome, or give procedural instructions that are not explicitly supported by the user's notice. Return JSON only with summary, questions, and nextSteps.\n\nCitation details:\nState or union territory: ${state.trim()}\nCity or district: ${city.trim()}\nVehicle: ${vehicleType.trim()}\nAlleged violation: ${violation.trim()}\n\nThe summary must be two cautious sentences. questions and nextSteps must each contain 3 to 5 short, practical items. Include checking the original notice and official channel.\n\nJSON schema:\n{"summary":"string","questions":["string"],"nextSteps":["string"]}`;

  try {
    const providerResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                questions: { type: "array", items: { type: "string" } },
                nextSteps: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "questions", "nextSteps"],
            },
            temperature: 0.2,
            maxOutputTokens: 1600,
          },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!providerResponse.ok) {
      const providerBody = await providerResponse.json().catch(() => ({}));
      const failure = providerFailure(providerResponse.status, providerBody?.error?.status);
      logFailure({ requestId, category: failure.code, providerStatus: providerResponse.status, elapsedMs: Date.now() - startedAt });
      return sendFailure(response, failure.status, failure.code, failure.error, failure.retryable);
    }
    const providerData = await providerResponse.json();
    const rawText = providerData?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
    let generated;
    try {
      generated = parseGeneratedResponse(rawText);
    } catch {
      logFailure({ requestId, category: "MALFORMED_RESPONSE", providerStatus: providerResponse.status, elapsedMs: Date.now() - startedAt });
      return sendFailure(response, 502, "MALFORMED_RESPONSE", "The analysis service returned an incomplete response. Please try again.", true);
    }
    const result = {
      summary: typeof generated.summary === "string" && generated.summary.length <= 900 ? generated.summary : "Review the original citation carefully and verify its details through an official channel.",
      questions: asStringList(generated.questions),
      nextSteps: asStringList(generated.nextSteps),
      sources: SOURCES,
    };
    if (result.questions.length < 2 || result.nextSteps.length < 2) {
      logFailure({ requestId, category: "MALFORMED_RESPONSE", providerStatus: providerResponse.status, elapsedMs: Date.now() - startedAt });
      return sendFailure(response, 502, "MALFORMED_RESPONSE", "The analysis service returned an incomplete response. Please try again.", true);
    }
    return sendJson(response, 200, result);
  } catch (error) {
    const category = error?.name === "TimeoutError" || error?.name === "AbortError" ? "TIMEOUT" : "TEMPORARY";
    logFailure({ requestId, category, providerStatus: null, elapsedMs: Date.now() - startedAt });
    return sendFailure(response, 503, category, "The analysis service is temporarily unavailable. Please try again shortly.", true);
  }
}
