import { CUES, type CueName, type PreloadGroup, type SoundBus } from './cues';

// Sounds are fire-and-forget side effects, so this is a module singleton rather
// than React state — nothing here should trigger a re-render.

const DEBOUNCE_MS = 50;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const busGains = new Map<SoundBus, GainNode>();

const buffers = new Map<CueName, AudioBuffer>();
const loading = new Map<CueName, Promise<AudioBuffer | null>>();
const failed = new Set<CueName>();
const lastPlayedAt = new Map<CueName, number>();

export interface SoundHandle {
  stop: () => void;
}

const NOOP_HANDLE: SoundHandle = { stop: () => {} };

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  for (const bus of ['sfx', 'music'] as const) {
    const g = ctx.createGain();
    g.connect(masterGain);
    busGains.set(bus, g);
  }

  return ctx;
}

// Browsers start the context suspended until a user gesture, and Safari
// re-suspends it when the tab is backgrounded.
function resume() {
  void getContext()?.resume().catch(() => {});
}

export function initAudio() {
  const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
  const unlock = () => {
    resume();
    events.forEach(e => window.removeEventListener(e, unlock));
  };
  events.forEach(e => window.addEventListener(e, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resume();
  });
}

async function loadCue(name: CueName): Promise<AudioBuffer | null> {
  const cached = buffers.get(name);
  if (cached) return cached;
  if (failed.has(name)) return null;

  const inFlight = loading.get(name);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const audioCtx = getContext();
    if (!audioCtx) return null;
    try {
      const res = await fetch(CUES[name].path);
      // The SPA catch-all rewrite serves index.html with a 200 for missing
      // files, so a content-type check is the only reliable 404 signal here.
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !type.startsWith('audio/')) {
        throw new Error(`expected audio, got ${res.status} ${type || 'unknown'}`);
      }
      const buf = await audioCtx.decodeAudioData(await res.arrayBuffer());
      buffers.set(name, buf);
      return buf;
    } catch (err) {
      failed.add(name);
      console.warn(`[sound] could not load "${name}" (${CUES[name].path}):`, err);
      return null;
    } finally {
      loading.delete(name);
    }
  })();

  loading.set(name, promise);
  return promise;
}

export function preloadGroup(group: PreloadGroup) {
  for (const name of Object.keys(CUES) as CueName[]) {
    if (CUES[name].group === group) void loadCue(name);
  }
}

/**
 * `dedupe` (on by default) drops a repeat of the same cue fired within a few
 * frames, which keeps rapid clicks from stacking. Turn it off for sustained
 * cues that are started and stopped by hand — there the caller owns the
 * lifetime, and a restart right after a stop is legitimate.
 */
export function play(name: CueName, opts?: { loop?: boolean; dedupe?: boolean }): SoundHandle {
  if (opts?.dedupe !== false) {
    const now = Date.now();
    const last = lastPlayedAt.get(name);
    if (last !== undefined && now - last < DEBOUNCE_MS) return NOOP_HANDLE;
    lastPlayedAt.set(name, now);
  }

  const audioCtx = getContext();
  if (!audioCtx) return NOOP_HANDLE;

  const cue = CUES[name];
  const buffer = buffers.get(name);

  // Already-decoded cues play synchronously; anything else loads and plays as
  // soon as it lands, which only matters on the very first use of a cue.
  if (!buffer) {
    let cancelled = false;
    let pending: SoundHandle | null = null;
    void loadCue(name).then(buf => {
      if (!buf || cancelled) return;
      pending = start(buf, cue.gain, cue.bus, opts?.loop ?? false);
    });
    return {
      stop: () => {
        cancelled = true;
        // The buffer may have landed and started playing before this call.
        pending?.stop();
      },
    };
  }

  return start(buffer, cue.gain, cue.bus, opts?.loop ?? false);
}

function start(buffer: AudioBuffer, gain: number, bus: SoundBus, loop: boolean): SoundHandle {
  const audioCtx = getContext();
  const busGain = busGains.get(bus);
  if (!audioCtx || !busGain) return NOOP_HANDLE;

  resume();

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;

  const cueGain = audioCtx.createGain();
  cueGain.gain.value = gain;

  source.connect(cueGain);
  cueGain.connect(busGain);
  source.start();

  let stopped = false;
  source.onended = () => { cueGain.disconnect(); };

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try { source.stop(); } catch { /* already ended */ }
    },
  };
}
