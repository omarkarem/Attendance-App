const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Athlete = require('../models/Athlete');
const Package = require('../models/Package');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');
const { financeOwnerId, hasFinanceAccess, brief } = require('../utils/team');
const { clientToday } = require('../utils/dates');
const { isMonthKey, addMonths, monthBounds, money, cleanShares, expenseApplies, summarize } = require('../utils/finance');

const router = express.Router();

// Finance belongs to the team: the head coach's data, shared with the coaches the head
// allows. Coaches without a team see their own. It never follows X-Act-As.
router.use(auth.self, (req, res, next) => {
  if (!hasFinanceAccess(req.authUser)) {
    return res.status(403).json({ code: 'FINANCE_DENIED', message: 'Your head coach has not given you access to finance.' });
  }
  req.ownerId = financeOwnerId(req.authUser);
  next();
});

const currentMonth = (req) => clientToday(req.query.today).slice(0, 7);

const monthParam = (req, res, value) => {
  const month = value || currentMonth(req);
  if (!isMonthKey(month)) {
    res.status(400).json({ message: 'Month must look like 2026-11.' });
    return null;
  }
  return month;
};

// The owner and every coach under them.
const teamCoaches = async (ownerId) => {
  const [owner, members] = await Promise.all([
    User.findById(ownerId).select('name email currency'),
    User.find({ headCoach: ownerId }).select('name email').sort({ name: 1 })
  ]);
  return { owner, coaches: [owner, ...members].filter(Boolean) };
};

const validId = (id) => typeof id === 'string' && mongoose.isValidObjectId(id);

// A head coach can add a team coach's athlete to their own roster (linkedFrom). It is
// the same person, so finance lists them once: the copy is dropped while the original
// is listed, unless the copy itself has payments (`keepIds`).
const withoutLinkedCopies = (athletes, keepIds = []) => {
  const listed = new Set(athletes.map((a) => String(a._id)));
  const keep = new Set(keepIds.map(String));
  return athletes.filter((a) => !(a.linkedFrom?.athlete && listed.has(String(a.linkedFrom.athlete)) && !keep.has(String(a._id))));
};

// Map of key -> items, in the order given.
const groupBy = (items, keyOf) => items.reduce((map, item) => {
  const key = keyOf(item);
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
  return map;
}, new Map());

const packageView = (p) => ({
  _id: p._id,
  name: p.name,
  price: p.price,
  daysPerWeek: p.daysPerWeek,
  shares: p.shares,
  active: p.active
});

const paymentView = (p) => ({
  _id: p._id,
  package: p.package,
  packageName: p.packageName,
  price: p.price,
  daysPerWeek: p.daysPerWeek,
  shares: p.shares,
  paid: p.paid,
  paidAt: p.paidAt
});

const expenseView = (e) => ({
  _id: e._id,
  label: e.label,
  amount: e.amount,
  category: e.category,
  coach: e.coach,
  recurring: e.recurring,
  startMonth: e.startMonth,
  endMonth: e.endMonth
});

const expensesIn = (ownerId, from, to) => Expense.find({
  owner: ownerId,
  startMonth: { $lte: to },
  $or: [{ endMonth: null }, { endMonth: { $gte: from } }]
}).sort({ category: 1, label: 1 });

const packageInput = (body, current = {}) => {
  const name = body.name !== undefined ? String(body.name).trim() : current.name;
  const price = body.price !== undefined ? Number(body.price) : current.price;
  const daysPerWeek = body.daysPerWeek !== undefined ? Number(body.daysPerWeek) : current.daysPerWeek;
  if (!name) return { error: 'Give the package a name.' };
  if (name.length > 50) return { error: 'Keep the name under 50 characters.' };
  if (!Number.isFinite(price) || price < 0) return { error: 'Enter the package price.' };
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) return { error: 'Days per week must be 1 to 7.' };
  const { shares, error } = body.shares !== undefined ? cleanShares(body.shares, price) : cleanShares(current.shares || [], price);
  if (error) return { error };
  return { value: { name, price: money(price), daysPerWeek, shares } };
};

const snapshot = (pkg) => ({
  package: pkg._id,
  packageName: pkg.name,
  price: pkg.price,
  daysPerWeek: pkg.daysPerWeek,
  shares: pkg.shares.map((s) => ({ label: s.label, amount: s.amount }))
});

// ---------- Settings ----------

// PUT /api/finance/settings - { currency }
router.put('/settings', async (req, res) => {
  try {
    const currency = typeof req.body.currency === 'string' ? req.body.currency.trim().toUpperCase() : '';
    if (currency.length > 8) return res.status(400).json({ message: 'Use a short currency, like EGP or USD.' });
    await User.updateOne({ _id: req.ownerId }, { $set: { currency } });
    res.json({ currency });
  } catch (error) {
    res.status(500).json({ message: 'Could not save the currency.' });
  }
});

// ---------- Packages ----------

// GET /api/finance/packages
router.get('/packages', async (req, res) => {
  try {
    const packages = await Package.find({ owner: req.ownerId }).sort({ active: -1, price: 1, name: 1 });
    res.json(packages.map(packageView));
  } catch (error) {
    res.status(500).json({ message: 'Could not load packages.' });
  }
});

// POST /api/finance/packages - { name, price, daysPerWeek, shares: [{ label, amount }] }
router.post('/packages', async (req, res) => {
  try {
    const { value, error } = packageInput(req.body);
    if (error) return res.status(400).json({ message: error });
    const pkg = await Package.create({ owner: req.ownerId, ...value });
    res.status(201).json(packageView(pkg));
  } catch (error) {
    res.status(500).json({ message: 'Could not create the package.' });
  }
});

// PUT /api/finance/packages/:id - also { active } to archive or restore.
// Unpaid athletes from this month on get the new price; paid and past months keep theirs.
router.put('/packages/:id', async (req, res) => {
  try {
    const pkg = validId(req.params.id) ? await Package.findOne({ _id: req.params.id, owner: req.ownerId }) : null;
    if (!pkg) return res.status(404).json({ message: 'Package not found.' });
    const { value, error } = packageInput(req.body, pkg);
    if (error) return res.status(400).json({ message: error });
    Object.assign(pkg, value);
    if (typeof req.body.active === 'boolean') pkg.active = req.body.active;
    await pkg.save();
    const updated = await Payment.updateMany(
      { owner: req.ownerId, package: pkg._id, paid: false, month: { $gte: currentMonth(req) } },
      { $set: snapshot(pkg) }
    );
    res.json({ ...packageView(pkg), updatedPayments: updated.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Could not update the package.' });
  }
});

// DELETE /api/finance/packages/:id - archived when athletes have used it, deleted otherwise
router.delete('/packages/:id', async (req, res) => {
  try {
    const pkg = validId(req.params.id) ? await Package.findOne({ _id: req.params.id, owner: req.ownerId }) : null;
    if (!pkg) return res.status(404).json({ message: 'Package not found.' });
    if (await Payment.exists({ owner: req.ownerId, package: pkg._id })) {
      pkg.active = false;
      await pkg.save();
      return res.json({ archived: true, package: packageView(pkg) });
    }
    await pkg.deleteOne();
    res.json({ archived: false });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete the package.' });
  }
});

// ---------- Month ----------

// GET /api/finance/month?month=yyyy-MM - athletes with their packages and paid state,
// packages, costs and the month's summary. An athlete can be on several packages.
router.get('/month', async (req, res) => {
  try {
    const month = monthParam(req, res, req.query.month);
    if (!month) return;
    const prev = addMonths(month, -1);
    const { start, end } = monthBounds(month);
    const { owner, coaches } = await teamCoaches(req.ownerId);
    const coachIds = coaches.map((c) => c._id);

    const [payments, prevPayments, packages, expenses] = await Promise.all([
      Payment.find({ owner: req.ownerId, month }).sort({ createdAt: 1 }),
      Payment.find({ owner: req.ownerId, month: prev }).select('athlete package'),
      Package.find({ owner: req.ownerId }).sort({ active: -1, price: 1, name: 1 }),
      expensesIn(req.ownerId, month, month)
    ]);

    // Athletes on the team that month: joined by its end, and active or archived after it began.
    const paidIds = payments.map((p) => p.athlete);
    const athletes = withoutLinkedCopies(await Athlete.find({
      $or: [
        { coach: { $in: coachIds }, joinDate: { $lte: end }, $or: [{ active: true }, { archivedAt: { $gte: start } }] },
        { _id: { $in: paidIds } }
      ]
    }).select('name coach active joinDate linkedFrom').sort({ name: 1 }), paidIds);

    const coachById = new Map(coaches.map((c) => [String(c._id), c]));
    const paymentsByAthlete = groupBy(payments, (p) => String(p.athlete));
    const prevByAthlete = groupBy(prevPayments, (p) => String(p.athlete));
    const seen = new Set();

    const rows = athletes.map((a) => {
      seen.add(String(a._id));
      const coach = coachById.get(String(a.coach));
      return {
        athleteId: a._id,
        name: a.name,
        active: a.active,
        onTeam: !!coach,
        coach: coach ? brief(coach) : null,
        payments: (paymentsByAthlete.get(String(a._id)) || []).map(paymentView),
        previousPackages: (prevByAthlete.get(String(a._id)) || []).map((p) => p.package)
      };
    });
    // Payments for athletes that were deleted since.
    paymentsByAthlete.forEach((list, athleteId) => {
      if (seen.has(athleteId)) return;
      const coach = coachById.get(String(list[0].coach));
      rows.push({
        athleteId,
        name: list[0].athleteName || 'Deleted athlete',
        active: false,
        onTeam: false,
        deleted: true,
        coach: coach ? brief(coach) : null,
        payments: list.map(paymentView),
        previousPackages: []
      });
    });

    res.json({
      month,
      currency: owner?.currency || '',
      owner: owner ? brief(owner) : null,
      coaches: coaches.map(brief),
      athletes: rows,
      packages: packages.map(packageView),
      expenses: expenses.map(expenseView),
      summary: summarize(payments, expenses)
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the month.' });
  }
});

// GET /api/finance/trend?end=yyyy-MM&months=12 - one summary row per month
router.get('/trend', async (req, res) => {
  try {
    const endMonth = monthParam(req, res, req.query.end);
    if (!endMonth) return;
    const count = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 12));
    const startMonth = addMonths(endMonth, -(count - 1));

    const [payments, expenses] = await Promise.all([
      Payment.find({ owner: req.ownerId, month: { $gte: startMonth, $lte: endMonth } }).select('month athlete price shares paid coach package packageName'),
      expensesIn(req.ownerId, startMonth, endMonth)
    ]);

    const rows = [];
    for (let i = 0; i < count; i += 1) {
      const month = addMonths(startMonth, i);
      const s = summarize(payments.filter((p) => p.month === month), expenses.filter((e) => expenseApplies(e, month)));
      rows.push({
        month,
        expected: s.expected,
        collected: s.collected,
        sharesPaid: s.sharesPaid,
        net: s.net,
        costs: s.costs,
        profit: s.profit,
        athletes: s.athletes,
        paidCount: s.paidCount
      });
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Could not load the trend.' });
  }
});

// ---------- Payments ----------

const teamAthlete = async (ownerId, athleteId) => {
  const { coaches } = await teamCoaches(ownerId);
  return Athlete.findOne({ _id: athleteId, coach: { $in: coaches.map((c) => c._id) } }).select('name coach');
};

// PUT /api/finance/payments - { athleteId, month, packageIds: [id] } sets the athlete's
// packages for the month. Packages kept keep their paid state; removed ones are deleted.
router.put('/payments', async (req, res) => {
  try {
    const { athleteId, packageIds } = req.body;
    const month = monthParam(req, res, req.body.month);
    if (!month) return;
    if (!validId(athleteId)) return res.status(400).json({ message: 'Choose an athlete.' });
    if (!Array.isArray(packageIds) || !packageIds.every(validId)) return res.status(400).json({ message: 'Choose packages from the list.' });
    const ids = [...new Set(packageIds.map(String))];

    const athlete = await teamAthlete(req.ownerId, athleteId);
    if (!athlete) return res.status(404).json({ message: 'This athlete is not on your team.' });

    const [existing, packages] = await Promise.all([
      Payment.find({ owner: req.ownerId, athlete: athleteId, month }),
      Package.find({ _id: { $in: ids }, owner: req.ownerId })
    ]);
    if (packages.length !== ids.length) return res.status(404).json({ message: 'Package not found.' });

    const had = new Set(existing.map((p) => String(p.package)));
    const adding = packages.filter((pkg) => !had.has(String(pkg._id)));
    const archived = adding.find((pkg) => !pkg.active);
    if (archived) return res.status(400).json({ message: `${archived.name} is archived. Restore it first.` });

    const removing = existing.filter((p) => !ids.includes(String(p.package)));
    if (removing.length) await Payment.deleteMany({ _id: { $in: removing.map((p) => p._id) } });
    if (adding.length) {
      await Payment.insertMany(adding.map((pkg) => ({
        owner: req.ownerId, athlete: athlete._id, athleteName: athlete.name, coach: athlete.coach, month, ...snapshot(pkg)
      })));
    }
    await Payment.updateMany({ owner: req.ownerId, athlete: athlete._id, month }, { $set: { athleteName: athlete.name, coach: athlete.coach } });

    const payments = await Payment.find({ owner: req.ownerId, athlete: athlete._id, month }).sort({ createdAt: 1 });
    res.json({ payments: payments.map(paymentView) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This athlete was just updated. Reload and try again.' });
    res.status(500).json({ message: 'Could not save the packages.' });
  }
});

// PATCH /api/finance/payments/:id - { paid } marks one package paid or not. Works for
// athletes who have left the team too, so old months can still be settled.
router.patch('/payments/:id', async (req, res) => {
  try {
    const { paid } = req.body;
    if (typeof paid !== 'boolean') return res.status(400).json({ message: 'Paid must be yes or no.' });
    const payment = validId(req.params.id) ? await Payment.findOne({ _id: req.params.id, owner: req.ownerId }) : null;
    if (!payment) return res.status(404).json({ message: 'Payment not found.' });
    if (paid !== payment.paid) {
      payment.paid = paid;
      payment.paidAt = paid ? new Date() : null;
      await payment.save();
    }
    res.json({ payment: paymentView(payment) });
  } catch (error) {
    res.status(500).json({ message: 'Could not save the payment.' });
  }
});

// POST /api/finance/payments/copy - { month } gives every athlete with no package this
// month the packages they had last month (unpaid, at today's prices).
router.post('/payments/copy', async (req, res) => {
  try {
    const month = monthParam(req, res, req.body.month);
    if (!month) return;
    const { coaches } = await teamCoaches(req.ownerId);
    const { start, end } = monthBounds(month);
    const [current, previous, packages, roster] = await Promise.all([
      Payment.find({ owner: req.ownerId, month }).select('athlete'),
      Payment.find({ owner: req.ownerId, month: addMonths(month, -1) }).select('athlete package'),
      Package.find({ owner: req.ownerId, active: true }),
      Athlete.find({
        coach: { $in: coaches.map((c) => c._id) },
        joinDate: { $lte: end },
        $or: [{ active: true }, { archivedAt: { $gte: start } }]
      }).select('name coach linkedFrom')
    ]);
    const athletes = withoutLinkedCopies(roster, current.map((p) => p.athlete));
    const has = new Set(current.map((p) => String(p.athlete)));
    const pkgById = new Map(packages.map((p) => [String(p._id), p]));
    const prevByAthlete = groupBy(previous, (p) => String(p.athlete));

    const docs = [];
    let athletesCopied = 0;
    athletes.forEach((a) => {
      if (has.has(String(a._id))) return;
      const pkgs = (prevByAthlete.get(String(a._id)) || []).map((p) => pkgById.get(String(p.package))).filter(Boolean);
      if (pkgs.length) athletesCopied += 1;
      pkgs.forEach((pkg) => docs.push({ owner: req.ownerId, athlete: a._id, athleteName: a.name, coach: a.coach, month, ...snapshot(pkg) }));
    });
    if (docs.length) await Payment.insertMany(docs, { ordered: false }).catch((e) => { if (e.code !== 11000) throw e; });
    res.json({ copied: athletesCopied, packages: docs.length });
  } catch (error) {
    res.status(500).json({ message: 'Could not copy last month.' });
  }
});

// ---------- Costs ----------

const expenseInput = async (req, body, current = {}) => {
  const label = body.label !== undefined ? String(body.label).trim() : current.label;
  const amount = body.amount !== undefined ? Number(body.amount) : current.amount;
  const category = body.category !== undefined ? body.category : (current.category || 'other');
  const recurring = body.recurring !== undefined ? !!body.recurring : (current.recurring ?? true);
  if (!label) return { error: 'Say what the cost is for.' };
  if (label.length > 50) return { error: 'Keep it under 50 characters.' };
  if (!Number.isFinite(amount) || amount < 0) return { error: 'Enter the amount.' };
  if (!['coach', 'facility', 'other'].includes(category)) return { error: 'Choose a type of cost.' };
  let coach = current.coach || null;
  if (body.coachId !== undefined) {
    coach = null;
    if (body.coachId) {
      const { coaches } = await teamCoaches(req.ownerId);
      const match = coaches.find((c) => String(c._id) === String(body.coachId));
      if (!match) return { error: 'That coach is not on your team.' };
      coach = match._id;
    }
  }
  if (category !== 'coach') coach = null;
  return { value: { label, amount: money(amount), category, coach, recurring } };
};

const loadExpense = async (req, res) => {
  const e = validId(req.params.id) ? await Expense.findOne({ _id: req.params.id, owner: req.ownerId }) : null;
  if (!e) res.status(404).json({ message: 'Cost not found.' });
  return e;
};

// GET /api/finance/expenses?month=yyyy-MM - costs that apply that month
router.get('/expenses', async (req, res) => {
  try {
    const month = monthParam(req, res, req.query.month);
    if (!month) return;
    const list = await expensesIn(req.ownerId, month, month);
    res.json(list.map(expenseView));
  } catch (error) {
    res.status(500).json({ message: 'Could not load costs.' });
  }
});

// POST /api/finance/expenses - { label, amount, category, coachId?, recurring, month }
// Monthly costs start in `month` and repeat; one-off costs apply to `month` only.
router.post('/expenses', async (req, res) => {
  try {
    const month = monthParam(req, res, req.body.month);
    if (!month) return;
    const { value, error } = await expenseInput(req, req.body);
    if (error) return res.status(400).json({ message: error });
    const e = await Expense.create({ owner: req.ownerId, ...value, startMonth: month, endMonth: value.recurring ? null : month });
    res.status(201).json(expenseView(e));
  } catch (error) {
    res.status(500).json({ message: 'Could not add the cost.' });
  }
});

// PUT /api/finance/expenses/:id?month=yyyy-MM - changes apply from `month` on, so a
// monthly cost that started earlier is split and earlier months keep the old amount.
router.put('/expenses/:id', async (req, res) => {
  try {
    const month = monthParam(req, res, req.query.month || req.body.month);
    if (!month) return;
    const e = await loadExpense(req, res);
    if (!e) return;
    if (!expenseApplies(e, month)) return res.status(400).json({ message: 'This cost does not apply to that month.' });
    const { value, error } = await expenseInput(req, req.body, e);
    if (error) return res.status(400).json({ message: error });

    if (e.recurring && e.startMonth < month) {
      const laterEnd = e.endMonth;
      e.endMonth = addMonths(month, -1);
      await e.save();
      const next = await Expense.create({
        owner: req.ownerId,
        ...value,
        startMonth: month,
        endMonth: value.recurring ? laterEnd : month
      });
      return res.json(expenseView(next));
    }

    const wasRecurring = e.recurring;
    Object.assign(e, value);
    if (value.recurring && !wasRecurring) e.endMonth = null;
    if (!value.recurring) e.endMonth = e.startMonth;
    await e.save();
    res.json(expenseView(e));
  } catch (error) {
    res.status(500).json({ message: 'Could not update the cost.' });
  }
});

// DELETE /api/finance/expenses/:id?month=yyyy-MM - a monthly cost that started earlier
// stops from `month` on (earlier months keep it); anything else is deleted.
router.delete('/expenses/:id', async (req, res) => {
  try {
    const month = monthParam(req, res, req.query.month);
    if (!month) return;
    const e = await loadExpense(req, res);
    if (!e) return;
    if (!expenseApplies(e, month)) return res.status(400).json({ message: 'This cost does not apply to that month.' });
    if (e.recurring && e.startMonth < month) {
      e.endMonth = addMonths(month, -1);
      await e.save();
      return res.json({ stopped: true, endMonth: e.endMonth });
    }
    await e.deleteOne();
    res.json({ stopped: false });
  } catch (error) {
    res.status(500).json({ message: 'Could not remove the cost.' });
  }
});

module.exports = router;
