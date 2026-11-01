// The single number reports compare for a result, matching client/src/utils/performance.js:
// Running/Swimming pace (lower is better), Cycling speed (higher is better), and for
// Other the time on fixed-distance tests (lower is better) or the distance on
// fixed-time tests (higher is better).

const pad = (n) => n.toString().padStart(2, '0');

const formatTime = (totalSeconds) => {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '-';
  // Hundredths are kept for sprint times (0:32.45).
  const hundredths = Math.round(totalSeconds * 100);
  const t = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const sec = frac ? `${pad(s)}.${pad(frac)}` : pad(s);
  return h > 0 ? `${h}:${pad(m)}:${sec}` : `${m}:${sec}`;
};

const formatDistance = (meters) => {
  if (meters == null || Number.isNaN(meters)) return '-';
  if (meters >= 1000) return `${parseFloat((meters / 1000).toFixed(2))} km`;
  return `${parseFloat(Number(meters).toFixed(1))} m`;
};

const formatMinutes = (decimalMinutes) => {
  if (!Number.isFinite(decimalMinutes)) return '-';
  let mins = Math.floor(decimalMinutes);
  let secs = Math.round((decimalMinutes - mins) * 60);
  if (secs === 60) { mins += 1; secs = 0; }
  return `${mins}:${pad(secs)}`;
};

const metricFor = (testType) => {
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

/** "5:20 min/km", "32.4 km/h", "12:05" or "2.8 km". */
const formatMetric = (r, testType) => {
  const metric = metricFor(testType);
  const v = metric.value(r);
  if (v == null || !Number.isFinite(v)) return '-';
  return metric.unit ? `${metric.format(v)} ${metric.unit}` : metric.format(v);
};

/** What the athlete actually produced: the time on fixed-distance tests, the distance on fixed-time tests. */
const formatRaw = (r, testType) => (testType?.measureType === 'Time' ? formatDistance(r.distance) : formatTime(r.time));

/** Unit suffix for column headers, e.g. "min/km"; empty for Other. */
const metricUnit = (testType) => metricFor(testType).unit;

/** Percentage change where positive always means better; null without a baseline. */
const improvement = (baseline, latest, testType) => {
  if (!Number.isFinite(baseline) || !Number.isFinite(latest) || baseline === 0) return null;
  const { lowerIsBetter } = metricFor(testType);
  return Math.round(((lowerIsBetter ? baseline - latest : latest - baseline) / baseline) * 100);
};

const describeTarget = (t) => (t.measureType === 'Distance'
  ? (t.targetDistance ? formatDistance(t.targetDistance) : 'distance not set')
  : (t.targetTime ? formatTime(t.targetTime) : 'time not set'));

/** Title with the version spelled out when the test has been redefined, e.g. "Run test (v1, 3 km)". */
const versionedTitle = (t) => {
  if (!t) return 'Unknown test';
  if ((t.version || 1) === 1 && t.isCurrent !== false) return t.title;
  return `${t.title} (v${t.version || 1}, ${describeTarget(t)})`;
};

module.exports = { formatTime, formatDistance, metricFor, formatMetric, formatRaw, metricUnit, improvement, versionedTitle };
