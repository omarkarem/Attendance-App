import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../utils/api';
import { apiError } from '../utils/browser';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import { Field, Input } from './ui/Form';
import RosterField from './RosterField';

const keyToDate = (key) => parseISO(`${key}T12:00:00`);

/**
 * Create (or edit) a one-off session. Creating can jump straight into check-in, and the
 * roster can be picked here or copied from a template. Typing a template's name copies
 * its time and roster.
 * onSaved(session, created, { checkIn })
 */
const SessionDialog = ({ open, onClose, session, dayKey, templates = [], onSaved }) => {
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [roster, setRoster] = useState(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null); // null | 'save' | 'checkin'

  useEffect(() => {
    if (!open) return;
    setName(session?.name || '');
    setTime(session?.time || '');
    setRoster(new Set());
    setError('');
  }, [open, session]);

  const submit = async (e, checkIn = false) => {
    e?.preventDefault();
    if (!name.trim()) { setError('Give the session a name.'); return; }
    setSaving(checkIn ? 'checkin' : 'save');
    try {
      const { data } = session
        ? await api.put(`/sessions/${session._id}`, { name: name.trim(), time: time || null })
        : await api.post('/sessions', { name: name.trim(), date: dayKey, time: time || null, assignedAthletes: [...roster] });
      onClose();
      onSaved(data, !session, { checkIn });
    } catch (err) {
      setError(apiError(err, 'Could not save the session.'));
    } finally {
      setSaving(null);
    }
  };

  const pickName = (value) => {
    setName(value);
    setError('');
    const t = templates.find((x) => x.name === value);
    if (t && !session) {
      if (t.time && !time) setTime(t.time);
      setRoster(new Set((t.assignedAthletes || []).map(String)));
    }
  };

  const suggestions = [...new Set(templates.map((t) => t.name))];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={session ? 'Edit session' : 'New session'}
      description={session ? undefined : `One-off session on ${format(keyToDate(dayKey), 'EEEE, MMMM d')}.`}
      footer={session ? (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="session-form" loading={!!saving}>Save changes</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={(e) => submit(e, false)} loading={saving === 'save'} disabled={!!saving}>Create only</Button>
          <Button type="submit" form="session-form" loading={saving === 'checkin'} disabled={!!saving}>Create and take attendance</Button>
        </>
      )}
    >
      <form id="session-form" onSubmit={(e) => submit(e, !session)} className="flex flex-col gap-5" noValidate>
        <Field label="Name" htmlFor="session-name" error={error}>
          <Input id="session-name" list="session-name-suggestions" value={name} onChange={(e) => pickName(e.target.value)} placeholder="Make-up swim" maxLength={100} aria-invalid={!!error} data-autofocus autoComplete="off" />
          <datalist id="session-name-suggestions">
            {suggestions.map((n) => <option key={n} value={n} />)}
          </datalist>
        </Field>
        <Field label="Start time" htmlFor="session-time" hint="Optional.">
          <Input id="session-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        {!session && (
          <RosterField
            value={roster}
            onChange={setRoster}
            sources={templates.filter((t) => t.assignedAthletes?.length).map((t) => ({ label: `Same as ${t.name}`, ids: t.assignedAthletes }))}
          />
        )}
      </form>
    </Dialog>
  );
};

export default SessionDialog;
