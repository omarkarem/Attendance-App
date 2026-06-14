const PDFDocument = require('pdfkit');

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

const formatPeriodLabel = (startDate, endDate) => {
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', opts)} — ${endDate.toLocaleDateString('en-US', opts)}`;
};

// ── Colors ──
const C = {
  primary: '#1a1a2e',
  headerBg: '#16163a',
  headerText: '#ffffff',
  accent: '#6c63ff',
  accentLight: '#eef2ff',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#f59e0b',
  muted: '#94a3b8',
  subtitle: '#64748b',
  rowEven: '#f8f9fa',
  rowOdd: '#ffffff',
  border: '#e2e8f0',
  cardBg: '#f1f5f9',
};

// Category colors for visual badges
const categoryColors = {
  Running: '#f97316',
  Swimming: '#3b82f6',
  Cycling: '#22c55e',
  Other: '#a855f7',
};

// ═══════════════════════════════════════════
// MODE 1: Single Athlete — all tests
// ═══════════════════════════════════════════

const generateAthleteTestPdf = (data) => {
  const { athlete, results, testTypes, startDate, endDate } = data;

  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'portrait' });

  // ── Title ──
  doc.rect(30, 20, doc.page.width - 60, 4).fill(C.accent);

  doc.fontSize(22).font('Helvetica-Bold').fillColor(C.primary)
    .text('Athlete Test Report', 30, 34, { align: 'center' });

  doc.fontSize(14).font('Helvetica-Bold').fillColor(C.accent)
    .text(athlete.name, { align: 'center' });

  doc.fontSize(10).font('Helvetica').fillColor(C.subtitle)
    .text(formatPeriodLabel(startDate, endDate), { align: 'center' });

  doc.moveDown(0.6);

  // ── Summary Cards ──
  const totalTests = results.length;
  const uniqueTypes = [...new Set(results.map(r => r.testType?._id?.toString()))].length;

  const cardY = doc.y;
  const cardW = 120;
  const cardH = 40;
  const cardGap = 16;
  const totalCardW = cardW * 3 + cardGap * 2;
  const cardStartX = (doc.page.width - totalCardW) / 2;

  const drawStatCard = (x, y, label, value, color) => {
    doc.roundedRect(x, y, cardW, cardH, 6).fill(C.accentLight);
    doc.fontSize(8).font('Helvetica').fillColor(C.subtitle)
      .text(label, x, y + 6, { width: cardW, align: 'center' });
    doc.fontSize(16).font('Helvetica-Bold').fillColor(color || C.accent)
      .text(value.toString(), x, y + 19, { width: cardW, align: 'center' });
  };

  drawStatCard(cardStartX, cardY, 'Total Tests', totalTests);
  drawStatCard(cardStartX + cardW + cardGap, cardY, 'Test Types', uniqueTypes);
  drawStatCard(cardStartX + (cardW + cardGap) * 2, cardY, 'Period', `${Math.ceil((endDate - startDate) / 86400000)}d`, C.subtitle);

  doc.y = cardY + cardH + 20;

  // ── Group results by test type ──
  const grouped = {};
  results.forEach(r => {
    const typeId = r.testType?._id?.toString() || 'unknown';
    if (!grouped[typeId]) grouped[typeId] = [];
    grouped[typeId].push(r);
  });

  // Process each test type group
  Object.keys(grouped).forEach((typeId) => {
    const typeResults = grouped[typeId].sort((a, b) => new Date(a.date) - new Date(b.date));
    const testType = typeResults[0]?.testType;
    const typeName = testType?.title || 'Unknown Test';
    const category = testType?.category || 'Other';
    const catColor = categoryColors[category] || categoryColors.Other;

    // Check page space
    if (doc.y + 80 > doc.page.height - 50) {
      doc.addPage();
      doc.y = 30;
    }

    // ── Section Header ──
    const sectionY = doc.y;
    doc.roundedRect(30, sectionY, doc.page.width - 60, 28, 4).fill(catColor);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
      .text(`${typeName}`, 40, sectionY + 7);
    doc.fontSize(9).font('Helvetica').fillColor('#ffffffcc')
      .text(`${category} • ${typeResults.length} result${typeResults.length !== 1 ? 's' : ''}`,
        30, sectionY + 8, { width: doc.page.width - 70, align: 'right' });

    doc.y = sectionY + 34;

    // ── Table Header ──
    const colWidths = { date: 80, distance: 80, time: 80, pace: 110, desc: doc.page.width - 60 - 350 };
    let tableY = doc.y;
    let tx = 30;

    doc.rect(tx, tableY, doc.page.width - 60, 20).fill(C.primary);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.headerText);
    doc.text('Date', tx + 5, tableY + 6, { width: colWidths.date });
    tx += colWidths.date;
    doc.text('Distance', tx + 5, tableY + 6, { width: colWidths.distance, align: 'right' });
    tx += colWidths.distance;
    doc.text('Time', tx + 5, tableY + 6, { width: colWidths.time, align: 'right' });
    tx += colWidths.time;
    doc.text('Pace / Speed', tx + 5, tableY + 6, { width: colWidths.pace, align: 'right' });
    tx += colWidths.pace;
    doc.text('Notes', tx + 5, tableY + 6, { width: colWidths.desc });

    tableY += 20;

    // ── Table Rows ──
    // Compute best values for highlighting
    const isLowerBetter = category === 'Running' || category === 'Swimming';
    const paceValues = typeResults.map(r => {
      if (category === 'Running') return (r.time / 60) / (r.distance / 1000);
      if (category === 'Swimming') return (r.time / 60) / (r.distance / 100);
      if (category === 'Cycling') return (r.distance / 1000) / (r.time / 3600);
      return r.time;
    });
    const bestPace = isLowerBetter ? Math.min(...paceValues) : Math.max(...paceValues);

    typeResults.forEach((r, idx) => {
      if (tableY + 20 > doc.page.height - 50) {
        doc.addPage();
        tableY = 30;
      }

      const rowBg = idx % 2 === 0 ? C.rowEven : C.rowOdd;
      doc.rect(30, tableY, doc.page.width - 60, 18).fill(rowBg);

      // Is this the best result?
      const currentPace = paceValues[idx];
      const isBest = Math.abs(currentPace - bestPace) < 0.001;

      tx = 30;
      doc.fontSize(7).font('Helvetica').fillColor(C.primary);
      doc.text(new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        tx + 5, tableY + 5, { width: colWidths.date });
      tx += colWidths.date;

      doc.text(formatDistance(r.distance), tx + 5, tableY + 5, { width: colWidths.distance, align: 'right' });
      tx += colWidths.distance;

      doc.text(formatTime(r.time), tx + 5, tableY + 5, { width: colWidths.time, align: 'right' });
      tx += colWidths.time;

      // Pace — highlight best
      if (isBest && typeResults.length > 1) {
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.green);
        doc.text(`★ ${formatPace(r.distance, r.time, category)}`, tx + 5, tableY + 5, { width: colWidths.pace, align: 'right' });
      } else {
        doc.fontSize(7).font('Helvetica').fillColor(C.accent);
        doc.text(formatPace(r.distance, r.time, category), tx + 5, tableY + 5, { width: colWidths.pace, align: 'right' });
      }
      tx += colWidths.pace;

      doc.fontSize(6).font('Helvetica').fillColor(C.muted);
      const desc = r.description || '';
      doc.text(desc.length > 40 ? desc.substring(0, 40) + '…' : desc, tx + 5, tableY + 6, { width: colWidths.desc });

      tableY += 18;
    });

    // ── Mini Stats Row ──
    if (typeResults.length > 1) {
      if (tableY + 22 > doc.page.height - 50) {
        doc.addPage();
        tableY = 30;
      }

      doc.rect(30, tableY, doc.page.width - 60, 22).fill(C.accentLight);

      const avgPace = paceValues.reduce((a, b) => a + b, 0) / paceValues.length;
      const firstPace = paceValues[0];
      const latestPace = paceValues[paceValues.length - 1];
      const improvement = firstPace !== 0
        ? (isLowerBetter
            ? Math.round(((firstPace - latestPace) / firstPace) * 100)
            : Math.round(((latestPace - firstPace) / firstPace) * 100))
        : 0;

      const formatPaceValue = (v) => {
        if (category === 'Running' || category === 'Swimming') {
          const mins = Math.floor(v);
          const secs = Math.round((v - mins) * 60);
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return v.toFixed(2);
      };

      const paceUnit = category === 'Running' ? 'min/km' : category === 'Swimming' ? 'min/100m' : category === 'Cycling' ? 'km/h' : 's';

      doc.fontSize(7).font('Helvetica-Bold').fillColor(C.subtitle);
      doc.text(`Best: ${formatPaceValue(bestPace)} ${paceUnit}`, 40, tableY + 4);
      doc.text(`Avg: ${formatPaceValue(avgPace)} ${paceUnit}`, 180, tableY + 4);
      const impColor = improvement >= 0 ? C.green : C.red;
      doc.fillColor(impColor);
      doc.text(`Improvement: ${improvement >= 0 ? '+' : ''}${improvement}%`, 310, tableY + 4);

      doc.fontSize(6).font('Helvetica').fillColor(C.muted)
        .text('(vs first result)', 310, tableY + 14);

      tableY += 24;
    }

    doc.y = tableY + 10;
  });

  // Handle empty results
  if (results.length === 0) {
    doc.fontSize(12).font('Helvetica').fillColor(C.muted)
      .text('No test results found for the selected period.', { align: 'center' });
  }

  // ── Footer ──
  doc.fontSize(8).font('Helvetica').fillColor(C.muted)
    .text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 30, doc.page.height - 35, {
      align: 'center',
      width: doc.page.width - 60
    });

  return doc;
};


// ═══════════════════════════════════════════
// MODE 2: All Athletes for a Specific Test
// ═══════════════════════════════════════════

const generateTestTypeReportPdf = (data) => {
  const { testType, results, athletes, startDate, endDate } = data;

  // Determine layout based on athlete count
  const athleteCount = athletes.length;
  const doc = new PDFDocument({
    margin: 30,
    size: 'A4',
    layout: athleteCount > 8 ? 'landscape' : 'portrait'
  });

  const category = testType.category;
  const catColor = categoryColors[category] || categoryColors.Other;
  const isLowerBetter = category === 'Running' || category === 'Swimming';
  const paceUnit = category === 'Running' ? 'min/km' : category === 'Swimming' ? 'min/100m' : category === 'Cycling' ? 'km/h' : 's';

  // ── Title ──
  doc.rect(30, 20, doc.page.width - 60, 4).fill(catColor);

  doc.fontSize(22).font('Helvetica-Bold').fillColor(C.primary)
    .text('Test Report', 30, 34, { align: 'center' });

  doc.fontSize(15).font('Helvetica-Bold').fillColor(catColor)
    .text(`${testType.title}`, { align: 'center' });

  doc.fontSize(10).font('Helvetica').fillColor(C.subtitle)
    .text(`${category} • ${formatPeriodLabel(startDate, endDate)}`, { align: 'center' });

  doc.moveDown(0.6);

  // ── Summary Cards ──
  const cardY = doc.y;
  const cardW = 110;
  const cardH = 40;
  const cardGap = 14;
  const totalCardW = cardW * 3 + cardGap * 2;
  const cardStartX = (doc.page.width - totalCardW) / 2;

  const drawStatCard = (x, y, label, value, color) => {
    doc.roundedRect(x, y, cardW, cardH, 6).fill(C.accentLight);
    doc.fontSize(8).font('Helvetica').fillColor(C.subtitle)
      .text(label, x, y + 6, { width: cardW, align: 'center' });
    doc.fontSize(16).font('Helvetica-Bold').fillColor(color || C.accent)
      .text(value.toString(), x, y + 19, { width: cardW, align: 'center' });
  };

  drawStatCard(cardStartX, cardY, 'Athletes', athleteCount);
  drawStatCard(cardStartX + cardW + cardGap, cardY, 'Total Results', results.length);

  // Compute overall best
  let overallBestStr = '-';
  if (results.length > 0) {
    const paces = results.map(r => {
      if (category === 'Running') return (r.time / 60) / (r.distance / 1000);
      if (category === 'Swimming') return (r.time / 60) / (r.distance / 100);
      if (category === 'Cycling') return (r.distance / 1000) / (r.time / 3600);
      return r.time;
    });
    const best = isLowerBetter ? Math.min(...paces) : Math.max(...paces);
    if (category === 'Running' || category === 'Swimming') {
      const mins = Math.floor(best);
      const secs = Math.round((best - mins) * 60);
      overallBestStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    } else {
      overallBestStr = best.toFixed(2);
    }
  }
  drawStatCard(cardStartX + (cardW + cardGap) * 2, cardY, `Best (${paceUnit})`, overallBestStr, C.green);

  doc.y = cardY + cardH + 20;

  // ── Group results by athlete ──
  const resultsByAthlete = {};
  results.forEach(r => {
    const aId = (r.athlete?._id || r.athlete)?.toString();
    if (!resultsByAthlete[aId]) resultsByAthlete[aId] = [];
    resultsByAthlete[aId].push(r);
  });

  // ── Table ──
  const colWidths = {
    name: 110,
    tests: 45,
    bestPace: 85,
    latestPace: 85,
    avgPace: 85,
    improvement: 65,
    latestDate: 80,
  };

  let tableY = doc.y;
  let tx = 30;

  // Header
  doc.rect(tx, tableY, doc.page.width - 60, 22).fill(C.headerBg);
  doc.fontSize(7).font('Helvetica-Bold').fillColor(C.headerText);

  doc.text('Athlete', tx + 5, tableY + 7, { width: colWidths.name });
  tx += colWidths.name;
  doc.text('Tests', tx, tableY + 7, { width: colWidths.tests, align: 'center' });
  tx += colWidths.tests;
  doc.text(`Best (${paceUnit})`, tx, tableY + 7, { width: colWidths.bestPace, align: 'center' });
  tx += colWidths.bestPace;
  doc.text(`Latest (${paceUnit})`, tx, tableY + 7, { width: colWidths.latestPace, align: 'center' });
  tx += colWidths.latestPace;
  doc.text(`Avg (${paceUnit})`, tx, tableY + 7, { width: colWidths.avgPace, align: 'center' });
  tx += colWidths.avgPace;
  doc.text('Change', tx, tableY + 7, { width: colWidths.improvement, align: 'center' });
  tx += colWidths.improvement;
  doc.text('Last Test', tx, tableY + 7, { width: colWidths.latestDate, align: 'center' });

  tableY += 22;

  // ── Rows ──
  athletes.forEach((athlete, idx) => {
    if (tableY + 22 > doc.page.height - 50) {
      doc.addPage();
      tableY = 30;
    }

    const athleteResults = resultsByAthlete[athlete._id.toString()] || [];

    const rowBg = idx % 2 === 0 ? C.rowEven : C.rowOdd;
    doc.rect(30, tableY, doc.page.width - 60, 22).fill(rowBg);
    doc.moveTo(30, tableY + 22).lineTo(doc.page.width - 30, tableY + 22)
      .strokeColor(C.border).lineWidth(0.5).stroke();

    tx = 30;

    // Athlete name
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.primary);
    doc.text(athlete.name, tx + 5, tableY + 7, { width: colWidths.name });
    tx += colWidths.name;

    if (athleteResults.length === 0) {
      doc.fontSize(7).font('Helvetica').fillColor(C.muted);
      doc.text('-', tx, tableY + 7, { width: colWidths.tests, align: 'center' });
      tx += colWidths.tests;
      doc.text('-', tx, tableY + 7, { width: colWidths.bestPace, align: 'center' });
      tx += colWidths.bestPace;
      doc.text('-', tx, tableY + 7, { width: colWidths.latestPace, align: 'center' });
      tx += colWidths.latestPace;
      doc.text('-', tx, tableY + 7, { width: colWidths.avgPace, align: 'center' });
      tx += colWidths.avgPace;
      doc.text('-', tx, tableY + 7, { width: colWidths.improvement, align: 'center' });
      tx += colWidths.improvement;
      doc.text('-', tx, tableY + 7, { width: colWidths.latestDate, align: 'center' });
    } else {
      const sorted = [...athleteResults].sort((a, b) => new Date(a.date) - new Date(b.date));
      const paces = sorted.map(r => {
        if (category === 'Running') return (r.time / 60) / (r.distance / 1000);
        if (category === 'Swimming') return (r.time / 60) / (r.distance / 100);
        if (category === 'Cycling') return (r.distance / 1000) / (r.time / 3600);
        return r.time;
      });

      const best = isLowerBetter ? Math.min(...paces) : Math.max(...paces);
      const latest = paces[paces.length - 1];
      const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
      const first = paces[0];
      const improvement = first !== 0
        ? (isLowerBetter
            ? Math.round(((first - latest) / first) * 100)
            : Math.round(((latest - first) / first) * 100))
        : 0;

      const fmtPace = (v) => {
        if (category === 'Running' || category === 'Swimming') {
          const mins = Math.floor(v);
          const secs = Math.round((v - mins) * 60);
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return v.toFixed(2);
      };

      doc.fontSize(7).font('Helvetica').fillColor(C.primary);
      doc.text(athleteResults.length.toString(), tx, tableY + 7, { width: colWidths.tests, align: 'center' });
      tx += colWidths.tests;

      doc.font('Helvetica-Bold').fillColor(C.green);
      doc.text(fmtPace(best), tx, tableY + 7, { width: colWidths.bestPace, align: 'center' });
      tx += colWidths.bestPace;

      doc.font('Helvetica').fillColor(C.accent);
      doc.text(fmtPace(latest), tx, tableY + 7, { width: colWidths.latestPace, align: 'center' });
      tx += colWidths.latestPace;

      doc.fillColor(C.subtitle);
      doc.text(fmtPace(avg), tx, tableY + 7, { width: colWidths.avgPace, align: 'center' });
      tx += colWidths.avgPace;

      const impColor = improvement >= 0 ? C.green : C.red;
      doc.font('Helvetica-Bold').fillColor(impColor);
      doc.text(`${improvement >= 0 ? '+' : ''}${improvement}%`, tx, tableY + 7, { width: colWidths.improvement, align: 'center' });
      tx += colWidths.improvement;

      const lastDate = new Date(sorted[sorted.length - 1].date);
      doc.font('Helvetica').fillColor(C.subtitle);
      doc.text(lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tx, tableY + 7, { width: colWidths.latestDate, align: 'center' });
    }

    tableY += 22;
  });

  // Handle empty
  if (results.length === 0) {
    doc.y = tableY + 10;
    doc.fontSize(12).font('Helvetica').fillColor(C.muted)
      .text('No test results found for the selected period.', { align: 'center' });
  }

  // ── Footer ──
  doc.fontSize(8).font('Helvetica').fillColor(C.muted)
    .text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 30, doc.page.height - 35, {
      align: 'center',
      width: doc.page.width - 60
    });

  return doc;
};


// ═══════════════════════════════════════════
// MODE 3: Multiple Test Types in one report
// ═══════════════════════════════════════════

const generateMultiTestTypeReportPdf = (allTestData) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'portrait' });

  const firstData = allTestData[0];
  const { startDate, endDate } = firstData;

  // ── Cover Title ──
  doc.rect(30, 20, doc.page.width - 60, 4).fill(C.accent);

  doc.fontSize(22).font('Helvetica-Bold').fillColor(C.primary)
    .text('Multi-Test Report', 30, 34, { align: 'center' });

  doc.fontSize(12).font('Helvetica').fillColor(C.subtitle)
    .text(`${allTestData.length} Tests • ${formatPeriodLabel(startDate, endDate)}`, { align: 'center' });

  doc.moveDown(0.6);

  // List test names as horizontal pill badges
  const pillH = 20;
  const pillPadX = 12;
  const pillGap = 8;
  const pillRowGap = 6;
  const pageLeft = 30;
  const pageRight = doc.page.width - 30;
  const maxRowWidth = pageRight - pageLeft;

  // Measure all pills first to center them
  const pills = allTestData.map(({ testType }) => {
    const label = `${testType.title}  •  ${testType.category}`;
    const textW = doc.fontSize(8).font('Helvetica-Bold').widthOfString(label);
    const pillW = textW + pillPadX * 2;
    const color = categoryColors[testType.category] || categoryColors.Other;
    return { label, pillW, color };
  });

  // Arrange pills into rows
  const rows = [];
  let currentRow = [];
  let currentRowW = 0;
  pills.forEach((pill) => {
    const needed = currentRow.length > 0 ? pill.pillW + pillGap : pill.pillW;
    if (currentRowW + needed > maxRowWidth && currentRow.length > 0) {
      rows.push({ items: currentRow, totalW: currentRowW });
      currentRow = [pill];
      currentRowW = pill.pillW;
    } else {
      currentRow.push(pill);
      currentRowW += needed;
    }
  });
  if (currentRow.length > 0) rows.push({ items: currentRow, totalW: currentRowW });

  // Draw centered pill rows
  let pillY = doc.y;
  rows.forEach((row) => {
    // Compute actual total width: all pill widths + gaps between them
    const actualW = row.items.reduce((sum, p) => sum + p.pillW, 0) + (row.items.length - 1) * pillGap;
    let px = 30 + (maxRowWidth - actualW) / 2;
    row.items.forEach((pill) => {
      // Pill background
      doc.roundedRect(px, pillY, pill.pillW, pillH, pillH / 2).fill(pill.color);
      // Pill text — vertically centered (extra 1pt for ascender correction)
      const pillFontSize = 8;
      const textYOffset = (pillH - pillFontSize) / 2 + 1;
      doc.fontSize(pillFontSize).font('Helvetica-Bold').fillColor('#ffffff')
        .text(pill.label, px, pillY + textYOffset, { width: pill.pillW, align: 'center', lineBreak: false });
      px += pill.pillW + pillGap;
    });
    pillY += pillH + pillRowGap;
  });

  doc.y = pillY + 8;


  // ── Render each test type section ──
  allTestData.forEach(({ testType, results, athletes, startDate: sd, endDate: ed }, sectionIdx) => {
    if (sectionIdx > 0) {
      doc.addPage();
    }

    const category = testType.category;
    const catColor = categoryColors[category] || categoryColors.Other;
    const isLowerBetter = category === 'Running' || category === 'Swimming';
    const paceUnit = category === 'Running' ? 'min/km' : category === 'Swimming' ? 'min/100m' : category === 'Cycling' ? 'km/h' : 's';

    // ── Section Title ──
    const sectionY = doc.y;
    doc.rect(30, sectionY, doc.page.width - 60, 4).fill(catColor);

    doc.fontSize(18).font('Helvetica-Bold').fillColor(C.primary)
      .text(testType.title, 30, sectionY + 12, { align: 'center' });

    doc.fontSize(10).font('Helvetica').fillColor(C.subtitle)
      .text(`${category} • ${formatPeriodLabel(sd, ed)}`, { align: 'center' });

    doc.moveDown(0.6);

    // ── Summary Cards ──
    const athleteCount = athletes.length;
    const cardY = doc.y;
    const cardW = 110;
    const cardH = 40;
    const cardGap = 14;
    const totalCardW = cardW * 3 + cardGap * 2;
    const cardStartX = (doc.page.width - totalCardW) / 2;

    const drawStatCard = (x, y, label, value, color) => {
      doc.roundedRect(x, y, cardW, cardH, 6).fill(C.accentLight);
      doc.fontSize(8).font('Helvetica').fillColor(C.subtitle)
        .text(label, x, y + 6, { width: cardW, align: 'center' });
      doc.fontSize(16).font('Helvetica-Bold').fillColor(color || C.accent)
        .text(value.toString(), x, y + 19, { width: cardW, align: 'center' });
    };

    drawStatCard(cardStartX, cardY, 'Athletes', athleteCount);
    drawStatCard(cardStartX + cardW + cardGap, cardY, 'Total Results', results.length);

    let overallBestStr = '-';
    if (results.length > 0) {
      const paces = results.map(r => {
        if (category === 'Running') return (r.time / 60) / (r.distance / 1000);
        if (category === 'Swimming') return (r.time / 60) / (r.distance / 100);
        if (category === 'Cycling') return (r.distance / 1000) / (r.time / 3600);
        return r.time;
      });
      const best = isLowerBetter ? Math.min(...paces) : Math.max(...paces);
      if (category === 'Running' || category === 'Swimming') {
        const mins = Math.floor(best);
        const secs = Math.round((best - mins) * 60);
        overallBestStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      } else {
        overallBestStr = best.toFixed(2);
      }
    }
    drawStatCard(cardStartX + (cardW + cardGap) * 2, cardY, `Best (${paceUnit})`, overallBestStr, C.green);

    doc.y = cardY + cardH + 20;

    // ── Group results by athlete ──
    const resultsByAthlete = {};
    results.forEach(r => {
      const aId = (r.athlete?._id || r.athlete)?.toString();
      if (!resultsByAthlete[aId]) resultsByAthlete[aId] = [];
      resultsByAthlete[aId].push(r);
    });

    // ── Table ──
    const colWidths = {
      name: 105, previous: 80, latest: 80,
      prevAvg: 80, avgPace: 80, improvement: 60, latestDate: 70,
    };

    let tableY = doc.y;
    let tx = 30;

    doc.rect(tx, tableY, doc.page.width - 60, 22).fill(C.headerBg);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.headerText);

    doc.text('Athlete', tx + 5, tableY + 7, { width: colWidths.name });
    tx += colWidths.name;
    doc.text('Previous', tx, tableY + 7, { width: colWidths.previous, align: 'center' });
    tx += colWidths.previous;
    doc.text('Prev Avg', tx, tableY + 7, { width: colWidths.prevAvg, align: 'center' });
    tx += colWidths.prevAvg;
    doc.text('Latest', tx, tableY + 7, { width: colWidths.latest, align: 'center' });
    tx += colWidths.latest;
    doc.text(`Avg (${paceUnit})`, tx, tableY + 7, { width: colWidths.avgPace, align: 'center' });
    tx += colWidths.avgPace;
    doc.text('Change', tx, tableY + 7, { width: colWidths.improvement, align: 'center' });
    tx += colWidths.improvement;
    doc.text('Last Test', tx, tableY + 7, { width: colWidths.latestDate, align: 'center' });

    tableY += 22;

    // ── Rows ──
    athletes.forEach((athlete, idx) => {
      if (tableY + 22 > doc.page.height - 50) {
        doc.addPage();
        tableY = 30;
      }

      const athleteResults = resultsByAthlete[athlete._id.toString()] || [];

      const rowBg = idx % 2 === 0 ? C.rowEven : C.rowOdd;
      doc.rect(30, tableY, doc.page.width - 60, 22).fill(rowBg);
      doc.moveTo(30, tableY + 22).lineTo(doc.page.width - 30, tableY + 22)
        .strokeColor(C.border).lineWidth(0.5).stroke();

      tx = 30;

      doc.fontSize(7).font('Helvetica-Bold').fillColor(C.primary);
      doc.text(athlete.name, tx + 5, tableY + 7, { width: colWidths.name });
      tx += colWidths.name;

      if (athleteResults.length === 0) {
        doc.fontSize(7).font('Helvetica').fillColor(C.muted);
        doc.text('-', tx, tableY + 7, { width: colWidths.previous, align: 'center' });
        tx += colWidths.previous;
        doc.text('-', tx, tableY + 7, { width: colWidths.prevAvg, align: 'center' });
        tx += colWidths.prevAvg;
        doc.text('-', tx, tableY + 7, { width: colWidths.latest, align: 'center' });
        tx += colWidths.latest;
        doc.text('-', tx, tableY + 7, { width: colWidths.avgPace, align: 'center' });
        tx += colWidths.avgPace;
        doc.text('-', tx, tableY + 7, { width: colWidths.improvement, align: 'center' });
        tx += colWidths.improvement;
        doc.text('-', tx, tableY + 7, { width: colWidths.latestDate, align: 'center' });
      } else {
        const sorted = [...athleteResults].sort((a, b) => new Date(a.date) - new Date(b.date));
        const paces = sorted.map(r => {
          if (category === 'Running') return (r.time / 60) / (r.distance / 1000);
          if (category === 'Swimming') return (r.time / 60) / (r.distance / 100);
          if (category === 'Cycling') return (r.distance / 1000) / (r.time / 3600);
          return r.time;
        });

        const latest = paces[paces.length - 1];
        const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
        const first = paces[0];
        const improvement = first !== 0
          ? (isLowerBetter
              ? Math.round(((first - latest) / first) * 100)
              : Math.round(((latest - first) / first) * 100))
          : 0;

        // Previous average (all results except the latest)
        const prevPaces = paces.slice(0, -1);
        const prevAvg = prevPaces.length > 0
          ? prevPaces.reduce((a, b) => a + b, 0) / prevPaces.length
          : null;

        const fmtPace = (v) => {
          if (category === 'Running' || category === 'Swimming') {
            const mins = Math.floor(v);
            const secs = Math.round((v - mins) * 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
          }
          return v.toFixed(2);
        };

        // Previous result (second-to-last actual time)
        if (sorted.length >= 2) {
          const prevResult = sorted[sorted.length - 2];
          doc.fontSize(7).font('Helvetica').fillColor(C.subtitle);
          doc.text(formatTime(prevResult.time), tx, tableY + 7, { width: colWidths.previous, align: 'center' });
        } else {
          doc.fontSize(7).font('Helvetica').fillColor(C.muted);
          doc.text('-', tx, tableY + 7, { width: colWidths.previous, align: 'center' });
        }
        tx += colWidths.previous;

        // Previous average pace
        if (prevAvg !== null) {
          doc.fontSize(7).font('Helvetica').fillColor(C.subtitle);
          doc.text(fmtPace(prevAvg), tx, tableY + 7, { width: colWidths.prevAvg, align: 'center' });
        } else {
          doc.fontSize(7).font('Helvetica').fillColor(C.muted);
          doc.text('-', tx, tableY + 7, { width: colWidths.prevAvg, align: 'center' });
        }
        tx += colWidths.prevAvg;

        // Latest result (actual time)
        const latestResult = sorted[sorted.length - 1];
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.accent);
        doc.text(formatTime(latestResult.time), tx, tableY + 7, { width: colWidths.latest, align: 'center' });
        tx += colWidths.latest;

        // Avg pace (all results)
        doc.font('Helvetica').fillColor(C.subtitle);
        doc.text(fmtPace(avg), tx, tableY + 7, { width: colWidths.avgPace, align: 'center' });
        tx += colWidths.avgPace;

        // Change
        const impColor = improvement >= 0 ? C.green : C.red;
        doc.font('Helvetica-Bold').fillColor(impColor);
        doc.text(`${improvement >= 0 ? '+' : ''}${improvement}%`, tx, tableY + 7, { width: colWidths.improvement, align: 'center' });
        tx += colWidths.improvement;

        // Last test date
        const lastDate = new Date(sorted[sorted.length - 1].date);
        doc.font('Helvetica').fillColor(C.subtitle);
        doc.text(lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), tx, tableY + 7, { width: colWidths.latestDate, align: 'center' });
      }

      tableY += 22;
    });

    // Handle empty
    if (results.length === 0) {
      doc.y = tableY + 10;
      doc.fontSize(12).font('Helvetica').fillColor(C.muted)
        .text('No test results found for the selected period.', { align: 'center' });
    }

    doc.y = tableY + 10;
  });

  // ── Footer ──
  doc.fontSize(8).font('Helvetica').fillColor(C.muted)
    .text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 30, doc.page.height - 35, {
      align: 'center',
      width: doc.page.width - 60
    });

  return doc;
};


module.exports = { generateAthleteTestPdf, generateTestTypeReportPdf, generateMultiTestTypeReportPdf };
