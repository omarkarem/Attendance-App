import React, { useEffect, useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PiPackage, PiArrowRight } from 'react-icons/pi';
import api from '../../utils/api';
import { Card, CardHeader, Spotlight, Stat, Skeleton, EmptyState } from '../ui/Display';
import Button from '../ui/Button';
import { AXIS, GRID, ChartFrame } from '../ui/Chart';
import { formatMoney, monthLabel } from '../../utils/money';
import cx from '../../utils/cx';

const CATEGORY_LABEL = { coach: 'Coach pay', facility: 'Facilities', other: 'Other costs' };

// One line of the "where the money goes" breakdown, with a bar sized against what was collected.
const FlowRow = ({ label, sub, amount, total, currency, tone }) => {
  const pct = total > 0 ? Math.max(0, Math.min(100, (Math.abs(amount) / total) * 100)) : 0;
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[14px]">
          {label}
          {sub && <span className="text-muted"> · {sub}</span>}
        </span>
        <span className={cx('shrink-0 text-[14px] font-semibold tabular-nums', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger')}>
          {formatMoney(amount, currency)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div
          className={cx('h-full rounded-full', tone === 'success' ? 'bg-success' : tone === 'danger' ? 'bg-danger' : tone === 'muted' ? 'bg-muted' : 'bg-ink')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
};

const TrendTooltip = ({ active, payload, currency }) => {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] shadow-float">
      <p className="mb-1 font-semibold">{monthLabel(r.month)}</p>
      <p>Revenue <span className="tabular-nums">{formatMoney(r.net, currency)}</span></p>
      <p className="text-muted">Costs <span className="tabular-nums">{formatMoney(r.costs, currency)}</span></p>
      <p className={r.profit < 0 ? 'text-danger' : 'text-success'}>Profit <span className="tabular-nums">{formatMoney(r.profit, currency)}</span></p>
      <p className="mt-1 text-muted">{r.paidCount} of {r.athletes} paid</p>
    </div>
  );
};

const Trend = ({ month, currency }) => {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    setRows(null);
    api.get('/finance/trend', { params: { end: month, months: 12 } })
      .then(({ data }) => live && setRows(data))
      .catch(() => live && setRows([]));
    return () => { live = false; };
  }, [month]);

  if (!rows) return <Skeleton className="h-56" />;
  if (rows.every((r) => !r.athletes && !r.costs)) {
    return <p className="py-10 text-center text-[14px] text-muted">Nothing recorded in the last 12 months yet.</p>;
  }
  const data = rows.map((r) => ({ ...r, label: monthLabel(r.month, 'MMM') }));
  return (
    <ChartFrame label="Revenue, costs and profit for the last 12 months">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
          <YAxis {...AXIS} width={56} tickFormatter={(v) => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(v)} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<TrendTooltip currency={currency} />} />
          <Bar dataKey="net" fill="#ffffff" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          <Bar dataKey="costs" fill="#3a3a3a" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          <Line dataKey="profit" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
};

const Legend = () => (
  <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted">
    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink" aria-hidden="true" />Revenue after shares</span>
    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#3a3a3a]" aria-hidden="true" />Costs</span>
    <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-success" aria-hidden="true" />Profit</span>
  </div>
);

const FinanceOverview = ({ data, month, onTab }) => {
  const { summary: s, currency, coaches, packages } = data;
  const money = (n) => formatMoney(n, currency);
  const coachName = (id) => coaches.find((c) => c.id === id)?.name || 'Former coach';

  if (packages.length === 0 && s.athletes === 0 && s.costs === 0) {
    return (
      <Card>
        <EmptyState
          icon={PiPackage}
          title="Start with your packages"
          body="Create the packages you sell (name, price, days a week, and what goes to the gym or pool). Then pick each athlete's package for the month and mark who has paid."
          action={<Button icon={PiArrowRight} onClick={() => onTab('packages')}>Create a package</Button>}
        />
      </Card>
    );
  }

  const collected = s.collected;

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <Spotlight tone="violet" className="p-6 md:p-8">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <div>
            <p className="text-[14px] font-medium text-white/75">Profit in {monthLabel(month, 'MMMM')}</p>
            <p className="mt-2 font-display text-[44px] font-medium leading-[0.95] tracking-[-0.05em] tabular-nums md:text-[60px]">{money(s.profit)}</p>
            <p className="mt-2 text-[14px] text-white/80">After money passed on and costs</p>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {[
              ['Collected', s.collected],
              ['Passed on', s.sharesPaid],
              ['Costs', s.costs]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-black/25 p-3 backdrop-blur">
                <dt className="text-[12px] text-white/70">{label}</dt>
                <dd className="mt-1 truncate text-[15px] font-semibold tabular-nums">{money(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Spotlight>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4"><Stat label="Revenue" value={money(s.net)} sub="Collected minus shares" /></Card>
        <Card className="p-4"><Stat label="Expected" value={money(s.expected)} sub={`${s.athletes} with a package`} /></Card>
        <Card className="p-4"><Stat label="Outstanding" value={money(s.outstanding)} tone={s.outstanding > 0 ? 'danger' : undefined} sub={`${s.unpaidCount} not paid yet`} /></Card>
        <Card className="p-4"><Stat label="Paid" value={`${s.paidCount}/${s.athletes}`} sub={s.athletes ? `${Math.round((s.paidCount / s.athletes) * 100)}% of athletes` : 'No packages set'} /></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4 md:p-6">
          <CardHeader title="Where the money goes" description={`Out of ${money(collected)} collected`} />
          {collected === 0 && s.costs === 0 ? (
            <p className="mt-6 text-[14px] text-muted">Nothing paid yet this month. Mark athletes paid on the Athletes tab.</p>
          ) : (
            <>
              <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.04em] text-muted">Passed on from packages</p>
              <ul className="divide-y divide-line-soft">
                {s.shares.length === 0 && <li className="py-2.5 text-[14px] text-muted">None. Packages keep their whole price.</li>}
                {s.shares.map((r) => <FlowRow key={r.label} label={r.label} amount={r.amount} total={collected} currency={currency} tone="muted" />)}
              </ul>
              <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.04em] text-muted">Costs</p>
              <ul className="divide-y divide-line-soft">
                {s.costItems.length === 0 && <li className="py-2.5 text-[14px] text-muted">No costs this month.</li>}
                {s.costItems.map((r) => <FlowRow key={r.label} label={r.label} amount={r.amount} total={collected} currency={currency} tone="muted" />)}
              </ul>
              <ul className="mt-2 border-t border-line">
                <FlowRow label="You keep" sub="profit" amount={s.profit} total={collected} currency={currency} tone={s.profit < 0 ? 'danger' : 'success'} />
              </ul>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-4 md:p-6">
            <CardHeader title="Costs by type" description={`${money(s.costs)} this month`} actions={<Button size="sm" variant="ghost" onClick={() => onTab('costs')}>Edit costs</Button>} />
            <ul className="mt-3 divide-y divide-line-soft">
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <li key={key} className="flex items-center justify-between py-2.5 text-[14px]">
                  <span>{label}</span>
                  <span className="font-semibold tabular-nums">{money(s.costsByCategory[key] || 0)}</span>
                </li>
              ))}
            </ul>
          </Card>

          {s.byPackage.length > 0 && (
            <Card className="p-4 md:p-6">
              <CardHeader title="By package" />
              <ul className="mt-3 divide-y divide-line-soft">
                {s.byPackage.map((p) => (
                  <li key={p.package || p.name} className="flex items-center gap-3 py-2.5 text-[14px]">
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="shrink-0 text-muted">{p.paid}/{p.athletes} paid</span>
                    <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{money(p.collected)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {coaches.length > 1 && s.byCoach.length > 0 && (
        <Card className="p-4 md:p-6">
          <CardHeader title="By coach" description="Packages of each coach's athletes" />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th className="py-2 font-medium">Coach</th>
                  <th className="py-2 text-right font-medium">Athletes</th>
                  <th className="py-2 text-right font-medium">Collected</th>
                  <th className="py-2 text-right font-medium">After shares</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {s.byCoach.map((c) => (
                  <tr key={c.coach || 'none'}>
                    <td className="py-2.5">{coachName(c.coach)}</td>
                    <td className="py-2.5 text-right tabular-nums">{c.athletes}</td>
                    <td className="py-2.5 text-right tabular-nums">{money(c.collected)}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{money(c.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-4 md:p-6">
        <CardHeader title="Last 12 months" description={`Up to ${monthLabel(month)}`} />
        <div className="mt-4"><Trend month={month} currency={currency} /></div>
        <Legend />
      </Card>
    </div>
  );
};

export default FinanceOverview;
