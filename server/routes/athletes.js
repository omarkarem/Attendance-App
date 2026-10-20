const express = require('express');
const Athlete = require('../models/Athlete');
const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const Schedule = require('../models/Schedule');
const TestResult = require('../models/TestResult');
const auth = require('../middleware/auth');
const { escapeRegex } = require('../utils/dates');

const nameError = (name) => {
  const trimmed = (name || '').trim();
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (trimmed.length > 50) return 'Name must be less than 50 characters.';
  return null;
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

    const athletes = await Athlete.find(query).sort({ name: 1 });
    res.json(athletes);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching athletes.' });
  }
});

// POST /api/athletes - Add a new athlete
router.post('/', async (req, res) => {
  try {
    const { name, isNewAthlete } = req.body;

    if (nameError(name)) {
      return res.status(400).json({ message: nameError(name) });
    }

    // Check for duplicate name under same coach
    const existing = await Athlete.findOne({
      name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' },
      coach: req.user._id
    });

    if (existing) {
      return res.status(400).json({ message: 'An athlete with this name already exists.' });
    }

    const athlete = await Athlete.create({
      name: name.trim(),
      coach: req.user._id,
      isNewAthlete: isNewAthlete || false,
      joinDate: new Date()
    });

    res.status(201).json(athlete);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error adding athlete.' });
  }
});

// PUT /api/athletes/:id - Update an athlete
router.put('/:id', async (req, res) => {
  try {
    const { name, isNewAthlete, active } = req.body;

    const athlete = await Athlete.findOne({
      _id: req.params.id,
      coach: req.user._id
    });

    if (!athlete) {
      return res.status(404).json({ message: 'Athlete not found.' });
    }

    if (name !== undefined) {
      if (nameError(name)) return res.status(400).json({ message: nameError(name) });
      const existing = await Athlete.findOne({
        name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' },
        coach: req.user._id,
        _id: { $ne: req.params.id }
      });
      if (existing) {
        return res.status(400).json({ message: 'An athlete with this name already exists.' });
      }
      athlete.name = name.trim();
    }
    if (isNewAthlete !== undefined) athlete.isNewAthlete = isNewAthlete;
    if (active !== undefined) athlete.active = active;

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
      { active: false },
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
    const allAttendance = await Attendance.find({
      coach: req.user._id,
      athlete: athlete._id
    }).sort({ date: 1 });

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

    // --- Monthly attendance trend (last 6 months, UTC calendar months) ---
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
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
      .populate('testType', 'title category measureType targetDistance targetTime')
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
