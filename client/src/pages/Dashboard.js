import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import StatsCard from '../components/StatsCard';
import toast from 'react-hot-toast';
import {
  HiOutlineCalendar,
  HiOutlineUserGroup,
  HiOutlineCheckCircle,
  HiOutlineChartBar,
  HiOutlinePlus,
  HiOutlineSparkles
} from 'react-icons/hi2';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/attendance/stats');
      setStats(data);
    } catch (error) {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card px-3 py-2 text-sm">
          <p className="text-dark-400">Day {label}</p>
          <p className="text-accent-400 font-semibold">{payload[0].value} present</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title mb-1">Dashboard</h1>
          <p className="text-dark-400 text-sm">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => navigate('/sessions')}
          className="btn-primary flex items-center gap-2 whitespace-nowrap text-sm"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Start Session
        </button>
        <button
          onClick={() => navigate('/athletes')}
          className="btn-secondary flex items-center gap-2 whitespace-nowrap text-sm"
        >
          <HiOutlineUserGroup className="w-4 h-4" />
          Add Athlete
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatsCard
          icon={HiOutlineCalendar}
          label="Today's Sessions"
          value={stats?.today?.sessions || 0}
          color="accent"
        />
        <StatsCard
          icon={HiOutlineCheckCircle}
          label="Present Today"
          value={stats?.today?.present || 0}
          color="blue"
        />
        <StatsCard
          icon={HiOutlineUserGroup}
          label="Total Athletes"
          value={stats?.totalAthletes || 0}
          color="purple"
        />
        <StatsCard
          icon={HiOutlineChartBar}
          label="Monthly Sessions"
          value={stats?.month?.sessions || 0}
          color="amber"
        />
      </div>

      {/* Attendance Chart */}
      {stats?.month?.dailyTrend && stats.month.dailyTrend.length > 0 && (
        <div className="glass-card p-5 mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HiOutlineChartBar className="w-5 h-5 text-accent-400" />
            Monthly Attendance Trend
          </h2>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.month.dailyTrend}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d54" />
                <XAxis
                  dataKey="day"
                  stroke="#5a5a84"
                  tick={{ fill: '#5a5a84', fontSize: 12 }}
                />
                <YAxis
                  stroke="#5a5a84"
                  tick={{ fill: '#5a5a84', fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="present"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPresent)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Athlete Growth & Churn Chart */}
      {stats?.churn && (
        <div className="glass-card p-5 mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HiOutlineUserGroup className="w-5 h-5 text-neon-purple" />
            Athlete Growth & Churn
          </h2>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    name: 'Metrics',
                    'Joined This Month': stats.churn.joinedThisMonth,
                    'Currently Inactive': stats.churn.inactiveAthletes
                  }
                ]}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d54" />
                <XAxis dataKey="name" stroke="#5a5a84" tick={{ fill: '#5a5a84', fontSize: 12 }} />
                <YAxis stroke="#5a5a84" tick={{ fill: '#5a5a84', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{ backgroundColor: '#1c1c38', border: '1px solid #2d2d54', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="Joined This Month" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="Currently Inactive" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Athlete Stats */}
      {stats?.athleteStats && stats.athleteStats.length > 0 && (
        <div className="glass-card p-5 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HiOutlineUserGroup className="w-5 h-5 text-neon-purple" />
            Athlete Attendance This Month
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {stats.athleteStats.map((athlete) => (
              <div key={athlete.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{athlete.name}</span>
                    {athlete.isNewAthlete && (
                      <span className="badge-new">
                        <HiOutlineSparkles className="w-3 h-3" />
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-dark-400">{athlete.attended}/{athlete.totalSessions} sessions</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Progress bar */}
                  <div className="w-20 md:w-32 h-2 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${athlete.percentage}%`,
                        background: athlete.percentage >= 75
                          ? 'linear-gradient(to right, #10b981, #06d6a0)'
                          : athlete.percentage >= 50
                            ? 'linear-gradient(to right, #f59e0b, #eab308)'
                            : 'linear-gradient(to right, #ef4444, #f87171)'
                      }}
                    />
                  </div>
                  <span className={`text-sm font-semibold w-10 text-right ${athlete.percentage >= 75 ? 'text-accent-400' :
                    athlete.percentage >= 50 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                    {athlete.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!stats?.athleteStats || stats.athleteStats.length === 0) && (
        <div className="glass-card p-8 text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-500/10 flex items-center justify-center">
            <HiOutlineUserGroup className="w-8 h-8 text-accent-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No athletes yet</h3>
          <p className="text-dark-400 mb-4">Start by adding your athletes to begin tracking attendance</p>
          <button onClick={() => navigate('/athletes')} className="btn-primary">
            Add Athletes
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
