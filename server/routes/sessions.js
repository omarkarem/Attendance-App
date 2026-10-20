const express = require('express');
const Session = require('../models/Session');
const Schedule = require('../models/Schedule');
const Attendance = require('../models/Attendance');
const auth = require('../middleware/auth');
const { parseDayKey, dayRange, noonUtc, toDayKey } = require('../utils/dates');
const { ensureScheduledSessions } = require('../utils/sessionGenerator');

const router = express.Router();

// All routes require authentication
router.use(auth);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Attach present/total counts to a list of sessions with one aggregate query.
const withCounts = async (sessions) => {
  if (sessions.length === 0) return [];
  const counts = await Attendance.aggregate([
    { $match: { session: { $in: sessions.map((s) => s._id) } } },
    { $group: { _id: '$session', total: { $sum: 1 }, present: { $sum: { $cond: ['$present', 1, 0] } } } }
  ]);
  const byId = new Map(counts.map((c) => [c._id.toString(), c]));
  return sessions.map((session) => {
    const c = byId.get(session._id.toString());
    return { ...session.toObject(), presentCount: c?.present || 0, totalCount: c?.total || 0 };
  });
};

// Templates store a single time; generated sessions copy it. Older sessions only have date.
const sortByTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || new Date(a.createdAt) - new Date(b.createdAt);

// GET /api/sessions - Get sessions (by day, generating template sessions, or by date range)
router.get('/', async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    const query = { coach: req.user._id };

    if (date) {
      const dayKey = parseDayKey(date);
      if (!dayKey) return res.status(400).json({ message: 'Invalid date.' });
      await ensureScheduledSessions(req.user._id, dayKey);
      const { start, end } = dayRange(dayKey);
      query.date = { $gte: start, $lt: end };
    } else if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const sessions = await Session.find(query).sort({ date: -1, createdAt: -1 });
    const result = await withCounts(sessions);
    if (date) result.sort(sortByTime);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching sessions.' });
  }
});

// POST /api/sessions - Create a one-off session
router.post('/', async (req, res) => {
  try {
    const { name, date, time, assignedAthletes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Session name is required.' });
    }
    if (time && !TIME_RE.test(time)) {
      return res.status(400).json({ message: 'Time must be in HH:MM format.' });
    }
    const dayKey = parseDayKey(date);
    if (!dayKey) return res.status(400).json({ message: 'Invalid date.' });

    const session = await Session.create({
      name: name.trim(),
      coach: req.user._id,
      date: noonUtc(dayKey),
      time: time || null,
      assignedAthletes: assignedAthletes || []
    });

    res.status(201).json({ ...session.toObject(), presentCount: 0, totalCount: 0 });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating session.' });
  }
});

// GET /api/sessions/:id - Get a single session
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, coach: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found.' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching session.' });
  }
});

// PUT /api/sessions/:id - Update name, time or expected athletes
router.put('/:id', async (req, res) => {
  try {
    const { name, time, assignedAthletes } = req.body;

    const session = await Session.findOne({ _id: req.params.id, coach: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found.' });

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'Session name is required.' });
      session.name = name.trim();
    }
    if (time !== undefined) {
      if (time && !TIME_RE.test(time)) return res.status(400).json({ message: 'Time must be in HH:MM format.' });
      session.time = time || null;
    }
    if (assignedAthletes !== undefined) {
      session.assignedAthletes = assignedAthletes;

      // A session generated from a template shares its roster: the template is updated
      // so the athlete profile and future sessions match. Past sessions are left alone.
      if (session.scheduleId) {
        await Schedule.findOneAndUpdate(
          { _id: session.scheduleId, coach: req.user._id },
          { $set: { assignedAthletes } }
        );
        await Session.updateMany(
          { coach: req.user._id, scheduleId: session.scheduleId, date: { $gte: dayRange(toDayKey(new Date())).start } },
          { $set: { assignedAthletes } }
        );
      }
    }

    await session.save();
    const [withCount] = await withCounts([session]);
    res.json(withCount);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating session.' });
  }
});

// DELETE /api/sessions/:id - Delete a session and its attendance records
router.delete('/:id', async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({ _id: req.params.id, coach: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found.' });

    await Attendance.deleteMany({ session: session._id });

    // Remember the day so the template does not regenerate the session on the next visit.
    if (session.scheduleId) {
      await Schedule.updateOne(
        { _id: session.scheduleId, coach: req.user._id },
        { $addToSet: { skippedDates: session.dayKey || toDayKey(session.date) } }
      );
    }

    res.json({ message: 'Session and attendance records deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting session.' });
  }
});

module.exports = router;
