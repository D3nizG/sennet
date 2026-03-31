# TODO

## Cleanup

- [ ] remove temporary client debug logging from `client/src/context/GameContext.tsx`
- [ ] remove temporary client debug logging from `client/src/components/Lobby/LobbyView.tsx`
- [ ] remove temporary client debug logging from `client/src/services/socket.ts`
- [ ] remove the stray `ToDO.txt` line in `.gitignore`
- [ ] either add `server/prisma/seed.ts` or remove the stale `db:seed` script from `server/package.json`
- [ ] keep repo docs aligned with implementation changes so setup, infra, and feature status do not drift again
- [ ] review environment examples whenever runtime config changes so `.env.example` stays production-relevant
- [ ] keep rules/reference docs synchronized with the shared engine so malformed or non-repo content does not get committed again

## Correctness

- [ ] fix the `bestStreak` update path in `server/src/services/gameManager.ts` so it does not rely on a second read/write cycle
- [ ] review the test database story after the Postgres migration so docs, CI, and local setup stay consistent
- [ ] decide whether active games need persistence or recovery beyond the current in-memory `GameManager`

## Testing

- [ ] add client tests for auth, socket, and game providers
- [ ] add client tests for lobby flow, reconnect flow, and timer rendering
- [ ] add client tests for chat and game-over rematch behavior

## Deployment And Ops

- [ ] choose and document the production hosting target
- [ ] add deployment config for server and client
- [ ] document pooled vs direct Postgres URLs for production
- [ ] add error monitoring and uptime checks

## Later Product Work

- [ ] leaderboard
- [ ] replay/history endpoint and viewer
- [ ] spectator mode
- [ ] mobile/PWA polish
- [ ] board and special-square animation polish

## Completed Recently

- [x] in-game chat
- [x] friend removal
- [x] friend invites into lobbies
- [x] multiplayer post-game auto-queue flow
- [x] reconnect grace timer
- [x] preset profile color swatches
- [x] server logging through `pino`
- [x] CI workflow
