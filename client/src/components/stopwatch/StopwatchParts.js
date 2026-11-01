import React, { memo, useState } from 'react';
import cx from '../../utils/cx';
import { Field, Input } from '../ui/Form';
import Button from '../ui/Button';
import Dialog from '../ui/Dialog';
import {
  elapsedOf, currentLapOf, lapDurations, lapExtremes, formatStopwatch, hasTime, isRunning,
  TAG_COLORS, MAX_NAME_LENGTH
} from '../../utils/stopwatch';

// iPhone-style round controls: Lap/Reset on the left (grey), Start (green) / Stop (red) on the right.
// The thin outer ring with a gap, as on the iPhone, is a ring offset by the surface color.
const ROUND_TONES = {
  neutral: 'bg-surface-2 text-ink ring-surface-2 hover:bg-line',
  start: 'bg-success/20 text-success ring-success/20 hover:bg-success/30',
  stop: 'bg-danger/20 text-danger ring-danger/20 hover:bg-danger/30'
};

/** `size` lg sits on the canvas (single stopwatch), md on a card. */
export const RoundButton = ({ tone = 'neutral', size = 'md', className, children, ...rest }) => (
  <button
    type="button"
    className={cx(
      'inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium tracking-[-0.01em] ring-2',
      'transition-[background-color,transform] duration-150 active:scale-[0.95] disabled:pointer-events-none disabled:opacity-40',
      size === 'lg'
        ? 'h-[80px] w-[80px] text-[17px] ring-offset-[3px] ring-offset-canvas'
        : 'h-[60px] w-[60px] text-[14px] ring-offset-2 ring-offset-surface-1',
      ROUND_TONES[tone],
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

/** Lap / Reset and Start / Stop for one stopwatch. `middle` sits between them. */
export const StopwatchControls = ({ watch, actions, size = 'md', middle }) => {
  const running = isRunning(watch);
  const started = hasTime(watch);
  const name = watch.name;
  return (
    <div className="flex items-center justify-between gap-3">
      {running || !started ? (
        <RoundButton size={size} disabled={!running} onClick={() => actions.lap(watch.id)} aria-label={`Lap ${name}`}>
          Lap
        </RoundButton>
      ) : (
        <RoundButton size={size} onClick={() => actions.reset(watch.id)} aria-label={`Reset ${name}`}>
          Reset
        </RoundButton>
      )}
      <div className="min-w-0 flex-1">{middle}</div>
      {running ? (
        <RoundButton size={size} tone="stop" onClick={() => actions.stop(watch.id)} aria-label={`Stop ${name}`}>
          Stop
        </RoundButton>
      ) : (
        <RoundButton size={size} tone="start" onClick={() => actions.start(watch.id)} aria-label={`Start ${name}`}>
          Start
        </RoundButton>
      )}
    </div>
  );
};

export const TagDot = ({ color, className }) => (
  <span aria-hidden="true" className={cx('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ background: color }} />
);

/** The big readout. Steps down a size past an hour so h:mm:ss.cc still fits a phone. */
export const DigitalTime = ({ ms, className, longClassName }) => (
  <span
    className={cx('block whitespace-nowrap font-display font-light leading-none tracking-[-0.04em] tabular-nums text-ink', ms >= 3600000 ? longClassName : className)}
    role="timer"
    aria-live="off"
  >
    {formatStopwatch(ms)}
  </span>
);

const LapRow = ({ label, ms, tone }) => (
  <li className={cx(
    'flex h-11 items-center justify-between border-b border-line-soft text-[15px] tabular-nums last:border-b-0',
    tone === 'best' ? 'text-success' : tone === 'worst' ? 'text-danger' : 'text-ink'
  )}>
    <span>{label}</span>
    <span>{formatStopwatch(ms)}</span>
  </li>
);

// Completed laps never change while the clock runs, so they skip the per-frame render.
const CompletedLaps = memo(({ laps }) => {
  const durations = lapDurations({ laps });
  const { best, worst } = lapExtremes(durations);
  return durations
    .map((d, i) => <LapRow key={i} label={`Lap ${i + 1}`} ms={d} tone={i === best ? 'best' : i === worst ? 'worst' : null} />)
    .reverse();
});

/** Newest first, with the running lap on top. Fastest lap green, slowest red. */
export const LapList = ({ watch, now, className }) => {
  if (!hasTime(watch)) return null;
  return (
    <ol className={cx('flex flex-col', className)} aria-label={`Laps for ${watch.name}`}>
      <LapRow label={`Lap ${watch.laps.length + 1}`} ms={currentLapOf(watch, now)} />
      <CompletedLaps laps={watch.laps} />
    </ol>
  );
};

// Static dial markings, drawn once.
const C = 160;
const polar = (r, deg, cx0 = C, cy0 = C) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx0 + r * Math.cos(a), cy0 + r * Math.sin(a)];
};
const SUB = { x: C, y: 104, r: 34 };

const DialMarks = memo(() => {
  const ticks = [];
  for (let i = 0; i < 240; i += 1) {
    const major = i % 20 === 0;
    const second = i % 4 === 0;
    const [x1, y1] = polar(152, i * 1.5);
    const [x2, y2] = polar(major ? 138 : second ? 143 : 147, i * 1.5);
    ticks.push(
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major || second ? '#ffffff' : '#666666'} strokeWidth={major ? 2 : 1} strokeLinecap="round" />
    );
  }
  const numbers = [];
  for (let s = 5; s <= 60; s += 5) {
    const [x, y] = polar(122, s * 6);
    numbers.push(<text key={s} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="17" fill="#ffffff">{s}</text>);
  }
  const subTicks = [];
  for (let i = 0; i < 60; i += 1) {
    const [x1, y1] = polar(SUB.r, i * 6, SUB.x, SUB.y);
    const [x2, y2] = polar(SUB.r - (i % 10 === 0 ? 7 : i % 2 === 0 ? 4 : 2.5), i * 6, SUB.x, SUB.y);
    subTicks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 2 === 0 ? '#ffffff' : '#666666'} strokeWidth={i % 10 === 0 ? 1.5 : 1} strokeLinecap="round" />);
  }
  const subNumbers = [5, 10, 15, 20, 25, 30].map((m) => {
    const [x, y] = polar(SUB.r - 15, m * 12, SUB.x, SUB.y);
    return <text key={m} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#999999">{m}</text>;
  });
  return <g>{ticks}{numbers}{subTicks}{subNumbers}</g>;
});

const Hand = ({ deg, length, tail, color, width }) => (
  <line
    x1={C} y1={C + tail} x2={C} y2={C - length}
    stroke={color} strokeWidth={width} strokeLinecap="round"
    transform={`rotate(${deg} ${C} ${C})`}
  />
);

/** Analog face like the iPhone's: seconds dial, 30-minute sub-dial, blue lap hand. */
export const AnalogFace = ({ watch, now, className }) => {
  const elapsed = elapsedOf(watch, now);
  const lapMs = currentLapOf(watch, now);
  const secDeg = ((elapsed / 1000) % 60) * 6;
  const minDeg = ((elapsed / 60000) % 30) * 12;
  return (
    <svg viewBox="0 0 320 320" className={cx('h-auto w-full', className)} role="img" aria-label={`Elapsed ${formatStopwatch(elapsed)}`}>
      <DialMarks />
      <line
        x1={SUB.x} y1={SUB.y} x2={SUB.x} y2={SUB.y - SUB.r + 6}
        stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round"
        transform={`rotate(${minDeg} ${SUB.x} ${SUB.y})`}
      />
      <circle cx={SUB.x} cy={SUB.y} r="2.5" fill="#ff7a3d" />
      <text x={C} y={222} textAnchor="middle" fontSize="24" fill="#ffffff" className="font-display tabular-nums" style={{ fontWeight: 300 }}>
        {formatStopwatch(elapsed)}
      </text>
      {watch.laps.length > 0 && <Hand deg={((lapMs / 1000) % 60) * 6} length={150} tail={18} color="#0099ff" width={2} />}
      <Hand deg={secDeg} length={150} tail={18} color="#ff7a3d" width={2} />
      <circle cx={C} cy={C} r="5" fill="#ff7a3d" />
      <circle cx={C} cy={C} r="2" fill="#090909" />
    </svg>
  );
};

/** Name and color tag for one stopwatch. Render with key={watch id} so each opening starts fresh. */
export const EditStopwatchDialog = ({ watch, onClose, onSave }) => {
  const [name, setName] = useState(watch?.name || '');
  const [color, setColor] = useState(watch?.color || TAG_COLORS[0].value);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(watch.id, { name, color });
    onClose();
  };

  return (
    <Dialog
      open={!!watch}
      onClose={onClose}
      title="Name and tag"
      description="Name it after the lane, group or athlete so you know which is which."
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="stopwatch-edit" disabled={!name.trim()}>Save</Button>
        </>
      )}
    >
      <form id="stopwatch-edit" onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Name" htmlFor="stopwatch-name">
          <Input
            id="stopwatch-name"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lane 1, 1:30 pace, Sara..."
            autoComplete="off"
            data-autofocus
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-medium text-muted">Tag color</legend>
          <div role="radiogroup" aria-label="Tag color" className="flex flex-wrap gap-2.5">
            {TAG_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={color === c.value}
                aria-label={c.label}
                title={c.label}
                onClick={() => setColor(c.value)}
                className={cx(
                  'h-10 w-10 rounded-full transition-transform duration-150 active:scale-95',
                  color === c.value ? 'ring-2 ring-ink ring-offset-[3px] ring-offset-surface-1' : 'opacity-80 hover:opacity-100'
                )}
                style={{ background: c.value }}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
};
