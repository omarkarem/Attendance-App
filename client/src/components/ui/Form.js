import React, { forwardRef } from 'react';
import { PiCaretDown, PiCheckBold } from 'react-icons/pi';
import cx from '../../utils/cx';

// 16px on phones: iOS Safari zooms the page into any field smaller than that.
const FIELD_BASE =
  'w-full rounded-md border border-line bg-surface-2 text-[16px] sm:text-[15px] text-ink placeholder:text-muted ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-[#333] ' +
  'focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20 ' +
  'disabled:opacity-50 aria-[invalid=true]:border-danger';

// Label above, hint or error below (never placeholder-as-label).
export const Field = ({ label, htmlFor, hint, error, children, className, aside }) => (
  <div className={cx('flex min-w-0 flex-col gap-2', className)}>
    {(label || aside) && (
      <div className="flex items-center justify-between gap-2">
        {label && <label htmlFor={htmlFor} className="text-[13px] font-medium text-muted">{label}</label>}
        {aside}
      </div>
    )}
    {children}
    {error ? (
      <p className="text-[12px] text-danger" role="alert">{error}</p>
    ) : hint ? (
      <p className="text-[12px] text-muted">{hint}</p>
    ) : null}
  </div>
);

export const Input = forwardRef(({ className, icon: Icon, trailing, ...rest }, ref) => {
  if (!Icon && !trailing) {
    return <input ref={ref} className={cx(FIELD_BASE, 'h-11 px-3.5', className)} {...rest} />;
  }
  return (
    <div className="relative">
      {Icon && <Icon aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />}
      <input ref={ref} className={cx(FIELD_BASE, 'h-11', Icon ? 'pl-10' : 'pl-3.5', trailing ? 'pr-11' : 'pr-3.5', className)} {...rest} />
      {trailing && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div>}
    </div>
  );
});

export const Textarea = forwardRef(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={cx(FIELD_BASE, 'min-h-[88px] resize-y px-3.5 py-2.5 leading-snug', className)} {...rest} />
));

export const Select = forwardRef(({ className, children, size = 'md', ...rest }, ref) => (
  <div className={cx('relative min-w-0', className)}>
    <select
      ref={ref}
      className={cx(FIELD_BASE, 'appearance-none truncate pl-3.5 pr-9', size === 'sm' ? 'h-10 sm:h-9 sm:!text-[13px]' : 'h-11')}
      {...rest}
    >
      {children}
    </select>
    <PiCaretDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
  </div>
));

// Accessible on/off switch. White track when on, per the monochrome palette.
export const Switch = ({ checked, onChange, label, id, disabled }) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cx(
      'relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40',
      checked ? 'bg-ink' : 'bg-line'
    )}
  >
    <span
      className={cx(
        'inline-block h-5 w-5 rounded-full shadow transition-transform duration-200',
        checked ? 'translate-x-[21px] bg-canvas' : 'translate-x-[3px] bg-muted'
      )}
    />
  </button>
);

// Visual checkbox used inside clickable rows; the row owns the real input.
export const CheckMark = ({ checked, className }) => (
  <span
    aria-hidden="true"
    className={cx(
      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150',
      checked ? 'border-ink bg-ink text-canvas' : 'border-[#3a3a3a] bg-transparent',
      className
    )}
  >
    {checked && <PiCheckBold className="h-3 w-3" />}
  </span>
);

// A whole-row checkbox: large tap target, real input for keyboard and screen readers.
export const CheckRow = ({ checked, onChange, children, className }) => (
  <label
    className={cx(
      'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors duration-150',
      checked ? 'bg-surface-2' : 'hover:bg-surface-2/60',
      className
    )}
  >
    <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
    <CheckMark checked={checked} />
    <span className="min-w-0 flex-1">{children}</span>
  </label>
);

// hh : mm : ss entry. Value is { h, m, s } strings.
export const DurationInput = ({ value, onChange, idPrefix, disabled, invalid }) => {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value.replace(/[^0-9]/g, '').slice(0, key === 'h' ? 2 : 2) });
  const part = (key, label, max) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <input
        id={`${idPrefix}-${key}`}
        inputMode="numeric"
        aria-label={label}
        aria-invalid={invalid || (max && parseInt(value[key], 10) > max) || undefined}
        placeholder="00"
        disabled={disabled}
        value={value[key] === '0' ? '' : value[key]}
        onChange={set(key)}
        className={cx(FIELD_BASE, 'h-11 px-2 text-center font-mono tabular-nums')}
      />
      <span className="text-center text-[11px] text-muted">{label}</span>
    </div>
  );
  return (
    <div className="flex items-start gap-2">
      {part('h', 'hours')}
      <span className="pt-2.5 text-muted">:</span>
      {part('m', 'min', 59)}
      <span className="pt-2.5 text-muted">:</span>
      {part('s', 'sec', 59)}
    </div>
  );
};
