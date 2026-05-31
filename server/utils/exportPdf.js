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

  // Title
  doc.fontSize(20).font('Helvetica-Bold')
    .fillColor('#1a1a2e')
    .text(`Attendance Report`, { align: 'center' });

  doc.fontSize(14).font('Helvetica')
    .fillColor('#64748b')
    .text(`${monthNames[month - 1]} ${year}`, { align: 'center' });

  doc.moveDown(1);

  // Summary stats
  const totalSessionCount = sessions.length;
  const totalAthleteCount = athletes.length;

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a2e')
    .text(`Total Sessions: ${totalSessionCount}    |    Total Athletes: ${totalAthleteCount}`);
  doc.moveDown(0.5);

  // Build attendance lookup
  const attendanceLookup = {};
  attendance.forEach(a => {
    const key = `${a.athlete?._id || a.athlete}-${a.session}`;
    attendanceLookup[key] = a.present;
  });

  // Table
  const tableTop = doc.y + 10;
  const nameColWidth = 120;
  const cellWidth = Math.min(35, (doc.page.width - 60 - nameColWidth - 80) / Math.max(sessions.length, 1));
  const totalColWidth = 40;
  const pctColWidth = 40;
  const rowHeight = 20;

  // Header row
  let x = 30;
  let y = tableTop;

  // Background for header
  doc.rect(x, y, doc.page.width - 60, rowHeight).fill('#1a1a2e');

  doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
  doc.text('Athlete', x + 4, y + 5, { width: nameColWidth - 8 });

  x += nameColWidth;
  sessions.forEach(s => {
    const dateStr = new Date(s.date).getDate().toString();
    doc.text(dateStr, x + 2, y + 5, { width: cellWidth - 4, align: 'center' });
    x += cellWidth;
  });

  doc.text('Total', x + 2, y + 5, { width: totalColWidth - 4, align: 'center' });
  x += totalColWidth;
  doc.text('%', x + 2, y + 5, { width: pctColWidth - 4, align: 'center' });

  y += rowHeight;

  // Data rows
  athletes.forEach((athlete, index) => {
    // Check if we need a new page
    if (y + rowHeight > doc.page.height - 40) {
      doc.addPage();
      y = 30;
    }

    x = 30;

    // Alternate row background
    if (index % 2 === 0) {
      doc.rect(x, y, doc.page.width - 60, rowHeight).fill('#f8f9fa');
    } else {
      doc.rect(x, y, doc.page.width - 60, rowHeight).fill('#ffffff');
    }

    doc.fontSize(7).font('Helvetica').fillColor('#1a1a2e');
    doc.text(athlete.name, x + 4, y + 5, { width: nameColWidth - 8 });

    x += nameColWidth;
    let presentCount = 0;

    sessions.forEach(s => {
      const key = `${athlete._id}-${s._id}`;
      const isPresent = attendanceLookup[key] || false;

      if (isPresent) {
        presentCount++;
        doc.font('Helvetica-Bold').fillColor('#16a34a');
        doc.text('✓', x + 2, y + 5, { width: cellWidth - 4, align: 'center' });
      } else {
        doc.font('Helvetica').fillColor('#dc2626');
        doc.text('✗', x + 2, y + 5, { width: cellWidth - 4, align: 'center' });
      }
      x += cellWidth;
    });

    doc.font('Helvetica-Bold').fillColor('#1a1a2e');
    doc.text(presentCount.toString(), x + 2, y + 5, { width: totalColWidth - 4, align: 'center' });
    x += totalColWidth;

    const pct = sessions.length > 0 ? Math.round((presentCount / sessions.length) * 100) : 0;
    doc.text(`${pct}%`, x + 2, y + 5, { width: pctColWidth - 4, align: 'center' });

    y += rowHeight;
  });

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
    .text(`Generated on ${new Date().toLocaleDateString()}`, 30, doc.page.height - 40, {
      align: 'center'
    });

  return doc;
};

module.exports = generatePdf;
