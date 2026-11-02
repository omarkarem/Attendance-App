import React, { useEffect, useState } from 'react';
import { PiArrowLeft, PiCaretRight, PiMagnifyingGlass, PiWarningCircle, PiUsersThree } from 'react-icons/pi';
import api from '../utils/api';
import { apiError } from '../utils/browser';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import { Input, CheckRow } from './ui/Form';
import { Avatar, Badge, Skeleton, EmptyState, WeekDots } from './ui/Display';

const STATE_LABEL = { added: 'On your roster', 'name-taken': 'Name taken' };

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * A head coach adds athletes from a coach under them: pick the coach, tick athletes,
 * optionally the templates they train in. Each becomes the head's own athlete, linked
 * to the original. onSaved({ added, restored, skipped }).
 */
const AddFromCoachesDialog = ({ open, onClose, onSaved }) => {
  const [coaches, setCoaches] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [coachId, setCoachId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateIds, setTemplateIds] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCoaches(null);
    setLoadError(false);
    setCoachId(null);
    setSelected([]);
    setSearch('');
    setTemplateIds([]);
    setError('');
    api.get('/athletes/from-coaches')
      .then(({ data }) => {
        setCoaches(data);
        if (data.length === 1) setCoachId(data[0].id);
      })
      .catch(() => setLoadError(true));
    api.get('/schedules').then(({ data }) => setTemplates(data.filter((t) => t.active))).catch(() => setTemplates([]));
  }, [open]);

  const coach = coaches?.find((c) => c.id === coachId);
  const query = search.trim().toLowerCase();
  const shown = coach ? coach.athletes.filter((a) => a.name.toLowerCase().includes(query)) : [];
  const available = shown.filter((a) => a.state === null || a.state === 'archived');
  const allShownSelected = available.length > 0 && available.every((a) => selected.includes(a._id));
  const withRoster = templates.filter((t) => t.assignedAthletes?.length);

  const toggle = (id) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const toggleAll = () => setSelected((ids) => (allShownSelected
    ? ids.filter((id) => !available.some((a) => a._id === id))
    : [...new Set([...ids, ...available.map((a) => a._id)])]));

  const pickCoach = (id) => { setCoachId(id); setSelected([]); setSearch(''); setError(''); };

  const submit = async () => {
    if (selected.length === 0) { setError('Tick at least one athlete.'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/athletes/from-coach', { coachId, athleteIds: selected, scheduleIds: templateIds });
      onSaved(data, coach);
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not add the athletes.'));
    } finally {
      setSaving(false);
    }
  };

  const choosing = !coach;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={choosing ? 'Add from your coaches' : `Add from ${coach.name}`}
      description={choosing
        ? 'Choose a coach, then the athletes you want on your own roster.'
        : 'They join your roster today, so you can put them in your sessions, take their attendance and record tests. They stay on the coach’s roster too.'}
      footer={choosing ? (
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={selected.length === 0}>
            {selected.length > 1 ? `Add ${selected.length} athletes` : 'Add athlete'}
          </Button>
        </>
      )}
    >
      {loadError ? (
        <EmptyState icon={PiWarningCircle} title="Could not load your coaches" className="py-6" />
      ) : !coaches ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-md" />)}
        </div>
      ) : coaches.length === 0 ? (
        <EmptyState icon={PiUsersThree} title="No coaches under you" body="Invite coaches on the Coaches page first." className="py-6" />
      ) : choosing ? (
        <ul className="-mx-2 flex flex-col">
          {coaches.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => pickCoach(c.id)} className="flex min-h-[56px] w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface-2">
                <Avatar name={c.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{c.name}</span>
                  <span className="block text-[12px] text-muted">
                    {plural(c.athletes.length, 'athlete')}
                    {c.athletes.some((a) => a.state === 'added') ? `, ${c.athletes.filter((a) => a.state === 'added').length} already on your roster` : ''}
                  </span>
                </span>
                <PiCaretRight className="h-4 w-4 text-muted" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-4">
          {coaches.length > 1 && (
            <button type="button" onClick={() => pickCoach(null)} className="-ml-1 inline-flex items-center gap-1.5 self-start rounded-pill px-1 text-[13px] font-medium text-muted hover:text-ink">
              <PiArrowLeft className="h-4 w-4" aria-hidden="true" />
              All coaches
            </button>
          )}
          {coach.athletes.length === 0 ? (
            <p className="py-4 text-center text-[14px] text-muted">{coach.name} has no active athletes.</p>
          ) : (
            <>
              <Input icon={PiMagnifyingGlass} placeholder={`Search ${coach.name}’s athletes`} value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search athletes" />
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted">{selected.length ? `${selected.length} selected` : `${plural(coach.athletes.length, 'athlete')}`}</span>
                {available.length > 0 && (
                  <button type="button" onClick={toggleAll} className="font-medium text-accent hover:underline">
                    {allShownSelected ? 'Clear' : query ? 'Select shown' : 'Select all'}
                  </button>
                )}
              </div>
              <ul className="-mx-2 flex flex-col gap-0.5">
                {shown.map((a) => (
                  <li key={a._id}>
                    {a.state === null || a.state === 'archived' ? (
                      <CheckRow checked={selected.includes(a._id)} onChange={() => toggle(a._id)}>
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-[15px] font-medium">{a.name}</span>
                          {a.state === 'archived' && <Badge>Restores your archived copy</Badge>}
                        </span>
                      </CheckRow>
                    ) : (
                      <div className="flex min-h-[48px] items-center gap-3 rounded-md px-3 py-2 opacity-60" title={a.state === 'name-taken' ? 'You already have a different athlete with this name' : undefined}>
                        <span className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-[15px]">{a.name}</span>
                        <Badge tone={a.state === 'added' ? 'success' : 'neutral'}>{STATE_LABEL[a.state]}</Badge>
                      </div>
                    )}
                  </li>
                ))}
                {shown.length === 0 && <li className="px-3 py-4 text-[14px] text-muted">Nobody matches “{search.trim()}”.</li>}
              </ul>
              {withRoster.length > 0 && (
                <fieldset className="flex flex-col gap-2 border-t border-line-soft pt-4">
                  <legend className="mb-2 pt-4 text-[13px] font-medium text-muted">Training in your templates (optional)</legend>
                  <div className="-mx-2 flex flex-col gap-0.5">
                    {withRoster.map((t) => (
                      <CheckRow key={t._id} checked={templateIds.includes(t._id)} onChange={() => setTemplateIds((ids) => (ids.includes(t._id) ? ids.filter((x) => x !== t._id) : [...ids, t._id]))}>
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-[14px] font-medium">{t.name}</span>
                          <WeekDots days={t.daysOfWeek} />
                        </span>
                      </CheckRow>
                    ))}
                  </div>
                </fieldset>
              )}
            </>
          )}
          {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
        </div>
      )}
    </Dialog>
  );
};

export default AddFromCoachesDialog;
