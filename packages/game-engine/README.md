# @sennet/game-engine

Shared, pure Senet rules engine used by both server and client.

## Responsibilities

- Authoritative game state transitions
- Legal move generation (forward and forced-backward)
- Special-square effects (13/14/25/26/27-29)
- Piece protection and blockade logic
- AI move selection (easy/medium/hard)
- Shared Socket.IO event type contracts

## Public API

- `initGame(gameId)`
- `performInitialRoll(state, p1Roll, p2Roll)`
- `applyRoll(state, rollValue)`
- `applyMove(state, move)`
- `getLegalMoves(state, playerId, rollValue)`
- `checkWinner(state)`
- `getAIMove(state, playerId, rollValue, difficulty)`

## Development

```bash
npm run build -w @sennet/game-engine
npm run test -w @sennet/game-engine
```

## Source Layout

- `src/types.ts`: canonical type model and constants
- `src/board.ts`: board geometry and path/protection checks
- `src/moves.ts`: legal move generation
- `src/engine.ts`: state machine transitions
- `src/rolls.ts`: seeded deterministic RNG utilities
- `src/ai.ts`: scoring-based AI selector
- `src/events.ts`: typed client/server event payloads
