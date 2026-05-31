import { useEffect, useMemo, useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const STORAGE_KEYS = {
  history: 'drivelegal_saved_history',
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim() || '';

const VEHICLE_TYPES = [
  'Two-Wheeler',
  'Light Motor Vehicle (Car)',
  'Heavy Goods Vehicle (Truck/Bus)',
  'Commercial/Transport',
];

const SYSTEM_INSTRUCTION =
  'You are DriveLegal, an expert AI engine specialized in international, national, and localized traffic laws. Parse user inputs (Location, Vehicle Type, Violation) and output a highly structured breakdown of legal clauses, base statutory fines, localized state compounding adjustments, total financial liabilities, and exact official dispute/payment protocols. Format everything using clear Markdown with short, scannable bullet points. No pleasantries.';

const DEFAULT_FORM = {
  country: 'India',
  state: '',
  city: '',
  vehicleType: VEHICLE_TYPES[0],
  violation: '',
};

const INITIAL_STATUS = GEMINI_API_KEY
  ? {
      kind: 'idle',
      message: '',
    }
  : {
      kind: 'error',
      message: 'Missing environment variable: VITE_GEMINI_API_KEY. Add it to your Vite environment before using DriveLegal.',
    };

function readStoredHistory() {
  if (typeof window === 'undefined') return [];

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
  return value.trim().replace(/\s+/g, ' ');
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
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

    if (matchedText.startsWith('**')) {
      segments.push(<strong key={`${index}-strong`}>{matchedText.slice(2, -2)}</strong>);
    } else if (matchedText.startsWith('`')) {
      segments.push(<code key={`${index}-code`}>{matchedText.slice(1, -1)}</code>);
    } else if (matchedText.startsWith('*')) {
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
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let listBuffer = [];
  let currentListType = null;

  const flushList = () => {
    if (!currentListType || !listBuffer.length) return;

    const ListTag = currentListType === 'ordered' ? 'ol' : 'ul';
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
      const headingLevel = Math.min(trimmedLine.match(/^#{1,3}/)?.[0].length ?? 1, 3);
      const HeadingTag = `h${headingLevel}`;
      nodes.push(
        <HeadingTag key={`heading-${nodes.length}`} style={styles[`markdownHeading${headingLevel}`]}>
          {parseInlineMarkdown(trimmedLine.replace(/^#{1,3}\s+/, ''))}
        </HeadingTag>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmedLine)) {
      if (currentListType === 'ordered') flushList();
      currentListType = 'unordered';
      listBuffer.push(trimmedLine.replace(/^[-*]\s+/, ''));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmedLine)) {
      if (currentListType === 'unordered') flushList();
      currentListType = 'ordered';
      listBuffer.push(trimmedLine.replace(/^\d+\.\s+/, ''));
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
  const [form, setForm] = useState(DEFAULT_FORM);
  const [history, setHistory] = useState(() => readStoredHistory());
  const [analysis, setAnalysis] = useState(() => readStoredHistory()[0]?.report || '');
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [loading, setLoading] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState(() => readStoredHistory()[0]?.id || '');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const { body, documentElement } = document;
    const previousBodyStyles = {
      margin: body.style.margin,
      background: body.style.background,
      color: body.style.color,
      fontFamily: body.style.fontFamily,
    };
    const previousRootStyles = {
      scrollBehavior: documentElement.style.scrollBehavior,
    };

    body.style.margin = '0';
    body.style.background = '#f5f7fb';
    body.style.color = '#112033';
    body.style.fontFamily = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    documentElement.style.scrollBehavior = 'smooth';

    return () => {
      body.style.margin = previousBodyStyles.margin;
      body.style.background = previousBodyStyles.background;
      body.style.color = previousBodyStyles.color;
      body.style.fontFamily = previousBodyStyles.fontFamily;
      documentElement.style.scrollBehavior = previousRootStyles.scrollBehavior;
    };
  }, []);

  const latestHistory = useMemo(() => history[0] ?? null, [history]);

  const updateField = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateForm = () => {
    // Validation flow: normalize user input first, then reject incomplete or suspiciously short values
    // before any network call is attempted. This prevents empty requests and keeps error handling local.
    const normalizedCountry = safeString(form.country);
    const normalizedState = safeString(form.state);
    const normalizedCity = safeString(form.city);
    const normalizedViolation = safeString(form.violation);

    if (!normalizedCountry) return 'Country is required.';
    if (!normalizedState) return 'State or region is required.';
    if (!normalizedCity) return 'City is required.';
    if (!VEHICLE_TYPES.includes(form.vehicleType)) return 'Select a supported vehicle type.';
    if (normalizedViolation.length < 8) return 'Describe the violation with a little more detail.';

    return null;
  };

  const storeSuccessfulReport = (reportText) => {
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      country: safeString(form.country),
      state: safeString(form.state),
      city: safeString(form.city),
      vehicleType: form.vehicleType,
      violation: safeString(form.violation),
      report: reportText,
    };

    setHistory((current) => [entry, ...current].slice(0, 20));
    setActiveHistoryId(entry.id);
  };

  const runAnalysis = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      setStatus({ kind: 'error', message: validationMessage });
      return;
    }

    if (!GEMINI_API_KEY) {
      setStatus({
        kind: 'error',
        message: 'Missing environment variable: VITE_GEMINI_API_KEY. Add it to your Vite environment before using DriveLegal.',
      });
      return;
    }

    const prompt = [
      `Location: Country=${safeString(form.country)}; State=${safeString(form.state)}; City=${safeString(form.city)}`,
      `Vehicle Type: ${form.vehicleType}`,
      `Violation: ${safeString(form.violation)}`,
      'Produce a concise legal breakdown with clear markdown bullets and labeled sections.',
    ].join('\n');

    setLoading(true);
    setStatus({ kind: 'idle', message: '' });

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), 25000);
    });

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      const response = await Promise.race([model.generateContent(prompt), timeoutPromise]);
      const reportText = response.response.text().trim();

      if (!reportText) {
        throw new Error('EMPTY_RESPONSE');
      }

      setAnalysis(reportText);
      storeSuccessfulReport(reportText);
      setStatus({
        kind: 'success',
        message: 'Analysis completed and saved to local history.',
      });
    } catch (error) {
      const message = String(error?.message || error);

      if (message.includes('REQUEST_TIMEOUT')) {
        setStatus({
          kind: 'error',
          message: 'The request timed out. Check connectivity and try again.',
        });
      } else if (/api key|permission|unauthorized|invalid/i.test(message)) {
        setStatus({
          kind: 'error',
          message: 'The Gemini API key appears invalid or unauthorized. Replace it and save again.',
        });
      } else {
        setStatus({
          kind: 'error',
          message: 'Unable to complete the analysis. Use the latest saved history or retry with a stable network.',
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
    setStatus({
      kind: 'success',
      message: 'Loaded a cached report from local storage.',
    });
  };

  const activeHistoryEntry = history.find((entry) => entry.id === activeHistoryId) || latestHistory;

  return (
    <div style={styles.shell}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Road Safety Hackathon 2026 · CoERS, IIT Madras</p>
          <h1 style={styles.title}>DriveLegal Platform</h1>
          <p style={styles.subtitle}>
            Fast legal triage for traffic challans with secure Gemini access, localized context, and offline-ready history.
          </p>
        </div>
      </header>

      <section style={styles.stepStrip} aria-label="Workflow steps">
        {['Setup Key', 'Enter Details', 'View Result', 'Access Local History'].map((step, index) => (
          <div key={step} style={styles.stepCard}>
            <span style={styles.stepIndex}>{index + 1}</span>
            <span style={styles.stepText}>{step}</span>
          </div>
        ))}
      </section>

      <main style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>1. Challan Details</h2>
            <p style={styles.cardNote}>Provide enough jurisdiction and incident context for localized legal reasoning.</p>
          </div>

          <div style={styles.statusBar} data-kind={status.kind}>
            {status.message || 'Ready for secure analysis.'}
          </div>

          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="country">Country</label>
              <input
                id="country"
                type="text"
                placeholder="India"
                value={form.country}
                onChange={updateField('country')}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="state">State / Region</label>
              <input
                id="state"
                type="text"
                placeholder="Tamil Nadu, Karnataka, California..."
                value={form.state}
                onChange={updateField('state')}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="city">City</label>
              <input
                id="city"
                type="text"
                placeholder="Chennai, Bengaluru, Los Angeles..."
                value={form.city}
                onChange={updateField('city')}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="vehicleType">Vehicle Type</label>
              <select
                id="vehicleType"
                value={form.vehicleType}
                onChange={updateField('vehicleType')}
                style={styles.input}
              >
                {VEHICLE_TYPES.map((vehicleType) => (
                  <option key={vehicleType} value={vehicleType}>
                    {vehicleType}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...styles.fieldGroup, gridColumn: '1 / -1' }}>
              <label style={styles.label} htmlFor="violation">Violation Context</label>
              <textarea
                id="violation"
                placeholder="Describe the incident, for example: overspeeding on a state highway, driving without a helmet, or signal jumping near a school zone."
                value={form.violation}
                onChange={updateField('violation')}
                rows={5}
                style={{ ...styles.input, ...styles.textarea }}
              />
            </div>
          </div>

          <button type="button" onClick={runAnalysis} disabled={loading} style={styles.primaryButton}>
            {loading ? (
              <span style={styles.buttonContent}>
                <Spinner />
                Analyzing legal context...
              </span>
            ) : (
              'View Result'
            )}
          </button>

          <p style={styles.microcopy}>
            Data validation trims whitespace, enforces required jurisdiction fields, checks the vehicle type against the supported set, and blocks the API call until the environment variable is available.
          </p>
        </section>

        <section style={styles.fullWidthCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>2. Gemini Result</h2>
            <p style={styles.cardNote}>Rendered from markdown so the legal breakdown stays scannable on desktop and mobile.</p>
          </div>

          <div style={styles.resultShell}>
            {analysis ? <MarkdownRenderer markdown={analysis} /> : <p style={styles.emptyState}>Run an analysis or load a cached report.</p>}
          </div>
        </section>

        <section style={styles.fullWidthCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>3. Saved History</h2>
            <p style={styles.cardNote}>Offline compliance cache stored locally in this browser for quick re-open without network access.</p>
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
                      ...(entry.id === activeHistoryEntry?.id ? styles.historyItemActive : null),
                    }}
                  >
                    <div>
                      <strong style={styles.historyTitle}>{entry.city}, {entry.state}</strong>
                      <p style={styles.historyMeta}>
                        {entry.country} · {entry.vehicleType}
                      </p>
                    </div>
                    <p style={styles.historyMeta}>{formatTimestamp(entry.createdAt)}</p>
                  </button>
                ))
              ) : (
                <div style={styles.emptyHistory}>
                  No cached reports yet. Run a request to populate offline history.
                </div>
              )}
            </div>

            <div style={styles.historyDetail}>
              {activeHistoryEntry ? (
                <>
                  <p style={styles.detailLabel}>Selected Cache Item</p>
                  <h3 style={styles.detailTitle}>{activeHistoryEntry.city}, {activeHistoryEntry.state}</h3>
                  <p style={styles.detailMeta}>
                    {activeHistoryEntry.country} · {activeHistoryEntry.vehicleType}
                  </p>
                  <p style={styles.detailMeta}>Violation: {activeHistoryEntry.violation}</p>
                  <div style={styles.detailReport}>
                    <MarkdownRenderer markdown={activeHistoryEntry.report} />
                  </div>
                </>
              ) : (
                <div style={styles.emptyState}>Select a saved record to inspect the cached legal breakdown.</div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles = {
  shell: {
    minHeight: '100svh',
    padding: '32px 20px 56px',
    position: 'relative',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at top left, rgba(255, 176, 87, 0.18), transparent 34%), radial-gradient(circle at top right, rgba(41, 121, 255, 0.12), transparent 32%), linear-gradient(180deg, #0d1321 0%, #111827 42%, #f5f7fb 42%, #f5f7fb 100%)',
    color: '#112033',
    boxSizing: 'border-box',
  },
  glowOne: {
    position: 'absolute',
    inset: '120px auto auto -80px',
    width: '220px',
    height: '220px',
    borderRadius: '999px',
    filter: 'blur(32px)',
    background: 'rgba(255, 159, 67, 0.35)',
    pointerEvents: 'none',
  },
  glowTwo: {
    position: 'absolute',
    inset: '40px -90px auto auto',
    width: '260px',
    height: '260px',
    borderRadius: '999px',
    filter: 'blur(42px)',
    background: 'rgba(56, 189, 248, 0.22)',
    pointerEvents: 'none',
  },
  header: {
    maxWidth: '1180px',
    margin: '0 auto 24px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '24px',
    alignItems: 'flex-start',
    position: 'relative',
    zIndex: 1,
  },
  kicker: {
    margin: '0 0 10px',
    fontSize: '0.86rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#8ab4ff',
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontSize: 'clamp(2.3rem, 4vw, 4.2rem)',
    lineHeight: 0.96,
    color: '#f8fbff',
    letterSpacing: '-0.04em',
  },
  subtitle: {
    marginTop: '14px',
    maxWidth: '760px',
    fontSize: '1.02rem',
    lineHeight: 1.7,
    color: 'rgba(248, 251, 255, 0.78)',
  },
  keyPill: {
    minWidth: '200px',
    borderRadius: '18px',
    padding: '16px 18px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(7, 12, 24, 0.55)',
    backdropFilter: 'blur(12px)',
    color: '#eff6ff',
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.2)',
  },
  keyPillLabel: {
    display: 'block',
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'rgba(239, 246, 255, 0.7)',
    marginBottom: '8px',
  },
  keyPillValue: {
    fontSize: '1rem',
    fontWeight: 700,
  },
  stepStrip: {
    maxWidth: '1180px',
    margin: '0 auto 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '12px',
    position: 'relative',
    zIndex: 1,
  },
  stepCard: {
    borderRadius: '18px',
    padding: '16px 18px',
    background: 'rgba(255, 255, 255, 0.72)',
    border: '1px solid rgba(17, 32, 51, 0.08)',
    boxShadow: '0 14px 40px rgba(15, 23, 42, 0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  stepIndex: {
    width: '34px',
    height: '34px',
    borderRadius: '999px',
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #f97316, #f59e0b)',
    color: '#fff',
    fontWeight: 800,
  },
  stepText: {
    fontWeight: 700,
    color: '#142339',
  },
  grid: {
    maxWidth: '1180px',
    margin: '0 auto',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '18px',
    position: 'relative',
    zIndex: 1,
  },
  card: {
    flex: '1 1 420px',
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: '24px',
    padding: '22px',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)',
    backdropFilter: 'blur(10px)',
  },
  fullWidthCard: {
    flex: '1 1 100%',
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: '24px',
    padding: '22px',
    boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)',
    backdropFilter: 'blur(10px)',
  },
  cardHeader: {
    marginBottom: '18px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.2rem',
    color: '#0f172a',
  },
  cardNote: {
    margin: '8px 0 0',
    color: '#526174',
    lineHeight: 1.6,
    fontSize: '0.96rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: '#1f2a37',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '16px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    padding: '14px 16px',
    fontSize: '0.98rem',
    outline: 'none',
    transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
  },
  textarea: {
    resize: 'vertical',
    minHeight: '126px',
    lineHeight: 1.6,
  },
  inlineActions: {
    marginTop: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    background: '#eff6ff',
    color: '#163a63',
    borderRadius: '14px',
    padding: '12px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  helperText: {
    color: '#5b6b7d',
    fontSize: '0.92rem',
  },
  statusBar: {
    marginTop: '16px',
    borderRadius: '16px',
    padding: '12px 14px',
    fontSize: '0.95rem',
    fontWeight: 600,
    background: '#f8fafc',
    color: '#334155',
    border: '1px solid #e2e8f0',
  },
  primaryButton: {
    marginTop: '16px',
    width: '100%',
    border: 'none',
    borderRadius: '16px',
    padding: '15px 18px',
    background: 'linear-gradient(135deg, #0f4c81, #0b7c9d)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '1rem',
    cursor: 'pointer',
    boxShadow: '0 16px 30px rgba(15, 76, 129, 0.25)',
  },
  buttonContent: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
  },
  microcopy: {
    margin: '12px 0 0',
    color: '#66758a',
    lineHeight: 1.6,
    fontSize: '0.9rem',
  },
  resultShell: {
    minHeight: '240px',
    borderRadius: '20px',
    padding: '18px',
    background: 'linear-gradient(180deg, #f8fbff, #eef4ff)',
    border: '1px solid #d9e4f5',
    color: '#0f172a',
  },
  emptyState: {
    margin: 0,
    color: '#64748b',
    lineHeight: 1.7,
  },
  markdownBody: {
    display: 'grid',
    gap: '10px',
  },
  markdownParagraph: {
    margin: 0,
    lineHeight: 1.75,
    color: '#172033',
  },
  markdownHeading1: {
    margin: '0 0 2px',
    fontSize: '1.42rem',
    color: '#0f172a',
  },
  markdownHeading2: {
    margin: '0 0 2px',
    fontSize: '1.18rem',
    color: '#0f172a',
  },
  markdownHeading3: {
    margin: '0 0 2px',
    fontSize: '1.04rem',
    color: '#0f172a',
  },
  markdownList: {
    margin: 0,
    paddingInlineStart: '22px',
    color: '#172033',
    lineHeight: 1.7,
    display: 'grid',
    gap: '8px',
  },
  historyLayout: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
  },
  historyList: {
    flex: '1 1 300px',
    display: 'grid',
    gap: '10px',
    alignContent: 'start',
  },
  historyItem: {
    width: '100%',
    textAlign: 'left',
    borderRadius: '18px',
    border: '1px solid #dbe4ef',
    background: '#fff',
    padding: '14px 16px',
    cursor: 'pointer',
    color: '#0f172a',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
  },
  historyItemActive: {
    borderColor: '#0b7c9d',
    boxShadow: '0 10px 22px rgba(11, 124, 157, 0.14)',
    background: 'linear-gradient(180deg, #f5fdff, #edfafd)',
  },
  historyTitle: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '0.98rem',
  },
  historyMeta: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.88rem',
    lineHeight: 1.5,
  },
  emptyHistory: {
    borderRadius: '18px',
    padding: '16px',
    background: '#f8fafc',
    color: '#64748b',
    border: '1px dashed #cbd5e1',
  },
  historyDetail: {
    flex: '2 1 420px',
    borderRadius: '18px',
    padding: '16px',
    background: '#fbfdff',
    border: '1px solid #d9e4f5',
    minHeight: '260px',
  },
  detailLabel: {
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#0b7c9d',
    fontSize: '0.8rem',
    fontWeight: 800,
  },
  detailTitle: {
    margin: '8px 0 6px',
    fontSize: '1.35rem',
    color: '#0f172a',
  },
  detailMeta: {
    margin: '0 0 8px',
    color: '#526174',
    lineHeight: 1.7,
  },
  detailReport: {
    marginTop: '16px',
  },
  spinner: {
    width: '14px',
    height: '14px',
    borderRadius: '999px',
    border: '2px solid rgba(255, 255, 255, 0.35)',
    borderTopColor: '#fff',
    display: 'inline-block',
    animation: 'drivelegal-spin 0.8s linear infinite',
  },
};