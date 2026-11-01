import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import cx from '../../utils/cx';

// DESIGN.md pricing-tab: selected = one surface step up, not a color fill.
// Items are 40px tall on phones (thumb-sized) and 36px from `sm` up. Icons only show
// from `sm` up so a full row of options fits a 375px screen.
const TRACK = 'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-pill bg-surface-1 p-1 no-scrollbar';
const ITEM = 'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 text-[13px] font-medium transition-colors duration-150 sm:h-9 sm:px-4';
const ON = 'bg-surface-2 text-ink shadow-edge';
const OFF = 'text-muted hover:text-ink';
const ICON = 'hidden h-4 w-4 sm:block';

// When options still do not fit, fade the clipped edge so it reads as scrollable,
// and keep the selected option in view.
const FADE_RIGHT = '[mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]';
const FADE_LEFT = '[mask-image:linear-gradient(to_left,black_calc(100%-32px),transparent)]';
const FADE_BOTH = '[mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]';

const useOverflowFade = (selectedKey) => {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setEdges({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', update); ro?.disconnect(); };
  }, []);

  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector('[aria-checked="true"], [aria-current="page"]');
    if (el && active && el.scrollWidth > el.clientWidth) {
      el.scrollTo({ left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
    }
  }, [selectedKey]);

  const fade = edges.left && edges.right ? FADE_BOTH : edges.right ? FADE_RIGHT : edges.left ? FADE_LEFT : '';
  return [ref, fade];
};

/** options: [{ value, label, count?, icon? }] */
export const Segmented = ({ options, value, onChange, label, className, stretch }) => {
  const [ref, fade] = useOverflowFade(value);
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={cx(TRACK, stretch && 'flex w-full', fade, className)}>
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
            {o.icon && <o.icon className={ICON} aria-hidden="true" />}
            {o.label}
            {o.count != null && <span className={cx('tabular-nums', active ? 'text-muted' : 'text-muted/80')}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
};

/** Same look, but each option is a route. links: [{ to, label, end? }] */
export const SegmentedLinks = ({ links, label, className }) => {
  const [ref, fade] = useOverflowFade(links.findIndex((l) => l.active));
  return (
    <nav ref={ref} aria-label={label} className={cx(TRACK, fade, className)}>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          // /tests and /tests?tab=types share a path, so `active` decides which one is current.
          aria-current={l.active === undefined ? undefined : (l.active ? 'page' : 'false')}
          className={({ isActive }) => cx(ITEM, (l.active ?? isActive) ? ON : OFF)}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
};
