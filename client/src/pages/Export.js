import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  HiOutlineArrowDownTray,
  HiOutlineDocumentText,
  HiOutlineTableCells
} from 'react-icons/hi2';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const Export = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [format, setFormat] = useState('excel');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [sessionNames, setSessionNames] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch available session names for the selected month
    const fetchSessions = async () => {
      try {
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0).toISOString();
        const { data } = await api.get(`/sessions?startDate=${startDate}&endDate=${endDate}`);
        const names = [...new Set(data.map(s => s.name))];
        setSessionNames(names);
      } catch (error) {
        // Silently fail
      }
    };
    fetchSessions();
  }, [month, year]);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
        format,
        sessionFilter
      });

      const response = await api.get(`/export?${params}`, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Attendance_${monthNames[month - 1]}_${year}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to export. Make sure there is attendance data for this month.');
    } finally {
      setLoading(false);
    }
  };

  // Generate year options (current year +/- 2)
  const yearOptions = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="page-container">
      <h1 className="page-title flex items-center gap-2">
        <HiOutlineArrowDownTray className="w-7 h-7 text-accent-400" />
        Export Attendance
      </h1>

      <div className="max-w-lg mx-auto space-y-6 animate-slide-up">
        {/* Month & Year */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-dark-300 mb-4">Select Period</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Month</label>
              <select
                id="export-month"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full"
              >
                {monthNames.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1.5">Year</label>
              <select
                id="export-year"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Session Filter */}
        {sessionNames.length > 0 && (
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-dark-300 mb-4">Session Filter</h2>
            <select
              id="export-session"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="w-full"
            >
              <option value="all">All Sessions</option>
              {sessionNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Format Selection */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-dark-300 mb-4">Export Format</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setFormat('excel')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                format === 'excel'
                  ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                  : 'border-dark-600 bg-dark-700/50 text-dark-400 hover:border-dark-500'
              }`}
            >
              <HiOutlineTableCells className="w-8 h-8" />
              <span className="text-sm font-medium">Excel</span>
              <span className="text-[10px] text-dark-500">.xlsx</span>
            </button>
            <button
              onClick={() => setFormat('pdf')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                format === 'pdf'
                  ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                  : 'border-dark-600 bg-dark-700/50 text-dark-400 hover:border-dark-500'
              }`}
            >
              <HiOutlineDocumentText className="w-8 h-8" />
              <span className="text-sm font-medium">PDF</span>
              <span className="text-[10px] text-dark-500">.pdf</span>
            </button>
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 text-base py-4"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <HiOutlineArrowDownTray className="w-5 h-5" />
              Download {format === 'excel' ? 'Excel' : 'PDF'}
            </>
          )}
        </button>

        {/* Preview Text */}
        <p className="text-center text-xs text-dark-500">
          Exporting {monthNames[month - 1]} {year} • {sessionFilter === 'all' ? 'All sessions' : sessionFilter} • {format.toUpperCase()}
        </p>
      </div>
    </div>
  );
};

export default Export;
