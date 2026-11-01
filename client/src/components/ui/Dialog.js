import React, { useEffect, useRef, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { PiX } from 'react-icons/pi';
import cx from '../../utils/cx';
import { isTouchDevice } from '../../utils/device';
import { IconButton } from './Button';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const TEXT_ENTRY = 'input:not([type="checkbox"]):not([type="radio"]),textarea,select';

// Shared scroll lock so stacked dialogs (form + confirm) restore correctly. iOS Safari
// ignores overflow:hidden on body for touch scrolling, so the body is pinned in place
// and the scroll position restored on unlock.
let openCount = 0;
let savedScrollY = 0;
const lockScroll = () => {
  if (openCount++ > 0) return;
  savedScrollY = window.scrollY;
  Object.assign(document.body.style, { position: 'fixed', top: `-${savedScrollY}px`, left: '0', right: '0', overflow: 'hidden' });
};
const unlockScroll = () => {
  if (--openCount > 0) return;
  openCount = 0;
  Object.assign(document.body.style, { position: '', top: '', left: '', right: '', overflow: '' });
  window.scrollTo(0, savedScrollY);
};

/**
 * Height of the on-screen keyboard (iOS keeps the layout viewport full height and
 * overlays the keyboard, so fixed bottom sheets would sit underneath it).
 */
const useKeyboardInset = (active) => {
  const [inset, setInset] = useState({ bottom: 0, height: null });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return undefined;
    const update = () => {
      const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset({ bottom: bottom > 80 ? bottom : 0, height: vv.height });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);
  return inset;
};

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-xl' };

/**
 * Bottom sheet on phones, centered card from `sm` up.
 * Focus moves into the dialog on open, Tab is trapped, Escape closes, focus returns on close.
 * On touch devices a text field is never focused on open, so the keyboard does not
 * cover the sheet before the coach has read it.
 */
const Dialog = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();
  const keyboard = useKeyboardInset(open);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    lockScroll();

    const panel = panelRef.current;
    let first = panel?.querySelector('[data-autofocus]') || panel?.querySelector(FOCUSABLE);
    if (first && isTouchDevice() && first.matches(TEXT_ENTRY)) first = null;
    (first || panel)?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
      }
      if (e.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll(FOCUSABLE)];
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    // Keep a focused field visible above the keyboard.
    const onFocusIn = (e) => {
      if (isTouchDevice() && e.target.matches?.(TEXT_ENTRY)) setTimeout(() => e.target.scrollIntoView({ block: 'nearest' }), 300);
    };
    panel?.addEventListener('keydown', onKey);
    panel?.addEventListener('focusin', onFocusIn);
    return () => {
      panel?.removeEventListener('keydown', onKey);
      panel?.removeEventListener('focusin', onFocusIn);
      unlockScroll();
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-end justify-center overscroll-contain sm:items-center sm:p-6"
      style={keyboard.bottom ? { bottom: keyboard.bottom } : undefined}
    >
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface-1 shadow-float outline-none',
          'rounded-t-xl animate-sheet-up sm:animate-pop-in sm:rounded-xl',
          SIZES[size]
        )}
        style={keyboard.bottom && keyboard.height ? { maxHeight: keyboard.height - 12 } : undefined}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-4 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-[20px] font-medium leading-tight tracking-[-0.03em] text-ink">{title}</h2>
            {description && <p id={descId} className="mt-1.5 text-[14px] leading-snug text-muted">{description}</p>}
          </div>
          <IconButton icon={PiX} label="Close" size="sm" onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">{children}</div>
        {footer && (
          <div
            className={cx(
              'flex shrink-0 flex-col-reverse gap-2 border-t border-line-soft px-5 py-4 sm:flex-row sm:justify-end sm:px-6',
              // The home indicator only matters when the sheet touches the bottom edge.
              !keyboard.bottom && 'pb-[max(1rem,env(safe-area-inset-bottom))]'
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Dialog;
