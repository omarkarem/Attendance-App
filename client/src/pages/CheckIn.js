import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineSparkles,
  HiOutlineMagnifyingGlass,
  HiOutlineDocumentDuplicate
} from 'react-icons/hi2';

const CheckIn = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [attendance, setAttendance] = useState({}); // { athleteId: true/false }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (session?.assignedAthletes?.length > 0) {
      setShowAll(false);
    } else {
      setShowAll(true);
    }
  }, [session]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const fetchData = async () => {
    try {
      const [sessionRes, athletesRes, attendanceRes] = await Promise.all([
        api.get(`/sessions/${sessionId}`),
        api.get('/athletes'),
        api.get(`/attendance/session/${sessionId}`)
      ]);

      setSession(sessionRes.data);
      setAthletes(athletesRes.data);

      // Build attendance map from existing records
      const attMap = {};
      athletesRes.data.forEach(a => {
        attMap[a._id] = false; // default absent
      });
      attendanceRes.data.forEach(a => {
        const athleteId = a.athlete?._id || a.athlete;
        attMap[athleteId] = a.present;
      });
      setAttendance(attMap);
    } catch (error) {
      toast.error('Failed to load session data');
      navigate('/sessions');
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = (athleteId) => {
    setAttendance(prev => ({
      ...prev,
      [athleteId]: !prev[athleteId]
    }));
    setHasChanges(true);
  };

  const markAllPresent = () => {
    const newAtt = { ...attendance };
    filteredAthletes.forEach(a => {
      newAtt[a._id] = true;
    });
    setAttendance(newAtt);
    setHasChanges(true);
  };

  const markAllAbsent = () => {
    const newAtt = { ...attendance };
    filteredAthletes.forEach(a => {
      newAtt[a._id] = false;
    });
    setAttendance(newAtt);
    setHasChanges(true);
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const records = Object.entries(attendance)
        .filter(([athleteId, present]) => {
          if (present) return true;
          if (session?.assignedAthletes?.length > 0) {
            return session.assignedAthletes.includes(athleteId);
          }
          return true;
        })
        .map(([athleteId, present]) => ({
          athleteId,
          present
        }));

      await api.post('/attendance/bulk', {
        sessionId,
        records
      });

      setHasChanges(false);
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const visibleAthletes = athletes.filter(a => {
    if (showAll) return true;
    if (session?.assignedAthletes?.length > 0) {
      return session.assignedAthletes.includes(a._id);
    }
    return true;
  });

  const filteredAthletes = visibleAthletes.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const presentCount = Object.values(attendance).filter(Boolean).length;

  const copyToWhatsApp = () => {
    if (!session) return;
    const dateStr = format(new Date(session.date), 'MMM d, yyyy');
    let text = `${session.name} - ${dateStr} :\n`;
    
    const presentAthletes = athletes.filter(a => attendance[a._id]);
    
    if (presentAthletes.length === 0) {
      toast.error('No athletes present to copy');
      return;
    }

    presentAthletes.forEach(a => {
      text += `- ${a.name}\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      toast.success('List copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy');
    });
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

  return (
    <div className="page-container pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/sessions')}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-all"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{session?.name}</h1>
          <p className="text-sm text-dark-400">
            {session && format(new Date(session.date), 'EEEE, MMM d, yyyy')}
          </p>
        </div>
        <button
          onClick={copyToWhatsApp}
          className="btn-secondary !px-3 !py-2 flex items-center gap-2 text-sm bg-dark-700/50"
        >
          <HiOutlineDocumentDuplicate className="w-4 h-4 text-accent-400" />
          <span className="hidden sm:inline">Copy List</span>
        </button>
      </div>

      {/* Stats bar */}
      <div className="glass-card p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-dark-400">
            <span className="text-accent-400 font-bold">{presentCount}</span> / {athletes.length} present
          </span>
        </div>
        <div className="flex gap-2">
          {session?.assignedAthletes?.length > 0 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                showAll 
                  ? 'bg-dark-600 text-white' 
                  : 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
              }`}
            >
              {showAll ? 'Show Assigned Only' : 'Assigned Only'}
            </button>
          )}
          <button
            onClick={markAllPresent}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 transition-all"
          >
            All Present
          </button>
          <button
            onClick={markAllAbsent}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
          >
            All Absent
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400 w-5 h-5" />
        <input
          id="checkin-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search athletes..."
          className="w-full pl-12"
        />
      </div>

      {/* Athletes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredAthletes.map((athlete, index) => (
          <button
            key={athlete._id}
            onClick={() => toggleAttendance(athlete._id)}
            className={`toggle-present animate-slide-up ${
              attendance[athlete._id] ? 'toggle-present-active' : ''
            }`}
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all duration-200 ${
                attendance[athlete._id]
                  ? 'bg-accent-500 text-white'
                  : 'bg-dark-600 text-dark-300'
              }`}>
                {athlete.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">{athlete.name}</span>
                  {athlete.isNewAthlete && (
                    <span className="badge-new flex-shrink-0">
                      <HiOutlineSparkles className="w-3 h-3" />
                      NEW
                    </span>
                  )}
                </div>
                {athlete.isNewAthlete && (
                  <p className="text-xs text-dark-400">
                    Joined {format(new Date(athlete.joinDate), 'MMM d')}
                  </p>
                )}
              </div>
            </div>

            {/* Toggle indicator */}
            <div className={`w-12 h-7 rounded-full flex items-center transition-all duration-200 flex-shrink-0 ${
              attendance[athlete._id]
                ? 'bg-accent-500 justify-end'
                : 'bg-dark-600 justify-start'
            }`}>
              <div className={`w-5 h-5 rounded-full mx-1 transition-all duration-200 ${
                attendance[athlete._id]
                  ? 'bg-white'
                  : 'bg-dark-400'
              }`} />
            </div>
          </button>
        ))}
      </div>

      {filteredAthletes.length === 0 && (
        <div className="text-center py-8 text-dark-400">
          {search ? 'No athletes match your search' : 'No athletes yet. Add some from the Athletes page!'}
        </div>
      )}

      {/* Floating Save Button */}
      {hasChanges && (
        <div className="fixed bottom-28 md:bottom-8 left-0 right-0 md:left-64 flex justify-center px-4 z-30 animate-slide-up">
          <button
            onClick={saveAttendance}
            disabled={saving}
            className="btn-primary px-8 py-4 text-base shadow-glow-lg flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <HiOutlineCheckCircle className="w-5 h-5" />
                Save Attendance ({presentCount}/{athletes.length})
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default CheckIn;
