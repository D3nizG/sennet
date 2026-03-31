# Senet Rules

The implementation in this repo follows the detailed rules reference in [`sennet-core-logic.md`](./sennet-core-logic.md). That document is the long-form rules source used to keep the engine and docs aligned.

## Quick Reference

| Rule | Summary |
| --- | --- |
| Board | 30 squares in a 3x10 snake layout |
| Faceoff | Both players roll until one exclusively rolls `1`; that player starts |
| Starting layout | After faceoff, the starter occupies odd indices `1,3,5,7,9`; the other player occupies `0,2,4,6,8` |
| Roll outcomes | `1/4/5`: move and earn another roll; `2/3`: move and end turn; `6`: no move and roll again |
| Capture | Landing on a lone opposing piece swaps positions |
| Protection | Two contiguous same-owner pieces in the same row cannot be captured |
| Blockade | Three contiguous same-owner pieces in the same row block movement through or onto that line |
| Forced backward | If no forward move exists, backward moves become mandatory |
| Blocked turn | If no legal move exists at all, the turn is skipped |
| Special square 13 | House of Netting, ends the turn immediately |
| Special squares 14 and 25 | grant one extra roll |
| Special square 26 | Waters of Chaos, washes the moved piece back and ends the turn |
| Safe squares 27 to 29 | cannot be captured |
| Bearing off | exact roll to the virtual square `30`, only from the final row |
| Victory | first player to bear off all five pieces wins |

## Multiplayer Runtime Rules

These are gameplay behaviors enforced by the server for multiplayer sessions:

- 5 second roll timer
- 13 second move timer
- 15 second disconnect grace period
- random legal auto-move on move timeout
- automatic loss after three consecutive move timeouts

## Implementation Notes

- rules and state transitions live in `packages/game-engine/src/engine.ts`
- legal move generation lives in `packages/game-engine/src/moves.ts`
- board geometry, protection, and blockade checks live in `packages/game-engine/src/board.ts`
