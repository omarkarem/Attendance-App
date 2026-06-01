import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  HiOutlinePlus,
  HiOutlineMagnifyingGlass,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineSparkles,
  HiOutlineUserGroup
} from 'react-icons/hi2';

const Athletes = () => {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState(null);
  const [formName, setFormName] = useState('');
  const [formIsNew, setFormIsNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetchAthletes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  const fetchAthletes = async () => {
    try {
      const { data } = await api.get(`/athletes?active=${!showInactive}`);
      setAthletes(data);
    } catch (error) {
      toast.error('Failed to load athletes');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingAthlete(null);
    setFormName('');
    setFormIsNew(false);
    setShowModal(true);
  };

  const openEditModal = (athlete) => {
    setEditingAthlete(athlete);
    setFormName(athlete.name);
    setFormIsNew(athlete.isNewAthlete);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    setSubmitting(true);
    try {
      if (editingAthlete) {
        const { data } = await api.put(`/athletes/${editingAthlete._id}`, {
          name: formName.trim(),
          isNewAthlete: formIsNew
        });
        setAthletes(athletes.map(a => a._id === data._id ? data : a));
      } else {
        const { data } = await api.post('/athletes', {
          name: formName.trim(),
          isNewAthlete: formIsNew
        });
        setAthletes([...athletes, data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save athlete');
    } finally {
      setSubmitting(false);
    }
  };

  const deactivateAthlete = async (id) => {
    try {
      await api.delete(`/athletes/${id}`);
      setAthletes(athletes.filter(a => a._id !== id));
    } catch (error) {
      toast.error('Failed to deactivate athlete');
    }
  };

  const reactivateAthlete = async (athlete) => {
    try {
      await api.put(`/athletes/${athlete._id}`, { active: true });
      setAthletes(athletes.filter(a => a._id !== athlete._id));
    } catch (error) {
      toast.error('Failed to reactivate athlete');
    }
  };

  const deleteAthletePermanent = async (id) => {
    if (!window.confirm('Permanently delete this athlete and ALL their past attendance records? This cannot be undone.')) return;
    try {
      await api.delete(`/athletes/${id}/permanent`);
      setAthletes(athletes.filter(a => a._id !== id));
    } catch (error) {
      toast.error('Failed to permanently delete athlete');
    }
  };

  const filtered = athletes.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Athletes</h1>
        <button onClick={openAddModal} className="btn-primary flex items-center gap-2 text-sm">
          <HiOutlinePlus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Athlete</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400 w-5 h-5" />
          <input
            id="athlete-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search athletes..."
            className="w-full pl-12"
          />
        </div>
        <button
          onClick={() => { setShowInactive(!showInactive); setLoading(true); }}
          className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            showInactive
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-dark-700 text-dark-400 border border-dark-600'
          }`}
        >
          {showInactive ? 'Inactive' : 'Active'}
        </button>
      </div>

      {/* Count */}
      <p className="text-sm text-dark-400 mb-4">
        {filtered.length} athlete{filtered.length !== 1 ? 's' : ''}{' '}
        {search && `matching "${search}"`}
      </p>

      {/* Athletes List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((athlete, index) => (
            <div
              key={athlete._id}
              className="glass-card-hover p-4 flex items-center justify-between animate-slide-up"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500/30 to-neon-purple/30 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
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
                  <p className="text-xs text-dark-400">
                    {athlete.isNewAthlete ? 'Joined' : 'Added'} {format(new Date(athlete.joinDate), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                {showInactive ? (
                  <>
                    <button
                      onClick={() => reactivateAthlete(athlete)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 transition-all"
                    >
                      Reactivate
                    </button>
                    <button
                      onClick={() => deleteAthletePermanent(athlete._id)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Permanently Delete"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => openEditModal(athlete)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-dark-400 hover:text-white hover:bg-dark-600 transition-all"
                    >
                      <HiOutlinePencilSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deactivateAthlete(athlete._id)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-8 text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-700 flex items-center justify-center">
            <HiOutlineUserGroup className="w-8 h-8 text-dark-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {showInactive ? 'No inactive athletes' : 'No athletes yet'}
          </h3>
          <p className="text-dark-400 mb-4">
            {showInactive ? 'All your athletes are active' : 'Add your first athlete to get started'}
          </p>
          {!showInactive && (
            <button onClick={openAddModal} className="btn-primary">
              <HiOutlinePlus className="w-4 h-4 inline mr-2" />
              Add Athlete
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAthlete ? 'Edit Athlete' : 'Add Athlete'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Athlete Name</label>
            <input
              id="athlete-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Enter athlete name"
              className="w-full"
              autoFocus
            />
          </div>

          {/* Mark as New Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-dark-700/50 border border-dark-600/50">
            <div>
              <div className="flex items-center gap-2">
                <HiOutlineSparkles className="w-4 h-4 text-amber-400" />
                <span className="font-medium text-sm">Mark as New Athlete</span>
              </div>
              <p className="text-xs text-dark-400 mt-1">
                Shows a "NEW" badge to track when they joined
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormIsNew(!formIsNew)}
              className={`w-12 h-7 rounded-full flex items-center transition-all duration-200 flex-shrink-0 ${
                formIsNew ? 'bg-amber-500 justify-end' : 'bg-dark-600 justify-start'
              }`}
            >
              <div className={`w-5 h-5 rounded-full mx-1 transition-all duration-200 ${
                formIsNew ? 'bg-white' : 'bg-dark-400'
              }`} />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Saving...' : editingAthlete ? 'Update' : 'Add Athlete'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Athletes;
