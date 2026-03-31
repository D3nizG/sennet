# Architecture

## Overview

Sennet is organized as three npm workspaces:

```text
@sennet/game-engine  -> shared rules, AI, and event contracts
sennet-server        -> authoritative runtime, persistence, and realtime transport
sennet-client        -> React SPA for auth, lobby, gameplay, and profile UI
```

The game engine is shared across client and server, but only the server advances authoritative state.

## Core Runtime Model

### Shared `GameState`

The shared engine models gameplay with a fully serializable state object:

```ts
interface GameState {
  id: string;
  phase: 'initial_roll' | 'playing' | 'finished';
  pieces: PieceState[];
  currentPlayer: PlayerId;
  turnPhase: 'roll' | 'move';
  currentRoll: number | null;
  turnNumber: number;
  moveLog: MoveLogEntry[];
  winner: PlayerId | null;
  extraRolls: number;
  initialRolls: InitialRollState;
}
```

The server wraps this with additional runtime-only metadata in `ActiveGame`, including:

- player socket mappings
- AI metadata
- move and roll deadlines
- faceoff round state
- reconnect/timeout bookkeeping

### Shared Game Engine

`packages/game-engine/` exposes the gameplay primitives used throughout the repo:

| API | Purpose |
| --- | --- |
| `initGame(id)` | create an empty game in `initial_roll` phase |
| `performInitialRoll(state, p1Roll, p2Roll)` | resolve a faceoff round and place pieces when decided |
| `applyRoll(state, rollValue)` | apply a server-generated roll |
| `applyMove(state, move)` | apply a validated move and special-square effects |
| `getLegalMoves(state, playerId, rollValue)` | compute legal forward moves or forced backward moves |
| `checkWinner(state)` | detect full bear-off completion |
| `getAIMove(state, playerId, rollValue, difficulty)` | choose an AI move |

Important design point: the client may use shared helpers for display logic, but the server is the only process allowed to mutate game state.

## Server Architecture

### HTTP Layer

`server/src/app.ts` wires:

- `helmet`
- CORS restricted to `CLIENT_URL`
- JSON parsing
- API rate limiting
- `GET /health`
- authenticated REST routes under `/api/auth`, `/api/profile`, and `/api/friends`

### Realtime Layer

`server/src/socket/index.ts` sets up Socket.IO with:

- JWT auth during the handshake
- per-socket rate limiting
- reconnect restoration for active games
- registration of queue, lobby, and gameplay handlers

### Services

- `GameManager`: creates games, keeps active games in memory, persists finished games and stats, and maps users to current games
- `TurnRunner`: orchestrates faceoff, timers, auto-roll, auto-play, AI pacing, resign/timeout/disconnect handling, and state emission
- `QueueManager`: maintains the quick-match FIFO queue
- `LobbyManager`: maintains private lobbies and lobby membership

### Persistence

The server uses Prisma against PostgreSQL. Current models:

- `User`
- `UserStats`
- `Game`
- `Friendship`

The app persists completed game records and profile statistics. Active multiplayer runtime state still lives in memory, which means horizontal scaling and crash recovery are not solved yet.

## Client Architecture

### Providers

The client bootstraps in `client/src/main.tsx` with:

- `AuthProvider`: stores JWT and user profile in `localStorage`
- `SocketProvider`: manages a singleton Socket.IO client
- `GameProvider`: owns current game session state and event subscriptions

### Routes

- `/`: lobby, quick match, AI launch, private lobby, friends
- `/game`: active game UI, faceoff, board, timers, move log, chat
- `/profile`: profile editing, stats, recent games

### UI Composition

Key modules:

- `Board.tsx`: renders the 3x10 snake board and selectable pieces/squares
- `GameView.tsx`: drives faceoff, timers, roll action, move flow, chat, and end-of-game actions
- `LobbyView.tsx`: handles queueing, lobby management, invites, AI launches, and friend actions
- `ProfileView.tsx`: reads and edits profile metadata and renders stats/history

## Event Flow

### Faceoff

1. Server creates a game in `initial_roll`.
2. Multiplayer players each emit `GAME_ROLL` during the faceoff round.
3. `TurnRunner` records or auto-rolls missing faceoff values after 5 seconds.
4. Server emits `GAME_INITIAL_ROLL`.
5. When one player exclusively rolls `1`, the engine places pieces and the server transitions to `playing`.

### Normal Turn

1. Active player emits `GAME_ROLL`.
2. Server generates the roll securely.
3. Engine resolves roll consequences.
4. Server emits `GAME_ROLL_RESULT` and then `GAME_STATE`.
5. Client selects a legal move and emits `GAME_MOVE`.
6. Server validates against the engine’s legal move set, applies the move, emits `GAME_MOVE_APPLIED`, and broadcasts the next `GAME_STATE`.

### Recovery And Enforcement

- reconnecting players get a player-specific `GAME_STATE`
- if a player reconnects during move selection, the server replays `GAME_ROLL_RESULT` first so legal moves can be restored
- multiplayer roll timer: 5 seconds
- multiplayer move timer: 13 seconds
- disconnect grace window: 15 seconds
- three consecutive move timeouts cause an automatic loss

## Socket Contract

Shared event payloads live in `packages/game-engine/src/events.ts`.

Client to server:

- `QUEUE_JOIN`
- `QUEUE_LEAVE`
- `LOBBY_CREATE`
- `LOBBY_JOIN`
- `LOBBY_INVITE`
- `LOBBY_START`
- `GAME_ROLL`
- `GAME_MOVE`
- `GAME_RESIGN`
- `GAME_REJOIN`
- `GAME_LEAVE`
- `START_AI_GAME`
- `GAME_CHAT`

Server to client:

- `QUEUE_MATCHED`
- `LOBBY_UPDATE`
- `GAME_STATE`
- `GAME_INITIAL_ROLL`
- `GAME_ROLL_RESULT`
- `GAME_MOVE_APPLIED`
- `GAME_ERROR`
- `GAME_OVER`
- `FRIENDS_UPDATED`
- `LOBBY_INVITE_RECEIVED`
- `GAME_CHAT`

## Testing Shape

- engine tests cover rules, board helpers, AI, and RNG behavior
- server tests cover route registration, auth, queue/lobby managers, game manager, turn runner, AI orchestration, socket payload validation, and integration flow
- client automation is still absent

See [`TESTING.md`](./TESTING.md) for the command matrix and current gaps.
