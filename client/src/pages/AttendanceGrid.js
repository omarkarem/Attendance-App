import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format, startOfWeek, addWeeks, subWeeks, endOfWeek } from 'date-fns';
import {
  HiOutlineTableCells,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineSparkles
} from 'react-icons/hi2';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AttendanceGrid = () => {
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' | 'weekly'
  
  // Monthly State
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  
  // Weekly State (Starts on Sunday)
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(now));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState('all');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, month, year, currentWeekStart]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (viewMode === 'monthly') {
        const { data: result } = await api.get(`/attendance/monthly?month=${month}&year=${year}`);
        setData(result);
      } else {
        const end = endOfWeek(currentWeekStart);
        const startStr = format(currentWeekStart, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');
        const { data: result } = await api.get(`/attendance/range?startDate=${startStr}&endDate=${endStr}`);
        setData(result);
      }
    } catch (error) {
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (dir) => {
    let newMonth = month + dir;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const changeWeek = (dir) => {
    if (dir > 0) {
      setCurrentWeekStart(addWeeks(currentWeekStart, 1));
    } else {
      setCurrentWeekStart(subWeeks(currentWeekStart, 1));
    }
  };

  // Build grid data
  const buildGrid = () => {
    if (!data || !data.sessions.length) return null;

    let sessions = data.sessions;
    if (sessionFilter !== 'all') {
      sessions = sessions.filter(s => s.name === sessionFilter);
    }

    // Build lookup: athleteId-sessionId -> present
    const lookup = {};
    data.attendance.forEach(a => {
      const athleteId = a.athlete?._id || a.athlete;
      const sessionId = a.session;
      lookup[`${athleteId}-${sessionId}`] = a.present;
    });

    // Get unique session names for filter
    const uniqueNames = [...new Set(data.sessions.map(s => s.name))];

    return { sessions, lookup, uniqueNames };
  };

  const gridData = !loading ? buildGrid() : null;

  return (
    <div className="page-container">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="page-title flex items-center gap-2 !mb-0">
          <HiOutlineTableCells className="w-7 h-7 text-accent-400" />
          Attendance Grid
        </h1>
        
        {/* View Mode Toggle */}
        <div className="flex bg-dark-800 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('monthly')}
            className={`flex-1 md:w-32 py-2 text-sm font-medium rounded-lg transition-all ${
              viewMode === 'monthly' ? 'bg-dark-600 text-white shadow' : 'text-dark-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`flex-1 md:w-32 py-2 text-sm font-medium rounded-lg transition-all ${
              viewMode === 'weekly' ? 'bg-dark-600 text-white shadow' : 'text-dark-400 hover:text-white'
            }`}
          >
            Weekly
          </button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="glass-card p-3 mb-6 flex items-center justify-between">
        <button
          onClick={() => viewMode === 'monthly' ? changeMonth(-1) : changeWeek(-1)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-600 transition-all"
        >
          <HiOutlineChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          {viewMode === 'monthly' ? (
            <>
              <p className="font-semibold text-white">{monthNames[month - 1]}</p>
              <p className="text-xs text-dark-400">{year}</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-white">Week of {format(currentWeekStart, 'MMM d')}</p>
              <p className="text-xs text-dark-400">{format(currentWeekStart, 'yyyy')}</p>
            </>
          )}
        </div>
        <button
          onClick={() => viewMode === 'monthly' ? changeMonth(1) : changeWeek(1)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-600 transition-all"
        >
          <HiOutlineChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Session Filter */}
      {gridData?.uniqueNames && gridData.uniqueNames.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSessionFilter('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              sessionFilter === 'all'
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                : 'bg-dark-700 text-dark-400 border border-dark-600'
            }`}
          >
            All Sessions
          </button>
          {gridData.uniqueNames.map(name => (
            <button
              key={name}
              onClick={() => setSessionFilter(name)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                sessionFilter === name
                  ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                  : 'bg-dark-700 text-dark-400 border border-dark-600'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Grid Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : gridData && gridData.sessions.length > 0 ? (
        <div className="glass-card overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-dark-700/50">
                  <th className="sticky left-0 z-10 bg-dark-700 px-4 py-3 text-left font-semibold text-dark-300 min-w-[140px]">
                    Athlete
                  </th>
                  {gridData.sessions.map(s => (
                    <th key={s._id} className="px-2 py-3 text-center font-medium text-dark-400 min-w-[50px]">
                      <div className="text-xs">{viewMode === 'weekly' ? format(new Date(s.date), 'EEE d') : new Date(s.date).getDate()}</div>
                      <div className="text-[10px] text-dark-500 whitespace-normal break-words w-16 mx-auto leading-tight">{s.name}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold text-dark-300 min-w-[50px]">%</th>
                </tr>
              </thead>
              <tbody>
                {data.athletes.map((athlete, idx) => {
                  let total = 0;
                  let present = 0;
                  gridData.sessions.forEach(s => {
                    total++;
                    if (gridData.lookup[`${athlete._id}-${s._id}`]) present++;
                  });
                  const pct = total > 0 ? Math.round((present / total) * 100) : 0;

                  return (
                    <tr key={athlete._id} className={idx % 2 === 0 ? 'bg-dark-800/30' : ''}>
                      <td className="sticky left-0 z-10 px-4 py-3 font-medium text-white whitespace-nowrap bg-dark-800 border-r border-dark-700/50">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[120px]">{athlete.name}</span>
                          {athlete.isNewAthlete && (
                            <HiOutlineSparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          )}
                        </div>
                      </td>
                      {gridData.sessions.map(s => {
                        const isPresent = gridData.lookup[`${athlete._id}-${s._id}`];
                        return (
                          <td key={s._id} className={`px-2 py-3 text-center ${isPresent ? 'grid-cell-present' : 'grid-cell-absent'}`}>
                            {isPresent ? (
                              <HiOutlineCheckCircle className="w-5 h-5 mx-auto" />
                            ) : (
                              <HiOutlineXCircle className="w-5 h-5 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                      <td className={`px-3 py-3 text-center font-bold ${
                        pct >= 75 ? 'text-accent-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card p-8 text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-700 flex items-center justify-center">
            <HiOutlineTableCells className="w-8 h-8 text-dark-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No attendance data</h3>
          <p className="text-dark-400">
            {viewMode === 'monthly' 
              ? `No sessions found for ${monthNames[month - 1]} ${year}` 
              : `No sessions found for the week of ${format(currentWeekStart, 'MMM d, yyyy')}`}
          </p>
        </div>
      )}
    </div>
  );
};

export default AttendanceGrid;
