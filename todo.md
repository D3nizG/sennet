Visual Changes:
- [x] does not render the opponent's chosen color — fixed: preserve opponentColor across GAME_STATE updates
- [x] allows users to choose any rgb — replaced with 10 preset color swatches (R/O/Y/G/B/Purple/Cyan/Black/White/Silver)
- [x] reloading /game shows empty background — fixed: show "Connecting..." while socket connects
- (FUTURE) animations for house of netting, bonus, waters of chaos, and being borne off.

Performance Changes:
- [x] reloading the game gives an instant resign — fixed: 15s disconnect grace timer in TurnRunner

Logic Changes:
- [x] allow users to chat to each other in game — GAME_CHAT socket event, server handler + client UI
- [x] add "rematch" || "new game" option on game finish screen — "Play Again" button auto-queues
- friends:
    - [x] cannot delete friends once added — DELETE /friends/:id endpoint + trash button in UI
    - [x] users should have the option to invite a friend to a game — invite (+) button in friends list creates lobby + invites

Remaining (Phase 1+):
- structured logging (replace console.log with pino)
- CI/CD: GitHub Actions workflow
- Deploy: Railway (server) + Vercel (client) + sennet.d3n1zg.dev
