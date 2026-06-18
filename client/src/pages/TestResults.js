import React, { useState, useEffect } from 'react';
import { HiOutlineTrash, HiOutlineClipboardDocumentList, HiOutlineSparkles, HiOutlinePencil, HiOutlineChartBar } from 'react-icons/hi2';
import { FaSwimmer, FaRunning, FaBicycle } from 'react-icons/fa';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import api from '../utils/api';

const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatPace = (distanceMeters, timeSeconds, category) => {
  if (!distanceMeters || !timeSeconds) return '-';

  if (category === 'Running') {
    // min/km
    const distanceKm = distanceMeters / 1000;
    const timeMinutes = timeSeconds / 60;
    const paceMinKm = timeMinutes / distanceKm;
    const paceMins = Math.floor(paceMinKm);
    const paceSecs = Math.round((paceMinKm - paceMins) * 60);
    return `${paceMins}:${paceSecs.toString().padStart(2, '0')} min/km`;
  } else if (category === 'Swimming') {
    // min/100m
    const distance100m = distanceMeters / 100;
    const timeMinutes = timeSeconds / 60;
    const paceMin100 = timeMinutes / distance100m;
    const paceMins = Math.floor(paceMin100);
    const paceSecs = Math.round((paceMin100 - paceMins) * 60);
    return `${paceMins}:${paceSecs.toString().padStart(2, '0')} min/100m`;
  } else if (category === 'Cycling') {
    // km/h
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

const TestResults = () => {
  const [results, setResults] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [testTypes, setTestTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Edit Modal State
  const [editingResult, setEditingResult] = useState(null);
  const [editForm, setEditForm] = useState({
    athleteId: '', testTypeId: '', date: '', distanceValue: '', distanceUnit: 'm', timeH: '0', timeM: '0', timeS: '0', description: '',
    weight: '', avgPower: '', maxPower: '', avgCadence: '', maxCadence: '', avgHeartRate: '', maxHeartRate: ''
  });

  const fetchResults = async () => {
    try {
      const [resultsRes, athletesRes, typesRes] = await Promise.all([
        api.get('/tests/results'),
        api.get('/athletes'),
        api.get('/tests/types')
      ]);

      setResults(resultsRes.data);
      setAthletes(athletesRes.data);
      setTestTypes(typesRes.data);
      
    } catch (error) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleEditResult = (r) => {
    let distanceValue = r.distance.toString();
    let distanceUnit = 'm';
    if (r.distance >= 1000 && r.distance % 1000 === 0) {
      distanceValue = (r.distance / 1000).toString();
      distanceUnit = 'km';
    }

    setEditForm({
      athleteId: r.athlete?._id || '',
      testTypeId: r.testType?._id || '',
      date: new Date(r.date).toISOString().split('T')[0],
      distanceValue,
      distanceUnit,
      timeH: Math.floor(r.time / 3600).toString(),
      timeM: Math.floor((r.time % 3600) / 60).toString(),
      timeS: (r.time % 60).toString(),
      description: r.description || '',
      weight: r.weight != null ? r.weight.toString() : '',
      avgPower: r.avgPower != null ? r.avgPower.toString() : '',
      maxPower: r.maxPower != null ? r.maxPower.toString() : '',
      avgCadence: r.avgCadence != null ? r.avgCadence.toString() : '',
      maxCadence: r.maxCadence != null ? r.maxCadence.toString() : '',
      avgHeartRate: r.avgHeartRate != null ? r.avgHeartRate.toString() : '',
      maxHeartRate: r.maxHeartRate != null ? r.maxHeartRate.toString() : ''
    });
    setEditingResult(r);
  };

  const handleUpdateResult = async (e) => {
    e.preventDefault();
    try {
      const distanceMeters = editForm.distanceUnit === 'km' 
          ? parseFloat(editForm.distanceValue) * 1000 
          : parseFloat(editForm.distanceValue);
          
      const timeSeconds = (parseInt(editForm.timeH) || 0) * 3600 + 
                          (parseInt(editForm.timeM) || 0) * 60 + 
                          (parseInt(editForm.timeS) || 0);

      const numOrNull = (v) => v !== '' && v !== undefined ? parseFloat(v) : undefined;
      const editTestType = testTypes.find(t => t._id === editForm.testTypeId);

      const payload = {
        athleteId: editForm.athleteId,
        testTypeId: editForm.testTypeId,
        date: editForm.date,
        distance: distanceMeters,
        time: timeSeconds,
        description: editForm.description
      };

      // Include cycling fields
      if (editTestType?.category === 'Cycling') {
        payload.weight = numOrNull(editForm.weight);
        payload.avgPower = numOrNull(editForm.avgPower);
        payload.maxPower = numOrNull(editForm.maxPower);
        payload.avgCadence = numOrNull(editForm.avgCadence);
        payload.maxCadence = numOrNull(editForm.maxCadence);
        payload.avgHeartRate = numOrNull(editForm.avgHeartRate);
        payload.maxHeartRate = numOrNull(editForm.maxHeartRate);
      }

      const { data: updatedResult } = await api.put(`/tests/results/${editingResult._id}`, payload);
      
      setResults(results.map(r => r._id === updatedResult._id ? updatedResult : r));
      toast.success('Result updated');
      setEditingResult(null);
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleDeleteResult = async (id) => {
    if (!window.confirm('Delete this test result?')) return;
    try {
      await api.delete(`/tests/results/${id}`);
      setResults(results.filter(r => r._id !== id));
      toast.success('Result deleted');
    } catch (error) {
      toast.error('Network error');
    }
  };

  const filteredResults = results.filter(r => {
    if (categoryFilter === 'All') return true;
    return r.testType?.category === categoryFilter;
  });

  return (
    <div className="page-container">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="page-title !mb-2">Test Results</h1>
          <p className="text-dark-400">View performance history of your athletes.</p>
        </div>
      </div>

      <div className="glass-card p-6 overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <HiOutlineClipboardDocumentList className="w-6 h-6 text-accent-400" />
            <h2 className="text-xl font-bold text-white">Results History</h2>
          </div>
          <select
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
        
        {loading ? (
          <p className="text-dark-400">Loading results...</p>
        ) : filteredResults.length === 0 ? (
          <p className="text-dark-400">No results match your current view.</p>
        ) : (
          <div className="min-w-[800px]">
            <div className="grid grid-cols-12 gap-4 pb-3 border-b border-dark-600/50 text-sm font-medium text-dark-400">
              <div className="col-span-1"></div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Athlete</div>
              <div className="col-span-2">Test</div>
              <div className="col-span-1 text-right">Dist</div>
              <div className="col-span-1 text-right">Time</div>
              <div className="col-span-2 text-right">Pace</div>
              <div className="col-span-1 text-right"></div>
            </div>
            <div className="divide-y divide-dark-600/30 text-sm">
              {filteredResults.map(r => (
                <div key={r._id} className="grid grid-cols-12 gap-4 py-3 items-center text-white hover:bg-dark-800/50 transition-colors rounded-lg px-2 -mx-2 group">
                  <div className="col-span-1 flex justify-center">
                    <div className="p-1.5 bg-dark-800 rounded-lg shadow-sm border border-dark-600/50">
                      {getCategoryIcon(r.testType?.category)}
                    </div>
                  </div>
                  <div className="col-span-2 text-dark-300">
                    {new Date(r.date).toLocaleDateString()}
                  </div>
                  <div className="col-span-2 font-medium">
                    {r.athlete?.name || 'Unknown'}
                  </div>
                  <div className="col-span-2">
                    <span className="bg-dark-700 px-2 py-1 rounded text-xs truncate max-w-full inline-block">
                      {r.testType?.title || 'Unknown'}
                    </span>
                  </div>
                  <div className="col-span-1 text-right text-dark-300">
                    {r.distance >= 1000 ? `${(r.distance / 1000).toFixed(2)} km` : `${r.distance} m`}
                  </div>
                  <div className="col-span-1 text-right text-dark-300">
                    {formatTime(r.time)}
                  </div>
                  <div className="col-span-2 text-right font-medium text-accent-400 whitespace-nowrap">
                    {formatPace(r.distance, r.time, r.testType?.category)}
                  </div>
                  <div className="col-span-1 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditResult(r)}
                      className="p-1.5 text-dark-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    >
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteResult(r._id)}
                      className="p-1.5 text-dark-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                  {r.description && (
                    <div className="col-span-12 text-xs text-dark-400 mt-1 italic px-2">
                      "{r.description}"
                    </div>
                  )}
                  {r.testType?.category === 'Cycling' && (r.avgPower || r.avgCadence || r.avgHeartRate) && (
                    <div className="col-span-12 flex flex-wrap gap-3 mt-1 px-2 text-[11px]">
                      {r.avgPower != null && (
                        <span className="text-green-400">⚡ {r.avgPower}W{r.maxPower ? ` (max ${r.maxPower}W)` : ''}</span>
                      )}
                      {r.avgCadence != null && (
                        <span className="text-blue-400">🔄 {r.avgCadence} rpm{r.maxCadence ? ` (max ${r.maxCadence})` : ''}</span>
                      )}
                      {r.avgHeartRate != null && (
                        <span className="text-red-400">❤ {r.avgHeartRate} bpm{r.maxHeartRate ? ` (max ${r.maxHeartRate})` : ''}</span>
                      )}
                      {r.weight != null && r.avgPower != null && (
                        <span className="text-amber-400">W/kg: {(r.avgPower / r.weight).toFixed(2)}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!editingResult}
        onClose={() => setEditingResult(null)}
        title="Edit Test Result"
      >
        <form onSubmit={handleUpdateResult} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Athlete</label>
            <select
              required
              value={editForm.athleteId}
              onChange={e => setEditForm({ ...editForm, athleteId: e.target.value })}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500"
            >
              <option value="">Select Athlete</option>
              {athletes.map(a => (
                <option key={a._id} value={a._id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Test Type</label>
            <select
              required
              value={editForm.testTypeId}
              onChange={e => setEditForm({ ...editForm, testTypeId: e.target.value })}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500"
            >
              <option value="">Select Test Type</option>
              {testTypes.map(t => (
                <option key={t._id} value={t._id}>{t.title} ({t.category})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Date</label>
            <input
              type="date"
              required
              value={editForm.date}
              onChange={e => setEditForm({ ...editForm, date: e.target.value })}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Distance</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={editForm.distanceValue}
                onChange={e => setEditForm({ ...editForm, distanceValue: e.target.value })}
                className="flex-1 bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500"
              />
              <select
                value={editForm.distanceUnit}
                onChange={e => setEditForm({ ...editForm, distanceUnit: e.target.value })}
                className="w-24 bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white focus:outline-none focus:border-accent-500"
              >
                <option value="m">m</option>
                <option value="km">km</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Time</label>
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-center">
              <input
                type="number"
                min="0"
                value={editForm.timeH}
                onChange={e => setEditForm({ ...editForm, timeH: e.target.value })}
                className="w-full min-w-0 bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white text-center focus:outline-none focus:border-accent-500"
                placeholder="hh"
              />
              <span className="text-dark-400">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={editForm.timeM}
                onChange={e => setEditForm({ ...editForm, timeM: e.target.value })}
                className="w-full min-w-0 bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white text-center focus:outline-none focus:border-accent-500"
                placeholder="mm"
              />
              <span className="text-dark-400">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={editForm.timeS}
                onChange={e => setEditForm({ ...editForm, timeS: e.target.value })}
                className="w-full min-w-0 bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white text-center focus:outline-none focus:border-accent-500"
                placeholder="ss"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Description</label>
            <textarea
              rows="2"
              value={editForm.description}
              onChange={e => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500 resize-none"
            />
          </div>

          {/* Cycling Data Section */}
          {(() => {
            const editTestType = testTypes.find(t => t._id === editForm.testTypeId);
            if (editTestType?.category !== 'Cycling') return null;
            return (
              <div className="border border-green-500/20 rounded-xl p-4 space-y-3 bg-green-500/5">
                <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                  <FaBicycle className="w-4 h-4" />
                  Cycling Data
                </h3>
                <div>
                  <label className="block text-xs font-medium text-dark-300 mb-1">Weight (kg)</label>
                  <input type="number" step="0.1" min="0" value={editForm.weight} onChange={e => setEditForm({ ...editForm, weight: e.target.value })} className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent-500" placeholder="e.g. 72.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-300 mb-1">Power (watts)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-dark-500 mb-0.5">Avg (FTP)</span>
                      <input type="number" min="0" value={editForm.avgPower} onChange={e => setEditForm({ ...editForm, avgPower: e.target.value })} className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm text-center focus:outline-none focus:border-accent-500" placeholder="Avg" />
                    </div>
                    <div>
                      <span className="block text-[10px] text-dark-500 mb-0.5">Max</span>
                      <input type="number" min="0" value={editForm.maxPower} onChange={e => setEditForm({ ...editForm, maxPower: e.target.value })} className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm text-center focus:outline-none focus:border-accent-500" placeholder="Max" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-300 mb-1">Cadence (RPM)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-dark-500 mb-0.5">Avg</span>
                      <input type="number" min="0" value={editForm.avgCadence} onChange={e => setEditForm({ ...editForm, avgCadence: e.target.value })} className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm text-center focus:outline-none focus:border-accent-500" placeholder="Avg" />
                    </div>
                    <div>
                      <span className="block text-[10px] text-dark-500 mb-0.5">Max</span>
                      <input type="number" min="0" value={editForm.maxCadence} onChange={e => setEditForm({ ...editForm, maxCadence: e.target.value })} className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm text-center focus:outline-none focus:border-accent-500" placeholder="Max" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-300 mb-1">Heart Rate (BPM)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-dark-500 mb-0.5">Avg</span>
                      <input type="number" min="0" value={editForm.avgHeartRate} onChange={e => setEditForm({ ...editForm, avgHeartRate: e.target.value })} className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm text-center focus:outline-none focus:border-accent-500" placeholder="Avg" />
                    </div>
                    <div>
                      <span className="block text-[10px] text-dark-500 mb-0.5">Max</span>
                      <input type="number" min="0" value={editForm.maxHeartRate} onChange={e => setEditForm({ ...editForm, maxHeartRate: e.target.value })} className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm text-center focus:outline-none focus:border-accent-500" placeholder="Max" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <button
            type="submit"
            className="w-full btn-primary flex items-center justify-center gap-2 mt-2"
          >
            <HiOutlineChartBar className="w-5 h-5" />
            Save Changes
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default TestResults;
