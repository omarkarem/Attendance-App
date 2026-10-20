import React, { useEffect, useMemo, useState } from 'react';
import { PiMagnifyingGlass } from 'react-icons/pi';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import { Input, CheckRow } from './ui/Form';
import { Badge, Skeleton } from './ui/Display';

/**
 * Pick the athletes expected at a session or template.
 * An empty selection means "everyone is expected", which the copy spells out.
 */
const AssignAthletesDialog = ({ open, onClose, title, description, initialIds = [], onSave }) => {
  const [athletes, setAthletes] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(initialIds.map(String)));
    setQuery('');
    api.get('/athletes')
      .then(({ data }) => setAthletes(data))
      .catch(() => { setAthletes([]); toast.error('Could not load athletes'); });
    // initialIds is read once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(
    () => (athletes || []).filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase())),
    [athletes, query]
  );

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const setMany = (ids, on) => setSelected((prev) => {
    const next = new Set(prev);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    return next;
  });

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

  const allFilteredOn = filtered.length > 0 && filtered.every((a) => selected.has(a._id));

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
      <div className="flex flex-col gap-3">
        <Input icon={PiMagnifyingGlass} placeholder="Search athletes" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search athletes" />
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-muted">Leave everyone unselected to expect the whole roster.</p>
          <button
            type="button"
            className="shrink-0 text-[13px] font-medium text-accent hover:underline disabled:opacity-40"
            disabled={filtered.length === 0}
            onClick={() => setMany(filtered.map((a) => a._id), !allFilteredOn)}
          >
            {allFilteredOn ? 'Clear' : 'Select all'}
          </button>
        </div>
        <div className="-mx-2 flex max-h-[46dvh] flex-col gap-0.5 overflow-y-auto sm:max-h-80">
          {athletes === null ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="mx-2 h-11" />)
          ) : filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-[14px] text-muted">{athletes.length === 0 ? 'No active athletes yet.' : 'No athletes match that search.'}</p>
          ) : (
            filtered.map((a) => (
              <CheckRow key={a._id} checked={selected.has(a._id)} onChange={() => toggle(a._id)}>
                <span className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-medium">{a.name}</span>
                  {a.isNewAthlete && <Badge tone="new">New</Badge>}
                </span>
              </CheckRow>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default AssignAthletesDialog;
