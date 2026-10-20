// Shared PDFKit helpers.
// The built-in Helvetica font has no glyphs for ✓ ✗ ★, so status marks are drawn as vectors.

const drawCheck = (doc, cx, cy, size = 3.2, color = '#ffffff') => {
  doc.save()
    .moveTo(cx - size, cy)
    .lineTo(cx - size * 0.25, cy + size * 0.75)
    .lineTo(cx + size, cy - size * 0.8)
    .lineWidth(1.4).lineCap('round').lineJoin('round').strokeColor(color).stroke()
    .restore();
};

const drawCross = (doc, cx, cy, size = 2.6, color = '#ffffff') => {
  doc.save()
    .moveTo(cx - size, cy - size).lineTo(cx + size, cy + size)
    .moveTo(cx + size, cy - size).lineTo(cx - size, cy + size)
    .lineWidth(1.4).lineCap('round').strokeColor(color).stroke()
    .restore();
};

// Writing below the bottom margin makes PDFKit add a blank page, so lift the margin first.
const writeFooter = (doc, color = '#94a3b8') => {
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fontSize(8).font('Helvetica').fillColor(color)
    .text(
      `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      30, doc.page.height - 30,
      { align: 'center', width: doc.page.width - 60, lineBreak: false }
    );
  doc.page.margins.bottom = bottom;
};

// "All time" exports use a sentinel start date of Jan 1, 2000.
const isAllTime = (startDate) => startDate.getFullYear() <= 2000;

const formatPeriodLabel = (startDate, endDate) => {
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  if (isAllTime(startDate)) return `All results up to ${endDate.toLocaleDateString('en-US', opts)}`;
  return `${startDate.toLocaleDateString('en-US', opts)} to ${endDate.toLocaleDateString('en-US', opts)}`;
};

module.exports = { drawCheck, drawCross, writeFooter, isAllTime, formatPeriodLabel };
