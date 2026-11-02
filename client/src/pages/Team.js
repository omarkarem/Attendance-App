import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  PiUserPlus, PiSignIn, PiCheck, PiX, PiWarningCircle, PiUsersFour, PiEnvelopeSimple,
  PiUserMinus, PiDoorOpen, PiArrowSquareOut, PiHourglassMedium, PiWallet
} from 'react-icons/pi';
import api from '../utils/api';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import { apiError } from '../utils/browser';
import { Card, CardHeader, PageHeader, Avatar, Badge, Skeleton, EmptyState } from '../components/ui/Display';
import Button from '../components/ui/Button';
import Menu from '../components/ui/Menu';
import Dialog from '../components/ui/Dialog';
import { Field, Input, Select, Switch } from '../components/ui/Form';
import { useConfirm } from '../components/ui/ConfirmProvider';

const ACCESS_LABEL = { none: 'No access', view: 'View only', edit: 'Full access' };

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const day = (value) => (value ? format(new Date(value), 'MMM d, yyyy') : null);

const REQUEST_COPY = {
  invite: {
    title: 'Invite a coach',
    description: 'They get the invite the next time they open AttendTrack. Once they accept, you can open their account, manage their athletes and sessions, and include them in finance.',
    submit: 'Send invite'
  },
  join: {
    title: 'Join a head coach',
    description: 'Ask a head coach to add you to their team. They can then open and manage your account, and choose what of theirs you can see.',
    submit: 'Send request'
  }
};

const RequestDialog = ({ type, onClose, onSent }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const copy = REQUEST_COPY[type] || REQUEST_COPY.invite;

  useEffect(() => { setEmail(''); setError(''); }, [type]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Enter the email they use for AttendTrack.'); return; }
    setSaving(true);
    try {
      await api.post('/team/requests', { type, email: email.trim() });
      toast.success(type === 'invite' ? 'Invite sent' : 'Request sent');
      onSent();
    } catch (err) {
      setError(apiError(err, 'Could not send the request'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!type}
      onClose={onClose}
      title={copy.title}
      description={copy.description}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="team-request" loading={saving}>{copy.submit}</Button>
        </>
      )}
    >
      <form id="team-request" onSubmit={submit} noValidate>
        <Field label="Their email" htmlFor="team-email" error={error}>
          <Input
            id="team-email"
            type="email"
            icon={PiEnvelopeSimple}
            autoComplete="off"
            placeholder="coach@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            aria-invalid={!!error || undefined}
            data-autofocus
          />
        </Field>
      </form>
    </Dialog>
  );
};

const RequestRow = ({ r, busy, onAccept, onDecline }) => {
  const other = r.type === 'invite' ? r.head : r.member;
  const text = r.incoming
    ? (r.type === 'invite' ? `${other.name} invited you to coach under them` : `${other.name} wants to coach under you`)
    : (r.type === 'invite' ? `You invited ${other.name} to your team` : `You asked to coach under ${other.name}`);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={other.name} />
        <div className="min-w-0">
          <p className="text-[15px] font-medium [overflow-wrap:anywhere]">{text}</p>
          <p className="truncate text-[13px] text-muted">{other.email} · {day(r.createdAt)}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 pl-[52px] sm:pl-0">
        {r.incoming ? (
          <>
            <Button size="sm" variant="secondary" icon={PiX} disabled={busy} onClick={() => onDecline(r)}>Decline</Button>
            <Button size="sm" icon={PiCheck} loading={busy} onClick={() => onAccept(r)}>Accept</Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onDecline(r)}>Cancel request</Button>
        )}
      </div>
    </li>
  );
};

// A coach under you, with what they may see of yours.
const MemberRow = ({ m, onOpen, onAccess, onRemove, busy }) => (
  <li className="p-4">
    <div className="flex items-center gap-3">
      <Avatar name={m.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{m.name}</p>
        <p className="truncate text-[13px] text-muted">{m.email}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted">
          {plural(m.athleteCount, 'athlete')} · {plural(m.sessionsThisMonth, 'session')} this month{m.joinedAt ? ` · joined ${day(m.joinedAt)}` : ''}
        </p>
      </div>
      <Button size="sm" variant="secondary" icon={PiArrowSquareOut} onClick={() => onOpen(m)} disabled={m.status !== 'active'}>
        <span className="hidden sm:inline">Open account</span>
        <span className="sm:hidden">Open</span>
      </Button>
      <Menu label={`More actions for ${m.name}`} items={[
        { label: 'Remove from team', icon: PiUserMinus, tone: 'danger', onSelect: () => onRemove(m) }
      ]} />
    </div>
    <div className="mt-3 grid gap-3 rounded-lg bg-surface-2/60 p-3 sm:ml-[52px] sm:grid-cols-2">
      <Field label="Access to your data" htmlFor={`access-${m.id}`} hint={m.access.data === 'edit' ? 'Can add, change and delete your athletes, sessions and tests.' : m.access.data === 'view' ? 'Can open your account but not change anything.' : 'Cannot open your account.'}>
        <Select id={`access-${m.id}`} size="sm" value={m.access.data} disabled={busy} onChange={(e) => onAccess(m, { data: e.target.value })}>
          <option value="none">No access</option>
          <option value="view">View only</option>
          <option value="edit">Full access</option>
        </Select>
      </Field>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-[13px] font-medium text-muted" id={`finance-${m.id}`}>Finance</span>
        <div className="flex h-10 items-center gap-3 sm:h-9">
          <Switch checked={m.access.finance} disabled={busy} onChange={(v) => onAccess(m, { finance: v })} label={`Finance access for ${m.name}`} />
          <span className="text-[14px]">{m.access.finance ? 'Can see revenue, packages and costs' : 'Hidden'}</span>
        </div>
      </div>
    </div>
  </li>
);

const Team = () => {
  usePageTitle('Coaches');
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { refreshUser, switchAccount } = useAuth();
  const [team, setTeam] = useState(null);
  const [status, setStatus] = useState('loading');
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/team');
      setTeam(data);
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Request counts and accounts in the switcher come from /auth/me.
  const reload = () => Promise.all([load(), refreshUser().catch(() => {})]);

  const act = async (id, fn, done) => {
    setBusy(id);
    try {
      const { data } = await fn();
      toast.success(done || data?.message);
      await reload();
    } catch (err) {
      toast.error(apiError(err, 'Something went wrong'));
      load();
    } finally {
      setBusy(null);
    }
  };

  const accept = async (r) => {
    if (r.type === 'invite') {
      const ok = await confirm({
        title: `Coach under ${r.head.name}?`,
        body: `${r.head.name} will be able to open your account and manage your athletes, sessions and tests. Your finance pages switch to ${r.head.name}'s team finance, and only show if they give you access.`,
        confirmLabel: 'Accept'
      });
      if (!ok) return;
    }
    act(r._id, () => api.post(`/team/requests/${r._id}/accept`));
  };
  const decline = (r) => act(r._id, () => api.post(`/team/requests/${r._id}/decline`));

  const changeAccess = (m, body) => {
    setTeam((t) => ({ ...t, members: t.members.map((x) => (x.id === m.id ? { ...x, access: { ...x.access, ...body } } : x)) }));
    const label = body.data !== undefined
      ? `${m.name}: ${ACCESS_LABEL[body.data].toLowerCase()} to your data`
      : `${m.name}: finance ${body.finance ? 'shown' : 'hidden'}`;
    act(m.id, () => api.patch(`/team/members/${m.id}`, body), label);
  };

  const remove = async (m) => {
    const ok = await confirm({
      title: `Remove ${m.name} from your team?`,
      body: 'You can no longer open their account, and their athletes leave your finance from now on. Their athletes, sessions and records stay with them, and payments already recorded stay in your finance history.',
      confirmLabel: 'Remove',
      tone: 'danger'
    });
    if (ok) act(m.id, () => api.delete(`/team/members/${m.id}`));
  };

  const leave = async () => {
    const ok = await confirm({
      title: `Leave ${team.head.name}'s team?`,
      body: `${team.head.name} can no longer open your account. Your athletes and records stay with you.`,
      confirmLabel: 'Leave team',
      tone: 'danger'
    });
    if (ok) act('leave', () => api.post('/team/leave'));
  };

  const open = (ws) => {
    switchAccount({ ...ws, access: ws.access || 'edit', relation: ws.relation || 'member' });
    navigate('/');
  };

  const isMember = !!team?.head;
  const canInvite = status === 'ready' && !isMember;
  const canJoin = status === 'ready' && !isMember && team.members.length === 0;

  const incoming = team?.incoming || [];
  const outgoing = team?.outgoing || [];

  return (
    <>
      <PageHeader
        title="Coaches"
        description={isMember
          ? `You coach under ${team.head.name}.`
          : 'Coaches under you: open their accounts, manage their athletes, and choose what they can see of yours.'}
        actions={status === 'ready' && (
          <>
            {canJoin && <Button variant="secondary" icon={PiSignIn} onClick={() => setDialog('join')}>Join a head coach</Button>}
            {canInvite && <Button icon={PiUserPlus} onClick={() => setDialog('invite')}>Invite a coach</Button>}
          </>
        )}
      />

      {status === 'loading' ? (
        <Card className="divide-y divide-line-soft" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1"><Skeleton className="mb-2 h-4 w-40" /><Skeleton className="h-3 w-56" /></div></div>
          ))}
        </Card>
      ) : status === 'error' ? (
        <Card><EmptyState icon={PiWarningCircle} title="Could not load your team" action={<Button onClick={load}>Try again</Button>} /></Card>
      ) : (
        <div className="flex flex-col gap-6 animate-rise">
          {incoming.length > 0 && (
            <Card>
              <CardHeader className="px-4 pt-4" title="Waiting for you" description={plural(incoming.length, 'request') + ' to answer'} />
              <ul className="divide-y divide-line-soft">
                {incoming.map((r) => <RequestRow key={r._id} r={r} busy={busy === r._id} onAccept={accept} onDecline={decline} />)}
              </ul>
            </Card>
          )}

          {isMember ? (
            <Card className="p-4 md:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={team.head.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-muted">Your head coach</p>
                  <p className="truncate font-display text-[24px] font-medium tracking-[-0.03em]">{team.head.name}</p>
                  <p className="truncate text-[13px] text-muted">{team.head.email}</p>
                </div>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-surface-2 p-3">
                  <dt className="text-[13px] text-muted">Their data</dt>
                  <dd className="mt-1 text-[15px] font-medium">{ACCESS_LABEL[team.access.data]}</dd>
                </div>
                <div className="rounded-lg bg-surface-2 p-3">
                  <dt className="text-[13px] text-muted">Finance</dt>
                  <dd className="mt-1 flex items-center gap-2 text-[15px] font-medium">
                    {team.access.finance ? <><PiWallet className="h-4 w-4" aria-hidden="true" />Can see team finance</> : 'No access'}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-[13px] text-muted">{team.head.name} can open your account and manage your athletes, sessions and tests. They choose what you can see of theirs.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {team.access.data !== 'none' && (
                  <Button icon={PiArrowSquareOut} onClick={() => open({ ...team.head, relation: 'head', access: team.access.data })}>
                    Open {team.head.name}&rsquo;s account
                  </Button>
                )}
                <Button variant="danger" icon={PiDoorOpen} loading={busy === 'leave'} onClick={leave}>Leave team</Button>
              </div>
            </Card>
          ) : team.members.length > 0 ? (
            <Card>
              <CardHeader className="px-4 pt-4" title="Coaches under you" description={`${team.members.length} ${team.members.length === 1 ? 'coach' : 'coaches'}`} />
              <ul className="divide-y divide-line-soft">
                {team.members.map((m) => (
                  <MemberRow key={m.id} m={m} busy={busy === m.id} onOpen={open} onAccess={changeAccess} onRemove={remove} />
                ))}
              </ul>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={PiUsersFour}
                title="No coaches under you yet"
                body="Invite a coach by the email they use for AttendTrack. Once they accept, you can open their account, add or remove their athletes, follow their sessions and attendance, and choose whether they see your data and finance."
                action={<Button icon={PiUserPlus} onClick={() => setDialog('invite')}>Invite a coach</Button>}
              />
            </Card>
          )}

          {outgoing.length > 0 && (
            <Card>
              <CardHeader className="px-4 pt-4" title="Sent" description="Waiting for an answer" actions={<Badge icon={PiHourglassMedium}>{outgoing.length}</Badge>} />
              <ul className="divide-y divide-line-soft">
                {outgoing.map((r) => <RequestRow key={r._id} r={r} busy={busy === r._id} onAccept={accept} onDecline={decline} />)}
              </ul>
            </Card>
          )}
        </div>
      )}

      <RequestDialog type={dialog} onClose={() => setDialog(null)} onSent={() => { setDialog(null); reload(); }} />
    </>
  );
};

export default Team;
