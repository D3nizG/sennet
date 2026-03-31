# Sennet — Roadmap to Live Production

> **Status as of March 2026:** Phase 0 complete. Phase 1 (database migration + logging)
> in progress. The game is feature-complete, the database is live on Supabase PostgreSQL,
> and all Phase 0 polish items (chat, rematch, friend delete/invite, preset colors,
> reload fix, disconnect grace timer) have been implemented.

---

## Codebase Assessment

### Strengths

| Area | Rating | Notes |
|------|--------|-------|
| Game engine | ★★★★★ | Pure functions, fully typed, 6 test files covering every rule |
| Server architecture | ★★★★☆ | Clean service split (GameManager / TurnRunner / QueueManager / LobbyManager), Zod validation everywhere, rate limiting, crypto RNG |
| Security posture | ★★★★☆ | Server-authoritative, JWT + bcrypt, Helmet, CORS, per-socket rate limiter |
| Client code | ★★★★☆ | Good component separation, clean hooks pattern, reconnection support |
| Documentation | ★★★★★ | ARCHITECTURE, SECURITY, TESTING, RULES all present and accurate |
| Test coverage | ★★★☆☆ | Engine + server well covered; **client has zero tests** |
| Production-readiness | ★★☆☆☆ | SQLite, in-memory state, console.log TODOs, no CI/CD |

### Known Issues (fix before launch)

1. **bestStreak uses a double-query workaround** — `gameManager.ts:236`. The Prisma `upsert` sets `increment: 0` then a second `findUnique` + `update` handles the max. This is a data-race window under concurrent requests.
2. **`console.log` / `console.error` debug statements** scattered throughout server with `// TODO: remove` comments.
3. **In-memory game state** — `GameManager` uses a `Map`. A server restart drops all active games. Players can rejoin only if the server is still running.
4. **SQLite** — not suitable for concurrent writes under real traffic.
5. **No client-side tests** — React components, hooks, and context are entirely untested.
6. **Chat tab is a placeholder** — UI exists, socket events do not.
7. **No rematch / new game flow** — game-over card has only "Back to Lobby".
8. **Socket.IO is single-instance** — scaling horizontally requires Redis adapter or sticky sessions.

---

## Phase 0 — Polish the Existing Game ✅ COMPLETE

> **Goal:** Ship a complete, bug-free experience before going live.
> No new infrastructure — just finish what's started.

### 0.1 Complete In-Game Chat ✅

- `GAME_CHAT` event added to game-engine events (client→server→room broadcast)
- Zod schema (`GameChatSchema`) validates payload: min 1, max 500 chars
- Server handler broadcasts with sender name + timestamp
- Chat tab in GameView now shows messages and input form with auto-scroll

### 0.2 Post-Game Options ✅

- **Play Again** button on game-over overlay: resets game state, navigates to `/` with `autoQueue: true`
- LobbyView handles `autoQueue` navigation state and immediately joins the queue
- AI games show only "Back to Lobby" (no play again for solo)

### 0.3 Bug Fixes ✅

- **Reload → instant resign**: 15s disconnect grace timer in TurnRunner, canceled on reconnect
- **Reload → empty screen on /game**: GameView shows "Connecting..." while socket is not yet connected
- **Opponent color not rendering**: `opponentColor` preserved across GAME_STATE updates
- **Friend delete missing**: `DELETE /friends/:id` endpoint + trash button in friends list UI
- **Infinite color picker**: replaced `<input type="color">` with 10 preset swatches

### 0.4 UX — Friend Invite from Friends List ✅

- Invite (+) button beside each friend: creates lobby (if not in one) then emits `LOBBY_INVITE`

### Remaining from Phase 0 (deferred to later)

- Client test suite (Vitest + React Testing Library)
- `bestStreak` race condition fix
- Remove all `// TODO: remove` console statements (planned for Phase 1 logging work)

---

## Phase 1 — Infrastructure Foundation

> **Goal:** Everything needed to deploy and operate the game reliably.

### 1.1 Database Migration: SQLite → PostgreSQL

SQLite cannot handle concurrent writes from multiple players. PostgreSQL is the target for production.

**Steps:**
1. Add `provider = "postgresql"` variant to `schema.prisma` behind an env flag
2. Create a migration with `prisma migrate dev`
3. Update `DATABASE_URL` in environment config
4. Test locally with a Docker PostgreSQL container
5. Confirm all queries, including `UserStats.upsert`, behave correctly under concurrent load

**Hosting options (pick one):**
- **Railway** — PostgreSQL add-on, automatic backups, free tier for dev
- **Supabase** — managed Postgres, generous free tier, built-in connection pooling (PgBouncer)
- **Neon** — serverless Postgres, autoscales to zero, branching for preview deploys

**Recommendation:** Supabase for simplicity + PgBouncer (connection pooling is important with Socket.IO's persistent connections).

### 1.2 Structured Logging

Replace `console.log` / `console.error` with **pino** (fast, JSON, log-level aware).

```
npm install pino pino-pretty -w server
```

- Create `server/src/utils/logger.ts` exporting a configured pino instance
- Replace all console calls
- Log levels: `debug` in dev, `info` in prod, `error` always
- Include `gameId`, `userId`, `socketId` as structured fields where relevant

### 1.3 Environment Configuration

Create a proper environment setup for each target:

```
server/.env.development    ← SQLite, local secrets
server/.env.production     ← PostgreSQL URL, strong JWT_SECRET, prod CORS
server/.env.example        ← checked in, no real values
```

Required production env vars:
```
DATABASE_URL=postgresql://...
JWT_SECRET=<min-32-random-chars>
CLIENT_URL=https://yourdomain.com
PORT=3001
NODE_ENV=production
```

### 1.4 CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/ci.yml`:

```yaml
# Triggers: push to main, all pull requests
jobs:
  test:
    - Install dependencies
    - Build game-engine
    - Run npm test (engine + server + client)
    - Upload coverage report

  lint:
    - ESLint + TypeScript type-check all workspaces

  deploy:
    - needs: [test, lint]
    - only on push to main
    - Trigger Railway / Render deploy hook
```

**Branch strategy:**
- `main` — production, protected, requires passing CI
- `dev` — integration branch, staging deploy
- `feature/*` — individual feature branches, PR into `dev`
- `fix/*` — bug fix branches

### 1.5 Git Hygiene (Start Now)

- Add `.gitignore` entries: `*.env`, `server/prisma/*.db`, `dist/`, `node_modules/`
- Protect `main` branch (require PR + passing CI)
- Write descriptive commit messages: `feat:`, `fix:`, `chore:`, `test:` prefixes

---

## Phase 2 — Deployment

> **Goal:** The game is live at a real URL with HTTPS.

### 2.1 Server Hosting

**Recommended: Railway**

- Connects directly to GitHub repo
- Automatic deploys on push to `main`
- Built-in PostgreSQL add-on
- Environment variable UI
- Free tier covers early traffic; scales by usage

**Alternative: Render or Fly.io**

Deploy steps (Railway):
1. Create Railway project → connect GitHub repo
2. Add `railway.json` or `nixpacks.toml` build config
3. Set all env vars in Railway dashboard
4. Add PostgreSQL service → copy `DATABASE_URL` to server service
5. Set start command: `node dist/index.js`
6. Run `prisma migrate deploy` as a release command

### 2.2 Client Hosting

**Recommended: Vercel** (you already have the MCP connected)

- Zero-config Vite deploy
- Automatic preview deployments per PR
- Custom domain with free HTTPS

Deploy steps:
1. Connect repo to Vercel
2. Set build command: `npm run build -w client`
3. Set output directory: `client/dist`
4. Set env var: `VITE_SERVER_URL=https://your-railway-app.up.railway.app`
5. Add custom domain

### 2.3 Custom Domain + HTTPS

- Purchase domain (Namecheap, Cloudflare Registrar)
- Point DNS to Vercel (client) and Railway (API)
- Both Vercel and Railway provision TLS automatically
- Consider Cloudflare as DNS proxy for DDoS protection and caching

### 2.4 Socket.IO CORS Configuration

Update server CORS for production:
```
CLIENT_URL=https://www.yourdomain.com
```

Verify Socket.IO `cors.origin` matches exactly (trailing slashes matter).

---

## Phase 3 — Observability & Reliability

> **Goal:** Know when something breaks before users report it.

### 3.1 Error Monitoring (Sentry)

```
npm install @sentry/node -w server
npm install @sentry/react -w client
```

- Server: capture unhandled exceptions, Socket.IO errors, Prisma errors
- Client: capture React render errors, unhandled promise rejections
- Configure source maps for readable stack traces
- Set up Slack/email alert for new issues

**Free tier** covers small-scale launch comfortably.

### 3.2 Uptime Monitoring

- **Better Uptime** or **UptimeRobot** (free) — ping `/health` endpoint every 60 seconds
- Add a `GET /health` route to Express that checks DB connectivity and returns 200
- Alert on downtime > 2 minutes

### 3.3 Basic Metrics

Add a `GET /metrics` endpoint or integrate with Railway's built-in metrics:
- Active games count
- Queue length
- Connected sockets
- DB query latency (Prisma middleware timer)

---

## Phase 4 — Scaling

> **Goal:** Handle concurrent players without the server falling over.
> Start here only after Phase 2 is live and you see real traffic.

### 4.1 Connection Pooling

With PostgreSQL + persistent Socket.IO connections, you'll exhaust DB connections quickly.

- **Supabase PgBouncer** (if using Supabase) — pool at the infrastructure layer
- Or **prisma-connection-pool** / configure `connection_limit` in `DATABASE_URL`

### 4.2 Socket.IO Horizontal Scaling (Redis Adapter)

The current `GameManager` is in-memory. A second server instance can't see games from the first.

Two approaches:

**Option A — Sticky Sessions (simpler)**
- Configure load balancer to route each user to the same server instance
- Works with Railway's built-in load balancing
- No code changes needed
- Drawback: uneven load, no failover

**Option B — Redis Adapter (proper)**
```
npm install @socket.io/redis-adapter ioredis -w server
```
- Publish all Socket.IO events through Redis pub/sub
- Move `GameManager` game state to Redis (JSON) instead of in-memory `Map`
- All server instances share game state through Redis
- Railway and Render both offer managed Redis add-ons
- Enables true horizontal autoscaling

**Recommendation:** Start with sticky sessions for simplicity. Move to Redis when you need more than 2 instances.

### 4.3 Autoscaling Configuration

**Railway:**
- Enable autoscaling in service settings
- Set min/max instance count (1–5 for a game)
- CPU threshold: scale up at 70%, scale down at 30%
- Memory threshold: 512MB per instance for this app

**Vercel** (client) autoscales automatically — no config needed.

### 4.4 Database Scaling

- Enable **connection pooling** (PgBouncer or Supabase)
- Add **read replicas** for stats queries if write load grows
- Add **indexes** on hot query paths:
  - `Game.player1Id`, `Game.player2Id` (game history)
  - `Friendship.requesterId`, `Friendship.addresseeId`
  - `UserStats.userId` (already unique index via `@unique`)

---

## Phase 5 — Post-Launch Features

> Implement after the game is stable and live.

### 5.1 Leaderboard
- `GET /api/leaderboard` — top players by wins, win rate, streak
- Public-facing page on the client

### 5.2 Spectator Mode
- Allow any authenticated user to join a game room as observer
- Receive `GAME_STATE` events but cannot emit `GAME_ROLL` / `GAME_MOVE`

### 5.3 Game History / Replay
- Store full `moveLog` in DB (already in `stateJson`)
- `GET /api/games/:id` — return game record
- Client-side replay viewer stepping through `moveLog`

### 5.4 Tournaments
- Bracket system, round-robin, scheduled start times

### 5.5 Dice Animation
- Visual die face animation (marked as FUTURE in todo.md)
- WebGL or CSS 3D transforms

### 5.6 Mobile / PWA
- Responsive board layout for small screens
- `manifest.json` + service worker for installable PWA

---

## Required Keys & Integrations

| Service | What For | Key Location |
|---------|----------|-------------|
| **Railway** | Server hosting + PostgreSQL | `RAILWAY_TOKEN` in GitHub Actions secret |
| **Vercel** | Client hosting | `VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` in GitHub Actions |
| **Sentry** | Error monitoring | `SENTRY_DSN` in server and client env |
| **Custom domain registrar** | Domain DNS | DNS records pointing to Vercel + Railway |
| **Supabase / Neon** | Managed PostgreSQL (optional, if not using Railway's Postgres) | `DATABASE_URL` |
| **Redis** (Phase 4+) | Socket.IO adapter + game state | `REDIS_URL` |
| **Cloudflare** (optional) | DNS proxy, DDoS, caching | Free tier |
| **UptimeRobot** | Uptime alerts | Free account, no key needed for basic |

---

## Milestone Summary

```
Phase 0 — Polish        Complete the game (chat, rematch, bug fixes, client tests)
Phase 1 — Infra         PostgreSQL, logging, CI/CD, env config, git branching
Phase 2 — Deploy        Live URL with HTTPS, Vercel + Railway, custom domain
Phase 3 — Observe       Sentry, uptime monitoring, /health endpoint
Phase 4 — Scale         Connection pooling, Redis adapter, autoscaling config
Phase 5 — Grow          Leaderboard, replays, spectator, mobile, tournaments
```

---

## Commit & Branch Conventions

```
feat(chat): add in-game chat via CHAT_MESSAGE socket event
fix(stats): resolve bestStreak race condition in endGame
chore(db): migrate schema from SQLite to PostgreSQL
test(client): add GameView and useGame hook test suite
ci: add GitHub Actions workflow for test + deploy
```

Branch naming:
```
feature/in-game-chat
feature/rematch-flow
fix/best-streak-race
chore/postgres-migration
infra/railway-deploy
```

PRs always target `dev`. Only `dev → main` merges trigger production deploys.
