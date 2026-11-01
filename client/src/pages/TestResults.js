import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PiMagnifyingGlass, PiPencilSimple, PiTrash, PiChartLineUp, PiWarningCircle, PiPlus } from 'react-icons/pi';
import api from '../utils/api';
import usePageTitle from '../hooks/usePageTitle';
import { apiError } from '../utils/browser';
import { Card, PageHeader, Skeleton, EmptyState } from '../components/ui/Display';
import Button from '../components/ui/Button';
import Menu from '../components/ui/Menu';
import Dialog from '../components/ui/Dialog';
import { Input, Select } from '../components/ui/Form';
import { Segmented } from '../components/ui/Segmented';
import { useConfirm } from '../components/ui/ConfirmProvider';
import PerformanceTabs from '../components/PerformanceTabs';
import ResultFields, { formFromResult, validateResult, buildPayload, ResultPreview, CyclingMeta } from '../components/ResultFields';
import { CATEGORIES, categoryMeta, formatDistance, formatTime, formatPace, formatResultDate, lineageOf, versionLabel } from '../utils/performance';

const PAGE = 40;

const EditResultDialog = ({ result, onClose, athletes, testTypes, onSaved }) => {
  const [form, setForm] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (result) { setForm(formFromResult(result, testTypes)); setAttempted(false); } }, [result, testTypes]);
  if (!result || !form) return null;

  const testType = testTypes.find((t) => t._id === form.testTypeId) || result.testType;
  // Archived athletes are not in the active list; keep the current one selectable.
  const athleteOptions = athletes.some((a) => a._id === form.athleteId) || !result.athlete
    ? athletes
    : [...athletes, { _id: result.athlete._id, name: `${result.athlete.name} (archived)` }];
  const typeOptions = testTypes.some((t) => t._id === form.testTypeId) || !result.testType ? testTypes : [...testTypes, result.testType];

  const errors = attempted ? validateResult(form, testType, false) : {};

  const submit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    if (Object.keys(validateResult(form, testType, false)).length) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/tests/results/${result._id}`, buildPayload(form, testType, false));
      onSaved(data);
      onClose();
      toast.success('Result updated');
    } catch (err) {
      toast.error(apiError(err, 'Could not update the result'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit result"
      size="lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-result-form" loading={saving}>Save changes</Button>
        </>
      )}
    >
      <form id="edit-result-form" onSubmit={submit} noValidate>
        <ResultFields form={form} setForm={setForm} errors={errors} athletes={athleteOptions} testTypes={typeOptions} lockTargets={false} idPrefix="edit" />
        <ResultPreview form={form} testType={testType} lockTargets={false} className="mt-5 rounded-lg bg-surface-2/60 p-4" />
      </form>
    </Dialog>
  );
};

const TestResults = () => {
  usePageTitle('Results');
  const confirm = useConfirm();
  const [results, setResults] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [testTypes, setTestTypes] = useState([]);
  const [status, setStatus] = useState('loading');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [typeId, setTypeId] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [r, a, t] = await Promise.all([api.get('/tests/results'), api.get('/athletes'), api.get('/tests/types')]);
      setResults(r.data);
      setAthletes(a.data);
      setTestTypes(t.data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setLimit(PAGE); }, [search, category, typeId]);

  // A test filter matches every version of that test.
  const typeLineage = lineageOf(testTypes.find((t) => t._id === typeId));
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results.filter((r) =>
      (category === 'All' || r.testType?.category === category)
      && (!typeId || lineageOf(r.testType) === typeLineage)
      && (!q || (r.athlete?.name || '').toLowerCase().includes(q)));
  }, [results, search, category, typeId, typeLineage]);

  const typesInCategory = testTypes.filter((t) => category === 'All' || t.category === category);
  const shown = filtered.slice(0, limit);

  const remove = async (r) => {
    const ok = await confirm({
      title: 'Delete this result?',
      body: `${r.athlete?.name || 'This athlete'}'s ${r.testType?.title || 'test'} on ${formatResultDate(r.date)}. This cannot be undone.`,
      confirmLabel: 'Delete result',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      await api.delete(`/tests/results/${r._id}`);
      setResults((list) => list.filter((x) => x._id !== r._id));
      toast.success('Result deleted');
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the result'));
    }
  };

  const actions = (r) => (
    <Menu
      label="Result actions"
      items={[
        { label: 'Edit', icon: PiPencilSimple, onSelect: () => setEditing(r) },
        { label: 'Delete', icon: PiTrash, tone: 'danger', onSelect: () => remove(r) }
      ]}
    />
  );

  return (
    <>
      <PageHeader title="Performance" description="Every recorded test, newest first." actions={<Button to="/tests" icon={PiPlus}>Record test</Button>}>
        <PerformanceTabs />
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:w-72"><Input icon={PiMagnifyingGlass} placeholder="Search athlete" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search by athlete" /></div>
        <Segmented
          label="Sport"
          value={category}
          onChange={(v) => { setCategory(v); setTypeId(''); }}
          options={[{ value: 'All', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c, label: categoryMeta(c).short, icon: categoryMeta(c).Icon }))]}
          className="self-start lg:self-auto"
        />
        <Select value={typeId} onChange={(e) => setTypeId(e.target.value)} aria-label="Filter by test" className="lg:w-56">
          <option value="">All tests</option>
          {typesInCategory.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
        </Select>
      </div>

      {status === 'loading' ? (
        <Card className="p-4" aria-hidden="true">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="mb-3 h-12 last:mb-0" />)}</Card>
      ) : status === 'error' ? (
        <Card><EmptyState icon={PiWarningCircle} title="Could not load results" action={<Button onClick={load}>Try again</Button>} /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiChartLineUp}
            title={results.length ? 'No results match these filters' : 'No results yet'}
            body={results.length ? 'Try another sport or clear the search.' : 'Recorded tests show up here with pace and speed worked out.'}
            action={results.length ? <Button variant="secondary" onClick={() => { setSearch(''); setCategory('All'); setTypeId(''); }}>Clear filters</Button> : <Button to="/tests" icon={PiPlus}>Record a test</Button>}
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-muted">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</p>

          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-line-soft text-[12px] text-muted">
                  <th scope="col" className="px-5 py-3 font-medium">Date</th>
                  <th scope="col" className="px-3 py-3 font-medium">Athlete</th>
                  <th scope="col" className="px-3 py-3 font-medium">Test</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Distance</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Time</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Pace / speed</th>
                  <th scope="col" className="w-14 px-3 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const { Icon } = categoryMeta(r.testType?.category);
                  return (
                    <tr key={r._id} className="border-b border-line-soft align-top last:border-0 hover:bg-surface-2/40">
                      <td className="whitespace-nowrap px-5 py-3 text-muted tabular-nums">{formatResultDate(r.date)}</td>
                      <td className="px-3 py-3">
                        {r.athlete ? <Link to={`/athlete/${r.athlete._id}`} className="font-medium hover:underline">{r.athlete.name}</Link> : <span className="text-muted">Deleted athlete</span>}
                        <CyclingMeta r={r} />
                        {r.description && <p className="mt-1 max-w-[42ch] text-[12px] text-muted">{r.description}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4 text-muted" aria-hidden="true" />{r.testType?.title || 'Deleted test'}</span>
                        {versionLabel(r.testType) && <span className="mt-0.5 block text-[12px] text-muted">{versionLabel(r.testType)}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatDistance(r.distance)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatTime(r.time)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{formatPace(r.distance, r.time, r.testType)}</td>
                      <td className="px-3 py-2 text-right">{actions(r)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {shown.map((r) => {
              const { Icon } = categoryMeta(r.testType?.category);
              return (
                <Card as="li" key={r._id} className="flex gap-3 p-4">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{r.athlete?.name || 'Deleted athlete'}</p>
                    <p className="truncate text-[13px] text-muted">{r.testType?.title || 'Deleted test'}{versionLabel(r.testType) && ` (${versionLabel(r.testType)})`} · {formatResultDate(r.date)}</p>
                    <p className="mt-2 text-[14px] tabular-nums">
                      <span className="font-semibold">{formatPace(r.distance, r.time, r.testType)}</span>
                      <span className="text-muted"> · {formatDistance(r.distance)} in {formatTime(r.time)}</span>
                    </p>
                    <CyclingMeta r={r} />
                    {r.description && <p className="mt-1 text-[12px] text-muted">{r.description}</p>}
                  </div>
                  <div className="-mr-2 -mt-1">{actions(r)}</div>
                </Card>
              );
            })}
          </ul>

          {filtered.length > limit && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, filtered.length - limit)} more</Button>
            </div>
          )}
        </>
      )}

      <EditResultDialog
        result={editing}
        onClose={() => setEditing(null)}
        athletes={athletes}
        testTypes={testTypes}
        onSaved={(data) => setResults((list) => list.map((x) => (x._id === data._id ? data : x)).sort((a, b) => new Date(b.date) - new Date(a.date)))}
      />
    </>
  );
};

export default TestResults;
