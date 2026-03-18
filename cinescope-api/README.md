# CINESCOPE API (BFF Proxy)

This repository contains the Backend-For-Frontend (BFF) serverless API for the Cinescope mobile application. 
It is strictly designed to secure third-party API keys (TMDB, Gemini) so they are never exposed to the client-side Angular/Capacitor application.

## Architecture
- **Provider:** Vercel Serverless Functions (Node.js)
- **Language:** Strict TypeScript (ES2022)
- **Security:** Requires `X-Cinescope-Client: CS-Mobile-App-2026` header for all invocations to prevent unauthorized public access.

---

## 🚀 Setup & Installation

**1. Install Dependencies**
Ensure you are in the root directory of this API project, then install the required packages:
```bash
npm install
```

**2. Install Vercel CLI globally**
If you haven't already, install the Vercel CLI to test the API locally:
```bash
npm install -g vercel
```

**3. Configure Local Environment Variables**
Create a `.env` file in the root of the project to hold your secret keys. **Do not commit this file to GitHub.**
```env
# .env
TMDB_ACCESS_TOKEN="your_tmdb_read_access_token_here"
GEMINI_API_KEY="your_google_gemini_api_key_here"
```

---

## 🛠️ Local Development

To run the API locally and test it with your Angular frontend:

**1. Start the Vercel Dev Server:**
```bash
vercel dev
```
*(This will typically launch the server on `http://localhost:3000`)*

**2. Update Angular Environment:**
In your Angular app (`cinescope`), point your `environment.ts` to the local API for testing:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  geminiModel: 'gemini-2.5-flash'
};
```

---

## ☁️ Deployment

When you are ready to push your changes to production on Vercel:

**1. Link the Project (First time only):**
```bash
vercel link
```

**2. Deploy to Production:**
```bash
vercel --prod
```

**3. Configure Production Secrets:**
Ensure you have added your `TMDB_ACCESS_TOKEN` and `GEMINI_API_KEY` to your project settings in the Vercel Web Dashboard under **Settings > Environment Variables**.

---

## 📡 Endpoints

### `GET /api/tmdb`
Proxies all requests to the TMDB API v3.
- **Required Header:** `X-TMDB-Path` (e.g., `/movie/popular`)
- **Query Params:** Automatically forwarded.

### `POST /api/extract`
Uses Google Gemini 2.5 Flash to extract movie titles from bulk text.
- **Body:** `{ "text": "Raw OCR text goes here" }`
- **Response:** Strictly formatted JSON array of strings `["Movie 1", "Movie 2"]`