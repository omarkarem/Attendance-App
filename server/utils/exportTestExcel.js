const ExcelJS = require('exceljs');
const { formatTime, formatDistance, metricFor, formatRaw, metricUnit, improvement, versionedTitle } = require('./testMetrics');

// Colors
const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16163a' } };
const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const accentFont = { color: { argb: 'FF6c63ff' } };
const greenFont = { bold: true, color: { argb: 'FF16a34a' } };
const redFont = { bold: true, color: { argb: 'FFdc2626' } };
const rowEvenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
const borderStyle = { style: 'thin', color: { argb: 'FFE2E8F0' } };
const cellBorder = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

const longDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const unitSuffix = (testType) => (metricUnit(testType) ? ` (${metricUnit(testType)})` : '');
const valuesOf = (results, testType) => results.map((r) => metricFor(testType).value(r)).filter(Number.isFinite);
const fmtValue = (v, testType) => (v == null ? '-' : metricFor(testType).format(v));
const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const mean = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);
const changeText = (pct) => (pct == null ? '-' : `${pct >= 0 ? '+' : ''}${pct}%`);

const styleHeader = (sheet, height = 28) => {
  const headerRow = sheet.getRow(1);
  headerRow.font = headerFont;
  headerRow.fill = headerFill;
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = height;
};

const addBorders = (sheet) => sheet.eachRow((row) => row.eachCell((cell) => { cell.border = cellBorder; }));

// Worksheet names must be unique and at most 31 characters, without : \ / ? * [ ].
const uniqueSheetName = (workbook, name) => {
  const base = (name || 'Sheet').replace(/[:\\/?*[\]]/g, ' ').substring(0, 31);
  let candidate = base;
  for (let i = 2; workbook.getWorksheet(candidate); i++) candidate = `${base.substring(0, 27)} (${i})`;
  return candidate;
};

// ═══════════════════════════════════════════
// MODE 1: Single Athlete — one sheet per test version
// ═══════════════════════════════════════════

const generateAthleteTestExcel = async (data) => {
  const { results } = data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AttendTrack';
  workbook.created = new Date();

  const grouped = new Map();
  results.forEach((r) => {
    const key = r.testType?._id?.toString() || 'unknown';
    if (!grouped.has(key)) grouped.set(key, { type: r.testType, results: [] });
    grouped.get(key).results.push(r);
  });

  if (grouped.size === 0) {
    workbook.addWorksheet('No Results').addRow(['No test results found for the selected period.']);
    return workbook;
  }

  grouped.forEach(({ type: testType, results: typeResults }) => {
    const metric = metricFor(testType);
    const sheet = workbook.addWorksheet(uniqueSheetName(workbook, versionedTitle(testType)), { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'Date', key: 'date', width: 16 },
      { header: 'Distance', key: 'distance', width: 14 },
      { header: 'Time', key: 'time', width: 14 },
      { header: `${metric.label}${unitSuffix(testType)}`, key: 'pace', width: 18 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    styleHeader(sheet);

    const sorted = [...typeResults].sort((a, b) => new Date(a.date) - new Date(b.date));
    const values = sorted.map((r) => metric.value(r));
    const finite = values.filter(Number.isFinite);
    const best = finite.length ? (metric.lowerIsBetter ? Math.min(...finite) : Math.max(...finite)) : null;

    sorted.forEach((r, idx) => {
      const row = sheet.addRow({
        date: longDate(r.date),
        distance: formatDistance(r.distance),
        time: formatTime(r.time),
        pace: fmtValue(values[idx], testType),
        notes: r.description || '',
      });
      if (idx % 2 === 0) row.fill = rowEvenFill;
      const isBest = sorted.length > 1 && best != null && Math.abs(values[idx] - best) < 0.001;
      row.getCell('pace').font = isBest ? greenFont : accentFont;
      if (isBest) row.getCell('pace').value = `★ ${fmtValue(values[idx], testType)}`;
      row.getCell('date').alignment = { horizontal: 'left' };
      ['distance', 'time', 'pace'].forEach((k) => { row.getCell(k).alignment = { horizontal: 'right' }; });
    });

    if (sorted.length > 1) {
      const change = improvement(finite[0], finite[finite.length - 1], testType);
      sheet.addRow({});
      const summaryRow = sheet.addRow({
        date: 'Summary',
        distance: `Best: ${fmtValue(best, testType)}`,
        time: `Avg: ${fmtValue(average(finite), testType)}`,
        pace: `Change: ${changeText(change)}`,
        notes: `${sorted.length} results`,
      });
      summaryRow.font = { bold: true, size: 10 };
      summaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
      summaryRow.getCell('pace').font = change == null || change >= 0 ? greenFont : redFont;
    }

    addBorders(sheet);
  });

  return workbook;
};

// ═══════════════════════════════════════════
// MODE 2: One or more tests, all athletes — one sheet per test version
// ═══════════════════════════════════════════

const generateMultiTestTypeReportExcel = async (allTestData) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AttendTrack';
  workbook.created = new Date();

  for (const { testType, results, athletes, previousResultsByAthlete } of allTestData) {
    const unit = unitSuffix(testType);
    const isCycling = testType.category === 'Cycling';

    const sheet = workbook.addWorksheet(uniqueSheetName(workbook, versionedTitle(testType)), { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
    sheet.columns = isCycling
      ? [
        { header: 'Athlete', key: 'athlete', width: 22 },
        { header: 'Avg Speed (km/h)', key: 'avgSpeed', width: 16 },
        { header: 'Avg Power/FTP (W)', key: 'avgPower', width: 18 },
        { header: 'Avg Cadence (RPM)', key: 'avgCadence', width: 18 },
        { header: 'Avg HR (BPM)', key: 'avgHR', width: 14 },
        { header: 'W/kg', key: 'wkg', width: 10 },
        { header: 'Change', key: 'change', width: 12 },
        { header: 'Last Test', key: 'lastDate', width: 16 },
        { header: 'Prev Date', key: 'prevDate', width: 16 },
      ]
      : [
        { header: 'Athlete', key: 'athlete', width: 22 },
        { header: 'Previous', key: 'previous', width: 16 },
        { header: `Prev Avg${unit}`, key: 'prevAvg', width: 16 },
        { header: 'Latest', key: 'latest', width: 16 },
        { header: `Avg${unit}`, key: 'avg', width: 16 },
        { header: 'Change', key: 'change', width: 12 },
        { header: 'Last Test', key: 'lastDate', width: 16 },
        { header: 'Prev Date', key: 'prevDate', width: 16 },
      ];
    styleHeader(sheet, 30);

    const byAthlete = {};
    results.forEach((r) => {
      const id = (r.athlete?._id || r.athlete)?.toString();
      (byAthlete[id] = byAthlete[id] || []).push(r);
    });

    athletes.forEach((athlete, idx) => {
      const own = [...(byAthlete[athlete._id.toString()] || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
      if (own.length === 0) {
        const empty = Object.fromEntries(sheet.columns.map((c) => [c.key, '-']));
        const row = sheet.addRow({ ...empty, athlete: athlete.name });
        if (idx % 2 === 0) row.fill = rowEvenFill;
        row.font = { color: { argb: 'FF94a3b8' } };
        return;
      }

      const prev = [...((previousResultsByAthlete && previousResultsByAthlete[athlete._id.toString()]) || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
      const values = valuesOf(own, testType);
      const prevValues = valuesOf(prev, testType);
      const baseline = prevValues.length ? prevValues[prevValues.length - 1] : (values.length > 1 ? values[0] : null);
      const change = baseline == null ? null : improvement(baseline, values[values.length - 1], testType);
      const latest = own[own.length - 1];
      const lastPrev = prev[prev.length - 1];
      const common = {
        athlete: athlete.name,
        change: changeText(change),
        lastDate: longDate(latest.date),
        prevDate: lastPrev ? longDate(lastPrev.date) : '-',
      };

      let row;
      if (isCycling) {
        const avgPower = mean(own.filter((r) => r.avgPower != null).map((r) => r.avgPower));
        const avgCadence = mean(own.filter((r) => r.avgCadence != null).map((r) => r.avgCadence));
        const avgHR = mean(own.filter((r) => r.avgHeartRate != null).map((r) => r.avgHeartRate));
        const wkg = latest.avgPower && latest.weight ? (latest.avgPower / latest.weight).toFixed(2) : '-';
        row = sheet.addRow({
          ...common,
          avgSpeed: fmtValue(average(values), testType),
          avgPower: avgPower ? `${avgPower}` : '-',
          avgCadence: avgCadence ? `${avgCadence}` : '-',
          avgHR: avgHR ? `${avgHR}` : '-',
          wkg,
        });
        row.getCell('avgSpeed').font = accentFont;
        if (wkg !== '-') row.getCell('wkg').font = greenFont;
      } else {
        row = sheet.addRow({
          ...common,
          previous: lastPrev ? formatRaw(lastPrev, testType) : '-',
          prevAvg: prevValues.length ? fmtValue(average(prevValues), testType) : '-',
          latest: formatRaw(latest, testType),
          avg: fmtValue(average(values), testType),
        });
        row.getCell('latest').font = accentFont;
      }
      if (idx % 2 === 0) row.fill = rowEvenFill;
      if (change != null) row.getCell('change').font = change >= 0 ? greenFont : redFont;
      sheet.columns.slice(1).forEach((c) => { row.getCell(c.key).alignment = { horizontal: 'center' }; });
    });

    if (!isCycling && testType.measureType === 'Time') {
      sheet.addRow({});
      sheet.addRow({ athlete: 'Fixed-time test: Previous and Latest show the distance covered.' });
    }

    addBorders(sheet);
  }

  return workbook;
};

module.exports = { generateAthleteTestExcel, generateMultiTestTypeReportExcel };
