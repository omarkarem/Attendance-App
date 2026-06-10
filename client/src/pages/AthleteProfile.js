import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  HiOutlineArrowLeft,
  HiOutlineChartBar,
  HiOutlineCheckCircle,
  HiOutlineSparkles,
  HiOutlineUserGroup,
  HiOutlineTrophy,
  HiOutlineFire,
  HiOutlineArrowTrendingUp,
  HiOutlineArrowTrendingDown,
  HiOutlineClipboardDocumentList,
  HiOutlineCalendarDays,
  HiOutlineArrowPath,
  HiOutlineClock,
  HiOutlineMinus,
  HiOutlinePlus,
  HiOutlineXMark,
  HiOutlineBeaker
} from 'react-icons/hi2';
import { FaSwimmer, FaRunning, FaBicycle } from 'react-icons/fa';
import StatsCard from '../components/StatsCard';
import Modal from '../components/Modal';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// --- Shared utilities (same as TestResults.js) ---
const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatPace = (distanceMeters, timeSeconds, category) => {
  if (!distanceMeters || !timeSeconds) return '-';
  if (category === 'Running') {
    const distanceKm = distanceMeters / 1000;
    const timeMinutes = timeSeconds / 60;
    const paceMinKm = timeMinutes / distanceKm;
    const paceMins = Math.floor(paceMinKm);
    const paceSecs = Math.round((paceMinKm - paceMins) * 60);
    return `${paceMins}:${paceSecs.toString().padStart(2, '0')} min/km`;
  } else if (category === 'Swimming') {
    const distance100m = distanceMeters / 100;
    const timeMinutes = timeSeconds / 60;
    const paceMin100 = timeMinutes / distance100m;
    const paceMins = Math.floor(paceMin100);
    const paceSecs = Math.round((paceMin100 - paceMins) * 60);
    return `${paceMins}:${paceSecs.toString().padStart(2, '0')} min/100m`;
  } else if (category === 'Cycling') {
    const distanceKm = distanceMeters / 1000;
    const timeHours = timeSeconds / 3600;
    const speed = distanceKm / timeHours;
    return `${speed.toFixed(2)} km/h`;
  }
  return '-';
};

const getCategoryIcon = (category) => {
  switch (category) {
    case 'Running': return <FaRunning className="w-4 h-4 text-orange-400" title="Running" />;
    case 'Swimming': return <FaSwimmer className="w-4 h-4 text-blue-400" title="Swimming" />;
    case 'Cycling': return <FaBicycle className="w-4 h-4 text-green-400" title="Cycling" />;
    default: return <HiOutlineSparkles className="w-4 h-4 text-purple-400" title="Other" />;
  }
};

const DAYS_OF_WEEK = [
  { id: 0, label: 'Sun' },
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' }
];

const AthleteProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);

  // Test progress state
  const [selectedTestTypeId, setSelectedTestTypeId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Enroll modal state
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollingSaving, setEnrollingSaving] = useState(false);
  const [selectedScheduleToEnroll, setSelectedScheduleToEnroll] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchAllSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get(`/athletes/${id}/profile`);
      setProfile(data);

      // Auto-select first test type if available
      if (data.testResults.length > 0) {
        const firstType = data.testResults[0].testType?._id;
        if (firstType) setSelectedTestTypeId(firstType);
      }
    } catch (error) {
      toast.error('Failed to load athlete profile');
      navigate('/athletes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSchedules = async () => {
    try {
      const { data } = await api.get('/schedules');
      setAllSchedules(data);
    } catch {
      // non-critical, silently fail
    }
  };

  // Schedules the athlete is NOT yet enrolled in
  const unenrolledSchedules = useMemo(() => {
    if (!profile) return [];
    const enrolledIds = new Set(profile.schedules.map(s => s._id));
    return allSchedules.filter(s => !enrolledIds.has(s._id));
  }, [profile, allSchedules]);

  // --- Remove athlete from a schedule ---
  const removeFromSchedule = async (scheduleId) => {
    const schedule = profile.schedules.find(s => s._id === scheduleId);
    if (!schedule) return;
    const updated = schedule.assignedAthletes.filter(aid => {
      const idStr = typeof aid === 'object' ? aid.toString() : aid;
      return idStr !== id;
    });
    try {
      await api.put(`/schedules/${scheduleId}`, { assignedAthletes: updated });
      toast.success('Removed from template');
      fetchProfile();
    } catch {
      toast.error('Failed to remove from template');
    }
  };

  // --- Enroll athlete in a schedule ---
  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!selectedScheduleToEnroll) return;
    setEnrollingSaving(true);
    try {
      const schedule = allSchedules.find(s => s._id === selectedScheduleToEnroll);
      if (!schedule) return;
      const updated = [...(schedule.assignedAthletes || []), id];
      await api.put(`/schedules/${selectedScheduleToEnroll}`, { assignedAthletes: updated });
      toast.success('Enrolled in template');
      setShowEnrollModal(false);
      setSelectedScheduleToEnroll('');
      await fetchProfile();
      await fetchAllSchedules();
    } catch {
      toast.error('Failed to enroll in template');
    } finally {
      setEnrollingSaving(false);
    }
  };

  // --- Derived data ---
  const uniqueTestTypes = useMemo(() => {
    if (!profile?.testResults) return [];
    const map = new Map();
    profile.testResults.forEach(r => {
      if (r.testType && !map.has(r.testType._id)) {
        map.set(r.testType._id, r.testType);
      }
    });
    return Array.from(map.values());
  }, [profile]);

  const selectedTestType = uniqueTestTypes.find(t => t._id === selectedTestTypeId);

  const selectedTestResults = useMemo(() => {
    if (!profile?.testResults || !selectedTestTypeId) return [];
    return profile.testResults
      .filter(r => r.testType?._id === selectedTestTypeId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [profile, selectedTestTypeId]);

  const chartData = useMemo(() => {
    return selectedTestResults.map(r => {
      const pace = selectedTestType
        ? (() => {
            const cat = selectedTestType.category;
            if (cat === 'Running') {
              const distKm = r.distance / 1000;
              return distKm > 0 ? (r.time / 60) / distKm : 0;
            } else if (cat === 'Swimming') {
              const dist100 = r.distance / 100;
              return dist100 > 0 ? (r.time / 60) / dist100 : 0;
            } else if (cat === 'Cycling') {
              const distKm = r.distance / 1000;
              const timeH = r.time / 3600;
              return timeH > 0 ? distKm / timeH : 0;
            }
            return r.time;
          })()
        : r.time;

      return {
        date: format(new Date(r.date), 'MMM d'),
        fullDate: format(new Date(r.date), 'MMM d, yyyy'),
        value: Math.round(pace * 100) / 100,
        time: r.time,
        distance: r.distance
      };
    });
  }, [selectedTestResults, selectedTestType]);

  const analytics = useMemo(() => {
    if (selectedTestResults.length === 0) return null;

    const category = selectedTestType?.category;
    const isLowerBetter = category === 'Running' || category === 'Swimming';

    const values = chartData.map(d => d.value);
    const best = isLowerBetter ? Math.min(...values) : Math.max(...values);
    const latest = values[values.length - 1];
    const first = values[0];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const improvement = first !== 0
      ? (isLowerBetter
          ? Math.round(((first - latest) / first) * 100)
          : Math.round(((latest - first) / first) * 100))
      : 0;

    let paceLabel = 'Pace';
    let paceUnit = '';
    if (category === 'Running') { paceUnit = 'min/km'; }
    else if (category === 'Swimming') { paceUnit = 'min/100m'; }
    else if (category === 'Cycling') { paceLabel = 'Speed'; paceUnit = 'km/h'; }
    else { paceLabel = 'Time'; paceUnit = 's'; }

    const formatValue = (v) => {
      if (category === 'Running' || category === 'Swimming') {
        const mins = Math.floor(v);
        const secs = Math.round((v - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      }
      return v.toFixed(2);
    };

    return {
      best: formatValue(best),
      latest: formatValue(latest),
      avg: formatValue(avg),
      improvement,
      count: selectedTestResults.length,
      paceLabel,
      paceUnit,
      isLowerBetter
    };
  }, [selectedTestResults, chartData, selectedTestType]);

  const filteredTestHistory = useMemo(() => {
    if (!profile?.testResults) return [];
    if (categoryFilter === 'All') return profile.testResults;
    return profile.testResults.filter(r => r.testType?.category === categoryFilter);
  }, [profile, categoryFilter]);

  // --- Tooltips ---
  const AttendanceTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card px-3 py-2 text-sm">
          <p className="text-dark-400">{label}</p>
          <p className="text-accent-400 font-semibold">{payload[0].value} sessions attended</p>
          {payload[0].payload.rate !== undefined && (
            <p className="text-dark-300 text-xs">{payload[0].payload.rate}% rate</p>
          )}
        </div>
      );
    }
    return null;
  };

  const ProgressTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="glass-card px-3 py-2 text-sm">
          <p className="text-dark-400">{d.fullDate}</p>
          <p className="text-accent-400 font-semibold">
            {analytics?.paceLabel}: {d.value} {analytics?.paceUnit}
          </p>
          <p className="text-dark-300 text-xs">
            Time: {formatTime(d.time)} • Dist: {d.distance >= 1000 ? `${(d.distance / 1000).toFixed(2)} km` : `${d.distance} m`}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-3 border-accent-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const { athlete, attendance, schedules, testResults } = profile;

  return (
    <div className="page-container pb-32">

      {/* ============ HEADER ============ */}
      <div className="flex items-center gap-4 mb-6 animate-fade-in">
        <button
          onClick={() => navigate('/athletes')}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-all flex-shrink-0"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500/40 to-neon-purple/40 flex items-center justify-center text-xl font-bold text-white flex-shrink-0 border border-accent-500/20">
          {athlete.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-white truncate">{athlete.name}</h1>
            {athlete.isNewAthlete && (
              <span className="badge-new flex-shrink-0">
                <HiOutlineSparkles className="w-3 h-3" />
                NEW
              </span>
            )}
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              athlete.active
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {athlete.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-dark-400 mt-0.5">
            <HiOutlineCalendarDays className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            Joined {format(new Date(athlete.joinDate), 'MMMM d, yyyy')}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            id="enroll-template-btn"
            onClick={() => { setSelectedScheduleToEnroll(''); setShowEnrollModal(true); }}
            className="btn-secondary !px-3 !py-2 flex items-center gap-1.5 text-sm"
            title="Enroll in Template"
          >
            <HiOutlineArrowPath className="w-4 h-4 text-neon-purple" />
            <span className="hidden sm:inline">Enroll</span>
          </button>
          <button
            id="record-test-btn"
            onClick={() => navigate(`/tests?athleteId=${id}`)}
            className="btn-primary !px-3 !py-2 flex items-center gap-1.5 text-sm"
            title="Record a Test"
          >
            <HiOutlineBeaker className="w-4 h-4" />
            <span className="hidden sm:inline">Record Test</span>
          </button>
        </div>
      </div>

      {/* ============ STATS CARDS ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <StatsCard icon={HiOutlineChartBar} label="Attendance Rate" value={`${attendance.rate}%`} color="accent" />
        <StatsCard icon={HiOutlineCheckCircle} label="Sessions Attended" value={attendance.attended} color="blue" />
        <StatsCard icon={HiOutlineClipboardDocumentList} label="Tests Recorded" value={profile.testCount} color="purple" />
        <StatsCard icon={HiOutlineFire} label="Active Streak" value={attendance.streak} color="amber" />
      </div>

      {/* ============ ATTENDANCE TREND ============ */}
      {attendance.monthlyTrend && attendance.monthlyTrend.some(m => m.total > 0) && (
        <div className="glass-card p-5 mb-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HiOutlineChartBar className="w-5 h-5 text-accent-400" />
            Attendance Trend (Last 6 Months)
          </h2>
          <div className="h-48 md:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendance.monthlyTrend}>
                <defs>
                  <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d54" />
                <XAxis dataKey="month" stroke="#5a5a84" tick={{ fill: '#5a5a84', fontSize: 12 }} />
                <YAxis stroke="#5a5a84" tick={{ fill: '#5a5a84', fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<AttendanceTooltip />} />
                <Area type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorAttendance)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ============ ENROLLED SCHEDULES ============ */}
      <div className="glass-card p-5 mb-6 animate-fade-in" style={{ animationDelay: '150ms' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <HiOutlineArrowPath className="w-5 h-5 text-neon-purple" />
            Enrolled Templates
          </h2>
          <button
            onClick={() => { setSelectedScheduleToEnroll(''); setShowEnrollModal(true); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-neon-purple/10 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/20 transition-all flex items-center gap-1.5"
          >
            <HiOutlinePlus className="w-3.5 h-3.5" />
            Enroll
          </button>
        </div>

        {schedules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {schedules.map(schedule => (
              <div key={schedule._id} className="bg-dark-700/50 border border-dark-600/50 rounded-xl p-4 relative group">
                {/* Remove button */}
                <button
                  id={`remove-schedule-${schedule._id}`}
                  onClick={() => removeFromSchedule(schedule._id)}
                  className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center text-dark-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                  title="Remove from this template"
                >
                  <HiOutlineXMark className="w-3.5 h-3.5" />
                </button>

                <h3 className="font-semibold text-white mb-1 pr-6">{schedule.name}</h3>
                <p className="text-xs text-dark-400 mb-3 flex items-center gap-1">
                  <HiOutlineClock className="w-3.5 h-3.5" />
                  {schedule.time || '12:00'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map(day => (
                    <span key={day.id} className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                      schedule.daysOfWeek.includes(day.id)
                        ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                        : 'bg-dark-600/50 text-dark-500 border border-dark-600'
                    }`}>
                      {day.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-dark-700 flex items-center justify-center">
              <HiOutlineArrowPath className="w-6 h-6 text-dark-400" />
            </div>
            <p className="text-dark-400 text-sm mb-3">{athlete.name} isn't enrolled in any template yet.</p>
            <button
              onClick={() => { setSelectedScheduleToEnroll(''); setShowEnrollModal(true); }}
              className="text-sm px-4 py-2 rounded-xl bg-neon-purple/10 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/20 transition-all inline-flex items-center gap-1.5"
            >
              <HiOutlinePlus className="w-4 h-4" />
              Enroll in Template
            </button>
          </div>
        )}
      </div>

      {/* ============ PERFORMANCE PROGRESS ============ */}
      {uniqueTestTypes.length > 0 ? (
        <div className="glass-card p-5 mb-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <HiOutlineTrophy className="w-5 h-5 text-amber-400" />
              Performance Progress
            </h2>
            <div className="flex items-center gap-2">
              <select
                id="test-type-selector"
                value={selectedTestTypeId}
                onChange={(e) => setSelectedTestTypeId(e.target.value)}
                className="bg-dark-800 border border-dark-600 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-accent-500 w-full sm:w-auto"
              >
                {uniqueTestTypes.map(t => (
                  <option key={t._id} value={t._id}>{t.title} ({t.category})</option>
                ))}
              </select>
              <button
                onClick={() => navigate(`/tests?athleteId=${id}`)}
                className="btn-primary !px-3 !py-2 flex items-center gap-1.5 text-sm whitespace-nowrap"
                title="Record a new test"
              >
                <HiOutlineBeaker className="w-4 h-4" />
                <span className="hidden md:inline">Record Test</span>
              </button>
            </div>
          </div>

          {/* Progress Chart */}
          {chartData.length > 1 ? (
            <div className="h-56 md:h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d2d54" />
                  <XAxis dataKey="date" stroke="#5a5a84" tick={{ fill: '#5a5a84', fontSize: 11 }} />
                  <YAxis stroke="#5a5a84" tick={{ fill: '#5a5a84', fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip content={<ProgressTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#8b5cf6', stroke: '#1c1c38', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#a78bfa', stroke: '#8b5cf6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : chartData.length === 1 ? (
            <div className="text-center py-8 mb-6">
              <p className="text-dark-400 text-sm">Only 1 result recorded — need at least 2 for a chart</p>
              <p className="text-white font-semibold mt-2">{analytics?.paceLabel}: {analytics?.latest} {analytics?.paceUnit}</p>
            </div>
          ) : (
            <div className="text-center py-8 mb-6">
              <p className="text-dark-400 text-sm">No results for this test type</p>
            </div>
          )}

          {/* Analytics Cards */}
          {analytics && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-dark-700/50 border border-dark-600/50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <HiOutlineTrophy className="w-4 h-4 text-amber-400" />
                  <p className="text-xs text-dark-400 font-medium">Personal Best</p>
                </div>
                <p className="text-lg font-bold text-white">{analytics.best}</p>
                <p className="text-[10px] text-dark-500">{analytics.paceUnit}</p>
              </div>
              <div className="bg-dark-700/50 border border-dark-600/50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <HiOutlineClock className="w-4 h-4 text-blue-400" />
                  <p className="text-xs text-dark-400 font-medium">Latest</p>
                </div>
                <p className="text-lg font-bold text-white">{analytics.latest}</p>
                <p className="text-[10px] text-dark-500">{analytics.paceUnit}</p>
              </div>
              <div className="bg-dark-700/50 border border-dark-600/50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <HiOutlineMinus className="w-4 h-4 text-dark-300" />
                  <p className="text-xs text-dark-400 font-medium">Average</p>
                </div>
                <p className="text-lg font-bold text-white">{analytics.avg}</p>
                <p className="text-[10px] text-dark-500">{analytics.paceUnit}</p>
              </div>
              <div className="bg-dark-700/50 border border-dark-600/50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {analytics.improvement >= 0
                    ? <HiOutlineArrowTrendingUp className="w-4 h-4 text-accent-400" />
                    : <HiOutlineArrowTrendingDown className="w-4 h-4 text-red-400" />
                  }
                  <p className="text-xs text-dark-400 font-medium">Improvement</p>
                </div>
                <p className={`text-lg font-bold ${analytics.improvement >= 0 ? 'text-accent-400' : 'text-red-400'}`}>
                  {analytics.improvement >= 0 ? '+' : ''}{analytics.improvement}%
                </p>
                <p className="text-[10px] text-dark-500">vs first result</p>
              </div>
              <div className="bg-dark-700/50 border border-dark-600/50 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <HiOutlineClipboardDocumentList className="w-4 h-4 text-neon-purple" />
                  <p className="text-xs text-dark-400 font-medium">Total Tests</p>
                </div>
                <p className="text-lg font-bold text-white">{analytics.count}</p>
                <p className="text-[10px] text-dark-500">recorded</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* No tests yet — show a prompt */
        <div className="glass-card p-6 mb-6 animate-fade-in text-center" style={{ animationDelay: '200ms' }}>
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 flex items-center justify-center">
            <HiOutlineTrophy className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-dark-400 text-sm mb-3">No performance tests recorded yet for {athlete.name}.</p>
          <button
            onClick={() => navigate(`/tests?athleteId=${id}`)}
            className="btn-primary !px-4 !py-2 text-sm inline-flex items-center gap-2"
          >
            <HiOutlineBeaker className="w-4 h-4" />
            Record First Test
          </button>
        </div>
      )}

      {/* ============ TEST RESULTS HISTORY ============ */}
      {testResults.length > 0 && (
        <div className="glass-card p-5 animate-fade-in" style={{ animationDelay: '250ms' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <HiOutlineClipboardDocumentList className="w-5 h-5 text-accent-400" />
              Test History
            </h2>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-dark-800 border border-dark-600 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-accent-500 w-full sm:w-auto"
            >
              <option value="All">All Sports</option>
              <option value="Running">Running</option>
              <option value="Swimming">Swimming</option>
              <option value="Cycling">Cycling</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {filteredTestHistory.length === 0 ? (
            <p className="text-dark-400 text-sm text-center py-4">No results match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-12 gap-3 pb-3 border-b border-dark-600/50 text-xs font-medium text-dark-400">
                  <div className="col-span-1"></div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-3">Test</div>
                  <div className="col-span-2 text-right">Distance</div>
                  <div className="col-span-2 text-right">Time</div>
                  <div className="col-span-2 text-right">Pace</div>
                </div>
                <div className="divide-y divide-dark-600/30 text-sm">
                  {filteredTestHistory.map((r, idx) => (
                    <div
                      key={r._id}
                      className="grid grid-cols-12 gap-3 py-3 items-center text-white hover:bg-dark-800/50 transition-colors rounded-lg px-1 -mx-1 animate-slide-up"
                      style={{ animationDelay: `${idx * 20}ms` }}
                    >
                      <div className="col-span-1 flex justify-center">
                        <div className="p-1.5 bg-dark-800 rounded-lg border border-dark-600/50">
                          {getCategoryIcon(r.testType?.category)}
                        </div>
                      </div>
                      <div className="col-span-2 text-dark-300 text-xs">{format(new Date(r.date), 'MMM d, yyyy')}</div>
                      <div className="col-span-3">
                        <span className="bg-dark-700 px-2 py-1 rounded text-xs truncate max-w-full inline-block">
                          {r.testType?.title || 'Unknown'}
                        </span>
                      </div>
                      <div className="col-span-2 text-right text-dark-300 text-xs">
                        {r.distance >= 1000 ? `${(r.distance / 1000).toFixed(2)} km` : `${r.distance} m`}
                      </div>
                      <div className="col-span-2 text-right text-dark-300 text-xs">{formatTime(r.time)}</div>
                      <div className="col-span-2 text-right font-medium text-accent-400 text-xs whitespace-nowrap">
                        {formatPace(r.distance, r.time, r.testType?.category)}
                      </div>
                      {r.description && (
                        <div className="col-span-12 text-[11px] text-dark-400 mt-0.5 italic px-1">"{r.description}"</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ EMPTY STATE ============ */}
      {testResults.length === 0 && schedules.length === 0 && attendance.totalSessions === 0 && (
        <div className="glass-card p-8 text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-700 flex items-center justify-center">
            <HiOutlineUserGroup className="w-8 h-8 text-dark-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No data yet</h3>
          <p className="text-dark-400">Start tracking {athlete.name}'s attendance and tests to see their profile come to life.</p>
        </div>
      )}

      {/* ============ ENROLL IN TEMPLATE MODAL ============ */}
      <Modal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        title={`Enroll ${athlete.name} in Template`}
      >
        {unenrolledSchedules.length === 0 ? (
          <div className="text-center py-6">
            <HiOutlineArrowPath className="w-10 h-10 mx-auto mb-3 text-dark-400" />
            <p className="text-dark-400 text-sm">
              {allSchedules.length === 0
                ? 'No templates found. Create a template first from the Sessions page.'
                : `${athlete.name} is already enrolled in all available templates.`
              }
            </p>
            <button
              onClick={() => { setShowEnrollModal(false); navigate('/sessions'); }}
              className="mt-4 btn-secondary text-sm"
            >
              Go to Sessions
            </button>
          </div>
        ) : (
          <form onSubmit={handleEnroll} className="space-y-4">
            <p className="text-xs text-dark-400">
              Select a template to enroll {athlete.name} in. They'll be automatically expected in future sessions generated from that template.
            </p>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Select Template</label>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {unenrolledSchedules.map(s => (
                  <label
                    key={s._id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedScheduleToEnroll === s._id
                        ? 'border-neon-purple/50 bg-neon-purple/10'
                        : 'border-dark-600 bg-dark-700/50 hover:bg-dark-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="schedule"
                      value={s._id}
                      checked={selectedScheduleToEnroll === s._id}
                      onChange={() => setSelectedScheduleToEnroll(s._id)}
                      className="hidden"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 transition-all ${
                      selectedScheduleToEnroll === s._id ? 'border-neon-purple bg-neon-purple' : 'border-dark-400'
                    }`} />
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm">{s.name}</p>
                      <p className="text-xs text-dark-400 mt-0.5">
                        {DAYS_OF_WEEK.filter(d => s.daysOfWeek.includes(d.id)).map(d => d.label).join(', ')}
                        {s.time ? ` • ${s.time}` : ''}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowEnrollModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                type="submit"
                disabled={!selectedScheduleToEnroll || enrollingSaving}
                className="btn-primary flex-1"
              >
                {enrollingSaving ? 'Enrolling...' : 'Enroll'}
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
};

export default AthleteProfile;
