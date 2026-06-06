const express = require('express');
const Attendance = require('../models/Attendance');
const Athlete = require('../models/Athlete');
const Session = require('../models/Session');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// POST /api/attendance/bulk - Save attendance for a session (bulk upsert)
router.post('/bulk', async (req, res) => {
  try {
    const { sessionId, records } = req.body;
    // records: [{ athleteId, present }]

    if (!sessionId || !records || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Session ID and records array are required.' });
    }

    // Verify session belongs to coach
    const session = await Session.findOne({
      _id: sessionId,
      coach: req.user._id
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    // Upsert each attendance record
    const operations = records.map(record => ({
      updateOne: {
        filter: {
          session: sessionId,
          athlete: record.athleteId,
          coach: req.user._id
        },
        update: {
          $set: {
            present: record.present,
            date: session.date
          }
        },
        upsert: true
      }
    }));

    // Find all athletes NOT in the records list for this session, and delete their attendance
    const recordAthleteIds = records.map(r => r.athleteId);
    
    await Attendance.deleteMany({
      session: sessionId,
      coach: req.user._id,
      athlete: { $nin: recordAthleteIds }
    });

    if (operations.length > 0) {
      await Attendance.bulkWrite(operations);
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
    }).populate('athlete', 'name isNewAthlete joinDate active');

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching attendance.' });
  }
});

// GET /api/attendance/monthly - Get monthly attendance data
router.get('/monthly', async (req, res) => {
  try {
    const { month, year, sessionFilter } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required.' });
    }

    const m = parseInt(month) - 1; // JS months are 0-indexed
    const y = parseInt(year);
    const startDate = new Date(y, m, 1);
    const endDate = new Date(y, m + 1, 0, 23, 59, 59);

    // Get all sessions in this month
    const sessionQuery = {
      coach: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    };

    if (sessionFilter && sessionFilter !== 'all') {
      sessionQuery._id = sessionFilter;
    }

    const sessions = await Session.find(sessionQuery).sort({ date: 1 });
    const sessionIds = sessions.map(s => s._id);

    // Get all attendance records for these sessions
    const attendance = await Attendance.find({
      session: { $in: sessionIds },
      coach: req.user._id
    }).populate('athlete', 'name isNewAthlete joinDate active');

    // Get all active athletes
    const athletes = await Athlete.find({
      coach: req.user._id,
      active: true
    }).sort({ name: 1 });

    res.json({
      sessions,
      attendance,
      athletes,
      month: m + 1,
      year: y
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching monthly attendance.' });
  }
});

// GET /api/attendance/range - Get attendance data for a specific date range
router.get('/range', async (req, res) => {
  try {
    const { startDate, endDate, sessionFilter } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const sessionQuery = {
      coach: req.user._id,
      date: { $gte: start, $lte: end }
    };

    if (sessionFilter && sessionFilter !== 'all') {
      sessionQuery._id = sessionFilter;
    }

    const sessions = await Session.find(sessionQuery).sort({ date: 1 });
    const sessionIds = sessions.map(s => s._id);

    const attendance = await Attendance.find({
      session: { $in: sessionIds },
      coach: req.user._id
    }).populate('athlete', 'name isNewAthlete joinDate active');

    const athletes = await Athlete.find({
      coach: req.user._id,
      active: true
    }).sort({ name: 1 });

    res.json({
      sessions,
      attendance,
      athletes
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching attendance range.' });
  }
});

// GET /api/attendance/stats - Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Today's stats
    const todaySessions = await Session.countDocuments({
      coach: req.user._id,
      date: { $gte: startOfDay, $lt: endOfDay }
    });

    const todayPresent = await Attendance.countDocuments({
      coach: req.user._id,
      date: { $gte: startOfDay, $lt: endOfDay },
      present: true
    });

    // Total active athletes
    const totalAthletes = await Athlete.countDocuments({
      coach: req.user._id,
      active: true
    });

    // This month's stats
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const monthSessions = await Session.countDocuments({
      coach: req.user._id,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Monthly attendance trend (daily data for chart)
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dailyTrend = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStart = new Date(today.getFullYear(), today.getMonth(), day);
      const dayEnd = new Date(today.getFullYear(), today.getMonth(), day + 1);

      if (dayStart > today) break; // Don't include future days

      const presentCount = await Attendance.countDocuments({
        coach: req.user._id,
        date: { $gte: dayStart, $lt: dayEnd },
        present: true
      });

      dailyTrend.push({
        day,
        date: dayStart.toISOString().split('T')[0],
        present: presentCount
      });
    }

    // Per-athlete stats this month
    const athletes = await Athlete.find({
      coach: req.user._id,
      active: true
    }).sort({ name: 1 });

    const athleteStats = await Promise.all(
      athletes.map(async (athlete) => {
        const totalRecords = await Attendance.countDocuments({
          coach: req.user._id,
          athlete: athlete._id,
          date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        const presentRecords = await Attendance.countDocuments({
          coach: req.user._id,
          athlete: athlete._id,
          date: { $gte: startOfMonth, $lte: endOfMonth },
          present: true
        });

        return {
          id: athlete._id,
          name: athlete.name,
          isNewAthlete: athlete.isNewAthlete,
          totalSessions: totalRecords,
          attended: presentRecords,
          percentage: totalRecords > 0
            ? Math.round((presentRecords / totalRecords) * 100)
            : 0
        };
      })
    );

    // Athlete churn stats
    const joinedThisMonth = await Athlete.countDocuments({
      coach: req.user._id,
      joinDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const inactiveAthletes = await Athlete.countDocuments({
      coach: req.user._id,
      active: false
    });

    res.json({
      today: {
        sessions: todaySessions,
        present: todayPresent
      },
      totalAthletes,
      month: {
        sessions: monthSessions,
        dailyTrend
      },
      churn: {
        joinedThisMonth,
        inactiveAthletes
      },
      athleteStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching stats.' });
  }
});

module.exports = router;
