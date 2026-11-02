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
  PiShieldCheck, PiShieldCheckFill,
  PiUsersFour, PiUsersFourFill,
  PiWallet, PiWalletFill,
  PiSignOut, PiCheckBold, PiCaretRight, PiCaretUpDown, PiEye, PiArrowUUpLeft, PiCheck
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

// Team: everyone sees Coaches (requests and the head coach's controls). Finance only
// shows to coaches with finance access. `badge` names the user field with the count.
const TEAM_ITEM = { to: '/team', label: 'Coaches', icon: PiUsersFour, activeIcon: PiUsersFourFill, match: ['/team'], badge: 'requestCount' };
const FINANCE_ITEM = { to: '/finance', label: 'Finance', icon: PiWallet, activeIcon: PiWalletFill, match: ['/finance'] };
const teamGroup = (financeAccess) => ({ group: 'Team', items: financeAccess ? [FINANCE_ITEM, TEAM_ITEM] : [TEAM_ITEM] });

// Only admins see this group. The badge shows the number of accounts waiting.
const ADMIN_ITEM = { to: '/admin/accounts', label: 'Accounts', icon: PiShieldCheck, activeIcon: PiShieldCheckFill, match: ['/admin'], badge: 'pendingCount' };
const ADMIN_GROUP = { group: 'Admin', items: [ADMIN_ITEM] };

const CountBadge = ({ count }) => (count > 0 ? (
  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-canvas" aria-label={`${count} waiting`}>
    {count}
  </span>
) : null);

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

// Which account the coaching pages show. Only rendered when the user can open another one.
const AccountButton = ({ user, actingAs, onClick, className }) => (
  <button
    type="button"
    onClick={onClick}
    aria-haspopup="dialog"
    className={cx('flex w-full items-center gap-3 rounded-md border border-line bg-surface-1 px-3 py-2 text-left transition-colors hover:bg-surface-2', className)}
  >
    <Avatar name={actingAs ? actingAs.name : user?.name} size="sm" active={!!actingAs} />
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-medium text-muted">Working in</span>
      <span className="block truncate text-[14px] font-medium text-ink">{actingAs ? actingAs.name : 'Your account'}</span>
    </span>
    <PiCaretUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
  </button>
);

const Sidebar = ({ pathname, user, groups, onLogout, running, actingAs, onSwitch }) => (
  <aside className="fixed inset-y-0 left-0 z-chrome hidden w-[240px] flex-col border-r border-line-soft bg-canvas md:flex">
    <div className="flex h-16 items-center px-5">
      <NavLink to="/" aria-label="AttendTrack home"><Wordmark /></NavLink>
    </div>
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
      {user?.workspaces?.length > 0 && (
        <AccountButton user={user} actingAs={actingAs} onClick={onSwitch} className="mt-2" />
      )}
      {groups.map((group) => (
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
                    {item.badge && <CountBadge count={user?.[item.badge]} />}
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
const BASE_MORE = [byPath('/attendance'), byPath('/test-results'), byPath('/export')];
const moreItemsFor = (isAdmin, financeAccess) => [
  ...BASE_MORE,
  ...(financeAccess ? [FINANCE_ITEM] : []),
  TEAM_ITEM,
  ...(isAdmin ? [ADMIN_ITEM] : [])
];

// Green dot on the Stopwatch item while a stopwatch is running elsewhere in the app.
const RunningDot = ({ item, running, className }) => (item.to === '/stopwatch' && running ? (
  <span className={cx('absolute h-2 w-2 rounded-full bg-success ring-2 ring-canvas', className)} aria-label="Running" role="img" />
) : null);

const BottomTabs = ({ pathname, onMore, moreOpen, running, moreItems, pending }) => {
  const moreActive = moreOpen || moreItems.some((i) => isActive(i, pathname) && !TABS.some((t) => isActive(t, pathname)));
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
          <span className="relative">
            {moreActive ? <PiSquaresFourFill className="h-6 w-6" aria-hidden="true" /> : <PiSquaresFour className="h-6 w-6" aria-hidden="true" />}
            {pending > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-canvas" aria-hidden="true" />}
          </span>
          More
          {pending > 0 && <span className="sr-only">, {pending} waiting for you</span>}
        </button>
      </div>
    </nav>
  );
};

const MoreSheet = ({ open, onClose, user, moreItems, onLogout, pathname, actingAs, onSwitch }) => {
  const navigate = useNavigate();
  const go = (to) => { onClose(); navigate(to); };
  return (
    <Dialog open={open} onClose={onClose} title="More" size="sm">
      {user?.workspaces?.length > 0 && (
        <AccountButton user={user} actingAs={actingAs} onClick={() => { onClose(); onSwitch(); }} className="mb-3" />
      )}
      <div className="-mx-2 flex flex-col">
        {moreItems.map((item) => {
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
              {item.badge && <CountBadge count={user?.[item.badge]} />}
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

const TopBar = ({ onMenu, user, actingAs }) => (
  <header className="sticky top-0 z-chrome flex h-14 items-center justify-between border-b border-line-soft bg-canvas/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden" style={{ height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
    <NavLink to="/" aria-label="AttendTrack home"><Wordmark /></NavLink>
    <button type="button" onClick={onMenu} aria-label="Account and more" className="rounded-full">
      <Avatar name={actingAs ? actingAs.name : user?.name} size="sm" active={!!actingAs} />
    </button>
  </header>
);

// Always visible while working in someone else's account, so nobody edits the wrong roster.
const ActingBanner = ({ actingAs, onBack }) => (
  <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-chrome border-b border-accent/30 bg-[#0b1a26]/95 backdrop-blur-xl md:top-0" role="status">
    <div className="mx-auto flex w-full max-w-[1120px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-10">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        {actingAs.access === 'view' ? <PiEye className="h-4 w-4" aria-hidden="true" /> : <PiUsersFour className="h-4 w-4" aria-hidden="true" />}
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-tight">
        <span className="text-muted">Working in </span>
        <span className="font-semibold text-ink">{actingAs.name}</span>
        <span className="text-muted">{actingAs.access === 'view' ? '’s account, view only' : '’s account'}</span>
      </p>
      <button type="button" onClick={onBack} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill bg-surface-2 px-3 text-[13px] font-medium text-ink hover:bg-line">
        <PiArrowUUpLeft className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Back to my account</span>
        <span className="sm:hidden">My account</span>
      </button>
    </div>
  </div>
);

// Pick the account the coaching pages show: yours, or a team coach's.
const SwitchDialog = ({ open, onClose, user, actingAs, onPick }) => (
  <Dialog open={open} onClose={onClose} title="Switch account" description="Today, Sessions, Athletes, Attendance, Tests and Export show the account you pick." size="sm">
    <div className="-mx-2 flex flex-col">
      {[{ id: user?.id, name: user?.name, self: true }, ...(user?.workspaces || [])].map((ws) => {
        const current = ws.self ? !actingAs : actingAs?.id === ws.id;
        return (
          <button
            key={ws.id}
            type="button"
            onClick={() => onPick(ws.self ? null : ws)}
            aria-current={current || undefined}
            className={cx('flex min-h-[56px] items-center gap-3 rounded-md px-3 py-2 text-left transition-colors', current ? 'bg-surface-2' : 'hover:bg-surface-2')}
          >
            <Avatar name={ws.name} size="sm" active={current} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{ws.self ? `${ws.name} (you)` : ws.name}</span>
              <span className="block truncate text-[12px] text-muted">
                {ws.self ? 'Your own athletes and sessions' : `${ws.relation === 'head' ? 'Your head coach' : 'Coaches under you'}${ws.access === 'view' ? ', view only' : ''}`}
              </span>
            </span>
            {current && <PiCheck className="h-5 w-5 text-ink" aria-label="Current" />}
          </button>
        );
      })}
    </div>
  </Dialog>
);

// Pages under these paths belong to one account, so switching leaves them for Today.
const ACCOUNT_DETAIL = ['/athlete/', '/checkin/'];

const AppShell = ({ children }) => {
  const { user, isAdmin, financeAccess, logout, actingAs, switchAccount } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const running = useStopwatches().runningCount > 0;

  const groups = [...NAV, teamGroup(financeAccess), ...(isAdmin ? [ADMIN_GROUP] : [])];
  const moreItems = moreItemsFor(isAdmin, financeAccess);
  const waiting = (isAdmin ? user?.pendingCount || 0 : 0) + (user?.requestCount || 0);

  const pick = (ws) => {
    setSwitchOpen(false);
    if ((ws?.id || null) === (actingAs?.id || null)) return;
    switchAccount(ws);
    if (ACCOUNT_DETAIL.some((p) => pathname.startsWith(p))) navigate('/');
  };

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas">
        Skip to content
      </a>
      <Sidebar pathname={pathname} user={user} groups={groups} onLogout={logout} running={running} actingAs={actingAs} onSwitch={() => setSwitchOpen(true)} />
      <TopBar onMenu={() => setMoreOpen(true)} user={user} actingAs={actingAs} />
      <main id="main" className="md:pl-[240px]">
        {actingAs && <ActingBanner actingAs={actingAs} onBack={() => pick(null)} />}
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pb-16 md:pt-10 lg:px-10">
          {children}
        </div>
      </main>
      <BottomTabs pathname={pathname} onMore={() => setMoreOpen(true)} moreOpen={moreOpen} running={running} moreItems={moreItems} pending={waiting} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} user={user} moreItems={moreItems} onLogout={logout} pathname={pathname} actingAs={actingAs} onSwitch={() => setSwitchOpen(true)} />
      <SwitchDialog open={switchOpen} onClose={() => setSwitchOpen(false)} user={user} actingAs={actingAs} onPick={pick} />
    </div>
  );
};

export default AppShell;
