const express = require('express');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Athlete = require('../models/Athlete');
const TestResult = require('../models/TestResult');
const TestType = require('../models/TestType');
const generateExcel = require('../utils/exportExcel');
const generatePdf = require('../utils/exportPdf');
const { generateAthleteTestPdf, generateTestTypeReportPdf, generateMultiTestTypeReportPdf } = require('../utils/exportTestPdf');
const { generateAthleteTestExcel, generateTestTypeReportExcel, generateMultiTestTypeReportExcel } = require('../utils/exportTestExcel');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

// GET /api/export - Export attendance data
router.get('/', async (req, res) => {
  try {
    const { month, year, format, sessionFilter } = req.query;

    if (!month || !year || !format) {
      return res.status(400).json({ message: 'Month, year, and format are required.' });
    }

    const m = parseInt(month) - 1;
    const y = parseInt(year);
    const startDate = new Date(y, m, 1);
    const endDate = new Date(y, m + 1, 0, 23, 59, 59);

    // Get sessions
    const sessionQuery = {
      coach: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    };

    if (sessionFilter && sessionFilter !== 'all') {
      sessionQuery.name = sessionFilter;
    }

    const sessions = await Session.find(sessionQuery).sort({ date: 1 });
    const sessionIds = sessions.map(s => s._id);

    // Get attendance
    const attendance = await Attendance.find({
      session: { $in: sessionIds },
      coach: req.user._id
    }).populate('athlete', 'name isNewAthlete joinDate');

    // Get athletes
    const athletes = await Athlete.find({
      coach: req.user._id,
      active: true
    }).sort({ name: 1 });

    const data = {
      sessions,
      attendance,
      athletes,
      month: m + 1,
      year: y
    };

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (format === 'excel') {
      const workbook = await generateExcel(data);
      const filename = `Attendance_${monthNames[m]}_${y}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'pdf') {
      const filename = `Attendance_${monthNames[m]}_${y}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const doc = generatePdf(data);
      doc.pipe(res);
      doc.end();
    } else {
      res.status(400).json({ message: 'Invalid format. Use "excel" or "pdf".' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error exporting data.' });
  }
});

// ────────────────────────────────────────────────
// GET /api/export/tests - Export test results data
// ────────────────────────────────────────────────
router.get('/tests', async (req, res) => {
  try {
    const { mode, athleteId, testTypeId, testTypeIds, period, startDate: startStr, endDate: endStr, format } = req.query;

    if (!mode || !format) {
      return res.status(400).json({ message: 'Mode and format are required.' });
    }

    if (mode === 'athlete' && !athleteId) {
      return res.status(400).json({ message: 'athleteId is required for athlete mode.' });
    }

    // Support both testTypeIds (comma-separated) and legacy testTypeId (single)
    let testTypeIdList = [];
    if (mode === 'test') {
      if (testTypeIds) {
        testTypeIdList = testTypeIds.split(',').filter(id => id.trim());
      } else if (testTypeId) {
        testTypeIdList = [testTypeId];
      }
      if (testTypeIdList.length === 0) {
        return res.status(400).json({ message: 'At least one testTypeId is required for test mode.' });
      }
    }

    // ── Compute date range ──
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case '1w':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        endDate = new Date(now);
        break;
      case '1m':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        endDate = new Date(now);
        break;
      case '3m':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        endDate = new Date(now);
        break;
      case '6m':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 6);
        endDate = new Date(now);
        break;
      case 'custom':
        if (!startStr || !endStr) {
          return res.status(400).json({ message: 'startDate and endDate required for custom period.' });
        }
        startDate = new Date(startStr);
        endDate = new Date(endStr);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        // No period filter — get all results
        startDate = new Date(2000, 0, 1);
        endDate = new Date(now);
        break;
    }

    // ── Mode: Single Athlete ──
    if (mode === 'athlete') {
      const athlete = await Athlete.findOne({ _id: athleteId, coach: req.user._id });
      if (!athlete) {
        return res.status(404).json({ message: 'Athlete not found.' });
      }

      const results = await TestResult.find({
        coach: req.user._id,
        athlete: athleteId,
        date: { $gte: startDate, $lte: endDate }
      })
        .populate('testType', 'title category measureType targetDistance targetTime')
        .sort({ date: -1 });

      const testTypes = await TestType.find({ coach: req.user._id, active: true });

      const data = { athlete, results, testTypes, startDate, endDate };

      const safeName = athlete.name.replace(/[^a-zA-Z0-9]/g, '_');

      if (format === 'excel') {
        const workbook = await generateAthleteTestExcel(data);
        const filename = `Tests_${safeName}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
      } else if (format === 'pdf') {
        const filename = `Tests_${safeName}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        const doc = generateAthleteTestPdf(data);
        doc.pipe(res);
        doc.end();
      } else {
        res.status(400).json({ message: 'Invalid format.' });
      }
    }

    // ── Mode: All Athletes for Selected Test(s) ──
    else if (mode === 'test') {
      // Fetch all selected test types
      const fetchedTestTypes = await TestType.find({
        _id: { $in: testTypeIdList },
        coach: req.user._id
      });

      if (fetchedTestTypes.length === 0) {
        return res.status(404).json({ message: 'No matching test types found.' });
      }

      // For a single test type, use the same generator as multi-test for consistency
      if (fetchedTestTypes.length === 1) {
        const testType = fetchedTestTypes[0];

        const results = await TestResult.find({
          coach: req.user._id,
          testType: testType._id,
          date: { $gte: startDate, $lte: endDate }
        })
          .populate('athlete', 'name')
          .sort({ date: -1 });

        const athleteIdsWithResults = [...new Set(results.map(r => (r.athlete?._id || r.athlete)?.toString()))];
        const athletes = await Athlete.find({
          _id: { $in: athleteIdsWithResults },
          coach: req.user._id
        }).sort({ name: 1 });

        // Fetch results before the selected period so Previous columns are populated
        const prevResultsRaw = await TestResult.find({
          coach: req.user._id,
          testType: testType._id,
          athlete: { $in: athleteIdsWithResults },
          date: { $lt: startDate }
        }).sort({ date: -1 });

        const previousResultsByAthlete = {};
        prevResultsRaw.forEach(r => {
          const aId = (r.athlete?._id || r.athlete)?.toString();
          if (!previousResultsByAthlete[aId]) previousResultsByAthlete[aId] = [];
          previousResultsByAthlete[aId].push(r);
        });

        const allTestData = [{ testType, results, athletes, startDate, endDate, previousResultsByAthlete }];
        const safeName = testType.title.replace(/[^a-zA-Z0-9]/g, '_');

        if (format === 'excel') {
          const workbook = await generateMultiTestTypeReportExcel(allTestData);
          const filename = `TestReport_${safeName}.xlsx`;
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          await workbook.xlsx.write(res);
          res.end();
        } else if (format === 'pdf') {
          const filename = `TestReport_${safeName}.pdf`;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          const doc = generateMultiTestTypeReportPdf(allTestData);
          doc.pipe(res);
          doc.end();
        } else {
          res.status(400).json({ message: 'Invalid format.' });
        }
      }
      // For multiple test types, build a combined report with one section per test
      else {
        const allTestData = [];
        for (const testType of fetchedTestTypes) {
          const results = await TestResult.find({
            coach: req.user._id,
            testType: testType._id,
            date: { $gte: startDate, $lte: endDate }
          })
            .populate('athlete', 'name')
            .sort({ date: -1 });

          const athleteIdsWithResults = [...new Set(results.map(r => (r.athlete?._id || r.athlete)?.toString()))];
          const athletes = await Athlete.find({
            _id: { $in: athleteIdsWithResults },
            coach: req.user._id
          }).sort({ name: 1 });

          // Fetch all results BEFORE the selected period so the PDF can show the
          // true "Previous" result regardless of the time window chosen.
          const prevResultsRaw = await TestResult.find({
            coach: req.user._id,
            testType: testType._id,
            athlete: { $in: athleteIdsWithResults },
            date: { $lt: startDate }
          }).sort({ date: -1 });

          const previousResultsByAthlete = {};
          prevResultsRaw.forEach(r => {
            const aId = (r.athlete?._id || r.athlete)?.toString();
            if (!previousResultsByAthlete[aId]) previousResultsByAthlete[aId] = [];
            previousResultsByAthlete[aId].push(r);
          });

          allTestData.push({ testType, results, athletes, startDate, endDate, previousResultsByAthlete });
        }

        const safeNames = fetchedTestTypes.map(t => t.title.replace(/[^a-zA-Z0-9]/g, '_'));
        const displayName = fetchedTestTypes.length > 2
          ? `${fetchedTestTypes.length}_Tests`
          : safeNames.join('_');

        if (format === 'excel') {
          const workbook = await generateMultiTestTypeReportExcel(allTestData);
          const filename = `TestReport_${displayName}.xlsx`;
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          await workbook.xlsx.write(res);
          res.end();
        } else if (format === 'pdf') {
          const filename = `TestReport_${displayName}.pdf`;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          const doc = generateMultiTestTypeReportPdf(allTestData);
          doc.pipe(res);
          doc.end();
        } else {
          res.status(400).json({ message: 'Invalid format.' });
        }
      }
    } else {
      res.status(400).json({ message: 'Invalid mode. Use "athlete" or "test".' });
    }
  } catch (error) {
    console.error('Test export error:', error);
    res.status(500).json({ message: error.message || 'Error exporting test data.' });
  }
});

module.exports = router;

