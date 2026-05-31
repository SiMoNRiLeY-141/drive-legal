import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [location, setLocation] = useState('');
  const [violation, setViolation] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const saveKey = (key) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
  };

  const analyzeTrafficLaw = async () => {
    if (!apiKey) return alert('Please input a valid Gemini API key to proceed.');
    setLoading(true);
    setResult('');
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash"
      });

      const prompt = `Location/Jurisdiction: ${location}. Situation: ${violation}. Parse the applicable traffic rules, legal sections, specific monetary fines, and corrective actions. Provide the response in direct bullet points.`;
      const response = await model.generateContent(prompt);
      setResult(response.response.text());
    } catch (error) {
      console.error(error);
      setResult('Error generating analysis. Check the console and verify your API key settings.');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '32px', maxWidth: '700px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '24px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>DriveLegal Platform</h1>
        <p style={{ margin: '4px 0 0 0', color: '#666' }}>AI-Powered Traffic Law & Penalty Compliance Interface</p>
      </header>
      
      <section style={{ backgroundColor: '#f9f9f9', padding: '16px', borderRadius: '6px', marginBottom: '24px' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Gemini API Key Configuration</label>
        <input 
          type="password" 
          placeholder="Paste AIzaSy... key here" 
          value={apiKey} 
          onChange={(e) => saveKey(e.target.value)} 
          style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <small style={{ color: '#777', display: 'block', marginTop: '4px' }}>
          Key stored locally in the browser storage. Will not be exposed on GitHub public repositories.
        </small>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Target Location / State</label>
          <input 
            type="text" 
            placeholder="e.g., Kerala, Delhi, California" 
            value={location} 
            onChange={(e) => setLocation(e.target.value)} 
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Violation Details or Query</label>
          <textarea 
            placeholder="e.g., Driving a two-wheeler without a helmet, or parking in a no-parking zone on a main highway." 
            value={violation} 
            onChange={(e) => setViolation(e.target.value)} 
            style={{ width: '100%', height: '120px', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }}
          />
        </div>

        <button 
          onClick={analyzeTrafficLaw} 
          disabled={loading || !location || !violation}
          style={{ width: '100%', padding: '12px', fontWeight: 'bold', backgroundColor: '#0052cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: (loading || !location || !violation) ? 0.6 : 1 }}
        >
          {loading ? 'Processing Legal Frameworks...' : 'Run Compliance Analysis'}
        </button>
      </section>

      {result && (
        <section style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '20px', backgroundColor: '#fff' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Analysis Output</h3>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{result}</div>
        </section>
      )}
    </div>
  );
}