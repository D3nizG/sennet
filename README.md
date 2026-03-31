# Sennet

Server-authoritative web implementation of Senet built as an npm workspace monorepo. The repo contains a shared TypeScript game engine, an Express + Socket.IO backend, and a React + Vite client.

## Current Status

As of March 31, 2026, the playable product in this repo includes:

- authenticated accounts with profile customization
- quick match queue and private lobby flow
- friend requests, friend removal, and lobby invites
- AI games with `easy`, `medium`, and `hard` difficulty
- server-driven faceoff, roll timers, move timers, timeout auto-play, and reconnect handling
- persisted game history and user stats through Prisma on PostgreSQL
- CI for install, type-check, build, and engine/server test runs

The main gaps are around documentation drift, client test coverage, deployment/runbook work, and a few cleanup items called out in [`todo.md`](./todo.md) and [`ROADMAP.md`](./ROADMAP.md).

## Workspace Layout

```text
.
├── client/                  # React 19 + Vite 6 frontend
├── server/                  # Express 4 + Socket.IO 4 + Prisma backend
├── packages/game-engine/    # Shared Senet rules, AI, and event contracts
├── .github/workflows/ci.yml
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

## Documentation Map

- repo and runtime architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- current priorities and longer-term work: [`ROADMAP.md`](./ROADMAP.md)
- cleanup backlog and maintenance items: [`todo.md`](./todo.md)
- security model and operational notes: [`SECURITY.md`](./SECURITY.md)
- test surface and CI details: [`TESTING.md`](./TESTING.md)
- gameplay rules overview: [`RULES.md`](./RULES.md)
- detailed rules reference: [`sennet-core-logic.md`](./sennet-core-logic.md)
