import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { apiError } from '../utils/browser';
import { joinKey, todayKey, NEW_ATHLETE_DAYS } from '../utils/athletes';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import { Field, Input } from './ui/Form';

/** Edit an athlete's name and join date. */
const AthleteFormDialog = ({ open, onClose, athlete, onSaved }) => {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(athlete?.name || '');
    setJoined(joinKey(athlete) || todayKey());
    setErrors({});
  }, [open, athlete]);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    const next = {};
    if (trimmed.length < 2) next.name = 'Enter at least 2 characters.';
    if (!joined) next.joined = 'Pick the day they joined.';
    else if (joined > todayKey()) next.joined = 'The join date cannot be in the future.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const body = { name: trimmed, joinDate: joined };
      const { data } = athlete ? await api.put(`/athletes/${athlete._id}`, body) : await api.post('/athletes', body);
      onSaved(data, !athlete);
      onClose();
    } catch (err) {
      setErrors({ name: apiError(err, 'Could not save the athlete.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={athlete ? 'Edit athlete' : 'Add athlete'}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="athlete-form" loading={saving}>{athlete ? 'Save changes' : 'Add athlete'}</Button>
        </>
      )}
    >
      <form id="athlete-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Full name" htmlFor="athlete-name" error={errors.name}>
          <Input id="athlete-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} autoComplete="off" aria-invalid={!!errors.name} data-autofocus />
        </Field>
        <Field
          label="Joined on"
          htmlFor="athlete-joined"
          error={errors.joined}
          hint={`The New badge shows for ${NEW_ATHLETE_DAYS} days after this date. Sessions before it do not count against them.`}
        >
          <Input id="athlete-joined" type="date" value={joined} max={todayKey()} onChange={(e) => setJoined(e.target.value)} aria-invalid={!!errors.joined} />
        </Field>
      </form>
    </Dialog>
  );
};

export default AthleteFormDialog;
