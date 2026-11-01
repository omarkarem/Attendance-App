import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { PiCheckCircleFill, PiMagnifyingGlass, PiArrowUpRight, PiArrowDownRight } from 'react-icons/pi';
import api from '../utils/api';
import { apiError } from '../utils/browser';
import { Card, Avatar, EmptyState } from './ui/Display';
import Button from './ui/Button';
import { Field, Input, Select } from './ui/Form';
import { TestSelect, VersionNotice } from './ResultFields';
import {
  versionOn, lineageOf, parseDuration, parseDistance, formatTime, formatDistance, formatPace,
  metricFor, formatResultDate, describeTarget, versionLabel
} from '../utils/performance';
import cx from '../utils/cx';

const todayKey = () => format(new Date(), 'yyyy-MM-dd');
const emptyRow = { main: '', distance: '', avgPower: '', weight: '' };

/**
 * Record one test for a whole squad: choose the test and date once, then type each
 * athlete's result. Enter jumps to the next athlete; one Save stores every filled row.
 */
const SquadResults = ({ athletes, testTypes, templates }) => {
  const [testTypeId, setTestTypeId] = useState(() => testTypes[0]?._id || '');
  const [date, setDate] = useState(todayKey());
  const [group, setGroup] = useState('all');
  const [search, setSearch] = useState('');
  const [unit, setUnit] = useState('m');
  const [rows, setRows] = useState({}); // athleteId -> { main, distance, avgPower, weight }
  const [saved, setSaved] = useState({}); // athleteId -> result saved during this visit
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const inputs = useRef({});

  const testType = testTypes.find((t) => t._id === testTypeId);
  const version = versionOn(testType, date);
  const fixedDistance = version?.measureType === 'Distance' && version.targetDistance > 0;
  const fixedTime = version?.measureType === 'Time' && version.targetTime > 0;
  // What the coach types per athlete: the time on fixed-distance tests, the distance on fixed-time ones.
  const entersTime = !fixedTime;
  const entersDistance = !fixedDistance;
  const isCycling = testType?.category === 'Cycling';

  useEffect(() => {
    if (!testType) return;
    setUnit(testType.category === 'Running' || testType.category === 'Cycling' ? 'km' : 'm');
    setSaved({});
    api.get('/tests/results', { params: { testTypeId: testType._id } })
      .then(({ data }) => setHistory(data))
      .catch(() => setHistory([]));
  }, [testType]);

  // Latest earlier result per athlete for the same test (any version with the same metric).
  const lastByAthlete = useMemo(() => {
    const map = new Map();
    history.forEach((r) => {
      const id = r.athlete?._id;
      if (!id || map.has(id) || lineageOf(r.testType) !== lineageOf(testType)) return;
      map.set(id, r);
    });
    return map;
  }, [history, testType]);

  const roster = useMemo(() => {
    const t = templates.find((x) => x._id === group);
    const ids = t ? new Set((t.assignedAthletes || []).map(String)) : null;
    const q = search.trim().toLowerCase();
    return athletes.filter((a) => (!ids || ids.has(a._id)) && a.name.toLowerCase().includes(q));
  }, [athletes, templates, group, search]);

  const setRow = (id, key, value) => setRows((r) => ({ ...r, [id]: { ...emptyRow, ...r[id], [key]: value } }));

  // Parses one row into { distance, time } (meters, seconds) or an error; null when empty.
  const parseRow = (row) => {
    if (!row) return null;
    const timeText = entersTime ? row.main : '';
    const distText = entersTime ? row.distance : row.main;
    if (!timeText.trim() && !(entersDistance && distText.trim())) return null;
    const time = fixedTime ? version.targetTime : parseDuration(timeText);
    const distance = fixedDistance ? version.targetDistance : parseDistance(distText, unit);
    if (entersTime && !(time > 0)) return { error: timeText.trim() ? 'Unreadable time' : 'Time missing' };
    if (entersDistance && !(distance > 0)) return { error: distText.trim() ? 'Unreadable distance' : 'Distance missing' };
    return { distance, time };
  };

  const parsed = roster.map((a) => ({ athlete: a, row: rows[a._id], result: parseRow(rows[a._id]) }));
  const ready = Object.entries(rows)
    .map(([id, row]) => ({ id, row, result: parseRow(row) }))
    .filter((x) => x.result && !x.result.error);
  const invalid = Object.values(rows).map(parseRow).filter((x) => x && x.error).length;

  const focusNext = (index) => {
    const next = parsed[index + 1];
    if (next) inputs.current[next.athlete._id]?.focus();
    else inputs.current[parsed[index]?.athlete._id]?.blur();
  };

  const save = async () => {
    if (!testType) { toast.error('Choose a test'); return; }
    if (date > todayKey()) { toast.error('Results cannot be in the future'); return; }
    if (invalid) { toast.error('Fix the highlighted rows first'); return; }
    if (ready.length === 0) { toast.error('Type at least one result'); return; }
    setSaving(true);
    try {
      const entries = ready.map(({ id, row, result }) => ({
        athleteId: id,
        distance: result.distance,
        time: result.time,
        ...(isCycling ? { avgPower: row.avgPower || null, weight: row.weight || null } : {})
      }));
      const { data } = await api.post('/tests/results/bulk', { testTypeId: testType._id, date, entries });
      setSaved((s) => {
        const next = { ...s };
        data.created.forEach((r) => { next[r.athlete?._id] = r; });
        return next;
      });
      setHistory((h) => [...data.created, ...h]);
      setRows({});
      toast.success(`Saved ${data.created.length} ${data.created.length === 1 ? 'result' : 'results'}`);
    } catch (err) {
      toast.error(apiError(err, 'Could not save the results'));
    } finally {
      setSaving(false);
    }
  };

  const metric = metricFor(version);
  const groups = templates.filter((t) => t.assignedAthletes?.length);
  const mainLabel = entersTime ? 'Time' : `Distance (${unit})`;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <Card className="grid gap-4 p-5 md:grid-cols-3 md:p-6">
        <Field label="Test" htmlFor="squad-test">
          <TestSelect id="squad-test" value={testTypeId} onChange={(e) => { setTestTypeId(e.target.value); setRows({}); }} testTypes={testTypes} />
        </Field>
        <Field label="Date" htmlFor="squad-date">
          <Input id="squad-date" type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Athletes" htmlFor="squad-group">
          <Select id="squad-group" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">Everyone ({athletes.length})</option>
            {groups.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.assignedAthletes.length})</option>)}
          </Select>
        </Field>
        {testType && (
          <div className="md:col-span-3">
            <p className="text-[13px] text-muted">
              {fixedDistance && <>Everyone covers <span className="font-medium text-ink">{formatDistance(version.targetDistance)}</span>. Type each time as 5:32, or 532 on a phone keypad.</>}
              {fixedTime && <>Everyone goes for <span className="font-medium text-ink">{formatTime(version.targetTime)}</span>. Type the distance each athlete covered.</>}
              {!fixedDistance && !fixedTime && <>This test has no fixed target ({describeTarget(version)}), so enter both distance and time.</>}
            </p>
            <VersionNotice version={version} className="mt-3" />
          </div>
        )}
      </Card>

      {!testType ? (
        <Card><EmptyState title="Choose a test" body="Pick the test you ran, then type each athlete's result." /></Card>
      ) : (
        <Card className="p-2 md:p-3">
          <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input icon={PiMagnifyingGlass} placeholder="Find athlete" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find athlete" />
            </div>
            {(entersDistance) && (
              <Select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Distance unit" className="sm:w-28">
                <option value="m">meters</option>
                <option value="km">km</option>
              </Select>
            )}
          </div>

          {roster.length === 0 ? (
            <p className="px-3 py-8 text-center text-[14px] text-muted">{athletes.length ? 'Nobody matches.' : 'Add athletes first.'}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {parsed.map(({ athlete, row, result }, index) => {
                const last = lastByAthlete.get(athlete._id);
                const done = saved[athlete._id];
                const value = result && !result.error ? metric.value(result) : null;
                const lastValue = last ? metricFor(last.testType).value(last) : null;
                const better = value != null && lastValue != null && lineageOf(last.testType) === lineageOf(testType) && last.testType?._id === version._id
                  ? (metric.lowerIsBetter ? value < lastValue : value > lastValue)
                  : null;
                // Under the name: the live result while typing, else what was saved, else the last result.
                let status;
                if (result?.error) status = <span className="text-danger">{result.error}</span>;
                else if (result) {
                  status = (
                    <span className={cx('inline-flex items-center gap-0.5 font-medium', better === true ? 'text-success' : better === false ? 'text-danger' : 'text-ink')}>
                      {better === true && <PiArrowUpRight className="h-3 w-3" aria-label="Better than last time" />}
                      {better === false && <PiArrowDownRight className="h-3 w-3" aria-label="Worse than last time" />}
                      {formatPace(result.distance, result.time, version)}
                      {entersTime && <span className="font-normal text-muted"> · {formatTime(result.time)}</span>}
                    </span>
                  );
                } else if (done) {
                  status = <span className="inline-flex items-center gap-1 text-success"><PiCheckCircleFill className="h-3.5 w-3.5" aria-hidden="true" />Saved {formatPace(done.distance, done.time, done.testType)}</span>;
                } else if (last) {
                  status = `Last${versionLabel(last.testType) ? ` (${versionLabel(last.testType)})` : ''}: ${formatPace(last.distance, last.time, last.testType)} · ${formatResultDate(last.date, { month: 'short', day: 'numeric' })}`;
                } else status = 'No earlier result';

                return (
                  <li key={athlete._id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5">
                    <Avatar name={athlete.name} size="sm" active={!!done} />
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`squad-${athlete._id}`} className="block truncate text-[14px] font-medium">{athlete.name}</label>
                      <p className="truncate text-[12px] text-muted tabular-nums">{status}</p>
                    </div>
                    {/* Inputs are full width by default, so each sits in a fixed-width box. */}
                    {entersTime && entersDistance && (
                      <div className="w-20 shrink-0 sm:w-24">
                        <Input
                          inputMode="decimal"
                          value={row?.distance || ''}
                          onChange={(e) => setRow(athlete._id, 'distance', e.target.value)}
                          placeholder={unit}
                          aria-label={`${athlete.name} distance in ${unit}`}
                          className="text-right tabular-nums"
                        />
                      </div>
                    )}
                    <div className="w-24 shrink-0 sm:w-28">
                      <Input
                        id={`squad-${athlete._id}`}
                        ref={(el) => { inputs.current[athlete._id] = el; }}
                        inputMode="decimal"
                        enterKeyHint="next"
                        autoComplete="off"
                        value={row?.main || ''}
                        onChange={(e) => setRow(athlete._id, 'main', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); focusNext(index); } }}
                        placeholder={entersTime ? 'mm:ss' : unit}
                        aria-label={`${athlete.name} ${mainLabel.toLowerCase()}`}
                        aria-invalid={!!result?.error}
                        className="text-right font-mono tabular-nums"
                      />
                    </div>
                    {isCycling && (
                      <div className="flex basis-full justify-end gap-2 sm:basis-auto">
                        <div className="w-24"><Input inputMode="decimal" value={row?.avgPower || ''} onChange={(e) => setRow(athlete._id, 'avgPower', e.target.value)} placeholder="Avg W" aria-label={`${athlete.name} average power`} className="text-right tabular-nums" /></div>
                        <div className="w-20"><Input inputMode="decimal" value={row?.weight || ''} onChange={(e) => setRow(athlete._id, 'weight', e.target.value)} placeholder="kg" aria-label={`${athlete.name} weight`} className="text-right tabular-nums" /></div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-chrome px-4 pb-3 md:bottom-0 md:left-[240px] md:pb-6">
        <div className="mx-auto flex max-w-[640px] items-center gap-3 rounded-pill border border-line bg-surface-2/95 p-1.5 pl-5 shadow-float backdrop-blur-xl">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-[15px] font-semibold tabular-nums">{ready.length} {ready.length === 1 ? 'result' : 'results'} ready</p>
            <p className={cx('text-[12px]', invalid ? 'text-danger' : 'text-muted')}>
              {invalid ? `${invalid} ${invalid === 1 ? 'row needs' : 'rows need'} fixing` : Object.keys(saved).length ? `${Object.keys(saved).length} saved this visit` : 'Leave a row empty to skip that athlete'}
            </p>
          </div>
          <Button size="lg" onClick={save} loading={saving} disabled={ready.length === 0 && !invalid}>Save all</Button>
        </div>
      </div>
    </div>
  );
};

export default SquadResults;
