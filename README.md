# DriveLegal Platform 🛡️
> **Fast legal triage for traffic citations with secure Gemini access, localized context, and offline-ready history.**
> Developed for the **Road Safety Hackathon 2026** at the **Center of Excellence in Road Safety (CoERS), IIT Madras**.

---

## 📖 Project Overview

**DriveLegal** is a client-side web application designed to empower citizens facing traffic citations or "challans." By combining localized traffic code databases with the reasoning power of the **Google Gemini API**, DriveLegal translates complex legal citations into clear, actionable advice. 

The application helps drivers understand:
1. Which statutory traffic laws or compounding acts apply to their alleged infraction.
2. The breakdown of estimated liabilities (base fine, state compounding adjustments, and administrative fees).
3. The precise official protocols for paying the fine or contesting it in court.
4. How to draft a formal dispute/appeal representation letter tailored to their specific incident.

---

## 🌟 Key Features

### 1. Secure Gemini Integration & Model Selector
- Allows users to enter their own Gemini API key for local, client-side requests. No remote servers store the API keys.
- Features a dropdown selector supporting multiple Gemini models (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`) to balance speed and reasoning depth.

### 2. High-Speed OCR Citation Scanner Simulator
- Simulates advanced OCR text extraction from uploaded images or PDF tickets.
- Built-in interactive demo files:
  - 🇮🇳 **Chennai Overspeeding Challan**: Auto-populates Section 183 of the Motor Vehicles Act for speed violations caught on cameras near Anna Salai, Chennai.
  - 🇺🇸 **New York Red Light Citation**: Auto-populates Section 1111(d)(1) of the NY Vehicle & Traffic Law (VTL) for intersection camera citations in New York City.
- Implements visual scanning animations with simulated regex processing and character parsing logs.

### 3. Workflow Stepper Validation
- An intuitive four-step progress tracker guiding the user: **Setup Key** ➔ **Enter Details** ➔ **View Result** ➔ **Access Local History**.
- Step checkmarks (`✓`) validate input completeness dynamically (the form details checkmark only ticks when a valid location, vehicle type, and detailed violation context are filled).

### 4. Dynamic Liability Invoice
- Breaks down the citation fees based on vehicle size classifications (e.g., two-wheeler vs. commercial vehicle) and location.
- Generates a **Dispute Success Rate** gauge, assessing the likelihood of a successful representation or compounding waiver based on local statutes (like camera calibration or signage visibility rules).

### 5. Appeal Representation Letter Builder
- Generates a formal, professionally structured legal representation letter ready to copy to the clipboard.
- The letter dynamically adapts to the selected country, state, city, vehicle class, and violation parameters.

### 6. Offline Compliance History Cache
- Persists successfully run reports locally in the browser's `localStorage`.
- Includes a side-by-side history panel to inspect, reload, or delete cached items.
- Features a **Clear History** button that wipes the cache and resets the active workspace.
- Starts with a clean reload behavior (a fresh form and empty result area) on refresh to ensure privacy and clear workspace flows.

### 7. Glassmorphic UI & Dark Mode Switcher
- Premium interface featuring glowing radial gradients, clean glassmorphic panels, and transitions.
- The theme toggle changes colors instantly using CSS custom property tokens optimized for light and dark environments.
- Integrates a Roadside Citizen Rights FAQ accordion to serve as a quick guide when stopped by enforcement officers.

---

## 🛠️ Architecture & Technology Stack

The project is built to run entirely on the client side, ensuring privacy and rapid response times without reliance on database servers.

- **Frontend Core**: [React 19](https://react.dev/) & [Vite](https://vite.dev/) (Fast HMR bundler)
- **Styling**: Vanilla CSS custom properties with responsive flexbox and grid layouts
- **AI Engine SDK**: [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)
- **Assets**: Custom steering-wheel and scale-of-justice SVG vectors in `public/favicon.svg` and `src/App.jsx`
- **Data Mappings**: Built-in state list mappings for **India**, the **United States**, and the **United Kingdom**, with custom fallback inputs for "Other" international locations.

---

## 🚀 Running Locally

1. **Clone and Install Dependencies**:
   ```bash
   git clone <repository-url>
   cd drive-legal
   npm install
   ```

2. **Configure API Key (Optional)**:
   Create a `.env.local` file in the root directory to preset a Gemini API key:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *Note: If not preset, you can input your key directly into the application header at runtime.*

3. **Start Dev Server**:
   ```bash
   npm run dev
   ```

4. **Production Build**:
   ```bash
   npm run build
   npm run preview
   ```
