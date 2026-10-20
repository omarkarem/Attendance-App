// Sessions and attendance are calendar-day records. They are stored at 12:00 UTC on
// their day so that the same calendar date shows up for coaches in any timezone
// between UTC-11 and UTC+11. Day queries therefore use UTC day boundaries.

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const toDayKey = (date) => new Date(date).toISOString().slice(0, 10);

// Accepts 'yyyy-MM-dd' (preferred) or anything Date can parse.
const parseDayKey = (value) => {
  if (typeof value === 'string' && DAY_KEY.test(value)) return value;
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  return toDayKey(d);
};

const dayRange = (dayKey) => {
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

const noonUtc = (dayKey) => new Date(`${dayKey}T12:00:00.000Z`);

// month is 1-12
const monthRange = (year, month) => ({
  start: new Date(Date.UTC(year, month - 1, 1)),
  end: new Date(Date.UTC(year, month, 1) - 1)
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { toDayKey, parseDayKey, dayRange, noonUtc, monthRange, escapeRegex };
