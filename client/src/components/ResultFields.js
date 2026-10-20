import React from 'react';
import { format } from 'date-fns';
import { PiLightning, PiGauge, PiHeartbeat, PiBarbell, PiClockCounterClockwise } from 'react-icons/pi';
import { Field, Input, Select, Textarea } from './ui/Form';
import {
  CATEGORIES, formatDistance, formatTime, formatPace, resultDateInput, parseDuration,
  versionOn, lineageOf, describeTarget, formatResultDate
} from '../utils/performance';

const CYCLING_FIELDS = ['weight', 'avgPower', 'maxPower', 'avgCadence', 'maxCadence', 'avgHeartRate', 'maxHeartRate'];

export const emptyResultForm = (athleteId = '') => ({
  athleteId,
  testTypeId: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  distanceValue: '',
  distanceUnit: 'km',
  timeText: '',
  description: '',
  ...Object.fromEntries(CYCLING_FIELDS.map((k) => [k, '']))
});

/** Form values for editing a result. The test is shown as its current version (same lineage). */
export const formFromResult = (r, testTypes = []) => {
  const km = r.distance >= 1000;
  const lineage = lineageOf(r.testType);
  const current = testTypes.find((t) => lineageOf(t) === lineage);
  return {
    athleteId: r.athlete?._id || r.athlete || '',
    testTypeId: current?._id || r.testType?._id || r.testType || '',
    date: resultDateInput(r.date),
    distanceValue: String(km ? parseFloat((r.distance / 1000).toFixed(3)) : r.distance),
    distanceUnit: km ? 'km' : 'm',
    timeText: formatTime(r.time),
    description: r.description || '',
    ...Object.fromEntries(CYCLING_FIELDS.map((k) => [k, r[k] != null ? String(r[k]) : '']))
  };
};

/**
 * The values that will be saved. `testType` is a current type with its `versions`; the
 * version that applied on the form's date supplies fixed targets (the server does the same).
 * When recording, fixed targets come from that version; when editing, values stay editable.
 */
export const effectiveValues = (form, testType, lockTargets) => {
  const version = versionOn(testType, form.date);
  const fixedDistance = lockTargets && version?.measureType === 'Distance' && version.targetDistance;
  const fixedTime = lockTargets && version?.measureType === 'Time' && version.targetTime;
  const entered = parseFloat(String(form.distanceValue).replace(',', '.'));
  const distance = fixedDistance ? version.targetDistance : (Number.isFinite(entered) ? entered * (form.distanceUnit === 'km' ? 1000 : 1) : 0);
  const parsed = parseDuration(form.timeText);
  const time = fixedTime ? version.targetTime : (parsed || 0);
  return { distance, time, fixedDistance: !!fixedDistance, fixedTime: !!fixedTime, version, timeUnreadable: !fixedTime && form.timeText.trim() !== '' && parsed == null };
};

export const validateResult = (form, testType, lockTargets) => {
  const errors = {};
  if (!form.athleteId) errors.athleteId = 'Choose an athlete.';
  if (!form.testTypeId) errors.testTypeId = 'Choose a test.';
  if (!form.date) errors.date = 'Pick a date.';
  else if (form.date > format(new Date(), 'yyyy-MM-dd')) errors.date = 'Results cannot be in the future.';
  const { distance, time, timeUnreadable } = effectiveValues(form, testType, lockTargets);
  if (testType && !(distance > 0)) errors.distance = 'Enter a distance above zero.';
  if (timeUnreadable) errors.time = 'Type a time like 5:32, 1:02:05 or 532.';
  else if (testType && !(time > 0)) errors.time = 'Enter a time above zero.';
  return errors;
};

export const buildPayload = (form, testType, lockTargets) => {
  const { distance, time } = effectiveValues(form, testType, lockTargets);
  const payload = {
    athleteId: form.athleteId,
    testTypeId: form.testTypeId,
    date: form.date,
    distance,
    time,
    description: form.description.trim()
  };
  if (testType?.category === 'Cycling') {
    CYCLING_FIELDS.forEach((k) => { payload[k] = form[k] === '' ? null : parseFloat(form[k]); });
  }
  return payload;
};

const NumberField = ({ id, label, value, onChange, step = '1', placeholder }) => (
  <Field label={label} htmlFor={id}>
    <Input id={id} type="number" inputMode="decimal" min="0" step={step} value={value} onChange={onChange} placeholder={placeholder} className="tabular-nums" />
  </Field>
);

const CyclingFields = ({ form, set }) => (
  <fieldset className="flex flex-col gap-4 rounded-lg bg-surface-2/60 p-4">
    <legend className="sr-only">Cycling data</legend>
    <p className="text-[14px] font-semibold">Cycling data <span className="font-normal text-muted">(optional)</span></p>
    <div className="grid grid-cols-2 gap-3">
      <NumberField id="cy-weight" label="Weight (kg)" value={form.weight} onChange={set('weight')} step="0.1" placeholder="72.5" />
      <div className="flex items-end pb-2.5 text-[12px] text-muted"><PiBarbell className="mr-1.5 h-4 w-4" aria-hidden="true" />Used for W/kg</div>
      <NumberField id="cy-avg-power" label="Avg power (W), FTP" value={form.avgPower} onChange={set('avgPower')} />
      <NumberField id="cy-max-power" label="Max power (W)" value={form.maxPower} onChange={set('maxPower')} />
      <NumberField id="cy-avg-cad" label="Avg cadence (rpm)" value={form.avgCadence} onChange={set('avgCadence')} />
      <NumberField id="cy-max-cad" label="Max cadence (rpm)" value={form.maxCadence} onChange={set('maxCadence')} />
      <NumberField id="cy-avg-hr" label="Avg heart rate (bpm)" value={form.avgHeartRate} onChange={set('avgHeartRate')} />
      <NumberField id="cy-max-hr" label="Max heart rate (bpm)" value={form.maxHeartRate} onChange={set('maxHeartRate')} />
    </div>
  </fieldset>
);

/** Shown when the chosen date falls under an older definition of the test. */
export const VersionNotice = ({ version, className }) => {
  if (!version || version.isCurrent !== false) return null;
  return (
    <p className={`flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-[13px] text-ink ${className || ''}`}>
      <PiClockCounterClockwise className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      <span>
        On this date the test was version {version.version} ({describeTarget(version)}), used until {formatResultDate(version.validTo)}.
        The result is saved under that version so it is compared fairly.
      </span>
    </p>
  );
};

/** Live calculation shown next to (or under) the form. */
export const ResultPreview = ({ form, testType, lockTargets, className }) => {
  if (!testType) return null;
  const { distance, time, version } = effectiveValues(form, testType, lockTargets);
  const pace = distance > 0 && time > 0 ? formatPace(distance, time, version) : '-';
  const wkg = testType.category === 'Cycling' && parseFloat(form.avgPower) > 0 && parseFloat(form.weight) > 0
    ? (parseFloat(form.avgPower) / parseFloat(form.weight)).toFixed(2)
    : null;
  return (
    <div className={className}>
      <p className="text-[13px] font-medium text-muted">{testType.category === 'Cycling' ? 'Average speed' : testType.category === 'Other' ? 'Result' : 'Pace'}</p>
      <p className="mt-1 font-display text-[34px] font-medium leading-none tracking-[-0.04em] tabular-nums">{pace}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
        <div><dt className="text-muted">Distance</dt><dd className="font-medium tabular-nums">{distance > 0 ? formatDistance(distance) : '-'}</dd></div>
        <div><dt className="text-muted">Time</dt><dd className="font-medium tabular-nums">{time > 0 ? formatTime(time) : '-'}</dd></div>
        {wkg && <div><dt className="flex items-center gap-1 text-muted"><PiLightning className="h-3.5 w-3.5" aria-hidden="true" />W/kg</dt><dd className="font-medium tabular-nums">{wkg}</dd></div>}
        {testType.category === 'Cycling' && form.avgCadence && <div><dt className="flex items-center gap-1 text-muted"><PiGauge className="h-3.5 w-3.5" aria-hidden="true" />Cadence</dt><dd className="font-medium tabular-nums">{form.avgCadence} rpm</dd></div>}
        {testType.category === 'Cycling' && form.avgHeartRate && <div><dt className="flex items-center gap-1 text-muted"><PiHeartbeat className="h-3.5 w-3.5" aria-hidden="true" />Heart rate</dt><dd className="font-medium tabular-nums">{form.avgHeartRate} bpm</dd></div>}
      </dl>
    </div>
  );
};

/** Test picker grouped by sport. */
export const TestSelect = ({ id, value, onChange, testTypes, invalid }) => (
  <Select id={id} value={value} onChange={onChange} aria-invalid={invalid}>
    <option value="">Choose test</option>
    {CATEGORIES.map((cat) => {
      const items = testTypes.filter((t) => t.category === cat);
      if (!items.length) return null;
      return (
        <optgroup key={cat} label={cat}>
          {items.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
        </optgroup>
      );
    })}
  </Select>
);

/**
 * Athlete, test, date, distance/time, notes and cycling fields.
 * `lockTargets`: true when recording, so fixed targets from the test type are not re-entered.
 */
const ResultFields = ({ form, setForm, errors = {}, athletes, testTypes, lockTargets, idPrefix = 'result' }) => {
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const testType = testTypes.find((t) => t._id === form.testTypeId);
  const { fixedDistance, fixedTime, version, time } = effectiveValues(form, testType, lockTargets);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Athlete" htmlFor={`${idPrefix}-athlete`} error={errors.athleteId}>
          <Select id={`${idPrefix}-athlete`} value={form.athleteId} onChange={set('athleteId')} aria-invalid={!!errors.athleteId}>
            <option value="">Choose athlete</option>
            {athletes.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="Test" htmlFor={`${idPrefix}-type`} error={errors.testTypeId}>
          <TestSelect id={`${idPrefix}-type`} value={form.testTypeId} onChange={set('testTypeId')} testTypes={testTypes} invalid={!!errors.testTypeId} />
        </Field>
      </div>

      <Field label="Date" htmlFor={`${idPrefix}-date`} error={errors.date}>
        <Input id={`${idPrefix}-date`} type="date" value={form.date} max={format(new Date(), 'yyyy-MM-dd')} onChange={set('date')} aria-invalid={!!errors.date} />
      </Field>
      <VersionNotice version={testType && version} className="-mt-2" />

      <div className="grid gap-5 sm:grid-cols-2">
        {fixedDistance ? (
          <Field label="Distance">
            <div className="flex h-11 items-center justify-between rounded-md bg-surface-2/60 px-3.5 text-[15px]">
              <span className="font-medium tabular-nums">{formatDistance(version.targetDistance)}</span>
              <span className="text-[12px] text-muted">Set by test</span>
            </div>
          </Field>
        ) : (
          <Field label="Distance" htmlFor={`${idPrefix}-distance`} error={errors.distance}>
            <div className="flex gap-2">
              <Input id={`${idPrefix}-distance`} type="number" inputMode="decimal" min="0" step="0.01" value={form.distanceValue} onChange={set('distanceValue')} placeholder="0" aria-invalid={!!errors.distance} className="tabular-nums" />
              <Select value={form.distanceUnit} onChange={set('distanceUnit')} aria-label="Distance unit" className="w-24 shrink-0">
                <option value="m">m</option>
                <option value="km">km</option>
              </Select>
            </div>
          </Field>
        )}
        {fixedTime ? (
          <Field label="Time">
            <div className="flex h-11 items-center justify-between rounded-md bg-surface-2/60 px-3.5 text-[15px]">
              <span className="font-medium tabular-nums">{formatTime(version.targetTime)}</span>
              <span className="text-[12px] text-muted">Set by test</span>
            </div>
          </Field>
        ) : (
          <Field
            label="Time"
            htmlFor={`${idPrefix}-time`}
            error={errors.time}
            hint={time > 0 ? `= ${formatTime(time)}` : 'Type 5:32, or just 532 on a phone keypad.'}
          >
            <Input id={`${idPrefix}-time`} inputMode="decimal" value={form.timeText} onChange={set('timeText')} placeholder="mm:ss" autoComplete="off" aria-invalid={!!errors.time} className="font-mono tabular-nums" />
          </Field>
        )}
      </div>

      {testType?.category === 'Cycling' && <CyclingFields form={form} set={set} />}

      <Field label="Notes" htmlFor={`${idPrefix}-notes`} hint="Optional. Conditions, how it felt, splits.">
        <Textarea id={`${idPrefix}-notes`} rows={2} value={form.description} onChange={set('description')} maxLength={300} />
      </Field>
    </div>
  );
};

export default ResultFields;
