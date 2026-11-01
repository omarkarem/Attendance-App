import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  PiCheck, PiMagnifyingGlass, PiProhibit, PiArrowCounterClockwise, PiTrash,
  PiShieldCheck, PiShieldSlash, PiWarningCircle, PiHourglassMedium, PiUserCircle, PiLockSimple
} from 'react-icons/pi';
import api from '../utils/api';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import { apiError } from '../utils/browser';
import { Card, PageHeader, Avatar, Badge, Skeleton, EmptyState } from '../components/ui/Display';
import Button from '../components/ui/Button';
import Menu from '../components/ui/Menu';
import { Input } from '../components/ui/Form';
import { Segmented } from '../components/ui/Segmented';
import { useConfirm } from '../components/ui/ConfirmProvider';

const TABS = ['pending', 'active', 'revoked'];

const EMPTY = {
  pending: { icon: PiHourglassMedium, title: 'Nobody is waiting', body: 'New sign-ups appear here until you give them access.' },
  active: { icon: PiUserCircle, title: 'No accounts with access', body: 'Approve a sign-up to give it access to AttendTrack.' },
  revoked: { icon: PiProhibit, title: 'No revoked accounts', body: 'Accounts you revoke appear here. Their data is kept, and you can restore access any time.' }
};

const day = (value) => (value ? format(new Date(value), 'MMM d, yyyy') : null);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const metaLine = (a) => {
  if (a.status === 'pending') return `Signed up ${day(a.createdAt)}`;
  if (a.status === 'revoked') return `Revoked ${day(a.statusChangedAt || a.createdAt)}, ${plural(a.athleteCount, 'athlete')}`;
  return `${plural(a.athleteCount, 'athlete')}, joined ${day(a.createdAt)}`;
};

const Accounts = () => {
  usePageTitle('Accounts');
  const confirm = useConfirm();
  const { user, refreshUser } = useAuth();
  const [params, setParams] = useSearchParams();

  const [accounts, setAccounts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await api.get('/admin/users');
      setAccounts(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = TABS.reduce((acc, t) => ({ ...acc, [t]: accounts.filter((a) => a.status === t).length }), {});
  // Open on the waiting list when someone is waiting.
  const fallbackTab = (status === 'ready' ? counts.pending : user?.pendingCount) ? 'pending' : 'active';
  const tab = TABS.includes(params.get('show')) ? params.get('show') : fallbackTab;
  const setTab = (v) => setParams({ show: v }, { replace: true });

  const update = async (a, body, done) => {
    setBusy(a._id);
    try {
      const { data } = await api.patch(`/admin/users/${a._id}`, body);
      setAccounts((list) => list.map((x) => (x._id === data._id ? data : x)));
      toast.success(done);
      refreshUser().catch(() => {});
    } catch (err) {
      toast.error(apiError(err, 'Could not update the account'));
    } finally {
      setBusy(null);
    }
  };

  const approve = (a) => update(a, { status: 'active' }, `${a.name} now has access`);
  const restore = (a) => update(a, { status: 'active' }, `Access restored for ${a.name}`);

  const revoke = async (a) => {
    const ok = await confirm({
      title: `Revoke access for ${a.name}?`,
      body: 'They are signed out of the app straight away. Their athletes and records are kept, and you can restore access any time.',
      confirmLabel: 'Revoke access',
      tone: 'danger'
    });
    if (ok) update(a, { status: 'revoked' }, `Access revoked for ${a.name}`);
  };

  const setAdmin = async (a, admin) => {
    const ok = await confirm(admin ? {
      title: `Make ${a.name} an admin?`,
      body: 'Admins can approve sign-ups, revoke access and manage other admins.',
      confirmLabel: 'Make admin'
    } : {
      title: `Remove ${a.name} as admin?`,
      body: 'They keep access to their own coaching data but can no longer manage accounts.',
      confirmLabel: 'Remove admin'
    });
    if (ok) update(a, { role: admin ? 'admin' : 'coach' }, admin ? `${a.name} is now an admin` : `${a.name} is no longer an admin`);
  };

  const decline = async (a) => {
    const ok = await confirm({
      title: `Decline ${a.name}?`,
      body: `The account for ${a.email} is deleted. They can sign up again later.`,
      confirmLabel: 'Decline and delete',
      tone: 'danger'
    });
    if (!ok) return;
    setBusy(a._id);
    try {
      await api.delete(`/admin/users/${a._id}`);
      setAccounts((list) => list.filter((x) => x._id !== a._id));
      toast.success(`${a.name} declined`);
      refreshUser().catch(() => {});
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the account'));
    } finally {
      setBusy(null);
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = accounts.filter((a) => a.status === tab
    && (a.name.toLowerCase().includes(query) || a.email.toLowerCase().includes(query)));

  const actionsFor = (a) => {
    const self = a._id === user?.id;
    if (self || a.locked) {
      return (
        <span className="inline-flex items-center gap-1.5 pr-2 text-[12px] text-muted" title={a.locked ? 'Set by ADMIN_EMAILS on the server' : undefined}>
          {a.locked && <PiLockSimple className="h-3.5 w-3.5" aria-hidden="true" />}
          {self ? 'This is you' : 'Server admin'}
        </span>
      );
    }
    const loading = busy === a._id;
    if (a.status === 'pending') {
      return (
        <>
          <Button size="sm" icon={PiCheck} loading={loading} onClick={() => approve(a)}>Approve</Button>
          <Menu label={`More actions for ${a.name}`} items={[
            { label: 'Decline and delete', icon: PiTrash, tone: 'danger', onSelect: () => decline(a) }
          ]} />
        </>
      );
    }
    if (a.status === 'revoked') {
      return <Button size="sm" variant="secondary" icon={PiArrowCounterClockwise} loading={loading} onClick={() => restore(a)}>Restore</Button>;
    }
    return (
      <Menu label={`Actions for ${a.name}`} items={[
        a.role === 'admin'
          ? { label: 'Remove admin', icon: PiShieldSlash, onSelect: () => setAdmin(a, false) }
          : { label: 'Make admin', icon: PiShieldCheck, onSelect: () => setAdmin(a, true) },
        { label: 'Revoke access', icon: PiProhibit, tone: 'danger', onSelect: () => revoke(a) }
      ]} />
    );
  };

  const empty = EMPTY[tab];

  return (
    <>
      <PageHeader
        title="Accounts"
        description={status === 'ready'
          ? (counts.pending ? `${plural(counts.pending, 'account')} waiting for access.` : 'Nobody is waiting for access.')
          : 'Give coaches access to AttendTrack, or take it away.'}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input icon={PiMagnifyingGlass} placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search accounts" />
        </div>
        <Segmented
          label="Access"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: 'Waiting', count: status === 'ready' ? counts.pending : undefined },
            { value: 'active', label: 'Active', count: status === 'ready' ? counts.active : undefined },
            { value: 'revoked', label: 'Revoked', count: status === 'ready' ? counts.revoked : undefined }
          ]}
          className="self-start sm:self-auto"
        />
      </div>

      {status === 'loading' ? (
        <Card className="divide-y divide-line-soft" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1"><Skeleton className="mb-2 h-4 w-40" /><Skeleton className="h-3 w-56" /></div></div>
          ))}
        </Card>
      ) : status === 'error' ? (
        <Card><EmptyState icon={PiWarningCircle} title="Could not load accounts" action={<Button onClick={load}>Try again</Button>} /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          {query
            ? <EmptyState icon={PiMagnifyingGlass} title="No matches" body={`No account on this list matches “${search.trim()}”.`} />
            : <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />}
        </Card>
      ) : (
        <Card as="ul" className="divide-y divide-line-soft animate-rise">
          {filtered.map((a) => (
            <li key={a._id} className="flex items-center gap-3 p-4 pr-2 sm:pr-3">
              <Avatar name={a.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-medium">{a.name}</span>
                  {a.role === 'admin' && <Badge tone="info" icon={PiShieldCheck}>Admin</Badge>}
                </div>
                <p className="truncate text-[13px] text-muted">{a.email}</p>
                <p className="mt-0.5 truncate text-[12px] text-muted">{metaLine(a)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">{actionsFor(a)}</div>
            </li>
          ))}
        </Card>
      )}
    </>
  );
};

export default Accounts;
