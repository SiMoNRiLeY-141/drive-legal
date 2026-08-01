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

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }
  if (isRateLimited(request)) return sendJson(response, 429, { error: "Too many requests. Please wait a minute and try again." });
  if (!validBody(request.body)) return sendJson(response, 400, { error: "Enter valid India citation details before requesting an analysis." });
  if (!process.env.GEMINI_API_KEY) return sendJson(response, 503, { error: "The analysis service is not configured. Please try again later." });

  const { state, city, vehicleType, violation, language } = request.body;
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
          generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 900 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!providerResponse.ok) throw new Error("Provider request failed");
    const providerData = await providerResponse.json();
    const rawText = providerData?.candidates?.[0]?.content?.parts?.[0]?.text;
    const generated = JSON.parse(rawText);
    const result = {
      summary: typeof generated.summary === "string" && generated.summary.length <= 900 ? generated.summary : "Review the original citation carefully and verify its details through an official channel.",
      questions: asStringList(generated.questions),
      nextSteps: asStringList(generated.nextSteps),
      sources: SOURCES,
    };
    if (result.questions.length < 2 || result.nextSteps.length < 2) throw new Error("Invalid provider response");
    return sendJson(response, 200, result);
  } catch {
    return sendJson(response, 502, { error: "The analysis service could not prepare guidance right now. Please try again later." });
  }
}
