# Sennet — Multiplayer Senet Web App

A production-ready web implementation of the ancient Egyptian board game **Senet**, featuring online multiplayer matchmaking, friend-based private matches, single-player AI, and full player profiles with statistics.

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

```bash
# Install all dependencies (monorepo workspaces)
npm install

# Build the shared game engine
npm run build -w @sennet/game-engine

# Generate Prisma client & push schema to SQLite
npm run db:generate -w server
npm run db:push -w server

# Copy environment config
cp .env.example server/.env
# Edit server/.env and set a real JWT_SECRET for production
```

### Development

```bash
# Start both server (port 3001) and client (port 5173) concurrently
npm run dev
```

Or run them separately:

```bash
npm run dev:server   # Express + Socket.IO on :3001
npm run dev:client   # Vite React on :5173
```

### Testing

```bash
# Run all tests
npm test

# Game engine tests only
npm run test:engine

# Server tests only
npm run test:server
```

### Production Build

```bash
npm run build
# Server: server/dist/
# Client: client/dist/
```

## Project Structure

```
Sennet/
├── packages/game-engine/  # Shared pure game logic (TypeScript)
│   └── src/
│       ├── types.ts       # GameState, Move, PieceState, etc.
│       ├── board.ts       # Board geometry, blockade/protection checks
│       ├── rolls.ts       # Seedable RNG + roll generation
│       ├── moves.ts       # Legal move calculation
│       ├── engine.ts      # State machine: init, roll, move, winner
│       ├── ai.ts          # Heuristic AI (easy/medium/hard)
│       └── events.ts      # Socket.IO event type contracts
├── server/                # Express + Socket.IO + Prisma
│   ├── prisma/schema.prisma
│   └── src/
│       ├── routes/        # REST: auth, profile, friends
│       ├── socket/        # Realtime: queue, lobby, game handlers
│       └── services/      # GameManager, QueueManager, LobbyManager, AI
├── client/                # React + Vite
│   └── src/
│       ├── components/    # Board, Game, Lobby, Profile, Auth, Layout
│       ├── context/       # Auth + Socket providers
│       └── hooks/         # useGame hook
├── ARCHITECTURE.md
├── SECURITY.md
└── RULES.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6 |
| Backend | Node.js, Express 4, TypeScript |
| Realtime | Socket.IO 4 |
| Database | SQLite + Prisma 6 |
| Validation | Zod |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Security | Helmet, CORS, express-rate-limit |
| Testing | Vitest |

## Key Features

- **Server-authoritative gameplay** — all rolls generated server-side with crypto RNG; all moves validated by the engine
- **Classic 3×10 snake board** with legal-move highlighting
- **Online matchmaking** — automatic queue and match
- **Friend system** — add friends, invite to private lobbies
- **Single-player AI** with 3 difficulty levels
- **Reconnection support** — refresh and rejoin your active game
- **Full player stats** — wins, streaks, captures, resign rate, and more
- **Egyptian-themed UI** — gold-and-lapis dark theme

## References

- Game rules: [`sennet-core-logic.md`](./sennet-core-logic.md)
- Architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Security: [`SECURITY.md`](./SECURITY.md)
