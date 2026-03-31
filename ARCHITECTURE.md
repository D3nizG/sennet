# Architecture

## Overview

Sennet is a monorepo with three packages connected via npm workspaces:

```
@sennet/game-engine  →  shared pure logic
sennet-server        →  authoritative server
sennet-client        →  React SPA
```

## Single Source of Truth

The game engine (`packages/game-engine`) contains all Senet rules as pure functions over an immutable `GameState` type. Both server and client import this package, but **only the server may advance game state**. The client uses the engine solely for rendering helpers (e.g., highlighting legal moves locally before the server responds).

## Game Engine API

| Function | Purpose |
|----------|---------|
| `initGame(id)` | Creates a new game in `initial_roll` phase with an empty board |
| `performInitialRoll(state, p1Roll, p2Roll)` | Simultaneous roll to determine first player and place pieces |
| `applyRoll(state, rollValue)` | Applies a roll: enters move phase, or skips turn if blocked |
| `applyMove(state, move)` | Applies a validated move, handles captures, specials, bearing off |
| `getLegalMoves(state, playerId, rollValue)` | Returns all legal forward moves; if none, returns backward moves |
| `checkWinner(state)` | Returns winner if all 5 pieces borne off |
| `getAIMove(state, playerId, rollValue, difficulty)` | AI pick via heuristic scoring |

## State Model

```typescript
interface GameState {
  id: string;
  phase: 'initial_roll' | 'playing' | 'finished';
  pieces: PieceState[];          // 10 pieces total
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

State is fully serializable via `JSON.stringify` for Socket.IO transport and database persistence.

## Server Architecture

### Express + Socket.IO
- Express handles REST endpoints: auth, profile, friends
- Socket.IO handles realtime gameplay: queue, lobby, game events
- JWT authentication on both HTTP (Bearer header) and Socket.IO (handshake auth)

### Services
- **GameManager**: In-memory active game registry. Creates games, validates/applies moves, persists to DB on completion, handles reconnection.
- **QueueManager**: FIFO matchmaking queue. Auto-matches when 2+ players are queued.
- **LobbyManager**: Private match lobbies with shareable codes. Host can invite friends.
- **AI Player**: Runs the AI turn loop using the game engine + heuristic scoring.

### Database (SQLite + Prisma)
- `User` — credentials + display settings
- `UserStats` — denormalized statistics for fast reads
- `Game` — persisted game records with JSON state
- `Friendship` — bidirectional friend relationships

## Socket.IO Event Contract

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `QUEUE_JOIN` | — | Join matchmaking queue |
| `QUEUE_LEAVE` | — | Leave queue |
| `LOBBY_CREATE` | — | Create private lobby |
| `LOBBY_JOIN` | `{ lobbyCode }` | Join lobby by code |
| `LOBBY_INVITE` | `{ friendId }` | Invite friend to lobby |
| `LOBBY_START` | — | Host starts the lobby game |
| `GAME_ROLL` | — | Request dice roll |
| `GAME_MOVE` | `{ pieceId, toSquare }` | Submit move intent |
| `GAME_RESIGN` | — | Resign the game |
| `START_AI_GAME` | `{ difficulty }` | Start single-player game |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `QUEUE_MATCHED` | Match info | Players matched |
| `LOBBY_UPDATE` | Lobby state | Lobby changed |
| `GAME_STATE` | Full state snapshot | Sync/reconnect |
| `GAME_INITIAL_ROLL` | Roll results | Initial roll ceremony |
| `GAME_ROLL_RESULT` | Roll value + legal moves | After rolling |
| `GAME_MOVE_APPLIED` | Move + new state | After move |
| `GAME_ERROR` | Code + message | Error occurred |
| `GAME_OVER` | Winner + reason + state | Game finished |

## Client Architecture

### React SPA with Vite
- **AuthContext** manages JWT storage and user session
- **SocketContext** manages the Socket.IO connection lifecycle (auto-connect when authenticated)
- **useGame hook** aggregates all game-related socket events into a single reactive state object

### Routing
- `/` — Lobby (matchmaking, AI, private match, friends)
- `/game` — Active game board
- `/profile` — Player stats and settings

### Board Rendering
The board is a CSS Grid of 3 rows × 10 columns. Row 2 is displayed in reverse order (right-to-left) to create the snake layout. Square positions map: row 0 → squares 0–9 (L→R), row 1 → squares 19–10 (R→L), row 2 → squares 20–29 (L→R).

## Data Flow: Move Lifecycle

```
1. Player clicks "Roll Sticks"
2. Client emits GAME_ROLL
3. Server generates roll via crypto.randomBytes
4. Server calls applyRoll(state, rollValue)
5. If move phase: server computes getLegalMoves
6. Server emits GAME_ROLL_RESULT { value, legalMoves }
7. Client highlights legal destination squares
8. Player clicks piece + destination square
9. Client emits GAME_MOVE { pieceId, toSquare }
10. Server validates against getLegalMoves
11. Server calls applyMove(state, validatedMove)
12. Server emits GAME_MOVE_APPLIED { move, gameState }
13. Client updates board display
```

## Test Architecture

- `packages/game-engine/src/__tests__` covers pure rule computation modules (`engine`, `moves`, `board`, `rolls`, `types`, `ai`).
- `server/src/__tests__` covers orchestration and server concerns (`turnRunner`, `gameManager`, `aiPlayer`, queue/lobby managers, auth middleware, socket payload schemas, and app registration).
- Full command matrix and coverage instructions live in [`TESTING.md`](./TESTING.md).
