# sennet-server

Express + Socket.IO backend for authentication, profiles, friendships, matchmaking, private lobbies, and authoritative Senet gameplay.

## Responsibilities

- authenticate users for both REST and realtime traffic
- expose `/api/auth`, `/api/profile`, and `/api/friends`
- manage quick-match queue and private lobby state
- run faceoff, roll, move, timeout, reconnect, and resign orchestration
- persist completed games and user stats through Prisma

## Key Modules

- `src/app.ts`: Express middleware, REST route registration, and `/health`
- `src/socket/index.ts`: Socket.IO bootstrap, handshake auth, reconnect handling
- `src/services/gameManager.ts`: active game registry and persistence
- `src/services/turnRunner.ts`: timers, faceoff, AI pacing, and game completion flow
- `src/services/queueManager.ts`: quick-match queue
- `src/services/lobbyManager.ts`: private lobby state
- `src/routes/`: auth, profile, and friend APIs

## Runtime Notes

- completed games are persisted in PostgreSQL
- active games are still stored in memory
- the server is the only authority allowed to mutate game state
- the client only sends gameplay intent

## Development

```bash
npm run dev -w server
npm run test -w server
npm run build -w server
```

## Environment

Required values are documented in the repo-root `.env.example`.

Important ones for this workspace:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `CLIENT_URL`
- `PORT`
- `NODE_ENV`

## Database

- Prisma schema: `prisma/schema.prisma`
- tracked migration: `prisma/migrations/20260331030118_init_postgres/`
