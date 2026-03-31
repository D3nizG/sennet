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

### 1. Auth And Security

- move toward proper email-backed auth instead of the current game-first local-storage JWT flow
- evaluate Supabase Auth and OAuth as the likely fastest path to secure production auth
- add email verification, clearer session handling, and hardening around account lifecycle
- keep the threat model and deploy guidance aligned with the actual auth/storage choice

### 2. Gameplay UX Polish

- add sound effects for bonuses, traps, bear-off, wins/losses, turn start/end, timer pressure, and swaps
- add optional background music with an explicit player-controlled toggle
- add piece motion so moves are not visually instantaneous
- implement a dedicated swap animation where the moving piece clearly passes over the captured piece
- move bonus-roll information into the top HUD for both players
- keep the roll/faceoff container a stable size and scroll inside it instead of jumping layout
- stop hiding core roll UI during the faceoff sequence
- add a how-to-play section so new players can learn rules and special squares in-product

### 3. Match Continuity And Rematch UX

- keep hard refresh and reconnect behavior reliable across lobby, game, and post-game states
- replace the current play-again server hop with a rematch flow against the same opponent
- add opponent presence/availability cues for rematch, likely by dimming or disabling rematch affordances when they leave
- decide whether rematch should preserve lobby/game context or return to a lightweight post-game handshake state

### 4. Test Coverage

- add real client automation for providers, lobby flow, game flow, and refresh/reconnect regressions
- add end-to-end coverage for auth, direct `/game` reload, timers, chat, rematch, and post-game flows
- keep server and engine coverage growing around reconnect, presence, and timer-sensitive behavior

### 5. Cleanup And Reliability

- remove leftover client-side `console.log` and `console.error` debugging
- remove stale `// TODO: remove` comments tied to those client logs
- resolve the `bestStreak` double-write race in `server/src/services/gameManager.ts`
- delete or implement the stale `server` `db:seed` script target
- clean up the stray `ToDO.txt` ignore entry in `.gitignore`
- review the testing/database setup after the Postgres migration so local and CI assumptions stay coherent
- decide how active games should survive process restarts if production uptime matters
- keep setup, security, and architecture docs aligned whenever runtime or feature status changes

## Next Phase

### Phase 1: Trustworthy Production MVP

- secure auth rollout
- refresh/reconnect confidence
- client and E2E coverage
- basic release/ops runbooks
- onboarding/help content

### Phase 2: Scalability And Runtime Resilience

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
- the client still lacks automation and the repo has no real E2E suite yet

## Milestone Snapshot

```text
Done now          Shared engine, multiplayer, AI, stats, chat, Postgres, logging, CI
Next              Auth hardening, refresh/rematch UX, audio/motion polish, client+E2E coverage
Later             Observability, scaling, replay/leaderboard/spectator features
```
