import { format } from 'date-fns';

// Matches the server: athletes show a New badge for this many days after joining.
export const NEW_ATHLETE_DAYS = 30;

export const todayKey = () => format(new Date(), 'yyyy-MM-dd');

/** Join dates are calendar days stored at 12:00 UTC; read the day back in UTC. */
export const joinKey = (athlete) => (athlete?.joinDate ? new Date(athlete.joinDate).toISOString().slice(0, 10) : null);

/** True when the athlete had joined by `dayKey` (yyyy-MM-dd). Unknown join dates count as joined. */
export const joinedBy = (athlete, dayKey) => {
  const key = joinKey(athlete);
  return !key || !dayKey || key <= dayKey;
};

/** Splits pasted or typed text into names: one per line, or separated by commas. */
export const splitNames = (text) => {
  const seen = new Set();
  return String(text || '')
    .split(/[\n,;]+/)
    .map((n) => n.trim().replace(/\s+/g, ' ').replace(/^[-*•\d.)\s]+(?=\S)/, ''))
    .filter((n) => {
      const key = n.toLowerCase();
      if (!n || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
