# @sennet/game-engine

Shared TypeScript package for Senet rules, AI move selection, and the typed Socket.IO payload contract used by both client and server.

## Responsibilities

- canonical game state and constants
- faceoff resolution and initial piece placement
- legal move generation, including forced backward moves
- capture, protection, blockade, special-square, and bear-off rules
- heuristic AI move selection
- shared event payload types for the realtime protocol, including gameplay and live friend-state updates

## Main API

- `initGame(gameId)`
- `performInitialRoll(state, p1Roll, p2Roll)`
- `applyRoll(state, rollValue)`
- `applyMove(state, move)`
- `getLegalMoves(state, playerId, rollValue)`
- `checkWinner(state)`
- `getAIMove(state, playerId, rollValue, difficulty)`

## Source Layout

- `src/types.ts`: state model, constants, and helpers
- `src/board.ts`: board geometry, adjacency, protection, blockade, and path checks
- `src/moves.ts`: legal move generation
- `src/engine.ts`: roll and move state transitions
- `src/rolls.ts`: deterministic RNG helpers for tests and simulations
- `src/ai.ts`: AI scoring and move selection
- `src/events.ts`: shared realtime payload types

## Development

```bash
npm run build -w @sennet/game-engine
npm run test -w @sennet/game-engine
```
