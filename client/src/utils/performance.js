import { PiPersonSimpleRun, PiPersonSimpleSwim, PiPersonSimpleBike, PiTimer } from 'react-icons/pi';

// Shared helpers for performance tests. Distances are stored in meters, times in seconds.

export const CATEGORIES = ['Running', 'Swimming', 'Cycling', 'Other'];

export const CATEGORY_META = {
  Running: { label: 'Running', short: 'Run', Icon: PiPersonSimpleRun },
  Swimming: { label: 'Swimming', short: 'Swim', Icon: PiPersonSimpleSwim },
  Cycling: { label: 'Cycling', short: 'Bike', Icon: PiPersonSimpleBike },
  Other: { label: 'Other', short: 'Other', Icon: PiTimer }
};

export const categoryMeta = (category) => CATEGORY_META[category] || CATEGORY_META.Other;

const pad = (n) => n.toString().padStart(2, '0');

// 1500 -> "25:00", 3725 -> "1:02:05", 32.45 -> "0:32.45" (hundredths kept for sprints)
export const formatTime = (totalSeconds) => {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '-';
  const hundredths = Math.round(totalSeconds * 100);
  const t = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const sec = frac ? `${pad(s)}.${pad(frac)}` : pad(s);
  return h > 0 ? `${h}:${pad(m)}:${sec}` : `${m}:${sec}`;
};

export const formatDistance = (meters) => {
  if (meters == null || Number.isNaN(meters)) return '-';
  if (meters >= 1000) return `${parseFloat((meters / 1000).toFixed(2))} km`;
  return `${parseFloat(meters.toFixed(1))} m`;
};

// Minutes as a decimal -> "m:ss"
export const formatMinutes = (decimalMinutes) => {
  if (!Number.isFinite(decimalMinutes)) return '-';
  let mins = Math.floor(decimalMinutes);
  let secs = Math.round((decimalMinutes - mins) * 60);
  if (secs === 60) { mins += 1; secs = 0; }
  return `${mins}:${pad(secs)}`;
};

/**
 * The single number we chart and compare for a result.
 * Running/Swimming: pace in minutes (per km / per 100 m), lower is better.
 * Cycling: speed in km/h, higher is better.
 * Other: time when the distance is fixed (lower is better), distance when the time is fixed (higher is better).
 */
export const metricFor = (testType) => {
  const category = testType?.category;
  if (category === 'Running') {
    return { label: 'Pace', unit: 'min/km', lowerIsBetter: true, value: (r) => (r.distance > 0 ? (r.time / 60) / (r.distance / 1000) : null), format: formatMinutes };
  }
  if (category === 'Swimming') {
    return { label: 'Pace', unit: 'min/100m', lowerIsBetter: true, value: (r) => (r.distance > 0 ? (r.time / 60) / (r.distance / 100) : null), format: formatMinutes };
  }
  if (category === 'Cycling') {
    return { label: 'Speed', unit: 'km/h', lowerIsBetter: false, value: (r) => (r.time > 0 ? (r.distance / 1000) / (r.time / 3600) : null), format: (v) => (Number.isFinite(v) ? v.toFixed(1) : '-') };
  }
  if (testType?.measureType === 'Time') {
    return { label: 'Distance', unit: '', lowerIsBetter: false, value: (r) => r.distance, format: formatDistance };
  }
  return { label: 'Time', unit: '', lowerIsBetter: true, value: (r) => r.time, format: formatTime };
};

/** Cycling tests are FTP efforts, so average power is the number that matters when it was recorded. */
export const POWER_METRIC = { label: 'Avg power', unit: 'W', lowerIsBetter: false, value: (r) => (r.avgPower > 0 ? r.avgPower : null), format: (v) => (Number.isFinite(v) ? String(Math.round(v)) : '-') };

/** Like metricFor, but switches cycling to power when any of `results` has it. */
export const chartMetricFor = (testType, results = []) => (
  testType?.category === 'Cycling' && results.some((r) => r.avgPower > 0) ? POWER_METRIC : metricFor(testType)
);

export const formatPace = (distance, time, testType) => {
  if (!distance || !time) return '-';
  const metric = metricFor(typeof testType === 'string' ? { category: testType } : testType);
  const v = metric.value({ distance, time });
  if (v == null) return '-';
  return metric.unit ? `${metric.format(v)} ${metric.unit}` : metric.format(v);
};

export const toSeconds = ({ h, m, s }) => (parseInt(h, 10) || 0) * 3600 + (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);

export const fromSeconds = (total) => {
  const t = Math.max(0, Math.round(total || 0));
  return { h: String(Math.floor(t / 3600)), m: String(Math.floor((t % 3600) / 60)), s: String(t % 60) };
};

/**
 * Parses a typed duration and returns seconds, or null when it cannot be read.
 * - Colons: "5:32", "1:02:05", "0:32.45"
 * - Stopwatch digits (phone keypads have no colon): the last two digits are seconds,
 *   the two before are minutes, the rest hours. "532" = 5:32, "2215" = 22:15,
 *   "10512" = 1:05:12, "45" = 45 s, "32.45" = 32.45 s.
 * - Units: "12m 30s", "1h 5m"
 */
export const parseDuration = (text) => {
  const s = String(text || '').trim().toLowerCase().replace(/,/g, '.');
  if (!s) return null;

  const units = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in)?)?\s*(?:(\d+(?:\.\d+)?)\s*s(?:ec)?)?$/);
  if (units && (units[1] || units[2] || units[3])) {
    return parseFloat(units[1] || 0) * 3600 + parseFloat(units[2] || 0) * 60 + parseFloat(units[3] || 0);
  }

  if (/^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(s)) {
    const parts = s.split(':').map(Number);
    if (parts.slice(1).some((n) => n >= 60)) return null;
    return parts.reduce((total, n) => total * 60 + n, 0);
  }

  const digits = s.match(/^(\d+)(\.\d+)?$/);
  if (!digits) return null;
  const [, whole, fraction = ''] = digits;
  const sec = parseInt(whole.slice(-2), 10);
  const min = whole.length > 2 ? parseInt(whole.slice(-4, -2), 10) : 0;
  const hrs = whole.length > 4 ? parseInt(whole.slice(0, -4), 10) : 0;
  if (whole.length > 2 && (sec >= 60 || min >= 60)) return null;
  return hrs * 3600 + min * 60 + sec + (fraction ? parseFloat(fraction) : 0);
};

/** Distance typed in the given unit ("km" or "m") to meters; null when unreadable. */
export const parseDistance = (text, unit) => {
  const v = parseFloat(String(text || '').replace(',', '.'));
  if (!Number.isFinite(v)) return null;
  return unit === 'km' ? v * 1000 : v;
};

// ---------- Test type versions (history kept on the server, type 2) ----------

/** The id shared by every version of a test. */
export const lineageOf = (t) => (t ? String(t.lineageId || t._id) : '');

export const describeTarget = (t) => (t?.measureType === 'Distance'
  ? (t.targetDistance ? formatDistance(t.targetDistance) : 'distance not set')
  : (t?.targetTime ? formatTime(t.targetTime) : 'time not set'));

/** "v1 · 3 km" for older versions; empty for a test that was never redefined. */
export const versionLabel = (t) => {
  if (!t || ((t.version || 1) === 1 && t.isCurrent !== false)) return '';
  return `v${t.version || 1} · ${describeTarget(t)}`;
};

/**
 * The version of `testType` (a current type from /tests/types, with `versions`) that
 * applied on `dayKey`: the newest one that had started by then, else the first one.
 * Mirrors the server, so previews show the same fixed target that will be saved.
 */
export const versionOn = (testType, dayKey) => {
  const versions = testType?.versions;
  if (!versions || versions.length === 0 || !dayKey) return testType;
  let chosen = versions[0];
  versions.forEach((v) => { if (resultDateInput(v.validFrom) <= dayKey) chosen = v; });
  return { ...testType, ...chosen, title: testType.title, versions };
};

// Test result dates are calendar dates saved as UTC midnight, so read them back in UTC.
export const resultDateInput = (date) => new Date(date).toISOString().slice(0, 10);

export const formatResultDate = (date, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Date(date).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
