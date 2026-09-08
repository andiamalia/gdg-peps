# PEPS — People · Events · Proximity · Social

AI-powered in-person networking for Google Developer Groups communities.

Attendees join an event room, complete a short **Gemini dynamic interview**, then **shake** (or tap) to find people in the same room who share hobbies, interests, city, major, work, and tech stack — with AI icebreakers.

## Features

- Create / join event rooms (4-char code + QR)
- Anonymous auth + display name
- Gemini multi-turn interview (max 8 turns) that fills structured biodata
- Embedding-based circle matching scoped to the event
- Shake-to-find + accessible button fallback
- Natural-language search (“fintech + hiking + Flutter”)
- Organizer-friendly invite QR

## Tech stack

- Vite + React + TypeScript + Tailwind
- Firebase Authentication (anonymous)
- Cloud Firestore
- Cloud Functions (Node 22)
- Vertex AI Gemini (`gemini-3.1-flash-lite`) + text embeddings (with bag-of-words fallback)
- Firebase Hosting

## Setup

### 1. Firebase project

1. Create a Firebase project (example id: `gen-lang-client-0137104290`).
2. Enable **Anonymous** sign-in under Authentication.
3. Create a Firestore database.
4. Upgrade to Blaze to deploy Cloud Functions that call Gemini.
5. Register a Web app and copy the config values.
6. Enable Vertex AI:

```bash
gcloud services enable aiplatform.googleapis.com --project=gen-lang-client-0137104290
```

### 2. Web app env

```bash
cp .env.example .env
```

Fill `VITE_FIREBASE_*` values. Update `.firebaserc` if your project id differs.

### 3. Install and run locally

```bash
npm install
cd functions && npm install && cd ..
npm run build:functions
npm run dev
```

### 4. Deploy

```bash
npm run deploy
```

## Demo script (90 seconds)

1. Create an event room from the home page; show the QR / code.
2. Join on a second device or browser profile.
3. Run the Gemini interview on both devices (answer a few follow-ups).
4. Open **Find my circle**, shake or tap the button — show match reasons + icebreakers.
5. Try **Search by vibe** with a natural-language query.

## Buildathon notes

**Problem:** Cold-start networking at GDG meetups — attendees struggle to find people with shared hobbies, majors, stacks, or goals in a crowded venue.

**Solution:** Event-scoped PEPS rooms; Gemini conversational biodata interview; embedding match; shake-to-find circle with AI icebreakers; NL search.

**Uniqueness:** Physical shake gesture + dynamic multi-turn AI interview (not static forms) + explainable proximity matching.

**Google technologies:** AI Studio (prompt prototyping), Firebase, Gemini / Vertex AI, Cloud Functions, Hosting.

## Project layout

- `src/` — web client
- `functions/` — callable Gemini + matching functions
- `firestore.rules` — security rules (profile/embedding server-only)

## License

Apache-2.0 for community reuse by GDG chapters.
