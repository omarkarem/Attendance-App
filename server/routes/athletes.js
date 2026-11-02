const express = require('express');
const mongoose = require('mongoose');
const Athlete = require('../models/Athlete');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const Schedule = require('../models/Schedule');
const TestResult = require('../models/TestResult');
const auth = require('../middleware/auth');
const { escapeRegex, parseDayKey, noonUtc, clientToday, dayRange } = require('../utils/dates');

const nameError = (name) => {
  const trimmed = (name || '').trim();
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (trimmed.length > 50) return 'Name must be less than 50 characters.';
  return null;
};

// Join dates are calendar days (yyyy-MM-dd) and cannot be in the future.
// Returns { date } or { error }; an empty value means "today".
const joinDateFrom = (value, today) => {
  if (value === undefined || value === null || value === '') return { date: noonUtc(today) };
  const key = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDayKey(value) : null;
  if (!key || Number.isNaN(noonUtc(key).getTime())) return { error: 'Join date must be a valid date.' };
  if (key > today) return { error: 'Join date cannot be in the future.' };
  return { date: noonUtc(key) };
};

const sameName = (coach, name, exceptId) => ({
  name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' },
  coach,
  ...(exceptId ? { _id: { $ne: exceptId } } : {})
});

// Adds athletes to the rosters of the given templates and of their sessions from today on,
// so a new athlete is expected straight away. Templates that expect everyone are left alone.
const enrollInTemplates = async (coach, scheduleIds, athleteIds, today) => {
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0 || athleteIds.length === 0) return;
  const schedules = await Schedule.find({ _id: { $in: scheduleIds }, coach });
  await Promise.all(schedules.map(async (schedule) => {
    if (!schedule.assignedAthletes || schedule.assignedAthletes.length === 0) return;
    await Schedule.updateOne({ _id: schedule._id }, { $addToSet: { assignedAthletes: { $each: athleteIds } } });
    await Session.updateMany(
      { coach, scheduleId: schedule._id, date: { $gte: dayRange(today).start }, 'assignedAthletes.0': { $exists: true } },
      { $addToSet: { assignedAthletes: { $each: athleteIds } } }
    );
  }));
};

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/athletes - Get all athletes for the coach
router.get('/', async (req, res) => {
  try {
    const { active, search } = req.query;
    const query = { coach: req.user._id };

    // Filter by active status (default: show only active)
    if (active !== undefined) {
      query.active = active === 'true';
    } else {
      query.active = true;
    }

    // Search by name
    if (search) {
      query.name = { $regex: escapeRegex(search), $options: 'i' };
    }

    const athletes = await Athlete.find(query).sort({ name: 1 }).populate('linkedFrom.coach', 'name');
    res.json(athletes);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching athletes.' });
  }
});

// Only a head coach working in their own account can take athletes from their coaches.
const headOnly = (req, res) => {
  if (!req.user._id.equals(req.authUser._id)) {
    res.status(400).json({ message: 'Switch back to your own account to add athletes from your coaches.' });
    return false;
  }
  return true;
};

// GET /api/athletes/from-coaches - the coaches under you and their active athletes.
// `added` marks athletes already on your roster (added before, or same name).
router.get('/from-coaches', async (req, res) => {
  try {
    if (!headOnly(req, res)) return;
    const coaches = await User.find({ headCoach: req.user._id, status: 'active' }).select('name email').sort({ name: 1 });
    const [theirs, mine] = await Promise.all([
      Athlete.find({ coach: { $in: coaches.map((c) => c._id) }, active: true }).select('name coach joinDate').sort({ name: 1 }),
      Athlete.find({ coach: req.user._id }).select('name active linkedFrom')
    ]);
    const linked = new Map(mine.filter((a) => a.linkedFrom?.athlete).map((a) => [String(a.linkedFrom.athlete), a]));
    const names = new Map(mine.map((a) => [a.name.toLowerCase(), a]));
    res.json(coaches.map((c) => ({
      id: c._id,
      name: c.name,
      email: c.email,
      athletes: theirs.filter((a) => a.coach.equals(c._id)).map((a) => {
        const copy = linked.get(String(a._id));
        const sameName = names.get(a.name.toLowerCase());
        return {
          _id: a._id,
          name: a.name,
          // 'added' (on your roster), 'archived' (yours but archived: adding restores it),
          // 'name-taken' (you have a different athlete with this name), or null.
          state: copy ? (copy.active ? 'added' : 'archived') : sameName ? 'name-taken' : null
        };
      })
    })));
  } catch (error) {
    res.status(500).json({ message: 'Could not load your coaches\' athletes.' });
  }
});

// POST /api/athletes/from-coach - { coachId, athleteIds: [id], scheduleIds?: [id] }
// Adds the chosen athletes of a coach under you to your own roster, joining today.
router.post('/from-coach', async (req, res) => {
  try {
    if (!headOnly(req, res)) return;
    const { coachId, athleteIds, scheduleIds } = req.body;
    const today = clientToday(req.query.today);
    if (!Array.isArray(athleteIds) || athleteIds.length === 0) return res.status(400).json({ message: 'Choose at least one athlete.' });
    const coach = mongoose.isValidObjectId(coachId) ? await User.findOne({ _id: coachId, headCoach: req.user._id }) : null;
    if (!coach) return res.status(404).json({ message: 'This coach is not on your team.' });

    const ids = athleteIds.filter((id) => mongoose.isValidObjectId(id));
    const [sources, mine] = await Promise.all([
      Athlete.find({ _id: { $in: ids }, coach: coach._id }).select('name'),
      Athlete.find({ coach: req.user._id }).select('name active linkedFrom')
    ]);
    if (sources.length !== new Set(ids.map(String)).size) return res.status(404).json({ message: `Some of these athletes are not ${coach.name}'s.` });

    const linked = new Map(mine.filter((a) => a.linkedFrom?.athlete).map((a) => [String(a.linkedFrom.athlete), a]));
    const taken = new Set(mine.map((a) => a.name.toLowerCase()));
    const toCreate = [];
    const restore = [];
    const skipped = [];
    sources.forEach((s) => {
      const copy = linked.get(String(s._id));
      if (copy) {
        if (copy.active) skipped.push({ name: s.name, reason: 'already on your roster' });
        else restore.push(copy._id);
        return;
      }
      if (taken.has(s.name.toLowerCase())) { skipped.push({ name: s.name, reason: 'you already have an athlete with this name' }); return; }
      taken.add(s.name.toLowerCase());
      toCreate.push({ name: s.name, coach: req.user._id, joinDate: noonUtc(today), linkedFrom: { athlete: s._id, coach: coach._id } });
    });

    const created = toCreate.length ? await Athlete.insertMany(toCreate) : [];
    if (restore.length) await Athlete.updateMany({ _id: { $in: restore } }, { $set: { active: true, archivedAt: null } });
    await enrollInTemplates(req.user._id, scheduleIds, [...created.map((a) => a._id), ...restore], today);

    res.status(201).json({ added: created.length + restore.length, restored: restore.length, skipped });
  } catch (error) {
    res.status(500).json({ message: 'Could not add the athletes.' });
  }
});

// POST /api/athletes - Add one athlete
// body: { name, joinDate?: yyyy-MM-dd, scheduleIds?: [id] }
router.post('/', async (req, res) => {
  try {
    const { name, scheduleIds } = req.body;
    const today = clientToday(req.query.today);

    if (nameError(name)) {
      return res.status(400).json({ message: nameError(name) });
    }
    const join = joinDateFrom(req.body.joinDate, today);
    if (join.error) return res.status(400).json({ message: join.error });

    if (await Athlete.exists(sameName(req.user._id, name))) {
      return res.status(400).json({ message: 'An athlete with this name already exists.' });
    }

    const athlete = await Athlete.create({
      name: name.trim(),
      coach: req.user._id,
      joinDate: join.date
    });
    await enrollInTemplates(req.user._id, scheduleIds, [athlete._id], today);

    res.status(201).json(athlete);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error adding athlete.' });
  }
});

// POST /api/athletes/bulk - Add several athletes at once
// body: { names: [string], joinDate?: yyyy-MM-dd, scheduleIds?: [id] }
// Duplicates (already on the roster, or repeated in the list) are skipped, not errors.
router.post('/bulk', async (req, res) => {
  try {
    const { names, scheduleIds } = req.body;
    const today = clientToday(req.query.today);
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ message: 'Add at least one name.' });
    }
    if (names.length > 200) return res.status(400).json({ message: 'Add at most 200 athletes at a time.' });

    const join = joinDateFrom(req.body.joinDate, today);
    if (join.error) return res.status(400).json({ message: join.error });

    const cleaned = names.map((n) => (typeof n === 'string' ? n.trim().replace(/\s+/g, ' ') : '')).filter(Boolean);
    const invalid = cleaned.find((n) => nameError(n));
    if (invalid) return res.status(400).json({ message: `"${invalid}": ${nameError(invalid)}` });

    const existing = await Athlete.find({ coach: req.user._id }).select('name');
    const taken = new Set(existing.map((a) => a.name.toLowerCase()));
    const toCreate = [];
    const skipped = [];
    cleaned.forEach((n) => {
      if (taken.has(n.toLowerCase())) { skipped.push(n); return; }
      taken.add(n.toLowerCase());
      toCreate.push({ name: n, coach: req.user._id, joinDate: join.date });
    });

    const created = toCreate.length ? await Athlete.insertMany(toCreate) : [];
    await enrollInTemplates(req.user._id, scheduleIds, created.map((a) => a._id), today);

    res.status(201).json({ created, skipped });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error adding athletes.' });
  }
});

// PUT /api/athletes/:id - Update an athlete
router.put('/:id', async (req, res) => {
  try {
    const { name, active } = req.body;

    const athlete = await Athlete.findOne({
      _id: req.params.id,
      coach: req.user._id
    });

    if (!athlete) {
      return res.status(404).json({ message: 'Athlete not found.' });
    }

    if (name !== undefined) {
      if (nameError(name)) return res.status(400).json({ message: nameError(name) });
      if (await Athlete.exists(sameName(req.user._id, name, req.params.id))) {
        return res.status(400).json({ message: 'An athlete with this name already exists.' });
      }
      athlete.name = name.trim();
    }
    if (req.body.joinDate !== undefined) {
      const join = joinDateFrom(req.body.joinDate, clientToday(req.query.today));
      if (join.error) return res.status(400).json({ message: join.error });
      athlete.joinDate = join.date;
    }
    if (active !== undefined && !!active !== athlete.active) {
      athlete.active = !!active;
      athlete.archivedAt = athlete.active ? null : new Date();
    }

    await athlete.save();
    res.json(athlete);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating athlete.' });
  }
});

// DELETE /api/athletes/:id - Deactivate (soft delete) an athlete
router.delete('/:id', async (req, res) => {
  try {
    const athlete = await Athlete.findOneAndUpdate(
      { _id: req.params.id, coach: req.user._id },
      { active: false, archivedAt: new Date() },
      { new: true }
    );

    if (!athlete) {
      return res.status(404).json({ message: 'Athlete not found.' });
    }

    res.json({ message: 'Athlete deactivated.', athlete });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deactivating athlete.' });
  }
});

// DELETE /api/athletes/:id/permanent - Permanently delete an athlete and their attendance records
router.delete('/:id/permanent', async (req, res) => {
  try {
    const athlete = await Athlete.findOneAndDelete({
      _id: req.params.id,
      coach: req.user._id
    });

    if (!athlete) {
      return res.status(404).json({ message: 'Athlete not found.' });
    }

    // Remove everything that references the athlete so nothing shows up as "Unknown".
    await Promise.all([
      Attendance.deleteMany({ athlete: athlete._id, coach: req.user._id }),
      TestResult.deleteMany({ athlete: athlete._id, coach: req.user._id }),
      Session.updateMany({ coach: req.user._id }, { $pull: { assignedAthletes: athlete._id } }),
      Schedule.updateMany({ coach: req.user._id }, { $pull: { assignedAthletes: athlete._id } })
    ]);

    res.json({ message: 'Athlete permanently deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting athlete.' });
  }
});

// GET /api/athletes/:id/profile - Get comprehensive athlete profile data
router.get('/:id/profile', async (req, res) => {
  try {
    const athlete = await Athlete.findOne({
      _id: req.params.id,
      coach: req.user._id
    });

    if (!athlete) {
      return res.status(404).json({ message: 'Athlete not found.' });
    }

    // --- Attendance Stats ---
    // Session time breaks ties between two sessions on the same day.
    const allAttendance = await Attendance.find({
      coach: req.user._id,
      athlete: athlete._id
    }).populate('session', 'time').sort({ date: 1, createdAt: 1 });
    allAttendance.sort((a, b) => a.date - b.date || (a.session?.time || '').localeCompare(b.session?.time || ''));

    const totalRecords = allAttendance.length;
    const presentRecords = allAttendance.filter(a => a.present).length;
    const attendanceRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

    // Calculate current streak (consecutive present from most recent backwards)
    let streak = 0;
    for (let i = allAttendance.length - 1; i >= 0; i--) {
      if (allAttendance[i].present) {
        streak++;
      } else {
        break;
      }
    }

    // --- Monthly attendance trend (last 6 months of the coach's calendar) ---
    const [ty, tm] = clientToday(req.query.today).split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(Date.UTC(ty, tm - 1 - i, 1));
      const end = new Date(Date.UTC(ty, tm - i, 1));
      const inMonth = allAttendance.filter((a) => a.date >= start && a.date < end);
      const present = inMonth.filter((a) => a.present).length;
      monthlyTrend.push({
        month: monthNames[start.getUTCMonth()],
        year: start.getUTCFullYear(),
        total: inMonth.length,
        present,
        rate: inMonth.length > 0 ? Math.round((present / inMonth.length) * 100) : 0
      });
    }

    // --- Enrolled Schedules ---
    const schedules = await Schedule.find({
      coach: req.user._id,
      active: true,
      assignedAthletes: athlete._id
    });

    // --- Test Results ---
    const testResults = await TestResult.find({
      coach: req.user._id,
      athlete: athlete._id
    })
      .populate('testType', 'title category measureType targetDistance targetTime lineageId version validFrom validTo isCurrent active')
      .sort({ date: -1 });

    res.json({
      athlete,
      attendance: {
        rate: attendanceRate,
        totalSessions: totalRecords,
        attended: presentRecords,
        streak,
        monthlyTrend
      },
      schedules,
      testResults,
      testCount: testResults.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching athlete profile.' });
  }
});

module.exports = router;
