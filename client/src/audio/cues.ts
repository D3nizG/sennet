export type SoundBus = 'sfx' | 'music';

export type PreloadGroup = 'ui' | 'game';

export interface CueDef {
  path: string;
  gain: number;
  bus: SoundBus;
  group: PreloadGroup;
}

export const CUES = {
  'ui-primary':       { path: '/sfx/ui/primary.wav',            gain: 0.7,  bus: 'sfx', group: 'ui' },
  'ui-secondary':     { path: '/sfx/ui/secondary.wav',          gain: 0.6,  bus: 'sfx', group: 'ui' },

  'dice-roll':        { path: '/sfx/game/dice-roll.mp3',        gain: 0.9,  bus: 'sfx', group: 'game' },
  'piece-place':      { path: '/sfx/game/piece-place.wav',      gain: 0.8,  bus: 'sfx', group: 'game' },
  'piece-capture':    { path: '/sfx/game/piece-capture.wav',    gain: 0.9,  bus: 'sfx', group: 'game' },
  'bear-off':         { path: '/sfx/game/bear-off.mp3',         gain: 0.9,  bus: 'sfx', group: 'game' },
  'blocked':          { path: '/sfx/game/blocked.mp3',          gain: 0.7,  bus: 'sfx', group: 'game' },

  'bonus':            { path: '/sfx/tiles/bonus.mp3',           gain: 0.85, bus: 'sfx', group: 'game' },
  'bad-netting':      { path: '/sfx/tiles/bad-netting.mp3',     gain: 0.85, bus: 'sfx', group: 'game' },
  'bad-chaos':        { path: '/sfx/tiles/bad-chaos.mp3',       gain: 0.85, bus: 'sfx', group: 'game' },

  'match-found':      { path: '/sfx/flow/match-found.mp3',      gain: 0.9,  bus: 'sfx', group: 'game' },
  'game-start':       { path: '/sfx/flow/game-start.mp3',       gain: 0.9,  bus: 'sfx', group: 'game' },
  'game-end-win':     { path: '/sfx/flow/game-end-win.mp3',     gain: 1.0,  bus: 'sfx', group: 'game' },
  'game-end-lose':    { path: '/sfx/flow/game-end-lose.mp3',    gain: 0.9,  bus: 'sfx', group: 'game' },
  'turn-switch':      { path: '/sfx/flow/turn-switch.mp3',      gain: 0.6,  bus: 'sfx', group: 'game' },
  // A continuous ticking bed, not a single tick — started once when the
  // countdown enters its final seconds and stopped when it leaves.
  'clock-tick':       { path: '/sfx/flow/clock-tick.wav',       gain: 0.7,  bus: 'sfx', group: 'game' },

  'chat-send':        { path: '/sfx/chat/send.mp3',             gain: 0.5,  bus: 'sfx', group: 'game' },
  'chat-receive':     { path: '/sfx/chat/receive.mp3',          gain: 0.6,  bus: 'sfx', group: 'game' },
} as const satisfies Record<string, CueDef>;

export type CueName = keyof typeof CUES;
