import { useEffect, useMemo, useState } from "react";

const HISTORY_KEY = "drivelegal_history";
const HISTORY_ENABLED_KEY = "drivelegal_history_enabled";
const INDIA_STATES = ["Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal", "Other"];
const LANGUAGES = [["en", "English"], ["hi", "Hindi"], ["ta", "Tamil"], ["te", "Telugu"], ["kn", "Kannada"], ["ml", "Malayalam"], ["mr", "Marathi"], ["bn", "Bengali"], ["gu", "Gujarati"]];
const INITIAL_FORM = { state: "Tamil Nadu", city: "", vehicleType: "Two-wheeler", violation: "" };
const DEMOS = [
  { label: "Speeding notice", state: "Tamil Nadu", city: "Chennai", vehicleType: "Car", violation: "Camera-issued challan for alleged speeding near Anna Salai. I need to understand the notice and official next steps." },
  { label: "Helmet notice", state: "Kerala", city: "Kochi", vehicleType: "Two-wheeler", violation: "A traffic notice alleges that I was riding without a helmet. What details should I check before paying or contesting it?" },
];

function readHistory() { try { const value = localStorage.getItem(HISTORY_KEY); return Array.isArray(JSON.parse(value)) ? JSON.parse(value) : []; } catch { return []; } }
function Notice({ children }) { return <div className="notice" role="note">{children}</div>; }
function Progress({ step, onBack }) {
  return <ol className="progress" aria-label="Citation review progress">{["Details", "Review", "Guidance"].map((name, index) => { const number = index + 1; const complete = number < step; return <li key={name} className={number === step ? "active" : complete ? "complete" : ""}>{complete ? <button type="button" onClick={() => onBack(number)} aria-label={`Return to ${name}`}>✓</button> : <span>{number}</span>}<span>{name}</span></li>; })}</ol>;
}

function App() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [language, setLanguage] = useState("en");
  const [step, setStep] = useState(1);
  const [acknowledged, setAcknowledged] = useState(() => sessionStorage.getItem("drivelegal_acknowledged") === "true");
  const [historyEnabled, setHistoryEnabled] = useState(() => localStorage.getItem(HISTORY_ENABLED_KEY) === "true");
  const [history, setHistory] = useState(() => localStorage.getItem(HISTORY_ENABLED_KEY) === "true" ? readHistory() : []);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState("");

  useEffect(() => { localStorage.setItem(HISTORY_ENABLED_KEY, String(historyEnabled)); if (historyEnabled) localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); else localStorage.removeItem(HISTORY_KEY); }, [history, historyEnabled]);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const validationMessage = () => {
    if (!form.city.trim()) return "Enter the city or district where the incident occurred.";
    if (form.violation.trim().length < 12) return "Describe the citation or alleged violation in at least 12 characters.";
    return "";
  };
  const advance = () => { const message = validationMessage(); if (message) { setError(message); return; } setError(""); setStatus(""); setStep(2); };
  const loadDemo = (demo) => { setForm({ state: demo.state, city: demo.city, vehicleType: demo.vehicleType, violation: demo.violation }); setStatus("Example details loaded. They are fictional."); setError(""); };
  const analyze = async () => {
    if (!acknowledged) { setError("Acknowledge the information notice before continuing."); return; }
    setLoading(true); setError(""); setStatus("Preparing your guidance…");
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, language }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The analysis service is unavailable. Please try again later.");
      setResult(payload); setStep(3); setStatus("Guidance ready. Verify any decision through official channels.");
      if (historyEnabled) setHistory((items) => [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), form, result: payload }, ...items].slice(0, 10));
    } catch (requestError) { setError(requestError.message || "Unable to complete the analysis."); setStatus(""); } finally { setLoading(false); }
  };
  const letter = useMemo(() => `To,\nThe Traffic Police / Appropriate Challan Authority\n\nSubject: Request for information and review of traffic citation\n\nI request the official citation details, supporting evidence, payment instructions, and the applicable review or representation process for the notice concerning ${form.violation || "the alleged violation"} in ${form.city || "[City]"}, ${form.state}.\n\nI understand this request does not suspend any deadline. Please advise the correct official channel and any time limit that applies.\n\nSincerely,\n[Your name]\n[Vehicle registration number]\n[Contact details]`, [form]);
  const copyLetter = async () => { try { await navigator.clipboard.writeText(letter); setCopyState("Template copied."); } catch { setCopyState("Copy is unavailable. Select the text and copy it manually."); } };

  return <main className="app-shell">
    <header className="site-header"><a className="brand" href="/">DriveLegal</a><span>India traffic-citation information</span></header>
    <section className="intro"><p className="eyebrow">A SIMPLE, SAFER WAY TO START</p><h1>Understand your challan in three steps.</h1><p>General information, official verification links, and no legal outcomes or fine estimates.</p></section>
    <Progress step={step} onBack={(target) => { if (target < step) { setStep(target); setError(""); } }} />
    <section className="flow-card" aria-live="polite">
      {step === 1 && <div className="step-content"><p className="eyebrow">STEP 1 OF 3</p><h2>Tell us what happened</h2><p className="muted">India only. Do not enter Aadhaar, licence, payment-card, or other sensitive details.</p><div className="field-grid"><label>State or union territory<select value={form.state} onChange={update("state")}>{INDIA_STATES.map((state) => <option key={state}>{state}</option>)}</select></label><label>City or district<input value={form.city} onChange={update("city")} autoComplete="address-level2" required /></label><label>Vehicle type<select value={form.vehicleType} onChange={update("vehicleType")}><option>Two-wheeler</option><option>Car</option><option>Commercial vehicle</option><option>Other</option></select></label><label>Response language<select value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label></div><label>Citation or alleged violation<textarea value={form.violation} onChange={update("violation")} placeholder="What does the notice say? Where did it occur?" required /></label><details className="optional"><summary>Use a fictional example</summary><div className="demo-buttons">{DEMOS.map((demo) => <button key={demo.label} type="button" onClick={() => loadDemo(demo)}>{demo.label}</button>)}</div></details><div className="actions"><button className="primary-button" type="button" onClick={advance}>Continue</button></div></div>}
      {step === 2 && <div className="step-content"><p className="eyebrow">STEP 2 OF 3</p><h2>Review before we help</h2><dl className="summary"><div><dt>Location</dt><dd>{form.city}, {form.state}</dd></div><div><dt>Vehicle</dt><dd>{form.vehicleType}</dd></div><div><dt>Language</dt><dd>{LANGUAGES.find(([code]) => code === language)?.[1]}</dd></div><div><dt>Notice</dt><dd>{form.violation}</dd></div></dl><Notice>DriveLegal provides general information, not legal advice. It cannot determine fines, deadlines, liability, or whether you should pay or contest a citation. Check the original notice and official channels.</Notice><label className="check-label"><input type="checkbox" checked={acknowledged} onChange={(event) => { setAcknowledged(event.target.checked); if (event.target.checked) sessionStorage.setItem("drivelegal_acknowledged", "true"); else sessionStorage.removeItem("drivelegal_acknowledged"); }} />I understand and will verify any deadline, payment, or legal decision through official channels.</label><div className="actions split"><button className="secondary-button" type="button" onClick={() => setStep(1)}>Back</button><button className="primary-button" type="button" onClick={analyze} disabled={loading}>{loading ? "Preparing guidance…" : "Get guidance"}</button></div></div>}
      {step === 3 && result && <div className="step-content"><p className="eyebrow">STEP 3 OF 3</p><h2>Guidance to verify</h2><p className="result-summary">{result.summary}</p><div className="guidance-grid"><div><h3>Questions to check</h3><ul>{result.questions.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Suggested next steps</h3><ol>{result.nextSteps.map((item) => <li key={item}>{item}</li>)}</ol></div></div><section className="source-list"><h3>Official verification</h3><a href="https://echallan.parivahan.gov.in/" target="_blank" rel="noreferrer">Parivahan eChallan <span>↗</span></a><a href="https://www.indiacode.nic.in/" target="_blank" rel="noreferrer">India Code <span>↗</span></a><a href="https://morth.nic.in/" target="_blank" rel="noreferrer">Ministry of Road Transport and Highways <span>↗</span></a></section><details className="optional"><summary>Open information-request template</summary><textarea readOnly value={letter} aria-label="Information request template" /><button className="secondary-button inline-button" type="button" onClick={copyLetter}>Copy template</button><p className="status">{copyState}</p></details><details className="optional"><summary>Save guidance on this device</summary><label className="check-label"><input type="checkbox" checked={historyEnabled} onChange={(event) => { const enabled = event.target.checked; setHistoryEnabled(enabled); if (!enabled) setHistory([]); }} />Keep up to 10 analyses in this browser.</label>{historyEnabled && <div className="history-tools"><button className="text-button" type="button" onClick={() => setHistory([])}>Delete all saved guidance</button>{history.map((item) => <button className="history-item" key={item.id} type="button" onClick={() => { setForm(item.form); setResult(item.result); setStatus("Saved guidance loaded."); }}>{item.form.city}, {item.form.state} · {new Date(item.createdAt).toLocaleDateString()}</button>)}</div>}</details><div className="actions"><button className="secondary-button" type="button" onClick={() => { setStep(1); setResult(null); setStatus(""); }}>Start another review</button></div></div>}
      {error && <p className="error" role="alert">{error}</p>}<p className="status" aria-live="polite">{status}</p>
    </section>
    <footer>DriveLegal is an informational tool for Indian traffic citations. It is not a law firm or a substitute for legal advice.</footer>
  </main>;
}

export default App;
