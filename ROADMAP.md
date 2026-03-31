# Sennet Roadmap

Status reviewed against the codebase on March 31, 2026.

## What Is Already Landed

The following are present in the repo now and should no longer be treated as future work:

- PostgreSQL-backed Prisma schema and tracked migration
- structured logging on the server through `pino`
- GitHub Actions CI in `.github/workflows/ci.yml`
- `/health` endpoint
- in-game chat
- post-game auto-queue flow for multiplayer rematches
- friend removal and friend-to-lobby invite flow
- reconnect handling, disconnect grace timer, roll timer, and move timer

## Current Priorities

### 1. Codebase Cleanup

- remove leftover client-side `console.log` and `console.error` debugging
- remove stale `// TODO: remove` comments tied to those client logs
- delete or implement the stale `server` `db:seed` script target
- clean up the stray `ToDO.txt` ignore entry in `.gitignore`
- keep setup and architecture docs aligned whenever infra or feature status changes
- review `.env.example` whenever runtime configuration changes so local and production guidance does not drift
- keep gameplay reference docs synchronized with the shared engine and reject malformed documentation files in review

### 2. Correctness And Reliability

- resolve the `bestStreak` double-write race in `server/src/services/gameManager.ts`
- review the testing/database setup after the Postgres migration so local and CI assumptions stay coherent
- decide how active games should survive process restarts if production uptime matters

### 3. Client Quality

- add a real client test suite for providers, lobby flow, and game flow
- cover reconnect behavior, timer rendering, and chat interactions

### 4. Deployment Readiness

- pick and document the actual hosting target
- add deployment config and environment runbooks
- document pooled vs direct Postgres connection strings for production

## Next Phase

### Phase 1: Ship-Ready Ops

- deployment config for server and client
- production environment templates and release steps
- error monitoring
- uptime checks
- basic operational metrics

### Phase 2: Scalability

- connection pooling for Postgres
- strategy for multi-instance Socket.IO
- replacement of in-memory active game storage if horizontal scaling is required

### Phase 3: Product Expansion

- leaderboard
- game replay/history endpoints
- spectator mode
- tournaments
- mobile/PWA polish

## Cleanup Backlog

This section is intentionally repo-focused rather than feature-focused.

- `client/src/context/GameContext.tsx`, `client/src/components/Lobby/LobbyView.tsx`, and `client/src/services/socket.ts` still contain temporary debug logging
- `server/package.json` advertises `db:seed`, but `server/prisma/seed.ts` does not exist
- docs had drifted from the current runtime state and should be kept aligned when infrastructure or gameplay flow changes
- `.env.example` had drifted from the Postgres-based runtime and now needs to be treated as part of configuration maintenance
- `sennet-core-logic.md` had previously contained malformed non-repo content, which is a sign the docs need the same review discipline as code
- active games still live only in memory, so crash recovery and multi-instance support remain unresolved
- the client has no automated tests yet

## Milestone Snapshot

```text
Done now          Shared engine, multiplayer, AI, stats, chat, Postgres, logging, CI
Next              Cleanup, client tests, deployment config, operational runbooks
Later             Observability, scaling, replay/leaderboard/spectator features
```
