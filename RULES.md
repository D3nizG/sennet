# Senet Rules

This application implements the Senet ruleset defined in [`sennet-core-logic.md`](./sennet-core-logic.md).

That file is the **single source of truth** for all game rules. The game engine (`packages/game-engine/`) implements those rules directly.

## Quick Reference

| Rule | Summary |
|------|---------|
| Board | 3×10 snake layout, 30 squares (0–29) |
| Pieces | 5 per player, alternating on squares 0–9 |
| Rolls | 1–6; rolls 1/4/5 = move + roll again; 2/3 = move + end turn; 6 = no move, re-roll |
| First Player | Simultaneous rolls — first to exclusively roll 1 goes first |
| Capture | Landing on single opponent piece swaps positions |
| Protection | 2 adjacent same-color in same row = cannot capture (can jump over) |
| Blockade | 3 adjacent same-color in same row = blocks all movement (no jump, no land) |
| Row-Break | Adjacency for protection/blockade only within same row (9↔10 NOT adjacent) |
| Square 13 | House of Netting — trap, turn ends immediately |
| Square 14 | +1 extra roll |
| Square 25 | +1 extra roll |
| Square 26 | Waters of Chaos — piece washed to 13 (or 0, or next free), turn ends |
| Squares 27–29 | Safe — cannot be captured |
| Forced Backward | If no forward move exists, must move backward |
| Blocked Turn | If no move at all (forward or backward), turn is skipped |
| Bearing Off | Exact roll to reach square 30 from final row (20–29) |
| Winning | First player to bear off all 5 pieces wins |

## Implementation Notes

See `sennet-core-logic.md` for the authoritative rule text. The engine implements these rules in `moves.ts` (legal move calculation) and `engine.ts` (state transitions).
