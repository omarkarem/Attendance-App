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

// 1500 -> "25:00", 3725 -> "1:02:05"
export const formatTime = (totalSeconds) => {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '-';
  const t = Math.round(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
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

// Test result dates are calendar dates saved as UTC midnight, so read them back in UTC.
export const resultDateInput = (date) => new Date(date).toISOString().slice(0, 10);

export const formatResultDate = (date, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Date(date).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
