# sennet-server

Server-authoritative backend for authentication, profiles/friends APIs, and realtime Senet gameplay.

## Responsibilities

- JWT authentication and profile/friend REST APIs
- Socket.IO matchmaking queue, private lobbies, and game events
- Game lifecycle orchestration through `TurnRunner` and `GameManager`
- Persistence of finished games and user stats using Prisma

## Key Modules

- `src/app.ts`: Express app wiring and HTTP middleware
- `src/socket/index.ts`: Socket.IO setup, auth handshake, and handler registration
- `src/services/gameManager.ts`: active game registry + DB persistence
- `src/services/turnRunner.ts`: turn flow, timers, faceoff, and move/roll handling
- `src/services/queueManager.ts`: FIFO matchmaking queue
- `src/services/lobbyManager.ts`: private lobby lifecycle

## Development

```bash
npm run dev -w server
npm run test -w server
npm run build -w server
```

## Database

- Prisma schema: `prisma/schema.prisma`
- Required env vars are documented in root `.env.example`
