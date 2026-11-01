const express = require('express');
const Schedule = require('../models/Schedule');
const Session = require('../models/Session');
const Athlete = require('../models/Athlete');
const Attendance = require('../models/Attendance');
const auth = require('../middleware/auth');
const { dayRange, addDays, clientToday } = require('../utils/dates');
const { ensureScheduledSessions } = require('../utils/sessionGenerator');

// Keeps only ids of athletes that belong to the coach (deduplicated); null if the input is not a list.
const ownedAthletes = async (coach, ids) => {
  if (!Array.isArray(ids)) return null;
  const unique = [...new Set(ids.map(String))];
  if (unique.length === 0) return [];
  const owned = await Athlete.find({ _id: { $in: unique }, coach }).select('_id');
  return owned.map((a) => a._id);
};

// Deletes a template's sessions from `today` on that match `shouldRemove`, unless
// someone has already been checked in to them (those keep their attendance).
const removeUntakenSessions = async (coach, scheduleId, today, shouldRemove) => {
  const future = await Session.find({ coach, scheduleId, date: { $gte: dayRange(today).start } }).select('_id date');
  const stale = future.filter(shouldRemove);
  if (stale.length === 0) return;
  const taken = new Set((await Attendance.distinct('session', { session: { $in: stale.map((s) => s._id) } })).map(String));
  const removable = stale.filter((s) => !taken.has(String(s._id))).map((s) => s._id);
  if (removable.length) await Session.deleteMany({ _id: { $in: removable } });
};

const router = express.Router();

// All routes require authentication
router.use(auth);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDays = (days) => Array.isArray(days) && days.length > 0 && days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);

// GET /api/schedules - Get all schedules
router.get('/', async (req, res) => {
  try {
    const schedules = await Schedule.find({ coach: req.user._id }).sort({ createdAt: -1 });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching schedules.' });
  }
});

// POST /api/schedules - Create a schedule
router.post('/', async (req, res) => {
  try {
    const { name, daysOfWeek, time, assignedAthletes } = req.body;

    if (!name || !name.trim() || !validDays(daysOfWeek)) {
      return res.status(400).json({ message: 'Name and at least one day of the week are required.' });
    }
    if (time && !TIME_RE.test(time)) {
      return res.status(400).json({ message: 'Time must be in HH:MM format.' });
    }

    const today = clientToday(req.query.today);
    const schedule = await Schedule.create({
      name: name.trim(),
      coach: req.user._id,
      daysOfWeek: [...new Set(daysOfWeek)].sort(),
      time: time || null,
      assignedAthletes: (await ownedAthletes(req.user._id, assignedAthletes)) || [],
      // Backfill starts on the day the template was created.
      generatedThrough: addDays(today, -1)
    });
    // Today's session exists straight away if the template runs today.
    await ensureScheduledSessions(req.user._id, today);

    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating schedule.' });
  }
});

// PUT /api/schedules/:id - Update name, days, time, paused state or roster
router.put('/:id', async (req, res) => {
  try {
    const { name, daysOfWeek, time, active, assignedAthletes } = req.body;

    const schedule = await Schedule.findOne({ _id: req.params.id, coach: req.user._id });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    const today = clientToday(req.query.today);

    // Changes flow into today's and future generated sessions, never into past ones,
    // so historical attendance percentages stay stable.
    const futureUpdate = {};

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'Template name is required.' });
      schedule.name = name.trim();
      futureUpdate.name = schedule.name;
    }
    if (daysOfWeek !== undefined) {
      if (!validDays(daysOfWeek)) return res.status(400).json({ message: 'Select at least one day of the week.' });
      schedule.daysOfWeek = [...new Set(daysOfWeek)].sort();
    }
    if (time !== undefined) {
      if (time && !TIME_RE.test(time)) return res.status(400).json({ message: 'Time must be in HH:MM format.' });
      schedule.time = time || null;
      futureUpdate.time = schedule.time;
    }
    if (active !== undefined) {
      // Resuming skips the paused days: backfill picks up from today, not from the pause.
      const yesterday = addDays(today, -1);
      if (!schedule.active && active && (!schedule.generatedThrough || schedule.generatedThrough < yesterday)) {
        schedule.generatedThrough = yesterday;
      }
      schedule.active = !!active;
    }
    if (assignedAthletes !== undefined) {
      const roster = await ownedAthletes(req.user._id, assignedAthletes);
      if (!roster) return res.status(400).json({ message: 'Athletes must be a list.' });
      schedule.assignedAthletes = roster;
      futureUpdate.assignedAthletes = roster;
    }

    await schedule.save();

    if (Object.keys(futureUpdate).length > 0) {
      await Session.updateMany(
        { coach: req.user._id, scheduleId: schedule._id, date: { $gte: dayRange(today).start } },
        { $set: futureUpdate }
      );
    }

    // Days that no longer match (removed weekday, or paused) lose their future sessions.
    if (daysOfWeek !== undefined || active === false) {
      await removeUntakenSessions(req.user._id, schedule._id, today,
        (s) => !schedule.active || !schedule.daysOfWeek.includes(new Date(s.date).getUTCDay()));
    }
    // New weekdays (or resuming) should show today's session straight away.
    if (schedule.active && (daysOfWeek !== undefined || active === true)) {
      await ensureScheduledSessions(req.user._id, today);
    }

    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating schedule.' });
  }
});

// DELETE /api/schedules/:id - Delete a schedule. Past sessions and any session with
// attendance are kept; empty sessions from today on are removed.
router.delete('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findOneAndDelete({ _id: req.params.id, coach: req.user._id });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found.' });
    await removeUntakenSessions(req.user._id, schedule._id, clientToday(req.query.today), () => true);
    res.json({ message: 'Schedule deleted. Future sessions will not be auto-generated.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting schedule.' });
  }
});

module.exports = router;
