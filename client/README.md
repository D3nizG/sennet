# sennet-client

React + Vite frontend for Sennet gameplay, lobby flow, and profile management.

## Responsibilities

- Authentication UX and token/session handling
- Lobby, queue, and in-game interfaces
- Realtime Socket.IO event consumption and state rendering
- Local legal-move highlighting based on server-emitted game state

## Key Modules

- `src/context/AuthContext.tsx`: auth state and API session handling
- `src/context/SocketContext.tsx`: socket connection lifecycle
- `src/context/GameContext.tsx`: shared game state container
- `src/hooks/useGame.ts`: game event orchestration hook
- `src/components/Board/Board.tsx`: board rendering and interaction
- `src/components/Game/GameView.tsx`: game flow UI
- `src/components/Lobby/LobbyView.tsx`: matchmaking and private lobby UX

## Development

```bash
npm run dev -w client
npm run build -w client
```
