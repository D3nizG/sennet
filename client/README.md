# sennet-client

React 19 + Vite frontend for authentication, lobby flow, active gameplay, chat, and player profile views.

## Responsibilities

- store and hydrate the authenticated user session
- open and maintain the Socket.IO connection
- render lobby, private lobby, AI launch, and friend-management flows
- render the active board, timers, move hints, chat, and end-of-game states
- render profile stats and recent game history

## Key Modules

- `src/context/AuthContext.tsx`: token and user state
- `src/context/SocketContext.tsx`: singleton socket lifecycle
- `src/context/GameContext.tsx`: shared game session state and socket subscriptions
- `src/components/Lobby/LobbyView.tsx`: quick match, AI, private lobbies, invites, and friends
- `src/components/Game/GameView.tsx`: faceoff, board interaction, timers, chat, and game-over flow
- `src/components/Board/Board.tsx`: board rendering and move target highlighting
- `src/components/Profile/ProfileView.tsx`: profile editing and stats/history display

## Routes

- `/`: lobby
- `/game`: active game
- `/profile`: profile

## Development

```bash
npm run dev -w client
npm run build -w client
```

The client expects the backend on `http://localhost:3001` during development and proxies `/api` plus `/socket.io` through Vite.

## Current Gap

There is still no dedicated automated client test suite in this workspace.
