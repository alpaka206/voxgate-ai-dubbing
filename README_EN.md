[한국어](./README.md) | [English](./README_EN.md)

# readvox

readvox is a web app for turning uploaded audio or video into dubbed output in another language.

## Overview

- Demo: [https://readvox.vercel.app](https://readvox.vercel.app)
- Repository: [https://github.com/alpaka206/voxgate-ai-dubbing](https://github.com/alpaka206/voxgate-ai-dubbing)
- One-line intro:
  Extract audio from uploaded media, transcribe it, translate it, and return dubbed output in one flow.

## Preview video

- Preview video: [readvox-preview.mp4](./public/readvox-preview.mp4)

## Core Features

1. Allowlist-based dubbing workspace
   Google sign-in is open, but actual studio access is limited to allowlisted accounts stored in Turso.
2. Audio and video upload pipeline
   Uploaded media is processed through audio extraction, transcription, translation, and voice synthesis.
3. Multi-language output with ElevenLabs and Gemini
   ElevenLabs handles transcription and text-to-speech, while Gemini translates the transcript into the target language.
4. Browser-first review flow
   Users can preview the dubbed result in the browser and download the output directly.

## Tech Stack

- Frontend: Next.js App Router, React 19, Tailwind CSS v4
- Auth: next-auth + Google OAuth
- Database: Turso, `@libsql/client`
- Media processing: `ffmpeg-static`
- AI services:
  - ElevenLabs Speech-to-Text
  - ElevenLabs Text-to-Speech
  - Gemini 2.5 Flash-Lite
- Deployment: Vercel

## AI Agent Workflow

- Planned the MVP scope, issue split, commit boundaries, and release flow with an AI coding agent.
- Used the agent to iterate on auth flow, allowlist policy, dubbing pipeline wiring, UI copy, and documentation.
- Logged major changes and tradeoffs in [docs/agent-log.md](./docs/agent-log.md).
- Used agent-assisted checkpoints for `lint`, `build`, and seed verification.

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in the required values.

3. Register Google OAuth callback URLs.

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://readvox.vercel.app/api/auth/callback/google`

4. Reset the Turso schema and seed the initial data.

```bash
npm run db:seed
```

5. Start the development server.

```bash
npm run dev
```

## Environment Variables

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_MODEL_ID`
- `ELEVENLABS_STT_MODEL_ID`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Architecture

### Flow

1. The browser uploads audio or video to the protected `/api/dub` route.
2. The Next.js server extracts audio with `ffmpeg`.
3. ElevenLabs transcribes the extracted speech.
4. Gemini translates the transcript into the target language.
5. ElevenLabs synthesizes the translated script into a new voice track.
6. If the input is video, the server tries to mux the new audio back into the original video; otherwise it returns dubbed audio.

## Main Routes

- `/`: landing page
- `/dashboard`: account status and quick actions
- `/studio`: protected dubbing workspace
- `/mypage`: account details and usage status
- `/allowlist`: manager-only allowlist management

## Data Model

```sql
CREATE TABLE allowlist_users (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

```sql
CREATE TABLE access_requests (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

```sql
CREATE TABLE daily_generation_usage (
  email TEXT NOT NULL COLLATE NOCASE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email, usage_date)
);
```

## Verification

```bash
npm run lint
npm run build
npm run db:seed
```
