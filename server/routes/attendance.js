const express = require('express');
const Attendance = require('../models/Attendance');
const Athlete = require('../models/Athlete');
const Session = require('../models/Session');
const auth = require('../middleware/auth');
const { parseDayKey, dayRange, monthRange, clientToday } = require('../utils/dates');
const { backfillScheduledSessions } = require('../utils/sessionGenerator');

const router = express.Router();

// All routes require authentication
router.use(auth);

// POST /api/attendance/bulk - Save attendance for a session
// body: { sessionId, records: [{ athleteId, present }], clearAthleteIds?: [id] }
// clearAthleteIds removes records for those athletes only. Records for anyone not
// mentioned (for example archived athletes) are left untouched.
router.post('/bulk', async (req, res) => {
  try {
    const { sessionId, records, clearAthleteIds } = req.body;

    if (!sessionId || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Session ID and records array are required.' });
    }

    const session = await Session.findOne({ _id: sessionId, coach: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found.' });

    // Only accept athletes that belong to this coach.
    const requestedIds = [...new Set([...records.map((r) => r.athleteId), ...(clearAthleteIds || [])])];
    const owned = await Athlete.find({ _id: { $in: requestedIds }, coach: req.user._id }).select('_id');
    const ownedIds = new Set(owned.map((a) => a._id.toString()));
    if (ownedIds.size !== requestedIds.length) {
      return res.status(400).json({ message: 'One or more athletes were not found.' });
    }

    if (Array.isArray(clearAthleteIds)) {
      if (clearAthleteIds.length > 0) {
        await Attendance.deleteMany({ session: sessionId, coach: req.user._id, athlete: { $in: clearAthleteIds } });
      }
    } else {
      // Legacy clients: anyone not in records is removed.
      await Attendance.deleteMany({ session: sessionId, coach: req.user._id, athlete: { $nin: records.map((r) => r.athleteId) } });
    }

    if (records.length > 0) {
      await Attendance.bulkWrite(records.map((record) => ({
        updateOne: {
          filter: { session: sessionId, athlete: record.athleteId, coach: req.user._id },
          update: { $set: { present: !!record.present, date: session.date } },
          upsert: true
        }
      })));
    }

    res.json({ message: 'Attendance saved successfully.', count: records.length });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error saving attendance.' });
  }
});

// GET /api/attendance/session/:sessionId - Get attendance for a session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const attendance = await Attendance.find({
      session: req.params.sessionId,
      coach: req.user._id
    }).populate('athlete', 'name joinDate active');

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching attendance.' });
  }
});

const gridPayload = async (coachId, start, end) => {
  const sessions = await Session.find({ coach: coachId, date: { $gte: start, $lte: end } }).sort({ date: 1, time: 1 });
  const attendance = await Attendance.find({
    session: { $in: sessions.map((s) => s._id) },
    coach: coachId
  }).select('session athlete present');
  // Archived athletes stay in the grid for periods where they were recorded.
  const recorded = [...new Set(attendance.map((a) => String(a.athlete)))];
  const athletes = await Athlete.find({ coach: coachId, $or: [{ active: true }, { _id: { $in: recorded } }] }).sort({ name: 1 });
  return { sessions, attendance, athletes };
};

// GET /api/attendance/monthly - Get monthly attendance data
router.get('/monthly', async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Month and year are required.' });
    }
    // Template days since the last read are created first so the grid has no gaps.
    await backfillScheduledSessions(req.user._id, clientToday(req.query.today));
    const { start, end } = monthRange(year, month);
    res.json({ ...(await gridPayload(req.user._id, start, end)), month, year });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching monthly attendance.' });
  }
});

// GET /api/attendance/range - Get attendance data for a date range (yyyy-MM-dd, inclusive)
router.get('/range', async (req, res) => {
  try {
    const startKey = parseDayKey(req.query.startDate);
    const endKey = parseDayKey(req.query.endDate);
    if (!req.query.startDate || !req.query.endDate || !startKey || !endKey) {
      return res.status(400).json({ message: 'Start date and end date are required.' });
    }
    await backfillScheduledSessions(req.user._id, clientToday(req.query.today));
    const start = dayRange(startKey).start;
    const end = new Date(dayRange(endKey).end.getTime() - 1);
    res.json(await gridPayload(req.user._id, start, end));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching attendance range.' });
  }
});

// GET /api/attendance/stats?date=yyyy-MM-dd - Dashboard stats for the coach's "today"
router.get('/stats', async (req, res) => {
  try {
    const coach = req.user._id;
    const todayKey = clientToday(req.query.date);
    const today = dayRange(todayKey);

    // Create template sessions up to today (including any days missed since the
    // last visit) so the dashboard counts are accurate.
    await backfillScheduledSessions(coach, todayKey);

    const [y, m, d] = todayKey.split('-').map(Number);
    const month = monthRange(y, m);

    const [todaySessions, todayPresent, totalAthletes, monthSessions, joinedThisMonth, inactiveAthletes, athletes] = await Promise.all([
      Session.countDocuments({ coach, date: { $gte: today.start, $lt: today.end } }),
      Attendance.countDocuments({ coach, date: { $gte: today.start, $lt: today.end }, present: true }),
      Athlete.countDocuments({ coach, active: true }),
      Session.countDocuments({ coach, date: { $gte: month.start, $lte: month.end } }),
      Athlete.countDocuments({ coach, joinDate: { $gte: month.start, $lte: month.end } }),
      Athlete.countDocuments({ coach, active: false }),
      Athlete.find({ coach, active: true }).sort({ name: 1 })
    ]);

    // One pass over this month's records gives both the daily trend and per-athlete stats.
    const monthRecords = await Attendance.find({ coach, date: { $gte: month.start, $lte: month.end } }).select('athlete present date');

    const dailyPresent = new Array(d).fill(0);
    const perAthlete = new Map();
    monthRecords.forEach((r) => {
      const day = new Date(r.date).getUTCDate();
      if (r.present && day <= d) dailyPresent[day - 1] += 1;
      const key = r.athlete.toString();
      const s = perAthlete.get(key) || { total: 0, present: 0 };
      s.total += 1;
      if (r.present) s.present += 1;
      perAthlete.set(key, s);
    });

    const dailyTrend = dailyPresent.map((present, i) => ({
      day: i + 1,
      date: `${todayKey.slice(0, 8)}${String(i + 1).padStart(2, '0')}`,
      present
    }));

    const athleteStats = athletes.map((athlete) => {
      const s = perAthlete.get(athlete._id.toString()) || { total: 0, present: 0 };
      return {
        id: athlete._id,
        name: athlete.name,
        isNewAthlete: athlete.isNewAthlete,
        totalSessions: s.total,
        attended: s.present,
        percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0
      };
    });

    res.json({
      today: { date: todayKey, sessions: todaySessions, present: todayPresent },
      totalAthletes,
      month: { sessions: monthSessions, dailyTrend },
      churn: { joinedThisMonth, inactiveAthletes },
      athleteStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching stats.' });
  }
});

module.exports = router;
