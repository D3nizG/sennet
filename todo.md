# TODO

## Cleanup

- [ ] remove temporary client debug logging from `client/src/components/Game/GameView.tsx`
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
- [ ] add end-to-end coverage for sign-in, direct `/game` refresh, reconnect, chat, timers, and rematch flow

## Auth And Security

- [ ] choose the production auth direction: in-house email auth vs Supabase Auth/OAuth
- [ ] add proper email-backed auth with verification/reset flows
- [ ] harden token/session storage for production and document the final threat-model tradeoff
- [ ] add error monitoring and uptime checks once the production auth/deploy path is stable

## UX And Audio

- [ ] add a how-to-play section that explains faceoff, special squares, captures, and bear-off
- [ ] move bonus rolls into the top HUD and show the opponent's bonus-roll count too
- [ ] keep the faceoff/roll panel at a stable size and scroll internally instead of resizing the layout
- [ ] stop hiding the roll UI while faceoff rounds are resolving
- [ ] add sound effects for bonuses, traps, bear-off, swaps, win/loss, turn start/end, and low-time ticking
- [ ] add optional background music with mute/toggle controls
- [ ] animate normal piece moves with a short slide/fade from old square to new square
- [ ] animate swaps with both pieces traveling in straight lines and the moving piece visibly passing on top

## Match Flow

- [ ] replace the current play-again hop with a rematch button against the same opponent
- [ ] add opponent presence/availability feedback for rematch actions
- [ ] decide whether rematch should reuse the finished game surface or transition through a lighter post-game state

## Later Product Work

- [ ] leaderboard
- [ ] replay/history endpoint and viewer
- [ ] spectator mode
- [ ] mobile/PWA polish
- [ ] board and special-square animation polish

## Completed Recently

- [x] in-game chat
- [x] live friend-list refresh after friend changes
- [x] friend removal
- [x] friend invites into lobbies
- [x] live opponent color sync after profile updates/reconnect
- [x] multiplayer post-game auto-queue flow
- [x] reconnect grace timer
- [x] preset profile color swatches
- [x] server logging through `pino`
- [x] CI workflow
