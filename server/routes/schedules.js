const express = require('express');
const Schedule = require('../models/Schedule');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

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

    if (!name || !daysOfWeek || daysOfWeek.length === 0) {
      return res.status(400).json({ message: 'Name and at least one day of the week are required.' });
    }

    const schedule = await Schedule.create({
      name: name.trim(),
      coach: req.user._id,
      daysOfWeek,
      time: time || null,
      assignedAthletes: assignedAthletes || []
    });

    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating schedule.' });
  }
});

// PUT /api/schedules/:id - Update schedule active status
router.put('/:id', async (req, res) => {
  try {
    const { active, assignedAthletes } = req.body;
    
    const schedule = await Schedule.findOne({ _id: req.params.id, coach: req.user._id });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    
    if (active !== undefined) schedule.active = active;
    if (assignedAthletes !== undefined) schedule.assignedAthletes = assignedAthletes;
    
    await schedule.save();
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating schedule.' });
  }
});

// DELETE /api/schedules/:id - Delete a schedule
router.delete('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findOneAndDelete({
      _id: req.params.id,
      coach: req.user._id
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    res.json({ message: 'Schedule deleted. Future sessions will not be auto-generated.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting schedule.' });
  }
});

module.exports = router;
