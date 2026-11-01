const express = require('express');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Athlete = require('../models/Athlete');
const TestResult = require('../models/TestResult');
const TestType = require('../models/TestType');
const generateExcel = require('../utils/exportExcel');
const generatePdf = require('../utils/exportPdf');
const { generateAthleteTestPdf, generateMultiTestTypeReportPdf } = require('../utils/exportTestPdf');
const { generateAthleteTestExcel, generateMultiTestTypeReportExcel } = require('../utils/exportTestExcel');
const auth = require('../middleware/auth');
const { monthRange, clientToday, dayRange, parseDayKey } = require('../utils/dates');
const { backfillScheduledSessions } = require('../utils/sessionGenerator');

const { lineageOf, lineageQuery } = TestType;
const TYPE_FIELDS = 'title category measureType targetDistance targetTime lineageId version validFrom validTo isCurrent active';

const router = express.Router();

router.use(auth);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const sendWorkbook = async (res, workbook, filename) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

const sendPdf = (res, doc, filename) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.end();
};

// GET /api/export - Export attendance data
router.get('/', async (req, res) => {
  try {
    const { month, year, format, sessionFilter } = req.query;

    if (!month || !year || !format) {
      return res.status(400).json({ message: 'Month, year, and format are required.' });
    }
    if (!['excel', 'pdf'].includes(format)) {
      return res.status(400).json({ message: 'Invalid format. Use "excel" or "pdf".' });
    }

    const m = parseInt(month, 10) - 1;
    const y = parseInt(year, 10);
    if (!(m >= 0 && m <= 11) || !y) return res.status(400).json({ message: 'Invalid month or year.' });
    await backfillScheduledSessions(req.user._id, clientToday(req.query.today));
    const { start: startDate, end: endDate } = monthRange(y, m + 1);

    const sessionQuery = {
      coach: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    };
    if (sessionFilter && sessionFilter !== 'all') {
      sessionQuery.name = sessionFilter;
    }

    const sessions = await Session.find(sessionQuery).sort({ date: 1, time: 1 });
    if (sessions.length === 0) {
      return res.status(404).json({ message: 'No sessions found for this month.' });
    }

    const attendance = await Attendance.find({
      session: { $in: sessions.map((s) => s._id) },
      coach: req.user._id
    }).populate('athlete', 'name joinDate');

    // Active athletes, plus anyone archived since who was recorded this month, so an
    // old month's report still lists everyone who trained.
    const recorded = [...new Set(attendance.map((a) => String(a.athlete?._id || a.athlete)))];
    const athletes = await Athlete.find({
      coach: req.user._id,
      $or: [{ active: true }, { _id: { $in: recorded } }]
    }).sort({ name: 1 });

    const data = { sessions, attendance, athletes, month: m + 1, year: y };
    const base = `Attendance_${MONTH_NAMES[m]}_${y}`;

    if (format === 'excel') await sendWorkbook(res, await generateExcel(data), `${base}.xlsx`);
    else sendPdf(res, generatePdf(data), `${base}.pdf`);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error exporting data.' });
  }
});

// The export window in UTC calendar days, ending on the coach's today.
const periodRange = (period, today, startStr, endStr) => {
  const end = new Date(dayRange(today).end.getTime() - 1);
  const [y, m, d] = today.split('-').map(Number);
  const monthsBack = { '1m': 1, '3m': 3, '6m': 6 }[period];
  if (period === '1w') return { startDate: new Date(Date.UTC(y, m - 1, d - 7)), endDate: end };
  if (monthsBack) return { startDate: new Date(Date.UTC(y, m - 1 - monthsBack, d)), endDate: end };
  if (period === 'custom') {
    const s = parseDayKey(startStr);
    const e = parseDayKey(endStr);
    if (!startStr || !endStr || !s || !e) return { error: 'startDate and endDate required for custom period.' };
    if (s > e) return { error: 'The start date is after the end date.' };
    return { startDate: dayRange(s).start, endDate: new Date(dayRange(e).end.getTime() - 1) };
  }
  // All time: a sentinel start the PDF recognises.
  return { startDate: new Date(Date.UTC(2000, 0, 1)), endDate: end };
};

// ────────────────────────────────────────────────
// GET /api/export/tests - Export test results data
// ────────────────────────────────────────────────
router.get('/tests', async (req, res) => {
  try {
    const { mode, athleteId, testTypeId, testTypeIds, period, startDate: startStr, endDate: endStr, format, excludeAthleteIds } = req.query;
    const excludedIds = new Set(excludeAthleteIds ? excludeAthleteIds.split(',').map((id) => id.trim()).filter(Boolean) : []);

    if (!mode || !format) {
      return res.status(400).json({ message: 'Mode and format are required.' });
    }
    if (!['excel', 'pdf'].includes(format)) return res.status(400).json({ message: 'Invalid format.' });
    if (!['athlete', 'test'].includes(mode)) return res.status(400).json({ message: 'Invalid mode. Use "athlete" or "test".' });

    const range = periodRange(period, clientToday(req.query.today), startStr, endStr);
    if (range.error) return res.status(400).json({ message: range.error });
    const { startDate, endDate } = range;

    // ── Mode: Single Athlete ──
    if (mode === 'athlete') {
      if (!athleteId || !mongoose.isValidObjectId(athleteId)) return res.status(400).json({ message: 'athleteId is required for athlete mode.' });
      const athlete = await Athlete.findOne({ _id: athleteId, coach: req.user._id });
      if (!athlete) return res.status(404).json({ message: 'Athlete not found.' });

      const results = await TestResult.find({
        coach: req.user._id,
        athlete: athleteId,
        date: { $gte: startDate, $lte: endDate }
      }).populate('testType', TYPE_FIELDS).sort({ date: -1 });

      const data = { athlete, results, startDate, endDate };
      const base = `Tests_${athlete.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (format === 'excel') return sendWorkbook(res, await generateAthleteTestExcel(data), `${base}.xlsx`);
      return sendPdf(res, generateAthleteTestPdf(data), `${base}.pdf`);
    }

    // ── Mode: All athletes for the selected test(s) ──
    const requested = (testTypeIds ? testTypeIds.split(',') : testTypeId ? [testTypeId] : [])
      .map((id) => id.trim()).filter((id) => mongoose.isValidObjectId(id));
    if (requested.length === 0) {
      return res.status(400).json({ message: 'At least one testTypeId is required for test mode.' });
    }

    const picked = await TestType.find({ _id: { $in: requested }, coach: req.user._id });
    if (picked.length === 0) return res.status(404).json({ message: 'No matching test types found.' });

    // Keep the order the coach picked; each test expands to all of its versions.
    const lineages = [...new Set(picked.map((t) => String(lineageOf(t))))];
    const allVersions = await TestType.find(lineageQuery(req.user._id, lineages)).sort({ version: 1 });

    const allTestData = [];
    for (const lineage of lineages) {
      const versions = allVersions.filter((v) => String(lineageOf(v)) === lineage);
      const current = versions.find((v) => v.isCurrent !== false) || versions[versions.length - 1];
      // Newest first, so the current definition leads.
      for (const version of [...versions].reverse()) {
        const results = (await TestResult.find({
          coach: req.user._id,
          testType: version._id,
          date: { $gte: startDate, $lte: endDate }
        }).populate('athlete', 'name').sort({ date: -1 }))
          .filter((r) => !excludedIds.has(String(r.athlete?._id || r.athlete)));

        // Older versions only appear when they have results in the period.
        if (results.length === 0 && version !== current) continue;

        const athleteIds = [...new Set(results.map((r) => String(r.athlete?._id || r.athlete)))];
        const athletes = await Athlete.find({ _id: { $in: athleteIds }, coach: req.user._id }).sort({ name: 1 });

        // Results before the period (same version) fill the Previous columns.
        const previous = await TestResult.find({
          coach: req.user._id,
          testType: version._id,
          athlete: { $in: athleteIds },
          date: { $lt: startDate }
        }).sort({ date: -1 });
        const previousResultsByAthlete = {};
        previous.forEach((r) => {
          const id = String(r.athlete);
          (previousResultsByAthlete[id] = previousResultsByAthlete[id] || []).push(r);
        });

        allTestData.push({ testType: version, results, athletes, startDate, endDate, previousResultsByAthlete });
      }
    }

    const titles = picked.map((t) => t.title.replace(/[^a-zA-Z0-9]/g, '_'));
    const base = `TestReport_${picked.length > 2 ? `${picked.length}_Tests` : titles.join('_')}`;
    if (format === 'excel') return sendWorkbook(res, await generateMultiTestTypeReportExcel(allTestData), `${base}.xlsx`);
    return sendPdf(res, generateMultiTestTypeReportPdf(allTestData), `${base}.pdf`);
  } catch (error) {
    console.error('Test export error:', error);
    res.status(500).json({ message: error.message || 'Error exporting test data.' });
  }
});

module.exports = router;
