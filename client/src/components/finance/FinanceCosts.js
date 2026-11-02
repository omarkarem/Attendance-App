import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PiPlus, PiReceipt, PiPencilSimple, PiTrash, PiUser, PiBuildings, PiDotsThreeCircle } from 'react-icons/pi';
import api from '../../utils/api';
import { apiError } from '../../utils/browser';
import { Card, CardHeader, Badge, EmptyState } from '../ui/Display';
import Button from '../ui/Button';
import Menu from '../ui/Menu';
import Dialog from '../ui/Dialog';
import { Field, Input, Select } from '../ui/Form';
import { Segmented } from '../ui/Segmented';
import { useConfirm } from '../ui/ConfirmProvider';
import { formatMoney, monthLabel } from '../../utils/money';

const CATEGORIES = [
  { value: 'coach', label: 'Coach pay', icon: PiUser },
  { value: 'facility', label: 'Facility', icon: PiBuildings },
  { value: 'other', label: 'Other', icon: PiDotsThreeCircle }
];
const CATEGORY_LABEL = { coach: 'Coach pay', facility: 'Facilities', other: 'Other' };

const EMPTY = { label: '', amount: '', category: 'coach', coachId: '', recurring: 'monthly' };

const cleanNumber = (v) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

const CostDialog = ({ open, cost, month, coaches, currency, onClose, onSaved }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(cost ? {
      label: cost.label,
      amount: String(cost.amount),
      category: cost.category,
      coachId: cost.coach || '',
      recurring: cost.recurring ? 'monthly' : 'once'
    } : EMPTY);
  }, [open, cost]);

  const set = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setErrors({}); };

  // Picking a coach fills in the name when the field is still empty or was a coach's name.
  const pickCoach = (id) => {
    const coach = coaches.find((c) => c.id === id);
    setForm((f) => {
      const wasCoachName = !f.label.trim() || coaches.some((c) => c.name === f.label.trim());
      return { ...f, coachId: id, label: coach && wasCoachName ? coach.name : f.label };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.label.trim()) next.label = 'Say what the cost is for.';
    if (form.amount === '' || !Number.isFinite(Number(form.amount))) next.amount = 'Enter the amount.';
    if (Object.keys(next).length) { setErrors(next); return; }
    setSaving(true);
    try {
      const body = {
        label: form.label.trim(),
        amount: Number(form.amount),
        category: form.category,
        coachId: form.category === 'coach' ? (form.coachId || null) : null,
        recurring: form.recurring === 'monthly',
        month
      };
      if (cost) await api.put(`/finance/expenses/${cost._id}`, body, { params: { month } });
      else await api.post('/finance/expenses', body);
      toast.success(cost ? 'Cost saved' : 'Cost added');
      onSaved();
    } catch (err) {
      setErrors({ form: apiError(err, 'Could not save the cost') });
    } finally {
      setSaving(false);
    }
  };

  const startedEarlier = cost && cost.recurring && cost.startMonth < month;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={cost ? 'Edit cost' : 'Add a cost'}
      description={startedEarlier
        ? `Changes apply from ${monthLabel(month)} on. Months before keep the old amount.`
        : 'Coach pay, pool or gym rent, equipment: anything you pay out of your revenue.'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="cost-form" loading={saving}>{cost ? 'Save' : 'Add cost'}</Button>
        </>
      )}
    >
      <form id="cost-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Type">
          <Segmented label="Type of cost" value={form.category} onChange={(v) => set('category', v)} options={CATEGORIES} stretch />
        </Field>
        {form.category === 'coach' && coaches.length > 0 && (
          <Field label="Coach (optional)" htmlFor="cost-coach" hint="Link the pay to a coach on your team, or type any name below.">
            <Select id="cost-coach" value={form.coachId} onChange={(e) => pickCoach(e.target.value)}>
              <option value="">Not linked</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="What is it for" htmlFor="cost-label" error={errors.label}>
          <Input
            id="cost-label"
            maxLength={50}
            placeholder={form.category === 'coach' ? 'Coach name' : form.category === 'facility' ? 'Pool rent, gym...' : 'Equipment, transport...'}
            value={form.label}
            onChange={(e) => set('label', e.target.value)}
            aria-invalid={!!errors.label || undefined}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Amount${currency ? ` (${currency})` : ''}`} htmlFor="cost-amount" error={errors.amount}>
            <Input id="cost-amount" inputMode="decimal" placeholder="0" value={form.amount} onChange={(e) => set('amount', cleanNumber(e.target.value))} aria-invalid={!!errors.amount || undefined} />
          </Field>
          <Field label="Repeats" htmlFor="cost-repeat" hint={form.recurring === 'monthly' ? `Every month from ${monthLabel(cost && !startedEarlier ? cost.startMonth : month, 'MMM yyyy')} until you remove it.` : `Only in ${monthLabel(month, 'MMMM yyyy')}.`}>
            <Select id="cost-repeat" value={form.recurring} onChange={(e) => set('recurring', e.target.value)}>
              <option value="monthly">Every month</option>
              <option value="once">This month only</option>
            </Select>
          </Field>
        </div>
        {errors.form && <p className="text-[13px] text-danger" role="alert">{errors.form}</p>}
      </form>
    </Dialog>
  );
};

const FinanceCosts = ({ data, month, reload }) => {
  const { expenses, coaches, currency, summary } = data;
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);
  const coachName = (id) => coaches.find((c) => c.id === id)?.name;

  const remove = async (e) => {
    const stop = e.recurring && e.startMonth < month;
    const ok = await confirm(stop ? {
      title: `Stop ${e.label} from ${monthLabel(month)}?`,
      body: `Months before ${monthLabel(month)} keep this cost. It no longer counts from ${monthLabel(month)} on.`,
      confirmLabel: 'Stop cost',
      tone: 'danger'
    } : {
      title: `Remove ${e.label}?`,
      body: e.recurring ? `It started in ${monthLabel(month)}, so it is removed from every month.` : `It is removed from ${monthLabel(month)}.`,
      confirmLabel: 'Remove',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      await api.delete(`/finance/expenses/${e._id}`, { params: { month } });
      toast.success(stop ? `${e.label} stopped` : `${e.label} removed`);
      reload();
    } catch (err) {
      toast.error(apiError(err, 'Could not remove the cost'));
    }
  };

  const when = (e) => {
    if (!e.recurring) return 'This month only';
    const since = e.startMonth < month ? `Monthly since ${monthLabel(e.startMonth, 'MMM yyyy')}` : 'Monthly, from this month';
    return e.endMonth ? `${since}, until ${monthLabel(e.endMonth, 'MMM yyyy')}` : since;
  };

  const groups = CATEGORIES.map((c) => ({ ...c, items: expenses.filter((e) => e.category === c.value) })).filter((g) => g.items.length);

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <CardHeader
        title={`Costs in ${monthLabel(month)}`}
        description={`${formatMoney(summary.costs, currency)} in total. Money passed on from packages (gym, pool) is set on each package and not listed here.`}
        actions={<Button icon={PiPlus} onClick={() => setEditing('new')}>Add a cost</Button>}
      />
      {expenses.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiReceipt}
            title="No costs this month"
            body="Add what you pay out: each coach's pay, pool or gym rent, equipment. Monthly costs repeat on their own."
            action={<Button icon={PiPlus} onClick={() => setEditing('new')}>Add a cost</Button>}
          />
        </Card>
      ) : groups.map((g) => (
        <Card key={g.value}>
          <div className="flex items-center justify-between px-4 pt-4">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold"><g.icon className="h-4 w-4 text-muted" aria-hidden="true" />{CATEGORY_LABEL[g.value]}</h3>
            <span className="text-[14px] font-semibold tabular-nums">{formatMoney(g.items.reduce((sum, e) => sum + e.amount, 0), currency)}</span>
          </div>
          <ul className="mt-2 divide-y divide-line-soft">
            {g.items.map((e) => (
              <li key={e._id} className="flex items-center gap-3 py-3 pl-4 pr-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium">{e.label}</span>
                    {e.coach && coachName(e.coach) && coachName(e.coach) !== e.label && <Badge>{coachName(e.coach)}</Badge>}
                  </div>
                  <p className="truncate text-[12px] text-muted">{when(e)}</p>
                </div>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatMoney(e.amount, currency)}</span>
                <Menu label={`Actions for ${e.label}`} items={[
                  { label: 'Edit', icon: PiPencilSimple, onSelect: () => setEditing(e) },
                  { label: e.recurring && e.startMonth < month ? 'Stop from this month' : 'Remove', icon: PiTrash, tone: 'danger', onSelect: () => remove(e) }
                ]} />
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <CostDialog
        open={!!editing}
        cost={editing && editing !== 'new' ? editing : null}
        month={month}
        coaches={coaches}
        currency={currency}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
      />
    </div>
  );
};

export default FinanceCosts;
