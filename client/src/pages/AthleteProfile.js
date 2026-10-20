import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  PiArrowLeft, PiTimer, PiPencilSimple, PiRepeat, PiArchive, PiArrowCounterClockwise, PiX, PiPlus,
  PiWarningCircle, PiChartLineUp, PiClock, PiTrophy
} from 'react-icons/pi';
import api from '../utils/api';
import usePageTitle from '../hooks/usePageTitle';
import { apiError } from '../utils/browser';
import { Card, CardHeader, Spotlight, Stat, Avatar, Badge, Skeleton, EmptyState, WeekDots } from '../components/ui/Display';
import Button, { IconButton } from '../components/ui/Button';
import Menu from '../components/ui/Menu';
import Dialog from '../components/ui/Dialog';
import { Segmented } from '../components/ui/Segmented';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { AXIS, GRID, ChartTooltip, ChartFrame } from '../components/ui/Chart';
import AthleteFormDialog from '../components/AthleteFormDialog';
import { CATEGORIES, categoryMeta, metricFor, formatDistance, formatTime, formatPace, formatResultDate, versionLabel } from '../utils/performance';
import cx from '../utils/cx';

const EnrollDialog = ({ open, onClose, athlete, schedules, onEnroll }) => {
  const [choice, setChoice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setChoice(''); }, [open]);

  const submit = async () => {
    setSaving(true);
    try { await onEnroll(choice); onClose(); } catch { /* toast shown by caller */ } finally { setSaving(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add ${athlete.name} to a template`}
      description="They will be expected at every session the template creates from today on."
      footer={schedules.length > 0 && (
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!choice} loading={saving}>Add to template</Button>
        </>
      )}
    >
      {schedules.length === 0 ? (
        <EmptyState
          icon={PiRepeat}
          title="Nothing to add"
          body={`${athlete.name} is already on every template, or you have not created one yet.`}
          action={<Link to="/sessions?view=templates" onClick={onClose}><Button variant="secondary">Manage templates</Button></Link>}
          className="py-6"
        />
      ) : (
        <div role="radiogroup" aria-label="Templates" className="-mx-2 flex flex-col gap-1">
          {schedules.map((s) => (
            <label key={s._id} className={cx('flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 transition-colors', choice === s._id ? 'bg-surface-2' : 'hover:bg-surface-2/60')}>
              <input type="radio" name="template" className="sr-only" checked={choice === s._id} onChange={() => setChoice(s._id)} />
              <span aria-hidden="true" className={cx('h-5 w-5 shrink-0 rounded-full border-2', choice === s._id ? 'border-ink bg-ink shadow-[inset_0_0_0_3px_#1c1c1c]' : 'border-[#3a3a3a]')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{s.name}{!s.active && <span className="text-muted"> (paused)</span>}</span>
                <WeekDots days={s.daysOfWeek} className="mt-1.5" />
              </span>
              {s.time && <span className="text-[13px] text-muted tabular-nums">{s.time}</span>}
            </label>
          ))}
        </div>
      )}
    </Dialog>
  );
};

const ProfileSkeleton = () => (
  <div aria-hidden="true">
    <Skeleton className="mb-6 h-5 w-24" />
    <Skeleton className="mb-6 h-52 rounded-xxl" />
    <Skeleton className="mb-6 h-28 rounded-xl" />
    <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
  </div>
);

const AthleteProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [profile, setProfile] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);
  const [status, setStatus] = useState('loading');
  const [typeId, setTypeId] = useState('');
  const [historySport, setHistorySport] = useState('All');
  const [editOpen, setEditOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  usePageTitle(profile?.athlete?.name || 'Athlete');

  const load = useCallback(async () => {
    try {
      const [{ data }, schedules] = await Promise.all([
        api.get(`/athletes/${id}/profile`),
        api.get('/schedules').catch(() => ({ data: [] }))
      ]);
      setProfile(data);
      setAllSchedules(schedules.data);
      setStatus('ready');
      setTypeId((current) => current || data.testResults[0]?.testType?._id || '');
    } catch (err) {
      setStatus(err?.response?.status === 404 ? 'missing' : 'error');
    }
  }, [id]);

  useEffect(() => { setStatus('loading'); setTypeId(''); load(); }, [load]);

  const testTypes = useMemo(() => {
    const map = new Map();
    (profile?.testResults || []).forEach((r) => { if (r.testType && !map.has(r.testType._id)) map.set(r.testType._id, r.testType); });
    return [...map.values()];
  }, [profile]);

  const selectedType = testTypes.find((t) => t._id === typeId);
  const metric = useMemo(() => metricFor(selectedType), [selectedType]);

  const series = useMemo(() => {
    if (!profile || !selectedType) return [];
    return profile.testResults
      .filter((r) => r.testType?._id === typeId)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((r) => ({ ...r, label: formatResultDate(r.date, { month: 'short', day: 'numeric' }), value: metric.value(r) }))
      .filter((p) => Number.isFinite(p.value));
  }, [profile, selectedType, typeId, metric]);

  const summary = useMemo(() => {
    if (series.length === 0) return null;
    const values = series.map((p) => p.value);
    const best = metric.lowerIsBetter ? Math.min(...values) : Math.max(...values);
    const first = values[0];
    const latest = values[values.length - 1];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    // Positive change always means "got better".
    const change = series.length > 1 && first ? Math.round(((metric.lowerIsBetter ? first - latest : latest - first) / first) * 100) : null;
    return { best, latest, avg, change };
  }, [series, metric]);

  const enrolledIds = new Set((profile?.schedules || []).map((s) => s._id));
  const available = allSchedules.filter((s) => !enrolledIds.has(s._id));

  const updateRoster = async (schedule, ids, message) => {
    try {
      await api.put(`/schedules/${schedule._id}`, { assignedAthletes: ids });
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not update the template'));
      throw err;
    }
  };

  const enroll = (scheduleId) => {
    const s = allSchedules.find((x) => x._id === scheduleId);
    return updateRoster(s, [...new Set([...(s.assignedAthletes || []).map(String), id])], `Added to ${s.name}`);
  };

  const unenroll = async (s) => {
    const ok = await confirm({
      title: `Remove from ${s.name}?`,
      body: `${profile.athlete.name} will no longer be expected at ${s.name} from today on. Past attendance is kept.`,
      confirmLabel: 'Remove'
    });
    if (!ok) return;
    updateRoster(s, (s.assignedAthletes || []).map(String).filter((x) => x !== id), `Removed from ${s.name}`).catch(() => {});
  };

  const toggleArchive = async () => {
    const { athlete } = profile;
    if (athlete.active) {
      const ok = await confirm({
        title: `Archive ${athlete.name}?`,
        body: 'They leave check-in lists and reports. History is kept and you can restore them any time.',
        confirmLabel: 'Archive'
      });
      if (!ok) return;
    }
    try {
      if (athlete.active) await api.delete(`/athletes/${id}`);
      else await api.put(`/athletes/${id}`, { active: true });
      toast.success(athlete.active ? `${athlete.name} archived` : `${athlete.name} restored`);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Could not update the athlete'));
    }
  };

  if (status === 'loading') return <ProfileSkeleton />;
  if (status !== 'ready') {
    return (
      <Card>
        <EmptyState
          icon={PiWarningCircle}
          title={status === 'missing' ? 'Athlete not found' : 'Could not load this profile'}
          body={status === 'missing' ? 'They may have been deleted.' : 'Check your connection and try again.'}
          action={status === 'missing' ? <Button onClick={() => navigate('/athletes')}>Back to athletes</Button> : <Button onClick={load}>Try again</Button>}
        />
      </Card>
    );
  }

  const { athlete, attendance, schedules, testResults } = profile;
  const history = historySport === 'All' ? testResults : testResults.filter((r) => r.testType?.category === historySport);
  const hasTrend = attendance.monthlyTrend.some((m) => m.total > 0);
  const fmt = (v) => (v == null ? '-' : metric.format(v));

  return (
    <div className="flex flex-col gap-6">
      <Link to="/athletes" className="inline-flex items-center gap-1.5 self-start text-[14px] text-muted hover:text-ink">
        <PiArrowLeft className="h-4 w-4" aria-hidden="true" />Athletes
      </Link>

      <Spotlight tone="magenta" className="p-6 md:p-8 animate-rise">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={athlete.name} size="lg" className="!bg-white/20 !text-white" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {athlete.isNewAthlete && <Badge tone="new">New</Badge>}
                {!athlete.active && <Badge tone="onColor">Archived</Badge>}
              </div>
              <h1 className="mt-1 font-display text-[32px] font-medium leading-[1] tracking-[-0.05em] md:text-[44px]">{athlete.name}</h1>
              <p className="mt-2 text-[14px] text-white/80">
                Joined {new Date(athlete.joinDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/tests?athleteId=${id}`}><Button icon={PiTimer}>Record test</Button></Link>
            <Menu
              label="Athlete actions"
              triggerVariant="translucent"
              items={[
                { label: 'Edit details', icon: PiPencilSimple, onSelect: () => setEditOpen(true) },
                { label: 'Add to template', icon: PiRepeat, onSelect: () => setEnrollOpen(true) },
                athlete.active
                  ? { label: 'Archive', icon: PiArchive, onSelect: toggleArchive }
                  : { label: 'Restore', icon: PiArrowCounterClockwise, onSelect: toggleArchive }
              ]}
            />
          </div>
        </div>
      </Spotlight>

      <Card className="grid grid-cols-2 gap-6 p-5 md:grid-cols-4 md:p-6">
        <Stat
          label="Attendance rate"
          value={attendance.totalSessions ? `${attendance.rate}%` : '-'}
          tone={attendance.totalSessions ? (attendance.rate >= 75 ? 'success' : attendance.rate < 50 ? 'danger' : undefined) : undefined}
          sub="All time"
        />
        <Stat label="Sessions attended" value={attendance.attended} sub={`of ${attendance.totalSessions} recorded`} />
        <Stat label="Current streak" value={attendance.streak} sub={attendance.streak === 1 ? 'session in a row' : 'sessions in a row'} />
        <Stat label="Tests recorded" value={profile.testCount} sub={`${testTypes.length} ${testTypes.length === 1 ? 'test type' : 'test types'}`} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="p-5 md:p-6">
          <CardHeader title="Attendance by month" description="Sessions attended, last 6 months" />
          {hasTrend ? (
            <div className="mt-5">
              <ChartFrame height="h-52" label="Sessions attended per month">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendance.monthlyTrend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="month" {...AXIS} />
                    <YAxis {...AXIS} allowDecimals={false} width={48} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      content={<ChartTooltip render={(d) => (
                        <>
                          <p className="text-muted">{d.month} {d.year}</p>
                          <p className="font-semibold">{d.present} of {d.total} attended</p>
                          {d.total > 0 && <p className="text-muted">{d.rate}% rate</p>}
                        </>
                      )} />}
                    />
                    <Bar isAnimationActive={false} dataKey="present" fill="#ffffff" radius={[6, 6, 2, 2]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
          ) : (
            <EmptyState icon={PiChartLineUp} title="No attendance yet" body="Once this athlete is checked in, monthly totals appear here." className="py-10" />
          )}
        </Card>

        <Card className="flex flex-col p-5 md:p-6">
          <CardHeader
            title="Templates"
            description="Recurring sessions they are expected at"
            actions={<Button size="sm" variant="secondary" icon={PiPlus} onClick={() => setEnrollOpen(true)}>Add</Button>}
          />
          {schedules.length ? (
            <ul className="mt-4 flex flex-col gap-2">
              {schedules.map((s) => (
                <li key={s._id} className="flex items-center gap-3 rounded-lg bg-surface-2/60 p-3 pl-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{s.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <WeekDots days={s.daysOfWeek} />
                      {s.time && <span className="inline-flex items-center gap-1 text-[12px] text-muted"><PiClock className="h-3.5 w-3.5" aria-hidden="true" />{s.time}</span>}
                    </div>
                  </div>
                  <IconButton icon={PiX} label={`Remove from ${s.name}`} size="sm" onClick={() => unenroll(s)} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={PiRepeat}
              title="Not on any template"
              body="Templates that list nobody expect the whole roster, so they may still be counted there."
              className="py-8"
            />
          )}
        </Card>
      </div>

      <Card className="p-5 md:p-6">
        <CardHeader
          title="Performance"
          description={selectedType ? `${metric.label}${metric.unit ? ` in ${metric.unit}` : ''}, ${metric.lowerIsBetter ? 'lower' : 'higher'} is better` : 'Benchmark results over time'}
          actions={<Link to={`/tests?athleteId=${id}`}><Button size="sm" variant="secondary" icon={PiTimer}>Record test</Button></Link>}
        />
        {testTypes.length === 0 ? (
          <EmptyState icon={PiTrophy} title="No tests recorded" body={`Record a benchmark to start tracking ${athlete.name}'s progress.`} className="py-10" />
        ) : (
          <>
            <Segmented
              label="Test"
              value={typeId}
              onChange={setTypeId}
              options={testTypes.map((t) => ({ value: t._id, label: versionLabel(t) ? `${t.title} (${versionLabel(t)})` : t.title, icon: categoryMeta(t.category).Icon }))}
              className="mt-4"
            />
            {summary && (
              <dl className="mt-5 grid grid-cols-2 gap-6 md:grid-cols-4">
                <div><dt className="text-[13px] text-muted">Best</dt><dd className="mt-1 font-display text-[26px] font-medium tracking-[-0.04em] tabular-nums">{fmt(summary.best)}</dd></div>
                <div><dt className="text-[13px] text-muted">Latest</dt><dd className="mt-1 font-display text-[26px] font-medium tracking-[-0.04em] tabular-nums">{fmt(summary.latest)}</dd></div>
                <div><dt className="text-[13px] text-muted">Average</dt><dd className="mt-1 font-display text-[26px] font-medium tracking-[-0.04em] tabular-nums">{fmt(summary.avg)}</dd></div>
                <div>
                  <dt className="text-[13px] text-muted">Since first test</dt>
                  <dd className={cx('mt-1 font-display text-[26px] font-medium tracking-[-0.04em] tabular-nums', summary.change > 0 && 'text-success', summary.change < 0 && 'text-danger')}>
                    {summary.change == null ? '-' : `${summary.change > 0 ? '+' : ''}${summary.change}%`}
                  </dd>
                </div>
              </dl>
            )}
            {series.length > 1 ? (
              <div className="mt-6">
                <ChartFrame height="h-60" label={`${selectedType?.title} results over time`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="label" {...AXIS} />
                      <YAxis {...AXIS} width={60} domain={['auto', 'auto']} reversed={metric.lowerIsBetter} tickFormatter={(v) => metric.format(v)} />
                      <Tooltip
                        cursor={{ stroke: '#333' }}
                        content={<ChartTooltip render={(d) => (
                          <>
                            <p className="text-muted">{formatResultDate(d.date)}</p>
                            <p className="font-semibold">{metric.format(d.value)}{metric.unit && ` ${metric.unit}`}</p>
                            <p className="text-muted">{formatDistance(d.distance)} in {formatTime(d.time)}</p>
                          </>
                        )} />}
                      />
                      <Line isAnimationActive={false} type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={2} dot={{ r: 3.5, fill: '#ffffff', stroke: '#141414', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#0099ff', stroke: '#141414', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartFrame>
                {metric.lowerIsBetter && <p className="mt-2 text-[12px] text-muted">The axis is flipped so faster results sit higher.</p>}
              </div>
            ) : (
              <p className="mt-6 rounded-lg bg-surface-2/60 p-4 text-[14px] text-muted">One result so far. Record another to see a trend line.</p>
            )}
          </>
        )}
      </Card>

      {testResults.length > 0 && (
        <Card className="p-5 md:p-6">
          <CardHeader
            title="Test history"
            description={`${history.length} ${history.length === 1 ? 'result' : 'results'}`}
            actions={(
              <Segmented
                label="Sport"
                value={historySport}
                onChange={setHistorySport}
                options={[{ value: 'All', label: 'All' }, ...CATEGORIES.filter((c) => testResults.some((r) => r.testType?.category === c)).map((c) => ({ value: c, label: categoryMeta(c).short }))]}
              />
            )}
          />
          <ul className="mt-4 flex flex-col divide-y divide-line-soft">
            {history.map((r) => {
              const { Icon } = categoryMeta(r.testType?.category);
              return (
                <li key={r._id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">
                      {r.testType?.title || 'Deleted test'}
                      {versionLabel(r.testType) && <span className="font-normal text-muted"> · {versionLabel(r.testType)}</span>}
                    </p>
                    <p className="text-[13px] text-muted">{formatResultDate(r.date)} · {formatDistance(r.distance)} in {formatTime(r.time)}</p>
                    {r.description && <p className="mt-1 text-[13px] text-muted">{r.description}</p>}
                  </div>
                  <span className="shrink-0 pt-0.5 text-[14px] font-semibold tabular-nums">{formatPace(r.distance, r.time, r.testType)}</span>
                </li>
              );
            })}
          </ul>
          <Link to="/test-results" className="mt-2 inline-block text-[14px] font-medium text-accent hover:underline">Edit results</Link>
        </Card>
      )}

      <AthleteFormDialog
        open={editOpen}
        athlete={athlete}
        onClose={() => setEditOpen(false)}
        onSaved={() => { toast.success('Athlete updated'); load(); }}
      />
      <EnrollDialog open={enrollOpen} onClose={() => setEnrollOpen(false)} athlete={athlete} schedules={available} onEnroll={enroll} />
    </div>
  );
};

export default AthleteProfile;
