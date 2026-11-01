import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import cx from '../../utils/cx';

// DESIGN.md: every CTA is a pill. Primary = white pill, secondary = charcoal pill.
const VARIANTS = {
  primary: 'bg-ink text-canvas hover:bg-ink/90',
  secondary: 'bg-surface-2 text-ink hover:bg-line',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25',
  translucent: 'bg-white/15 text-ink hover:bg-white/25 backdrop-blur'
};

// Small buttons grow to 40px on phones so they stay easy to hit with a thumb.
const SIZES = {
  sm: 'h-10 sm:h-9 px-3.5 text-[13px] gap-1.5',
  md: 'h-11 px-[18px] text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2'
};

export const Spinner = ({ className }) => (
  <span
    aria-hidden="true"
    className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
  />
);

/** A pill button. With `to` it renders a router link styled as a button (never a button inside a link). */
const Button = forwardRef(({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  className,
  children,
  type = 'button',
  disabled,
  to,
  ...rest
}, ref) => {
  const classes = cx(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-pill font-medium tracking-[-0.01em]',
    'transition-[background-color,color,transform] duration-150 active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-40',
    VARIANTS[variant],
    SIZES[size],
    className
  );
  const content = (
    <>
      {loading ? <Spinner /> : Icon ? <Icon className="h-[18px] w-[18px]" aria-hidden="true" /> : null}
      {children}
    </>
  );
  if (to) return <Link ref={ref} to={to} className={classes} {...rest}>{content}</Link>;
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes} {...rest}>
      {content}
    </button>
  );
});

export const IconButton = forwardRef(({ icon: Icon, label, variant = 'ghost', size = 'md', className, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    title={label}
    className={cx(
      'inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 active:scale-[0.96]',
      'disabled:pointer-events-none disabled:opacity-40',
      size === 'sm' ? 'h-10 w-10 sm:h-9 sm:w-9' : 'h-10 w-10',
      VARIANTS[variant],
      className
    )}
    {...rest}
  >
    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
  </button>
));

export default Button;
