import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PiPlus, PiPencilSimple, PiTrash, PiArrowLeft, PiTimer, PiWarningCircle, PiCheckCircle, PiClockCounterClockwise, PiUsersThree, PiUser
} from 'react-icons/pi';
import api from '../utils/api';
import usePageTitle from '../hooks/usePageTitle';
import { apiError } from '../utils/browser';
import { Card, CardHeader, PageHeader, Skeleton, EmptyState } from '../components/ui/Display';
import Button from '../components/ui/Button';
import Menu from '../components/ui/Menu';
import Dialog from '../components/ui/Dialog';
import { Field, Input, Select, DurationInput } from '../components/ui/Form';
import { Segmented } from '../components/ui/Segmented';
import { useConfirm } from '../components/ui/ConfirmProvider';
import PerformanceTabs from '../components/PerformanceTabs';
import ResultFields, { emptyResultForm, validateResult, buildPayload, ResultPreview } from '../components/ResultFields';
import SquadResults from '../components/SquadResults';
import {
  CATEGORIES, categoryMeta, formatDistance, formatTime, formatPace, formatResultDate, fromSeconds, toSeconds, describeTarget
} from '../utils/performance';

// ---------- Test types ----------

const emptyType = { title: '', category: 'Running', measureType: 'Distance', distanceValue: '', distanceUnit: 'm', time: { h: '0', m: '0', s: '0' } };

const TestTypeDialog = ({ open, onClose, testType, onSaved }) => {
  const [form, setForm] = useState(emptyType);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (!testType) { setForm(emptyType); return; }
    const d = testType.targetDistance || 0;
    const km = d >= 1000 && d % 1000 === 0;
    setForm({
      title: testType.title,
      category: testType.category,
      measureType: testType.measureType,
      distanceValue: d ? String(km ? d / 1000 : d) : '',
      distanceUnit: km ? 'km' : 'm',
      time: fromSeconds(testType.targetTime || 0)
    });
  }, [open, testType]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const distance = parseFloat(form.distanceValue) * (form.distanceUnit === 'km' ? 1000 : 1);
  const time = toSeconds(form.time);
  // Changing what is measured on a test that already has results starts a new version.
  const redefines = testType && testType.resultCount > 0 && (
    form.category !== testType.category
    || form.measureType !== testType.measureType
    || (form.measureType === 'Distance' && distance !== testType.targetDistance)
    || (form.measureType === 'Time' && time !== testType.targetTime)
  );

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = 'Give the test a name.';
    if (form.measureType === 'Distance' && !(distance > 0)) next.target = 'Enter the distance athletes cover.';
    if (form.measureType === 'Time' && !(time > 0)) next.target = 'Enter how long the test lasts.';
    if (parseInt(form.time.m, 10) > 59 || parseInt(form.time.s, 10) > 59) next.target = 'Minutes and seconds go up to 59.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        category: form.category,
        measureType: form.measureType,
        ...(form.measureType === 'Distance' ? { targetDistance: distance } : { targetTime: time })
      };
      const { data } = testType ? await api.put(`/tests/types/${testType._id}`, body) : await api.post('/tests/types', body);
      onSaved(data, !testType);
      onClose();
    } catch (err) {
      setErrors({ form: apiError(err, 'Could not save the test type.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={testType ? 'Edit test type' : 'New test type'}
      description="Fix either the distance (time is measured) or the time (distance is measured)."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="type-form" loading={saving}>{testType ? 'Save changes' : 'Create test'}</Button>
        </>
      )}
    >
      <form id="type-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Name" htmlFor="type-title" error={errors.title}>
          <Input id="type-title" value={form.title} onChange={set('title')} placeholder="5 km run" aria-invalid={!!errors.title} data-autofocus />
        </Field>
        <Field label="Sport" htmlFor="type-category">
          <Select id="type-category" value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="What is fixed?">
          <Segmented
            label="What is fixed"
            stretch
            value={form.measureType}
            onChange={(v) => setForm((f) => ({ ...f, measureType: v }))}
            options={[{ value: 'Distance', label: 'Distance' }, { value: 'Time', label: 'Time' }]}
          />
        </Field>
        {form.measureType === 'Distance' ? (
          <Field label="Target distance" htmlFor="type-distance" error={errors.target}>
            <div className="flex gap-2">
              <Input id="type-distance" type="number" inputMode="decimal" min="0" step="0.01" value={form.distanceValue} onChange={set('distanceValue')} aria-invalid={!!errors.target} />
              <Select value={form.distanceUnit} onChange={set('distanceUnit')} aria-label="Distance unit" className="w-24 shrink-0">
                <option value="m">m</option>
                <option value="km">km</option>
              </Select>
            </div>
          </Field>
        ) : (
          <Field label="Target time" error={errors.target}>
            <DurationInput idPrefix="type-time" value={form.time} onChange={(time) => setForm((f) => ({ ...f, time }))} invalid={!!errors.target} />
          </Field>
        )}
        {redefines ? (
          <p className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-[13px]">
            <PiClockCounterClockwise className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <span>
              {testType.resultCount} {testType.resultCount === 1 ? 'result uses' : 'results use'} the current definition ({describeTarget(testType)}).
              Saving starts version {(testType.version || 1) + 1} from today. Earlier results stay on version {testType.version || 1}, so they are never compared with the new target.
            </span>
          </p>
        ) : testType ? (
          <p className="text-[12px] text-muted">Renaming updates every result. Results already recorded keep their own distance and time.</p>
        ) : null}
        {errors.form && <p role="alert" className="text-[13px] text-danger">{errors.form}</p>}
      </form>
    </Dialog>
  );
};

const targetLabel = (t) => (t.measureType === 'Distance'
  ? `Fixed distance, ${t.targetDistance ? formatDistance(t.targetDistance) : 'not set'}`
  : `Fixed time, ${t.targetTime ? formatTime(t.targetTime) : 'not set'}`);

// "12 results · v2 since Mar 4 (was 3 km)"
const historyLabel = (t) => {
  const parts = [`${t.resultCount || 0} ${t.resultCount === 1 ? 'result' : 'results'}`];
  const versions = t.versions || [];
  if (versions.length > 1) {
    const previous = versions[versions.length - 2];
    parts.push(`v${t.version} since ${formatResultDate(t.validFrom, { month: 'short', day: 'numeric', year: 'numeric' })} (was ${describeTarget(previous)})`);
  }
  return parts.join(' · ');
};

const TestTypesView = ({ testTypes, setTestTypes, status, reload }) => {
  const confirm = useConfirm();
  const [dialog, setDialog] = useState({ open: false, testType: null });

  const remove = async (t) => {
    const ok = await confirm({
      title: `Delete “${t.title}”?`,
      body: 'It disappears from the record form and export choices. Results already recorded stay in history.',
      confirmLabel: 'Delete test type',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      await api.delete(`/tests/types/${t._id}`);
      setTestTypes((list) => list.filter((x) => x._id !== t._id));
      toast.success('Test type deleted');
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the test type'));
    }
  };

  if (status === 'loading') return <Skeleton className="h-64 rounded-xl" />;
  if (status === 'error') return <Card><EmptyState icon={PiWarningCircle} title="Could not load test types" action={<Button onClick={reload}>Try again</Button>} /></Card>;

  const groups = CATEGORIES.map((c) => ({ category: c, items: testTypes.filter((t) => t.category === c) })).filter((g) => g.items.length);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[14px] text-muted">{testTypes.length} {testTypes.length === 1 ? 'test' : 'tests'} set up</p>
        <Button icon={PiPlus} onClick={() => setDialog({ open: true, testType: null })}>New test type</Button>
      </div>
      {testTypes.length === 0 ? (
        <Card>
          <EmptyState icon={PiTimer} title="No test types yet" body="Create the benchmarks you run, like a 5 km run, a 400 m swim or a 20 minute FTP." action={<Button icon={PiPlus} onClick={() => setDialog({ open: true, testType: null })}>New test type</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map(({ category, items }) => {
            const { Icon } = categoryMeta(category);
            return (
              <Card key={category} className="p-2">
                <p className="flex items-center gap-2 px-3 pb-1 pt-3 text-[13px] font-medium text-muted">
                  <Icon className="h-4 w-4" aria-hidden="true" />{category}
                </p>
                <ul>
                  {items.map((t) => (
                    <li key={t._id} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface-2/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">{t.title}</p>
                        <p className="text-[12px] text-muted">{targetLabel(t)}</p>
                        <p className="text-[12px] text-muted/80">{historyLabel(t)}</p>
                      </div>
                      <Menu
                        label={`Actions for ${t.title}`}
                        items={[
                          { label: 'Edit', icon: PiPencilSimple, onSelect: () => setDialog({ open: true, testType: t }) },
                          { label: 'Delete', icon: PiTrash, tone: 'danger', onSelect: () => remove(t) }
                        ]}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
      <TestTypeDialog
        open={dialog.open}
        testType={dialog.testType}
        onClose={() => setDialog({ open: false, testType: null })}
        onSaved={(data, created) => {
          if (data.versioned) toast.success(`Saved as version ${data.version}. Earlier results keep version ${data.previousVersion}.`, { duration: 5000 });
          else toast.success(created ? 'Test type created' : 'Test type updated');
          // Reload for fresh version history and result counts.
          reload({ quiet: true });
        }}
      />
    </>
  );
};

// ---------- Record ----------

const RecordView = ({ athletes, testTypes, templates, status, preselectedAthlete }) => {
  // Whole squad by default; one athlete when coming from a profile.
  const [mode, setMode] = useState(preselectedAthlete ? 'single' : 'squad');

  if (status === 'loading') return <Skeleton className="h-[520px] rounded-xl" />;
  if (status === 'error') return <Card><EmptyState icon={PiWarningCircle} title="Could not load the form" body="Check your connection and try again." /></Card>;
  if (testTypes.length === 0) {
    return (
      <Card>
        <EmptyState icon={PiTimer} title="Set up a test first" body="Create a test type, like a 5 km run, before recording results." action={<Button to="/tests?tab=types" icon={PiPlus}>New test type</Button>} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Record for"
        value={mode}
        onChange={setMode}
        options={[{ value: 'squad', label: 'Whole squad', icon: PiUsersThree }, { value: 'single', label: 'One athlete', icon: PiUser }]}
        className="self-start"
      />
      {mode === 'squad'
        ? <SquadResults athletes={athletes} testTypes={testTypes} templates={templates} />
        : <SingleResult athletes={athletes} testTypes={testTypes} preselectedAthlete={preselectedAthlete} />}
    </div>
  );
};

const SingleResult = ({ athletes, testTypes, preselectedAthlete }) => {
  const [form, setForm] = useState(() => emptyResultForm(preselectedAthlete || ''));
  // Errors show after the first submit attempt and update live as fields are fixed.
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState([]);

  useEffect(() => { if (preselectedAthlete) setForm((f) => ({ ...f, athleteId: preselectedAthlete })); }, [preselectedAthlete]);

  const testType = testTypes.find((t) => t._id === form.testTypeId);
  const errors = attempted ? validateResult(form, testType, true) : {};

  const submit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    if (Object.keys(validateResult(form, testType, true)).length) return;
    setSaving(true);
    try {
      const { data } = await api.post('/tests/results', buildPayload(form, testType, true));
      setRecent((list) => [data, ...list].slice(0, 6));
      // Keep athlete, test and date so the next result is quick to enter.
      setForm((f) => ({ ...emptyResultForm(f.athleteId), testTypeId: f.testTypeId, date: f.date, distanceUnit: f.distanceUnit }));
      setAttempted(false);
      toast.success(`Saved ${data.athlete?.name || 'result'}`);
    } catch (err) {
      toast.error(apiError(err, 'Could not save the result'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <Card className="p-5 md:p-6">
        <form onSubmit={submit} noValidate>
          <ResultFields form={form} setForm={setForm} errors={errors} athletes={athletes} testTypes={testTypes} lockTargets idPrefix="record" />
          <Button type="submit" size="lg" loading={saving} className="mt-6 w-full sm:w-auto">Save result</Button>
        </form>
      </Card>
      <div className="flex flex-col gap-6 lg:sticky lg:top-10">
        <Card className="p-5 md:p-6">
          {testType ? (
            <ResultPreview form={form} testType={testType} lockTargets />
          ) : (
            <p className="text-[14px] text-muted">Choose a test to see the calculated pace or speed here.</p>
          )}
        </Card>
        {recent.length > 0 && (
          <Card className="p-5 md:p-6">
            <CardHeader title="Saved just now" description="Results recorded during this visit" />
            <ul className="mt-3 flex flex-col divide-y divide-line-soft">
              {recent.map((r) => (
                <li key={r._id} className="flex items-center gap-3 py-2.5">
                  <PiCheckCircle className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{r.athlete?.name}</p>
                    <p className="truncate text-[12px] text-muted">{r.testType?.title} · {formatResultDate(r.date, { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <span className="text-[13px] font-medium tabular-nums">{formatPace(r.distance, r.time, r.testType)}</span>
                </li>
              ))}
            </ul>
            <Link to="/test-results" className="mt-2 inline-flex min-h-10 items-center text-[14px] font-medium text-accent hover:underline">See all results</Link>
          </Card>
        )}
      </div>
    </div>
  );
};

// ---------- Page ----------

const Tests = () => {
  const [params] = useSearchParams();
  const tab = params.get('tab') === 'types' ? 'types' : 'record';
  const preselected = params.get('athleteId');
  usePageTitle(tab === 'types' ? 'Test types' : 'Record test');

  const [athletes, setAthletes] = useState([]);
  const [testTypes, setTestTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState('loading');

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus('loading');
    try {
      const [a, t, s] = await Promise.all([
        api.get('/athletes'),
        api.get('/tests/types'),
        api.get('/schedules').catch(() => ({ data: [] }))
      ]);
      setAthletes(a.data);
      setTestTypes(t.data);
      setTemplates(s.data.filter((x) => x.active));
      setStatus('ready');
    } catch {
      if (!quiet) setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fromAthlete = preselected && athletes.find((a) => a._id === preselected);

  return (
    <>
      <PageHeader
        title="Performance"
        description={tab === 'types' ? 'The benchmark tests you run with your squad.' : 'Record benchmark results. Pace and speed are calculated for you.'}
        back={fromAthlete && (
          <Link to={`/athlete/${fromAthlete._id}`} className="-my-2.5 inline-flex min-h-10 items-center gap-1.5 self-start pr-2 text-[14px] text-muted hover:text-ink">
            <PiArrowLeft className="h-4 w-4" aria-hidden="true" />{fromAthlete.name}
          </Link>
        )}
      >
        <PerformanceTabs />
      </PageHeader>
      {tab === 'types'
        ? <TestTypesView testTypes={testTypes} setTestTypes={setTestTypes} status={status} reload={load} />
        : <RecordView athletes={athletes} testTypes={testTypes} templates={templates} status={status} preselectedAthlete={preselected} />}
    </>
  );
};

export default Tests;
