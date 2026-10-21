import React from 'react';
import cx from '../../utils/cx';

export const Card = ({ as: Tag = 'section', className, children, ...rest }) => (
  <Tag className={cx('rounded-xl bg-surface-1', className)} {...rest}>{children}</Tag>
);

export const CardHeader = ({ title, description, actions, className }) => (
  <div className={cx('flex flex-wrap items-start justify-between gap-3', className)}>
    <div className="min-w-0">
      <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

/**
 * Gradient atmosphere tile (DESIGN.md gradient-spotlight-card). Use at most one per screen.
 */
const SPOTLIGHTS = {
  violet: 'bg-spot-violet',
  magenta: 'bg-spot-magenta',
  orange: 'bg-spot-orange'
};

export const Spotlight = ({ tone = 'violet', className, children }) => (
  <section className={cx('relative isolate overflow-hidden rounded-xxl text-ink', SPOTLIGHTS[tone], className)}>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_100%_0%,rgba(255,255,255,0.22),transparent_60%)]" />
    {children}
  </section>
);

export const PageHeader = ({ title, description, actions, back, children }) => (
  <header className="mb-6 flex flex-col gap-4 md:mb-8">
    {back}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <h1 className="font-display text-[28px] font-medium leading-[1.05] tracking-[-0.045em] text-ink md:text-[36px]">{title}</h1>
        {description && <p className="mt-2 max-w-[60ch] text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {children}
  </header>
);

export const Stat = ({ label, value, sub, className, tone }) => (
  <div className={cx('min-w-0', className)}>
    <p className="text-[13px] font-medium text-muted">{label}</p>
    <p className={cx(
      'mt-1.5 font-display text-[30px] font-medium leading-none tracking-[-0.04em] tabular-nums md:text-[36px]',
      tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink'
    )}>
      {value}
    </p>
    {sub && <p className="mt-1.5 truncate text-[12px] text-muted">{sub}</p>}
  </div>
);

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

export const Avatar = ({ name, size = 'md', className, active }) => (
  <span
    aria-hidden="true"
    className={cx(
      'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-0.02em] transition-colors duration-150',
      size === 'sm' && 'h-8 w-8 text-[11px]',
      size === 'md' && 'h-10 w-10 text-[13px]',
      size === 'lg' && 'h-16 w-16 text-[20px]',
      active ? 'bg-ink text-canvas' : 'bg-surface-2 text-ink',
      className
    )}
  >
    {initials(name)}
  </span>
);

const BADGE_TONES = {
  neutral: 'bg-surface-2 text-muted',
  new: 'bg-ink text-canvas',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-accent/15 text-accent',
  onColor: 'bg-white/20 text-ink'
};

export const Badge = ({ tone = 'neutral', children, className, icon: Icon }) => (
  <span className={cx('inline-flex h-[22px] shrink-0 items-center gap-1 rounded-pill px-2 text-[11px] font-semibold leading-none', BADGE_TONES[tone], className)}>
    {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
    {children}
  </span>
);

export const Skeleton = ({ className }) => <div aria-hidden="true" className={cx('animate-pulse rounded-md bg-surface-2', className)} />;

export const EmptyState = ({ icon: Icon, title, body, action, className }) => (
  <div className={cx('flex flex-col items-center px-6 py-12 text-center', className)}>
    {Icon && (
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
    )}
    <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
    {body && <p className="mt-1.5 max-w-[42ch] text-[14px] text-muted">{body}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

// Week pills S M T W T F S; days = array of 0..6
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const WeekDots = ({ days = [], className }) => (
  <div className={cx('flex gap-1', className)} aria-label={`Repeats on ${days.slice().sort().map((d) => DAY_NAMES[d]).join(', ') || 'no days'}`}>
    {DAY_LETTERS.map((l, i) => (
      <span
        key={i}
        aria-hidden="true"
        className={cx(
          'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
          days.includes(i) ? 'bg-ink text-canvas' : 'bg-surface-2 text-muted'
        )}
      >
        {l}
      </span>
    ))}
  </div>
);

export { DAY_NAMES };
