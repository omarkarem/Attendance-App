import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PiWarningCircle, PiChartPie, PiUsersThree, PiPackage, PiReceipt } from 'react-icons/pi';
import api from '../utils/api';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import { Card, PageHeader, Skeleton, EmptyState } from '../components/ui/Display';
import Button from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import DateStepper from '../components/DateStepper';
import FinanceOverview from '../components/finance/FinanceOverview';
import FinanceAthletes from '../components/finance/FinanceAthletes';
import FinancePackages from '../components/finance/FinancePackages';
import FinanceCosts from '../components/finance/FinanceCosts';
import { monthKey, isMonthKey, addMonths, monthLabel } from '../utils/money';

const TABS = [
  { value: 'overview', label: 'Overview', icon: PiChartPie },
  { value: 'athletes', label: 'Athletes', icon: PiUsersThree },
  { value: 'packages', label: 'Packages', icon: PiPackage },
  { value: 'costs', label: 'Costs', icon: PiReceipt }
];

const Finance = () => {
  usePageTitle('Finance');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const thisMonth = monthKey();
  const month = isMonthKey(params.get('month')) ? params.get('month') : thisMonth;
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'overview';

  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const latest = useRef(0);

  const setParam = (key, value, fallback) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  // Reloads quietly once the month is on screen, so edits do not flash skeletons.
  const load = useCallback(async () => {
    const id = ++latest.current;
    try {
      const { data: d } = await api.get('/finance/month', { params: { month } });
      if (id !== latest.current) return;
      setData(d);
      setStatus('ready');
    } catch {
      if (id === latest.current) setStatus('error');
    }
  }, [month]);

  useEffect(() => {
    setStatus((s) => (s === 'ready' ? 'switching' : 'loading'));
    load();
  }, [load]);

  const owner = data?.owner;
  const teamOf = owner && owner.id !== user?.id ? owner.name : null;

  return (
    <>
      <PageHeader
        title="Finance"
        description={teamOf
          ? `${teamOf}'s team: packages, payments, costs and revenue.`
          : 'Packages, who has paid, what goes to the gym or pool, your costs and what you keep.'}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented label="Finance section" value={tab} onChange={(v) => setParam('tab', v, 'overview')} options={TABS} />
          {tab !== 'packages' && (
            <DateStepper
              className="sm:max-w-[360px] lg:w-[300px]"
              title={monthLabel(month)}
              subtitle={month === thisMonth ? 'This month' : month < thisMonth ? 'Past month' : 'Upcoming'}
              trailing={month !== thisMonth && (
                <Button size="sm" variant="secondary" onClick={() => setParam('month', thisMonth, thisMonth)}>Now</Button>
              )}
              onPrev={() => setParam('month', addMonths(month, -1), thisMonth)}
              onNext={() => setParam('month', addMonths(month, 1), thisMonth)}
            />
          )}
        </div>
      </PageHeader>

      {status === 'loading' ? (
        <div className="flex flex-col gap-4" aria-hidden="true">
          <Skeleton className="h-44 rounded-xxl" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : status === 'error' ? (
        <Card><EmptyState icon={PiWarningCircle} title="Could not load finance" action={<Button onClick={() => { setStatus('loading'); load(); }}>Try again</Button>} /></Card>
      ) : (
        <div className={status === 'switching' ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}>
          {tab === 'overview' && <FinanceOverview data={data} month={month} onTab={(v) => setParam('tab', v, 'overview')} />}
          {tab === 'athletes' && <FinanceAthletes data={data} month={month} reload={load} setData={setData} onTab={(v) => setParam('tab', v, 'overview')} />}
          {tab === 'packages' && <FinancePackages data={data} reload={load} />}
          {tab === 'costs' && <FinanceCosts data={data} month={month} reload={load} />}
        </div>
      )}
    </>
  );
};

export default Finance;
