Description: Use this skill for game engine logic, initial board setup, and movement validation.

1. Board Geometry & Layout
The board is a 3x10 grid (30 squares total) navigated in a "snake" pattern.

Row 1 (Indices 0-9): Left to Right.

Row 2 (Indices 10-19): Right to Left.

Row 3 (Indices 20-29): Left to Right.

2. Initial Setup (The Alternating Start)
Pieces are placed on the first row (Indices 0-9) in alternating order:

Player 1 (Starter): Occupies Even numbers / Odd indices (1, 3, 5, 7, 9).

Player 2: Occupies Odd numbers / Even indices (0, 2, 4, 6, 8).

Note: The player who rolls a "1" first in the pre-game roll-off becomes Player 1 and takes the even-numbered squares.

3. Absolute Safety Rules
Safety is binary in this game. There is no "partially safe" status.

The ONLY Safe Squares: 27, 28, and 29. Pieces here cannot be captured or swapped.

Combat Zone: All other squares (0-26), including special squares like 14 and 25, are unsafe. Pieces here can be swapped/eaten unless protected by a Row-Blockade.

4. Movement & The "Dice"
1, 4, 5: Move and Roll Again.

2, 3: Move and end turn.

6: No movement; simply roll again.

The Row-Break Rule: Protection (2 pieces) or Blockades (3+ pieces) only function if the pieces are on the same horizontal row. Row transitions (9 to 10 and 19 to 20) offer zero protection.

5. Special Squares & Penalties
13 (House of Netting): Ends turn immediately. All bonuses/rerolls lost.

14 & 25 (Bonus Squares): Grant +1 extra roll. These are not safe; you can be eaten off these squares.

26 (Waters of Chaos): Piece resets to 13. If 13 is occupied, it resets to 0. If 0 is occupied, it takes the next available square (1, 2, 3...). Turn ends immediately.

6. Forced Moves & Winning
Mandatory Moves: If no forward move is possible, you must move backward.

Jail (Blocked): If no forward or backward move exists, the turn is skipped (Trigger "Jail Cell" UI).

Bearing Off: Pieces can exit the board from the final row (20-29) individually with an exact roll to reach "Square 30".