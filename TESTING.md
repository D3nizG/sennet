# Testing Guide

## Scope

The repo currently has automated tests for:

- `packages/game-engine`: pure gameplay rules and helpers
- `server`: route wiring, services, orchestration, validation, and integration behavior

The client currently has no automated test suite.

## Commands

Run the full automated suite from the repo root:

```bash
npm test
```

Run individual workspace suites:

```bash
npm run test:engine
npm run test:server
```

Or call the workspace scripts directly:

```bash
npm run test -w @sennet/game-engine
npm run test -w server
```

## What CI Runs

The GitHub Actions workflow at `.github/workflows/ci.yml` currently does the following:

1. installs dependencies
2. builds the shared game engine
3. type-checks server and client
4. runs `npm test`
5. builds server and client

The current workflow does not run any client-specific test suite because none exists yet.

## Coverage Reporting

If you want coverage locally, add Vitest's V8 coverage package:

```bash
npm i -D @vitest/coverage-v8
```

Then run coverage per workspace:

```bash
npm run test -w @sennet/game-engine -- --coverage
npm run test -w server -- --coverage
```

## Current Test Surface

### Game Engine

`packages/game-engine/src/__tests__/`

- `engine.test.ts`: game lifecycle, turn flow, special squares, and winner checks
- `moves.test.ts`: legal move generation, captures, blockades, and forced backward moves
- `board.test.ts`: board mapping, adjacency, protection, blockade, and path helpers
- `rolls.test.ts`: seeded RNG determinism and roll metadata
- `types.test.ts`: helper utilities and constants
- `ai.test.ts`: AI move selection behavior

### Server

`server/src/__tests__/`

- `app.test.ts`: app route and middleware registration
- `auth.test.ts`: token and auth middleware behavior
- `game.test.ts`: integration flow around the shared engine
- `gameManager.test.ts`: game creation, persistence, reconnect, and cleanup behavior
- `turnRunner.test.ts`: faceoff, timers, resign, timeout, and orchestration behavior
- `aiPlayer.test.ts`: AI turn sequencing
- `queueManager.test.ts`: queue membership and matching
- `lobbyManager.test.ts`: lobby lifecycle and membership cleanup
- `socketEvents.test.ts`: socket payload validation
- `rng.test.ts`: secure roll and lobby code generation

## Known Gap

The biggest testing gap is still the client:

- no component tests
- no provider tests
- no lobby/game flow tests
- no reconnect/timer UI coverage

That gap is intentionally tracked in [`todo.md`](./todo.md) and [`ROADMAP.md`](./ROADMAP.md).
