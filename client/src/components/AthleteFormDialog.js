import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { apiError } from '../utils/browser';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import { Field, Input, Switch } from './ui/Form';

const AthleteFormDialog = ({ open, onClose, athlete, onSaved }) => {
  const [name, setName] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(athlete?.name || '');
    setIsNew(athlete ? !!athlete.isNewAthlete : true);
    setError('');
  }, [open, athlete]);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError('Enter at least 2 characters.'); return; }
    setSaving(true);
    try {
      const body = { name: trimmed, isNewAthlete: isNew };
      const { data } = athlete ? await api.put(`/athletes/${athlete._id}`, body) : await api.post('/athletes', body);
      onSaved(data, !athlete);
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not save the athlete.'));
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
        <Field label="Full name" htmlFor="athlete-name" error={error}>
          <Input id="athlete-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} autoComplete="off" aria-invalid={!!error} data-autofocus />
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-2 p-4">
          <div>
            <p className="text-[14px] font-medium" id="athlete-new-label">New athlete</p>
            <p className="mt-0.5 text-[12px] text-muted">Shows a New badge so the squad knows to welcome them.</p>
          </div>
          <Switch checked={isNew} onChange={setIsNew} label="New athlete" />
        </div>
      </form>
    </Dialog>
  );
};

export default AthleteFormDialog;
