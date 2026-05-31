import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  HiOutlinePlus,
  HiOutlineCalendar,
  HiOutlineUserGroup,
  HiOutlineTrash,
  HiOutlineClipboardDocumentCheck,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineArrowPath
} from 'react-icons/hi2';

const DAYS_OF_WEEK = [
  { id: 0, label: 'Sun', full: 'Sunday' },
  { id: 1, label: 'Mon', full: 'Monday' },
  { id: 2, label: 'Tue', full: 'Tuesday' },
  { id: 3, label: 'Wed', full: 'Wednesday' },
  { id: 4, label: 'Thu', full: 'Thursday' },
  { id: 5, label: 'Fri', full: 'Friday' },
  { id: 6, label: 'Sat', full: 'Saturday' }
];

const Sessions = () => {
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' or 'schedules'
  
  // Daily Sessions State
  const [sessions, setSessions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  
  // Schedules State
  const [schedules, setSchedules] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleDays, setScheduleDays] = useState([]);
  const [scheduleTime, setScheduleTime] = useState('12:00');
  
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchSessions();
    } else {
      fetchSchedules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, activeTab]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data } = await api.get(`/sessions?date=${dateStr}`);
      setSessions(data);
    } catch (error) {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/schedules');
      setSchedules(data);
    } catch (error) {
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (e) => {
    e.preventDefault();
    if (!sessionName.trim()) {
      toast.error('Please enter a session name');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post('/sessions', {
        name: sessionName.trim(),
        date: format(selectedDate, 'yyyy-MM-dd')
      });
      setSessions([data, ...sessions]);
      setShowCreateModal(false);
      setSessionName('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const createSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleName.trim() || scheduleDays.length === 0) {
      toast.error('Please enter a name and select at least one day');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post('/schedules', {
        name: scheduleName.trim(),
        daysOfWeek: scheduleDays,
        time: scheduleTime
      });
      setSchedules([data, ...schedules]);
      setShowScheduleModal(false);
      setScheduleName('');
      setScheduleDays([]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create schedule');
    } finally {
      setCreating(false);
    }
  };

  const deleteSession = async (id) => {
    try {
      await api.delete(`/sessions/${id}`);
      setSessions(sessions.filter(s => s._id !== id));
      setSessions(sessions.filter(s => s._id !== id));
    } catch (error) {
      toast.error('Failed to delete session');
    }
  };

  const deleteSchedule = async (id) => {
    try {
      await api.delete(`/schedules/${id}`);
      setSchedules(schedules.filter(s => s._id !== id));
      setSchedules(schedules.filter(s => s._id !== id));
    } catch (error) {
      toast.error('Failed to delete schedule');
    }
  };

  const toggleDay = (dayId) => {
    if (scheduleDays.includes(dayId)) {
      setScheduleDays(scheduleDays.filter(id => id !== dayId));
    } else {
      setScheduleDays([...scheduleDays, dayId]);
    }
  };

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="page-container">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="page-title !mb-0">Sessions</h1>
        
        {/* Tab Navigation */}
        <div className="flex bg-dark-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 md:w-32 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'daily' ? 'bg-dark-600 text-white shadow' : 'text-dark-400 hover:text-white'
            }`}
          >
            Daily Log
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`flex-1 md:w-32 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'schedules' ? 'bg-dark-600 text-white shadow' : 'text-dark-400 hover:text-white'
            }`}
          >
            Templates
          </button>
        </div>

        {activeTab === 'daily' ? (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center justify-center gap-2 text-sm">
            <HiOutlinePlus className="w-4 h-4" />
            <span>New Session</span>
          </button>
        ) : (
          <button onClick={() => setShowScheduleModal(true)} className="btn-primary flex items-center justify-center gap-2 text-sm">
            <HiOutlineArrowPath className="w-4 h-4" />
            <span>New Template</span>
          </button>
        )}
      </div>

      {activeTab === 'daily' && (
        <>
          {/* Date Selector */}
          <div className="glass-card p-3 mb-6 flex items-center justify-between">
            <button onClick={() => changeDate(-1)} className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-600 transition-all">
              <HiOutlineChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {isToday ? 'Today' : format(selectedDate, 'EEEE')}
              </p>
              <p className="text-xs text-dark-400">
                {format(selectedDate, 'MMM d, yyyy')}
              </p>
            </div>
            <button onClick={() => changeDate(1)} className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-600 transition-all">
              <HiOutlineChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Sessions List */}
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sessions.length > 0 ? (
            <div className="space-y-4">
              {sessions.map((session, index) => (
                <div key={session._id} className="glass-card-hover p-4 animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <HiOutlineCalendar className="w-4 h-4 text-accent-400 flex-shrink-0" />
                        <h3 className="font-semibold text-white truncate">{session.name}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-dark-400">
                        <span className="flex items-center gap-1">
                          <HiOutlineUserGroup className="w-3.5 h-3.5" />
                          {session.presentCount || 0}/{session.totalCount || 0} present
                        </span>
                        {session.scheduleId && (
                          <span className="flex items-center gap-1 text-accent-400/80">
                            <HiOutlineArrowPath className="w-3.5 h-3.5" />
                            Auto-generated
                          </span>
                        )}
                        <span>{format(new Date(session.date), 'h:mm a')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button onClick={() => navigate(`/checkin/${session._id}`)} className="btn-primary !px-4 !py-2 text-sm flex items-center gap-1.5">
                        <HiOutlineClipboardDocumentCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Check In</span>
                      </button>
                      <button onClick={() => deleteSession(session._id)} className="w-9 h-9 flex items-center justify-center rounded-xl text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-700 flex items-center justify-center">
                <HiOutlineCalendar className="w-8 h-8 text-dark-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No sessions</h3>
              <p className="text-dark-400 mb-4">
                {isToday ? "No sessions generated or created for today" : "No sessions on this day"}
              </p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                <HiOutlinePlus className="w-4 h-4 inline mr-2" />
                Create Manual Session
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'schedules' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : schedules.length > 0 ? (
            <div className="space-y-4">
              {schedules.map((schedule, index) => (
                <div key={schedule._id} className="glass-card p-5 animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-white mb-1">{schedule.name}</h3>
                      <p className="text-xs text-dark-400 flex items-center gap-1">
                        <HiOutlineArrowPath className="w-3.5 h-3.5" />
                        Auto-generates at {schedule.time || '12:00'}
                      </p>
                    </div>
                    <button onClick={() => deleteSchedule(schedule._id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <span key={day.id} className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                        schedule.daysOfWeek.includes(day.id) 
                          ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30' 
                          : 'bg-dark-700/50 text-dark-500 border border-dark-600'
                      }`}>
                        {day.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-700 flex items-center justify-center">
                <HiOutlineArrowPath className="w-8 h-8 text-dark-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Templates</h3>
              <p className="text-dark-400 mb-4 max-w-sm mx-auto">
                Create a recurring template to automatically generate sessions on specific days of the week.
              </p>
              <button onClick={() => setShowScheduleModal(true)} className="btn-primary">
                <HiOutlinePlus className="w-4 h-4 inline mr-2" />
                Create Template
              </button>
            </div>
          )}
        </>
      )}

      {/* Create Manual Session Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Manual Session">
        <form onSubmit={createSession} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Session Name</label>
            <input id="session-name" type="text" value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="e.g., Make-up class" className="w-full" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Date</label>
            <div className="glass-card px-4 py-3 text-sm text-dark-300">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={creating} className="btn-primary flex-1">{creating ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Create Schedule Modal */}
      <Modal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} title="New Recurring Template">
        <form onSubmit={createSchedule} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Template Name</label>
            <input id="schedule-name" type="text" value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="e.g., Swim Session" className="w-full" autoFocus />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Time (Optional)</label>
            <input id="schedule-time" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full" />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Repeats On</label>
            <div className="grid grid-cols-4 gap-2">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                    scheduleDays.includes(day.id)
                      ? 'bg-accent-500/20 border-accent-500/50 text-accent-400 shadow-glow'
                      : 'bg-dark-700/50 border-dark-600 text-dark-400 hover:bg-dark-600'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowScheduleModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={creating} className="btn-primary flex-1">{creating ? 'Saving...' : 'Save Template'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Sessions;
