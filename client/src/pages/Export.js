import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PiFileXls, PiFilePdf, PiDownloadSimple, PiCalendarDots, PiTimer } from 'react-icons/pi';
import api from '../utils/api';
import usePageTitle from '../hooks/usePageTitle';
import { saveBlob, blobErrorMessage } from '../utils/browser';
import { Card, CardHeader, PageHeader, Skeleton } from '../components/ui/Display';
import Button from '../components/ui/Button';
import { Field, Input, Select, CheckRow } from '../components/ui/Form';
import { Segmented } from '../components/ui/Segmented';
import { categoryMeta } from '../utils/performance';
import cx from '../utils/cx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PERIODS = [
  { value: '1w', label: '1 week' },
  { value: '1m', label: '1 month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' }
];
const safe = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_');

const FormatChoice = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="File format" className="grid grid-cols-2 gap-2">
    {[{ v: 'excel', label: 'Excel', ext: '.xlsx', Icon: PiFileXls }, { v: 'pdf', label: 'PDF', ext: '.pdf', Icon: PiFilePdf }].map(({ v, label, ext, Icon }) => {
      const on = value === v;
      return (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={on}
          onClick={() => onChange(v)}
          className={cx('flex items-center gap-3 rounded-lg p-3.5 text-left transition-colors', on ? 'bg-surface-2 shadow-ring' : 'bg-surface-2/40 hover:bg-surface-2/70')}
        >
          <Icon className={cx('h-7 w-7', on ? 'text-ink' : 'text-muted')} aria-hidden="true" />
          <span>
            <span className="block text-[14px] font-semibold">{label}</span>
            <span className="block text-[12px] text-muted">{ext}</span>
          </span>
        </button>
      );
    })}
  </div>
);

const Export = () => {
  usePageTitle('Export');
  const now = new Date();
  const [tab, setTab] = useState('attendance');
  const [fileFormat, setFileFormat] = useState('pdf');
  const [busy, setBusy] = useState(false);

  // Attendance
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [sessionNames, setSessionNames] = useState(null);
  const [sessionFilter, setSessionFilter] = useState('all');

  // Tests
  const [mode, setMode] = useState('athlete');
  const [athletes, setAthletes] = useState(null);
  const [testTypes, setTestTypes] = useState([]);
  const [athleteId, setAthleteId] = useState('');
  const [typeIds, setTypeIds] = useState([]);
  const [period, setPeriod] = useState('3m');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [testAthletes, setTestAthletes] = useState([]);
  const [excluded, setExcluded] = useState([]);

  useEffect(() => {
    if (tab !== 'attendance') return;
    setSessionNames(null);
    api.get(`/attendance/monthly?month=${month}&year=${year}`)
      .then(({ data }) => {
        const names = [...new Set(data.sessions.map((s) => s.name))];
        setSessionNames(names);
        setSessionFilter((f) => (f === 'all' || names.includes(f) ? f : 'all'));
      })
      .catch(() => setSessionNames([]));
  }, [tab, month, year]);

  useEffect(() => {
    if (tab !== 'tests' || athletes) return;
    Promise.all([api.get('/athletes'), api.get('/tests/types')])
      .then(([a, t]) => {
        setAthletes(a.data);
        setTestTypes(t.data);
        setAthleteId((id) => id || a.data[0]?._id || '');
        setTypeIds((ids) => (ids.length ? ids : t.data.slice(0, 1).map((x) => x._id)));
      })
      .catch(() => { setAthletes([]); toast.error('Could not load athletes and tests'); });
  }, [tab, athletes]);

  useEffect(() => {
    if (mode !== 'test' || typeIds.length === 0) { setTestAthletes([]); return; }
    api.get(`/tests/results/athletes?testTypeIds=${typeIds.join(',')}`)
      .then(({ data }) => { setTestAthletes(data); setExcluded((ex) => ex.filter((id) => data.some((a) => a._id === id))); })
      .catch(() => setTestAthletes([]));
  }, [mode, typeIds]);

  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 5 + i);
  const ext = fileFormat === 'excel' ? 'xlsx' : 'pdf';
  const toggleIn = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const summary = tab === 'attendance'
    ? [['Report', 'Attendance grid'], ['Month', `${MONTHS[month - 1]} ${year}`], ['Sessions', sessionFilter === 'all' ? 'All sessions' : sessionFilter]]
    : [
      ['Report', mode === 'athlete' ? 'One athlete, all tests' : 'Selected tests, all athletes'],
      mode === 'athlete'
        ? ['Athlete', athletes?.find((a) => a._id === athleteId)?.name || '-']
        : ['Tests', typeIds.length === 1 ? testTypes.find((t) => t._id === typeIds[0])?.title : `${typeIds.length} selected`],
      ['Period', period === 'custom' ? (customStart && customEnd ? `${customStart} to ${customEnd}` : 'Pick dates') : PERIODS.find((p) => p.value === period).label],
      ...(mode === 'test' && excluded.length ? [['Excluded', `${excluded.length} ${excluded.length === 1 ? 'athlete' : 'athletes'}`]] : [])
    ];

  const download = async () => {
    try {
      let url;
      let filename;
      if (tab === 'attendance') {
        url = `/export?${new URLSearchParams({ month, year, format: fileFormat, sessionFilter })}`;
        filename = `Attendance_${MONTHS[month - 1]}_${year}${sessionFilter !== 'all' ? `_${safe(sessionFilter)}` : ''}.${ext}`;
      } else {
        if (mode === 'athlete' && !athleteId) { toast.error('Choose an athlete'); return; }
        if (mode === 'test' && typeIds.length === 0) { toast.error('Choose at least one test'); return; }
        if (period === 'custom' && (!customStart || !customEnd)) { toast.error('Pick a start and end date'); return; }
        if (period === 'custom' && customStart > customEnd) { toast.error('The start date is after the end date'); return; }
        const params = new URLSearchParams({ mode, format: fileFormat, period });
        if (mode === 'athlete') params.append('athleteId', athleteId);
        else {
          params.append('testTypeIds', typeIds.join(','));
          if (excluded.length) params.append('excludeAthleteIds', excluded.join(','));
        }
        if (period === 'custom') { params.append('startDate', customStart); params.append('endDate', customEnd); }
        url = `/export/tests?${params}`;
        filename = mode === 'athlete'
          ? `Tests_${safe(athletes.find((a) => a._id === athleteId)?.name || 'Athlete')}.${ext}`
          : `TestReport_${typeIds.length > 2 ? `${typeIds.length}_Tests` : typeIds.map((id) => safe(testTypes.find((t) => t._id === id)?.title || 'Test')).join('_')}.${ext}`;
      }
      setBusy(true);
      const res = await api.get(url, { responseType: 'blob' });
      saveBlob(res.data, filename);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      toast.error(await blobErrorMessage(err, 'Export failed. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const attendanceSettings = (
    <Card className="p-5 md:p-6">
      <CardHeader title="Month" description="One sheet with every session and athlete for the month." />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Field label="Month" htmlFor="export-month">
          <Select id="export-month" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Year" htmlFor="export-year">
          <Select id="export-year" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Sessions" htmlFor="export-session" className="mt-5" hint={sessionNames && sessionNames.length === 0 ? 'No sessions this month, so there is nothing to export yet.' : undefined}>
        <Select id="export-session" value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} disabled={!sessionNames || sessionNames.length === 0}>
          <option value="all">All sessions</option>
          {(sessionNames || []).map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
      </Field>
    </Card>
  );

  const testSettings = athletes === null ? <Skeleton className="h-80 rounded-xl" /> : (
    <>
      <Card className="p-5 md:p-6">
        <CardHeader title="What to include" />
        <Segmented
          label="Report type"
          stretch
          value={mode}
          onChange={setMode}
          options={[{ value: 'athlete', label: 'One athlete' }, { value: 'test', label: 'By test' }]}
          className="mt-4"
        />
        {mode === 'athlete' ? (
          <Field label="Athlete" htmlFor="export-athlete" className="mt-5">
            <Select id="export-athlete" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
              {athletes.length === 0 && <option value="">No athletes yet</option>}
              {athletes.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </Select>
          </Field>
        ) : (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium text-muted">Tests ({typeIds.length} selected)</p>
              <button type="button" className="text-[13px] font-medium text-accent hover:underline" onClick={() => setTypeIds(typeIds.length === testTypes.length ? [] : testTypes.map((t) => t._id))}>
                {typeIds.length === testTypes.length ? 'Clear' : 'Select all'}
              </button>
            </div>
            {testTypes.length === 0 ? <p className="py-4 text-[14px] text-muted">No test types yet.</p> : (
              <div className="-mx-2 flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                {testTypes.map((t) => {
                  const { Icon } = categoryMeta(t.category);
                  return (
                    <CheckRow key={t._id} checked={typeIds.includes(t._id)} onChange={() => setTypeIds((ids) => toggleIn(ids, t._id))}>
                      <span className="flex items-center gap-2 text-[14px]"><Icon className="h-4 w-4 text-muted" aria-hidden="true" /><span className="truncate font-medium">{t.title}</span></span>
                    </CheckRow>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {mode === 'test' && testAthletes.length > 0 && (
        <Card className="p-5 md:p-6">
          <CardHeader
            title="Athletes in the report"
            description="Untick anyone you want to leave out."
            actions={<button type="button" className="text-[13px] font-medium text-accent hover:underline" onClick={() => setExcluded(excluded.length ? [] : testAthletes.map((a) => a._id))}>{excluded.length ? 'Include all' : 'Exclude all'}</button>}
          />
          <div className="-mx-2 mt-3 grid max-h-64 gap-0.5 overflow-y-auto sm:grid-cols-2">
            {testAthletes.map((a) => (
              <CheckRow key={a._id} checked={!excluded.includes(a._id)} onChange={() => setExcluded((ex) => toggleIn(ex, a._id))}>
                <span className={cx('truncate text-[14px] font-medium', excluded.includes(a._id) && 'text-muted line-through')}>{a.name}</span>
              </CheckRow>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5 md:p-6">
        <CardHeader title="Time period" description="Results recorded in this window. Earlier results fill the Previous columns." />
        <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Time period">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={cx('h-10 rounded-pill text-[13px] font-medium transition-colors', period === p.value ? 'bg-ink text-canvas' : 'bg-surface-2 text-muted hover:text-ink')}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="custom-start"><Input id="custom-start" type="date" value={customStart} max={customEnd || undefined} onChange={(e) => setCustomStart(e.target.value)} /></Field>
            <Field label="To" htmlFor="custom-end"><Input id="custom-end" type="date" value={customEnd} min={customStart || undefined} onChange={(e) => setCustomEnd(e.target.value)} /></Field>
          </div>
        )}
      </Card>
    </>
  );

  return (
    <>
      <PageHeader title="Export" description="Download reports to share with parents, clubs or federations.">
        <Segmented
          label="Report"
          value={tab}
          onChange={setTab}
          options={[{ value: 'attendance', label: 'Attendance', icon: PiCalendarDots }, { value: 'tests', label: 'Test results', icon: PiTimer }]}
          className="self-start"
        />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-6">{tab === 'attendance' ? attendanceSettings : testSettings}</div>
        <Card className="p-5 md:p-6 lg:sticky lg:top-10">
          <CardHeader title="Your file" />
          <dl className="mt-4 flex flex-col gap-2.5 text-[14px]">
            {summary.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="truncate text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mb-2 mt-6 text-[13px] font-medium text-muted">Format</p>
          <FormatChoice value={fileFormat} onChange={setFileFormat} />
          <Button
            size="lg"
            icon={PiDownloadSimple}
            loading={busy}
            onClick={download}
            disabled={tab === 'attendance' && sessionNames?.length === 0}
            className="mt-6 w-full"
          >
            {busy ? 'Preparing file' : `Download ${fileFormat === 'excel' ? 'Excel' : 'PDF'}`}
          </Button>
        </Card>
      </div>
    </>
  );
};

export default Export;
