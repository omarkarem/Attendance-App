import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  HiOutlineArrowDownTray,
  HiOutlineDocumentText,
  HiOutlineTableCells,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineUserGroup,
  HiOutlineBeaker,
  HiOutlineUser,
  HiOutlineClipboardDocumentList,
  HiOutlineEyeSlash
} from 'react-icons/hi2';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const periodOptions = [
  { value: '1w', label: '1 Week' },
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

const Export = () => {
  const now = new Date();

  // ── Shared State ──
  const [activeTab, setActiveTab] = useState('attendance');
  const [format, setFormat] = useState('pdf');
  const [loading, setLoading] = useState(false);

  // ── Attendance State ──
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [sessionFilter, setSessionFilter] = useState('all');
  const [sessionNames, setSessionNames] = useState([]);

  // ── Tests State ──
  const [testMode, setTestMode] = useState('athlete'); // 'athlete' or 'test'
  const [selectedAthlete, setSelectedAthlete] = useState('');
  const [selectedTestTypes, setSelectedTestTypes] = useState([]);
  const [period, setPeriod] = useState('3m');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [athletes, setAthletes] = useState([]);
  const [testTypes, setTestTypes] = useState([]);
  const [excludedAthletes, setExcludedAthletes] = useState([]);
  const [testAthletes, setTestAthletes] = useState([]); // athletes with results for selected test types
  const [loadingTestAthletes, setLoadingTestAthletes] = useState(false);

  // ── Fetch sessions for attendance tab ──
  useEffect(() => {
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
    if (activeTab === 'attendance') fetchSessions();
  }, [month, year, activeTab]);

  // ── Fetch athletes and test types for tests tab ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [athletesRes, typesRes] = await Promise.all([
          api.get('/athletes'),
          api.get('/tests/types')
        ]);
        setAthletes(athletesRes.data);
        setTestTypes(typesRes.data);

        // Auto-select first items
        if (athletesRes.data.length > 0 && !selectedAthlete) {
          setSelectedAthlete(athletesRes.data[0]._id);
        }
        if (typesRes.data.length > 0 && selectedTestTypes.length === 0) {
          setSelectedTestTypes([typesRes.data[0]._id]);
        }
      } catch (error) {
        // Silently fail
      }
    };
    if (activeTab === 'tests') fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Fetch athletes for selected test types ──
  useEffect(() => {
    const fetchTestAthletes = async () => {
      if (testMode !== 'test' || selectedTestTypes.length === 0) {
        setTestAthletes([]);
        return;
      }
      setLoadingTestAthletes(true);
      try {
        const { data } = await api.get(`/tests/results/athletes?testTypeIds=${selectedTestTypes.join(',')}`);
        setTestAthletes(data);
        // Clear any excluded athletes that are no longer in the list
        setExcludedAthletes(prev => prev.filter(id => data.some(a => a._id === id)));
      } catch (error) {
        setTestAthletes([]);
      } finally {
        setLoadingTestAthletes(false);
      }
    };
    fetchTestAthletes();
  }, [selectedTestTypes, testMode]);

  // ── Export Attendance ──
  const handleExportAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString(),
        format,
        sessionFilter
      });

      const response = await api.get(`/export?${params}`, { responseType: 'blob' });

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

  // ── Export Tests ──
  const handleExportTests = async () => {
    // Validate
    if (testMode === 'athlete' && !selectedAthlete) {
      toast.error('Please select an athlete.');
      return;
    }
    if (testMode === 'test' && selectedTestTypes.length === 0) {
      toast.error('Please select at least one test type.');
      return;
    }
    if (period === 'custom' && (!customStart || !customEnd)) {
      toast.error('Please select start and end dates.');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ mode: testMode, format, period });

      if (testMode === 'athlete') params.append('athleteId', selectedAthlete);
      if (testMode === 'test') {
        params.append('testTypeIds', selectedTestTypes.join(','));
        if (excludedAthletes.length > 0) {
          params.append('excludeAthleteIds', excludedAthletes.join(','));
        }
      }
      if (period === 'custom') {
        params.append('startDate', customStart);
        params.append('endDate', customEnd);
      }

      const response = await api.get(`/export/tests?${params}`, { responseType: 'blob' });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      let filename;
      if (testMode === 'athlete') {
        const athlete = athletes.find(a => a._id === selectedAthlete);
        filename = `Tests_${athlete?.name || 'Athlete'}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      } else {
        const selectedNames = selectedTestTypes
          .map(id => testTypes.find(t => t._id === id)?.title || 'Test')
          .join('_');
        const displayName = selectedTestTypes.length > 2
          ? `${selectedTestTypes.length}_Tests`
          : selectedNames;
        filename = `TestReport_${displayName}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      }
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to export. Make sure there is test data for the selected filters.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (activeTab === 'attendance') handleExportAttendance();
    else handleExportTests();
  };

  // Year options
  const yearOptions = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
    yearOptions.push(y);
  }

  // ── Preview text ──
  const getPreviewText = () => {
    if (activeTab === 'attendance') {
      return `${monthNames[month - 1]} ${year} • ${sessionFilter === 'all' ? 'All sessions' : sessionFilter} • ${format.toUpperCase()}`;
    }
    if (testMode === 'athlete') {
      const athlete = athletes.find(a => a._id === selectedAthlete);
      const periodLabel = periodOptions.find(p => p.value === period)?.label || period;
      return `${athlete?.name || 'Athlete'} • ${periodLabel} • ${format.toUpperCase()}`;
    }
    const periodLabel = periodOptions.find(p => p.value === period)?.label || period;
    if (selectedTestTypes.length === 0) return `No tests selected • ${periodLabel} • ${format.toUpperCase()}`;
    if (selectedTestTypes.length === 1) {
      const testType = testTypes.find(t => t._id === selectedTestTypes[0]);
      return `${testType?.title || 'Test'} • ${periodLabel} • ${format.toUpperCase()}`;
    }
    return `${selectedTestTypes.length} tests selected • ${periodLabel} • ${format.toUpperCase()}`;
  };

  return (
    <div className="page-container">
      <h1 className="page-title flex items-center gap-2">
        <HiOutlineArrowDownTray className="w-7 h-7 text-accent-400" />
        Export Data
      </h1>

      <div className="max-w-lg mx-auto space-y-5 animate-slide-up">

        {/* ── Tab Switcher ── */}
        <div className="glass-card p-1.5 flex gap-1">
          <button
            id="tab-attendance"
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'attendance'
                ? 'bg-accent-500/15 text-accent-400 shadow-glow'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
              }`}
          >
            <HiOutlineCalendarDays className="w-4.5 h-4.5" />
            Attendance
          </button>
          <button
            id="tab-tests"
            onClick={() => setActiveTab('tests')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'tests'
                ? 'bg-accent-500/15 text-accent-400 shadow-glow'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
              }`}
          >
            <HiOutlineChartBar className="w-4.5 h-4.5" />
            Tests
          </button>
        </div>

        {/* ══════════════════════════════════════ */}
        {/* ── ATTENDANCE TAB ── */}
        {/* ══════════════════════════════════════ */}
        {activeTab === 'attendance' && (
          <>
            {/* Month & Year */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-dark-300 mb-4 flex items-center gap-2">
                <HiOutlineCalendarDays className="w-4 h-4 text-accent-400" />
                Select Period
              </h2>
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
          </>
        )}

        {/* ══════════════════════════════════════ */}
        {/* ── TESTS TAB ── */}
        {/* ══════════════════════════════════════ */}
        {activeTab === 'tests' && (
          <>
            {/* Mode Selector */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-dark-300 mb-4 flex items-center gap-2">
                <HiOutlineClipboardDocumentList className="w-4 h-4 text-accent-400" />
                Export Mode
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  id="mode-athlete"
                  onClick={() => setTestMode('athlete')}
                  className={`p-3.5 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${testMode === 'athlete'
                      ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                      : 'border-dark-600 bg-dark-700/50 text-dark-400 hover:border-dark-500'
                    }`}
                >
                  <HiOutlineUser className="w-6 h-6" />
                  <span className="text-sm font-medium">Single Athlete</span>
                  <span className="text-[10px] text-dark-500 leading-tight text-center">All tests for one athlete</span>
                </button>
                <button
                  id="mode-test"
                  onClick={() => setTestMode('test')}
                  className={`p-3.5 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${testMode === 'test'
                      ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                      : 'border-dark-600 bg-dark-700/50 text-dark-400 hover:border-dark-500'
                    }`}
                >
                  <HiOutlineBeaker className="w-6 h-6" />
                  <span className="text-sm font-medium">By Test</span>
                  <span className="text-[10px] text-dark-500 leading-tight text-center">All athletes for selected tests</span>
                </button>
              </div>
            </div>

            {/* Athlete / Test Type Selection */}
            <div className="glass-card p-5">
              {testMode === 'athlete' ? (
                <>
                  <h2 className="text-sm font-semibold text-dark-300 mb-4 flex items-center gap-2">
                    <HiOutlineUserGroup className="w-4 h-4 text-accent-400" />
                    Select Athlete
                  </h2>
                  <select
                    id="export-athlete"
                    value={selectedAthlete}
                    onChange={(e) => setSelectedAthlete(e.target.value)}
                    className="w-full"
                  >
                    {athletes.length === 0 && <option value="">No athletes found</option>}
                    {athletes.map(a => (
                      <option key={a._id} value={a._id}>{a.name}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-dark-300 mb-3 flex items-center gap-2">
                    <HiOutlineBeaker className="w-4 h-4 text-accent-400" />
                    Select Test Types
                    {selectedTestTypes.length > 0 && (
                      <span className="ml-auto text-xs font-normal text-accent-400 bg-accent-500/10 px-2 py-0.5 rounded-full">
                        {selectedTestTypes.length} selected
                      </span>
                    )}
                  </h2>

                  {/* Select All / Deselect All */}
                  <div className="flex gap-2 mb-3">
                    <button
                      id="select-all-tests"
                      type="button"
                      onClick={() => setSelectedTestTypes(testTypes.map(t => t._id))}
                      className="text-[11px] text-accent-400 hover:text-accent-300 font-medium transition-colors"
                    >
                      Select All
                    </button>
                    <span className="text-dark-600">•</span>
                    <button
                      id="deselect-all-tests"
                      type="button"
                      onClick={() => setSelectedTestTypes([])}
                      className="text-[11px] text-dark-500 hover:text-dark-300 font-medium transition-colors"
                    >
                      Deselect All
                    </button>
                  </div>

                  {testTypes.length === 0 ? (
                    <p className="text-sm text-dark-500 text-center py-4">No test types found</p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                      {testTypes.map(t => {
                        const isSelected = selectedTestTypes.includes(t._id);
                        return (
                          <label
                            key={t._id}
                            htmlFor={`test-check-${t._id}`}
                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border-2 ${isSelected
                                ? 'border-accent-500/50 bg-accent-500/8 text-dark-100'
                                : 'border-transparent bg-dark-700/40 text-dark-400 hover:bg-dark-700/70 hover:text-dark-300'
                              }`}
                          >
                            <input
                              id={`test-check-${t._id}`}
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedTestTypes(prev =>
                                  prev.includes(t._id)
                                    ? prev.filter(id => id !== t._id)
                                    : [...prev, t._id]
                                );
                              }}
                              className="sr-only"
                            />
                            <div className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${isSelected
                                ? 'border-accent-500 bg-accent-500'
                                : 'border-dark-500 bg-dark-700'
                              }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium block truncate">{t.title}</span>
                              <span className="text-[10px] text-dark-500">{t.category}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Exclude Athletes */}
            {testMode === 'test' && testAthletes.length > 0 && (
              <div className="glass-card p-5">
                <h2 className="text-sm font-semibold text-dark-300 mb-3 flex items-center gap-2">
                  <HiOutlineEyeSlash className="w-4 h-4 text-accent-400" />
                  Exclude Athletes
                  {excludedAthletes.length > 0 && (
                    <span className="ml-auto text-xs font-normal text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                      {excludedAthletes.length} excluded
                    </span>
                  )}
                </h2>

                <p className="text-[11px] text-dark-500 mb-3">Uncheck athletes to remove them from the report.</p>

                <div className="flex gap-2 mb-3">
                  <button
                    id="include-all-athletes"
                    type="button"
                    onClick={() => setExcludedAthletes([])}
                    className="text-[11px] text-accent-400 hover:text-accent-300 font-medium transition-colors"
                  >
                    Include All
                  </button>
                  <span className="text-dark-600">•</span>
                  <button
                    id="exclude-all-athletes"
                    type="button"
                    onClick={() => setExcludedAthletes(testAthletes.map(a => a._id))}
                    className="text-[11px] text-dark-500 hover:text-dark-300 font-medium transition-colors"
                  >
                    Exclude All
                  </button>
                </div>

                {loadingTestAthletes ? (
                  <p className="text-xs text-dark-500 text-center py-3">Loading athletes...</p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                    {testAthletes.map(a => {
                      const isIncluded = !excludedAthletes.includes(a._id);
                      return (
                        <label
                          key={a._id}
                          htmlFor={`athlete-excl-${a._id}`}
                          className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border-2 ${isIncluded
                              ? 'border-transparent bg-dark-700/40 text-dark-200 hover:bg-dark-700/70'
                              : 'border-red-500/30 bg-red-500/8 text-dark-500 line-through'
                            }`}
                        >
                          <input
                            id={`athlete-excl-${a._id}`}
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => {
                              setExcludedAthletes(prev =>
                                prev.includes(a._id)
                                  ? prev.filter(id => id !== a._id)
                                  : [...prev, a._id]
                              );
                            }}
                            className="sr-only"
                          />
                          <div className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${isIncluded
                              ? 'border-accent-500 bg-accent-500'
                              : 'border-dark-500 bg-dark-700'
                            }`}>
                            {isIncluded && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium truncate">{a.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Period Filter */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-dark-300 mb-4 flex items-center gap-2">
                <HiOutlineCalendarDays className="w-4 h-4 text-accent-400" />
                Time Period
              </h2>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {periodOptions.map(opt => (
                  <button
                    key={opt.value}
                    id={`period-${opt.value}`}
                    onClick={() => setPeriod(opt.value)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all border-2 ${period === opt.value
                        ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                        : 'border-dark-600 bg-dark-700/50 text-dark-400 hover:border-dark-500 hover:text-dark-300'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Custom date pickers */}
              {period === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-dark-600/50">
                  <div>
                    <label className="block text-xs text-dark-400 mb-1.5">Start Date</label>
                    <input
                      id="custom-start"
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-400 mb-1.5">End Date</label>
                    <input
                      id="custom-end"
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════ */}
        {/* ── FORMAT SELECTOR (shared) ── */}
        {/* ══════════════════════════════════════ */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-dark-300 mb-4">Export Format</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              id="format-excel"
              onClick={() => setFormat('excel')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${format === 'excel'
                  ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                  : 'border-dark-600 bg-dark-700/50 text-dark-400 hover:border-dark-500'
                }`}
            >
              <HiOutlineTableCells className="w-8 h-8" />
              <span className="text-sm font-medium">Excel</span>
              <span className="text-[10px] text-dark-500">.xlsx</span>
            </button>
            <button
              id="format-pdf"
              onClick={() => setFormat('pdf')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${format === 'pdf'
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

        {/* ── Export Button ── */}
        <button
          id="export-btn"
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

        {/* ── Preview Text ── */}
        <p className="text-center text-xs text-dark-500">
          Exporting {getPreviewText()}
        </p>
      </div>
    </div>
  );
};

export default Export;
