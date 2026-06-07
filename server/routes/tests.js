const express = require('express');
const TestType = require('../models/TestType');
const TestResult = require('../models/TestResult');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// --- Test Types ---

// GET /api/tests/types - Get all test types for the coach
router.get('/types', async (req, res) => {
  try {
    const testTypes = await TestType.find({ coach: req.user._id, active: true }).sort({ title: 1 });
    res.json(testTypes);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching test types.' });
  }
});

// POST /api/tests/types - Create a new test type
router.post('/types', async (req, res) => {
  try {
    const { title, category, measureType, targetDistance, targetTime } = req.body;

    if (!title || !category || !measureType) {
      return res.status(400).json({ message: 'Title, category, and measure type are required.' });
    }

    const testType = await TestType.create({
      title: title.trim(),
      category,
      measureType,
      targetDistance,
      targetTime,
      coach: req.user._id
    });

    res.status(201).json(testType);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error creating test type.' });
  }
});

// PUT /api/tests/types/:id - Update a test type
router.put('/types/:id', async (req, res) => {
  try {
    const { title, category, measureType, targetDistance, targetTime } = req.body;

    if (!title || !category || !measureType) {
      return res.status(400).json({ message: 'Title, category, and measure type are required.' });
    }

    const testType = await TestType.findOneAndUpdate(
      { _id: req.params.id, coach: req.user._id },
      {
        title: title.trim(),
        category,
        measureType,
        targetDistance,
        targetTime
      },
      { new: true }
    );

    if (!testType) {
      return res.status(404).json({ message: 'Test type not found.' });
    }

    res.json(testType);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating test type.' });
  }
});

// DELETE /api/tests/types/:id - Soft delete a test type
router.delete('/types/:id', async (req, res) => {
  try {
    const testType = await TestType.findOneAndUpdate(
      { _id: req.params.id, coach: req.user._id },
      { active: false },
      { new: true }
    );
    if (!testType) {
      return res.status(404).json({ message: 'Test type not found.' });
    }
    res.json({ message: 'Test type deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting test type.' });
  }
});

// --- Test Results ---

// GET /api/tests/results - Get test results
router.get('/results', async (req, res) => {
  try {
    const { athleteId, testTypeId } = req.query;
    const query = { coach: req.user._id };
    
    if (athleteId) query.athlete = athleteId;
    if (testTypeId) query.testType = testTypeId;

    const results = await TestResult.find(query)
      .populate('athlete', 'name')
      .populate('testType', 'title category measureType targetDistance targetTime')
      .sort({ date: -1 });
      
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching test results.' });
  }
});

// POST /api/tests/results - Record a new test result
router.post('/results', async (req, res) => {
  try {
    const { athleteId, testTypeId, date, distance, time, description } = req.body;

    if (!athleteId || !testTypeId || distance === undefined || time === undefined) {
      return res.status(400).json({ message: 'Athlete, test type, distance, and time are required.' });
    }

    const result = await TestResult.create({
      athlete: athleteId,
      testType: testTypeId,
      date: date || new Date(),
      distance,
      time,
      description: description ? description.trim() : '',
      coach: req.user._id
    });

    // Populate for the response so frontend can show it immediately
    const populatedResult = await TestResult.findById(result._id)
      .populate('athlete', 'name')
      .populate('testType', 'title category measureType targetDistance targetTime');

    res.status(201).json(populatedResult);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error recording test result.' });
  }
});

// PUT /api/tests/results/:id - Update a test result
router.put('/results/:id', async (req, res) => {
  try {
    const { athleteId, testTypeId, date, distance, time, description } = req.body;

    if (!athleteId || !testTypeId || distance === undefined || time === undefined) {
      return res.status(400).json({ message: 'Athlete, test type, distance, and time are required.' });
    }

    const result = await TestResult.findOneAndUpdate(
      { _id: req.params.id, coach: req.user._id },
      {
        athlete: athleteId,
        testType: testTypeId,
        date: date || new Date(),
        distance,
        time,
        description: description ? description.trim() : ''
      },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'Test result not found.' });
    }

    const populatedResult = await TestResult.findById(result._id)
      .populate('athlete', 'name')
      .populate('testType', 'title category measureType targetDistance targetTime');

    res.json(populatedResult);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating test result.' });
  }
});

// DELETE /api/tests/results/:id - Delete a test result
router.delete('/results/:id', async (req, res) => {
  try {
    const result = await TestResult.findOneAndDelete({
      _id: req.params.id,
      coach: req.user._id
    });

    if (!result) {
      return res.status(404).json({ message: 'Test result not found.' });
    }

    res.json({ message: 'Test result deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error deleting test result.' });
  }
});

module.exports = router;
