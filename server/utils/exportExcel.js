const ExcelJS = require('exceljs');

const generateExcel = async (data) => {
  const { sessions, attendance, athletes, month, year } = data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Attendance App';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Attendance', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  });

  // Build date columns from sessions
  const dateMap = {};
  sessions.forEach(s => {
    const dateStr = new Date(s.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    const key = `${dateStr} - ${s.name}`;
    dateMap[s._id.toString()] = key;
  });

  // Set columns
  const columns = [
    { header: 'Athlete', key: 'athlete', width: 25 }
  ];

  const sessionKeys = [];
  sessions.forEach(s => {
    const key = s._id.toString();
    const dateStr = new Date(s.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    columns.push({
      header: `${dateStr}\n${s.name}`,
      key: key,
      width: 14
    });
    sessionKeys.push(key);
  });

  columns.push(
    { header: 'Total Present', key: 'total', width: 14 },
    { header: 'Percentage', key: 'percentage', width: 12 }
  );

  sheet.columns = columns;

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1a1a2e' }
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 35;

  // Build attendance lookup
  const attendanceLookup = {};
  attendance.forEach(a => {
    const key = `${a.athlete?._id || a.athlete}-${a.session}`;
    attendanceLookup[key] = { present: a.present };
  });

  // Add athlete rows
  athletes.forEach((athlete, index) => {
    const rowData = { athlete: athlete.name };
    let presentCount = 0;
    let expectedCount = 0;

    sessions.forEach(s => {
      const sessionId = s._id.toString();
      const key = `${athlete._id}-${sessionId}`;
      const record = attendanceLookup[key];
      
      const assigned = s.assignedAthletes || [];
      const hasAssignments = assigned.length > 0;
      const isExpected = hasAssignments ? assigned.some(id => id.toString() === athlete._id.toString()) : true;

      if ((isExpected && record !== undefined) || (record && record.present === true)) {
        expectedCount++;
        rowData[sessionId] = record.present ? '✓' : '✗';
        if (record.present) presentCount++;
      } else {
        rowData[sessionId] = '-';
      }
    });

    rowData.total = presentCount;
    rowData.percentage = expectedCount > 0
      ? `${Math.round((presentCount / expectedCount) * 100)}%`
      : '0%';

    const row = sheet.addRow(rowData);

    // Alternate row coloring
    if (index % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8F9FA' }
      };
    }

    // Color-code attendance cells
    sessions.forEach((s, colIndex) => {
      const sessionId = s._id.toString();
      const cell = row.getCell(colIndex + 2); // +2 because athlete name is col 1
      const key = `${athlete._id}-${sessionId}`;
      const record = attendanceLookup[key];

      const assigned = s.assignedAthletes || [];
      const hasAssignments = assigned.length > 0;
      const isExpected = hasAssignments ? assigned.some(id => id.toString() === athlete._id.toString()) : true;

      cell.alignment = { horizontal: 'center' };
      if (record === undefined || (!isExpected && record && !record.present)) {
        cell.font = { color: { argb: 'FF6B7280' } }; // Gray
      } else if (record && record.present) {
        cell.font = { color: { argb: 'FF16a34a' }, bold: true };
      } else {
        cell.font = { color: { argb: 'FFdc2626' } };
      }
    });

    // Style total and percentage
    row.getCell('total').alignment = { horizontal: 'center' };
    row.getCell('total').font = { bold: true };
    row.getCell('percentage').alignment = { horizontal: 'center' };
  });

  // Add borders
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    });
  });

  return workbook;
};

module.exports = generateExcel;
