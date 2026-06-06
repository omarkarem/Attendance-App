const express = require('express');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/sessions - Get sessions (by date or date range)
router.get('/', async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    const query = { coach: req.user._id };

    if (date) {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      
      // --- Lazy Session Generation ---
      const Schedule = require('../models/Schedule');
      const dayOfWeek = d.getDay();
      
      const activeSchedules = await Schedule.find({ 
        coach: req.user._id, 
        active: true, 
        daysOfWeek: dayOfWeek 
      });

      for (const schedule of activeSchedules) {
        const existingSession = await Session.findOne({
          coach: req.user._id,
          scheduleId: schedule._id,
          date: { $gte: start, $lt: end }
        });

        if (!existingSession) {
          let sessionDate = new Date(start);
          if (schedule.time) {
            const [hours, minutes] = schedule.time.split(':');
            sessionDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
          } else {
            // default to noon to avoid timezone shift issues
            sessionDate.setHours(12, 0, 0, 0); 
          }
          await Session.create({
            name: schedule.name,
            coach: req.user._id,
            date: sessionDate,
            scheduleId: schedule._id,
            assignedAthletes: schedule.assignedAthletes || []
          });
        }
      }
      // --------------------------------

      query.date = { $gte: start, $lt: end };
    } else if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const sessions = await Session.find(query).sort({ date: -1, createdAt: -1 });

    // Get attendance counts for each session
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (session) => {
        const presentCount = await Attendance.countDocuments({
          session: session._id,
          present: true
        });
        const totalCount = await Attendance.countDocuments({
          session: session._id
        });
        return {
          ...session.toObject(),
          presentCount,
          totalCount
        };
      })
    );

    res.json(sessionsWithCounts);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching sessions.' });
  }
});

// POST /api/sessions - Create a new session
router.post('/', async (req, res) => {
  try {
    const { name, date, assignedAthletes } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Session name is required.' });
    }

    const session = await Session.create({
      name: name.trim(),
      coach: req.user._id,
      date: date ? new Date(date) : new Date(),
      assignedAthletes: assignedAthletes || []
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating session.' });
  }
});

// GET /api/sessions/:id - Get a single session
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      coach: req.user._id
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching session.' });
  }
});

// PUT /api/sessions/:id - Update session
router.put('/:id', async (req, res) => {
  try {
    const { assignedAthletes } = req.body;
    
    const session = await Session.findOne({ _id: req.params.id, coach: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    
    if (assignedAthletes !== undefined) session.assignedAthletes = assignedAthletes;
    
    await session.save();
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating session.' });
  }
});

// DELETE /api/sessions/:id - Delete a session and its attendance records
router.delete('/:id', async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({
      _id: req.params.id,
      coach: req.user._id
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    // Delete all attendance records for this session
    await Attendance.deleteMany({ session: req.params.id });

    res.json({ message: 'Session and attendance records deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting session.' });
  }
});

module.exports = router;
