# Sennet

Server-authoritative web implementation of Senet built as an npm workspace monorepo. The repo contains a shared TypeScript game engine, an Express + Socket.IO backend, and a React + Vite client.

## Current Status

As of March 31, 2026, the playable product in this repo includes:

- authenticated accounts with profile customization
- quick match queue and private lobby flow
- friend requests, live friend-list refresh, friend removal, and lobby invites
- AI games with `easy`, `medium`, and `hard` difficulty
- server-driven faceoff, roll timers, move timers, timeout auto-play, and reconnect handling
- live opponent color sync after profile changes and reconnect
- persisted game history and user stats through Prisma on PostgreSQL
- CI for install, type-check, build, and engine/server test runs

The main gaps are around production auth hardening, client and end-to-end coverage, audiovisual polish, onboarding/help UX, rematch UX, and a few cleanup items called out in [`todo.md`](./todo.md) and [`ROADMAP.md`](./ROADMAP.md).

## Workspace Layout

```text
.
├── client/                  # React 19 + Vite 6 frontend
├── server/                  # Express 4 + Socket.IO 4 + Prisma backend
├── packages/game-engine/    # Shared Senet rules, AI, and event contracts
├── .github/workflows/ci.yml
├── railway.json
├── ARCHITECTURE.md
├── ROADMAP.md
├── RULES.md
├── SECURITY.md
├── TESTING.md
├── sennet-core-logic.md
└── todo.md
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6, React Router 7 |
| Backend | Node.js, Express 4, TypeScript |
| Realtime | Socket.IO 4 |
| Database | PostgreSQL + Prisma 6 |
| Auth | JWT + bcrypt |
| Validation | Zod |
| Logging | pino + pino-pretty |
| Testing | Vitest |

## Local Setup

### Prerequisites

- Node.js 22.x recommended (matches CI)
- npm 10+
- a running PostgreSQL database

### Install

```bash
npm install
```

### Environment

Copy the tracked example into the server workspace and fill in real values:

```bash
cp .env.example server/.env
```

Required variables are documented in [`./.env.example`](./.env.example). For local development:

- `DATABASE_URL` should point at your Postgres database
- `DIRECT_URL` can usually match `DATABASE_URL` locally
- `JWT_SECRET` must be set
- `CLIENT_URL` should remain `http://localhost:5173` unless you change the Vite dev origin
- `VITE_API_URL` and `VITE_SOCKET_URL` can be left blank locally to use the Vite proxy fallback

### Prisma

Generate the Prisma client and sync the schema:

```bash
npm run db:generate
npm run db:push
```

If you prefer applying tracked migrations directly instead of `db push`, run Prisma from `server/` with the same environment file.

## Development

Start both apps together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:server
npm run dev:client
```

Default local ports:

- server: `http://localhost:3001`
- client: `http://localhost:5173`

The Vite client proxies `/api` and `/socket.io` to the server in development.

## Production Hosting

Current split:

- frontend on Vercel
- backend on Railway
- PostgreSQL on Supabase

### Frontend on Vercel

Because the client imports the shared workspace package from `packages/game-engine`, Vercel should build from the repo root, not from `client/`.

Set these values in Vercel:

- Framework Preset: `Vite`
- Root Directory: repo root
- Install Command: `npm install`
- Build Command: `npm run build -w @sennet/game-engine && npm run build -w client`
- Output Directory: `client/dist`

Required frontend env vars:

- `VITE_API_URL=https://your-railway-service.up.railway.app/api`
- `VITE_SOCKET_URL=https://your-railway-service.up.railway.app`

### Backend on Railway

Railway builds from the repo root so the server can access the shared workspace package.

Use the included [`railway.json`](./railway.json) — it sets the build command, start command (which runs migrations then starts the server), and health check path automatically.

Required backend env vars (set in the Railway dashboard):

- `NODE_ENV=production`
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `CLIENT_URL=https://your-frontend-domain.com`

### Domains

Recommended domain split:

- `sennet.d3nizg.dev` → Vercel frontend
- `api.sennet.d3nizg.dev` → Railway backend

The client is environment-driven for cross-origin deploys, while still falling back to same-origin `/api` and `window.location.origin` for local dev.

## Test And Build

Run the current automated suite:

```bash
npm test
```

Workspace-specific commands:

```bash
npm run test:engine
npm run test:server
npm run build
```

Build outputs:

- server: `server/dist/`
- client: `client/dist/`
- shared engine: `packages/game-engine/dist/`

## Feature Summary

- server-authoritative move validation and secure roll generation
- shared rules engine used by both server and client
- multiplayer faceoff before initial placement
- 5 second multiplayer roll timer, 13 second move timer, and 15 second reconnect grace window
- single-player AI with heuristic move selection
- chat during games
- profile stats and recent games

## Near-Term Product Focus

- email-backed auth and a stronger production auth story, potentially via Supabase Auth/OAuth
- end-to-end coverage for login, lobby/game flow, refresh/reconnect, and rematch UX
- sound design for traps, bonuses, swaps, bear-off, win/loss, turn changes, and low-time pressure
- board and piece motion polish, including move/swap animation work
- a dedicated how-to-play surface for onboarding
- gameplay HUD cleanup around bonus rolls, faceoff layout stability, and rematch UX

## Documentation Map

- repo and runtime architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- current priorities and longer-term work: [`ROADMAP.md`](./ROADMAP.md)
- cleanup backlog and maintenance items: [`todo.md`](./todo.md)
- security model and operational notes: [`SECURITY.md`](./SECURITY.md)
- test surface and CI details: [`TESTING.md`](./TESTING.md)
- gameplay rules overview: [`RULES.md`](./RULES.md)
- detailed rules reference: [`sennet-core-logic.md`](./sennet-core-logic.md)
