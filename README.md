# Cinescope (v4 Architecture)

Welcome to the completely revamped Cinescope project! This repository has been structurally upgraded to a **Monorepo** architecture powered by **PNPM Workspaces**.

## Repository Structure

This repository contains both the frontend application and the backend API, allowing them to share dependencies and exist harmoniously under one roof without long-path locking issues.

- `/cinescope` - The Ionic/Angular frontend application.
- `/cinescope-api` - The Node.js/Vercel serverless backend API.

## Getting Started

### 1. Installation
Because this is a PNPM workspace, you only need to run the install command once at the **root** of the repository:
```bash
pnpm install
```
PNPM will automatically hoist and link dependencies for both the frontend and the backend simultaneously to save space and time.

### 2. Running Locally (Development)

**Frontend (Cinescope):**
To start the frontend development server:
```bash
cd cinescope
pnpm start
```
This will run `ng serve` and host the web app locally.

**Backend (Cinescope API):**
To start the backend development server using the Vercel CLI:
```bash
cd cinescope-api
npx vercel dev
```

### 3. Building for Production

**Frontend:**
```bash
cd cinescope
pnpm run build
```
This will compile the production-ready Angular bundle into the `/cinescope/www/` directory.

**Mobile Deployment (Capacitor):**
After building the production frontend, you can sync and run the Android app natively on an attached mobile device:
```bash
cd cinescope
npx cap sync android
npx cap run android
```

## Documentation Architecture

This monorepo features a fully automated, self-generating documentation pipeline powered by **Docusaurus**, **Compodoc** (Frontend), and **OpenAPI** (Backend API).

### Generating the Docs

To regenerate all documentation across the entire stack, run this single command from the root:
```bash
pnpm run docs:build-all
```

### 4. Publishing & Hosting

**Frontend App:** You can deploy the web version of the frontend to any static host (Firebase Hosting, Vercel, Netlify) by uploading the compiled `/cinescope/www` directory. 

**Backend API:** The backend is natively configured for **Vercel** (`@vercel/node`). You can instantly publish your Serverless functions by navigating to the API folder and pushing to production:
```bash
cd cinescope-api
npx vercel --prod
```
