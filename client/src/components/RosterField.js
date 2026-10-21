import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Field } from './ui/Form';
import { Segmented } from './ui/Segmented';
import AthletePicker from './AthletePicker';

/**
 * "Who is expected?" inside a create form: everyone (empty roster) or a chosen list.
 * `value` is a Set of athlete ids; an empty Set means everyone.
 */
const RosterField = ({ value, onChange, sources = [], hint }) => {
  const [mode, setMode] = useState(value.size ? 'choose' : 'everyone');
  const [athletes, setAthletes] = useState(null);

  // A roster filled in from outside (copied from a template) opens the list.
  useEffect(() => { if (value.size > 0) setMode('choose'); }, [value]);

  useEffect(() => {
    if (mode !== 'choose' || athletes) return;
    api.get('/athletes').then(({ data }) => setAthletes(data)).catch(() => setAthletes([]));
  }, [mode, athletes]);

  return (
    <Field label="Who is expected?" hint={mode === 'everyone' ? (hint || 'Everyone on your active roster, including athletes you add later.') : undefined}>
      <Segmented
        label="Who is expected"
        stretch
        value={mode}
        onChange={(m) => { setMode(m); if (m === 'everyone') onChange(new Set()); }}
        options={[{ value: 'everyone', label: 'Everyone' }, { value: 'choose', label: value.size ? `Chosen (${value.size})` : 'Choose athletes' }]}
      />
      {mode === 'choose' && (
        <AthletePicker athletes={athletes} selected={value} onChange={onChange} sources={sources} maxHeight="sm:max-h-64" className="mt-2" />
      )}
    </Field>
  );
};

export default RosterField;
