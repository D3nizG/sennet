# Security

## Authentication

- authentication is JWT-based for both REST and Socket.IO
- tokens are signed with `JWT_SECRET`
- tokens expire after 24 hours
- the current client stores the token in `localStorage`
- passwords are hashed with bcrypt using 12 rounds

`localStorage` is a deliberate tradeoff here for a game-oriented SPA, not the highest-security option. Near-term roadmap work includes reevaluating the auth/session model around proper email-backed auth and potentially Supabase Auth/OAuth for production.

## Authorization

- REST routes use `authMiddleware` and require a Bearer token
- Socket.IO connections must provide `auth.token` during the handshake
- gameplay actions are always checked against the server-side player assignment for the active game
- lobby actions are role-checked; only hosts can start games or send lobby invites

## Validation

- auth, profile, and friend REST payloads are validated with Zod
- Socket.IO payloads are validated with Zod before handlers act on them
- gameplay actions are validated twice: payload schema first, then game-rule legality in the shared engine

## Rate Limiting

- auth endpoints: 20 requests per 15 minutes per IP
- general API traffic: 100 requests per minute per IP
- socket traffic: 30 events per 5 seconds per socket

When the socket limit is exceeded, the server emits `GAME_ERROR` rather than processing the event.

## Server-Authoritative Gameplay

The client only sends intent. The server decides outcome.

- rolls are generated on the server via `crypto.randomInt`
- legal moves are recomputed on the server for each submitted move
- illegal or out-of-turn actions are rejected
- reconnecting clients are resynchronized from server state
- timers, auto-rolls, auto-moves, and disconnect forfeits are enforced server-side

## Transport And Headers

- Express uses `helmet`
- CORS is restricted to `CLIENT_URL`
- Socket.IO uses the same origin restriction

The current `/health` endpoint is intentionally lightweight and does not expose internal state.

## Data Handling

- secrets come from environment variables
- Prisma persists users, friendships, games, and denormalized stats in PostgreSQL
- completed games are stored in the database
- active games remain in memory until completion or cleanup
- lobby codes are generated with a restricted random character set to avoid ambiguous characters

## Current Security Limitations

- JWTs in `localStorage` remain vulnerable to XSS if the client is compromised
- active game state is in memory, so restart recovery is limited
- there is no CAPTCHA, email verification, password reset, or account lockout layer
- there is no external anomaly monitoring or audit trail yet
- the repo does not yet have a finalized production auth provider or OAuth story

## Production Recommendations

1. Use a strong `JWT_SECRET` with at least 32 random characters.
2. Serve the app only over HTTPS.
3. If moving away from `localStorage`, prefer HttpOnly secure cookies with explicit `sameSite` policy.
4. If adopting Supabase Auth or another hosted auth layer, document which flows remain first-party and which are delegated.
5. Tighten CSP for the final deployment origin rather than relying only on defaults.
6. Use pooled and direct Postgres URLs intentionally when deploying behind a managed database platform.
7. Add external monitoring for auth abuse, repeated socket throttling, and unhandled exceptions.
