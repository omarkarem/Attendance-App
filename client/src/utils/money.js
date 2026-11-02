import { format } from 'date-fns';

// Month keys are 'yyyy-MM', the same as the server.
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const isMonthKey = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export const addMonths = (key, n) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};

export const monthDate = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
};

export const monthLabel = (key, pattern = 'MMMM yyyy') => format(monthDate(key), pattern);

const NUMBER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

// 4,000 or 4,000 EGP when the team set a currency.
export const formatMoney = (n, currency) => {
  const text = NUMBER.format(Number(n) || 0);
  return currency ? `${text} ${currency}` : text;
};

export const sharesTotal = (shares = []) => shares.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
