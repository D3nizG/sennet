# Security

## Authentication

- **JWT-based auth** chosen over sessions for statelessness and natural Socket.IO integration.
  - JWT tokens are signed with a server-side secret (`JWT_SECRET` env var).
  - Tokens expire after 24 hours.
  - Stored in `localStorage` on the client (acceptable for game apps; HttpOnly cookies are an option for higher-security deployments).
- **Password hashing**: bcrypt with 12 rounds.

## Authorization

- **HTTP routes** protected by `authMiddleware` which verifies the JWT Bearer token.
- **Socket.IO connections** authenticated via handshake `auth.token`. Invalid tokens reject the connection.
- **Game rooms**: Only players assigned to a game can emit events (roll, move, resign) for that game. The server validates `userId` against `game.players` on every action.
- **Lobby rooms**: Only the host can start or invite. Guests can only join open lobbies.

## Input Validation

- All HTTP request bodies validated with **Zod schemas** (auth, profile updates, friend requests).
- All Socket.IO event payloads validated with Zod schemas before processing.
- Strict schema validation (`.strict()`) prevents extra fields.

## Rate Limiting

- **Auth endpoints** (register, login): 20 requests per 15 minutes per IP via `express-rate-limit`.
- **API endpoints**: 100 requests per minute per IP.
- **Socket events**: Custom per-socket rate limiter — max 30 events per 5 seconds. Excess events receive a `GAME_ERROR` response.

## Server-Authoritative Gameplay

The server is the **single source of truth** for all game state:

- **Rolls**: Generated server-side using `crypto.randomBytes` (cryptographically secure). The client never provides roll values.
- **Move validation**: The server re-computes `getLegalMoves()` on every `GAME_MOVE` event and rejects any move not in the legal set.
- **No client trust**: The client sends only intents (`GAME_ROLL`, `GAME_MOVE { pieceId, toSquare }`). The server generates outcomes.

## Transport Security

- **Helmet** enabled on Express for HTTP security headers (CSP, HSTS, X-Frame-Options, etc.).
- **CORS** restricted to the configured `CLIENT_URL` origin only.
- Socket.IO configured with the same CORS origin restriction.

## Data Protection

- **Secrets** loaded from environment variables, never hardcoded.
- **Password hashes** stored with bcrypt; raw passwords never persisted.
- **Game room IDs** are random UUIDs — not enumerable or guessable.
- **Lobby codes** use cryptographically random characters, excluding ambiguous chars.

## Recommendations for Production

1. Set a strong, unique `JWT_SECRET` (min 32 random characters).
2. Enable HTTPS via a reverse proxy (nginx, Caddy).
3. Set `secure` and `sameSite` flags on any cookies if switching from localStorage.
4. Configure proper CSP headers for the specific deployment domain.
5. Add request logging and anomaly detection.
6. Consider adding CAPTCHA to registration if abuse occurs.
7. Migrate from SQLite to PostgreSQL for concurrent production workloads.
