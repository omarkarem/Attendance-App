import React, { useMemo, useState } from 'react';
import { PiMagnifyingGlass } from 'react-icons/pi';
import { Input, CheckRow } from './ui/Form';
import { Badge, Skeleton } from './ui/Display';
import cx from '../utils/cx';

/**
 * Searchable checklist of athletes. `selected` is a Set of ids; `onChange` gets a new Set.
 * `sources` are optional shortcuts ([{ label, ids }]) such as "Same as Morning swim".
 */
const AthletePicker = ({ athletes, selected, onChange, sources = [], className, maxHeight = 'max-h-[46dvh] sm:max-h-80' }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => (athletes || []).filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase())),
    [athletes, query]
  );

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  const setMany = (ids, on) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    onChange(next);
  };

  const allFilteredOn = filtered.length > 0 && filtered.every((a) => selected.has(a._id));

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <Input icon={PiMagnifyingGlass} placeholder="Search athletes" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search athletes" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          className="text-[13px] font-medium text-accent hover:underline disabled:opacity-40"
          disabled={filtered.length === 0}
          onClick={() => setMany(filtered.map((a) => a._id), !allFilteredOn)}
        >
          {allFilteredOn ? 'Clear' : query ? 'Select shown' : 'Select all'}
        </button>
        {sources.filter((s) => s.ids.length).map((s) => (
          <button
            key={s.label}
            type="button"
            className="text-[13px] font-medium text-accent hover:underline"
            onClick={() => onChange(new Set(s.ids.map(String)))}
          >
            {s.label}
          </button>
        ))}
        {selected.size > 0 && (
          <span className="ml-auto text-[12px] text-muted">{selected.size} selected</span>
        )}
      </div>
      <div className={cx('-mx-2 flex flex-col gap-0.5 overflow-y-auto', maxHeight)}>
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
  );
};

export default AthletePicker;
