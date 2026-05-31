const express = require('express');
const Athlete = require('../models/Athlete');
const auth = require('../middleware/auth');

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
      query.name = { $regex: search, $options: 'i' };
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

    if (!name) {
      return res.status(400).json({ message: 'Athlete name is required.' });
    }

    // Check for duplicate name under same coach
    const existing = await Athlete.findOne({
      name: { $regex: `^${name.trim()}$`, $options: 'i' },
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
      const existing = await Athlete.findOne({
        name: { $regex: `^${name.trim()}$`, $options: 'i' },
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

    const Attendance = require('../models/Attendance');
    await Attendance.deleteMany({ athlete: req.params.id });

    res.json({ message: 'Athlete permanently deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting athlete.' });
  }
});

module.exports = router;
