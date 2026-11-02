// Month keys are 'yyyy-MM' strings, so they compare and sort as text.
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

const isMonthKey = (v) => typeof v === 'string' && MONTH_KEY.test(v);

const addMonths = (key, n) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthBounds = (key) => {
  const [y, m] = key.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1) - 1) };
};

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Validates a share list ({ label, amount }) against the price. Returns { shares } or { error }.
const cleanShares = (input, price) => {
  if (input === undefined) return { shares: [] };
  if (!Array.isArray(input)) return { error: 'Shares must be a list.' };
  const shares = [];
  for (const s of input) {
    const label = typeof s?.label === 'string' ? s.label.trim() : '';
    const amount = Number(s?.amount);
    if (!label && !s?.amount) continue; // empty row left in the form
    if (!label) return { error: 'Every share needs a name, like Gym or Pool.' };
    if (label.length > 40) return { error: 'Keep share names under 40 characters.' };
    if (!Number.isFinite(amount) || amount < 0) return { error: `Enter an amount for ${label}.` };
    shares.push({ label, amount: money(amount) });
  }
  const total = shares.reduce((sum, s) => sum + s.amount, 0);
  if (total > price) return { error: 'Shares add up to more than the package price.' };
  return { shares };
};

const sharesTotal = (shares = []) => money(shares.reduce((sum, s) => sum + (s.amount || 0), 0));

// Adds `amount` under `label` (case-insensitive) in a Map of label -> { label, amount }.
const addTo = (map, label, amount) => {
  const key = label.trim().toLowerCase();
  const row = map.get(key) || { label: label.trim(), amount: 0 };
  row.amount = money(row.amount + amount);
  map.set(key, row);
};

const expenseApplies = (e, month) => e.startMonth <= month && (!e.endMonth || e.endMonth >= month);

// Revenue, money passed on, costs and profit for one month. There is one payment per
// athlete per package; athlete counts are people, and an athlete counts as paid once
// every package they are on that month is paid.
const summarize = (payments, expenses) => {
  let expected = 0;
  let collected = 0;
  let sharesPaid = 0;
  let sharesExpected = 0;
  const shares = new Map();
  const byCoach = new Map();
  const byPackage = new Map();
  const athletePaid = new Map(); // athlete -> every package paid so far
  const coachAthletes = new Map(); // coach -> Set of athletes

  payments.forEach((p) => {
    const passOn = sharesTotal(p.shares);
    const athleteKey = String(p.athlete);
    athletePaid.set(athleteKey, (athletePaid.get(athleteKey) ?? true) && !!p.paid);
    expected += p.price;
    sharesExpected += passOn;
    const coachKey = String(p.coach || '');
    const coach = byCoach.get(coachKey) || { coach: p.coach || null, athletes: 0, expected: 0, collected: 0, net: 0 };
    if (!coachAthletes.has(coachKey)) coachAthletes.set(coachKey, new Set());
    coachAthletes.get(coachKey).add(athleteKey);
    coach.athletes = coachAthletes.get(coachKey).size;
    coach.expected = money(coach.expected + p.price);
    const pkgKey = String(p.package || p.packageName);
    const pkg = byPackage.get(pkgKey) || { package: p.package || null, name: p.packageName, athletes: 0, paid: 0, collected: 0 };
    pkg.athletes += 1;
    if (p.paid) {
      collected += p.price;
      sharesPaid += passOn;
      (p.shares || []).forEach((s) => addTo(shares, s.label, s.amount));
      coach.collected = money(coach.collected + p.price);
      coach.net = money(coach.net + p.price - passOn);
      pkg.paid += 1;
      pkg.collected = money(pkg.collected + p.price);
    }
    byCoach.set(coachKey, coach);
    byPackage.set(pkgKey, pkg);
  });

  const costs = new Map();
  const costsByCategory = { coach: 0, facility: 0, other: 0 };
  let costTotal = 0;
  expenses.forEach((e) => {
    costTotal += e.amount;
    costsByCategory[e.category] = money((costsByCategory[e.category] || 0) + e.amount);
    addTo(costs, e.label, e.amount);
  });

  const net = money(collected - sharesPaid);
  const paidCount = [...athletePaid.values()].filter(Boolean).length;
  return {
    athletes: athletePaid.size,
    paidCount,
    unpaidCount: athletePaid.size - paidCount,
    expected: money(expected),
    collected: money(collected),
    outstanding: money(expected - collected),
    sharesPaid: money(sharesPaid),
    sharesExpected: money(sharesExpected),
    shares: [...shares.values()].sort((a, b) => b.amount - a.amount),
    net,
    costs: money(costTotal),
    costsByCategory,
    costItems: [...costs.values()].sort((a, b) => b.amount - a.amount),
    profit: money(net - costTotal),
    byCoach: [...byCoach.values()],
    byPackage: [...byPackage.values()].sort((a, b) => b.collected - a.collected)
  };
};

module.exports = { isMonthKey, addMonths, monthBounds, money, cleanShares, sharesTotal, expenseApplies, summarize };
