import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PiPlus, PiPackage, PiPencilSimple, PiArchive, PiArrowCounterClockwise, PiTrash, PiX, PiCurrencyCircleDollar } from 'react-icons/pi';
import api from '../../utils/api';
import { apiError } from '../../utils/browser';
import { Card, CardHeader, Badge, EmptyState } from '../ui/Display';
import Button, { IconButton } from '../ui/Button';
import Menu from '../ui/Menu';
import Dialog from '../ui/Dialog';
import { Field, Input, Select } from '../ui/Form';
import { useConfirm } from '../ui/ConfirmProvider';
import { formatMoney, sharesTotal } from '../../utils/money';
import cx from '../../utils/cx';

const EMPTY = { name: '', price: '', daysPerWeek: '3', shares: [] };

const toForm = (p) => (p ? {
  name: p.name,
  price: String(p.price),
  daysPerWeek: String(p.daysPerWeek),
  shares: p.shares.map((s) => ({ label: s.label, amount: String(s.amount) }))
} : EMPTY);

// Whole numbers or up to 2 decimals, typed freely.
const cleanNumber = (v) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

const PackageDialog = ({ open, pkg, currency, onClose, onSaved }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm(toForm(pkg)); setErrors({}); }
  }, [open, pkg]);

  const price = Number(form.price) || 0;
  const passOn = sharesTotal(form.shares);
  const keep = price - passOn;

  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: key === 'price' ? cleanNumber(e.target.value) : e.target.value })); setErrors({}); };
  const setShare = (i, key, value) => {
    setForm((f) => ({ ...f, shares: f.shares.map((s, j) => (j === i ? { ...s, [key]: key === 'amount' ? cleanNumber(value) : value } : s)) }));
    setErrors({});
  };
  const addShare = () => setForm((f) => ({ ...f, shares: [...f.shares, { label: '', amount: '' }] }));
  const removeShare = (i) => setForm((f) => ({ ...f, shares: f.shares.filter((_, j) => j !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Give the package a name.';
    if (form.price === '' || !Number.isFinite(price)) next.price = 'Enter the price.';
    const shares = form.shares.filter((s) => s.label.trim() || s.amount !== '');
    if (shares.some((s) => !s.label.trim())) next.shares = 'Every share needs a name, like Gym or Pool.';
    else if (shares.some((s) => s.amount === '')) next.shares = 'Enter an amount for every share.';
    else if (passOn > price) next.shares = 'Shares add up to more than the price.';
    if (Object.keys(next).length) { setErrors(next); return; }

    setSaving(true);
    try {
      const body = { name: form.name.trim(), price, daysPerWeek: Number(form.daysPerWeek), shares: shares.map((s) => ({ label: s.label.trim(), amount: Number(s.amount) })) };
      const { data } = pkg ? await api.put(`/finance/packages/${pkg._id}`, body) : await api.post('/finance/packages', body);
      toast.success(pkg
        ? (data.updatedPayments ? `Package saved. ${data.updatedPayments} unpaid athlete${data.updatedPayments === 1 ? '' : 's'} updated` : 'Package saved')
        : 'Package created');
      onSaved();
    } catch (err) {
      setErrors({ form: apiError(err, 'Could not save the package') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={pkg ? 'Edit package' : 'New package'}
      description={pkg ? 'Unpaid athletes from this month on get the new price. Paid months and earlier months keep what they had.' : 'What you sell, and how much of it goes to the gym, pool or anyone else.'}
      size="lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="package-form" loading={saving}>{pkg ? 'Save' : 'Create package'}</Button>
        </>
      )}
    >
      <form id="package-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Package name" htmlFor="pkg-name" error={errors.name}>
          <Input id="pkg-name" placeholder="e.g. 3 days a week" value={form.name} onChange={set('name')} maxLength={50} aria-invalid={!!errors.name || undefined} data-autofocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Price per month${currency ? ` (${currency})` : ''}`} htmlFor="pkg-price" error={errors.price}>
            <Input id="pkg-price" inputMode="decimal" placeholder="4000" value={form.price} onChange={set('price')} aria-invalid={!!errors.price || undefined} />
          </Field>
          <Field label="Days per week" htmlFor="pkg-days">
            <Select id="pkg-days" value={form.daysPerWeek} onChange={set('daysPerWeek')}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}
            </Select>
          </Field>
        </div>

        <div className="rounded-lg bg-surface-2/60 p-3">
          <p className="text-[14px] font-semibold">Money that goes to others</p>
          <p className="mt-0.5 text-[13px] text-muted">For example the gym takes 2000 of a 4000 package. This is taken out before your revenue is counted.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {form.shares.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input aria-label={`Share ${i + 1} name`} placeholder="Gym, Pool, Club..." value={s.label} maxLength={40} onChange={(e) => setShare(i, 'label', e.target.value)} className="min-w-0" />
                <Input aria-label={`Share ${i + 1} amount`} inputMode="decimal" placeholder="Amount" value={s.amount} onChange={(e) => setShare(i, 'amount', e.target.value)} className="!w-28 shrink-0 sm:!w-32" />
                <IconButton icon={PiX} label={`Remove share ${i + 1}`} size="sm" onClick={() => removeShare(i)} />
              </li>
            ))}
          </ul>
          {errors.shares && <p className="mt-2 text-[12px] text-danger" role="alert">{errors.shares}</p>}
          <Button size="sm" variant="ghost" icon={PiPlus} onClick={addShare} className="mt-2 -ml-2">Add where money goes</Button>
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface-2 p-3"><dt className="text-[12px] text-muted">Price</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(price, currency)}</dd></div>
          <div className="rounded-lg bg-surface-2 p-3"><dt className="text-[12px] text-muted">Passed on</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(passOn, currency)}</dd></div>
          <div className="rounded-lg bg-surface-2 p-3"><dt className="text-[12px] text-muted">You keep</dt><dd className={cx('mt-1 font-semibold tabular-nums', keep < 0 ? 'text-danger' : 'text-success')}>{formatMoney(keep, currency)}</dd></div>
        </dl>
        {errors.form && <p className="text-[13px] text-danger" role="alert">{errors.form}</p>}
      </form>
    </Dialog>
  );
};

const CurrencyCard = ({ currency, onSaved }) => {
  const [value, setValue] = useState(currency || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(currency || ''); }, [currency]);
  const dirty = value.trim().toUpperCase() !== (currency || '');

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/finance/settings', { currency: value });
      toast.success('Currency saved');
      onSaved();
    } catch (err) {
      toast.error(apiError(err, 'Could not save the currency'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 md:p-6">
      <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Currency" htmlFor="fin-currency" hint="Shown next to every amount, like EGP or USD. Leave empty for plain numbers." className="flex-1">
          <Input id="fin-currency" icon={PiCurrencyCircleDollar} maxLength={8} placeholder="EGP" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={!dirty} loading={saving} className="sm:mb-[26px]">Save</Button>
      </form>
    </Card>
  );
};

const FinancePackages = ({ data, reload }) => {
  const { packages, currency } = data;
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // null closed, 'new', or a package

  const active = packages.filter((p) => p.active);
  const archived = packages.filter((p) => !p.active);

  const setActive = async (p, value) => {
    try {
      await api.put(`/finance/packages/${p._id}`, { active: value });
      toast.success(value ? `${p.name} restored` : `${p.name} archived`);
      reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not update the package'));
    }
  };

  const remove = async (p) => {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      body: 'If athletes already had this package, it is archived instead so their months keep it. You can restore archived packages.',
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      const { data: res } = await api.delete(`/finance/packages/${p._id}`);
      toast.success(res.archived ? `${p.name} is in use, so it was archived` : `${p.name} deleted`);
      reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the package'));
    }
  };

  const card = (p) => {
    const passOn = sharesTotal(p.shares);
    return (
      <li key={p._id} className={cx('flex flex-col rounded-xl bg-surface-1 p-4 md:p-5', !p.active && 'opacity-70')}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[17px] font-semibold tracking-[-0.02em]">{p.name}</h3>
              {!p.active && <Badge>Archived</Badge>}
            </div>
            <p className="mt-0.5 text-[13px] text-muted">{p.daysPerWeek} {p.daysPerWeek === 1 ? 'day' : 'days'} a week</p>
          </div>
          <Menu label={`Actions for ${p.name}`} items={[
            { label: 'Edit', icon: PiPencilSimple, onSelect: () => setEditing(p) },
            p.active
              ? { label: 'Archive', icon: PiArchive, onSelect: () => setActive(p, false) }
              : { label: 'Restore', icon: PiArrowCounterClockwise, onSelect: () => setActive(p, true) },
            { label: 'Delete', icon: PiTrash, tone: 'danger', onSelect: () => remove(p) }
          ]} />
        </div>
        <p className="mt-4 font-display text-[30px] font-medium leading-none tracking-[-0.04em] tabular-nums">{formatMoney(p.price, currency)}</p>
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-line-soft pt-3 text-[13px]">
          {p.shares.map((s) => (
            <li key={s.label} className="flex justify-between gap-3"><span className="truncate text-muted">To {s.label}</span><span className="tabular-nums">{formatMoney(s.amount, currency)}</span></li>
          ))}
          <li className="flex justify-between gap-3 font-semibold"><span>You keep</span><span className="tabular-nums text-success">{formatMoney(p.price - passOn, currency)}</span></li>
        </ul>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <CardHeader
        title="Packages"
        description="Price per month, days a week, and what goes to the gym, pool or anyone else."
        actions={<Button icon={PiPlus} onClick={() => setEditing('new')}>New package</Button>}
      />
      {packages.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiPackage}
            title="No packages yet"
            body="For example: 3 days a week, 4000 a month, 2000 of it to the gym."
            action={<Button icon={PiPlus} onClick={() => setEditing('new')}>New package</Button>}
          />
        </Card>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{active.map(card)}</ul>
          {archived.length > 0 && (
            <div>
              <p className="mb-3 text-[13px] font-medium text-muted">Archived</p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{archived.map(card)}</ul>
            </div>
          )}
        </>
      )}
      <CurrencyCard currency={currency} onSaved={reload} />
      <PackageDialog
        open={!!editing}
        pkg={editing && editing !== 'new' ? editing : null}
        currency={currency}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />
    </div>
  );
};

export default FinancePackages;
