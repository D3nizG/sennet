# Sound effects

Files here must match the paths in `client/src/audio/cues.ts` exactly. A missing
file degrades to silence with a console warning — the game still works.

Both `.mp3` and `.wav` are fine; if you change a file's extension, update
`cues.ts` to match.

| Path | When it plays | Length |
|---|---|---|
| `ui/primary.wav` | Main call-to-action buttons (ParchmentButton) | 0.33s |
| `ui/secondary.wav` | Standard + icon buttons (EgyptianButton, EgyptianIconButton) | 0.46s |
| `game/dice-roll.mp3` | Throwing the sticks (any roll: manual, auto, AI, faceoff) | 0.67s |
| `game/piece-place.wav` | Placing a piece on a square | 1.10s |
| `game/piece-capture.wav` | Landing on an opponent's piece (swap) | 0.28s |
| `game/bear-off.mp3` | A piece exits the board | 7.54s ⚠️ |
| `game/blocked.mp3` | Rolled but no legal move — turn skipped | 4.86s ⚠️ |
| `tiles/bonus.mp3` | Landed on either bonus square (14 or 25) | 5.72s ⚠️ |
| `tiles/bad-netting.mp3` | Landed on House of Netting (sq 13) | 0.99s |
| `tiles/bad-chaos.mp3` | Landed on Waters of Chaos (sq 26) | 2.47s |
| `flow/match-found.mp3` | Opponent found (alert tone) | 1.44s |
| `flow/game-start.mp3` | Faceoff resolved, board goes live | 0.65s |
| `flow/game-end-win.mp3` | You won | 3.55s |
| `flow/game-end-lose.mp3` | You lost | 8.31s |
| `flow/turn-switch.mp3` | Turn passes — fires every turn | 1.46s |
| `flow/clock-tick.wav` | Final 3 seconds of your own countdown | 3.50s |
| `chat/send.mp3` | You sent a message | 1.07s |
| `chat/receive.mp3` | You received a message | 2.77s |

Source files live in `reference_sounds/` at the repo root; this directory is the
deployed copy.

`clock-tick.wav` is a continuous ticking bed. The code starts it when the
countdown enters its last 3 seconds and stops it on the way out — it is never
played to completion, so its length only needs to cover the window.

## ⚠️ Trim candidates

- **`bear-off.mp3` (7.5s), `blocked.mp3` (4.9s), `bonus.mp3` (5.7s)** — these
  fire mid-turn and will still be playing while the next action happens. Bear-off
  in particular can fire several times in a row late in a game and will overlap
  itself.
The Roll button deliberately has no click cue (`soundCue={null}` in
`GameActionArea.tsx`) — the throw itself is the sound.

Per-cue volume lives in `cues.ts` (`gain`, 0–1) if a sound is just too loud
rather than too long.

`music/` is empty — background music is deferred. When added, route it through a
`MediaElementAudioSourceNode` on the `music` bus rather than decoding it into an
`AudioBuffer`.
