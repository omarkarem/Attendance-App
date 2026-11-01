import {
  createStopwatch, start, stop, lap, reset, elapsedOf, currentLapOf, lapDurations, lapExtremes,
  formatStopwatch, nextName, nextColor, sanitize, TAG_COLORS
} from './stopwatch';

describe('stopwatch maths', () => {
  it('counts from wall-clock timestamps across stop and resume', () => {
    let w = createStopwatch('Lane 1', TAG_COLORS[0].value);
    w = start(w, 1000);
    expect(elapsedOf(w, 3500)).toBe(2500);
    w = stop(w, 4000);
    expect(elapsedOf(w, 99999)).toBe(3000);
    w = start(w, 10000);
    expect(elapsedOf(w, 11000)).toBe(4000);
  });

  it('keeps laps as splits and derives durations', () => {
    let w = start(createStopwatch('A', TAG_COLORS[0].value), 0);
    w = lap(w, 30000);
    w = lap(w, 62000);
    w = lap(w, 90500);
    expect(w.laps).toEqual([30000, 62000, 90500]);
    expect(lapDurations(w)).toEqual([30000, 32000, 28500]);
    expect(currentLapOf(w, 100000)).toBe(9500);
    expect(lapExtremes(lapDurations(w))).toEqual({ best: 2, worst: 1 });
  });

  it('ignores lap while stopped and clears everything on reset', () => {
    let w = stop(start(createStopwatch('A', TAG_COLORS[0].value), 0), 5000);
    expect(lap(w, 6000)).toBe(w);
    w = reset(w);
    expect(w).toMatchObject({ startedAt: null, accumulated: 0, laps: [] });
  });

  it('marks no best or worst lap until two different laps exist', () => {
    expect(lapExtremes([1000])).toEqual({ best: -1, worst: -1 });
    expect(lapExtremes([1000, 1000])).toEqual({ best: -1, worst: -1 });
  });

  it('formats like the iPhone', () => {
    expect(formatStopwatch(0)).toBe('00:00.00');
    expect(formatStopwatch(83456)).toBe('01:23.45');
    expect(formatStopwatch(3723450)).toBe('1:02:03.45');
  });

  it('names and colors new lanes without clashing', () => {
    const watches = [createStopwatch('Lane 1', TAG_COLORS[0].value), createStopwatch('Lane 3', TAG_COLORS[1].value)];
    expect(nextName(watches)).toBe('Lane 2');
    expect(nextColor(watches)).toBe(TAG_COLORS[2].value);
  });

  it('drops malformed stored data', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize({ watches: [] })).toBeNull();
    const s = sanitize({ watches: [{ id: 'x', name: '', color: 'red', startedAt: 'no', accumulated: -5, laps: [1, 'a', 2] }, { nope: 1 }] });
    expect(s.watches).toEqual([{ id: 'x', name: 'Stopwatch', color: TAG_COLORS[0].value, startedAt: null, accumulated: 0, laps: [1, 2] }]);
  });
});
