import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  PiArrowLeft, PiMagnifyingGlass, PiCopySimple, PiCheckBold, PiChecks, PiEraser, PiWarningCircle, PiUsersThree,
  PiUserPlus, PiCloudCheck, PiArrowClockwise
} from 'react-icons/pi';
import api from '../utils/api';
import usePageTitle from '../hooks/usePageTitle';
import { apiError, copyText } from '../utils/browser';
import { joinedBy, todayKey } from '../utils/athletes';
import { Card, Avatar, Badge, Skeleton, EmptyState } from '../components/ui/Display';
import Button, { IconButton, Spinner } from '../components/ui/Button';
import { Input } from '../components/ui/Form';
import { Segmented } from '../components/ui/Segmented';
import Menu from '../components/ui/Menu';
import { useConfirm } from '../components/ui/ConfirmProvider';
import cx from '../utils/cx';

// Taps are batched and saved shortly after the last one.
const SAVE_DELAY = 600;

// Comparable form of the shown state, to know whether anything is left to save.
const snapshotOf = (athletes, map) => JSON.stringify(athletes.map((a) => [a._id, !!map[a._id]]));

const AthleteToggle = ({ athlete, present, note, onToggle }) => (
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
      {note && <span className="text-[12px] text-muted">{note}</span>}
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
  const [status, setStatus] = useState('loading');
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saving | saved | error
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('expected');
  const [taken, setTaken] = useState(false); // attendance has been saved at least once
  const [adding, setAdding] = useState(false);

  // Refs so the debounced save always sends the latest state.
  const presentRef = useRef({});
  const athletesRef = useRef([]);
  const savedRef = useRef(snapshotOf([], {}));
  const timerRef = useRef(null);
  const inFlightRef = useRef(null);
  const isExpectedRef = useRef(() => true);

  usePageTitle(session ? `Check in: ${session.name}` : 'Check in');

  const sessionKey = session ? new Date(session.date).toISOString().slice(0, 10) : null;
  const backTo = location.state?.from
    || (sessionKey && sessionKey !== todayKey() ? `/sessions?date=${sessionKey}` : '/sessions');

  const assigned = useMemo(() => new Set((session?.assignedAthletes || []).map(String)), [session]);
  const hasRoster = assigned.size > 0;
  // Expected: on the roster (or there is no roster) and already joined by the session day.
  const isExpected = useCallback(
    (a) => (!hasRoster || assigned.has(a._id)) && joinedBy(a, sessionKey),
    [hasRoster, assigned, sessionKey]
  );
  isExpectedRef.current = isExpected;

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
      athletesRef.current = a.data;
      presentRef.current = map;
      savedRef.current = snapshotOf(a.data, map);
      setSession(s.data);
      setAthletes(a.data);
      setPresent(map);
      setTaken(att.data.length > 0);
      setSaveState(att.data.length > 0 ? 'saved' : 'idle');
      setStatus('ready');
    } catch (err) {
      setStatus(err?.response?.status === 404 ? 'missing' : 'error');
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  // Sends the full state. Calls are serialized; a call made while one is running
  // waits for it and then sends whatever is newest.
  // `force` records the session even when nothing changed (a session nobody came to).
  const saveNow = useCallback(async (force = false) => {
    clearTimeout(timerRef.current);
    if (inFlightRef.current) await inFlightRef.current.catch(() => {});
    const map = presentRef.current;
    const snap = snapshotOf(athletesRef.current, map);
    if (!force && snap === savedRef.current) { setSaveState((s) => (s === 'pending' ? 'saved' : s)); return; }

    const records = [];
    const clearAthleteIds = [];
    athletesRef.current.forEach((a) => {
      if (isExpectedRef.current(a) || map[a._id]) records.push({ athleteId: a._id, present: !!map[a._id] });
      else clearAthleteIds.push(a._id);
    });

    setSaveState('saving');
    const request = api.post('/attendance/bulk', { sessionId, records, clearAthleteIds });
    inFlightRef.current = request;
    try {
      await request;
      savedRef.current = snap;
      setTaken(true);
      setSaveState(snapshotOf(athletesRef.current, presentRef.current) === snap ? 'saved' : 'pending');
    } catch (err) {
      setSaveState('error');
      toast.error(apiError(err, 'Could not save attendance. Tap Retry.'));
      throw err;
    } finally {
      if (inFlightRef.current === request) inFlightRef.current = null;
    }
  }, [sessionId]);

  const scheduleSave = useCallback(() => {
    setSaveState('pending');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { saveNow().catch(() => {}); }, SAVE_DELAY);
  }, [saveNow]);

  const update = (fn) => {
    setPresent((p) => {
      const next = fn(p);
      presentRef.current = next;
      return next;
    });
    scheduleSave();
  };

  const unsaved = saveState === 'pending' || saveState === 'saving' || saveState === 'error';

  // Warn before closing the tab while a save is pending or failed.
  useEffect(() => {
    if (!unsaved) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsaved]);

  // Leaving the page (any link, not only Back) flushes a pending save instead of dropping it.
  const flushPending = useCallback(() => {
    if (snapshotOf(athletesRef.current, presentRef.current) !== savedRef.current) saveNow().catch(() => {});
  }, [saveNow]);
  useEffect(() => () => flushPending(), [flushPending]);

  const expectedAthletes = athletes.filter(isExpected);
  const showScope = expectedAthletes.length !== athletes.length;
  const query = search.trim().toLowerCase();
  // Searching always looks at everyone, so a walk-in already on the roster is found, not duplicated.
  const scoped = !query && showScope && scope === 'expected' ? expectedAthletes : athletes;
  const visible = scoped.filter((a) => a.name.toLowerCase().includes(query));
  const canAdd = query.length >= 2 && visible.length === 0;

  const presentExpected = expectedAthletes.filter((a) => present[a._id]).length;
  const presentExtra = athletes.filter((a) => !isExpected(a) && present[a._id]).length;

  const toggle = (id) => update((p) => ({ ...p, [id]: !p[id] }));
  const setAll = (value) => update((p) => {
    const next = { ...p };
    visible.forEach((a) => { next[a._id] = value; });
    return next;
  });

  const noteFor = (a) => {
    if (!joinedBy(a, sessionKey)) return 'Joined after this session';
    if (hasRoster && !assigned.has(a._id)) return 'Not on this session’s list';
    return null;
  };

  // A walk-in who is not on the roster yet: create them and mark them present.
  const addWalkIn = async () => {
    const name = search.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || adding) return;
    setAdding(true);
    try {
      // Joining on the session day (or today, if the session is in the future) counts this session.
      const joinDate = sessionKey && sessionKey < todayKey() ? sessionKey : todayKey();
      const { data } = await api.post('/athletes', { name, joinDate });
      const list = [...athletesRef.current, data].sort((x, y) => x.name.localeCompare(y.name));
      athletesRef.current = list;
      setAthletes(list);
      update((p) => ({ ...p, [data._id]: true }));
      setSearch('');
      toast.success(`${data.name} added and marked present`);
    } catch (err) {
      toast.error(apiError(err, 'Could not add the athlete'));
    } finally {
      setAdding(false);
    }
  };

  const leave = async () => {
    if (unsaved) {
      try {
        await saveNow();
      } catch {
        const ok = await confirm({
          title: 'Leave without saving?',
          body: 'The last changes could not be saved. They will be lost if you leave now.',
          confirmLabel: 'Leave anyway',
          tone: 'danger'
        });
        if (!ok) return;
      }
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

  const nobodyPresent = presentExpected + presentExtra === 0;
  const saveLabel = {
    idle: taken ? 'Saved' : 'Tap athletes to mark them present',
    pending: 'Saving…',
    saving: 'Saving…',
    saved: 'Saved automatically',
    error: 'Not saved'
  }[saveState];

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
          <Input
            icon={PiMagnifyingGlass}
            placeholder="Search, or type a new name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (visible.length === 1) { toggle(visible[0]._id); setSearch(''); } else if (canAdd) addWalkIn();
            }}
            aria-label="Search athletes"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showScope && (
            <Segmented
              label="Who to show"
              value={scope}
              onChange={setScope}
              options={[{ value: 'expected', label: 'Expected', count: expectedAthletes.length }, { value: 'all', label: 'Everyone', count: athletes.length }]}
            />
          )}
          {nobodyPresent && visible.length > 1 && (
            <Button variant="secondary" icon={PiChecks} onClick={() => setAll(true)}>{search ? 'Shown present' : 'All present'}</Button>
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

      {athletes.length === 0 && !query ? (
        <Card>
          <EmptyState icon={PiUsersThree} title="No athletes yet" body="Type a name in the search box to add someone and mark them present." />
        </Card>
      ) : (
        <>
          {visible.length > 0 && (
            <ul className="grid gap-2 lg:grid-cols-2">
              {visible.map((a) => (
                <li key={a._id}>
                  <AthleteToggle athlete={a} present={!!present[a._id]} note={noteFor(a)} onToggle={() => toggle(a._id)} />
                </li>
              ))}
            </ul>
          )}
          {canAdd && (
            <button
              type="button"
              onClick={addWalkIn}
              disabled={adding}
              className={cx('mt-2 flex min-h-[64px] w-full items-center gap-3 rounded-lg border border-dashed border-line px-3.5 py-2.5 text-left transition-colors hover:bg-surface-1 disabled:opacity-50')}
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
                {adding ? <Spinner /> : <PiUserPlus className="h-5 w-5" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">Add &ldquo;{search.trim()}&rdquo;</span>
                <span className="text-[12px] text-muted">New athlete, marked present for this session</span>
              </span>
            </button>
          )}
        </>
      )}

      {/* Status bar: sits above the mobile tab bar, offset by the sidebar on desktop. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-chrome px-4 pb-3 md:bottom-0 md:left-[240px] md:pb-6">
        <div className="mx-auto flex max-w-[640px] items-center gap-3 rounded-pill border border-line bg-surface-2/95 p-1.5 pl-5 shadow-float backdrop-blur-xl">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-[15px] font-semibold tabular-nums">
              {presentExpected} of {expectedAthletes.length} present
              {presentExtra > 0 && <span className="font-normal text-muted"> +{presentExtra} extra</span>}
            </p>
            <p className={cx('flex items-center gap-1 text-[12px]', saveState === 'error' ? 'text-danger' : 'text-muted')}>
              {saveState === 'saved' && <PiCloudCheck className="h-3.5 w-3.5" aria-hidden="true" />}
              {saveLabel}
            </p>
          </div>
          {saveState === 'error' ? (
            <Button onClick={() => saveNow().catch(() => {})} icon={PiArrowClockwise} size="lg">Retry</Button>
          ) : !taken && nobodyPresent ? (
            // A session where nobody came still needs to be recorded.
            <Button variant="secondary" onClick={() => saveNow(true).catch(() => {})} loading={saveState === 'saving'} size="lg">Nobody came</Button>
          ) : (
            <Button onClick={leave} loading={saveState === 'saving'} size="lg">Done</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckIn;
