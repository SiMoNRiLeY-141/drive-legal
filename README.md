# DriveLegal

DriveLegal is an India-only traffic-citation information tool. It helps a person turn a challan description into cautious questions to check, suggested verification steps, official source links, and an information-request template.

> DriveLegal is not a law firm and does not provide legal advice. It does not calculate fines, determine deadlines, assess liability, or recommend whether to pay or contest a citation.

## Privacy and data handling

- Citation details are sent to the server only when the user requests an analysis.
- The server uses `GEMINI_API_KEY` to call Gemini; this key is never included in the browser bundle, URL, browser storage, or client logs.
- Analysis history is off by default. When a user opts in, up to ten reports are stored only in that browser and can be deleted individually or all at once.
- Do not enter Aadhaar, driving-licence, payment-card, or other sensitive personal data.

## Local development

Use Node.js 24 (the version used by CI).

```sh
npm ci
cp .env.example .env.local
# Add GEMINI_API_KEY to .env.local for Vercel CLI local development.
npm run dev
```

Vite serves the interface locally. To exercise the serverless endpoint locally, use `vercel dev` after adding `GEMINI_API_KEY` to your local Vercel environment.

```sh
npm run lint
npm run build
npm audit --omit=dev
```

## Vercel deployment

1. Import this repository into Vercel and use the default Vite build settings.
2. Add `GEMINI_API_KEY` as an encrypted environment variable for Production, Preview, and Development. Do **not** use `VITE_GEMINI_API_KEY`.
3. Configure Vercel Firewall/rate limiting for `POST /api/analyze` before making the site public. The endpoint also applies a best-effort per-instance limit; platform controls are required for production-wide abuse protection.
4. Deploy through the Vercel Git integration. GitHub Actions runs the independent build and lint checks.

The UI calls the same-origin `/api/analyze` Vercel Function. No user account or server-side citation history is created.

## Official verification links

- [Parivahan eChallan](https://echallan.parivahan.gov.in/)
- [India Code](https://www.indiacode.nic.in/)
- [Ministry of Road Transport and Highways](https://morth.nic.in/)
