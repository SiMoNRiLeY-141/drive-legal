import { useEffect, useMemo, useState } from "react";

const HISTORY_KEY = "drivelegal_history";
const HISTORY_ENABLED_KEY = "drivelegal_history_enabled";
const INDIA_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
  "Uttar Pradesh", "West Bengal", "Other",
];
const LANGUAGES = [
  ["en", "English"], ["hi", "Hindi"], ["ta", "Tamil"], ["te", "Telugu"],
  ["kn", "Kannada"], ["ml", "Malayalam"], ["mr", "Marathi"], ["bn", "Bengali"],
  ["gu", "Gujarati"],
];
const INITIAL_FORM = { state: "Tamil Nadu", city: "", vehicleType: "Two-wheeler", violation: "" };
const DEMOS = [
  { label: "Speeding challan example", state: "Tamil Nadu", city: "Chennai", vehicleType: "Car", violation: "Camera-issued challan for alleged speeding near Anna Salai. I need to understand the notice and official next steps." },
  { label: "Helmet notice example", state: "Kerala", city: "Kochi", vehicleType: "Two-wheeler", violation: "A traffic notice alleges that I was riding without a helmet. What details should I check before paying or contesting it?" },
];

function readHistory() {
  try {
    const value = localStorage.getItem(HISTORY_KEY);
    return Array.isArray(JSON.parse(value)) ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function Notice({ children }) {
  return <div className="notice" role="note">{children}</div>;
}

function App() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [language, setLanguage] = useState("en");
  const [acknowledged, setAcknowledged] = useState(() => sessionStorage.getItem("drivelegal_acknowledged") === "true");
  const [historyEnabled, setHistoryEnabled] = useState(() => localStorage.getItem(HISTORY_ENABLED_KEY) === "true");
  const [history, setHistory] = useState(() => localStorage.getItem(HISTORY_ENABLED_KEY) === "true" ? readHistory() : []);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState("");

  useEffect(() => {
    localStorage.setItem(HISTORY_ENABLED_KEY, String(historyEnabled));
    if (historyEnabled) localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    else localStorage.removeItem(HISTORY_KEY);
  }, [history, historyEnabled]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const selectDemo = (demo) => {
    setForm({ state: demo.state, city: demo.city, vehicleType: demo.vehicleType, violation: demo.violation });
    setStatus("Demo details loaded. They are examples, not a scanned citation.");
    setError("");
  };
  const validate = () => {
    if (!form.state || !form.city.trim()) return "Enter the state or union territory and city where the incident occurred.";
    if (form.violation.trim().length < 12) return "Describe the citation or alleged violation in at least 12 characters.";
    if (!acknowledged) return "Acknowledge the information notice before requesting an analysis.";
    return "";
  };
  const analyze = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true); setError(""); setStatus("Reviewing the citation information…");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, language }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The analysis service is unavailable. Please try again later.");
      setResult(payload);
      setStatus("Analysis ready. Review the official sources and next steps below.");
      if (historyEnabled) {
        setHistory((items) => [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), form, result: payload }, ...items].slice(0, 10));
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to complete the analysis.");
      setStatus("");
    } finally { setLoading(false); }
  };
  const letter = useMemo(() => `To,\nThe Traffic Police / Appropriate Challan Authority\n\nSubject: Request for information and review of traffic citation\n\nI request the official citation details, supporting evidence, payment instructions, and the applicable review or representation process for the notice concerning ${form.violation || "the alleged violation"} in ${form.city || "[City]"}, ${form.state}.\n\nI understand this request does not suspend any deadline. Please advise the correct official channel and any time limit that applies.\n\nSincerely,\n[Your name]\n[Vehicle registration number]\n[Contact details]`, [form]);
  const copyLetter = async () => {
    try { await navigator.clipboard.writeText(letter); setCopyState("Template copied."); }
    catch { setCopyState("Copy is unavailable. Select the template text and copy it manually."); }
  };

  return <main className="app-shell">
    <header className="site-header">
      <div><p className="eyebrow">INDIA TRAFFIC-CITATION INFORMATION</p><h1>DriveLegal</h1></div>
      <a href="#sources">Official sources</a>
    </header>
    <section className="hero">
      <div><p className="eyebrow">CLEARER NEXT STEPS, NOT LEGAL ADVICE</p><h2>Understand a challan before you act.</h2><p>Describe an Indian traffic citation to receive plain-language questions to ask, official places to verify it, and a cautious information-request template.</p></div>
      <Notice>DriveLegal provides general information only. It does not determine fines, deadlines, liability, or the likelihood of success. Check your original notice and consult a qualified legal professional for advice.</Notice>
    </section>

    <section className="workflow" aria-label="Citation information workflow">
      <span>1. Details</span><span>2. Acknowledge</span><span>3. Review guidance</span><span>4. Verify officially</span>
    </section>
    <div className="content-grid">
      <form className="card form-card" onSubmit={analyze} noValidate>
        <div className="section-heading"><p className="eyebrow">STEP 1</p><h2>Citation details</h2></div>
        <p className="muted">India only. Do not enter Aadhaar, licence, payment-card, or other sensitive personal information.</p>
        <div className="field-grid">
          <label>State or union territory<select value={form.state} onChange={update("state")}>{INDIA_STATES.map((state) => <option key={state}>{state}</option>)}</select></label>
          <label>City or district<input value={form.city} onChange={update("city")} autoComplete="address-level2" required /></label>
          <label>Vehicle type<select value={form.vehicleType} onChange={update("vehicleType")}><option>Two-wheeler</option><option>Car</option><option>Commercial vehicle</option><option>Other</option></select></label>
          <label>Response language<select value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
        </div>
        <label>Citation or alleged violation<textarea value={form.violation} onChange={update("violation")} placeholder="For example: What the notice says, where it occurred, and the notice number only if necessary." required /></label>
        <fieldset className="acknowledgement"><legend>STEP 2 — Information acknowledgement</legend><label className="check-label"><input type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); if (event.target.checked) sessionStorage.setItem("drivelegal_acknowledged", "true"); else sessionStorage.removeItem("drivelegal_acknowledged"); }} />I understand that DriveLegal is informational and I must verify any deadline, payment, or legal decision through official channels.</label></fieldset>
        <button className="primary-button" type="submit" disabled={loading}>{loading ? "Preparing guidance…" : "Review citation information"}</button>
        <p className="status" aria-live="polite">{status}</p>{error && <p className="error" role="alert">{error}</p>}
      </form>

      <aside className="card helper-card"><p className="eyebrow">DEMO EXAMPLES</p><h2>Try a sample</h2><p className="muted">These load fictional details only. Scanner/OCR is not available in this release.</p>{DEMOS.map((demo) => <button className="secondary-button" type="button" onClick={() => selectDemo(demo)} key={demo.label}>{demo.label}</button>)}<hr /><label className="check-label"><input type="checkbox" checked={historyEnabled} onChange={(event) => { const enabled = event.target.checked; setHistoryEnabled(enabled); if (!enabled) setHistory([]); }} />Save analyses on this device</label><p className="muted small">Off by default. If enabled, the last 10 analyses remain in this browser until you delete them.</p></aside>
    </div>

    {result && <section className="result card" aria-labelledby="result-title"><p className="eyebrow">STEP 3</p><h2 id="result-title">Information to review</h2><p className="result-summary">{result.summary}</p><div className="result-columns"><div><h3>Questions to check</h3><ul>{result.questions.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Suggested next steps</h3><ol>{result.nextSteps.map((item) => <li key={item}>{item}</li>)}</ol></div></div><Notice>Generated guidance may be incomplete or outdated. Do not rely on it to determine whether to pay, contest, or miss a deadline.</Notice></section>}

    <section className="card template" aria-labelledby="template-title"><p className="eyebrow">OPTIONAL TEMPLATE</p><h2 id="template-title">Request information, not an outcome</h2><p className="muted">Adapt this template after checking your notice. It does not submit an appeal or pause enforcement.</p><textarea readOnly value={letter} aria-label="Information request template" /><button className="secondary-button" type="button" onClick={copyLetter}>Copy template</button><p className="status" aria-live="polite">{copyState}</p></section>

    <section id="sources" className="card sources"><p className="eyebrow">STEP 4</p><h2>Verify through official channels</h2><ul><li><a href="https://echallan.parivahan.gov.in/" target="_blank" rel="noreferrer">Parivahan eChallan</a> — use the official portal to check a challan and available services.</li><li><a href="https://www.indiacode.nic.in/" target="_blank" rel="noreferrer">India Code</a> — consult official legislation and current text.</li><li><a href="https://morth.nic.in/" target="_blank" rel="noreferrer">Ministry of Road Transport and Highways</a> — verify rules and official notices.</li></ul></section>

    {historyEnabled && <section className="card history"><div className="history-title"><div><p className="eyebrow">LOCAL HISTORY</p><h2>Saved on this device</h2></div><button className="text-button" type="button" onClick={() => setHistory([])}>Delete all</button></div>{history.length ? <ul>{history.map((item) => <li key={item.id}><button type="button" onClick={() => { setForm(item.form); setResult(item.result); setStatus("Saved analysis loaded."); }}>{item.form.city}, {item.form.state} — {new Date(item.createdAt).toLocaleDateString()}</button><button className="text-button" type="button" aria-label={`Delete ${item.form.city} history item`} onClick={() => setHistory((items) => items.filter((entry) => entry.id !== item.id))}>Delete</button></li>)}</ul> : <p className="muted">No analyses have been saved.</p>}</section>}
    <footer>DriveLegal is an informational tool for Indian traffic citations. It is not a law firm or a substitute for legal advice.</footer>
  </main>;
}

export default App;
