# CineScope

CineScope is a movie and TV tracking application built with Ionic, Angular 19, and Capacitor 7, supported by a serverless Backend-for-Frontend (BFF) on Vercel.

## Repository Layout

This monorepo is managed using PNPM Workspaces:

- `cinescope/` - Frontend mobile application (Angular 19, Ionic 8, Capacitor 7, RxDB).
- `cinescope-api/` - Serverless API gateway (Node.js, TMDB proxy, Gemini AI orchestration).
- `docs/` - Docusaurus documentation hub and OpenAPI specifications.

## Prerequisites

- Node.js >= 22.0.0
- pnpm >= 10.0.0
- Java JDK 21 (for Android builds)
- Android SDK Platform 34+

## Getting Started

### 1. Installation

Install all workspace dependencies from the repository root:

```bash
pnpm install
```

### 2. Local Development

Run both the API server (port 3000) and the Angular UI development server concurrently:

```bash
pnpm run dev
```

Or run services individually:

- Frontend UI: `pnpm --filter cinescope start`
- Backend API: `pnpm --filter cinescope-api exec npx vercel dev --listen 3000 --yes`

### 3. Production Build

Compile all packages across the workspace:

```bash
pnpm run build
```

Frontend assets will be generated in `cinescope/www/`.

### 4. Android Build and Deployment

Sync web assets to Capacitor and launch on a connected Android device:

```bash
cd cinescope
npx cap sync android
npx cap run android
```

Or use the workspace scripts:

```bash
pnpm run android:dev   # Live-reload mode
pnpm run android:prod  # Production bundle mode
```

## Backend API & AI Resilience

The backend API secures TMDB and Gemini keys and implements a 4-tier resilience strategy against AI demand spikes and outages:
- Multi-tier in-memory LRU query cache (2-hour TTL).
- Cascading model fallback across available Gemini Flash models.
- Automatic graceful degradation to direct TMDB search when AI tiers are unavailable.
- Strict prefix allowlists and SSRF protection.

Detailed API endpoint documentation and architecture diagrams are in [`cinescope-api/README.md`](cinescope-api/README.md).

## Documentation Hub

Build and preview the unified documentation portal (Compodoc and OpenAPI):

```bash
pnpm run docs:start
```
