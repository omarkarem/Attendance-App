import React, { useState, useEffect } from 'react';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineChartBar, HiOutlineCog, HiOutlinePencil } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import useAuth from '../hooks/useAuth';
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

const Tests = () => {
  useAuth();
  const [activeTab, setActiveTab] = useState('record'); // 'record' or 'manage'
  // eslint-disable-next-line no-unused-vars
  const [loading, setLoading] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState(null);

  // Data
  const [athletes, setAthletes] = useState([]);
  const [testTypes, setTestTypes] = useState([]);

  // Forms
  const [typeForm, setTypeForm] = useState({ 
    title: '', category: 'Running', measureType: 'Distance',
    targetDistanceValue: '', targetDistanceUnit: 'm',
    targetTimeH: '0', targetTimeM: '0', targetTimeS: '0'
  });
  const [resultForm, setResultForm] = useState({
    athleteId: '',
    testTypeId: '',
    date: new Date().toISOString().split('T')[0],
    distanceValue: '',
    distanceUnit: 'km', // 'm' or 'km'
    timeH: '0',
    timeM: '0',
    timeS: '0',
    description: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [athletesRes, typesRes] = await Promise.all([
        api.get('/athletes'),
        api.get('/tests/types')
      ]);

      setAthletes(athletesRes.data);
      setTestTypes(typesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers for Test Types ---
  const handleEditTestType = (testType) => {
    setEditingTypeId(testType._id);
    
    let targetDistanceValue = '';
    let targetDistanceUnit = 'm';
    if (testType.measureType === 'Distance' && testType.targetDistance) {
      if (testType.targetDistance >= 1000 && testType.targetDistance % 1000 === 0) {
        targetDistanceValue = (testType.targetDistance / 1000).toString();
        targetDistanceUnit = 'km';
      } else {
        targetDistanceValue = testType.targetDistance.toString();
        targetDistanceUnit = 'm';
      }
    }

    let targetTimeH = '0', targetTimeM = '0', targetTimeS = '0';
    if (testType.measureType === 'Time' && testType.targetTime) {
      targetTimeH = Math.floor(testType.targetTime / 3600).toString();
      targetTimeM = Math.floor((testType.targetTime % 3600) / 60).toString();
      targetTimeS = (testType.targetTime % 60).toString();
    }

    setTypeForm({
      title: testType.title,
      category: testType.category,
      measureType: testType.measureType,
      targetDistanceValue,
      targetDistanceUnit,
      targetTimeH,
      targetTimeM,
      targetTimeS
    });
    setActiveTab('manage');
  };

  const cancelEditTestType = () => {
    setEditingTypeId(null);
    setTypeForm({ 
      title: '', category: 'Running', measureType: 'Distance',
      targetDistanceValue: '', targetDistanceUnit: 'm',
      targetTimeH: '0', targetTimeM: '0', targetTimeS: '0'
    });
  };

  const handleCreateTestType = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        title: typeForm.title, 
        category: typeForm.category, 
        measureType: typeForm.measureType 
      };
      if (typeForm.measureType === 'Distance') {
        payload.targetDistance = typeForm.targetDistanceUnit === 'km' ? parseFloat(typeForm.targetDistanceValue) * 1000 : parseFloat(typeForm.targetDistanceValue);
      } else {
        payload.targetTime = (parseInt(typeForm.targetTimeH) || 0) * 3600 + (parseInt(typeForm.targetTimeM) || 0) * 60 + (parseInt(typeForm.targetTimeS) || 0);
      }

      let updatedType;
      if (editingTypeId) {
        const { data } = await api.put(`/tests/types/${editingTypeId}`, payload);
        updatedType = data;
        setTestTypes(testTypes.map(t => t._id === editingTypeId ? updatedType : t));
        toast.success('Test type updated');
        setEditingTypeId(null);
      } else {
        const { data } = await api.post('/tests/types', payload);
        updatedType = data;
        setTestTypes([...testTypes, updatedType]);
        toast.success('Test type created');
      }
      
      setTypeForm({ 
        title: '', category: 'Running', measureType: 'Distance',
        targetDistanceValue: '', targetDistanceUnit: 'm',
        targetTimeH: '0', targetTimeM: '0', targetTimeS: '0'
      });
    } catch (error) {
      toast.error('Network error');
    }
  };

  const handleDeleteTestType = async (id) => {
    if (!window.confirm('Delete this test type?')) return;
    try {
      await api.delete(`/tests/types/${id}`);
      setTestTypes(testTypes.filter(t => t._id !== id));
      toast.success('Test type deleted');
    } catch (error) {
      toast.error('Network error');
    }
  };

  // --- Handlers for Results ---
  const handleRecordResult = async (e) => {
    e.preventDefault();
    if (!resultForm.athleteId || !resultForm.testTypeId) {
      return toast.error('Please select athlete and test type');
    }

    const selectedTestType = testTypes.find(t => t._id === resultForm.testTypeId);
    if (!selectedTestType) {
      return toast.error('Please select test type');
    }

    const distanceMeters = selectedTestType.measureType === 'Distance' && selectedTestType.targetDistance
      ? selectedTestType.targetDistance
      : (resultForm.distanceUnit === 'km' 
          ? parseFloat(resultForm.distanceValue) * 1000 
          : parseFloat(resultForm.distanceValue));
      
    const timeSeconds = selectedTestType.measureType === 'Time' && selectedTestType.targetTime
      ? selectedTestType.targetTime
      : ((parseInt(resultForm.timeH) || 0) * 3600 + 
         (parseInt(resultForm.timeM) || 0) * 60 + 
         (parseInt(resultForm.timeS) || 0));

    if (!distanceMeters || !timeSeconds) {
      return toast.error('Please enter valid distance and time');
    }

    try {
      const payload = {
        athleteId: resultForm.athleteId,
        testTypeId: resultForm.testTypeId,
        date: resultForm.date,
        distance: distanceMeters,
        time: timeSeconds,
        description: resultForm.description
      };

      await api.post('/tests/results', payload);
      
      setResultForm({
        ...resultForm,
        distanceValue: '',
        timeH: '0',
        timeM: '0',
        timeS: '0',
        description: ''
      });
      toast.success('Result recorded');
    } catch (error) {
      toast.error('Network error');
    }
  };

  const selectedTestType = testTypes.find(t => t._id === resultForm.testTypeId);

  const currentDistanceMeters = (selectedTestType && selectedTestType.measureType === 'Distance' && selectedTestType.targetDistance)
    ? selectedTestType.targetDistance
    : (resultForm.distanceUnit === 'km' 
      ? parseFloat(resultForm.distanceValue || 0) * 1000 
      : parseFloat(resultForm.distanceValue || 0));
      
  const currentTimeSeconds = (selectedTestType && selectedTestType.measureType === 'Time' && selectedTestType.targetTime)
    ? selectedTestType.targetTime
    : ((parseInt(resultForm.timeH) || 0) * 3600 + 
       (parseInt(resultForm.timeM) || 0) * 60 + 
       (parseInt(resultForm.timeS) || 0));
  
  const calculatedPace = formatPace(currentDistanceMeters, currentTimeSeconds, selectedTestType?.category);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto md:ml-64 w-full md:w-[calc(100%-16rem)] min-h-screen pt-20 md:pt-8 transition-all">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">Performance Tests</h1>
          <p className="text-dark-400">Manage and track athlete test results.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-dark-600/50 pb-2">
        <button
          onClick={() => setActiveTab('record')}
          className={`flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
            activeTab === 'record' ? 'bg-accent-500/20 text-accent-400' : 'text-dark-400 hover:text-white'
          }`}
        >
          <HiOutlineChartBar className="w-5 h-5" />
          Record Results
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
            activeTab === 'manage' ? 'bg-accent-500/20 text-accent-400' : 'text-dark-400 hover:text-white'
          }`}
        >
          <HiOutlineCog className="w-5 h-5" />
          Manage Test Types
        </button>
      </div>

      {activeTab === 'manage' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Test Type Form */}
          <div className="lg:col-span-1 glass-panel p-6 self-start">
            <h2 className="text-xl font-bold text-white mb-4">{editingTypeId ? 'Edit Test Type' : 'Add Test Type'}</h2>
            <form onSubmit={handleCreateTestType} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={typeForm.title}
                  onChange={e => setTypeForm({ ...typeForm, title: e.target.value })}
                  placeholder="e.g. 5km Run, 400m Swim"
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Category</label>
                <select
                  value={typeForm.category}
                  onChange={e => setTypeForm({ ...typeForm, category: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500"
                >
                  <option value="Running">Running</option>
                  <option value="Swimming">Swimming</option>
                  <option value="Cycling">Cycling</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Measure Type</label>
                <select
                  value={typeForm.measureType}
                  onChange={e => setTypeForm({ ...typeForm, measureType: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500"
                >
                  <option value="Distance">Fixed Distance Target</option>
                  <option value="Time">Fixed Time Target</option>
                </select>
              </div>

              {typeForm.measureType === 'Distance' ? (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Target Distance</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={typeForm.targetDistanceValue}
                      onChange={e => setTypeForm({ ...typeForm, targetDistanceValue: e.target.value })}
                      className="flex-1 bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:border-accent-500"
                      placeholder="Distance"
                    />
                    <select
                      value={typeForm.targetDistanceUnit}
                      onChange={e => setTypeForm({ ...typeForm, targetDistanceUnit: e.target.value })}
                      className="w-24 bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white focus:outline-none focus:border-accent-500"
                    >
                      <option value="m">m</option>
                      <option value="km">km</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Target Time</label>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-center">
                    <input
                      type="number"
                      min="0"
                      value={typeForm.targetTimeH}
                      onChange={e => setTypeForm({ ...typeForm, targetTimeH: e.target.value })}
                      className="w-full bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white text-center focus:outline-none focus:border-accent-500"
                      placeholder="hh"
                    />
                    <span className="text-dark-400">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={typeForm.targetTimeM}
                      onChange={e => setTypeForm({ ...typeForm, targetTimeM: e.target.value })}
                      className="w-full bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white text-center focus:outline-none focus:border-accent-500"
                      placeholder="mm"
                    />
                    <span className="text-dark-400">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={typeForm.targetTimeS}
                      onChange={e => setTypeForm({ ...typeForm, targetTimeS: e.target.value })}
                      className="w-full bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white text-center focus:outline-none focus:border-accent-500"
                      placeholder="ss"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {editingTypeId ? <HiOutlinePencil className="w-5 h-5" /> : <HiOutlinePlus className="w-5 h-5" />}
                  {editingTypeId ? 'Update' : 'Add'}
                </button>
                {editingTypeId && (
                  <button
                    type="button"
                    onClick={cancelEditTestType}
                    className="px-4 py-2 bg-dark-700 text-white rounded-xl font-medium hover:bg-dark-600 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List Test Types */}
          <div className="lg:col-span-2 glass-panel p-6">
            <h2 className="text-xl font-bold text-white mb-4">Existing Test Types</h2>
            <div className="space-y-3">
              {testTypes.length === 0 ? (
                <p className="text-dark-400">No test types configured yet.</p>
              ) : (
                testTypes.map(type => (
                  <div key={type._id} className="flex items-center justify-between bg-dark-800 p-4 rounded-xl border border-dark-600/50">
                    <div>
                      <h3 className="font-bold text-white">{type.title}</h3>
                      <p className="text-sm text-dark-400">{type.category} • {type.measureType}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditTestType(type)}
                        className="p-2 text-dark-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                      >
                        <HiOutlinePencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTestType(type._id)}
                        className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* Record Result Form */}
          <div className="glass-panel p-6">
            <h2 className="text-xl font-bold text-white mb-4">Record Result</h2>
            <form onSubmit={handleRecordResult} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Athlete</label>
                <select
                  required
                  value={resultForm.athleteId}
                  onChange={e => setResultForm({ ...resultForm, athleteId: e.target.value })}
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
                  value={resultForm.testTypeId}
                  onChange={e => setResultForm({ ...resultForm, testTypeId: e.target.value })}
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
                  value={resultForm.date}
                  onChange={e => setResultForm({ ...resultForm, date: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-500"
                />
              </div>

              {(!selectedTestType || selectedTestType.measureType !== 'Distance' || !selectedTestType.targetDistance) ? (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Distance</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={resultForm.distanceValue}
                      onChange={e => setResultForm({ ...resultForm, distanceValue: e.target.value })}
                      className="flex-1 bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:border-accent-500"
                      placeholder="Distance"
                    />
                    <select
                      value={resultForm.distanceUnit}
                      onChange={e => setResultForm({ ...resultForm, distanceUnit: e.target.value })}
                      className="w-24 bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white focus:outline-none focus:border-accent-500"
                    >
                      <option value="m">m</option>
                      <option value="km">km</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="bg-dark-800/50 border border-dark-600/50 rounded-xl px-4 py-3 text-dark-300 flex justify-between">
                  <span>Target Distance</span>
                  <span className="text-white font-medium">
                    {selectedTestType.targetDistance >= 1000 ? `${selectedTestType.targetDistance / 1000} km` : `${selectedTestType.targetDistance} m`}
                  </span>
                </div>
              )}

              {(!selectedTestType || selectedTestType.measureType !== 'Time' || !selectedTestType.targetTime) ? (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Time</label>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-center">
                    <input
                      type="number"
                      min="0"
                      value={resultForm.timeH}
                      onChange={e => setResultForm({ ...resultForm, timeH: e.target.value })}
                      className="w-full bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white text-center focus:outline-none focus:border-accent-500"
                      placeholder="hh"
                    />
                    <span className="text-dark-400">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={resultForm.timeM}
                      onChange={e => setResultForm({ ...resultForm, timeM: e.target.value })}
                      className="w-full bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white text-center focus:outline-none focus:border-accent-500"
                      placeholder="mm"
                    />
                    <span className="text-dark-400">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={resultForm.timeS}
                      onChange={e => setResultForm({ ...resultForm, timeS: e.target.value })}
                      className="w-full bg-dark-800 border border-dark-600 rounded-xl px-2 py-3 text-white text-center focus:outline-none focus:border-accent-500"
                      placeholder="ss"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-dark-800/50 border border-dark-600/50 rounded-xl px-4 py-3 text-dark-300 flex justify-between">
                  <span>Target Time</span>
                  <span className="text-white font-medium">
                    {formatTime(selectedTestType.targetTime)}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Description / Comments</label>
                <textarea
                  rows="3"
                  value={resultForm.description}
                  onChange={e => setResultForm({ ...resultForm, description: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:border-accent-500 resize-none"
                  placeholder="e.g., Felt great, windy conditions..."
                />
              </div>

              {selectedTestType && (
                <div className="bg-dark-800 border border-accent-500/30 rounded-xl p-4 mt-4 flex justify-between items-center">
                  <span className="text-dark-300 text-sm">Calculated {selectedTestType.category === 'Cycling' ? 'Speed' : 'Pace'}</span>
                  <span className="text-accent-400 font-bold">{calculatedPace}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full btn-primary flex items-center justify-center gap-2 mt-4"
              >
                <HiOutlineChartBar className="w-5 h-5" />
                Record Result
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tests;
