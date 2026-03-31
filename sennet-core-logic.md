# Sennet Core Logic

This document is the long-form rules reference for the implementation in `packages/game-engine/`.

## 1. Board Geometry

The board has 30 playable squares indexed `0` through `29`.

- row 1: `0` to `9`, left to right
- row 2: `10` to `19`, right to left when rendered
- row 3: `20` to `29`, left to right

Movement follows the square index order rather than screen direction.

## 2. Faceoff And Initial Placement

Games start in an `initial_roll` phase with an empty board.

- both players roll simultaneously
- the first player to roll an exclusive `1` wins the faceoff
- ties and non-winning rounds repeat until the faceoff is decided

When the faceoff is decided:

- the winner becomes the opening player
- the winner's pieces are placed on odd starting indices: `1, 3, 5, 7, 9`
- the other player's pieces are placed on even starting indices: `0, 2, 4, 6, 8`

The starter may be either `player1` or `player2`; the faceoff winner gets the odd indices regardless of label.

## 3. Roll Rules

The game uses integer roll values from `1` to `6`.

- `1`, `4`, `5`: the player moves, then earns another roll
- `2`, `3`: the player moves, then the turn ends
- `6`: no movement occurs and the same player rolls again

The server generates all rolls.

## 4. Legal Movement

Each player controls five pieces.

- forward movement is attempted first
- if no forward move is legal, backward movement becomes mandatory
- if no forward or backward move exists, the turn is blocked and skipped
- a piece may not land on a square already occupied by a friendly piece
- bearing off requires an exact move to the virtual exit square `30`

## 5. Capture, Protection, And Blockades

### Capture

Landing on a lone opposing piece captures by swapping positions with that piece.

### Protection

Two contiguous pieces owned by the same player in the same row are protected. A protected piece cannot be captured.

### Blockade

Three or more contiguous same-owner pieces in the same row form a blockade.

A blockade blocks movement:

- through the blocked squares
- onto the blocked squares
- across the path to bear off

### Row Break Rule

Adjacency only counts inside a row.

- `9` and `10` are not adjacent for protection or blockade purposes
- `19` and `20` are not adjacent for protection or blockade purposes

## 6. Safe And Special Squares

### Safe Squares

Squares `27`, `28`, and `29` are safe. Pieces on those squares cannot be captured.

### House of Netting

Square `13` ends the turn immediately and clears any accumulated extra rolls.

### Bonus Squares

Squares `14` and `25` each grant one extra roll when landed on.

These squares are not safe.

### Waters of Chaos

Square `26` washes the moved piece backward and ends the turn immediately.

The relocation order is:

1. square `13`
2. square `0` if `13` is occupied
3. the next free square starting from `1` and scanning upward, wrapping if needed

## 7. Bearing Off And Victory

- a piece may bear off only from the final row
- the roll must land the piece exactly on the virtual square `30`
- the first player to bear off all five pieces wins

## 8. Multiplayer Runtime Rules

These behaviors are enforced by the server in multiplayer games:

- 5 second timer to click roll
- 13 second timer to choose a move once legal moves are available
- automatic roll if the player does not roll in time
- automatic random legal move if the player does not move in time
- automatic loss after three consecutive move timeouts
- 15 second disconnect grace window before disconnect forfeit

AI games use the same rules engine but do not run the human multiplayer timer model.

## 9. Source Mapping

Implementation references:

- `packages/game-engine/src/engine.ts`
- `packages/game-engine/src/moves.ts`
- `packages/game-engine/src/board.ts`
- `packages/game-engine/src/types.ts`
- `server/src/services/turnRunner.ts`
