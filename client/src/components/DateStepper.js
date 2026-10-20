import React, { useRef } from 'react';
import { PiCaretLeft, PiCaretRight, PiCalendarBlank } from 'react-icons/pi';
import { IconButton } from './ui/Button';
import cx from '../utils/cx';

/**
 * Prev / label / next stepper. When `pickerValue` is given, tapping the label opens the
 * native date picker so coaches can jump straight to any day.
 */
const DateStepper = ({ title, subtitle, onPrev, onNext, onJump, pickerValue, trailing, className }) => {
  const pickerRef = useRef(null);

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch { /* falls through to focus */ }
    }
    el.focus();
    el.click();
  };

  return (
    <div className={cx('flex items-center gap-2 rounded-pill bg-surface-1 p-1.5', className)}>
      <IconButton icon={PiCaretLeft} label="Previous" onClick={onPrev} />
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={pickerValue ? openPicker : undefined}
          className={cx('flex w-full flex-col items-center rounded-pill px-3 py-1 text-center', pickerValue && 'hover:bg-surface-2')}
          aria-label={pickerValue ? `${title}, ${subtitle}. Choose a date` : undefined}
          tabIndex={pickerValue ? 0 : -1}
        >
          <span className="flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {title}
            {pickerValue && <PiCalendarBlank className="h-3.5 w-3.5 text-muted" aria-hidden="true" />}
          </span>
          {subtitle && <span className="text-[12px] text-muted">{subtitle}</span>}
        </button>
        {pickerValue && (
          <input
            ref={pickerRef}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            value={pickerValue}
            onChange={(e) => e.target.value && onJump(e.target.value)}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          />
        )}
      </div>
      {trailing}
      <IconButton icon={PiCaretRight} label="Next" onClick={onNext} />
    </div>
  );
};

export default DateStepper;
