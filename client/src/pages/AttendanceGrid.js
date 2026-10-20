import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addWeeks, addMonths } from 'date-fns';
import { PiCheckBold, PiXBold, PiTable, PiWarningCircle, PiDownloadSimple } from 'react-icons/pi';
import api from '../utils/api';
import usePageTitle from '../hooks/usePageTitle';
import { Card, PageHeader, Badge, Skeleton, EmptyState } from '../components/ui/Display';
import Button from '../components/ui/Button';
import { Switch } from '../components/ui/Form';
import { Segmented } from '../components/ui/Segmented';
import DateStepper from '../components/DateStepper';
import cx from '../utils/cx';

// Sessions are stored at 12:00 UTC on their calendar day, so read the day in UTC.
const sessionDay = (s) => new Date(s.date);
const dayNum = (s) => sessionDay(s).getUTCDate();
const weekday = (s) => sessionDay(s).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

const Cell = ({ state }) => {
  if (state === 'present') {
    return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-success/20 text-success"><PiCheckBold className="h-3.5 w-3.5" aria-label="Present" /></span>;
  }
  if (state === 'absent') {
    return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-danger/15 text-danger"><PiXBold className="h-3 w-3" aria-label="Absent" /></span>;
  }
  return <span className="inline-block h-[3px] w-3 rounded-full bg-line" aria-label={state === 'unexpected' ? 'Not expected' : 'No record'} />;
};

const rateTone = (pct) => (pct >= 75 ? 'text-success' : pct < 50 ? 'text-danger' : 'text-ink');

const AttendanceGrid = () => {
  usePageTitle('Attendance');
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [nameFilter, setNameFilter] = useState('all');
  const [expectedOnly, setExpectedOnly] = useState(true);

  const weekStart = startOfWeek(anchor);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const url = mode === 'month'
        ? `/attendance/monthly?month=${anchor.getMonth() + 1}&year=${anchor.getFullYear()}`
        : `/attendance/range?startDate=${format(startOfWeek(anchor), 'yyyy-MM-dd')}&endDate=${format(endOfWeek(anchor), 'yyyy-MM-dd')}`;
      const { data: result } = await api.get(url);
      setData(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [mode, anchor]);

  useEffect(() => { load(); }, [load]);

  const names = useMemo(() => [...new Set((data?.sessions || []).map((s) => s.name))], [data]);
  // A filter for a session that does not exist in this period would hide everything.
  useEffect(() => { if (nameFilter !== 'all' && !names.includes(nameFilter)) setNameFilter('all'); }, [names, nameFilter]);

  const grid = useMemo(() => {
    if (!data) return null;
    const sessions = data.sessions.filter((s) => nameFilter === 'all' || s.name === nameFilter);
    const lookup = new Map(data.attendance.map((a) => [`${a.athlete?._id || a.athlete}-${a.session}`, a.present]));
    const expectedIn = (s, athleteId) => !s.assignedAthletes?.length || s.assignedAthletes.map(String).includes(athleteId);

    const stateOf = (s, athleteId) => {
      const rec = lookup.get(`${athleteId}-${s._id}`);
      const expected = expectedIn(s, athleteId);
      if (rec === true) return 'present';
      if (rec === false && expected) return 'absent';
      return expected ? 'none' : 'unexpected';
    };

    const rows = data.athletes.map((a) => {
      const states = sessions.map((s) => stateOf(s, a._id));
      const counted = states.filter((x) => x === 'present' || x === 'absent').length;
      const present = states.filter((x) => x === 'present').length;
      const anyExpected = sessions.some((s) => expectedIn(s, a._id));
      return { athlete: a, states, counted, present, pct: counted ? Math.round((present / counted) * 100) : null, anyExpected };
    });

    const totals = sessions.map((_, i) => rows.filter((r) => r.states[i] === 'present').length);
    const hasRosters = sessions.some((s) => s.assignedAthletes?.length);
    return { sessions, rows, totals, hasRosters };
  }, [data, nameFilter]);

  const rows = grid ? grid.rows.filter((r) => !expectedOnly || !grid.hasRosters || r.anyExpected) : [];
  const multiplePerDay = grid ? new Set(grid.sessions.map(dayNum)).size < grid.sessions.length : false;

  const periodTitle = mode === 'month' ? format(anchor, 'MMMM') : `Week of ${format(weekStart, 'MMM d')}`;
  const periodSub = mode === 'month' ? format(anchor, 'yyyy') : `${format(weekStart, 'MMM d')} to ${format(endOfWeek(anchor), 'MMM d, yyyy')}`;
  const step = (dir) => setAnchor((d) => (mode === 'month' ? addMonths(d, dir) : addWeeks(d, dir)));

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Who came to what, session by session."
        actions={<Link to="/export"><Button variant="secondary" icon={PiDownloadSimple}>Export</Button></Link>}
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <Segmented label="Period" value={mode} onChange={setMode} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }]} />
        <DateStepper title={periodTitle} subtitle={periodSub} onPrev={() => step(-1)} onNext={() => step(1)} className="md:w-80" />
        {grid?.hasRosters && (
          <label className="flex items-center gap-3 text-[14px] text-muted md:ml-auto">
            <Switch checked={expectedOnly} onChange={setExpectedOnly} label="Only athletes expected in this period" />
            Expected only
          </label>
        )}
      </div>

      {names.length > 1 && (
        <Segmented
          label="Session"
          value={nameFilter}
          onChange={setNameFilter}
          options={[{ value: 'all', label: 'All sessions' }, ...names.map((n) => ({ value: n, label: n }))]}
          className="mb-4"
        />
      )}

      {status === 'loading' ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : status === 'error' ? (
        <Card><EmptyState icon={PiWarningCircle} title="Could not load attendance" action={<Button onClick={load}>Try again</Button>} /></Card>
      ) : !grid || grid.sessions.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiTable}
            title={`No sessions in ${mode === 'month' ? format(anchor, 'MMMM yyyy') : 'this week'}`}
            body="Sessions show up here once they are created. Template sessions are created when you open that day."
            action={<Link to="/sessions"><Button variant="secondary">Go to sessions</Button></Link>}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={PiTable} title="No athletes to show" body="Nobody active is expected at these sessions." /></Card>
      ) : (
        <>
          <Card className="overflow-hidden animate-rise">
            <div className="max-h-[70dvh] overflow-auto">
              <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 top-0 z-[3] min-w-[160px] border-b border-r border-line-soft bg-surface-1 px-4 py-3 text-left text-[12px] font-medium text-muted">Athlete</th>
                    {grid.sessions.map((s) => (
                      <th key={s._id} scope="col" title={`${s.name}, ${weekday(s)} ${dayNum(s)}${s.time ? ` at ${s.time}` : ''}`} className="sticky top-0 z-[2] min-w-[44px] border-b border-line-soft bg-surface-1 px-1 py-2 text-center font-medium">
                        <span className="block text-[11px] text-muted">{weekday(s).slice(0, 2)}</span>
                        <span className="block text-[14px] tabular-nums text-ink">{dayNum(s)}</span>
                        {multiplePerDay && nameFilter === 'all' && <span className="mx-auto block max-w-[52px] truncate text-[10px] text-muted">{s.name}</span>}
                      </th>
                    ))}
                    <th scope="col" className="sticky right-0 top-0 z-[3] min-w-[84px] border-b border-l border-line-soft bg-surface-1 px-3 py-3 text-right text-[12px] font-medium text-muted">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ athlete, states, counted, present, pct }) => (
                    <tr key={athlete._id} className="group">
                      <th scope="row" className="sticky left-0 z-[1] border-b border-r border-line-soft bg-surface-1 px-4 py-2 text-left font-medium group-hover:bg-surface-2">
                        <Link to={`/athlete/${athlete._id}`} className="flex max-w-[180px] items-center gap-2 hover:underline">
                          <span className="truncate">{athlete.name}</span>
                          {athlete.isNewAthlete && <Badge tone="new">New</Badge>}
                        </Link>
                      </th>
                      {states.map((st, i) => (
                        <td key={grid.sessions[i]._id} className="border-b border-line-soft px-1 py-1.5 text-center group-hover:bg-surface-2/50">
                          <Cell state={st} />
                        </td>
                      ))}
                      <td className="sticky right-0 z-[1] border-b border-l border-line-soft bg-surface-1 px-3 py-2 text-right group-hover:bg-surface-2">
                        {pct == null ? <span className="text-muted">-</span> : (
                          <>
                            <span className={cx('block text-[14px] font-semibold tabular-nums', rateTone(pct))}>{pct}%</span>
                            <span className="block text-[11px] text-muted tabular-nums">{present}/{counted}</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="sticky bottom-0 left-0 z-[3] border-r border-t border-line bg-surface-1 px-4 py-2.5 text-left text-[12px] font-medium text-muted">Present</th>
                    {grid.totals.map((t, i) => (
                      <td key={grid.sessions[i]._id} className="sticky bottom-0 z-[2] border-t border-line bg-surface-1 px-1 py-2.5 text-center text-[13px] font-semibold tabular-nums">{t}</td>
                    ))}
                    <td className="sticky bottom-0 right-0 z-[3] border-l border-t border-line bg-surface-1" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
            <span className="inline-flex items-center gap-2"><Cell state="present" />Present</span>
            <span className="inline-flex items-center gap-2"><Cell state="absent" />Absent</span>
            <span className="inline-flex items-center gap-2"><Cell state="none" />Not recorded or not expected</span>
            <span>Rate counts only sessions where the athlete was recorded.</span>
          </div>
        </>
      )}
    </>
  );
};

export default AttendanceGrid;
