// Stopwatch maths and formatting. Time is stored as wall-clock timestamps (Date.now()),
// never as a ticking counter, so a running stopwatch keeps counting through a refresh,
// a closed tab or a locked phone.

// Lane tags. Bright enough to read on the dark canvas, distinct from each other.
export const TAG_COLORS = [
  { value: '#0099ff', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#ff7a3d', label: 'Orange' },
  { value: '#d44df0', label: 'Magenta' },
  { value: '#facc15', label: 'Yellow' },
  { value: '#2dd4bf', label: 'Teal' },
  { value: '#ff5577', label: 'Coral' },
  { value: '#a78bfa', label: 'Violet' }
];

export const MAX_STOPWATCHES = 24;
export const MAX_NAME_LENGTH = 30;

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/** A stopped stopwatch at zero. `laps` holds the elapsed time at each Lap press (cumulative splits). */
export const createStopwatch = (name, color) => ({
  id: newId(),
  name,
  color,
  startedAt: null,
  accumulated: 0,
  laps: []
});

export const isRunning = (w) => w.startedAt != null;

export const elapsedOf = (w, now) => w.accumulated + (w.startedAt != null ? Math.max(0, now - w.startedAt) : 0);

export const hasTime = (w) => isRunning(w) || w.accumulated > 0 || w.laps.length > 0;

export const start = (w, now) => (isRunning(w) ? w : { ...w, startedAt: now });

export const stop = (w, now) => (isRunning(w) ? { ...w, accumulated: elapsedOf(w, now), startedAt: null } : w);

export const lap = (w, now) => (isRunning(w) ? { ...w, laps: [...w.laps, elapsedOf(w, now)] } : w);

export const reset = (w) => ({ ...w, startedAt: null, accumulated: 0, laps: [] });

/** Durations of the completed laps, in order. */
export const lapDurations = (w) => w.laps.map((split, i) => split - (i > 0 ? w.laps[i - 1] : 0));

export const currentLapOf = (w, now) => elapsedOf(w, now) - (w.laps.length ? w.laps[w.laps.length - 1] : 0);

/**
 * Index of the fastest and slowest completed lap, as on the iPhone: only once there are
 * at least two to compare, and never when they are all equal.
 */
export const lapExtremes = (durations) => {
  if (durations.length < 2) return { best: -1, worst: -1 };
  let best = 0;
  let worst = 0;
  durations.forEach((d, i) => {
    if (d < durations[best]) best = i;
    if (d > durations[worst]) worst = i;
  });
  return durations[best] === durations[worst] ? { best: -1, worst: -1 } : { best, worst };
};

const pad = (n) => String(n).padStart(2, '0');

/** 00:00.00, or 1:02:03.45 once past an hour. */
export const formatStopwatch = (ms) => {
  const total = Math.max(0, Math.floor(ms / 10));
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000) % 60;
  const h = Math.floor(total / 360000);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}.${pad(cs)}` : `${pad(m)}:${pad(s)}.${pad(cs)}`;
};

/** First tag color not used yet, so new lanes are told apart at a glance. */
export const nextColor = (watches) => {
  const used = new Set(watches.map((w) => w.color));
  return (TAG_COLORS.find((c) => !used.has(c.value)) || TAG_COLORS[watches.length % TAG_COLORS.length]).value;
};

/** "Lane n" with the first number not taken. */
export const nextName = (watches) => {
  const taken = new Set(watches.map((w) => w.name.trim().toLowerCase()));
  let n = watches.length + 1;
  for (let i = 1; i <= watches.length + 1; i += 1) {
    if (!taken.has(`lane ${i}`)) { n = i; break; }
  }
  return `Lane ${n}`;
};

/** Keeps only well-formed stopwatches from storage (old versions, manual edits, another tab mid-write). */
export const sanitize = (raw) => {
  if (!raw || !Array.isArray(raw.watches)) return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const watches = raw.watches
    .filter((w) => w && typeof w.id === 'string')
    .slice(0, MAX_STOPWATCHES)
    .map((w) => ({
      id: w.id,
      name: typeof w.name === 'string' && w.name.trim() ? w.name.slice(0, MAX_NAME_LENGTH) : 'Stopwatch',
      color: TAG_COLORS.some((c) => c.value === w.color) ? w.color : TAG_COLORS[0].value,
      startedAt: typeof w.startedAt === 'number' && Number.isFinite(w.startedAt) ? w.startedAt : null,
      accumulated: num(w.accumulated),
      laps: Array.isArray(w.laps) ? w.laps.filter((l) => typeof l === 'number' && Number.isFinite(l) && l >= 0) : []
    }));
  return watches.length ? { watches, openedAt: num(raw.openedAt) || Date.now() } : null;
};
