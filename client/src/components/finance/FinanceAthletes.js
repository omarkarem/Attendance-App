import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PiMagnifyingGlass, PiCheckCircleFill, PiCircle, PiCopy, PiPackage, PiArrowRight, PiUsersThree, PiPlus, PiChecks } from 'react-icons/pi';
import api from '../../utils/api';
import { apiError } from '../../utils/browser';
import { Card, Avatar, Badge, EmptyState } from '../ui/Display';
import Button from '../ui/Button';
import Dialog from '../ui/Dialog';
import { Input, Select, CheckRow } from '../ui/Form';
import { Segmented } from '../ui/Segmented';
import { useConfirm } from '../ui/ConfirmProvider';
import { formatMoney, monthLabel, addMonths } from '../../utils/money';
import cx from '../../utils/cx';

const FILTERS = ['all', 'unpaid', 'paid', 'none'];

// An athlete counts as paid once every package they are on this month is paid.
const matches = (row, filter) => {
  const list = row.payments;
  if (filter === 'paid') return list.length > 0 && list.every((p) => p.paid);
  if (filter === 'unpaid') return list.some((p) => !p.paid);
  if (filter === 'none') return list.length === 0;
  return true;
};

const total = (list) => list.reduce((sum, p) => sum + p.price, 0);
const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const PaidButton = ({ paid, loading, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    aria-pressed={paid}
    aria-label={`${label}: ${paid ? 'paid, tap to mark not paid' : 'not paid, tap to mark paid'}`}
    className={cx(
      'inline-flex h-10 min-w-[108px] shrink-0 items-center justify-center gap-1.5 rounded-pill px-3.5 text-[13px] font-semibold transition-colors sm:h-9 disabled:opacity-40',
      paid ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-surface-2 text-muted hover:text-ink'
    )}
  >
    {paid ? <PiCheckCircleFill className="h-[18px] w-[18px]" aria-hidden="true" /> : <PiCircle className="h-[18px] w-[18px]" aria-hidden="true" />}
    {paid ? 'Paid' : 'Not paid'}
  </button>
);

// Tick every package the athlete is on this month.
const PackagePicker = ({ row, month, packages, currency, onClose, onSave }) => {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    if (row) setSelected(row.payments.map((p) => p.package));
  }, [row]);

  if (!row) return null;
  const current = new Set(row.payments.map((p) => p.package));
  // Archived packages stay listed for athletes already on them.
  const options = packages.filter((p) => p.active || current.has(p._id));
  const toggle = (id) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const chosen = options.filter((p) => selected.includes(p._id));

  const save = async () => {
    const removedPaid = row.payments.filter((p) => p.paid && !selected.includes(p.package));
    if (removedPaid.length) {
      const ok = await confirm({
        title: `Remove ${removedPaid.map((p) => p.packageName).join(' and ')}?`,
        body: `${row.name} is marked paid for ${removedPaid.length === 1 ? 'it' : 'them'} in ${monthLabel(month)}. Removing ${removedPaid.length === 1 ? 'it' : 'them'} also takes the payment out of this month's revenue.`,
        confirmLabel: 'Remove',
        tone: 'danger'
      });
      if (!ok) return;
    }
    setSaving(true);
    await onSave(row, selected);
    setSaving(false);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${row.name}'s packages`}
      description={`Everything ${row.name} is enrolled in for ${monthLabel(month)}. Each package is marked paid on its own.`}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save</Button>
        </>
      )}
    >
      <div className="-mx-2 flex flex-col gap-1">
        {options.map((p) => (
          <CheckRow key={p._id} checked={selected.includes(p._id)} onChange={() => toggle(p._id)}>
            <span className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium">{p.name}{p.active ? '' : ' (archived)'}</span>
                <span className="block text-[12px] text-muted">{p.daysPerWeek} {p.daysPerWeek === 1 ? 'day' : 'days'} a week</span>
              </span>
              <span className="shrink-0 text-[14px] font-semibold tabular-nums">{formatMoney(p.price, currency)}</span>
            </span>
          </CheckRow>
        ))}
      </div>
      <p className="mt-4 flex justify-between border-t border-line-soft pt-3 text-[14px]">
        <span className="text-muted">{chosen.length === 0 ? 'No package this month' : `${chosen.length} ${chosen.length === 1 ? 'package' : 'packages'}`}</span>
        <span className="font-semibold tabular-nums">{formatMoney(total(chosen), currency)}</span>
      </p>
    </Dialog>
  );
};

const FinanceAthletes = ({ data, month, reload, setData, onTab }) => {
  const { athletes, packages, coaches, currency, summary: s } = data;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [coach, setCoach] = useState('all');
  const [busy, setBusy] = useState(null); // payment id or athlete id being saved
  const [picking, setPicking] = useState(null);
  const [copying, setCopying] = useState(false);

  const query = search.trim().toLowerCase();
  const shown = useMemo(() => athletes.filter((a) => matches(a, filter)
    && (coach === 'all' || a.coach?.id === coach)
    && a.name.toLowerCase().includes(query)), [athletes, filter, coach, query]);

  const counts = FILTERS.reduce((acc, f) => ({ ...acc, [f]: athletes.filter((a) => matches(a, f)).length }), {});
  const activeIds = new Set(packages.filter((p) => p.active).map((p) => p._id));
  const copyable = athletes.filter((a) => a.payments.length === 0 && a.onTeam && a.previousPackages.some((id) => activeIds.has(id))).length;

  const setRow = (athleteId, payments) => setData((d) => ({
    ...d,
    athletes: d.athletes.map((a) => (a.athleteId === athleteId ? { ...a, payments } : a))
  }));

  // The row updates straight away; the summary is refreshed from the server.
  const savePackages = async (row, packageIds) => {
    setBusy(row.athleteId);
    try {
      const { data: res } = await api.put('/finance/payments', { athleteId: row.athleteId, month, packageIds });
      setRow(row.athleteId, res.payments);
      setPicking(null);
      reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not save the packages'));
    } finally {
      setBusy(null);
    }
  };

  const setPaid = async (row, list, paid) => {
    setBusy(list.length === 1 ? list[0]._id : row.athleteId);
    try {
      const updated = await Promise.all(list.map((p) => api.patch(`/finance/payments/${p._id}`, { paid }).then((r) => r.data.payment)));
      const byId = new Map(updated.map((p) => [p._id, p]));
      setRow(row.athleteId, row.payments.map((p) => byId.get(p._id) || p));
      reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not save'));
      reload();
    } finally {
      setBusy(null);
    }
  };

  const copyLast = async () => {
    setCopying(true);
    try {
      const { data: res } = await api.post('/finance/payments/copy', { month });
      toast.success(res.copied ? `${res.copied} athlete${res.copied === 1 ? '' : 's'} given last month's packages` : 'Nothing to copy');
      await reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not copy last month'));
    } finally {
      setCopying(false);
    }
  };

  if (packages.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={PiPackage}
          title="Create a package first"
          body="Each athlete is enrolled in one or more of your packages for the month. Create your packages, then come back to set them and mark who has paid."
          action={<Button icon={PiArrowRight} onClick={() => onTab('packages')}>Go to packages</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-rise">
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <p className="text-[14px]"><span className="font-semibold tabular-nums">{s.paidCount}</span><span className="text-muted"> of {s.athletes} paid in full</span></p>
        <p className="text-[14px]"><span className="text-muted">Collected </span><span className="font-semibold tabular-nums">{formatMoney(s.collected, currency)}</span></p>
        <p className="text-[14px]"><span className="text-muted">Outstanding </span><span className={cx('font-semibold tabular-nums', s.outstanding > 0 && 'text-danger')}>{formatMoney(s.outstanding, currency)}</span></p>
        {copyable > 0 && (
          <Button size="sm" variant="secondary" icon={PiCopy} loading={copying} onClick={copyLast} className="ml-auto">
            Use {monthLabel(addMonths(month, -1), 'MMMM')} packages ({copyable})
          </Button>
        )}
      </Card>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <Input icon={PiMagnifyingGlass} placeholder="Search athletes" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search athletes" />
        </div>
        {coaches.length > 1 && (
          <Select value={coach} onChange={(e) => setCoach(e.target.value)} aria-label="Coach" className="lg:w-52">
            <option value="all">All coaches</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        )}
        <Segmented
          label="Payment"
          value={filter}
          onChange={setFilter}
          className="self-start lg:self-auto"
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'unpaid', label: 'Not paid', count: counts.unpaid },
            { value: 'paid', label: 'Paid', count: counts.paid },
            { value: 'none', label: 'No package', count: counts.none }
          ]}
        />
      </div>

      {athletes.length === 0 ? (
        <Card><EmptyState icon={PiUsersThree} title="No athletes this month" body="Athletes on your team show up here once they have joined." /></Card>
      ) : shown.length === 0 ? (
        <Card><EmptyState icon={PiMagnifyingGlass} title="No matches" body="No athlete matches these filters." /></Card>
      ) : (
        <Card as="ul" className="divide-y divide-line-soft">
          {shown.map((a) => {
            const list = a.payments;
            const unpaid = list.filter((p) => !p.paid);
            const sum = total(list);
            const paidSum = total(list.filter((p) => p.paid));
            return (
              <li key={a.athleteId} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={a.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-medium">{a.name}</span>
                      {a.deleted ? <Badge>Deleted</Badge> : !a.onTeam ? <Badge>Left team</Badge> : !a.active && <Badge>Archived</Badge>}
                    </div>
                    <p className="truncate text-[13px] text-muted">
                      {coaches.length > 1 && a.coach ? `${a.coach.name} · ` : ''}
                      {list.length === 0
                        ? 'No package this month'
                        : list.length === 1
                          ? formatMoney(sum, currency)
                          : `${list.length} packages · ${formatMoney(sum, currency)}${paidSum > 0 && paidSum < sum ? ` · ${formatMoney(paidSum, currency)} paid` : ''}`}
                    </p>
                  </div>
                  {a.onTeam && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={list.length ? PiPackage : PiPlus}
                      onClick={() => setPicking(a)}
                      aria-label={`Choose packages for ${a.name}`}
                    >
                      {list.length ? 'Packages' : 'Add package'}
                    </Button>
                  )}
                </div>
                {list.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-2 sm:ml-[52px]">
                    {list.map((p) => (
                      <li key={p._id} className="flex items-center gap-3 rounded-lg bg-surface-2/60 py-1.5 pl-3 pr-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">{p.packageName}</p>
                          <p className="truncate text-[12px] text-muted">
                            {p.daysPerWeek ? `${p.daysPerWeek}/wk · ` : ''}{formatMoney(p.price, currency)}{p.paid && p.paidAt ? ` · paid ${shortDate(p.paidAt)}` : ''}
                          </p>
                        </div>
                        <PaidButton
                          label={`${a.name}, ${p.packageName}`}
                          paid={p.paid}
                          loading={busy === p._id || busy === a.athleteId}
                          onClick={() => setPaid(a, [p], !p.paid)}
                        />
                      </li>
                    ))}
                    {list.length > 1 && unpaid.length > 1 && (
                      <li>
                        <Button size="sm" variant="ghost" icon={PiChecks} loading={busy === a.athleteId} onClick={() => setPaid(a, unpaid, true)} className="-ml-2">
                          Mark all paid
                        </Button>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </Card>
      )}

      <PackagePicker
        row={picking}
        month={month}
        packages={packages}
        currency={currency}
        onClose={() => setPicking(null)}
        onSave={savePackages}
      />
    </div>
  );
};

export default FinanceAthletes;
