# Testing Guide

## Scope

The repository uses Vitest for unit and integration testing across:

- `packages/game-engine` (pure rules engine)
- `server` (services, middleware, socket payload validation, integration flow)

The client currently has no dedicated automated test suite in this repository.

## Commands

From repository root:

```bash
npm test
```

Target individual workspaces:

```bash
npm run test:engine
npm run test:server
```

Direct workspace runs:

```bash
npm run test -w @sennet/game-engine
npm run test -w server
```

## Coverage Reporting

Vitest coverage requires `@vitest/coverage-v8`.

Install:

```bash
npm i -D @vitest/coverage-v8
```

Run with coverage:

```bash
npm run test -w @sennet/game-engine -- --coverage
npm run test -w server -- --coverage
```

## Current Test Surface

### Game Engine (`packages/game-engine/src/__tests__`)

- `engine.test.ts`: game lifecycle, turn flow, special squares, winner checks
- `moves.test.ts`: legal move generation, captures, blockades, forced backward moves
- `board.test.ts`: board mapping, adjacency/protection/blockade/path helpers, coordinate mapping
- `rolls.test.ts`: seeded RNG determinism and roll metadata
- `types.test.ts`: row/opponent/roll helper utilities
- `ai.test.ts`: AI move selection across easy/medium/hard and edge cases

### Server (`server/src/__tests__`)

- `game.test.ts`: server integration flow with shared engine
- `turnRunner.test.ts`: faceoff, timeout, roll, move, resign orchestration
- `gameManager.test.ts`: game creation, roll/move delegation, persistence and cleanup behavior
- `aiPlayer.test.ts`: AI turn loop actions (roll, blocked, move, game-over)
- `queueManager.test.ts`: queue membership and matching behavior
- `lobbyManager.test.ts`: lobby lifecycle and mapping cleanup
- `auth.test.ts`: token creation/verification and auth middleware behavior
- `socketEvents.test.ts`: zod validation of client->server event payloads
- `rng.test.ts`: secure roll and lobby code generation constraints
- `app.test.ts`: app route/middleware registration sanity checks

## CI Recommendation

Use the root `npm test` command in CI and add coverage gates after enabling `@vitest/coverage-v8`.
