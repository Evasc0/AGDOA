# Agduwa

Agduwa is a web-based ride-hailing and queue management system built with React, TypeScript, Vite, Firebase, and Tailwind CSS.

## Installation Guide

### 1. Prerequisites

- Node.js 18+ (Node.js 20 LTS recommended)
- npm (comes with Node.js)
- A Firebase project (Auth, Firestore, Realtime Database, Storage, Analytics)
- An OpenCage API key (for reverse geocoding)

### 2. Clone and install dependencies

```bash
git clone <your-repo-url>
cd agduwa
npm install
```

### 3. Create environment variables

Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.<region>.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_ADMIN_EMAIL=admin@example.com
VITE_OPENCAGE_API_KEY=your_opencage_api_key
```

### 4. Run in development

```bash
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).

### 5. Build for production

```bash
npm run build
```

Production output is generated in the `dist/` directory.

### 6. Preview production build locally

```bash
npm run preview
```

## Deployment Notes

- This repository includes `vercel.json` for SPA routing rewrites.
- Add the same `VITE_...` environment variables in your hosting provider (for example, Vercel project settings).

## Why We Do Not Need an APK

This repository is a web application, not a native Android project.

- It runs in a browser and is deployable as a website.
- There is no Android build setup in this codebase (`android/`, Gradle files, `AndroidManifest.xml`, Capacitor/Cordova config).
- One web deployment supports desktop and mobile browsers without maintaining a separate Android binary.

An APK is only needed if you want native Android packaging or distribution (for example, Play Store release). For the current architecture and deployment flow, it is not required.
