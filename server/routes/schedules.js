const express = require('express');
const Schedule = require('../models/Schedule');
const Session = require('../models/Session');
const auth = require('../middleware/auth');
const { dayRange, toDayKey, addDays } = require('../utils/dates');

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

    const schedule = await Schedule.create({
      name: name.trim(),
      coach: req.user._id,
      daysOfWeek: [...new Set(daysOfWeek)].sort(),
      time: time || null,
      assignedAthletes: assignedAthletes || [],
      // Backfill starts on the day the template was created.
      generatedThrough: addDays(toDayKey(new Date()), -1)
    });

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
      const yesterday = addDays(toDayKey(new Date()), -1);
      if (!schedule.active && active && (!schedule.generatedThrough || schedule.generatedThrough < yesterday)) {
        schedule.generatedThrough = yesterday;
      }
      schedule.active = !!active;
    }
    if (assignedAthletes !== undefined) {
      schedule.assignedAthletes = assignedAthletes;
      futureUpdate.assignedAthletes = assignedAthletes;
    }

    await schedule.save();

    if (Object.keys(futureUpdate).length > 0) {
      await Session.updateMany(
        { coach: req.user._id, scheduleId: schedule._id, date: { $gte: dayRange(toDayKey(new Date())).start } },
        { $set: futureUpdate }
      );
    }

    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating schedule.' });
  }
});

// DELETE /api/schedules/:id - Delete a schedule (sessions already generated are kept)
router.delete('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findOneAndDelete({ _id: req.params.id, coach: req.user._id });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found.' });
    res.json({ message: 'Schedule deleted. Future sessions will not be auto-generated.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting schedule.' });
  }
});

module.exports = router;
