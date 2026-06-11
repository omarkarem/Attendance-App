const PDFDocument = require('pdfkit');

const generatePdf = (data) => {
  const { sessions, attendance, athletes, month, year } = data;

  const doc = new PDFDocument({
    margin: 30,
    size: 'A4',
    layout: sessions.length > 10 ? 'landscape' : 'portrait'
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // ── Colors ──
  const colors = {
    primary: '#1a1a2e',
    headerBg: '#16163a',
    headerText: '#ffffff',
    accent: '#6c63ff',
    presentGreen: '#16a34a',
    presentBg: '#dcfce7',
    absentRed: '#dc2626',
    absentBg: '#fee2e2',
    muted: '#94a3b8',
    rowEven: '#f8f9fa',
    rowOdd: '#ffffff',
    border: '#e2e8f0',
    subtitle: '#64748b',
  };

  // ── Title Section ──
  // Accent bar
  doc.rect(30, 20, doc.page.width - 60, 4).fill(colors.accent);

  doc.fontSize(22).font('Helvetica-Bold')
    .fillColor(colors.primary)
    .text('Attendance Report', 30, 34, { align: 'center' });

  doc.fontSize(13).font('Helvetica')
    .fillColor(colors.subtitle)
    .text(`${monthNames[month - 1]} ${year}`, { align: 'center' });

  doc.moveDown(0.8);

  // ── Summary Stats ──
  const totalSessionCount = sessions.length;
  const totalAthleteCount = athletes.length;

  const statsY = doc.y;
  const statsBoxW = 130;
  const statsBoxH = 36;
  const statsGap = 16;
  const totalStatsW = statsBoxW * 2 + statsGap;
  const statsStartX = (doc.page.width - totalStatsW) / 2;

  // Sessions box
  doc.roundedRect(statsStartX, statsY, statsBoxW, statsBoxH, 6)
    .fill('#eef2ff');
  doc.fontSize(9).font('Helvetica').fillColor(colors.subtitle)
    .text('Total Sessions', statsStartX, statsY + 6, { width: statsBoxW, align: 'center' });
  doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.accent)
    .text(totalSessionCount.toString(), statsStartX, statsY + 18, { width: statsBoxW, align: 'center' });

  // Athletes box
  doc.roundedRect(statsStartX + statsBoxW + statsGap, statsY, statsBoxW, statsBoxH, 6)
    .fill('#eef2ff');
  doc.fontSize(9).font('Helvetica').fillColor(colors.subtitle)
    .text('Total Athletes', statsStartX + statsBoxW + statsGap, statsY + 6, { width: statsBoxW, align: 'center' });
  doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.accent)
    .text(totalAthleteCount.toString(), statsStartX + statsBoxW + statsGap, statsY + 18, { width: statsBoxW, align: 'center' });

  doc.y = statsY + statsBoxH + 16;

  // Build attendance lookup
  const attendanceLookup = {};
  attendance.forEach(a => {
    const key = `${a.athlete?._id || a.athlete}-${a.session}`;
    attendanceLookup[key] = { present: a.present };
  });

  // ── Table ──
  const tableTop = doc.y;
  const nameColWidth = 120;
  const cellWidth = Math.min(35, (doc.page.width - 60 - nameColWidth - 80) / Math.max(sessions.length, 1));
  const totalColWidth = 40;
  const pctColWidth = 40;
  const rowHeight = 24;

  // Header row
  let x = 30;
  let y = tableTop;

  // Header background
  doc.rect(x, y, doc.page.width - 60, rowHeight + 2).fill(colors.headerBg);

  doc.fontSize(7).font('Helvetica-Bold').fillColor(colors.headerText);
  doc.text('Athlete', x + 5, y + 7, { width: nameColWidth - 10 });

  x += nameColWidth;
  sessions.forEach(s => {
    const dateStr = new Date(s.date).getDate().toString();
    doc.text(dateStr, x + 2, y + 7, { width: cellWidth - 4, align: 'center' });
    x += cellWidth;
  });

  doc.text('Total', x + 2, y + 7, { width: totalColWidth - 4, align: 'center' });
  x += totalColWidth;
  doc.text('%', x + 2, y + 7, { width: pctColWidth - 4, align: 'center' });

  y += rowHeight + 2;

  // ── Data Rows ──
  athletes.forEach((athlete, index) => {
    // New page check
    if (y + rowHeight > doc.page.height - 50) {
      doc.addPage();
      y = 30;
    }

    x = 30;

    // Alternate row background
    const rowBg = index % 2 === 0 ? colors.rowEven : colors.rowOdd;
    doc.rect(x, y, doc.page.width - 60, rowHeight).fill(rowBg);

    // Row bottom border
    doc.moveTo(x, y + rowHeight)
      .lineTo(doc.page.width - 30, y + rowHeight)
      .strokeColor(colors.border).lineWidth(0.5).stroke();

    // Athlete name
    doc.fontSize(7).font('Helvetica').fillColor(colors.primary);
    doc.text(athlete.name, x + 5, y + 8, { width: nameColWidth - 10 });

    x += nameColWidth;
    let presentCount = 0;
    let expectedCount = 0;

    sessions.forEach(s => {
      const key = `${athlete._id}-${s._id}`;
      const record = attendanceLookup[key];

      const assigned = s.assignedAthletes || [];
      const hasAssignments = assigned.length > 0;
      const isExpected = hasAssignments ? assigned.some(id => id.toString() === athlete._id.toString()) : true;

      const cellCenterX = x + cellWidth / 2;
      const cellCenterY = y + rowHeight / 2;

      if ((isExpected && record !== undefined) || (record && record.present === true)) {
        expectedCount++;
        if (record.present) {
          presentCount++;
          // Green filled circle with white checkmark
          doc.circle(cellCenterX, cellCenterY, 6).fill(colors.presentGreen);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
          doc.text('✓', x + 2, y + 6, { width: cellWidth - 4, align: 'center' });
        } else {
          // Red filled circle with white X
          doc.circle(cellCenterX, cellCenterY, 6).fill(colors.absentRed);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
          doc.text('✗', x + 2, y + 6, { width: cellWidth - 4, align: 'center' });
        }
      } else {
        doc.fontSize(7).font('Helvetica').fillColor(colors.muted);
        doc.text('–', x + 2, y + 8, { width: cellWidth - 4, align: 'center' });
      }
      x += cellWidth;
    });

    // Total column
    doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.primary);
    doc.text(presentCount.toString(), x + 2, y + 8, { width: totalColWidth - 4, align: 'center' });
    x += totalColWidth;

    // Percentage column — color coded
    const pct = expectedCount > 0 ? Math.round((presentCount / expectedCount) * 100) : 0;
    const pctColor = pct >= 80 ? colors.presentGreen : pct >= 50 ? '#f59e0b' : colors.absentRed;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(pctColor);
    doc.text(`${pct}%`, x + 2, y + 8, { width: pctColWidth - 4, align: 'center' });

    y += rowHeight;
  });

  // ── Legend ──
  const legendY = Math.min(y + 16, doc.page.height - 60);
  if (legendY < doc.page.height - 40) {
    doc.circle(44, legendY + 4, 5).fill(colors.presentGreen);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff')
      .text('✓', 38, legendY, { width: 12, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor(colors.subtitle)
      .text('Present', 54, legendY + 1);

    doc.circle(104, legendY + 4, 5).fill(colors.absentRed);
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff')
      .text('✗', 98, legendY, { width: 12, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor(colors.subtitle)
      .text('Absent', 114, legendY + 1);

    doc.fontSize(7).font('Helvetica').fillColor(colors.muted)
      .text('–  Not expected', 154, legendY + 1);
  }

  // ── Footer ──
  doc.fontSize(8).font('Helvetica').fillColor(colors.muted)
    .text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 30, doc.page.height - 35, {
      align: 'center',
      width: doc.page.width - 60
    });

  return doc;
};

module.exports = generatePdf;
