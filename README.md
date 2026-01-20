# Social Persona Card System

A backend system that collects Farcaster activity to generate AI-powered Social Personas and provides structured data for visual card contexts.

## Features

- **Farcaster Data Ingestion**: Collects user profiles and casts via the Neynar API.
- **Social Metrics Calculation**: Detailed analysis of activity volume, engagement, channel activity, time-based patterns, etc.
- **AI Persona Generation**: Utilizes Gemini AI to analyze user tone, topics, and tendencies.
- **Card Context Generation**: Provides structured data for visual card rendering.

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to create a `.env` file and set up your API keys:

```bash
cp .env.example .env
```

```env
# Gemini AI API Key (https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key

# Neynar API Key (https://neynar.com/)
NEYNAR_API_KEY=your_neynar_api_key

# Database path
DATABASE_URL=./db/social-persona.db

# Server port
PORT=4000
```

## Database Setup

```bash
# Generate schema migrations
npm run db:generate

# Apply schema to database
npm run db:push

# (Optional) Verify DB with Drizzle Studio
npm run db:studio
```

## Running the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

### 1. Get Card Context

```bash
GET /api/users/:fid/card-latest
```

### 2. Trigger Card Generation

```bash
POST /api/users/:fid/cards
```

### 3. Immediate Ingestion (Admin)

```bash
POST /api/admin/users/:fid/ingest-now
```

### 4. Immediate Persona Generation (Admin)

```bash
POST /api/admin/users/:fid/persona-now
```

### 5. Run Full Pipeline (Admin)

```bash
POST /api/admin/users/:fid/full-pipeline
```

## Workflow

1. **Ingestion**: Collect user data from Farcaster.
2. **Persona Generation**: Analyze persona using AI.
3. **Card Context**: Generate context for card rendering.

```bash
# Run the full pipeline at once
curl -X POST http://localhost:4000/api/admin/users/YOUR_FID/full-pipeline

# Or run step-by-step
curl -X POST http://localhost:4000/api/admin/users/YOUR_FID/ingest-now
curl -X POST http://localhost:4000/api/admin/users/YOUR_FID/persona-now
curl -X POST http://localhost:4000/api/users/YOUR_FID/cards

# Check results
curl http://localhost:4000/api/users/YOUR_FID/card-latest
```

## CLI Scripts

```bash
# Run ingestion for a specific user
npm run worker:ingest -- 12345

# Generate persona for a specific user
npm run worker:persona -- 12345
```

## Directory Structure

```
src/
├── index.ts              # Express server entry point
├── db/
│   ├── index.ts          # Drizzle DB connection
│   └── schema.ts         # Table schemas
├── services/
│   ├── farcaster.service.ts  # Neynar API integration
│   ├── gemini.service.ts     # Gemini AI integration
│   └── users.service.ts      # User service (TODO)
├── workers/
│   ├── ingestion.worker.ts      # Data ingestion worker
│   ├── persona.worker.ts        # Persona generation worker
│   └── card-context.generator.ts # Card context generation
├── routes/
│   └── index.ts          # API router
├── types/
│   └── index.ts          # TypeScript type definitions
└── scripts/
    ├── run-ingestion.ts  # Ingestion CLI
    └── run-persona.ts    # Persona CLI
```

## TODO

- `src/services/users.service.ts`: Implement user lookup/creation logic
  - `getUserByFid()`: Actual user lookup logic
  - `upsertUser()`: User creation/update logic
  - `getAllUsersForSync()`: List of users to sync

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: SQLite + Drizzle ORM
- **AI**: Google Gemini AI (with Search Grounding)
- **Data Source**: Neynar API (Farcaster)
