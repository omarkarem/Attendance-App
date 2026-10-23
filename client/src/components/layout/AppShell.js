import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  PiHouseSimple, PiHouseSimpleFill,
  PiCalendarDots, PiCalendarDotsFill,
  PiUsersThree, PiUsersThreeFill,
  PiTable, PiTableFill,
  PiClockCountdown, PiClockCountdownFill,
  PiTimer, PiTimerFill,
  PiChartLineUp, PiChartLineUpFill,
  PiDownloadSimple, PiDownloadSimpleFill,
  PiSquaresFour, PiSquaresFourFill,
  PiSignOut, PiCheckBold, PiCaretRight
} from 'react-icons/pi';
import useAuth from '../../hooks/useAuth';
import { useStopwatches } from '../../context/StopwatchContext';
import cx from '../../utils/cx';
import { Avatar } from '../ui/Display';
import { IconButton } from '../ui/Button';
import Dialog from '../ui/Dialog';

// `match` lists path prefixes that should light the item up (detail pages included).
const NAV = [
  {
    group: 'Coaching',
    items: [
      { to: '/', label: 'Today', icon: PiHouseSimple, activeIcon: PiHouseSimpleFill, match: ['/'], exact: true },
      { to: '/sessions', label: 'Sessions', icon: PiCalendarDots, activeIcon: PiCalendarDotsFill, match: ['/sessions', '/checkin'] },
      { to: '/athletes', label: 'Athletes', icon: PiUsersThree, activeIcon: PiUsersThreeFill, match: ['/athletes', '/athlete/'] },
      { to: '/attendance', label: 'Attendance', icon: PiTable, activeIcon: PiTableFill, match: ['/attendance'] },
      { to: '/stopwatch', label: 'Stopwatch', icon: PiClockCountdown, activeIcon: PiClockCountdownFill, match: ['/stopwatch'] }
    ]
  },
  {
    group: 'Performance',
    items: [
      { to: '/tests', label: 'Record test', icon: PiTimer, activeIcon: PiTimerFill, match: ['/tests'] },
      { to: '/test-results', label: 'Results', icon: PiChartLineUp, activeIcon: PiChartLineUpFill, match: ['/test-results'] }
    ]
  },
  {
    group: 'Reports',
    items: [
      { to: '/export', label: 'Export', icon: PiDownloadSimple, activeIcon: PiDownloadSimpleFill, match: ['/export'] }
    ]
  }
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);
const byPath = (to) => ALL_ITEMS.find((i) => i.to === to);

const isActive = (item, pathname) =>
  item.exact ? pathname === '/' : item.match.some((m) => pathname === m || pathname.startsWith(m.endsWith('/') ? m : `${m}/`));

export const Wordmark = ({ className }) => (
  <span className={cx('inline-flex items-center gap-2', className)}>
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-canvas" aria-hidden="true">
      <PiCheckBold className="h-4 w-4" />
    </span>
    <span className="font-display text-[19px] font-medium tracking-[-0.05em] text-ink">AttendTrack</span>
  </span>
);

const Sidebar = ({ pathname, user, onLogout, running }) => (
  <aside className="fixed inset-y-0 left-0 z-chrome hidden w-[240px] flex-col border-r border-line-soft bg-canvas md:flex">
    <div className="flex h-16 items-center px-5">
      <NavLink to="/" aria-label="AttendTrack home"><Wordmark /></NavLink>
    </div>
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
      {NAV.map((group) => (
        <div key={group.group} className="mt-5 first:mt-2">
          <p className="px-3 pb-2 text-[12px] font-medium text-muted">{group.group}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item, pathname);
              const Icon = active ? item.activeIcon : item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors duration-150',
                      active ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface-1 hover:text-ink'
                    )}
                  >
                    <span className="relative">
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      <RunningDot item={item} running={running} className="-right-0.5 -top-0.5" />
                    </span>
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
    <div className="flex items-center gap-3 border-t border-line-soft p-4">
      <Avatar name={user?.name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">{user?.name || 'Coach'}</p>
        <p className="truncate text-[12px] text-muted">{user?.email}</p>
      </div>
      <IconButton icon={PiSignOut} label="Sign out" size="sm" onClick={onLogout} />
    </div>
  </aside>
);

const TABS = [
  byPath('/'),
  byPath('/sessions'),
  byPath('/athletes'),
  { ...byPath('/tests'), label: 'Tests', match: ['/tests', '/test-results'] },
  byPath('/stopwatch')
];
const MORE_ITEMS = [byPath('/attendance'), byPath('/test-results'), byPath('/export')];

// Green dot on the Stopwatch item while a stopwatch is running elsewhere in the app.
const RunningDot = ({ item, running, className }) => (item.to === '/stopwatch' && running ? (
  <span className={cx('absolute h-2 w-2 rounded-full bg-success ring-2 ring-canvas', className)} aria-label="Running" role="img" />
) : null);

const BottomTabs = ({ pathname, onMore, moreOpen, running }) => {
  const moreActive = moreOpen || MORE_ITEMS.some((i) => isActive(i, pathname) && !TABS.some((t) => isActive(t, pathname)));
  const tabClass = (active) => cx(
    'flex h-full flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150',
    active ? 'text-ink' : 'text-muted'
  );
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-chrome border-t border-line-soft bg-canvas/90 pb-safe backdrop-blur-xl md:hidden">
      <div className="flex h-16 items-stretch">
        {TABS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = active ? item.activeIcon : item.icon;
          return (
            <NavLink key={item.to} to={item.to} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
              <span className="relative">
                <Icon className="h-6 w-6" aria-hidden="true" />
                <RunningDot item={item} running={running} className="right-0 top-0" />
              </span>
              {item.label}
            </NavLink>
          );
        })}
        <button type="button" onClick={onMore} className={tabClass(moreActive)} aria-haspopup="dialog" aria-expanded={moreOpen}>
          {moreActive ? <PiSquaresFourFill className="h-6 w-6" aria-hidden="true" /> : <PiSquaresFour className="h-6 w-6" aria-hidden="true" />}
          More
        </button>
      </div>
    </nav>
  );
};

const MoreSheet = ({ open, onClose, user, onLogout, pathname }) => {
  const navigate = useNavigate();
  const go = (to) => { onClose(); navigate(to); };
  return (
    <Dialog open={open} onClose={onClose} title="More" size="sm">
      <div className="-mx-2 flex flex-col">
        {MORE_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => go(item.to)}
              className={cx('flex h-12 items-center gap-3 rounded-md px-3 text-left text-[15px] transition-colors', active ? 'bg-surface-2 text-ink' : 'text-ink hover:bg-surface-2')}
            >
              <item.icon className="h-5 w-5 text-muted" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              <PiCaretRight className="h-4 w-4 text-muted" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface-2 p-3">
        <Avatar name={user?.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{user?.name || 'Coach'}</p>
          <p className="truncate text-[12px] text-muted">{user?.email}</p>
        </div>
        <button type="button" onClick={() => { onClose(); onLogout(); }} className="inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-[13px] font-medium text-danger hover:bg-danger/10">
          <PiSignOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </Dialog>
  );
};

const TopBar = ({ onMenu, user }) => (
  <header className="sticky top-0 z-chrome flex h-14 items-center justify-between border-b border-line-soft bg-canvas/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden" style={{ height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
    <NavLink to="/" aria-label="AttendTrack home"><Wordmark /></NavLink>
    <button type="button" onClick={onMenu} aria-label="Account and more" className="rounded-full">
      <Avatar name={user?.name} size="sm" />
    </button>
  </header>
);

const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const running = useStopwatches().runningCount > 0;

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas">
        Skip to content
      </a>
      <Sidebar pathname={pathname} user={user} onLogout={logout} running={running} />
      <TopBar onMenu={() => setMoreOpen(true)} user={user} />
      <main id="main" className="md:pl-[240px]">
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pb-16 md:pt-10 lg:px-10">
          {children}
        </div>
      </main>
      <BottomTabs pathname={pathname} onMore={() => setMoreOpen(true)} moreOpen={moreOpen} running={running} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} user={user} onLogout={logout} pathname={pathname} />
    </div>
  );
};

export default AppShell;
