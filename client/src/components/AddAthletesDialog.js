import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { apiError } from '../utils/browser';
import { splitNames, todayKey, NEW_ATHLETE_DAYS } from '../utils/athletes';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import { Field, Input, Textarea, CheckRow } from './ui/Form';
import { WeekDots } from './ui/Display';

/**
 * Add one or many athletes in one go: one name per line (pasting a list from WhatsApp
 * or a spreadsheet works), a shared join date, and the templates they train in.
 * onSaved({ created, skipped }).
 */
const AddAthletesDialog = ({ open, onClose, onSaved, initialNames = '' }) => {
  const [text, setText] = useState('');
  const [joined, setJoined] = useState(todayKey());
  const [templates, setTemplates] = useState([]);
  const [templateIds, setTemplateIds] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(initialNames);
    setJoined(todayKey());
    setTemplateIds([]);
    setError('');
    api.get('/schedules').then(({ data }) => setTemplates(data.filter((t) => t.active))).catch(() => setTemplates([]));
  }, [open, initialNames]);

  const names = splitNames(text);
  const withRoster = templates.filter((t) => t.assignedAthletes?.length);
  const everyone = templates.filter((t) => !t.assignedAthletes?.length);

  const submit = async (e) => {
    e.preventDefault();
    if (names.length === 0) { setError('Type at least one name.'); return; }
    const short = names.find((n) => n.length < 2);
    if (short) { setError(`“${short}” is too short. Names need at least 2 characters.`); return; }
    if (joined > todayKey()) { setError('The join date cannot be in the future.'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/athletes/bulk', { names, joinDate: joined, scheduleIds: templateIds });
      onSaved(data);
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not add the athletes.'));
    } finally {
      setSaving(false);
    }
  };

  const label = names.length > 1 ? `Add ${names.length} athletes` : 'Add athlete';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add athletes"
      description="One name per line. Paste a whole list to add everyone at once."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-athletes-form" loading={saving} disabled={names.length === 0}>{label}</Button>
        </>
      )}
    >
      <form id="add-athletes-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Names" htmlFor="add-names" error={error} hint={names.length > 1 ? `${names.length} names` : undefined}>
          <Textarea
            id="add-names"
            rows={5}
            value={text}
            onChange={(e) => { setText(e.target.value); setError(''); }}
            placeholder={'Sara Ali\nOmar Hassan\nLina Saeed'}
            aria-invalid={!!error}
            data-autofocus
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); }}
          />
        </Field>
        <Field label="Joined on" htmlFor="add-joined" hint={`Shows a New badge for ${NEW_ATHLETE_DAYS} days. Set an earlier date for athletes who are not new.`}>
          <Input id="add-joined" type="date" value={joined} max={todayKey()} onChange={(e) => setJoined(e.target.value)} />
        </Field>
        {templates.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-medium text-muted">Training in</legend>
            {withRoster.length > 0 && (
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
            )}
            {everyone.length > 0 && (
              <p className="text-[12px] text-muted">
                {everyone.map((t) => t.name).join(', ')} {everyone.length === 1 ? 'expects' : 'expect'} everyone, so new athletes are included automatically.
              </p>
            )}
          </fieldset>
        )}
      </form>
    </Dialog>
  );
};

export default AddAthletesDialog;
