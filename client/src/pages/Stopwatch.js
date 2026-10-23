import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PiArrowLeft, PiArrowsOutSimple, PiPencilSimple, PiPlayFill, PiStopFill, PiPlus,
  PiArrowCounterClockwise, PiTrash, PiXCircle, PiCaretDown
} from 'react-icons/pi';
import usePageTitle from '../hooks/usePageTitle';
import useNow from '../hooks/useNow';
import { useStopwatches } from '../context/StopwatchContext';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { Card, CardHeader, PageHeader } from '../components/ui/Display';
import Button, { IconButton } from '../components/ui/Button';
import Menu from '../components/ui/Menu';
import {
  StopwatchControls, DigitalTime, LapList, AnalogFace, TagDot, EditStopwatchDialog
} from '../components/stopwatch/StopwatchParts';
import {
  elapsedOf, hasTime, isRunning, lapDurations, formatStopwatch, MAX_STOPWATCHES
} from '../utils/stopwatch';
import cx from '../utils/cx';

const FACE_KEY = 'attendtrack.stopwatch.face';
const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];

// Digital or analog, remembered on this device.
const useFace = () => {
  const [face, setFace] = useState(() => {
    try { return localStorage.getItem(FACE_KEY) === 'analog' ? 'analog' : 'digital'; } catch { return 'digital'; }
  });
  const change = (next) => {
    setFace(next);
    try { localStorage.setItem(FACE_KEY, next); } catch { /* not persisted */ }
  };
  return [face, change];
};

const Setup = ({ onOpen }) => {
  const [count, setCount] = useState(1);
  return (
    <>
      <PageHeader
        title="Stopwatch"
        description="Time one athlete or every lane at once. Stopwatches keep running through a refresh or a closed browser until you close them."
      />
      <Card className="max-w-[560px] p-5 md:p-6">
        <CardHeader
          title="How many stopwatches?"
          description="One for each lane or group. You can name them, tag them and add more later."
        />
        <div role="radiogroup" aria-label="Number of stopwatches" className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={count === n}
              onClick={() => setCount(n)}
              className={cx(
                'h-12 rounded-md text-[17px] font-medium tabular-nums transition-colors duration-150',
                count === n ? 'bg-ink text-canvas' : 'bg-surface-2 text-ink hover:bg-line'
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <Button className="mt-6 w-full sm:w-auto" icon={PiPlayFill} onClick={() => onOpen(count)}>
          {count === 1 ? 'Open stopwatch' : `Open ${count} stopwatches`}
        </Button>
      </Card>
    </>
  );
};

/** The name chip; tapping it opens the name and tag dialog. */
const NameChip = ({ watch, onEdit, className }) => (
  <button
    type="button"
    onClick={onEdit}
    className={cx('inline-flex min-w-0 items-center gap-2 rounded-pill bg-surface-1 py-2 pl-3 pr-3.5 text-[14px] font-medium transition-colors hover:bg-surface-2', className)}
    aria-label={`Name and tag: ${watch.name}`}
  >
    <TagDot color={watch.color} />
    <span className="truncate">{watch.name}</span>
    <PiPencilSimple className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
  </button>
);

const FaceDots = ({ face, onChange }) => (
  <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="Stopwatch face">
    {['digital', 'analog'].map((f) => (
      <button
        key={f}
        type="button"
        role="radio"
        aria-checked={face === f}
        aria-label={f === 'digital' ? 'Digital' : 'Analog'}
        onClick={() => onChange(f)}
        className="inline-flex h-8 w-6 items-center justify-center"
      >
        <span className={cx('h-2 w-2 rounded-full transition-colors', face === f ? 'bg-ink' : 'bg-line')} />
      </button>
    ))}
  </div>
);

const isTyping = (el) => !!el?.closest?.('input,textarea,select,button,a,[role="dialog"],[role="menu"],[contenteditable="true"]');

/** One stopwatch, full size, like the iPhone app. Space starts/stops and L laps/resets on a keyboard. */
const FocusView = ({ watch, now, multi, actions, onBack, onEdit, onAdd, onRemove, onClose }) => {
  const [face, setFace] = useFace();
  const watchRef = useRef(watch);
  watchRef.current = watch;

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      const w = watchRef.current;
      if (e.code === 'Space') {
        e.preventDefault();
        if (isRunning(w)) actions.stop(w.id); else actions.start(w.id);
      } else if (e.key === 'l' || e.key === 'L') {
        if (isRunning(w)) actions.lap(w.id); else if (hasTime(w)) actions.reset(w.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);

  const elapsed = elapsedOf(watch, now);
  const toggleFace = () => setFace(face === 'digital' ? 'analog' : 'digital');

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col">
      <div className="mb-2 flex items-center gap-2">
        {multi ? (
          <Button variant="ghost" size="sm" icon={PiArrowLeft} onClick={onBack} className="-ml-3">All stopwatches</Button>
        ) : (
          <h1 className="font-display text-[28px] font-medium leading-none tracking-[-0.045em] md:text-[36px]">Stopwatch</h1>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!multi && <Button variant="secondary" size="sm" icon={PiPlus} onClick={onAdd}>Add stopwatch</Button>}
          <Menu
            label={`More actions for ${watch.name}`}
            items={[
              { label: 'Name and tag', icon: PiPencilSimple, onSelect: onEdit },
              { label: 'Remove stopwatch', icon: PiTrash, onSelect: onRemove, hidden: !multi },
              { label: 'Close stopwatch', icon: PiXCircle, onSelect: onClose, tone: 'danger', hidden: multi }
            ]}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <NameChip watch={watch} onEdit={onEdit} className="max-w-full" />
      </div>

      <button
        type="button"
        onClick={toggleFace}
        aria-label={face === 'digital' ? 'Show analog face' : 'Show digital face'}
        className="my-2 flex h-[clamp(220px,44vh,380px)] w-full items-center justify-center rounded-xl"
      >
        {face === 'digital' ? (
          <DigitalTime ms={elapsed} className="text-[clamp(60px,18vw,112px)]" longClassName="text-[clamp(44px,13.5vw,88px)]" />
        ) : (
          <AnalogFace watch={watch} now={now} className="!h-full !w-auto max-w-full" />
        )}
      </button>

      <div className="px-1">
        <StopwatchControls watch={watch} actions={actions} size="lg" middle={<FaceDots face={face} onChange={setFace} />} />
      </div>

      <LapList watch={watch} now={now} className="mt-6 border-t border-line-soft" />
    </div>
  );
};

// Phones show laps on demand so several lanes fit on one screen.
const lapsOpenByDefault = () => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(min-width: 640px)').matches;

const StopwatchCard = ({ watch, now, actions, onFocus, onEdit, onRemove }) => {
  const [showLaps, setShowLaps] = useState(lapsOpenByDefault);
  const durations = lapDurations(watch);
  const last = durations[durations.length - 1];
  return (
    <Card className="relative flex flex-col overflow-hidden p-4 pl-5">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: watch.color }} />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="-ml-1.5 flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
          aria-label={`Name and tag: ${watch.name}`}
        >
          <TagDot color={watch.color} />
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{watch.name}</span>
        </button>
        <div className="ml-auto flex shrink-0 items-center">
          <IconButton icon={PiArrowsOutSimple} label={`Open ${watch.name} full screen`} size="sm" onClick={onFocus} />
          <Menu
            label={`More actions for ${watch.name}`}
            items={[
              { label: 'Name and tag', icon: PiPencilSimple, onSelect: onEdit },
              { label: 'Full screen', icon: PiArrowsOutSimple, onSelect: onFocus },
              { label: 'Remove', icon: PiTrash, onSelect: onRemove, tone: 'danger' }
            ]}
          />
        </div>
      </div>

      <DigitalTime ms={elapsedOf(watch, now)} className="mb-4 mt-2 text-[52px]" longClassName="mb-4 mt-2 text-[40px]" />

      <StopwatchControls
        watch={watch}
        actions={actions}
        middle={last != null && (
          <p className="text-center text-[13px] leading-tight text-muted tabular-nums">
            Last lap<br /><span className="text-[15px] text-ink">{formatStopwatch(last)}</span>
          </p>
        )}
      />

      {watch.laps.length > 0 && (
        <button
          type="button"
          onClick={() => setShowLaps((v) => !v)}
          aria-expanded={showLaps}
          className="-mb-1 mt-3 inline-flex h-9 items-center gap-1 self-start rounded-pill px-1 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          {showLaps ? 'Hide laps' : `Show laps (${watch.laps.length})`}
          <PiCaretDown className={cx('h-3.5 w-3.5 transition-transform', showLaps && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
      {showLaps && watch.laps.length > 0 && (
        <LapList watch={watch} now={now} className="-mx-1 mt-3 max-h-[176px] overflow-y-auto border-t border-line-soft px-1" />
      )}
    </Card>
  );
};

const Stopwatch = () => {
  usePageTitle('Stopwatch');
  const sw = useStopwatches();
  const { watches, hasSession, runningCount } = sw;
  const now = useNow(runningCount > 0);
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [editingId, setEditingId] = useState(null);

  const focusId = params.get('focus');
  const multi = watches.length > 1;
  const focused = multi ? watches.find((w) => w.id === focusId) : watches[0];
  const editing = watches.find((w) => w.id === editingId) || null;

  const showAll = () => setParams({});
  const focus = (id) => setParams({ focus: id });

  const add = () => {
    if (watches.length >= MAX_STOPWATCHES) return;
    sw.add();
    // Adding from the single view leads to the overview, where the new one is visible.
    if (focusId) showAll();
  };

  const remove = async (w) => {
    if (hasTime(w)) {
      const ok = await confirm({
        title: `Remove ${w.name}?`,
        body: 'Its time and laps are cleared.',
        confirmLabel: 'Remove',
        tone: 'danger'
      });
      if (!ok) return;
    }
    if (focusId === w.id) showAll();
    sw.remove(w.id);
  };

  const resetAll = async () => {
    const ok = await confirm({
      title: 'Reset all stopwatches?',
      body: 'Every stopwatch stops at zero and its laps are cleared. Names and tags stay.',
      confirmLabel: 'Reset all',
      tone: 'danger'
    });
    if (ok) sw.resetAll();
  };

  const close = async () => {
    const anyTime = watches.some(hasTime);
    if (anyTime) {
      const ok = await confirm({
        title: multi ? 'Close stopwatches?' : 'Close stopwatch?',
        body: 'This clears every stopwatch with its time and laps. Note down anything you need first.',
        confirmLabel: multi ? 'Close stopwatches' : 'Close stopwatch',
        tone: 'danger'
      });
      if (!ok) return;
    }
    if (focusId) showAll();
    sw.close();
  };

  const editDialog = <EditStopwatchDialog key={editingId || 'closed'} watch={editing} onClose={() => setEditingId(null)} onSave={sw.edit} />;

  if (!hasSession) return <Setup onOpen={sw.open} />;

  if (focused) {
    return (
      <>
        <FocusView
          watch={focused}
          now={now}
          multi={multi}
          actions={sw}
          onBack={showAll}
          onEdit={() => setEditingId(focused.id)}
          onAdd={add}
          onRemove={() => remove(focused)}
          onClose={close}
        />
        {editDialog}
      </>
    );
  }

  const allRunning = runningCount === watches.length;
  return (
    <>
      <PageHeader
        title="Stopwatches"
        description={`${watches.length} stopwatches${runningCount ? `, ${runningCount} running` : ''}. They keep running through a refresh until you close them.`}
      />

      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mb-4 bg-canvas/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 md:top-0 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-2">
          <Button icon={PiPlayFill} onClick={sw.startAll} disabled={allRunning}>Start all</Button>
          <Button variant="secondary" icon={PiStopFill} onClick={sw.stopAll} disabled={!runningCount}>Stop all</Button>
          <div className="ml-auto flex items-center gap-1">
            <IconButton icon={PiPlus} label="Add stopwatch" variant="secondary" onClick={add} disabled={watches.length >= MAX_STOPWATCHES} />
            <Menu
              label="More stopwatch actions"
              items={[
                { label: 'Reset all', icon: PiArrowCounterClockwise, onSelect: resetAll, hidden: !watches.some(hasTime) },
                { label: 'Close stopwatches', icon: PiXCircle, onSelect: close, tone: 'danger' }
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {watches.map((w) => (
          <StopwatchCard
            key={w.id}
            watch={w}
            now={now}
            actions={sw}
            onFocus={() => focus(w.id)}
            onEdit={() => setEditingId(w.id)}
            onRemove={() => remove(w)}
          />
        ))}
      </div>
      {editDialog}
    </>
  );
};

export default Stopwatch;
