import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import AthletePicker from './AthletePicker';

/**
 * Pick the athletes expected at a session or template.
 * An empty selection means "everyone is expected", which the copy spells out.
 * `sources`: optional shortcuts, e.g. [{ label: 'Same as Morning swim', ids }].
 */
const AssignAthletesDialog = ({ open, onClose, title, description, initialIds = [], onSave, sources = [] }) => {
  const [athletes, setAthletes] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(initialIds.map(String)));
    setAthletes(null);
    api.get('/athletes')
      .then(({ data }) => setAthletes(data))
      .catch(() => { setAthletes([]); toast.error('Could not load athletes'); });
    // initialIds is read once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave([...selected]);
      onClose();
    } catch {
      // caller shows the error
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={(
        <>
          <p className="mr-auto self-center text-[13px] text-muted">
            {selected.size === 0 ? 'Everyone is expected' : `${selected.size} expected`}
          </p>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save</Button>
        </>
      )}
    >
      <p className="mb-3 text-[12px] text-muted">Leave everyone unselected to expect the whole roster.</p>
      {/* On phones the sheet scrolls as a whole; a second scroll area inside it is hard to use. */}
      <AthletePicker athletes={athletes} selected={selected} onChange={setSelected} sources={sources} maxHeight="sm:max-h-80" />
    </Dialog>
  );
};

export default AssignAthletesDialog;
