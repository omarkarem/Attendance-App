const express = require('express');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Athlete = require('../models/Athlete');
const generateExcel = require('../utils/exportExcel');
const generatePdf = require('../utils/exportPdf');
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

module.exports = router;
