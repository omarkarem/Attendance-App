import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { PiCalendarDots, PiArrowRight, PiUsersThree, PiPlus, PiWarningCircle, PiClock, PiLightning, PiUserPlus, PiTimer } from 'react-icons/pi';
import api from '../utils/api';
import SessionDialog from '../components/SessionDialog';
import AddAthletesDialog from '../components/AddAthletesDialog';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import { Card, CardHeader, PageHeader, Spotlight, Stat, Avatar, Badge, Skeleton, EmptyState } from '../components/ui/Display';
import Button from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { AXIS, GRID, ChartTooltip, ChartFrame } from '../components/ui/Chart';
import cx from '../utils/cx';
import { presentLabel } from '../utils/sessions';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const rateTone = (pct) => (pct >= 75 ? 'text-success' : pct < 50 ? 'text-danger' : 'text-ink');
const barTone = (pct) => (pct >= 75 ? 'bg-success' : pct < 50 ? 'bg-danger' : 'bg-ink');

const LIST_LIMIT = 8;

const QuickAction = ({ icon: Icon, label, sub, onClick, to }) => {
  const body = (
    <>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[14px] font-semibold">{label}</span>
        <span className="block truncate text-[12px] text-muted">{sub}</span>
      </span>
    </>
  );
  const className = 'flex min-h-[64px] items-center gap-3 rounded-lg bg-surface-1 px-3.5 py-3 transition-colors hover:bg-surface-2/70 active:scale-[0.99]';
  return to
    ? <Link to={to} className={className}>{body}</Link>
    : <button type="button" onClick={onClick} className={className}>{body}</button>;
};

const TodayCard = ({ sessions, onCheckIn, onStart }) => (
  <Spotlight tone="violet" className="p-6 md:p-8">
    <div className="grid gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-end">
      <div>
        <p className="text-[14px] font-medium text-white/75">Today</p>
        <p className="mt-2 font-display text-[56px] font-medium leading-[0.9] tracking-[-0.06em] tabular-nums md:text-[72px]">{sessions.length}</p>
        <p className="mt-2 text-[15px] text-white/80">{sessions.length === 1 ? 'session scheduled' : 'sessions scheduled'}</p>
      </div>
      {sessions.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const done = s.recordCount > 0;
            return (
              <li key={s._id} className="flex items-center gap-3 rounded-lg bg-black/25 p-3 pl-4 backdrop-blur">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/75">
                    {s.time && <><PiClock className="h-3.5 w-3.5" aria-hidden="true" />{s.time}<span aria-hidden="true">·</span></>}
                    {done ? presentLabel(s) : 'Not taken yet'}
                  </p>
                </div>
                <Button size="sm" variant={done ? 'translucent' : 'primary'} onClick={() => onCheckIn(s._id)}>
                  {done ? 'Review' : 'Check in'}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg bg-black/25 p-5 backdrop-blur">
          <p className="text-[15px] font-semibold">Nothing on the plan today</p>
          <p className="mt-1 text-[14px] text-white/75">Training anyway? Start a session and check athletes in straight away.</p>
          <Button size="sm" icon={PiPlus} onClick={onStart} className="mt-4">Start a session</Button>
        </div>
      )}
    </div>
  </Spotlight>
);

const DashboardSkeleton = () => (
  <div aria-hidden="true">
    <Skeleton className="mb-3 h-9 w-64" />
    <Skeleton className="mb-8 h-5 w-40" />
    <Skeleton className="mb-6 h-56 w-full rounded-xxl" />
    <Skeleton className="mb-6 h-28 w-full rounded-xl" />
    <Skeleton className="h-72 w-full rounded-xl" />
  </div>
);

const Dashboard = () => {
  usePageTitle('Today');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [sort, setSort] = useState('attention');
  const [showAll, setShowAll] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [startOpen, setStartOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      // Stats first: it also generates today's template sessions.
      const { data } = await api.get(`/attendance/stats?date=${today}`);
      const [{ data: sessions }, schedules] = await Promise.all([
        api.get(`/sessions?date=${today}`),
        api.get('/schedules').catch(() => ({ data: [] }))
      ]);
      setStats(data);
      setTodaySessions(sessions);
      setTemplates(schedules.data.filter((t) => t.active));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const athletes = useMemo(() => {
    const list = [...(stats?.athleteStats || [])];
    if (sort === 'attention') {
      // Athletes with sessions first, lowest rate first; no-session athletes last.
      list.sort((a, b) => (b.totalSessions > 0) - (a.totalSessions > 0) || a.percentage - b.percentage || a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [stats, sort]);

  const atRisk = athletes.filter((a) => a.totalSessions > 0 && a.percentage < 50).length;
  const firstName = (user?.name || 'Coach').split(' ')[0];

  if (status === 'loading' && !stats) return <DashboardSkeleton />;

  if (status === 'error' && !stats) {
    return (
      <Card>
        <EmptyState
          icon={PiWarningCircle}
          title="Could not load today"
          body="Check your connection and try again."
          action={<Button onClick={load}>Try again</Button>}
        />
      </Card>
    );
  }

  const trend = stats.month.dailyTrend;
  const hasTrend = trend.some((d) => d.present > 0);
  const visible = showAll ? athletes : athletes.slice(0, LIST_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={format(new Date(), 'EEEE, MMMM d')}
        actions={<Link to="/athletes" className="hidden md:block"><Button variant="secondary" icon={PiUsersThree}>Athletes</Button></Link>}
      />

      <div className="animate-rise">
        <TodayCard sessions={todaySessions} onCheckIn={(id) => navigate(`/checkin/${id}`)} onStart={() => setStartOpen(true)} />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <QuickAction icon={PiLightning} label="Start a session" sub="Create it and check in now" onClick={() => setStartOpen(true)} />
        <QuickAction icon={PiUserPlus} label="Add athletes" sub="Paste a list of names" onClick={() => setAddOpen(true)} />
        <QuickAction icon={PiTimer} label="Record a test" sub="Whole squad on one screen" to="/tests" />
      </div>

      <Card className="grid grid-cols-2 gap-x-6 gap-y-6 p-5 md:grid-cols-4 md:p-6">
        <Stat label="Active athletes" value={stats.totalAthletes} sub={stats.churn.inactiveAthletes ? `${stats.churn.inactiveAthletes} archived` : 'None archived'} />
        <Stat label="Present today" value={stats.today.present} sub={`${stats.today.sessions} ${stats.today.sessions === 1 ? 'session' : 'sessions'}`} />
        <Stat label="Sessions this month" value={stats.month.sessions} sub={format(new Date(), 'MMMM')} />
        <Stat label="Joined this month" value={stats.churn.joinedThisMonth} sub="New athletes" />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card className="p-5 md:p-6">
          <CardHeader title="Check-ins this month" description="Athletes marked present, per day" />
          {hasTrend ? (
            <div className="mt-5">
              <ChartFrame height="h-56" label="Daily present count for this month">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...GRID} />
                    <XAxis dataKey="day" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis {...AXIS} allowDecimals={false} width={48} />
                    <Tooltip
                      cursor={{ stroke: '#333', strokeWidth: 1 }}
                      content={<ChartTooltip render={(d) => (
                        <>
                          <p className="text-muted">{format(new Date(`${d.date}T12:00:00`), 'EEE, MMM d')}</p>
                          <p className="font-semibold">{d.present} present</p>
                        </>
                      )} />}
                    />
                    <Area isAnimationActive={false} type="monotone" dataKey="present" stroke="#ffffff" strokeWidth={2} fill="url(#trendFill)" activeDot={{ r: 4, fill: '#ffffff', stroke: '#090909', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
          ) : (
            <EmptyState icon={PiCalendarDots} title="No check-ins yet this month" body="Saved attendance shows up here day by day." className="py-10" />
          )}
        </Card>

        <Card className="flex flex-col p-5 md:p-6">
          <CardHeader
            title="Attendance this month"
            description={atRisk > 0 ? `${atRisk} ${atRisk === 1 ? 'athlete is' : 'athletes are'} below 50%` : 'Everyone with sessions is at 50% or above'}
            actions={(
              <Segmented
                label="Sort athletes"
                value={sort}
                onChange={setSort}
                options={[{ value: 'attention', label: 'Lowest first' }, { value: 'name', label: 'A to Z' }]}
              />
            )}
          />
          {athletes.length === 0 ? (
            <EmptyState
              icon={PiUsersThree}
              title="No athletes yet"
              body="Add your roster to start tracking attendance."
              action={<Link to="/athletes"><Button icon={PiPlus}>Add athletes</Button></Link>}
              className="py-10"
            />
          ) : (
            <>
              <ul className="mt-4 flex flex-col">
                {visible.map((a) => (
                  <li key={a.id}>
                    <Link to={`/athlete/${a.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-2">
                      <Avatar name={a.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-medium">{a.name}</span>
                          {a.isNewAthlete && <Badge tone="new">New</Badge>}
                        </div>
                        <p className="text-[12px] text-muted">
                          {a.totalSessions > 0 ? `${a.attended} of ${a.totalSessions} sessions` : 'No sessions this month'}
                        </p>
                      </div>
                      {a.totalSessions > 0 ? (
                        <div className="flex w-[92px] shrink-0 items-center gap-2.5">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                            <div className={cx('h-full rounded-full', barTone(a.percentage))} style={{ width: `${a.percentage}%` }} />
                          </div>
                          <span className={cx('w-9 text-right text-[14px] font-semibold tabular-nums', rateTone(a.percentage))}>{a.percentage}%</span>
                        </div>
                      ) : (
                        <span className="w-[92px] text-right text-[14px] text-muted">-</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              {athletes.length > LIST_LIMIT && (
                <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-3 inline-flex items-center gap-1.5 self-start text-[14px] font-medium text-accent hover:underline">
                  {showAll ? 'Show fewer' : `Show all ${athletes.length}`}
                  <PiArrowRight className={cx('h-4 w-4 transition-transform', showAll && '-rotate-90')} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </Card>
      </div>

      <SessionDialog
        open={startOpen}
        dayKey={today}
        templates={templates}
        onClose={() => setStartOpen(false)}
        onSaved={(data, created, { checkIn }) => {
          if (checkIn) navigate(`/checkin/${data._id}`, { state: { from: '/' } });
          else { toast.success('Session created'); load(); }
        }}
      />
      <AddAthletesDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={({ created, skipped }) => {
          const added = created.length === 1 ? `${created[0].name} added` : `${created.length} athletes added`;
          if (skipped.length) toast(`${created.length ? `${added}. ` : ''}Already on your roster: ${skipped.join(', ')}`, { duration: 5000 });
          else toast.success(added);
          load();
        }}
      />
    </div>
  );
};

export default Dashboard;
