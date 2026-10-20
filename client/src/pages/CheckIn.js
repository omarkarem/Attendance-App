import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { PiArrowLeft, PiMagnifyingGlass, PiCopySimple, PiCheckBold, PiChecks, PiEraser, PiWarningCircle, PiUsersThree } from 'react-icons/pi';
import api from '../utils/api';
import usePageTitle from '../hooks/usePageTitle';
import { apiError, copyText } from '../utils/browser';
import { Card, Avatar, Badge, Skeleton, EmptyState } from '../components/ui/Display';
import Button, { IconButton } from '../components/ui/Button';
import { Input } from '../components/ui/Form';
import { Segmented } from '../components/ui/Segmented';
import Menu from '../components/ui/Menu';
import { useConfirm } from '../components/ui/ConfirmProvider';
import cx from '../utils/cx';

const AthleteToggle = ({ athlete, present, expected, onToggle }) => (
  <button
    type="button"
    aria-pressed={present}
    onClick={onToggle}
    className={cx(
      'flex min-h-[64px] w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left transition-[background-color,transform] duration-150 active:scale-[0.99]',
      present ? 'bg-surface-2 shadow-edge' : 'bg-surface-1 hover:bg-surface-2/70'
    )}
  >
    <Avatar name={athlete.name} active={present} />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <span className={cx('truncate text-[15px] font-medium', !present && 'text-ink/80')}>{athlete.name}</span>
        {athlete.isNewAthlete && <Badge tone="new">New</Badge>}
      </span>
      {!expected && <span className="text-[12px] text-muted">Not on this session&apos;s list</span>}
    </span>
    <span
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill px-3 text-[13px] font-semibold transition-colors',
        present ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'
      )}
    >
      {present && <PiCheckBold className="h-3.5 w-3.5" aria-hidden="true" />}
      {present ? 'Present' : 'Absent'}
    </span>
  </button>
);

const CheckIn = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();

  const [session, setSession] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [present, setPresent] = useState({}); // athleteId -> boolean (what is shown)
  const [saved, setSaved] = useState({}); // last saved state, for the dirty check
  const [status, setStatus] = useState('loading');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('expected');
  const [taken, setTaken] = useState(false); // attendance has been saved at least once

  usePageTitle(session ? `Check in: ${session.name}` : 'Check in');

  const sessionKey = session ? new Date(session.date).toISOString().slice(0, 10) : null;
  const backTo = location.state?.from
    || (sessionKey && sessionKey !== format(new Date(), 'yyyy-MM-dd') ? `/sessions?date=${sessionKey}` : '/sessions');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [s, a, att] = await Promise.all([
        api.get(`/sessions/${sessionId}`),
        api.get('/athletes'),
        api.get(`/attendance/session/${sessionId}`)
      ]);
      const map = {};
      a.data.forEach((x) => { map[x._id] = false; });
      att.data.forEach((r) => { map[r.athlete?._id || r.athlete] = r.present; });
      setSession(s.data);
      setAthletes(a.data);
      setPresent(map);
      setSaved(map);
      setScope(s.data.assignedAthletes?.length ? 'expected' : 'all');
      setTaken(att.data.length > 0);
      setStatus('ready');
    } catch (err) {
      setStatus(err?.response?.status === 404 ? 'missing' : 'error');
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const assigned = useMemo(() => new Set((session?.assignedAthletes || []).map(String)), [session]);
  const hasRoster = assigned.size > 0;
  const isExpected = useCallback((id) => !hasRoster || assigned.has(id), [hasRoster, assigned]);

  const dirty = useMemo(() => athletes.some((a) => !!present[a._id] !== !!saved[a._id]), [athletes, present, saved]);

  // Warn before closing the tab with unsaved attendance.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const expectedAthletes = athletes.filter((a) => isExpected(a._id));
  const scoped = scope === 'expected' ? expectedAthletes : athletes;
  const visible = scoped.filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase()));

  const presentExpected = expectedAthletes.filter((a) => present[a._id]).length;
  const presentExtra = athletes.filter((a) => !isExpected(a._id) && present[a._id]).length;

  const toggle = (id) => setPresent((p) => ({ ...p, [id]: !p[id] }));
  const setAll = (value) => setPresent((p) => {
    const next = { ...p };
    visible.forEach((a) => { next[a._id] = value; });
    return next;
  });

  const save = async () => {
    setSaving(true);
    try {
      // Expected athletes get a record either way. Others only when present;
      // their absent records are cleared so they do not count against them.
      const records = [];
      const clearAthleteIds = [];
      athletes.forEach((a) => {
        if (isExpected(a._id) || present[a._id]) records.push({ athleteId: a._id, present: !!present[a._id] });
        else clearAthleteIds.push(a._id);
      });
      await api.post('/attendance/bulk', { sessionId, records, clearAthleteIds });
      setSaved(present);
      setTaken(true);
      toast.success(`Saved. ${presentExpected + presentExtra} present.`);
    } catch (err) {
      toast.error(apiError(err, 'Could not save attendance. Your changes are still here.'));
    } finally {
      setSaving(false);
    }
  };

  const leave = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Leave without saving?',
        body: 'The changes you made to this session will be lost.',
        confirmLabel: 'Discard changes',
        tone: 'danger'
      });
      if (!ok) return;
    }
    navigate(backTo);
  };

  const copyList = async () => {
    const names = athletes.filter((a) => present[a._id]).map((a) => a.name);
    if (names.length === 0) { toast.error('Nobody is marked present yet'); return; }
    const text = `${session.name} - ${format(new Date(session.date), 'MMM d, yyyy')}\n${names.map((n) => `- ${n}`).join('\n')}`;
    try {
      await copyText(text);
      toast.success(`Copied ${names.length} ${names.length === 1 ? 'name' : 'names'}`);
    } catch {
      toast.error('Could not copy the list');
    }
  };

  if (status === 'loading') {
    return (
      <div aria-hidden="true">
        <Skeleton className="mb-2 h-8 w-56" />
        <Skeleton className="mb-6 h-4 w-40" />
        <Skeleton className="mb-4 h-11 w-full" />
        <div className="grid gap-2 lg:grid-cols-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      </div>
    );
  }

  if (status !== 'ready') {
    return (
      <Card>
        <EmptyState
          icon={PiWarningCircle}
          title={status === 'missing' ? 'Session not found' : 'Could not load this session'}
          body={status === 'missing' ? 'It may have been deleted.' : 'Check your connection and try again.'}
          action={status === 'missing' ? <Button onClick={() => navigate('/sessions')}>Go to sessions</Button> : <Button onClick={load}>Try again</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="pb-24">
      <header className="mb-6 flex items-start gap-3">
        <IconButton icon={PiArrowLeft} label="Back to sessions" variant="secondary" onClick={leave} className="mt-1" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[26px] font-medium leading-tight tracking-[-0.045em] md:text-[32px]">{session.name}</h1>
          <p className="mt-0.5 text-[14px] text-muted">
            {format(new Date(session.date), 'EEEE, MMMM d')}
            {session.time && <> at {session.time}</>}
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Button variant="secondary" icon={PiCopySimple} onClick={copyList}>Copy present list</Button>
        </div>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input icon={PiMagnifyingGlass} placeholder="Search athletes" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search athletes" />
        </div>
        <div className="flex items-center gap-2">
          {hasRoster && (
            <Segmented
              label="Who to show"
              value={scope}
              onChange={setScope}
              options={[{ value: 'expected', label: 'Expected', count: expectedAthletes.length }, { value: 'all', label: 'Everyone', count: athletes.length }]}
            />
          )}
          <Menu
            label="Bulk actions"
            triggerVariant="secondary"
            items={[
              { label: search ? 'Mark shown present' : 'Mark all present', icon: PiChecks, onSelect: () => setAll(true) },
              { label: search ? 'Clear shown' : 'Clear all', icon: PiEraser, onSelect: () => setAll(false) },
              { label: 'Copy present list', icon: PiCopySimple, onSelect: copyList }
            ]}
          />
        </div>
      </div>

      {athletes.length === 0 ? (
        <Card>
          <EmptyState icon={PiUsersThree} title="No athletes yet" body="Add your roster first, then come back to take attendance." action={<Button onClick={() => navigate('/athletes')}>Add athletes</Button>} />
        </Card>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-muted">No athletes match &ldquo;{search}&rdquo;.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {visible.map((a) => (
            <li key={a._id}>
              <AthleteToggle athlete={a} present={!!present[a._id]} expected={isExpected(a._id)} onToggle={() => toggle(a._id)} />
            </li>
          ))}
        </ul>
      )}

      {/* Save bar: sits above the mobile tab bar, offset by the sidebar on desktop. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-chrome px-4 pb-3 md:bottom-0 md:left-[240px] md:pb-6">
        <div className="mx-auto flex max-w-[640px] items-center gap-3 rounded-pill border border-line bg-surface-2/95 p-1.5 pl-5 shadow-float backdrop-blur-xl">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-[15px] font-semibold tabular-nums">
              {presentExpected} of {expectedAthletes.length} present
              {presentExtra > 0 && <span className="font-normal text-muted"> +{presentExtra} extra</span>}
            </p>
            <p className={cx('text-[12px]', dirty || !taken ? 'text-ink' : 'text-muted')}>{dirty ? 'Unsaved changes' : taken ? 'All changes saved' : 'Not saved yet'}</p>
          </div>
          <Button onClick={save} loading={saving} disabled={!dirty && taken} size="lg">
            {saving ? 'Saving' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CheckIn;
