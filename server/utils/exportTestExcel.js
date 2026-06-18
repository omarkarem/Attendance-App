const ExcelJS = require('exceljs');

// ── Shared helpers ──

const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatPace = (distanceMeters, timeSeconds, category) => {
  if (!distanceMeters || !timeSeconds) return '-';
  if (category === 'Running') {
    const distKm = distanceMeters / 1000;
    const timeMins = timeSeconds / 60;
    const pace = timeMins / distKm;
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')} min/km`;
  } else if (category === 'Swimming') {
    const dist100 = distanceMeters / 100;
    const timeMins = timeSeconds / 60;
    const pace = timeMins / dist100;
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')} min/100m`;
  } else if (category === 'Cycling') {
    const distKm = distanceMeters / 1000;
    const timeH = timeSeconds / 3600;
    return `${(distKm / timeH).toFixed(2)} km/h`;
  }
  return formatTime(timeSeconds);
};

const formatDistance = (meters) => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters} m`;
};

const computePace = (distance, time, category) => {
  if (category === 'Running') return (time / 60) / (distance / 1000);
  if (category === 'Swimming') return (time / 60) / (distance / 100);
  if (category === 'Cycling') return (distance / 1000) / (time / 3600);
  return time;
};

const formatPaceValue = (v, category) => {
  if (category === 'Running' || category === 'Swimming') {
    const mins = Math.floor(v);
    const secs = Math.round((v - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return v.toFixed(2);
};

// Colors
const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16163a' } };
const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const accentFont = { color: { argb: 'FF6c63ff' } };
const greenFont = { bold: true, color: { argb: 'FF16a34a' } };
const redFont = { bold: true, color: { argb: 'FFdc2626' } };
const rowEvenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
const borderStyle = { style: 'thin', color: { argb: 'FFE2E8F0' } };
const cellBorder = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };


// ═══════════════════════════════════════════
// MODE 1: Single Athlete — all tests
// ═══════════════════════════════════════════

const generateAthleteTestExcel = async (data) => {
  const { athlete, results, startDate, endDate } = data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AttendTrack';
  workbook.created = new Date();

  // Group results by test type
  const grouped = {};
  results.forEach(r => {
    const typeId = r.testType?._id?.toString() || 'unknown';
    if (!grouped[typeId]) grouped[typeId] = { type: r.testType, results: [] };
    grouped[typeId].results.push(r);
  });

  // Create a sheet per test type (or one combined sheet if few types)
  const createSheet = (sheetName, typeResults, testType) => {
    const category = testType?.category || 'Other';
    const isLowerBetter = category === 'Running' || category === 'Swimming';
    const paceUnit = category === 'Running' ? 'min/km' : category === 'Swimming' ? 'min/100m' : category === 'Cycling' ? 'km/h' : 's';

    const sheet = workbook.addWorksheet(sheetName.substring(0, 31), {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'Date', key: 'date', width: 16 },
      { header: 'Distance', key: 'distance', width: 14 },
      { header: 'Time', key: 'time', width: 14 },
      { header: `Pace (${paceUnit})`, key: 'pace', width: 18 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = headerFont;
    headerRow.fill = headerFill;
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 28;

    // Sort by date
    const sorted = [...typeResults].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Find best pace
    const paces = sorted.map(r => computePace(r.distance, r.time, category));
    const bestPace = isLowerBetter ? Math.min(...paces) : Math.max(...paces);

    sorted.forEach((r, idx) => {
      const pace = computePace(r.distance, r.time, category);
      const row = sheet.addRow({
        date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        distance: formatDistance(r.distance),
        time: formatTime(r.time),
        pace: formatPaceValue(pace, category),
        notes: r.description || '',
      });

      // Alternate row color
      if (idx % 2 === 0) row.fill = rowEvenFill;

      // Highlight best pace
      const isBest = Math.abs(pace - bestPace) < 0.001;
      if (isBest && sorted.length > 1) {
        row.getCell('pace').font = greenFont;
        row.getCell('pace').value = `★ ${formatPaceValue(pace, category)}`;
      } else {
        row.getCell('pace').font = accentFont;
      }

      row.getCell('date').alignment = { horizontal: 'left' };
      row.getCell('distance').alignment = { horizontal: 'right' };
      row.getCell('time').alignment = { horizontal: 'right' };
      row.getCell('pace').alignment = { horizontal: 'right' };
    });

    // Summary row
    if (sorted.length > 1) {
      const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
      const first = paces[0];
      const latest = paces[paces.length - 1];
      const improvement = first !== 0
        ? (isLowerBetter
            ? Math.round(((first - latest) / first) * 100)
            : Math.round(((latest - first) / first) * 100))
        : 0;

      sheet.addRow({}); // blank row
      const summaryRow = sheet.addRow({
        date: 'Summary',
        distance: `Best: ${formatPaceValue(bestPace, category)}`,
        time: `Avg: ${formatPaceValue(avg, category)}`,
        pace: `Change: ${improvement >= 0 ? '+' : ''}${improvement}%`,
        notes: `${sorted.length} results`,
      });
      summaryRow.font = { bold: true, size: 10 };
      summaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
      summaryRow.getCell('pace').font = improvement >= 0 ? greenFont : redFont;
    }

    // Borders
    sheet.eachRow(row => {
      row.eachCell(cell => { cell.border = cellBorder; });
    });
  };

  if (Object.keys(grouped).length === 0) {
    const sheet = workbook.addWorksheet('No Results');
    sheet.addRow({ A: 'No test results found for the selected period.' });
  } else {
    Object.values(grouped).forEach(({ type, results: typeResults }) => {
      const name = type?.title || 'Unknown';
      createSheet(name, typeResults, type);
    });
  }

  return workbook;
};


// ═══════════════════════════════════════════
// MODE 2: All Athletes for a Specific Test
// ═══════════════════════════════════════════

const generateTestTypeReportExcel = async (data) => {
  const { testType, results, athletes, startDate, endDate } = data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AttendTrack';
  workbook.created = new Date();

  const category = testType.category;
  const isLowerBetter = category === 'Running' || category === 'Swimming';
  const paceUnit = category === 'Running' ? 'min/km' : category === 'Swimming' ? 'min/100m' : category === 'Cycling' ? 'km/h' : 's';

  const sheet = workbook.addWorksheet(`${testType.title}`.substring(0, 31), {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  });

  sheet.columns = [
    { header: 'Athlete', key: 'athlete', width: 22 },
    { header: 'Tests', key: 'tests', width: 10 },
    { header: `Best (${paceUnit})`, key: 'best', width: 16 },
    { header: `Latest (${paceUnit})`, key: 'latest', width: 16 },
    { header: `Avg (${paceUnit})`, key: 'avg', width: 16 },
    { header: 'Change', key: 'change', width: 12 },
    { header: 'Last Test Date', key: 'lastDate', width: 16 },
  ];

  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = headerFont;
  headerRow.fill = headerFill;
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 30;

  // Group results by athlete
  const resultsByAthlete = {};
  results.forEach(r => {
    const aId = (r.athlete?._id || r.athlete)?.toString();
    if (!resultsByAthlete[aId]) resultsByAthlete[aId] = [];
    resultsByAthlete[aId].push(r);
  });

  athletes.forEach((athlete, idx) => {
    const athleteResults = resultsByAthlete[athlete._id.toString()] || [];

    if (athleteResults.length === 0) {
      const row = sheet.addRow({
        athlete: athlete.name,
        tests: 0,
        best: '-', latest: '-', avg: '-', change: '-', lastDate: '-'
      });
      if (idx % 2 === 0) row.fill = rowEvenFill;
      row.font = { color: { argb: 'FF94a3b8' } };
    } else {
      const sorted = [...athleteResults].sort((a, b) => new Date(a.date) - new Date(b.date));
      const paces = sorted.map(r => computePace(r.distance, r.time, category));

      const best = isLowerBetter ? Math.min(...paces) : Math.max(...paces);
      const latest = paces[paces.length - 1];
      const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
      const first = paces[0];
      const improvement = first !== 0
        ? (isLowerBetter
            ? Math.round(((first - latest) / first) * 100)
            : Math.round(((latest - first) / first) * 100))
        : 0;

      const row = sheet.addRow({
        athlete: athlete.name,
        tests: athleteResults.length,
        best: formatPaceValue(best, category),
        latest: formatPaceValue(latest, category),
        avg: formatPaceValue(avg, category),
        change: `${improvement >= 0 ? '+' : ''}${improvement}%`,
        lastDate: new Date(sorted[sorted.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      });

      if (idx % 2 === 0) row.fill = rowEvenFill;

      row.getCell('best').font = greenFont;
      row.getCell('change').font = improvement >= 0 ? greenFont : redFont;
      row.getCell('tests').alignment = { horizontal: 'center' };
      row.getCell('best').alignment = { horizontal: 'center' };
      row.getCell('latest').alignment = { horizontal: 'center' };
      row.getCell('avg').alignment = { horizontal: 'center' };
      row.getCell('change').alignment = { horizontal: 'center' };
      row.getCell('lastDate').alignment = { horizontal: 'center' };
    }
  });

  // Borders
  sheet.eachRow(row => {
    row.eachCell(cell => { cell.border = cellBorder; });
  });

  return workbook;
};


// ═══════════════════════════════════════════
// MODE 3: Multiple Test Types — one sheet per test
// ═══════════════════════════════════════════

const generateMultiTestTypeReportExcel = async (allTestData) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AttendTrack';
  workbook.created = new Date();

  for (const { testType, results, athletes, previousResultsByAthlete } of allTestData) {
    const category = testType.category;
    const isLowerBetter = category === 'Running' || category === 'Swimming';
    const paceUnit = category === 'Running' ? 'min/km' : category === 'Swimming' ? 'min/100m' : category === 'Cycling' ? 'km/h' : 's';

    const sheetName = `${testType.title}`.substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
    });

    sheet.columns = [
      { header: 'Athlete', key: 'athlete', width: 22 },
      { header: `Previous (${paceUnit})`, key: 'previous', width: 16 },
      { header: `Prev Avg (${paceUnit})`, key: 'prevAvg', width: 16 },
      { header: `Latest (${paceUnit})`, key: 'latest', width: 16 },
      { header: `Avg (${paceUnit})`, key: 'avg', width: 16 },
      { header: 'Change', key: 'change', width: 12 },
      { header: 'Last Test', key: 'lastDate', width: 16 },
      { header: 'Prev Date', key: 'prevDate', width: 16 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = headerFont;
    headerRow.fill = headerFill;
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 30;

    // Group results by athlete
    const resultsByAthlete = {};
    results.forEach(r => {
      const aId = (r.athlete?._id || r.athlete)?.toString();
      if (!resultsByAthlete[aId]) resultsByAthlete[aId] = [];
      resultsByAthlete[aId].push(r);
    });

    athletes.forEach((athlete, idx) => {
      const athleteResults = resultsByAthlete[athlete._id.toString()] || [];

      if (athleteResults.length === 0) {
        const row = sheet.addRow({
          athlete: athlete.name,
          previous: '-', prevAvg: '-', latest: '-', avg: '-', change: '-', lastDate: '-', prevDate: '-'
        });
        if (idx % 2 === 0) row.fill = rowEvenFill;
        row.font = { color: { argb: 'FF94a3b8' } };
      } else {
        const sorted = [...athleteResults].sort((a, b) => new Date(a.date) - new Date(b.date));
        const paces = sorted.map(r => computePace(r.distance, r.time, category));

        const latest = paces[paces.length - 1];
        const avg = paces.reduce((a, b) => a + b, 0) / paces.length;

        // Previous results (before the period)
        const prevResultsRaw = (previousResultsByAthlete && previousResultsByAthlete[athlete._id.toString()]) || [];
        const prevSorted = [...prevResultsRaw].sort((a, b) => new Date(a.date) - new Date(b.date));
        const prevPaces = prevSorted.map(r => computePace(r.distance, r.time, category));

        const baselinePace = prevPaces.length > 0 ? prevPaces[prevPaces.length - 1] : paces[0];
        const improvement = baselinePace !== 0
          ? (isLowerBetter
              ? Math.round(((baselinePace - latest) / baselinePace) * 100)
              : Math.round(((latest - baselinePace) / baselinePace) * 100))
          : 0;

        const prevAvgPace = prevPaces.length > 0
          ? prevPaces.reduce((a, b) => a + b, 0) / prevPaces.length
          : null;

        const mostRecentPrev = prevSorted.length > 0 ? prevSorted[prevSorted.length - 1] : null;
        const prevDateStr = mostRecentPrev
          ? new Date(mostRecentPrev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '-';

        const row = sheet.addRow({
          athlete: athlete.name,
          previous: mostRecentPrev ? formatTime(mostRecentPrev.time) : '-',
          prevAvg: prevAvgPace !== null ? formatPaceValue(prevAvgPace, category) : '-',
          latest: formatPaceValue(latest, category),
          avg: formatPaceValue(avg, category),
          change: `${improvement >= 0 ? '+' : ''}${improvement}%`,
          lastDate: new Date(sorted[sorted.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          prevDate: prevDateStr,
        });

        if (idx % 2 === 0) row.fill = rowEvenFill;

        row.getCell('latest').font = accentFont;
        row.getCell('change').font = improvement >= 0 ? greenFont : redFont;
        ['previous', 'prevAvg', 'latest', 'avg', 'change', 'lastDate', 'prevDate'].forEach(k => {
          row.getCell(k).alignment = { horizontal: 'center' };
        });
      }
    });

    // Borders
    sheet.eachRow(row => {
      row.eachCell(cell => { cell.border = cellBorder; });
    });
  }

  return workbook;
};



module.exports = { generateAthleteTestExcel, generateTestTypeReportExcel, generateMultiTestTypeReportExcel };
