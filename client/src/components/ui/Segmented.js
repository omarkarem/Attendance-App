import React from 'react';
import { NavLink } from 'react-router-dom';
import cx from '../../utils/cx';

// DESIGN.md pricing-tab: selected = one surface step up, not a color fill.
const TRACK = 'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-pill bg-surface-1 p-1 no-scrollbar';
const ITEM = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-4 text-[13px] font-medium transition-colors duration-150';
const ON = 'bg-surface-2 text-ink shadow-edge';
const OFF = 'text-muted hover:text-ink';

/** options: [{ value, label, count?, icon? }] */
export const Segmented = ({ options, value, onChange, label, className, stretch }) => (
  <div role="radiogroup" aria-label={label} className={cx(TRACK, stretch && 'flex w-full', className)}>
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(o.value)}
          className={cx(ITEM, active ? ON : OFF, stretch && 'flex-1')}
        >
          {o.icon && <o.icon className="h-4 w-4" aria-hidden="true" />}
          {o.label}
          {o.count != null && <span className={cx('tabular-nums', active ? 'text-muted' : 'text-muted/80')}>{o.count}</span>}
        </button>
      );
    })}
  </div>
);

/** Same look, but each option is a route. links: [{ to, label, end? }] */
export const SegmentedLinks = ({ links, label, className }) => (
  <nav aria-label={label} className={cx(TRACK, className)}>
    {links.map((l) => (
      <NavLink
        key={l.to}
        to={l.to}
        end={l.end}
        className={({ isActive }) => cx(ITEM, (l.active ?? isActive) ? ON : OFF)}
      >
        {l.label}
      </NavLink>
    ))}
  </nav>
);
