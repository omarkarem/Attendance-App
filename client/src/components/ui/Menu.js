import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PiDotsThreeBold } from 'react-icons/pi';
import cx from '../../utils/cx';
import { IconButton } from './Button';

const MENU_WIDTH = 220;

/**
 * Overflow menu for row actions. Rendered in a portal so cards with overflow
 * never clip it; flips above the trigger when there is no room below.
 * items: [{ label, icon, onSelect, tone: 'danger', hidden }]
 */
const Menu = ({ items, label = 'More actions', triggerVariant = 'ghost' }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const visible = items.filter((i) => !i.hidden);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const height = visible.length * 44 + 12;
    const below = window.innerHeight - r.bottom > height + 8;
    setPos({
      top: below ? r.bottom + 6 : r.top - height - 6,
      left: Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
    });
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const nodes = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
        const idx = nodes.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (idx + 1) % nodes.length : (idx - 1 + nodes.length) % nodes.length;
        nodes[next]?.focus();
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <>
      <IconButton
        ref={triggerRef}
        icon={PiDotsThreeBold}
        label={label}
        variant={triggerVariant}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      />
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="fixed z-popover animate-pop-in rounded-lg border border-line bg-surface-2 p-1.5 shadow-float"
          onClick={(e) => e.stopPropagation()}
        >
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); item.onSelect(); }}
              className={cx(
                'flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[14px] outline-none transition-colors',
                'focus-visible:bg-line hover:bg-line',
                item.tone === 'danger' ? 'text-danger' : 'text-ink'
              )}
            >
              {item.icon && <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

export default Menu;
