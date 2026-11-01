const PDFDocument = require('pdfkit');
const { writeFooter, isAllTime, formatPeriodLabel } = require('./pdfHelpers');
const { formatTime, formatDistance, metricFor, formatMetric, formatRaw, metricUnit, improvement, versionedTitle } = require('./testMetrics');

// ── Colors ──
const C = {
  primary: '#1a1a2e',
  headerBg: '#16163a',
  headerText: '#ffffff',
  accent: '#6c63ff',
  accentLight: '#eef2ff',
  green: '#16a34a',
  red: '#dc2626',
  muted: '#94a3b8',
  subtitle: '#64748b',
  rowEven: '#f8f9fa',
  rowOdd: '#ffffff',
  border: '#e2e8f0',
};

// Category colors for visual badges
const categoryColors = {
  Running: '#f97316',
  Swimming: '#3b82f6',
  Cycling: '#22c55e',
  Other: '#a855f7',
};

const shortDate = (d, withYear = true) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });
const unitSuffix = (testType) => (metricUnit(testType) ? ` (${metricUnit(testType)})` : '');
const changeText = (pct) => (pct == null ? '-' : `${pct >= 0 ? '+' : ''}${pct}%`);
const changeColor = (pct) => (pct == null ? C.muted : pct >= 0 ? C.green : C.red);
const valuesOf = (results, testType) => results.map((r) => metricFor(testType).value(r)).filter(Number.isFinite);
const bestOf = (values, testType) => (values.length ? (metricFor(testType).lowerIsBetter ? Math.min(...values) : Math.max(...values)) : null);
const fmtValue = (v, testType) => (v == null ? '-' : metricFor(testType).format(v));
const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const mean = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);

const drawStatCards = (doc, cards, cardW = 115) => {
  const cardH = 40;
  const gap = 14;
  const y = doc.y;
  const startX = (doc.page.width - (cardW * cards.length + gap * (cards.length - 1))) / 2;
  cards.forEach(([label, value, color], i) => {
    const x = startX + i * (cardW + gap);
    doc.roundedRect(x, y, cardW, cardH, 6).fill(C.accentLight);
    doc.fontSize(8).font('Helvetica').fillColor(C.subtitle).text(label, x, y + 6, { width: cardW, align: 'center' });
    doc.fontSize(16).font('Helvetica-Bold').fillColor(color || C.accent).text(String(value), x, y + 19, { width: cardW, align: 'center' });
  });
  doc.y = y + cardH + 20;
};

// Draws one table row of [text, width, { align, font, color }] cells, each clipped to one line.
const drawCells = (doc, y, cells, startX = 30) => {
  let x = startX;
  cells.forEach(([text, width, opts = {}]) => {
    const size = opts.size || 7;
    const pad = opts.pad ?? 0;
    doc.fontSize(size).font(opts.font || 'Helvetica').fillColor(opts.color || C.primary)
      .text(String(text), x + pad, y, { width: width - pad - 2, height: size + 3, align: opts.align || 'center', ellipsis: true });
    x += width;
  });
};

// ═══════════════════════════════════════════
// MODE 1: Single Athlete - all tests
// ═══════════════════════════════════════════

const generateAthleteTestPdf = (data) => {
  const { athlete, results, startDate, endDate } = data;
  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'portrait' });
  const width = doc.page.width - 60;

  doc.rect(30, 20, width, 4).fill(C.accent);
  doc.fontSize(22).font('Helvetica-Bold').fillColor(C.primary).text('Athlete Test Report', 30, 34, { align: 'center' });
  doc.fontSize(14).font('Helvetica-Bold').fillColor(C.accent).text(athlete.name, { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor(C.subtitle).text(formatPeriodLabel(startDate, endDate), { align: 'center' });
  doc.moveDown(0.6);

  // Each test version is its own group: different definitions are not compared.
  const grouped = new Map();
  results.forEach((r) => {
    const key = r.testType?._id?.toString() || 'unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r);
  });

  drawStatCards(doc, [
    ['Total Tests', results.length],
    ['Test Types', grouped.size],
    ['Period', isAllTime(startDate) ? 'All' : `${Math.ceil((endDate - startDate) / 86400000)}d`, C.subtitle]
  ], 120);

  const col = { date: 80, distance: 80, time: 80, pace: 110 };
  col.desc = width - col.date - col.distance - col.time - col.pace;

  grouped.forEach((group) => {
    const typeResults = [...group].sort((a, b) => new Date(a.date) - new Date(b.date));
    const testType = typeResults[0]?.testType;
    const category = testType?.category || 'Other';
    const catColor = categoryColors[category] || categoryColors.Other;
    const values = typeResults.map((r) => metricFor(testType).value(r));
    const best = bestOf(values.filter(Number.isFinite), testType);

    if (doc.y + 80 > doc.page.height - 50) { doc.addPage(); doc.y = 30; }

    const sectionY = doc.y;
    doc.roundedRect(30, sectionY, width, 28, 4).fill(catColor);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff').text(versionedTitle(testType), 40, sectionY + 7, { width: width - 140, height: 14, ellipsis: true });
    doc.fontSize(9).font('Helvetica').fillColor('#ffffff')
      .text(`${category} • ${typeResults.length} result${typeResults.length !== 1 ? 's' : ''}`, 30, sectionY + 8, { width: width - 10, align: 'right' });

    let y = sectionY + 34;
    doc.rect(30, y, width, 20).fill(C.primary);
    drawCells(doc, y + 6, [
      ['Date', col.date, { align: 'left', pad: 5, font: 'Helvetica-Bold', color: C.headerText }],
      ['Distance', col.distance, { align: 'right', font: 'Helvetica-Bold', color: C.headerText }],
      ['Time', col.time, { align: 'right', font: 'Helvetica-Bold', color: C.headerText }],
      [metricFor(testType).label + unitSuffix(testType), col.pace, { align: 'right', font: 'Helvetica-Bold', color: C.headerText }],
      ['Notes', col.desc, { align: 'left', pad: 12, font: 'Helvetica-Bold', color: C.headerText }]
    ]);
    y += 20;

    typeResults.forEach((r, idx) => {
      if (y + 20 > doc.page.height - 50) { doc.addPage(); y = 30; }
      doc.rect(30, y, width, 18).fill(idx % 2 === 0 ? C.rowEven : C.rowOdd);
      const isBest = typeResults.length > 1 && best != null && Math.abs(values[idx] - best) < 0.001;
      const desc = r.description || '';
      drawCells(doc, y + 5, [
        [shortDate(r.date), col.date, { align: 'left', pad: 5 }],
        [formatDistance(r.distance), col.distance, { align: 'right' }],
        [formatTime(r.time), col.time, { align: 'right' }],
        [formatMetric(r, testType), col.pace, { align: 'right', font: isBest ? 'Helvetica-Bold' : 'Helvetica', color: isBest ? C.green : C.accent }],
        [desc.length > 60 ? `${desc.substring(0, 60)}...` : desc, col.desc, { align: 'left', pad: 12, size: 6, color: C.muted }]
      ]);
      y += 18;
    });

    if (typeResults.length > 1) {
      if (y + 22 > doc.page.height - 50) { doc.addPage(); y = 30; }
      doc.rect(30, y, width, 22).fill(C.accentLight);
      const finite = values.filter(Number.isFinite);
      const change = improvement(finite[0], finite[finite.length - 1], testType);
      const unit = metricUnit(testType);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(C.subtitle);
      doc.text(`Best: ${fmtValue(best, testType)} ${unit}`, 40, y + 4);
      doc.text(`Avg: ${fmtValue(average(finite), testType)} ${unit}`, 180, y + 4);
      doc.fillColor(changeColor(change)).text(`Improvement: ${changeText(change)}`, 310, y + 4);
      doc.fontSize(6).font('Helvetica').fillColor(C.muted).text('(vs first result)', 310, y + 14);
      y += 24;
    }

    doc.y = y + 10;
  });

  if (results.length === 0) {
    doc.fontSize(12).font('Helvetica').fillColor(C.muted)
      .text('No test results found for the selected period.', 30, doc.y, { width, align: 'center' });
  }

  writeFooter(doc, C.muted);
  return doc;
};

// ═══════════════════════════════════════════
// MODE 2: One or more tests, all athletes (one section per test version)
// ═══════════════════════════════════════════

const generateMultiTestTypeReportPdf = (allTestData) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'portrait' });
  const width = doc.page.width - 60;
  const { startDate, endDate } = allTestData[0];

  doc.rect(30, 20, width, 4).fill(C.accent);
  doc.fontSize(22).font('Helvetica-Bold').fillColor(C.primary)
    .text(allTestData.length === 1 ? 'Test Report' : 'Multi-Test Report', 30, 34, { align: 'center' });
  doc.fontSize(12).font('Helvetica').fillColor(C.subtitle)
    .text(`${allTestData.length} ${allTestData.length === 1 ? 'Test' : 'Tests'} • ${formatPeriodLabel(startDate, endDate)}`, { align: 'center' });
  doc.moveDown(0.6);

  // Test names as centered pill badges
  const pillH = 20;
  const pillGap = 8;
  const pills = allTestData.map(({ testType }) => {
    const label = `${versionedTitle(testType)}  •  ${testType.category}`;
    const pillW = Math.min(width, doc.fontSize(8).font('Helvetica-Bold').widthOfString(label) + 24);
    return { label, pillW, color: categoryColors[testType.category] || categoryColors.Other };
  });
  const rows = [];
  pills.forEach((pill) => {
    const row = rows[rows.length - 1];
    if (row && row.w + pillGap + pill.pillW <= width) { row.items.push(pill); row.w += pillGap + pill.pillW; } else rows.push({ items: [pill], w: pill.pillW });
  });
  let pillY = doc.y;
  rows.forEach((row) => {
    let px = 30 + (width - row.w) / 2;
    row.items.forEach((pill) => {
      doc.roundedRect(px, pillY, pill.pillW, pillH, pillH / 2).fill(pill.color);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff').text(pill.label, px, pillY + 6, { width: pill.pillW, height: 11, align: 'center', ellipsis: true });
      px += pill.pillW + pillGap;
    });
    pillY += pillH + 6;
  });
  doc.y = pillY + 8;

  allTestData.forEach(({ testType, results, athletes, startDate: sd, endDate: ed, previousResultsByAthlete }, sectionIdx) => {
    if (sectionIdx > 0) doc.addPage();

    const category = testType.category;
    const catColor = categoryColors[category] || categoryColors.Other;
    const metric = metricFor(testType);
    const unit = unitSuffix(testType);
    const isCycling = category === 'Cycling';

    const sectionY = doc.y;
    doc.rect(30, sectionY, width, 4).fill(catColor);
    doc.fontSize(18).font('Helvetica-Bold').fillColor(C.primary).text(versionedTitle(testType), 30, sectionY + 12, { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor(C.subtitle).text(`${category} • ${formatPeriodLabel(sd, ed)}`, { align: 'center' });
    doc.moveDown(0.6);

    drawStatCards(doc, [
      ['Athletes', athletes.length],
      ['Total Results', results.length],
      [`Best${unit}`, fmtValue(bestOf(valuesOf(results, testType), testType), testType), C.green]
    ], 110);

    const byAthlete = {};
    results.forEach((r) => {
      const id = (r.athlete?._id || r.athlete)?.toString();
      (byAthlete[id] = byAthlete[id] || []).push(r);
    });

    const columns = isCycling
      ? [['Athlete', 90], [`Avg ${metric.label}`, 55], ['Avg Power', 55], ['Cadence', 50], ['Avg HR', 45], ['W/kg', 45], ['Change', 48], ['Last Test', 55], ['Prev Date', 55]]
      : [['Athlete', 95], ['Previous', 68], ['Prev Avg', 62], ['Latest', 68], [`Avg${unit}`, 64], ['Change', 50], ['Last Test', 60], ['Prev Date', 60]];

    let y = doc.y;
    doc.rect(30, y, width, 22).fill(C.headerBg);
    drawCells(doc, y + 7, columns.map(([label, w], i) => [label, w, { align: i === 0 ? 'left' : 'center', pad: i === 0 ? 5 : 0, font: 'Helvetica-Bold', color: C.headerText }]));
    y += 22;

    athletes.forEach((athlete, idx) => {
      if (y + 22 > doc.page.height - 50) { doc.addPage(); y = 30; }
      doc.rect(30, y, width, 22).fill(idx % 2 === 0 ? C.rowEven : C.rowOdd);
      doc.moveTo(30, y + 22).lineTo(doc.page.width - 30, y + 22).strokeColor(C.border).lineWidth(0.5).stroke();

      const own = [...(byAthlete[athlete._id.toString()] || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
      const prev = [...((previousResultsByAthlete && previousResultsByAthlete[athlete._id.toString()]) || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
      const name = [athlete.name, columns[0][1], { align: 'left', pad: 5, font: 'Helvetica-Bold' }];

      if (own.length === 0) {
        drawCells(doc, y + 7, [name, ...columns.slice(1).map(([, w]) => ['-', w, { color: C.muted }])]);
        y += 22;
        return;
      }

      const values = valuesOf(own, testType);
      const prevValues = valuesOf(prev, testType);
      const latestValue = values[values.length - 1];
      // Baseline: the last result before the period, else the first one in it.
      const baseline = prevValues.length ? prevValues[prevValues.length - 1] : (values.length > 1 ? values[0] : null);
      const change = baseline == null ? null : improvement(baseline, latestValue, testType);
      const latest = own[own.length - 1];
      const lastPrev = prev[prev.length - 1];
      const dates = [
        [shortDate(latest.date, false), isCycling ? 55 : 60, { color: C.subtitle }],
        [lastPrev ? shortDate(lastPrev.date, false) : '-', isCycling ? 55 : 60, { color: C.muted }]
      ];

      if (isCycling) {
        const avgPower = mean(own.filter((r) => r.avgPower != null).map((r) => r.avgPower));
        const avgCadence = mean(own.filter((r) => r.avgCadence != null).map((r) => r.avgCadence));
        const avgHR = mean(own.filter((r) => r.avgHeartRate != null).map((r) => r.avgHeartRate));
        const wkg = latest.avgPower && latest.weight ? (latest.avgPower / latest.weight).toFixed(2) : null;
        drawCells(doc, y + 7, [
          name,
          [fmtValue(average(values), testType), 55, { font: 'Helvetica-Bold', color: C.accent }],
          [avgPower ? `${avgPower}W` : '-', 55, { color: avgPower ? C.primary : C.muted }],
          [avgCadence ? String(avgCadence) : '-', 50, { color: avgCadence ? C.primary : C.muted }],
          [avgHR ? String(avgHR) : '-', 45, { color: avgHR ? C.primary : C.muted }],
          [wkg || '-', 45, { font: 'Helvetica-Bold', color: wkg ? C.green : C.muted }],
          [changeText(change), 48, { font: 'Helvetica-Bold', color: changeColor(change) }],
          ...dates
        ]);
      } else {
        drawCells(doc, y + 7, [
          name,
          [lastPrev ? formatRaw(lastPrev, testType) : '-', 68, { color: lastPrev ? C.subtitle : C.muted }],
          [prevValues.length ? fmtValue(average(prevValues), testType) : '-', 62, { color: prevValues.length ? C.subtitle : C.muted }],
          [formatRaw(latest, testType), 68, { font: 'Helvetica-Bold', color: C.accent }],
          [fmtValue(average(values), testType), 64, { color: C.subtitle }],
          [changeText(change), 50, { font: 'Helvetica-Bold', color: changeColor(change) }],
          ...dates
        ]);
      }
      y += 22;
    });

    if (results.length === 0) {
      doc.fontSize(12).font('Helvetica').fillColor(C.muted)
        .text('No test results found for the selected period.', 30, y + 10, { width, align: 'center' });
      y += 30;
    }
    doc.y = y + 10;
  });

  writeFooter(doc, C.muted);
  return doc;
};

module.exports = { generateAthleteTestPdf, generateMultiTestTypeReportPdf };
